/**
 * @file useEditorRowLayout.ts
 * @description Manages column-based layout for Yoopta editor blocks.
 *              Supports Notion-style columns: each column group has N columns,
 *              and each column can contain multiple vertically-stacked blocks.
 * @app PAGES - Enables Notion-style column layout for any block type
 *
 * Data model (stored under `__rowLayout` key):
 *   blocks: { [blockId]: { groupId, columnIndex, orderInColumn } }
 *   groups: { [groupId]: { columnCount, columnWidths } }
 *
 * Used by:
 * - PageEditor.tsx
 */
import { useState, useCallback, useMemo, useRef } from 'react';
import type { YooEditor } from '@yoopta/editor';

// ============================================================================
// TYPES
// ============================================================================

export interface ColumnBlockEntry {
  /** Shared ID grouping blocks in the same column layout */
  groupId: string;
  /** Which column (0 = leftmost) */
  columnIndex: number;
  /** Vertical position within the column (0 = top) */
  orderInColumn: number;
}

export interface ColumnGroupMeta {
  columnCount: number;
  /** Fractional widths per column, e.g. [0.5, 0.5] */
  columnWidths: number[];
}

export interface ColumnsMetadata {
  blocks: Record<string, ColumnBlockEntry>;
  groups: Record<string, ColumnGroupMeta>;
}

