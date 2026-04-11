/**
 * @file navigationStore.test.ts
 * @description Tests for navigation state management
 * @app SHARED - Navigation testing
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useNavigationStore } from './navigationStore';

// Mock pagesStore and selectionStore
vi.mock('./pagesStore', () => ({
  usePagesStore: {
    getState: vi.fn(() => ({
      pagesById: {},
    })),
    setState: vi.fn(),
  },
}));

vi.mock('./selectionStore', () => ({
  useSelectionStore: {
    getState: vi.fn(() => ({
      clearSelection: vi.fn(),
    })),
    setState: vi.fn(),
  },
}));

describe('navigationStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useNavigationStore.setState({
      currentView: 'home',
      selectedTaskPageId: null,
      selectedPageId: null,
      taskFilter: 'inbox',
      sidebarVisible: false,
      sidebarPinned: false,
      sidePanelOpen: false,
      sidePanelTab: 'metadata',
      viewPreferences: {},
      taskFilterOptions: {},
      pagesSearchQuery: '',
      pagesFilterBy: 'all',
      pagesViewMode: 'list',
      pagesGroupBy: 'none',
      pagesSortBy: 'updated',
      pagesSortDirection: 'desc',
      pagesShowExcerpts: true,
    });
  });

  describe('navigation', () => {
    it('initializes with home view', () => {
      const state = useNavigationStore.getState();
      expect(state.currentView).toBe('home');
    });

    it('navigates to different views', () => {
      const { navigateToView } = useNavigationStore.getState();
      
      navigateToView('tasks');
      expect(useNavigationStore.getState().currentView).toBe('tasks');
      
      navigateToView('pages');
      expect(useNavigationStore.getState().currentView).toBe('pages');
      
      navigateToView('settings');
      expect(useNavigationStore.getState().currentView).toBe('settings');
    });
  });

  describe('task page selection', () => {
    it('selects a task page', () => {
      const { selectTaskPage } = useNavigationStore.getState();
      
      selectTaskPage('page-123');
      
      expect(useNavigationStore.getState().selectedTaskPageId).toBe('page-123');
    });

    it('clears task page selection', () => {
      const { selectTaskPage } = useNavigationStore.getState();
      
      selectTaskPage('page-123');
      selectTaskPage(null);
      
      expect(useNavigationStore.getState().selectedTaskPageId).toBeNull();
    });
  });

  describe('page selection', () => {
    it('selects a page', () => {
      const { selectPage } = useNavigationStore.getState();
      
      selectPage('page-456');
      
      expect(useNavigationStore.getState().selectedPageId).toBe('page-456');
    });

    it('clears page selection', () => {
      const { selectPage, clearSelectedPage } = useNavigationStore.getState();
      
      selectPage('page-456');
      clearSelectedPage();
      
      expect(useNavigationStore.getState().selectedPageId).toBeNull();
    });
  });

  describe('task filter', () => {
    it('sets task filter', () => {
      const { setTaskFilter } = useNavigationStore.getState();
      
      setTaskFilter('today');
      expect(useNavigationStore.getState().taskFilter).toBe('today');
      
      setTaskFilter('upcoming');
      expect(useNavigationStore.getState().taskFilter).toBe('upcoming');
      
      setTaskFilter('all');
      expect(useNavigationStore.getState().taskFilter).toBe('all');
    });
  });

  describe('sidebar', () => {
    it('toggles sidebar expansion', () => {
      const { toggleSidebar } = useNavigationStore.getState();
      
      expect(useNavigationStore.getState().sidebarVisible).toBe(false);
      
      toggleSidebar();
      expect(useNavigationStore.getState().sidebarVisible).toBe(true);
      
      toggleSidebar();
      expect(useNavigationStore.getState().sidebarVisible).toBe(false);
    });

    it('unpins when collapsing the sidebar directly', () => {
      const { setSidebarVisible, setSidebarPinned } = useNavigationStore.getState();

      setSidebarPinned(true);
      setSidebarVisible(false);

      expect(useNavigationStore.getState().sidebarVisible).toBe(false);
      expect(useNavigationStore.getState().sidebarPinned).toBe(false);
    });

    it('pins the sidebar and keeps it expanded', () => {
      const { setSidebarPinned } = useNavigationStore.getState();

      setSidebarPinned(true);

      expect(useNavigationStore.getState().sidebarPinned).toBe(true);
      expect(useNavigationStore.getState().sidebarVisible).toBe(true);
    });

    it('sets sidebar expansion directly', () => {
      const { setSidebarVisible } = useNavigationStore.getState();
      
      setSidebarVisible(true);
      expect(useNavigationStore.getState().sidebarVisible).toBe(true);

      setSidebarVisible(false);
      expect(useNavigationStore.getState().sidebarVisible).toBe(false);
    });
  });

  describe('unified sidepanel', () => {
    it('toggles the sidepanel open state', () => {
      const { toggleSidePanel } = useNavigationStore.getState();

      expect(useNavigationStore.getState().sidePanelOpen).toBe(false);

      toggleSidePanel();
      expect(useNavigationStore.getState().sidePanelOpen).toBe(true);
    });

    it('opens the sidepanel on a requested tab', () => {
      const { openSidePanel } = useNavigationStore.getState();

      openSidePanel('task-editor');

      expect(useNavigationStore.getState().sidePanelOpen).toBe(true);
      expect(useNavigationStore.getState().sidePanelTab).toBe('task-editor');
    });
  });

  describe('pages view preferences', () => {
    it('sets search query', () => {
      const { setPagesSearchQuery } = useNavigationStore.getState();
      
      setPagesSearchQuery('test query');
      
      expect(useNavigationStore.getState().pagesSearchQuery).toBe('test query');
    });

    it('sets filter by', () => {
      const { setPagesFilterBy } = useNavigationStore.getState();
      
      setPagesFilterBy('collections');
      expect(useNavigationStore.getState().pagesFilterBy).toBe('collections');
      
      setPagesFilterBy('tasks');
      expect(useNavigationStore.getState().pagesFilterBy).toBe('tasks');
    });

    it('sets view mode', () => {
      const { setPagesViewMode } = useNavigationStore.getState();
      
      setPagesViewMode('list');
      expect(useNavigationStore.getState().pagesViewMode).toBe('list');
      
      setPagesViewMode('kanban');
      expect(useNavigationStore.getState().pagesViewMode).toBe('kanban');
    });

    it('sets sort options', () => {
      const { setPagesSortBy, setPagesSortDirection } = useNavigationStore.getState();
      
      setPagesSortBy('title');
      expect(useNavigationStore.getState().pagesSortBy).toBe('title');
      
      setPagesSortDirection('asc');
      expect(useNavigationStore.getState().pagesSortDirection).toBe('asc');
    });

    it('sets show excerpts', () => {
      const { setPagesShowExcerpts } = useNavigationStore.getState();
      
      setPagesShowExcerpts(false);
      expect(useNavigationStore.getState().pagesShowExcerpts).toBe(false);
    });
  });

  describe('view preferences', () => {
    it('sets and gets view preferences', () => {
      const { setViewPreference, getViewPreference } = useNavigationStore.getState();
      
      setViewPreference('tasks', 'viewMode', 'kanban');
      setViewPreference('tasks', 'showCompleted', true);
      
      const prefs = useNavigationStore.getState().getViewPreference('tasks');
      expect(prefs.viewMode).toBe('kanban');
      expect(prefs.showCompleted).toBe(true);
    });

    it('returns defaults for unknown view', () => {
      const prefs = useNavigationStore.getState().getViewPreference('unknown-view');
      
      expect(prefs).toBeDefined();
      expect(prefs.viewMode).toBe('list'); // default
    });
  });
});
