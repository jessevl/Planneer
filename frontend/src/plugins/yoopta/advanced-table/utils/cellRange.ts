/**
 * @file cellRange.ts
 * @description Rectangular cell ranges, the way spreadsheets select cells.
 */
import type { BaseEditor, Path, Range as SlateRange } from 'slate';
import { Editor, Node, Path as SlatePath, Range } from 'slate';

import type { AdvancedTableCellElement, AdvancedTableElement } from '../types';
import { isTableCellElement } from './cellUtils';

export type CellRect = {
  tablePath: Path;
  top: number;
  bottom: number;
  left: number;
  right: number;
};

const cellPathAt = (slate: BaseEditor, point: SlateRange['anchor']): Path | null => {
  try {
    const entry = Editor.above(slate, { at: point, match: isTableCellElement });
    return entry ? entry[1] : null;
  } catch {
    return null;
  }
};

/**
 * The rectangle of cells spanned by a selection: every cell between the
 * rows and columns of its two ends, not the cells in reading order between them.
 */
export function getCellRect(slate: BaseEditor, range: SlateRange | null = slate.selection): CellRect | null {
  if (!range || !Range.isRange(range)) return null;

  const fromPath = cellPathAt(slate, Range.start(range));
  const toPath = cellPathAt(slate, Range.end(range));
  if (!fromPath || !toPath) return null;

  const tablePath = SlatePath.parent(SlatePath.parent(fromPath));
  if (!SlatePath.equals(tablePath, SlatePath.parent(SlatePath.parent(toPath)))) return null;

  const [fromRow, fromCol] = fromPath.slice(-2);
  const [toRow, toCol] = toPath.slice(-2);

  return {
    tablePath,
    top: Math.min(fromRow, toRow),
    bottom: Math.max(fromRow, toRow),
    left: Math.min(fromCol, toCol),
    right: Math.max(fromCol, toCol),
  };
}

export const isMultiCellRect = (rect: CellRect | null): rect is CellRect =>
  !!rect && (rect.top !== rect.bottom || rect.left !== rect.right);

/** Cells inside the rectangle, row by row */
export function getCellsInRect(
  slate: BaseEditor,
  rect: CellRect
): [AdvancedTableCellElement, Path][][] {
  const table = Node.get(slate, rect.tablePath) as unknown as AdvancedTableElement;
  const rows: [AdvancedTableCellElement, Path][][] = [];

  for (let r = rect.top; r <= rect.bottom; r++) {
    const row = table.children[r] as any;
    if (!row?.children) continue;
    const cells: [AdvancedTableCellElement, Path][] = [];
    for (let c = rect.left; c <= rect.right; c++) {
      const cell = row.children[c];
      if (isTableCellElement(cell)) cells.push([cell, [...rect.tablePath, r, c]]);
    }
    rows.push(cells);
  }

  return rows;
}
