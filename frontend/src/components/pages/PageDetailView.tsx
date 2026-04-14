/**
 * @file PageDetailView.tsx
 * @description Full-page view for a single page with multiple display modes
 * @app PAGES - Main page viewing/editing experience
 * 
 * Displays a page in one of several modes:
 * 
 * NOTE MODE (viewMode: 'note'):
 * - Full Yoopta editor embedded directly for writing
 * - Compact collapsible list of sub-pages below the editor
 * - Primary focus: content writing experience
 * 
 * COLLECTION MODE (viewMode: 'collection'):
 * - Small content preview at top (click to edit)
 * - Large children grid/list using PageCollection component
 * - External drag-and-drop support (move pages from sidebar)
 * - Primary focus: organizing and browsing pages
 * 
 * TASKS MODE (viewMode: 'tasks'):
 * - Task list or Kanban board for managing tasks
 * - Tasks are linked to this page via parentPageId
 * 
 * Features:
 * - Breadcrumb navigation to ancestors
 * - Action bar with delete, view mode toggle
 * - Icon/color editing via PageActionsMenu
 * - Create child pages (as page, collection, or tasks)
 * - Move pages via external drag-and-drop from sidebar
 * 
 * State Management:
 * - Uses usePagesStore for editor state (draftTitle, draftContent)
 * - PageEditor reads from store directly
 * 
 * This is the main component rendered when a page is selected in PagesView.
 */
'use client';

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useIsMobile, useIsDesktop } from '@frameer/hooks/useMobileDetection';
import { cn } from '@/lib/design-system';
import type { Page, PageBreadcrumb, PageViewMode, UpdatePageInput } from '../../types/page';
import type { Task } from '../../types/task';
import type { ViewMode as TaskViewMode, GroupBy } from '../layout/ViewSwitcher';
import UnifiedHeader, { type BreadcrumbItem } from '../layout/UnifiedHeader';
import FloatingSidePanelLayout from '../layout/FloatingSidePanelLayout';
import UnifiedSidepanel, { UNIFIED_SIDEPANEL_DOCK_WIDTH, UNIFIED_SIDEPANEL_FLOATING_GUTTER, UNIFIED_SIDEPANEL_FLOATING_RESERVE_WIDTH } from '../layout/UnifiedSidepanel';
import SortFilterViewBar from '../layout/SortFilterViewBar';
import ViewSwitcherMobileWrapper from '../layout/ViewSwitcherMobileWrapper';
const PageEditor = React.lazy(() => import('./PageEditor'));
const SuspensePageEditor: React.FC<React.ComponentProps<typeof PageEditor>> = (props) => (
  <React.Suspense fallback={null}><PageEditor {...props} /></React.Suspense>
);
import PageCollection from './PageCollection';
import PageHero from './PageHero';

import TaskList from '../tasks/TaskList';
import KanbanView from '../tasks/KanbanView';
import TaskTableView from '../tasks/TaskTableView';
import AddTaskForm from '../tasks/AddTaskForm';
import TaskDetailPane from '../tasks/TaskDetailPane';
import ConfirmDiscardModal from '../common/ConfirmDiscardModal';
import SectionManagerModal from './SectionManagerModal';
import { IconButton, Button, LucideIcon, SmartEmptyState, ResizeHandle } from '../ui';
import { SavedViewsBar } from '../ui/SavedViewsBar';
import type { TaskViewConfig, CollectionViewConfig, PageSavedView } from '@/types/savedView';
import { PlusIcon, ChevronDownIcon, ChevronRightIcon, PagesIcon, SettingsIcon } from '../common/Icons';
import ItemIcon from '../common/ItemIcon';
import { usePagesStore, useTaskCollections, type PagesState } from '@/stores/pagesStore';
import { useTasksStore } from '@/stores/tasksStore';
import { useDeleteConfirmStore } from '@/stores/deleteConfirmStore';
import { useUIStore } from '@/stores/uiStore';
import { useNavigationStore, getViewKey } from '@/stores/navigationStore';
import { usePageOperations } from '@/hooks/usePageOperations';
import { SplitViewProvider } from '@/contexts/SplitViewContext';
import type { View } from '../../lib/selectors';
import { applyTaskFilterOptions, collectTaskTags } from '../../lib/selectors';
import { dateGroupToDate, type DateGroupKey } from '../../lib/dateGroups';
import { getRightInsetStyle } from '@/lib/layout';

import { getToday, getTodayISO } from '../../lib/dateUtils';
import type { TaskFilterOptions, PageFilterOptions } from '../../types/view';
import { DEFAULT_TASK_FILTER_OPTIONS, DEFAULT_PAGE_FILTER_OPTIONS } from '../../types/view';

interface PageDetailViewProps {
  page: Page;
  children: Page[];
  ancestors: PageBreadcrumb[];
  onNavigate: (pageId: string) => void;
  onNavigateHome: () => void;
  onUpdatePage: (id: string, updates: UpdatePageInput) => void;
  onCreateChild?: (parentId: string, viewMode?: PageViewMode) => void;
  onDeletePage: (id: string, cascade?: boolean) => void;
  onMovePage?: (pageId: string, newParentId: string | null) => void;
  sidebarVisible?: boolean;
  onToggleSidebar?: () => void;
  /** Whether this view is rendered in a split pane (right panel) */
  inSplitView?: boolean;
  /** Split view page ID for collection mode (controlled from parent) */
  splitViewPageId?: string | null;
  /** Callback when split view page changes (for URL sync) */
  onSplitViewPageChange?: (pageId: string | null) => void;
  /** Callback when expand button is clicked in split view (navigates to full page) */
  onExpandSplitView?: () => void;
}

/**
 * PageDetailView - Displays a page in either Note or Collection mode
 * 
 * NOTE MODE (viewMode: 'note'):
 * - Full Yoopta editor embedded directly (not click-to-edit)
 * - Compact list of sub-pages below the editor (collapsed by default)
 * - Primary focus: content writing
 * 
 * COLLECTION MODE (viewMode: 'collection'):
 * - Small content preview at top (click to edit)
 * - Large children grid/list as primary focus
 * - Primary focus: organizing and browsing pages
 */
