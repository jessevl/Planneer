/**
 * @file syncEngine/syncOperations.ts
 * @description Individual sync operations for tasks and pages
 * 
 * NOTE: Uses Unified Pages architecture - 'pages' collection replaces 'pages' and 'projects'
 */

import {
  type HLCTimestamp,
  createFieldHLCs,
  mergeRecords,
  mergeYooptaContent,
  PAGE_CRDT_FIELDS,
} from '../crdt';
import { extractExcerpt, computeExcerptForSync } from '@/lib/pageUtils';
import { devLog } from '@/lib/config';
import {
  offlineDb,
  type OfflinePage,
  type SyncCollection,
  saveLocalPage,
  getLocalTask,
  getLocalPage,
  queueOperation,
} from '../offlineDb';
import * as tasksApi from '@/api/tasksApi';
import * as pagesApi from '@/api/pagesApi';
import type { Task } from '@/types/task';
import type { Page } from '@/types/page';
import { is404Error, isNotUniqueError, extractBlockIds, extractChangedBlocks, NOTE_METADATA_FIELDS, getPageSyncContent, applyTableRowToContent, applyTableMetaToContent, deleteTableRowFromContent, parseGranularKey } from './utils';

// ============================================================================
// SYNC WITH FALLBACK
// ============================================================================

/**
 * Sync a record with proper fallback handling.
 * Handles race conditions where:
 * - Update fails with 404 → try create
 * - Create fails with "duplicate" → record exists, consider it synced
 * Also handles nested fallback failures.
 */
export async function syncWithFallback(
  id: string,
  operation: 'create' | 'update',
  createFn: () => Promise<unknown>,
  updateFn: () => Promise<unknown>,
  entityName: string,
  collection: SyncCollection
): Promise<void> {
  const tryCreate = async () => {
    try {
      await createFn();
    } catch (createErr) {
      if (isNotUniqueError(createErr)) {
        // Record already exists on the server - try one update
        devLog(`[SyncEngine] ${entityName} ${id} already exists, updating instead`);
        try {
          await updateFn();
        } catch (updateErr) {
          // If update also fails, check if it's a 404 (impossible state) or other error
          if (is404Error(updateErr)) {
            // Record supposedly exists (duplicate) but can't be found (404)
            // This is stale data - ID exists elsewhere (different workspace/user)
            // Remove from IndexedDB to stop endless retries
            devLog(`[SyncEngine] ${entityName} ${id} is stale (duplicate ID but 404) - removing from local DB`);
            await offlineDb[collection].delete(id);
          } else {
            throw updateErr;
          }
        }
      } else {
        throw createErr;
      }
    }
  };

  const tryUpdate = async () => {
    try {
      await updateFn();
    } catch (updateErr) {
      if (is404Error(updateErr)) {
        // Record doesn't exist - create instead
        devLog(`[SyncEngine] ${entityName} ${id} not found, creating instead`);
        await tryCreate();
      } else if (isNotUniqueError(updateErr)) {
        // Duplicate on update is strange but can happen - just log and continue
        devLog(`[SyncEngine] ${entityName} ${id} duplicate on update, skipping`);
      } else {
        throw updateErr;
      }
    }
  };

  if (operation === 'create') {
    await tryCreate();
  } else {
    await tryUpdate();
  }
}

// ============================================================================
// TASK SYNC
// ============================================================================

export async function syncTask(
  operation: 'create' | 'update' | 'delete',
  id: string,
  _data?: Task
): Promise<void> {
  switch (operation) {
    case 'create':
    case 'update': {
      // Always fetch full record from IndexedDB to ensure we have all required fields
      const localTask = await getLocalTask(id);
      if (!localTask) {
        devLog(`[SyncEngine] Task ${id} not found in IndexedDB, skipping sync`);
        return;
      }
      // Strip CRDT metadata before sending to API
      const { _syncStatus, _hlc, _fieldHLCs, _serverVersion, ...taskData } = localTask;
      
      await syncWithFallback(
        id,
        operation,
        () => tasksApi.createTask(taskData),
        () => tasksApi.updateTask(id, taskData),
        'Task',
        'tasks'
      );
      break;
    }
    case 'delete':
      try {
        await tasksApi.deleteTask(id);
      } catch (err: unknown) {
        // 404 on delete is fine - record already gone from server
        if (is404Error(err)) {
          devLog(`[SyncEngine] Task ${id} already deleted on server, treating as success`);
        } else {
          throw err;
        }
      }
      break;
  }
}

