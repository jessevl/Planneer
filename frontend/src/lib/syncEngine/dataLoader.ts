/**
 * @file syncEngine/dataLoader.ts
 * @description Initial data loading and server data merging
 * 
 * NOTE: This uses the Unified Pages architecture where:
 * - Notes are now called "pages"
 * - Projects are pages with viewMode='tasks'
 */

import {
  type HLCTimestamp,
  tick,
  createFieldHLCs,
  mergeRecords,
  mergeYooptaContent,
  TASK_CRDT_FIELDS,
  PAGE_CRDT_FIELDS,
} from '../crdt';
import {
  type OfflineTask,
  type OfflinePage,
  type SyncCollection,
  saveLocalTask,
  saveLocalPage,
  getLocalTask,
  getLocalPage,
  getLocalTasks,
  getLocalPages,
  updateSyncMeta,
  getSyncMeta,
  purgeOldPageContent,
  offlineDb,
} from '../offlineDb';
import * as tasksApi from '@/api/tasksApi';
import * as pagesApi from '@/api/pagesApi';
import type { Task } from '@/types/task';
import type { Page } from '@/types/page';
import { useSettingsStore } from '@/stores/settingsStore';
import { PAGES_PAGINATION, devLog, devWarn } from '../config';
import type { LoadInitialDataResult, LoadInitialDataOptions, PagesPaginationResult, DataChangeEvent } from './types';
import { SyncEventEmitter } from './events';
import { extractBlockIds, stripSyncMetadata, getPageSyncContent } from './utils';
import { extractExcerpt, computeExcerptForSync } from '@/lib/pageUtils';


// ============================================================================
// INITIAL DATA LOADING
// ============================================================================

/**
 * Load initial data for a workspace.
 * 
 * Data fetching strategy (complete metadata + lazy content):
 * 
 * **First load (no cache):**
 * - Tasks: All incomplete + completed today or later (no completed old tasks)
 * - Pages: ALL pages metadata (no content) - ensures pinned pages at any level are available
 * 
 * **Subsequent loads (has cache):**
 * - Emit cached data immediately (instant UI)
 * - Delta sync: Fetch only items updated since lastSyncAt
 * - Also fetch pinned pages explicitly (in case they were added while offline)
 * - Merge deltas into local cache
 * 
 * **Content caching (based on offlineSettings.noteContentRetentionDays):**
 * - 0: No content cached (metadata only, loaded on demand when opening page)
 * - 7/14/30: Also fetch and cache content for pages updated in last N days
 * 
 * Flow:
 * 1. Load from IndexedDB first (instant UI)
 * 2. If has cache: Delta sync + pinned pages fetch
 *    If no cache or forceFullRefresh: Fetch ALL pages metadata
 * 3. Merge server data with local using CRDT
 * 4. Optionally fetch content for recent pages
 * 5. Purge content older than retention period
 * 6. Emit data-loaded event
 * 
 * @param options.forceFullRefresh - Skip delta sync and fetch all data fresh (for PWA resume)
 */
