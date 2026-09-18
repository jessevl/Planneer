/**
 * @file clipboard.ts
 * @description Clipboard formats for the advanced table.
 *
 * A copied range of cells is written in three flavours so it survives the trip
 * to wherever it is pasted:
 * - text/plain: tab-separated values, which Excel, Numbers and Google Sheets
 *   read as a grid
 * - text/html: a plain <table>, which docs tools (Google Docs, Word, Notion)
 *   read as a table
 * - the same <table> carries a `data-planneer-table` attribute with JSON, so a
 *   paste into another advanced table keeps colors and column types
 *
 * Reading goes the other way: our JSON first, then any HTML <table>, then TSV.
 */
import type { AdvancedTableElement, BackgroundColor, ColumnType } from '../types';

export const CLIPBOARD_ATTRIBUTE = 'data-planneer-table';
const CLIPBOARD_VERSION = 1;

export type ClipboardCell = {
  text: string;
  backgroundColor?: BackgroundColor;
};

export type TableClipboardData = {
  cells: ClipboardCell[][];
  /** Column metadata, indexed from the first copied column */
  columnTypes?: Record<number, ColumnType>;
  columnNames?: Record<number, string>;
};

export type ClipboardGrid = TableClipboardData & {
  /** true when the grid came from an advanced table (colors/types are meaningful) */
  fromPlanneer: boolean;
  /** true when the source marked its first row as a header (<th>/<thead>) */
  hasHeaderRow?: boolean;
};

type CellBounds = { top: number; bottom: number; left: number; right: number };

const pickColumns = <T>(record: Record<number, T> | undefined, left: number, right: number) => {
  if (!record) return undefined;
  const result: Record<number, T> = {};
  for (let i = left; i <= right; i++) {
    if (record[i] !== undefined) result[i - left] = record[i];
  }
  return result;
};

/**
 * Read cells out of a table element, optionally limited to a rectangle.
 * Column metadata is re-indexed so the first copied column is 0.
 */
export function tableToClipboardData(table: AdvancedTableElement, bounds?: CellBounds): TableClipboardData {
  const rows = (table.children as any[]) ?? [];
  const width = Math.max(0, ...rows.map((row) => row?.children?.length ?? 0));
  const { top = 0, bottom = rows.length - 1, left = 0, right = width - 1 } = bounds ?? {};

  const cells: ClipboardCell[][] = [];
  for (let r = top; r <= bottom; r++) {
    const row = rows[r];
    if (!row?.children) continue;
    const out: ClipboardCell[] = [];
    for (let c = left; c <= right; c++) {
      const cell = row.children[c];
      out.push({
        text: (cell?.children ?? []).map((child: any) => child.text ?? '').join(''),
        backgroundColor: cell?.props?.backgroundColor ?? null,
      });
    }
    cells.push(out);
  }

  return {
    cells,
    columnTypes: pickColumns(table.props?.columnTypes, left, right),
    columnNames: pickColumns(table.props?.columnNames, left, right),
  };
}

// ============================================================================
// TSV
// ============================================================================

const quoteTSVField = (value: string) =>
  /[\t\n\r"]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

export function gridToTSV(rows: string[][]): string {
  return rows.map((row) => row.map(quoteTSVField).join('\t')).join('\n');
}

/**
 * Parse tab-separated text as spreadsheets write it: fields may be quoted,
 * quoted fields may contain tabs, newlines and doubled quotes, and a single
 * trailing line break is not an extra row.
 */
export function parseTSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let i = 0;
  let atFieldStart = true;

  while (i < text.length) {
    const char = text[i];

    if (atFieldStart && char === '"') {
      // Quoted field: read until the closing quote
      i++;
      while (i < text.length) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          i++;
          break;
        }
        field += text[i++];
      }
      atFieldStart = false;
      continue;
    }

    if (char === '\t') {
      row.push(field);
      field = '';
      atFieldStart = true;
      i++;
      continue;
    }

    if (char === '\r' || char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      atFieldStart = true;
      i += char === '\r' && text[i + 1] === '\n' ? 2 : 1;
      continue;
    }

    field += char;
    atFieldStart = false;
    i++;
  }

  if (!atFieldStart || field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

// ============================================================================
// HTML
// ============================================================================

const escapeHTML = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const cellHTML = (tag: 'td' | 'th', text: string) =>
  `<${tag}>${escapeHTML(text).replace(/\r?\n/g, '<br>')}</${tag}>`;

/**
 * Render clipboard data as an HTML table. Column names become a <thead> only
 * when `includeHeader` is set (whole-table copies), so a copied range pastes
 * into a spreadsheet as exactly the cells that were selected.
 */
export function tableDataToHTML(data: TableClipboardData, { includeHeader = false } = {}): string {
  const payload = escapeHTML(JSON.stringify({ version: CLIPBOARD_VERSION, ...data }));
  const columnCount = Math.max(0, ...data.cells.map((row) => row.length));

  let head = '';
  if (includeHeader && data.columnNames && Object.keys(data.columnNames).length > 0) {
    const names = Array.from({ length: columnCount }, (_, i) => data.columnNames?.[i] || `Column ${i + 1}`);
    head = `<thead><tr>${names.map((name) => cellHTML('th', name)).join('')}</tr></thead>`;
  }

  const body = data.cells
    .map((row) => `<tr>${row.map((cell) => cellHTML('td', cell.text)).join('')}</tr>`)
    .join('');

  return `<table ${CLIPBOARD_ATTRIBUTE}="${payload}">${head}<tbody>${body}</tbody></table>`;
}

const BLOCK_TAGS = new Set(['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'TR']);

/**
 * Visible text of a cell. `innerText` needs layout, which parsed documents
 * don't have, so line breaks from <br> and block elements are rebuilt here.
 */
function cellText(el: Element): string {
  let out = '';
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      out += (node.textContent || '').replace(/[\t\n\r]+/g, ' ');
      return;
    }
    if (node.nodeType !== 1) return;
    const name = (node as Element).nodeName;
    if (name === 'STYLE' || name === 'SCRIPT') return;
    if (name === 'BR') {
      out += '\n';
      return;
    }
    const isBlock = BLOCK_TAGS.has(name);
    if (isBlock && out && !out.endsWith('\n')) out += '\n';
    node.childNodes.forEach(walk);
    if (isBlock && out && !out.endsWith('\n')) out += '\n';
  };
  el.childNodes.forEach(walk);

  return out
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/ {2,}/g, ' ').trim())
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function readPlanneerPayload(table: Element): TableClipboardData | null {
  const raw = table.getAttribute(CLIPBOARD_ATTRIBUTE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version !== CLIPBOARD_VERSION || !Array.isArray(parsed.cells)) return null;
    const cells: ClipboardCell[][] = parsed.cells.map((row: unknown) =>
      Array.isArray(row)
        ? row.map((cell: any) => ({
            text: typeof cell?.text === 'string' ? cell.text : '',
            backgroundColor: typeof cell?.backgroundColor === 'string' ? cell.backgroundColor : null,
          }))
        : []
    );
    return { cells, columnTypes: parsed.columnTypes, columnNames: parsed.columnNames };
  } catch {
    return null;
  }
}

