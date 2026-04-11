import type {
  AdvancedTableCellElement,
  AdvancedTableElement,
  AdvancedTableRowElement,
} from './types';
import './styles.css';
import { AdvancedTablePlugin } from './AdvancedTablePlugin';

export { AdvancedTableCommands } from './commands';
export { AdvancedTablePlugin };

export type {
  AdvancedTableElement,
  AdvancedTableRowElement,
  AdvancedTableCellElement,
  AdvancedTableElementMap,
  AdvancedTableElementProps,
  AdvancedTableDataCellElementProps,
  AdvancedTableRowElementProps,
  BackgroundColor,
  SortDirection,
} from './types';

export default AdvancedTablePlugin;
