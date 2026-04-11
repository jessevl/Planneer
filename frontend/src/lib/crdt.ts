/**
 * @file crdt.ts
 * @description CRDT utilities for offline sync with conflict resolution
 * @app SHARED - Used by sync engine and stores
 *
 * Implements Hybrid Logical Clocks (HLC) and Last-Writer-Wins (LWW) registers
 * for automatic conflict resolution across devices.
 *
 * Key concepts:
 * - HLC provides causality-preserving timestamps that work offline
 * - Field-level LWW allows concurrent edits to different fields to merge
 * - Block-level LWW for Yoopta content allows concurrent edits to different blocks
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Hybrid Logical Clock timestamp.
 * Combines wall clock time with logical counters for total ordering.
 */
export interface HLCTimestamp {
  /** Wall clock time in milliseconds since epoch */
  ts: number;
  /** Logical counter for ordering within same millisecond */
  counter: number;
  /** Node ID (device identifier) for tie-breaking */
  node: string;
}

/**
 * CRDT metadata for a record.
 * Tracks per-field timestamps for LWW merging.
 */
export interface CRDTMetadata {
  /** Record-level HLC (max of all field HLCs) */
  _hlc: HLCTimestamp;
  /** Per-field HLC timestamps */
  _fieldHLCs: Record<string, HLCTimestamp>;
}

/**
 * Extended CRDT metadata for pages with block-level tracking.
 */
export interface NoteCRDTMetadata extends CRDTMetadata {
  /** Per-block HLC timestamps for Yoopta content */
  _blockHLCs: Record<string, HLCTimestamp>;
  /** Tombstones for deleted blocks (blockId -> deletion HLC) */
  _deletedBlocks: Record<string, HLCTimestamp>;
}

/**
 * Sync status for a record in IndexedDB.
 */
export type SyncStatus = 'synced' | 'pending' | 'conflict' | 'deleted';

/**
 * A record with sync metadata attached.
 */
export interface SyncableRecord {
  id: string;
  _syncStatus: SyncStatus;
  _hlc: HLCTimestamp;
  _fieldHLCs: Record<string, HLCTimestamp>;
  /** Server's 'updated' timestamp when we last synced */
  _serverVersion?: string;
}

/**
 * A note record with block-level CRDT metadata.
 */
export interface SyncableNote extends SyncableRecord {
  _blockHLCs: Record<string, HLCTimestamp>;
  _deletedBlocks: Record<string, HLCTimestamp>;
}

// ============================================================================
// HLC COMPARISON
// ============================================================================

/**
 * Compare two HLC timestamps.
 * @returns negative if a < b, positive if a > b, 0 if equal
 */
export function compareHLC(a: HLCTimestamp, b: HLCTimestamp): number {
  // Compare wall clock time first
  if (a.ts !== b.ts) return a.ts - b.ts;
  // Then logical counter
  if (a.counter !== b.counter) return a.counter - b.counter;
  // Finally node ID (lexicographic) for deterministic tie-breaking
  return a.node.localeCompare(b.node);
}

/**
 * Check if HLC a is greater than HLC b.
 */
export function isHLCGreater(a: HLCTimestamp, b: HLCTimestamp): boolean {
  return compareHLC(a, b) > 0;
}

/**
 * Get the maximum of two HLC timestamps.
 */
export function maxHLC(a: HLCTimestamp, b: HLCTimestamp): HLCTimestamp {
  return compareHLC(a, b) >= 0 ? a : b;
}

/**
 * Serialize HLC to a string for storage/transmission.
 * Format: "ts:counter:node" - lexicographically sortable
 */
export function serializeHLC(hlc: HLCTimestamp): string {
  // Pad ts to 15 digits (good until year 2286)
  // Pad counter to 6 digits (allows 1M ops per millisecond)
  return `${hlc.ts.toString().padStart(15, '0')}:${hlc.counter.toString().padStart(6, '0')}:${hlc.node}`;
}

/**
 * Deserialize HLC from string format.
 */
export function deserializeHLC(str: string): HLCTimestamp {
  const [ts, counter, node] = str.split(':');
  return {
    ts: parseInt(ts, 10),
    counter: parseInt(counter, 10),
    node,
  };
}

// ============================================================================
// HYBRID LOGICAL CLOCK
// ============================================================================