export async function loadInitialData(
  workspaceId: string,
  isOnline: boolean,
  eventEmitter: SyncEventEmitter,
  scheduleSync: (delayMs?: number) => void,
  options?: LoadInitialDataOptions
): Promise<LoadInitialDataResult> {
  const forceFullRefresh = options?.forceFullRefresh ?? false;
  devLog('[SyncEngine] Loading initial data for workspace:', workspaceId, forceFullRefresh ? '(forced refresh)' : '');

  // Get offline settings
  const { noteContentRetentionDays } = useSettingsStore.getState().offlineSettings;

  // Step 1: Load from IndexedDB first (instant UI)
  const localTasks = await getLocalTasks(workspaceId);
  const localPages = await getLocalPages(workspaceId);
  
  // Get last sync timestamp for delta sync
  const pagesSyncMeta = await getSyncMeta('pages', workspaceId);
  // Use delta sync only if: has cache, has sync timestamp, and NOT forcing refresh
  const canUseDeltaSync = localPages.length > 0 && pagesSyncMeta?.lastServerTimestamp && !forceFullRefresh;

  const cachedTasks = stripSyncMetadata(localTasks) as Task[];
  const cachedPages = stripSyncMetadata(localPages) as Page[];

  const hasCache = cachedTasks.length > 0 || cachedPages.length > 0;

  // Emit cached data immediately if we have it (offline-first)
  if (hasCache) {
    const pagesWithExcerpt = cachedPages.filter(p => p.excerpt).length;
    devLog('[SyncEngine] Loaded from cache:', {
      tasks: cachedTasks.length,
      pages: cachedPages.length,
      pagesWithExcerpt,
      lastPageSync: pagesSyncMeta?.lastServerTimestamp,
    });
    eventEmitter.emit({
      type: 'tasks-changed',
      data: { action: 'bulk-load', records: cachedTasks } as DataChangeEvent<Task>,
    });
    // Emit ALL pages (unified - includes both pages and task collections)
    eventEmitter.emit({
      type: 'pages-changed',
      data: { action: 'bulk-load', records: cachedPages } as DataChangeEvent<Page>,
    });
  }

  // If offline, return cached data
  if (!isOnline) {
    devLog('[SyncEngine] Offline - using cached data only');
    eventEmitter.emit({ type: 'data-loaded', data: { fromCache: true } });
    return { tasks: cachedTasks, pages: cachedPages, fromCache: true };
  }

  // Step 2: Fetch from server
  try {
    let serverPages: Page[];
    let serverTimestamp: string | undefined;
    
    if (canUseDeltaSync) {
      // Delta sync: Fetch pages updated since last sync
      devLog('[SyncEngine] Delta sync for pages since:', pagesSyncMeta?.lastServerTimestamp);
      const deltaResult = await pagesApi.fetchPagesSince(pagesSyncMeta!.lastServerTimestamp!);
      serverTimestamp = deltaResult.serverTimestamp;
      devLog(`[SyncEngine] Delta sync found ${deltaResult.pages.length} updated pages`);
      
      // Also fetch pinned pages explicitly - they might be deeply nested
      // and need to be available for sidebar even if parent wasn't updated
      const pinnedPages = await pagesApi.fetchPinnedPages();
      devLog(`[SyncEngine] Fetched ${pinnedPages.length} pinned pages`);
      
      // Merge delta pages with pinned pages (dedupe by ID)
      const pageMap = new Map<string, Page>();
      for (const page of deltaResult.pages) {
        pageMap.set(page.id, page);
      }
      for (const page of pinnedPages) {
        if (!pageMap.has(page.id)) {
          pageMap.set(page.id, page);
        }
      }
      serverPages = Array.from(pageMap.values());
    } else {
      // First load OR forced refresh: Fetch ALL pages metadata (not just root)
      // This ensures pinned pages at any level, nested pages, etc. are all available
      devLog('[SyncEngine] Full load - fetching all pages metadata');
      serverPages = await pagesApi.fetchAllPagesMetadata();
      serverTimestamp = new Date().toISOString();
      devLog(`[SyncEngine] Fetched ${serverPages.length} total pages`);
    }

    // Tasks: fetch all incomplete + recently completed
    const serverTasks = await tasksApi.fetchTasks();

    devLog('[SyncEngine] Fetched from server:', {
      tasks: serverTasks.length,
      pages: serverPages.length,
      contentRetention: noteContentRetentionDays,
    });

    // Step 3: Merge server data into local IndexedDB
    await mergeServerData('tasks', serverTasks, workspaceId);
    // Pages are merged as metadata-only (content = null, _hasContent = false)
    await mergeServerPagesMetadata(serverPages, workspaceId);
    // Update pages sync timestamp
    if (serverTimestamp) {
      await updateSyncMeta('pages', workspaceId, serverTimestamp);
    }

    // Step 4: Reconcile with server to purge deleted items
    // This ensures that items deleted on other devices while this one was offline
    // are correctly removed from the local cache.
    await Promise.all([
      reconcileTasks(workspaceId),
      reconcilePages(workspaceId)
    ]);

    // Step 5: Optionally fetch and cache content for recent pages
    if (noteContentRetentionDays > 0) {
      devLog(`[SyncEngine] Fetching content for pages from last ${noteContentRetentionDays} days`);
      const recentPagesWithContent = await pagesApi.fetchRecentPagesWithContent(noteContentRetentionDays);
      
      // Update IndexedDB with content
      for (const page of recentPagesWithContent) {
        await updatePageWithContent(page);
      }
      
      devLog(`[SyncEngine] Cached content for ${recentPagesWithContent.length} recent pages`);
    }

    // Step 6: Purge old content based on retention setting
    if (noteContentRetentionDays > 0) {
      await purgeOldPageContent(workspaceId, noteContentRetentionDays);
    }

    // Step 7: Load final merged state from IndexedDB
    const mergedTasks = await getLocalTasks(workspaceId);
    const mergedPages = await getLocalPages(workspaceId);

    const finalTasks = stripSyncMetadata(mergedTasks) as Task[];
    const finalPages = stripSyncMetadata(mergedPages) as Page[];

    const finalPagesWithExcerpt = finalPages.filter(p => p.excerpt).length;
    devLog('[SyncEngine] Final merged state:', {
      tasks: finalTasks.length,
      pages: finalPages.length,
      pagesWithExcerpt: finalPagesWithExcerpt,
    });

    // Emit merged data (may have changed from cache)
    eventEmitter.emit({
      type: 'tasks-changed',
      data: { action: 'bulk-load', records: finalTasks } as DataChangeEvent<Task>,
    });
    // Emit ALL pages (unified - includes both pages and task collections)
    eventEmitter.emit({
      type: 'pages-changed',
      data: { 
        action: 'bulk-load', 
        records: finalPages,
        // No pagination since we load all pages
        pagination: {
          hasMore: false,
          totalItems: finalPages.length,
        },
      } as DataChangeEvent<Page> & { pagination?: { hasMore: boolean; totalItems: number } },
    });

    // Process any pending operations
    scheduleSync();

    eventEmitter.emit({ type: 'data-loaded', data: { fromCache: false } });
    
    return { 
      tasks: finalTasks, 
      pages: finalPages,
      fromCache: false,
      pagesPagination: {
        hasMore: false,
        totalItems: finalPages.length,
      },
    };
  } catch (error) {
    devLog('[SyncEngine] Failed to fetch from server:', error);
    // If server fetch fails but we have cache, use that
    if (hasCache) {
      devLog('[SyncEngine] Using cached data after server error');
      eventEmitter.emit({ type: 'data-loaded', data: { fromCache: true } });
      return { tasks: cachedTasks, pages: cachedPages, fromCache: true };
    }
    // No cache and server failed - rethrow
    throw error;
  }
}

