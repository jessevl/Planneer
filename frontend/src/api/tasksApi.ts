/**
 * @file tasksApi.ts
 * @description Task API layer with PocketBase integration
 * @app TASKS APP ONLY
 *
 * Provides workspace-scoped task operations via PocketBase.
 * All operations require a valid workspace to be selected.
 *
 * =============================================================================
 * ARCHITECTURE
 * =============================================================================
 *
 * - All tasks belong to a workspace (team-based multi-tenancy)
 * - Access rules on PocketBase ensure users can only access their workspace's data
 * - Subtasks are embedded JSON for simplicity
 * - Recurring tasks use pattern-based generation
 */
import type { Task } from '@/types/task';
import { devLog, devWarn } from '@/lib/config';
import {
  pb,
  collections,
  buildWorkspaceFilter,
  fetchAllInWorkspace,
  generateId,
  createInWorkspace,
  updateRecord,
  deleteRecord,
  safeFilter,
  batchUpdate,
} from '@/lib/pocketbase';
import { getCurrentWorkspaceIdOrNull } from '@/stores/workspaceStore';

// ============================================================================
// FETCH OPERATIONS
// ============================================================================

/**
 * Fetch all tasks for the current workspace.
 *
 * @param options.todayISO - Today's date for filtering overdue completed tasks
 * @param options.includeCompleted - Include all completed tasks (default: false)
 */
export async function fetchTasks(options?: {
  todayISO?: string;
  includeCompleted?: boolean;
}): Promise<Task[]> {
  const today = options?.todayISO || new Date().toISOString().split('T')[0];

  const workspaceId = getCurrentWorkspaceIdOrNull();
  devLog('[tasksApi] fetchTasks called, workspaceId:', workspaceId, 'authValid:', pb.authStore.isValid);
  
  if (!workspaceId) {
    devWarn('[tasksApi] No workspace selected, returning empty tasks');
    return [];
  }

  // Build filter to exclude completed overdue tasks
  // For empty dates, check both empty string and null
  let filter: string | undefined;
  if (!options?.includeCompleted) {
    filter = safeFilter(
      'completed = false || dueDate >= {:today} || dueDate = "" || dueDate = null',
      { today }
    );
  }

  return fetchAllInWorkspace<Task>('tasks', {
    workspaceId,
    filter,
    sort: 'dueDate,-created',
    expand: 'parentPageId',
  });
}

/**
 * Fetch all task IDs for the current workspace.
 * Used for reconciliation/purging of deleted tasks.
 */
export async function fetchAllTaskIds(): Promise<string[]> {
  const workspaceId = getCurrentWorkspaceIdOrNull();
  if (!workspaceId) return [];

  try {
    const result = await pb.collection('tasks').getFullList({
      filter: buildWorkspaceFilter(workspaceId),
      fields: 'id',
    });

    return result.map(record => record.id);
  } catch (e) {
    console.error('[tasksApi] fetchAllTaskIds error:', e);
    throw e; // Rethrow to prevent accidental purge
  }
}

/**
 * Minimal task data for completion status sync.
 * Used to reconcile completion status for tasks not included in main fetch.
 */
export interface TaskCompletionInfo {
  id: string;
  completed: boolean;
  completedAt: string | null;
}

/**
 * Fetch minimal task data (id, completed, completedAt) for all tasks.
 * Used to sync completion status for tasks that weren't included in the main fetch
 * (e.g., old completed tasks that were completed on another device).
 */
export async function fetchAllTaskCompletionStatus(): Promise<TaskCompletionInfo[]> {
  const workspaceId = getCurrentWorkspaceIdOrNull();
  if (!workspaceId) return [];

  try {
    const result = await pb.collection('tasks').getFullList({
      filter: buildWorkspaceFilter(workspaceId),
      fields: 'id,completed,completedAt',
    });

    return result.map(record => ({
      id: record.id,
      completed: record.completed as boolean,
      completedAt: (record.completedAt as string) || null,
    }));
  } catch (e) {
    console.error('[tasksApi] fetchAllTaskCompletionStatus error:', e);
    throw e;
  }
}

/**
 * Fetch tasks for a specific parent page (task collection)
 */
export async function fetchTasksByParentPage(
  parentPageId: string,
  options?: { includeCompleted?: boolean }
): Promise<Task[]> {
  const workspaceId = getCurrentWorkspaceIdOrNull();
  if (!workspaceId) return [];

  let filter = safeFilter('parentPageId = {:parentPageId}', { parentPageId });
  if (!options?.includeCompleted) {
    filter += ' && completed = false';
  }

  return fetchAllInWorkspace<Task>('tasks', {
    workspaceId,
    filter,
    sort: 'dueDate',
  });
}

/** @deprecated Use fetchTasksByParentPage instead */
export const fetchTasksByPage = fetchTasksByParentPage;

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Create a new task in a workspace
 * @param data - Task data (id and workspace are optional - will use defaults if not provided)
 */