/**
 * Hybrid Logical Clock implementation.
 * Maintains causality while allowing offline operation.
 *
 * Based on "Logical Physical Clocks and Consistent Snapshots in Globally
 * Distributed Databases" - Kulkarni et al.
 */
export class HybridLogicalClock {
  private ts: number;
  private counter: number;
  private nodeId: string;

  constructor(nodeId?: string) {
    this.ts = Date.now();
    this.counter = 0;
    this.nodeId = nodeId || this.generateNodeId();
  }

  /**
   * Generate a unique node ID for this device.
   * Persists to localStorage to maintain identity across sessions.
   */
  private generateNodeId(): string {
    const storageKey = 'planneer_node_id';
    let nodeId = localStorage.getItem(storageKey);
    if (!nodeId) {
      // Generate a random 8-character alphanumeric ID
      nodeId = Array.from({ length: 8 }, () =>
        'abcdefghijklmnopqrstuvwxyz0123456789'.charAt(
          Math.floor(Math.random() * 36)
        )
      ).join('');
      localStorage.setItem(storageKey, nodeId);
    }
    return nodeId;
  }

  /**
   * Get current node ID.
   */
  getNodeId(): string {
    return this.nodeId;
  }

  /**
   * Generate a new timestamp for a local event.
   * Called when making a local change.
   */
  tick(): HLCTimestamp {
    const now = Date.now();
    if (now > this.ts) {
      this.ts = now;
      this.counter = 0;
    } else {
      // Clock hasn't advanced, increment counter
      this.counter++;
    }
    return { ts: this.ts, counter: this.counter, node: this.nodeId };
  }

  /**
   * Update clock when receiving a remote timestamp.
   * Called when syncing changes from server/other devices.
   * Returns a new timestamp that is greater than both local and remote.
   */
  receive(remote: HLCTimestamp): HLCTimestamp {
    const now = Date.now();

    if (now > this.ts && now > remote.ts) {
      // Wall clock has advanced past both
      this.ts = now;
      this.counter = 0;
    } else if (this.ts === remote.ts) {
      // Same timestamp, take max counter and increment
      this.counter = Math.max(this.counter, remote.counter) + 1;
    } else if (remote.ts > this.ts) {
      // Remote is ahead, catch up
      this.ts = remote.ts;
      this.counter = remote.counter + 1;
    } else {
      // Local is ahead, just increment counter
      this.counter++;
    }

    return { ts: this.ts, counter: this.counter, node: this.nodeId };
  }

  /**
   * Get current clock state without advancing it.
   */
  now(): HLCTimestamp {
    return { ts: this.ts, counter: this.counter, node: this.nodeId };
  }

  /**
   * Restore clock state from storage.
   */
  restore(state: { ts: number; counter: number }): void {
    // Only restore if stored state is ahead of current wall clock
    const now = Date.now();
    if (state.ts > now) {
      this.ts = state.ts;
      this.counter = state.counter;
    } else {
      this.ts = now;
      this.counter = 0;
    }
  }

  /**
   * Export state for persistence.
   */
  export(): { ts: number; counter: number; nodeId: string } {
    return { ts: this.ts, counter: this.counter, nodeId: this.nodeId };
  }
}

// ============================================================================
// FIELD-LEVEL MERGE (for Tasks, Projects)
// ============================================================================

/**
 * Fields to track with CRDT timestamps for tasks.
 */
export const TASK_CRDT_FIELDS = [
  'title',
  'description',
  'dueDate',
  'priority',
  'taskPageId',
  'sectionId',
  'completed',
  'completedAt',
  'subtasks',
  'recurrence',
  'order',
  'assignee',
  'tag',
] as const;

/**
 * Fields to track with CRDT timestamps for projects.
 */
export const PROJECT_CRDT_FIELDS = [
  'name',
  'color',
  'icon',
  'order',
  'parent',
  'sections',
  'viewMode',
  'groupBy',
] as const;

/**
 * Fields to track with CRDT timestamps for pages (excluding content).
 * 
 * ⚠️ SOURCE OF TRUTH for page metadata field definitions.
 * This array is imported by:
 * - syncEngine/utils.ts → PAGE_METADATA_FIELDS (adds 'excerpt')
 * - api/pagesApi.ts → METADATA_FIELDS (adds PocketBase fields)
 * 
 * Note: childCount is included even though it's server-calculated,
 * so that SSE updates properly update the local value.
 */