// ============================================================================
// PAGE SYNC
// ============================================================================

export async function syncPage(
  operation: 'create' | 'update' | 'delete',
  id: string,
  _data?: Page,
  changedFields?: string[],
  scheduleSync?: (delayMs?: number) => void
): Promise<void> {
  switch (operation) {
    case 'create':
    case 'update': {
      // Always fetch full record from IndexedDB to ensure we have all required fields
      const localPage = await getLocalPage(id);
      if (!localPage) {
        devLog(`[SyncEngine] Page ${id} not found in IndexedDB, skipping sync`);
        return;
      }
      
      // For updates, do block-level merge with server state before pushing
      if (operation === 'update') {
        await syncPageWithBlockMerge(id, localPage, changedFields, scheduleSync);
        return;
      }
      
      // For creates, just send the data
      const { _syncStatus, _hlc, _fieldHLCs, _blockHLCs, _deletedBlocks, _serverVersion, _hasContent, _contentFetchedAt, _lastSyncedContent, ...pageData } = localPage;
      
      await syncWithFallback(
        id,
        operation,
        () => pagesApi.createPage(pageData),
        () => pagesApi.updatePage(id, pageData),
        'Page',
        'pages'
      );
      break;
    }
    case 'delete':
      try {
        await pagesApi.deletePage(id);
      } catch (err: unknown) {
        // 404 on delete is fine - record already gone from server
        if (is404Error(err)) {
          devLog(`[SyncEngine] Page ${id} already deleted on server, treating as success`);
        } else {
          throw err;
        }
      }
      break;
  }
}

// Backward compatibility alias
export const syncNote = syncPage;

/**
 * Sync a page update with block-level merge.
 * 
 * Optimization (Option 1): First check if remote changed by fetching only 'updated'.
 * If unchanged, skip the full content fetch and just push our changes.
 * This saves ~100KB download when editing a page solo.
 * 
 * This ensures concurrent edits to different blocks are preserved when merging.
 */
async function syncPageWithBlockMerge(
  id: string, 
  localPage: OfflinePage,
  changedFields?: string[],
  scheduleSync?: (delayMs?: number) => void
): Promise<void> {
  try {
    // OPTIMIZATION: Check if remote changed before fetching full content
    // This saves bandwidth when we're the only one editing
    const remoteMetadata = await pagesApi.fetchPageMetadata(id);
    
    if (!remoteMetadata) {
      // Page doesn't exist on server - create it instead
      devLog(`[SyncEngine] Page ${id} not on server, creating`);
      const { _syncStatus, _hlc, _fieldHLCs, _blockHLCs, _deletedBlocks, _serverVersion, _hasContent, _contentFetchedAt, _lastSyncedContent, ...pageData } = localPage;
      await pagesApi.createPage(pageData);
      return;
    }
    
    // Compare server's updated timestamp with what we last synced from
    const localLastSyncedAt = localPage._contentFetchedAt || 0;
    const remoteUpdatedAt = new Date(remoteMetadata.updated).getTime();
    
    // If remote hasn't changed since we last fetched, skip the merge and just push
    if (remoteUpdatedAt <= localLastSyncedAt) {
      devLog(`[SyncEngine] Page ${id} - no remote changes, pushing directly`);
      await pushPageChangesDirectly(id, localPage, changedFields, scheduleSync);
      return;
    }
    
    devLog(`[SyncEngine] Page ${id} - remote changed, fetching for merge`);
    
    // Remote has changes - fetch full content for merge
    const serverPage = await pagesApi.fetchPage(id);
    
    if (!serverPage) {
      // Race condition: page was deleted between metadata check and fetch
      devLog(`[SyncEngine] Page ${id} deleted on server, recreating`);
      const { _syncStatus, _hlc, _fieldHLCs, _blockHLCs, _deletedBlocks, _serverVersion, _hasContent, _contentFetchedAt, _lastSyncedContent, ...pageData } = localPage;
      await pagesApi.createPage(pageData);
      return;
    }
    
    await mergeAndPushPageChanges(id, localPage, serverPage);
    
  } catch (err) {
    if (is404Error(err)) {
      // Page was deleted on server, create it
      devLog(`[SyncEngine] Page ${id} not found on server (404), creating`);
      const { _syncStatus, _hlc, _fieldHLCs, _blockHLCs, _deletedBlocks, _serverVersion, _hasContent, _contentFetchedAt, _lastSyncedContent, ...pageData } = localPage;
      await pagesApi.createPage(pageData);
    } else {
      throw err;
    }
  }
}

