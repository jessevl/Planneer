import { useMemo, useState, useCallback } from 'react';
import type { PluginElementRenderProps } from '@yoopta/editor';
import { Elements, useYooptaEditor } from '@yoopta/editor';
import { UI } from '@/plugins/yoopta/editor-ui/ui-compat';
import { Editor, Element, Transforms, Node, Text } from 'slate';
import dayjs from 'dayjs';
import { Calendar, AlertCircle } from 'lucide-react';
import { useFloating, offset, flip, shift, autoUpdate } from '@floating-ui/react';

import { AdvancedTableCommands } from '../commands';
import { AdvancedTableRowDragButton } from '../components/AdvancedTableRowDragButton';
import PageCellPicker from '../components/PageCellPicker';
import { InlineTagInput, Popover } from '@/components/ui';
import { resolveColor } from '@/lib/editorColors';
import { useIsDarkMode } from '@/hooks/useIsDarkMode';
import CalendarPicker from '@/components/common/CalendarPicker';
import { usePagesStore } from '@/stores/pagesStore';

const { Portal } = UI;

import type {
  AdvancedTableCellElement,
  AdvancedTableElement,
  AdvancedTableElementProps,
  AggregationType,
  ColumnType,
} from '../types';
import { TABLE_SLATE_TO_SELECTION_SET } from '../utils/weakMaps';

