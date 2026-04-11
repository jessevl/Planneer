import { useMemo, useState, useRef, useEffect } from 'react';
import type { PluginElementRenderProps } from '@yoopta/editor';
import { useBlockData, useYooptaEditor, Elements } from '@yoopta/editor';
import { UI } from '@/plugins/yoopta/editor-ui/ui-compat';
import { Editor, Element, Transforms } from 'slate';
import { SearchX, Plus } from 'lucide-react';
import { useFloating, offset, flip, shift, autoUpdate } from '@floating-ui/react';

import { AdvancedTableBlockOptions } from '../components/AdvancedTableBlockOptions';
import { AdvancedTableColumnOptions } from '../components/AdvancedTableColumnOptions';
import ColumnHeader from '../components/ColumnHeader';
import { AdvancedTableCommands } from '../commands';
import type { AdvancedTableElement, AdvancedTableCellElement, AdvancedTableRowElement } from '../types';
import { TABLE_SLATE_TO_SELECTION_SET } from '../utils/weakMaps';
import { getCellText } from '../utils/cellUtils';
import { resolveColor } from '@/lib/editorColors';
import { useIsDarkMode } from '@/hooks/useIsDarkMode';
import { usePagesStore } from '@/stores/pagesStore';

const { Portal, Overlay } = UI;

// ============================================================================
// ADVANCED TABLE COMPONENT
// ============================================================================

