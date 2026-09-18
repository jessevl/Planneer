/**
 * @file commands.clipboard.test.ts
 * @description Tests for pasting and clearing ranges of cells in the advanced table
 */

import { describe, it, expect } from 'vitest';
import type { SlateEditor, YooEditor } from '@yoopta/editor';
import { createEditor, Editor, Transforms } from 'slate';

import { AdvancedTableCommands } from './commands';
import { withAdvancedTable } from './extensions/withAdvancedTable';
import type { AdvancedTableElement } from './types';
import type { ClipboardGrid } from './utils/clipboard';
import { EDITOR_TO_SELECTION } from './utils/weakMaps';

const BLOCK_ID = 'block';

function setup(rows = 3, columns = 3) {
  const table = AdvancedTableCommands.buildTableElements(null as unknown as YooEditor, { rows, columns });
  table.children.forEach((row: any, r) =>
    row.children.forEach((cell: any, c: number) => {
      cell.children = [{ text: `${r}${c}` }];
    })
  );

  const editor = { children: {}, blockEditorsMap: {} } as unknown as YooEditor;
  const slate = withAdvancedTable(createEditor() as unknown as SlateEditor, editor);
  slate.children = [table as any];
  (editor.blockEditorsMap as any)[BLOCK_ID] = slate;

  return { editor, slate };
}

const tableOf = (slate: SlateEditor) => slate.children[0] as unknown as AdvancedTableElement;

const texts = (slate: SlateEditor) =>
  (tableOf(slate).children as any[]).map((row) =>
    row.children.map((cell: any) => cell.children.map((t: any) => t.text).join(''))
  );

const grid = (rows: string[][], extra: Partial<ClipboardGrid> = {}): ClipboardGrid => ({
  cells: rows.map((row) => row.map((text) => ({ text }))),
  fromPlanneer: false,
  ...extra,
});

const rect = (top: number, left: number, bottom = top, right = left) => ({ tablePath: [0], top, left, bottom, right });

describe('pasteCells', () => {
  it('pastes a grid at the target cell', () => {
    const { editor, slate } = setup();
    AdvancedTableCommands.pasteCells(editor, BLOCK_ID, grid([['a', 'b'], ['c', 'd']]), rect(0, 1));
    expect(texts(slate)).toEqual([
      ['00', 'a', 'b'],
      ['10', 'c', 'd'],
      ['20', '21', '22'],
    ]);
  });

  it('adds rows and columns when the grid runs past the edge', () => {
    const { editor, slate } = setup();
    AdvancedTableCommands.pasteCells(editor, BLOCK_ID, grid([['a', 'b'], ['c', 'd']]), rect(2, 2));
    expect(texts(slate)).toEqual([
      ['00', '01', '02', ''],
      ['10', '11', '12', ''],
      ['20', '21', 'a', 'b'],
      ['', '', 'c', 'd'],
    ]);
    expect(tableOf(slate).props?.columnTypes?.[3]).toBe('text');
    // Caret ends in the last pasted cell
    expect(slate.selection?.anchor.path).toEqual([0, 3, 3, 0]);
  });

  it('repeats a grid that fits the selected range evenly', () => {
    const { editor, slate } = setup();
    AdvancedTableCommands.pasteCells(editor, BLOCK_ID, grid([['x']]), rect(0, 0, 1, 2));
    expect(texts(slate)).toEqual([
      ['x', 'x', 'x'],
      ['x', 'x', 'x'],
      ['20', '21', '22'],
    ]);
  });

  it('pastes at the top-left when the grid does not fit the range evenly', () => {
    const { editor, slate } = setup();
    AdvancedTableCommands.pasteCells(editor, BLOCK_ID, grid([['a', 'b']]), rect(0, 0, 1, 2));
    expect(texts(slate)[0]).toEqual(['a', 'b', '02']);
    expect(texts(slate)[1]).toEqual(['10', '11', '12']);
  });

  it('carries colors and column types from our own tables', () => {
    const { editor, slate } = setup();
    const source = grid([['1', '2']], { fromPlanneer: true, columnTypes: { 0: 'number', 1: 'date' } });
    source.cells[0][0].backgroundColor = 'red';

    AdvancedTableCommands.pasteCells(editor, BLOCK_ID, source, rect(0, 2));

    const table = tableOf(slate);
    expect((table.children[0] as any).children[2].props.backgroundColor).toBe('red');
    // Existing column keeps its type, the new one takes the copied type
    expect(table.props?.columnTypes?.[2]).toBe('text');
    expect(table.props?.columnTypes?.[3]).toBe('date');
  });

  it('leaves formatting alone for data from other apps', () => {
    const { editor, slate } = setup();
    Transforms.setNodes(slate, { props: { width: 200, asHeader: false, backgroundColor: 'green' } } as any, {
      at: [0, 0, 0],
    });
    AdvancedTableCommands.pasteCells(editor, BLOCK_ID, grid([['new']]), rect(0, 0));
    expect((tableOf(slate).children[0] as any).children[0].props.backgroundColor).toBe('green');
  });
});

