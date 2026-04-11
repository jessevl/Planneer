/**
 * @file PagesView.tsx
 * @description Main view component for the Pages App
 * @app PAGES - Primary pages display view
 *
 * The main content area for page management, displaying either:
 * - Page collection (PageCollection) when browsing all/filtered pages
 * - Page detail (PageDetailView) when a specific page is selected
 *
 * Features:
 * - ViewHeader with title and view options
 * - View mode toggle (grid/list)
 * - Sorting by updated or created date
 * - Grouping by date or none
 * - Card size options for grid view
 * - Search result display with highlighting
 * - Filtering (all, pages only, collections only)
 * - Split view with list + page detail panel (list mode on desktop)
 *
 * Route Props (from TanStack Router):
 * - routePageId: Page ID from URL (/pages/:id)
 *
 * Navigation:
 * - Click page card/row → navigates to /pages/:id
 * - PageDetailView breadcrumbs → navigate hierarchy
 * - Home navigation → returns to /pages
 *
 * State Management:
 * - View preferences from useNavigationStore (persisted)
 * - CRUD operations from usePagesStore (accessed directly)
 * - Editor state managed by usePagesStore
 */
import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useShallow } from 'zustand/react/shallow';
import type { Page, PageViewMode } from '../types/page';
import type { GroupBy } from '../components/layout/ViewSwitcher';
import type { PageFilterOptions } from '../types/view';
import { collectPageTags, applyPageFilterOptions } from '../lib/selectors';
import UnifiedHeader from '../components/layout/UnifiedHeader';
import UnifiedSidepanel, { UNIFIED_SIDEPANEL_DOCK_WIDTH, UNIFIED_SIDEPANEL_FLOATING_GUTTER, UNIFIED_SIDEPANEL_FLOATING_RESERVE_WIDTH } from '../components/layout/UnifiedSidepanel';
import FloatingSidePanelLayout from '../components/layout/FloatingSidePanelLayout';
import PageCollection from '../components/pages/PageCollection';
import PageDetailView from '../components/pages/PageDetailView';
import { PagesIcon } from '../components/common/Icons';
import { ResizeHandle } from '../components/ui';
import { SplitViewProvider } from '@/contexts/SplitViewContext';
import { usePagesStore, usePages, selectPageActions, type PagesState } from '@/stores/pagesStore';
import { useNavigationStore, selectPagesViewState, selectPagesViewActions } from '@/stores/navigationStore';
import { useIsMobile, useIsDesktop } from '@frameer/hooks/useMobileDetection';
import { PAGES_PAGINATION } from '@/lib/config';
import { cn } from '@/lib/design-system';
import { isBooxPage } from '@/lib/pageUtils';

interface PagesViewProps {
  /** Route-provided page ID (from /pages/:id) */
  routePageId?: string;
  splitViewPageId?: string;
}