const AdvancedTable = ({
  attributes,
  children,
  blockId,
  element,
  HTMLAttributes,
}: PluginElementRenderProps) => {
  const editor = useYooptaEditor();
  const isDark = useIsDarkMode();
  const slate = editor.blockEditorsMap[blockId];
  const blockData = useBlockData(blockId);
  const isReadOnly = editor.readOnly;

  const [activeColumnIndex, setActiveColumnIndex] = useState<number | null>(null);
  const headerRefs = useRef<(HTMLTableHeaderCellElement | null)[]>([]);
  const tableRef = useRef<HTMLTableElement | null>(null);

  const { refs, floatingStyles } = useFloating({
    placement: 'bottom-start',
    open: activeColumnIndex !== null,
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const isSelecting = TABLE_SLATE_TO_SELECTION_SET.get(slate);
  
  // Get table props for styling classes
  const tableElement = element as unknown as AdvancedTableElement;
  const tableProps = tableElement?.props || {};
  const { 
    headerRow, 
    alternatingRows, 
    columnFilters, 
    columnTypes, 
    columnAggregations, 
    showCalculationRow,
    sortInfo,
    columnNames = {}
  } = tableProps;

  // Set reference element when active column changes
  useEffect(() => {
    if (activeColumnIndex !== null && headerRefs.current[activeColumnIndex]) {
      refs.setReference(headerRefs.current[activeColumnIndex]);
    }
  }, [activeColumnIndex, refs]);

  // Filter rows
  const filteredChildren = useMemo(() => {
    if (!columnFilters || Object.keys(columnFilters).length === 0) return children;

    const rows = tableElement.children as unknown as AdvancedTableRowElement[];
    
    return (children as React.ReactElement[]).filter((child, index) => {
      // Always show header row
      if (index === 0 && headerRow) return true;

      const row = rows[index];
      if (!row) return true;

      // Check all filters
      return Object.entries(columnFilters).every(([colIdx, filter]) => {
        const columnIndex = parseInt(colIdx);
        const cell = row.children[columnIndex] as unknown as AdvancedTableCellElement;
        if (!cell) return true;

        const text = getCellText(cell);
        const type = columnTypes?.[columnIndex] || 'text';

        if (!filter || (!filter.value && filter.value !== 0)) return true;

        try {
          switch (type) {
            case 'text':
              if (filter.operator === 'contains') {
                return text.toLowerCase().includes(String(filter.value).toLowerCase());
              }
              return text.toLowerCase() === String(filter.value).toLowerCase();
            
            case 'number':
              const num = parseFloat(text);
              const filterNum = parseFloat(filter.value);
              if (isNaN(num) || isNaN(filterNum)) return true;
              if (filter.operator === 'gt') return num > filterNum;
              if (filter.operator === 'lt') return num < filterNum;
              if (filter.operator === 'gte') return num >= filterNum;
              if (filter.operator === 'lte') return num <= filterNum;
              return num === filterNum;

            case 'select':
            case 'multi-select':
              const tags = text.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
              const filterVal = String(filter.value).toLowerCase();
              if (Array.isArray(filter.value)) {
                const hasMatch = filter.value.some(v => tags.includes(String(v).toLowerCase()));
                return filter.operator === 'not_in' ? !hasMatch : hasMatch;
              }
              const hasTag = tags.includes(filterVal);
              return filter.operator === 'not_in' ? !hasTag : hasTag;

            case 'date':
              if (!text || !filter.value) return true;
              const cellDate = new Date(text);
              const filterDate = new Date(filter.value);
              if (isNaN(cellDate.getTime()) || isNaN(filterDate.getTime())) return true;
              
              if (filter.operator === 'before') {
                return cellDate < filterDate;
              }
              if (filter.operator === 'after') {
                return cellDate > filterDate;
              }
              // Default 'on'
              return cellDate.toISOString().split('T')[0] === filterDate.toISOString().split('T')[0];

            case 'page':
              // Cell contains page ID - lookup page title for filtering
              const linkedPageId = text;
              const pagesById = usePagesStore.getState().pagesById;
              const linkedPage = pagesById[linkedPageId];
              const pageTitle = linkedPage?.title?.toLowerCase() || '';
              const filterValue = String(filter.value).toLowerCase();
              if (filter.operator === 'contains') {
                return pageTitle.includes(filterValue);
              }
              return pageTitle === filterValue;

            default:
              return true;
          }
        } catch (e) {
          console.error('Filter error:', e);
          return true;
        }
      });
    });
  }, [children, columnFilters, tableElement.children, headerRow, columnTypes]);

  // Calculate aggregations
  const aggregationResults = useMemo(() => {
    if (!showCalculationRow) return null;

    const rows = tableElement.children as unknown as AdvancedTableRowElement[];
    const dataRows = headerRow ? rows.slice(1) : rows;
    const results: Record<number, any> = {};

    const columnsCount = rows[0]?.children?.length || 0;

    for (let i = 0; i < columnsCount; i++) {
      const aggType = columnAggregations?.[i];
      if (!aggType) continue;

      const values = dataRows.map(row => {
        const cell = row.children[i] as unknown as AdvancedTableCellElement;
        return getCellText(cell);
      }).filter(Boolean);

      if (aggType === 'count') {
        results[i] = values.length;
        continue;
      }

      const numValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
      if (numValues.length === 0) {
        results[i] = '-';
        continue;
      }

      try {
        switch (aggType) {
          case 'sum':
            results[i] = numValues.reduce((a, b) => a + b, 0);
            break;
          case 'average':
            results[i] = (numValues.reduce((a, b) => a + b, 0) / numValues.length).toFixed(2);
            break;
          case 'min':
            results[i] = Math.min(...numValues);
            break;
          case 'max':
            results[i] = Math.max(...numValues);
            break;
          case 'median':
            const sorted = [...numValues].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            results[i] = sorted.length % 2 !== 0 ? sorted[mid] : ((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2);
            break;
        }
      } catch (e) {
        console.error('Aggregation error:', e);
        results[i] = 'Error';
      }
    }

    return results;
  }, [showCalculationRow, tableElement.children, headerRow, columnAggregations]);

  const { className, ...htmlAttrs } = HTMLAttributes || {};
  
  // Build table class names
  const tableClasses = [
    'yoopta-advanced-table',
    isSelecting ? 'yoopta-advanced-table-selecting' : '',
    alternatingRows ? 'yoopta-advanced-table-alternating' : '',
    headerRow ? 'yoopta-advanced-table-has-header' : '',
    showCalculationRow ? 'yoopta-advanced-table-has-calculation-row' : '',
  ].filter(Boolean).join(' ');

  const columnsCount = (tableElement.children[0] as any)?.children?.length || 0;
  const rowsCount = tableElement.children?.length || 0;
  const hasNoResults = (filteredChildren as any[]).length === (headerRow ? 1 : 0);

  // Quick add row at the bottom
  const handleAddRow = () => {
    if (isReadOnly) return;
    // Get the last row path and add after it
    const lastRowPath = [0, rowsCount - 1, 0];
    AdvancedTableCommands.insertTableRow(editor, blockId, { 
      path: lastRowPath,
      insertMode: 'after',
      select: true,
    });
  };

  // Quick add column on the right
  const handleAddColumn = () => {
    if (isReadOnly) return;
    // Get the last column path and add after it
    const lastColumnPath = [0, 0, columnsCount - 1];
    AdvancedTableCommands.insertTableColumn(editor, blockId, { 
      path: lastColumnPath,
      insertMode: 'after',
      columnType: 'text',
      select: true,
    });
  };

  return (
    <div 
      className={`yoopta-advanced-table-block ${className || ''} relative group`}
    >
      {/* Block options - absolutely positioned top-right by CSS */}
      {!isReadOnly && (
        <div className="yoopta-advanced-table-options" contentEditable={false}>
          <AdvancedTableBlockOptions
            block={blockData}
            editor={editor}
            table={element as unknown as AdvancedTableElement}
          />
        </div>
      )}

      {/* Horizontal scroll container - table + add buttons */}
      <div
        className="overflow-x-auto overflow-y-visible"
      >
      <div className="relative inline-block overflow-visible pr-5 pb-5">
        <div className={`yoopta-advanced-table-wrapper ${showCalculationRow ? 'yoopta-advanced-table-wrapper-has-calculation-row' : ''}`}>
        <table
          ref={tableRef}
          {...htmlAttrs}
          className={tableClasses}
        >
        <thead>
          <tr className="yoopta-advanced-table-metadata-row">
            {Array.from({ length: columnsCount }).map((_, i) => {
              const type = columnTypes?.[i] || 'text';
              const isFiltered = !!columnFilters?.[i];
              const isSorted = sortInfo?.columnIndex === i;
              const columnName = columnNames[i] || `Column ${i + 1}`;
              const columnWidth = (tableElement.children[0] as any)?.children[i]?.props?.width || 200;

              const onResize = (newWidth: number) => {
                AdvancedTableCommands.updateColumnWidth(editor, blockId, i, newWidth);
              };

              return (
                <ColumnHeader
                  key={i}
                  ref={(el) => (headerRefs.current[i] = el as any)}
                  editor={editor}
                  blockId={blockId}
                  columnIndex={i}
                  columnType={type}
                  columnName={columnName}
                  isFiltered={isFiltered}
                  currentFilter={columnFilters?.[i] || null}
                  isSorted={isSorted}
                  sortDirection={isSorted ? sortInfo?.direction || null : null}
                  width={columnWidth}
                  isReadOnly={isReadOnly}
                  onOpenOptions={() => setActiveColumnIndex(i)}
                  onResize={onResize}
                />
              );
            })}
          </tr>
        </thead>
        <tbody {...attributes}>
          {filteredChildren}
          
          {hasNoResults && (
            <tr className="yoopta-advanced-table-no-results">
              <td colSpan={columnsCount} className="py-8 text-center">
                <div className="flex flex-col items-center gap-2 text-[var(--color-text-tertiary)]">
                  <SearchX className="w-8 h-8 opacity-20" />
                  <span className="text-sm">No matching results</span>
                  <button 
                    className="text-xs text-[var(--color-accent-primary)] hover:underline mt-1"
                    onClick={() => {
                      // Clear all filters
                      Object.keys(columnFilters || {}).forEach(colIdx => {
                        AdvancedTableCommands.setColumnFilter(editor, blockId, parseInt(colIdx), null);
                      });
                    }}
                  >
                    Clear all filters
                  </button>
                </div>
              </td>
            </tr>
          )}
          
          {showCalculationRow && (
            <tr className="yoopta-advanced-table-calculation-row border-t-2" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'color-mix(in srgb, var(--color-surface-inset) 50%, var(--color-surface-primary))' }}>
              {Array.from({ length: columnsCount }).map((_, i) => (
                <td 
                  key={i} 
                  className="px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] text-right border-r border-[var(--color-border-default)] last:border-r-0"
                >
                  {aggregationResults?.[i] !== undefined && (
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] uppercase tracking-wider opacity-70">
                        {columnAggregations?.[i]}
                      </span>
                      <span className="text-sm text-[var(--color-text-primary)]">
                        {aggregationResults[i]}
                      </span>
                    </div>
                  )}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
      </div>{/* end yoopta-advanced-table-wrapper */}

      {/* Quick Add Row Button - appears on hover at bottom inside padding area */}
      {!isReadOnly && (
        <button
          type="button"
          onClick={handleAddRow}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 h-7 w-7 flex items-center justify-center
            opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150
            rounded-full border shadow-sm z-20"
          style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-surface-base)', color: 'var(--color-text-secondary)' }}
          title="Add row"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}

      {/* Quick Add Column Button - appears on hover at right inside padding area */}
      {!isReadOnly && (
        <button
          type="button"
          onClick={handleAddColumn}
          className="absolute right-0 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center
            opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150
            rounded-full border shadow-sm z-20"
          style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-surface-base)', color: 'var(--color-text-secondary)' }}
          title="Add column"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}
      </div>
      </div>{/* end scroll container */}
      
      {activeColumnIndex !== null && (
        <AdvancedTableColumnOptions
          key={`${blockId}-${activeColumnIndex}`}
          editor={editor}
          blockId={blockId}
          columnIndex={activeColumnIndex}
          isOpen={true}
          onClose={() => setActiveColumnIndex(null)}
          refs={refs}
          style={floatingStyles}
        />
      )}

    </div>
  );
};

export { AdvancedTable };
