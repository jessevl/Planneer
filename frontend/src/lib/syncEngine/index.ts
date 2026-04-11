/**
 * @file syncEngine/index.ts
 * @description Sync engine for offline-first operation with CRDT conflict resolution
 * @app SHARED - Core sync logic between IndexedDB and PocketBase
 *
 * The sync engine handles:
 * 1. Queuing local changes when offline
 * 2. Processing the queue when online
 * 3. Merging remote changes using CRDTs
 * 4. Handling conflicts automatically (field-level for tasks, block-level for pages)
 *
 * NOTE: Uses Unified Pages architecture - 'pages' collection replaces 'pages' and 'projects'
 *
 * Flow:
 * - Local write → Save to IndexedDB → Queue operation → Try sync
 * - Remote change (SSE) → Merge with local → Update IndexedDB → Notify stores
 * - Reconnect → Process queue → Fetch remote changes → Merge all
 */

import {
  type OfflineTask,
  type OfflinePage,
  getPendingCount,
  clearWorkspaceData,
} from '../offlineDb';
import type { Task } from '@/types/task';
import type { Page } from '@/types/page';
import { CONNECTION, devLog } from '../config';

// Import from submodules
import type {
  SyncEngineState,
  SyncEventType,
  SyncEvent,
  SyncEventListener,
  DataChangeEvent,
  LoadInitialDataResult,
  PagesPaginationResult,
} from './types';
import { SyncEventEmitter } from './events';
import { restoreHLCState, persistHLCState } from './hlcState';
import {
  recordLocalTaskChange,
  recordLocalPageChange,
} from './localOperations';
import {
  handleRemoteTaskChange,
  handleRemotePageChange,
} from './remoteHandlers';
import { loadInitialData, loadMorePages, downloadAllForOffline, type DownloadProgressCallback } from './dataLoader';
import { ensurePageContent, type PageContentResult } from './contentLoader';
import { processQueue } from './queueProcessor';
import { SSEManager } from './sseManager';
import {
  queueImageForUpload,
  processAllPendingImageUploads,
  replaceBlobUrlsInContent,
  getPendingImageUploadCount,
  type QueuedImageResult,
} from './imageUpload';

// Re-export types
export type {
  SyncEngineState,
  SyncError,
  SyncEventType,
  SyncEvent,
  SyncEventListener,
  DataChangeEvent,
  LoadInitialDataResult,
  PagesPaginationResult,
} from './types';

// Re-export image upload types and utilities
export { type QueuedImageResult } from './imageUpload';

// Re-export download progress callback type
export { type DownloadProgressCallback } from './dataLoader';

// ============================================================================
// SYNC ENGINE CLASS
// ============================================================================

/**
 * Sync engine singleton that manages offline/online synchronization.
 */
class SyncEngine {
  private isProcessing = false;
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private eventEmitter = new SyncEventEmitter();
  private syncTimeout: ReturnType<typeof setTimeout> | null = null;
  private initialized = false;
  private currentWorkspaceId: string | null = null;
  private sseManager: SSEManager;
  
  /**
   * Track records currently being synced to ignore SSE updates for them.
   * This prevents the "edit disappears then reappears" issue where:
   * 1. We push local changes to server
   * 2. SSE receives update event from our push
   * 3. SSE handler would overwrite local state with server data
   * 
   * By tracking syncing records, SSE handlers can skip updates for them.
   */
  private syncingRecords = new Set<string>();

  constructor() {
    this.sseManager = new SSEManager(this.syncingRecords, this.eventEmitter);
  }

  /**
   * Check if a record is currently being synced (to skip SSE updates).
   */
  isRecordSyncing(recordId: string): boolean {
    return this.syncingRecords.has(recordId);
  }

  /**
   * Mark a record as syncing to protect it from SSE updates.
   * Called immediately when queueing a local change, before async work starts.
   */
  markRecordSyncing(recordId: string): void {
    this.syncingRecords.add(recordId);
  }

  /**
   * Set the current workspace ID. Only operations for this workspace will be synced.
   */
  setWorkspace(workspaceId: string | null): void {
    this.currentWorkspaceId = workspaceId;
  }