const PageDetailView: React.FC<PageDetailViewProps> = ({
  page,
  children,
  ancestors,
  onNavigate,
  onNavigateHome,
  onUpdatePage,
  onCreateChild,
  onDeletePage,
  onMovePage,
  sidebarVisible = true,
  onToggleSidebar,
  inSplitView = false,
  splitViewPageId: controlledSplitViewPageId,
  onSplitViewPageChange,
  onExpandSplitView,
}) => {
  const isMobile = useIsMobile();
  const isReadOnlyPage = page.isReadOnly === true;
  // Desktop detection for reading pane (disable on tablet < 1024px)
  const isDesktop = useIsDesktop();

  // === ZUSTAND STORE - editor state ===
  const draftTitle = usePagesStore((state: PagesState) => state.draftTitle);
  const draftContent = usePagesStore((state: PagesState) => state.draftContent);
  const pagesById = usePagesStore((state: PagesState) => state.pagesById);
  const selectPage = usePagesStore((state: PagesState) => state.selectPage);
  const getChildren = usePagesStore((state: PagesState) => state.getChildren);
  const getAncestors = usePagesStore((state: PagesState) => state.getAncestors);
  const updatePageStore = usePagesStore((state: PagesState) => state.updatePage);
  const loadPages = usePagesStore((state: PagesState) => state.loadPages);
  const childrenIndex = usePagesStore((state: PagesState) => state.childrenIndex);
  const movePageStore = usePagesStore((state: PagesState) => state.movePage);
  const { createPage, setExpanded } = usePagesStore(useShallow((state: PagesState) => ({
    createPage: state.createPage,
    setExpanded: state.setExpanded,
  })));

  // === TASK COLLECTION STATE ===
  const tasksById = useTasksStore((state) => state.tasksById);
  const toggleComplete = useTasksStore((state) => state.toggleComplete);
  const updateTask = useTasksStore((state) => state.updateTask);
  const { taskCollections } = useTaskCollections();
  const openSectionManager = useUIStore((state) => state.openSectionManager);
  const openTaskInContext = useUIStore((state) => state.openTaskInContext);
  const createTaskInContext = useUIStore((state) => state.createTaskInContext);
  const openPageMovePicker = useUIStore((state) => state.openPageMovePicker);
  
  // Global task pane state from uiStore (for FloatingActionBar integration)
  const globalTaskPaneMode = useUIStore((state) => state.taskPaneMode);
  const globalTaskPaneTaskId = useUIStore((state) => state.taskPaneTaskId);
  const globalTaskPaneDefaults = useUIStore((state) => state.taskPaneDefaults);
  const closeTaskPane = useUIStore((state) => state.closeTaskPane);
  const pageOps = usePageOperations();

  // Pagination state for children
  const parentHasMore = usePagesStore((state: PagesState) => state.parentHasMore);
  const loadMoreChildren = usePagesStore((state: PagesState) => state.loadMoreChildren);
  const childrenHasMore = parentHasMore(page.id);
  const [isLoadingMoreChildren, setIsLoadingMoreChildren] = useState(false);

  // Split view resizing logic
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

  // Split view state for collection mode
  // Use controlled state from parent if provided (for URL sync), otherwise use local state
  const [localSplitViewPageId, setLocalSplitViewPageId] = useState<string | null>(null);
  const splitViewPageId = controlledSplitViewPageId !== undefined ? controlledSplitViewPageId : localSplitViewPageId;
  const setSplitViewPageId = useCallback((pageId: string | null) => {
    if (onSplitViewPageChange) {
      onSplitViewPageChange(pageId);
    } else {
      setLocalSplitViewPageId(pageId);
    }
  }, [onSplitViewPageChange]);
  
  const sidePanelOpen = useNavigationStore((state) => state.sidePanelOpen);
  const setSidePanelOpen = useNavigationStore((state) => state.setSidePanelOpen);

  // Active page state from store (to avoid title/content hijacking in split view)
  const activePageId = usePagesStore((state: PagesState) => state.activePageId);
  const isPageActive = activePageId === page.id;
  const displayTitle = isPageActive ? draftTitle : page.title;
  const displayContent = isPageActive ? draftContent : page.content;

  // Effective showExcerpts setting (per-page only, defaults to true)
  const showExcerpts = page.showExcerpts ?? true;
  // Tag suggestions from sibling pages (pages sharing the same parent).
  // Uses childrenIndex for efficient lookup instead of scanning all pages.
  const siblingPageTags = useMemo(() => {
    const parentKey = page.parentId || '__root__';
    const siblingIds = childrenIndex[parentKey] || [];
    const tagSet = new Set<string>();
    for (const id of siblingIds) {
      const sibling = pagesById[id];
      if (sibling?.tags) {
        sibling.tags.split(',').map(t => t.trim()).filter(Boolean).forEach(tag => tagSet.add(tag));
      }
    }
    return Array.from(tagSet).sort();
  }, [childrenIndex, page.parentId, pagesById]);

  const handleShowExcerptsChange = useCallback((show: boolean) => {
    onUpdatePage(page.id, { showExcerpts: show });
  }, [page.id, onUpdatePage]);

  // Delete confirmation
  const requestDelete = useDeleteConfirmStore((s) => s.requestDelete);

  // Sub-pages collapsed by default in page view
  const [childrenExpanded, setChildrenExpanded] = useState(false);

  // Lifted description editing state (shared between child content components and UnifiedHeader)
  const [editingContent, setEditingContent] = useState(false);

  // Reset editing state when page changes
  useEffect(() => {
    setEditingContent(false);
  }, [page.id]);
  
  // Collection mode view preferences - read directly from page to react to saved view changes
  // Using || instead of ?? to handle empty strings from PocketBase
  const childrenDisplayMode = (page.childrenViewMode === 'gallery' ? 'gallery' : (page.childrenViewMode === 'table' ? 'table' : 'list')) as 'list' | 'gallery' | 'table';
  const collectionSortBy = (page.collectionSortBy || 'updated') as 'updated' | 'created' | 'title';
  const collectionSortDirection = (page.collectionSortDirection || 'desc') as 'asc' | 'desc';
  const collectionGroupBy = (page.collectionGroupBy || 'date') as 'none' | 'date';
  
  // Load more children handler - uses collection sort settings or 'order' for page mode
  const handleLoadMoreChildren = useCallback(async () => {
    setIsLoadingMoreChildren(true);
    try {
      const isCollection = page.viewMode === 'collection';
      // Collection mode uses user's sort preference, page mode uses tree order
      await loadMoreChildren(
        page.id, 
        isCollection ? collectionSortBy : 'order',
        isCollection ? collectionSortDirection : 'asc'
      );
    } finally {
      setIsLoadingMoreChildren(false);
    }
  }, [loadMoreChildren, page.id, page.viewMode, collectionSortBy, collectionSortDirection]);
  
  // Handlers that persist to page (no local state needed - reading from page props)
  const setCollectionSortBy = useCallback((sortBy: 'updated' | 'created' | 'title') => {
    onUpdatePage(page.id, { collectionSortBy: sortBy });
  }, [page.id, onUpdatePage]);
  
  const setCollectionSortDirection = useCallback((direction: 'asc' | 'desc') => {
    onUpdatePage(page.id, { collectionSortDirection: direction });
  }, [page.id, onUpdatePage]);
  
  const setCollectionGroupBy = useCallback((groupBy: 'none' | 'date') => {
    onUpdatePage(page.id, { collectionGroupBy: groupBy });
  }, [page.id, onUpdatePage]);

  const isCollectionMode = page.viewMode === 'collection';
  const isTasksMode = page.viewMode === 'tasks';
  const isPageMode = page.viewMode === 'note';
  const hasCover = !!(page.coverImage || page.coverGradient);

  // Task Detail Pane state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [paneMode, setPaneMode] = useState<'edit' | 'create' | null>(null);
  const [paneDefaults, setPaneDefaults] = useState<{
    defaultDueDate?: string;
    defaultTaskPageId?: string;
    defaultSection?: string;
    defaultTag?: string;
    defaultPriority?: 'Low' | 'Medium' | 'High';
  }>({});
  const [taskPaneDirty, setTaskPaneDirty] = useState(false);
  const [showTaskPaneDiscardModal, setShowTaskPaneDiscardModal] = useState(false);
  // Store pending action when user tries to switch tasks while dirty
  const pendingTaskActionRef = useRef<{ type: 'select' | 'create'; taskId?: string | null; defaults?: typeof paneDefaults } | null>(null);

  const showSidePanelLayout = isDesktop && !inSplitView && sidePanelOpen;

  // Determine if we should show the split view layout
  // We show it if:
  // 1. On desktop (>= 1024px)
  // 2. Not already in a split view (prevent nesting)
  // 3. Parent is in Collection mode (not Tasks or Note)
  // 4. Reading Pane is enabled globally
  const showSplitViewLayout = false;
  
  // Task split view layout
  const showTasksSplitViewLayout = false;

  // Auto-exit split view if we are no longer in a valid split view mode
  useEffect(() => {
    if (splitViewPageId && !showSplitViewLayout) {
      setSplitViewPageId(null);
    }
  }, [splitViewPageId, showSplitViewLayout, setSplitViewPageId]);

  // Auto-exit task split view if we are no longer in tasks mode
  useEffect(() => {
    if (selectedTaskId && !showTasksSplitViewLayout && paneMode === 'edit') {
      setSelectedTaskId(null);
    }
  }, [selectedTaskId, showTasksSplitViewLayout, paneMode]);
  
  // Sync global task pane state with local state (for FloatingActionBar integration)
  useEffect(() => {
    if (globalTaskPaneMode && isTasksMode && showTasksSplitViewLayout) {
      // FloatingActionBar triggered task creation/editing - sync with local state
      setPaneMode(globalTaskPaneMode);
      setSelectedTaskId(globalTaskPaneTaskId);
      if (globalTaskPaneDefaults) {
        setPaneDefaults({
          defaultDueDate: globalTaskPaneDefaults.defaultDueDate,
          defaultTaskPageId: globalTaskPaneDefaults.defaultTaskPageId,
          defaultSection: globalTaskPaneDefaults.defaultSection,
          defaultTag: globalTaskPaneDefaults.defaultTags?.[0],
          defaultPriority: globalTaskPaneDefaults.defaultPriority,
        });
      }
      // Clear global state after syncing
      closeTaskPane();
    }
  }, [globalTaskPaneMode, globalTaskPaneTaskId, globalTaskPaneDefaults, isTasksMode, showTasksSplitViewLayout, closeTaskPane]);

  // Use a ref to track the previous page.id for cleanup when navigating
  const prevPageIdRef = useRef(page.id);
  
  // Handle navigation between pages - clean up pane when navigating
  // Note: Dirty check is handled by global NavigationBlocker via TanStack Router's useBlocker
  useEffect(() => {
    if (prevPageIdRef.current !== page.id && paneMode) {
      // Navigation happened - close pane and reset state
      // Global navigation blocker already showed confirmation if dirty
      setPaneMode(null);
      setSelectedTaskId(null);
      setPaneDefaults({});
      setTaskPaneDirty(false);
    }
    prevPageIdRef.current = page.id;
  }, [page.id, paneMode]);
  
  // Handle confirming discard - for task switching (not page navigation which uses global blocker)
  const handleConfirmNavigationDiscard = useCallback(() => {
    setShowTaskPaneDiscardModal(false);
    setTaskPaneDirty(false);
    
    // Execute pending task action if any
    const pendingAction = pendingTaskActionRef.current;
    if (pendingAction) {
      if (pendingAction.type === 'select') {
        setSelectedTaskId(pendingAction.taskId ?? null);
        setPaneMode(pendingAction.taskId ? 'edit' : null);
        setPaneDefaults({});
      } else if (pendingAction.type === 'create') {
        setSelectedTaskId(null);
        setPaneMode('create');
        setPaneDefaults(pendingAction.defaults || {});
      }
      pendingTaskActionRef.current = null;
    } else {
      // Fallback - just close the pane
      setPaneMode(null);
      setSelectedTaskId(null);
      setPaneDefaults({});
    }
  }, []);
  
  // Handle canceling discard - user wants to stay and keep editing
  const handleCancelNavigationDiscard = useCallback(() => {
    setShowTaskPaneDiscardModal(false);
    pendingTaskActionRef.current = null;
  }, []);
  
  // Clear task editing state when unmounting (final cleanup)
  useEffect(() => {
    return () => {
      // Cleanup: close task pane when unmounting
      // Note: We can't show a modal during unmount, so just clean up silently
    };
  }, []);

  // Get selected child for split view
  const splitViewPage = useMemo(() => {
    if (!splitViewPageId) return null;
    return pagesById[splitViewPageId] || null;
  }, [splitViewPageId, pagesById]);
  
  // Clear split view selection if the page no longer exists (e.g., deleted externally)
  useEffect(() => {
    if (splitViewPageId && !pagesById[splitViewPageId]) {
      setSplitViewPageId(null);
    }
  }, [splitViewPageId, pagesById]);

  // Initialize draft state for split view page
  const splitViewInitRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (splitViewPageId && splitViewInitRef.current !== splitViewPageId) {
      selectPage(splitViewPageId, false, true);
      splitViewInitRef.current = splitViewPageId;
    }
  }, [splitViewPageId, selectPage]);

  // Load children for split view page
  useEffect(() => {
    if (!splitViewPage) return;

    const expectedChildCount = splitViewPage.childCount ?? 0;
    const loadedChildCount = childrenIndex[splitViewPage.id]?.length ?? 0;

    if (expectedChildCount > 0 && loadedChildCount < expectedChildCount) {
      loadPages({ parentId: splitViewPage.id, sortBy: 'order', sortDirection: 'asc' });
    }
  }, [splitViewPage?.id, splitViewPage?.childCount, childrenIndex, loadPages]);

  // Get children and ancestors for split view page
  const splitViewChildPages = useMemo(() => {
    if (!splitViewPage) return [];
    return getChildren(splitViewPage.id);
  }, [splitViewPage, getChildren, pagesById]);

  const splitViewAncestors = useMemo(() => {
    if (!splitViewPage) return [];
    return getAncestors(splitViewPage.id);
  }, [splitViewPage, getAncestors, pagesById]);
  
  // Handler for clicking pages in split view mode
  const handlePageClick = useCallback((pageId: string) => {
    if (showSplitViewLayout) {
      setSplitViewPageId(pageId);
    } else {
      onNavigate(pageId);
    }
  }, [showSplitViewLayout, onNavigate, setSplitViewPageId]);

  // Handler for navigating within split view
  const handleSplitViewNavigate = useCallback((pageId: string) => {
    setSplitViewPageId(pageId);
  }, [setSplitViewPageId]);

  // Handler to go back to collection from split view
  const handleSplitViewNavigateHome = useCallback(() => {
    setSplitViewPageId(null);
  }, [setSplitViewPageId]);

  // Handler for expanding split view page to full view
  const handleExpandSplitView = useCallback(() => {
    if (splitViewPageId) {
      onNavigate(splitViewPageId);
    }
  }, [splitViewPageId, onNavigate]);

  // Handler for creating child in split view
  const handleSplitViewCreateChild = useCallback((parentId: string | null, viewMode?: PageViewMode) => {
    const newPage = createPage({
      title: 'Untitled',
      parentId: parentId || page.id,
      viewMode: viewMode || 'note',
    });
    selectPage(newPage.id, true);
    setSplitViewPageId(newPage.id);
    if (parentId) {
      setExpanded(parentId, true);
    }
  }, [createPage, selectPage, setExpanded, setSplitViewPageId]);

  // Task Handlers
  const handleTaskClick = useCallback((taskId: string | null) => {
    if (showTasksSplitViewLayout) {
      // Check if current task is dirty before switching
      if (taskPaneDirty && taskId !== selectedTaskId) {
        // Store the pending action and show confirmation
        pendingTaskActionRef.current = { type: 'select', taskId };
        setShowTaskPaneDiscardModal(true);
        return;
      }
      setSelectedTaskId(taskId);
      setPaneMode(taskId ? 'edit' : null);
    } else if (taskId) {
      openTaskInContext(taskId);
    }
  }, [openTaskInContext, showTasksSplitViewLayout, taskPaneDirty, selectedTaskId]);

  const handleCreateTask = useCallback((defaults?: { defaultDueDate?: string; defaultTaskPageId?: string; defaultSection?: string; defaultTag?: string; defaultPriority?: 'Low' | 'Medium' | 'High' }) => {
    if (showTasksSplitViewLayout) {
      // Check if current task is dirty before creating new
      if (taskPaneDirty && paneMode) {
        // Store the pending action and show confirmation
        pendingTaskActionRef.current = { type: 'create', defaults: defaults || { defaultTaskPageId: page.id } };
        setShowTaskPaneDiscardModal(true);
        return;
      }
      setSelectedTaskId(null);
      setPaneMode('create');
      setPaneDefaults(defaults || { defaultTaskPageId: page.id });
    } else {
      createTaskInContext({ defaultTaskPageId: page.id, ...defaults });
    }
  }, [createTaskInContext, page.id, paneMode, showTasksSplitViewLayout, taskPaneDirty]);

  const handleClosePane = useCallback(() => {
    setSelectedTaskId(null);
    setPaneMode(null);
  }, []);

  // Get task count for this page (available for all view modes to show cross-view indicators)
  const taskCount = pageOps.countTasksForPage(page.id);
  
  // Filter tasks for this page (available for all modes so task data is ready on view switch)
  const pageTasks = useMemo(() => {
    return Object.values(tasksById).filter(t => t.parentPageId === page.id);
  }, [tasksById, page.id]);
  
  // Task view settings from page object
  const tasksViewMode = page.tasksViewMode || 'list';
  const tasksGroupBy = page.tasksGroupBy || 'none';
  const showCompletedTasks = page.showCompletedTasks ?? false;
  
  // Task sort settings from navigationStore (per-page view preferences)
  const viewPreferences = useNavigationStore((state) => state.viewPreferences);
  const setViewPreference = useNavigationStore((state) => state.setViewPreference);
  const viewKey = getViewKey('taskPage', page.id);
  const taskSortBy = viewPreferences[viewKey]?.taskSortBy || 'date';
  const taskSortDirection = viewPreferences[viewKey]?.taskSortDirection || 'desc';
  
  // Task filter options for this page (reactive - subscribes directly to map for reactivity)
  const taskFilterOptionsMap = useNavigationStore(useShallow((s) => s.taskFilterOptions));
  const setTaskFilterOptions = useNavigationStore((s) => s.setTaskFilterOptions);
  const pageTaskFilterOptions = useMemo(
    () => taskFilterOptionsMap[viewKey] ?? DEFAULT_TASK_FILTER_OPTIONS,
    [viewKey, taskFilterOptionsMap]
  );
  const todayISO = useMemo(() => getTodayISO(), []);
  const allPageTaskTags = useMemo(() => collectTaskTags(pageTasks), [pageTasks]);
  const handlePageTaskFilterOptionsChange = useCallback((opts: TaskFilterOptions) => {
    setTaskFilterOptions(viewKey, opts);
  }, [setTaskFilterOptions, viewKey]);
  
  // Sync sort settings when activeSavedViewId changes (including from SSE updates).
  // This ensures that when a saved view is activated on another device, the sort settings
  // are applied locally, preventing the auto-save effect from detecting a false "modification".
  useEffect(() => {
    if (!isTasksMode) return;
    
    const activeViewId = page.activeSavedViewId;
    if (!activeViewId) return;
    
    const savedViews = page.savedViews || [];
    const activeView = savedViews.find(v => v.id === activeViewId);
    if (!activeView || !('showCompleted' in activeView.config)) return;
    
    const taskConfig = activeView.config as TaskViewConfig;
    // Apply the saved view's sort settings to local preferences
    // This is idempotent - setting the same value doesn't cause issues
    setViewPreference(viewKey, 'taskSortBy', taskConfig.sortBy);
    setViewPreference(viewKey, 'taskSortDirection', taskConfig.sortDirection);
  }, [isTasksMode, page.activeSavedViewId, page.savedViews, setViewPreference, viewKey]);
  
  // Filtered tasks based on showCompleted setting + active filter options
  const filteredTasks = useMemo(() => {
    const base = showCompletedTasks ? pageTasks : pageTasks.filter(t => !t.completed);
    return applyTaskFilterOptions(base, pageTaskFilterOptions, todayISO);
  }, [pageTasks, showCompletedTasks, pageTaskFilterOptions, todayISO]);
  
  // Task view handlers
  const handleTasksViewModeChange = useCallback((mode: TaskViewMode) => {
    onUpdatePage(page.id, { tasksViewMode: mode as 'list' | 'kanban' });
  }, [page.id, onUpdatePage]);
  
  const handleTasksGroupByChange = useCallback((gb: GroupBy) => {
    const mappedGroupBy = gb === 'taskPage' ? 'none' : gb;
    onUpdatePage(page.id, { tasksGroupBy: mappedGroupBy as 'date' | 'priority' | 'section' | 'tag' | 'none' | 'parentPage' });
  }, [page.id, onUpdatePage]);
  
  const handleShowCompletedChange = useCallback((show: boolean) => {
    onUpdatePage(page.id, { showCompletedTasks: show });
  }, [page.id, onUpdatePage]);
  
  // Task sort handlers (within groups) - uses navigationStore
  const handleTaskSortByChange = useCallback((sortBy: 'date' | 'priority' | 'title' | 'created' | 'tag') => {
    setViewPreference(viewKey, 'taskSortBy', sortBy);
  }, [setViewPreference, viewKey]);

  const handleTaskSortDirectionChange = useCallback((direction: 'asc' | 'desc') => {
    setViewPreference(viewKey, 'taskSortDirection', direction);
  }, [setViewPreference, viewKey]);
  
  const handleTaskDrop = useCallback((taskId: string, targetGroup: string, currentGroupBy: GroupBy) => {
    const task = tasksById[taskId];
    if (!task) return;
    const updates: Partial<Task> = {};
    if (currentGroupBy === 'date') {
      updates.dueDate = dateGroupToDate(targetGroup as DateGroupKey, getToday());
    } else if (currentGroupBy === 'priority') {
      // Map lowercase group keys to capitalized priority values
      if (targetGroup === 'high') updates.priority = 'High';
      else if (targetGroup === 'medium') updates.priority = 'Medium';
      else if (targetGroup === 'low') updates.priority = 'Low';
      else if (targetGroup === 'none') updates.priority = undefined;
    } else if (currentGroupBy === 'section') {
      updates.sectionId = targetGroup === 'unsectioned' ? undefined : targetGroup;
    } else if (currentGroupBy === 'tag') {
      updates.tag = targetGroup === '__no_tag__' ? undefined : targetGroup;
    }
    if (Object.keys(updates).length > 0) {
      updateTask(taskId, updates);
    }
  }, [tasksById, updateTask]);

  // Handle adding a task to a specific kanban column (group)
  const handleAddTaskToGroup = useCallback((groupKey: string, currentGroupBy: GroupBy) => {
    const defaults: { defaultDueDate?: string; defaultTaskPageId?: string; defaultSection?: string; defaultTag?: string; defaultPriority?: 'Low' | 'Medium' | 'High' } = {
      defaultTaskPageId: page.id,
    };

    if (currentGroupBy === 'date') {
      const date = dateGroupToDate(groupKey as DateGroupKey, getToday());
      if (date) defaults.defaultDueDate = date;
    } else if (currentGroupBy === 'priority') {
      // Map group key to priority value
      if (groupKey === 'high') defaults.defaultPriority = 'High';
      else if (groupKey === 'medium') defaults.defaultPriority = 'Medium';
      else if (groupKey === 'low') defaults.defaultPriority = 'Low';
      // 'none' = no default priority (leave empty)
    } else if (currentGroupBy === 'section') {
      if (groupKey !== 'unsectioned' && groupKey !== 'unassigned') {
        defaults.defaultSection = groupKey;
      }
    } else if (currentGroupBy === 'tag') {
      // Only set tag if it's a real tag, not 'none', 'untagged', or '__no_tag__'
      if (groupKey !== 'none' && groupKey !== 'untagged' && groupKey !== '__no_tag__') {
        defaults.defaultTag = groupKey;
      }
      // For 'none'/'untagged'/'__no_tag__', don't set any default - task will have no tag
    }

    handleCreateTask(defaults);
  }, [page.id, handleCreateTask]);

  // Handle view mode change - allows switching between note, collection, and tasks
  const handleViewModeChange = useCallback((mode: PageViewMode) => {
  if (isReadOnlyPage) {
    return;
  }
    onUpdatePage(page.id, { viewMode: mode });
  }, [isReadOnlyPage, page.id, onUpdatePage]);

  const handleChildrenDisplayChange = useCallback((mode: 'list' | 'gallery' | 'table') => {
    onUpdatePage(page.id, { childrenViewMode: mode });
  }, [page.id, onUpdatePage]);

  const handleIconChange = useCallback((icon: string | null, color: string | null) => {
  if (isReadOnlyPage) {
    return;
  }
    onUpdatePage(page.id, { icon, color });
  }, [isReadOnlyPage, page.id, onUpdatePage]);

  const handleCreateChild = useCallback((viewMode: PageViewMode = 'note') => {
  if (isReadOnlyPage) {
    return;
  }
    onCreateChild?.(page.id, viewMode);
  }, [isReadOnlyPage, page.id, onCreateChild]);

  // Convert ancestors to breadcrumb items for UnifiedHeader
  const breadcrumbItems = useMemo((): BreadcrumbItem[] => {
    return ancestors.map(ancestor => ({
      id: ancestor.id,
      title: ancestor.title,
      icon: ancestor.icon,
      onClick: () => onNavigate(ancestor.id),
    }));
  }, [ancestors, onNavigate]);

  // ============================================================================
  // COLLECTION SPLIT VIEW: Full-height panels like /pages/ view
  // ============================================================================
  // 
  // Edge Cases & Behaviors:
  // - Deletion of right panel page: Clears split view, shows empty state
  // - Deletion of left panel (parent): Parent component handles navigation away
  // - External deletion (via SSE): useEffect clears splitViewPageId when page disappears from store
  // - Deep linking: Split view state is local (not in URL), deep links load full page view
  // - Moving right panel page out of parent: Page stays visible until manually closed or reloaded
  // - Nested split views: Prevented by inSplitView prop - right panel pages show inline, not split
  // - Child creation from sidebar: SplitViewContext provides handler to create in right panel
  // - Keyboard nav: TODO - Consider Escape to close right panel, arrow keys to navigate list
  // 
  if (showSplitViewLayout) {
    return (
      <SplitViewProvider
        parentPageId={page.id}
        onCreateChild={handleSplitViewCreateChild}
        onNavigateInSplitView={handleSplitViewNavigate}
      >
        <div ref={containerRef} className="flex-1 flex overflow-hidden relative">
          {/* Left panel: Main page content */}
          <div 
            className={cn(
              'relative flex flex-col overflow-hidden',
              'bg-[var(--color-surface-secondary)]/50',
              'border-r border-[var(--color-border-subtle)]/50',
              // Paper shadow effect
              // NOTE: No z-index — see PagesView comment about Safari stacking context bug.
              'shadow-[4px_0_24px_-4px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_24px_-4px_rgba(0,0,0,0.25)]',
            )}
            style={{ width: `${splitViewWidth}px`, flexShrink: 0 }}
          >
              {/* Header */}
              <UnifiedHeader
                sidebarVisible={sidebarVisible}
                onToggleSidebar={onToggleSidebar}
                className="border-b-0"
                hasCover={false}
                inSplitView={false}
                compact={true}
                contentType={isTasksMode ? 'tasks' : 'pages'}
                breadcrumbs={breadcrumbItems}
                currentTitle={displayTitle || 'Untitled'}
                currentIcon={
                  page.icon ? (
                    <LucideIcon name={page.icon} className="w-4 h-4" />
                  ) : (
                    <ItemIcon
                      type={page.viewMode === 'tasks' ? 'tasks' : page.viewMode === 'collection' ? 'collection' : 'note'}
                      color={page.color}
                      size="sm"
                    />
                  )
                }
                
                currentPage={page}
                showPinButton={!isReadOnlyPage}
                isPinned={page.isPinned}
                onTogglePin={isReadOnlyPage ? undefined : () => onUpdatePage(page.id, { isPinned: !page.isPinned })}
                showDeleteButton={!isReadOnlyPage}
                onDelete={isReadOnlyPage ? undefined : () => requestDelete({
                  itemType: 'page',
                  count: 1,
                  hasChildren: (page.childCount || 0) > 0 || taskCount > 0,
                  childCount: (page.childCount || 0) + taskCount,
                  onConfirm: (cascade: boolean) => onDeletePage(page.id, cascade),
                })}
                showSidePanelToggle={true}
                sidePanelOpen={sidePanelOpen}
              />

              {/* Scrollable content area - scrollbar stays in visible area */}
              <div className="flex-1 overflow-y-auto">
            {isTasksMode ? (
              <TaskModeContent
                page={page}
                tasks={filteredTasks}
                allTasks={pageTasks}
                taskCollections={taskCollections}
                viewMode={tasksViewMode}
                groupBy={tasksGroupBy}
                showCompleted={showCompletedTasks}
                onViewModeChange={handleTasksViewModeChange}
                onGroupByChange={handleTasksGroupByChange}
                onShowCompletedChange={handleShowCompletedChange}
                taskSortBy={taskSortBy}
                taskSortDirection={taskSortDirection}
                onTaskSortByChange={handleTaskSortByChange}
                onTaskSortDirectionChange={handleTaskSortDirectionChange}
                onToggleComplete={toggleComplete}
                onTaskDrop={handleTaskDrop}
                onEditTask={(id) => handleTaskClick(id)}
                onCreateTask={() => handleCreateTask({ defaultTaskPageId: page.id })}
                onAddTaskToGroup={handleAddTaskToGroup}
                onOpenSectionManager={() => openSectionManager(page.id)}
                allChildren={children}
                childrenExpanded={childrenExpanded}
                setChildrenExpanded={setChildrenExpanded}
                onNavigate={handlePageClick}
                onCreateChild={handleCreateChild}
                
                hasMore={childrenHasMore}
                isLoadingMore={isLoadingMoreChildren}
                onLoadMore={handleLoadMoreChildren}
                hasCover={hasCover}
                showExcerpts={showExcerpts}
                onShowExcerptsChange={handleShowExcerptsChange}
                onUpdatePage={onUpdatePage}
                inSplitView={true}
                filterOptions={pageTaskFilterOptions}
                onFilterOptionsChange={handlePageTaskFilterOptionsChange}
                heroTagSuggestions={siblingPageTags}
              />
            ) : isCollectionMode ? (
              <CollectionModeContent
                page={page}
                allChildren={children}
                childrenDisplayMode={childrenDisplayMode}
                onChildrenDisplayChange={handleChildrenDisplayChange}
                onNavigate={handlePageClick}
                onCreateChild={handleCreateChild}
                onDeletePage={onDeletePage}
                onMovePage={onMovePage}
                
                sortBy={collectionSortBy}
                onSortByChange={setCollectionSortBy}
                sortDirection={collectionSortDirection}
                onSortDirectionChange={setCollectionSortDirection}
                groupBy={collectionGroupBy}
                onGroupByChange={setCollectionGroupBy}
                hasMore={childrenHasMore}
                isLoadingMore={isLoadingMoreChildren}
                onLoadMore={handleLoadMoreChildren}
                hasCover={hasCover}
                showExcerpts={showExcerpts}
                onShowExcerptsChange={handleShowExcerptsChange}
                onUpdatePage={onUpdatePage}
                inSplitView={true}
                heroTagSuggestions={siblingPageTags}
              />
            ) : (
              <PageModeContent
                page={page}
                allChildren={children}
                childrenExpanded={childrenExpanded}
                setChildrenExpanded={setChildrenExpanded}
                onNavigate={handlePageClick}
                onCreateChild={handleCreateChild}
                
                hasMore={childrenHasMore}
                isLoadingMore={isLoadingMoreChildren}
                onLoadMore={handleLoadMoreChildren}
                onUpdatePage={onUpdatePage}
                tagSuggestions={siblingPageTags}
              />
            )}
          </div>
          
          {/* Resize handle - inside visible area, on right edge */}
          <ResizeHandle
            onMouseDown={handleResizeStart}
            className="absolute right-0 top-0 bottom-0"
          />
        </div>

        {/* Right panel: Selected child page */}
        <div 
          className={cn(
            'relative flex-1 flex flex-col overflow-hidden min-w-0',
            'bg-[var(--color-surface-base)]',
            // Border on left for subtle definition
            'border-l border-[var(--color-border-subtle)]/30',
            // NOTE: No z-index — see PagesView comment about Safari stacking context bug.
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
              onUpdatePage={(id, updates) => updatePageStore(id, updates)}
              onCreateChild={handleSplitViewCreateChild}
              onDeletePage={(id, cascade) => {
                onDeletePage(id, cascade);
                setSplitViewPageId(null);
              }}
              onMovePage={(pageId, newParentId) => movePageStore(pageId, newParentId)}
              sidebarVisible={true}
              onToggleSidebar={() => {}}
              inSplitView={true}
              onExpandSplitView={handleExpandSplitView}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-[var(--color-surface-secondary)]/50">
              <div className="text-center text-[var(--color-text-secondary)]">
                <PagesIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium mb-1">Select a page</p>
                <p className="text-sm">Choose a page from the list to view its contents</p>
              </div>
            </div>
          )}
        </div>

        </div>
      </SplitViewProvider>
    );
  }

  // ============================================================================
  if (showTasksSplitViewLayout) {
    return (
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left panel: Task list */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto bg-[var(--color-surface-base)]">
            <UnifiedHeader
              sidebarVisible={sidebarVisible}
              onToggleSidebar={onToggleSidebar}
              className="border-b-0"
              hasCover={false}
              inSplitView={inSplitView}
              compact={showTasksSplitViewLayout}
              onExpandSplitView={onExpandSplitView}
              contentType="tasks"
              breadcrumbs={breadcrumbItems}
              currentTitle={displayTitle || 'Untitled'}
              currentIcon={
                page.icon ? (
                  <LucideIcon name={page.icon} className="w-4 h-4" />
                ) : (
                  <ItemIcon
                    type="tasks"
                    color={page.color}
                    size="sm"
                  />
                )
              }
              
              currentPage={page}
              showPinButton={!isReadOnlyPage}
              isPinned={page.isPinned}
              onTogglePin={isReadOnlyPage ? undefined : () => onUpdatePage(page.id, { isPinned: !page.isPinned })}
              showDeleteButton={!isReadOnlyPage}
              onDelete={isReadOnlyPage ? undefined : () => requestDelete({
                itemType: 'page',
                count: 1,
                hasChildren: (page.childCount || 0) > 0 || taskCount > 0,
                childCount: (page.childCount || 0) + taskCount,
                onConfirm: (cascade: boolean) => onDeletePage(page.id, cascade),
              })}
              showSidePanelToggle={true}
              sidePanelOpen={sidePanelOpen}
            />
            
            <TaskModeContent
              page={page}
              tasks={filteredTasks}
              allTasks={pageTasks}
              taskCollections={taskCollections}
              viewMode={tasksViewMode}
              groupBy={tasksGroupBy}
              showCompleted={showCompletedTasks}
              onViewModeChange={handleTasksViewModeChange}
              onGroupByChange={handleTasksGroupByChange}
              onShowCompletedChange={handleShowCompletedChange}
              taskSortBy={taskSortBy}
              taskSortDirection={taskSortDirection}
              onTaskSortByChange={handleTaskSortByChange}
              onTaskSortDirectionChange={handleTaskSortDirectionChange}
              onToggleComplete={toggleComplete}
              onTaskDrop={handleTaskDrop}
              onEditTask={handleTaskClick}
              onCreateTask={handleCreateTask}
              onAddTaskToGroup={handleAddTaskToGroup}
              onOpenSectionManager={() => openSectionManager(page.id)}
              allChildren={children}
              childrenExpanded={childrenExpanded}
              setChildrenExpanded={setChildrenExpanded}
              onNavigate={handlePageClick}
              onCreateChild={handleCreateChild}
              
              hasMore={childrenHasMore}
              isLoadingMore={isLoadingMoreChildren}
              onLoadMore={handleLoadMoreChildren}
              hasCover={hasCover}
              showExcerpts={showExcerpts}
              onShowExcerptsChange={handleShowExcerptsChange}
              onUpdatePage={onUpdatePage}
              inSplitView={true}
              filterOptions={pageTaskFilterOptions}
              onFilterOptionsChange={handlePageTaskFilterOptionsChange}
              heroTagSuggestions={siblingPageTags}
            />
          </div>
        </div>

        {/* Right panel: Task Detail Pane */}
        <div 
          className="flex-shrink-0 flex flex-col overflow-hidden bg-[var(--color-surface-base)] border-l border-[var(--color-border-default)]"
          style={{ width: '360px' }}
        >
          <TaskDetailPane
            mode={paneMode}
            task={selectedTaskId ? tasksById[selectedTaskId] : null}
            taskPages={taskCollections}
            selectedTaskPageId={paneDefaults.defaultTaskPageId || page.id}
            currentView="taskPage"
            defaultDueDate={paneDefaults.defaultDueDate}
            defaultSection={paneDefaults.defaultSection}
            defaultTag={paneDefaults.defaultTag}
            defaultPriority={paneDefaults.defaultPriority}
            onClose={handleClosePane}
            onDirtyChange={setTaskPaneDirty}
          />
        </div>
        
        {/* Confirm discard modal for unsaved task pane changes during navigation */}
        <ConfirmDiscardModal
          open={showTaskPaneDiscardModal}
          onCancel={handleCancelNavigationDiscard}
          onDiscard={handleConfirmNavigationDiscard}
          message="You have unsaved task changes. Discard them?"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
      <FloatingSidePanelLayout
        side="right"
        isOpen={showSidePanelLayout}
        onOpenChange={setSidePanelOpen}
        pinned={false}
        railWidth={0}
        collapsedWidth={0}
        defaultExpandedWidth={UNIFIED_SIDEPANEL_DOCK_WIDTH}
        expandedWidth={UNIFIED_SIDEPANEL_DOCK_WIDTH}
        gutterPx={UNIFIED_SIDEPANEL_FLOATING_GUTTER}
        className={cn(
          `flex flex-1 min-h-0 flex-col`,
          isPageMode ? 'bg-[var(--color-surface-editor)]' : 'bg-[var(--color-surface-base)]',
          'overflow-hidden',
          hasCover && !(page.heroCompact ?? false) && "-mt-[env(safe-area-inset-top)] md:mt-0"
        )}
        contentClassName="flex min-h-0 flex-1 flex-col"
        applyContentInset={false}
        renderPanel={() => (
          <UnifiedSidepanel floating currentPage={page} childPages={children} />
        )}
      >
        {({ reserveWidth }) => (
        <div
          className="flex min-h-0 flex-1 flex-col"
        >
          {/* Header - sticky with initial space, floats over content when scrolling */}
          <UnifiedHeader
          sidebarVisible={sidebarVisible}
          onToggleSidebar={onToggleSidebar}
          className="border-b-0"
          desktopWidthClassName="max-w-5xl mx-auto"
          desktopRightInsetPx={reserveWidth}
          hasCover={hasCover && !(page.heroCompact ?? false)}
          inSplitView={inSplitView}
          compact={inSplitView}
          onExpandSplitView={onExpandSplitView}
          contentType={isTasksMode ? 'tasks' : 'pages'}
          breadcrumbs={breadcrumbItems}
          currentTitle={displayTitle || 'Untitled'}
          subtitle={isCollectionMode ? `${children.length} items` : isTasksMode ? `${taskCount} tasks` : undefined}
          currentIcon={
            page.icon ? (
              <LucideIcon name={page.icon} className="w-4 h-4" />
            ) : (
              <ItemIcon
                type={page.viewMode === 'tasks' ? 'tasks' : page.viewMode === 'collection' ? 'collection' : 'note'}
                color={page.color}
                size="sm"
              />
            )
          }
          
          currentPage={page}
          showPinButton={!editingContent && !isReadOnlyPage}
          isPinned={page.isPinned}
          onTogglePin={isReadOnlyPage ? undefined : () => onUpdatePage(page.id, { isPinned: !page.isPinned })}
          showDeleteButton={!editingContent && !isReadOnlyPage}
          onDelete={isReadOnlyPage ? undefined : () => requestDelete({
            itemType: 'page',
            count: 1,
            hasChildren: (page.childCount || 0) > 0 || taskCount > 0,
            childCount: (page.childCount || 0) + taskCount,
            onConfirm: (cascade: boolean) => onDeletePage(page.id, cascade),
          })}
          showSidePanelToggle={true}
          sidePanelOpen={sidePanelOpen}
          additionalActionsLeft={editingContent ? (
            <span className="text-sm text-[var(--color-text-secondary)] whitespace-nowrap">{isTasksMode ? 'Editing description' : 'Editing content'}</span>
          ) : undefined}
          additionalActionsRight={
            <div className="flex items-center gap-2">
              {editingContent ? (
                <>
                  {sidePanelOpen ? (
                    <Button variant="secondary" size="sm" onClick={() => setSidePanelOpen(false)}>
                      Close panel
                    </Button>
                  ) : null}
                  <Button variant="secondary" size="sm" onClick={() => setEditingContent(false)}>
                    Done
                  </Button>
                </>
              ) : null}
            </div>
          }
          />

          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div className={cn(
              'flex h-full min-h-0 min-w-0 flex-1 flex-col',
              isPageMode ? 'overflow-hidden' : 'overflow-y-auto',
            )}>
        {isTasksMode ? (
          // ================================================================
          // TASKS MODE: Description + task list/kanban + subpages
          // ================================================================
          <TaskModeContent
            page={page}
            tasks={filteredTasks}
            allTasks={pageTasks}
            taskCollections={taskCollections}
            viewMode={tasksViewMode}
            groupBy={tasksGroupBy}
            showCompleted={showCompletedTasks}
            onViewModeChange={handleTasksViewModeChange}
            onGroupByChange={handleTasksGroupByChange}
            onShowCompletedChange={handleShowCompletedChange}
            taskSortBy={taskSortBy}
            taskSortDirection={taskSortDirection}
            onTaskSortByChange={handleTaskSortByChange}
            onTaskSortDirectionChange={handleTaskSortDirectionChange}
            onToggleComplete={toggleComplete}
            onTaskDrop={handleTaskDrop}
            onEditTask={handleTaskClick}
            onCreateTask={handleCreateTask}
            onAddTaskToGroup={handleAddTaskToGroup}
            onOpenSectionManager={() => openSectionManager(page.id)}
            allChildren={children}
            childrenExpanded={childrenExpanded}
            setChildrenExpanded={setChildrenExpanded}
            onNavigate={handlePageClick}
            onCreateChild={handleCreateChild}
            
            hasMore={childrenHasMore}
            isLoadingMore={isLoadingMoreChildren}
            onLoadMore={handleLoadMoreChildren}
            hasCover={hasCover}
            showExcerpts={showExcerpts}
            onShowExcerptsChange={handleShowExcerptsChange}
            onUpdatePage={onUpdatePage}
            inSplitView={inSplitView}
            filterOptions={pageTaskFilterOptions}
            onFilterOptionsChange={handlePageTaskFilterOptionsChange}
            heroTagSuggestions={siblingPageTags}
            editingContent={editingContent}
            onEditingContentChange={setEditingContent}
            contentRightInsetPx={reserveWidth}
          />
        ) : isCollectionMode ? (
          // ================================================================
          // COLLECTION MODE: Small preview + children grid as primary
          // ================================================================
          <CollectionModeContent
            page={page}
            allChildren={children}
            childrenDisplayMode={childrenDisplayMode}
            onChildrenDisplayChange={handleChildrenDisplayChange}
            onNavigate={handlePageClick}
            onCreateChild={handleCreateChild}
            onDeletePage={onDeletePage}
            onMovePage={onMovePage}
            
            sortBy={collectionSortBy}
            onSortByChange={setCollectionSortBy}
            sortDirection={collectionSortDirection}
            onSortDirectionChange={setCollectionSortDirection}
            groupBy={collectionGroupBy}
            onGroupByChange={setCollectionGroupBy}
            hasMore={childrenHasMore}
            isLoadingMore={isLoadingMoreChildren}
            onLoadMore={handleLoadMoreChildren}
            hasCover={hasCover}
            showExcerpts={showExcerpts}
            onShowExcerptsChange={handleShowExcerptsChange}
            onUpdatePage={onUpdatePage}
            inSplitView={inSplitView}
            heroTagSuggestions={siblingPageTags}
            editingContent={editingContent}
            onEditingContentChange={setEditingContent}
            contentRightInsetPx={reserveWidth}
          />
        ) : (
          // ================================================================
          // PAGE MODE: Full editor + compact children list below
          // ================================================================
          <PageModeContent
            page={page}
            allChildren={children}
            childrenExpanded={childrenExpanded}
            setChildrenExpanded={setChildrenExpanded}
            onNavigate={handlePageClick}
            onCreateChild={handleCreateChild}
            
            hasMore={childrenHasMore}
            isLoadingMore={isLoadingMoreChildren}
            onLoadMore={handleLoadMoreChildren}
            onUpdatePage={onUpdatePage}
            tagSuggestions={siblingPageTags}
            contentRightInsetPx={reserveWidth}
          />
        )}
            </div>

          </div>
        </div>
        )}
      </FloatingSidePanelLayout>
      
      {/* Section Manager Modal for task collection view */}
      {isTasksMode && <SectionManagerModal />}
    </div>
  );
};

