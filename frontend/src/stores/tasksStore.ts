/**
 * @file tasksStore.ts
 * @description Task state management with Zustand
 * @app TASKS APP ONLY - Core task data management
 * 
 * Manages all task state using a normalized pattern:
 * - tasksById: Record<string, Task> for O(1) lookups
 * - taskOrder: string[] for ordered iteration
 * 
 * Uses offline-first sync adapter for data operations:
 * - Local changes are saved to IndexedDB immediately
 * - Changes are queued for sync to server
 * - Remote changes flow through syncEngine events
 * 
 * RECURRING TASKS:
 * When a recurring task is completed, handleRecurrenceCompletion() is called:
 * 1. Calculate next due date using recurrenceUtils
 * 2. Create new task instance with updated recurrence pattern
 * 3. Original task remains completed for history
 */
import { useMemo } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { devtools } from 'zustand/middleware';
import type { Task, Subtask, RecurrencePattern, LinkedItem } from '@/types/task';
import { offlineCreateTask, offlineUpdateTask, offlineDeleteTask } from '@/lib/syncAdapter';
import { syncEngine, type DataChangeEvent } from '@/lib/syncEngine/index';
import { getNextDueDate } from '@/lib/recurrenceUtils';
import { SUBTASKS } from '@/lib/config';
import { toastSuccess, toastInfo } from '@/components/ui';
import { usePagesStore } from './pagesStore';
import { dayjs, isOverdue } from '@/lib/dateUtils';

// ============================================================================
// DEBOUNCED SUBTASK SYNC
// ============================================================================
// Subtask operations happen in rapid succession (e.g., checking multiple items).
// Instead of syncing after each operation, we debounce to batch them together.
const pendingSubtaskSyncs = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleSubtaskSync(taskId: string, getTask: () => Task | undefined) {
  // Clear any pending sync for this task
  const existing = pendingSubtaskSyncs.get(taskId);
  if (existing) {
    clearTimeout(existing);
  }
  
  // Schedule new sync
  const timeout = setTimeout(() => {
    pendingSubtaskSyncs.delete(taskId);
    const task = getTask();
    if (task) {
      // Update via offline-first adapter
      offlineUpdateTask(taskId, { subtasks: task.subtasks }).catch(console.error);
    }
  }, SUBTASKS.SYNC_DELAY_MS);
  
  pendingSubtaskSyncs.set(taskId, timeout);
}

// ============================================================================
// PARENT PAGE TIMESTAMP TOUCH
// ============================================================================
// When tasks are added/updated/deleted, bump the parent page's `updated`
// timestamp so it appears in "recently edited" lists and sorts correctly.
// Debounced to avoid spamming on bulk operations.

const pendingPageTouches = new Map<string, ReturnType<typeof setTimeout>>();

function touchParentPage(parentPageId?: string) {
  if (!parentPageId) return;
  
  // Debounce: if we already have a pending touch for this page, skip
  const existing = pendingPageTouches.get(parentPageId);
  if (existing) {
    clearTimeout(existing);
  }
  
  const timeout = setTimeout(() => {
    pendingPageTouches.delete(parentPageId);
    usePagesStore.getState().touchPageTimestamp(parentPageId);
  }, 500);
  
  pendingPageTouches.set(parentPageId, timeout);
}

interface TasksState {
  // Data (normalized)
  tasksById: Record<string, Task>;
  taskOrder: string[];

  // Loading state
  isLoading: boolean;
  error: string | null;

  // Actions - Local mutations
  addTask: (taskData: {
    title: string;
    description?: string;
    dueDate?: string;
    priority?: string;
    /** Parent page ID (task collection), null = Inbox */
    parentPageId?: string;
    sectionId?: string;
    subtasks?: Subtask[];
    recurrence?: RecurrencePattern;
    recurringParentId?: string;
    copySubtasksOnRecur?: boolean;
    tag?: string;
    linkedItems?: LinkedItem[];
  }) => Promise<string>;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleComplete: (id: string) => void;
  reorderTasks: (orderedIds: string[]) => void;
  /** Move a task to a page (task collection) or Inbox (null) */
  moveTaskToPage: (taskId: string, parentPageId: string | null, sectionId?: string | null) => void;
  