const PagesView: React.FC<PagesViewProps> = ({
  routePageId,
  splitViewPageId: routeSplitViewPageId,
}) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  // Desktop detection for reading pane (disable on tablet < 1024px)
  const isDesktop = useIsDesktop();

  // Selected page state for split view (list mode) - synced with URL
  // Initialize from route prop, then keep in sync
  const [splitViewPageId, setSplitViewPageIdState] = useState<string | null>(routeSplitViewPageId ?? null);
  
  // Update local state when route prop changes (e.g., browser back/forward)
  useEffect(() => {
    setSplitViewPageIdState(routeSplitViewPageId ?? null);
  }, [routeSplitViewPageId]);
  
  const setSplitViewPageId = useCallback((pageId: string | null) => {
    if (pageId === splitViewPageId) return;
    setSplitViewPageIdState(pageId);
  }, [splitViewPageId]);

  // Sidebar visibility from navigation store
  const sidebarVisible = useNavigationStore((state) => state.sidebarVisible);
  const setSidebarVisible = useNavigationStore((state) => state.setSidebarVisible);
  const toggleSidebar = useCallback(() => setSidebarVisible(!sidebarVisible), [setSidebarVisible, sidebarVisible]);
  const pagesSearchQuery = useNavigationStore((state) => state.pagesSearchQuery);
  const sidePanelOpen = useNavigationStore((state) => state.sidePanelOpen);
  const setSidePanelOpen = useNavigationStore((state) => state.setSidePanelOpen);

  // === ZUSTAND STORES - Combined selectors for fewer subscriptions ===
  // Pages store - data and actions
  const { pages } = usePages();
  const pagesById = usePagesStore((state: PagesState) => state.pagesById);
  const selectPage = usePagesStore((state: PagesState) => state.selectPage);

  // Pagination state for "Load More"
  const hasMore = usePagesStore((state: PagesState) => state.hasMore);
  const totalItems = usePagesStore((state: PagesState) => state.totalItems);
  const isLoading = usePagesStore((state: PagesState) => state.isLoading);
  const loadMorePages = usePagesStore((state: PagesState) => state.loadMorePages);
  const {
    createPage,
    updatePage,
    deletePage,
    movePage,
    reorderPages,
    getChildren,
    getAncestors,
    setExpanded,
  } = usePagesStore(useShallow(selectPageActions));

  // Navigation store - view state and actions (combined for performance)
  const { viewMode, sortBy, sortDirection, groupBy, filterBy, showExcerpts, tagFilter } =
    useNavigationStore(useShallow(selectPagesViewState));
  const { setViewMode, setSortBy, setSortDirection, setGroupBy, setFilterBy, setShowExcerpts, setTagFilter } =
    useNavigationStore(useShallow(selectPagesViewActions));

  useEffect(() => {
    if (viewMode === 'graph') {
      setViewMode('kanban');
    }
  }, [viewMode, setViewMode]);

  // Page filter options object (combines filterBy + tagFilter)
  const pageFilterOptions = useMemo((): PageFilterOptions => ({
    filterBy: filterBy as PageFilterOptions['filterBy'],
    tags: tagFilter,
  }), [filterBy, tagFilter]);

  const handlePageFilterOptionsChange = useCallback((opts: PageFilterOptions) => {
    setFilterBy(opts.filterBy);
    setTagFilter(opts.tags);
  }, [setFilterBy, setTagFilter]);

  // All unique tags across pages (for filter suggestions)
  const allPageTags = useMemo(() => collectPageTags(pages), [pages]);

  // --- RESIZING LOGIC ---
  const [splitViewWidth, setSplitViewWidth] = useState(420);
  const isResizingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const newWidth = Math.max(280, Math.min(600, e.clientX - containerRect.left));
    setSplitViewWidth(newWidth);
  }, []);

  const handleResizeEnd = useCallback(() => {
    if (!isResizingRef.current) return;
    isResizingRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeEnd);
    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [handleResizeMove, handleResizeEnd]);

  // Wrapper to load more pages with current sort settings (all pages, not root-only)
  const handleLoadMorePages = useCallback(() => {
    loadMorePages(false, sortBy, sortDirection);  // false = all pages, not root-only
  }, [loadMorePages, sortBy, sortDirection]);

  // Load all pages (not just root) when viewing All Pages view
  // Initial app load only fetches root pages for sidebar, so we need to fetch all here
  // Page size is controlled by PAGES_PAGINATION.PAGE_SIZE in config.ts
  const loadPages = usePagesStore((state: PagesState) => state.loadPages);
  useEffect(() => {
    // Only load all pages when not viewing a specific page (i.e., on All Pages view)
    if (!routePageId) {
      loadPages({ sortBy, sortDirection }); // Uses PAGE_SIZE from config via API
    }
  }, [routePageId, loadPages, sortBy, sortDirection]);

  // Use route prop for selected page
  const selectedPageId = routePageId ?? null;
  const hasSearchQuery = !!pagesSearchQuery.trim();
  const searchQuery = pagesSearchQuery;

  // Filtered pages (search)
  const filteredPages = useMemo(() => {
    const nonDaily = pages.filter((page: Page) => !page.isDailyNote);
    if (!pagesSearchQuery.trim()) return nonDaily;
    const query = pagesSearchQuery.toLowerCase();
    return nonDaily.filter((page: Page) =>
      page.title.toLowerCase().includes(query) ||
      (page.content && JSON.stringify(page.content).toLowerCase().includes(query))
    );
  }, [pages, pagesSearchQuery, filterBy]);

  // Get selected page if any (for route-based navigation)
  const selectedPage = useMemo(() => {
    if (!selectedPageId) return null;
    return pagesById[selectedPageId] || null;
  }, [selectedPageId, pagesById]);

  useEffect(() => {
    if (!routePageId || !selectedPage || !isBooxPage(selectedPage)) {
      return;
    }

    navigate({ to: '/handwritten/$id', params: { id: selectedPage.id }, replace: true });
  }, [navigate, routePageId, selectedPage]);

  const canUseRouteSplitView = useMemo(() => {
    return false;
  }, []);

  // Clear stale split-view query when it cannot be rendered for the current page/context.
  useEffect(() => {
    if (selectedPageId && splitViewPageId && !canUseRouteSplitView) {
      setSplitViewPageId(null);
    }
  }, [selectedPageId, splitViewPageId, canUseRouteSplitView, setSplitViewPageId]);

  // Get split view page (for inline display)
  const splitViewPage = useMemo(() => {
    if (!splitViewPageId) return null;
    return pagesById[splitViewPageId] || null;
  }, [splitViewPageId, pagesById]);
  
  // Clear split view selection if the page no longer exists (e.g., deleted externally)
  useEffect(() => {
    if (splitViewPageId && !pagesById[splitViewPageId]) {
      setSplitViewPageId(null);
    }
  }, [splitViewPageId, pagesById, setSplitViewPageId]);

  // Track if this is a fresh page load (URL navigation) vs in-app navigation
  // On fresh load, we force a full fetch to prevent stale data accumulation
  const isInitialLoadRef = useRef(true);
  const previousPageIdRef = useRef<string | null>(null);

  // Initialize draft state when navigating to a page
  // Only trigger on selectedPageId change, NOT on pagesById changes (which selectPage updates)
  useEffect(() => {
    if (selectedPageId) {
      // Force refresh on initial page load OR when navigating to a different page via URL
      // This ensures we always have fresh content from server
      const isFirstLoad = isInitialLoadRef.current;
      const isDifferentPage = previousPageIdRef.current !== selectedPageId;

      // On first load, always force refresh
      // On subsequent navigations, only force refresh if it's a different page
      const forceRefresh = isFirstLoad || isDifferentPage;

      selectPage(selectedPageId, false, forceRefresh, canUseRouteSplitView);

      isInitialLoadRef.current = false;
      previousPageIdRef.current = selectedPageId;
    } else if (!splitViewPageId) {
      // If no page is selected and no split view is active, clear active page
      selectPage(null);
    }
  }, [selectedPageId, canUseRouteSplitView, selectPage]);

  // Initialize draft state for split view page
  const splitViewInitRef = useRef<string | null>(null);
  useEffect(() => {
    if (splitViewPageId && splitViewInitRef.current !== splitViewPageId) {
      // Split view page is always active
      selectPage(splitViewPageId, false, true, false);
      splitViewInitRef.current = splitViewPageId;
    }
  }, [splitViewPageId, selectPage]);

  // Load children when viewing a page (so child count is accurate)
  const childrenIndex = usePagesStore((state: PagesState) => state.childrenIndex);
  useEffect(() => {
    if (!selectedPage) return;

    // Check if this page has children that aren't loaded yet
    const expectedChildCount = selectedPage.childCount ?? 0;
    const loadedChildCount = childrenIndex[selectedPage.id]?.length ?? 0;

    if (expectedChildCount > 0 && loadedChildCount < expectedChildCount) {
      // Use 'order' sort by default (PageDetailView will re-sort based on its settings)
      loadPages({ parentId: selectedPage.id, sortBy: 'order', sortDirection: 'asc' });
    }
  }, [selectedPage?.id, selectedPage?.childCount, childrenIndex, loadPages]);

  // Load children for split view page
  useEffect(() => {
    if (!splitViewPage) return;

    const expectedChildCount = splitViewPage.childCount ?? 0;
    const loadedChildCount = childrenIndex[splitViewPage.id]?.length ?? 0;

    if (expectedChildCount > 0 && loadedChildCount < expectedChildCount) {
      loadPages({ parentId: splitViewPage.id, sortBy: 'order', sortDirection: 'asc' });
    }
  }, [splitViewPage?.id, splitViewPage?.childCount, childrenIndex, loadPages]);

  // Get children and ancestors for selected page
  // Note: We depend on pagesById to ensure reactivity when children are reordered/moved
  const childPages = useMemo(() => {
    if (!selectedPage) return [];
    return getChildren(selectedPage.id);
     
  }, [selectedPage, getChildren, pagesById]);

  const ancestors = useMemo(() => {
    if (!selectedPage) return [];
    return getAncestors(selectedPage.id);
     
  }, [selectedPage, getAncestors, pagesById]);

  // Get children and ancestors for split view page
  const splitViewChildPages = useMemo(() => {
    if (!splitViewPage) return [];
    return getChildren(splitViewPage.id);
     
  }, [splitViewPage, getChildren, pagesById]);

  const splitViewAncestors = useMemo(() => {
    if (!splitViewPage) return [];
    return getAncestors(splitViewPage.id);
     
  }, [splitViewPage, getAncestors, pagesById]);

  // All Pages: Apply filter and sort by updated
  const displayPages = useMemo(() => {
    let filtered = applyPageFilterOptions(filteredPages, pageFilterOptions);
    return [...filtered].sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
  }, [filteredPages, pageFilterOptions]);

  // Get filter label for subtitle
  const filterLabel = useMemo(() => {
    switch (filterBy) {
      case 'notes': return 'note';
      case 'collections': return 'collection';
      case 'tasks': return 'tasks page';
      case 'handwritten': return 'handwritten notebook';
      default: return 'page';
    }
  }, [filterBy]);

  const _title = 'All Pages';
  // Use totalItems from pagination for accurate count (not just loaded items)
  const displayCount = totalItems ?? displayPages.length;
  const subtitle = useMemo(() => `${displayCount} ${displayCount === 1 ? filterLabel : filterLabel + 's'}`, [displayCount, filterLabel]);

  // Determine if we should show split view (reading pane enabled on desktop >= 1024px)
  const showSplitView = false;

  // Navigation handlers
  const handlePageNavigate = useCallback((pageId: string) => {
    navigate({
      to: '/pages/$id',
      params: { id: pageId },
      replace: false,
    });
  }, [navigate]);

  const handlePageClick = useCallback((pageId: string) => {
    handlePageNavigate(pageId);
  }, [handlePageNavigate]);

  // Handler for navigating within split view (e.g., clicking child pages)
  const handleSplitViewNavigate = useCallback((pageId: string) => {
    setSplitViewPageId(pageId);
  }, [setSplitViewPageId]);

  const handleNavigateHome = useCallback(() => {
    navigate({ to: '/pages' });
  }, [navigate]);

  // Handler to close split view and go back to list
  const handleSplitViewNavigateHome = useCallback(() => {
    setSplitViewPageId(null);
  }, [setSplitViewPageId]);

  // Handler to expand split view page to full view
  const handleExpandSplitView = useCallback(() => {
    if (splitViewPageId) {
      handlePageNavigate(splitViewPageId);
    }
  }, [splitViewPageId, handlePageNavigate]);

  const handleCreateChildPage = useCallback((parentId: string | null, viewMode?: PageViewMode) => {
    const newPage = createPage({
      title: 'Untitled',
      parentId,
      viewMode: viewMode || 'note',
    });
    // Explicitly mark as new so title auto-focuses (like HomeView does)
    selectPage(newPage.id, true);
    navigate({ to: '/pages/$id', params: { id: newPage.id } });
    if (parentId) {
      setExpanded(parentId, true);
    }
  }, [createPage, selectPage, navigate, setExpanded]);

  // Handler for creating child in split view
  const handleSplitViewCreateChild = useCallback((parentId: string | null, viewMode?: PageViewMode) => {
    const newPage = createPage({
      title: 'Untitled',
      parentId,
      viewMode: viewMode || 'note',
    });
    selectPage(newPage.id, true);
    setSplitViewPageId(newPage.id);
    if (parentId) {
      setExpanded(parentId, true);
    }
  }, [createPage, selectPage, setSplitViewPageId, setExpanded]);

  // Show page view if a page is selected via route
  if (selectedPage) {
    if (isBooxPage(selectedPage)) {
      return null;
    }

    return (
      <PageDetailView
        key={selectedPage.id}
        page={selectedPage}
        children={childPages}
        ancestors={ancestors}
        onNavigate={handlePageNavigate}
        onNavigateHome={handleNavigateHome}
        onUpdatePage={(id, updates) => updatePage(id, updates)}
        onCreateChild={handleCreateChildPage}
        onDeletePage={deletePage}
        onMovePage={(pageId, newParentId) => movePage(pageId, newParentId)}
        sidebarVisible={sidebarVisible}
        onToggleSidebar={toggleSidebar}
        splitViewPageId={splitViewPageId}
        onSplitViewPageChange={setSplitViewPageId}
        onExpandSplitView={handleExpandSplitView}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Split view for list mode on desktop */}
      {showSplitView ? (
        <SplitViewProvider
          parentPageId={null}
          onCreateChild={handleSplitViewCreateChild}
          onNavigateInSplitView={handleSplitViewNavigate}
        >
          <div ref={containerRef} className="flex-1 flex overflow-hidden relative">
            {/* Left panel: Page list - secondary surface (subtle stone) */}
          <div 
            className={cn(
              'relative flex flex-col overflow-hidden',
              'split-list-panel bg-[var(--color-surface-secondary)]',
              'border-r border-[var(--color-border-secondary)]/50',
              // Paper shadow effect
              // NOTE: No z-index here — explicit z-index on the left panel creates
              // a stacking context that causes Safari to render it over the
              // position:fixed drag handle which extends to the left of the editor.
              // DOM order (left before right) handles visual overlap correctly.
              'shadow-[4px_0_24px_-4px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_24px_-4px_rgba(0,0,0,0.25)]',
            )}
            style={{ width: `${splitViewWidth}px`, flexShrink: 0 }}
          >
              {/* Header for list panel */}
              <UnifiedHeader
                sidebarVisible={sidebarVisible}
                onToggleSidebar={toggleSidebar}
                compact={true}
                rootLabel="Pages"
                rootIcon={<PagesIcon className="w-4 h-4" />}
                subtitle={subtitle}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                showViewSettings
                groupBy={groupBy as GroupBy}
                showCompleted={false}
                onGroupByChange={(gb) => setGroupBy(gb === 'date' ? 'date' : 'none')}
                onShowCompletedChange={() => {}}
                contentType="pages"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortByChange={setSortBy}
                onSortDirectionChange={setSortDirection}
                filterBy={filterBy}
                onFilterByChange={setFilterBy}
                pageFilterOptions={pageFilterOptions}
                onPageFilterOptionsChange={handlePageFilterOptionsChange}
                existingPageTags={allPageTags}
                showExcerpts={showExcerpts}
                onShowExcerptsChange={setShowExcerpts}
                showSidePanelToggle={true}
                sidePanelOpen={sidePanelOpen}
              />

              {/* List content - scrollbar stays in visible area */}
              <div className="flex-1 overflow-y-auto pt-[var(--header-height)]">
                <div className="px-3 py-3">
                  <PageCollection
                    pages={displayPages}
                    viewMode={viewMode}
                    groupBy={groupBy}
                    sortBy={sortBy}
                    sortDirection={sortDirection}
                    onPageClick={handlePageClick}
                    onDeletePage={deletePage}
                    hasSearchQuery={hasSearchQuery}
                    searchQuery={searchQuery}
                    hasMore={hasMore}
                    totalItems={totalItems}
                    isLoadingMore={isLoading}
                    onLoadMore={handleLoadMorePages}
                    showExcerpts={showExcerpts}
                  />
                </div>
              </div>
              
              {/* Resize handle - inside visible area, on right edge */}
              <ResizeHandle
                onMouseDown={handleResizeStart}
                className="absolute right-0 top-0 bottom-0"
              />
          </div>

          {/* Right panel: Page detail - primary surface (lightest, main content) */}
          <div 
            className={cn(
              'relative flex-1 flex flex-col overflow-hidden min-w-0',
              'side-panel bg-[var(--color-surface-primary)]',
              // Border on left for subtle definition
              'border-l border-[var(--color-border-secondary)]/30',
              // NOTE: No z-index here. The combination of z-index + overflow-hidden
              // creates a stacking context that causes Safari to clip position:fixed
              // descendants (like the Yoopta drag handle). DOM order already puts
              // this panel above the left panel.
            )}
          >
            {splitViewPage ? (
              <PageDetailView
                key={splitViewPage.id}
                page={splitViewPage}
                children={splitViewChildPages}
                ancestors={splitViewAncestors}
                onNavigate={handleSplitViewNavigate}
                onNavigateHome={handleSplitViewNavigateHome}
                onUpdatePage={(id, updates) => updatePage(id, updates)}
                onCreateChild={handleSplitViewCreateChild}
                onDeletePage={(id, cascade) => {
                  deletePage(id, cascade);
                  setSplitViewPageId(null);
                }}
                onMovePage={(pageId, newParentId) => movePage(pageId, newParentId)}
                sidebarVisible={true}
                onToggleSidebar={() => {}}
                inSplitView={true}
                onExpandSplitView={handleExpandSplitView}
              />
            ) : (
              // Empty state when no page selected
              <div className="flex-1 flex items-center justify-center bg-[var(--color-surface-secondary)]/30">
                <div className="text-center text-[var(--color-text-tertiary)]">
                  <PagesIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium mb-1">Select a page</p>
                  <p className="text-sm">Choose a page from the list to view its contents</p>
                </div>
              </div>
            )}
          </div>
        </div>
        </SplitViewProvider>
      ) : (
        /* Standard view for grid/kanban/table modes */
        <FloatingSidePanelLayout
          side="right"
          isOpen={sidePanelOpen && isDesktop}
          onOpenChange={setSidePanelOpen}
          pinned={false}
          railWidth={0}
          collapsedWidth={0}
          defaultExpandedWidth={UNIFIED_SIDEPANEL_DOCK_WIDTH}
          expandedWidth={UNIFIED_SIDEPANEL_DOCK_WIDTH}
          gutterPx={UNIFIED_SIDEPANEL_FLOATING_GUTTER}
          className="flex-1 overflow-hidden view-content"
          contentClassName="h-full overflow-y-auto"
          renderPanel={() => (
            <UnifiedSidepanel floating />
          )}
        >
            <UnifiedHeader
              sidebarVisible={sidebarVisible}
              onToggleSidebar={toggleSidebar}
              rootLabel="Pages"
              rootIcon={<PagesIcon className="w-4 h-4" />}
              subtitle={subtitle}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              showViewSettings
              groupBy={groupBy as GroupBy}
              showCompleted={false}
              onGroupByChange={(gb) => setGroupBy(gb === 'date' ? 'date' : 'none')}
              onShowCompletedChange={() => {}}
              contentType="pages"
              sortBy={sortBy}
              sortDirection={sortDirection}
              onSortByChange={setSortBy}
              onSortDirectionChange={setSortDirection}
              filterBy={filterBy}
              onFilterByChange={setFilterBy}
              pageFilterOptions={pageFilterOptions}
              onPageFilterOptionsChange={handlePageFilterOptionsChange}
              existingPageTags={allPageTags}
              showExcerpts={showExcerpts}
              onShowExcerptsChange={setShowExcerpts}
              showSidePanelToggle={true}
              sidePanelOpen={sidePanelOpen}
            />

            <div className="pt-[calc(var(--header-height)+1.5rem)] py-2 pb-32 md:pb-6">
              <div className="max-w-5xl mx-auto px-4 md:px-6">
              <PageCollection
                pages={displayPages}
                viewMode={viewMode}
                groupBy={groupBy}
                sortBy={sortBy}
                sortDirection={sortDirection}
                onPageClick={handlePageClick}
                onDeletePage={deletePage}
                hasSearchQuery={hasSearchQuery}
                searchQuery={searchQuery}
                hasMore={hasMore}
                totalItems={totalItems}
                isLoadingMore={isLoading}
                onLoadMore={handleLoadMorePages}
                showExcerpts={showExcerpts}
              />
              </div>
            </div>
        </FloatingSidePanelLayout>
      )}
    </div>
  );
};

export default PagesView;