const AdvancedTableDataCell = ({
  attributes,
  children,
  element,
  blockId,
  HTMLAttributes,
}: PluginElementRenderProps) => {
  const editor = useYooptaEditor();
  const isDark = useIsDarkMode();
  const slate = editor.blockEditorsMap[blockId];
  const cellElement = element as unknown as AdvancedTableCellElement;

  // Get active page for "page" column type
  const activePageId = usePagesStore((s) => s.activePageId);

  const [showDatePicker, setShowDatePicker] = useState(false);

  const { refs, floatingStyles } = useFloating({
    placement: 'bottom',
    open: showDatePicker,
    onOpenChange: setShowDatePicker,
    middleware: [offset(5), flip(), shift()],
    whileElementsMounted: autoUpdate,
    strategy: 'fixed',
  });

  const path = Elements.getElementPath(editor, { blockId, element });
  const selected = TABLE_SLATE_TO_SELECTION_SET.get(slate)?.has(cellElement);
  const asHeader = cellElement?.props?.asHeader || false;
  const backgroundColor = cellElement?.props?.backgroundColor;

  const tableProps = useMemo(() => {
    if (!path) return null;
    
    try {
      const tableElementEntry = Editor.above<AdvancedTableElement>(slate, {
        at: path,
        match: (n) => Element.isElement(n) && (n as unknown as AdvancedTableElement).type === 'table',
      });

      if (!tableElementEntry) return null;
      const [tableElement] = tableElementEntry;

      return {
        tableElement,
        headerRow: tableElement?.props?.headerRow || false,
        headerColumn: tableElement?.props?.headerColumn || false,
        columnBackgroundColors: tableElement?.props?.columnBackgroundColors || {},
        columnAggregations: tableElement?.props?.columnAggregations || {},
        columnTypes: tableElement?.props?.columnTypes || {},
        columnFilters: tableElement?.props?.columnFilters || {},
        sortInfo: tableElement?.props?.sortInfo,
        rowCount: tableElement?.children?.length || 0,
      };
    } catch {
      return null;
    }
  }, [slate, path]);

  const { 
    tableElement,
    headerRow, 
    headerColumn, 
    columnBackgroundColors, 
    columnAggregations, 
    columnTypes, 
    columnFilters,
    sortInfo,
    rowCount 
  } = tableProps || {};

  const columnIndex = path?.[path.length - 1] || 0;
  const rowIndex = path?.[path.length - 2] || 0;
  const elementWidth = cellElement?.props?.width || 200;

  const isFirstDataCell = path?.[path.length - 1] === 0;
  const isFirstRow = path?.[path.length - 2] === 0;

  const columnType = columnTypes?.[columnIndex] || 'text';
  const isFiltered = !!columnFilters?.[columnIndex];
  const isSorted = sortInfo?.columnIndex === columnIndex;

  let isDataCellAsHeader = false;

  if (isFirstRow && headerRow) {
    isDataCellAsHeader = true;
  }

  if (isFirstDataCell && headerColumn) {
    isDataCellAsHeader = true;
  }

  // Only handle number input validation - Enter is handled in onKeyDown.ts
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (columnType === 'number') {
      // Allow: backspace, delete, tab, escape, enter, decimal point, and minus sign
      if ([46, 8, 9, 27, 13, 110, 190, 189, 109].includes(e.keyCode) ||
          // Allow: Ctrl+A, Command+A, Ctrl+C, Command+C, Ctrl+V, Command+V, Ctrl+X, Command+X
          ((e.ctrlKey === true || e.metaKey === true) && [65, 67, 86, 88].includes(e.keyCode)) ||
          // Allow: home, end, left, right, down, up
          (e.keyCode >= 35 && e.keyCode <= 40)) {
               return;
      }
      // Ensure that it is a number and stop the keypress
      if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
          e.preventDefault();
      }
    }
  };

  // Handle paste for number columns
  const onPaste = (e: React.ClipboardEvent) => {
    if (columnType === 'number') {
      const pastedText = e.clipboardData.getData('text/plain');
      // Allow paste only if it's a valid number
      if (!/^-?\d*\.?\d*$/.test(pastedText)) {
        e.preventDefault();
      }
    }
  };

  // Update cell text for date/tag pickers - safe text replacement
  const updateCellText = useCallback((newText: string) => {
    if (!path) return;
    
    Editor.withoutNormalizing(slate, () => {
      try {
        // Find the text node path within the cell (always at path + [0])
        const textPath = [...path, 0];
        
        // Get current text node
        const [textNode] = Editor.node(slate, textPath);
        if (!textNode || !Text.isText(textNode)) return;
        
        // Get the current text length
        const currentText = textNode.text || '';
        
        // Select all text in the cell and replace it
        if (currentText.length > 0) {
          Transforms.select(slate, {
            anchor: { path: textPath, offset: 0 },
            focus: { path: textPath, offset: currentText.length }
          });
          Transforms.insertText(slate, newText);
        } else {
          // Cell is empty, just insert at the start
          Transforms.insertText(slate, newText, { at: { path: textPath, offset: 0 } });
        }
      } catch (err) {
        console.error('Failed to update cell text:', err);
      }
    });
  }, [slate, path]);

  const CellTag: 'th' | 'td' = isDataCellAsHeader ? 'th' : 'td';

  // Determine final background color (cell > column > row)
  const columnColorName = columnBackgroundColors && columnBackgroundColors[columnIndex];
  const cellColorName = backgroundColor;
  
  const resolvedCellColor = resolveColor(cellColorName, isDark);
  const resolvedColumnColor = resolveColor(columnColorName, isDark);

  const finalBgColor = resolvedCellColor?.bg || resolvedColumnColor?.bg || undefined;
  const finalTextColor = resolvedCellColor?.text || resolvedColumnColor?.text || undefined;

  const style: React.CSSProperties = {
    maxWidth: elementWidth,
    minWidth: elementWidth,
    backgroundColor: finalBgColor,
    color: finalTextColor,
  };

  const { className: extendedClassName = '', ...htmlAttrs } = HTMLAttributes || {};

  // Extract cell text
  const cellText = cellElement.children
    // @ts-expect-error - mixed Slate descendants include text nodes with `text`
    .map((child) => child.text || '')
    .join('')
    .trim();

  // Extract existing tags for select/multi-select columns
  // NOTE: This useMemo MUST be called before any early returns (React hooks rule)
  const existingTags = useMemo(() => {
    if (!tableElement?.children) return [];
    const tags = new Set<string>();
    tableElement.children.forEach((row: any) => {
      const cell = row.children[columnIndex];
      const text = cell?.children?.map((c: any) => c.text || '').join('').trim();
      if (text && (columnType === 'select' || columnType === 'multi-select')) {
        text.split(',').forEach((t: string) => tags.add(t.trim()));
      }
    });
    return Array.from(tags);
  }, [tableElement?.children, columnIndex, columnType]);

  // Build class name
  const cellClassName = isDataCellAsHeader
    ? `yoopta-advanced-table-data-cell yoopta-advanced-table-data-cell-head ${extendedClassName}`
    : `yoopta-advanced-table-data-cell ${extendedClassName}`;

  const renderSpecializedContent = () => {
    if (isDataCellAsHeader) return null;

    switch (columnType) {
      case 'number':
        return null; // Allow direct editing, validation overlay added separately
      
      case 'date':
        const formattedDate = cellText ? dayjs(cellText).format('MMM D, YYYY') : '';
        return (
          <div className="w-full min-h-[28px]" contentEditable={false}>
            <button 
              ref={refs.setReference}
              type="button"
              className={`w-full text-left text-sm px-1 py-0.5 rounded transition-colors flex items-center ${
                cellText 
                  ? 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)]/80' 
                  : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-secondary)]/80'
              }`}
              onClick={() => setShowDatePicker(!showDatePicker)}
            >
              <Calendar className="w-3.5 h-3.5 mr-2 opacity-50" />
              <span className="truncate">{formattedDate || 'Select date...'}</span>
            </button>
            
            {showDatePicker && (
              <Portal id={`date-picker-${blockId}-${columnIndex}`}>
                <div 
                  className="fixed inset-0 z-[9998]" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDatePicker(false);
                  }}
                />
                <Popover 
                  ref={refs.setFloating}
                  style={floatingStyles}
                  width="xl"
                  className="z-[9999]"
                  onClickCapture={(e) => e.stopPropagation()}
                >
                  <CalendarPicker 
                    value={cellText}
                    onChange={(iso) => {
                      updateCellText(iso);
                      setShowDatePicker(false);
                    }}
                    onClear={() => {
                      updateCellText('');
                      setShowDatePicker(false);
                    }}
                  />
                </Popover>
              </Portal>
            )}
          </div>
        );

      case 'select':
      case 'multi-select':
        // Create a unique context key for this column to ensure unique colors
        const contextKey = `table-${blockId}-col-${columnIndex}`;
        return (
          <div 
            className="w-full min-h-[28px]" 
            contentEditable={false}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <InlineTagInput
              value={cellText}
              onChange={updateCellText}
              isMulti={columnType === 'multi-select'}
              existingTags={existingTags}
              placeholder="Type to add..."
              contextKey={contextKey}
            />
          </div>
        );

      case 'page':
        return (
          <div 
            className="w-full min-h-[28px]" 
            contentEditable={false}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <PageCellPicker
              value={cellText}
              onChange={updateCellText}
              parentPageId={activePageId}
              placeholder="Link page..."
            />
          </div>
        );

      default:
        return null;
    }
  };

  const specializedContent = renderSpecializedContent();

  // Number validation for visual feedback
  const isNumberColumn = columnType === 'number';
  const isValidNumber = !cellText || /^-?\d*\.?\d*$/.test(cellText);
  const showNumberError = isNumberColumn && cellText && !isValidNumber;

  return (
    <CellTag
      scope={isDataCellAsHeader ? 'col' : undefined}
      data-cell-selected={selected}
      data-has-bg={!!finalBgColor || isDataCellAsHeader || undefined}
      style={style}
      colSpan={1}
      rowSpan={1}
      {...htmlAttrs}
      className={`${cellClassName} ${columnType === 'number' ? 'text-right' : ''} ${showNumberError ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
    >
      <div 
        className="yoopta-advanced-table-data-cell-content relative" 
        {...attributes}
        contentEditable={!isDataCellAsHeader && !editor.readOnly}
        suppressContentEditableWarning
      >
        {isDataCellAsHeader ? (
          <div className="sr-only" contentEditable={false}>{children}</div>
        ) : specializedContent ? (
          <>
            {/* Hidden Slate children to maintain editor state */}
            <span className="sr-only">{children}</span>
            {specializedContent}
          </>
        ) : children}
        
        {/* Number validation error indicator */}
        {showNumberError && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" title="Invalid number: only digits, decimal point, and minus sign are allowed">
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
        )}
      </div>

      {/* Row drag button on first column */}
      {!editor.readOnly && isFirstDataCell && (
        <AdvancedTableRowDragButton editor={editor} blockId={blockId} tdElement={element} />
      )}
    </CellTag>
  );
};

export { AdvancedTableDataCell };