/**
 * Push page changes directly without merging (when remote hasn't changed).
 */
async function pushPageChangesDirectly(
  id: string,
  localPage: OfflinePage,
  changedFields?: string[],
  scheduleSync?: (delayMs?: number) => void
): Promise<void> {
  // OPTIMIZATION: Use patch API to send only changed blocks since last sync
  const lastSyncedContent = localPage._lastSyncedContent || null;
  
  const currentContent = localPage.content;
  
  const changedBlocks = extractChangedBlocks(lastSyncedContent, currentContent);
  
  const hasBlockChanges = 
    Object.keys(changedBlocks.blocks).length > 0 || 
    changedBlocks.deleted.length > 0 ||
    (changedBlocks.tableRowChanges && Object.keys(changedBlocks.tableRowChanges).length > 0) ||
    (changedBlocks.tableMetaChanges && Object.keys(changedBlocks.tableMetaChanges).length > 0) ||
    (changedBlocks.deletedTableRows && changedBlocks.deletedTableRows.length > 0);
    
  const hasOrderOnlyChanges = Object.keys(changedBlocks.orderOnlyChanges).length > 0;
  
  // Check if any metadata (non-content) fields changed
  // Include excerpt when content changed — it needs to be synced to the server
  const contentChanged = changedFields?.includes('content');
  const changedMetadataFields = changedFields?.filter(f => {
    if (!NOTE_METADATA_FIELDS.includes(f as typeof NOTE_METADATA_FIELDS[number])) return false;
    return true;
  }) || [];
  // When content changed, also ensure excerpt is included if not already
  if (contentChanged && !changedMetadataFields.includes('excerpt')) {
    changedMetadataFields.push('excerpt');
  }
  const hasMetadataChanges = changedMetadataFields.length > 0;
  
  let serverUpdatedAt: number | undefined;
  
  if (hasBlockChanges || hasOrderOnlyChanges) {
    // Use patch API for block changes
    // If metadata also changed, include it in the patch to avoid split requests
    const patchRequest: Parameters<typeof pagesApi.patchPage>[1] = {
      blocks: {
        ...changedBlocks.blocks,
        ...(changedBlocks.tableRowChanges || {}),
        ...(changedBlocks.tableMetaChanges || {}),
      },
      deleted: [
        ...changedBlocks.deleted,
        ...(changedBlocks.deletedTableRows || []),
      ],
      blockOrders: hasOrderOnlyChanges ? changedBlocks.orderOnlyChanges : undefined,
    };
    
    // Include metadata changes in the same PATCH request
    if (hasMetadataChanges) {
      const metadata: Record<string, unknown> = {};
      for (const field of changedMetadataFields) {
        metadata[field] = localPage[field as keyof OfflinePage];
      }
      patchRequest.metadata = metadata;
    }
    
    const totalBlocks = Object.keys(patchRequest.blocks || {}).length;
    const totalDeleted = (patchRequest.deleted || []).length;
    
    devLog(`[SyncEngine] Page ${id} - patching ${totalBlocks} blocks/rows, ${totalDeleted} deleted, ${Object.keys(changedBlocks.orderOnlyChanges).length} order-only${hasMetadataChanges ? ', metadata: ' + changedMetadataFields.join(', ') : ''}`);
    const patchResponse = await pagesApi.patchPage(id, patchRequest);
    serverUpdatedAt = patchResponse?.updated 
      ? new Date(patchResponse.updated).getTime() + 1
      : Date.now();
    
    // IMPORTANT: Only update _lastSyncedContent for the blocks we actually synced,
    // NOT the entire current content. User may have made more edits during the request.
    
    // Parse last synced content
    let baseContent: any = {};
    
    if (lastSyncedContent) {
      try {
        baseContent = { ...JSON.parse(lastSyncedContent) };
      } catch {
        baseContent = {};
      }
    }
    
    // Apply the blocks we just synced
    for (const [blockId, blockData] of Object.entries(changedBlocks.blocks)) {
      baseContent[blockId] = blockData;
    }
    
    // Apply table row-level changes using helpers
    if (changedBlocks.tableRowChanges) {
      for (const [rowKey, rowData] of Object.entries(changedBlocks.tableRowChanges)) {
        const parsed = parseGranularKey(rowKey);
        if (parsed?.type === 'row' && parsed.rowId) {
          applyTableRowToContent(baseContent, parsed.tableId, parsed.rowId, rowData, currentContent);
        }
      }
    }
    
    // Apply table metadata changes
    if (changedBlocks.tableMetaChanges) {
      for (const [metaKey, metaData] of Object.entries(changedBlocks.tableMetaChanges)) {
        const parsed = parseGranularKey(metaKey);
        if (parsed?.type === 'meta') {
          applyTableMetaToContent(baseContent, parsed.tableId, metaData, currentContent);
        }
      }
    }
    
    // Apply deleted table rows
    if (changedBlocks.deletedTableRows) {
      for (const rowKey of changedBlocks.deletedTableRows) {
        const parsed = parseGranularKey(rowKey);
        if (parsed?.type === 'row' && parsed.rowId) {
          deleteTableRowFromContent(baseContent, parsed.tableId, parsed.rowId);
        }
      }
    }
    
    // Apply order-only changes
    for (const [blockId, newOrder] of Object.entries(changedBlocks.orderOnlyChanges)) {
      const block = baseContent[blockId] as { meta?: { order?: number } } | undefined;
      if (block) {
        if (!block.meta) block.meta = {};
        block.meta.order = newOrder;
      }
    }
    // Remove deleted blocks
    for (const blockId of changedBlocks.deleted) {
      delete baseContent[blockId];
    }
    
    // Re-fetch local page in case it changed during the request
    const currentLocalPage = await getLocalPage(id);
    if (currentLocalPage) {
      // Check if content changed during the request
      const currentLocalContent = currentLocalPage.content;
      const contentChangedDuringSync = currentLocalContent !== currentContent;
      await saveLocalPage({
        ...currentLocalPage,
        _syncStatus: contentChangedDuringSync ? 'pending' : 'synced',
        _contentFetchedAt: serverUpdatedAt,
        _lastSyncedContent: JSON.stringify(baseContent),
      });
      
      // If content changed during sync, queue a new operation and schedule sync
      if (contentChangedDuringSync && scheduleSync) {
        devLog(`[SyncEngine] Page ${id} - content changed during sync, queueing resync`);
        await queueOperation({
          collection: 'pages',
          operation: 'update',
          recordId: id,
          workspaceId: currentLocalPage.workspace,
          data: currentLocalPage as unknown as Record<string, unknown>,
          changedFields: ['content'],
          hlc: currentLocalPage._hlc,
          createdAt: Date.now(),
          attempts: 0,
        });
        scheduleSync();
      }
    }
    return;
  } else if (hasMetadataChanges) {
    // Only metadata changed (no block changes) - use regular update
    devLog(`[SyncEngine] Page ${id} - metadata only: ${changedMetadataFields.join(', ')}`);
    
    // Build update with only the changed fields
    const metadataUpdates: Record<string, unknown> = {};
    for (const field of changedMetadataFields) {
      metadataUpdates[field] = localPage[field as keyof OfflinePage];
    }
    
    // Debug: log what we're sending for savedViews
    if (changedMetadataFields.includes('savedViews')) {
      devLog(`[SyncEngine] Page ${id} - savedViews value being sent:`, JSON.stringify(metadataUpdates['savedViews']));
      devLog(`[SyncEngine] Page ${id} - localPage.savedViews:`, JSON.stringify((localPage as any).savedViews));
    }
    
    await pagesApi.updatePage(id, metadataUpdates);
    
    await saveLocalPage({
      ...localPage,
      _syncStatus: 'synced',
    });
    return;
  } else {
    // No changes to sync
    devLog(`[SyncEngine] Page ${id} - no changes to sync`);
    await saveLocalPage({
      ...localPage,
      _syncStatus: 'synced',
    });
    return;
  }
}

