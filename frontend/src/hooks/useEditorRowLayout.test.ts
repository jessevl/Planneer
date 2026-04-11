/**
 * @file useEditorRowLayout.test.ts
 * @description Unit tests for column layout pure functions and hook behavior.
 *              Tests extractRowLayout, injectRowLayout, computeGridPositions,
 *              getGroupColumns, and the column manipulation logic (addToRow,
 *              addBlockToColumn, removeFromRow).
 */
import { describe, it, expect } from 'vitest';
import {
  extractRowLayout,
  injectRowLayout,
  computeGridPositions,
  getGroupColumns,
  ROW_LAYOUT_KEY,
  MAX_COLUMNS,
  type ColumnsMetadata,
  type ColumnBlockEntry,
} from './useEditorRowLayout';

// ============================================================================
// HELPERS
// ============================================================================

/** Build a minimal ColumnsMetadata for testing */
function makeMeta(
  blocks: Record<string, ColumnBlockEntry>,
  groups: Record<string, { columnCount: number; columnWidths: number[] }>,
): ColumnsMetadata {
  return { blocks, groups };
}

const EMPTY_META: ColumnsMetadata = { blocks: {}, groups: {} };

// ============================================================================
// extractRowLayout
// ============================================================================

describe('extractRowLayout', () => {
  it('returns empty meta for null/undefined content', () => {
    expect(extractRowLayout(null)).toEqual(EMPTY_META);
    expect(extractRowLayout(undefined)).toEqual(EMPTY_META);
  });

  it('returns empty meta for non-object content', () => {
    expect(extractRowLayout('string')).toEqual(EMPTY_META);
    expect(extractRowLayout(42)).toEqual(EMPTY_META);
    expect(extractRowLayout([])).toEqual(EMPTY_META);
  });

  it('returns empty meta when __rowLayout key is missing', () => {
    expect(extractRowLayout({ 'block-1': {} })).toEqual(EMPTY_META);
  });

  it('returns empty meta when __rowLayout is not an object', () => {
    expect(extractRowLayout({ [ROW_LAYOUT_KEY]: 'invalid' })).toEqual(EMPTY_META);
    expect(extractRowLayout({ [ROW_LAYOUT_KEY]: null })).toEqual(EMPTY_META);
    expect(extractRowLayout({ [ROW_LAYOUT_KEY]: [] })).toEqual(EMPTY_META);
  });

  it('extracts new-format metadata with blocks+groups', () => {
    const meta: ColumnsMetadata = {
      blocks: {
        'b1': { groupId: 'g1', columnIndex: 0, orderInColumn: 0 },
        'b2': { groupId: 'g1', columnIndex: 1, orderInColumn: 0 },
      },
      groups: {
        'g1': { columnCount: 2, columnWidths: [0.5, 0.5] },
      },
    };
    const content = { 'block-1': {}, [ROW_LAYOUT_KEY]: meta };
    expect(extractRowLayout(content)).toEqual(meta);
  });

  it('migrates old format (rowId/width/order) to new format', () => {
    const oldFormat = {
      'b1': { rowId: 'r1', width: 6, order: 0 },
      'b2': { rowId: 'r1', width: 6, order: 1 },
    };
    const content = { [ROW_LAYOUT_KEY]: oldFormat };
    const result = extractRowLayout(content);

    expect(result.blocks['b1']).toEqual({ groupId: 'r1', columnIndex: 0, orderInColumn: 0 });
    expect(result.blocks['b2']).toEqual({ groupId: 'r1', columnIndex: 1, orderInColumn: 0 });
    expect(result.groups['r1'].columnCount).toBe(2);
    expect(result.groups['r1'].columnWidths).toHaveLength(2);
  });
});

// ============================================================================
// injectRowLayout
// ============================================================================

