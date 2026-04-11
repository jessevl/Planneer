/**
 * @file navigationStore.ts
 * @description Navigation state management with Zustand
 * @app SHARED - Unified navigation for the entire app
 * 
 * Manages the application's navigation state including:
 * - Current view (unified - no more app switching)
 * - Task filter (persisted pill state)
 * - Selected task page IDs
 * - Sidebar visibility
 * - View preferences (per-view, persisted)
 */
import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import type { ViewMode, GroupBy, TaskFilterOptions, PageFilterOptions } from '@/types/view';
import { DEFAULT_TASK_FILTER_OPTIONS, DEFAULT_PAGE_FILTER_OPTIONS } from '@/types/view';
import { useSelectionStore } from './selectionStore';
import { usePagesStore } from './pagesStore';

// Unified views - no more separate apps
export type UnifiedView = 
  | 'home'           // Dashboard (default)
  | 'daily-journal'  // Daily tasks + page
  | 'pages'          // All pages view
  | 'graph'          // Workspace relationship graph
  | 'page'           // Single page editor
  | 'tasks'          // Tasks with pill sub-navigation
  | 'taskPage'        // Project-specific tasks
  | 'settings';

// Task filter for pill navigation (persisted)
export type TaskFilter = 'inbox' | 'today' | 'upcoming' | 'all';

export type UnifiedSidepanelTab = 'graph' | 'metadata' | 'task-editor' | 'task-overview';

// Legacy type alias for backward compatibility during migration
export type View = UnifiedView;

interface ViewPreferences {
  viewMode: ViewMode;
  groupBy: GroupBy;
  showCompleted: boolean;
  sortBy?: 'updated' | 'created' | 'title' | 'manual';
  // Task-specific sort options (within groups)
  taskSortBy?: 'date' | 'priority' | 'title' | 'created' | 'tag';
  taskSortDirection?: 'asc' | 'desc';
}

// Notes-specific view preferences (stored separately for clarity)
export type NotesFilterType = 'all' | 'notes' | 'collections' | 'tasks' | 'handwritten';
export type NotesGroupBy = 'none' | 'date';
export type NotesSortBy = 'updated' | 'created' | 'title';
export type NotesSortDirection = 'asc' | 'desc';
export type HandwrittenGroupBy = 'none' | 'date';
export type HandwrittenSortBy = 'updated' | 'created' | 'title';
export type HandwrittenSortDirection = 'asc' | 'desc';

interface NavigationState {
  // Current Location (unified - no more currentApp)
  currentView: UnifiedView;
  selectedTaskPageId: string | null; // Legacy: selectedProjectId
  selectedPageId: string | null;

  // Task filter for pills (persisted)
  taskFilter: TaskFilter;

  // Sidebar
  sidebarVisible: boolean;
  sidebarPinned: boolean;

  // Unified right sidepanel state (shared across pages and tasks views)
  sidePanelOpen: boolean;
  sidePanelTab: UnifiedSidepanelTab;
  // View Preferences (per-view, persisted)
  viewPreferences: Record<string, ViewPreferences>;

  // Task filter options per view key (persisted to localStorage)
  taskFilterOptions: Record<string, TaskFilterOptions>;

  // Pages-specific view state (persisted)
  pagesSearchQuery: string;
  pagesFilterBy: NotesFilterType;
  pagesViewMode: ViewMode;
  pagesGroupBy: NotesGroupBy;
  pagesSortBy: NotesSortBy;
  pagesSortDirection: NotesSortDirection;
  pagesShowExcerpts: boolean;
  pagesTagFilter: string[];

  // Handwritten library view state (persisted)
  handwrittenViewMode: ViewMode;
  handwrittenGroupBy: HandwrittenGroupBy;
  handwrittenSortBy: HandwrittenSortBy;
  handwrittenSortDirection: HandwrittenSortDirection;
  handwrittenShowExcerpts: boolean;

  // Actions
  navigateToView: (view: UnifiedView) => void;
  selectTaskPage: (id: string | null) => void;
  selectPage: (id: string | null) => void;
  clearSelectedPage: () => void;
  setSidebarVisible: (visible: boolean) => void;
  toggleSidebar: () => void;
  setSidebarPinned: (pinned: boolean) => void;
  toggleSidebarPin: () => void;

  // Task filter
  setTaskFilter: (filter: TaskFilter) => void;

  // Unified sidepanel
  setSidePanelOpen: (open: boolean) => void;
  toggleSidePanel: () => void;
  setSidePanelTab: (tab: UnifiedSidepanelTab) => void;
  openSidePanel: (tab?: UnifiedSidepanelTab) => void;