/**
 * Load more pages from server and persist to IndexedDB.
 * Called by pagesStore.loadMorePages() when user clicks "Load More".
 */
export async function loadMorePages(
  workspaceId: string | null,
  options: {
    rootOnly?: boolean;
    parentId?: string;
    page?: number;
    pageSize?: number;
    sortBy?: 'updated' | 'created' | 'order' | 'title';
    sortDirection?: 'asc' | 'desc';
  }
): Promise<PagesPaginationResult> {
  if (!workspaceId) {
    devLog('[SyncEngine] No workspace set, cannot load more pages');
    return { pages: [], hasMore: false, totalItems: 0 };
  }

  try {
    const result = await pagesApi.fetchPages(options);
    
    // Persist to IndexedDB for offline access
    await mergeServerPagesMetadata(result.pages, workspaceId);
    
    // Filter out pages that are locally deleted (pending delete sync)
    // This prevents race conditions where server responds before delete is synced
    const filteredPages: Page[] = [];
    for (const page of result.pages) {
      const local = await getLocalPage(page.id);
      if (!local || local._syncStatus !== 'deleted') {
        filteredPages.push(page);
      }
    }
    
    devLog(`[SyncEngine] Loaded more pages: ${filteredPages.length} (filtered from ${result.pages.length}), hasMore: ${result.hasMore}`);
    
    return {
      pages: filteredPages,
      hasMore: result.hasMore,
      totalItems: result.totalItems,
    };
  } catch (error) {
    devLog('[SyncEngine] Failed to load more pages from server:', error);
    
    // If it's a network error, return empty result instead of throwing
    // This prevents app boot failure when restoring expanded notes offline
    return { pages: [], hasMore: true, totalItems: 0 };
  }
}

