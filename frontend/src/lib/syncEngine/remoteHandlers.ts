/**
 * @file syncEngine/remoteHandlers.ts
 * @description Handles remote changes from SSE subscriptions
 * 
 * NOTE: Uses Unified Pages architecture - 'pages' collection replaces 'pages' and 'projects'
 */

import {
  type HLCTimestamp,
  receive,
  createFieldHLCs,
  mergeRecords,
  mergeYooptaContent,
  detectChangedBlocks,
  isGranularKey,
  isAdvancedTableBlock,
  TASK_CRDT_FIELDS,
  PAGE_CRDT_FIELDS,
} from '../crdt';
import {
  offlineDb,
  type OfflineTask,
  type OfflinePage,
  saveLocalTask,
  saveLocalPage,
  getLocalTask,
  getLocalPage,
} from '../offlineDb';
import { extractExcerpt, computeExcerptForSync } from '@/lib/pageUtils';
import { devLog } from '@/lib/config';
import type { Task } from '@/types/task';
import type { Page } from '@/types/page';
import {
  extractBlockIds,
  parseContent,
  parseBlocks,
  reconstructContent,
  getPageSyncContent,
  applyRowToTable,
  applyMetaToTable,
  removeRowFromTable,
} from './utils';

// ============================================================================
// REMOTE TASK HANDLER
// ============================================================================

/**
 * Handle a remote task change from SSE.
 */
export async function handleRemoteTaskChange(
  action: 'create' | 'update' | 'delete',
  remoteTask: Task
): Promise<OfflineTask | null> {
  const hlc = receive({ ts: Date.now(), counter: 0, node: 'server' });

  if (action === 'delete') {
    await offlineDb.tasks.delete(remoteTask.id);
    return null;
  }

  const localTask = await getLocalTask(remoteTask.id);

  // If no local version, just save remote
  if (!localTask) {
    const offlineTask: OfflineTask = {
      ...remoteTask,
      workspace: remoteTask.workspace || '',
      _syncStatus: 'synced',
      _hlc: hlc,
      _fieldHLCs: createFieldHLCs(remoteTask as unknown as Record<string, unknown>, TASK_CRDT_FIELDS, hlc),
    };
    await saveLocalTask(offlineTask);
    return offlineTask;
  }

  // If local is pending, merge with CRDT
  if (localTask._syncStatus === 'pending') {
    const remoteWithCRDT: OfflineTask = {
      ...remoteTask,
      workspace: remoteTask.workspace || '',
      _syncStatus: 'synced',
      _hlc: hlc,
      _fieldHLCs: createFieldHLCs(remoteTask as unknown as Record<string, unknown>, TASK_CRDT_FIELDS, hlc),
    };

    const { merged, hadLocalChanges } = mergeRecords<OfflineTask>(
      localTask,
      remoteWithCRDT,
      TASK_CRDT_FIELDS
    );

    merged._syncStatus = hadLocalChanges ? 'pending' : 'synced';
    await saveLocalTask(merged);
    return merged;
  }

  // Local is synced, just update
  const offlineTask: OfflineTask = {
    ...remoteTask,
    workspace: remoteTask.workspace || '',
    _syncStatus: 'synced',
    _hlc: hlc,
    _fieldHLCs: createFieldHLCs(remoteTask as unknown as Record<string, unknown>, TASK_CRDT_FIELDS, hlc),
  };
  await saveLocalTask(offlineTask);
  return offlineTask;
}

// ============================================================================
// REMOTE PAGE HANDLER
// ============================================================================

/**
 * Handle a remote page change from SSE.
 * NOTE: SSE updates may come without content (metadata-only) to save bandwidth.
 * When changedBlocks (with content), deletedBlocks, or blockOrders are provided, 
 * we merge directly without needing to fetch from server.
 * 
 * Echo detection: When SSE blocks match _lastSyncedContent, they're our own echo
 * and are skipped (no conflict logged).
 * 
 * @param action - The type of change (create, update, delete)
 * @param remotePage - The page metadata from SSE (may not include content)
 * @param changedBlocks - Object mapping block IDs to their content (from patch SSE)
 * @param deletedBlocks - Block IDs that were deleted (from patch SSE)
 * @param blockOrders - Block IDs with only order changes (maps to new order value)
 */
