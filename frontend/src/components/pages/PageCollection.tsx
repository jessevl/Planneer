/**
 * @file PageCollection.tsx
 * @description Container component for displaying a collection of pages
 * @app PAGES - Main page listing component
 * 
 * Renders a collection of pages in either grid (kanban) or list view.
 * Handles sorting, grouping, and empty states.
 * 
 * Features:
 * - Grid view using PageCard components
 * - List view using PageRow components
 * - Date-based grouping (Today, This Week, Last Week, etc.)
 * - Sorting by updated, created, or manual order
 * - Search result highlighting
 * - Empty state with create button
 * - Child count display per page
 * - Centralized properties modal management
 * - Optional header with controls (count, view toggle, create button)
 * - External drag-and-drop support (move pages into collection from sidebar)
 * 
 * Used by:
 * - PagesView (main pages listing)
 * - PageDetailView collection mode (children listing)
 */
import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import type { Page, PageViewMode } from '../../types/page';
import type { ViewMode, PageFilterOptions } from '../../types/view';
import { DEFAULT_PAGE_FILTER_OPTIONS } from '../../types/view';
import type { PageSavedView, TaskViewConfig, CollectionViewConfig } from '@/types/savedView';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { categorizePageDateGroup, generatePageDateGroups } from '../../lib/dateGroups';
import { applyPageFilterOptions } from '../../lib/selectors';
import PageCard from './PageCard';
import PageRow from './PageRow';
import PageTableView from './PageTableView';
import ViewSwitcherMobileWrapper from '../layout/ViewSwitcherMobileWrapper';
import SortFilterViewBar from '../layout/SortFilterViewBar';
import { Card, SmartEmptyState, Label, Button, SectionHeader } from '@/components/ui';
import { PlusIcon } from '../common/Icons';

import { usePagesStore, type PagesState } from '@/stores/pagesStore';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';

dayjs.extend(relativeTime);

interface PageCollectionProps {
  pages: Page[];
  onPageClick: (pageId: string) => void;
  onCreatePage?: (viewMode?: PageViewMode) => void;
  onDeletePage?: (id: string, cascade?: boolean) => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  groupBy?: 'none' | 'date';
  onGroupByChange?: (groupBy: 'none' | 'date') => void;
  sortBy?: 'updated' | 'created' | 'order' | 'title';
  onSortByChange?: (sortBy: 'updated' | 'created' | 'title') => void;
  sortDirection?: 'asc' | 'desc';
  onSortDirectionChange?: (direction: 'asc' | 'desc') => void;
  filterBy?: 'all' | 'notes' | 'collections' | 'tasks';
  onFilterByChange?: (filter: 'all' | 'notes' | 'collections' | 'tasks') => void;
  /** Page filter options (type + tags) */
  pageFilterOptions?: PageFilterOptions;
  /** Callback to change page filter options */
  onPageFilterOptionsChange?: (opts: PageFilterOptions) => void;
  /** All existing page tags in the current context (for tag filter suggestions) */
  existingPageTags?: string[];
  hasSearchQuery?: boolean;
  searchQuery?: string;
  /** Show header with count, view toggle, and create button */
  showHeader?: boolean;
  /** Custom empty state message */
  emptyTitle?: string;
  emptyDescription?: string;
  /** Called when an external page is dropped into this collection (from sidebar) */
  onExternalDrop?: (pageId: string) => void;
  /** IDs to exclude from external drop (e.g., the collection itself) */
  excludeFromDrop?: string[];
  /** Custom header content (rendered above the list, below showHeader controls) */
  headerContent?: React.ReactNode;
  /** Whether items can be dragged (default true for sidebar operations) */
  draggable?: boolean;
  /** Pagination: whether there are more items to load */
  hasMore?: boolean;
  /** Pagination: total number of items */
  totalItems?: number;
  /** Pagination: whether currently loading more */
  isLoadingMore?: boolean;
  /** Pagination: callback to load more items */
  onLoadMore?: () => void;
  /** Whether to show excerpts in page cards (default: true) */
  showExcerpts?: boolean;
  /** Callback to change showExcerpts setting */
  onShowExcerptsChange?: (show: boolean) => void;
  /** Optional saved views bar to render in header (desktop only) */
  savedViewsBar?: React.ReactNode;
  /** Page object for saved views (mobile sheet) */
  page?: Page;
  /** Callback to update page with saved view changes (mobile sheet) */
  onSavedViewUpdate?: (
    updates: { savedViews?: PageSavedView[]; activeSavedViewId?: string | null },
    configToApply?: TaskViewConfig | CollectionViewConfig | null
  ) => void;
  /** Current view config for saved views (mobile sheet) */
  currentSavedViewConfig?: CollectionViewConfig;
}

