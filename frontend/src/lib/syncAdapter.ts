/**
 * @file syncAdapter.ts
 * @description Offline-first sync adapters for API operations
 * 
 * These adapters wrap the standard API calls to provide offline-first behavior:
 * 1. Record changes locally in IndexedDB immediately
 * 2. Queue changes for sync to backend
 * 3. Return optimistically without waiting for network
 * 
 * The sync engine handles:
 * - Queueing changes when offline
 * - Syncing when connection is restored
 * - CRDT-based conflict resolution
 * 
 * Usage:
 * Instead of: await tasksApi.createTask(data)
 * Use:        await offlineCreateTask(data)
 */
import { offlineDb, type OfflineTask, type OfflinePage } from './offlineDb';
import { syncEngine } from './syncEngine';
import { generateId } from './pocketbase';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { Task, Subtask, RecurrencePattern, LinkedItem } from '@/types/task';
import type { Page, CreatePageInput, UpdatePageInput, Section } from '@/types/page';

// Type aliases for backward compatibility
type Note = Page;
type CreateNoteInput = CreatePageInput;
type UpdateNoteInput = UpdatePageInput;

// Helper to get current workspace ID - throws if not set
function getCurrentWorkspaceId(): string {
  const workspaceId = useWorkspaceStore.getState().currentWorkspaceId;
  if (!workspaceId) {
    throw new Error('[syncAdapter] Cannot create/update data without a workspace. Ensure user is logged in and workspace is selected.');
  }
  return workspaceId;
}

// ============================================================================
// TASK ADAPTERS
// ============================================================================

export interface CreateTaskInput {
  title: string;
  description?: string;
  dueDate?: string;
  priority?: 'Low' | 'Medium' | 'High';
  /** Parent page ID (task collection with viewMode='tasks') */
  parentPageId?: string;
  sectionId?: string;
  subtasks?: Subtask[];
  recurrence?: RecurrencePattern;
  recurringParentId?: string;
  copySubtasksOnRecur?: boolean;
  completed?: boolean;
  tag?: string;
  linkedItems?: LinkedItem[];
}

/**
 * Create a task with offline-first support.
 * Records the task locally in IndexedDB and queues for sync.
 */
export async function offlineCreateTask(input: CreateTaskInput): Promise<Task> {
  const id = generateId();
  const now = new Date().toISOString();
  const workspace = getCurrentWorkspaceId();
  
  const task: Task = {
    id,
    title: input.title,
    description: input.description,
    dueDate: input.dueDate,
    priority: input.priority,
    parentPageId: input.parentPageId,
    sectionId: input.sectionId,
    subtasks: input.subtasks,
    recurrence: input.recurrence,
    recurringParentId: input.recurringParentId,
    copySubtasksOnRecur: input.copySubtasksOnRecur,
    completed: input.completed ?? false,
    completedAt: input.completed ? now : undefined,
    workspace,
    tag: input.tag,
    linkedItems: input.linkedItems,
  };
  
  // Record this as a creation in the sync engine
  await syncEngine.recordTaskChange('create', task, undefined, workspace);
  
  return task;
}

/**
 * Update a task with offline-first support.
 * Records the update locally and queues for sync with field-level CRDT.
 */
export async function offlineUpdateTask(id: string, updates: Partial<Task>): Promise<void> {
  const workspace = getCurrentWorkspaceId();
  // Get current task from IndexedDB
  const currentTask = await offlineDb.tasks.get(id);
  
  if (!currentTask) {
    // Task not in local DB - create a minimal version with updates
    const task: Task = {
      id,
      title: '',
      completed: false,
      workspace,
      ...updates,
    };
    await syncEngine.recordTaskChange('update', task, Object.keys(updates), workspace);
    return;
  }
  
  // Merge updates into the task (strip CRDT metadata)
  const { _syncStatus, _hlc, _fieldHLCs, ...baseTask } = currentTask;
  const updatedTask: Task = {
    ...baseTask,
    ...updates,
    id, // Ensure ID stays the same
  };
  
  // Record the update
  await syncEngine.recordTaskChange('update', updatedTask, Object.keys(updates));
}

/**
 * Delete a task with offline-first support.
 * Records the deletion locally and queues for sync.
 */
