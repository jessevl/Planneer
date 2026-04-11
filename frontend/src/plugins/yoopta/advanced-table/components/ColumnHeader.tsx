/**
 * @file ColumnHeader.tsx
 * @description Interactive column header with quick actions for filter, sort, and settings
 * 
 * Features:
 * - Shows column type icon and name
 * - Filter/sort indicators (always visible when active)
 * - Hover reveals settings icon overlay
 * - Click anywhere to open full column settings
 * 
 * Inspired by Notion's table headers with quick-access functionality.
 */
import React, { useState, forwardRef } from 'react';
import { 
  Type, 
  Hash, 
  Calendar, 
  List, 
  Tags, 
  Filter, 
  ArrowUp, 
  ArrowDown,
  ChevronDown,
  Settings2,
} from 'lucide-react';
import type { YooEditor } from '@yoopta/editor';

import type { ColumnType, ColumnFilter } from '../types';
import { cn } from '@/lib/design-system';
import { ResizeHandle } from './ResizeHandle';

interface ColumnHeaderProps {
  editor: YooEditor;
  blockId: string;
  columnIndex: number;
  columnType: ColumnType;
  columnName: string;
  isFiltered: boolean;
  currentFilter: ColumnFilter | null;
  isSorted: boolean;
  sortDirection: 'asc' | 'desc' | null;
  width: number;
  isReadOnly: boolean;
  onOpenOptions?: () => void;
  onResize?: (width: number) => void;
}

const ColumnHeader = forwardRef<HTMLTableHeaderCellElement, ColumnHeaderProps>(({
  columnIndex,
  columnType,
  columnName,
  isFiltered,
  isSorted,
  sortDirection,
  width,
  isReadOnly,
  onOpenOptions,
  onResize,
}, ref) => {
  const [isHovered, setIsHovered] = useState(false);

  // Get column type icon
  const getTypeIcon = () => {
    switch (columnType) {
      case 'number': return Hash;
      case 'date': return Calendar;
      case 'select': return List;
      case 'multi-select': return Tags;
      default: return Type;
    }
  };

  const TypeIcon = getTypeIcon();

  if (isReadOnly) {
    return (
      <th 
        ref={ref}
        className="px-3 h-10 text-[10px] font-semibold uppercase tracking-wider text-left last:border-r-0"
        style={{ 
          width,
          backgroundColor: 'var(--color-surface-inset)',
          color: 'var(--color-text-secondary)',
          borderBottom: '1px solid var(--color-border-default)',
          borderRight: '1px solid var(--color-border-default)',
        }}
      >
        <div className="flex items-center gap-1.5">
          <TypeIcon className="w-3.5 h-3.5 opacity-60" />
          <span className="truncate">{columnName}</span>
          {isFiltered && <Filter className="w-3 h-3 text-[var(--color-interactive-text-strong)]" />}
          {isSorted && (
            sortDirection === 'asc' 
              ? <ArrowUp className="w-3 h-3 text-[var(--color-interactive-text-strong)]" /> 
              : <ArrowDown className="w-3 h-3 text-[var(--color-interactive-text-strong)]" />
          )}
        </div>
      </th>
    );
  }

  return (
    <th 
      ref={ref}
      contentEditable={false}
      className={cn(
        'relative px-3 h-10 text-[10px] font-semibold uppercase tracking-wider text-left cursor-pointer transition-colors select-none last:border-r-0'
      )}
      style={{ 
        width, 
        minWidth: width,
        backgroundColor: isHovered ? 'var(--color-surface-hover)' : 'var(--color-surface-inset)',
        color: 'var(--color-text-secondary)',
        borderBottom: '1px solid var(--color-border-default)',
        borderRight: '1px solid var(--color-border-default)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        if (onOpenOptions) {
          onOpenOptions();
        }
      }}
    >
      <div className="flex items-center gap-2 min-w-0 h-full pr-8">
        {/* Type Icon */}
        <TypeIcon className={cn(
          "w-3.5 h-3.5 flex-shrink-0 transition-opacity",
          isHovered ? "opacity-80" : "opacity-40"
        )} />
        
        {/* Column Name - read only */}
        <span className="truncate flex-1 min-w-0">{columnName}</span>
        
        {/* Status Indicators - always visible */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {isFiltered && (
            <span className="p-0.5 rounded bg-[var(--color-interactive-bg)]">
              <Filter className="w-3 h-3 text-[var(--color-interactive-text-strong)]" />
            </span>
          )}
          {isSorted && (
            <span className="p-0.5 rounded bg-[var(--color-interactive-bg)]">
              {sortDirection === 'asc' 
                ? <ArrowUp className="w-3 h-3 text-[var(--color-interactive-text-strong)]" /> 
                : <ArrowDown className="w-3 h-3 text-[var(--color-interactive-text-strong)]" />
              }
            </span>
          )}
        </div>
      </div>
      
      {/* Settings indicator on hover - absolute positioned to overlay */}
      {isHovered && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 rounded px-1 py-0.5" style={{ backgroundColor: 'var(--color-surface-hover)' }}>
          <Settings2 className="w-3.5 h-3.5" style={{ color: 'var(--color-text-tertiary)' }} />
          <ChevronDown className="w-3 h-3" style={{ color: 'var(--color-text-tertiary)' }} />
        </div>
      )}

      {/* Resize handle */}
      {!isReadOnly && onResize && (
        <ResizeHandle onResize={onResize} tdWidth={width} columnIndex={columnIndex} />
      )}
    </th>
  );
});

ColumnHeader.displayName = 'ColumnHeader';

export default ColumnHeader;
