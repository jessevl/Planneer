/**
 * @file offlineDb.ts
 * @description IndexedDB offline storage using Dexie.js
 * @app SHARED - Used by sync engine and stores
 *
 * Provides persistent local storage for offline-first operation:
 * - Tasks, pages stored locally with sync metadata
 * - Operation queue for pending changes
 * - HLC state persistence across sessions
 *
 * All data operations go through here first, then sync to PocketBase.
 * 
 * Note: Pages with viewMode='tasks' replace the legacy projects table.
 */

import Dexie, { type Table } from 'dexie';
import type { Task } from '@/types/task';
import type { Page } from '@/types/page';
import type { HLCTimestamp, SyncStatus } from './crdt';
import { RETRY, OFFLINE_STORAGE, devLog } from './config';

// ============================================================================
// SYNCABLE RECORD TYPES
// ============================================================================

/**
 * Base sync metadata added to all records.
 * Note: workspace is made required here (overrides optional in Task/Page types)
 */
export interface SyncMetadata {
  /** Current sync status */
  _syncStatus: SyncStatus;
  /** Record-level HLC */
  _hlc: HLCTimestamp;
  /** Per-field HLCs for field-level merging */
  _fieldHLCs: Record<string, HLCTimestamp>;
  /** Server's 'updated' timestamp when last synced */
  _serverVersion?: string;
}

/**
 * Task with sync metadata.
 */
export interface OfflineTask extends Omit<Task, 'workspace'>, SyncMetadata {
  /** Workspace ID (required for filtering/querying) */
  workspace: string;
}

/**
 * Page with sync metadata (including block-level HLCs).
 * Pages with viewMode='tasks' replace the legacy projects table.
 */
export interface OfflinePage extends Omit<Page, 'workspace'>, SyncMetadata {
  /** Workspace ID (required for filtering/querying) */
  workspace: string;
  /** Per-block HLCs for Yoopta content */
  _blockHLCs: Record<string, HLCTimestamp>;
  /** Tombstones for deleted blocks */
  _deletedBlocks: Record<string, HLCTimestamp>;
  /** Whether we have content locally (false = metadata only) */
  _hasContent: boolean;
  /** When content was last fetched from server (for freshness check) */
  _contentFetchedAt?: number;
  /** Content as of last successful sync (for Option 2C block diffing) */
  _lastSyncedContent?: string | null;
}

// ============================================================================
// SYNC QUEUE
// ============================================================================

/**
 * Operation types for the sync queue.
 */
export type SyncOperationType = 'create' | 'update' | 'delete';

/**
 * Collection names we sync.
 */
export type SyncCollection = 'tasks' | 'pages';

/**
 * A queued sync operation.
 */
export interface SyncOperation {
  /** Unique operation ID */
  id: string;
  /** Which collection this affects */
  collection: SyncCollection;
  /** Type of operation */
  operation: SyncOperationType;
  /** ID of the affected record */
  recordId: string;
  /** Workspace ID */
  workspaceId: string;
  /** Changed data (for create/update) */
  data?: Record<string, unknown>;
  /** Changed fields (for update - helps with partial sync) */
  changedFields?: string[];
  /** HLC when operation was created */
  hlc: HLCTimestamp;
  /** Timestamp when queued */
  createdAt: number;
  /** Number of sync attempts */
  attempts: number;
  /** Last error message if sync failed */
  lastError?: string;
  /** Next retry time (exponential backoff) */
  retryAfter?: number;
}

// ============================================================================
// HLC STATE
// ============================================================================

/**
 * Persisted HLC state.
 */
export interface HLCState {
  /** Always 'hlc' - single record */
  id: 'hlc';
  /** Wall clock component */
  ts: number;
  /** Logical counter */
  counter: number;
  /** This device's node ID */
  nodeId: string;
}

// ============================================================================
// IMAGE UPLOAD QUEUE
// ============================================================================

/**
 * A pending image upload (for offline support).
 */
export interface PendingImageUpload {
  /** Unique upload ID */
  id: string;
  /** Page ID to attach image to */
  pageId: string;
  /** Workspace ID */
  workspaceId: string;
  /** Processed file as base64 (for IndexedDB storage) */
  fileBase64: string;
  /** Original filename */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** Blob URL used as placeholder in content */
  blobUrl: string;
  /** Image width */
  width: number;
  /** Image height */
  height: number;
  /** When queued */
  createdAt: number;
  /** Number of upload attempts */
  attempts: number;
  /** Last error if upload failed */
  lastError?: string;
}

// ============================================================================
// SYNC METADATA
// ============================================================================

