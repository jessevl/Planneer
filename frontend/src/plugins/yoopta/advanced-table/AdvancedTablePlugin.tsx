import { YooptaPlugin } from '@yoopta/editor';

import { AdvancedTableCommands } from './commands';
import { AdvancedTable } from './elements/AdvancedTable';
import { AdvancedTableDataCell } from './elements/AdvancedTableDataCell';
import { AdvancedTableRow } from './elements/AdvancedTableRow';
import { onKeyDown } from './events/onKeyDown';
import { withAdvancedTable } from './extensions/withAdvancedTable';
import type { AdvancedTableElement, AdvancedTableElementMap } from './types';
import {
  htmlTableToGrid,
  tableDataToHTML,
  tableDataToMarkdown,
  tableToClipboardData,
} from './utils/clipboard';
import { TABLE_SLATE_TO_SELECTION_SET } from './utils/weakMaps';

const AdvancedTablePlugin = new YooptaPlugin<AdvancedTableElementMap>({
  type: 'AdvancedTable',
  elements: {
    table: {
      render: AdvancedTable,
      asRoot: true,
      children: ['table-row'],
      props: {
        headerRow: false,
        headerColumn: false,
        alternatingRows: false,
        columnBackgroundColors: {},
        columnTypes: {},
        columnFilters: {},
        sortInfo: undefined,
        showCalculationRow: false,
      },
    },
    'table-row': {
      render: AdvancedTableRow,
      children: ['table-data-cell'],
      props: {
        backgroundColor: null,
      },
    },
    'table-data-cell': {
      render: AdvancedTableDataCell,
      props: {
        asHeader: false,
        width: 200,
        backgroundColor: null,
      },
    },
  },
  events: {
    onKeyDown,
    onBlur: (editor, slate) => () => {
      TABLE_SLATE_TO_SELECTION_SET.delete(slate);
    },
  },
  lifecycle: {
    beforeCreate(editor) {
      return AdvancedTableCommands.buildTableElements(editor, { rows: 3, columns: 3 });
    },
  },
  extensions: withAdvancedTable,
  options: {
    display: {
      title: 'Advanced Table (Alpha)',
      description: 'Add table with colors, sorting & column aggregations',
    },
    shortcuts: ['advanced-table', 'atable', 'stable'],
  },
  commands: AdvancedTableCommands,
  parsers: {
    html: {
      deserialize: {
        nodeNames: ['TABLE'],
        parse: (el, editor) => {
          if (el.nodeName !== 'TABLE') return;
          // Tables used for page layout (emails, newsletters) paste as their contents
          if (el.getAttribute('role') === 'presentation' || el.querySelector('table')) return;

          const grid = htmlTableToGrid(el as HTMLTableElement);
          if (grid.cells.length === 0 || grid.cells[0].length === 0) return;
          return AdvancedTableCommands.buildTableFromClipboard(editor, grid) as any;
        },
      },
      serialize: (element) =>
        tableDataToHTML(tableToClipboardData(element as unknown as AdvancedTableElement), { includeHeader: true }),
    },
    markdown: {
      serialize: (element) => tableDataToMarkdown(tableToClipboardData(element as unknown as AdvancedTableElement)),
    },
  },
});

export { AdvancedTablePlugin };