// Backward compatibility alias
export const loadMoreNotes = loadMorePages;

// ============================================================================
// DOWNLOAD ALL FOR OFFLINE
// ============================================================================

/**
 * Progress callback for downloadAllForOffline
 */
export interface DownloadProgressCallback {
  (progress: {
    stage: 'tasks' | 'pages-metadata' | 'pages-content';
    current: number;
    total: number;
    message: string;
  }): void;
}

/**
 * Download all data for offline use.
 * This is an explicit action triggered by the user from Settings.
 * 
 * Unlike the regular initial load which is optimized for speed (delta sync),
 * this function:
 * 1. Fetches ALL tasks (including old completed for history)
 * 2. Fetches ALL pages metadata
 * 3. Fetches ALL pages content (full content, not just recent)
 * 
 * @param workspaceId - Workspace to download
 * @param onProgress - Progress callback for UI updates
 * @returns Summary of what was downloaded
 */
export async function downloadAllForOffline(
  workspaceId: string,
  onProgress?: DownloadProgressCallback
): Promise<{ tasks: number; pages: number; pagesWithContent: number }> {
  devLog('[SyncEngine] Starting full offline download for workspace:', workspaceId);
  
  // Step 1: Download all tasks (including completed)
  onProgress?.({ stage: 'tasks', current: 0, total: 0, message: 'Fetching all tasks...' });
  const allTasks = await tasksApi.fetchTasks({ includeCompleted: true });
  await mergeServerData('tasks', allTasks, workspaceId);
  onProgress?.({ stage: 'tasks', current: allTasks.length, total: allTasks.length, message: `Downloaded ${allTasks.length} tasks` });
  devLog(`[SyncEngine] Downloaded ${allTasks.length} tasks`);
  
  // Step 2: Download all pages metadata
  onProgress?.({ stage: 'pages-metadata', current: 0, total: 0, message: 'Fetching all pages...' });
  const allPages = await pagesApi.fetchAllPagesMetadata();
  await mergeServerPagesMetadata(allPages, workspaceId);
  onProgress?.({ stage: 'pages-metadata', current: allPages.length, total: allPages.length, message: `Downloaded ${allPages.length} pages` });
  devLog(`[SyncEngine] Downloaded ${allPages.length} pages metadata`);
  
  // Step 3: Download all pages content (batch to avoid memory issues)
  // Note: We fetch ALL content, not just recent. This is a deliberate choice for offline.
  const pagesWithContent: string[] = [];
  const BATCH_SIZE = 20;
  
  for (let i = 0; i < allPages.length; i += BATCH_SIZE) {
    const batch = allPages.slice(i, i + BATCH_SIZE);
    onProgress?.({ 
      stage: 'pages-content', 
      current: i, 
      total: allPages.length, 
      message: `Downloading content ${i + 1} - ${Math.min(i + BATCH_SIZE, allPages.length)} of ${allPages.length}...` 
    });
    
    // Fetch content for each page in batch (parallel but limited)
    const contentPromises = batch.map(async (page) => {
      try {
        const fullPage = await pagesApi.fetchPage(page.id);
        if (fullPage && fullPage.content) {
          await updatePageWithContent(fullPage);
          return page.id;
        }
      } catch (e) {
        devWarn(`[SyncEngine] Failed to fetch content for page ${page.id}:`, e);
      }
      return null;
    });
    
    const results = await Promise.all(contentPromises);
    pagesWithContent.push(...results.filter((id): id is string => id !== null));
  }
  
  onProgress?.({ 
    stage: 'pages-content', 
    current: allPages.length, 
    total: allPages.length, 
    message: `Downloaded content for ${pagesWithContent.length} pages` 
  });
  devLog(`[SyncEngine] Downloaded content for ${pagesWithContent.length} pages`);
  
  // Update sync timestamp to now
  await updateSyncMeta('pages', workspaceId, new Date().toISOString());
  
  return {
    tasks: allTasks.length,
    pages: allPages.length,
    pagesWithContent: pagesWithContent.length,
  };
}

// ============================================================================
// SERVER DATA MERGING
// ============================================================================

/**
 * Merge server data into IndexedDB using CRDT logic.
 * Only handles 'tasks' and 'pages' collections.
 */
