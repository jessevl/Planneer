import type { SlateElement, YooEditor, YooptaPathIndex } from '@yoopta/editor';
import { Blocks, generateId } from '@yoopta/editor';
import { Editor, Element, Path, Transforms, type BaseEditor, type Location } from 'slate';

import type {
  InsertAdvancedTableOptions,
  AdvancedTableCellElement,
  AdvancedTableElement,
  AdvancedTableRowElement,
  BackgroundColor,
  SortDirection,
  ColumnType,
  ColumnFilter,
  AggregationType,
} from './types';
import { getCellText } from './utils/cellUtils';

// ============================================================================
// HELPER TYPES AND UTILITIES
// ============================================================================

type Options = {
  path?: Location;
  select?: boolean;
  insertMode?: 'before' | 'after';
  columnType?: ColumnType;
};

type DeleteOptions = Omit<Options, 'insertMode' | 'select'>;

type MoveTableOptions = {
  from: Path;
  to: Path;
};

type InsertOptions = Partial<InsertAdvancedTableOptions & { at: YooptaPathIndex }>;

/** Type guard for table element */
const isTable = (n: unknown): n is AdvancedTableElement =>
  Element.isElement(n) && (n as SlateElement).type === 'table';

/** Type guard for table row element */
const isTableRow = (n: unknown): n is AdvancedTableRowElement =>
  Element.isElement(n) && (n as SlateElement).type === 'table-row';

/** Type guard for table cell element */
const isTableCell = (n: unknown): n is AdvancedTableCellElement =>
  Element.isElement(n) && (n as SlateElement).type === 'table-data-cell';

/** 
 * Get the Slate editor instance for a block.
 * Returns null if not found.
 */
const getSlate = (editor: YooEditor, blockId: string) =>
  Blocks.getBlockSlate(editor, { id: blockId });

/**
 * Get the table element and path from the current selection or [0].
 * Returns null if no table found.
 */
const getTableEntry = (
  slate: BaseEditor,
  at?: Location
): [AdvancedTableElement, Path] | null => {
  try {
    // If looking at a specific path, try to find table above it
    if (at && !Path.equals(at as Path, [0])) {
      const entry = Editor.above(slate, {
        at,
        match: isTable,
      });
      if (entry) return [entry[0] as unknown as AdvancedTableElement, entry[1]];
    }
    
    // Default: get the table at [0] directly (root of block)
    const [node, path] = Editor.node(slate, [0]);
    if (isTable(node)) return [node as AdvancedTableElement, path];
    return null;
  } catch {
    return null;
  }
};

/**
 * Get the row entry containing the given path.
 */
const getRowEntry = (
  slate: BaseEditor,
  at: Location
): [AdvancedTableRowElement, Path] | null => {
  // Try above first
  const entry = Editor.above(slate, { at, match: isTableRow });
  if (entry) return [entry[0] as unknown as AdvancedTableRowElement, entry[1]];
  
  // If path points directly to a row
  if (Path.isPath(at)) {
    try {
      const [node] = Editor.node(slate, at);
      if (isTableRow(node)) return [node as AdvancedTableRowElement, at];
    } catch {
      // no-op
    }
  }
  return null;
};

/**
 * Get the cell entry containing the given path.
 */
const getCellEntry = (
  slate: BaseEditor,
  at: Location
): [AdvancedTableCellElement, Path] | null => {
  // Try above first
  const entry = Editor.above(slate, { at, match: isTableCell });
  if (entry) return [entry[0] as unknown as AdvancedTableCellElement, entry[1]];
  
  // If path points directly to a cell
  if (Path.isPath(at)) {
    try {
      const [node] = Editor.node(slate, at);
      if (isTableCell(node)) return [node as AdvancedTableCellElement, at];
    } catch {
      // no-op
    }
  }
  return null;
};

/**
 * Shift column indices in a record when inserting/deleting columns.
 */
