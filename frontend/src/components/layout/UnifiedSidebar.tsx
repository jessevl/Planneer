/**
 * @file UnifiedSidebar.tsx
 * @description Unified sidebar combining pages and tasks navigation
 * @app SHARED - Main navigation for the entire application
 * 
 * The single sidebar for the unified app experience, containing:
 * - Logo and collapse button
 * - Main navigation (Home, Daily Journal, Pages, Tasks)
 * - Pages tree (hierarchical navigation)
 * 
 * Consumes stores directly (no prop drilling):
 * - usePagesStore for pages tree and CRUD
 * - useTasksStore for sidebar counts and task updates
 * 
 * Uses TanStack Router for navigation
 */
import React, { Suspense, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useNavigate, useLocation } from '@tanstack/react-router';

// Store imports
import { useNavigationStore } from '@/stores/navigationStore';
import { usePagesStore, usePages, selectPageState, selectPageActions, type PagesState } from '@/stores/pagesStore';
import { useTasksStore, useTasks } from '@/stores/tasksStore';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { useDeleteConfirmStore } from '@/stores/deleteConfirmStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTabsStore } from '@/stores/tabsStore';
import { selectSidebarCounts } from '@/lib/selectors';
import { getTodayISO, dayjs } from '@/lib/dateUtils';
import { isRootLevel } from '@/lib/treeUtils';
import { pb } from '@/lib/pocketbase';
import { cn } from '@/lib/design-system';
import { FLOATING_PANEL_GUTTER_PX, getFloatingPanelReserveWidth } from '@/lib/layout';
// Components
import TreeSection, { type TreeNode, type TreeItemConfig } from './TreeSection';
import { NavItem, Divider, SectionHeader, Label, ContextMenu, type ContextMenuItem, ResizeHandle } from '@/components/ui';
import { MobileSheet } from '@/components/ui';
import { Settings, LogOut, User, ExternalLink, Network, PanelLeftClose, PanelLeftOpen, PenLine, Pin, PinOff } from 'lucide-react';
import { 
  HomeIcon, 
  PagesIcon, 
  CheckIcon, 
  SearchIcon,
} from '../common/Icons';
import ItemIcon from '../common/ItemIcon';
import { openCommandPalette } from '@/hooks/useCommandPalette';
import { useMobileLayout } from '@/contexts/MobileLayoutContext';
import { useSplitViewStore } from '@/contexts/SplitViewContext';
import SidebarHeader from './SidebarHeader';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import { useWorkspaceStore, selectCurrentWorkspace } from '@/stores/workspaceStore';
import { usePageOperations } from '@/hooks/usePageOperations';
import { buildPageMenuItems } from '@/hooks/usePageContextMenu';
import { filterOutBooxPages, filterOutBooxTree, findBooxRootPage } from '@/lib/pageUtils';

// Types
import type { Page, PageTreeNode, PageViewMode } from '@/types/page';

// ============================================================================
// SIDEBAR PAGE TYPE (simplified for tree)
// ============================================================================
interface SidebarPage {
  id: string;
  title: string;
  icon?: string | null;
  color?: string | null;
  parentId?: string | null;
  viewMode?: PageViewMode;
  childCount?: number;
  showChildrenInSidebar?: boolean;
  isPinned?: boolean;
  isReadOnly?: boolean;
}

export const UNIFIED_SIDEBAR_FLOATING_GUTTER = FLOATING_PANEL_GUTTER_PX;
export const UNIFIED_SIDEBAR_RAIL_WIDTH = 78;
export const UNIFIED_SIDEBAR_DEFAULT_EXPANDED_WIDTH = 288;
export const UNIFIED_SIDEBAR_RAIL_RESERVE_WIDTH = getFloatingPanelReserveWidth(UNIFIED_SIDEBAR_RAIL_WIDTH, UNIFIED_SIDEBAR_FLOATING_GUTTER);

const SettingsModal = React.lazy(() => import('./SettingsModal'));
const CreateWorkspaceModal = React.lazy(() => import('@/components/workspace/CreateWorkspaceModal'));

interface UnifiedSidebarProps {
  /** Presentation mode for desktop. Mobile always renders the expanded version inside the drawer. */
  mode?: 'rail' | 'expanded';
  /** Current expanded width for desktop mode. */
  width?: number;
  /** Callback used by the resize handle to update expanded width. */
  onWidthChange?: (width: number) => void;
}

interface SidebarRailButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick: () => void;
  showTooltip?: boolean;
  onMouseEnter?: () => void;
  contextMenuItems?: ContextMenuItem[];
}

const SidebarRailButton: React.FC<SidebarRailButtonProps> = ({
  icon,
  label,
  isActive = false,
  onClick,
  showTooltip = true,
  onMouseEnter,
  contextMenuItems = [],
}) => {
  const button = (
    <div className="group relative flex justify-center">
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        title={label}
        aria-label={label}
        className={cn(
            'relative flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-fg)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
          'active:scale-[0.97] hover:-translate-y-0.5',
          isActive
            ? 'glass-item text-[var(--color-text-primary)]'
            : 'glass-item-subtle text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
        )}
      >
        <span className="flex items-center justify-center transition-transform duration-200 group-hover:scale-105 [&_svg]:h-4.5 [&_svg]:w-4.5">{icon}</span>
      </button>
      {showTooltip ? (
        <div className="pointer-events-none absolute left-[calc(100%+0.85rem)] top-1/2 z-30 -translate-y-1/2 translate-x-[-6px] opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100">
          <div className="whitespace-nowrap rounded-xl border border-[var(--color-border-default)]/80 bg-[color-mix(in_srgb,var(--color-surface-base)_94%,transparent)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] shadow-[0_14px_34px_-24px_rgba(15,23,42,0.42)] backdrop-blur-md eink-shell-surface">
            {label}
          </div>
        </div>
      ) : null}
    </div>
  );

  if (contextMenuItems.length === 0) {
    return button;
  }

  return <ContextMenu items={contextMenuItems}>{button}</ContextMenu>;
};