// ============================================================================
// PAGE MODE CONTENT
// ============================================================================

interface PageModeContentProps {
  page: Page;
  allChildren: Page[];
  childrenExpanded: boolean;
  setChildrenExpanded: (expanded: boolean) => void;
  onNavigate: (pageId: string) => void;
  onCreateChild?: () => void;
  onIconClick?: () => void;
  /** Whether there are more children to load (pagination) */
  hasMore?: boolean;
  /** Whether currently loading more children */
  isLoadingMore?: boolean;
  /** Callback to load more children */
  onLoadMore?: () => void;
  /** Callback to update page fields */
  onUpdatePage: (pageId: string, updates: UpdatePageInput) => void;
  /** Tag suggestions for autocomplete */
  tagSuggestions?: string[];
  /** Optional right inset to keep page content clear of the floating sidebar. */
  contentRightInsetPx?: number;
}

const PageModeContent: React.FC<PageModeContentProps> = ({
  page,
  allChildren,
  childrenExpanded,
  setChildrenExpanded,
  onNavigate,
  onCreateChild,
  onIconClick,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  onUpdatePage,
  tagSuggestions,
  contentRightInsetPx = 0,
}) => {
  const isMobile = useIsMobile();

  // === ZUSTAND STORE - editor state ===
  const activePageId = usePagesStore((state: PagesState) => state.activePageId);
  const isPageActive = activePageId === page.id;

  // Hero compact state - notes default to expanded
  const [heroCompact, setHeroCompact] = useState(() => page.heroCompact ?? false);
  const handleToggleCompact = useCallback((compact: boolean) => {
    setHeroCompact(compact);
    onUpdatePage(page.id, { heroCompact: compact });
  }, [page.id, onUpdatePage]);

  useEffect(() => {
    setHeroCompact(page.heroCompact ?? false);
  }, [page.heroCompact]);

  // Use page.childCount for accurate total (precalculated in DB)
  const totalChildCount = page.childCount ?? allChildren.length;
  const loadedChildCount = allChildren.length;
  const remainingCount = totalChildCount - loadedChildCount;
  
  // Sort children by order for page mode
  const sortedChildren = useMemo(() => {
    return [...allChildren].sort((a, b) => a.order - b.order);
  }, [allChildren]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 min-h-0">
        <SuspensePageEditor
          key={page.id}
          pageId={page.id}
          created={page.created}
          updated={page.updated}
          onCancel={() => {}}
          hideActions
          hideBorder
          icon={page.icon}
          color={page.color}
          coverImage={page.coverImage}
          coverGradient={page.coverGradient}
          coverAttribution={page.coverAttribution}
          onIconClick={onIconClick}
          readOnly={!isPageActive || page.isReadOnly === true}
          tags={page.tags}
          contentRightInsetPx={contentRightInsetPx}
          compact={heroCompact}
          onToggleCompact={handleToggleCompact}
          onTagsChange={page.isReadOnly ? undefined : (tags) => onUpdatePage(page.id, { tags })}
          tagSuggestions={tagSuggestions}
        />
      </div>

      {/* Sub-pages section - compact list below editor (hidden on mobile) */}
      {!isMobile && (totalChildCount > 0 || childrenExpanded) && (
        <div className="flex-shrink-0 border-t border-[var(--color-border-default)] bg-[var(--color-surface-inset)]/50">
          <div className="max-w-3xl mx-auto px-6 py-3">
            <button
              onClick={() => setChildrenExpanded(!childrenExpanded)}
              className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {childrenExpanded ? (
                <ChevronDownIcon className="w-4 h-4" />
              ) : (
                <ChevronRightIcon className="w-4 h-4" />
              )}
              Sub-pages ({totalChildCount})
            </button>
            
            {childrenExpanded && (
              <div className="mt-2 space-y-1">
                {sortedChildren.map((child) => (
                  <CompactChildRow
                    key={child.id}
                    page={child}
                    onClick={() => onNavigate(child.id)}
                  />
                ))}
                {/* Load More button for pagination */}
                {hasMore && onLoadMore && (
                  <div className="flex justify-center py-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={onLoadMore}
                      disabled={isLoadingMore}
                      className="min-w-[140px]"
                    >
                      {isLoadingMore 
                        ? 'Loading...' 
                        : remainingCount > 0 
                          ? `Load More (${remainingCount} remaining)`
                          : 'Load More'
                      }
                    </Button>
                  </div>
                )}
                {onCreateChild && (
                  <button
                    onClick={onCreateChild}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-secondary)] rounded-lg transition-colors"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Add sub-page
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

// ============================================================================
// COLLECTION MODE CONTENT
// ============================================================================

interface CollectionModeContentProps {
  page: Page;
  allChildren: Page[];
  childrenDisplayMode: 'list' | 'gallery' | 'table';
  onChildrenDisplayChange: (mode: 'list' | 'gallery' | 'table') => void;
  onNavigate: (pageId: string) => void;
  onCreateChild?: (viewMode?: PageViewMode) => void;
  onDeletePage: (id: string, cascade?: boolean) => void;
  onMovePage?: (pageId: string, newParentId: string | null) => void;
  onIconClick?: () => void;
  sortBy: 'updated' | 'created' | 'title';
  onSortByChange: (sortBy: 'updated' | 'created' | 'title') => void;
  sortDirection: 'asc' | 'desc';
  onSortDirectionChange: (direction: 'asc' | 'desc') => void;
  groupBy: 'none' | 'date';
  onGroupByChange: (groupBy: 'none' | 'date') => void;
  /** Pagination: whether there are more children to load */
  hasMore?: boolean;
  /** Pagination: whether currently loading more */
  isLoadingMore?: boolean;
  /** Pagination: callback to load more children */
  onLoadMore?: () => void;
  hasCover?: boolean;
  showExcerpts?: boolean;
  onShowExcerptsChange?: (show: boolean) => void;
  /** Callback to update the page (for saved views) */
  onUpdatePage: (id: string, updates: UpdatePageInput) => void;
  /** Whether this content is in a split view panel (more compact layout) */
  inSplitView?: boolean;
  /** Tag suggestions for the page hero (from sibling pages) */
  heroTagSuggestions?: string[];
  /** Whether description/content is being edited */
  editingContent?: boolean;
  /** Callback to toggle description editing */
  onEditingContentChange?: (editing: boolean) => void;
  /** Optional right inset to keep content clear of the floating sidebar while allowing the cover to bleed. */
  contentRightInsetPx?: number;
}

const CollectionModeContent: React.FC<CollectionModeContentProps> = ({
  page,
  allChildren,
  childrenDisplayMode,
  onChildrenDisplayChange,
  onNavigate,
  onCreateChild,
  onDeletePage,
  onMovePage,
  onIconClick,
  sortBy,
  onSortByChange,
  sortDirection,
  onSortDirectionChange,
  groupBy,
  onGroupByChange,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  hasCover,
  showExcerpts,
  onShowExcerptsChange,
  onUpdatePage,
  inSplitView = false,
  heroTagSuggestions = [],
  editingContent: editingContentProp,
  onEditingContentChange,
  contentRightInsetPx = 0,
}) => {
	const isReadOnly = page.isReadOnly === true;

  // === ZUSTAND STORE - editor state ===
  const activePageId = usePagesStore((state: PagesState) => state.activePageId);
  const draftTitle = usePagesStore((state: PagesState) => state.draftTitle);
  const draftContent = usePagesStore((state: PagesState) => state.draftContent);

  const isPageActive = activePageId === page.id;
  const displayTitle = isPageActive ? draftTitle : page.title;
  const displayContent = isPageActive ? draftContent : page.content;

  // Page filter options state for collection filtering
  const [pageFilterOptions, setPageFilterOptions] = useState<PageFilterOptions>(DEFAULT_PAGE_FILTER_OPTIONS);
  const [collectionFilterBy, setCollectionFilterBy] = useState<'all' | 'notes' | 'collections' | 'tasks' | 'handwritten'>('all');

  // Compute existing tags from children for tag filter suggestions
  const existingPageTags = useMemo(() => {
    const tagSet = new Set<string>();
    allChildren.forEach(child => {
      if (child.tags) {
        child.tags.split(',').map(t => t.trim()).filter(Boolean).forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [allChildren]);

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  // Use lifted state if provided, otherwise fall back to local state
  const [localEditingContent, setLocalEditingContent] = useState(false);
  const editingContent = editingContentProp ?? localEditingContent;
  const setEditingContent = onEditingContentChange ?? setLocalEditingContent;
  const [heroCompact, setHeroCompact] = useState(() => {
    // Default: use saved preference, fallback to compact for collections
    return page.heroCompact ?? true;
  });

  // Persist compact toggle to database
  const handleToggleCompact = useCallback((compact: boolean) => {
    setHeroCompact(compact);
    onUpdatePage(page.id, { heroCompact: compact });
  }, [page.id, onUpdatePage]);

  useEffect(() => {
    setHeroCompact(page.heroCompact ?? true);
  }, [page.heroCompact]);

  // Auto-focus title on new page creation
  useEffect(() => {
    // Check if this is a newly created page (title is default "Untitled" and no children yet)
    if (!isReadOnly && displayTitle === 'Untitled' && allChildren.length === 0 && !isEditingTitle) {
      setIsEditingTitle(true);
    }
  }, []); // Only run on mount
  
  const handleTitleChange = (newTitle: string) => {
	if (isReadOnly) return;
    const { setDraftTitle } = usePagesStore.getState();
    setDraftTitle(newTitle);
  };
  
  const handleTitleEditEnd = () => {
	if (isReadOnly) return;
    setIsEditingTitle(false);
    // Save the title change
    const { updatePage } = usePagesStore.getState();
    updatePage(page.id, { title: isPageActive ? draftTitle : page.title });
  };
  
  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleEditEnd();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };

  // Cover change handler
  const handleCoverChange = useCallback((newCover: string | null) => {
	if (isReadOnly) return;
    const { updatePage } = usePagesStore.getState();
    updatePage(page.id, { coverImage: newCover });
	}, [isReadOnly, page.id]);

  // Handle external drops (from sidebar)
  const handleExternalDrop = useCallback((droppedId: string) => {
    if (!onMovePage) return;
    // Don't allow dropping the collection onto itself
    if (droppedId === page.id) return;
    // Move the dropped page into this collection
    onMovePage(droppedId, page.id);
  }, [onMovePage, page.id]);

  // Extract preview text from content
  const previewText = useMemo(() => {
    const contentToUse = displayContent;
    if (!contentToUse) return '';
    try {
      const parsed = JSON.parse(contentToUse);
      const texts: string[] = [];
      Object.values(parsed).forEach((block: any) => {
        if (block?.value && Array.isArray(block.value)) {
          block.value.forEach((node: any) => {
            if (node?.children) {
              node.children.forEach((child: any) => {
                if (child?.text) texts.push(child.text);
              });
            }
          });
        }
      });
      return texts.join(' ').trim().slice(0, 200);
    } catch {
      return '';
    }
  }, [displayContent]);

  if (editingContent) {
    // Full editor overlay for editing
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 min-h-0">
          <SuspensePageEditor
            key={page.id}
            pageId={page.id}
            created={page.created}
            updated={page.updated}
            onCancel={() => setEditingContent(false)}
            hideActions
            hideBorder
            coverImage={page.coverImage}
            coverAttribution={page.coverAttribution}
            contentRightInsetPx={contentRightInsetPx}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Unified hero with cover + title + description */}
      <PageHero
        pageId={page.id}
        title={displayTitle}
        isEditingTitle={isPageActive ? isEditingTitle : false}
        onTitleChange={handleTitleChange}
        onTitleEditStart={isReadOnly ? undefined : () => isPageActive && setIsEditingTitle(true)}
        onTitleEditEnd={handleTitleEditEnd}
        onTitleKeyDown={handleTitleKeyDown}
        coverImage={page.coverImage}
        coverGradient={page.coverGradient}
        coverAttribution={page.coverAttribution}
        editableCover={isPageActive && !isReadOnly}
        onCoverChange={handleCoverChange}
        created={page.created}
        updated={page.updated}
        hideActions={true}
        icon={page.icon}
        color={page.color}
        onIconClick={isReadOnly ? undefined : onIconClick}
        viewMode={page.viewMode}
        isDailyNote={page.isDailyNote}
        description={previewText}
        onDescriptionClick={isReadOnly ? undefined : (isPageActive ? () => setEditingContent(true) : undefined)}
        inSplitView={inSplitView}
        tags={page.tags}
        compact={heroCompact}
        onToggleCompact={handleToggleCompact}
        onTagsChange={isReadOnly ? undefined : (tags) => onUpdatePage(page.id, { tags })}
        tagSuggestions={heroTagSuggestions}
        contentRightInsetPx={contentRightInsetPx}
      />

      <div
        className="relative z-10 w-full"
        style={getRightInsetStyle(contentRightInsetPx)}
      >
        <div
          className={cn(
            "max-w-5xl mx-auto px-4 md:px-6 py-2 pb-32 md:pb-6 space-y-6 w-full"
          )}
        >
        <PageCollection
          pages={allChildren}
          onPageClick={onNavigate}
          onCreatePage={isReadOnly ? undefined : onCreateChild}
          onDeletePage={onDeletePage}
          viewMode={childrenDisplayMode === 'gallery' ? 'kanban' : (childrenDisplayMode === 'table' ? 'table' : 'list')}
          onViewModeChange={(mode) => onChildrenDisplayChange(mode === 'kanban' ? 'gallery' : (mode === 'table' ? 'table' : 'list'))}
          sortBy={sortBy}
          onSortByChange={onSortByChange}
          sortDirection={sortDirection}
          onSortDirectionChange={onSortDirectionChange}
          groupBy={groupBy}
          onGroupByChange={onGroupByChange}
          filterBy={collectionFilterBy}
          onFilterByChange={setCollectionFilterBy}
          pageFilterOptions={pageFilterOptions}
          onPageFilterOptionsChange={setPageFilterOptions}
          existingPageTags={existingPageTags}
          showHeader
          emptyTitle="No pages yet"
          emptyDescription="Create your first page to get started"
          onExternalDrop={onMovePage ? handleExternalDrop : undefined}
          excludeFromDrop={[page.id]}
          hasMore={hasMore}
          totalItems={page.childCount ?? allChildren.length}
          isLoadingMore={isLoadingMore}
          onLoadMore={onLoadMore}
          showExcerpts={showExcerpts}
          onShowExcerptsChange={onShowExcerptsChange}
          page={page}
          onSavedViewUpdate={(
            updates: { savedViews?: PageSavedView[]; activeSavedViewId?: string | null },
            configToApply?: TaskViewConfig | CollectionViewConfig | null
          ) => {
            const batchedUpdates: UpdatePageInput = { ...updates };
            if (configToApply && 'showExcerpts' in configToApply) {
              const collectionConfig = configToApply as CollectionViewConfig;
              batchedUpdates.childrenViewMode = collectionConfig.viewMode === 'kanban' ? 'gallery' : (collectionConfig.viewMode === 'table' ? 'table' : 'list');
              batchedUpdates.collectionGroupBy = collectionConfig.groupBy;
              batchedUpdates.collectionSortBy = collectionConfig.sortBy;
              batchedUpdates.collectionSortDirection = collectionConfig.sortDirection;
              batchedUpdates.showExcerpts = collectionConfig.showExcerpts;
              // Apply filter options from saved view
              if (collectionConfig.filterOptions) {
                setPageFilterOptions(collectionConfig.filterOptions);
                setCollectionFilterBy(collectionConfig.filterOptions.filterBy || 'all');
              }
            }
            onUpdatePage(page.id, batchedUpdates);
          }}
          currentSavedViewConfig={{
            viewMode: childrenDisplayMode === 'gallery' ? 'kanban' : (childrenDisplayMode === 'table' ? 'table' : 'list'),
            groupBy,
            sortBy,
            sortDirection,
            showExcerpts: showExcerpts ?? true,
            filterOptions: pageFilterOptions,
          } as CollectionViewConfig}
          savedViewsBar={
            <SavedViewsBar
              page={page}
              onUpdatePage={(
                updates: { savedViews?: PageSavedView[]; activeSavedViewId?: string | null },
                configToApply?: TaskViewConfig | CollectionViewConfig | null
              ) => {
                const batchedUpdates: UpdatePageInput = { ...updates };

                if (configToApply && 'showExcerpts' in configToApply) {
                  const collectionConfig = configToApply as CollectionViewConfig;
                  batchedUpdates.childrenViewMode = collectionConfig.viewMode === 'kanban' ? 'gallery' : (collectionConfig.viewMode === 'table' ? 'table' : 'list');
                  batchedUpdates.collectionGroupBy = collectionConfig.groupBy;
                  batchedUpdates.collectionSortBy = collectionConfig.sortBy;
                  batchedUpdates.collectionSortDirection = collectionConfig.sortDirection;
                  batchedUpdates.showExcerpts = collectionConfig.showExcerpts;
                  // Apply filter options from saved view
                  if (collectionConfig.filterOptions) {
                    setPageFilterOptions(collectionConfig.filterOptions);
                    setCollectionFilterBy(collectionConfig.filterOptions.filterBy || 'all');
                  }
                }

                onUpdatePage(page.id, batchedUpdates);
              }}
              currentConfig={{
                viewMode: childrenDisplayMode === 'gallery' ? 'kanban' : (childrenDisplayMode === 'table' ? 'table' : 'list'),
                groupBy,
                sortBy,
                sortDirection,
                showExcerpts: showExcerpts ?? true,
                filterOptions: pageFilterOptions,
              } as CollectionViewConfig}
              existingTags={existingPageTags}
            />
          }
        />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// TASKS MODE CONTENT
// ============================================================================

interface TaskModeContentProps {
  page: Page;
  tasks: Task[];
  allTasks: Task[];  // All tasks (including completed) for section manager
  taskCollections: Page[];
  viewMode: TaskViewMode;
  groupBy: GroupBy;
  showCompleted: boolean;
  onViewModeChange: (mode: TaskViewMode) => void;
  onGroupByChange: (groupBy: GroupBy) => void;
  onShowCompletedChange: (show: boolean) => void;
  taskSortBy: 'date' | 'priority' | 'title' | 'created' | 'tag';
  taskSortDirection: 'asc' | 'desc';
  onTaskSortByChange: (sortBy: 'date' | 'priority' | 'title' | 'created' | 'tag') => void;
  onTaskSortDirectionChange: (direction: 'asc' | 'desc') => void;
  onToggleComplete: (id: string) => void;
  onTaskDrop?: (taskId: string, targetGroup: string, groupBy: GroupBy) => void;
  onEditTask?: (id: string | null) => void;
  onCreateTask?: () => void;
  onAddTaskToGroup?: (groupKey: string, groupBy: GroupBy) => void;
  onOpenSectionManager: () => void;
  allChildren: Page[];
  childrenExpanded: boolean;
  setChildrenExpanded: (expanded: boolean) => void;
  onNavigate: (pageId: string) => void;
  onCreateChild?: () => void;
  onIconClick?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  hasCover?: boolean;
  showExcerpts?: boolean;
  onShowExcerptsChange?: (show: boolean) => void;
  /** Callback to update the page (for saved views) */
  onUpdatePage: (id: string, updates: UpdatePageInput) => void;
  /** Whether this content is in a split view panel (more compact layout) */
  inSplitView?: boolean;
  /** Current task filter options */
  filterOptions?: TaskFilterOptions;
  /** Callback to change filter options */
  onFilterOptionsChange?: (opts: TaskFilterOptions) => void;
  /** Tag suggestions for the page hero (from sibling pages) */
  heroTagSuggestions?: string[];
  /** Whether description/content is being edited */
  editingContent?: boolean;
  /** Callback to toggle description editing */
  onEditingContentChange?: (editing: boolean) => void;
  /** Optional right inset to keep content clear of the floating sidebar while allowing the cover to bleed. */
  contentRightInsetPx?: number;
}

const TaskModeContent: React.FC<TaskModeContentProps> = ({
  page,
  tasks,
  allTasks,
  taskCollections,
  viewMode,
  groupBy,
  showCompleted,
  onViewModeChange,
  onGroupByChange,
  onShowCompletedChange,
  taskSortBy,
  taskSortDirection,
  onTaskSortByChange,
  onTaskSortDirectionChange,
  onToggleComplete,
  onTaskDrop,
  onEditTask,
  onCreateTask,
  onAddTaskToGroup,
  onOpenSectionManager,
  allChildren,
  childrenExpanded,
  setChildrenExpanded,
  onNavigate,
  onCreateChild,
  onIconClick,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  hasCover,
  showExcerpts,
  onShowExcerptsChange,
  onUpdatePage,
  inSplitView = false,
  filterOptions,
  onFilterOptionsChange,
  heroTagSuggestions = [],
  editingContent: editingContentProp,
  onEditingContentChange,
  contentRightInsetPx = 0,
}) => {
  const isMobile = useIsMobile();
  
  // === ZUSTAND STORE - editor state ===
  const activePageId = usePagesStore((state: PagesState) => state.activePageId);
  const draftTitle = usePagesStore((state: PagesState) => state.draftTitle);
  const draftContent = usePagesStore((state: PagesState) => state.draftContent);

  const isPageActive = activePageId === page.id;
  const displayTitle = isPageActive ? draftTitle : page.title;
  const displayContent = isPageActive ? draftContent : page.content;

  // Compute existing task tags for tag filter suggestions
  const existingTaskTags = useMemo(() => {
    const tagSet = new Set<string>();
    allTasks.forEach(task => {
      if (task.tag) {
        tagSet.add(task.tag);
      }
    });
    return Array.from(tagSet).sort();
  }, [allTasks]);
  
  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  // Use lifted state if provided, otherwise fall back to local state
  const [localEditingContent, setLocalEditingContent] = useState(false);
  const editingContent = editingContentProp ?? localEditingContent;
  const setEditingContent = onEditingContentChange ?? setLocalEditingContent;
  const [heroCompact, setHeroCompact] = useState(() => {
    // Default: use saved preference, fallback to compact for tasks
    return page.heroCompact ?? true;
  });

  // Persist compact toggle to database
  const handleToggleCompact = useCallback((compact: boolean) => {
    setHeroCompact(compact);
    onUpdatePage(page.id, { heroCompact: compact });
  }, [page.id, onUpdatePage]);

  useEffect(() => {
    setHeroCompact(page.heroCompact ?? true);
  }, [page.heroCompact]);

  // Auto-focus title on new page creation
  useEffect(() => {
    // Check if this is a newly created page (title is default "Untitled" and no tasks yet)
    if (displayTitle === 'Untitled' && tasks.length === 0 && !isEditingTitle) {
      setIsEditingTitle(true);
    }
  }, []); // Only run on mount
  
  const handleTitleChange = (newTitle: string) => {
    const { setDraftTitle } = usePagesStore.getState();
    setDraftTitle(newTitle);
  };
  
  const handleTitleEditEnd = () => {
    setIsEditingTitle(false);
    // Save the title change
    const { updatePage } = usePagesStore.getState();
    updatePage(page.id, { title: isPageActive ? draftTitle : page.title });
  };
  
  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleEditEnd();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };

  // Cover change handler
  const handleCoverChange = useCallback((newCover: string | null) => {
    const { updatePage } = usePagesStore.getState();
    updatePage(page.id, { coverImage: newCover });
  }, [page.id]);

  // Use page.childCount for accurate total
  const totalChildCount = page.childCount ?? allChildren.length;
  const loadedChildCount = allChildren.length;
  const remainingCount = totalChildCount - loadedChildCount;
  
  // Sort children by order
  const sortedChildren = useMemo(() => {
    return [...allChildren].sort((a, b) => a.order - b.order);
  }, [allChildren]);

  // Extract preview text from content
  const previewText = useMemo(() => {
    const contentToUse = displayContent;
    if (!contentToUse) return '';
    try {
      const parsed = JSON.parse(contentToUse);
      const texts: string[] = [];
      Object.values(parsed).forEach((block: any) => {
        if (block?.value && Array.isArray(block.value)) {
          block.value.forEach((node: any) => {
            if (node?.children) {
              node.children.forEach((child: any) => {
                if (child?.text) texts.push(child.text);
              });
            }
          });
        }
      });
      return texts.join(' ').trim().slice(0, 200);
    } catch {
      return '';
    }
  }, [displayContent]);

  if (editingContent) {
    // Full editor overlay for editing description
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 min-h-0">
          <SuspensePageEditor
            key={page.id}
            pageId={page.id}
            created={page.created}
            updated={page.updated}
            onCancel={() => setEditingContent(false)}
            hideActions
            hideBorder
            coverImage={page.coverImage}
            coverAttribution={page.coverAttribution}
            contentRightInsetPx={contentRightInsetPx}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Unified hero with cover + title + description */}
      <PageHero
        pageId={page.id}
        title={displayTitle}
        isEditingTitle={isPageActive ? isEditingTitle : false}
        onTitleChange={handleTitleChange}
        onTitleEditStart={() => isPageActive && setIsEditingTitle(true)}
        onTitleEditEnd={handleTitleEditEnd}
        onTitleKeyDown={handleTitleKeyDown}
        coverImage={page.coverImage}
        coverGradient={page.coverGradient}
        coverAttribution={page.coverAttribution}
        editableCover={isPageActive}
        onCoverChange={handleCoverChange}
        created={page.created}
        updated={page.updated}
        hideActions={true}
        icon={page.icon}
        color={page.color}
        onIconClick={onIconClick}
        viewMode={page.viewMode}
        isDailyNote={page.isDailyNote}
        description={previewText}
        onDescriptionClick={isPageActive ? () => setEditingContent(true) : undefined}
        inSplitView={inSplitView}
        tags={page.tags}
        compact={heroCompact}
        onToggleCompact={handleToggleCompact}
        onTagsChange={(tags) => onUpdatePage(page.id, { tags })}
        tagSuggestions={heroTagSuggestions}
        contentRightInsetPx={contentRightInsetPx}
      />
      
      <div
        className="py-2 pb-32 md:pb-6 space-y-6 w-full relative z-10"
        style={getRightInsetStyle(contentRightInsetPx)}
      >
      <div className="max-w-5xl mx-auto px-4 md:px-6 space-y-4">
        {/* View Controls Bar - saved views + sort/filter/view inline */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {/* Hide SavedViewsBar on mobile - it's in the mobile sheet */}
            {!isMobile && (
            <SavedViewsBar
              page={page}
              onUpdatePage={(
                updates: { savedViews?: PageSavedView[]; activeSavedViewId?: string | null },
                configToApply?: TaskViewConfig | CollectionViewConfig | null
              ) => {
                // Build batched update with saved views and task config
                const batchedUpdates: UpdatePageInput = { ...updates };
                
                if (configToApply && 'showCompleted' in configToApply) {
                  const taskConfig = configToApply as TaskViewConfig;
                  batchedUpdates.tasksViewMode = taskConfig.viewMode === 'graph' ? 'list' : taskConfig.viewMode;
                  batchedUpdates.tasksGroupBy = taskConfig.groupBy as 'date' | 'priority' | 'section' | 'tag' | 'none' | 'parentPage';
                  batchedUpdates.showCompletedTasks = taskConfig.showCompleted;
                  // Sort preferences are handled via callbacks since they may use local state
                  onTaskSortByChange(taskConfig.sortBy);
                  onTaskSortDirectionChange(taskConfig.sortDirection);
                  // Apply filter options from saved view
                  if (taskConfig.filterOptions && onFilterOptionsChange) {
                    onFilterOptionsChange(taskConfig.filterOptions);
                  }
                }
                
                onUpdatePage(page.id, batchedUpdates);
              }}
              currentConfig={{
                viewMode: viewMode,
                groupBy,
                showCompleted,
                sortBy: taskSortBy,
                sortDirection: taskSortDirection,
                filterOptions,
              } as TaskViewConfig}
              existingTags={existingTaskTags}
            />
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Sort/filter/view controls - desktop: inline icons, mobile: bottom sheet */}
            {isMobile ? (
              <ViewSwitcherMobileWrapper
                viewMode={viewMode}
                groupBy={groupBy}
                showCompleted={showCompleted}
                onViewModeChange={onViewModeChange}
                onGroupByChange={onGroupByChange}
                onShowCompletedChange={onShowCompletedChange}
                contentType="tasks"
                hasSections={true}
                isTaskPageView={true}
                taskSortBy={taskSortBy}
                taskSortDirection={taskSortDirection}
                onTaskSortByChange={onTaskSortByChange}
                onTaskSortDirectionChange={onTaskSortDirectionChange}
                showExcerpts={showExcerpts}
                onShowExcerptsChange={onShowExcerptsChange}
                page={page}
                onSavedViewUpdate={(
                  updates: { savedViews?: PageSavedView[]; activeSavedViewId?: string | null },
                  configToApply?: TaskViewConfig | CollectionViewConfig | null
                ) => {
                  const batchedUpdates: UpdatePageInput = { ...updates };
                  if (configToApply && 'showCompleted' in configToApply) {
                    const taskConfig = configToApply as TaskViewConfig;
                    batchedUpdates.tasksViewMode = taskConfig.viewMode === 'graph' ? 'list' : taskConfig.viewMode;
                    batchedUpdates.tasksGroupBy = taskConfig.groupBy as 'date' | 'priority' | 'section' | 'tag' | 'none' | 'parentPage';
                    batchedUpdates.showCompletedTasks = taskConfig.showCompleted;
                    onTaskSortByChange(taskConfig.sortBy);
                    onTaskSortDirectionChange(taskConfig.sortDirection);
                    // Apply filter options from saved view
                    if (taskConfig.filterOptions && onFilterOptionsChange) {
                      onFilterOptionsChange(taskConfig.filterOptions);
                    }
                  }
                  onUpdatePage(page.id, batchedUpdates);
                }}
                currentConfig={{
                  viewMode: viewMode,
                  groupBy,
                  showCompleted,
                  sortBy: taskSortBy,
                  sortDirection: taskSortDirection,
                  filterOptions,
                } as TaskViewConfig}
              />
            ) : (
              <SortFilterViewBar
                contentType="tasks"
                viewMode={viewMode}
                onViewModeChange={onViewModeChange}
                groupBy={groupBy}
                onGroupByChange={onGroupByChange}
                hasSections
                isTaskPageView
                showCompleted={showCompleted}
                onShowCompletedChange={onShowCompletedChange}
                taskSortBy={taskSortBy}
                taskSortDirection={taskSortDirection}
                onTaskSortByChange={onTaskSortByChange}
                onTaskSortDirectionChange={onTaskSortDirectionChange}
                taskFilterOptions={filterOptions}
                onTaskFilterOptionsChange={onFilterOptionsChange}
                existingTaskTags={existingTaskTags}
              />
            )}
            {/* Section manager button - always visible when in kanban or section grouping */}
            {(viewMode === 'kanban' || groupBy === 'section') && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onOpenSectionManager}
                className="gap-1.5"
              >
                <SettingsIcon className="w-4 h-4" />
                Sections
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tasks - List, Kanban, or Table view */}
      <div className="min-h-[200px]">
        {viewMode === 'table' ? (
          <div className="max-w-5xl mx-auto px-4 md:px-6">
            <TaskTableView
              tasks={tasks}
              onToggleComplete={onToggleComplete}
              groupBy={groupBy}
              taskPages={taskCollections}
              onTaskDrop={onTaskDrop}
              onEditTask={onEditTask}
              sortBy={taskSortBy}
              sortDirection={taskSortDirection}
              onAddTaskToGroup={onAddTaskToGroup}
              showParentPage={false}
            />
          </div>
        ) : viewMode === 'kanban' ? (
          <KanbanView
            tasks={tasks}
            onToggleComplete={onToggleComplete}
            groupBy={groupBy}
            taskPages={taskCollections}
            onTaskDrop={onTaskDrop}
            onEditTask={onEditTask}
            sortBy={taskSortBy}
            sortDirection={taskSortDirection}
            onAddTaskToGroup={onAddTaskToGroup}
            showParentPage={false}
          />
        ) : (
          <div className="max-w-5xl mx-auto px-4 md:px-6">
            <TaskList
              tasks={tasks}
              onToggleComplete={onToggleComplete}
              view="taskCollection"
              taskPages={taskCollections}
              groupBy={groupBy}
              onTaskDrop={onTaskDrop}
              onEditTask={onEditTask}
              sortBy={taskSortBy}
              sortDirection={taskSortDirection}
              onAddTaskToGroup={onAddTaskToGroup}
            />
          </div>
        )}
        {tasks.length === 0 && (
          <div className="max-w-5xl mx-auto px-4 md:px-6">
            <SmartEmptyState
              type="tasks"
              actionLabel="Add your first task"
              onAction={onCreateTask}
            />
          </div>
        )}
      </div>

      {/* Sub-pages section - collapsible (hidden on mobile) */}
      {!isMobile && (totalChildCount > 0 || childrenExpanded) && (
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          <div className="border-t border-[var(--color-border-default)] pt-4">
            <button
              onClick={() => setChildrenExpanded(!childrenExpanded)}
              className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {childrenExpanded ? (
                <ChevronDownIcon className="w-4 h-4" />
              ) : (
                <ChevronRightIcon className="w-4 h-4" />
              )}
              Sub-pages ({totalChildCount})
            </button>
            
            {childrenExpanded && (
              <div className="mt-2 space-y-1">
                {sortedChildren.map((child) => (
                  <CompactChildRow
                    key={child.id}
                    page={child}
                    onClick={() => onNavigate(child.id)}
                  />
                ))}
                {/* Load More button for pagination */}
                {hasMore && onLoadMore && (
                  <div className="flex justify-center py-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={onLoadMore}
                      disabled={isLoadingMore}
                      className="min-w-[140px]"
                    >
                      {isLoadingMore 
                        ? 'Loading...' 
                        : remainingCount > 0 
                          ? `Load More (${remainingCount} remaining)`
                          : 'Load More'
                      }
                    </Button>
                  </div>
                )}
                {onCreateChild && (
                  <button
                    onClick={onCreateChild}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-secondary)] rounded-lg transition-colors"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Add sub-page
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

// ============================================================================
// SHARED COMPONENTS
// ============================================================================

interface CompactChildRowProps {
  page: Page;
  onClick: () => void;
}

const CompactChildRow: React.FC<CompactChildRowProps> = ({ page, onClick }) => {
  const childCount = page.childCount || 0;
  return (
  <button
    onClick={onClick}
    className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-[var(--color-surface-overlay)] rounded-lg transition-colors group"
  >
    <ItemIcon
      type={page.viewMode as any}
      icon={page.icon}
      color={page.color}
      size="sm"
    />
    <span className="flex-1 text-sm text-[var(--color-text-primary)] truncate">
      {page.title || 'Untitled'}
    </span>
    {childCount > 0 && (
      <span className="text-xs text-[var(--color-text-tertiary)]">{childCount}</span>
    )}
    <ChevronRightIcon className="w-4 h-4 text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" />
  </button>
)};

export default PageDetailView;
