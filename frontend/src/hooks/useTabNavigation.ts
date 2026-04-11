/**
 * @file useTabNavigation.ts
 * @description Hook for tab-aware navigation
 * @app SHARED - Provides tab operations for context menus and navigation
 *
 * Features:
 * - Open pages/items in new tabs
 * - Navigate within tabs when tabs are enabled
 * - Sync tabs with current route
 * - Update tab titles when page titles change
 */
import { useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { useTabsStore } from '@/stores/tabsStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePagesStore } from '@/stores/pagesStore';

export interface UseTabNavigationReturn {
  tabsEnabled: boolean;
  openPageInNewTab: (pageId: string, title: string, icon?: string | null, color?: string | null) => void;
  openTasksInNewTab: (filter?: string) => void;
  openPagesInNewTab: () => void;
  navigateToPage: (pageId: string, title: string, icon?: string | null, color?: string | null, forceNewTab?: boolean) => void;
  navigateToHome: () => void;
  navigateToTasks: (filter?: string) => void;
  syncRouteToTab: () => void;
}

export function useTabNavigation(): UseTabNavigationReturn {
  const navigate = useNavigate();
  const location = useLocation();
  const tabsEnabled = useSettingsStore((s) => s.tabsEnabled);
  const openTab = useTabsStore((s) => s.openTab);
  const setActiveTab = useTabsStore((s) => s.setActiveTab);
  const updateTab = useTabsStore((s) => s.updateTab);
  const findTabByPageId = useTabsStore((s) => s.findTabByPageId);
  const tabs = useTabsStore((s) => s.tabs);
  const activeTabId = useTabsStore((s) => s.activeTabId);

  const openPageInNewTab = useCallback(
    (pageId: string, title: string, icon?: string | null, color?: string | null) => {
      const path = `/pages/${pageId}`;
      openTab({
        title,
        path,
        icon,
        color,
        pageId,
        type: 'page',
      });
      navigate({ to: '/pages/$id', params: { id: pageId } });
    },
    [openTab, navigate]
  );

  const openTasksInNewTab = useCallback(
    (filter: string = 'upcoming') => {
      const path = `/tasks/${filter}`;
      const title = filter.charAt(0).toUpperCase() + filter.slice(1);
      openTab({
        title: `Tasks - ${title}`,
        path,
        type: 'tasks',
      });
      navigate({ to: '/tasks/$filter', params: { filter } });
    },
    [openTab, navigate]
  );

  const openPagesInNewTab = useCallback(() => {
    openTab({
      title: 'All Pages',
      path: '/pages',
      type: 'pages',
    });
    navigate({ to: '/pages' });
  }, [openTab, navigate]);

  const navigateToPage = useCallback(
    (pageId: string, title: string, icon?: string | null, color?: string | null, forceNewTab?: boolean) => {
      if (!tabsEnabled) {
        navigate({ to: '/pages/$id', params: { id: pageId } });
        return;
      }

      const existingTab = findTabByPageId(pageId);
      if (existingTab) {
        setActiveTab(existingTab.id);
        navigate({ to: '/pages/$id', params: { id: pageId } });
        return;
      }

      if (forceNewTab) {
        openPageInNewTab(pageId, title, icon, color);
        return;
      }

      // Navigate within the same tab (update active tab content)
      const activeTab = tabs.find((t) => t.id === activeTabId);
      if (activeTab && activeTab.type === 'page') {
        // Update all relevant tab properties to reflect the new page
        updateTab(activeTab.id, { 
          title, 
          icon, 
          color, 
          path: `/pages/${pageId}`,
          pageId 
        });
        navigate({ to: '/pages/$id', params: { id: pageId } });
      } else {
        openPageInNewTab(pageId, title, icon, color);
      }
    },
    [tabsEnabled, findTabByPageId, setActiveTab, navigate, openPageInNewTab, tabs, activeTabId, updateTab]
  );

  const navigateToHome = useCallback(() => {
    if (tabsEnabled) {
      setActiveTab('home');
    }
    navigate({ to: '/' });
  }, [tabsEnabled, setActiveTab, navigate]);

  const navigateToTasks = useCallback(
    (filter: string = 'upcoming') => {
      if (tabsEnabled) {
        const existingTab = tabs.find((t) => t.type === 'tasks' && t.path === `/tasks/${filter}`);
        if (existingTab) {
          setActiveTab(existingTab.id);
        } else {
          openTasksInNewTab(filter);
          return;
        }
      }
      navigate({ to: '/tasks/$filter', params: { filter } });
    },
    [tabsEnabled, tabs, setActiveTab, openTasksInNewTab, navigate]
  );

  // Sync active tab when route changes - update tab content for page navigation
  useEffect(() => {
    if (!tabsEnabled) return;

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
      
      // No existing tab - update the active tab if it's a page tab
      const activeTab = tabs.find((t) => t.id === activeTabId);
      if (activeTab && activeTab.type === 'page') {
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
          });
        }
      }
      return;
    }
    
    // For non-page routes, find matching tab
    const matchingTab = tabs.find((t) => t.path === path);
    if (matchingTab && matchingTab.id !== activeTabId) {
      setActiveTab(matchingTab.id);
    }
  }, [location.pathname, tabsEnabled, tabs, activeTabId, setActiveTab, updateTab]);

  const syncRouteToTab = useCallback(() => {
    if (!tabsEnabled) return;

    const path = location.pathname;
    const matchingTab = tabs.find((t) => {
      if (t.pageId && path.startsWith('/pages/')) {
        return path === `/pages/${t.pageId}`;
      }
      return t.path === path;
    });

    if (matchingTab && matchingTab.id !== activeTabId) {
      setActiveTab(matchingTab.id);
    }
  }, [tabsEnabled, location.pathname, tabs, activeTabId, setActiveTab]);


  useEffect(() => {
    if (!tabsEnabled) return;

    const unsubscribe = usePagesStore.subscribe((state, prevState) => {
      for (const tab of tabs) {
        if (tab.pageId && tab.type === 'page') {
          const page = state.pagesById[tab.pageId];
          const prevPage = prevState.pagesById[tab.pageId];
          if (page && prevPage && (page.title !== prevPage.title || page.icon !== prevPage.icon || page.color !== prevPage.color)) {
            updateTab(tab.id, { title: page.title, icon: page.icon, color: page.color });
          }
        }
      }
    });

    return unsubscribe;
  }, [tabsEnabled, tabs, updateTab]);

  return {
    tabsEnabled,
    openPageInNewTab,
    openTasksInNewTab,
    openPagesInNewTab,
    navigateToPage,
    navigateToHome,
    navigateToTasks,
    syncRouteToTab,
  };
}

export default useTabNavigation;