const usePrimaryNavContextMenus = (taskFilterFromStore: string | null) => {
  const tabsEnabled = useSettingsStore((s) => s.tabsEnabled);
  const openTab = useTabsStore((s) => s.openTab);
  const navigate = useNavigate();
  const iconClass = 'w-4 h-4';

  const homeContextMenu = React.useMemo((): ContextMenuItem[] => {
    if (!tabsEnabled) return [];
    return [{
      id: 'open-in-new-tab',
      label: 'Open in new tab',
      icon: <ExternalLink className={iconClass} />,
      onClick: () => {
        openTab({
          title: 'Home',
          path: '/',
          type: 'home',
        });
        navigate({ to: '/' });
      },
    }];
  }, [tabsEnabled, openTab, navigate]);

  const pagesContextMenu = React.useMemo((): ContextMenuItem[] => {
    if (!tabsEnabled) return [];
    return [{
      id: 'open-in-new-tab',
      label: 'Open in new tab',
      icon: <ExternalLink className={iconClass} />,
      onClick: () => {
        openTab({
          title: 'All Pages',
          path: '/pages',
          type: 'pages',
        });
        navigate({ to: '/pages' });
      },
    }];
  }, [tabsEnabled, openTab, navigate]);

  const graphContextMenu = React.useMemo((): ContextMenuItem[] => {
    if (!tabsEnabled) return [];
    return [{
      id: 'open-in-new-tab',
      label: 'Open in new tab',
      icon: <ExternalLink className={iconClass} />,
      onClick: () => {
        openTab({
          title: 'Graph',
          path: '/graph',
          type: 'graph',
        });
        navigate({ to: '/graph' });
      },
    }];
  }, [tabsEnabled, openTab, navigate]);

  const tasksContextMenu = React.useMemo((): ContextMenuItem[] => {
    if (!tabsEnabled) return [];
    const filter = taskFilterFromStore || 'all';
    const filterLabel = filter.charAt(0).toUpperCase() + filter.slice(1);
    return [{
      id: 'open-in-new-tab',
      label: 'Open in new tab',
      icon: <ExternalLink className={iconClass} />,
      onClick: () => {
        openTab({
          title: `Tasks - ${filterLabel}`,
          path: `/tasks/${filter}`,
          type: 'tasks',
        });
        navigate({ to: '/tasks/$filter', params: { filter } });
      },
    }];
  }, [tabsEnabled, openTab, navigate, taskFilterFromStore]);

  return {
    tabsEnabled,
    homeContextMenu,
    pagesContextMenu,
    graphContextMenu,
    tasksContextMenu,
  };
};

// ============================================================================
// TREE CONFIGS
// ============================================================================
const pageConfig: TreeItemConfig<SidebarPage> = {
  getId: (n) => n.id,
  getParentId: (n) => n.parentId || null,
  getTitle: (n) => n.title || 'Untitled',
  getIcon: (n) => n.icon || null,
  getColor: (n) => n.color || null,
  getItemType: (n) => {
    if (n.viewMode === 'collection') return 'collection';
    if (n.viewMode === 'tasks') return 'tasks';
    return 'note';
  },
  getViewMode: (n) => n.viewMode,
  getIsPinned: (n) => n.isPinned ?? false,
  getShowChildrenInSidebar: (n) => n.showChildrenInSidebar,
  // Use showChildrenInSidebar if defined, otherwise default based on viewMode
  // Notes show subpages in sidebar by default, others don't
  shouldShowChildren: (n) => {
    if (n.showChildrenInSidebar !== undefined) return n.showChildrenInSidebar;
    return n.viewMode === 'note';
  },
  mayHaveChildren: (n) => (n.childCount ?? 0) > 0,
  // Server-side child count - more reliable than counting tree nodes
  getChildCount: (n) => n.childCount ?? 0,
};

// ============================================================================
// TREE CONVERTERS
// ============================================================================
// Cache for tree nodes to avoid unnecessary re-renders of the tree structure
const treeNodeCache = new Map<string, TreeNode<SidebarPage>>();
const EMPTY_CHILDREN: TreeNode<SidebarPage>[] = [];

const convertPageTree = (nodes: PageTreeNode[]): TreeNode<SidebarPage>[] => {
  if (nodes.length === 0) return EMPTY_CHILDREN;

  return nodes.map(node => {
    const cached = treeNodeCache.get(node.page.id);
    
    // Determine if subpages should be shown in sidebar for this node
    const shouldShowChildren = node.page.showChildrenInSidebar ?? (node.page.viewMode === 'note');
    
    // Convert children recursively
    const children = shouldShowChildren && node.children.length > 0 
      ? convertPageTree(node.children) 
      : EMPTY_CHILDREN;
    
    // Check if we can reuse the cached node by comparing sidebar-relevant properties
    if (cached && 
        cached.item.title === node.page.title &&
        cached.item.icon === node.page.icon &&
        cached.item.color === node.page.color &&
        cached.item.parentId === node.page.parentId &&
        cached.item.viewMode === node.page.viewMode &&
        cached.item.childCount === node.page.childCount &&
        cached.item.showChildrenInSidebar === node.page.showChildrenInSidebar &&
        cached.item.isPinned === node.page.isPinned &&
        cached.item.isReadOnly === node.page.isReadOnly &&
        cached.children === children
    ) {
      return cached;
    }
    
    const newNode = {
      item: {
        id: node.page.id,
        title: node.page.title,
        icon: node.page.icon,
        color: node.page.color,
        parentId: node.page.parentId,
        viewMode: node.page.viewMode,
        childCount: node.page.childCount,
        showChildrenInSidebar: node.page.showChildrenInSidebar,
        isPinned: node.page.isPinned,
        isReadOnly: node.page.isReadOnly,
      },
      children,
    };
    
    treeNodeCache.set(node.page.id, newNode);
    return newNode;
  });
};