/**
 * Metadata about last sync per collection/workspace.
 */
export interface SyncMeta {
  /** Key: "collection:workspaceId" */
  id: string;
  /** Last successful sync time */
  lastSyncAt: number;
  /** Server timestamp from last sync (for delta sync) */
  lastServerTimestamp?: string;
}

// ============================================================================
// DATABASE CLASS
// ============================================================================

/**
 * Dexie database for offline storage.
 */
class PlanneerOfflineDB extends Dexie {
  // Tables
  tasks!: Table<OfflineTask, string>;
  pages!: Table<OfflinePage, string>;
  syncQueue!: Table<SyncOperation, string>;
  hlcState!: Table<HLCState, string>;
  syncMeta!: Table<SyncMeta, string>;
  imageUploadQueue!: Table<PendingImageUpload, string>;

  constructor() {
    super('planneer-offline');

    // Schema version 3: Unified pages model (replaces legacy pages + projects)
    // Starting fresh - no migration from previous versions needed
    this.version(3).stores({
      // Primary key is 'id', indexed fields for queries
      tasks: 'id, workspace, _syncStatus, dueDate, parentPageId, completed',
      // Pages replace legacy notes and projects. viewMode distinguishes page types.
      pages: 'id, workspace, _syncStatus, parentId, dailyNoteDate, isDailyNote, viewMode, updated, order',
      // Sync queue indexed by creation time for FIFO processing
      syncQueue: 'id, collection, createdAt, retryAfter, workspaceId',
      // Single HLC state record
      hlcState: 'id',
      // Sync metadata per collection/workspace
      syncMeta: 'id',
      // Image upload queue for offline image uploads
      imageUploadQueue: 'id, pageId, workspaceId, createdAt',
    });
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/** Global database instance */
export const offlineDb = new PlanneerOfflineDB();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique operation ID.
 */
export function generateOpId(): string {
  return `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Get all pending operations for a workspace.
 */
export async function getPendingOperations(
  workspaceId: string
): Promise<SyncOperation[]> {
  const now = Date.now();
  return offlineDb.syncQueue
    .where('workspaceId')
    .equals(workspaceId)
    .filter((op) => !op.retryAfter || op.retryAfter <= now)
    .sortBy('createdAt');
}

/**
 * Get count of pending operations.
 */
export async function getPendingCount(workspaceId?: string): Promise<number> {
  if (workspaceId) {
    return offlineDb.syncQueue.where('workspaceId').equals(workspaceId).count();
  }
  return offlineDb.syncQueue.count();
}

/**
 * Add an operation to the sync queue.
 */
export async function queueOperation(op: Omit<SyncOperation, 'id'>): Promise<string> {
  const id = generateOpId();
  await offlineDb.syncQueue.add({ ...op, id });
  return id;
}

/**
 * Remove an operation from the queue (after successful sync).
 */
export async function dequeueOperation(opId: string): Promise<void> {
  await offlineDb.syncQueue.delete(opId);
}

/**
 * Mark an operation as failed and schedule retry.
 */
export async function markOperationFailed(
  opId: string,
  error: string
): Promise<void> {
  const op = await offlineDb.syncQueue.get(opId);
  if (!op) return;

  // Exponential backoff using config values
  const backoffMs = Math.min(
    RETRY.INITIAL_DELAY_MS * Math.pow(RETRY.BACKOFF_FACTOR, op.attempts),
    RETRY.SYNC_QUEUE_MAX_BACKOFF_MS
  );

  await offlineDb.syncQueue.update(opId, {
    attempts: op.attempts + 1,
    lastError: error,
    retryAfter: Date.now() + backoffMs,
  });
}

/**
 * Clear all failed operations (after too many retries).
 */
export async function clearStuckOperations(maxAttempts: number = 10): Promise<number> {
  const stuck = await offlineDb.syncQueue
    .filter((op) => op.attempts >= maxAttempts)
    .toArray();

  if (stuck.length > 0) {
    await offlineDb.syncQueue.bulkDelete(stuck.map((op) => op.id));
  }

  return stuck.length;
}

// ============================================================================
// TASK OPERATIONS
// ============================================================================

/**
 * Get all tasks for a workspace from local storage.
 */
export async function getLocalTasks(workspaceId: string): Promise<OfflineTask[]> {
  return offlineDb.tasks
    .where('workspace')
    .equals(workspaceId)
    .filter((t) => t._syncStatus !== 'deleted')
    .toArray();
}

/**
 * Get a single task by ID.
 */
export async function getLocalTask(id: string): Promise<OfflineTask | undefined> {
  return offlineDb.tasks.get(id);
}

/**
 * Save a task to local storage.
 */
export async function saveLocalTask(task: OfflineTask): Promise<void> {
  await offlineDb.tasks.put(task);
}

/**
 * Bulk save tasks (for initial sync).
 */
export async function bulkSaveTasks(tasks: OfflineTask[]): Promise<void> {
  await offlineDb.tasks.bulkPut(tasks);
}

/**
 * Mark a task as deleted locally.
 */
export async function markTaskDeleted(id: string, hlc: HLCTimestamp): Promise<void> {
  const task = await offlineDb.tasks.get(id);
  if (task) {
    await offlineDb.tasks.update(id, {
      _syncStatus: 'deleted',
      _hlc: hlc,
    });
  }
}

/**
 * Permanently remove deleted records after sync.
 */
export async function purgeSyncedDeletes(collection: SyncCollection): Promise<void> {
  const table = offlineDb[collection];
  const deleted = await table.where('_syncStatus').equals('deleted').toArray();
  // Only purge if they're truly synced (no pending ops)
  for (const record of deleted) {
    const pendingOps = await offlineDb.syncQueue
      .where('recordId')
      .equals(record.id)
      .count();
    if (pendingOps === 0) {
      await table.delete(record.id);
    }
  }
}

// ============================================================================
// PAGE OPERATIONS
// ============================================================================

/**
 * Get all pages for a workspace from local storage.
 */
export async function getLocalPages(workspaceId: string): Promise<OfflinePage[]> {
  return offlineDb.pages
    .where('workspace')
    .equals(workspaceId)
    .filter((p) => p._syncStatus !== 'deleted')
    .toArray();
}

/**
 * Get a single page by ID.
 */
export async function getLocalPage(id: string): Promise<OfflinePage | undefined> {
  return offlineDb.pages.get(id);
}

/**
 * Save a page to local storage.
 */
export async function saveLocalPage(page: OfflinePage): Promise<void> {
  await offlineDb.pages.put(page);
}

/**
 * Atomically merge and save a page update.
 * Uses a Dexie transaction to prevent race conditions when multiple
 * rapid updates occur (e.g., saving savedViews and sort settings simultaneously).
 * 
 * @param id - Page ID
 * @param updates - Partial page data to merge (only specified fields are updated)
 * @param crdtUpdates - CRDT metadata updates to apply
 * @returns The merged page
 */
export async function mergeAndSaveLocalPage(
  id: string,
  updates: Partial<OfflinePage>,
  crdtUpdates: {
    _syncStatus: SyncStatus;
    _hlc: HLCTimestamp;
    _fieldHLCs: Record<string, HLCTimestamp>;
    _blockHLCs?: Record<string, HLCTimestamp>;
    _deletedBlocks?: Record<string, HLCTimestamp>;
    _hasContent?: boolean;
    _contentFetchedAt?: number;
    _lastSyncedContent?: string | null;
  }
): Promise<OfflinePage> {
  return offlineDb.transaction('rw', offlineDb.pages, async () => {
    // Read current state within transaction (locked)
    const existing = await offlineDb.pages.get(id);
    
    // Merge: existing data + new updates + CRDT metadata
    const merged: OfflinePage = {
      ...(existing || {} as OfflinePage),
      ...updates,
      ...crdtUpdates,
      // Preserve existing CRDT state that wasn't updated
      _blockHLCs: {
        ...(existing?._blockHLCs || {}),
        ...(crdtUpdates._blockHLCs || {}),
      },
      _deletedBlocks: {
        ...(existing?._deletedBlocks || {}),
        ...(crdtUpdates._deletedBlocks || {}),
      },
      _contentFetchedAt: crdtUpdates._contentFetchedAt ?? existing?._contentFetchedAt,
      _lastSyncedContent: crdtUpdates._lastSyncedContent !== undefined 
        ? crdtUpdates._lastSyncedContent 
        : existing?._lastSyncedContent,
    } as OfflinePage;
    
    // Write merged state
    await offlineDb.pages.put(merged);
    
    return merged;
  });
}

/**
 * Bulk save pages (for initial sync).
 */
export async function bulkSavePages(pages: OfflinePage[]): Promise<void> {
  await offlineDb.pages.bulkPut(pages);
}

/**
 * Mark a page as deleted locally.
 */
export async function markPageDeleted(id: string, hlc: HLCTimestamp): Promise<void> {
  const page = await offlineDb.pages.get(id);
  if (page) {
    await offlineDb.pages.update(id, {
      _syncStatus: 'deleted',
      _hlc: hlc,
    });
  }
}

/**
 * Update a page's content and mark as having content.
 * Used when user opens a page and we fetch fresh content.
 */
export async function updatePageContent(
  id: string, 
  content: string | null,
  hlc: HLCTimestamp
): Promise<void> {
  const page = await offlineDb.pages.get(id);
  if (page) {
    await offlineDb.pages.update(id, {
      content,
      _hasContent: content !== null,
      _contentFetchedAt: Date.now(),
      _hlc: hlc,
    });
  }
}

/**
 * Purge content from pages older than the retention period.
 * Keeps metadata, just clears the content field.
 * 
 * @param retentionDays - Keep content for pages updated in last N days (0 = purge all)
 */
export async function purgeOldPageContent(
  workspaceId: string,
  retentionDays: number
): Promise<number> {
  const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
  
  const pagesToPurge = await offlineDb.pages
    .where('workspace')
    .equals(workspaceId)
    .filter((p) => {
      // Don't purge deleted pages (they'll be purged separately)
      if (p._syncStatus === 'deleted') return false;
      // Don't purge pages that don't have content
      if (!p._hasContent) return false;
      // Don't purge pages with pending changes
      if (p._syncStatus === 'pending') return false;
      // Purge if content was fetched before cutoff
      return (p._contentFetchedAt || 0) < cutoffTime;
    })
    .toArray();
  
  for (const page of pagesToPurge) {
    await offlineDb.pages.update(page.id, {
      content: null,
      _hasContent: false,
    });
  }
  
  devLog(`[offlineDb] Purged content from ${pagesToPurge.length} old pages`);
  return pagesToPurge.length;
}

/**
 * Get pages that need content refresh (opened but content is stale).
 */
export async function getPagesNeedingContentRefresh(
  workspaceId: string,
  staleAfterMs: number = OFFLINE_STORAGE.NOTE_CONTENT_STALE_AFTER_MS
): Promise<string[]> {
  const staleTime = Date.now() - staleAfterMs;
  
  const stalePages = await offlineDb.pages
    .where('workspace')
    .equals(workspaceId)
    .filter((p) => {
      if (p._syncStatus === 'deleted') return false;
      if (!p._hasContent) return false;
      return (p._contentFetchedAt || 0) < staleTime;
    })
    .toArray();
  
  return stalePages.map(p => p.id);
}

/**
 * Get all task collection pages (viewMode='tasks') for a workspace.
 */
export async function getLocalTaskCollections(workspaceId: string): Promise<OfflinePage[]> {
  return offlineDb.pages
    .where('workspace')
    .equals(workspaceId)
    .filter((p) => p._syncStatus !== 'deleted' && p.viewMode === 'tasks')
    .toArray();
}

// ============================================================================
// HLC STATE PERSISTENCE
// ============================================================================

/**
 * Save HLC state to IndexedDB.
 */
export async function saveHLCState(state: Omit<HLCState, 'id'>): Promise<void> {
  await offlineDb.hlcState.put({ ...state, id: 'hlc' });
}

/**
 * Load HLC state from IndexedDB.
 */
export async function loadHLCState(): Promise<HLCState | undefined> {
  return offlineDb.hlcState.get('hlc');
}

// ============================================================================
// SYNC METADATA
// ============================================================================

/**
 * Get sync metadata for a collection/workspace.
 */
export async function getSyncMeta(
  collection: SyncCollection,
  workspaceId: string
): Promise<SyncMeta | undefined> {
  return offlineDb.syncMeta.get(`${collection}:${workspaceId}`);
}

/**
 * Update sync metadata after successful sync.
 */
export async function updateSyncMeta(
  collection: SyncCollection,
  workspaceId: string,
  serverTimestamp?: string
): Promise<void> {
  await offlineDb.syncMeta.put({
    id: `${collection}:${workspaceId}`,
    lastSyncAt: Date.now(),
    lastServerTimestamp: serverTimestamp,
  });
}

// ============================================================================
// DATABASE MANAGEMENT
// ============================================================================

/**
 * Clear all data for a workspace (on logout or workspace switch).
 */
export async function clearWorkspaceData(workspaceId: string): Promise<void> {
  await Promise.all([
    offlineDb.tasks.where('workspace').equals(workspaceId).delete(),
    offlineDb.pages.where('workspace').equals(workspaceId).delete(),
    offlineDb.syncQueue.where('workspaceId').equals(workspaceId).delete(),
    offlineDb.imageUploadQueue.where('workspaceId').equals(workspaceId).delete(),
  ]);
}

/**
 * Clear all offline data (full reset).
 */
export async function clearAllOfflineData(): Promise<void> {
  await Promise.all([
    offlineDb.tasks.clear(),
    offlineDb.pages.clear(),
    offlineDb.syncQueue.clear(),
    offlineDb.syncMeta.clear(),
    offlineDb.imageUploadQueue.clear(),
    // Don't clear hlcState - preserve node identity
  ]);
}

/**
 * Get database statistics.
 */
export async function getDbStats(): Promise<{
  tasks: number;
  pages: number;
  pagesWithContent: number;
  taskCollections: number;
  pendingOps: number;
}> {
  const [tasks, pages, pendingOps] = await Promise.all([
    offlineDb.tasks.count(),
    offlineDb.pages.count(),
    offlineDb.syncQueue.count(),
  ]);
  
  // Count pages with content
  const pagesWithContent = await offlineDb.pages
    .filter((p) => p._hasContent === true)
    .count();
  
  // Count task collections
  const taskCollections = await offlineDb.pages
    .filter((p) => p.viewMode === 'tasks')
    .count();
  
  return { 
    tasks, 
    pages, 
    pagesWithContent, 
    taskCollections,
    pendingOps,
  };
}

/**
 * Estimate storage size in bytes.
 * Note: This is an approximation based on JSON serialization.
 */
export async function estimateStorageSize(): Promise<{
  tasks: number;
  pages: number;
  syncQueue: number;
  imageQueue: number;
  total: number;
}> {
  const [tasks, pages, syncQueue, imageQueue] = await Promise.all([
    offlineDb.tasks.toArray(),
    offlineDb.pages.toArray(),
    offlineDb.syncQueue.toArray(),
    offlineDb.imageUploadQueue.toArray(),
  ]);
  
  const tasksSize = JSON.stringify(tasks).length;
  const pagesSize = JSON.stringify(pages).length;
  const syncQueueSize = JSON.stringify(syncQueue).length;
  const imageQueueSize = JSON.stringify(imageQueue).length;
  
  return {
    tasks: tasksSize,
    pages: pagesSize,
    syncQueue: syncQueueSize,
    imageQueue: imageQueueSize,
    total: tasksSize + pagesSize + syncQueueSize + imageQueueSize,
  };
}

// ============================================================================
// IMAGE UPLOAD QUEUE HELPERS
// ============================================================================

/**
 * Generate a unique upload ID.
 */
export function generateUploadId(): string {
  return `upload_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Queue an image upload for sync.
 */
export async function queueImageUpload(
  upload: Omit<PendingImageUpload, 'id' | 'createdAt' | 'attempts'>
): Promise<string> {
  const id = generateUploadId();
  await offlineDb.imageUploadQueue.add({
    ...upload,
    id,
    createdAt: Date.now(),
    attempts: 0,
  });
  return id;
}

/**
 * Get pending image uploads for a workspace.
 */
export async function getPendingImageUploads(
  workspaceId: string
): Promise<PendingImageUpload[]> {
  return offlineDb.imageUploadQueue
    .where('workspaceId')
    .equals(workspaceId)
    .sortBy('createdAt');
}

/**
 * Get pending image uploads for a specific page.
 */
export async function getPendingImageUploadsForPage(
  pageId: string
): Promise<PendingImageUpload[]> {
  return offlineDb.imageUploadQueue
    .where('pageId')
    .equals(pageId)
    .sortBy('createdAt');
}

/**
 * Remove an image upload from the queue (after successful upload).
 */
export async function dequeueImageUpload(uploadId: string): Promise<void> {
  await offlineDb.imageUploadQueue.delete(uploadId);
}

/**
 * Mark an image upload as failed.
 */
export async function markImageUploadFailed(
  uploadId: string,
  error: string
): Promise<void> {
  const upload = await offlineDb.imageUploadQueue.get(uploadId);
  if (upload) {
    await offlineDb.imageUploadQueue.update(uploadId, {
      attempts: upload.attempts + 1,
      lastError: error,
    });
  }
}

/**
 * Get an image upload by its blob URL.
 */
export async function getImageUploadByBlobUrl(
  blobUrl: string
): Promise<PendingImageUpload | undefined> {
  return offlineDb.imageUploadQueue
    .filter((upload) => upload.blobUrl === blobUrl)
    .first();
}

/**
 * Clear all pending image uploads for a workspace.
 */
export async function clearImageUploadQueue(workspaceId: string): Promise<void> {
  await offlineDb.imageUploadQueue.where('workspaceId').equals(workspaceId).delete();
}
