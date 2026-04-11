/**
 * @file syncEngine/utils.ts
 * @description Utility functions for the sync engine
 */

import { isGranularKey, isAdvancedTableBlock } from '../crdt';
import type { HLCTimestamp, YooptaBlock } from '../crdt';
import type { OfflinePage } from '../offlineDb';
import type { Page } from '@/types/page';

// ============================================================================
// ERROR DETECTION
// ============================================================================

/**
 * Check if an error is a "not unique" error (record already exists).
 * PocketBase ClientResponseError has structure: { status, data: { fieldName: { code, message } } }
 */
export function isNotUniqueError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { data?: { id?: { code?: string } } };
  return e.data?.id?.code === 'validation_not_unique';
}

/**
 * Check if error is a 404 Not Found
 */
export function is404Error(err: unknown): boolean {
  if (!err || typeof err !== 'object' || !('status' in err)) return false;
  return (err as { status: number }).status === 404;
}

/**
 * Check if error is a network error (status 0 or "Failed to fetch")
 * or a rate limit error (status 429).
 */
export function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  
  // PocketBase ClientResponseError with status 0 or 429
  if (typeof err === 'object' && 'status' in err) {
    const status = (err as any).status;
    if (status === 0 || status === 429) {
      return true;
    }
  }
  
  // Standard fetch error
  const message = String(err).toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('network error') ||
    message.includes('status 0') ||
    message.includes('clientresponserror 0') ||
    message.includes('status 429') ||
    message.includes('too many requests')
  );
}

// ============================================================================
// CONTENT UTILITIES
// ============================================================================

/**
 * Get the syncable content from a page.
 */
export function getPageSyncContent(page: Page | OfflinePage): string | null {
  return page.content || null;
}

/**
 * Extract block IDs from Yoopta content JSON.
 */
export function extractBlockIds(content: string | null): string[] {
  if (!content) return [];
  try {
    return Object.keys(JSON.parse(content));
  } catch {
    return [];
  }
}

/**
 * Safely parse content JSON to object.
 * Returns empty object if content is null/undefined or invalid JSON.
 */
export function parseContent(content: string | null | undefined): Record<string, unknown> {
  if (!content) return {};
  try {
    return typeof content === 'string' ? JSON.parse(content) : content;
  } catch {
    return {};
  }
}

/**
 * Parse content and extract the blocks map.
 * For Yoopta: returns the blocks map directly
 */
export function parseBlocks(content: string | null | undefined): Record<string, unknown> {
  const parsed = parseContent(content);
  return parsed;
}

/**
 * Reconstruct full content from blocks map.
 * For Yoopta: returns blocks directly (identity function preserved for semantic clarity).
 */
export function reconstructContent(
  blocks: Record<string, unknown>
): Record<string, unknown> {
  return blocks;
}

/**
 * Deep equality check for row objects.
 * More reliable than JSON.stringify comparison since property order doesn't matter.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return a === b;
  
  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  
  // One is array, other is not
  if (Array.isArray(a) || Array.isArray(b)) return false;
  
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  
  if (aKeys.length !== bKeys.length) return false;
  
  for (const key of aKeys) {
    if (!bKeys.includes(key)) return false;
    if (!deepEqual(aObj[key], bObj[key])) return false;
  }
  
  return true;
}

/**
 * Compare block content excluding meta.order to detect content-only changes.
 */