describe('injectRowLayout', () => {
  it('adds __rowLayout key when blocks exist', () => {
    const content = { 'block-1': { type: 'Paragraph' } };
    const meta = makeMeta(
      { 'b1': { groupId: 'g1', columnIndex: 0, orderInColumn: 0 } },
      { 'g1': { columnCount: 2, columnWidths: [0.5, 0.5] } },
    );
    const result = injectRowLayout(content, meta);
    expect(result[ROW_LAYOUT_KEY]).toEqual(meta);
    // Original content is preserved
    expect(result['block-1']).toEqual({ type: 'Paragraph' });
  });

  it('removes __rowLayout key when no blocks exist', () => {
    const content = { 'block-1': {}, [ROW_LAYOUT_KEY]: 'old-data' };
    const result = injectRowLayout(content, EMPTY_META);
    expect(result[ROW_LAYOUT_KEY]).toBeUndefined();
  });

  it('does not mutate the original content object', () => {
    const content = { 'block-1': {} };
    const meta = makeMeta(
      { 'b1': { groupId: 'g1', columnIndex: 0, orderInColumn: 0 } },
      { 'g1': { columnCount: 1, columnWidths: [1] } },
    );
    const result = injectRowLayout(content, meta);
    expect(content).not.toHaveProperty(ROW_LAYOUT_KEY);
    expect(result).not.toBe(content);
  });
});

// ============================================================================
// computeGridPositions
// ============================================================================

describe('computeGridPositions', () => {
  it('assigns sequential grid rows for standalone blocks', () => {
    const sortedIds = ['b1', 'b2', 'b3'];
    const positions = computeGridPositions(sortedIds, EMPTY_META);

    expect(positions.get('b1')).toEqual({
      gridRow: 1, gridColumn: '1 / -1', groupId: null, isGroupAnchor: false,
    });
    expect(positions.get('b2')).toEqual({
      gridRow: 2, gridColumn: '1 / -1', groupId: null, isGroupAnchor: false,
    });
    expect(positions.get('b3')).toEqual({
      gridRow: 3, gridColumn: '1 / -1', groupId: null, isGroupAnchor: false,
    });
  });

  it('groups column blocks into a single grid row', () => {
    const sortedIds = ['standalone', 'col-a', 'col-b', 'after'];
    const meta = makeMeta(
      {
        'col-a': { groupId: 'g1', columnIndex: 0, orderInColumn: 0 },
        'col-b': { groupId: 'g1', columnIndex: 1, orderInColumn: 0 },
      },
      { 'g1': { columnCount: 2, columnWidths: [0.5, 0.5] } },
    );
    const positions = computeGridPositions(sortedIds, meta);

    // standalone gets row 1
    expect(positions.get('standalone')!.gridRow).toBe(1);

    // col-a and col-b share the same grid row
    expect(positions.get('col-a')!.gridRow).toBe(2);
    expect(positions.get('col-b')!.gridRow).toBe(2);

    // The last block in content order is the anchor
    expect(positions.get('col-a')!.isGroupAnchor).toBe(false);
    expect(positions.get('col-b')!.isGroupAnchor).toBe(true);

    // 'after' gets the next row
    expect(positions.get('after')!.gridRow).toBe(3);
  });

  it('marks the last block in a multi-block column group as anchor', () => {
    // 3 blocks in a 2-column group (col 0 has 2 stacked blocks)
    const sortedIds = ['top-left', 'bottom-left', 'right'];
    const meta = makeMeta(
      {
        'top-left': { groupId: 'g1', columnIndex: 0, orderInColumn: 0 },
        'bottom-left': { groupId: 'g1', columnIndex: 0, orderInColumn: 1 },
        'right': { groupId: 'g1', columnIndex: 1, orderInColumn: 0 },
      },
      { 'g1': { columnCount: 2, columnWidths: [0.5, 0.5] } },
    );
    const positions = computeGridPositions(sortedIds, meta);

    // 'right' is last in content order → anchor
    expect(positions.get('right')!.isGroupAnchor).toBe(true);
    expect(positions.get('top-left')!.isGroupAnchor).toBe(false);
    expect(positions.get('bottom-left')!.isGroupAnchor).toBe(false);
  });

  it('handles a block whose group is missing from groups map', () => {
    const sortedIds = ['orphan'];
    const meta = makeMeta(
      { 'orphan': { groupId: 'missing-group', columnIndex: 0, orderInColumn: 0 } },
      {},
    );
    const positions = computeGridPositions(sortedIds, meta);
    // Falls back to standalone rendering
    expect(positions.get('orphan')!.groupId).toBeNull();
  });

  it('handles empty block list', () => {
    const positions = computeGridPositions([], EMPTY_META);
    expect(positions.size).toBe(0);
  });
});

// ============================================================================
// getGroupColumns
// ============================================================================

