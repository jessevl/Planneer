/**
 * @file TableToolbar.tsx
 * @description Toolbar for the advanced table's full view, styled after the whiteboard toolbar
 *
 * Features:
 * - Main row: undo/redo, insert/delete rows and columns, clear, table toggles, CSV export, close
 * - Column sub-bar (when a cell is selected): type, number format, decimals,
 *   alignment, sort, fill color and the full column menu
 * - Acts on the selected cell, or on every selected row/column for a range
 * - Buttons never take focus, so the table keeps its selection while clicking
 *
 * Used by:
 * - AdvancedTable.tsx (full view only)
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { YooEditor } from '@yoopta/editor';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownAZ,
  ArrowDownZA,
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Calendar,
  ChevronDown,
  DecimalsArrowLeft,
  DecimalsArrowRight,
  Download,
  Eraser,
  FileText,
  Hash,
  List,
  PaintBucket,
  Redo2,
  Rows3,
  Sigma,
  SlidersHorizontal,
  Snowflake,
  Tags,
  TableColumnsSplit,
  TableRowsSplit,
  Type,
  Undo2,
  X,
} from 'lucide-react';

import { cn } from '@/lib/design-system';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import { useConfirmStore } from '@/stores/confirmStore';
import { AdvancedTableCommands } from '../commands';
import type {
  AdvancedTableElement,
  BackgroundColor,
  ColumnAlignment,
  ColumnType,
  NumberFormat,
} from '../types';
import type { CellRect } from '../utils/cellRange';
import { CURRENCIES, effectiveDecimals, formatNumber } from '../utils/numberFormat';
import { ColorPicker } from './ColorPicker';

type Props = {
  editor: YooEditor;
  blockId: string;
  table: AdvancedTableElement;
  /** Selected cells, or null when the caret is not in the table */
  rect: CellRect | null;
  onClose: () => void;
  onExportCSV: () => void;
  onOpenColumnMenu: (columnIndex: number) => void;
};

type DropdownId = 'type' | 'format' | 'fill' | null;

const COLUMN_TYPES: { type: ColumnType; label: string; icon: typeof Type }[] = [
  { type: 'text', label: 'Text', icon: Type },
  { type: 'number', label: 'Number', icon: Hash },
  { type: 'date', label: 'Date', icon: Calendar },
  { type: 'select', label: 'Select', icon: List },
  { type: 'multi-select', label: 'Multi-select', icon: Tags },
  { type: 'page', label: 'Page', icon: FileText },
];

const I = 'w-[18px] h-[18px]';
const SUB_I = 'w-4 h-4';

/** Column letter as in spreadsheets: 0 → A, 26 → AA */
export function columnLetter(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** Keep the editor's focus and selection when a toolbar control is pressed */
const keepSelection = (e: React.MouseEvent) => {
  if ((e.target as HTMLElement).closest('input, select, textarea')) return;
  e.preventDefault();
};

// ============================================================================
// DROPDOWN (same look as the whiteboard toolbar's)
// ============================================================================

const Dropdown: React.FC<{
  trigger: React.ReactNode;
  title: string;
  isOpen: boolean;
  disabled?: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ trigger, title, isOpen, disabled, onToggle, children }) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left + rect.width / 2 });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) {
        onToggleRef.current();
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        title={title}
        disabled={disabled}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className={cn(
          'flex items-center gap-1 rounded-lg px-1.5 py-1 transition-colors flex-shrink-0',
          'text-[var(--color-text-secondary)] disabled:opacity-40 disabled:pointer-events-none',
          isOpen
            ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]'
            : 'hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]',
        )}
      >
        {trigger}
        <ChevronDown className={cn('w-3 h-3 transition-transform', isOpen && 'rotate-180')} />
      </button>
      {isOpen && createPortal(
        <div
          ref={panelRef}
          className="fixed p-2 rounded-xl z-[250] min-w-[160px] bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-white/10 shadow-xl"
          style={{ top: pos.top, left: pos.left, transform: 'translateX(-50%)' }}
          onMouseDown={keepSelection}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>,
        document.body,
      )}
    </>
  );
};

const MenuOption: React.FC<{ active?: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left transition-colors',
      active
        ? 'bg-[var(--color-accent-muted)] text-[var(--color-accent-primary)]'
        : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]',
    )}
  >
    {children}
  </button>
);

const PanelLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="block px-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase">{children}</span>
);

// ============================================================================
// TOOLBAR
// ============================================================================

const TableToolbar: React.FC<Props> = ({ editor, blockId, table, rect, onClose, onExportCSV, onOpenColumnMenu }) => {
  const isMobile = useIsMobile();
  const { requestConfirm } = useConfirmStore();
  const [openDD, setOpenDD] = useState<DropdownId>(null);
  const [fillScope, setFillScope] = useState<'cells' | 'rows' | 'columns'>('cells');

  const props = table.props ?? {};
  const rows = table.children as any[];
  const rowCount = rows.length;
  const columnCount = rows[0]?.children?.length ?? 0;
  const tablePath = rect?.tablePath ?? [0];

  const column = rect?.left ?? null;
  const columnType: ColumnType = column !== null ? props.columnTypes?.[column] || 'text' : 'text';
  const columnFormat = column !== null ? props.columnFormats?.[column] : undefined;
  const alignment: ColumnAlignment | null = column !== null
    ? props.columnAlignments?.[column] ?? (columnType === 'number' ? 'right' : 'left')
    : null;
  const sortDirection = column !== null && props.sortInfo?.columnIndex === column ? props.sortInfo.direction : null;
  const columnName = column !== null ? props.columnNames?.[column] || `Column ${column + 1}` : '';

  const toggle = (id: Exclude<DropdownId, null>) => setOpenDD((cur) => (cur === id ? null : id));

  // ---- Structure ----
  const cellPath = (r: number, c: number) => [...tablePath, r, c];

  const insertRow = (mode: 'before' | 'after') => {
    if (!rect) return;
    const r = mode === 'before' ? rect.top : rect.bottom;
    AdvancedTableCommands.insertTableRow(editor, blockId, { path: cellPath(r, rect.left), insertMode: mode, select: true });
  };

  const insertColumn = (mode: 'before' | 'after') => {
    if (!rect) return;
    const c = mode === 'before' ? rect.left : rect.right;
    AdvancedTableCommands.insertTableColumn(editor, blockId, { path: cellPath(rect.top, c), insertMode: mode, select: true });
  };

  // Delete from the end of the range backwards so earlier indices stay valid.
  // The commands refuse to remove the last remaining row or column.
  const deleteRows = () => {
    if (!rect) return;
    for (let r = rect.bottom; r >= rect.top; r--) {
      AdvancedTableCommands.deleteTableRow(editor, blockId, { path: cellPath(r, 0) });
    }
  };

  const deleteColumns = () => {
    if (!rect) return;
    for (let c = rect.right; c >= rect.left; c--) {
      AdvancedTableCommands.deleteTableColumn(editor, blockId, { path: cellPath(0, c) });
    }
  };

  // ---- Column properties ----
  const setType = (type: ColumnType) => {
    setOpenDD(null);
    if (column === null || type === columnType) return;
    const apply = () => AdvancedTableCommands.setColumnType(editor, blockId, column, type);
    const clears = type === 'page' || columnType === 'page';
    const hasContent = rows.some((row) => row.children?.[column]?.children?.some((t: any) => t.text?.trim()));
    if (clears && hasContent) {
      requestConfirm({
        title: 'Change Column Type?',
        message: type === 'page'
          ? 'Page columns hold links to pages, so the existing content in this column will be cleared.'
          : 'The page links in this column will be cleared.',
        detail: 'This action cannot be undone.',
        confirmLabel: 'Change Type',
        variant: 'warning',
        onConfirm: apply,
      });
      return;
    }
    apply();
  };

  const setFormat = (format: NumberFormat | null) => {
    if (column === null) return;
    AdvancedTableCommands.setColumnFormat(editor, blockId, column, format);
  };

  const columnValues = (): number[] =>
    column === null
      ? []
      : rows
          .map((row) => Number((row.children?.[column]?.children ?? []).map((t: any) => t.text ?? '').join('')))
          .filter((v) => Number.isFinite(v));

  const changeDecimals = (delta: 1 | -1) => {
    const current = effectiveDecimals(columnFormat, columnValues());
    const base: NumberFormat = columnFormat ?? { style: 'number', grouping: false };
    setFormat({ ...base, decimals: Math.max(0, Math.min(10, current + delta)) });
  };

  const applyFill = (color: BackgroundColor) => {
    if (!rect) return;
    if (fillScope === 'columns') {
      for (let c = rect.left; c <= rect.right; c++) AdvancedTableCommands.setColumnBackgroundColor(editor, blockId, c, color);
    } else if (fillScope === 'rows') {
      for (let r = rect.top; r <= rect.bottom; r++) AdvancedTableCommands.setRowBackgroundColor(editor, blockId, r, color);
    } else {
      for (let r = rect.top; r <= rect.bottom; r++) {
        for (let c = rect.left; c <= rect.right; c++) {
          AdvancedTableCommands.setCellBackgroundColor(editor, blockId, cellPath(r, c), color);
        }
      }
    }
    setOpenDD(null);
  };

  const currentFill: BackgroundColor = rect
    ? fillScope === 'columns'
      ? props.columnBackgroundColors?.[rect.left] ?? null
      : fillScope === 'rows'
        ? rows[rect.top]?.props?.backgroundColor ?? null
        : rows[rect.top]?.children?.[rect.left]?.props?.backgroundColor ?? null
    : null;

  // ---- Styling ----
  const toolBtn = cn(
    'flex items-center justify-center rounded-full flex-shrink-0 transition-colors disabled:opacity-35 disabled:pointer-events-none',
    isMobile ? 'w-10 h-10' : 'w-8 h-8',
  );
  const idleBtn = 'glass-header-btn text-[var(--color-text-tertiary)]';
  const subBtn = cn(
    'flex items-center justify-center rounded-full flex-shrink-0 glass-header-btn text-[var(--color-text-tertiary)] disabled:opacity-35 disabled:pointer-events-none',
    isMobile ? 'w-9 h-9' : 'w-7 h-7',
  );
  const activeBtn = 'bg-[var(--color-accent-muted)] !text-[var(--color-accent-primary)]';
  const divider = <div className="w-px h-5 bg-gray-200 dark:bg-white/10 mx-0.5 flex-shrink-0" />;
  const subDivider = <div className="w-px h-4 bg-gray-200 dark:bg-white/10 mx-0.5 flex-shrink-0" />;
  const noCell = !rect;

  const TypeIcon = COLUMN_TYPES.find((t) => t.type === columnType)?.icon ?? Type;
  const formatLabel = !columnFormat
    ? 'General'
    : columnFormat.style === 'currency'
      ? columnFormat.currency ?? 'EUR'
      : columnFormat.style === 'percent' ? 'Percent' : 'Number';

  const sample = 1234.5;
  const formatOptions: { label: string; format: NumberFormat | null }[] = [
    { label: 'General', format: null },
    { label: 'Number', format: { style: 'number', grouping: true, decimals: 2 } },
    { label: 'Percent', format: { style: 'percent', decimals: 0 } },
  ];

  return (
    <div
      // Rows stretch to the wider of the two, so the main row is never
      // narrower than the column sub-bar tucked behind it
      className="flex flex-col items-stretch fixed left-1/2 -translate-x-1/2 z-[240] max-w-[calc(100vw-24px)]"
      style={{ top: 'max(12px, env(safe-area-inset-top, 12px))' }}
      onMouseDown={keepSelection}
    >
      {/* ROW 1: TABLE ACTIONS */}
      <div className="glass-toolbar relative z-10 shadow-lg overflow-hidden max-w-full">
        <div className="excalidraw-toolbar-scroll flex items-center [justify-content:safe_center] gap-0.5 px-2 py-1 overflow-x-auto">
          <button type="button" title="Undo (⌘Z)" onClick={() => editor.undo()} className={cn(toolBtn, idleBtn)}>
            <Undo2 className={I} />
          </button>
          <button type="button" title="Redo (⌘⇧Z)" onClick={() => editor.redo()} className={cn(toolBtn, idleBtn)}>
            <Redo2 className={I} />
          </button>
          {divider}
          <button type="button" title="Insert row above" disabled={noCell} onClick={() => insertRow('before')} className={cn(toolBtn, idleBtn)}>
            <BetweenHorizontalStart className={I} />
          </button>
          <button type="button" title="Insert row below" disabled={noCell} onClick={() => insertRow('after')} className={cn(toolBtn, idleBtn)}>
            <BetweenHorizontalEnd className={I} />
          </button>
          <button type="button" title="Insert column left" disabled={noCell} onClick={() => insertColumn('before')} className={cn(toolBtn, idleBtn)}>
            <BetweenVerticalStart className={I} />
          </button>
          <button type="button" title="Insert column right" disabled={noCell} onClick={() => insertColumn('after')} className={cn(toolBtn, idleBtn)}>
            <BetweenVerticalEnd className={I} />
          </button>
          <button type="button" title="Delete selected rows" disabled={noCell || rowCount <= 1} onClick={deleteRows}
            className={cn(toolBtn, idleBtn, 'hover:!text-red-600 dark:hover:!text-red-400')}>
            <TableRowsSplit className={I} />
          </button>
          <button type="button" title="Delete selected columns" disabled={noCell || columnCount <= 1} onClick={deleteColumns}
            className={cn(toolBtn, idleBtn, 'hover:!text-red-600 dark:hover:!text-red-400')}>
            <TableColumnsSplit className={I} />
          </button>
          <button type="button" title="Clear selected cells" disabled={noCell}
            onClick={() => rect && AdvancedTableCommands.clearCells(editor, blockId, rect)} className={cn(toolBtn, idleBtn)}>
            <Eraser className={I} />
          </button>
          {divider}
          <button type="button" title="Banded rows" onClick={() => AdvancedTableCommands.toggleAlternatingRows(editor, blockId)}
            className={cn(toolBtn, props.alternatingRows ? activeBtn : idleBtn)}>
            <Rows3 className={I} />
          </button>
          <button type="button" title="Totals row" onClick={() => AdvancedTableCommands.toggleCalculationRow(editor, blockId)}
            className={cn(toolBtn, props.showCalculationRow ? activeBtn : idleBtn)}>
            <Sigma className={I} />
          </button>
          <button type="button" title="Freeze first column" onClick={() => AdvancedTableCommands.toggleFreezeFirstColumn(editor, blockId)}
            className={cn(toolBtn, props.freezeFirstColumn ? activeBtn : idleBtn)}>
            <Snowflake className={I} />
          </button>
          {divider}
          <button type="button" title="Download as CSV" onClick={onExportCSV} className={cn(toolBtn, idleBtn)}>
            <Download className={I} />
          </button>
          {divider}
          <button type="button" title="Exit full view (Esc)" onClick={onClose}
            className={cn(toolBtn, 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-red-600 dark:hover:text-red-400')}>
            <X className={I} />
          </button>
        </div>
      </div>

      {/* ROW 2: COLUMN SUB-BAR (tucked behind row 1, like the whiteboard's property bar) */}
      <div
        className={cn(
          'glass-toolbar-lighter relative overflow-hidden max-w-full -mt-6 border-t-0 shadow-md transition-all duration-200',
          // Out of the layout while hidden so it doesn't widen the main row
          rect ? 'opacity-100 translate-y-0' : 'absolute inset-x-0 top-full opacity-0 -translate-y-2 pointer-events-none h-0 !py-0 !border-0',
        )}
        style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}
      >
        <div className="excalidraw-subbar-scroll flex items-center [justify-content:safe_center] gap-1 px-5 pt-7 pb-1 overflow-x-auto">
          <span className="text-[11px] font-medium text-[var(--color-text-tertiary)] whitespace-nowrap px-1 max-w-[140px] truncate" title={columnName}>
            {column !== null && `${columnLetter(column)} · ${columnName}`}
          </span>
          {subDivider}

          {/* Column type */}
          <Dropdown
            title="Column type"
            isOpen={openDD === 'type'}
            onToggle={() => toggle('type')}
            trigger={<span className="flex items-center gap-1 text-[11px] font-medium whitespace-nowrap"><TypeIcon className="w-3.5 h-3.5" />{COLUMN_TYPES.find((t) => t.type === columnType)?.label}</span>}
          >
            <PanelLabel>Column type</PanelLabel>
            {COLUMN_TYPES.map((t) => (
              <MenuOption key={t.type} active={t.type === columnType} onClick={() => setType(t.type)}>
                <t.icon className="w-4 h-4" /> {t.label}
              </MenuOption>
            ))}
          </Dropdown>

          {/* Number format + decimals (number columns only) */}
          {columnType === 'number' && (<>
            <Dropdown
              title="Number format"
              isOpen={openDD === 'format'}
              onToggle={() => toggle('format')}
              trigger={<span className="text-[11px] font-medium whitespace-nowrap">{formatLabel}</span>}
            >
              <PanelLabel>Format</PanelLabel>
              {formatOptions.map((o) => (
                <MenuOption
                  key={o.label}
                  active={o.format === null ? !columnFormat : columnFormat?.style === o.format.style}
                  onClick={() => { setFormat(o.format); setOpenDD(null); }}
                >
                  <span className="flex-1">{o.label}</span>
                  <span className="text-[11px] text-[var(--color-text-tertiary)] tabular-nums">
                    {o.format ? formatNumber(o.format.style === 'percent' ? 0.125 : sample, o.format) : String(sample)}
                  </span>
                </MenuOption>
              ))}
              <div className="my-1 border-t border-gray-100 dark:border-white/5" />
              <PanelLabel>Currency</PanelLabel>
              <div className="grid grid-cols-3 gap-1 px-1">
                {CURRENCIES.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      setFormat({ style: 'currency', currency: code, decimals: columnFormat?.decimals, grouping: true });
                      setOpenDD(null);
                    }}
                    className={cn(
                      'px-1.5 py-1 rounded-md text-xs transition-colors',
                      columnFormat?.style === 'currency' && columnFormat.currency === code
                        ? 'bg-[var(--color-accent-muted)] text-[var(--color-accent-primary)]'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]',
                    )}
                  >
                    {code}
                  </button>
                ))}
              </div>
            </Dropdown>
            <button type="button" title="Fewer decimals" onClick={() => changeDecimals(-1)} className={subBtn}>
              <DecimalsArrowLeft className={SUB_I} />
            </button>
            <button type="button" title="More decimals" onClick={() => changeDecimals(1)} className={subBtn}>
              <DecimalsArrowRight className={SUB_I} />
            </button>
          </>)}
          {subDivider}

          {/* Alignment */}
          {([
            ['left', AlignLeft, 'Align left'],
            ['center', AlignCenter, 'Align center'],
            ['right', AlignRight, 'Align right'],
          ] as const).map(([value, Icon, title]) => (
            <button
              key={value}
              type="button"
              title={title}
              onClick={() => {
                if (!rect) return;
                for (let c = rect.left; c <= rect.right; c++) AdvancedTableCommands.setColumnAlignment(editor, blockId, c, value);
              }}
              className={cn(subBtn, alignment === value && activeBtn)}
            >
              <Icon className={SUB_I} />
            </button>
          ))}
          {subDivider}

          {/* Sort */}
          <button type="button" title="Sort ascending" onClick={() => column !== null && AdvancedTableCommands.sortColumn(editor, blockId, column, 'asc')}
            className={cn(subBtn, sortDirection === 'asc' && activeBtn)}>
            <ArrowDownAZ className={SUB_I} />
          </button>
          <button type="button" title="Sort descending" onClick={() => column !== null && AdvancedTableCommands.sortColumn(editor, blockId, column, 'desc')}
            className={cn(subBtn, sortDirection === 'desc' && activeBtn)}>
            <ArrowDownZA className={SUB_I} />
          </button>
          {subDivider}

          {/* Fill color */}
          <Dropdown
            title="Fill color"
            isOpen={openDD === 'fill'}
            onToggle={() => toggle('fill')}
            trigger={<PaintBucket className="w-3.5 h-3.5" />}
          >
            <div className="flex gap-1 p-1 mb-1 rounded-lg bg-[var(--color-surface-secondary)]">
              {(['cells', 'rows', 'columns'] as const).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setFillScope(scope)}
                  className={cn(
                    'flex-1 px-2 py-1 rounded-md text-xs capitalize transition-colors',
                    fillScope === scope
                      ? 'bg-[var(--color-surface-base)] text-[var(--color-text-primary)] shadow-sm'
                      : 'text-[var(--color-text-secondary)]',
                  )}
                >
                  {scope}
                </button>
              ))}
            </div>
            <ColorPicker selectedColor={currentFill} onColorSelect={applyFill} />
          </Dropdown>

          <button type="button" title="Column options (filter, totals, rename…)" onClick={() => column !== null && onOpenColumnMenu(column)} className={subBtn}>
            <SlidersHorizontal className={SUB_I} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TableToolbar;
