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
