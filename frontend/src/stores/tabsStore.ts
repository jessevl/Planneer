/**
 * @file tabsStore.ts
 * @description Tab management store with Zustand
 * @app SHARED - Manages browser-style tabs for multi-page navigation
 *
 * Features:
 * - Open/close tabs
 * - Track active tab
 * - Persist tabs across sessions
 * - Support for different page types (pages, tasks, home)
 * - Tab ordering and reordering
 */
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

/**
 * Represents a single tab
 */
export interface Tab {
  /** Unique identifier for the tab */
  id: string;
  /** Display title for the tab */
  title: string;
  /** Route path for the tab */
  path: string;
  /** Icon for the tab (emoji or lucide icon name) */
  icon?: string | null;
  /** Color for the tab icon (used with page icons) */
  color?: string | null;
  /** Page ID if this tab is for a specific page */
  pageId?: string;
  /** Tab type for styling/behavior */
  type: 'home' | 'page' | 'pages' | 'graph' | 'tasks' | 'settings';
  /** Whether this tab is pinned (cannot be closed) */
  pinned?: boolean;
}

interface TabsState {
  /** All open tabs */
  tabs: Tab[];
  /** Currently active tab ID */
  activeTabId: string | null;
  /** Tab order (array of tab IDs) */
  tabOrder: string[];
}

interface TabsActions {
  /** Open a new tab or switch to existing */
  openTab: (
    tab: Omit<Tab, 'id'> & { id?: string },
    options?: { allowDuplicate?: boolean }
  ) => string;
  /** Close a specific tab */
  closeTab: (tabId: string) => void;
  /** Close all tabs except pinned */
  closeAllTabs: () => void;
  /** Close all tabs except the active one */
  closeOtherTabs: (tabId: string) => void;
  /** Close all tabs to the right of a tab */
  closeTabsToRight: (tabId: string) => void;
  /** Set the active tab */
  setActiveTab: (tabId: string) => void;
  /** Update tab info (title, icon, color, path) */
  updateTab: (tabId: string, updates: Partial<Pick<Tab, 'title' | 'icon' | 'color' | 'path' | 'pageId' | 'type'>>) => void;
  /** Update the active tab with new navigation info */
  updateActiveTab: (updates: Partial<Pick<Tab, 'title' | 'icon' | 'color' | 'path' | 'pageId' | 'type'>>) => void;
  /** Reorder tabs */
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  /** Pin/unpin a tab */
  togglePinTab: (tabId: string) => void;
  /** Clear all tabs and reset to default */
  resetTabs: () => void;
  /** Find tab by page ID */
  findTabByPageId: (pageId: string) => Tab | undefined;
  /** Find tab by path */
  findTabByPath: (path: string) => Tab | undefined;
  /** Get the next tab to activate when closing a tab */
  getNextActiveTab: (closingTabId: string) => string | null;
}