export async function createTask(
  data: Omit<Task, 'workspace'> & { id?: string; workspace?: string }
): Promise<Task> {
  const workspaceId = data.workspace || getCurrentWorkspaceIdOrNull();
  if (!workspaceId) throw new Error('No workspace selected');

  const pbData = {
    ...data,
    id: data.id || generateId(),
    completed: data.completed ?? false,
    subtasks: data.subtasks ?? [],
    createdBy: pb.authStore.record?.id,
  };

  return createInWorkspace<Task>('tasks', workspaceId, pbData);
}

/**
 * Update an existing task
 */
export async function updateTask(
  id: string,
  updates: Partial<Task>
): Promise<Task> {
  return updateRecord<Task>('tasks', id, updates);
}

/**
 * Delete a task
 */
export async function deleteTask(id: string): Promise<void> {
  return deleteRecord('tasks', id);
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Batch update multiple tasks (for reordering, bulk changes)
 * Uses PocketBase batch API - single request instead of N requests.
 */
export async function batchUpdateTasks(
  updates: Array<{ id: string; updates: Partial<Task> }>
): Promise<void> {

  await batchUpdate('tasks', updates.map(({ id, updates: u }) => ({ id, data: u as Record<string, unknown> })));
}

// ============================================================================
// STATS & HISTORY
// ============================================================================

/**
 * Get tasks completed within a date range (for productivity stats)
 */
export async function getCompletedTasksInRange(
  startDate: string,
  endDate: string
): Promise<Task[]> {
  const workspaceId = getCurrentWorkspaceIdOrNull();
  if (!workspaceId) return [];

  const filter = safeFilter(
    'completed = true && completedAt >= {:startDate} && completedAt <= {:endDate}',
    { startDate, endDate: `${endDate}T23:59:59` }
  );

  return fetchAllInWorkspace<Task>('tasks', {
    workspaceId,
    filter,
    sort: '-completedAt',
  });
}

/**
 * Get productivity stats for a date range
 */
export async function getProductivityStats(
  startDate: string,
  endDate: string
): Promise<{
  totalCompleted: number;
  completedByDate: Record<string, number>;
  averagePerDay: number;
}> {
  const completedTasks = await getCompletedTasksInRange(startDate, endDate);

  const completedByDate: Record<string, number> = {};
  completedTasks.forEach((t) => {
    if (t.completedAt) {
      const date = t.completedAt.split('T')[0];
      completedByDate[date] = (completedByDate[date] || 0) + 1;
    }
  });

  const days = Object.keys(completedByDate).length || 1;

  return {
    totalCompleted: completedTasks.length,
    completedByDate,
    averagePerDay: completedTasks.length / days,
  };
}

// ============================================================================
// RECURRING TASKS
// ============================================================================

/**
 * Complete a recurring task and create the next instance
 */
export async function completeRecurringTask(
  taskId: string,
  nextTask: Omit<Task, 'id' | 'workspace'> | null
): Promise<{ completedTask: Task; newTask: Task | null }> {
  // Mark current task as completed (remove recurrence pattern)
  const completedTask = await updateTask(taskId, {
    completed: true,
    completedAt: new Date().toISOString(),
    recurrence: undefined,
  });

  // Create next instance if recurrence continues
  // Cast is safe because createTask makes id optional
  const newTask = nextTask 
    ? await createTask(nextTask as Omit<Task, 'workspace'> & { id?: string }) 
    : null;

  return { completedTask, newTask };
}

/**
 * Get all recurring task templates (incomplete tasks with recurrence)
 */
export async function getRecurringTasks(): Promise<Task[]> {
  const workspaceId = getCurrentWorkspaceIdOrNull();
  if (!workspaceId) return [];

  // Note: PocketBase JSON filter syntax may vary
  return fetchAllInWorkspace<Task>('tasks', {
    workspaceId,
    filter: 'completed = false && recurrence != null',
  });
}

/**
 * Get completion history for a recurring task lineage
 */
export async function getRecurringTaskHistory(
  recurringParentId: string
): Promise<Task[]> {
  const workspaceId = getCurrentWorkspaceIdOrNull();
  if (!workspaceId) return [];

  return fetchAllInWorkspace<Task>('tasks', {
    workspaceId,
    filter: safeFilter('recurringParentId = {:recurringParentId} && completed = true', { recurringParentId }),
    sort: '-completedAt',
  });
}

// ============================================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribe to task changes in the current workspace
 * @returns Unsubscribe function
 */
export function subscribeToTasks(
  callback: (action: 'create' | 'update' | 'delete', task: Task) => void
): () => void {
  const workspaceId = getCurrentWorkspaceIdOrNull();
  if (!workspaceId) return () => {};

  collections.tasks().subscribe(
    '*',
    (e) => {
      // Only process events for current workspace
      const task = e.record as Task;
      if (task.workspace === workspaceId) {
        callback(e.action as 'create' | 'update' | 'delete', task);
      }
    },
    {
      filter: buildWorkspaceFilter(workspaceId),
    }
  );

  return () => {
    try {
      if (pb.authStore.isValid) {
        collections.tasks().unsubscribe('*');
      }
    } catch (err) {
      console.warn('[tasksApi] Failed to unsubscribe from tasks:', err);
    }
  };
}