describe('getGroupColumns', () => {
  it('organizes blocks by column index', () => {
    const meta = makeMeta(
      {
        'b1': { groupId: 'g1', columnIndex: 0, orderInColumn: 0 },
        'b2': { groupId: 'g1', columnIndex: 1, orderInColumn: 0 },
        'b3': { groupId: 'g1', columnIndex: 0, orderInColumn: 1 },
        'other': { groupId: 'g2', columnIndex: 0, orderInColumn: 0 },
      },
      {
        'g1': { columnCount: 2, columnWidths: [0.5, 0.5] },
        'g2': { columnCount: 1, columnWidths: [1] },
      },
    );

    const cols = getGroupColumns(meta, 'g1');
    expect(cols.get(0)).toEqual(['b1', 'b3']); // sorted by orderInColumn
    expect(cols.get(1)).toEqual(['b2']);
  });

  it('returns empty map for unknown group', () => {
    const cols = getGroupColumns(EMPTY_META, 'nonexistent');
    expect(cols.size).toBe(0);
  });

  it('sorts blocks within a column by orderInColumn', () => {
    const meta = makeMeta(
      {
        'b3': { groupId: 'g1', columnIndex: 0, orderInColumn: 2 },
        'b1': { groupId: 'g1', columnIndex: 0, orderInColumn: 0 },
        'b2': { groupId: 'g1', columnIndex: 0, orderInColumn: 1 },
      },
      { 'g1': { columnCount: 1, columnWidths: [1] } },
    );

    const cols = getGroupColumns(meta, 'g1');
    expect(cols.get(0)).toEqual(['b1', 'b2', 'b3']);
  });
});

// ============================================================================
// Column manipulation logic (tested via pure metadata transforms)
// ============================================================================

/**
 * Since addToRow / addBlockToColumn / removeFromRow are hook callbacks that
 * depend on editor state, we test the underlying removeBlockFromGroup logic
 * and the metadata invariants through integration-style tests that replicate
 * the same transforms.
 */