// Generate a unique tab ID
const generateTabId = () => `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Default home tab - not pinned by default
const DEFAULT_HOME_TAB: Tab = {
  id: 'home',
  title: 'Home',
  path: '/',
  type: 'home',
  pinned: false,
};

export const useTabsStore = create<TabsState & TabsActions>()(
  devtools(
    persist(
      (set, get) => ({
        tabs: [DEFAULT_HOME_TAB],
        activeTabId: 'home',
        tabOrder: ['home'],

        openTab: (tabData, options) => {
          const state = get();
          const allowDuplicate = options?.allowDuplicate ?? false;

          // Check if tab with same path already exists (except for pages with pageId)
          let existingTab: Tab | undefined;
          if (!allowDuplicate) {
            if (tabData.pageId) {
              existingTab = state.tabs.find((t) => t.pageId === tabData.pageId);
            } else {
              existingTab = state.tabs.find((t) => t.path === tabData.path && !t.pageId);
            }
          }

          if (existingTab) {
            // Switch to existing tab
            set({ activeTabId: existingTab.id }, false, 'openTab/existing');
            return existingTab.id;
          }

          // Create new tab
          const newTab: Tab = {
            ...tabData,
            id: tabData.id || generateTabId(),
          };

          set(
            (state) => ({
              tabs: [...state.tabs, newTab],
              activeTabId: newTab.id,
              tabOrder: [...state.tabOrder, newTab.id],
            }),
            false,
            'openTab/new'
          );

          return newTab.id;
        },

        closeTab: (tabId) => {
          const state = get();
          const tab = state.tabs.find((t) => t.id === tabId);

          // Don't close pinned tabs
          if (tab?.pinned) return;

          // Don't close if it's the last tab
          if (state.tabs.length <= 1) return;

          const nextActiveId = state.getNextActiveTab(tabId);

          set(
            (state) => ({
              tabs: state.tabs.filter((t) => t.id !== tabId),
              tabOrder: state.tabOrder.filter((id) => id !== tabId),
              activeTabId:
                state.activeTabId === tabId ? nextActiveId : state.activeTabId,
            }),
            false,
            'closeTab'
          );
        },

        closeAllTabs: () => {
          const state = get();
          const pinnedTabs = state.tabs.filter((t) => t.pinned);
          const pinnedIds = pinnedTabs.map((t) => t.id);
          
          // If active tab is pinned, keep it active; otherwise activate first pinned
          const newActiveId = pinnedIds.includes(state.activeTabId!)
            ? state.activeTabId
            : pinnedIds[0] || null;

          set(
            {
              tabs: pinnedTabs,
              tabOrder: state.tabOrder.filter((id) => pinnedIds.includes(id)),
              activeTabId: newActiveId,
            },
            false,
            'closeAllTabs'
          );
        },

        closeOtherTabs: (tabId) => {
          const state = get();
          const keepTabs = state.tabs.filter(
            (t) => t.id === tabId || t.pinned
          );
          const keepIds = keepTabs.map((t) => t.id);

          set(
            {
              tabs: keepTabs,
              tabOrder: state.tabOrder.filter((id) => keepIds.includes(id)),
              activeTabId: tabId,
            },
            false,
            'closeOtherTabs'
          );
        },

        closeTabsToRight: (tabId) => {
          const state = get();
          const tabIndex = state.tabOrder.indexOf(tabId);
          if (tabIndex === -1) return;

          const keepIds = state.tabOrder.slice(0, tabIndex + 1);
          // Also keep pinned tabs
          const pinnedIds = state.tabs
            .filter((t) => t.pinned && !keepIds.includes(t.id))
            .map((t) => t.id);
          const allKeepIds = [...keepIds, ...pinnedIds];

          set(
            (state) => ({
              tabs: state.tabs.filter((t) => allKeepIds.includes(t.id)),
              tabOrder: state.tabOrder.filter((id) => allKeepIds.includes(id)),
              activeTabId: allKeepIds.includes(state.activeTabId!)
                ? state.activeTabId
                : tabId,
            }),
            false,
            'closeTabsToRight'
          );
        },

        setActiveTab: (tabId) => {
          const state = get();
          if (!state.tabs.some((t) => t.id === tabId)) return;
          if (state.activeTabId === tabId) return;
          set({ activeTabId: tabId }, false, 'setActiveTab');
        },

        updateTab: (tabId, updates) => {
          set(
            (state) => ({
              tabs: state.tabs.map((t) =>
                t.id === tabId ? { ...t, ...updates } : t
              ),
            }),
            false,
            'updateTab'
          );
        },

        updateActiveTab: (updates) => {
          const state = get();
          if (!state.activeTabId) return;
          set(
            (state) => ({
              tabs: state.tabs.map((t) =>
                t.id === state.activeTabId ? { ...t, ...updates } : t
              ),
            }),
            false,
            'updateActiveTab'
          );
        },

        reorderTabs: (fromIndex, toIndex) => {
          set(
            (state) => {
              const newOrder = [...state.tabOrder];
              const [moved] = newOrder.splice(fromIndex, 1);
              newOrder.splice(toIndex, 0, moved);
              return { tabOrder: newOrder };
            },
            false,
            'reorderTabs'
          );
        },

        togglePinTab: (tabId) => {
          set(
            (state) => ({
              tabs: state.tabs.map((t) =>
                t.id === tabId ? { ...t, pinned: !t.pinned } : t
              ),
            }),
            false,
            'togglePinTab'
          );
        },

        resetTabs: () => {
          set(
            {
              tabs: [DEFAULT_HOME_TAB],
              activeTabId: 'home',
              tabOrder: ['home'],
            },
            false,
            'resetTabs'
          );
        },

        findTabByPageId: (pageId) => {
          return get().tabs.find((t) => t.pageId === pageId);
        },

        findTabByPath: (path) => {
          return get().tabs.find((t) => t.path === path);
        },

        getNextActiveTab: (closingTabId) => {
          const state = get();
          const currentIndex = state.tabOrder.indexOf(closingTabId);
          if (currentIndex === -1) return state.tabOrder[0] || null;

          // Prefer the tab to the right, then to the left
          if (currentIndex < state.tabOrder.length - 1) {
            return state.tabOrder[currentIndex + 1];
          } else if (currentIndex > 0) {
            return state.tabOrder[currentIndex - 1];
          }
          return null;
        },
      }),
      {
        name: 'planneer-tabs',
        partialize: (state) => ({
          tabs: state.tabs,
          activeTabId: state.activeTabId,
          tabOrder: state.tabOrder,
        }),
        onRehydrateStorage: () => (state) => {
          // Apply tab retention policy on app load
          if (!state) return;
          
          // Import settings dynamically to avoid circular dependency
          // Check localStorage directly to avoid circular import issues
          try {
            const settingsJson = localStorage.getItem('planneer-settings');
            if (!settingsJson) return;
            
            const settingsData = JSON.parse(settingsJson);
            const policy = settingsData?.state?.tabRetentionPolicy;
            
            if (policy === 'none') {
              // Clear all tabs, keep only home
              state.tabs = [DEFAULT_HOME_TAB];
              state.activeTabId = 'home';
              state.tabOrder = ['home'];
            } else if (policy === 'pinned-only') {
              // Keep only pinned tabs
              const pinnedTabs = state.tabs.filter((t) => t.pinned);
              if (pinnedTabs.length === 0) {
                // No pinned tabs, reset to home
                state.tabs = [DEFAULT_HOME_TAB];
                state.activeTabId = 'home';
                state.tabOrder = ['home'];
              } else {
                const pinnedIds = pinnedTabs.map((t) => t.id);
                state.tabs = pinnedTabs;
                state.tabOrder = state.tabOrder.filter((id) => pinnedIds.includes(id));
                // Set active tab to first pinned if current is not pinned
                if (!pinnedIds.includes(state.activeTabId!)) {
                  state.activeTabId = pinnedIds[0];
                }
              }
            }
            // 'all' policy: keep all tabs (default behavior, no changes needed)
          } catch (e) {
            // Ignore errors reading settings, keep tabs as-is
            console.warn('Failed to read tab retention policy:', e);
          }
        },
      }
    ),
    { name: 'TabsStore' }
  )
);

// Selectors for common access patterns
export const selectTabs = (state: TabsState & TabsActions) => state.tabs;
export const selectActiveTabId = (state: TabsState & TabsActions) => state.activeTabId;
export const selectActiveTab = (state: TabsState & TabsActions) =>
  state.tabs.find((t) => t.id === state.activeTabId);
export const selectOrderedTabs = (state: TabsState & TabsActions) =>
  state.tabOrder.map((id) => state.tabs.find((t) => t.id === id)).filter(Boolean) as Tab[];
