/**
 * @file PageTableView.tsx
 * @description Table view for pages using unified DataTable component
 * @app PAGES - Alternative display mode for page collections (table format)
 * 
 * Provides page-specific column definitions and grouping logic,
 * delegating rendering to the reusable DataTable component.
 */
import React, { useMemo, useCallback } from 'react';
import type { Page } from '@/types/page';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useNavigate } from '@tanstack/react-router';
import { useShallow } from 'zustand/react/shallow';
import { DataTable, type DataTableColumn, type DataTableGroup } from '@frameer/components/ui/DataTable';
import { categorizePageDateGroup, generatePageDateGroups } from '@/lib/dateGroups';
import ItemIcon from '@/components/common/ItemIcon';
import { FileText, FolderIcon, CheckSquare } from 'lucide-react';
import { buildPageMenuItems } from '@/hooks/usePageContextMenu';
import { useSelectionStore } from '@/stores/selectionStore';
import { useDeleteConfirmStore } from '@/stores/deleteConfirmStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTabsStore } from '@/stores/tabsStore';
import { usePagesStore, selectPageActions } from '@/stores/pagesStore';
import { exportPageToMarkdown, exportTasksToCSV } from '@/lib/dataExport';
import { toastError, toastSuccess, type ContextMenuItem } from '@/components/ui';
import { cn } from '@/lib/design-system';

dayjs.extend(relativeTime);

type PageSortBy = 'updated' | 'created' | 'title';
type SortDirection = 'asc' | 'desc';

interface PageTableViewProps {
  pages: Page[];
  onPageClick: (pageId: string) => void;
  onCreateChild?: (parentId: string) => void;
  onCreateTask?: (parentPageId: string) => void;
  searchQuery?: string;
  sortBy?: PageSortBy;
  sortDirection?: SortDirection;
  groupBy?: 'none' | 'date';
  showExcerpts?: boolean;
  enableSelection?: boolean;
}

// Type badge component
const TypeBadge: React.FC<{ viewMode: Page['viewMode']; childCount?: number }> = ({ viewMode, childCount }) => {
  const config: Record<Page['viewMode'], { label: string; icon: React.ReactNode; className: string }> = {
    note: {
      label: 'Note',
      icon: <FileText className="w-3 h-3" />,
      className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    },
    collection: {
      label: childCount && childCount > 0 ? `Collection (${childCount})` : 'Collection',
      icon: <FolderIcon className="w-3 h-3" />,
      className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    },
    tasks: {
      label: 'Tasks',
      icon: <CheckSquare className="w-3 h-3" />,
      className: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    },
  };
  
  const { label, icon, className } = config[viewMode] || config.note;
  
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap',
      className
    )}>
      {icon}
      {label}
    </span>
  );
};

