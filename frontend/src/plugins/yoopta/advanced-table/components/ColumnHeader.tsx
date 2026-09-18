/**
 * @file ColumnHeader.tsx
 * @description Column header with an editable name and quick access to column options
 *
 * Features:
 * - Column name is typed directly into the header
 * - Type icon and the hover chevron open the full column options
 * - Filter/sort indicators (always visible when active)
 *
 * Inspired by Notion's table headers with quick-access functionality.
 */
import React, { useEffect, useState, forwardRef } from 'react';
import {
  Type,
  Hash,
  Calendar,
  List,
  Tags,
  FileText,
  Filter,
  ArrowUp,
  ArrowDown,
  ChevronDown,
} from 'lucide-react';
import type { YooEditor } from '@yoopta/editor';

import type { ColumnType, ColumnFilter } from '../types';
import { ResizeHandle } from './ResizeHandle';

interface ColumnHeaderProps {
  editor: YooEditor;
  blockId: string;
  columnIndex: number;
  columnType: ColumnType;
  /** Stored name; empty when the column has not been named */
  columnName: string;
  placeholder: string;
  isFiltered: boolean;
  currentFilter: ColumnFilter | null;
  isSorted: boolean;
  sortDirection: 'asc' | 'desc' | null;
  width: number;
  isReadOnly: boolean;
  onOpenOptions?: () => void;
  onRename?: (name: string) => void;
  onResize?: (width: number) => void;
}

const TYPE_ICONS: Record<ColumnType, typeof Type> = {
  text: Type,
  number: Hash,
  date: Calendar,
  select: List,
  'multi-select': Tags,
  page: FileText,
};

const ColumnHeader = forwardRef<HTMLTableHeaderCellElement, ColumnHeaderProps>(({
  columnIndex,
  columnType,
  columnName,
  placeholder,
  isFiltered,
  isSorted,
  sortDirection,
  width,
  isReadOnly,
  onOpenOptions,
  onRename,
  onResize,
}, ref) => {
  const TypeIcon = TYPE_ICONS[columnType] ?? Type;
  const [draft, setDraft] = useState(columnName);

  // Follow changes made elsewhere (column options menu, undo, collaborators)
  useEffect(() => setDraft(columnName), [columnName]);

  const commit = () => {
    const next = draft.trim();
    if (next !== columnName) onRename?.(next);
  };

  const indicators = (isFiltered || isSorted) && (
    <span className="yoopta-advanced-table-header-indicators">
      {isFiltered && <Filter className="w-3 h-3" />}
      {isSorted && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
    </span>
  );

  return (
    <th
      ref={ref}
      contentEditable={false}
      className="yoopta-advanced-table-header group/header"
      style={{ width, minWidth: width }}
    >
      <div className="yoopta-advanced-table-header-content">
        {isReadOnly ? (
          <>
            <TypeIcon className="yoopta-advanced-table-header-icon" />
            <span className="truncate flex-1 min-w-0">{columnName || placeholder}</span>
            {indicators}
          </>
        ) : (
          <>
            <button
              type="button"
              className="yoopta-advanced-table-header-icon-button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenOptions?.();
              }}
              title="Column options"
            >
              <TypeIcon className="yoopta-advanced-table-header-icon" />
            </button>
            <input
              className="yoopta-advanced-table-header-input"
              value={draft}
              placeholder={placeholder}
              aria-label={`Column ${columnIndex + 1} name`}
              spellCheck={false}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              // Keep keystrokes away from the editor's shortcuts
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.currentTarget.blur();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setDraft(columnName);
                  // Blur after the reset so the old name is not committed
                  requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
                }
              }}
              onPaste={(e) => e.stopPropagation()}
              onCopy={(e) => e.stopPropagation()}
              onCut={(e) => e.stopPropagation()}
            />
            {indicators}
            <button
              type="button"
              className="yoopta-advanced-table-header-menu-button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenOptions?.();
              }}
              title="Column options"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>

      {!isReadOnly && onResize && (
        <ResizeHandle onResize={onResize} tdWidth={width} columnIndex={columnIndex} />
      )}
    </th>
  );
});

ColumnHeader.displayName = 'ColumnHeader';

export default ColumnHeader;
