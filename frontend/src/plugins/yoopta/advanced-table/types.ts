import type { SlateElement } from '@yoopta/editor';

export type AdvancedTablePluginElementKeys = 'table' | 'table-row' | 'table-data-cell';

// Background color for cells, rows, or columns
export type BackgroundColor = string | null;

// Sorting direction
export type SortDirection = 'asc' | 'desc' | null;

// Column sorting information stored at table level
export type ColumnSortInfo = {
  columnIndex: number;
  direction: SortDirection;
};

// Cell properties with advanced features
export type AdvancedTableDataCellElementProps = {
  width: number;
  asHeader: boolean;
  backgroundColor?: BackgroundColor;
};

// Row properties with background color support
export type AdvancedTableRowElementProps = {
  backgroundColor?: BackgroundColor;
};

// Aggregation types for column footers
export type AggregationType = 'count' | 'sum' | 'average' | 'min' | 'max' | 'median';

// Column types
export type ColumnType = 'text' | 'number' | 'date' | 'select' | 'multi-select' | 'page';

// Horizontal alignment of a column's cells
export type ColumnAlignment = 'left' | 'center' | 'right';

// How a number column displays its values. Cells always store plain numbers
// ("53166.5"); the format only changes what is shown.
export type NumberFormat = {
  style: 'number' | 'currency' | 'percent';
  /** ISO 4217 code, used when style is 'currency' */
  currency?: string;
  /** Fixed number of decimals; undefined shows as many as the value has */
  decimals?: number;
  /** Thousands separators (default on) */
  grouping?: boolean;
};

// Filter information
export type ColumnFilter = {
  type: ColumnType;
  value: any;
  operator?: 'eq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'not_in' | 'before' | 'after' | 'on' | 'between';
  // For date ranges or multi-value filters
  value2?: any;
};

// Table properties with sorting, column colors, and alternating rows
export type AdvancedTableElementProps = {
  headerRow?: boolean;
  headerColumn?: boolean;
  // Alternating row colors (zebra striping)
  alternatingRows?: boolean;
  // Column-level background colors (indexed by column position)
  columnBackgroundColors?: Record<number, BackgroundColor>;
  // Column-level aggregations (indexed by column position)
  columnAggregations?: Record<number, AggregationType>;
  // Column types (indexed by column position)
  columnTypes?: Record<number, ColumnType>;
  // Column filters (indexed by column position)
  columnFilters?: Record<number, ColumnFilter>;
  // Column names (indexed by column position)
  columnNames?: Record<number, string>;
  // Current column sort
  sortInfo?: ColumnSortInfo;
  // Whether to show the calculation row at the bottom
  showCalculationRow?: boolean;
  // Column alignment (indexed by column position); defaults depend on type
  columnAlignments?: Record<number, ColumnAlignment>;
  // Display formats for number columns (indexed by column position)
  columnFormats?: Record<number, NumberFormat>;
  // Keep the first column in view when scrolling sideways
  freezeFirstColumn?: boolean;
};

export type AdvancedTableElement = SlateElement<'table', AdvancedTableElementProps>;
export type AdvancedTableCellElement = SlateElement<'table-data-cell', AdvancedTableDataCellElementProps>;
export type AdvancedTableRowElement = SlateElement<'table-row', AdvancedTableRowElementProps>;

export type AdvancedTableElementMap = {
  table: AdvancedTableElement;
  'table-data-cell': AdvancedTableCellElement;
  'table-row': AdvancedTableRowElement;
};

export type InsertAdvancedTableOptions = {
  rows: number;
  columns: number;
  columnWidth?: number;
  headerColumn?: boolean;
  headerRow?: boolean;
};