export async function handleRemotePageChange(
  action: 'create' | 'update' | 'delete',
  remotePage: Page,
  changedBlocks?: Record<string, unknown>,
  deletedBlocks?: string[],
  blockOrders?: Record<string, number>
): Promise<OfflinePage | null> {
  const hlc = receive({ ts: Date.now(), counter: 0, node: 'server' });

  if (action === 'delete') {
    await offlineDb.pages.delete(remotePage.id);
    return null;
  }

  // Check if this is a metadata-only SSE update (content stripped for bandwidth)
  const hasRemoteContent = remotePage.content !== null && remotePage.content !== undefined;
  
  const localPage = await getLocalPage(remotePage.id);

  // If no local version, save remote (content may be null for metadata-only)
  if (!localPage) {
    const blockIds = hasRemoteContent ? extractBlockIds(remotePage.content) : [];
    const blockHLCs: Record<string, HLCTimestamp> = {};
    for (const blockId of blockIds) {
      blockHLCs[blockId] = hlc;
    }

    const offlinePage: OfflinePage = {
      ...remotePage,
      workspace: remotePage.workspace || '',
      _syncStatus: 'synced',
      _hlc: hlc,
      _fieldHLCs: createFieldHLCs(remotePage as unknown as Record<string, unknown>, PAGE_CRDT_FIELDS, hlc),
      _blockHLCs: blockHLCs,
      _deletedBlocks: {},
      _hasContent: hasRemoteContent,
      _contentFetchedAt: hasRemoteContent ? Date.now() : 0,
      _lastSyncedContent: getPageSyncContent(remotePage),
    };
    await saveLocalPage(offlinePage);
    return offlinePage;
  }

  // OPTIMIZATION: If remote has no content (metadata-only SSE), handle incrementally.
  // When changedBlocks (with content), blockOrders, or deletedBlocks are provided, 
  // merge directly without fetching.
  // Otherwise, just update metadata and preserve local content.
  if (!hasRemoteContent) {
    // If we have block content or order changes, merge directly (no fetch needed)
    const hasBlockData = (changedBlocks && Object.keys(changedBlocks).length > 0) || 
                         (blockOrders && Object.keys(blockOrders).length > 0);
    if (hasBlockData) {
      return handleRemotePageBlockPatch(localPage, remotePage, changedBlocks || {}, deletedBlocks, hlc, blockOrders);
    }
    
    devLog(`[SyncEngine] Page ${remotePage.id} - SSE metadata-only update`);
    
    // Metadata-only update: just merge metadata fields, preserve local content.
    // No need to fetch full content - if there were content changes, they would
    // have been included as changedBlocks in the SSE.
    return handleRemotePageMetadataOnly(localPage, remotePage, hlc);
  }

  // Check if local has unsaved changes (content differs from last synced)
  // This is more reliable than just checking _syncStatus
  const hasUnsavedLocalChanges = localPage.content !== localPage._lastSyncedContent;

  // If local has pending/unsaved changes, merge with CRDT (block-level for content)
  if (localPage._syncStatus === 'pending' || hasUnsavedLocalChanges) {
    return handleRemotePageWithPendingLocal(localPage, remotePage, hlc);
  }

  // Local is synced - apply remote changes, preserving HLCs for unchanged blocks
  return handleRemotePageSyncedLocal(localPage, remotePage, hlc);
}

// Backward compatibility alias
export const handleRemoteNoteChange = handleRemotePageChange;

/**
 * Handle remote page change with block patch data.
 */
