/**
 * @file TabBar.tsx
 * @description Browser-style tab bar component
 * @app SHARED - Displays tabs at the top of the main content area
 *
 * Features:
 * - Chrome-like tab appearance with curved corners
 * - Tabs shrink when space is limited (min-width enforced)
 * - Close button on each tab (except pinned)
 * - Context menu for tab actions
 * - Drag to reorder tabs
 * - Visual connection between active tab and content (no border between)
 * - Horizontal scrolling when many tabs
 * - Close all tabs button
 * - Custom page icons and colors
 *
 * Design:
 * - Active tab extends into content area (connected feel)
 * - Inactive tabs have subtle background
 * - Smooth transitions on hover/active states
 * - Aligned with content pane (no visual barrier)
 */
'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { X, Home, FileText, ListTodo, Settings, Pin, XCircle, Plus } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useTabsStore, selectOrderedTabs, type Tab } from '@/stores/tabsStore';
import { useSettingsStore, type TabRetentionPolicy } from '@/stores/settingsStore';
import { usePagesStore } from '@/stores/pagesStore';
import { ContextMenu, type ContextMenuItem } from '@/components/ui';
import ItemIcon from '@/components/common/ItemIcon';
import { cn } from '@/lib/design-system';

const TAB_MIN_WIDTH = 100;
const TAB_MAX_WIDTH = 200;
const TAB_HEIGHT = 36;

interface TabBarProps {
  className?: string;
}

/**
 * Get the icon for a tab - uses custom icon/color for pages, system icons for others
 */
const getTabIcon = (tab: Tab) => {
  // For pages with custom icons, use ItemIcon component
  if (tab.type === 'page' && (tab.icon || tab.pageId)) {
    return (
      <ItemIcon 
        icon={tab.icon || null} 
        color={tab.color || null} 
        type="note" 
        size="sm"
        className="flex-shrink-0" 
      />
    );
  }

  // Check if tab has emoji icon
  if (tab.icon) {
    if (tab.icon.length <= 2 || /\p{Emoji}/u.test(tab.icon)) {
      return <span className="text-sm">{tab.icon}</span>;
    }
  }

  switch (tab.type) {
    case 'home':
      return <Home className="w-4 h-4" />;
    case 'page':
      return <FileText className="w-4 h-4" />;
    case 'pages':
      return <FileText className="w-4 h-4" />;
    case 'tasks':
      return <ListTodo className="w-4 h-4" />;
    case 'settings':
      return <Settings className="w-4 h-4" />;
    default:
      return <FileText className="w-4 h-4" />;
  }
};

const TabItem: React.FC<{
  tab: Tab;
  isActive: boolean;
  onClose: () => void;
  onClick: () => void;
  style?: React.CSSProperties;
  showPinOption?: boolean;
}> = React.memo(({ tab, isActive, onClose, onClick, style, showPinOption = true }) => {
  const { closeOtherTabs, togglePinTab } = useTabsStore(
    useShallow((s) => ({
      closeOtherTabs: s.closeOtherTabs,
      togglePinTab: s.togglePinTab,
    }))
  );

  const contextMenuItems: ContextMenuItem[] = [];

  // Only show pin option when retention policy is 'pinned-only'
  if (showPinOption) {
    contextMenuItems.push({
      id: 'pin',
      label: 'Pinned',
      icon: <Pin className="w-4 h-4" />,
      toggled: !!tab.pinned,
      onClick: () => togglePinTab(tab.id),
    });
  }

  contextMenuItems.push(
    {
      id: 'close',
      label: 'Close tab',
      icon: <X className="w-4 h-4" />,
      onClick: onClose,
      disabled: tab.pinned,
      divider: contextMenuItems.length > 0,
    },
    {
      id: 'close-others',
      label: 'Close other tabs',
      icon: <X className="w-4 h-4" />,
      onClick: () => closeOtherTabs(tab.id),
    }
  );

  return (
    <ContextMenu items={contextMenuItems}>
      <div
        className={cn(
          'tab-item group relative flex items-center gap-2 px-3 cursor-pointer select-none',
          'transition-all duration-150 ease-out',
          'rounded-full',
          // Active tab - glass effect like sidebar items
          isActive && 'glass-item z-10',
          // Inactive tabs - visible background with glass on hover
          !isActive && 'glass-item-tab',
          !isActive && 'opacity-80 hover:opacity-100'
        )}
        style={{
          ...style,
          height: TAB_HEIGHT,
          minWidth: TAB_MIN_WIDTH,
          maxWidth: TAB_MAX_WIDTH,
        }}
        onClick={onClick}
        onAuxClick={(e) => {
          if (e.button === 1 && !tab.pinned) {
            e.preventDefault();
            onClose();
          }
        }}
      >
        {tab.pinned && (
          <Pin className="w-3 h-3 text-[var(--color-text-tertiary)] flex-shrink-0" />
        )}

        <span
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-4 w-4',
            isActive
              ? 'text-[var(--color-text-primary)]'
              : 'text-[var(--color-text-secondary)]'
          )}
        >
          {getTabIcon(tab)}
        </span>

        <span
          className={cn(
            'flex-1 truncate text-sm leading-none',
            isActive
              ? 'text-[var(--color-text-primary)] font-medium'
              : 'text-[var(--color-text-secondary)]'
          )}
        >
          {tab.title}
        </span>

        {!tab.pinned && (
          <button
            className={cn(
              'flex-shrink-0 p-0.5 rounded-sm',
              'opacity-0 group-hover:opacity-100',
              'hover:bg-[var(--color-surface-tertiary)]',
              'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
              'transition-opacity'
            )}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </ContextMenu>
  );
});