  // View Preferences
  setViewPreference: <K extends keyof ViewPreferences>(
    viewKey: string,
    key: K,
    value: ViewPreferences[K]
  ) => void;
  getViewPreference: (viewKey: string) => ViewPreferences;

  // Task filter options
  setTaskFilterOptions: (viewKey: string, opts: TaskFilterOptions) => void;
  getTaskFilterOptions: (viewKey: string) => TaskFilterOptions;

  // Reset view preferences (used on logout to avoid cross-user leakage)
  resetViewPreferences: () => void;

  // Pages view preferences
  setPagesSearchQuery: (query: string) => void;
  setPagesFilterBy: (filter: NotesFilterType) => void;
  setPagesViewMode: (mode: ViewMode) => void;
  setPagesGroupBy: (groupBy: NotesGroupBy) => void;
  setPagesSortBy: (sortBy: NotesSortBy) => void;
  setPagesSortDirection: (direction: NotesSortDirection) => void;
  setPagesShowExcerpts: (show: boolean) => void;
  setPagesTagFilter: (tags: string[]) => void;

  setHandwrittenViewMode: (mode: ViewMode) => void;
  setHandwrittenGroupBy: (groupBy: HandwrittenGroupBy) => void;
  setHandwrittenSortBy: (sortBy: HandwrittenSortBy) => void;
  setHandwrittenSortDirection: (direction: HandwrittenSortDirection) => void;
  setHandwrittenShowExcerpts: (show: boolean) => void;

}

const DEFAULT_PREFERENCES: ViewPreferences = {
  viewMode: 'list',
  groupBy: 'none',
  showCompleted: false,
  sortBy: 'updated',
  taskSortBy: 'date',
  taskSortDirection: 'desc',
};

/**
 * Per-filter default preferences for task views.
 * These define the initial view configuration for each task filter
 * when the user has not yet customized their preferences.
 */
export const TASK_FILTER_DEFAULTS: Record<TaskFilter, ViewPreferences> = {
  inbox: {
    viewMode: 'list',
    groupBy: 'priority',
    showCompleted: false,
    sortBy: 'updated',
    taskSortBy: 'date',
    taskSortDirection: 'asc',
  },
  today: {
    viewMode: 'list',
    groupBy: 'date',
    showCompleted: false,
    sortBy: 'updated',
    taskSortBy: 'priority',
    taskSortDirection: 'desc',
  },
  upcoming: {
    viewMode: 'list',
    groupBy: 'date',
    showCompleted: false,
    sortBy: 'updated',
    taskSortBy: 'date',
    taskSortDirection: 'asc',
  },
  all: {
    viewMode: 'table',
    groupBy: 'taskPage',
    showCompleted: false,
    sortBy: 'updated',
    taskSortBy: 'priority',
    taskSortDirection: 'desc',
  },
};

/** Get the default preferences for a given view key, respecting per-filter defaults */
export function getDefaultPreferences(viewKey: string): ViewPreferences {
  // Check if this is a task filter view key like 'tasks_inbox'
  const filterMatch = viewKey.match(/^tasks_(inbox|today|upcoming|all)$/);
  if (filterMatch) {
    return TASK_FILTER_DEFAULTS[filterMatch[1] as TaskFilter];
  }
  return DEFAULT_PREFERENCES;
}