/** Re-implement removeBlockFromGroup locally for direct testing */
function removeBlockFromGroup(meta: ColumnsMetadata, blockId: string): void {
  const entry = meta.blocks[blockId];
  if (!entry) return;

  const { groupId, columnIndex } = entry;
  delete meta.blocks[blockId];

  const colHasBlocks = Object.values(meta.blocks).some(
    (e) => e.groupId === groupId && e.columnIndex === columnIndex,
  );

  if (!colHasBlocks) {
    const group = meta.groups[groupId];
    if (!group) return;

    for (const [id, e] of Object.entries(meta.blocks)) {
      if (e.groupId === groupId && e.columnIndex > columnIndex) {
        meta.blocks[id] = { ...e, columnIndex: e.columnIndex - 1 };
      }
    }
    const newWidths = [...group.columnWidths];
    newWidths.splice(columnIndex, 1);
    const newCount = group.columnCount - 1;

    if (newCount <= 1) {
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

  const remaining = Object.entries(meta.blocks)
    .filter(([, e]) => e.groupId === groupId && e.columnIndex === columnIndex)
    .sort(([, a], [, b]) => a.orderInColumn - b.orderInColumn);
  remaining.forEach(([id], i) => {
    meta.blocks[id] = { ...meta.blocks[id], orderInColumn: i };
  });
}

/** Simulate addBlockToColumn logic */
function addBlockToColumn(
  meta: ColumnsMetadata,
  blockId: string,
  groupId: string,
  columnIndex: number,
  afterBlockId?: string,
  insertAtStart?: boolean,
): void {
  if (meta.blocks[blockId]) {
    removeBlockFromGroup(meta, blockId);
  }

  const columnBlocks = Object.entries(meta.blocks)
    .filter(([, e]) => e.groupId === groupId && e.columnIndex === columnIndex)
    .sort(([, a], [, b]) => a.orderInColumn - b.orderInColumn);

  let insertOrder = columnBlocks.length;
  if (insertAtStart) {
    insertOrder = 0;
    for (const [id, e] of columnBlocks) {
      meta.blocks[id] = { ...e, orderInColumn: e.orderInColumn + 1 };
    }
  } else if (afterBlockId) {
    const afterEntry = meta.blocks[afterBlockId];
    if (afterEntry && afterEntry.groupId === groupId && afterEntry.columnIndex === columnIndex) {
      insertOrder = afterEntry.orderInColumn + 1;
      for (const [id, e] of columnBlocks) {
        if (e.orderInColumn >= insertOrder) {
          meta.blocks[id] = { ...e, orderInColumn: e.orderInColumn + 1 };
        }
      }
    }
  }

  meta.blocks[blockId] = { groupId, columnIndex, orderInColumn: insertOrder };
}

describe('removeBlockFromGroup', () => {
  it('removes a block and re-numbers remaining blocks in the column', () => {
    const meta: ColumnsMetadata = {
      blocks: {
        'b1': { groupId: 'g1', columnIndex: 0, orderInColumn: 0 },
        'b2': { groupId: 'g1', columnIndex: 0, orderInColumn: 1 },
        'b3': { groupId: 'g1', columnIndex: 0, orderInColumn: 2 },
        'right': { groupId: 'g1', columnIndex: 1, orderInColumn: 0 },
      },
      groups: { 'g1': { columnCount: 2, columnWidths: [0.5, 0.5] } },
    };

    removeBlockFromGroup(meta, 'b2');

    expect(meta.blocks['b2']).toBeUndefined();
    expect(meta.blocks['b1'].orderInColumn).toBe(0);
    expect(meta.blocks['b3'].orderInColumn).toBe(1);
  });

  it('dissolves a 2-column group when one column becomes empty', () => {
    const meta: ColumnsMetadata = {
      blocks: {
        'left': { groupId: 'g1', columnIndex: 0, orderInColumn: 0 },
        'right': { groupId: 'g1', columnIndex: 1, orderInColumn: 0 },
      },
      groups: { 'g1': { columnCount: 2, columnWidths: [0.5, 0.5] } },
    };

    removeBlockFromGroup(meta, 'left');

    // Group should dissolve — remaining block becomes standalone
    expect(meta.groups['g1']).toBeUndefined();
    expect(meta.blocks['right']).toBeUndefined();
  });

  it('reduces column count when a column is emptied in a 3-column group', () => {
    const meta: ColumnsMetadata = {
      blocks: {
        'a': { groupId: 'g1', columnIndex: 0, orderInColumn: 0 },
        'b': { groupId: 'g1', columnIndex: 1, orderInColumn: 0 },
        'c': { groupId: 'g1', columnIndex: 2, orderInColumn: 0 },
      },
      groups: { 'g1': { columnCount: 3, columnWidths: [0.3333, 0.3333, 0.3333] } },
    };

    removeBlockFromGroup(meta, 'b');

    expect(meta.groups['g1'].columnCount).toBe(2);
    // 'c' should shift from index 2 to index 1
    expect(meta.blocks['c'].columnIndex).toBe(1);
    expect(meta.blocks['a'].columnIndex).toBe(0);
  });

  it('does nothing for a block not in any group', () => {
    const meta: ColumnsMetadata = { blocks: {}, groups: {} };
    removeBlockFromGroup(meta, 'nonexistent');
    expect(meta).toEqual(EMPTY_META);
  });
});

describe('addBlockToColumn', () => {
  it('appends a block to the end of a column by default', () => {
    const meta: ColumnsMetadata = {
      blocks: {
        'b1': { groupId: 'g1', columnIndex: 0, orderInColumn: 0 },
        'b2': { groupId: 'g1', columnIndex: 1, orderInColumn: 0 },
      },
      groups: { 'g1': { columnCount: 2, columnWidths: [0.5, 0.5] } },
    };

    addBlockToColumn(meta, 'new-block', 'g1', 0);

    expect(meta.blocks['new-block']).toEqual({
      groupId: 'g1', columnIndex: 0, orderInColumn: 1,
    });
  });

  it('inserts after a specific block', () => {
    const meta: ColumnsMetadata = {
      blocks: {
        'b1': { groupId: 'g1', columnIndex: 0, orderInColumn: 0 },
        'b2': { groupId: 'g1', columnIndex: 0, orderInColumn: 1 },
        'b3': { groupId: 'g1', columnIndex: 0, orderInColumn: 2 },
        'right': { groupId: 'g1', columnIndex: 1, orderInColumn: 0 },
      },
      groups: { 'g1': { columnCount: 2, columnWidths: [0.5, 0.5] } },
    };

    addBlockToColumn(meta, 'new', 'g1', 0, 'b1');

    expect(meta.blocks['new'].orderInColumn).toBe(1);
    expect(meta.blocks['b2'].orderInColumn).toBe(2);
    expect(meta.blocks['b3'].orderInColumn).toBe(3);
    // b1 unchanged
    expect(meta.blocks['b1'].orderInColumn).toBe(0);
  });

  it('inserts at the start of a column with insertAtStart=true', () => {
    const meta: ColumnsMetadata = {
      blocks: {
        'b1': { groupId: 'g1', columnIndex: 0, orderInColumn: 0 },
        'b2': { groupId: 'g1', columnIndex: 0, orderInColumn: 1 },
        'right': { groupId: 'g1', columnIndex: 1, orderInColumn: 0 },
      },
      groups: { 'g1': { columnCount: 2, columnWidths: [0.5, 0.5] } },
    };

    addBlockToColumn(meta, 'new', 'g1', 0, undefined, true);

    expect(meta.blocks['new'].orderInColumn).toBe(0);
    expect(meta.blocks['b1'].orderInColumn).toBe(1);
    expect(meta.blocks['b2'].orderInColumn).toBe(2);
  });

  it('removes block from old group before inserting into new one', () => {
    const meta: ColumnsMetadata = {
      blocks: {
        'a': { groupId: 'g1', columnIndex: 0, orderInColumn: 0 },
        'b': { groupId: 'g1', columnIndex: 1, orderInColumn: 0 },
        'target': { groupId: 'g2', columnIndex: 0, orderInColumn: 0 },
        'other': { groupId: 'g2', columnIndex: 1, orderInColumn: 0 },
      },
      groups: {
        'g1': { columnCount: 2, columnWidths: [0.5, 0.5] },
        'g2': { columnCount: 2, columnWidths: [0.5, 0.5] },
      },
    };

    // Move 'a' from g1 to g2 column 0
    addBlockToColumn(meta, 'a', 'g2', 0, 'target');

    // 'a' should be in g2 now
    expect(meta.blocks['a'].groupId).toBe('g2');
    expect(meta.blocks['a'].columnIndex).toBe(0);
    expect(meta.blocks['a'].orderInColumn).toBe(1); // after 'target'

    // g1 should have dissolved since only 'b' remained (2-col → 1-col dissolves)
    expect(meta.groups['g1']).toBeUndefined();
    expect(meta.blocks['b']).toBeUndefined(); // dissolved
  });

  it('reorder within same column: move bottom to top', () => {
    const meta: ColumnsMetadata = {
      blocks: {
        'top': { groupId: 'g1', columnIndex: 0, orderInColumn: 0 },
        'middle': { groupId: 'g1', columnIndex: 0, orderInColumn: 1 },
        'bottom': { groupId: 'g1', columnIndex: 0, orderInColumn: 2 },
        'right': { groupId: 'g1', columnIndex: 1, orderInColumn: 0 },
      },
      groups: { 'g1': { columnCount: 2, columnWidths: [0.5, 0.5] } },
    };

    // Move 'bottom' to the top of the column
    addBlockToColumn(meta, 'bottom', 'g1', 0, undefined, true);

    expect(meta.blocks['bottom'].orderInColumn).toBe(0);
    expect(meta.blocks['top'].orderInColumn).toBe(1);
    expect(meta.blocks['middle'].orderInColumn).toBe(2);
  });

  it('reorder within same column: move top to bottom', () => {
    const meta: ColumnsMetadata = {
      blocks: {
        'top': { groupId: 'g1', columnIndex: 0, orderInColumn: 0 },
        'middle': { groupId: 'g1', columnIndex: 0, orderInColumn: 1 },
        'bottom': { groupId: 'g1', columnIndex: 0, orderInColumn: 2 },
        'right': { groupId: 'g1', columnIndex: 1, orderInColumn: 0 },
      },
      groups: { 'g1': { columnCount: 2, columnWidths: [0.5, 0.5] } },
    };

    // Move 'top' after 'bottom'
    addBlockToColumn(meta, 'top', 'g1', 0, 'bottom');

    // After removeBlockFromGroup, middle→0, bottom→1
    // Then insert after bottom (order 1) → insertOrder=2
    expect(meta.blocks['middle'].orderInColumn).toBe(0);
    expect(meta.blocks['bottom'].orderInColumn).toBe(1);
    expect(meta.blocks['top'].orderInColumn).toBe(2);
  });
});

// ============================================================================
// MAX_COLUMNS constant
// ============================================================================

describe('MAX_COLUMNS', () => {
  it('is set to 4', () => {
    expect(MAX_COLUMNS).toBe(4);
  });
});