export const PAGE_CRDT_FIELDS = [
  'title',
  'parentId',
  'order',
  'icon',
  'color',
  'coverImage',
  'coverGradient',
  'coverAttribution',
  'viewMode',
  'childrenViewMode',
  'isDailyNote',
  'dailyNoteDate',
  'childCount',
  
  // Sidebar state
  'isExpanded',
  'isPinned',
  'pinnedOrder',
  'showChildrenInSidebar',
  
  // Collection view preferences
  'collectionSortBy',
  'collectionSortDirection', 
  'collectionGroupBy',
  // Task collection fields
  'sections',
  'tasksViewMode',
  'tasksGroupBy',
  'showCompletedTasks',
  'showExcerpts',
  // Saved views
  'savedViews',
  'activeSavedViewId',
  // Tags
  'tags',
  // Filter options (JSON-encoded)
  'tasksFilterOptions',
  'collectionFilterOptions',
  // Hero display preference
  'heroCompact',
  // Server-computed rich card preview payload
  'previewStructured',
  // Source-owned mirrored page metadata
  'isReadOnly',
  'sourceOrigin',
  'sourceItemType',
  'sourceExternalId',
  'sourcePath',
  'sourceLastSyncedAt',
  'sourceCreatedAt',
  'sourceModifiedAt',
  'sourceContentLength',
  'sourceETag',
] as const;

// Backward compatibility alias
export const NOTE_CRDT_FIELDS = PAGE_CRDT_FIELDS;

/**
 * Create initial field HLCs for a new record.
 */
export function createFieldHLCs(
  data: Record<string, unknown>,
  fields: readonly string[],
  hlc: HLCTimestamp
): Record<string, HLCTimestamp> {
  const fieldHLCs: Record<string, HLCTimestamp> = {};
  for (const field of fields) {
    if (field in data) {
      fieldHLCs[field] = hlc;
    }
  }
  return fieldHLCs;
}

/**
 * Update field HLCs for changed fields.
 */
export function updateFieldHLCs(
  currentHLCs: Record<string, HLCTimestamp>,
  changedFields: string[],
  hlc: HLCTimestamp
): Record<string, HLCTimestamp> {
  const updated = { ...currentHLCs };
  for (const field of changedFields) {
    updated[field] = hlc;
  }
  return updated;
}

/**
 * Merge two records using field-level LWW.
 * Returns the merged record and a boolean indicating if local had changes.
 */
export function mergeRecords<T extends CRDTMetadata>(
  local: T,
  remote: T,
  fields: readonly string[]
): { merged: T; hadLocalChanges: boolean } {
  const merged = { ...local } as T;
  let hadLocalChanges = false;

  for (const field of fields) {
    const localHLC = local._fieldHLCs[field];
    const remoteHLC = remote._fieldHLCs?.[field];

    if (!remoteHLC) {
      // Field only exists locally
      if (localHLC) hadLocalChanges = true;
      continue;
    }

    if (!localHLC || isHLCGreater(remoteHLC, localHLC)) {
      // Remote wins
      (merged as Record<string, unknown>)[field] = (remote as Record<string, unknown>)[field];
      merged._fieldHLCs[field] = remoteHLC;
    } else if (isHLCGreater(localHLC, remoteHLC)) {
      // Local wins
      hadLocalChanges = true;
    }
    // If equal (same HLC), local is kept
  }

  // Record-level HLC is max of both
  merged._hlc = maxHLC(local._hlc, remote._hlc);

  return { merged, hadLocalChanges };
}

// ============================================================================
// BLOCK-LEVEL MERGE (for Notes with Yoopta content)
// ============================================================================

/**
 * Yoopta block structure (simplified for CRDT purposes).
 */
export interface YooptaBlock {
  id: string;
  type: string;
  meta: { order: number; depth: number };
  value: unknown[];
}

/**
 * Check if a key is a granular table key (row or meta).
 */
export const isGranularKey = (key: string) => key.includes(':row:') || key.endsWith(':meta');

/** Parse JSON content into a blocks map, returning {} on null/invalid input. */
function parseBlocksMap(content: string | null): Record<string, YooptaBlock> {
  if (!content) return {};
  try {
    return JSON.parse(content) || {};
  } catch {
    return {};
  }
}

