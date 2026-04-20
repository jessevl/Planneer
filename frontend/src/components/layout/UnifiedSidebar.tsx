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
import { useDeleteConfirmStore } from '@/stores/deleteConfirmStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTabsStore } from '@/stores/tabsStore';
import { selectSidebarCounts } from '@/lib/selectors';
import { getTodayISO, dayjs } from '@/lib/dateUtils';
import { isInboxPlacement, isRootLevel } from '@/lib/treeUtils';
import { cn } from '@/lib/design-system';
import { FLOATING_PANEL_GUTTER_PX, getFloatingPanelReserveWidth } from '@/lib/layout';
// Components
import TreeSection, { type TreeNode, type TreeItemConfig } from './TreeSection';
import { Divider, ContextMenu, type ContextMenuItem, ResizeHandle } from '@/components/ui';
import { MobileSheet } from '@/components/ui';
import { ExternalLink, Network, PanelLeftClose, PanelLeftOpen, PenLine, Pin, PinOff } from 'lucide-react';
import { 
  HomeIcon, 
  InboxIcon,
  PagesIcon, 
  CheckIcon, 
  ClockIcon,
  SearchIcon,
} from '../common/Icons';
import ItemIcon from '../common/ItemIcon';
import PageTypeDropdown from '../common/PageTypeDropdown';
import { openCommandPalette } from '@/hooks/useCommandPalette';
import { useMobileLayout } from '@/contexts/MobileLayoutContext';
import { useSplitViewStore } from '@/contexts/SplitViewContext';
import SidebarHeader from './SidebarHeader';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import { usePageOperations } from '@/hooks/usePageOperations';
import { buildPageMenuItems } from '@/hooks/usePageContextMenu';
import { filterOutBooxPages, filterOutBooxTree } from '@/lib/pageUtils';

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
            'relative flex h-9 w-9 items-center justify-center rounded-[1.15rem] transition-all duration-200 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-fg)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
          'active:scale-[0.97] hover:-translate-y-0.5',
          isActive
            ? 'glass-item text-[var(--color-text-primary)]'
            : 'glass-item-subtle text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
        )}
      >
        <span className="flex items-center justify-center transition-transform duration-200 group-hover:scale-105 [&_svg]:h-4.25 [&_svg]:w-4.25">{icon}</span>
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
  isHandwritten: boolean;
  shouldShowHandwrittenNav: boolean;
  currentDateLabel: string;
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
  onNavigateToHandwritten: () => void;
  taskFilterFromStore: string | null;
}

interface MainNavigationTileProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  trailing?: React.ReactNode;
}

const NavPill: React.FC<{ tone?: 'neutral' | 'accent' | 'warning' | 'danger'; children: React.ReactNode }> = ({
  tone = 'neutral',
  children,
}) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
      tone === 'neutral' && 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]',
      tone === 'accent' && 'bg-[var(--color-accent-muted)] text-[var(--color-accent-fg)]',
      tone === 'warning' && 'bg-amber-500/14 text-amber-700 dark:text-amber-300',
      tone === 'danger' && 'bg-red-500/14 text-red-700 dark:text-red-300'
    )}
  >
    {children}
  </span>
);

const MainNavigationTile: React.FC<MainNavigationTileProps> = ({
  icon,
  label,
  isActive,
  onClick,
  trailing,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'group flex flex-row items-center gap-2 rounded-[16px] border px-2 py-1.5 text-left transition-all duration-200',
      isActive
        ? 'border-[var(--color-border-emphasis)] bg-[color-mix(in_srgb,var(--color-accent-muted)_80%,transparent)] shadow-[0_18px_34px_-28px_rgba(15,23,42,0.48)]'
        : 'border-[var(--color-border-default)]/75 bg-[color-mix(in_srgb,var(--color-surface-base)_88%,transparent)] hover:border-[var(--color-border-emphasis)] hover:bg-[var(--color-surface-secondary)]'
    )}
  >
    <span className={cn(
      'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105',
      isActive
        ? 'bg-[var(--color-accent-muted)] text-[var(--color-accent-fg)]'
        : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]'
    )}>
      <span className="[&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[12.5px] font-semibold leading-tight text-[var(--color-text-primary)]">{label}</span>
      {trailing ? <span className="mt-0.5 flex items-center gap-1 leading-none">{trailing}</span> : null}
    </span>
  </button>
);