/**
 * Merge local and remote page changes, then push the result.
 */
async function mergeAndPushPageChanges(
  id: string,
  localPage: OfflinePage,
  serverPage: Page
): Promise<void> {
  // Use server's updated timestamp directly (don't call receive() which advances our clock)
  // This ensures local edits made AFTER fetching the page will have higher HLCs
  const serverTimestamp = new Date(serverPage.updated).getTime();
  const serverHLC: HLCTimestamp = { ts: serverTimestamp, counter: 0, node: 'server' };
  
  // Build server block HLCs - all blocks get the server's last update time
  const serverBlockIds = extractBlockIds(serverPage.content);
  const serverBlockHLCs: Record<string, HLCTimestamp> = {};
  for (const blockId of serverBlockIds) {
    serverBlockHLCs[blockId] = serverHLC;
  }
  
  // Merge scalar fields (title, parentId, etc.)
  const serverWithCRDT: OfflinePage = {
    ...serverPage,
    workspace: serverPage.workspace || '',
    _syncStatus: 'synced',
    _hlc: serverHLC,
    _fieldHLCs: createFieldHLCs(serverPage as unknown as Record<string, unknown>, PAGE_CRDT_FIELDS, serverHLC),
    _blockHLCs: serverBlockHLCs,
    _deletedBlocks: {},
    _hasContent: serverPage.content !== null && serverPage.content !== undefined,
    _contentFetchedAt: Date.now(),
  };
  
  const { merged: scalarMerged, hadLocalChanges: hadScalarChanges } = mergeRecords<OfflinePage>(
    localPage,
    serverWithCRDT,
    PAGE_CRDT_FIELDS
  );
  
  // Merge content at block level - this is the key operation
  const {
    mergedContent,
    mergedBlockHLCs,
    mergedDeletedBlocks,
    hadLocalChanges: hadBlockChanges,
  } = mergeYooptaContent(
    localPage.content,
    serverPage.content,
    localPage._blockHLCs,
    serverBlockHLCs,
    localPage._deletedBlocks,
    {}
  );
  
  // Debug: log HLC comparison
  devLog(`[SyncEngine] Page ${id} merge:`, {
    serverTimestamp: serverPage.updated,
    localBlockCount: Object.keys(localPage._blockHLCs).length,
    serverBlockCount: serverBlockIds.length,
    hadScalarChanges,
    hadBlockChanges,
    sampleLocalHLC: Object.values(localPage._blockHLCs)[0],
    sampleServerHLC: serverHLC,
  });
  
  // If no local changes won, server is already correct
  if (!hadScalarChanges && !hadBlockChanges) {
    devLog(`[SyncEngine] Page ${id} - server wins on all fields, no update needed`);
    // Update local to match server
    const synced: OfflinePage = {
      ...serverWithCRDT,
      _syncStatus: 'synced',
      _lastSyncedContent: getPageSyncContent(serverPage),
    };
    await saveLocalPage(synced);
    return;
  }
  
  // Build final merged page
  const { _syncStatus, _hlc, _fieldHLCs, _blockHLCs, _deletedBlocks, _serverVersion, ...cleanScalarMerged } = scalarMerged;
  // Compute excerpt from merged content when possible; fall back to merged scalar if present
  const computedExcerpt = computeExcerptForSync(mergedContent, (cleanScalarMerged as any).excerpt, true);
  const finalData = {
    ...cleanScalarMerged,
    content: mergedContent,
    excerpt: computedExcerpt,
  };
  
  // OPTIMIZATION (Option 2C): Use patch API when possible
  // Extract only the blocks that differ from what server has
  const changedBlocks = extractChangedBlocks(serverPage.content, mergedContent);
  
  const hasBlockChanges = 
    Object.keys(changedBlocks.blocks).length > 0 || 
    changedBlocks.deleted.length > 0 ||
    (changedBlocks.tableRowChanges && Object.keys(changedBlocks.tableRowChanges).length > 0) ||
    (changedBlocks.tableMetaChanges && Object.keys(changedBlocks.tableMetaChanges).length > 0) ||
    (changedBlocks.deletedTableRows && changedBlocks.deletedTableRows.length > 0);

  if (hasBlockChanges) {
    const totalBlocks = Object.keys(changedBlocks.blocks).length + 
                       Object.keys(changedBlocks.tableRowChanges || {}).length + 
                       Object.keys(changedBlocks.tableMetaChanges || {}).length;
    
    devLog(`[SyncEngine] Page ${id} - merge complete, patching ${totalBlocks} blocks/rows`);
    
    // Build metadata that may have changed
    const metadataUpdates: Record<string, unknown> = {};
    if ((finalData as any).title !== serverPage.title) metadataUpdates.title = (finalData as any).title;
    if ((finalData as any).excerpt !== serverPage.excerpt) metadataUpdates.excerpt = (finalData as any).excerpt;
    if ((finalData as any).parentId !== serverPage.parentId) metadataUpdates.parentId = (finalData as any).parentId;
    
    const patchResponse = await pagesApi.patchPage(id, {
      blocks: {
        ...changedBlocks.blocks,
        ...(changedBlocks.tableRowChanges || {}),
        ...(changedBlocks.tableMetaChanges || {}),
      },
      deleted: [
        ...changedBlocks.deleted,
        ...(changedBlocks.deletedTableRows || []),
      ],
      metadata: Object.keys(metadataUpdates).length > 0 ? metadataUpdates : undefined,
    });
    
    // Use server's updated timestamp so we don't think it changed on next sync
    const serverUpdatedAt = patchResponse?.updated 
      ? new Date(patchResponse.updated).getTime() + 1
      : Date.now();
    
    // Update local with merged state and server timestamp
    const merged: OfflinePage = {
      ...localPage,
      ...finalData,
      _syncStatus: 'synced',
      _blockHLCs: mergedBlockHLCs,
      _deletedBlocks: mergedDeletedBlocks,
      _lastSyncedContent: mergedContent,
      _contentFetchedAt: serverUpdatedAt,
    };
    await saveLocalPage(merged);
  } else if (hadScalarChanges) {
    // Only scalar fields changed, use regular update (more efficient for metadata-only)
    devLog(`[SyncEngine] Page ${id} - only metadata changed, using regular update`);
    const { content: _, ...metadataOnly } = finalData;
    await pagesApi.updatePage(id, metadataOnly);
    
    // Update local with merged state
    const merged: OfflinePage = {
      ...localPage,
      ...finalData,
      _syncStatus: 'synced',
      _blockHLCs: mergedBlockHLCs,
      _deletedBlocks: mergedDeletedBlocks,
      _lastSyncedContent: mergedContent,
      _contentFetchedAt: Date.now(),
    };
    await saveLocalPage(merged);
  } else {
    devLog(`[SyncEngine] Page ${id} - no changes to push after merge`);
    
    // Update local with merged state
    const merged: OfflinePage = {
      ...localPage,
      ...finalData,
      _syncStatus: 'synced',
      _blockHLCs: mergedBlockHLCs,
      _deletedBlocks: mergedDeletedBlocks,
      _lastSyncedContent: mergedContent,
    };
    await saveLocalPage(merged);
  }
}