export interface GridPosition {
  gridRow: number;
  gridColumn: string;
  /** Which group this block belongs to (null if not in a column) */
  groupId: string | null;
  /** True for the last block in content order within a group — renders the flex container */
  isGroupAnchor: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const ROW_LAYOUT_KEY = '__rowLayout';
export const MAX_COLUMNS = 4;

// ============================================================================
// HELPERS (pure, exported for tests)
// ============================================================================

const EMPTY_META: ColumnsMetadata = { blocks: {}, groups: {} };

/** Extract __rowLayout from a parsed content object */
export function extractRowLayout(content: unknown): ColumnsMetadata {
  if (!content || typeof content !== 'object') return EMPTY_META;
  const raw = (content as Record<string, unknown>)[ROW_LAYOUT_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return EMPTY_META;
  const r = raw as Record<string, unknown>;
  // Support new format with blocks+groups
  if (r.blocks && r.groups) return raw as ColumnsMetadata;
  // Migrate old format: { [blockId]: { rowId, width, order } }
  return migrateOldFormat(raw as Record<string, { rowId: string; width: number; order: number }>);
}

/** Migrate old RowLayoutMap → ColumnsMetadata */
function migrateOldFormat(old: Record<string, { rowId: string; width: number; order: number }>): ColumnsMetadata {
  const blocks: Record<string, ColumnBlockEntry> = {};
  const groups: Record<string, ColumnGroupMeta> = {};
  const groupCols = new Map<string, number>();

  for (const [blockId, entry] of Object.entries(old)) {
    if (!entry || !entry.rowId) continue;
    blocks[blockId] = { groupId: entry.rowId, columnIndex: entry.order, orderInColumn: 0 };
    groupCols.set(entry.rowId, Math.max(groupCols.get(entry.rowId) ?? 0, entry.order + 1));
  }
  for (const [groupId, colCount] of groupCols) {
    const w = +(1 / colCount).toFixed(4);
    groups[groupId] = { columnCount: colCount, columnWidths: Array(colCount).fill(w) };
  }
  return { blocks, groups };
}

/** Merge ColumnsMetadata back into content JSON (returns a new object) */
export function injectRowLayout(
  content: Record<string, unknown>,
  meta: ColumnsMetadata,
): Record<string, unknown> {
  const result = { ...content };
  if (Object.keys(meta.blocks).length === 0) {
    delete result[ROW_LAYOUT_KEY];
  } else {
    result[ROW_LAYOUT_KEY] = meta;
  }
  return result;
}

/**
 * Compute CSS grid positions for all blocks given the column layout.
 *
 * Each column group occupies ONE grid row. The last block in content order
 * within a group is marked as the "anchor" — its renderBlock constructs a
 * flex container that holds all column blocks, achieving true independent
 * vertical stacking (not table-like row alignment).
 */
export function computeGridPositions(
  sortedBlockIds: string[],
  meta: ColumnsMetadata,
): Map<string, GridPosition> {
  const positions = new Map<string, GridPosition>();
  const processed = new Set<string>();
  let gridRow = 1;

  // Pre-build groupId → blockIds[] (in content order) to avoid O(n²) filter-per-group
  const groupBlockMap = new Map<string, string[]>();
  for (const id of sortedBlockIds) {
    const gid = meta.blocks[id]?.groupId;
    if (gid && meta.groups[gid]) {
      let arr = groupBlockMap.get(gid);
      if (!arr) { arr = []; groupBlockMap.set(gid, arr); }
      arr.push(id);
    }
  }

  for (const blockId of sortedBlockIds) {
    if (processed.has(blockId)) continue;

    const entry = meta.blocks[blockId];
    const groupId = entry?.groupId;
    const groupBlockIds = groupId ? groupBlockMap.get(groupId) : undefined;

    if (!groupBlockIds) {
      positions.set(blockId, { gridRow, gridColumn: '1 / -1', groupId: null, isGroupAnchor: false });
      gridRow++;
      continue;
    }

    const anchorId = groupBlockIds[groupBlockIds.length - 1];
    for (const id of groupBlockIds) {
      positions.set(id, {
        gridRow,
        gridColumn: '1 / -1',
        groupId: groupId!,
        isGroupAnchor: id === anchorId,
      });
      processed.add(id);
    }

    gridRow++;
  }

  return positions;
}

/** Get all blocks in a group organized by column, sorted by orderInColumn */
export function getGroupColumns(
  meta: ColumnsMetadata,
  groupId: string,
): Map<number, string[]> {
  const columns = new Map<number, string[]>();
  for (const [blockId, entry] of Object.entries(meta.blocks)) {
    if (entry.groupId === groupId) {
      if (!columns.has(entry.columnIndex)) columns.set(entry.columnIndex, []);
      columns.get(entry.columnIndex)!.push(blockId);
    }
  }
  for (const [, ids] of columns) {
    ids.sort((a, b) => meta.blocks[a].orderInColumn - meta.blocks[b].orderInColumn);
  }
  return columns;
}

/** Generate a short random ID */
function makeGroupId(): string {
  return 'cg-' + Math.random().toString(36).slice(2, 8);
}

// ============================================================================
// HOOK
// ============================================================================

export function useEditorRowLayout(editor: YooEditor) {
  const [colMeta, setColMeta] = useState<ColumnsMetadata>(EMPTY_META);
  const colMetaRef = useRef<ColumnsMetadata>(EMPTY_META);

  const updateMeta = useCallback((next: ColumnsMetadata) => {
    colMetaRef.current = next;
    setColMeta(next);
  }, []);

  /** Initialize from parsed content */
  const initFromContent = useCallback((content: unknown) => {
    updateMeta(extractRowLayout(content));
  }, [updateMeta]);

  /**
   * Create a new column group by placing two blocks side-by-side.
   * draggedBlock goes to targetBlock's left or right as a NEW column.
   * Returns false if the group is already at MAX_COLUMNS.
   */
  const addToRow = useCallback(
    (draggedBlockId: string, targetBlockId: string, side: 'left' | 'right'): boolean => {
      const prev = colMetaRef.current;
      const next: ColumnsMetadata = {
        blocks: { ...prev.blocks },
        groups: { ...prev.groups },
      };

      const targetEntry = next.blocks[targetBlockId];
      const draggedEntry = next.blocks[draggedBlockId];

      // Same block already in same group? Do nothing.
      if (draggedEntry && targetEntry && draggedEntry.groupId === targetEntry.groupId) return true;

      // Remove dragged from old group
      if (draggedEntry) {
        removeBlockFromGroup(next, draggedBlockId);
      }

      // Move dragged block adjacent in content order
      const targetBlock = editor.children[targetBlockId];
      if (targetBlock) {
        const dest = side === 'left' ? targetBlock.meta.order : targetBlock.meta.order + 1;
        editor.moveBlock(draggedBlockId, dest);
      }

      if (targetEntry) {
        // Target is in an existing group → add a new column
        const groupId = targetEntry.groupId;
        const group = next.groups[groupId];
        if (!group || group.columnCount >= MAX_COLUMNS) return false;

        const targetCol = targetEntry.columnIndex;
        const insertCol = side === 'left' ? targetCol : targetCol + 1;

        // Shift column indices for columns at or after insertCol
        for (const [id, e] of Object.entries(next.blocks)) {
          if (e.groupId === groupId && e.columnIndex >= insertCol) {
            next.blocks[id] = { ...e, columnIndex: e.columnIndex + 1 };
          }
        }

        // Insert the block
        next.blocks[draggedBlockId] = { groupId, columnIndex: insertCol, orderInColumn: 0 };

        // Update group
        const newWidths = [...group.columnWidths];
        const equalW = +(1 / (group.columnCount + 1)).toFixed(4);
        newWidths.splice(insertCol, 0, equalW);
        // Re-equalize widths
        const rebalanced = newWidths.map(() => equalW);
        next.groups[groupId] = { columnCount: group.columnCount + 1, columnWidths: rebalanced };
      } else {
        // Target is standalone → create new 2-column group
        const groupId = makeGroupId();
        const [leftId, rightId] =
          side === 'left' ? [draggedBlockId, targetBlockId] : [targetBlockId, draggedBlockId];

        next.blocks[leftId] = { groupId, columnIndex: 0, orderInColumn: 0 };
        next.blocks[rightId] = { groupId, columnIndex: 1, orderInColumn: 0 };
        next.groups[groupId] = { columnCount: 2, columnWidths: [0.5, 0.5] };
      }

      updateMeta(next);
      return true;
    },
    [editor, updateMeta],
  );

  /**
   * Add a block to an existing column (vertical stacking).
   * Used for Enter key propagation and dropping within a column.
   */
  /**
   * Add a block to an existing column (vertical stacking).
   * Placement: beforeBlockId → insert above it, afterBlockId → insert below it,
   * neither → append at end.
   */
  const addBlockToColumn = useCallback(
    (blockId: string, groupId: string, columnIndex: number, opts?: { afterBlockId?: string; beforeBlockId?: string }) => {
      const prev = colMetaRef.current;
      const next: ColumnsMetadata = {
        blocks: { ...prev.blocks },
        groups: { ...prev.groups },
      };

      if (next.blocks[blockId]) removeBlockFromGroup(next, blockId);

      const columnBlocks = Object.entries(next.blocks)
        .filter(([, e]) => e.groupId === groupId && e.columnIndex === columnIndex)
        .sort(([, a], [, b]) => a.orderInColumn - b.orderInColumn);

      let insertOrder = columnBlocks.length; // default: append at end

      if (opts?.beforeBlockId) {
        const be = next.blocks[opts.beforeBlockId];
        if (be && be.groupId === groupId && be.columnIndex === columnIndex) {
          insertOrder = be.orderInColumn;
        } else {
          insertOrder = 0;
        }
      } else if (opts?.afterBlockId) {
        const ae = next.blocks[opts.afterBlockId];
        if (ae && ae.groupId === groupId && ae.columnIndex === columnIndex) {
          insertOrder = ae.orderInColumn + 1;
        }
      }

      // Shift existing blocks at or after insertOrder down
      for (const [id, e] of columnBlocks) {
        if (e.orderInColumn >= insertOrder) {
          next.blocks[id] = { ...e, orderInColumn: e.orderInColumn + 1 };
        }
      }

      next.blocks[blockId] = { groupId, columnIndex, orderInColumn: insertOrder };
      updateMeta(next);
    },
    [updateMeta],
  );

  /** Remove a block from its group */
  const removeFromRow = useCallback(
    (blockId: string) => {
      const prev = colMetaRef.current;
      if (!prev.blocks[blockId]) return;
      const next: ColumnsMetadata = {
        blocks: { ...prev.blocks },
        groups: { ...prev.groups },
      };
      removeBlockFromGroup(next, blockId);
      updateMeta(next);
    },
    [updateMeta],
  );

  /**
   * Resize columns in a group by updating fractional widths.
   * @param groupId - The group to resize
   * @param columnWidths - New fractional widths array (must sum to ~1)
   */
  const resizeColumns = useCallback(
    (groupId: string, columnWidths: number[]) => {
      const prev = colMetaRef.current;
      const group = prev.groups[groupId];
      if (!group || columnWidths.length !== group.columnCount) return;
      const next: ColumnsMetadata = {
        blocks: { ...prev.blocks },
        groups: {
          ...prev.groups,
          [groupId]: { ...group, columnWidths },
        },
      };
      updateMeta(next);
    },
    [updateMeta],
  );

  /** Compute grid positions */
  const gridPositions = useMemo(() => {
    const sortedIds = Object.keys(editor.children).sort(
      (a, b) => editor.children[a].meta.order - editor.children[b].meta.order,
    );
    return computeGridPositions(sortedIds, colMeta);
  }, [editor.children, colMeta]);

  // === Block-ID tracking for column auto-join / deletion ===
  const prevBlockIdsRef = useRef<Set<string>>(new Set());
  const skipAutoJoinRef = useRef(false);

  /**
   * Restore column layout and block-ID tracking from raw draft content.
   * Centralizes the repeated parse → initFromContent → prevBlockIds pattern
   * used across mount, hydration, and remote-sync paths.
   */
  const restoreLayoutFromDraft = useCallback((draftContent: string | Record<string, unknown>) => {
    try {
      const raw = typeof draftContent === 'string' ? JSON.parse(draftContent) : draftContent;
      updateMeta(extractRowLayout(raw));
      const blockIds = Object.keys(raw).filter((k: string) => k !== ROW_LAYOUT_KEY);
      prevBlockIdsRef.current = new Set(blockIds);
    } catch { /* ignore parse errors */ }
  }, [updateMeta]);

  /**
   * Call from the editor's onChange handler. Detects new/deleted blocks and
   * auto-propagates column membership (Enter-key creates a block in the same
   * column as the predecessor).
   */
  const trackBlockChanges = useCallback((newValue: Record<string, unknown>) => {
    const newIds = Object.keys(newValue).filter((k) => k !== ROW_LAYOUT_KEY);
    const prevIds = prevBlockIdsRef.current;

    if (prevIds.size > 0) {
      const deleted = [...prevIds].filter((id) => !newValue[id]);
      const fresh = newIds.filter((id) => !prevIds.has(id));

      // Detect block REPLACEMENT (1 delete + 1 add): e.g. "Turn Into" changes
      // the block type, which may delete the old block and create a new one.
      // Transfer column membership BEFORE the removal to prevent group dissolution.
      const replacedIds = new Set<string>();
      if (deleted.length === 1 && fresh.length === 1) {
        const oldId = deleted[0];
        const newId = fresh[0];
        const oldEntry = colMetaRef.current.blocks[oldId];
        if (oldEntry) {
          // Transfer: add new ID at the same position, then remove old ID.
          // Using updateMeta directly to avoid the group-dissolution side-effect
          // of removeFromRow when the column only had one block.
          const prev = colMetaRef.current;
          const next: ColumnsMetadata = {
            blocks: { ...prev.blocks },
            groups: { ...prev.groups },
          };
          next.blocks[newId] = { ...oldEntry };
          delete next.blocks[oldId];
          updateMeta(next);
          replacedIds.add(oldId);
          replacedIds.add(newId);
        }
      }

      // Detect deleted blocks → remove from column layout (skip replaced ones)
      for (const id of deleted) {
        if (!replacedIds.has(id)) removeFromRow(id);
      }

      // Detect single new block → auto-join if prior block is in a column
      // (skip if the new block was already handled as a replacement)
      if (fresh.length === 1 && !skipAutoJoinRef.current && !replacedIds.has(fresh[0])) {
        const newBlockId = fresh[0];
        const meta = (newValue[newBlockId] as any)?.meta;
        if (meta?.order != null) {
          const sorted = newIds
            .map((id) => ({ id, order: ((newValue[id] as any)?.meta?.order ?? 0) as number }))
            .sort((a, b) => a.order - b.order);
          const idx = sorted.findIndex((s) => s.id === newBlockId);
          if (idx > 0) {
            const prevBlockId = sorted[idx - 1].id;
            const prevEntry = colMetaRef.current.blocks[prevBlockId];
            if (prevEntry) {
              addBlockToColumn(newBlockId, prevEntry.groupId, prevEntry.columnIndex, { afterBlockId: prevBlockId });
            }
          }
        }
      }
      skipAutoJoinRef.current = false;
    }
    prevBlockIdsRef.current = new Set(newIds);
  }, [colMetaRef, addBlockToColumn, removeFromRow, updateMeta]);

  return {
    colMeta,
    colMetaRef,
    gridPositions,
    initFromContent,
    addToRow,
    addBlockToColumn,
    removeFromRow,
    resizeColumns,
    // Block-tracking helpers (used by PageEditor)
    prevBlockIdsRef,
    skipAutoJoinRef,
    restoreLayoutFromDraft,
    trackBlockChanges,
  };
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Remove a block from its group; collapse column if empty, dissolve group
 * if only 1 column remains.
 */
function removeBlockFromGroup(meta: ColumnsMetadata, blockId: string): void {
  const entry = meta.blocks[blockId];
  if (!entry) return;

  const { groupId, columnIndex } = entry;
  delete meta.blocks[blockId];

  // Check if the column is now empty
  const colHasBlocks = Object.values(meta.blocks).some(
    (e) => e.groupId === groupId && e.columnIndex === columnIndex,
  );

  if (!colHasBlocks) {
    const group = meta.groups[groupId];
    if (!group) return;

    // Remove this column: shift higher columns down
    for (const [id, e] of Object.entries(meta.blocks)) {
      if (e.groupId === groupId && e.columnIndex > columnIndex) {
        meta.blocks[id] = { ...e, columnIndex: e.columnIndex - 1 };
      }
    }
    const newWidths = [...group.columnWidths];
    newWidths.splice(columnIndex, 1);
    const newCount = group.columnCount - 1;

    if (newCount <= 1) {
      // Group dissolves — remaining blocks become standalone
      for (const id of Object.keys(meta.blocks)) {
        if (meta.blocks[id].groupId === groupId) {
          delete meta.blocks[id];
        }
      }
      delete meta.groups[groupId];
    } else {
      const equalW = +(1 / newCount).toFixed(4);
      meta.groups[groupId] = {
        columnCount: newCount,
        columnWidths: Array(newCount).fill(equalW),
      };
    }
  }

  // Re-number orderInColumn for the remaining blocks in the old column
  const remaining = Object.entries(meta.blocks)
    .filter(([, e]) => e.groupId === groupId && e.columnIndex === columnIndex)
    .sort(([, a], [, b]) => a.orderInColumn - b.orderInColumn);
  remaining.forEach(([id], i) => {
    meta.blocks[id] = { ...meta.blocks[id], orderInColumn: i };
  });
}
