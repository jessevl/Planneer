/**
 * @file DataTable.tsx
 * @description Unified, reusable table component for tasks and pages
 * @app SHARED - Used by task pages and collection pages
 * 
 * A clean, styled table component that supports:
 * - Configurable columns with render functions
 * - Collapsible groups with headers
 * - Context menus on rows
 * - Responsive horizontal scrolling
 * - Consistent styling matching yoopta tables
 * 
 * This is a reusable primitive - actual column definitions are passed in.
 */
import React, { useState, useCallback, useMemo } from 'react';
import { cn } from '@frameer/lib/design-system';
import { ContextMenu, type ContextMenuItem, SectionHeader } from '@frameer/components/ui';

// ============================================================================
// Types
// ============================================================================

export interface DataTableColumn<T> {
  id: string;
  label: string;
  width: string; // e.g., '40px', '120px', 'minmax(200px, 1fr)'
  align?: 'left' | 'center' | 'right';
  render: (item: T) => React.ReactNode;
  /** Optional cell className */
  className?: string;
}

export interface DataTableGroup<T> {
  key: string;
  label: string;
  items: T[];
  color?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  items: T[];
  getKey: (item: T) => string;
  onRowClick?: (item: T, event: React.MouseEvent) => void;
  getMenuItems?: (item: T) => ContextMenuItem[];
  /** Optional function to determine if row is selected */
  isSelected?: (item: T) => boolean;
  /** Optional function to determine if row is "muted" (e.g., completed tasks) */
  isMuted?: (item: T) => boolean;
  /** Optional groups - if provided, items prop is ignored */
  groups?: DataTableGroup<T>[];
  /** Callback when add button is clicked in a group header */
  onAddToGroup?: (groupKey: string) => void;
  /** Empty state message */
  emptyMessage?: string;
  /** Maximum width constraint */
  maxWidth?: string;
  /** Additional className for the container */
  className?: string;
}

// ============================================================================
// Table Header
// ============================================================================

function TableHeader<T>({ columns }: { columns: DataTableColumn<T>[] }) {
  const gridTemplate = columns.map(c => c.width).join(' ');
  
  return (
    <div
      className="grid bg-[var(--color-surface-secondary)]/80 border-b border-[var(--color-border-default)]"
      style={{ gridTemplateColumns: gridTemplate }}
    >
      {columns.map(col => (
        <div
          key={col.id}
          className={cn(
            'px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]',
            col.align === 'center' && 'text-center',
            col.align === 'right' && 'text-right'
          )}
        >
          {col.label}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Table Row
// ============================================================================

interface TableRowProps<T> {
  item: T;
  columns: DataTableColumn<T>[];
  onClick?: (item: T, event: React.MouseEvent) => void;
  menuItems?: ContextMenuItem[];
  isSelected?: boolean;
  isMuted?: boolean;
}

function TableRow<T>({ 
  item, 
  columns, 
  onClick, 
  menuItems,
  isSelected,
  isMuted 
}: TableRowProps<T>) {
  const gridTemplate = columns.map(c => c.width).join(' ');
  
  const handleClick = useCallback((e: React.MouseEvent) => {
    onClick?.(item, e);
  }, [item, onClick]);

  const rowContent = (
    <div
      className={cn(
        'grid border-b border-[var(--color-border-subtle)]',
        'hover:bg-[var(--color-surface-secondary)] transition-colors cursor-pointer',
        isMuted && 'opacity-60',
                isSelected && 'bg-[var(--color-interactive-bg)]/50'
      )}
      style={{ gridTemplateColumns: gridTemplate }}
      onClick={handleClick}
    >
      {columns.map(col => (
        <div
          key={col.id}
          className={cn(
            'px-3 py-2.5 flex items-center min-w-0',
            col.align === 'center' && 'justify-center',
            col.align === 'right' && 'justify-end',
            col.className
          )}
        >
          {col.render(item)}
        </div>
      ))}
    </div>
  );

  if (menuItems && menuItems.length > 0) {
    return <ContextMenu items={menuItems}>{rowContent}</ContextMenu>;
  }

  return rowContent;
}

// ============================================================================
// Main DataTable Component
// ============================================================================

export function DataTable<T>({
  columns,
  items,
  getKey,
  onRowClick,
  getMenuItems,
  isSelected,
  isMuted,
  groups,
  onAddToGroup,
  emptyMessage = 'No items',
  maxWidth,
  className,
}: DataTableProps<T>) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = useCallback((groupKey: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  // Calculate minimum width from columns
  const minWidth = useMemo(() => {
    let total = 0;
    for (const col of columns) {
      // Extract numeric value from width
      const match = col.width.match(/(\d+)/);
      if (match) {
        total += parseInt(match[1], 10);
      } else {
        total += 100; // Default for flex columns
      }
    }
    return `${total}px`;
  }, [columns]);

  // Ungrouped view
  if (!groups) {
    if (items.length === 0) {
      return (
        <div className="py-8 text-center text-[var(--color-text-secondary)] text-sm">
          {emptyMessage}
        </div>
      );
    }

    return (
      <div 
        className={cn(
          'overflow-x-auto rounded-lg border border-[var(--color-border-default)]',
          className
        )}
        style={{ maxWidth }}
      >
        <div style={{ minWidth }}>
          <TableHeader columns={columns} />
          <div>
            {items.map(item => (
              <TableRow
                key={getKey(item)}
                item={item}
                columns={columns}
                onClick={onRowClick}
                menuItems={getMenuItems?.(item)}
                isSelected={isSelected?.(item)}
                isMuted={isMuted?.(item)}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Grouped view
  const nonEmptyGroups = groups.filter(g => g.items.length > 0);
  
  if (nonEmptyGroups.length === 0) {
    return (
      <div className="py-8 text-center text-[var(--color-text-secondary)] text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)} style={{ maxWidth }}>
      {nonEmptyGroups.map(group => {
        const isCollapsed = collapsedGroups.has(group.key);
        
        return (
          <div key={group.key}>
            <SectionHeader
              label={group.label}
              count={group.items.length}
              color={group.color}
              isExpanded={!isCollapsed}
              onToggle={() => toggleGroup(group.key)}
              onAdd={onAddToGroup ? () => onAddToGroup(group.key) : undefined}
              className="!mb-3"
            />
            
            {!isCollapsed && (
              <div 
                className="overflow-x-auto rounded-lg border border-[var(--color-border-default)]"
              >
                <div style={{ minWidth }}>
                  <TableHeader columns={columns} />
                  <div>
                    {group.items.map(item => (
                      <TableRow
                        key={getKey(item)}
                        item={item}
                        columns={columns}
                        onClick={onRowClick}
                        menuItems={getMenuItems?.(item)}
                        isSelected={isSelected?.(item)}
                        isMuted={isMuted?.(item)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default DataTable;