const PageCollection: React.FC<PageCollectionProps> = ({
  pages,
  onPageClick,
  onCreatePage,
  onDeletePage,
  viewMode = 'kanban',
  onViewModeChange,
  groupBy = 'date',
  onGroupByChange,
  sortBy = 'updated',
  onSortByChange,
  sortDirection = 'desc',
  onSortDirectionChange,
  filterBy,
  onFilterByChange,
  pageFilterOptions = DEFAULT_PAGE_FILTER_OPTIONS,
  onPageFilterOptionsChange,
  existingPageTags = [],
  hasSearchQuery = false,
  searchQuery = '',
  showHeader = false,
  emptyTitle,
  emptyDescription,
  onExternalDrop,
  excludeFromDrop = [],
  headerContent,
  draggable = true,
  hasMore = false,
  totalItems,
  isLoadingMore = false,
  onLoadMore,
  showExcerpts = true,
  onShowExcerptsChange,
  savedViewsBar,
  // Saved views for mobile sheet
  page: savedViewsPage,
  onSavedViewUpdate,
  currentSavedViewConfig,
}) => {
  const today = useMemo(() => dayjs(), []);
  const isMobile = useIsMobile();
  
  // External drop visual feedback state
  const [isExternalDropActive, setIsExternalDropActive] = useState(false);
  
  // Infinite scroll observer
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };
  
  useEffect(() => {
    if (!hasMore || !onLoadMore || isLoadingMore) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );
    
    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }
    
    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMore, onLoadMore, isLoadingMore]);
  
  const pagesById = usePagesStore((s: PagesState) => s.pagesById);
  const movePage = usePagesStore((s: PagesState) => s.movePage);

  // Handler for dropping a page onto another page to reparent
  const handlePageDrop = useCallback((droppedPageId: string, targetPageId: string) => {
    if (droppedPageId === targetPageId) return;
    movePage(droppedPageId, targetPageId);
  }, [movePage]);

  // Sort pages - memoized with all dependencies
  const sortedPages = useMemo(() => {
    return [...pages].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'order':
          comparison = a.order - b.order;
          break;
        case 'updated':
          comparison = new Date(a.updated).getTime() - new Date(b.updated).getTime();
          break;
        case 'created':
          comparison = new Date(a.created).getTime() - new Date(b.created).getTime();
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [pages, sortBy, sortDirection]);

  // Apply page filter options (type + tags) after sorting
  const filteredPages = useMemo(() => {
    return applyPageFilterOptions(sortedPages, pageFilterOptions);
  }, [sortedPages, pageFilterOptions]);

  // External drop handlers (for sidebar moves)
  const handleExternalDragOver = useCallback((e: React.DragEvent) => {
    if (!onExternalDrop) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsExternalDropActive(true);
  }, [onExternalDrop]);

  const handleExternalDragLeave = useCallback((e: React.DragEvent) => {
    // Only deactivate if actually leaving the container (not entering a child)
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsExternalDropActive(false);
  }, []);

  const handleExternalDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsExternalDropActive(false);
    
    if (!onExternalDrop) return;
    
    // Get dropped item ID from drag data
    const droppedId = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('pageId');
    if (!droppedId) return;
    
    // Don't allow dropping excluded items (e.g., the collection itself or its ancestors)
    if (excludeFromDrop.includes(droppedId)) return;
    
    // Check if it's not already in the collection
    const isAlreadyInCollection = pages.some(n => n.id === droppedId);
    if (!isAlreadyInCollection) {
      onExternalDrop(droppedId);
    }
  }, [onExternalDrop, excludeFromDrop, pages]);

  // Group pages - optimized with early return
  const groupedPages = useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: 'all', label: '', pages: filteredPages }];
    }

    // Date grouping
    const dateField = sortBy === 'created' ? 'created' : 'updated';
    const pageDates = filteredPages.map(page => ({ date: page[dateField] }));
    const dateGroups = generatePageDateGroups(pageDates, today);
    
    // Initialize and populate groups
    const groups = dateGroups.reduce((acc, group) => {
      acc[group.key] = { label: group.label, pages: [], order: group.order };
      return acc;
    }, {} as Record<string, { label: string; pages: Page[]; order: number }>);

    filteredPages.forEach((page) => {
      const category = categorizePageDateGroup(page[dateField], today);
      if (groups[category]) {
        groups[category].pages.push(page);
      }
    });

    // Sort groups by order, respecting sortDirection
    // desc = most recent first (lower order first), asc = oldest first (higher order first)
    return Object.entries(groups)
      .filter(([, group]) => group.pages.length > 0)
      .sort((a, b) => sortDirection === 'desc' 
        ? a[1].order - b[1].order 
        : b[1].order - a[1].order
      )
      .map(([key, group]) => ({ key, label: group.label, pages: group.pages }));
  }, [filteredPages, groupBy, sortBy, sortDirection, today]);

  const renderPage = useCallback((page: Page) => {
    const parentPage = page.parentId ? pagesById[page.parentId] : null;
    if (viewMode === 'kanban') {
      return (
        <PageCard 
          key={page.id} 
          page={page} 
          onClick={onPageClick} 
          searchQuery={searchQuery}
          draggable={draggable}
          parentPage={parentPage}
          showExcerpt={showExcerpts}
          onPageDrop={handlePageDrop}
        />
      );
    }
    return (
      <PageRow 
        key={page.id} 
        page={page} 
        onClick={onPageClick}
        searchQuery={searchQuery}
        draggable={draggable}
        parentPage={parentPage}
        onPageDrop={handlePageDrop}
      />
    );
  }, [viewMode, onPageClick, searchQuery, draggable, pagesById, showExcerpts, handlePageDrop]);

  // Grid or list layout
  // Use auto-fill with minmax to be responsive to container width rather than viewport
  const containerClass = viewMode === 'kanban' 
    ? "grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 sm:gap-4" 
    : "divide-y divide-[var(--color-border-subtle)]";

  // Empty state
  if (pages.length === 0 && !showHeader) {
    return (
      <div className="py-2">
        <SmartEmptyState 
          type={hasSearchQuery ? 'search' : 'pages'}
        />
      </div>
    );
  }

  return (
    <>
      {/* Optional header with controls */}
      {showHeader && (
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {/* Hide savedViewsBar on mobile - it's in the mobile sheet */}
            {!isMobile && savedViewsBar}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Sort/filter/view controls - desktop: inline icons, mobile: bottom sheet */}
            {(onSortByChange || onGroupByChange || onViewModeChange) && (
              isMobile ? (
                <ViewSwitcherMobileWrapper
                  viewMode={viewMode}
                  groupBy={groupBy === 'date' ? 'date' : 'none'}
                  showCompleted={false}
                  onViewModeChange={onViewModeChange || (() => {})}
                  onGroupByChange={(gb) => onGroupByChange?.(gb === 'date' ? 'date' : 'none')}
                  onShowCompletedChange={() => {}}
                  contentType="pages"
                  sortBy={sortBy === 'order' ? 'updated' : sortBy}
                  sortDirection={sortDirection}
                  onSortByChange={onSortByChange}
                  onSortDirectionChange={onSortDirectionChange}
                  filterBy={filterBy}
                  onFilterByChange={onFilterByChange}
                  showExcerpts={showExcerpts}
                  onShowExcerptsChange={onShowExcerptsChange}
                  // Saved views for mobile sheet
                  page={savedViewsPage}
                  onSavedViewUpdate={onSavedViewUpdate}
                  currentConfig={currentSavedViewConfig}
                />
              ) : (
                <SortFilterViewBar
                  contentType="pages"
                  viewMode={viewMode}
                  onViewModeChange={onViewModeChange || (() => {})}
                  groupBy={groupBy === 'date' ? 'date' : 'none'}
                  onGroupByChange={(gb) => onGroupByChange?.(gb === 'date' ? 'date' : 'none')}
                  showCompleted={false}
                  onShowCompletedChange={() => {}}
                  sortBy={sortBy === 'order' ? 'updated' : sortBy}
                  sortDirection={sortDirection}
                  onSortByChange={onSortByChange}
                  onSortDirectionChange={onSortDirectionChange}
                  filterBy={filterBy}
                  onFilterByChange={onFilterByChange}
                  pageFilterOptions={pageFilterOptions}
                  onPageFilterOptionsChange={onPageFilterOptionsChange}
                  existingPageTags={existingPageTags}
                  showExcerpts={showExcerpts}
                  onShowExcerptsChange={onShowExcerptsChange}
                />
              )
            )}
          </div>
        </div>
      )}

      {/* Drop zone wrapper for accepting drops from external sources (sidebar) */}
      <div
        onDragOver={onExternalDrop ? handleExternalDragOver : undefined}
        onDragLeave={onExternalDrop ? handleExternalDragLeave : undefined}
        onDrop={onExternalDrop ? handleExternalDrop : undefined}
        className={`rounded-lg transition-all ${
          isExternalDropActive 
            ? 'ring-2 ring-[var(--color-interactive-ring)] ring-dashed bg-[var(--color-interactive-bg)]/50 p-2 -m-2' 
            : ''
        }`}
      >
        {/* Optional header content slot */}
        {headerContent}
        
        {pages.length === 0 ? (
          // Empty state when header is shown - use SmartEmptyState for consistency
          <SmartEmptyState 
            type={hasSearchQuery ? 'search' : 'collection'}
            title={emptyTitle}
            description={emptyDescription}
            actionLabel={onCreatePage && !hasSearchQuery ? "Add Note" : undefined}
            onAction={onCreatePage && !hasSearchQuery ? onCreatePage : undefined}
          />
        ) : viewMode === 'table' ? (
          // Table view - uses its own grouping
          <div className="max-w-5xl mx-auto">
            <PageTableView
              pages={sortedPages}
              onPageClick={onPageClick}
              sortBy={sortBy === 'order' ? 'updated' : sortBy}
              sortDirection={sortDirection}
              groupBy={groupBy}
              showExcerpts={showExcerpts}
              enableSelection={true}
            />
          </div>
        ) : (
          <div className="space-y-8">
            {groupedPages.map((group) => (
              <div key={group.key}>
                {group.label && (
                  <SectionHeader
                    label={group.label}
                    count={group.pages.length}
                    isExpanded={!collapsedGroups.has(group.key)}
                    onToggle={() => toggleGroup(group.key)}
                    onAdd={onCreatePage ? () => onCreatePage() : undefined}
                    className="mb-3"
                  />
                )}
                {!collapsedGroups.has(group.key) && (
                <div className={containerClass}>
                  {group.pages.map(renderPage)}
                  
                  {/* Add card (gallery mode) */}
                  {viewMode === 'kanban' && onCreatePage && !showHeader && (
                    <button
                      onClick={() => onCreatePage()}
                      className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-dashed border-[var(--color-border-default)] hover:border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-secondary)] transition-colors min-h-[120px]"
                    >
                      <PlusIcon className="w-6 h-6 text-[var(--color-text-tertiary)] mb-2" />
                      <span className="text-sm text-[var(--color-text-secondary)]">Add note</span>
                    </button>
                  )}
                </div>
                )}
              </div>
            ))}
            
            {/* Load More button for pagination */}
            {hasMore && onLoadMore && (
              <div ref={loadMoreRef} className="flex justify-center py-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onLoadMore}
                  disabled={isLoadingMore}
                  className="min-w-[140px]"
                >
                  {isLoadingMore 
                    ? 'Loading...' 
                    : totalItems !== undefined 
                      ? `Load More (${totalItems - pages.length} remaining)`
                      : 'Load More'
                  }
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
      
    </>
  );
};

export default PageCollection;