/**
 * Check if a block is an AdvancedTable block.
 */
export function isAdvancedTableBlock(block: unknown): block is YooptaBlock {
  if (!block || typeof block !== 'object') return false;
  const b = block as Record<string, unknown>;
  return b.type === 'AdvancedTable' && Array.isArray(b.value);
}

/**
 * Extract rows from an AdvancedTable block.
 */
function extractTableRows(block: YooptaBlock): Record<string, unknown> {
  const rows: Record<string, unknown> = {};
  const tableElement = (block.value as unknown[])?.[0] as { type?: string; children?: Array<{ id: string }> } | undefined;
  if (!tableElement || tableElement.type !== 'table') return rows;
  
  for (const row of tableElement.children || []) {
    if (row.id) {
      rows[row.id] = row;
    }
  }
  return rows;
}

/**
 * Extract table metadata (props only).
 */
function extractTableMetadata(block: YooptaBlock): unknown {
  const tableElement = (block.value as unknown[])?.[0] as { type?: string; props?: unknown } | undefined;
  if (!tableElement || tableElement.type !== 'table') return null;
  return tableElement.props;
}

/**
 * Merge two AdvancedTable blocks at row level.
 * Returns the merged block.
 */
function mergeTableBlocksRowLevel(
  localBlock: YooptaBlock,
  remoteBlock: YooptaBlock,
  localBlockHLCs: Record<string, HLCTimestamp>,
  remoteBlockHLCs: Record<string, HLCTimestamp>,
  localDeletedBlocks: Record<string, HLCTimestamp>,
  remoteDeletedBlocks: Record<string, HLCTimestamp>,
  localAllBlocks: Record<string, YooptaBlock>,
  remoteAllBlocks: Record<string, YooptaBlock>
): {
  mergedBlock: YooptaBlock;
  updatedBlockHLCs: Record<string, HLCTimestamp>;
  updatedDeletedBlocks: Record<string, HLCTimestamp>;
  hadLocalChanges: boolean;
} {
  const blockId = localBlock.id;
  
  // Extract rows and metadata from the block objects themselves
  const localRows = extractTableRows(localBlock);
  const remoteRows = extractTableRows(remoteBlock);
  let localMeta = extractTableMetadata(localBlock);
  let remoteMeta = extractTableMetadata(remoteBlock);
  
  // ALSO check the top-level maps for granular keys (Option C)
  const rowKeyPrefix = `${blockId}:row:`;
  const metaKey = `${blockId}:meta`;
  
  for (const [key, block] of Object.entries(localAllBlocks)) {
    if (key.startsWith(rowKeyPrefix)) {
      const rowId = key.slice(rowKeyPrefix.length);
      localRows[rowId] = block;
    } else if (key === metaKey) {
      // Metadata is stored as the block itself in granular keys
      localMeta = block;
    }
  }
  
  for (const [key, block] of Object.entries(remoteAllBlocks)) {
    if (key.startsWith(rowKeyPrefix)) {
      const rowId = key.slice(rowKeyPrefix.length);
      remoteRows[rowId] = block;
    } else if (key === metaKey) {
      remoteMeta = block;
    }
  }
  
  const mergedRows: Record<string, unknown> = {};
  const updatedBlockHLCs: Record<string, HLCTimestamp> = {};
  const updatedDeletedBlocks: Record<string, HLCTimestamp> = {};
  let hadLocalChanges = false;
  
  // Row HLC keys use format: blockId:row:rowId
  const rowKey = (rowId: string) => `${blockId}:row:${rowId}`;
  
  // Merge deleted rows (composite keys in deletedBlocks)
  const prefix = `${blockId}:row:`;
  for (const [key, hlc] of Object.entries(remoteDeletedBlocks)) {
    if (key.startsWith(prefix)) {
      const localDeleteHLC = localDeletedBlocks[key];
      if (!localDeleteHLC || isHLCGreater(hlc, localDeleteHLC)) {
        updatedDeletedBlocks[key] = hlc;
      } else {
        updatedDeletedBlocks[key] = localDeleteHLC;
      }
    }
  }
  for (const [key, hlc] of Object.entries(localDeletedBlocks)) {
    if (key.startsWith(prefix) && !updatedDeletedBlocks[key]) {
      updatedDeletedBlocks[key] = hlc;
    }
  }
  
  // Merge metadata
  const localMetaHLC = localBlockHLCs[metaKey];
  const remoteMetaHLC = remoteBlockHLCs[metaKey];
  
  let mergedMeta: unknown;
  if (!localMetaHLC || (remoteMetaHLC && isHLCGreater(remoteMetaHLC, localMetaHLC))) {
    mergedMeta = remoteMeta;
    if (remoteMetaHLC) updatedBlockHLCs[metaKey] = remoteMetaHLC;
  } else {
    mergedMeta = localMeta;
    updatedBlockHLCs[metaKey] = localMetaHLC;
    if (remoteMetaHLC && isHLCGreater(localMetaHLC, remoteMetaHLC)) {
      hadLocalChanges = true;
    }
  }
  
  // Merge rows
  const allRowIds = new Set([...Object.keys(localRows), ...Object.keys(remoteRows)]);
  
  for (const rowId of allRowIds) {
    const key = rowKey(rowId);
    const deleteHLC = updatedDeletedBlocks[key];
    const localRow = localRows[rowId];
    const remoteRow = remoteRows[rowId];
    const localHLC = localBlockHLCs[key];
    const remoteHLC = remoteBlockHLCs[key];
    
    // Check if row was deleted
    if (deleteHLC) {
      const editHLC = localHLC && remoteHLC ? maxHLC(localHLC, remoteHLC) : (localHLC || remoteHLC);
      if (editHLC && isHLCGreater(deleteHLC, editHLC)) {
        continue; // Row stays deleted
      }
      // Edit is newer, remove from tombstones
      delete updatedDeletedBlocks[key];
    }
    
    // Row only exists locally
    if (localRow && !remoteRow) {
      mergedRows[rowId] = localRow;
      if (localHLC) {
        updatedBlockHLCs[key] = localHLC;
        hadLocalChanges = true;
      }
      continue;
    }
    
    // Row only exists remotely
    if (remoteRow && !localRow) {
      mergedRows[rowId] = remoteRow;
      if (remoteHLC) {
        updatedBlockHLCs[key] = remoteHLC;
      }
      continue;
    }
    
    // Row exists in both - compare HLCs
    if (localRow && remoteRow) {
      if (!localHLC || (remoteHLC && isHLCGreater(remoteHLC, localHLC))) {
        mergedRows[rowId] = remoteRow;
        updatedBlockHLCs[key] = remoteHLC!;
      } else {
        mergedRows[rowId] = localRow;
        updatedBlockHLCs[key] = localHLC;
        if (remoteHLC && isHLCGreater(localHLC, remoteHLC)) {
          hadLocalChanges = true;
        }
      }
    }
  }
  
  // Reconstruct table - preserve row order based on metadata winner
  const localRowOrder = Object.keys(localRows);
  const remoteRowOrder = Object.keys(remoteRows);
  const useLocalOrder = localMetaHLC && (!remoteMetaHLC || isHLCGreater(localMetaHLC, remoteMetaHLC));
  const baseOrder = useLocalOrder ? localRowOrder : remoteRowOrder;
  
  // Build final row order: base order + any new rows
  const finalRowOrder: string[] = [...baseOrder];
  const orderSet = new Set(finalRowOrder);
  for (const rowId of Object.keys(mergedRows)) {
    if (!orderSet.has(rowId)) {
      finalRowOrder.push(rowId);
    }
  }
  
  // Filter to only existing rows
  const orderedRows = finalRowOrder
    .filter(rowId => mergedRows[rowId])
    .map(rowId => mergedRows[rowId]);
  
  // Get table element structure from winner
  const sourceBlock = useLocalOrder ? localBlock : remoteBlock;
  const tableElement = (sourceBlock.value as unknown[])?.[0] as { id?: string; type?: string } | undefined;
  
  // Build merged block
  const mergedBlock: YooptaBlock = {
    id: blockId,
    type: 'AdvancedTable',
    meta: localBlock.meta,
    value: [{
      id: tableElement?.id || 'table',
      type: 'table',
      props: mergedMeta,
      children: orderedRows,
    }] as unknown[],
  };
  
  return { mergedBlock, updatedBlockHLCs, updatedDeletedBlocks, hadLocalChanges };
}