export const useNavigationStore = create<NavigationState>()(
  devtools(
    persist(
      (set, get) => ({
        currentView: 'home',
        selectedTaskPageId: null,
        selectedPageId: null,
        taskFilter: 'upcoming',
        sidebarVisible: false,
        sidebarPinned: false,
        sidePanelOpen: false,
        sidePanelTab: 'metadata' as UnifiedSidepanelTab,
        viewPreferences: {},
        taskFilterOptions: {},
        pagesSearchQuery: '',
        pagesFilterBy: 'all' as NotesFilterType,
        pagesViewMode: 'kanban' as ViewMode,
        pagesGroupBy: 'date' as NotesGroupBy,
        pagesSortBy: 'updated' as NotesSortBy,
        pagesSortDirection: 'desc' as NotesSortDirection,
        pagesShowExcerpts: true,
        pagesTagFilter: [],
        handwrittenViewMode: 'kanban' as ViewMode,
        handwrittenGroupBy: 'none' as HandwrittenGroupBy,
        handwrittenSortBy: 'updated' as HandwrittenSortBy,
        handwrittenSortDirection: 'desc' as HandwrittenSortDirection,
        handwrittenShowExcerpts: true,

        navigateToView: (view) => {
          // Clear all selections when navigating to a different view
          useSelectionStore.getState().clearSelection();
          
          set(
            {
              currentView: view,
              selectedTaskPageId: view === 'taskPage' ? get().selectedTaskPageId : null,
              // Clear selected page when leaving page view
              selectedPageId: view === 'page' ? get().selectedPageId : null,
            },
            false,
            'navigateToView'
          );

          // Auto-switch groupBy away from 'section' if not in task page view
          // For task filter views, we check the current filter's preferences
          if (view === 'tasks') {
            const taskFilter = get().taskFilter;
            const viewKey = getViewKey(view, null, taskFilter);
            const prefs = get().getViewPreference(viewKey);
            if (prefs.groupBy === 'section') {
              get().setViewPreference(viewKey, 'groupBy', 'date');
            }
          } else if (view !== 'taskPage') {
            const viewKey = getViewKey(view, null);
            const prefs = get().getViewPreference(viewKey);
            if (prefs.groupBy === 'section') {
              get().setViewPreference(viewKey, 'groupBy', 'date');
            }
          }
        },

        selectTaskPage: (id) => {
          // Clear all selections when switching task pages
          useSelectionStore.getState().clearSelection();
          
          set({ selectedTaskPageId: id }, false, 'selectTaskPage');
          if (id) {
            set({ currentView: 'taskPage' }, false, 'selectTaskPage/view');
          }
        },

        selectPage: (id) => {
          // Clear all selections when opening a page
          useSelectionStore.getState().clearSelection();
          
          set({ selectedPageId: id }, false, 'selectPage');
          if (id) {
            set({ currentView: 'page' }, false, 'selectPage/view');
          }
        },
        clearSelectedPage: () => set({ selectedPageId: null }, false, 'clearSelectedPage'),

        setSidebarVisible: (visible) =>
          set(
            (state) => ({
              sidebarVisible: visible,
              sidebarPinned: visible ? state.sidebarPinned : false,
            }),
            false,
            'setSidebarVisible'
          ),
        toggleSidebar: () =>
          set(
            (state) => ({
              sidebarVisible: !(state.sidebarVisible || state.sidebarPinned),
              sidebarPinned: false,
            }),
            false,
            'toggleSidebar'
          ),
        setSidebarPinned: (pinned) =>
          set(
            (state) => ({
              sidebarPinned: pinned,
              sidebarVisible: pinned ? true : state.sidebarVisible,
            }),
            false,
            'setSidebarPinned'
          ),
        toggleSidebarPin: () =>
          set(
            (state) => ({
              sidebarPinned: !state.sidebarPinned,
              sidebarVisible: !state.sidebarPinned ? true : state.sidebarVisible,
            }),
            false,
            'toggleSidebarPin'
          ),

        setTaskFilter: (filter) => set({ taskFilter: filter }, false, 'setTaskFilter'),

        setSidePanelOpen: (open) => {
          set({ sidePanelOpen: open }, false, 'setSidePanelOpen');
        },
        toggleSidePanel: () => {
          set((state) => ({ sidePanelOpen: !state.sidePanelOpen }), false, 'toggleSidePanel');
        },
        setSidePanelTab: (tab) => {
          set({ sidePanelTab: tab }, false, 'setSidePanelTab');
        },
        openSidePanel: (tab) => {
          set(
            (state) => ({
              sidePanelOpen: true,
              sidePanelTab: tab ?? state.sidePanelTab,
            }),
            false,
            'openSidePanel'
          );
        },

        setViewPreference: (viewKey, key, value) => {
          set(
            (state) => {
              const defaults = getDefaultPreferences(viewKey);
              const newState = {
                viewPreferences: {
                  ...state.viewPreferences,
                  [viewKey]: {
                    ...defaults,
                    ...state.viewPreferences[viewKey],
                    [key]: value,
                  },
                },
              };
              return newState;
            },
            false,
            `setViewPreference/${key}`
          );
        },

        setTaskFilterOptions: (viewKey, opts) => {
          set(
            (state) => ({
              taskFilterOptions: {
                ...state.taskFilterOptions,
                [viewKey]: opts,
              },
            }),
            false,
            'setTaskFilterOptions'
          );
        },

        getTaskFilterOptions: (viewKey) => {
          return get().taskFilterOptions[viewKey] ?? DEFAULT_TASK_FILTER_OPTIONS;
        },

        resetViewPreferences: () => {
          set(
            {
              viewPreferences: {},
              taskFilterOptions: {},
              pagesViewMode: 'kanban' as ViewMode,
              pagesGroupBy: 'date' as NotesGroupBy,
              pagesSortBy: 'updated' as NotesSortBy,
              pagesSortDirection: 'desc' as NotesSortDirection,
              pagesFilterBy: 'all' as NotesFilterType,
              pagesShowExcerpts: true,
              pagesTagFilter: [],
              handwrittenViewMode: 'kanban' as ViewMode,
              handwrittenGroupBy: 'none' as HandwrittenGroupBy,
              handwrittenSortBy: 'updated' as HandwrittenSortBy,
              handwrittenSortDirection: 'desc' as HandwrittenSortDirection,
              handwrittenShowExcerpts: true,
            },
            false,
            'resetViewPreferences'
          );
        },

        getViewPreference: (viewKey) => ({
          ...getDefaultPreferences(viewKey),
          ...get().viewPreferences[viewKey],
        }),

        setPagesSearchQuery: (query) => set({ pagesSearchQuery: query }, false, 'setPagesSearchQuery'),
        setPagesFilterBy: (filter) => set({ pagesFilterBy: filter }, false, 'setPagesFilterBy'),
        setPagesViewMode: (mode) => {
          set({ pagesViewMode: mode }, false, 'setPagesViewMode');
        },
        setPagesGroupBy: (groupBy) => {
          set({ pagesGroupBy: groupBy }, false, 'setPagesGroupBy');
        },
        setPagesSortBy: (sortBy) => {
          set({ pagesSortBy: sortBy }, false, 'setPagesSortBy');
        },
        setPagesSortDirection: (direction) => {
          set({ pagesSortDirection: direction }, false, 'setPagesSortDirection');
        },
        setPagesShowExcerpts: (show) => {
          set({ pagesShowExcerpts: show }, false, 'setPagesShowExcerpts');
        },
        setPagesTagFilter: (tags) => {
          set({ pagesTagFilter: tags }, false, 'setPagesTagFilter');
        },
        setHandwrittenViewMode: (mode) => {
          set({ handwrittenViewMode: mode }, false, 'setHandwrittenViewMode');
        },
        setHandwrittenGroupBy: (groupBy) => {
          set({ handwrittenGroupBy: groupBy }, false, 'setHandwrittenGroupBy');
        },
        setHandwrittenSortBy: (sortBy) => {
          set({ handwrittenSortBy: sortBy }, false, 'setHandwrittenSortBy');
        },
        setHandwrittenSortDirection: (direction) => {
          set({ handwrittenSortDirection: direction }, false, 'setHandwrittenSortDirection');
        },
        setHandwrittenShowExcerpts: (show) => {
          set({ handwrittenShowExcerpts: show }, false, 'setHandwrittenShowExcerpts');
        },
      }),
      {
        name: 'planneer-navigation',
        version: 9,
        storage: createJSONStorage(() => localStorage),
        migrate: (persistedState: any, version: number) => {
          if (!persistedState) return persistedState;

          if (version < 6) {
            return {
              ...persistedState,
              sidebarVisible: false,
              sidebarPinned: false,
            };
          }

          return persistedState;
        },
        partialize: (state) => {
          const partial = {
            currentView: state.currentView,
            taskFilter: state.taskFilter,
            sidebarVisible: state.sidebarVisible,
            sidebarPinned: state.sidebarPinned,
            sidePanelOpen: state.sidePanelOpen,
            sidePanelTab: state.sidePanelTab,
            viewPreferences: state.viewPreferences,
            taskFilterOptions: state.taskFilterOptions,
            // Persist pages view preferences
            pagesViewMode: state.pagesViewMode,
            pagesGroupBy: state.pagesGroupBy,
            pagesSortBy: state.pagesSortBy,
            pagesSortDirection: state.pagesSortDirection,
            pagesFilterBy: state.pagesFilterBy,
            pagesShowExcerpts: state.pagesShowExcerpts,
            pagesTagFilter: state.pagesTagFilter,
            handwrittenViewMode: state.handwrittenViewMode,
            handwrittenGroupBy: state.handwrittenGroupBy,
            handwrittenSortBy: state.handwrittenSortBy,
            handwrittenSortDirection: state.handwrittenSortDirection,
            handwrittenShowExcerpts: state.handwrittenShowExcerpts,
            selectedTaskPageId: state.selectedTaskPageId,
          };
          return partial;
        },
        merge: (persisted, current) => {
          const p = persisted as any;
          if (!p) return current;
          
          const merged = {
            ...current,
            ...p,
            // Migration: if legacy fields exist but new ones don't, use legacy
            selectedTaskPageId: p.selectedTaskPageId ?? p.selectedProjectId ?? current.selectedTaskPageId,
            pagesViewMode: p.pagesViewMode ?? p.notesViewMode ?? current.pagesViewMode,
            pagesGroupBy: p.pagesGroupBy ?? p.notesGroupBy ?? current.pagesGroupBy,
            pagesSortBy: p.pagesSortBy ?? p.notesSortBy ?? current.pagesSortBy,
            pagesSortDirection: p.pagesSortDirection ?? p.notesSortDirection ?? current.pagesSortDirection,
            pagesFilterBy: p.pagesFilterBy ?? p.notesFilterBy ?? current.pagesFilterBy,
            taskFilterOptions: p.taskFilterOptions ?? current.taskFilterOptions,
            pagesTagFilter: p.pagesTagFilter ?? [],
            handwrittenViewMode: p.handwrittenViewMode ?? current.handwrittenViewMode,
            handwrittenGroupBy: p.handwrittenGroupBy ?? current.handwrittenGroupBy,
            handwrittenSortBy: p.handwrittenSortBy ?? current.handwrittenSortBy,
            handwrittenSortDirection: p.handwrittenSortDirection ?? current.handwrittenSortDirection,
            handwrittenShowExcerpts: p.handwrittenShowExcerpts ?? current.handwrittenShowExcerpts,
            sidebarVisible: p.sidebarVisible ?? false,
            sidebarPinned: p.sidebarPinned ?? false,
            sidePanelOpen: p.sidePanelOpen ?? false,
            sidePanelTab: p.sidePanelTab ?? 'metadata',
            // Ensure viewPreferences is merged correctly
            viewPreferences: {
              ...(current.viewPreferences || {}),
              ...(p.viewPreferences || {}),
            },
          };
          return merged;
        },
        onRehydrateStorage: (state) => {
          return (state, error) => {
            // Hydration finished
          };
        },
      }
    ),
    { name: 'NavigationStore' }
  )
);

