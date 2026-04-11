import { useState, useRef, useEffect, useMemo, type CSSProperties } from 'react';
import type { YooEditor } from '@yoopta/editor';
import { Elements } from '@yoopta/editor';
import { UI } from '@/plugins/yoopta/editor-ui/ui-compat';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  MoveLeftIcon,
  MoveRightIcon,
  TrashIcon,
  Paintbrush,
  ArrowUp,
  ArrowDown,
  Type,
  Hash,
  Calendar,
  List,
  Tags,
  Filter,
  Calculator,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { Editor, Element } from 'slate';
import { useFloating, offset, flip, shift, autoUpdate } from '@floating-ui/react';

import { AdvancedTableCommands } from '../commands';
import { ColorPicker } from './ColorPicker';
import type { AdvancedTableElement, BackgroundColor, SortDirection, ColumnType, AggregationType } from '../types';
import { useConfirmStore } from '@/stores/confirmStore';
import { Popover, TagBadge, MobileSheet } from '@/components/ui';
import CalendarPicker from '@/components/common/CalendarPicker';
import { getTagColor } from '@/lib/tagUtils';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import { PluginMenuItem, PluginMenuSeparator } from '@/plugins/yoopta/shared/PluginMenuItems';
import dayjs from 'dayjs';

const { Portal } = UI;

export type Props = {
  isOpen: boolean;
  onClose: () => void;
  refs: any;
  style: CSSProperties;
  editor: YooEditor;
  blockId: string;
  columnIndex: number;
};