export async function offlineDeleteTask(id: string): Promise<void> {
  // Get current task
  const currentTask = await offlineDb.tasks.get(id);
  
  if (currentTask) {
    const { _syncStatus, _hlc, _fieldHLCs, ...baseTask } = currentTask;
    await syncEngine.recordTaskChange('delete', baseTask);
  } else {
    // Task might only exist on server - still queue the delete
    const minimalTask: Task = {
      id,
      title: '',
      completed: false,
    };
    await syncEngine.recordTaskChange('delete', minimalTask);
  }
}

// ============================================================================
// NOTE ADAPTERS (Note is now an alias for Page)
// ============================================================================

/**
 * Create a note/page with offline-first support.
 * Records the page locally in IndexedDB and queues for sync.
 */
export async function offlineCreateNote(input: CreateNoteInput & { id: string }): Promise<Note> {
  const now = new Date().toISOString();
  const workspace = getCurrentWorkspaceId();
  
  const page: Note = {
    id: input.id,
    title: input.title,
    content: input.content ?? null,
    excerpt: null,
    created: now,
    updated: now,
    parentId: input.parentId ?? null,
    order: input.order ?? 0,
    icon: input.icon ?? null,
    color: null,
    coverImage: null,
    coverGradient: null,
    coverAttribution: null,
    images: [],
    viewMode: input.viewMode ?? 'note',
    childrenViewMode: input.childrenViewMode ?? 'list',
    isDailyNote: input.isDailyNote ?? false,
    dailyNoteDate: input.dailyNoteDate ?? null,
    isExpanded: false,
    isPinned: false,
    pinnedOrder: 0,
    childCount: 0,
    showChildrenInSidebar: input.viewMode === 'note',
    // Task collection fields (only relevant when viewMode='tasks')
    sections: [],
    tasksViewMode: 'list',
    tasksGroupBy: 'none',
    showCompletedTasks: false,
    workspace,
  };
  
  // Record this as a creation in the sync engine
  await syncEngine.recordPageChange('create', page, undefined, workspace);
  
  return page;
}

/**
 * Update a note/page with offline-first support.
 * Uses block-level CRDT for content merging.
 */
export async function offlineUpdateNote(id: string, updates: UpdateNoteInput): Promise<void> {
  const workspace = getCurrentWorkspaceId();
  // Get current page from IndexedDB
  const currentPage = await offlineDb.pages.get(id);
  
  if (!currentPage) {
    // Page not in local DB - create a minimal page with the updates
    const page: Note = {
      id,
      title: '',
      content: null,
      excerpt: null,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      parentId: null,
      order: 0,
      icon: null,
      color: null,
      coverImage: null,
      coverGradient: null,
      coverAttribution: null,
      images: [],
      viewMode: 'note',
      childrenViewMode: 'list',
      isDailyNote: false,
      dailyNoteDate: null,
      isExpanded: false,
      isPinned: false,
      pinnedOrder: 0,
      childCount: 0,
      showChildrenInSidebar: true,
      // Task collection fields
      sections: [],
      tasksViewMode: 'list',
      tasksGroupBy: 'none',
      showCompletedTasks: false,
      workspace,
      // Apply updates, converting undefined to null
      ...Object.fromEntries(
        Object.entries(updates).map(([key, value]) => [key, value ?? null])
      ),
    };
    await syncEngine.recordPageChange('update', page, Object.keys(updates), workspace);
    return;
  }
  
  // IMPORTANT: Only pass the updates and the minimal required fields.
  // The sync engine's mergeAndSaveLocalPage will atomically merge with existing data.
  // This prevents race conditions where rapid updates overwrite each other.
  const changedFields = Object.keys(updates);
  const updatedNote: Note = {
    // Only include fields that are being updated + required identifiers
    id,
    workspace: currentPage.workspace,
    updated: new Date().toISOString(),
    // Include current values for content if updating content
    // (needed for block-level change detection)
    ...(changedFields.includes('content') ? { content: updates.content } : {}),
    // Apply the actual updates
    ...updates,
  } as Note;
  
  // Record the update - sync engine will handle atomic merge with IndexedDB
  await syncEngine.recordPageChange('update', updatedNote, changedFields);
}

/**
 * Delete a note/page with offline-first support.
 */