  /**
   * Get the current workspace ID.
   */
  getWorkspace(): string | null {
    return this.currentWorkspaceId;
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize the sync engine.
   * - Restore HLC state from IndexedDB
   * - Set up online/offline listeners
   * - Start processing queue if online
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Restore HLC state
    await restoreHLCState();

    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
      window.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    this.initialized = true;

    // Process queue if online
    if (this.isOnline) {
      this.scheduleSync();
    }
  }

  /**
   * Clean up event listeners.
   */
  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
      window.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    this.eventEmitter.clear();
    this.sseManager.stop();
  }

  // ============================================================================
  // ONLINE/OFFLINE HANDLING
  // ============================================================================

  /** Timestamp of when the tab was last visible (for detecting sleep/freeze duration) */
  private lastVisibleTime = Date.now();

  private static readonly FREEZE_THRESHOLD_MS = 30_000;        // 30s = page was frozen/slept
  private static readonly LONG_SLEEP_THRESHOLD_MS = 5 * 60_000; // 5min = force full refresh

  private handleVisibilityChange = (): void => {
    if (typeof document === 'undefined') return;

    const now = Date.now();

    if (document.visibilityState === 'hidden') {
      // Going hidden — record the time so we can measure the gap on return
      this.lastVisibleTime = now;
      return;
    }

    // Becoming visible
    const elapsed = now - this.lastVisibleTime;
    this.lastVisibleTime = now;

    // Short hide (< 30s): SSE likely stayed connected, skip the fetch
    if (elapsed < SyncEngine.FREEZE_THRESHOLD_MS) {
      devLog('[SyncEngine] Tab was hidden for', Math.round(elapsed / 1000), 's — skipping refresh');
      return;
    }

    const workspaceId = this.currentWorkspaceId;
    if (!this.isOnline || !workspaceId) return;

    const forceFullRefresh = elapsed >= SyncEngine.LONG_SLEEP_THRESHOLD_MS;
    devLog(
      '[SyncEngine] Tab was hidden for', Math.round(elapsed / 1000),
      's — syncing', forceFullRefresh ? '(forced full refresh)' : '(delta)',
    );

    // Small delay to let the network stack stabilize after wake
    setTimeout(() => {
      if (document.visibilityState !== 'visible') return;
      this.loadInitialData(workspaceId, { forceFullRefresh }).catch((error) => {
        devLog('[SyncEngine] Failed to refresh on visibility change:', error);
      });
    }, 1000);
  };

  private handleOnline = (): void => {
    this.isOnline = true;
    this.eventEmitter.emit({ type: 'online' });
    
    // When coming back online, do a full sync.
    // We add a small delay (500ms) because on some mobile devices (especially iOS),
    // the 'online' event fires slightly before the network stack is fully ready
    // to handle requests, which can lead to immediate 'status 0' errors.
    setTimeout(() => {
      if (!this.isOnline) return; // Check if we're still online

      if (this.currentWorkspaceId) {
        devLog('[SyncEngine] Back online - performing full sync');
        this.loadInitialData(this.currentWorkspaceId).catch((error) => {
          devLog('[SyncEngine] Failed to sync on reconnect:', error);
          // Still try to push pending changes even if fetch failed
          this.scheduleSync();
        });
      } else {
        this.scheduleSync();
      }
    }, 500);
  };

  private handleOffline = (): void => {
    this.isOnline = false;
    this.eventEmitter.emit({ type: 'offline' });
  };

  // ============================================================================
  // EVENT SUBSCRIPTION
  // ============================================================================

  /**
   * Subscribe to sync events.
   */
  subscribe(listener: SyncEventListener): () => void {
    return this.eventEmitter.subscribe(listener);
  }

  // ============================================================================
  // LOCAL OPERATIONS (called by stores)
  // ============================================================================

  /**
   * Record a local task change and queue for sync.
   */
  async recordTaskChange(
    operation: 'create' | 'update' | 'delete',
    task: Task,
    changedFields?: string[],
    workspaceId?: string
  ): Promise<OfflineTask> {
    // IMMEDIATELY mark as syncing to protect from SSE overwrites
    // This must happen BEFORE any async work starts
    this.syncingRecords.add(task.id);
    
    const offlineTask = await recordLocalTaskChange(operation, task, changedFields, workspaceId);
    
    // Persist HLC state
    await persistHLCState();

    // Try to sync
    this.eventEmitter.emit({ type: 'pending-change' });
    if (this.isOnline) {
      this.scheduleSync();
    }

    return offlineTask;
  }

  /**
   * Record a local page change and queue for sync.
   */
  async recordPageChange(
    operation: 'create' | 'update' | 'delete',
    page: Page,
    changedFields?: string[],
    workspaceId?: string
  ): Promise<OfflinePage> {
    // IMMEDIATELY mark as syncing to protect from SSE overwrites
    // This must happen BEFORE any async work starts
    this.syncingRecords.add(page.id);
    
    const offlinePage = await recordLocalPageChange(operation, page, changedFields, workspaceId);
    
    // Persist HLC state
    await persistHLCState();

    // Try to sync
    this.eventEmitter.emit({ type: 'pending-change' });
    if (this.isOnline) {
      this.scheduleSync();
    }

    return offlinePage;
  }

  // ============================================================================
  // REMOTE CHANGE HANDLING (called from SSE subscriptions)
  // ============================================================================

  /**
   * Handle a remote task change from SSE.
   */
  async handleRemoteTaskChange(
    action: 'create' | 'update' | 'delete',
    remoteTask: Task
  ): Promise<OfflineTask | null> {
    const result = await handleRemoteTaskChange(action, remoteTask);
    this.eventEmitter.emit({ type: 'remote-change', data: { collection: 'tasks', record: result } });
    return result;
  }

  /**
   * Handle a remote page change from SSE.
   */
  async handleRemotePageChange(
    action: 'create' | 'update' | 'delete',
    remotePage: Page,
    changedBlocks?: Record<string, unknown>,
    deletedBlocks?: string[],
    blockOrders?: Record<string, number>
  ): Promise<OfflinePage | null> {
    const result = await handleRemotePageChange(action, remotePage, changedBlocks, deletedBlocks, blockOrders);
    this.eventEmitter.emit({ type: 'remote-change', data: { collection: 'pages', record: result } });
    return result;
  }

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  /**
   * Load initial data for a workspace.
   * @param options.forceFullRefresh - Skip delta sync and fetch all data fresh
   */
  async loadInitialData(workspaceId: string, options?: { forceFullRefresh?: boolean }): Promise<LoadInitialDataResult> {
    this.currentWorkspaceId = workspaceId;
    return loadInitialData(
      workspaceId,
      this.isOnline,
      this.eventEmitter,
      () => this.scheduleSync(),
      options
    );
  }

  /**
   * Load more pages from server and persist to IndexedDB.
   */
  async loadMorePages(options: {
    rootOnly?: boolean;
    parentId?: string;
    page?: number;
    pageSize?: number;
    sortBy?: 'updated' | 'created' | 'order' | 'title';
    sortDirection?: 'asc' | 'desc';
  }): Promise<PagesPaginationResult> {
    return loadMorePages(this.currentWorkspaceId, options);
  }

  // Backward compatibility alias
  loadMoreNotes = this.loadMorePages.bind(this);

  /**
   * Ensure a page has content loaded (for editor).
   */
  async ensurePageContent(pageId: string, forceRefresh = false): Promise<PageContentResult> {
    return ensurePageContent(pageId, this.isOnline, forceRefresh);
  }

  // Backward compatibility alias
  ensureNoteContent = this.ensurePageContent.bind(this);

  /**
   * Download all data for offline use.
   * This fetches ALL tasks (including completed) and ALL pages with full content.
   * Use for explicit "Download All" action from Settings.
   */
  async downloadAllForOffline(onProgress?: DownloadProgressCallback): Promise<{ tasks: number; pages: number; pagesWithContent: number }> {
    if (!this.currentWorkspaceId) {
      throw new Error('No workspace selected');
    }
    return downloadAllForOffline(this.currentWorkspaceId, onProgress);
  }

  // ============================================================================
  // IMAGE UPLOAD
  // ============================================================================

  /**
   * Queue an image for upload.
   * Returns immediately with a blob URL for the editor.
   * The actual upload happens when online.
   */
  async queueImageUpload(
    file: File,
    pageId: string
  ): Promise<QueuedImageResult> {
    if (!this.currentWorkspaceId) {
      throw new Error('No workspace selected');
    }
    
    const result = await queueImageForUpload(file, pageId, this.currentWorkspaceId);
    
    // If online, schedule immediate sync to process the upload
    if (this.isOnline) {
      this.scheduleSync(100); // Quick debounce
    }
    
    return result;
  }

  /**
   * Process all pending image uploads and return URL mapping.
   * Used to replace blob URLs in content with real URLs.
   */
  async processPendingImageUploads(): Promise<Map<string, string>> {
    if (!this.currentWorkspaceId || !this.isOnline) {
      return new Map();
    }
    
    return processAllPendingImageUploads(this.currentWorkspaceId);
  }

  /**
   * Get count of pending image uploads.
   */
  async getPendingImageUploadCount(): Promise<number> {
    if (!this.currentWorkspaceId) {
      return 0;
    }
    return getPendingImageUploadCount(this.currentWorkspaceId);
  }

  /**
   * Replace blob URLs in content with real URLs from completed uploads.
   */
  replaceBlobUrls(content: string | null, urlMap: Map<string, string>): string | null {
    return replaceBlobUrlsInContent(content, urlMap);
  }

  // ============================================================================
  // SSE SUBSCRIPTION MANAGEMENT
  // ============================================================================

  /**
   * Start SSE subscriptions for all collections.
   */
  startRealtimeSync(): void {
    if (!this.currentWorkspaceId) {
      devLog('[SyncEngine] Cannot start realtime sync without workspace');
      return;
    }
    this.sseManager.start(this.currentWorkspaceId);
  }

  /**
   * Stop all SSE subscriptions.
   */
  stopRealtimeSync(): void {
    this.sseManager.stop();
  }

  /**
   * Clear all data for current workspace (for logout/switch).
   */
  async clearWorkspace(): Promise<void> {
    this.stopRealtimeSync();
    if (this.currentWorkspaceId) {
      await clearWorkspaceData(this.currentWorkspaceId);
    }
    this.currentWorkspaceId = null;
  }

  // ============================================================================
  // SYNC QUEUE PROCESSING
  // ============================================================================

  /**
   * Schedule sync with debounce.
   */
  private scheduleSync(delayMs: number = CONNECTION.SYNC_DEBOUNCE_MS): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    this.syncTimeout = setTimeout(() => {
      // Only sync current workspace
      if (this.currentWorkspaceId) {
        this.processQueue(this.currentWorkspaceId);
      }
    }, delayMs);
  }

  /**
   * Process all pending operations in the queue for a specific workspace.
   */
  async processQueue(workspaceId?: string): Promise<void> {
    const targetWorkspace = workspaceId || this.currentWorkspaceId;
    if (!targetWorkspace) return;

    const isProcessingRef = { current: this.isProcessing };
    
    await processQueue(
      targetWorkspace,
      this.isOnline,
      isProcessingRef,
      this.eventEmitter,
      this.syncingRecords,
      () => this.scheduleSync()
    );
    
    this.isProcessing = isProcessingRef.current;
  }

  // ============================================================================
  // STATE & UTILITIES
  // ============================================================================

  /**
   * Get current sync state.
   */
  async getState(workspaceId?: string): Promise<SyncEngineState> {
    const pendingCount = await getPendingCount(workspaceId);
    return {
      isOnline: this.isOnline,
      isSyncing: this.isProcessing,
      pendingCount,
      lastSyncAt: null, // TODO: track this
      errors: [],
    };
  }

  /**
   * Force an immediate sync.
   */
  async forceSync(workspaceId?: string): Promise<void> {
    if (!this.isOnline) {
      throw new Error('Cannot sync while offline');
    }
    await this.processQueue(workspaceId);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/** Global sync engine instance */
export const syncEngine = new SyncEngine();

/**
 * Initialize the sync engine (call on app startup).
 */
export async function initializeSyncEngine(): Promise<void> {
  await syncEngine.initialize();
}