/**
 * Helper to get view key for preferences.
 * Generates unique keys for each view context:
 * - Task Page views: `taskPage_<taskPageId>`
 * - Task filter views: `tasks_<filter>` (inbox, today, upcoming, all)
 * - Other views: just the view name
 */
export const getViewKey = (view: View, taskPageId: string | null, taskFilter?: TaskFilter): string => {
  if (view === 'taskPage' && taskPageId) {
    return `taskPage_${taskPageId}`;
  }
  if (view === 'tasks' && taskFilter) {
    return `tasks_${taskFilter}`;
  }
  return view;
};

// ============================================================================
// COMBINED SELECTORS (for useShallow - reduces re-renders)
// ============================================================================

/** Select pages view state (use with useShallow) */
export const selectPagesViewState = (state: NavigationState) => ({
  selectedPageId: state.selectedPageId,
  viewMode: state.pagesViewMode,
  sortBy: state.pagesSortBy,
  sortDirection: state.pagesSortDirection,
  groupBy: state.pagesGroupBy,
  filterBy: state.pagesFilterBy,
  tagFilter: state.pagesTagFilter,
  searchQuery: state.pagesSearchQuery,
  showExcerpts: state.pagesShowExcerpts,
});

/** Select pages view actions (use with useShallow) */
export const selectPagesViewActions = (state: NavigationState) => ({
  selectPage: state.selectPage,
  setViewMode: state.setPagesViewMode,
  setSortBy: state.setPagesSortBy,
  setSortDirection: state.setPagesSortDirection,
  setGroupBy: state.setPagesGroupBy,
  setFilterBy: state.setPagesFilterBy,
  setSearchQuery: state.setPagesSearchQuery,
  setShowExcerpts: state.setPagesShowExcerpts,
  setTagFilter: state.setPagesTagFilter,
});

/** Select task view state (use with useShallow) */
export const selectTaskViewState = (state: NavigationState) => ({
  currentView: state.currentView,
  selectedTaskPageId: state.selectedTaskPageId,
  taskFilter: state.taskFilter,
  sidebarVisible: state.sidebarVisible,
  sidebarPinned: state.sidebarPinned,
  viewPreferences: state.viewPreferences,
});

/** Select navigation actions (use with useShallow) */
export const selectNavigationActions = (state: NavigationState) => ({
  navigateToView: state.navigateToView,
  selectTaskPage: state.selectTaskPage,
  selectPage: state.selectPage,
  clearSelectedPage: state.clearSelectedPage,
  setSidebarVisible: state.setSidebarVisible,
  toggleSidebar: state.toggleSidebar,
  setSidebarPinned: state.setSidebarPinned,
  toggleSidebarPin: state.toggleSidebarPin,
  setTaskFilter: state.setTaskFilter,
  setViewPreference: state.setViewPreference,
  getViewPreference: state.getViewPreference,
});