export async function mergeServerData(
  collection: SyncCollection,
  serverRecords: Task[] | Page[],
  workspaceId: string
): Promise<void> {
  const hlc = tick();

  for (const serverRecord of serverRecords) {
    switch (collection) {
      case 'tasks': {
        const task = serverRecord as Task;
        const local = await getLocalTask(task.id);
        
        if (!local) {
          // New from server
          const offlineTask: OfflineTask = {
            ...task,
            workspace: workspaceId,
            _syncStatus: 'synced',
            _hlc: hlc,
            _fieldHLCs: createFieldHLCs(task as unknown as Record<string, unknown>, TASK_CRDT_FIELDS, hlc),
          };
          await saveLocalTask(offlineTask);
        } else if (local._syncStatus === 'pending') {
          // Local has changes - merge with CRDT
          // PocketBase adds 'updated' field automatically, cast to access it
          const taskUpdated = (task as unknown as { updated?: string }).updated;
          const serverHLC: HLCTimestamp = { 
            ts: new Date(taskUpdated || Date.now()).getTime(), 
            counter: 0, 
            node: 'server' 
          };
          const remoteWithCRDT: OfflineTask = {
            ...task,
            workspace: workspaceId,
            _syncStatus: 'synced',
            _hlc: serverHLC,
            _fieldHLCs: createFieldHLCs(task as unknown as Record<string, unknown>, TASK_CRDT_FIELDS, serverHLC),
          };
          const { merged, hadLocalChanges } = mergeRecords<OfflineTask>(local, remoteWithCRDT, TASK_CRDT_FIELDS);
          merged._syncStatus = hadLocalChanges ? 'pending' : 'synced';
          await saveLocalTask(merged);
        } else {
          // Local is synced - update to server version
          const offlineTask: OfflineTask = {
            ...task,
            workspace: workspaceId,
            _syncStatus: 'synced',
            _hlc: hlc,
            _fieldHLCs: createFieldHLCs(task as unknown as Record<string, unknown>, TASK_CRDT_FIELDS, hlc),
          };
          await saveLocalTask(offlineTask);
        }
        break;
      }
      case 'pages': {
        const page = serverRecord as Page;
        const local = await getLocalPage(page.id);
        
        if (!local) {
          // New from server
          const blockIds = extractBlockIds(page.content);
          const blockHLCs: Record<string, HLCTimestamp> = {};
          for (const blockId of blockIds) {
            blockHLCs[blockId] = hlc;
          }
          const offlinePage: OfflinePage = {
            ...page,
            workspace: workspaceId,
            _syncStatus: 'synced',
            _hlc: hlc,
            _fieldHLCs: createFieldHLCs(page as unknown as Record<string, unknown>, PAGE_CRDT_FIELDS, hlc),
            _blockHLCs: blockHLCs,
            _deletedBlocks: {},
            _hasContent: page.content !== null && page.content !== undefined,
            _contentFetchedAt: Date.now(),
            _lastSyncedContent: getPageSyncContent(page),
          };
          await saveLocalPage(offlinePage);
        } else if (local._syncStatus === 'pending') {
          // Local has changes - do block-level merge
          const serverHLC: HLCTimestamp = { 
            ts: new Date(page.updated || Date.now()).getTime(), 
            counter: 0, 
            node: 'server' 
          };
          const serverBlockIds = extractBlockIds(page.content);
          const serverBlockHLCs: Record<string, HLCTimestamp> = {};
          for (const blockId of serverBlockIds) {
            serverBlockHLCs[blockId] = serverHLC;
          }
          
          const remoteWithCRDT: OfflinePage = {
            ...page,
            workspace: workspaceId,
            _syncStatus: 'synced',
            _hlc: serverHLC,
            _fieldHLCs: createFieldHLCs(page as unknown as Record<string, unknown>, PAGE_CRDT_FIELDS, serverHLC),
            _blockHLCs: serverBlockHLCs,
            _deletedBlocks: {},
            _hasContent: page.content !== null && page.content !== undefined,
            _contentFetchedAt: Date.now(),
          };
          
          // Merge scalar fields
          const { merged: scalarMerged, hadLocalChanges: hadScalarChanges } = mergeRecords<OfflinePage>(
            local, remoteWithCRDT, PAGE_CRDT_FIELDS
          );
          
          // Merge content at block level
          const { mergedContent, mergedBlockHLCs, mergedDeletedBlocks, hadLocalChanges: hadBlockChanges } = 
            mergeYooptaContent(local.content, page.content, local._blockHLCs, serverBlockHLCs, local._deletedBlocks, {});
          
          // Excerpt is derived from content; compute from merged content when possible
          const computedExcerpt = computeExcerptForSync(mergedContent, (scalarMerged as any).excerpt, true);

          const merged: OfflinePage = {
            ...scalarMerged,
            excerpt: computedExcerpt,
            content: mergedContent,
            _blockHLCs: mergedBlockHLCs,
            _deletedBlocks: mergedDeletedBlocks,
            _syncStatus: hadScalarChanges || hadBlockChanges ? 'pending' : 'synced',
            _hasContent: mergedContent !== null && mergedContent !== undefined,
            _contentFetchedAt: Date.now(),
            _lastSyncedContent: hadScalarChanges || hadBlockChanges ? local._lastSyncedContent : mergedContent,
          };
          await saveLocalPage(merged);
        } else {
          // Local is synced - update to server version
          const blockIds = extractBlockIds(page.content);
          const blockHLCs: Record<string, HLCTimestamp> = {};
          for (const blockId of blockIds) {
            blockHLCs[blockId] = hlc;
          }
          const offlinePage: OfflinePage = {
            ...page,
            workspace: workspaceId,
            _syncStatus: 'synced',
            _hlc: hlc,
            _fieldHLCs: createFieldHLCs(page as unknown as Record<string, unknown>, PAGE_CRDT_FIELDS, hlc),
            _blockHLCs: blockHLCs,
            _deletedBlocks: {},
            _hasContent: page.content !== null && page.content !== undefined,
            _contentFetchedAt: Date.now(),
            _lastSyncedContent: getPageSyncContent(page),
          };
          await saveLocalPage(offlinePage);
        }
        break;
      }
    }
  }

  // Update sync metadata
  await updateSyncMeta(collection, workspaceId);
}