// ============================================================================
// MAIN NAVIGATION COMPONENT (with context menus for tabs)
// ============================================================================
interface MainNavigationProps {
  isHome: boolean;
  isPages: boolean;
  isGraph: boolean;
  isTasks: boolean;
  selectedPageId: string | null;
  pagesEditedRecently: number;
  sidebarCounts: {
    allCount: number;
    overdueCount: number;
    todayCount: number;
  };
  onNavigateToHome: () => void;
  onNavigateToPages: () => void;
  onNavigateToGraph: () => void;
  onNavigateToTasks: () => void;
  taskFilterFromStore: string | null;
}

const MainNavigation: React.FC<MainNavigationProps> = React.memo(({
  isHome,
  isPages,
  isGraph,
  isTasks,
  selectedPageId,
  pagesEditedRecently,
  sidebarCounts,
  onNavigateToHome,
  onNavigateToPages,
  onNavigateToGraph,
  onNavigateToTasks,
  taskFilterFromStore,
}) => {
  const isMobile = useIsMobile();
  const isEink = useSettingsStore((s) => s.einkMode);
  const { tabsEnabled, homeContextMenu, pagesContextMenu, graphContextMenu, tasksContextMenu } = usePrimaryNavContextMenus(taskFilterFromStore);
  
  if (isMobile) return null;
  
  return (
    <nav className="space-y-0.5 mb-2">
      <ContextMenu items={homeContextMenu} disabled={!tabsEnabled}>
        <NavItem
          icon={<HomeIcon className="w-5 h-5" />}
          label="Home"
          subtitle="Dashboard & overview"
          isActive={isHome}
          einkMode={isEink}
          onClick={onNavigateToHome}
        />
      </ContextMenu>
      <ContextMenu items={pagesContextMenu} disabled={!tabsEnabled}>
        <NavItem
          icon={<PagesIcon className="w-5 h-5" />}
          label="Pages"
          subtitle={pagesEditedRecently > 0 ? `${pagesEditedRecently} edited past 7 days` : 'Your workspace'}
          isActive={isPages && !selectedPageId}
          einkMode={isEink}
          onClick={onNavigateToPages}
        />
      </ContextMenu>
      <ContextMenu items={tasksContextMenu} disabled={!tabsEnabled}>
        <NavItem
          icon={<CheckIcon className="w-5 h-5" />}
          label="Tasks"
          subtitle={
            sidebarCounts.overdueCount > 0 || sidebarCounts.todayCount > 0
              ? [
                  sidebarCounts.overdueCount > 0 && `${sidebarCounts.overdueCount} overdue`,
                  sidebarCounts.todayCount > 0 && `${sidebarCounts.todayCount} due today`,
                ].filter(Boolean).join(', ')
              : 'Track your work'
          }
          isActive={isTasks}
          einkMode={isEink}
          onClick={onNavigateToTasks}
        />
      </ContextMenu>
      <ContextMenu items={graphContextMenu} disabled={!tabsEnabled}>
        <NavItem
          icon={<Network className="w-5 h-5" />}
          label="Graph"
          subtitle="Relationships and backlinks"
          isActive={isGraph}
          einkMode={isEink}
          onClick={onNavigateToGraph}
        />
      </ContextMenu>
    </nav>
  );
});

MainNavigation.displayName = 'MainNavigation';

