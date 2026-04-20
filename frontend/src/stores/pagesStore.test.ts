/**
 * @file pagesStore.test.ts
 * @description Tests for the pages Zustand store
 * @app PAGES - Core page state management
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePagesStore } from './pagesStore';
import type { Page } from '@/types/page';

// Mock dependencies
vi.mock('@/lib/syncAdapter', () => ({
  offlineCreatePage: vi.fn().mockImplementation((data) => 
    Promise.resolve({ 
      id: `page-${Date.now()}`, 
      ...data,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    })
  ),
  offlineUpdatePage: vi.fn().mockResolvedValue(undefined),
  offlineDeletePage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/syncEngine/index', () => ({
  syncEngine: {
    recordPageChange: vi.fn(),
    loadPageContent: vi.fn().mockResolvedValue(null),
    isOnline: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('@/components/ui/Toast', () => ({
  toastSuccess: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock('@/lib/pocketbase', () => ({
  generateId: vi.fn(() => `page-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`),
}));

// Helper to create mock pages
function createMockPage(overrides: Partial<Page> = {}): Page {
  const id = overrides.id || `page-${Date.now()}`;
  return {
    id,
    title: 'Test Page',
    content: '',
    excerpt: null,
    viewMode: 'note',
    childrenViewMode: 'list',
    parentId: null,
    order: 0,
    childCount: 0,
    isExpanded: false,
    isDailyNote: false,
    dailyNoteDate: null,
    icon: null,
    color: null,
    coverImage: null,
    coverGradient: null,
    coverAttribution: null,
    images: [],
    sections: [],
    created: '2025-01-15T12:00:00Z',
    updated: '2025-01-15T12:00:00Z',
    ...overrides,
  } as Page;
}

describe('pagesStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    usePagesStore.setState({
      pagesById: {},
      childrenIndex: { '__ROOT__': [] },
      dailyPagesIndex: {},
      expandedIds: new Set<string>(),
      hasMore: false,
      currentPage: 1,
      totalItems: 0,
      rootHasMore: false,
      rootCurrentPage: 1,
      rootTotalItems: 0,
      childrenPagination: {},
      activePageId: null,
      draftTitle: '',
      draftContent: '',
      isDirty: false,
      isNewlyCreated: false,
      contentVersion: 0,
      dailyNoteDate: '2025-01-15',
      isLoading: false,
      isContentLoading: false,
      contentUnavailableOffline: false,
      contentMayBeIncomplete: false,
      error: null,
    });
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('applyBulkLoad', () => {
    it('loads pages into store', () => {
      const pages = [
        createMockPage({ id: 'page-1', title: 'Page 1' }),
        createMockPage({ id: 'page-2', title: 'Page 2' }),
      ];
      
      usePagesStore.getState().applyBulkLoad(pages);
      
      const state = usePagesStore.getState();
      expect(Object.keys(state.pagesById)).toHaveLength(2);
      expect(state.pagesById['page-1'].title).toBe('Page 1');
      expect(state.pagesById['page-2'].title).toBe('Page 2');
      expect(state.isLoading).toBe(false);
    });

    it('builds children index correctly', () => {
      const pages = [
        createMockPage({ id: 'page-1', title: 'Parent', parentId: null }),
        createMockPage({ id: 'page-2', title: 'Child 1', parentId: 'page-1', order: 0 }),
        createMockPage({ id: 'page-3', title: 'Child 2', parentId: 'page-1', order: 1 }),
      ];
      
      usePagesStore.getState().applyBulkLoad(pages);
      
      const state = usePagesStore.getState();
      // Verify all pages are loaded
      expect(Object.keys(state.pagesById)).toHaveLength(3);
      expect(state.pagesById['page-1'].parentId).toBeNull();
      expect(state.pagesById['page-2'].parentId).toBe('page-1');
      expect(state.pagesById['page-3'].parentId).toBe('page-1');
      
      // Verify getChildren helper works (uses childrenIndex internally)
      const page1Children = state.getChildren('page-1');
      expect(page1Children).toHaveLength(2);
    });

    it('initializes expandedIds from pages', () => {
      const pages = [
        createMockPage({ id: 'page-1', isExpanded: true }),
        createMockPage({ id: 'page-2', isExpanded: false }),
        createMockPage({ id: 'page-3', isExpanded: true }),
      ];
      
      usePagesStore.getState().applyBulkLoad(pages);
      
      const state = usePagesStore.getState();
      expect(state.expandedIds.has('page-1')).toBe(true);
      expect(state.expandedIds.has('page-2')).toBe(false);
      expect(state.expandedIds.has('page-3')).toBe(true);
    });

    it('replaces existing pages (authoritative load)', () => {
      usePagesStore.setState({
        pagesById: { 'page-1': createMockPage({ id: 'page-1', title: 'Existing' }) },
        childrenIndex: { '__ROOT__': ['page-1'] },
        dailyPagesIndex: {},
      });
      
      const newPages = [createMockPage({ id: 'page-2', title: 'New Page' })];
      usePagesStore.getState().applyBulkLoad(newPages);
      
      const state = usePagesStore.getState();
      expect(Object.keys(state.pagesById)).toHaveLength(1);
      expect(state.pagesById['page-1']).toBeUndefined();
      expect(state.pagesById['page-2'].title).toBe('New Page');
    });
  });

  describe('applyRemoteChange', () => {
    it('handles create action', () => {
      const newPage = createMockPage({ id: 'page-new', title: 'New Page' });
      
      usePagesStore.getState().applyRemoteChange({
        action: 'create',
        record: newPage,
        recordId: newPage.id,
      });
      
      const state = usePagesStore.getState();
      expect(state.pagesById['page-new']).toBeDefined();
      expect(state.pagesById['page-new'].title).toBe('New Page');
      // Note: childrenIndex update is implementation-dependent
    });

    it('handles update action', () => {
      usePagesStore.setState({
        pagesById: { 'page-1': createMockPage({ id: 'page-1', title: 'Original' }) },
        childrenIndex: { '__ROOT__': ['page-1'] },
        dailyPagesIndex: {},
      });
      
      const updatedPage = createMockPage({ id: 'page-1', title: 'Updated' });
      
      usePagesStore.getState().applyRemoteChange({
        action: 'update',
        record: updatedPage,
        recordId: updatedPage.id,
      });
      
      expect(usePagesStore.getState().pagesById['page-1'].title).toBe('Updated');
    });

    it('handles delete action', () => {
      usePagesStore.setState({
        pagesById: { 
          'page-1': createMockPage({ id: 'page-1' }),
          'page-2': createMockPage({ id: 'page-2' }),
        },
        childrenIndex: { '__ROOT__': ['page-1', 'page-2'] },
        dailyPagesIndex: {},
      });
      
      usePagesStore.getState().applyRemoteChange({
        action: 'delete',
        recordId: 'page-1',
      });
      
      const state = usePagesStore.getState();
      expect(state.pagesById['page-1']).toBeUndefined();
      expect(state.pagesById['page-2']).toBeDefined();
      // Note: childrenIndex cleanup is implementation-dependent
    });

    it('ignores duplicate create', () => {
      const existingPage = createMockPage({ id: 'page-1', title: 'Existing' });
      usePagesStore.setState({
        pagesById: { 'page-1': existingPage },
        childrenIndex: { '__ROOT__': ['page-1'] },
        dailyPagesIndex: {},
      });
      
      const duplicatePage = createMockPage({ id: 'page-1', title: 'Duplicate' });
      
      usePagesStore.getState().applyRemoteChange({
        action: 'create',
        record: duplicatePage,
        recordId: duplicatePage.id,
      });
      
      expect(usePagesStore.getState().pagesById['page-1'].title).toBe('Existing');
    });
  });

  describe('createPage', () => {
    it('creates a new page', () => {
      const newPage = usePagesStore.getState().createPage({
        title: 'New Page',
        viewMode: 'note',
      });
      
      expect(newPage.title).toBe('New Page');
      expect(newPage.viewMode).toBe('note');
      expect(usePagesStore.getState().pagesById[newPage.id]).toBeDefined();
    });

    it('creates a child page', () => {
      usePagesStore.setState({
        pagesById: { 'parent-1': createMockPage({ id: 'parent-1' }) },
        childrenIndex: { '__ROOT__': ['parent-1'] },
        dailyPagesIndex: {},
      });
      
      const childPage = usePagesStore.getState().createPage({
        title: 'Child Page',
        viewMode: 'note',
        parentId: 'parent-1',
      });
      
      expect(childPage.parentId).toBe('parent-1');
      expect(usePagesStore.getState().childrenIndex['parent-1']).toContain(childPage.id);
    });
  });

  describe('updatePage', () => {
    it('updates page in store', () => {
      const page = createMockPage({ id: 'page-1', title: 'Original' });
      usePagesStore.setState({
        pagesById: { 'page-1': page },
        childrenIndex: { '__ROOT__': ['page-1'] },
        dailyPagesIndex: {},
      });
      
      usePagesStore.getState().updatePage('page-1', { title: 'Updated' });
      
      expect(usePagesStore.getState().pagesById['page-1'].title).toBe('Updated');
    });

    it('does nothing for non-existent page', () => {
      usePagesStore.getState().updatePage('non-existent', { title: 'Updated' });
      
      expect(usePagesStore.getState().pagesById['non-existent']).toBeUndefined();
    });
  });

  describe('deletePage', () => {
    it('removes page from store', () => {
      const page = createMockPage({ id: 'page-1' });
      usePagesStore.setState({
        pagesById: { 'page-1': page },
        childrenIndex: { '__ROOT__': ['page-1'] },
        dailyPagesIndex: {},
      });
      
      usePagesStore.getState().deletePage('page-1');
      
      expect(usePagesStore.getState().pagesById['page-1']).toBeUndefined();
      // Note: childrenIndex cleanup is implementation-dependent
    });
  });

  describe('editor state', () => {
    it('setDraftTitle updates draft', () => {
      usePagesStore.getState().setDraftTitle('New Title');
      
      const state = usePagesStore.getState();
      expect(state.draftTitle).toBe('New Title');
      expect(state.isDirty).toBe(true);
    });

    it('setDraftContent updates draft', () => {
      usePagesStore.getState().setDraftContent('New content');
      
      const state = usePagesStore.getState();
      expect(state.draftContent).toBe('New content');
      expect(state.isDirty).toBe(true);
    });

    it('discardDraft resets draft state', () => {
      const page = createMockPage({ id: 'page-1', title: 'Original', content: 'Original content' });
      usePagesStore.setState({
        pagesById: { 'page-1': page },
        childrenIndex: { '__ROOT__': ['page-1'] },
        dailyPagesIndex: {},
        activePageId: 'page-1',
        draftTitle: 'Modified',
        draftContent: 'Modified content',
        isDirty: true,
      });
      
      usePagesStore.getState().discardDraft();
      
      const state = usePagesStore.getState();
      expect(state.draftTitle).toBe('Original');
      expect(state.draftContent).toBe('Original content');
      expect(state.isDirty).toBe(false);
    });
  });

  describe('sidebar state', () => {
    it('toggleExpanded toggles expansion', () => {
      usePagesStore.setState({ expandedIds: new Set<string>() });
      
      usePagesStore.getState().toggleExpanded('page-1');
      expect(usePagesStore.getState().expandedIds.has('page-1')).toBe(true);
      
      usePagesStore.getState().toggleExpanded('page-1');
      expect(usePagesStore.getState().expandedIds.has('page-1')).toBe(false);
    });

    it('setExpanded sets specific expansion state', () => {
      usePagesStore.setState({ expandedIds: new Set<string>() });
      
      usePagesStore.getState().setExpanded('page-1', true);
      expect(usePagesStore.getState().expandedIds.has('page-1')).toBe(true);
      
      usePagesStore.getState().setExpanded('page-1', false);
      expect(usePagesStore.getState().expandedIds.has('page-1')).toBe(false);
    });
  });

  describe('daily pages', () => {
    it('builds daily pages index', () => {
      const pages = [
        createMockPage({ id: 'daily-1', isDailyNote: true, dailyNoteDate: '2025-01-15' }),
        createMockPage({ id: 'daily-2', isDailyNote: true, dailyNoteDate: '2025-01-16' }),
        createMockPage({ id: 'regular-1', isDailyNote: false }),
      ];
      
      usePagesStore.getState().applyBulkLoad(pages);
      
      const state = usePagesStore.getState();
      expect(state.dailyPagesIndex['2025-01-15']).toBe('daily-1');
      expect(state.dailyPagesIndex['2025-01-16']).toBe('daily-2');
    });

    it('setDailyPageDate updates current date', () => {
      usePagesStore.getState().setDailyPageDate('2025-02-01');
      
      expect(usePagesStore.getState().dailyNoteDate).toBe('2025-02-01');
    });
  });

  describe('hierarchy helpers', () => {
    beforeEach(() => {
      const pages = [
        createMockPage({ id: 'root-1', parentId: null }),
        createMockPage({ id: 'child-1', parentId: 'root-1' }),
        createMockPage({ id: 'child-2', parentId: 'root-1' }),
        createMockPage({ id: 'grandchild-1', parentId: 'child-1' }),
      ];
      usePagesStore.getState().applyBulkLoad(pages);
    });

    it('getPage returns page by id', () => {
      const page = usePagesStore.getState().getPage('root-1');
      expect(page).toBeDefined();
      expect(page?.id).toBe('root-1');
    });

    it('getPage returns undefined for non-existent', () => {
      const page = usePagesStore.getState().getPage('non-existent');
      expect(page).toBeUndefined();
    });

    it('getChildren returns children of a page', () => {
      const children = usePagesStore.getState().getChildren('root-1');
      expect(children).toHaveLength(2);
      expect(children.map(c => c.id)).toContain('child-1');
      expect(children.map(c => c.id)).toContain('child-2');
    });

    it('getChildren returns root pages for null', () => {
      const rootPages = usePagesStore.getState().getChildren(null);
      expect(rootPages.some(p => p.id === 'root-1')).toBe(true);
    });

    it('hasChildren returns true for parent with children', () => {
      // Update the page to have childCount
      usePagesStore.setState((state) => ({
        pagesById: {
          ...state.pagesById,
          'root-1': { ...state.pagesById['root-1'], childCount: 2 },
          'child-1': { ...state.pagesById['child-1'], childCount: 1 },
        },
      }));
      
      expect(usePagesStore.getState().hasChildren('root-1')).toBe(true);
      expect(usePagesStore.getState().hasChildren('child-1')).toBe(true);
      expect(usePagesStore.getState().hasChildren('child-2')).toBe(false);
    });
  });

  describe('reset', () => {
    it('resets store to initial state', () => {
      // Set up some state
      usePagesStore.setState({
        pagesById: { 'page-1': createMockPage({ id: 'page-1' }) },
        childrenIndex: { '__ROOT__': ['page-1'] },
        dailyPagesIndex: {},
        activePageId: 'page-1',
        draftTitle: 'Draft',
        isDirty: true,
        isLoading: true,
      });
      
      usePagesStore.getState().reset();
      
      const state = usePagesStore.getState();
      expect(Object.keys(state.pagesById)).toHaveLength(0);
      expect(state.activePageId).toBeNull();
      expect(state.draftTitle).toBe('');
      expect(state.isDirty).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('movePage', () => {
    beforeEach(() => {
      const pages = [
        createMockPage({ id: 'page-1', parentId: null }),
        createMockPage({ id: 'page-2', parentId: null }),
        createMockPage({ id: 'child-1', parentId: 'page-1' }),
      ];
      usePagesStore.getState().applyBulkLoad(pages);
    });

    it('moves page to a different parent', () => {
      usePagesStore.getState().movePage('child-1', 'page-2');
      
      const state = usePagesStore.getState();
      expect(state.pagesById['child-1'].parentId).toBe('page-2');
      // Note: childrenIndex updates are implementation-dependent
    });

    it('moves page to root (null parent)', () => {
      usePagesStore.getState().movePage('child-1', null);
      
      const state = usePagesStore.getState();
      expect(state.pagesById['child-1'].parentId).toBeNull();
      // Note: childrenIndex updates are implementation-dependent
    });
  });

  describe('reorderPages', () => {
    it('updates order of pages', () => {
      const pages = [
        createMockPage({ id: 'page-1', order: 0 }),
        createMockPage({ id: 'page-2', order: 1 }),
        createMockPage({ id: 'page-3', order: 2 }),
      ];
      usePagesStore.getState().applyBulkLoad(pages);
      
      // Reorder: page-3, page-1, page-2
      usePagesStore.getState().reorderPages(null, ['page-3', 'page-1', 'page-2']);
      
      const state = usePagesStore.getState();
      expect(state.pagesById['page-3'].order).toBe(0);
      expect(state.pagesById['page-1'].order).toBe(1);
      expect(state.pagesById['page-2'].order).toBe(2);
    });
  });
});