/**
 * Merge server pages as METADATA ONLY (no content).
 * Used during initial load - content is fetched separately based on retention settings.
 */
export async function mergeServerPagesMetadata(
  serverPages: Page[],
  workspaceId: string
): Promise<void> {
  const hlc = tick();

  for (const page of serverPages) {
    const local = await getLocalPage(page.id);
    
    // Skip pages that are locally deleted (pending delete sync)
    // This prevents race conditions where server data arrives before delete is synced
    if (local?._syncStatus === 'deleted') {
      continue;
    }
    
    if (!local) {
      // New from server - create with metadata only
      // Use server excerpt if provided, otherwise null
      const offlinePage: OfflinePage = {
        ...page,
        content: null, // No content - metadata only
        excerpt: page.excerpt ?? null,
        workspace: workspaceId,
        _syncStatus: 'synced',
        _hlc: hlc,
        _fieldHLCs: createFieldHLCs(page as unknown as Record<string, unknown>, PAGE_CRDT_FIELDS, hlc),
        _blockHLCs: {},
        _deletedBlocks: {},
        _hasContent: false,
        _contentFetchedAt: undefined,
      };
      await saveLocalPage(offlinePage);
    } else if (local._syncStatus === 'pending') {
      // Local has pending changes - merge metadata but keep local content
      const serverHLC: HLCTimestamp = { 
        ts: new Date(page.updated || Date.now()).getTime(), 
        counter: 0, 
        node: 'server' 
      };
      const remoteWithCRDT: OfflinePage = {
        ...page,
        content: local.content, // Keep local content
        workspace: workspaceId,
        _syncStatus: 'synced',
        _hlc: serverHLC,
        _fieldHLCs: createFieldHLCs(page as unknown as Record<string, unknown>, PAGE_CRDT_FIELDS, serverHLC),
        _blockHLCs: local._blockHLCs, // Keep local block HLCs
        _deletedBlocks: local._deletedBlocks,
        _hasContent: local._hasContent,
        _contentFetchedAt: local._contentFetchedAt,
      };
      
      // Merge scalar fields only (title, excerpt, icon, etc.)
      // PAGE_CRDT_FIELDS already excludes 'content'
      const { merged: scalarMerged, hadLocalChanges } = mergeRecords<OfflinePage>(
        local, remoteWithCRDT, PAGE_CRDT_FIELDS
      );
      // Excerpt is derived from content; compute from local content when available
      const computedExcerptForLocal = computeExcerptForSync(local.content, local.excerpt, local._hasContent);

      const merged: OfflinePage = {
        ...scalarMerged,
        excerpt: computedExcerptForLocal,
        content: local.content, // Always keep local content
        _blockHLCs: local._blockHLCs,
        _deletedBlocks: local._deletedBlocks,
        _hasContent: local._hasContent,
        _contentFetchedAt: local._contentFetchedAt,
        _lastSyncedContent: local._lastSyncedContent, // Preserve for block diffing
        _syncStatus: hadLocalChanges ? 'pending' : 'synced',
      };
      await saveLocalPage(merged);
    } else {
      // Local is synced - update metadata, preserve content if we have it
      // Excerpt should be derived from content when available. If we already have content locally, compute excerpt from it; otherwise use server-provided excerpt.
      const computedExcerptWhenSynced = computeExcerptForSync(
        local.content, page.excerpt, local._hasContent
      );

      const offlinePage: OfflinePage = {
        ...page,
        content: local._hasContent ? local.content : null,
        excerpt: computedExcerptWhenSynced,
        workspace: workspaceId,
        _syncStatus: 'synced',
        _hlc: hlc,
        _fieldHLCs: createFieldHLCs(page as unknown as Record<string, unknown>, PAGE_CRDT_FIELDS, hlc),
        _blockHLCs: local._hasContent ? local._blockHLCs : {},
        _deletedBlocks: local._hasContent ? local._deletedBlocks : {},
        _hasContent: local._hasContent,
        _contentFetchedAt: local._contentFetchedAt,
        _lastSyncedContent: local._lastSyncedContent, // Preserve for block diffing
      };
      await saveLocalPage(offlinePage);
    }
  }

  // Update sync metadata
  await updateSyncMeta('pages', workspaceId);
}