const MainNavigation: React.FC<MainNavigationProps> = React.memo(({
  isHome,
  isPages,
  isGraph,
  isTasks,
  isHandwritten,
  shouldShowHandwrittenNav,
  currentDateLabel,
  pagesEditedRecently,
  sidebarCounts,
  onNavigateToHome,
  onNavigateToPages,
  onNavigateToGraph,
  onNavigateToTasks,
  onNavigateToHandwritten,
  taskFilterFromStore,
}) => {
  const { tabsEnabled, homeContextMenu, pagesContextMenu, graphContextMenu, tasksContextMenu } = usePrimaryNavContextMenus(taskFilterFromStore);

  const items: Array<MainNavigationTileProps & { key: string; contextMenuItems?: ContextMenuItem[] }> = [
    {
      key: 'home',
      icon: <HomeIcon className="w-5 h-5" />,
      label: 'Home',
      isActive: isHome,
      onClick: onNavigateToHome,
      trailing: <span className="text-[11px] font-medium text-[var(--color-text-tertiary)]">{currentDateLabel}</span>,
      contextMenuItems: homeContextMenu,
    },
    {
      key: 'search',
      icon: <SearchIcon className="w-5 h-5" />,
      label: 'Search',
      isActive: false,
      onClick: openCommandPalette,
      trailing: (
        <kbd className="inline-flex items-center gap-0.5 rounded-full bg-[var(--color-surface-secondary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-disabled)]">
          {typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘' : 'Ctrl'}K
        </kbd>
      ),
    },
    {
      key: 'pages',
      icon: <PagesIcon className="w-5 h-5" />,
      label: 'Pages',
      isActive: isPages,
      onClick: onNavigateToPages,
      trailing: <span className="text-[11px] font-medium text-[var(--color-text-tertiary)]">{pagesEditedRecently} in 7D</span>,
      contextMenuItems: pagesContextMenu,
    },
    {
      key: 'tasks',
      icon: <CheckIcon className="w-5 h-5" />,
      label: 'Tasks',
      isActive: isTasks,
      onClick: onNavigateToTasks,
      trailing: (
        sidebarCounts.overdueCount > 0
          ? <NavPill tone="danger">{sidebarCounts.overdueCount} late</NavPill>
          : sidebarCounts.todayCount > 0
            ? <NavPill tone="warning">{sidebarCounts.todayCount} today</NavPill>
            : <NavPill>{sidebarCounts.allCount}</NavPill>
      ),
      contextMenuItems: tasksContextMenu,
    },
    {
      key: 'graph',
      icon: <Network className="w-5 h-5" />,
      label: 'Graph',
      isActive: isGraph,
      onClick: onNavigateToGraph,
      trailing: <span className="text-[11px] font-medium text-[var(--color-text-tertiary)]">Explore</span>,
      contextMenuItems: graphContextMenu,
    },
  ];

  if (shouldShowHandwrittenNav) {
    items.push({
      key: 'handwritten',
      icon: <PenLine className="w-5 h-5" />,
      label: 'BOOX',
      isActive: isHandwritten,
      onClick: onNavigateToHandwritten,
      trailing: <span className="text-[11px] font-medium text-[var(--color-text-tertiary)]">notes</span>,
    });
  }
  
  return (
    <nav className="mb-2 grid grid-cols-2 gap-2">
      {items.map(({ key, contextMenuItems, ...tileProps }) => {
        const tile = <MainNavigationTile key={key} {...tileProps} />;
        return contextMenuItems && contextMenuItems.length > 0 ? (
          <ContextMenu key={key} items={contextMenuItems} disabled={!tabsEnabled}>
            {tile}
          </ContextMenu>
        ) : (
          <React.Fragment key={key}>{tile}</React.Fragment>
        );
      })}
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
  const treeScrollRef = useRef<HTMLDivElement>(null);
  const dragScrollAnimRef = useRef<number | null>(null);
  
  // Settings modal from global UI store
  const settingsModal = useUIStore(s => s.settingsModal);
  const openSettingsModal = useUIStore(s => s.openSettingsModal);
  const closeSettingsModal = useUIStore(s => s.closeSettingsModal);
  
  // Mobile detection - on mobile, sidebar should be full-width inside MobileDrawer
  const isMobile = useIsMobile();
  const isRail = !isMobile && mode === 'rail';
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
  const isInbox = currentPath === '/inbox';
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
  // DRAG-SCROLL FOR SIDEBAR TREE
  // ============================================================================
  // Uses a global dragover listener + continuous rAF loop so scrolling works
  // regardless of which child element the cursor is over (no bubbling dependency).
  useEffect(() => {
    const ZONE = 64;  // px from edge to start scrolling
    const SPEED = 10; // max px per frame

    let scrollSpeed = 0;

    const onDragOver = (e: DragEvent) => {
      const el = treeScrollRef.current;
      if (!el) { scrollSpeed = 0; return; }

      const { top, bottom, left, right } = el.getBoundingClientRect();

      // Only scroll when cursor is horizontally within the sidebar panel
      if (e.clientX < left || e.clientX > right) {
        scrollSpeed = 0;
        return;
      }

      if (e.clientY < top + ZONE) {
        const ratio = Math.max((ZONE - (e.clientY - top)) / ZONE, 0.15);
        scrollSpeed = -SPEED * ratio;
      } else if (e.clientY > bottom - ZONE) {
        const ratio = Math.max((ZONE - (bottom - e.clientY)) / ZONE, 0.15);
        scrollSpeed = SPEED * ratio;
      } else {
        scrollSpeed = 0;
      }
    };

    const stopScroll = () => { scrollSpeed = 0; };

    const tick = () => {
      if (scrollSpeed !== 0 && treeScrollRef.current) {
        treeScrollRef.current.scrollTop += scrollSpeed;
      }
      dragScrollAnimRef.current = requestAnimationFrame(tick);
    };

    dragScrollAnimRef.current = requestAnimationFrame(tick);
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('dragend', stopScroll);
    document.addEventListener('drop', stopScroll);

    return () => {
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('dragend', stopScroll);
      document.removeEventListener('drop', stopScroll);
      if (dragScrollAnimRef.current !== null) {
        cancelAnimationFrame(dragScrollAnimRef.current);
        dragScrollAnimRef.current = null;
      }
    };
  }, []);

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

  const handleNavigateToInbox = useCallback(() => {
    const canNavigate = requestNavigation({ type: 'view', target: 'pages' });
    if (canNavigate) {
      closeDrawer();
      navigate({ to: '/inbox' });
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
    if (updates.showChildrenInSidebar !== undefined) pageUpdates.showChildrenInSidebar = updates.showChildrenInSidebar;
    if (updates.viewMode) {
      pageUpdates.viewMode = updates.viewMode as PageViewMode;
    }
    if (Object.keys(pageUpdates).length > 0) {
      updatePage(pageId, pageUpdates);
    }
  }, [pagesById, movePage, setExpanded, updatePage]);

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

  const handleReparentPage = useCallback((pageId: string, newParentId: string | null) => {
    if (newParentId !== null && pageId === newParentId) return;
    if (newParentId === null) {
      // Drop to root level of the tree
      movePage(pageId, null, { isTopLevel: true });
      return;
    }
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
  const shouldShowHandwrittenNav = true;
  const selectedPage = selectedPageId ? pagesById[selectedPageId] : null;
  const selectedPageIsInbox = selectedPage ? isInboxPlacement(selectedPage.parentId, selectedPage.isTopLevel) : false;
  // Pages tile is active only on the /pages index, not when viewing a specific page
  const pagesNavActive = isPages && !selectedPageId;
  const inboxNavActive = isInbox || selectedPageIsInbox;
  const recentPagesCount = useSettingsStore((state) => state.sidebar.recentPagesCount);
  const isEink = useSettingsStore((state) => state.einkMode);
  const recentOpenedPageIds = useNavigationStore((state) => state.recentOpenedPageIds);
  const recordOpenedPage = useNavigationStore((state) => state.recordOpenedPage);
  const userPageCount = useMemo(
    () => pages.filter((page) => !page.isDailyNote && page.sourceOrigin !== 'boox').length,
    [pages],
  );
  const inboxPages = useMemo(
    () => pages.filter((page) => !page.isDailyNote && page.sourceOrigin !== 'boox' && isInboxPlacement(page.parentId, page.isTopLevel)),
    [pages],
  );
  const handwrittenNotebookCount = useMemo(
    () => pages.filter((page) => page.sourceOrigin === 'boox' && page.sourceItemType === 'notebook').length,
    [pages],
  );
  const currentDateLabel = useMemo(() => dayjs(todayISO).format('ddd, MMM D'), [todayISO]);
  const activeRecentPageId = selectedPageId || selectedTaskPageId;

  useEffect(() => {
    if (!activeRecentPageId) {
      return;
    }

    const page = pagesById[activeRecentPageId];
    if (!page || page.isDailyNote || page.sourceOrigin === 'boox') {
      return;
    }

    recordOpenedPage(activeRecentPageId);
  }, [activeRecentPageId, pagesById, recordOpenedPage]);

  const recentPages = useMemo(
    () => recentOpenedPageIds
      .map((pageId: string) => pagesById[pageId])
      .filter((page: Page | undefined): page is Page => !!page && !page.isDailyNote && page.sourceOrigin !== 'boox')
      .slice(0, recentPagesCount),
    [pagesById, recentOpenedPageIds, recentPagesCount],
  );



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
      isReadOnly: n.isReadOnly,
    })), [pages]);

  const railPages = useMemo(
    () => pages
      .filter((page) => !page.isDailyNote && page.sourceOrigin !== 'boox' && page.isTopLevel && isRootLevel(page.parentId))
      .sort((a, b) => a.order - b.order || (a.title || '').localeCompare(b.title || ''))
      .slice(0, 18)
      .map((n): SidebarPage => ({
        id: n.id,
        title: n.title,
        icon: n.icon,
        color: n.color,
        parentId: n.parentId,
        viewMode: n.viewMode,
        childCount: n.childCount,
        showChildrenInSidebar: n.showChildrenInSidebar,
        isReadOnly: n.isReadOnly,
      })),
    [pages],
  );
  const railRecentPages = useMemo(
    () => recentPages.slice(0, 4),
    [recentPages],
  );
  const handleCreateInboxPage = useCallback((viewMode?: PageViewMode) => {
    handleCreateChildPage(null, viewMode);
  }, [handleCreateChildPage]);

  // Inbox drop target state and handlers
  const [inboxDropActive, setInboxDropActive] = useState(false);

  const handleInboxDragOver = useCallback((e: React.DragEvent) => {
    // Accept page drops from tree or collection views
    const hasPageData = e.dataTransfer.types.includes('text/plain') || e.dataTransfer.types.includes('pageid');
    if (!hasPageData) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setInboxDropActive(true);
  }, []);

  const handleInboxDragLeave = useCallback((e: React.DragEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    const currentTarget = e.currentTarget as HTMLElement;
    if (!currentTarget.contains(relatedTarget)) {
      setInboxDropActive(false);
    }
  }, []);

  const handleInboxDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setInboxDropActive(false);
    const draggedId = e.dataTransfer.getData('text/plain');
    if (!draggedId) return;
    // Move to inbox: parentId=null, isTopLevel=false
    movePage(draggedId, null, { isTopLevel: false });
  }, [movePage]);

  const inboxTreeLink = (
    <div
      onClick={handleNavigateToInbox}
      onDragOver={handleInboxDragOver}
      onDragLeave={handleInboxDragLeave}
      onDrop={handleInboxDrop}
      style={{ paddingLeft: '12px' }}
      className={cn(
        'group flex w-full items-center gap-1.5 rounded-lg pr-1.5 py-1.5 text-left text-sm font-medium transition-all outline-none cursor-pointer',
        inboxDropActive && 'bg-green-100 dark:bg-green-900/30 ring-2 ring-green-500',
        isEink && !inboxDropActive
          ? cn(
              'eink-expanded-sidebar-item border border-transparent bg-transparent shadow-none',
              inboxNavActive
                ? 'eink-expanded-sidebar-item-active text-[var(--color-text-primary)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            )
          : !inboxDropActive && cn(
              inboxNavActive && 'glass-item text-[var(--color-text-primary)]',
              !inboxNavActive && 'glass-item-subtle text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            )
      )}
    >
      <InboxIcon className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1 text-left truncate">Inbox</span>
      {inboxPages.length > 0 && (
        <span className="text-xs text-[var(--color-text-secondary)] flex-shrink-0">
          {inboxPages.length}
        </span>
      )}
      {/* Hover actions - matches TreeSidebarItem pattern */}
      <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex items-center gap-0.5 flex-shrink-0 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <PageTypeDropdown
          onSelect={handleCreateInboxPage}
          title="Add page to inbox"
          size="sm"
          align="right"
          triggerClassName="flex items-center justify-center w-5 h-5 rounded hover:bg-[var(--color-surface-inset)] transition-all"
        />
      </div>
    </div>
  );

  const getRailPageContextMenuItems = useCallback((page: SidebarPage): ContextMenuItem[] => {
    const showChildren = page.showChildrenInSidebar ?? (page.viewMode === 'note');
    const pageChildCount = page.childCount ?? 0;
    const taskCount = page.viewMode === 'tasks' ? countTasksForPage(page.id) : 0;
    const totalChildCount = pageChildCount + taskCount;

    return buildPageMenuItems({
      isMultiSelect: false,
      selectionCount: 1,
      tabsEnabled,
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
      onToggleShowChildren: () => handleUpdatePage(page.id, { showChildrenInSidebar: !showChildren }),
      onMoveTo: () => {
        useUIStore.getState().openPageMovePicker(page.id, page.title || 'Untitled');
      },
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
  }, [countTasksForPage, deletePage, handleCreateChildPage, handleCreateTask, handleUpdatePage, migrateTasksToInbox, requestDelete, tabsEnabled]);

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
        <div className="flex flex-1 flex-col items-center gap-1 overflow-x-hidden overflow-y-hidden">
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
            icon={<SearchIcon />}
            label="Search"
            onClick={openCommandPalette}
          />

          <div className="my-1 h-px w-7 bg-[var(--color-border-default)]/70" />

          <SidebarRailButton icon={<HomeIcon />} label="Home" isActive={isHome} onClick={handleNavigateToHome} contextMenuItems={homeContextMenu} />
          <SidebarRailButton icon={<PagesIcon />} label="All pages" isActive={pagesNavActive} onClick={handleNavigateToPages} contextMenuItems={pagesContextMenu} />
          <SidebarRailButton icon={<CheckIcon />} label="Tasks" isActive={isTasks} onClick={handleNavigateToTasks} contextMenuItems={tasksContextMenu} />
          <SidebarRailButton icon={<Network />} label="Graph" isActive={isGraph} onClick={handleNavigateToGraph} contextMenuItems={graphContextMenu} />
          {shouldShowHandwrittenNav ? (
            <SidebarRailButton
              icon={<PenLine />}
              label="Handwritten notes"
              isActive={isHandwritten}
              onClick={handleNavigateToHandwritten}
            />
          ) : null}

          <div className="my-1 h-px w-7 bg-[var(--color-border-default)]/70" />

          <div className="flex min-h-0 flex-1 w-full flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 w-full flex-col items-center gap-1 overflow-x-hidden overflow-y-auto pb-1 scrollbar-thin">
              <SidebarRailButton
                icon={<InboxIcon />}
                label={`Inbox${inboxPages.length > 0 ? ` (${inboxPages.length})` : ''}`}
                isActive={inboxNavActive}
                onClick={handleNavigateToInbox}
              />

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

            {railRecentPages.length > 0 ? (
              <div className="mt-auto flex w-full flex-col items-center gap-1 border-t border-[var(--color-border-default)]/70 px-1 pt-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)]" title="Recently opened pages">
                  <ClockIcon className="h-3 w-3" />
                </span>
                {railRecentPages.map((page) => (
                  <SidebarRailButton
                    key={`recent-${page.id}`}
                    icon={<ItemIcon type={page.viewMode === 'tasks' ? 'tasks' : page.viewMode === 'collection' ? 'collection' : 'note'} icon={page.icon || undefined} color={page.color} size="md" className="scale-110" />}
                    label={`Recent: ${page.title || 'Untitled'}`}
                    isActive={page.id === (selectedPageId || selectedTaskPageId)}
                    showTooltip={false}
                    onClick={() => handleSelectPage(page.id)}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-auto flex flex-col items-center gap-1 pt-1">
            <SidebarHeader
              triggerVariant="rail"
              onCreateWorkspace={() => setCreateWorkspaceOpen(true)}
              onOpenSettings={(section) => {
                openSettingsModal(section);
              }}
            />
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
          <div className="px-1 pb-2 pt-3 flex-shrink-0">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setSidebarVisible(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-border-default)]/75 bg-transparent text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-emphasis)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]"
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="h-4.5 w-4.5" />
              </button>
              <button
                type="button"
                onClick={() => setSidebarPinned(!sidebarPinned)}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl border transition-[background-color,border-color,color,box-shadow]',
                  sidebarPinned
                    ? 'border-[var(--color-border-emphasis)] bg-[color-mix(in_srgb,var(--color-accent-muted)_78%,transparent)] text-[var(--color-text-primary)] shadow-[0_14px_32px_-26px_rgba(15,23,42,0.45)]'
                    : 'border-[var(--color-border-default)]/75 bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border-emphasis)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]'
                )}
                aria-label={sidebarPinned ? 'Unpin sidebar' : 'Pin sidebar'}
                title={sidebarPinned ? 'Unpin sidebar' : 'Pin sidebar'}
              >
                {sidebarPinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Main Navigation - Home always shown, others hidden on mobile (moved to FAB) */}
        <div className="px-1">
          <MainNavigation 
          isHome={isHome}
          isPages={pagesNavActive}
          isGraph={isGraph}
          isTasks={isTasks}
          isHandwritten={isHandwritten}
          shouldShowHandwrittenNav={shouldShowHandwrittenNav}
          currentDateLabel={currentDateLabel}
          pagesEditedRecently={pagesEditedRecently}
          sidebarCounts={sidebarCounts}
          onNavigateToHome={handleNavigateToHome}
          onNavigateToPages={handleNavigateToPages}
          onNavigateToGraph={handleNavigateToGraph}
          onNavigateToTasks={handleNavigateToTasks}
          onNavigateToHandwritten={handleNavigateToHandwritten}
          taskFilterFromStore={taskFilterFromStore}
        />
        </div>

        <Divider className="my-1.5" />

        <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${isMobile ? 'pb-32' : ''}`}>
          <div
            ref={treeScrollRef}
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin"
          >
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
            prefixContent={inboxTreeLink}
          />
          </div>

          {recentPages.length > 0 ? (
            <section className="mt-auto border-t border-[var(--color-border-default)]/70 px-1 pt-3">
              <div className="mb-2 flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                <ClockIcon className="h-3.5 w-3.5" />
                <span>Recently opened</span>
              </div>
              <div className="flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin">
                {recentPages.map((page) => {
                  const parentLabel = isInboxPlacement(page.parentId, page.isTopLevel)
                    ? 'Inbox'
                    : page.parentId
                      ? (pagesById[page.parentId]?.title || 'Nested page')
                      : 'Top level';

                  return (
                    <button
                      key={`recent-${page.id}`}
                      type="button"
                      onClick={() => handleSelectPage(page.id)}
                      className={cn(
                        'flex w-[60px] min-w-[60px] flex-col items-center gap-1 rounded-xl border px-1.5 py-1.5 text-center transition-all',
                        page.id === (selectedPageId || selectedTaskPageId)
                          ? 'glass-item border-[var(--color-border-emphasis)] text-[var(--color-text-primary)]'
                          : 'glass-item-subtle border-[var(--color-border-default)]/70 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                      )}
                      title={`${page.title || 'Untitled'} • ${parentLabel}`}
                    >
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
                        <ItemIcon
                          type={page.viewMode === 'tasks' ? 'tasks' : page.viewMode === 'collection' ? 'collection' : 'note'}
                          icon={page.icon || undefined}
                          color={page.color}
                          size="sm"
                        />
                      </span>
                      <span className="w-full truncate text-[10px] font-medium leading-tight">{page.title || 'Untitled'}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>

        <div className="px-1 pb-1 pt-2 flex-shrink-0">
          <Divider className="mb-2" />
          <SidebarHeader
            onCreateWorkspace={() => setCreateWorkspaceOpen(true)}
            onOpenSettings={(section) => {
              openSettingsModal(section);
            }}
          />
        </div>
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
