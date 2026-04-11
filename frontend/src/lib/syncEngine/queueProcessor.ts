/**
 * @file syncEngine/queueProcessor.ts
 * @description Sync queue processing logic
 * 
 * NOTE: Uses Unified Pages architecture - 'pages' collection replaces 'pages' and 'projects'
 */

import {
  offlineDb,
  type SyncOperation,
  type SyncCollection,
  getPendingOperations,
  dequeueOperation,
  markOperationFailed,
  getPendingCount,
  updateSyncMeta,
  getPendingImageUploads,
} from '../offlineDb';
import type { Task } from '@/types/task';
import type { Page } from '@/types/page';
import { CONNECTION, devLog } from '../config';
import { SyncEventEmitter } from './events';
import { syncTask, syncPage } from './syncOperations';
import { processImageUpload, replaceBlobUrlsInContent } from './imageUpload';
import { isNetworkError } from './utils';

/**
 * Process all pending operations in the queue for a specific workspace.
 */
export async function processQueue(
  workspaceId: string,
  isOnline: boolean,
  isProcessingRef: { current: boolean },
  eventEmitter: SyncEventEmitter,
  syncingRecords: Set<string>,
  scheduleSync: (delayMs?: number) => void
): Promise<void> {
  if (!workspaceId) {
    devLog('[SyncEngine] No workspace set, skipping sync');
    return;
  }

  if (isProcessingRef.current || !isOnline) return;

  isProcessingRef.current = true;
  eventEmitter.emit({ type: 'sync-start' });

  try {
    // Get pending operations for the target workspace only
    const operations = await getPendingOperations(workspaceId);

    for (const op of operations) {
      try {
        await executeOperation(op, syncingRecords, scheduleSync);
        await dequeueOperation(op.id);
        
        // If this was a delete operation, permanently remove from IndexedDB
        if (op.operation === 'delete') {
          await offlineDb[op.collection].delete(op.recordId);
          devLog(`[SyncEngine] Purged deleted ${op.collection} ${op.recordId} from IndexedDB`);
        }

        // Add a small delay between operations to avoid hitting rate limits
        // 100ms = max 10 req/sec, which is much safer than "as fast as possible"
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        // Log detailed error information for debugging
        const pbError = error as { status?: number; data?: Record<string, unknown>; message?: string };
        devLog('[SyncEngine] Operation failed:', {
          opId: op.id,
          collection: op.collection,
          operation: op.operation,
          recordId: op.recordId,
          status: pbError.status,
          message: pbError.message,
          validationErrors: pbError.data,
        });
        
        // If it's a network error or rate limit, stop processing the queue for now
        // This prevents multiple rapid retry increments when the connection is flaky
        if (isNetworkError(error)) {
          const isRateLimit = String(error).includes('429') || (typeof error === 'object' && (error as any).status === 429);
          devLog(`[SyncEngine] ${isRateLimit ? 'Rate limit' : 'Network error'} detected, pausing queue processing`);
          
          await markOperationFailed(op.id, String(error));
          
          // Remove from syncing set
          syncingRecords.delete(op.recordId);
          
          eventEmitter.emit({
            type: 'sync-error',
            data: { 
              operation: op.operation, 
              message: isRateLimit ? 'Rate limit exceeded - retrying shortly' : 'Network error - will retry when connection stabilizes', 
              recordId: op.recordId 
            },
          });
          
          // Schedule a retry with backoff
          scheduleSync(isRateLimit ? 10000 : 5000);
          
          // Stop processing the rest of the queue
          break;
        }

        await markOperationFailed(op.id, String(error));
        // Remove from syncing set on error
        syncingRecords.delete(op.recordId);
        eventEmitter.emit({
          type: 'sync-error',
          data: { operation: op.operation, message: String(error), recordId: op.recordId },
        });
      }
    }

    // Update pending count for the target workspace
    const pendingCount = await getPendingCount(workspaceId);
    eventEmitter.emit({ type: 'sync-complete', data: { pendingCount } });
    
    // Process pending image uploads
    await processImageUploadQueue(workspaceId, eventEmitter);
  } catch (error) {
    devLog('[SyncEngine] Queue processing failed:', error);
    eventEmitter.emit({ type: 'sync-error', data: { message: String(error) } });
  } finally {
    isProcessingRef.current = false;
  }
}

/**
 * Execute a single sync operation.
 * Tracks the record as "syncing" so SSE updates for it are ignored.
 */
async function executeOperation(
  op: SyncOperation,
  syncingRecords: Set<string>,
  scheduleSync: (delayMs?: number) => void
): Promise<void> {
  const { collection, operation, recordId, data, changedFields } = op;
  
  // Mark record as syncing so SSE updates are ignored
  syncingRecords.add(recordId);

  try {
    switch (collection) {
      case 'tasks':
        await syncTask(operation, recordId, data as Task | undefined);
        break;
      case 'pages':
        await syncPage(operation, recordId, data as Page | undefined, changedFields, scheduleSync);
        break;
    }
  } finally {
    // Clear syncing flag after a short delay to ensure SSE has time to be ignored
    // SSE events can arrive very quickly after our push completes
    setTimeout(() => {
      syncingRecords.delete(recordId);
    }, CONNECTION.SYNC_SSE_IGNORE_DELAY_MS);
  }

  // Update sync metadata
  await updateSyncMeta(collection, op.workspaceId);

  // Mark local record as synced
  await markSynced(collection, recordId);
}

/**
 * Mark a local record as synced.
 */
async function markSynced(collection: SyncCollection, id: string): Promise<void> {
  const table = offlineDb[collection];
  const record = await table.get(id);
  if (record && record._syncStatus === 'pending') {
    await table.update(id, { _syncStatus: 'synced' });
  }
}

/**
 * Process pending image uploads and update page content with real URLs.
 */
async function processImageUploadQueue(
  workspaceId: string,
  eventEmitter: SyncEventEmitter
): Promise<void> {
  const uploads = await getPendingImageUploads(workspaceId);
  if (uploads.length === 0) return;

  devLog(`[SyncEngine] Processing ${uploads.length} pending image uploads`);

  // Group uploads by page ID to batch content updates
  const uploadsByPage = new Map<string, typeof uploads>();
  for (const upload of uploads) {
    const existing = uploadsByPage.get(upload.pageId) || [];
    existing.push(upload);
    uploadsByPage.set(upload.pageId, existing);
  }

  // Process each page's uploads
  for (const [pageId, pageUploads] of uploadsByPage) {
    const urlMap = new Map<string, string>();

    // Upload each image
    for (const upload of pageUploads) {
      try {
        const result = await processImageUpload(upload);
        if (result) {
          urlMap.set(upload.blobUrl, result.src);
          devLog(`[SyncEngine] Uploaded image ${upload.filename} → ${result.src}`);
        }
      } catch (error) {
        devLog(`[SyncEngine] Failed to upload image ${upload.id}:`, error);
        eventEmitter.emit({
          type: 'sync-error',
          data: { message: `Image upload failed: ${error}`, recordId: pageId },
        });
      }
    }

    // Update page content to replace blob URLs with real URLs
    if (urlMap.size > 0) {
      const page = await offlineDb.pages.get(pageId);
      if (page && page.content) {
        const updatedContent = replaceBlobUrlsInContent(page.content, urlMap);
        if (updatedContent !== page.content) {
          await offlineDb.pages.update(pageId, {
            content: updatedContent,
            _syncStatus: 'pending', // Mark as pending to sync updated content
          });
          devLog(`[SyncEngine] Updated page ${pageId} content with ${urlMap.size} real URLs`);
        }
      }
    }
  }
}