/**
 * Merge Yoopta content at block level.
 * Preserves edits to different blocks from different devices.
 */
export function mergeYooptaContent(
  localContent: string | null,
  remoteContent: string | null,
  localBlockHLCs: Record<string, HLCTimestamp>,
  remoteBlockHLCs: Record<string, HLCTimestamp>,
  localDeletedBlocks: Record<string, HLCTimestamp>,
  remoteDeletedBlocks: Record<string, HLCTimestamp>
): {
  mergedContent: string;
  mergedBlockHLCs: Record<string, HLCTimestamp>;
  mergedDeletedBlocks: Record<string, HLCTimestamp>;
  hadLocalChanges: boolean;
} {
  // Parse blocks from content
  const local: Record<string, YooptaBlock> = parseBlocksMap(localContent);
  const remote: Record<string, YooptaBlock> = parseBlocksMap(remoteContent);

  const merged: Record<string, YooptaBlock> = {};
  const mergedBlockHLCs: Record<string, HLCTimestamp> = {};
  const mergedDeletedBlocks: Record<string, HLCTimestamp> = {
    ...localDeletedBlocks,
  };
  let hadLocalChanges = false;

  // Merge deleted blocks (keep tombstones with highest HLC)
  for (const [blockId, remoteDeleteHLC] of Object.entries(remoteDeletedBlocks)) {
    const localDeleteHLC = localDeletedBlocks[blockId];
    if (!localDeleteHLC || isHLCGreater(remoteDeleteHLC, localDeleteHLC)) {
      mergedDeletedBlocks[blockId] = remoteDeleteHLC;
    }
  }

  // Get all block IDs (excluding deleted ones and granular ones)
  const allBlockIds = new Set([
    ...Object.keys(local).filter(id => !isGranularKey(id)),
    ...Object.keys(remote).filter(id => !isGranularKey(id)),
  ]);

  for (const blockId of allBlockIds) {
    // Check if block was deleted
    const deleteHLC = mergedDeletedBlocks[blockId];
    const localBlock = local[blockId];
    const remoteBlock = remote[blockId];
    const localHLC = localBlockHLCs[blockId];
    const remoteHLC = remoteBlockHLCs[blockId];

    // If block is deleted and deletion is newer than any edit, skip it
    if (deleteHLC) {
      const editHLC = localHLC && remoteHLC ? maxHLC(localHLC, remoteHLC) : (localHLC || remoteHLC);
      if (editHLC && isHLCGreater(deleteHLC, editHLC)) {
        continue; // Block stays deleted
      }
      // Edit is newer, remove from tombstones
      delete mergedDeletedBlocks[blockId];
    }

    // Block only exists locally
    if (localBlock && !remoteBlock) {
      merged[blockId] = localBlock;
      if (localHLC) {
        mergedBlockHLCs[blockId] = localHLC;
        hadLocalChanges = true;
      }
      // Copy over row-level HLCs for tables
      if (isAdvancedTableBlock(localBlock)) {
        const prefix = `${blockId}:`;
        for (const [key, hlc] of Object.entries(localBlockHLCs)) {
          if (key.startsWith(prefix)) {
            mergedBlockHLCs[key] = hlc;
          }
        }
      }
      continue;
    }

    // Block only exists remotely
    if (remoteBlock && !localBlock) {
      merged[blockId] = remoteBlock;
      if (remoteHLC) {
        mergedBlockHLCs[blockId] = remoteHLC;
      }
      // Copy over row-level HLCs for tables
      if (isAdvancedTableBlock(remoteBlock)) {
        const prefix = `${blockId}:`;
        for (const [key, hlc] of Object.entries(remoteBlockHLCs)) {
          if (key.startsWith(prefix)) {
            mergedBlockHLCs[key] = hlc;
          }
        }
      }
      continue;
    }

    // Block exists in both - handle AdvancedTable specially with row-level merge
    if (localBlock && remoteBlock) {
      if (isAdvancedTableBlock(localBlock) && isAdvancedTableBlock(remoteBlock)) {
        // Use row-level merge for tables
        const tableResult = mergeTableBlocksRowLevel(
          localBlock,
          remoteBlock,
          localBlockHLCs,
          remoteBlockHLCs,
          localDeletedBlocks,
          remoteDeletedBlocks,
          local,
          remote
        );
        
        merged[blockId] = tableResult.mergedBlock;
        Object.assign(mergedBlockHLCs, tableResult.updatedBlockHLCs);
        Object.assign(mergedDeletedBlocks, tableResult.updatedDeletedBlocks);
        
        // Keep block-level HLC as max of both
        mergedBlockHLCs[blockId] = maxHLC(localHLC || { ts: 0, counter: 0, node: '' }, remoteHLC || { ts: 0, counter: 0, node: '' });
        
        if (tableResult.hadLocalChanges) {
          hadLocalChanges = true;
        }
      } else {
        // Standard block-level merge
        if (!localHLC || (remoteHLC && isHLCGreater(remoteHLC, localHLC))) {
          merged[blockId] = remoteBlock;
          mergedBlockHLCs[blockId] = remoteHLC!;
        } else {
          merged[blockId] = localBlock;
          mergedBlockHLCs[blockId] = localHLC;
          if (remoteHLC && isHLCGreater(localHLC, remoteHLC)) {
            hadLocalChanges = true;
          }
        }
      }
    }
  }

  // Sort blocks by order for consistent output.
  // Separate metadata entries (like __rowLayout) from actual blocks — metadata
  // objects don't have .id/.meta.order and must be preserved by key, not by .id.
  const metadataEntries: Record<string, unknown> = {};
  const blockEntries: YooptaBlock[] = [];

  for (const [key, value] of Object.entries(merged)) {
    if (value && typeof (value as any).type === 'string' && (value as any).id) {
      blockEntries.push(value);
    } else {
      // Non-block metadata (e.g., __rowLayout) — preserve by key
      metadataEntries[key] = value;
    }
  }

  blockEntries.sort((a, b) => (a.meta?.order ?? 0) - (b.meta?.order ?? 0));
  const finalContent: Record<string, YooptaBlock | unknown> = {};
  for (const block of blockEntries) {
    finalContent[block.id] = block;
  }
  // Re-add metadata entries
  for (const [key, value] of Object.entries(metadataEntries)) {
    finalContent[key] = value;
  }
  
  // Reconstruct full content structure
  const mergedContentString = JSON.stringify(finalContent);

  return {
    mergedContent: mergedContentString,
    mergedBlockHLCs,
    mergedDeletedBlocks,
    hadLocalChanges,
  };
}