// Backward compatibility alias
export const mergeServerNotesMetadata = mergeServerPagesMetadata;

/**
 * Update a page with full content (from fetchRecentPagesWithContent).
 */
export async function updatePageWithContent(page: Page): Promise<void> {
  if (!page?.id) {
    devLog(`[SyncEngine] updatePageWithContent: Invalid page - missing id`, page);
    return;
  }
  
  const hlc = tick();
  const local = await getLocalPage(page.id);
  
  if (!local) {
    // Page doesn't exist locally - should have been created by metadata sync
    devLog(`[SyncEngine] updatePageWithContent: Page ${page.id} not found locally`);
    return;
  }
  
  if (local._syncStatus === 'pending') {
    // Local has pending changes - merge content with CRDT
    const serverHLC: HLCTimestamp = { 
      ts: new Date(page.updated || Date.now()).getTime(), 
      counter: 0, 
      node: 'server' 
    };
    const serverBlockIds = extractBlockIds(page.content);
    const serverBlockHLCs: Record<string, HLCTimestamp> = {};
    for (const blockId of serverBlockIds) {
      serverBlockHLCs[blockId] = serverHLC;
    }
    
    // Merge content at block level
    const { mergedContent, mergedBlockHLCs, mergedDeletedBlocks, hadLocalChanges } = 
      mergeYooptaContent(local.content, page.content, local._blockHLCs, serverBlockHLCs, local._deletedBlocks, {});
    
    // Compute excerpt from merged content
    const mergedExcerpt = computeExcerptForSync(mergedContent, page.excerpt, true);
    
    const merged: OfflinePage = {
      ...local,
      content: mergedContent,
      excerpt: mergedExcerpt,
      _blockHLCs: mergedBlockHLCs,
      _deletedBlocks: mergedDeletedBlocks,
      _hasContent: true,
      _contentFetchedAt: Date.now(),
      _lastSyncedContent: mergedContent, // Track what we synced for diffing
      _syncStatus: hadLocalChanges ? 'pending' : 'synced',
    };
    await saveLocalPage(merged);
  } else {
    // Local is synced - update with server content
    const blockIds = extractBlockIds(page.content);
    const blockHLCs: Record<string, HLCTimestamp> = {};
    for (const blockId of blockIds) {
      blockHLCs[blockId] = hlc;
    }
    
    // Compute excerpt from server content
    const syncedExcerpt = computeExcerptForSync(page.content, page.excerpt, true);
    
    const offlinePage: OfflinePage = {
      ...local,
      content: page.content,
      excerpt: syncedExcerpt,
      _hlc: hlc,
      _blockHLCs: blockHLCs,
      _deletedBlocks: {},
      _hasContent: true,
      _contentFetchedAt: Date.now(),
      _lastSyncedContent: getPageSyncContent(page),
    };
    await saveLocalPage(offlinePage);
  }
}