async function handleRemotePageBlockPatch(
  localPage: OfflinePage,
  remotePage: Page,
  changedBlocks: Record<string, unknown>,
  deletedBlocks: string[] | undefined,
  hlc: HLCTimestamp,
  blockOrders?: Record<string, number>
): Promise<OfflinePage> {
  const changedBlockIds = Object.keys(changedBlocks);
  devLog(`[SyncEngine] Page ${remotePage.id} - SSE with ${changedBlockIds.length} changed blocks, ${deletedBlocks?.length || 0} deleted, ${Object.keys(blockOrders || {}).length} order-only`);
  
  // Parse content - extract actual blocks/elements map
  const localBlocks = parseBlocks(localPage.content);
  const lastSyncedBlocks = parseBlocks(localPage._lastSyncedContent);
  
  // Detect which blocks have pending local changes (differ from last synced)
  const localPendingBlockIds = new Set<string>();
  for (const blockId of Object.keys(localBlocks)) {
    if (JSON.stringify(localBlocks[blockId]) !== JSON.stringify(lastSyncedBlocks[blockId])) {
      localPendingBlockIds.add(blockId);
    }
  }
  
  // Update block HLCs for changed blocks
  const updatedBlockHLCs = { ...localPage._blockHLCs };

  // Apply remote blocks, but PRESERVE local pending blocks
  // Local pending changes always win - they'll sync on the next cycle
  for (const [blockId, blockData] of Object.entries(changedBlocks)) {
    if (isGranularKey(blockId)) {
      // Handle granular table change
      const parts = blockId.split(':');
      const tableId = parts[0];
      const type = parts[1];
      const rowId = parts[2];
      
      const tableBlock = localBlocks[tableId] as any;
      if (tableBlock && isAdvancedTableBlock(tableBlock)) {
        if (type === 'row') {
          applyRowToTable(tableBlock, rowId, blockData);
        } else if (type === 'meta') {
          applyMetaToTable(tableBlock, blockData);
        }
        updatedBlockHLCs[blockId] = hlc;
      }
      continue; // Don't add granular key as top-level block
    }

    if (localPendingBlockIds.has(blockId)) {
      // Conflict: remote has changes AND we have pending local changes
      // LOCAL WINS - preserve our pending changes, they'll sync next
      devLog(`[SyncEngine] Block ${blockId} conflict - local wins, will re-sync`);
    } else {
      // No conflict, apply remote block
      localBlocks[blockId] = blockData;
      updatedBlockHLCs[blockId] = hlc;
    }
  }
  
  // Apply order-only changes
  if (blockOrders) {
    for (const [blockId, newOrder] of Object.entries(blockOrders)) {
      // Skip if this block has local pending content changes
      if (localPendingBlockIds.has(blockId)) {
        devLog(`[SyncEngine] Block ${blockId} order update skipped - has local pending changes`);
        continue;
      }
      
      const block = localBlocks[blockId] as { meta?: { order?: number; depth?: number } } | undefined;
      if (block) {
        if (!block.meta) block.meta = {};
        block.meta.order = newOrder;
        updatedBlockHLCs[blockId] = hlc;
      }
    }
  }
  
  // Handle deleted blocks - only delete if we don't have local pending changes
  if (deletedBlocks) {
    for (const blockId of deletedBlocks) {
      if (isGranularKey(blockId)) {
        // Handle granular delete
        const parts = blockId.split(':');
        const tableId = parts[0];
        const type = parts[1];
        const rowId = parts[2];
        
        const tableBlock = localBlocks[tableId] as any;
        if (tableBlock && isAdvancedTableBlock(tableBlock) && type === 'row') {
          removeRowFromTable(tableBlock, rowId);
        }
        delete updatedBlockHLCs[blockId];
        continue;
      }

      if (!localPendingBlockIds.has(blockId)) {
        delete localBlocks[blockId];
        delete updatedBlockHLCs[blockId];
      } else {
        devLog(`[SyncEngine] Block ${blockId} delete skipped - has local pending changes`);
      }
    }
  }
  
  // Reconstruct full content
  const mergedContentStructure = reconstructContent(localBlocks);
  const mergedContent = JSON.stringify(mergedContentStructure);
  
  // Determine sync status: 
  // - If we have ANY pending changes (whether or not remote touched them), stay pending
  // - Local wins on conflicts, so those blocks still need to sync
  const hasAnyPendingChanges = localPendingBlockIds.size > 0;
  const newSyncStatus = hasAnyPendingChanges ? 'pending' : 'synced';
  
  // Update _lastSyncedContent to reflect what we know the server has
  // Start from our last known state and apply the remote changes
  const newLastSyncedBlocks = { ...lastSyncedBlocks };
  for (const [blockId, blockData] of Object.entries(changedBlocks)) {
    if (isGranularKey(blockId)) {
      const parts = blockId.split(':');
      const tableId = parts[0];
      const type = parts[1];
      const rowId = parts[2];
      
      const tableBlock = newLastSyncedBlocks[tableId] as any;
      if (tableBlock && isAdvancedTableBlock(tableBlock)) {
        if (type === 'row') {
          applyRowToTable(tableBlock, rowId, blockData);
        } else if (type === 'meta') {
          applyMetaToTable(tableBlock, blockData);
        }
      }
      continue;
    }
    newLastSyncedBlocks[blockId] = blockData;
  }
  // Apply order changes to last synced
  if (blockOrders) {
    for (const [blockId, newOrder] of Object.entries(blockOrders)) {
      const block = newLastSyncedBlocks[blockId] as { meta?: { order?: number } } | undefined;
      if (block) {
        if (!block.meta) block.meta = {};
        block.meta.order = newOrder;
      }
    }
  }
  if (deletedBlocks) {
    for (const blockId of deletedBlocks) {
      if (isGranularKey(blockId)) {
        const parts = blockId.split(':');
        const tableId = parts[0];
        const type = parts[1];
        const rowId = parts[2];
        
        const tableBlock = newLastSyncedBlocks[tableId] as any;
        if (tableBlock && isAdvancedTableBlock(tableBlock) && type === 'row') {
          removeRowFromTable(tableBlock, rowId);
        }
        continue;
      }
      delete newLastSyncedBlocks[blockId];
    }
  }
  
  // Reconstruct last synced content with proper structure
  const newLastSyncedStructure = reconstructContent(newLastSyncedBlocks);
  const newLastSyncedContent = JSON.stringify(newLastSyncedStructure);
  
  // If we already did a full fetch previously, advance _contentFetchedAt to the
  // remote record's `updated` timestamp.  This prevents ensurePageContent() from
  // re-fetching the full page on next navigation — the SSE patches have already
  // brought our local content up to date.
  // If we never did a full fetch (_contentFetchedAt === 0), keep it at 0 so the
  // next selectPage still triggers a full content download.
  const newContentFetchedAt = localPage._contentFetchedAt
    ? new Date(remotePage.updated).getTime() + 1  // +1ms to be strictly > server updated
    : 0;

  const merged: OfflinePage = {
    ...localPage,
    ...remotePage,
    content: mergedContent,
    workspace: remotePage.workspace || localPage.workspace || '',
    _syncStatus: newSyncStatus,
    _hlc: hlc,
    _fieldHLCs: createFieldHLCs(remotePage as unknown as Record<string, unknown>, PAGE_CRDT_FIELDS, hlc),
    _blockHLCs: updatedBlockHLCs,
    _deletedBlocks: localPage._deletedBlocks,
    _hasContent: true,
    _contentFetchedAt: newContentFetchedAt,
    _lastSyncedContent: newLastSyncedContent,
  };
  
  await saveLocalPage(merged);
  return merged;
}