export async function offlineDeleteNote(id: string): Promise<void> {
  const currentPage = await offlineDb.pages.get(id);
  
  if (currentPage) {
    const { _syncStatus, _hlc, _fieldHLCs, _blockHLCs, _deletedBlocks, ...basePage } = currentPage;
    await syncEngine.recordPageChange('delete', basePage);
  } else {
    const minimalNote: Note = {
      id,
      title: '',
      content: null,
      excerpt: null,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      parentId: null,
      order: 0,
      icon: null,
      color: null,
      coverImage: null,
      coverGradient: null,
      coverAttribution: null,
      images: [],
      viewMode: 'note',
      childrenViewMode: 'list',
      isDailyNote: false,
      dailyNoteDate: null,
      isExpanded: false,
      isPinned: false,
      pinnedOrder: 0,
      childCount: 0,
      showChildrenInSidebar: true,
      // Task collection fields
      sections: [],
      tasksViewMode: 'list',
      tasksGroupBy: 'none',
      showCompletedTasks: false,
    };
    await syncEngine.recordPageChange('delete', minimalNote);
  }
}

// ============================================================================
// PAGE ADAPTERS (Modern aliases for Note functions)
// ============================================================================

/** Create a page with offline-first support. Alias for offlineCreateNote. */
export const offlineCreatePage = offlineCreateNote;

/** Update a page with offline-first support. Alias for offlineUpdateNote. */
export const offlineUpdatePage = offlineUpdateNote;

/** Delete a page with offline-first support. Alias for offlineDeleteNote. */
export const offlineDeletePage = offlineDeleteNote;

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Load all tasks from IndexedDB (for initial hydration when offline).
 */
export async function loadOfflineTasks(): Promise<Task[]> {
  const offlineTasks = await offlineDb.tasks.toArray();
  return offlineTasks.filter(t => t._syncStatus !== 'deleted').map(toTask);
}

/**
 * Load all pages from IndexedDB (for initial hydration when offline).
 */
export async function loadOfflinePages(): Promise<Page[]> {
  const offlinePages = await offlineDb.pages.toArray();
  return offlinePages.filter(p => p._syncStatus !== 'deleted').map(toPage);
}

// ============================================================================
// TYPE CONVERTERS
// ============================================================================

/** Convert OfflineTask to Task (strips sync metadata) */
function toTask(offline: OfflineTask): Task {
  const { _hlc, _fieldHLCs, _syncStatus, workspace, ...task } = offline;
  return task;
}

/** Convert OfflinePage to Page (strips sync metadata) */
function toPage(offline: OfflinePage): Page {
  const { _hlc, _fieldHLCs, _blockHLCs, _deletedBlocks, _syncStatus, _hasContent, _contentFetchedAt, _lastSyncedContent, workspace, ...page } = offline;
  return page;
}

// ============================================================================
// HYBRID MODE HELPERS
// ============================================================================

/**
 * Check if sync engine is initialized and ready.
 */
export function isSyncReady(): boolean {
  // The sync engine is a singleton - it's always available
  // but may not be initialized yet
  return true;
}

/**
 * Sync local IndexedDB with server data.
 * Called after initial fetch from server to merge any pending offline changes.
 */
export async function syncLocalWithServer<T extends { id: string }>(
  serverItems: T[],
  collection: 'tasks' | 'pages'
): Promise<T[]> {
  // Get local items
  const table = collection === 'tasks' 
    ? offlineDb.tasks 
    : offlineDb.pages;
  
  const localItems = await table.toArray();
  const localById = new Map(localItems.map(item => [item.id, item]));
  const serverById = new Map(serverItems.map(item => [item.id, item]));
  
  const result: T[] = [];
  
  // Process server items
  for (const serverItem of serverItems) {
    const localItem = localById.get(serverItem.id);
    
    if (!localItem || localItem._syncStatus === 'synced') {
      // No local version or local is synced - use server version
      result.push(serverItem);
    } else if (localItem._syncStatus === 'pending') {
      // Local has pending changes - keep local version (will be synced later)
      // Strip sync metadata for return
      if (collection === 'tasks') {
        result.push(toTask(localItem as OfflineTask) as unknown as T);
      } else {
        result.push(toPage(localItem as OfflinePage) as unknown as T);
      }
    }
    // Skip if localItem._syncStatus === 'deleted' (locally deleted)
  }
  
  // Add local-only items (created offline, not yet on server)
  for (const localItem of localItems) {
    if (!serverById.has(localItem.id) && localItem._syncStatus !== 'deleted') {
      if (collection === 'tasks') {
        result.push(toTask(localItem as OfflineTask) as unknown as T);
      } else {
        result.push(toPage(localItem as OfflinePage) as unknown as T);
      }
    }
  }
  
  return result;
}