const shiftColumnProps = <T>(
  obj: Record<number, T> | undefined,
  insertIndex: number,
  direction: 'insert' | 'delete'
): Record<number, T> | undefined => {
  if (!obj) return undefined;
  const result: Record<number, T> = {};
  for (const [key, val] of Object.entries(obj)) {
    const idx = parseInt(key, 10);
    if (direction === 'insert') {
      result[idx >= insertIndex ? idx + 1 : idx] = val;
    } else {
      // delete
      if (idx < insertIndex) result[idx] = val;
      else if (idx > insertIndex) result[idx - 1] = val;
      // Skip idx === insertIndex (deleted)
    }
  }
  return result;
};

/**
 * Move column indices when reordering columns.
 */
const moveColumnProps = <T>(
  obj: Record<number, T> | undefined,
  from: number,
  to: number
): Record<number, T> | undefined => {
  if (!obj) return undefined;
  const result: Record<number, T> = {};
  for (const [key, val] of Object.entries(obj)) {
    const idx = parseInt(key, 10);
    let newIdx = idx;
    if (idx === from) {
      newIdx = to;
    } else if (from < to) {
      if (idx > from && idx <= to) newIdx = idx - 1;
    } else if (from > to) {
      if (idx >= to && idx < from) newIdx = idx + 1;
    }
    result[newIdx] = val;
  }
  return result;
};

/**
 * Create a new empty cell element.
 */
const createEmptyCell = (width = 200): AdvancedTableCellElement => ({
  id: generateId(),
  type: 'table-data-cell',
  children: [{ text: '' }],
  props: { width, asHeader: false, backgroundColor: null },
});

/**
 * Create a new row with empty cells.
 */
const createEmptyRow = (numCells: number, cellWidth = 200): AdvancedTableRowElement => ({
  id: generateId(),
  type: 'table-row',
  children: Array.from({ length: numCells }, () => createEmptyCell(cellWidth)) as any,
  props: { backgroundColor: null },
});

/**
 * Update table props at the given path.
 */
const setTableProps = (
  slate: BaseEditor,
  tablePath: Path,
  propsUpdate: Partial<AdvancedTableElement['props']>
) => {
  Transforms.setNodes(
    slate,
    { props: propsUpdate } as any,
    { at: tablePath, match: isTable }
  );
};

// ============================================================================
// COMMANDS
// ============================================================================

export type AdvancedTableCommands = {
  buildTableElements: (editor: YooEditor, options?: InsertOptions) => AdvancedTableElement;
  insertTable: (editor: YooEditor, options?: InsertOptions) => void;
  deleteTable: (editor: YooEditor, blockId: string) => void;
  insertTableRow: (editor: YooEditor, blockId: string, options?: Options) => void;
  deleteTableRow: (editor: YooEditor, blockId: string, options?: DeleteOptions) => void;
  moveTableRow: (editor: YooEditor, blockId: string, options: MoveTableOptions) => void;
  moveTableColumn: (editor: YooEditor, blockId: string, options: MoveTableOptions) => void;
  insertTableColumn: (editor: YooEditor, blockId: string, options?: Options) => void;
  deleteTableColumn: (editor: YooEditor, blockId: string, options?: DeleteOptions) => void;
  updateColumnWidth: (editor: YooEditor, blockId: string, columnIndex: number, width: number) => void;
  toggleHeaderRow: (editor: YooEditor, blockId: string) => void;
  toggleHeaderColumn: (editor: YooEditor, blockId: string) => void;
  toggleAlternatingRows: (editor: YooEditor, blockId: string) => void;
  setCellBackgroundColor: (editor: YooEditor, blockId: string, path: Path, color: BackgroundColor) => void;
  setRowBackgroundColor: (editor: YooEditor, blockId: string, rowIndex: number, color: BackgroundColor) => void;
  setColumnBackgroundColor: (editor: YooEditor, blockId: string, columnIndex: number, color: BackgroundColor) => void;
  sortColumn: (editor: YooEditor, blockId: string, columnIndex: number, direction: SortDirection) => void;
  setColumnType: (editor: YooEditor, blockId: string, columnIndex: number, type: ColumnType) => void;
  setColumnFilter: (editor: YooEditor, blockId: string, columnIndex: number, filter: ColumnFilter | null) => void;
  setColumnAggregation: (editor: YooEditor, blockId: string, columnIndex: number, aggregation: AggregationType | null) => void;
  setColumnName: (editor: YooEditor, blockId: string, columnIndex: number, name: string) => void;
  toggleCalculationRow: (editor: YooEditor, blockId: string) => void;
};