/**
 * Extract block IDs from Yoopta content.
 */
export function getBlockIds(content: string | null): string[] {
  if (!content) return [];
  try {
    const parsed = JSON.parse(content);
    return Object.keys(parsed);
  } catch {
    return [];
  }
}

/**
 * Detect which blocks changed between two content versions.
 */
export function detectChangedBlocks(
  oldContent: string | null,
  newContent: string | null
): { added: string[]; modified: string[]; deleted: string[] } {
  const oldBlocks = parseBlocksMap(oldContent);
  const newBlocks = parseBlocksMap(newContent);

  const added: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];

  const oldIds = new Set(Object.keys(oldBlocks));
  const newIds = new Set(Object.keys(newBlocks));

  // Find added blocks
  for (const id of newIds) {
    if (!oldIds.has(id)) {
      added.push(id);
    }
  }

  // Find deleted blocks
  for (const id of oldIds) {
    if (!newIds.has(id)) {
      deleted.push(id);
    }
  }

  // Find modified blocks (exists in both, content differs)
  for (const id of oldIds) {
    if (newIds.has(id)) {
      const oldStr = JSON.stringify(oldBlocks[id]);
      const newStr = JSON.stringify(newBlocks[id]);
      if (oldStr !== newStr) {
        modified.push(id);
      }
    }
  }

  return { added, modified, deleted };
}

// ============================================================================
// SINGLETON CLOCK INSTANCE
// ============================================================================

/** Global HLC instance - initialized lazily */
let globalClock: HybridLogicalClock | null = null;

/**
 * Get the global HLC instance.
 */
export function getHLC(): HybridLogicalClock {
  if (!globalClock) {
    globalClock = new HybridLogicalClock();
  }
  return globalClock;
}

/**
 * Generate a new HLC timestamp (convenience wrapper).
 */
export function tick(): HLCTimestamp {
  return getHLC().tick();
}

/**
 * Receive a remote HLC timestamp (convenience wrapper).
 */
export function receive(remote: HLCTimestamp): HLCTimestamp {
  return getHLC().receive(remote);
}
