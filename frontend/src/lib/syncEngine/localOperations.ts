/**
 * @file syncEngine/localOperations.ts
 * @description Handles recording local changes and queuing for sync
 */

import {
  type HLCTimestamp,
  tick,
  createFieldHLCs,
  updateFieldHLCs,
  detectChangedBlocks,
  TASK_CRDT_FIELDS,
  PAGE_CRDT_FIELDS,
} from '../crdt';
import {
  type OfflineTask,
  type OfflinePage,
  queueOperation,
  saveLocalTask,
  saveLocalPage,
  mergeAndSaveLocalPage,
  getLocalTask,
  getLocalPage,
  markTaskDeleted,
  markPageDeleted,
} from '../offlineDb';
import type { Task } from '@/types/task';
import type { Page } from '@/types/page';
import type { OperationType } from './types';
import { extractChangedBlocks } from './utils';

// ============================================================================
// LOCAL TASK OPERATIONS
// ============================================================================

/**
 * Record a local task change and queue for sync.
 */
export async function recordLocalTaskChange(
  operation: OperationType,
  task: Task,
  changedFields?: string[],
  workspaceId?: string
): Promise<OfflineTask> {
  const hlc = tick();
  const workspace = workspaceId || task.workspace;
  
  if (!workspace) {
    throw new Error('[SyncEngine] Task must have a workspace');
  }

  // Build offline task with CRDT metadata
  const existingTask = await getLocalTask(task.id);
  const offlineTask: OfflineTask = {
    ...task,
    workspace,
    _syncStatus: operation === 'delete' ? 'deleted' : 'pending',
    _hlc: hlc,
    _fieldHLCs:
      operation === 'create'
        ? createFieldHLCs(task as unknown as Record<string, unknown>, TASK_CRDT_FIELDS, hlc)
        : updateFieldHLCs(existingTask?._fieldHLCs || {}, changedFields || [], hlc),
  };

  // Save or mark deleted locally
  if (operation === 'delete') {
    await markTaskDeleted(task.id, hlc);
  } else {
    await saveLocalTask(offlineTask);
  }

  // Queue for sync
  await queueOperation({
    collection: 'tasks',
    operation,
    recordId: task.id,
    workspaceId: workspace,
    data: operation !== 'delete' ? (task as unknown as Record<string, unknown>) : undefined,
    changedFields,
    hlc,
    createdAt: Date.now(),
    attempts: 0,
  });

  return offlineTask;
}

// ============================================================================
// LOCAL PAGE OPERATIONS
// ============================================================================

/**
 * Record a local page change and queue for sync.
 */
export async function recordLocalPageChange(
  operation: OperationType,
  page: Page,
  changedFields?: string[],
  workspaceId?: string
): Promise<OfflinePage> {
  const hlc = tick();
  const workspace = workspaceId || page.workspace;
  
  if (!workspace) {
    throw new Error('[SyncEngine] Page must have a workspace');
  }
  
  const existingPage = await getLocalPage(page.id);

  // Detect block changes for content fields
  const blockHLCs = existingPage?._blockHLCs || {};
  const deletedBlocks = existingPage?._deletedBlocks || {};

  // Handle regular content (Yoopta)
  if (changedFields?.includes('content') || operation === 'create') {
    const oldContent = existingPage?.content || null;
    const newContent = page.content || null;
    
    // Use extractChangedBlocks which handles row-level tracking for tables
    const changedBlocksResult = extractChangedBlocks(oldContent, newContent);
    
    // Update block HLCs for changed non-table blocks
    for (const [blockId, _blockData] of Object.entries(changedBlocksResult.blocks)) {
      blockHLCs[blockId] = hlc;
    }

    // Add tombstones for deleted blocks
    for (const blockId of changedBlocksResult.deleted) {
      deletedBlocks[blockId] = hlc;
      delete blockHLCs[blockId];
    }
    
    // Track row-level HLCs for tables
    if (changedBlocksResult.tableRowChanges) {
      for (const rowKey of Object.keys(changedBlocksResult.tableRowChanges)) {
        blockHLCs[rowKey] = hlc;
      }
    }
    
    // Track table metadata changes
    if (changedBlocksResult.tableMetaChanges) {
      for (const metaKey of Object.keys(changedBlocksResult.tableMetaChanges)) {
        blockHLCs[metaKey] = hlc;
      }
    }
    
    // Track deleted table rows
    if (changedBlocksResult.deletedTableRows) {
      for (const rowKey of changedBlocksResult.deletedTableRows) {
        deletedBlocks[rowKey] = hlc;
        delete blockHLCs[rowKey];
      }
    }
  }

  // Build CRDT metadata for this update
  const crdtMetadata = {
    _syncStatus: (operation === 'delete' ? 'deleted' : 'pending') as 'pending' | 'synced' | 'deleted' | 'conflict',
    _hlc: hlc,
    _fieldHLCs:
      operation === 'create'
        ? createFieldHLCs(page as unknown as Record<string, unknown>, PAGE_CRDT_FIELDS, hlc)
        : updateFieldHLCs(
            existingPage?._fieldHLCs || {},
            (changedFields || []).filter((f) => f !== 'content'),
            hlc
          ),
    _blockHLCs: blockHLCs,
    _deletedBlocks: deletedBlocks,
    _hasContent: page.content !== null && page.content !== undefined,
    _contentFetchedAt: existingPage?._contentFetchedAt,
    _lastSyncedContent: existingPage?._lastSyncedContent,
  };

  let offlinePage: OfflinePage;

  // Save or mark deleted locally
  if (operation === 'delete') {
    await markPageDeleted(page.id, hlc);
    // Build offline page for return value
    offlinePage = {
      ...page,
      workspace,
      ...crdtMetadata,
    } as OfflinePage;
  } else {
    // Use atomic merge to prevent race conditions with rapid updates
    // This ensures savedViews and other fields aren't lost when multiple
    // updates happen in quick succession
    offlinePage = await mergeAndSaveLocalPage(
      page.id,
      { ...page, workspace },
      crdtMetadata
    );
  }

  // Queue for sync
  await queueOperation({
    collection: 'pages',
    operation,
    recordId: page.id,
    workspaceId: workspace,
    data: operation !== 'delete' ? (page as unknown as Record<string, unknown>) : undefined,
    changedFields,
    hlc,
    createdAt: Date.now(),
    attempts: 0,
  });

  return offlinePage;
}

/**
 * Record a local note change and queue for sync.
 * @deprecated Use recordLocalPageChange instead
 */
export const recordLocalNoteChange = recordLocalPageChange;

// ============================================================================
// LOCAL PROJECT OPERATIONS (DEPRECATED)
// ============================================================================