const PageTableView: React.FC<PageTableViewProps> = ({
  pages,
  onPageClick,
  onCreateChild,
  onCreateTask,
  sortBy = 'updated',
  sortDirection = 'desc',
  groupBy = 'none',
  showExcerpts = false,
  enableSelection = true,
}) => {
  const today = useMemo(() => dayjs(), []);
  const navigate = useNavigate();
  const selectionMode = useSelectionStore((s) => s.selectionMode);
  const selectedIds = useSelectionStore((s) => s.selectedIds.page);
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  const toggleSelect = useSelectionStore((s) => s.toggleSelect);
  const requestDelete = useDeleteConfirmStore((s) => s.requestDelete);
  const tabsEnabled = useSettingsStore((s) => s.tabsEnabled);
  const openTab = useTabsStore((s) => s.openTab);
  const { deletePage, updatePage } = usePagesStore(useShallow(selectPageActions));

  // Build columns
  const columns = useMemo((): DataTableColumn<Page>[] => [
    {
      id: 'icon',
      label: '',
      width: '40px',
      align: 'center',
      render: (page) => {
        const iconType = page.isDailyNote ? 'daily' : 
                         page.viewMode === 'tasks' ? 'tasks' : 
                         page.viewMode === 'collection' ? 'collection' : 'note';
        return (
          <ItemIcon
            icon={page.icon}
            color={page.color}
            type={iconType}
            size="sm"
          />
        );
      },
    },
    {
      id: 'title',
      label: 'Title',
      width: 'minmax(200px, 1fr)',
      render: (page) => (
        <div className="flex flex-col min-w-0">
          <div className="flex items-center min-w-0">
            <span className="truncate text-sm text-[var(--color-text-primary)] font-medium">
              {page.title || 'Untitled'}
            </span>
            {page.isPinned && (
              <span className="ml-2 text-xs text-[var(--color-text-secondary)]">📌</span>
            )}
          </div>
          {showExcerpts && page.excerpt && (
            <span className="text-xs text-[var(--color-text-secondary)] truncate mt-0.5">
              {page.excerpt}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'type',
      label: 'Type',
      width: '120px',
      align: 'center',
      render: (page) => <TypeBadge viewMode={page.viewMode} childCount={page.childCount} />,
    },
    {
      id: 'children',
      label: 'Children',
      width: '80px',
      align: 'center',
      render: (page) => page.childCount && page.childCount > 0 ? (
        <span className="text-xs font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface-inset)] px-2 py-0.5 rounded-full">
          {page.childCount}
        </span>
      ) : (
        <span className="text-xs text-[var(--color-text-secondary)]">—</span>
      ),
    },
    {
      id: 'updated',
      label: 'Updated',
      width: '120px',
      render: (page) => (
        <span className="text-xs text-[var(--color-text-secondary)]">
          {dayjs(page.updated).fromNow()}
        </span>
      ),
    },
    {
      id: 'created',
      label: 'Created',
      width: '100px',
      render: (page) => (
        <span className="text-xs text-[var(--color-text-secondary)]">
          {dayjs(page.created).format('MMM D, YYYY')}
        </span>
      ),
    },
  ], [showExcerpts]);

  // Handle row click
  const handleRowClick = useCallback((page: Page, event: React.MouseEvent) => {
    if (enableSelection && (selectionMode || event.metaKey || event.ctrlKey || event.shiftKey)) {
      event.preventDefault();
      event.stopPropagation();
      toggleSelect('page', page.id);
    } else {
      if (enableSelection) {
        clearSelection('page');
      }
      onPageClick(page.id);
    }
  }, [enableSelection, selectionMode, toggleSelect, clearSelection, onPageClick]);

  // Check if page is selected
  const isSelected = useCallback((page: Page) => selectedIds.has(page.id), [selectedIds]);

  const getMenuItems = useCallback((page: Page): ContextMenuItem[] => {
    const effectiveSelection = Array.from(new Set([...selectedIds, page.id]));
    const isMultiSelect = effectiveSelection.length > 1;
    const selectionCount = effectiveSelection.length;
    const childCount = page.childCount || 0;
    const hasChildren = !isMultiSelect && childCount > 0;

    return buildPageMenuItems({
      isMultiSelect,
      selectionCount,
      tabsEnabled,
      isPinned: !!page.isPinned,
      onOpenInNewTab: tabsEnabled ? () => {
        openTab({
          title: page.title,
          path: `/pages/${page.id}`,
          icon: page.icon,
          color: page.color,
          pageId: page.id,
          type: 'page',
        });
        navigate({ to: '/pages/$id', params: { id: page.id } });
      } : undefined,
      onTogglePin: () => updatePage(page.id, { isPinned: !page.isPinned }),
      onExportMarkdown: async () => {
        try {
          await exportPageToMarkdown(page.id, page.title);
        } catch (error) {
          console.error('Export failed:', error);
        }
      },
      onExportCSV: page.viewMode === 'tasks' ? () => {
        try {
          exportTasksToCSV(page.id, page.title);
          toastSuccess('Tasks exported to CSV');
        } catch (error) {
          console.error('CSV export failed:', error);
          toastError('No tasks to export');
        }
      } : undefined,
      onDelete: () => {
        requestDelete({
          itemType: 'page',
          count: selectionCount,
          hasChildren,
          childCount: hasChildren ? childCount : 0,
          onConfirm: (cascade: boolean) => {
            effectiveSelection.forEach((id) => {
              deletePage(id, cascade);
            });
            clearSelection('page');
          },
        });
      },
    });
  }, [clearSelection, deletePage, navigate, openTab, requestDelete, selectedIds, tabsEnabled, updatePage]);

  // Sort pages
  const sortedPages = useMemo(() => {
    return [...pages].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'updated':
          comparison = new Date(a.updated).getTime() - new Date(b.updated).getTime();
          break;
        case 'created':
          comparison = new Date(a.created).getTime() - new Date(b.created).getTime();
          break;
        case 'title':
          comparison = (a.title || '').localeCompare(b.title || '');
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [pages, sortBy, sortDirection]);

  // Group by date
  const tableGroups = useMemo((): DataTableGroup<Page>[] => {
    if (groupBy === 'none') return [];
    const groups: Record<string, { label: string; pages: Page[] }> = {};
    
    // Generate date groups based on page dates
    const pageDates = sortedPages.map(p => ({ date: p.updated }));
    const dateGroups = generatePageDateGroups(pageDates, today);
    
    // Initialize groups
    for (const group of dateGroups) {
      groups[group.key] = { label: group.label, pages: [] };
    }
    
    // Categorize pages
    for (const page of sortedPages) {
      const groupKey = categorizePageDateGroup(page.updated, today);
      if (groups[groupKey]) {
        groups[groupKey].pages.push(page);
      } else {
        // Fallback to 'older'
        if (!groups.older) {
          groups.older = { label: 'Older', pages: [] };
        }
        groups.older.pages.push(page);
      }
    }
    
    // Convert to DataTableGroup format
    return Object.entries(groups)
      .filter(([, group]) => group.pages.length > 0)
      .map(([key, group]) => ({
        key,
        label: group.label,
        items: group.pages,
      }));
  }, [sortedPages, today, groupBy]);

  // No grouping - simple table
  if (groupBy === 'none') {
    return (
      <DataTable
        columns={columns}
        items={sortedPages}
        getKey={(page) => page.id}
        onRowClick={handleRowClick}
        getMenuItems={getMenuItems}
        isSelected={isSelected}
        emptyMessage="No pages"
        maxWidth="100%"
      />
    );
  }

  return (
    <DataTable
      columns={columns}
      items={[]}
      groups={tableGroups}
      getKey={(page) => page.id}
      onRowClick={handleRowClick}
      getMenuItems={getMenuItems}
      isSelected={isSelected}
      emptyMessage="No pages"
      maxWidth="100%"
    />
  );
};

export default PageTableView;