  // Recurrence operations
  handleRecurrenceCompletion: (taskId: string) => Promise<void>;
  removeRecurrence: (taskId: string) => void;
  
  // Subtask operations (embedded in task - no separate API calls)
  addSubtask: (taskId: string, title: string) => string;
  updateSubtask: (taskId: string, subtaskId: string, updates: Partial<Subtask>) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  deleteSubtask: (taskId: string, subtaskId: string) => void;
  reorderSubtasks: (taskId: string, orderedIds: string[]) => void;
  
  // Batch operations
  clearCompletedTasks: (parentPageId?: string) => void;
  /** Batch update multiple tasks with same updates (e.g., move all to inbox) */
  updateTasks: (taskIds: string[], updates: Partial<Task>) => void;
  /** Batch delete multiple tasks */
  deleteTasks: (taskIds: string[]) => void;
  /** Batch toggle completion for multiple tasks */
  toggleCompleteTasks: (taskIds: string[]) => void;
  
  // Sync engine integration - called by sync engine events
  /** Apply bulk load of tasks from sync engine (initial load or refresh) */
  applyBulkLoad: (tasks: Task[]) => void;
  /** Apply a remote change from sync engine (create/update/delete) */
  applyRemoteChange: (event: DataChangeEvent<Task>) => void;
  
  // Loading state control
  setLoading: (loading: boolean) => void;
  
  // Reset
  /** Reset store to initial state (for workspace switching) */
  reset: () => void;
}

export interface TaskPreviewLatestTask {
  id: string;
  title: string;
  dueDate?: string;
  completed: boolean;
  priority?: Task['priority'];
  created?: string;
  subtaskProgress: {
    total: number;
    completed: number;
  } | null;
}

export interface TaskPreviewStats {
  totalCount: number;
  openCount: number;
  overdueOpenCount: number;
  dueSoonCount: number;
  undatedOpenCount: number;
  recentlyCompletedCount: number;
  latestTask: TaskPreviewLatestTask | null;
}

const EMPTY_TASK_PREVIEW_STATS: TaskPreviewStats = Object.freeze({
  totalCount: 0,
  openCount: 0,
  overdueOpenCount: 0,
  dueSoonCount: 0,
  undatedOpenCount: 0,
  recentlyCompletedCount: 0,
  latestTask: null,
});

let cachedTaskPreviewStatsByPage: Record<string, TaskPreviewStats> = {};
let cachedTasksByIdRef: TasksState['tasksById'] | null = null;
let cachedTaskOrderRef: TasksState['taskOrder'] | null = null;

function getTaskPreviewStatsMap(
  tasksById: TasksState['tasksById'],
  taskOrder: TasksState['taskOrder']
): Record<string, TaskPreviewStats> {
  if (cachedTasksByIdRef === tasksById && cachedTaskOrderRef === taskOrder) {
    return cachedTaskPreviewStatsByPage;
  }

  const today = dayjs().startOf('day');
  const completedThreshold = today.subtract(7, 'day');
  const statsByPage: Record<string, TaskPreviewStats> = {};

  for (const taskId of taskOrder) {
    const task = tasksById[taskId];
    const parentPageId = task?.parentPageId;
    if (!task || !parentPageId) continue;

    const stats = statsByPage[parentPageId] ?? {
      totalCount: 0,
      openCount: 0,
      overdueOpenCount: 0,
      dueSoonCount: 0,
      undatedOpenCount: 0,
      recentlyCompletedCount: 0,
      latestTask: null,
    };

    stats.totalCount += 1;

    const latestTaskCreatedAt = stats.latestTask?.created;
    if (
      !stats.latestTask
      || (task.created && (!latestTaskCreatedAt || task.created > latestTaskCreatedAt))
      || (!task.created && !latestTaskCreatedAt)
    ) {
      stats.latestTask = {
        id: task.id,
        title: task.title,
        dueDate: task.dueDate,
        completed: task.completed,
        priority: task.priority,
        created: task.created,
        subtaskProgress: task.subtasks?.length
          ? {
              total: task.subtasks.length,
              completed: task.subtasks.filter((subtask) => subtask.completed).length,
            }
          : null,
      };
    }

    if (!task.completed) {
      stats.openCount += 1;
      if (isOverdue(task.dueDate)) {
        stats.overdueOpenCount += 1;
      }
      if (!task.dueDate) {
        stats.undatedOpenCount += 1;
      } else {
        const due = dayjs(task.dueDate).startOf('day');
        if (!due.isBefore(today, 'day') && due.diff(today, 'day') <= 7) {
          stats.dueSoonCount += 1;
        }
      }
    } else if (task.completedAt && dayjs(task.completedAt).isAfter(completedThreshold)) {
      stats.recentlyCompletedCount += 1;
    }

    statsByPage[parentPageId] = stats;
  }

  cachedTasksByIdRef = tasksById;
  cachedTaskOrderRef = taskOrder;
  cachedTaskPreviewStatsByPage = statsByPage;
  return statsByPage;
}

