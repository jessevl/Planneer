/**
 * @file clipboard.ts
 * @description Copy, cut and paste of cell ranges.
 *
 * These are attached as capture-phase handlers on the <table>. Yoopta's own
 * paste handler turns clipboard HTML into new blocks after the table and gives
 * plugins no way to stop it, so anything pasted into a cell is handled here and
 * the event is stopped before it gets there.
 */
import type React from 'react';
import type { YooEditor } from '@yoopta/editor';
import { Editor, Transforms } from 'slate';

import { AdvancedTableCommands } from '../commands';
import type { AdvancedTableElement } from '../types';
import { getCellRect, isMultiCellRect } from '../utils/cellRange';
import { gridToTSV, readClipboardGrid, tableDataToHTML, tableToClipboardData } from '../utils/clipboard';

export function onTableCopy(
  editor: YooEditor,
  blockId: string,
  event: React.ClipboardEvent,
  mode: 'copy' | 'cut'
) {
  const slate = editor.blockEditorsMap[blockId];
  if (!slate) return;

  // Text inside a single cell copies like any other text
  const rect = getCellRect(slate);
  if (!isMultiCellRect(rect)) return;

  const [table] = Editor.node(slate, rect.tablePath);
  const data = tableToClipboardData(table as unknown as AdvancedTableElement, rect);

  event.preventDefault();
  event.stopPropagation();
  event.clipboardData.setData('text/plain', gridToTSV(data.cells.map((row) => row.map((cell) => cell.text))));
  event.clipboardData.setData('text/html', tableDataToHTML(data));

  if (mode === 'cut' && !editor.readOnly) {
    AdvancedTableCommands.clearCells(editor, blockId, rect);
  }
}

export function onTablePaste(editor: YooEditor, blockId: string, event: React.ClipboardEvent) {
  if (editor.readOnly) return;

  const slate = editor.blockEditorsMap[blockId];
  if (!slate) return;

  const rect = getCellRect(slate);
  if (!rect) return;

  event.preventDefault();
  event.stopPropagation();

  const grid = readClipboardGrid(event.clipboardData);
  const isSingleCell = grid && grid.cells.length === 1 && grid.cells[0].length === 1;

  if (grid && (!isSingleCell || isMultiCellRect(rect))) {
    AdvancedTableCommands.pasteCells(editor, blockId, grid, rect);
    return;
  }

  // Anything else is pasted as plain text into the current cell. Line breaks
  // stay inside the cell rather than splitting it.
  const text = (isSingleCell ? grid.cells[0][0].text : event.clipboardData.getData('text/plain')).replace(/\r\n?/g, '\n');
  if (!text) return;

  const [table] = Editor.node(slate, rect.tablePath);
  const columnType = (table as unknown as AdvancedTableElement).props?.columnTypes?.[rect.left];

  // Text over a range of cells fills each of them. In number and date columns
  // a pasted value replaces the cell, converted to the column's format.
  if (isMultiCellRect(rect) || columnType === 'number' || columnType === 'date') {
    AdvancedTableCommands.pasteCells(editor, blockId, { cells: [[{ text }]], fromPlanneer: false }, rect);
    return;
  }

  Transforms.insertText(slate, text);
}