function blockContentEquals(a: YooptaBlock, b: YooptaBlock): boolean {
  // Quick checks first
  if (a.id !== b.id) return false;
  if (a.type !== b.type) return false;
  
  // Compare value and depth (order is tracked separately)
  if ((a.meta?.depth ?? 0) !== (b.meta?.depth ?? 0)) return false;
  if (JSON.stringify(a.value) !== JSON.stringify(b.value)) return false;
  return true;
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
 * Extract row IDs from an AdvancedTable block IN ORDER.
 * Used to detect when row order has changed (e.g., after sorting).
 */
function extractTableRowOrder(block: YooptaBlock): string[] {
  const tableElement = (block.value as unknown[])?.[0] as { type?: string; children?: Array<{ id: string }> } | undefined;
  if (!tableElement || tableElement.type !== 'table') return [];
  return (tableElement.children || []).map(row => row.id).filter(Boolean);
}

/**
 * Check if table row order has changed between two blocks.
 */
function tableRowOrderChanged(oldBlock: YooptaBlock, newBlock: YooptaBlock): boolean {
  const oldOrder = extractTableRowOrder(oldBlock);
  const newOrder = extractTableRowOrder(newBlock);
  if (oldOrder.length !== newOrder.length) return true;
  return oldOrder.some((id, i) => id !== newOrder[i]);
}

/**
 * Extract table metadata (props, excluding rows).
 */
function extractTableMetadata(block: YooptaBlock): unknown {
  const tableElement = (block.value as unknown[])?.[0] as { type?: string; props?: unknown } | undefined;
  if (!tableElement || tableElement.type !== 'table') return null;
  return tableElement.props;
}

/**
 * Compare table metadata (excluding rows).
 */
function tableMetadataEquals(a: YooptaBlock, b: YooptaBlock): boolean {
  return deepEqual(extractTableMetadata(a), extractTableMetadata(b));
}

/**
 * Extract changed blocks between two content versions.
 * Returns blocks that were added/modified and IDs of deleted blocks.
 * Now separates content changes from order-only changes for bandwidth optimization.
 * 
 * For AdvancedTable blocks, extracts row-level changes for granular sync.
 * Used by Option 2C to send only changed blocks to patch endpoint.
 */
export function extractChangedBlocks(
  oldContent: string | null,
  newContent: string | null
): { 
  blocks: Record<string, unknown>; 
  deleted: string[];
  /** Block IDs that only had their order changed (no content change) - maps to new order value */
  orderOnlyChanges: Record<string, number>;
  /** Table row changes - keyed by "blockId:row:rowId" */
  tableRowChanges?: Record<string, unknown>;
  /** Deleted table rows - "blockId:row:rowId" */
  deletedTableRows?: string[];
  /** Table metadata changes - keyed by "blockId:meta" */
  tableMetaChanges?: Record<string, unknown>;
} {
  const extractBlocks = (content: string | null): Record<string, YooptaBlock> => {
    if (!content) return {};
    const parsed = JSON.parse(content);
    return parsed || {};
  };
  
  const oldBlocks: Record<string, YooptaBlock> = extractBlocks(oldContent);
  const newBlocks: Record<string, YooptaBlock> = extractBlocks(newContent);
  
  const changedBlocks: Record<string, unknown> = {};
  const deletedBlockIds: string[] = [];
  const orderOnlyChanges: Record<string, number> = {};
  
  // Row-level tracking for tables
  const tableRowChanges: Record<string, unknown> = {};
  const deletedTableRows: string[] = [];
  const tableMetaChanges: Record<string, unknown> = {};
  
  const oldIds = new Set(Object.keys(oldBlocks));
  const newIds = new Set(Object.keys(newBlocks));
  
  // Find added or modified blocks
  for (const id of newIds) {
    if (isGranularKey(id)) continue; // Skip granular keys in top-level comparison
    
    const newBlock = newBlocks[id];
    
    if (!oldIds.has(id)) {
      // New block
      if (isAdvancedTableBlock(newBlock)) {
        // New table - track all rows individually
        const rows = extractTableRows(newBlock);
        for (const [rowId, row] of Object.entries(rows)) {
          tableRowChanges[`${id}:row:${rowId}`] = row;
        }
        tableMetaChanges[`${id}:meta`] = extractTableMetadata(newBlock);
        // Also include full block for compatibility
        changedBlocks[id] = newBlock;
      } else {
        changedBlocks[id] = newBlock;
      }
    } else {
      const oldBlock = oldBlocks[id];
      
      // Check if it's a table block
      if (isAdvancedTableBlock(newBlock) && isAdvancedTableBlock(oldBlock)) {
        // Check if row ORDER changed (e.g., after sorting)
        // If so, we need to send the full block to preserve order
        if (tableRowOrderChanged(oldBlock, newBlock)) {
          // Row order changed - send full block to preserve the new order
          changedBlocks[id] = newBlock;
          // Also track block order if it changed
          if ((oldBlock.meta?.order ?? 0) !== (newBlock.meta?.order ?? 0)) {
            orderOnlyChanges[id] = newBlock.meta?.order ?? 0;
          }
        } else {
          // Row order unchanged - extract row-level changes for granular sync
          const oldRows = extractTableRows(oldBlock);
          const newRows = extractTableRows(newBlock);
          
          const oldRowIds = new Set(Object.keys(oldRows));
          const newRowIds = new Set(Object.keys(newRows));
          let hasRowChanges = false;
          
          // Find added or modified rows
          for (const rowId of newRowIds) {
            if (!oldRowIds.has(rowId)) {
              // New row
              tableRowChanges[`${id}:row:${rowId}`] = newRows[rowId];
              hasRowChanges = true;
            } else if (!deepEqual(oldRows[rowId], newRows[rowId])) {
              // Modified row
              tableRowChanges[`${id}:row:${rowId}`] = newRows[rowId];
              hasRowChanges = true;
            }
          }
          
          // Find deleted rows
          for (const rowId of oldRowIds) {
            if (!newRowIds.has(rowId)) {
              deletedTableRows.push(`${id}:row:${rowId}`);
              hasRowChanges = true;
            }
          }
          
          // Check if metadata changed
          if (!tableMetadataEquals(oldBlock, newBlock)) {
            tableMetaChanges[`${id}:meta`] = extractTableMetadata(newBlock);
            hasRowChanges = true;
          }
          
          // Track block order changes if any
          if (hasRowChanges || (oldBlock.meta?.order ?? 0) !== (newBlock.meta?.order ?? 0)) {
            if ((oldBlock.meta?.order ?? 0) !== (newBlock.meta?.order ?? 0)) {
              orderOnlyChanges[id] = newBlock.meta?.order ?? 0;
            }
          }
        }
      } else {
        // Non-table block - standard comparison.
        // __rowLayout is metadata (not a Yoopta block), so blockContentEquals
        // would always return true since it only checks .id/.type/.value.
        // Use full JSON comparison for non-block entries.
        const isMetadataKey = !newBlock || typeof (newBlock as any).type !== 'string';
        if (isMetadataKey) {
          if (JSON.stringify(oldBlock) !== JSON.stringify(newBlock)) {
            changedBlocks[id] = newBlock;
          }
        } else if (!blockContentEquals(oldBlock, newBlock)) {
          changedBlocks[id] = newBlock;
        } else if ((oldBlock.meta?.order ?? 0) !== (newBlock.meta?.order ?? 0)) {
          orderOnlyChanges[id] = newBlock.meta?.order ?? 0;
        }
      }
    }
  }
  
  // Find deleted blocks
  for (const id of oldIds) {
    if (!newIds.has(id) && !isGranularKey(id)) {
      const oldBlock = oldBlocks[id];
      
      if (isAdvancedTableBlock(oldBlock)) {
        // Table deleted - track all rows as deleted
        const rows = extractTableRows(oldBlock);
        for (const rowId of Object.keys(rows)) {
          deletedTableRows.push(`${id}:row:${rowId}`);
        }
      }
      
      deletedBlockIds.push(id);
    }
  }
  
  const result: ReturnType<typeof extractChangedBlocks> = { 
    blocks: changedBlocks, 
    deleted: deletedBlockIds, 
    orderOnlyChanges 
  };
  
  // Only include table-specific fields if there are changes
  if (Object.keys(tableRowChanges).length > 0) {
    result.tableRowChanges = tableRowChanges;
  }
  if (deletedTableRows.length > 0) {
    result.deletedTableRows = deletedTableRows;
  }
  if (Object.keys(tableMetaChanges).length > 0) {
    result.tableMetaChanges = tableMetaChanges;
  }
  
  return result;
}

// ============================================================================
// TABLE CONTENT HELPERS
// ============================================================================

/**
 * Apply a row change to a table block within a content object.
 * Used when updating _lastSyncedContent after syncing granular row changes.
 */
export function applyTableRowToContent(
  content: Record<string, unknown>,
  tableId: string,
  rowId: string,
  rowData: unknown,
  fallbackContent?: string | null
): void {
  let tableBlock = content[tableId] as { type?: string; value?: unknown[] } | undefined;
  
  // If table doesn't exist, try to get from fallback
  if (!tableBlock && fallbackContent) {
    try {
      const parsed = JSON.parse(fallbackContent);
      if (parsed[tableId]) {
        content[tableId] = JSON.parse(JSON.stringify(parsed[tableId])); // Deep clone
        tableBlock = content[tableId] as { type?: string; value?: unknown[] };
      }
    } catch { /* ignore */ }
  }
  
  if (!tableBlock?.value || tableBlock.type !== 'AdvancedTable') return;
  
  const tableElement = tableBlock.value[0] as { type?: string; children?: unknown[] } | undefined;
  if (!tableElement || tableElement.type !== 'table') return;
  
  if (!tableElement.children) tableElement.children = [];
  
  const existingIdx = tableElement.children.findIndex((r: any) => r?.id === rowId);
  if (existingIdx >= 0) {
    tableElement.children[existingIdx] = rowData;
  } else {
    tableElement.children.push(rowData);
  }
}

/**
 * Apply a metadata change to a table block within a content object.
 */
export function applyTableMetaToContent(
  content: Record<string, unknown>,
  tableId: string,
  metaData: unknown,
  fallbackContent?: string | null
): void {
  let tableBlock = content[tableId] as { type?: string; value?: unknown[] } | undefined;
  
  if (!tableBlock && fallbackContent) {
    try {
      const parsed = JSON.parse(fallbackContent);
      if (parsed[tableId]) {
        content[tableId] = JSON.parse(JSON.stringify(parsed[tableId]));
        tableBlock = content[tableId] as { type?: string; value?: unknown[] };
      }
    } catch { /* ignore */ }
  }
  
  if (!tableBlock?.value || tableBlock.type !== 'AdvancedTable') return;
  
  const tableElement = tableBlock.value[0] as { type?: string; props?: unknown } | undefined;
  if (!tableElement || tableElement.type !== 'table') return;
  
  tableElement.props = metaData;
}

/**
 * Delete a row from a table block within a content object.
 */
export function deleteTableRowFromContent(
  content: Record<string, unknown>,
  tableId: string,
  rowId: string
): void {
  const tableBlock = content[tableId] as { type?: string; value?: unknown[] } | undefined;
  if (!tableBlock?.value || tableBlock.type !== 'AdvancedTable') return;
  
  const tableElement = tableBlock.value[0] as { type?: string; children?: unknown[] } | undefined;
  if (!tableElement?.children || tableElement.type !== 'table') return;
  
  tableElement.children = tableElement.children.filter((r: any) => r?.id !== rowId);
}

/**
 * Parse a granular table key into its components.
 * Returns null if not a granular key.
 */
export function parseGranularKey(key: string): { tableId: string; type: 'row' | 'meta'; rowId?: string } | null {
  if (key.includes(':row:')) {
    const [tableId, , rowId] = key.split(':');
    return { tableId, type: 'row', rowId };
  }
  if (key.endsWith(':meta')) {
    return { tableId: key.replace(':meta', ''), type: 'meta' };
  }
  return null;
}

// ============================================================================
// METADATA FIELDS
// ============================================================================

/**
 * Import PAGE_CRDT_FIELDS from crdt.ts as the single source of truth.
 * These are the metadata fields that can be updated separately from content.
 * 
 * Note: We add server-computed metadata fields here so metadata fetches and
 * non-editor views receive them even when content is omitted.
 */
import { PAGE_CRDT_FIELDS } from '../crdt';

export const PAGE_METADATA_FIELDS = [
  ...PAGE_CRDT_FIELDS,
  'excerpt', // Computed field, not in CRDT tracking
] as const;

// Backward compatibility alias
export const NOTE_METADATA_FIELDS = PAGE_METADATA_FIELDS;

// ============================================================================
// METADATA STRIPPING
// ============================================================================

/**
 * Strip CRDT/sync metadata from offline records.
 */
export function stripSyncMetadata<T extends { 
  _syncStatus?: unknown; 
  _hlc?: unknown; 
  _fieldHLCs?: unknown; 
  _serverVersion?: unknown; 
  _blockHLCs?: unknown; 
  _deletedBlocks?: unknown; 
  _hasContent?: unknown; 
  _contentFetchedAt?: unknown; 
  _lastSyncedContent?: unknown 
}>(records: T[]): Omit<T, '_syncStatus' | '_hlc' | '_fieldHLCs' | '_serverVersion' | '_blockHLCs' | '_deletedBlocks' | '_hasContent' | '_contentFetchedAt' | '_lastSyncedContent'>[] {
  return records.map(({ 
    _syncStatus, 
    _hlc, 
    _fieldHLCs, 
    _serverVersion, 
    _blockHLCs, 
    _deletedBlocks, 
    _hasContent, 
    _contentFetchedAt, 
    _lastSyncedContent, 
    ...rest 
  }) => rest);
}

/**
 * Strip CRDT/sync metadata from a single offline page.
 */
export function stripPageMetadata(page: OfflinePage): Omit<OfflinePage, '_syncStatus' | '_hlc' | '_fieldHLCs' | '_serverVersion' | '_blockHLCs' | '_deletedBlocks' | '_hasContent' | '_contentFetchedAt' | '_lastSyncedContent'> {
  const { 
    _syncStatus, 
    _hlc, 
    _fieldHLCs, 
    _serverVersion, 
    _blockHLCs, 
    _deletedBlocks, 
    _hasContent, 
    _contentFetchedAt, 
    _lastSyncedContent, 
    ...clean 
  } = page;
  return clean;
}

// Backward compatibility alias
export const stripNoteMetadata = stripPageMetadata;

// ============================================================================
// TABLE SYNC HELPERS
// ============================================================================

/**
 * Apply a granular row change to a table block.
 */
export function applyRowToTable(tableBlock: YooptaBlock, rowId: string, rowData: any): void {
  const tableElement = (tableBlock.value as any[])?.[0];
  if (!tableElement || tableElement.type !== 'table') return;
  
  if (!tableElement.children) tableElement.children = [];
  
  const existingIndex = tableElement.children.findIndex((c: any) => c.id === rowId);
  if (existingIndex >= 0) {
    tableElement.children[existingIndex] = rowData;
  } else {
    tableElement.children.push(rowData);
  }
}

/**
 * Remove a row from a table block.
 */
export function removeRowFromTable(tableBlock: YooptaBlock, rowId: string): void {
  const tableElement = (tableBlock.value as any[])?.[0];
  if (!tableElement || tableElement.type !== 'table' || !tableElement.children) return;
  
  tableElement.children = tableElement.children.filter((c: any) => c.id !== rowId);
}

/**
 * Apply granular metadata change to a table block.
 */
export function applyMetaToTable(tableBlock: YooptaBlock, metaData: any): void {
  const tableElement = (tableBlock.value as any[])?.[0];
  if (!tableElement || tableElement.type !== 'table') return;
  
  tableElement.props = metaData;
}

// ============================================================================
// BLOCK HLC UTILITIES
// ============================================================================

/**
 * Create block HLCs for all blocks in content.
 */
export function createBlockHLCs(
  content: string | null,
  hlc: HLCTimestamp
): Record<string, HLCTimestamp> {
  const blockIds = extractBlockIds(content);
  const blockHLCs: Record<string, HLCTimestamp> = {};
  for (const blockId of blockIds) {
    blockHLCs[blockId] = hlc;
  }
  return blockHLCs;
}