TabItem.displayName = 'TabItem';

export const TabBar: React.FC<TabBarProps> = ({ className }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [tabWidth, setTabWidth] = useState(TAB_MAX_WIDTH);

  const orderedTabs = useTabsStore(useShallow(selectOrderedTabs));
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const tabs = useTabsStore((s) => s.tabs);
  const { setActiveTab, closeTab, closeAllTabs, updateTab } = useTabsStore(
    useShallow((s) => ({
      setActiveTab: s.setActiveTab,
      closeTab: s.closeTab,
      closeAllTabs: s.closeAllTabs,
      updateTab: s.updateTab,
    }))
  );
  
  const tabRetentionPolicy = useSettingsStore((s) => s.tabRetentionPolicy);
  const showPinOption = tabRetentionPolicy === 'pinned-only';
  
  // Check if there are any closeable (non-pinned) tabs
  const hasCloseableTabs = orderedTabs.some((t) => !t.pinned);

  // Sync active tab when route changes - update tab content for page navigation
  useEffect(() => {
    const path = location.pathname;
    
    // Check if we're on a page route
    const pageMatch = path.match(/^\/pages\/(.+)$/);
    if (pageMatch) {
      const pageId = pageMatch[1];
      
      // First check if there's already a tab for this page
      const existingTab = tabs.find((t) => t.pageId === pageId);
      if (existingTab) {
        // Switch to existing tab
        if (existingTab.id !== activeTabId) {
          setActiveTab(existingTab.id);
        }
        return;
      }
      
      // No existing tab - update the active tab to show this page
      const activeTab = tabs.find((t) => t.id === activeTabId);
      if (activeTab && !activeTab.pinned) {
        // Get page data from store
        const pagesById = usePagesStore.getState().pagesById;
        const page = pagesById[pageId];
        if (page) {
          updateTab(activeTab.id, {
            title: page.title || 'Untitled',
            icon: page.icon,
            color: page.color,
            path: `/pages/${pageId}`,
            pageId: pageId,
            type: 'page',
          });
        }
      }
      return;
    }
    
    // For non-page routes (home, pages, tasks, settings)
    // Determine route type and metadata
    let routeType: 'home' | 'pages' | 'tasks' | 'settings' | 'page' = 'home';
    let routeTitle = 'Home';
    
    if (path === '/' || path === '/home') {
      routeType = 'home';
      routeTitle = 'Home';
    } else if (path === '/pages') {
      routeType = 'pages';
      routeTitle = 'Pages';
    } else if (path === '/tasks' || path.startsWith('/tasks/')) {
      routeType = 'tasks';
      routeTitle = 'Tasks';
    } else if (path === '/settings') {
      routeType = 'settings';
      routeTitle = 'Settings';
    }
    
    // First check if there's already a tab for this route
    const existingTab = tabs.find((t) => {
      // Exact path match
      if (t.path === path) return true;
      // Home route variants
      if ((path === '/' && t.path === '/home') || (path === '/home' && t.path === '/')) return true;
      // Tasks route - match any /tasks/* path to a tasks type tab
      if (routeType === 'tasks' && t.type === 'tasks') return true;
      return false;
    });
    if (existingTab) {
      if (existingTab.id !== activeTabId) {
        setActiveTab(existingTab.id);
      }
      // Update the tasks tab path to current filter
      if (routeType === 'tasks' && existingTab.path !== path) {
        updateTab(existingTab.id, { path });
      }
      return;
    }
    
    // No existing tab - update the active tab if it's not pinned
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (activeTab && !activeTab.pinned) {
      updateTab(activeTab.id, {
        title: routeTitle,
        icon: undefined,
        color: undefined,
        path: path === '/home' ? '/' : path,
        pageId: undefined,
        type: routeType,
      });
    }
  }, [location.pathname, tabs, activeTabId, setActiveTab, updateTab]);

  // Sync tab titles/icons/colors when pagesStore changes (e.g. page rename)
  useEffect(() => {
    const unsubscribe = usePagesStore.subscribe((state, prevState) => {
      // Also check draftTitle for immediate feedback while typing
      const { tabs: currentTabs } = useTabsStore.getState();
      for (const tab of currentTabs) {
        if (!tab.pageId || tab.type !== 'page') continue;
        
        const page = state.pagesById[tab.pageId];
        const prevPage = prevState.pagesById[tab.pageId];
        
        // Check if title/icon/color changed in pagesById
        if (page && prevPage && (
          page.title !== prevPage.title ||
          page.icon !== prevPage.icon ||
          page.color !== prevPage.color
        )) {
          updateTab(tab.id, {
            title: page.title || 'Untitled',
            icon: page.icon,
            color: page.color,
          });
        }
        
        // Also check draftTitle for the active page (immediate feedback while typing)
        if (tab.pageId === state.activePageId && state.draftTitle !== prevState.draftTitle) {
          updateTab(tab.id, { title: state.draftTitle || 'Untitled' });
        }
      }
    });
    return unsubscribe;
  }, [updateTab]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateTabWidth = () => {
      const containerWidth = container.clientWidth - 48;
      const tabCount = orderedTabs.length;

      if (tabCount === 0) {
        setTabWidth(TAB_MAX_WIDTH);
        return;
      }

      const idealWidth = containerWidth / tabCount;
      const clampedWidth = Math.max(TAB_MIN_WIDTH, Math.min(TAB_MAX_WIDTH, idealWidth));
      setTabWidth(clampedWidth);
    };

    updateTabWidth();

    const resizeObserver = new ResizeObserver(updateTabWidth);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [orderedTabs.length]);

  const handleTabClick = useCallback(
    (tab: Tab) => {
      setActiveTab(tab.id);
      navigate({ to: tab.path });
    },
    [navigate, setActiveTab]
  );

  const handleTabClose = useCallback(
    (tabId: string) => {
      const state = useTabsStore.getState();
      const isActive = state.activeTabId === tabId;
      const nextTabId = state.getNextActiveTab(tabId);

      closeTab(tabId);

      if (isActive && nextTabId) {
        const nextTab = state.tabs.find((t) => t.id === nextTabId);
        if (nextTab) {
          navigate({ to: nextTab.path });
        }
      }
    },
    [closeTab, navigate]
  );

  const handleCloseAllTabs = useCallback(() => {
    const state = useTabsStore.getState();
    closeAllTabs();
    
    // Navigate to first pinned tab or home
    const newState = useTabsStore.getState();
    if (newState.activeTabId) {
      const activeTab = newState.tabs.find((t) => t.id === newState.activeTabId);
      if (activeTab) {
        navigate({ to: activeTab.path });
      }
    } else {
      navigate({ to: '/' });
    }
  }, [closeAllTabs, navigate]);

  const handleNewTab = useCallback(() => {
    const { openTab } = useTabsStore.getState();
    const newTabId = openTab(
      {
        title: 'Home',
        path: '/',
        type: 'home',
      },
      { allowDuplicate: true }
    );
    navigate({ to: '/' });
  }, [navigate]);

  if (orderedTabs.length === 0) return null;

  return (
    <div className="flex flex-col">
      <div
        ref={containerRef}
        className={cn(
          'tab-bar flex items-center gap-1 pr-2 pb-1.5 pt-0',
          className
        )}
      >
      <div className="flex items-center scrollbar-hide gap-1 flex-shrink min-w-0">
        {orderedTabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onClick={() => handleTabClick(tab)}
            onClose={() => handleTabClose(tab.id)}
            style={{ width: tabWidth }}
            showPinOption={showPinOption}
          />
        ))}
        
        {/* New tab button - positioned right after the last tab */}
        <button
          onClick={handleNewTab}
          className={cn(
            'flex-shrink-0 p-1.5 rounded-md ml-1',
            'text-[var(--color-text-tertiary)]',
            'hover:text-[var(--color-text-primary)]',
            'hover:bg-[var(--color-surface-tertiary)]',
            'transition-colors'
          )}
          title="New tab"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      
      {/* Close all tabs button */}
      {hasCloseableTabs && (
        <button
          onClick={handleCloseAllTabs}
          className={cn(
            'flex-shrink-0 p-2.5 rounded-md',
            'text-[var(--color-text-tertiary)]',
            'hover:text-[var(--color-text-primary)]',
            'hover:bg-[var(--color-surface-tertiary)]',
            'transition-colors'
          )}
          title="Close all tabs"
        >
          <XCircle className="w-4 h-4" />
        </button>
      )}
    </div>
    </div>
  );
};

export default TabBar;
