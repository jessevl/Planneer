/**
 * @file clipboard.test.ts
 * @description Unit tests for advanced table clipboard formats
 */

import { describe, it, expect } from 'vitest';
import {
  gridToTSV,
  inferColumnTypes,
  parseTSV,
  readClipboardGrid,
  tableDataToHTML,
  tableDataToMarkdown,
  tableToClipboardData,
} from './clipboard';
import type { AdvancedTableElement } from '../types';

const clipboard = (data: Record<string, string>) => ({ getData: (type: string) => data[type] ?? '' });

const texts = (cells: { text: string }[][]) => cells.map((row) => row.map((cell) => cell.text));

const makeTable = (rows: string[][], props: Partial<AdvancedTableElement['props']> = {}) =>
  ({
    id: 't',
    type: 'table',
    props: props as AdvancedTableElement['props'],
    children: rows.map((row, r) => ({
      id: `r${r}`,
      type: 'table-row',
      props: { backgroundColor: null },
      children: row.map((text, c) => ({
        id: `c${r}${c}`,
        type: 'table-data-cell',
        props: { width: 200, asHeader: false, backgroundColor: r === 0 && c === 0 ? 'blue' : null },
        children: [{ text }],
      })),
    })),
  }) as unknown as AdvancedTableElement;

describe('TSV', () => {
  it('round-trips values with tabs, newlines and quotes', () => {
    const rows = [
      ['plain', 'with\ttab', 'two\nlines'],
      ['say "hi"', '', 'end'],
    ];
    expect(parseTSV(gridToTSV(rows))).toEqual(rows);
  });

  it('reads Excel output with CRLF and a trailing line break', () => {
    expect(parseTSV('a\tb\r\nc\td\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('keeps empty trailing cells', () => {
    expect(parseTSV('a\t\t\n')).toEqual([['a', '', '']]);
  });
});

describe('readClipboardGrid', () => {
  it('returns null for ordinary text', () => {
    expect(readClipboardGrid(clipboard({ 'text/plain': 'hello world' }))).toBeNull();
    expect(readClipboardGrid(clipboard({ 'text/plain': 'line one\nline two' }))).toBeNull();
  });

  it('reads tab-separated text when there is no HTML table', () => {
    const grid = readClipboardGrid(clipboard({ 'text/plain': 'a\tb\nc' }));
    expect(texts(grid!.cells)).toEqual([
      ['a', 'b'],
      ['c', ''],
    ]);
    expect(grid!.fromPlanneer).toBe(false);
  });

  it('reads an Excel-style HTML table, including in-cell line breaks and nbsp', () => {
    const html = `<html><head><style>td{}</style></head><body><table>
      <tr><td class=xl65>Name</td><td>Notes</td></tr>
      <tr><td>Ann&nbsp;Lee</td><td>first<br style="mso-data-placement:same-cell">second</td></tr>
    </table></body></html>`;
    const grid = readClipboardGrid(clipboard({ 'text/html': html, 'text/plain': 'ignored' }));
    expect(texts(grid!.cells)).toEqual([
      ['Name', 'Notes'],
      ['Ann Lee', 'first\nsecond'],
    ]);
    expect(grid!.hasHeaderRow).toBe(false);
  });

  it('reads a Google Sheets-style table wrapped in its origin element', () => {
    const html = `<google-sheets-html-origin><style>x</style><table><tbody>
      <tr><td data-sheets-value="1">1</td><td>2</td></tr></tbody></table></google-sheets-html-origin>`;
    expect(texts(readClipboardGrid(clipboard({ 'text/html': html }))!.cells)).toEqual([['1', '2']]);
  });

  it('unmerges colspan and rowspan into empty cells', () => {
    const html = `<table>
      <tr><td colspan="2">wide</td><td rowspan="2">tall</td></tr>
      <tr><td>a</td><td>b</td></tr>
    </table>`;
    expect(texts(readClipboardGrid(clipboard({ 'text/html': html }))!.cells)).toEqual([
      ['wide', '', 'tall'],
      ['a', 'b', ''],
    ]);
  });

  it('detects a header row', () => {
    const html = '<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>';
    expect(readClipboardGrid(clipboard({ 'text/html': html }))!.hasHeaderRow).toBe(true);
  });

  it('round-trips our own tables with colors and column types', () => {
    const table = makeTable(
      [
        ['a', 'b', 'c'],
        ['1', '2', '3'],
      ],
      { columnTypes: { 0: 'text', 1: 'number', 2: 'date' }, columnNames: { 1: 'Amount' } }
    );
    const data = tableToClipboardData(table, { top: 0, bottom: 1, left: 1, right: 2 });
    const grid = readClipboardGrid(clipboard({ 'text/html': tableDataToHTML(data) }));

    expect(grid!.fromPlanneer).toBe(true);
    expect(texts(grid!.cells)).toEqual([
      ['b', 'c'],
      ['2', '3'],
    ]);
    expect(grid!.columnTypes).toEqual({ 0: 'number', 1: 'date' });
    expect(grid!.columnNames).toEqual({ 0: 'Amount' });
  });

  it('keeps cell colors from our own tables', () => {
    const data = tableToClipboardData(makeTable([['x', 'y']]));
    const grid = readClipboardGrid(clipboard({ 'text/html': tableDataToHTML(data) }));
    expect(grid!.cells[0].map((cell) => cell.backgroundColor)).toEqual(['blue', null]);
  });

  it('escapes cell text in HTML output', () => {
    const html = tableDataToHTML({ cells: [[{ text: '<b>&"x"</b>' }]] });
    expect(html).toContain('<td>&lt;b&gt;&amp;&quot;x&quot;&lt;/b&gt;</td>');
    expect(texts(readClipboardGrid(clipboard({ 'text/html': html }))!.cells)).toEqual([['<b>&"x"</b>']]);
  });
});

describe('export helpers', () => {
  it('adds a header only for whole-table exports with column names', () => {
    const data = tableToClipboardData(makeTable([['1']], { columnNames: { 0: 'Qty' } }));
    expect(tableDataToHTML(data)).not.toContain('<thead>');
    expect(tableDataToHTML(data, { includeHeader: true })).toContain('<thead><tr><th>Qty</th></tr></thead>');
  });

  it('writes a markdown table', () => {
    const data = tableToClipboardData(makeTable([['a|b', 'c']], { columnNames: { 0: 'X' } }));
    expect(tableDataToMarkdown(data)).toBe('| X | Column 2 |\n| --- | --- |\n| a\\|b | c |');
  });

  it('infers number columns only when every value is numeric', () => {
    const rows = [
      [{ text: '1' }, { text: 'a' }, { text: '' }],
      [{ text: '-2.5' }, { text: '3' }, { text: '' }],
    ];
    expect(inferColumnTypes(rows)).toEqual({ 0: 'number', 1: 'text', 2: 'text' });
  });
});

describe('tableDataToCSV', () => {
  it('writes column names first and quotes fields that need it', async () => {
    const { tableDataToCSV } = await import('./clipboard');
    const csv = tableDataToCSV({
      cells: [[{ text: 'a,b' }, { text: 'say "hi"' }], [{ text: 'two\nlines' }, { text: ' padded' }]],
      columnNames: { 0: 'Name' },
    });
    expect(csv).toBe('Name,Column 2\r\n"a,b","say ""hi"""\r\n"two\nlines"," padded"');
  });
});