/**
 * Read an HTML <table> element into a grid. Merged cells (colspan/rowspan) are
 * unmerged: the text goes into the top-left cell and the rest stay empty.
 */
export function htmlTableToGrid(table: HTMLTableElement): ClipboardGrid {
  const planneer = readPlanneerPayload(table);
  if (planneer) return { ...planneer, fromPlanneer: true };

  const grid: ClipboardCell[][] = [];
  const rows = Array.from(table.rows);
  let hasHeaderRow = false;

  rows.forEach((row, rowIndex) => {
    grid[rowIndex] ??= [];
    const cells = Array.from(row.cells);
    if (rowIndex === 0) {
      hasHeaderRow =
        row.parentElement?.nodeName === 'THEAD' ||
        (cells.length > 0 && cells.every((cell) => cell.nodeName === 'TH'));
    }

    let col = 0;
    for (const cell of cells) {
      // Skip slots already filled by a rowspan from above
      while (grid[rowIndex][col] !== undefined) col++;

      const colSpan = Math.max(1, Math.min(cell.colSpan || 1, 100));
      const rowSpan = Math.max(1, Math.min(cell.rowSpan || 1, rows.length - rowIndex));
      const text = cellText(cell);

      for (let r = 0; r < rowSpan; r++) {
        grid[rowIndex + r] ??= [];
        for (let c = 0; c < colSpan; c++) {
          grid[rowIndex + r][col + c] = { text: r === 0 && c === 0 ? text : '' };
        }
      }
      col += colSpan;
    }
  });

  // Pad ragged rows and fill holes so every row has the same length
  const width = Math.max(0, ...grid.map((row) => row.length));
  const cells = grid.map((row) => Array.from({ length: width }, (_, i) => row[i] ?? { text: '' }));

  return { cells, fromPlanneer: false, hasHeaderRow };
}

function findTable(html: string): HTMLTableElement | null {
  if (!html || !/<table[\s>]/i.test(html)) return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.querySelector(`table[${CLIPBOARD_ATTRIBUTE}]`) ?? doc.querySelector('table');
}

/**
 * Work out whether the clipboard holds a grid of cells, and read it.
 * Returns null for ordinary text, which should paste as text.
 */
export function readClipboardGrid(clipboard: Pick<DataTransfer, 'getData'>): ClipboardGrid | null {
  const table = findTable(clipboard.getData('text/html'));
  if (table) {
    const grid = htmlTableToGrid(table);
    if (grid.cells.length > 0 && grid.cells[0].length > 0) return grid;
  }

  const text = clipboard.getData('text/plain');
  // Only tab-separated text is a grid; plain multi-line text stays one cell
  if (!text || !text.includes('\t')) return null;

  const rows = parseTSV(text);
  const width = Math.max(0, ...rows.map((row) => row.length));
  if (rows.length === 0 || width === 0) return null;

  return {
    cells: rows.map((row) => Array.from({ length: width }, (_, i) => ({ text: row[i] ?? '' }))),
    fromPlanneer: false,
  };
}

/**
 * Guess column types for a table built from pasted data. Only numbers are
 * inferred; everything else stays text so nothing gets reformatted.
 */
export function inferColumnTypes(rows: ClipboardCell[][]): Record<number, ColumnType> {
  const width = Math.max(0, ...rows.map((row) => row.length));
  const types: Record<number, ColumnType> = {};
  for (let col = 0; col < width; col++) {
    const values = rows.map((row) => row[col]?.text.trim() ?? '').filter(Boolean);
    types[col] = values.length > 0 && values.every((v) => /^-?\d+(\.\d+)?$/.test(v)) ? 'number' : 'text';
  }
  return types;
}

/** GitHub-flavoured markdown table, used for markdown export */
export function tableDataToMarkdown(data: TableClipboardData): string {
  const width = Math.max(0, ...data.cells.map((row) => row.length));
  if (width === 0) return '';
  const escape = (text: string) => text.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
  const header = Array.from({ length: width }, (_, i) => data.columnNames?.[i] || `Column ${i + 1}`);
  const lines = [
    `| ${header.map(escape).join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...data.cells.map((row) => `| ${Array.from({ length: width }, (_, i) => escape(row[i]?.text ?? '')).join(' | ')} |`),
  ];
  return lines.join('\n');
}