const AdvancedTableColumnOptions = ({ editor, blockId, columnIndex, onClose, ...props }: Props) => {
  const isMobile = useIsMobile();
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showAggregationPicker, setShowAggregationPicker] = useState(false);
  const [showFilterPicker, setShowFilterPicker] = useState(false);
  const [numberFilterValue, setNumberFilterValue] = useState('');
  const [numberFilterOperator, setNumberFilterOperator] = useState<'eq' | 'gt' | 'lt' | 'gte' | 'lte'>('eq');
  const [tagFilterSearch, setTagFilterSearch] = useState('');
  const [tagFilterMode, setTagFilterMode] = useState<'in' | 'not_in'>('in');
  const [dateFilterValue, setDateFilterValue] = useState('');
  const [dateFilterOperator, setDateFilterOperator] = useState<'on' | 'before' | 'after'>('on');
  const [textFilterValue, setTextFilterValue] = useState('');
  const [textFilterOperator, setTextFilterOperator] = useState<'contains' | 'eq'>('contains');
  const [showDateCalendar, setShowDateCalendar] = useState(false);
  const slate = editor.blockEditorsMap[blockId];
  const { requestConfirm } = useConfirmStore();

  // Floating UI for submenus
  const { refs: typeRefs, floatingStyles: typeStyles } = useFloating({
    placement: 'right-start',
    open: showTypePicker,
    onOpenChange: setShowTypePicker,
    middleware: [offset(5), flip(), shift()],
    whileElementsMounted: autoUpdate,
    strategy: 'fixed',
  });

  const { refs: filterRefs, floatingStyles: filterStyles } = useFloating({
    placement: 'right-start',
    open: showFilterPicker,
    onOpenChange: setShowFilterPicker,
    middleware: [offset(5), flip(), shift()],
    whileElementsMounted: autoUpdate,
    strategy: 'fixed',
  });

  const { refs: colorRefs, floatingStyles: colorStyles } = useFloating({
    placement: 'right-start',
    open: showColorPicker,
    onOpenChange: setShowColorPicker,
    middleware: [offset(5), flip(), shift()],
    whileElementsMounted: autoUpdate,
    strategy: 'fixed',
  });

  const { refs: aggregationRefs, floatingStyles: aggregationStyles } = useFloating({
    placement: 'right-start',
    open: showAggregationPicker,
    onOpenChange: setShowAggregationPicker,
    middleware: [offset(5), flip(), shift()],
    whileElementsMounted: autoUpdate,
    strategy: 'fixed',
  });

  // Construct a path to a cell in this column (first row, given column index)
  // Path format: [tableIndex, rowIndex, columnIndex]
  const path = [0, 0, columnIndex] as [number, number, number];

  // Get current column background color
  const tableElement = Elements.getElement(editor, { blockId, type: 'table', path: [0] }) as AdvancedTableElement | null;
  const currentColumnColor = tableElement?.props?.columnBackgroundColors?.[columnIndex] || null;
  const currentSortInfo = tableElement?.props?.sortInfo;
  const currentColumnType = tableElement?.props?.columnTypes?.[columnIndex] || 'text';
  const currentAggregation = tableElement?.props?.columnAggregations?.[columnIndex] || null;
  const currentFilter = tableElement?.props?.columnFilters?.[columnIndex] || null;
  const currentColumnName = tableElement?.props?.columnNames?.[columnIndex] || '';

  // Extract existing tags from the column for tag suggestions
  const existingColumnTags = useMemo(() => {
    if (!tableElement?.children || (currentColumnType !== 'select' && currentColumnType !== 'multi-select')) return [];
    const tags = new Set<string>();
    tableElement.children.forEach((row: any) => {
      const cell = row.children?.[columnIndex];
      const text = cell?.children?.map((c: any) => c.text || '').join('').trim();
      if (text) {
        text.split(',').forEach((t: string) => {
          const trimmed = t.trim();
          if (trimmed) tags.add(trimmed);
        });
      }
    });
    return Array.from(tags).sort();
  }, [tableElement?.children, columnIndex, currentColumnType]);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (props.isOpen && inputRef.current) {
      // Small delay to ensure the popover is positioned
      const timer = setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [props.isOpen]);

  // Sync operator states from currentFilter when filter picker opens
  useEffect(() => {
    if (showFilterPicker && currentFilter) {
      if (currentColumnType === 'text' || currentColumnType === 'page') {
        setTextFilterValue(String(currentFilter.value || ''));
        setTextFilterOperator((currentFilter.operator as 'contains' | 'eq') || 'contains');
      } else if (currentColumnType === 'number') {
        setNumberFilterValue(String(currentFilter.value || ''));
        setNumberFilterOperator((currentFilter.operator as any) || 'eq');
      } else if (currentColumnType === 'date') {
        setDateFilterValue(String(currentFilter.value || ''));
        setDateFilterOperator((currentFilter.operator as 'on' | 'before' | 'after') || 'on');
      } else if (currentColumnType === 'select' || currentColumnType === 'multi-select') {
        setTagFilterSearch('');
        setTagFilterMode((currentFilter.operator as 'in' | 'not_in') || 'in');
      }
    }
  }, [showFilterPicker, currentFilter, currentColumnType]);

  const insertColumnBefore = () => {
    AdvancedTableCommands.insertTableColumn(editor, blockId, { insertMode: 'before', path });
    onClose();
  };

  const insertColumnAfter = () => {
    AdvancedTableCommands.insertTableColumn(editor, blockId, { insertMode: 'after', path });
    onClose();
  };

  const deleteTableColumn = () => {
    if (!path) return;
    AdvancedTableCommands.deleteTableColumn(editor, blockId, { path });
    onClose();
  };

  const moveColumnRight = () => {
    if (!path) return;
    
    const nextTdEntry = Editor.next(slate, {
      at: path,
      match: (n) => Element.isElement(n) && (n as unknown as { type: string }).type === 'table-data-cell',
    });

    if (!nextTdEntry) return;

    const [, nextTdPath] = nextTdEntry;
    AdvancedTableCommands.moveTableColumn(editor, blockId, { from: path, to: nextTdPath });
  };

  const moveColumnLeft = () => {
    if (!path) return;

    const prevTdEntry = Editor.previous(slate, {
      at: path,
      match: (n) => Element.isElement(n) && (n as unknown as { type: string }).type === 'table-data-cell',
    });

    if (!prevTdEntry) return;

    const [, prevTdPath] = prevTdEntry;
    AdvancedTableCommands.moveTableColumn(editor, blockId, { from: path, to: prevTdPath });
  };

  const handleColorSelect = (color: BackgroundColor) => {
    AdvancedTableCommands.setColumnBackgroundColor(editor, blockId, columnIndex, color);
    setShowColorPicker(false);
    onClose();
  };

  const handleSort = (direction: SortDirection) => {
    // Toggle off if already sorting in this direction
    const newDirection =
      currentSortInfo?.columnIndex === columnIndex && currentSortInfo?.direction === direction
        ? null
        : direction;
    AdvancedTableCommands.sortColumn(editor, blockId, columnIndex, newDirection);
    onClose();
  };

  const handleTypeSelect = (type: ColumnType) => {
    if (currentColumnType !== type) {
      // Check if column has content
      const rows = tableElement?.children || [];
      const hasContent = rows.some((row: any) => {
        const cell = row.children[columnIndex];
        const text = cell?.children?.map((c: any) => c.text || '').join('').trim();
        return !!text;
      });

      if (hasContent) {
        requestConfirm({
          title: 'Change Column Type?',
          message: 'Changing the column type will clear all existing content in this column.',
          detail: 'This action cannot be undone.',
          confirmLabel: 'Change Type',
          variant: 'warning',
          onConfirm: () => {
            AdvancedTableCommands.setColumnType(editor, blockId, columnIndex, type);
            setShowTypePicker(false);
            onClose();
          }
        });
        return;
      }
    }
    AdvancedTableCommands.setColumnType(editor, blockId, columnIndex, type);
    setShowTypePicker(false);
    onClose();
  };

  const handleAggregationSelect = (agg: AggregationType | null) => {
    AdvancedTableCommands.setColumnAggregation(editor, blockId, columnIndex, agg);
    if (agg && !tableElement?.props?.showCalculationRow) {
      AdvancedTableCommands.toggleCalculationRow(editor, blockId);
    }
    setShowAggregationPicker(false);
    onClose();
  };

  const handleFilterChange = (value: any, operator?: any) => {
    AdvancedTableCommands.setColumnFilter(editor, blockId, columnIndex, {
      type: currentColumnType,
      value,
      operator
    });
    setShowFilterPicker(false);
    onClose();
  };

  const clearFilter = () => {
    AdvancedTableCommands.setColumnFilter(editor, blockId, columnIndex, null);
    setShowFilterPicker(false);
    onClose();
  };

  const columnTypes: { type: ColumnType; label: string; icon: any }[] = [
    { type: 'text', label: 'Text', icon: Type },
    { type: 'number', label: 'Number', icon: Hash },
    { type: 'date', label: 'Date', icon: Calendar },
    { type: 'select', label: 'Select', icon: List },
    { type: 'multi-select', label: 'Multi-select', icon: Tags },
    { type: 'page', label: 'Page', icon: FileText },
  ];

  const aggregations: { type: AggregationType | null; label: string }[] = [
    { type: null, label: 'None' },
    { type: 'count', label: 'Count' },
    { type: 'sum', label: 'Sum' },
    { type: 'average', label: 'Average' },
    { type: 'min', label: 'Min' },
    { type: 'max', label: 'Max' },
    { type: 'median', label: 'Median' },
  ];

  if (!props.isOpen) return null;

  // Aliases for shared menu primitives (keep same local names for minimal diff)
  const MenuItem = ({ onClick, children, active }: { onClick: () => void; children: React.ReactNode; active?: boolean }) =>
    <PluginMenuItem onClick={onClick} active={active}>{children}</PluginMenuItem>;
  const Separator = () => <PluginMenuSeparator />;

  // Submenu Contents
  const typePickerContent = (
    <div className={isMobile ? 'pb-6' : ''}>
      {columnTypes.map((t) => (
        <MenuItem 
          key={t.type} 
          onClick={() => handleTypeSelect(t.type)} 
          active={currentColumnType === t.type}
        >
          <t.icon className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
          {t.label}
        </MenuItem>
      ))}
    </div>
  );

  const aggregationPickerContent = (
    <div className={isMobile ? 'pb-6' : ''}>
      {aggregations.map((a) => (
        <MenuItem 
          key={a.label} 
          onClick={() => handleAggregationSelect(a.type)} 
          active={currentAggregation === a.type}
        >
          {a.label}
        </MenuItem>
      ))}
    </div>
  );

  const colorPickerContent = (
    <div className={isMobile ? 'px-4 pb-8' : 'p-1'}>
      {isMobile && <div className="py-2 text-sm font-medium text-[var(--color-text-secondary)]">Column Color</div>}
      <ColorPicker
        selectedColor={currentColumnColor}
        onColorSelect={handleColorSelect}
      />
    </div>
  );

  const filterPickerContent = (
    <div className={isMobile ? 'px-4 pb-8' : 'flex flex-col gap-2 p-2'}>
      <div className="flex items-center justify-between px-1 py-2">
        <span className={isMobile ? 'text-sm font-medium text-[var(--color-text-secondary)]' : 'text-xs font-medium text-[var(--color-text-primary)]'}>
          Filter Column
        </span>
        {currentFilter && (
          <button
            type="button"
            className={isMobile ? 'text-xs text-red-500 hover:underline' : 'text-[10px] text-red-500 hover:underline'}
            onClick={(e) => {
              if (!isMobile) {
                e.preventDefault();
                e.stopPropagation();
              }
              clearFilter();
            }}
          >
            Clear
          </button>
        )}
      </div>
      
      {currentColumnType === 'text' && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              className={`px-3 py-2 text-sm border rounded transition-colors ${
                textFilterOperator === 'contains' 
                  ? 'bg-[var(--color-interactive-bg)] border-[var(--color-interactive-border)] text-[var(--color-interactive-text-strong)]' 
                  : 'border-[var(--color-border-default)] hover:bg-[var(--color-surface-overlay)] text-[var(--color-text-primary)]'
              }`}
              onMouseDown={(e) => {
                if (!isMobile) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              onClick={(e) => {
                if (!isMobile) {
                  e.preventDefault();
                  e.stopPropagation();
                }
                setTextFilterOperator('contains');
              }}
            >
              Contains
            </button>
            <button
              type="button"
              className={`px-3 py-2 text-sm border rounded transition-colors ${
                textFilterOperator === 'eq' 
                  ? 'bg-[var(--color-interactive-bg)] border-[var(--color-interactive-border)] text-[var(--color-interactive-text-strong)]' 
                  : 'border-[var(--color-border-default)] hover:bg-[var(--color-surface-overlay)] text-[var(--color-text-primary)]'
              }`}
              onMouseDown={(e) => {
                if (!isMobile) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              onClick={(e) => {
                if (!isMobile) {
                  e.preventDefault();
                  e.stopPropagation();
                }
                setTextFilterOperator('eq');
              }}
            >
              Exact
            </button>
          </div>
          <input
            className="w-full px-3 py-2 text-base border border-[var(--color-border-default)] rounded bg-[var(--color-surface-base)] text-[var(--color-text-primary)]"
            placeholder="Text to search..."
            value={textFilterValue}
            onChange={(e) => setTextFilterValue(e.target.value)}
          />
          <button
            type="button"
            className="px-4 py-3 text-base bg-[var(--color-interactive-bg-strong)] text-white rounded hover:opacity-90"
            onMouseDown={(e) => {
              if (!isMobile) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            onClick={(e) => {
              if (!isMobile) {
                e.preventDefault();
                e.stopPropagation();
              }
              if (textFilterValue.trim()) {
                handleFilterChange(textFilterValue, textFilterOperator);
              }
            }}
          >
            Apply Filter
          </button>
        </div>
      )}

      {currentColumnType === 'number' && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 flex-wrap">
            {[
              { op: 'eq' as const, label: '=' },
              { op: 'gt' as const, label: '>' },
              { op: 'gte' as const, label: '≥' },
              { op: 'lt' as const, label: '<' },
              { op: 'lte' as const, label: '≤' }
            ].map((item) => (
              <button
                key={item.op}
                type="button"
                className={`px-3 py-2 text-sm border rounded transition-colors ${
                  numberFilterOperator === item.op 
                    ? 'bg-[var(--color-interactive-bg)] border-[var(--color-interactive-border)] text-[var(--color-interactive-text-strong)]' 
                    : 'border-[var(--color-border-default)] hover:bg-[var(--color-surface-overlay)] text-[var(--color-text-primary)]'
                }`}
                onMouseDown={(e) => {
                  if (!isMobile) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                onClick={(e) => {
                  if (!isMobile) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                  setNumberFilterOperator(item.op);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <input
            type="number"
            className="w-full px-3 py-2 text-base border rounded bg-[var(--color-surface-base)] border-[var(--color-border-default)] text-[var(--color-text-primary)]"
            placeholder="Enter number..."
            value={numberFilterValue}
            onChange={(e) => setNumberFilterValue(e.target.value)}
          />
          <button
            type="button"
            className="px-4 py-3 text-base bg-[var(--color-interactive-bg-strong)] text-white rounded hover:opacity-90"
            onMouseDown={(e) => {
              if (!isMobile) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            onClick={(e) => {
              if (!isMobile) {
                e.preventDefault();
                e.stopPropagation();
              }
              if (numberFilterValue !== '') {
                handleFilterChange(numberFilterValue, numberFilterOperator);
              }
            }}
          >
            Apply Filter
          </button>
        </div>
      )}

      {currentColumnType === 'date' && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            {[
              { op: 'on' as const, label: 'On' },
              { op: 'before' as const, label: 'Before' },
              { op: 'after' as const, label: 'After' }
            ].map((item) => (
              <button
                key={item.op}
                type="button"
                className={`px-3 py-2 text-sm border rounded transition-colors ${
                  dateFilterOperator === item.op 
                    ? 'bg-[var(--color-interactive-bg)] border-[var(--color-interactive-border)] text-[var(--color-interactive-text-strong)]' 
                    : 'border-[var(--color-border-default)] hover:bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]'
              }`}
              onMouseDown={(e) => {
                if (!isMobile) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              onClick={(e) => {
                if (!isMobile) {
                  e.preventDefault();
                  e.stopPropagation();
                }
                setDateFilterOperator(item.op);
              }}
            >
              {item.label}
            </button>
            ))}
          </div>
          <button
            type="button"
            className="w-full px-3 py-2 text-base border border-[var(--color-border-default)] rounded bg-[var(--color-surface-base)] hover:bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] flex items-center gap-2"
            onMouseDown={(e) => {
              if (!isMobile) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            onClick={(e) => {
              if (!isMobile) {
                e.preventDefault();
                e.stopPropagation();
              }
              setShowDateCalendar(!showDateCalendar);
            }}
          >
            <Calendar className="w-5 h-5" />
            <span className="flex-1 text-left">{dateFilterValue ? dayjs(dateFilterValue).format('MMM D, YYYY') : 'Select date...'}</span>
          </button>
          {showDateCalendar && (
            <div className="bg-[var(--color-surface-overlay)] border border-[var(--color-border-default)] rounded-lg shadow-xl p-2">
              <CalendarPicker
                value={dateFilterValue}
                onChange={(iso) => {
                  setDateFilterValue(iso);
                  setShowDateCalendar(false);
                }}
                onClear={() => {
                  setDateFilterValue('');
                  setShowDateCalendar(false);
                }}
              />
            </div>
          )}
          <button
            type="button"
            className="px-4 py-3 text-base bg-[var(--color-interactive-bg-strong)] text-white rounded hover:opacity-90 disabled:opacity-50"
            disabled={!dateFilterValue}
            onMouseDown={(e) => {
              if (!isMobile) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            onClick={(e) => {
              if (!isMobile) {
                e.preventDefault();
                e.stopPropagation();
              }
              if (dateFilterValue) {
                handleFilterChange(dateFilterValue, dateFilterOperator);
              }
            }}
          >
            Apply Filter
          </button>
        </div>
      )}

      {(currentColumnType === 'select' || currentColumnType === 'multi-select') && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              className={`px-3 py-2 text-sm border rounded transition-colors ${
                tagFilterMode === 'in' 
                  ? 'bg-[var(--color-interactive-bg)] border-[var(--color-interactive-border)] text-[var(--color-interactive-text-strong)]' 
                  : 'border-[var(--color-border-default)] hover:bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]'
              }`}
              onMouseDown={(e) => {
                if (!isMobile) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              onClick={(e) => {
                if (!isMobile) {
                  e.preventDefault();
                  e.stopPropagation();
                }
                setTagFilterMode('in');
              }}
            >
              Include
            </button>
            <button
              type="button"
              className={`px-3 py-2 text-sm border rounded transition-colors ${
                tagFilterMode === 'not_in' 
                  ? 'bg-[var(--color-interactive-bg)] border-[var(--color-interactive-border)] text-[var(--color-interactive-text-strong)]' 
                  : 'border-[var(--color-border-default)] hover:bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]'
              }`}
              onMouseDown={(e) => {
                if (!isMobile) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              onClick={(e) => {
                if (!isMobile) {
                  e.preventDefault();
                  e.stopPropagation();
                }
                setTagFilterMode('not_in');
              }}
            >
              Exclude
            </button>
          </div>
          <input
            className="w-full px-3 py-2 text-base border border-[var(--color-border-default)] rounded bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]"
            placeholder="Type tag or select below..."
            value={tagFilterSearch}
            onChange={(e) => setTagFilterSearch(e.target.value)}
          />
          {existingColumnTags.length > 0 && (
            <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto p-1">
              {existingColumnTags
                .filter(tag => !tagFilterSearch || tag.toLowerCase().includes(tagFilterSearch.toLowerCase()))
                .map((tag) => {
                  const isActive = currentFilter?.value === tag && currentFilter?.operator === tagFilterMode;
                  return (
                    <button
                      key={tag}
                      type="button"
                      className={`transition-all ${isActive ? 'ring-2 ring-[var(--color-interactive-ring)]/50' : 'hover:scale-105'}`}
                      onMouseDown={(e) => {
                        if (!isMobile) {
                          e.preventDefault();
                          e.stopPropagation();
                        }
                      }}
                      onClick={(e) => {
                        if (!isMobile) {
                          e.preventDefault();
                          e.stopPropagation();
                        }
                        handleFilterChange(tag, tagFilterMode);
                        setTagFilterSearch('');
                      }}
                    >
                      <TagBadge tag={tag} compact />
                    </button>
                  );
                })
              }
            </div>
          )}
          <button
            type="button"
            className="px-4 py-3 text-base bg-[var(--color-interactive-bg-strong)] text-white rounded hover:opacity-90"
            onMouseDown={(e) => {
              if (!isMobile) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            onClick={(e) => {
              if (!isMobile) {
                e.preventDefault();
                e.stopPropagation();
              }
              if (tagFilterSearch.trim()) {
                handleFilterChange(tagFilterSearch.trim(), tagFilterMode);
                setTagFilterSearch('');
              }
            }}
          >
            Apply Filter
          </button>
        </div>
      )}
    </div>
  );

  // Menu content - shared between mobile and desktop
  const menuContent = (
    <>
      {/* Column Name */}
      <div className={isMobile ? 'px-4 py-3' : 'px-2 py-1.5'}>
        <input
          ref={inputRef}
          type="text"
          className={`w-full px-2 py-1 bg-[var(--color-surface-secondary)] border border-[var(--color-border-default)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--color-interactive-ring)] text-[var(--color-text-primary)] ${isMobile ? 'text-base py-2' : 'text-sm'}`}
          placeholder="Column name..."
          value={currentColumnName}
          onChange={(e) => AdvancedTableCommands.setColumnName(editor, blockId, columnIndex, e.target.value)}
        />
      </div>

      <Separator />

      {/* Column Type */}
      <div ref={isMobile ? undefined : typeRefs.setReference}>
        <MenuItem onClick={() => setShowTypePicker(true)}>
          <Type className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
          Column type
          <span className="ml-auto flex items-center gap-1 text-xs text-[var(--color-text-tertiary)]">
            {columnTypes.find(t => t.type === currentColumnType)?.label}
            <ChevronRight className="w-3 h-3" />
          </span>
        </MenuItem>
      </div>

      <Separator />

      {/* Filter options */}
      <div ref={isMobile ? undefined : filterRefs.setReference}>
        <MenuItem onClick={() => setShowFilterPicker(true)} active={!!currentFilter}>
          <Filter className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
          Filter
          {currentFilter && <span className="ml-auto text-[10px] bg-[var(--color-interactive-bg)] px-1 rounded">Active</span>}
          <ChevronRight className="ml-auto w-3 h-3" />
        </MenuItem>
      </div>

      <Separator />

      {/* Insert options */}
      <MenuItem onClick={insertColumnBefore}>
        <ArrowLeftIcon className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
        Insert left
      </MenuItem>
      <MenuItem onClick={insertColumnAfter}>
        <ArrowRightIcon className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
        Insert right
      </MenuItem>

      <Separator />

      {/* Move options */}
      <MenuItem onClick={moveColumnRight}>
        <MoveRightIcon className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
        Move right
      </MenuItem>
      <MenuItem onClick={moveColumnLeft}>
        <MoveLeftIcon className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
        Move left
      </MenuItem>

      <Separator />

      {/* Background color */}
      <div ref={isMobile ? undefined : colorRefs.setReference}>
        <MenuItem onClick={() => setShowColorPicker(true)}>
          <Paintbrush className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
          Column color
          {currentColumnColor && (
            <span
              className="ml-auto w-4 h-4 rounded border border-[var(--color-border-default)]"
              style={{ backgroundColor: currentColumnColor }}
            />
          )}
        </MenuItem>
      </div>

      <Separator />

      {/* Sorting options */}
      <MenuItem 
        onClick={() => handleSort('asc')}
        active={currentSortInfo?.columnIndex === columnIndex && currentSortInfo?.direction === 'asc'}
      >
        <ArrowUp className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
        Sort ascending
      </MenuItem>
      <MenuItem 
        onClick={() => handleSort('desc')}
        active={currentSortInfo?.columnIndex === columnIndex && currentSortInfo?.direction === 'desc'}
      >
        <ArrowDown className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
        Sort descending
      </MenuItem>

      <Separator />

      {/* Calculation options */}
      <div ref={isMobile ? undefined : aggregationRefs.setReference}>
        <MenuItem onClick={() => setShowAggregationPicker(true)}>
          <Calculator className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
          Calculate
          <span className="ml-auto flex items-center gap-1 text-xs text-[var(--color-text-tertiary)]">
            {aggregations.find(a => a.type === currentAggregation)?.label}
            <ChevronRight className="w-3 h-3" />
          </span>
        </MenuItem>
      </div>

      <Separator />

      {/* Delete */}
      <PluginMenuItem onClick={deleteTableColumn} destructive>
        <TrashIcon className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'} shrink-0`} />
        Delete column
      </PluginMenuItem>
    </>
  );

  // Mobile: Use MobileSheet
  if (isMobile) {
    return (
      <>
        <MobileSheet
          isOpen={props.isOpen}
          onClose={onClose}
          title="Column Options"
        >
          {menuContent}
        </MobileSheet>

        {/* Type Picker Submenu */}
        <MobileSheet
          isOpen={showTypePicker}
          onClose={() => setShowTypePicker(false)}
          title="Select Type"
        >
          {typePickerContent}
        </MobileSheet>

        {/* Aggregation Picker Submenu */}
        <MobileSheet
          isOpen={showAggregationPicker}
          onClose={() => setShowAggregationPicker(false)}
          title="Calculate"
        >
          {aggregationPickerContent}
        </MobileSheet>

        {/* Color Picker Submenu */}
        <MobileSheet
          isOpen={showColorPicker}
          onClose={() => setShowColorPicker(false)}
          title="Column Color"
        >
          {colorPickerContent}
        </MobileSheet>

        {/* Filter Picker Submenu */}
        <MobileSheet
          isOpen={showFilterPicker}
          onClose={() => setShowFilterPicker(false)}
          title="Filter Column"
        >
          {filterPickerContent}
        </MobileSheet>
      </>
    );
  }

  // Desktop: Use Portal + Popover
  return (
    <Portal id={`column-options-${blockId}-${columnIndex}`}>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[9998]" 
        onClick={onClose}
      />
      {/* Menu */}
      <Popover 
        ref={props.refs.setFloating} 
        style={{ ...props.style, zIndex: 9999 }} 
        width="auto"
        padding="sm"
        className="min-w-[220px] max-h-[400px] overflow-y-auto"
      >
        {menuContent}
      </Popover>

      {/* Type Picker Submenu */}
      {showTypePicker && (
        <>
          <div className="fixed inset-0 z-[10000]" onClick={() => setShowTypePicker(false)} />
          <Popover
            ref={typeRefs.setFloating}
            style={{ ...typeStyles, zIndex: 10001 }}
            width="auto"
            padding="sm"
            className="min-w-[200px]"
          >
            {typePickerContent}
          </Popover>
        </>
      )}

      {/* Filter Picker Submenu */}
      {showFilterPicker && (
        <>
          <div className="fixed inset-0 z-[10000]" onClick={() => setShowFilterPicker(false)} />
          <Popover
            ref={filterRefs.setFloating}
            style={{ ...filterStyles, zIndex: 10001 }}
            width="auto"
            padding="sm"
            className="min-w-[220px]"
          >
            {filterPickerContent}
          </Popover>
        </>
      )}

      {/* Color Picker Submenu */}
      {showColorPicker && (
        <>
          <div className="fixed inset-0 z-[10000]" onClick={() => setShowColorPicker(false)} />
          <Popover
            ref={colorRefs.setFloating}
            style={{ ...colorStyles, zIndex: 10001 }}
            width="auto"
            padding="sm"
          >
            {colorPickerContent}
          </Popover>
        </>
      )}

      {/* Aggregation Picker Submenu */}
      {showAggregationPicker && (
        <>
          <div className="fixed inset-0 z-[10000]" onClick={() => setShowAggregationPicker(false)} />
          <Popover
            ref={aggregationRefs.setFloating}
            style={{ ...aggregationStyles, zIndex: 10001 }}
            width="auto"
            padding="sm"
            className="min-w-[200px]"
          >
            {aggregationPickerContent}
          </Popover>
        </>
      )}
    </Portal>
  );
};

export { AdvancedTableColumnOptions };