describe('clearing ranges', () => {
  it('cut clears the range without changing the table shape', () => {
    const { editor, slate } = setup();
    AdvancedTableCommands.clearCells(editor, BLOCK_ID, rect(0, 0, 1, 1));
    expect(texts(slate)).toEqual([
      ['', '', '02'],
      ['', '', '12'],
      ['20', '21', '22'],
    ]);
  });

  it('deleting a selection across cells empties them instead of merging', () => {
    const { slate } = setup();
    Transforms.select(slate, {
      anchor: { path: [0, 0, 1, 0], offset: 1 },
      focus: { path: [0, 1, 2, 0], offset: 1 },
    });
    Editor.deleteFragment(slate);
    expect(texts(slate)).toEqual([
      ['00', '', ''],
      ['10', '', ''],
      ['20', '21', '22'],
    ]);
  });
});

describe('selection', () => {
  it('selects the rectangle between two cells', () => {
    const { slate } = setup();
    Transforms.select(slate, {
      anchor: { path: [0, 0, 2, 0], offset: 0 },
      focus: { path: [0, 1, 1, 0], offset: 0 },
    });
    const selected = EDITOR_TO_SELECTION.get(slate)!.map(([, path]) => path.slice(1));
    expect(selected).toEqual([
      [0, 1],
      [0, 2],
      [1, 1],
      [1, 2],
    ]);
  });
});

describe('buildTableFromClipboard', () => {
  it('turns a header row from another app into column names', () => {
    const table = AdvancedTableCommands.buildTableFromClipboard(
      null as unknown as YooEditor,
      grid([['Item', 'Qty'], ['Apples', '3'], ['Pears', '5']], { hasHeaderRow: true })
    );
    expect(table.props?.columnNames).toEqual({ 0: 'Item', 1: 'Qty' });
    expect(table.props?.columnTypes).toEqual({ 0: 'text', 1: 'number' });
    expect(table.children).toHaveLength(2);
    expect((table.children[1] as any).children[0].children[0].text).toBe('Pears');
  });
});

describe('typed columns', () => {
  it('converts values when a column becomes a number column, keeping what does not parse', () => {
    const { editor, slate } = setup();
    AdvancedTableCommands.pasteCells(editor, BLOCK_ID, grid([['€53,166.00'], ['n/a'], ['1.234,50']]), rect(0, 0));
    AdvancedTableCommands.setColumnType(editor, BLOCK_ID, 0, 'number');
    expect(texts(slate).map((row) => row[0])).toEqual(['53166', 'n/a', '1234.5']);
    expect(tableOf(slate).props?.columnTypes?.[0]).toBe('number');
  });

  it('converts values when a column becomes a date column', () => {
    const { editor, slate } = setup();
    AdvancedTableCommands.pasteCells(editor, BLOCK_ID, grid([['31 Jan 2025'], ['2025-02-01']]), rect(0, 1));
    AdvancedTableCommands.setColumnType(editor, BLOCK_ID, 1, 'date');
    expect(texts(slate).map((row) => row[1])).toEqual(['2025-01-31', '2025-02-01', '21']);
  });

  it('clears values when switching to a page column', () => {
    const { editor, slate } = setup();
    AdvancedTableCommands.setColumnType(editor, BLOCK_ID, 2, 'page');
    expect(texts(slate).map((row) => row[2])).toEqual(['', '', '']);
  });

  it('parses values pasted into number and date columns', () => {
    const { editor, slate } = setup();
    AdvancedTableCommands.setColumnType(editor, BLOCK_ID, 1, 'number');
    AdvancedTableCommands.setColumnType(editor, BLOCK_ID, 2, 'date');
    AdvancedTableCommands.pasteCells(editor, BLOCK_ID, grid([['Rent', '€1,250.00', '31-01-2025']]), rect(0, 0));
    expect(texts(slate)[0]).toEqual(['Rent', '1250', '2025-01-31']);
  });
});