// ============================================================================
// MAIN COMPONENT
// ============================================================================
const UnifiedSidebar: React.FC<UnifiedSidebarProps> = ({
  mode = 'expanded',
  width = UNIFIED_SIDEBAR_DEFAULT_EXPANDED_WIDTH,
  onWidthChange,
}) => {
  // ============================================================================
  // STATE
  // ============================================================================
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const isResizingRef = useRef(false);
  const hoverCloseTimeoutRef = useRef<number | null>(null);
  
  // Settings modal from global UI store
  const settingsModal = useUIStore(s => s.settingsModal);
  const openSettingsModal = useUIStore(s => s.openSettingsModal);
  const closeSettingsModal = useUIStore(s => s.closeSettingsModal);
  
  // Auth state for sidebar footer
  const { user, logout } = useAuthStore(useShallow((s) => ({ user: s.user, logout: s.logout })));
  
  // Mobile user menu state
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  
  // Mobile detection - on mobile, sidebar should be full-width inside MobileDrawer
  const isMobile = useIsMobile();
  const isRail = !isMobile && mode === 'rail';
  const isEink = useSettingsStore((s) => s.einkMode);
  const currentWorkspace = useWorkspaceStore(selectCurrentWorkspace);
  const sidebarPinned = useNavigationStore((s) => s.sidebarPinned);
  const setSidebarPinned = useNavigationStore((s) => s.setSidebarPinned);
  const setSidebarVisible = useNavigationStore((s) => s.setSidebarVisible);
    const clearPendingHoverClose = useCallback(() => {
      if (hoverCloseTimeoutRef.current !== null) {
        window.clearTimeout(hoverCloseTimeoutRef.current);
        hoverCloseTimeoutRef.current = null;
      }
    }, []);

    const scheduleHoverClose = useCallback(() => {
      if (isMobile || sidebarPinned) return;
      clearPendingHoverClose();
      hoverCloseTimeoutRef.current = window.setTimeout(() => {
        setSidebarVisible(false);
        hoverCloseTimeoutRef.current = null;
      }, 120);
    }, [clearPendingHoverClose, isMobile, setSidebarVisible, sidebarPinned]);

    useEffect(() => {
      return () => {
        clearPendingHoverClose();
      };
    }, [clearPendingHoverClose]);

  const requestDelete = useDeleteConfirmStore((s) => s.requestDelete);
  const { countTasksForPage, migrateTasksToInbox } = usePageOperations();

  // ============================================================================
  // ROUTER NAVIGATION
  // ============================================================================
  const navigate = useNavigate();
  const mobileLayout = useMobileLayout();
  const closeDrawer = mobileLayout?.onCloseDrawer || (() => {});
  const location = useLocation();
  
  // Derive current view state from URL
  const currentPath = location.pathname;
  const isHome = currentPath === '/';
  const isPages = currentPath === '/pages' || currentPath.startsWith('/pages/');
  const isGraph = currentPath === '/graph';
  const isTasks = currentPath.startsWith('/tasks');
  const isHandwritten = currentPath === '/handwritten' || currentPath.startsWith('/handwritten/');
  
  // Extract IDs from URL params
  const selectedPageId = currentPath.startsWith('/pages/') ? currentPath.replace('/pages/', '') : null;
  // For task collections, check if the filter param is actually a page ID (UUID format)
  const taskFilter = currentPath.startsWith('/tasks/') ? currentPath.replace('/tasks/', '') : 'all';
  const isTaskCollectionId = taskFilter.length > 15; // UUIDs are longer than filter names
  const selectedTaskPageId = isTaskCollectionId ? taskFilter : null;

  // ============================================================================
  // PAGES STORE
  // ============================================================================
  const { pages, pageTree } = usePages();
  const { pagesById, expandedIds, totalItems: pagesTotalItems, rootHasMore } = usePagesStore(useShallow(selectPageState));
  const {
    createPage,
    updatePage,
    deletePage,
    movePage,
    reorderPages,
    selectPage,
    toggleExpanded,
    setExpanded,
    getPage,
    parentHasMore,
    loadMoreChildren,
    loadMorePages,
  } = usePagesStore(useShallow(selectPageActions));

  // Wrapper for loadMoreChildren that always uses tree order (not user's sort preference)
  const handleLoadMoreTreeChildren = useCallback((parentId: string) => {
    loadMoreChildren(parentId, 'order', 'asc');
  }, [loadMoreChildren]);

  // Wrapper for loadMorePages that always uses tree order and rootOnly (not user's sort preference)
  const handleLoadMoreRootPages = useCallback(() => {
    loadMorePages(true, 'order', 'asc');
  }, [loadMorePages]);

  // ============================================================================
  // TASKS STORE (for counts and task updates)
  // ============================================================================
  const tasks = useTasks();
  const addTask = useTasksStore((s) => s.addTask);
  const todayISO = useMemo(() => getTodayISO(), []);
  const sidebarCounts = useMemo(() => selectSidebarCounts(tasks, todayISO), [tasks, todayISO]);

  // Count pages edited in the past 7 days (pure in-memory from store)
  const pagesEditedRecently = useMemo(() => {
    const cutoff = dayjs(todayISO).subtract(7, 'day');
    let count = 0;
    for (const page of Object.values(pagesById)) {
      if (page.sourceOrigin === 'boox') continue;
      if (page.updated && dayjs(page.updated).isAfter(cutoff)) count++;
    }
    return count;
  }, [pagesById, todayISO]);
  
  // ============================================================================
  // SPLIT VIEW CONTEXT (from global store)
  // ============================================================================
  const splitViewParentId = useSplitViewStore((s) => s.parentPageId);
  const splitViewCreateChild = useSplitViewStore((s) => s.onCreateChild);

  // ============================================================================
  // UI STORE
  // ============================================================================
  const requestNavigation = useUIStore((s) => s.requestNavigation);
  const createTaskInContext = useUIStore((s) => s.createTaskInContext);

  // ============================================================================
  // RESIZE HANDLING
  // ============================================================================
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current) return;
    // Use hardcoded values since we can't import from config in this context
    const newWidth = Math.min(480, Math.max(240, e.clientX));
    onWidthChange?.(newWidth);
  }, [onWidthChange]);

  const stopResizing = useCallback(() => {
    isResizingRef.current = false;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [onMouseMove, stopResizing]);

  // ============================================================================
  // NAVIGATION HANDLERS
  // ============================================================================
  const handleNavigateToHome = useCallback(() => {
    const canNavigate = requestNavigation({ type: 'view', target: 'home' });
    if (canNavigate) {
      closeDrawer();
      navigate({ to: '/' });
    }
  }, [requestNavigation, navigate, closeDrawer]);

  const handleNavigateToPages = useCallback(() => {
    const canNavigate = requestNavigation({ type: 'view', target: 'pages' });
    if (canNavigate) {
      closeDrawer();
      navigate({ to: '/pages' });
    }
  }, [requestNavigation, navigate, closeDrawer]);

  const handleNavigateToGraph = useCallback(() => {
    const canNavigate = requestNavigation({ type: 'view', target: 'graph' });
    if (canNavigate) {
      closeDrawer();
      navigate({ to: '/graph' });
    }
  }, [requestNavigation, navigate, closeDrawer]);

  const taskFilterFromStore = useNavigationStore((state) => state.taskFilter);
  const { homeContextMenu, pagesContextMenu, graphContextMenu, tasksContextMenu, tabsEnabled } = usePrimaryNavContextMenus(taskFilterFromStore);

  const handleNavigateToTasks = useCallback(() => {
    const canNavigate = requestNavigation({ type: 'view', target: 'tasks' });
    if (canNavigate) {
      closeDrawer();
      navigate({ to: '/tasks/$filter', params: { filter: taskFilterFromStore || 'all' } });
    }
  }, [requestNavigation, navigate, closeDrawer, taskFilterFromStore]);

  const handleNavigateToHandwritten = useCallback(() => {
    closeDrawer();
    navigate({ to: '/handwritten' });
  }, [closeDrawer, navigate]);

  // ============================================================================
  // PAGE HANDLERS
  // ============================================================================
  // Page: We just navigate here - the view's useEffect will call selectPage
  // This prevents double-fetching when clicking a page in the sidebar
  const navigateToPage = useCallback((pageId: string) => {
    closeDrawer();
    navigate({ to: '/pages/$id', params: { id: pageId } });
  }, [navigate, closeDrawer]);

  const handleSelectPage = useCallback((pageId: string) => {
    const page = getPage(pageId);
    if (page) {
      closeDrawer();
      navigateToPage(pageId);
    }
  }, [getPage, navigateToPage, closeDrawer]);

  const handleCreateChildPage = useCallback((parentId: string | null, viewMode?: import('@/types/page').PageViewMode) => {
    // If creating a child of the current split view parent page (or root list), use split view handler
    const isInSplitViewParent = (parentId && parentId === splitViewParentId) || (parentId === null && splitViewParentId === null);
    
    if (isInSplitViewParent && splitViewCreateChild) {
      splitViewCreateChild(parentId, viewMode);
      if (parentId) {
        setExpanded(parentId, true);
      }
      return;
    }
    
    // Otherwise, create page and navigate normally
    const newPage = createPage({ 
      title: 'Untitled', 
      parentId,
      viewMode: viewMode || 'note',
    });
    // Explicitly mark as new so title auto-focuses (like HomeView does)
    selectPage(newPage.id, true);
    navigateToPage(newPage.id);
    if (parentId) {
      setExpanded(parentId, true);
    }
  }, [createPage, selectPage, navigateToPage, setExpanded, splitViewParentId, splitViewCreateChild]);

  // Create task handler for TreeSection context menu - opens modal instead of inline creation
  const handleCreateTask = useCallback((parentPageId: string) => {
    createTaskInContext({ defaultTaskPageId: parentPageId });
    closeDrawer();
  }, [createTaskInContext, closeDrawer]);

  const handleUpdatePage = useCallback((pageId: string, updates: { 
    title?: string; 
    icon?: string | null; 
    color?: string | null; 
    parentId?: string | null; 
    viewMode?: string;
    isPinned?: boolean;
    showChildrenInSidebar?: boolean;
  }) => {
    if (updates.parentId !== undefined && updates.parentId !== pagesById[pageId]?.parentId) {
      if (updates.parentId === null) {
        movePage(pageId, null);
      } else {
        movePage(pageId, updates.parentId);
        setExpanded(updates.parentId, true);
      }
    }
    const pageUpdates: Partial<Page> = {};
    if (updates.title !== undefined) pageUpdates.title = updates.title;
    if (updates.icon !== undefined) pageUpdates.icon = updates.icon;
    if (updates.color !== undefined) pageUpdates.color = updates.color;
    if (updates.isPinned !== undefined) pageUpdates.isPinned = updates.isPinned;
    if (updates.showChildrenInSidebar !== undefined) pageUpdates.showChildrenInSidebar = updates.showChildrenInSidebar;
    if (updates.viewMode) {
      pageUpdates.viewMode = updates.viewMode as PageViewMode;
    }
    if (Object.keys(pageUpdates).length > 0) {
      updatePage(pageId, pageUpdates);
    }
  }, [pagesById, movePage, setExpanded, updatePage]);

  // Pin handlers for TreeSection
  const handleTogglePin = useCallback((pageId: string, isPinned: boolean) => {
    updatePage(pageId, { isPinned });
  }, [updatePage]);

  const getIsPinned = useCallback((pageId: string): boolean => {
    return pagesById[pageId]?.isPinned ?? false;
  }, [pagesById]);

  const handleReorderPages = useCallback((pageId: string, targetId: string, targetParentId: string | null, position: 'before' | 'after') => {
    const draggedPage = pagesById[pageId];
    if (!draggedPage) return;
    
    // Normalize parent IDs for comparison (handles '' vs null vs undefined)
    const draggedParentIsRoot = isRootLevel(draggedPage.parentId);
    const targetParentIsRoot = isRootLevel(targetParentId);
    const isCrossParentMove = draggedParentIsRoot !== targetParentIsRoot || 
      (!draggedParentIsRoot && !targetParentIsRoot && draggedPage.parentId !== targetParentId);
    
    // Filter siblings using normalized comparison
    const targetSiblings = pages
      .filter((n: Page) => {
        const pageParentIsRoot = isRootLevel(n.parentId);
        if (targetParentIsRoot) return pageParentIsRoot;
        return n.parentId === targetParentId;
      })
      .sort((a: Page, b: Page) => a.order - b.order);
    
    const targetIndex = targetSiblings.findIndex((n: Page) => n.id === targetId);
    if (targetIndex === -1) return;
    
    if (isCrossParentMove) {
      movePage(pageId, targetParentId);
      const newSiblings = pages
        .filter((n: Page) => {
          const pageParentIsRoot = isRootLevel(n.parentId);
          if (targetParentIsRoot) return pageParentIsRoot && n.id !== pageId;
          return n.parentId === targetParentId && n.id !== pageId;
        })
        .sort((a: Page, b: Page) => a.order - b.order);
      const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex;
      newSiblings.splice(insertIndex, 0, draggedPage);
      reorderPages(targetParentId, newSiblings.map((n: Page) => n.id));
    } else {
      const draggedIndex = targetSiblings.findIndex((n: Page) => n.id === pageId);
      if (draggedIndex === -1) return;
      const reordered = targetSiblings.filter((n: Page) => n.id !== pageId);
      const insertIndex = position === 'after' 
        ? (targetIndex > draggedIndex ? targetIndex : targetIndex + 1)
        : (targetIndex > draggedIndex ? targetIndex - 1 : targetIndex);
      reordered.splice(insertIndex, 0, targetSiblings[draggedIndex]);
      reorderPages(targetParentId, reordered.map((n: Page) => n.id));
    }
  }, [pages, pagesById, reorderPages, movePage]);

  const handleReparentPage = useCallback((pageId: string, newParentId: string) => {
    if (pageId === newParentId) return;
    const isDescendant = (checkId: string, ancestorId: string): boolean => {
      let current = pagesById[checkId];
      while (current?.parentId) {
        if (current.parentId === ancestorId) return true;
        current = pagesById[current.parentId];
      }
      return false;
    };
    if (isDescendant(newParentId, pageId)) {
      console.warn('Cannot move a page into its own descendant');
      return;
    }
    movePage(pageId, newParentId);
    setExpanded(newParentId, true);
  }, [pagesById, movePage, setExpanded]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================
  const visiblePageTree = useMemo(() => filterOutBooxTree(pageTree), [pageTree]);
  const genericPageTree = useMemo(() => convertPageTree(visiblePageTree), [visiblePageTree]);
  const booxRootPage = useMemo(() => findBooxRootPage(pages), [pages]);
  const shouldShowHandwrittenNav = booxRootPage !== null;



  const sidebarPages = useMemo((): SidebarPage[] => 
    filterOutBooxPages(pages).map((n: Page) => ({
      id: n.id,
      title: n.title,
      icon: n.icon,
      color: n.color,
      parentId: n.parentId,
      viewMode: n.viewMode,
      childCount: n.childCount,
      showChildrenInSidebar: n.showChildrenInSidebar,
      isPinned: n.isPinned,
      isReadOnly: n.isReadOnly,
    })), [pages]);

  const railPages = useMemo(
    () => [...sidebarPages]
      .filter((page) => page.isPinned)
      .sort((left, right) => {
        const leftPinnedOrder = pagesById[left.id]?.pinnedOrder ?? Number.MAX_SAFE_INTEGER;
        const rightPinnedOrder = pagesById[right.id]?.pinnedOrder ?? Number.MAX_SAFE_INTEGER;
        if (leftPinnedOrder !== rightPinnedOrder) {
          return leftPinnedOrder - rightPinnedOrder;
        }
        return (left.title || '').localeCompare(right.title || '');
      })
      .slice(0, 18),
    [pagesById, sidebarPages],
  );

  const getRailPageContextMenuItems = useCallback((page: SidebarPage): ContextMenuItem[] => {
    const isPinned = page.isPinned ?? false;
    const showChildren = page.showChildrenInSidebar ?? (page.viewMode === 'note');
    const pageChildCount = page.childCount ?? 0;
    const taskCount = page.viewMode === 'tasks' ? countTasksForPage(page.id) : 0;
    const totalChildCount = pageChildCount + taskCount;

    return buildPageMenuItems({
      isMultiSelect: false,
      selectionCount: 1,
      tabsEnabled,
      isPinned,
      showChildrenInSidebar: showChildren,
      onOpenInNewTab: tabsEnabled ? () => {
        useTabsStore.getState().openTab({
          title: page.title || 'Untitled',
          path: `/pages/${page.id}`,
          icon: page.icon,
          color: page.color,
          pageId: page.id,
          type: 'page',
        });
      } : undefined,
      onCreateChild: () => handleCreateChildPage(page.id),
      onCreateTask: page.viewMode === 'tasks' ? () => handleCreateTask(page.id) : undefined,
      onTogglePin: () => handleTogglePin(page.id, !isPinned),
      onToggleShowChildren: () => handleUpdatePage(page.id, { showChildrenInSidebar: !showChildren }),
      onDelete: () => {
        requestDelete({
          itemType: 'page',
          count: 1,
          hasChildren: totalChildCount > 0,
          childCount: totalChildCount,
          onConfirm: (cascade: boolean) => {
            if (!cascade && page.viewMode === 'tasks' && taskCount > 0) {
              migrateTasksToInbox(page.id);
            }
            deletePage(page.id, cascade);
          },
        });
      },
    });
  }, [countTasksForPage, deletePage, handleCreateChildPage, handleCreateTask, handleTogglePin, handleUpdatePage, migrateTasksToInbox, requestDelete, tabsEnabled]);

  // Task counts for task pages (pages with viewMode='tasks')
  const taskPageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const overdueCounts: Record<string, number> = {};
    
    // Only show counts for task pages
    pages.forEach((page: Page) => {
      if (page.viewMode === 'tasks') {
        counts[page.id] = sidebarCounts.taskPageCounts[page.id] || 0;
        overdueCounts[page.id] = sidebarCounts.taskPageOverdueCounts[page.id] || 0;
      }
    });
    
    return { counts, overdueCounts };
  }, [pages, sidebarCounts.taskPageCounts, sidebarCounts.taskPageOverdueCounts]);
  // ============================================================================
  // RENDER
  // ============================================================================
  if (isRail) {
    return (
      <aside className="relative z-10 flex h-full w-full flex-col select-none overflow-x-hidden overflow-y-hidden bg-transparent px-2 py-2 eink-shell-surface-secondary">
        <div className="flex flex-1 flex-col items-center gap-1.5 overflow-x-hidden overflow-y-hidden">
          <SidebarRailButton
            icon={<PanelLeftOpen />}
            label="Expand sidebar"
            onClick={() => setSidebarVisible(true)}
            onMouseEnter={() => {
              clearPendingHoverClose();
              setSidebarVisible(true);
            }}
          />
          <SidebarRailButton
            icon={
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--color-accent-muted)] text-sm font-semibold text-[var(--color-accent-fg)]">
                {(currentWorkspace?.name || 'W').trim().charAt(0).toUpperCase()}
              </div>
            }
            label={currentWorkspace?.name || 'Workspace'}
            onClick={() => setSidebarVisible(true)}
          />
          <SidebarRailButton
            icon={<SearchIcon />}
            label="Search"
            onClick={openCommandPalette}
          />

          <div className="my-1.5 h-px w-8 bg-[var(--color-border-default)]/70" />

          <SidebarRailButton icon={<HomeIcon />} label="Home" isActive={isHome} onClick={handleNavigateToHome} contextMenuItems={homeContextMenu} />
          <SidebarRailButton icon={<PagesIcon />} label="All pages" isActive={isPages && !selectedPageId} onClick={handleNavigateToPages} contextMenuItems={pagesContextMenu} />
          <SidebarRailButton icon={<CheckIcon />} label="Tasks" isActive={isTasks} onClick={handleNavigateToTasks} contextMenuItems={tasksContextMenu} />
          <SidebarRailButton icon={<Network />} label="Graph" isActive={isGraph} onClick={handleNavigateToGraph} contextMenuItems={graphContextMenu} />

          <div className="my-1.5 h-px w-8 bg-[var(--color-border-default)]/70" />

          <div className="flex min-h-0 flex-1 w-full flex-col items-center gap-1.5 overflow-x-hidden overflow-y-auto pb-1 scrollbar-thin">
            {railPages.map((page) => {
              const isActive = page.id === (selectedPageId || selectedTaskPageId);

              return (
                <SidebarRailButton
                  key={page.id}
                  icon={<ItemIcon type={page.viewMode === 'tasks' ? 'tasks' : page.viewMode === 'collection' ? 'collection' : 'note'} icon={page.icon || undefined} color={page.color} size="md" className="scale-110" />}
                  label={page.title || 'Untitled'}
                  isActive={isActive}
                  showTooltip={false}
                  onClick={() => handleSelectPage(page.id)}
                  contextMenuItems={getRailPageContextMenuItems(page)}
                />
              );
            })}
          </div>

          <div className="mt-auto flex flex-col items-center gap-1.5 pt-1.5">
            {shouldShowHandwrittenNav ? (
              <SidebarRailButton
                icon={<PenLine />}
                label="Handwritten notes"
                isActive={isHandwritten}
                onClick={handleNavigateToHandwritten}
              />
            ) : null}
            <SidebarRailButton icon={<Settings />} label="Settings" onClick={() => openSettingsModal('general')} />
          </div>
        </div>

        {settingsModal.isOpen ? (
          <Suspense fallback={null}>
            <SettingsModal
              isOpen={settingsModal.isOpen}
              onClose={closeSettingsModal}
              initialSection={settingsModal.section}
            />
          </Suspense>
        ) : null}
        {createWorkspaceOpen ? (
          <Suspense fallback={null}>
            <CreateWorkspaceModal isOpen={createWorkspaceOpen} onClose={() => setCreateWorkspaceOpen(false)} />
          </Suspense>
        ) : null}
      </aside>
    );
  }

  return (
    <aside
      onMouseEnter={clearPendingHoverClose}
      onMouseLeave={scheduleHoverClose}
      className={`relative flex flex-col select-none flex-shrink-0 ${
        isMobile 
          ? 'h-full bg-[var(--color-surface-secondary)]' 
          : 'h-full bg-transparent'
      } eink-shell-surface-secondary`}
      style={isMobile ? undefined : { width: '100%', minWidth: 0 }}
    >
      <nav className={`relative z-10 flex flex-col w-full h-full ${isMobile ? 'px-0' : 'px-2'} overflow-x-hidden overflow-y-hidden ${isMobile ? 'pb-3' : 'pb-3'}`}>
        {!isMobile && (
          <div className="px-1 pb-2 pt-1 flex-shrink-0">
            <div className="flex items-center justify-between rounded-2xl border border-[var(--color-border-default)]/70 bg-[var(--color-surface-base)]/72 px-2 py-1.5 backdrop-blur-sm eink-shell-surface">
              <button
                type="button"
                onClick={() => setSidebarVisible(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]"
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="h-4.5 w-4.5" />
              </button>
              <button
                type="button"
                onClick={() => setSidebarPinned(!sidebarPinned)}
                className={cn(
                  'flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-[background-color,border-color,color,box-shadow]',
                  sidebarPinned
                    ? 'border-[var(--color-border-emphasis)] bg-[color-mix(in_srgb,var(--color-accent-muted)_78%,transparent)] text-[var(--color-text-primary)] shadow-[0_14px_32px_-26px_rgba(15,23,42,0.45)]'
                    : 'border-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border-default)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]'
                )}
                aria-label={sidebarPinned ? 'Unpin sidebar' : 'Pin sidebar'}
                title={sidebarPinned ? 'Unpin sidebar' : 'Pin sidebar'}
              >
                {sidebarPinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
                <span>{sidebarPinned ? 'Pinned layout' : 'Overlay mode'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div 
          className="px-0 pt-2 pb-1 flex-shrink-0"
        >
          {isMobile ? (
            /* Mobile: Workspace switcher and user/settings side by side */
            <div className="flex items-center">
              <div className="flex-1 min-w-0">
                <SidebarHeader
                  onCreateWorkspace={() => setCreateWorkspaceOpen(true)}
                  onOpenSettings={(section) => {
                    openSettingsModal(section);
                  }}
                />
              </div>
              {user && (
                <MobileSheet
                  isOpen={userMenuOpen}
                  onClose={() => setUserMenuOpen(false)}
                  title="Account & Settings"
                >
                  <div className="p-4 space-y-2">
                    <button
                      onClick={() => {
                        openSettingsModal('account');
                        setUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors"
                    >
                      <User className="w-5 h-5 text-[var(--color-text-secondary)]" />
                      <span className="text-sm font-medium">Profile</span>
                    </button>
                    <button
                      onClick={() => {
                        openSettingsModal('general');
                        setUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors"
                    >
                      <Settings className="w-5 h-5 text-[var(--color-text-secondary)]" />
                      <span className="text-sm font-medium">Settings</span>
                    </button>
                    <Divider />
                    <button
                      onClick={() => {
                        logout();
                        setUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[var(--color-state-error)]/10 text-[var(--color-state-error)] transition-colors"
                    >
                      <LogOut className="w-5 h-5" />
                      <span className="text-sm font-medium">Log out</span>
                    </button>
                  </div>
                </MobileSheet>
              )}
              {user && (
                <div className="flex-shrink-0">
                  <button
                    onClick={() => setUserMenuOpen(true)}
                    className="flex items-center justify-center w-11 h-11 mr-4 rounded-lg hover:bg-[var(--color-surface-hover)] transition-all duration-200 group"
                    aria-label="Account menu"
                  >
                    <div className="w-8 h-8 rounded-full bg-[var(--color-accent-muted)] flex items-center justify-center text-[var(--color-accent-fg)] flex-shrink-0 overflow-hidden transition-transform group-hover:scale-105">
                      {user.avatar ? (
                        <img
                          src={pb.files.getUrl(user, user.avatar)}
                          alt={user.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-4 h-4" />
                      )}
                    </div>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Desktop: Workspace switcher and user/settings side by side */
            <div className="px-1">
              <div className="flex items-center">
                <div className="flex-1 min-w-0">
                  <SidebarHeader
                    onCreateWorkspace={() => setCreateWorkspaceOpen(true)}
                    onOpenSettings={(section) => {
                      openSettingsModal(section);
                    }}
                  />
                </div>
                {user && (
                  <div className="flex-shrink-0">
                    <ContextMenu
                      trigger="click"
                      items={[
                        {
                          id: 'profile',
                          label: 'Profile',
                          icon: <User className="w-4 h-4" />,
                          onClick: () => openSettingsModal('account'),
                        },
                        {
                          id: 'settings',
                          label: 'Settings',
                          icon: <Settings className="w-4 h-4" />,
                          onClick: () => openSettingsModal('general'),
                        },
                        {
                          id: 'logout',
                          label: 'Log out',
                          icon: <LogOut className="w-4 h-4" />,
                          variant: 'danger' as const,
                          divider: true,
                          onClick: () => logout(),
                        },
                      ]}
                    >
                      <button
                        className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-[var(--color-surface-hover)] transition-all duration-200 group"
                        aria-label="Account menu"
                      >
                        <div className="w-6 h-6 rounded-full bg-[var(--color-accent-muted)] flex items-center justify-center text-[var(--color-accent-fg)] flex-shrink-0 overflow-hidden transition-transform group-hover:scale-105">
                          {user.avatar ? (
                            <img
                              src={pb.files.getUrl(user, user.avatar)}
                              alt={user.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-3.5 h-3.5" />
                          )}
                        </div>
                      </button>
                    </ContextMenu>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Search - Opens Command Palette - desktop only */}
        {!isMobile && (
          <div className="px-1.5 mb-1.5">
            <button
              onClick={openCommandPalette}
              className="w-full flex items-center gap-3 px-3 py-1.5 bg-[var(--color-surface-primary)] border border-[var(--color-border-default)] rounded-lg text-sm text-[var(--color-text-tertiary)] hover:border-[var(--color-border-emphasis)] hover:bg-[var(--color-surface-secondary)] transition-all"
            >
              <SearchIcon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left">Search...</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-[var(--color-surface-tertiary)] rounded text-[10px] font-medium text-[var(--color-text-disabled)]">
                {typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘' : 'Ctrl'}K
              </kbd>
            </button>
          </div>
        )}

        {/* Main Navigation - Home always shown, others hidden on mobile (moved to FAB) */}
        <div className="px-1">
          <MainNavigation 
          isHome={isHome}
          isPages={isPages}
          isGraph={isGraph}
          isTasks={isTasks}
          selectedPageId={selectedPageId}
          pagesEditedRecently={pagesEditedRecently}
          sidebarCounts={sidebarCounts}
          onNavigateToHome={handleNavigateToHome}
          onNavigateToPages={handleNavigateToPages}
          onNavigateToGraph={handleNavigateToGraph}
          onNavigateToTasks={handleNavigateToTasks}
          taskFilterFromStore={taskFilterFromStore}
        />
        </div>

        <Divider className="my-1.5" />

        {/* Scrollable content */}
        <div className={`flex-1 overflow-y-auto overflow-x-hidden min-h-0 space-y-3 scrollbar-thin ${isMobile ? 'pb-32' : ''}`}>
          {/* Pages Tree */}
          <TreeSection<SidebarPage>
            label="Pages"
            tree={genericPageTree}
            items={sidebarPages}
            config={pageConfig}
            expandedIds={expandedIds}
            selectedId={selectedPageId || selectedTaskPageId}
            itemType="page"
            onSelect={handleSelectPage}
            onToggleExpand={toggleExpanded}
            onCreateChild={handleCreateChildPage}
            onCreateTask={handleCreateTask}
            onUpdate={handleUpdatePage}
            onDelete={deletePage}
            onPin={handleTogglePin}
            getIsPinned={getIsPinned}
            onReorder={handleReorderPages}
            onReparent={handleReparentPage}
            dataAttrPrefix="page"
            enableExternalDrag={true}
            emptyMessage="No pages yet"
            parentHasMoreFn={parentHasMore}
            onLoadMoreChildren={handleLoadMoreTreeChildren}
            hasMoreRoot={rootHasMore}
            onLoadMoreRoot={handleLoadMoreRootPages}
            counts={taskPageCounts.counts}
            overdueCounts={taskPageCounts.overdueCounts}
            hideHeaderAdd={true}
          />
        </div>

        {shouldShowHandwrittenNav ? (
          <div className="px-1 pb-1">
            <Divider className="mb-2" />
            <NavItem
              icon={<PenLine className="w-5 h-5" />}
              label="Handwritten Notes"
              subtitle={booxRootPage ? 'Mirrored BOOX notebooks' : 'Dedicated BOOX notebook library'}
              isActive={isHandwritten}
              einkMode={isEink}
              onClick={handleNavigateToHandwritten}
            />
          </div>
        ) : null}

        {/* Sidebar Footer - Removed (now in header) */}
      </nav>

      {/* Resize handle - hidden on mobile */}
      {!isMobile && (
        <ResizeHandle onMouseDown={startResizing} />
      )}

      {/* Settings Modal */}
      {settingsModal.isOpen ? (
        <Suspense fallback={null}>
          <SettingsModal 
            isOpen={settingsModal.isOpen} 
            onClose={closeSettingsModal} 
            initialSection={settingsModal.section}
          />
        </Suspense>
      ) : null}

      {/* Workspace Modals */}
      {createWorkspaceOpen ? (
        <Suspense fallback={null}>
          <CreateWorkspaceModal isOpen={createWorkspaceOpen} onClose={() => setCreateWorkspaceOpen(false)} />
        </Suspense>
      ) : null}

    </aside>
  );
};

export default UnifiedSidebar;