export const AdvancedTableCommands: AdvancedTableCommands = {
  buildTableElements: (_editor, options) => {
    const { rows = 3, columns = 3, columnWidth = 200, headerColumn = false, headerRow = false } = options || {};

    const columnTypes: Record<number, ColumnType> = {};
    for (let j = 0; j < columns; j++) columnTypes[j] = 'text';

    const table: AdvancedTableElement = {
      id: generateId(),
      type: 'table',
      children: [],
      props: {
        headerColumn,
        headerRow,
        columnBackgroundColors: {},
        columnTypes,
        columnFilters: {},
        sortInfo: undefined,
        showCalculationRow: false,
      },
    };

    for (let i = 0; i < rows; i++) {
      const row = createEmptyRow(columns, columnWidth);
      // Mark first row cells as headers if needed
      if (i === 0 && headerRow) {
        row.children.forEach((cell: any) => { cell.props.asHeader = true; });
      }
      (table.children as any).push(row);
    }

    return table;
  },

  insertTable: (editor, options) => {
    const table = AdvancedTableCommands.buildTableElements(editor, options);
    const block = Blocks.buildBlockData({ value: [table], type: 'AdvancedTable' });
    Blocks.insertBlock(editor, block.type, { ...options, blockData: block });
  },

  deleteTable: (editor, blockId) => {
    editor.deleteBlock({ blockId });
  },

  insertTableRow: (editor, blockId, options) => {
    const slate = getSlate(editor, blockId);
    if (!slate) return;

    const { insertMode = 'after', path = slate.selection, select = true } = options || {};
    if (!path) return;

    const rowEntry = getRowEntry(slate, path);
    if (!rowEntry) return;

    const [currentRow, currentRowPath] = rowEntry;
    const insertPath = insertMode === 'before' ? currentRowPath : Path.next(currentRowPath);
    const numCells = currentRow.children.length;

    Editor.withoutNormalizing(slate, () => {
      Transforms.insertNodes(slate, createEmptyRow(numCells) as any, { at: insertPath });
    });

    if (select) {
      setTimeout(() => {
        try {
          Transforms.select(slate, Editor.start(slate, insertPath));
        } catch {
          // no-op
        }
      }, 0);
    }
  },

  deleteTableRow: (editor, blockId, options) => {
    const slate = getSlate(editor, blockId);
    if (!slate) return;

    const { path = slate.selection } = options || {};
    if (!path) return;

    const rowEntry = getRowEntry(slate, path);
    if (!rowEntry) return;

    const [, rowPath] = rowEntry;
    const tableEntry = getTableEntry(slate, rowPath);
    if (!tableEntry || tableEntry[0].children.length <= 1) return;

    Editor.withoutNormalizing(slate, () => {
      Transforms.removeNodes(slate, { at: rowPath });
    });
  },

  moveTableRow: (editor, blockId, { from, to }) => {
    const slate = getSlate(editor, blockId);
    if (!slate) return;

    Editor.withoutNormalizing(slate, () => {
      Transforms.moveNodes(slate, { at: from, to, match: isTableRow });
    });
  },

  moveTableColumn: (editor, blockId, { from, to }) => {
    const slate = getSlate(editor, blockId);
    if (!slate) return;

    Editor.withoutNormalizing(slate, () => {
      const tableEntry = getTableEntry(slate, from);
      if (!tableEntry) return;
      const [table, tablePath] = tableEntry;

      const fromIdx = from[from.length - 1];
      const toIdx = to[to.length - 1];

      // Move cells in each row
      table.children.forEach((row, i) => {
        if (!isTableRow(row)) return;
        const rowPath = [...tablePath, i];
        if (row.children.length > fromIdx) {
          Transforms.moveNodes(slate, { at: [...rowPath, fromIdx], to: [...rowPath, toIdx] });
        }
      });

      // Update table props
      const props = { ...table.props };
      props.columnTypes = moveColumnProps(props.columnTypes, fromIdx, toIdx) || {};
      props.columnNames = moveColumnProps(props.columnNames, fromIdx, toIdx);
      props.columnFilters = moveColumnProps(props.columnFilters, fromIdx, toIdx);
      props.columnAggregations = moveColumnProps(props.columnAggregations, fromIdx, toIdx);
      props.columnBackgroundColors = moveColumnProps(props.columnBackgroundColors, fromIdx, toIdx);

      if (props.sortInfo) {
        let newSortIdx = props.sortInfo.columnIndex;
        if (props.sortInfo.columnIndex === fromIdx) newSortIdx = toIdx;
        else if (fromIdx < toIdx && props.sortInfo.columnIndex > fromIdx && props.sortInfo.columnIndex <= toIdx) newSortIdx--;
        else if (fromIdx > toIdx && props.sortInfo.columnIndex >= toIdx && props.sortInfo.columnIndex < fromIdx) newSortIdx++;
        props.sortInfo = { ...props.sortInfo, columnIndex: newSortIdx };
      }

      setTableProps(slate, tablePath, props);
    });
  },

  insertTableColumn: (editor, blockId, options) => {
    const slate = getSlate(editor, blockId);
    if (!slate) return;

    const { insertMode = 'after', path = slate.selection, columnType = 'text', select = true } = options || {};
    if (!path) return;

    const cellEntry = getCellEntry(slate, path);
    if (!cellEntry) return;

    const [, cellPath] = cellEntry;
    const columnIndex = cellPath[cellPath.length - 1];
    const insertIndex = insertMode === 'before' ? columnIndex : columnIndex + 1;

    const tableEntry = getTableEntry(slate, cellPath);
    if (!tableEntry) return;
    const [table, tablePath] = tableEntry;

    Editor.withoutNormalizing(slate, () => {
      // Insert cells in each row
      table.children.forEach((row, i) => {
        if (!isTableRow(row)) return;
        Transforms.insertNodes(slate, createEmptyCell() as any, { at: [...tablePath, i, insertIndex] });
      });

      // Update table props
      const props = { ...table.props };
      props.columnTypes = shiftColumnProps(props.columnTypes, insertIndex, 'insert') || {};
      props.columnTypes[insertIndex] = columnType;
      props.columnNames = shiftColumnProps(props.columnNames, insertIndex, 'insert');
      props.columnFilters = shiftColumnProps(props.columnFilters, insertIndex, 'insert');
      props.columnAggregations = shiftColumnProps(props.columnAggregations, insertIndex, 'insert');
      props.columnBackgroundColors = shiftColumnProps(props.columnBackgroundColors, insertIndex, 'insert');

      if (props.sortInfo && props.sortInfo.columnIndex >= insertIndex) {
        props.sortInfo = { ...props.sortInfo, columnIndex: props.sortInfo.columnIndex + 1 };
      }

      setTableProps(slate, tablePath, props);
    });

    if (select) {
      setTimeout(() => {
        try {
          Transforms.select(slate, [...tablePath, 0, insertIndex, 0]);
        } catch {
          // no-op
        }
      }, 0);
    }
  },

  deleteTableColumn: (editor, blockId, options) => {
    const slate = getSlate(editor, blockId);
    if (!slate) return;

    const { path = slate.selection } = options || {};
    if (!path) return;

    const cellEntry = getCellEntry(slate, path);
    if (!cellEntry) return;

    const [, cellPath] = cellEntry;
    const columnIndex = cellPath[cellPath.length - 1];

    const tableEntry = getTableEntry(slate, cellPath);
    if (!tableEntry) return;
    const [table, tablePath] = tableEntry;

    // Don't delete the last column
    const firstRow = table.children[0];
    if (!isTableRow(firstRow) || firstRow.children.length <= 1) return;

    try {
      Transforms.deselect(slate);
    } catch {
      // no-op
    }

    Editor.withoutNormalizing(slate, () => {
      // Update table props first
      const props = { ...table.props };
      props.columnTypes = shiftColumnProps(props.columnTypes, columnIndex, 'delete') || {};
      props.columnNames = shiftColumnProps(props.columnNames, columnIndex, 'delete');
      props.columnFilters = shiftColumnProps(props.columnFilters, columnIndex, 'delete');
      props.columnAggregations = shiftColumnProps(props.columnAggregations, columnIndex, 'delete');
      props.columnBackgroundColors = shiftColumnProps(props.columnBackgroundColors, columnIndex, 'delete');

      if (props.sortInfo?.columnIndex === columnIndex) {
        props.sortInfo = undefined;
      } else if (props.sortInfo && props.sortInfo.columnIndex > columnIndex) {
        props.sortInfo = { ...props.sortInfo, columnIndex: props.sortInfo.columnIndex - 1 };
      }

      setTableProps(slate, tablePath, props);

      // Remove cells (iterate backwards for safety)
      for (let i = table.children.length - 1; i >= 0; i--) {
        const row = table.children[i];
        if (!isTableRow(row) || row.children.length <= columnIndex) continue;
        
        try {
          const targetPath = [...tablePath, i, columnIndex];
          const [cellNode] = Editor.node(slate, targetPath);
          if (isTableCell(cellNode)) {
            Transforms.removeNodes(slate, { at: targetPath });
          }
        } catch {
          // no-op
        }
      }
    });
  },

  updateColumnWidth: (editor, blockId, columnIndex, width) => {
    const slate = getSlate(editor, blockId);
    if (!slate) return;

    Editor.withoutNormalizing(slate, () => {
      const tableEntry = getTableEntry(slate);
      if (!tableEntry) return;
      const [, tablePath] = tableEntry;

      const cells = Editor.nodes(slate, {
        at: tablePath,
        match: isTableCell,
      });

      for (const [node, cellPath] of cells) {
        const cell = node as unknown as AdvancedTableCellElement;
        if (cellPath[cellPath.length - 1] === columnIndex) {
          Transforms.setNodes(
            slate,
            { props: { ...cell.props, width } } as any,
            { at: cellPath, match: isTableCell }
          );
        }
      }
    });
  },

  toggleHeaderRow: (editor, blockId) => {
    const slate = getSlate(editor, blockId);
    if (!slate) return;

    Editor.withoutNormalizing(slate, () => {
      const tableEntry = getTableEntry(slate);
      if (!tableEntry) return;
      const [table, tablePath] = tableEntry;
      const newHeaderRow = !table.props?.headerRow;

      // Toggle asHeader on first row cells
      const firstRowCells = Editor.nodes(slate, {
        at: [...tablePath, 0],
        match: isTableCell,
      });

      for (const [node, cellPath] of firstRowCells) {
        const cell = node as unknown as AdvancedTableCellElement;
        Transforms.setNodes(
          slate,
          { props: { ...cell.props, asHeader: newHeaderRow } } as any,
          { at: cellPath, match: isTableCell }
        );
      }

      setTableProps(slate, tablePath, { ...table.props, headerRow: newHeaderRow });
    });
  },

  toggleHeaderColumn: (editor, blockId) => {
    const slate = getSlate(editor, blockId);
    if (!slate) return;

    Editor.withoutNormalizing(slate, () => {
      const tableEntry = getTableEntry(slate);
      if (!tableEntry) return;
      const [table, tablePath] = tableEntry;
      const newHeaderColumn = !table.props?.headerColumn;

      // Toggle asHeader on first cell of each row
      const rows = Editor.nodes(slate, {
        at: tablePath,
        match: isTableRow,
      });

      for (const [node, rowPath] of rows) {
        const row = node as unknown as AdvancedTableRowElement;
        const cell = row.children[0] as unknown as AdvancedTableCellElement;
        if (cell) {
          Transforms.setNodes(
            slate,
            { props: { ...cell.props, asHeader: newHeaderColumn } } as any,
            { at: [...rowPath, 0], match: isTableCell }
          );
        }
      }

      setTableProps(slate, tablePath, { ...table.props, headerColumn: newHeaderColumn });
    });
  },

  toggleAlternatingRows: (editor, blockId) => {
    const slate = getSlate(editor, blockId);
    if (!slate) return;

    Editor.withoutNormalizing(slate, () => {
      const tableEntry = getTableEntry(slate);
      if (!tableEntry) return;
      const [table, tablePath] = tableEntry;

      setTableProps(slate, tablePath, {
        ...table.props,
        alternatingRows: !table.props?.alternatingRows,
      });
    });
  },

  setCellBackgroundColor: (editor, blockId, path, color) => {
    const slate = getSlate(editor, blockId);
    if (!slate) return;

    Editor.withoutNormalizing(slate, () => {
      try {
        const [node] = Editor.node(slate, path);
        if (isTableCell(node)) {
          Transforms.setNodes(
            slate,
            { props: { ...node.props, backgroundColor: color } } as any,
            { at: path }
          );
        }
      } catch {
        // no-op
      }
    });
  },

  setRowBackgroundColor: (editor, blockId, rowIndex, color) => {
    const slate = getSlate(editor, blockId);
    if (!slate) return;

    Editor.withoutNormalizing(slate, () => {
      const rowPath = [0, rowIndex];
      try {
        const [row] = Editor.node(slate, rowPath);
        if (!isTableRow(row)) return;

        // Set on row
        Transforms.setNodes(
          slate,
          { props: { ...row.props, backgroundColor: color } } as any,
          { at: rowPath }
        );

        // Set on each cell
        row.children.forEach((cell, i) => {
          if (isTableCell(cell)) {
            Transforms.setNodes(
              slate,
              { props: { ...cell.props, backgroundColor: color } } as any,
              { at: [...rowPath, i] }
            );
          }
        });
      } catch {
        // no-op
      }
    });
  },

  setColumnBackgroundColor: (editor, blockId, columnIndex, color) => {
    const slate = getSlate(editor, blockId);
    if (!slate) return;

    Editor.withoutNormalizing(slate, () => {
      const tableEntry = getTableEntry(slate);
      if (!tableEntry) return;
      const [table, tablePath] = tableEntry;

      // Update table props only - column color is stored at table level
      // Individual cell colors are separate (set via setCellBackgroundColor)
      const columnBackgroundColors = { ...table.props?.columnBackgroundColors };
      if (color) columnBackgroundColors[columnIndex] = color;
      else delete columnBackgroundColors[columnIndex];

      setTableProps(slate, tablePath, { ...table.props, columnBackgroundColors });
    });
  },

  sortColumn: (editor, blockId, columnIndex, direction) => {
    const slate = getSlate(editor, blockId);
    if (!slate) return;

    Editor.withoutNormalizing(slate, () => {
      const tableEntry = getTableEntry(slate);
      if (!tableEntry) return;
      const [table, tablePath] = tableEntry;

      // Clear sort if null
      if (direction === null) {
        setTableProps(slate, tablePath, { ...table.props, sortInfo: undefined });
        return;
      }

      const hasHeaderRow = table.props?.headerRow;
      const columnType = table.props?.columnTypes?.[columnIndex] || 'text';

      const allRows = [...table.children].filter(isTableRow) as unknown as AdvancedTableRowElement[];
      const headerRows = hasHeaderRow ? allRows.slice(0, 1) : [];
      const dataRows = hasHeaderRow ? allRows.slice(1) : allRows;

      const sortedDataRows = [...dataRows].sort((a, b) => {
        const cellA = a.children[columnIndex] as unknown as AdvancedTableCellElement;
        const cellB = b.children[columnIndex] as unknown as AdvancedTableCellElement;
        const textA = getCellText(cellA);
        const textB = getCellText(cellB);

        // Date sorting
        if (columnType === 'date') {
          const dateA = textA ? new Date(textA) : null;
          const dateB = textB ? new Date(textB) : null;
          if (!dateA || isNaN(dateA.getTime())) return direction === 'asc' ? 1 : -1;
          if (!dateB || isNaN(dateB.getTime())) return direction === 'asc' ? -1 : 1;
          return direction === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
        }

        // Number sorting
        const numA = parseFloat(textA);
        const numB = parseFloat(textB);
        if (!isNaN(numA) && !isNaN(numB)) {
          return direction === 'asc' ? numA - numB : numB - numA;
        }

        // Text sorting
        const comparison = textA.localeCompare(textB);
        return direction === 'asc' ? comparison : -comparison;
      });

      const allSortedRows = [...headerRows, ...sortedDataRows];

      // Remove all rows and re-insert sorted
      for (let i = allRows.length - 1; i >= 0; i--) {
        Transforms.removeNodes(slate, { at: [...tablePath, i] });
      }
      allSortedRows.forEach((row, i) => {
        Transforms.insertNodes(slate, row as any, { at: [...tablePath, i] });
      });

      setTableProps(slate, tablePath, { ...table.props, sortInfo: { columnIndex, direction } });
    });
  },

  setColumnType: (editor, blockId, columnIndex, type) => {
    const slate = getSlate(editor, blockId);
    if (!slate) return;

    const tableEntry = getTableEntry(slate);
    if (!tableEntry) return;
    const [table, tablePath] = tableEntry;

    const columnTypes = { ...(table.props?.columnTypes || {}) };
    const oldType = columnTypes[columnIndex];
    columnTypes[columnIndex] = type;

    // Clear cell content if type changed
    if (oldType !== type) {
      table.children.forEach((row, rowIndex) => {
        if (rowIndex === 0 && table.props?.headerRow) return;
        if (!isTableRow(row)) return;
        
        Transforms.setNodes(
          slate,
          { children: [{ text: '' }] } as any,
          { at: [...tablePath, rowIndex, columnIndex] }
        );
      });
    }

    setTableProps(slate, tablePath, { ...table.props, columnTypes });
  },

  setColumnFilter: (editor, blockId, columnIndex, filter) => {
    const slate = getSlate(editor, blockId);
    if (!slate) return;

    const tableEntry = getTableEntry(slate);
    if (!tableEntry) return;
    const [table, tablePath] = tableEntry;

    const columnFilters = { ...(table.props?.columnFilters || {}) };
    if (filter) columnFilters[columnIndex] = filter;
    else delete columnFilters[columnIndex];

    setTableProps(slate, tablePath, { ...table.props, columnFilters });
  },

  setColumnAggregation: (editor, blockId, columnIndex, aggregation) => {
    const slate = getSlate(editor, blockId);
    if (!slate) return;

    const tableEntry = getTableEntry(slate);
    if (!tableEntry) return;
    const [table, tablePath] = tableEntry;

    const columnAggregations = { ...(table.props?.columnAggregations || {}) };
    if (aggregation) columnAggregations[columnIndex] = aggregation;
    else delete columnAggregations[columnIndex];

    setTableProps(slate, tablePath, { ...table.props, columnAggregations });
  },

  setColumnName: (editor, blockId, columnIndex, name) => {
    const slate = getSlate(editor, blockId);
    if (!slate) return;

    const tableEntry = getTableEntry(slate);
    if (!tableEntry) return;
    const [table, tablePath] = tableEntry;

    const columnNames = { ...(table.props?.columnNames || {}) };
    if (name) columnNames[columnIndex] = name;
    else delete columnNames[columnIndex];

    setTableProps(slate, tablePath, { ...table.props, columnNames });
  },

  toggleCalculationRow: (editor, blockId) => {
    const slate = getSlate(editor, blockId);
    if (!slate) return;

    const tableEntry = getTableEntry(slate);
    if (!tableEntry) return;
    const [table, tablePath] = tableEntry;

    setTableProps(slate, tablePath, {
      ...table.props,
      showCalculationRow: !table.props?.showCalculationRow,
    });
  },
};