/**
 * Handle remote page change with metadata only (no content).
 */
async function handleRemotePageMetadataOnly(
  localPage: OfflinePage,
  remotePage: Page,
  hlc: HLCTimestamp
): Promise<OfflinePage> {
  // Merge metadata fields only, preserve local content
  const remoteWithCRDT: OfflinePage = {
    ...remotePage,
    // Preserve local content and content-related fields
    content: localPage.content,
    workspace: remotePage.workspace || localPage.workspace || '',
    _syncStatus: localPage._syncStatus,
    _hlc: hlc,
    _fieldHLCs: createFieldHLCs(remotePage as unknown as Record<string, unknown>, PAGE_CRDT_FIELDS, hlc),
    _blockHLCs: localPage._blockHLCs,
    _deletedBlocks: localPage._deletedBlocks,
    _hasContent: localPage._hasContent,
    _contentFetchedAt: localPage._contentFetchedAt,
    _lastSyncedContent: localPage._lastSyncedContent,
  };
  
  // Only merge scalar fields (title, excerpt, parentId, etc.), not content
  const { merged: scalarMerged } = mergeRecords<OfflinePage>(
    localPage,
    remoteWithCRDT,
    PAGE_CRDT_FIELDS
  );
  
  // Preserve content-related fields from local. Excerpt is derived from content when available.
  const computedExcerptLocal = computeExcerptForSync(localPage.content, (scalarMerged as any).excerpt, localPage._hasContent);
  const merged: OfflinePage = {
    ...scalarMerged,
    excerpt: computedExcerptLocal,
    content: localPage.content,
    _blockHLCs: localPage._blockHLCs,
    _deletedBlocks: localPage._deletedBlocks,
    _hasContent: localPage._hasContent,
    _contentFetchedAt: localPage._contentFetchedAt,
    _lastSyncedContent: localPage._lastSyncedContent,
  };
  
  await saveLocalPage(merged);
  return merged;
}