// Backward compatibility alias
export const updateNoteWithContent = updatePageWithContent;

/**
 * Reconcile local tasks with server tasks.
 * 
 * This function does two things:
 * 1. Purges local tasks that no longer exist on the server (deleted on another device)
 * 2. Syncs completion status for tasks that weren't included in the main fetch
 *    (e.g., tasks completed on another device with past due dates)
 * 
 * The second point is important because fetchTasks() excludes completed tasks with
 * past due dates to reduce bandwidth. But if a task was completed on another device,
 * we need to update the local copy's completion status.
 */
async function reconcileTasks(workspaceId: string): Promise<void> {
  try {
    devLog('[SyncEngine] Reconciling tasks...');
    
    // Fetch all task IDs AND completion status from server
    const serverCompletionStatus = await tasksApi.fetchAllTaskCompletionStatus();
    const serverStatusMap = new Map(serverCompletionStatus.map(t => [t.id, t]));
    const serverIds = new Set(serverCompletionStatus.map(t => t.id));
    
    const localTasks = await getLocalTasks(workspaceId);
    let purgeCount = 0;
    let completionSyncCount = 0;

    for (const local of localTasks) {
      // Skip if pending local changes - we don't want to overwrite something the user just changed
      if (local._syncStatus === 'pending') continue;
      
      if (!serverIds.has(local.id)) {
        // Task was deleted on server - purge local copy
        await offlineDb.tasks.delete(local.id);
        purgeCount++;
      } else {
        // Task exists on server - check if completion status differs
        const serverStatus = serverStatusMap.get(local.id);
        if (serverStatus && serverStatus.completed !== local.completed) {
          // Completion status differs - update local task
          devLog(`[SyncEngine] Syncing completion status for task ${local.id}: ${local.completed} -> ${serverStatus.completed}`);
          await offlineDb.tasks.update(local.id, {
            completed: serverStatus.completed,
            completedAt: serverStatus.completedAt ?? undefined,
          });
          completionSyncCount++;
        }
      }
    }
    
    if (purgeCount > 0) {
      devLog(`[SyncEngine] Purged ${purgeCount} deleted tasks from local cache`);
    }
    if (completionSyncCount > 0) {
      devLog(`[SyncEngine] Synced completion status for ${completionSyncCount} tasks`);
    }
  } catch (error) {
    devWarn('[SyncEngine] Task reconciliation failed:', error);
    // Don't throw - reconciliation is a background cleanup task
  }
}

/**
 * Reconcile local pages with server pages by comparing IDs.
 * Purges local pages that no longer exist on the server.
 */
async function reconcilePages(workspaceId: string): Promise<void> {
  try {
    devLog('[SyncEngine] Reconciling pages...');
    const serverIds = new Set(await pagesApi.fetchAllPageIds());
    const localPages = await getLocalPages(workspaceId);
    let purgeCount = 0;

    for (const local of localPages) {
      // Skip if pending local changes
      if (local._syncStatus === 'pending') continue;
      
      if (!serverIds.has(local.id)) {
        await offlineDb.pages.delete(local.id);
        purgeCount++;
      }
    }
    
    if (purgeCount > 0) {
      devLog(`[SyncEngine] Purged ${purgeCount} deleted pages from local cache`);
    }
  } catch (error) {
    devWarn('[SyncEngine] Page reconciliation failed:', error);
    // Don't throw
  }
}