export const useTasksStore = create<TasksState>()(
  devtools(
    (set, get) => ({
      // Initialize empty - data loaded via sync engine
      tasksById: {},
      taskOrder: [],
      isLoading: false,
      error: null,

      // ========================================================================
      // SYNC ENGINE INTEGRATION
      // These methods are called by sync engine events to update store state
      // ========================================================================

      applyBulkLoad: (tasks) => {
        set(
          (state) => {
            // REPLACE instead of merge to handle items deleted from other devices
            // while this one was idle. The sync engine ensures "tasks" 
            // is the authoritative current set from IndexedDB after reconciliation.
            const newTasksById: Record<string, Task> = {};
            tasks.forEach((t) => {
              newTasksById[t.id] = t;
            });
            
            return {
              tasksById: newTasksById,
              taskOrder: Object.keys(newTasksById),
              isLoading: false,
            };
          },
          false,
          'applyBulkLoad'
        );
      },

      applyRemoteChange: (event) => {
        const { action, record, recordId } = event;
        const { tasksById, taskOrder } = get();

        switch (action) {
          case 'create':
            if (record && !tasksById[record.id]) {
              set(
                {
                  tasksById: { ...tasksById, [record.id]: record },
                  taskOrder: [...taskOrder, record.id],
                },
                false,
                'applyRemoteChange/create'
              );
            }
            break;

          case 'update':
            if (record && tasksById[record.id]) {
              set(
                {
                  tasksById: { ...tasksById, [record.id]: { ...tasksById[record.id], ...record } },
                },
                false,
                'applyRemoteChange/update'
              );
            }
            break;

          case 'delete': {
            const idToDelete = recordId || record?.id;
            if (idToDelete && tasksById[idToDelete]) {
              const { [idToDelete]: _, ...remaining } = tasksById;
              set(
                {
                  tasksById: remaining,
                  taskOrder: taskOrder.filter((id) => id !== idToDelete),
                },
                false,
                'applyRemoteChange/delete'
              );
            }
            break;
          }

          case 'bulk-load':
            // Handled by applyBulkLoad
            break;
        }
      },

      setLoading: (loading) => set({ isLoading: loading }, false, 'setLoading'),

      // ========================================================================
      // LOCAL MUTATIONS
      // ========================================================================

      addTask: async ({ title, description, dueDate, priority, parentPageId, sectionId, subtasks, recurrence, recurringParentId, copySubtasksOnRecur, tag, linkedItems }) => {
        if (!title.trim()) return '';

        try {
          // Create task via offline-first adapter (saves to IndexedDB, queues for sync)
          const newTask = await offlineCreateTask({
            title,
            description,
            dueDate,
            priority: priority as 'Low' | 'Medium' | 'High' | undefined,
            parentPageId,
            sectionId,
            subtasks,
            recurrence,
            recurringParentId,
            copySubtasksOnRecur,
            completed: false,
            tag,
            linkedItems,
          });

          // Update store with the new task
          set(
            (state) => ({
              tasksById: { ...state.tasksById, [newTask.id]: newTask },
              taskOrder: [...state.taskOrder, newTask.id],
            }),
            false,
            'addTask/success'
          );
          touchParentPage(parentPageId);
          return newTask.id;
        } catch (e) {
          set({ error: (e as Error).message }, false, 'addTask/error');
          return '';
        }
      },

      updateTask: (id, updates) => {
        const existingTask = get().tasksById[id];
        set(
          (state) => {
            const task = state.tasksById[id];
            if (!task) return state;
            return {
              tasksById: {
                ...state.tasksById,
                [id]: { ...task, ...updates },
              },
            };
          },
          false,
          'updateTask'
        );
        // Update via offline-first adapter (saves locally, queues for sync)
        offlineUpdateTask(id, updates).catch(console.error);
        // Touch parent page timestamp
        touchParentPage(existingTask?.parentPageId);
      },

      toggleComplete: (id) => {
        const task = get().tasksById[id];
        if (!task) return;
        const newCompleted = !task.completed;
        const taskTitle = task.title;
        
        // Update the task's completion status
        get().updateTask(id, { 
          completed: newCompleted,
          completedAt: newCompleted ? new Date().toISOString() : undefined,
        });
        
        // Show toast with undo for completion
        if (newCompleted) {
          toastSuccess(`Completed "${taskTitle}"`, () => {
            get().updateTask(id, { 
              completed: false,
              completedAt: undefined,
            });
          });
        }
        
        // If completing a recurring task, create the next instance
        if (newCompleted && task.recurrence && task.dueDate) {
          get().handleRecurrenceCompletion(id);
        }
      },

      // ========================================================================
      // RECURRENCE OPERATIONS
      // When a recurring task is completed, create the next instance
      // ========================================================================

      handleRecurrenceCompletion: async (taskId: string) => {
        const task = get().tasksById[taskId];
        if (!task?.recurrence || !task.dueDate) return;

        // Calculate the next due date
        const nextDueDate = getNextDueDate(task.dueDate, task.recurrence);

        if (!nextDueDate) {
          // Recurrence has ended (hit count limit or end date)
          // Remove recurrence pattern from the completed task
          get().updateTask(taskId, { recurrence: undefined });
          return;
        }

        // Update the completed count in the pattern for the next instance
        const updatedPattern: RecurrencePattern = {
          ...task.recurrence,
          completedCount: (task.recurrence.completedCount || 0) + 1,
        };

        // Prepare subtasks for next instance (reset completion status)
        const shouldCopySubtasks = task.copySubtasksOnRecur !== false && task.subtasks?.length;
        const nextSubtasks = shouldCopySubtasks
          ? task.subtasks!.map((st) => ({
              ...st,
              id: `subtask_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              completed: false,
            }))
          : undefined;

        // Create the next instance
        await get().addTask({
          title: task.title,
          description: task.description,
          dueDate: nextDueDate,
          priority: task.priority,
          parentPageId: task.parentPageId,
          sectionId: task.sectionId,
          subtasks: nextSubtasks,
          recurrence: updatedPattern,
          recurringParentId: task.recurringParentId || taskId, // Track lineage
          copySubtasksOnRecur: task.copySubtasksOnRecur,
        });

        // Remove recurrence from completed task (it's now just a historical record)
        get().updateTask(taskId, { recurrence: undefined });
      },

      removeRecurrence: (taskId: string) => {
        get().updateTask(taskId, { recurrence: undefined });
      },

      deleteTask: (id) => {
        const deletedTask = get().tasksById[id];
        if (!deletedTask) return;
        
        const taskTitle = deletedTask.title || 'Untitled';
        
        set(
          (state) => ({
            tasksById: Object.fromEntries(Object.entries(state.tasksById).filter(([key]) => key !== id)),
            taskOrder: state.taskOrder.filter((tid) => tid !== id),
          }),
          false,
          'deleteTask'
        );
        // Delete via offline-first adapter (marks deleted locally, queues for sync)
        offlineDeleteTask(id).catch(console.error);
        touchParentPage(deletedTask.parentPageId);
        
        // Show toast with undo
        toastSuccess(`Deleted "${taskTitle}"`, () => {
          // Restore task to store
          set((state) => ({
            tasksById: { ...state.tasksById, [id]: deletedTask },
            taskOrder: [...state.taskOrder, id],
          }), false, 'undoDeleteTask');
        });
      },

      reorderTasks: (orderedIds) => set({ taskOrder: orderedIds }, false, 'reorderTasks'),

      moveTaskToPage: (taskId, parentPageId, sectionId) => {
        const oldParentPageId = get().tasksById[taskId]?.parentPageId;
        set(
          (state) => {
            const task = state.tasksById[taskId];
            if (!task) return state;
            return {
              tasksById: {
                ...state.tasksById,
                [taskId]: {
                  ...task,
                  parentPageId: parentPageId ?? undefined,
                  sectionId: sectionId ?? undefined,
                },
              },
            };
          },
          false,
          'moveTaskToPage'
        );
        // Update via offline-first adapter
        offlineUpdateTask(taskId, {
          parentPageId: parentPageId ?? undefined,
          sectionId: sectionId ?? undefined,
        }).catch(console.error);
        // Touch both old and new parent pages
        touchParentPage(oldParentPageId);
        touchParentPage(parentPageId ?? undefined);
      },

      // ========================================================================
      // SUBTASK OPERATIONS
      // Subtasks are embedded in the task object for simplicity and performance.
      // Changes are debounced to reduce API calls when rapidly editing subtasks.
      // ========================================================================

      addSubtask: (taskId, title) => {
        if (!title.trim()) return '';
        
        const subtaskId = `subtask_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const newSubtask: Subtask = {
          id: subtaskId,
          title: title.trim(),
          completed: false,
        };

        set(
          (state) => {
            const task = state.tasksById[taskId];
            if (!task) return state;
            return {
              tasksById: {
                ...state.tasksById,
                [taskId]: {
                  ...task,
                  subtasks: [...(task.subtasks || []), newSubtask],
                },
              },
            };
          },
          false,
          'addSubtask'
        );

        // Debounced sync to backend
        scheduleSubtaskSync(taskId, () => get().tasksById[taskId]);

        return subtaskId;
      },

      updateSubtask: (taskId, subtaskId, updates) => {
        set(
          (state) => {
            const task = state.tasksById[taskId];
            if (!task || !task.subtasks) return state;
            return {
              tasksById: {
                ...state.tasksById,
                [taskId]: {
                  ...task,
                  subtasks: task.subtasks.map((st) =>
                    st.id === subtaskId ? { ...st, ...updates } : st
                  ),
                },
              },
            };
          },
          false,
          'updateSubtask'
        );

        // Debounced sync to backend
        scheduleSubtaskSync(taskId, () => get().tasksById[taskId]);
      },

      toggleSubtask: (taskId, subtaskId) => {
        const task = get().tasksById[taskId];
        if (!task || !task.subtasks) return;
        
        const subtask = task.subtasks.find((st) => st.id === subtaskId);
        if (!subtask) return;
        
        get().updateSubtask(taskId, subtaskId, { completed: !subtask.completed });
      },

      deleteSubtask: (taskId, subtaskId) => {
        set(
          (state) => {
            const task = state.tasksById[taskId];
            if (!task || !task.subtasks) return state;
            return {
              tasksById: {
                ...state.tasksById,
                [taskId]: {
                  ...task,
                  subtasks: task.subtasks.filter((st) => st.id !== subtaskId),
                },
              },
            };
          },
          false,
          'deleteSubtask'
        );

        // Debounced sync to backend
        scheduleSubtaskSync(taskId, () => get().tasksById[taskId]);
      },

      reorderSubtasks: (taskId, orderedIds) => {
        set(
          (state) => {
            const task = state.tasksById[taskId];
            if (!task || !task.subtasks) return state;
            
            const subtaskMap = new Map(task.subtasks.map((st) => [st.id, st]));
            const reorderedSubtasks = orderedIds
              .map((id) => subtaskMap.get(id))
              .filter((st): st is Subtask => st !== undefined);
            
            return {
              tasksById: {
                ...state.tasksById,
                [taskId]: {
                  ...task,
                  subtasks: reorderedSubtasks,
                },
              },
            };
          },
          false,
          'reorderSubtasks'
        );

        // Debounced sync to backend
        scheduleSubtaskSync(taskId, () => get().tasksById[taskId]);
      },

      clearCompletedTasks: (parentPageId) => {
        const { tasksById, taskOrder } = get();
        const toDelete = Object.values(tasksById).filter(
          (t) => t.completed && (parentPageId === undefined || t.parentPageId === parentPageId)
        );
        
        if (toDelete.length === 0) return;
        
        const idsToDelete = new Set(toDelete.map((t) => t.id));
        set(
          {
            tasksById: Object.fromEntries(
              Object.entries(tasksById).filter(([id]) => !idsToDelete.has(id))
            ),
            taskOrder: taskOrder.filter((id) => !idsToDelete.has(id)),
          },
          false,
          'clearCompletedTasks'
        );
        
        // Delete via offline-first adapter
        toDelete.forEach((t) => offlineDeleteTask(t.id).catch(console.error));
        // Touch affected parent pages
        const affectedPages = new Set(toDelete.map(t => t.parentPageId).filter(Boolean));
        affectedPages.forEach(pid => touchParentPage(pid));
      },
      
      updateTasks: (taskIds, updates) => {
        if (taskIds.length === 0) return;
        
        set(
          (state) => {
            const updatedById = { ...state.tasksById };
            taskIds.forEach((id) => {
              if (updatedById[id]) {
                updatedById[id] = { ...updatedById[id], ...updates };
              }
            });
            return { tasksById: updatedById };
          },
          false,
          'updateTasks'
        );
        
        // Update via offline-first adapter for each task
        taskIds.forEach((id) => offlineUpdateTask(id, updates).catch(console.error));
        // Touch affected parent pages
        const affectedPages = new Set(taskIds.map(id => get().tasksById[id]?.parentPageId).filter(Boolean));
        affectedPages.forEach(pid => touchParentPage(pid));
      },

      deleteTasks: (taskIds) => {
        if (taskIds.length === 0) return;

        // Collect parent pages before deleting
        const affectedPages = new Set(
          taskIds.map(id => get().tasksById[id]?.parentPageId).filter(Boolean)
        );

        set(
          (state) => {
            const updatedById = { ...state.tasksById };
            const updatedOrder = state.taskOrder.filter(id => !taskIds.includes(id));
            taskIds.forEach(id => delete updatedById[id]);
            return { 
              tasksById: updatedById,
              taskOrder: updatedOrder
            };
          },
          false,
          'deleteTasks'
        );

        // Delete via offline-first adapter
        taskIds.forEach(id => offlineDeleteTask(id).catch(console.error));
        // Touch affected parent pages
        affectedPages.forEach(pid => touchParentPage(pid));
      },

      toggleCompleteTasks: (taskIds) => {
        if (taskIds.length === 0) return;

        set(
          (state) => {
            const updatedById = { ...state.tasksById };
            taskIds.forEach(id => {
              if (updatedById[id]) {
                updatedById[id] = { 
                  ...updatedById[id], 
                  completed: !updatedById[id].completed,
                  completedAt: !updatedById[id].completed ? new Date().toISOString() : undefined
                };
              }
            });
            return { tasksById: updatedById };
          },
          false,
          'toggleCompleteTasks'
        );

        // Update via offline-first adapter
        taskIds.forEach(id => {
          const task = get().tasksById[id];
          if (task) {
            offlineUpdateTask(id, { 
              completed: task.completed,
              completedAt: task.completedAt
            }).catch(console.error);
          }
        });
      },

      // Reset store to initial state (for workspace switching)
      reset: () => {
        set(
          {
            tasksById: {},
            taskOrder: [],
            isLoading: false,
            error: null,
          },
          false,
          'reset'
        );
      },
    }),
    { name: 'TasksStore' }
  )
);

// ============================================================================
// SELECTORS
// ============================================================================

/**
 * Select all tasks, excluding completed overdue tasks.
 * Completed overdue tasks are never shown - they're historical data
 * that should not be fetched from the API in the first place.
 */
export const selectTasks = (state: TasksState): Task[] => {
  const today = new Date().toISOString().split('T')[0];
  return state.taskOrder
    .map((id) => state.tasksById[id])
    .filter((t): t is Task => {
      if (!t) return false;
      // Keep if not completed
      if (!t.completed) return true;
      // Keep completed tasks if no due date
      if (!t.dueDate) return true;
      // Keep completed tasks if due date is today or future
      return t.dueDate >= today;
    });
};

/** Select tasks by parent page (task collection) */
export const selectTasksByPage = (parentPageId: string | null) => (state: TasksState): Task[] =>
  selectTasks(state).filter((t) => {
    const taskPageId = t.parentPageId;
    return parentPageId === null ? !taskPageId : taskPageId === parentPageId;
  });

export const selectTaskPreviewStatsByPage =
  (parentPageId: string) =>
  (state: TasksState): TaskPreviewStats =>
    getTaskPreviewStatsMap(state.tasksById, state.taskOrder)[parentPageId] ?? EMPTY_TASK_PREVIEW_STATS;

export const selectIncompleteTasks = (state: TasksState): Task[] =>
  selectTasks(state).filter((t) => !t.completed);

export const selectOverdueTasks = (today: string) => (state: TasksState): Task[] =>
  selectTasks(state).filter((t) => t.dueDate && t.dueDate < today && !t.completed);

export const selectTodayTasks = (today: string) => (state: TasksState): Task[] =>
  selectTasks(state).filter(
    (t) => t.dueDate === today || (t.dueDate && t.dueDate < today && !t.completed)
  );

// ============================================================================
// COMBINED SELECTORS (for useShallow - must return stable shapes)
// ============================================================================

/** Select raw task state (use with useShallow) */
export const selectTaskState = (state: TasksState) => ({
  tasksById: state.tasksById,
  taskOrder: state.taskOrder,
});

/** Select task actions (use with useShallow) */
export const selectTaskActions = (state: TasksState) => ({
  addTask: state.addTask,
  updateTask: state.updateTask,
  deleteTask: state.deleteTask,
  toggleComplete: state.toggleComplete,
  reorderTasks: state.reorderTasks,
  moveTaskToPage: state.moveTaskToPage,
  clearCompletedTasks: state.clearCompletedTasks,
  // Recurrence actions
  handleRecurrenceCompletion: state.handleRecurrenceCompletion,
  removeRecurrence: state.removeRecurrence,
  // Subtask actions
  addSubtask: state.addSubtask,
  updateSubtask: state.updateSubtask,
  toggleSubtask: state.toggleSubtask,
  deleteSubtask: state.deleteSubtask,
  reorderSubtasks: state.reorderSubtasks,
  // Batch actions
  updateTasks: state.updateTasks,
  deleteTasks: state.deleteTasks,
  toggleCompleteTasks: state.toggleCompleteTasks,
});

/** 
 * Hook to get tasks array - derives from raw state.
 * Use this instead of manually deriving in components.
 * 
 * IMPORTANT: Filters out completed overdue tasks as a safety net.
 * The API should already exclude them, but this ensures consistency.
 * 
 * OPTIMIZATION: Uses useShallow for proper array comparison and useMemo
 * to avoid recomputing on every render. The selector grabs both state
 * pieces in a single subscription, then useMemo derives the filtered array.
 */
export const useTasks = (): Task[] => {
  // Single subscription using useShallow to get stable references
  const { tasksById, taskOrder } = useTasksStore(
    useShallow((state) => ({
      tasksById: state.tasksById,
      taskOrder: state.taskOrder,
    }))
  );
  
  // Derive filtered array with useMemo for stable reference
  return useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    
    return taskOrder
      .map((id) => tasksById[id])
      .filter((t): t is Task => {
        if (!t) return false;
        // Keep if not completed
        if (!t.completed) return true;
        // Keep completed tasks if no due date (can't be overdue)
        if (!t.dueDate) return true;
        // Keep completed tasks if due date is today or future
        return t.dueDate >= today;
      });
  }, [tasksById, taskOrder]);
};