/**
 * Handle remote page change when local has pending changes.
 */
async function handleRemotePageWithPendingLocal(
  localPage: OfflinePage,
  remotePage: Page,
  hlc: HLCTimestamp
): Promise<OfflinePage> {
  // Detect which remote blocks actually changed vs local
  const { added: remoteAdded, modified: remoteModified } = detectChangedBlocks(
    localPage.content,
    remotePage.content
  );
  
  // Only assign new HLCs to blocks that actually changed on the server
  // Preserve existing HLCs for blocks that weren't modified remotely
  const remoteBlockHLCs: Record<string, HLCTimestamp> = { ...localPage._blockHLCs };
  for (const blockId of [...remoteAdded, ...remoteModified]) {
    remoteBlockHLCs[blockId] = hlc;
  }

  const remoteWithCRDT: OfflinePage = {
    ...remotePage,
    workspace: remotePage.workspace || '',
    _syncStatus: 'synced',
    _hlc: hlc,
    _fieldHLCs: createFieldHLCs(remotePage as unknown as Record<string, unknown>, PAGE_CRDT_FIELDS, hlc),
    _blockHLCs: remoteBlockHLCs,
    _deletedBlocks: {},
    _hasContent: remotePage.content !== null && remotePage.content !== undefined,
    _contentFetchedAt: Date.now(),
  };

  // Merge scalar fields
  const { merged: scalarMerged, hadLocalChanges: hadScalarChanges } = mergeRecords<OfflinePage>(
    localPage,
    remoteWithCRDT,
    PAGE_CRDT_FIELDS
  );

  // Merge content at block level
  const {
    mergedContent,
    mergedBlockHLCs,
    mergedDeletedBlocks,
    hadLocalChanges: hadBlockChanges,
  } = mergeYooptaContent(
    localPage.content,
    remotePage.content,
    localPage._blockHLCs,
    remoteBlockHLCs,
    localPage._deletedBlocks,
    {}
  );

  const merged: OfflinePage = {
    ...scalarMerged,
    // Derive excerpt from merged content or fall back to scalar merged value
    excerpt: computeExcerptForSync(localPage.content, (scalarMerged as any).excerpt, localPage._hasContent),
    content: mergedContent,
    _blockHLCs: mergedBlockHLCs,
    _deletedBlocks: mergedDeletedBlocks,
    _syncStatus: hadScalarChanges || hadBlockChanges ? 'pending' : 'synced',
    _lastSyncedContent: hadScalarChanges || hadBlockChanges ? localPage._lastSyncedContent : mergedContent,
  };

  await saveLocalPage(merged);
  return merged;
}

/**
 * Handle remote page change when local is synced (no pending changes).
 */
async function handleRemotePageSyncedLocal(
  localPage: OfflinePage,
  remotePage: Page,
  hlc: HLCTimestamp
): Promise<OfflinePage> {
  const { added, modified } = detectChangedBlocks(localPage.content, remotePage.content);
  const blockHLCs = { ...localPage._blockHLCs };
  
  // Update HLCs only for blocks that changed
  for (const blockId of [...added, ...modified]) {
    blockHLCs[blockId] = hlc;
  }
  
  // Remove HLCs for deleted blocks
  const remoteBlockIds = new Set(extractBlockIds(remotePage.content));
  for (const blockId of Object.keys(blockHLCs)) {
    if (!remoteBlockIds.has(blockId)) {
      delete blockHLCs[blockId];
    }
  }

  const offlinePage: OfflinePage = {
    ...remotePage,
    // Prefer local excerpt if remote omitted it and we have local content
    excerpt: computeExcerptForSync(localPage.content, remotePage.excerpt, localPage._hasContent),
    workspace: remotePage.workspace || '',
    _syncStatus: 'synced',
    _hlc: hlc,
    _fieldHLCs: createFieldHLCs(remotePage as unknown as Record<string, unknown>, PAGE_CRDT_FIELDS, hlc),
    _blockHLCs: blockHLCs,
    _deletedBlocks: localPage._deletedBlocks || {},
    _hasContent: remotePage.content !== null && remotePage.content !== undefined,
    _contentFetchedAt: Date.now(),
    _lastSyncedContent: getPageSyncContent(remotePage),
  };
  await saveLocalPage(offlinePage);
  return offlinePage;
}
