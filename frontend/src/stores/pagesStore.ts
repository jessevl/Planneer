/**
 * @file pagesStore.ts
 * @description Page state management with Zustand
 * @app PAGES APP ONLY - Core page data management
 * 
 * Manages all page state including:
 * - Normalized page data (pagesById)
 * - Sidebar expansion state (expandedIds)
 * - Active editor state (activePageId, draftTitle, draftContent)
 * - Daily pages state (dailyNoteDate)
 * 
 * Uses offline-first sync adapter for data operations:
 * - Local changes are saved to IndexedDB immediately
 * - Changes are queued for sync to server
 * - Remote changes flow through syncEngine events
 * 
 * This store eliminates the prop drilling from PagesView.tsx by
 * centralizing editor state that was previously passed through
 * multiple component layers.
 */
import { useMemo } from 'react';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  Page,
  PageTreeNode,
  PageBreadcrumb,
  CreatePageInput,
  UpdatePageInput,
} from '@/types/page';
import { toastSuccess } from '@/components/ui';
import { buildPageTree, getAncestorChain, extractExcerpt } from '@/lib/pageUtils';
import { isRootLevel, ROOT_KEY } from '@/lib/treeUtils';
import { generateId } from '@/lib/pocketbase';
import {
  offlineCreatePage,
  offlineUpdatePage,
  offlineDeletePage,
} from '@/lib/syncAdapter';
import { syncEngine, type DataChangeEvent } from '@/lib/syncEngine/index';
import { devLog } from '@/lib/config';
import dayjs from 'dayjs';
import { useTasksStore } from '@/stores/tasksStore';
import type { Task } from '@/types/task';

// ============================================================================
// REQUEST DEDUPLICATION
// ============================================================================
// Prevents duplicate concurrent requests (e.g., from React StrictMode, rapid clicks)
const pendingRequests = new Map<string, Promise<void>>();

async function withDedup<T>(key: string, fn: () => Promise<T>): Promise<T> {
  // If this exact request is already in-flight, return the existing promise
  const existing = pendingRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }
  
  const promise = fn().finally(() => {
    pendingRequests.delete(key);
  });
  
  pendingRequests.set(key, promise as Promise<void>);
  return promise;
}

function mergePageWithPreservedContent(existingPage: Page | undefined, incomingPage: Page): Page {
  if (!existingPage) return incomingPage;

  return {
    ...existingPage,
    ...incomingPage,
    content: incomingPage.content ?? existingPage.content,
  };
}

export interface PagesState {
  // Data (normalized)
  pagesById: Record<string, Page>;
  expandedIds: Set<string>;
  
  // Indexes for O(1) lookups (derived from pagesById)
  childrenIndex: Record<string, string[]>; // parentId -> childIds (sorted by order)
  dailyPagesIndex: Record<string, string>; // date (YYYY-MM-DD) -> pageId

  // Pagination state for "All Pages" view (all pages including children)
  hasMore: boolean;           // Whether there are more pages to load
  currentPage: number;        // Current page for "Load More"
  totalItems: number;         // Total number of pages
  
  // Pagination state for sidebar tree (root-only pages)
  rootHasMore: boolean;
  rootCurrentPage: number;
  rootTotalItems: number;
  
  // Per-parent pagination state (for children / subpages)
  childrenPagination: Record<string, { 
    hasMore: boolean; 
    currentPage: number; 
  }>;

  // Active Editor State (eliminates prop drilling!)
  activePageId: string | null;
  draftTitle: string;
  draftContent: string;
  isDirty: boolean;
  isNewlyCreated: boolean; // Flag to auto-focus title on creation
  contentVersion: number; // Incremented on remote updates to force editor re-mount

  // Daily Pages
  dailyNoteDate: string; // YYYY-MM-DD format

  // Loading
  isLoading: boolean;
  isContentLoading: boolean; // True when fetching individual page content
  contentUnavailableOffline: boolean; // True when offline and page content is not cached
  contentMayBeIncomplete: boolean; // True when content was built from SSE only (never fully fetched)
  error: string | null;

  // Actions - Data Loading
  /**
   * Load pages with pagination. Merges into existing state.
   * @param options.rootOnly - Only load root-level pages (for sidebar initial)
   * @param options.parentId - Load children of a specific parent (for expand)
   * @param options.limit - Hard limit (e.g., 6 for HomeView)
   * @param options.pageSize - Items per page (default 100)
   * @param options.page - Page number (default 1, increment for "Load More")
   * @param options.replace - Replace all pages instead of merging (default false)
   * @param options.sortBy - Sort field (default 'updated', use 'order' for tree)
   * @param options.sortDirection - Sort direction (default 'desc')
   */
  loadPages: (options?: { 
    rootOnly?: boolean; 
    parentId?: string; 
    limit?: number;
    pageSize?: number;
    page?: number;
    replace?: boolean;
    sortBy?: 'updated' | 'created' | 'order' | 'title';
    sortDirection?: 'asc' | 'desc';
  }) => Promise<void>;
  
  /** Load more pages (next page). Pass rootOnly=true for sidebar tree, false for All Pages view. */
  loadMorePages: (rootOnly: boolean, sortBy?: 'updated' | 'created' | 'order' | 'title', sortDirection?: 'asc' | 'desc') => Promise<void>;
  
  /** Load more children for a specific parent (paginated). Uses 'order' sort for tree, or custom sort for collection. */
  loadMoreChildren: (parentId: string, sortBy?: 'updated' | 'created' | 'order' | 'title', sortDirection?: 'asc' | 'desc') => Promise<void>;
  
  /** Check if a parent has more children to load */
  parentHasMore: (parentId: string) => boolean;
  
  /** Refetch all pages (for window focus sync) */
  refetchPages: () => Promise<void>;
  
  // Sync engine integration - called by sync engine events
  /** Apply bulk load of pages from sync engine (initial load or refresh) */
  applyBulkLoad: (pages: Page[], pagination?: { hasMore: boolean; totalItems: number }) => void;
  /** Apply a remote change from sync engine (create/update/delete) */
  applyRemoteChange: (event: DataChangeEvent<Page>) => void;
  
  // Loading state control
  setLoading: (loading: boolean) => void;
  
  createPage: (input: CreatePageInput) => Page;
  updatePage: (id: string, updates: UpdatePageInput) => void;
  updatePages: (ids: string[], updates: UpdatePageInput) => void;
  /** Lightweight timestamp update — bumps `updated` without sending content through sync */
  touchPageTimestamp: (id: string) => void;
  deletePage: (id: string, cascade?: boolean) => void;
  deletePages: (ids: string[]) => void;

  // Actions - Hierarchy
  movePage: (id: string, newParentId: string | null) => void;
  reorderPages: (parentId: string | null, orderedIds: string[]) => void;

  // Actions - Editor
  selectPage: (id: string | null, isNew?: boolean, forceRefresh?: boolean, isBackground?: boolean) => Promise<void>;
  setDraftTitle: (title: string) => void;
  setDraftContent: (content: string) => void;
  saveCurrentPage: () => Promise<void>;
  discardDraft: () => void;
  clearNewlyCreated: () => void;

  // Actions - Daily Pages
  setDailyPageDate: (date: string) => void;
  findOrCreateDailyPage: (date: string) => Page | null;

  // Actions - Sidebar
  toggleExpanded: (id: string) => void;
  setExpanded: (id: string, expanded: boolean) => void;
  expandToPage: (id: string) => void;
  /** Load children for all currently expanded pages (called after initial load) */
  loadChildrenForExpandedPages: () => Promise<void>;

  // Queries (not actions, but useful accessors)
  getPage: (id: string) => Page | undefined;
  getChildren: (parentId: string | null) => Page[];
  getAncestors: (id: string) => PageBreadcrumb[];
  hasChildren: (id: string) => boolean;
  
  // Reset
  /** Reset store to initial state (for workspace switching) */
  reset: () => void;
}

// Helper to build indexes from pages (used for bulk operations)
function buildIndexes(pagesById: Record<string, Page>): {
  childrenIndex: Record<string, string[]>;
  dailyPagesIndex: Record<string, string>;
} {
  const childrenIndex: Record<string, string[]> = { [ROOT_KEY]: [] };
  const dailyPagesIndex: Record<string, string> = {};
  
  // Single pass to build both indexes
  for (const page of Object.values(pagesById)) {
    // Build children index (exclude daily pages from hierarchy)
    if (!page.isDailyNote) {
      const parentKey = isRootLevel(page.parentId) ? ROOT_KEY : page.parentId!;
      if (!childrenIndex[parentKey]) {
        childrenIndex[parentKey] = [];
      }
      childrenIndex[parentKey].push(page.id);
    }
    
    // Build daily pages index
    if (page.isDailyNote && page.dailyNoteDate) {
      dailyPagesIndex[page.dailyNoteDate] = page.id;
    }
  }
  
  // Sort children by order
  for (const key of Object.keys(childrenIndex)) {
    childrenIndex[key].sort((a, b) => {
      const pageA = pagesById[a];
      const pageB = pagesById[b];
      const orderA = pageA?.order ?? 0;
      const orderB = pageB?.order ?? 0;
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      // Secondary sort by creation date to keep it stable
      return (pageA?.created || '').localeCompare(pageB?.created || '');
    });
  }
  
  return { childrenIndex, dailyPagesIndex };
}

// ============================================================================
// INCREMENTAL INDEX UPDATES
// ============================================================================
// For single-page operations, avoid rebuilding all indexes from scratch.
// These helpers modify indexes in-place for O(1) to O(log n) operations.

/**
 * Insert a page into the children index (for create/move operations).
 * Maintains sorted order by page.order.
 */
function insertIntoChildrenIndex(
  childrenIndex: Record<string, string[]>,
  page: Page,
  pagesById: Record<string, Page>
): Record<string, string[]> {
  if (page.isDailyNote) return childrenIndex;
  
  const newIndex = { ...childrenIndex };
  const parentKey = isRootLevel(page.parentId) ? ROOT_KEY : page.parentId!;
  
  // Ensure parent array exists
  if (!newIndex[parentKey]) {
    newIndex[parentKey] = [];
  }
  
  // Don't add if already exists
  if (newIndex[parentKey].includes(page.id)) return childrenIndex;
  
  // Insert and sort only this parent's children
  newIndex[parentKey] = [...newIndex[parentKey], page.id].sort((a, b) => {
    const pageA = a === page.id ? page : pagesById[a];
    const pageB = b === page.id ? page : pagesById[b];
    const orderA = pageA?.order ?? 0;
    const orderB = pageB?.order ?? 0;
    
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    
    return (pageA?.created || '').localeCompare(pageB?.created || '');
  });
  
  return newIndex;
}

/**
 * Remove a page from the children index (for delete/move operations).
 */
function removeFromChildrenIndex(
  childrenIndex: Record<string, string[]>,
  pageId: string,
  parentId: string | null
): Record<string, string[]> {
  const parentKey = isRootLevel(parentId) ? ROOT_KEY : parentId!;
  
  if (!childrenIndex[parentKey]) return childrenIndex;
  
  const newIndex = { ...childrenIndex };
  newIndex[parentKey] = newIndex[parentKey].filter(id => id !== pageId);
  
  return newIndex;
}

/**
 * Update daily pages index for a single page.
 */
function updateDailyPagesIndex(
  dailyPagesIndex: Record<string, string>,
  page: Page,
  isDelete: boolean = false
): Record<string, string> {
  if (!page.isDailyNote || !page.dailyNoteDate) return dailyPagesIndex;
  
  const newIndex = { ...dailyPagesIndex };
  
  if (isDelete) {
    delete newIndex[page.dailyNoteDate];
  } else {
    newIndex[page.dailyNoteDate] = page.id;
  }
  
  return newIndex;
}

// Helper to find expanded children that need their children loaded
function findExpandedChildrenNeedingLoad(
  childIds: string[],
  expandedIds: Set<string>,
  pagesById: Record<string, Page>,
  childrenIndex: Record<string, string[]>
): string[] {
  return childIds.filter(childId => {
    if (!expandedIds.has(childId)) return false;
    const childPage = pagesById[childId];
    if (!childPage || !childPage.childCount) return false;
    const childLoadedCount = childrenIndex[childId]?.length ?? 0;
    return childLoadedCount < childPage.childCount;
  });
}

// Initialize expanded state (will be populated from fetched data)
const initialExpanded = new Set<string>();

// Build empty initial indexes
const initialPagesById: Record<string, Page> = {};
const initialIndexes = buildIndexes(initialPagesById);

export const usePagesStore = create<PagesState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initialize empty - data loaded via sync engine
        pagesById: initialPagesById,
        childrenIndex: initialIndexes.childrenIndex,
        dailyPagesIndex: initialIndexes.dailyPagesIndex,
        expandedIds: initialExpanded,
        
        // Pagination state for "All Pages" view
        hasMore: false,
        currentPage: 1,
        totalItems: 0,
        
        // Pagination state for sidebar tree (root-only)
        rootHasMore: false,
        rootCurrentPage: 1,
        rootTotalItems: 0,
        
        // Per-parent pagination state
        childrenPagination: {},
        
        // Editor state
        activePageId: null,
        draftTitle: '',
        draftContent: '',
        isDirty: false,
        isNewlyCreated: false,
        contentVersion: 0,
        
        dailyNoteDate: dayjs().format('YYYY-MM-DD'),
        isLoading: false,
        isContentLoading: false,
        contentUnavailableOffline: false,
        contentMayBeIncomplete: false,
        error: null,

        // ========================================================================
        // SYNC ENGINE INTEGRATION
        // These methods are called by sync engine events to update store state
        // ========================================================================

        applyBulkLoad: (pages, pagination) => {
          set(
            (state) => {
              // REPLACE instead of merge to handle items deleted from other devices
              // while this one was idle. The sync engine ensures "pages" 
              // is the authoritative current set from IndexedDB after reconciliation.
              const newPagesById: Record<string, Page> = {};
              pages.forEach((p) => {
                newPagesById[p.id] = mergePageWithPreservedContent(state.pagesById[p.id], p);
              });
              
              const indexes = buildIndexes(newPagesById);
              
              // Count root pages from the index
              const rootCount = (indexes.childrenIndex[ROOT_KEY] || []).length;
              
              // Initialize expandedIds from pages that have isExpanded: true
              // but only if we don't have any expanded IDs yet (initial load)
              const { expandedIds } = state;
              const newExpandedIds = new Set(expandedIds);
              if (expandedIds.size === 0) {
                pages.forEach(n => {
                  if (n.isExpanded) newExpandedIds.add(n.id);
                });
              }
              
              return {
                pagesById: newPagesById,
                childrenIndex: indexes.childrenIndex,
                dailyPagesIndex: indexes.dailyPagesIndex,
                expandedIds: newExpandedIds,
                totalItems: Object.keys(newPagesById).length,
                // Set pagination state from server if provided
                // For sidebar (root pages), use hasMore from sync engine
                rootHasMore: pagination?.hasMore ?? state.rootHasMore,
                rootTotalItems: pagination?.totalItems ?? Math.max(state.rootTotalItems, rootCount),
                isLoading: false,
              };
            },
            false,
            'applyBulkLoad'
          );
        },

        applyRemoteChange: (event) => {
          const { action, record, recordId } = event;
          const { pagesById, activePageId, isDirty, childrenIndex, dailyPagesIndex } = get();

          devLog(`[PagesStore] applyRemoteChange:`, action, record?.id || recordId, 'content length:', record?.content?.length || 0);

          switch (action) {
            case 'create':
              if (record && !pagesById[record.id]) {
                const newPagesById = { ...pagesById, [record.id]: record };
                // Page: parent's childCount will be updated by a separate SSE event from the server
                // The server's hook recalculates the count and broadcasts the parent's update
                
                // Use incremental index update instead of full rebuild
                const newChildrenIndex = insertIntoChildrenIndex(childrenIndex, record, newPagesById);
                const newDailyPagesIndex = updateDailyPagesIndex(dailyPagesIndex, record);
                set(
                  {
                    pagesById: newPagesById,
                    childrenIndex: newChildrenIndex,
                    dailyPagesIndex: newDailyPagesIndex,
                  },
                  false,
                  'applyRemoteChange/create'
                );
              }
              break;

            case 'update':
              if (record && pagesById[record.id]) {
                const existingPage = pagesById[record.id];
                
                // Merge: keep content if we have it and remote doesn't send it
                // For childCount, trust the server value - it's calculated via COUNT(*)
                // by the backend hooks and is the source of truth
                const mergedPage = {
                  ...existingPage,
                  ...record,
                  // Preserve content fields if remote doesn't send them
                  content: record.content ?? existingPage.content,
                };
                const newPagesById = { ...pagesById, [record.id]: mergedPage };
                
                // Only rebuild indexes if hierarchy changed (parentId or order)
                const hierarchyChanged = 
                  existingPage.parentId !== mergedPage.parentId ||
                  existingPage.order !== mergedPage.order ||
                  existingPage.isDailyNote !== mergedPage.isDailyNote;
                
                let newChildrenIndex = childrenIndex;
                let newDailyPagesIndex = dailyPagesIndex;
                
                if (hierarchyChanged) {
                  // Remove from old parent, add to new parent
                  newChildrenIndex = removeFromChildrenIndex(childrenIndex, record.id, existingPage.parentId);
                  newChildrenIndex = insertIntoChildrenIndex(newChildrenIndex, mergedPage, newPagesById);
                  newDailyPagesIndex = updateDailyPagesIndex(dailyPagesIndex, mergedPage);
                }
                
                // If this is the active page, update draft (unless dirty)
                const updateDraft = activePageId === record.id && !isDirty;
                const contentChanged = updateDraft && 
                  mergedPage.content !== existingPage.content &&
                  mergedPage.content !== get().draftContent;
                
                devLog(`[PagesStore] update check:`, {
                  activePageId,
                  recordId: record.id,
                  isDirty,
                  updateDraft,
                  existingContentLen: existingPage.content?.length || 0,
                  mergedContentLen: mergedPage.content?.length || 0,
                  draftContentLen: get().draftContent?.length || 0,
                  contentChanged,
                  willIncrementVersion: contentChanged,
                });
                
                set(
                  {
                    pagesById: newPagesById,
                    childrenIndex: newChildrenIndex,
                    dailyPagesIndex: newDailyPagesIndex,
                    ...(updateDraft ? {
                      draftTitle: mergedPage.title,
                      draftContent: mergedPage.content ?? '',
                      ...(contentChanged ? { contentVersion: get().contentVersion + 1 } : {}),
                    } : {}),
                  },
                  false,
                  'applyRemoteChange/update'
                );
              }
              break;

            case 'delete': {
              const idToDelete = recordId || record?.id;
              devLog(`[PagesStore] applyRemoteChange/delete: idToDelete=${idToDelete}, exists=${!!pagesById[idToDelete!]}`);
              if (idToDelete && pagesById[idToDelete]) {
                const deletedPage = pagesById[idToDelete];
                devLog(`[PagesStore] Deleting page ${idToDelete}, parentId=${deletedPage.parentId}`);
                const { [idToDelete]: _, ...remaining } = pagesById;
                // Page: parent's childCount will be updated by a separate SSE event from the server
                // The server's hook recalculates the count and broadcasts the parent's update
                
                // Use incremental index update instead of full rebuild
                const newChildrenIndex = removeFromChildrenIndex(childrenIndex, idToDelete, deletedPage.parentId);
                const newDailyPagesIndex = updateDailyPagesIndex(dailyPagesIndex, deletedPage, true);
                set(
                  {
                    pagesById: remaining,
                    childrenIndex: newChildrenIndex,
                    dailyPagesIndex: newDailyPagesIndex,
                    // Clear editor if this was the active page
                    ...(activePageId === idToDelete ? {
                      activePageId: null,
                      draftTitle: '',
                      draftContent: '',
                      isDirty: false,
                    } : {}),
                  },
                  false,
                  'applyRemoteChange/delete'
                );
              }
              break;
            }

            case 'bulk-load':
              // Handled by applyBulkLoad
              break;
          }
        },

        setLoading: (loading) => set({ isLoading: loading }, false, 'setLoading'),

        // ========================================================================
        // DATA LOADING (still needed for pagination/children)
        // ========================================================================

        loadPages: async (options) => {
          const actionName = options?.parentId 
            ? `loadPages/children/${options.parentId}`
            : options?.rootOnly 
              ? 'loadPages/root' 
              : options?.page && options.page > 1
                ? `loadPages/page/${options.page}`
                : 'loadPages/all';
          
          // Use deduplication to prevent duplicate concurrent requests
          return withDedup(actionName, async () => {
            // Only show loading spinner for initial loads, not for lazy child loads or pagination
            const showLoading = !options?.parentId && (!options?.page || options.page === 1);
            
            if (showLoading) {
              set({ isLoading: true, error: null }, false, `${actionName}/start`);
            }
            
            try {
              // Use syncEngine to load pages and persist to IndexedDB
              const result = await syncEngine.loadMoreNotes({
                rootOnly: options?.rootOnly,
                parentId: options?.parentId,
                pageSize: options?.limit ?? options?.pageSize,
                page: options?.page ?? 1,
                sortBy: options?.sortBy,
                sortDirection: options?.sortDirection,
              });
            
            const { pagesById: existingPages } = get();
            // Only replace when explicitly requested (e.g., refetchPages)
            // Otherwise always merge to preserve sidebar data when loading more in views
            const shouldReplace = options?.replace === true;
            
            let newPagesById: Record<string, Page>;
            if (shouldReplace) {
              // Replace all pages (initial load or explicit replace)
              newPagesById = Object.fromEntries(
                result.pages.map((n: Page) => [n.id, mergePageWithPreservedContent(existingPages[n.id], n)])
              );
            } else {
              // Merge into existing state (pagination or child loads)
              newPagesById = { ...existingPages };
              for (const page of result.pages) {
                newPagesById[page.id] = mergePageWithPreservedContent(existingPages[page.id], page);
              }
            }
            
            const indexes = buildIndexes(newPagesById);
            
            // Update per-parent pagination if this was a child load
            const parentId = options?.parentId;
            const isRootOnly = options?.rootOnly;
            const childrenPagination = parentId 
              ? {
                  ...get().childrenPagination,
                  [parentId]: {
                    hasMore: result.hasMore,
                    currentPage: options?.page ?? 1,
                  },
                }
              : get().childrenPagination;
            
            // Determine which pagination state to update
            let paginationUpdate = {};
            if (parentId) {
              // Child load - pagination handled above in childrenPagination
            } else if (isRootOnly) {
              // Root-only load - update sidebar pagination
              paginationUpdate = {
                rootHasMore: result.hasMore,
                rootCurrentPage: options?.page ?? 1,
                rootTotalItems: result.totalItems,
              };
            } else {
              // All pages load - update "All Pages" view pagination
              paginationUpdate = {
                hasMore: result.hasMore,
                currentPage: options?.page ?? 1,
                totalItems: result.totalItems,
              };
            }
            
            set(
              {
                pagesById: newPagesById,
                childrenIndex: indexes.childrenIndex,
                dailyPagesIndex: indexes.dailyPagesIndex,
                ...paginationUpdate,
                childrenPagination,
                isLoading: false,
              },
              false,
              `${actionName}/success`
            );
          } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Failed to fetch pages';
            console.error(`[pagesStore] ${actionName} error:`, errorMessage);
            set({ error: errorMessage, isLoading: false }, false, `${actionName}/error`);
            if (showLoading) throw e;
          }
          }); // End withDedup
        },

        loadMorePages: async (rootOnly, sortBy, sortDirection) => {
          // Use the appropriate pagination state based on rootOnly
          const state = get();
          const page = rootOnly ? state.rootCurrentPage : state.currentPage;
          const hasMorePages = rootOnly ? state.rootHasMore : state.hasMore;
          
          if (!hasMorePages) return;
          
          // Use sync engine to load more and persist to IndexedDB
          const result = await syncEngine.loadMoreNotes({
            rootOnly,
            page: page + 1,
            sortBy,
            sortDirection,
          });
          
          // Merge new pages into store
          const { pagesById: existingPages } = get();
          const newPagesById = { ...existingPages };
          for (const page of result.pages) {
            newPagesById[page.id] = mergePageWithPreservedContent(existingPages[page.id], page);
          }
          
          const indexes = buildIndexes(newPagesById);
          
          // Update pagination state
          const paginationUpdate = rootOnly
            ? {
                rootHasMore: result.hasMore,
                rootCurrentPage: page + 1,
                rootTotalItems: result.totalItems,
              }
            : {
                hasMore: result.hasMore,
                currentPage: page + 1,
                totalItems: result.totalItems,
              };
          
          set(
            {
              pagesById: newPagesById,
              childrenIndex: indexes.childrenIndex,
              dailyPagesIndex: indexes.dailyPagesIndex,
              ...paginationUpdate,
            },
            false,
            `loadMorePages/${rootOnly ? 'root' : 'all'}/page${page + 1}`
          );
        },
        
        loadMoreChildren: async (parentId: string, sortBy, sortDirection) => {
          const { childrenPagination } = get();
          const pagination = childrenPagination[parentId];
          
          // If we don't have pagination info or no more items, don't load
          if (!pagination || !pagination.hasMore) return;
          
          // Use sync engine to load more children and persist to IndexedDB
          const result = await syncEngine.loadMoreNotes({
            parentId,
            page: pagination.currentPage + 1,
            sortBy,
            sortDirection,
          });
          
          // Merge new pages into store
          const { pagesById: existingPages } = get();
          const newPagesById = { ...existingPages };
          for (const page of result.pages) {
            newPagesById[page.id] = mergePageWithPreservedContent(existingPages[page.id], page);
          }
          
          const indexes = buildIndexes(newPagesById);
          
          // Update children pagination state
          const newChildrenPagination = {
            ...get().childrenPagination,
            [parentId]: {
              hasMore: result.hasMore,
              currentPage: pagination.currentPage + 1,
            },
          };
          
          set(
            {
              pagesById: newPagesById,
              childrenIndex: indexes.childrenIndex,
              dailyPagesIndex: indexes.dailyPagesIndex,
              childrenPagination: newChildrenPagination,
            },
            false,
            `loadMoreChildren/${parentId}/page${pagination.currentPage + 1}`
          );
        },
        
        parentHasMore: (parentId: string) => {
          const { childrenPagination, pagesById, childrenIndex } = get();
          const pagination = childrenPagination[parentId];
          
          // If we have explicit pagination info, use it
          if (pagination) return pagination.hasMore;
          
          // Fallback: if loaded children count < expected childCount, there may be more
          const loadedCount = childrenIndex[parentId]?.length ?? 0;
          const expectedCount = pagesById[parentId]?.childCount ?? 0;
          return loadedCount < expectedCount;
        },

        refetchPages: async () => {
          // Refetch pages for window focus sync.
          // We need to preserve sidebar data, so:
          // 1. Load root pages (for sidebar tree)
          // 2. Load children for expanded pages (to restore expanded state)
          // We DON'T use replace:true here because that would wipe sidebar data
          // and only load PAGE_SIZE pages.
          await get().loadPages({ rootOnly: true });
          await get().loadChildrenForExpandedPages();
        },

        createPage: (input) => {
          const now = new Date().toISOString();
          const id = generateId();

          // Build default Yoopta content if empty
          let content = input.content ?? null;
          if (content === '' || content === '{}') {
            content = JSON.stringify({
              block1: {
                id: 'block1',
                type: 'Paragraph',
                meta: { order: 0, depth: 0 },
                value: [
                  {
                    id: 'val1',
                    type: 'paragraph',
                    children: [{ text: '' }],
                    props: { nodeType: 'block' },
                  },
                ],
              },
            });
          }

          // Calculate order among siblings - use maxOrder + 1 to ensure new items always go at the end
          const siblings = get().getChildren(input.parentId ?? null);
          const maxOrder = siblings.reduce((max, sibling) => Math.max(max, sibling.order ?? 0), -1);
          const order = maxOrder + 1;

          const newPage: Page = {
            id,
            title: input.title,
            content,
            excerpt: extractExcerpt(content), // Compute excerpt immediately
            created: now,
            updated: now,
            parentId: input.parentId ?? null,
            order,
            icon: input.icon ?? null,
            color: null,
            coverImage: null,
            coverGradient: null,
            coverAttribution: null,
            images: [],
            viewMode: input.viewMode ?? 'note',
            childrenViewMode: input.childrenViewMode ?? 'gallery',
            isDailyNote: input.isDailyNote ?? false,
            dailyNoteDate: input.dailyNoteDate ?? null,
            isExpanded: false,
            showChildrenInSidebar: input.showChildrenInSidebar ?? (input.viewMode === 'note' || !input.viewMode),
            isPinned: false,
            pinnedOrder: 0,
            childCount: 0, // New pages have no children
            // Task collection fields
            sections: [],
            tasksViewMode: 'list',
            tasksGroupBy: 'none',
            showCompletedTasks: false,
          };

          set(
            (state) => {
              const newPagesById = { ...state.pagesById, [id]: newPage };
              // Page: childCount is NOT updated here - server's SSE will send the correct value
              // This avoids race conditions between optimistic updates and SSE
              
              const indexes = buildIndexes(newPagesById);
              return {
                pagesById: newPagesById,
                childrenIndex: indexes.childrenIndex,
                dailyPagesIndex: indexes.dailyPagesIndex,
                // IMMEDIATELY set draft state so PageEditor is ready
                activePageId: id,
                draftTitle: newPage.title,
                draftContent: content ?? '',
                isDirty: false,
                isNewlyCreated: true,
                isContentLoading: false,
              };
            },
            false,
            'createPage'
          );

          // Fire-and-forget to offline sync engine (handles backend sync)
          offlineCreatePage(newPage).catch(console.error);

          return newPage;
        },

        updatePage: (id, updates) => {
          // Compute excerpt if content is being updated
          const currentPage = get().pagesById[id];
          const excerpt = 'content' in updates 
            ? extractExcerpt(updates.content ?? null) 
            : currentPage?.excerpt;
          
          // Include excerpt in updates for both local state and API
          const updatesWithExcerpt = 'content' in updates 
            ? { ...updates, excerpt }
            : updates;
          
          set(
            (state) => {
              const page = state.pagesById[id];
              if (!page) return state;
              
              const updatedPage = { 
                ...page, 
                ...updatesWithExcerpt, 
                updated: new Date().toISOString() 
              };
              const newPagesById = { ...state.pagesById, [id]: updatedPage };
              
              // Only rebuild indexes if hierarchy-related fields changed
              const needsReindex = 
                updates.parentId !== undefined ||
                updates.order !== undefined;
              
              if (needsReindex) {
                const indexes = buildIndexes(newPagesById);
                return {
                  pagesById: newPagesById,
                  childrenIndex: indexes.childrenIndex,
                  dailyPagesIndex: indexes.dailyPagesIndex,
                };
              }
              
              return { pagesById: newPagesById };
            },
            false,
            'updatePage'
          );
          // Send updates WITH excerpt to offline sync engine
          offlineUpdatePage(id, updatesWithExcerpt).catch(console.error);
        },

        updatePages: (ids, updates) => {
          set(
            (state) => {
              const newPagesById = { ...state.pagesById };
              let needsReindex = false;
              
              ids.forEach((id) => {
                const page = newPagesById[id];
                if (page) {
                  newPagesById[id] = { 
                    ...page, 
                    ...updates, 
                    updated: new Date().toISOString() 
                  };
                  if (updates.parentId !== undefined || updates.order !== undefined) {
                    needsReindex = true;
                  }
                }
              });
              
              if (needsReindex) {
                const indexes = buildIndexes(newPagesById);
                return {
                  pagesById: newPagesById,
                  childrenIndex: indexes.childrenIndex,
                  dailyPagesIndex: indexes.dailyPagesIndex,
                };
              }
              
              return { pagesById: newPagesById };
            },
            false,
            'updatePages'
          );
          // Update via offline-first adapter
          Promise.all(ids.map((id) => offlineUpdatePage(id, updates))).catch(console.error);
        },

        touchPageTimestamp: (id) => {
          const now = new Date().toISOString();
          const page = get().pagesById[id];
          if (!page) return;
          set(
            (state) => {
              const p = state.pagesById[id];
              if (!p) return state;
              return {
                pagesById: {
                  ...state.pagesById,
                  [id]: { ...p, updated: now },
                },
              };
            },
            false,
            'touchPageTimestamp'
          );
          // Persist via sync engine with the page's current title as a no-op field
          // so the server's `updated` timestamp also advances on sync
          offlineUpdatePage(id, { title: page.title }).catch(console.error);
        },

        deletePage: (id, cascade = false) => {
          const { pagesById, activePageId } = get();
          const pageToDelete = pagesById[id];
          if (!pageToDelete) return;
          
          const idsToDelete = new Set([id]);
          
          // Find direct children that will become orphaned
          const directChildren = Object.values(pagesById).filter((page) => page.parentId === id);

          // Find tasks that will be deleted if cascading
          let taskIdsToDelete: string[] = [];
          let deletedTasks: Task[] = [];

          if (cascade) {
            // Optimized: Build parent->children index once, then traverse
            const childrenByParent = new Map<string | null, string[]>();
            for (const page of Object.values(pagesById)) {
              const parentId = page.parentId;
              if (!childrenByParent.has(parentId)) {
                childrenByParent.set(parentId, []);
              }
              childrenByParent.get(parentId)!.push(page.id);
            }
            
            // BFS to find all descendants (iterative, not recursive)
            const queue = [id];
            while (queue.length > 0) {
              const currentId = queue.shift()!;
              const children = childrenByParent.get(currentId) || [];
              for (const childId of children) {
                if (!idsToDelete.has(childId)) {
                  idsToDelete.add(childId);
                  queue.push(childId);
                }
              }
            }

            // Also find tasks belonging to these pages
            const tasksStore = useTasksStore.getState();
            const tasksToDelete = Object.values(tasksStore.tasksById).filter(
              task => task.parentPageId && idsToDelete.has(task.parentPageId)
            );
            taskIdsToDelete = tasksToDelete.map(t => t.id);
            deletedTasks = tasksToDelete;
          }

          // Capture deleted pages for undo
          const deletedPages = Array.from(idsToDelete).map(deleteId => pagesById[deleteId]).filter(Boolean);
          const reparentedChildren = cascade ? [] : directChildren.map(child => ({ ...child, originalParentId: id }));

          set(
            (state) => {
              // Optimized: Build new object excluding deleted ids (single pass)
              const updatedById: Record<string, Page> = {};
              
              for (const [pageId, page] of Object.entries(state.pagesById)) {
                if (idsToDelete.has(pageId)) continue; // Skip deleted
                
                // If not cascade, reparent direct children to root
                if (!cascade && page.parentId === id) {
                  updatedById[pageId] = { ...page, parentId: null };
                } else {
                  updatedById[pageId] = page;
                }
              }
              
              // Optimistically decrement parent's childCount to prevent
              // the view from triggering a reload (which could race with delete)
              const parentId = pageToDelete.parentId;
              if (parentId && updatedById[parentId]) {
                updatedById[parentId] = {
                  ...updatedById[parentId],
                  childCount: Math.max(0, (updatedById[parentId].childCount || 0) - 1),
                };
              }
              
              // Rebuild indexes after deletion
              const indexes = buildIndexes(updatedById);
              
              return {
                pagesById: updatedById,
                childrenIndex: indexes.childrenIndex,
                dailyPagesIndex: indexes.dailyPagesIndex,
                activePageId: idsToDelete.has(activePageId ?? '') ? null : activePageId,
                draftTitle: idsToDelete.has(activePageId ?? '') ? '' : state.draftTitle,
                draftContent: idsToDelete.has(activePageId ?? '') ? '' : state.draftContent,
                isDirty: idsToDelete.has(activePageId ?? '') ? false : state.isDirty,
              };
            },
            false,
            'deletePage'
          );

          // Queue deletions to offline sync engine
          if (cascade) {
            // Delete tasks first
            if (taskIdsToDelete.length > 0) {
              useTasksStore.getState().deleteTasks(taskIdsToDelete);
            }

            // Queue all deletions individually (sync engine tracks each)
            for (const deleteId of idsToDelete) {
              offlineDeletePage(deleteId).catch(console.error);
            }
          } else {
            // Reparent orphans first (update their parentId), then delete
            for (const child of directChildren) {
              offlineUpdatePage(child.id, { parentId: null }).catch(console.error);
            }
            offlineDeletePage(id).catch(console.error);
          }

          // Show toast with undo
          const pageTitle = pageToDelete.title || 'Untitled';
          const deletedCount = idsToDelete.size;
          toastSuccess(
            cascade && deletedCount > 1
              ? `Deleted "${pageTitle}" and ${deletedCount - 1} child page${deletedCount > 2 ? 's' : ''}`
              : `Deleted "${pageTitle}"`,
            () => {
              // Restore deleted pages to store
              set((state) => {
                const restoredById = { ...state.pagesById };
                for (const page of deletedPages) {
                  restoredById[page.id] = page;
                }
                // Restore children's original parent if they were reparented
                for (const child of reparentedChildren) {
                  if (restoredById[child.id]) {
                    restoredById[child.id] = { ...restoredById[child.id], parentId: child.originalParentId };
                  }
                }
                const indexes = buildIndexes(restoredById);
                return {
                  pagesById: restoredById,
                  childrenIndex: indexes.childrenIndex,
                  dailyPagesIndex: indexes.dailyPagesIndex,
                };
              }, false, 'undoDeletePage');

              // Restore deleted tasks
              if (deletedTasks.length > 0) {
                // We use setState to merge back the deleted tasks
                useTasksStore.setState((state) => ({
                  tasksById: { ...state.tasksById, ...Object.fromEntries(deletedTasks.map(t => [t.id, t])) },
                  taskOrder: [...state.taskOrder, ...deletedTasks.map(t => t.id)]
                }));
              }
            }
          );
        },

        deletePages: (ids) => {
          const { pagesById, activePageId } = get();
          const pagesToDelete = ids.map(id => pagesById[id]).filter(Boolean);
          if (pagesToDelete.length === 0) return;

          // Find tasks belonging to these pages
          const tasksStore = useTasksStore.getState();
          const idsSet = new Set(ids);
          const tasksToDelete = Object.values(tasksStore.tasksById).filter(
            task => task.parentPageId && idsSet.has(task.parentPageId)
          );
          const taskIdsToDelete = tasksToDelete.map(t => t.id);

          set(
            (state) => {
              const updatedById = { ...state.pagesById };
              ids.forEach(id => {
                const page = updatedById[id];
                if (page) {
                  // Decrement parent childCount
                  if (page.parentId && updatedById[page.parentId]) {
                    updatedById[page.parentId] = {
                      ...updatedById[page.parentId],
                      childCount: Math.max(0, (updatedById[page.parentId].childCount || 0) - 1),
                    };
                  }
                  delete updatedById[id];
                }
              });

              const indexes = buildIndexes(updatedById);
              return {
                pagesById: updatedById,
                childrenIndex: indexes.childrenIndex,
                dailyPagesIndex: indexes.dailyPagesIndex,
                activePageId: ids.includes(activePageId ?? '') ? null : activePageId,
                draftTitle: ids.includes(activePageId ?? '') ? '' : state.draftTitle,
                draftContent: ids.includes(activePageId ?? '') ? '' : state.draftContent,
                isDirty: ids.includes(activePageId ?? '') ? false : state.isDirty,
              };
            },
            false,
            'deletePages'
          );

          // Queue deletions
          if (taskIdsToDelete.length > 0) {
            useTasksStore.getState().deleteTasks(taskIdsToDelete);
          }
          Promise.all(ids.map(id => offlineDeletePage(id))).catch(console.error);

          // Show toast with undo
          toastSuccess(`Deleted ${pagesToDelete.length} pages`, () => {
            set((state) => {
              const restoredById = { ...state.pagesById };
              pagesToDelete.forEach(p => { restoredById[p.id] = p; });
              
              // Restore parent childCounts
              pagesToDelete.forEach(p => {
                if (p.parentId && restoredById[p.parentId]) {
                  restoredById[p.parentId] = {
                    ...restoredById[p.parentId],
                    childCount: (restoredById[p.parentId].childCount || 0) + 1,
                  };
                }
              });

              const indexes = buildIndexes(restoredById);
              return {
                pagesById: restoredById,
                childrenIndex: indexes.childrenIndex,
                dailyPagesIndex: indexes.dailyPagesIndex,
              };
            }, false, 'undoDeletePages');

            // Restore tasks
            if (tasksToDelete.length > 0) {
              useTasksStore.setState((state) => ({
                tasksById: { ...state.tasksById, ...Object.fromEntries(tasksToDelete.map(t => [t.id, t])) },
                taskOrder: [...state.taskOrder, ...tasksToDelete.map(t => t.id)]
              }));
            }
          });
        },

        movePage: (id, newParentId) => {
          // Prevent moving to self or descendant
          if (id === newParentId) return;
          
          const { pagesById } = get();
          const page = pagesById[id];
          if (!page) return;
          
          const oldParentId = page.parentId;

          // Check if newParentId is a descendant of id
          let current = newParentId ? pagesById[newParentId] : null;
          while (current) {
            if (current.parentId === id) {
              devLog('Cannot move a page into its own descendant');
              return;
            }
            current = current.parentId ? pagesById[current.parentId] : null;
          }

          // Calculate new order
          const newSiblings = get().getChildren(newParentId);
          const maxOrder = newSiblings.reduce((max, sibling) => Math.max(max, sibling.order ?? 0), -1);
          const order = maxOrder + 1;

          set(
            (state) => {
              const newPagesById = {
                ...state.pagesById,
                [id]: {
                  ...page,
                  parentId: newParentId,
                  order,
                  updatedAt: new Date().toISOString(),
                },
              };
              
              // Update childCount for old and new parents
              if (oldParentId !== newParentId) {
                // Decrement old parent's childCount
                if (oldParentId && newPagesById[oldParentId]) {
                  newPagesById[oldParentId] = {
                    ...newPagesById[oldParentId],
                    childCount: Math.max(0, (newPagesById[oldParentId].childCount || 0) - 1),
                  };
                }
                // Increment new parent's childCount
                if (newParentId && newPagesById[newParentId]) {
                  newPagesById[newParentId] = {
                    ...newPagesById[newParentId],
                    childCount: (newPagesById[newParentId].childCount || 0) + 1,
                  };
                }
              }
              
              const indexes = buildIndexes(newPagesById);
              return {
                pagesById: newPagesById,
                childrenIndex: indexes.childrenIndex,
                dailyPagesIndex: indexes.dailyPagesIndex,
              };
            },
            false,
            'movePage'
          );
          offlineUpdatePage(id, { parentId: newParentId, order }).catch(console.error);
        },

        reorderPages: (parentId, orderedIds) => {
          // Build the updates with new order values
          const updates: Array<{ id: string; updates: { order: number } }> = [];
          
          set(
            (state) => {
              const pageUpdates: Record<string, Page> = {};
              orderedIds.forEach((id, index) => {
                const page = state.pagesById[id];
                if (page && page.order !== index) {
                  pageUpdates[id] = { ...page, order: index };
                  updates.push({ id, updates: { order: index } });
                }
              });
              
              if (Object.keys(pageUpdates).length === 0) {
                return state; // No changes
              }
              
              const newPagesById = { ...state.pagesById, ...pageUpdates };
              const indexes = buildIndexes(newPagesById);
              return {
                pagesById: newPagesById,
                childrenIndex: indexes.childrenIndex,
                dailyPagesIndex: indexes.dailyPagesIndex,
              };
            },
            false,
            'reorderPages'
          );
          
          // Queue updates to offline sync engine (individually tracked)
          for (const update of updates) {
            offlineUpdatePage(update.id, update.updates).catch(console.error);
          }
        },

        // Editor state management
        selectPage: async (id, isNew = false, forceRefresh = false, isBackground = false) => {
          if (!id) {
            if (!isBackground) {
              set(
                {
                  activePageId: null,
                  draftTitle: '',
                  draftContent: '',
                  isDirty: false,
                  isNewlyCreated: false,
                  isContentLoading: false,
                },
                false,
                'selectPage/clear'
              );
            }
            return;
          }

          const { pagesById, activePageId, isNewlyCreated, isContentLoading } = get();
          const page = pagesById[id];
          
          // If this page is already active AND was just created, skip redundant fetch
          // This handles the case where createPage sets state, then view's useEffect calls selectPage
          if (activePageId === id && isNewlyCreated && !isBackground) {
            return; // Already set up correctly by createPage
          }
          
          // If we're already loading this page, skip (handles React StrictMode double-invoke)
          if (activePageId === id && isContentLoading && !isBackground) {
            return; // Already fetching this page
          }
          
          // Always fetch fresh content from backend (unless newly created)
          // This ensures we have the latest version even if edited on another device
          // Uses sync engine which handles caching in IndexedDB
          if (!isNew) {
            // Set activePageId and mark content as loading
            // Show existing title/content as placeholder while fetching
            if (!isBackground) {
              set(
                {
                  activePageId: id,
                  draftTitle: page?.title ?? '',
                  draftContent: page?.content ?? '', // Show cached content while loading
                  isDirty: false,
                  isNewlyCreated: false,
                  isContentLoading: true, // Signal to PageEditor that fresh data is coming
                  contentUnavailableOffline: false, // Reset until we know
                  contentMayBeIncomplete: false, // Reset until we know
                },
                false,
                'selectPage/loading'
              );
            }
            
            try {
              // Use sync engine to ensure content (handles caching in IndexedDB)
              // Pass forceRefresh to skip cache on page load/reload
              const { page: fullPage, contentAvailableOffline, contentMayBeIncomplete } = await syncEngine.ensurePageContent(id, forceRefresh);
              
              if (!fullPage) {
                // Only clear loading if we're still the active page
                if (!isBackground && get().activePageId === id) {
                  set({ isContentLoading: false }, false, 'selectPage/notFound');
                }
                return;
              }
              
              // Merge full page with existing metadata
              const existingPage = get().pagesById[id];
              const mergedPage = {
                ...existingPage,  // Keep existing metadata
                ...fullPage,      // Overlay with full page data (always use fresh content)
                // Excerpt should be derived from the full page's content, not preserved from stale metadata.
                // If fullPage has content, compute excerpt from it. Otherwise use what's available.
                excerpt: fullPage.content 
                  ? (extractExcerpt(fullPage.content) ?? null)
                  : (fullPage.excerpt ?? existingPage?.excerpt ?? null),
              };
              
              // Update store with merged page
              set(
                (state) => ({
                  pagesById: {
                    ...state.pagesById,
                    [id]: mergedPage,
                  },
                  // Only update draft/loading state if this is the active page
                  ...(state.activePageId === id ? {
                    isContentLoading: false,
                    contentUnavailableOffline: !contentAvailableOffline,
                    contentMayBeIncomplete: contentMayBeIncomplete,
                    draftTitle: mergedPage.title,
                    draftContent: mergedPage.content ?? '',
                  } : {})
                }),
                false,
                'selectPage/fetchContent'
              );
              return;
            } catch (e) {
              console.error('[pagesStore] Failed to fetch page content:', e);
              if (!isBackground && get().activePageId === id) {
                set({ isContentLoading: false }, false, 'selectPage/error');
              }
            }
            return;
          }

          if (!isBackground) {
            set(
              {
                activePageId: id,
                draftTitle: page?.title ?? '',
                draftContent: page?.content ?? '',
                isDirty: false,
                isNewlyCreated: isNew,
                isContentLoading: false, // Content is immediately available
                contentUnavailableOffline: false, // New pages have content available
                contentMayBeIncomplete: false, // New pages are complete
              },
              false,
              'selectPage'
            );
          }
        },

        setDraftTitle: (title) => set({ draftTitle: title, isDirty: true }, false, 'setDraftTitle'),
        setDraftContent: (content) =>
          set({ draftContent: content, isDirty: true }, false, 'setDraftContent'),

        saveCurrentPage: async () => {
          const { activePageId, draftTitle, draftContent } = get();
          if (!activePageId) return;
          
          // With CRDT-based sync, just save directly.
          // Conflicts are resolved automatically via block-level Last-Writer-Wins.
          get().updatePage(activePageId, {
            title: draftTitle,
            content: draftContent,
          });
          set({ isDirty: false }, false, 'saveCurrentPage');
        },

        discardDraft: () => {
          const { activePageId, pagesById } = get();
          const page = activePageId ? pagesById[activePageId] : null;
          set(
            {
              draftTitle: page?.title ?? '',
              draftContent: page?.content ?? '',
              isDirty: false,
            },
            false,
            'discardDraft'
          );
        },

        clearNewlyCreated: () => set({ isNewlyCreated: false }, false, 'clearNewlyCreated'),

        // Daily pages
        setDailyPageDate: (date) => set({ dailyNoteDate: date }, false, 'setDailyPageDate'),

        findOrCreateDailyPage: (date) => {
          const { pagesById, dailyPagesIndex, createPage } = get();

          // O(1) lookup using index
          const existingId = dailyPagesIndex[date];
          if (existingId && pagesById[existingId]) {
            return pagesById[existingId];
          }

          // Create new daily page
          const title = dayjs(date).format('dddd, MMMM D, YYYY');
          return createPage({
            title,
            isDailyNote: true,
            dailyNoteDate: date,
            parentId: null,
            viewMode: 'note',
          });
        },

        // Sidebar expansion - with lazy-loading of children (deduplicated)
        toggleExpanded: (id) => {
          const { expandedIds, childrenIndex, loadPages, pagesById } = get();
          const wasExpanded = expandedIds.has(id);
          
          // Update expansion state immediately (optimistic UI)
          set(
            (state) => {
              const newExpanded = new Set(state.expandedIds);
              if (newExpanded.has(id)) {
                newExpanded.delete(id);
              } else {
                newExpanded.add(id);
              }
              return { expandedIds: newExpanded };
            },
            false,
            'toggleExpanded'
          );
          
          // If collapsing, nothing more to do
          if (wasExpanded) return;
          
          // Helper to load children for expanded nodes
          const loadExpandedChildrenRecursively = (parentId: string) => {
            const { childrenIndex: idx, expandedIds: exp, pagesById: pages } = get();
            const childIds = idx[parentId] || [];
            const needsLoad = findExpandedChildrenNeedingLoad(childIds, exp, pages, idx);
            
            if (needsLoad.length > 0) {
              Promise.all(
                needsLoad.map(childId => loadPages({ parentId: childId, sortBy: 'order', sortDirection: 'asc' }))
              ).catch(() => {});
            }
          };
          
          const page = pagesById[id];
          const loadedChildCount = childrenIndex[id]?.length ?? 0;
          const expectedChildCount = page?.childCount ?? 0;
          
          // Load children if page has unloaded children
          if (page && expectedChildCount > 0 && loadedChildCount < expectedChildCount) {
            loadPages({ parentId: id, sortBy: 'order', sortDirection: 'asc' })
              .then(() => loadExpandedChildrenRecursively(id))
              .catch(() => {});
          } else {
            // Children already loaded - check if expanded children need their children
            loadExpandedChildrenRecursively(id);
          }
        },

        /**
         * Load children for all currently expanded pages.
         * Called after initial load to restore expanded state with data.
         * Uses childCount from backend to know which pages have children.
         * Loads in waves to handle deeply nested expanded trees.
         */
        loadChildrenForExpandedPages: async () => {
          const loadChildrenWave = async (pageIds: string[]): Promise<string[]> => {
            const { childrenIndex, pagesById, loadPages, expandedIds } = get();
            
            // Filter to pages that:
            // 1. Are expanded
            // 2. Have children (childCount > 0)
            // 3. But NOT all children are loaded yet (loaded < expected)
            const needsChildren = pageIds.filter(id => {
              const page = pagesById[id];
              if (!page) return false;
              const isExpanded = expandedIds.has(id);
              const expectedChildCount = page.childCount ?? 0;
              const loadedChildCount = childrenIndex[id]?.length ?? 0;
              return isExpanded && expectedChildCount > 0 && loadedChildCount < expectedChildCount;
            });
            
            if (needsChildren.length === 0) return [];
            
            // Load all children in parallel, using tree order (not user's view preference)
            await Promise.all(
              needsChildren.map(parentId => loadPages({ parentId, sortBy: 'order', sortDirection: 'asc' }))
            );
            
            // Return the IDs of children that were loaded AND are expanded (for recursive wave)
            const { childrenIndex: updatedIndex, expandedIds: currentExpanded, pagesById: updatedPages } = get();
            const loadedChildIds: string[] = [];
            for (const parentId of needsChildren) {
              const childIds = updatedIndex[parentId] || [];
              // Include children that are expanded (we'll check if they have children in the next wave)
              for (const childId of childIds) {
                if (currentExpanded.has(childId)) {
                  loadedChildIds.push(childId);
                }
              }
            }
            
            return loadedChildIds;
          };
          
          // Start with root-level expanded items that are actually in the store
          const { expandedIds, childrenIndex, pagesById } = get();
          const rootChildren = childrenIndex[ROOT_KEY] || [];
          const expandedRoots = rootChildren.filter(id => expandedIds.has(id) && pagesById[id]);
          
          // Only start with roots - deeper expanded pages will be discovered as their parents are loaded
          let currentWave = expandedRoots;
          let maxWaves = 10; // Safety limit for deeply nested trees
          
          while (currentWave.length > 0 && maxWaves > 0) {
            const nextWave = await loadChildrenWave(currentWave);
            currentWave = nextWave;
            maxWaves--;
          }
          
          if (maxWaves === 0 && currentWave.length > 0) {
            devLog('[pagesStore] Reached max waves for loading expanded children');
          }
        },

        setExpanded: (id, expanded) => {
          set(
            (state) => {
              const newExpanded = new Set(state.expandedIds);
              if (expanded) {
                newExpanded.add(id);
              } else {
                newExpanded.delete(id);
              }
              return { expandedIds: newExpanded };
            },
            false,
            'setExpanded'
          );
        },

        expandToPage: (id) => {
          const { pagesById } = get();
          const ancestors = getAncestorChain(pagesById, id);
          set(
            (state) => {
              const newExpanded = new Set(state.expandedIds);
              ancestors.forEach((a) => newExpanded.add(a.id));
              return { expandedIds: newExpanded };
            },
            false,
            'expandToPage'
          );
        },

        // Queries - O(1) using indexes
        getPage: (id) => get().pagesById[id],

        getChildren: (parentId) => {
          const { pagesById, childrenIndex } = get();
          const parentKey = isRootLevel(parentId) ? ROOT_KEY : parentId!;
          const childIds = childrenIndex[parentKey] || [];
          return childIds.map(id => pagesById[id]).filter(Boolean);
        },

        getAncestors: (id) => {
          const { pagesById } = get();
          return getAncestorChain(pagesById, id);
        },

        hasChildren: (id) => {
          const { childrenIndex } = get();
          return (childrenIndex[id]?.length ?? 0) > 0;
        },

        // Reset store to initial state (for workspace switching)
        reset: () => {
          set(
            {
              pagesById: {},
              childrenIndex: { [ROOT_KEY]: [] },
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
              isLoading: false,
              isContentLoading: false,
              contentUnavailableOffline: false,
              contentMayBeIncomplete: false,
              error: null,
            },
            false,
            'reset'
          );
        },
        
      }),
      {
        name: 'planneer-pages',
        partialize: (state) => ({
          expandedIds: Array.from(state.expandedIds),
          dailyNoteDate: state.dailyNoteDate,
        }),
        merge: (persisted, current) => {
          const persistedState = persisted as Partial<PagesState> & { expandedIds?: string[] };
          return {
            ...current,
            expandedIds: persistedState.expandedIds
              ? new Set(persistedState.expandedIds)
              : current.expandedIds,
            dailyNoteDate: persistedState.dailyNoteDate ?? current.dailyNoteDate,
          };
        },
      }
    ),
    { name: 'PagesStore' }
  )
);

// ============================================================================
// SELECTORS
// ============================================================================

export const selectPages = (state: PagesState): Page[] => Object.values(state.pagesById);

export const selectPageTree = (state: PagesState): PageTreeNode[] =>
  buildPageTree(selectPages(state));

export const selectActivePage = (state: PagesState): Page | null =>
  state.activePageId ? state.pagesById[state.activePageId] : null;

export const selectPageChildren =
  (parentId: string | null) =>
  (state: PagesState): Page[] =>
    selectPages(state)
      .filter((n) => n.parentId === parentId && !n.isDailyNote)
      .sort((a, b) => a.order - b.order);

export const selectPageAncestors =
  (pageId: string) =>
  (state: PagesState): import('@/types/page').PageBreadcrumb[] =>
    getAncestorChain(state.pagesById, pageId);

export const selectDailyPages = (state: PagesState): Page[] =>
  selectPages(state).filter((n) => n.isDailyNote);

export const selectDailyPageByDate =
  (date: string) =>
  (state: PagesState): Page | null =>
    selectPages(state).find((n) => n.isDailyNote && n.dailyNoteDate === date) ?? null;

export const selectRootPages = (state: PagesState): Page[] =>
  selectPages(state)
    .filter((n) => n.parentId === null && !n.isDailyNote)
    .sort((a, b) => a.order - b.order);

export const selectPagesBySearch =
  (query: string) =>
  (state: PagesState): Page[] => {
    if (!query.trim()) return selectPages(state);
    const lowerQuery = query.toLowerCase();
    return selectPages(state).filter(
      (n) =>
        n.title.toLowerCase().includes(lowerQuery) ||
        (n.content && JSON.stringify(n.content).toLowerCase().includes(lowerQuery))
    );
  };

// ============================================================================
// TASK COLLECTION SELECTORS (pages with viewMode='tasks')
// ============================================================================

/** Select all task collection pages (viewMode === 'tasks') */
export const selectTaskCollections = (state: PagesState): Page[] =>
  selectPages(state)
    .filter((p) => p.viewMode === 'tasks')
    .sort((a, b) => a.order - b.order);

/** Select sections for a specific task collection */
export const selectTaskCollectionSections =
  (pageId: string) =>
  (state: PagesState): import('@/types/page').Section[] => {
    const page = state.pagesById[pageId];
    return page?.sections ?? [];
  };

/** Select root-level task collections (no parent) */
export const selectRootTaskCollections = (state: PagesState): Page[] =>
  selectTaskCollections(state).filter((p) => p.parentId === null);

/** Build tree of task collections */
export const selectTaskCollectionTree = (state: PagesState): PageTreeNode[] =>
  buildPageTree(selectTaskCollections(state));

// ============================================================================
// COMBINED SELECTORS (for useShallow - must return stable shapes)
// ============================================================================

/** Select raw page state (use with useShallow) */
export const selectPageState = (state: PagesState) => ({
  pagesById: state.pagesById,
  expandedIds: state.expandedIds,
  dailyNoteDate: state.dailyNoteDate,
  // "All Pages" view pagination
  totalItems: state.totalItems,
  hasMore: state.hasMore,
  // Sidebar (root-only) pagination
  rootTotalItems: state.rootTotalItems,
  rootHasMore: state.rootHasMore,
});

/** Select editor state for page editing components (use with useShallow) */
export const selectEditorState = (state: PagesState) => ({
  activePageId: state.activePageId,
  draftTitle: state.draftTitle,
  draftContent: state.draftContent,
  isDirty: state.isDirty,
});

/** Select page actions (use with useShallow) */
export const selectPageActions = (state: PagesState) => ({
  // New page-based names
  createPage: state.createPage,
  updatePage: state.updatePage,
  deletePage: state.deletePage,
  movePage: state.movePage,
  reorderPages: state.reorderPages,
  selectPage: state.selectPage,
  setDraftTitle: state.setDraftTitle,
  setDraftContent: state.setDraftContent,
  saveCurrentPage: state.saveCurrentPage,
  discardDraft: state.discardDraft,
  toggleExpanded: state.toggleExpanded,
  setExpanded: state.setExpanded,
  expandToPage: state.expandToPage,
  setDailyPageDate: state.setDailyPageDate,
  findOrCreateDailyPage: state.findOrCreateDailyPage,
  getPage: state.getPage,
  getChildren: state.getChildren,
  getAncestors: state.getAncestors,
  hasChildren: state.hasChildren,
  loadMoreChildren: state.loadMoreChildren,
  parentHasMore: state.parentHasMore,
  loadMorePages: state.loadMorePages,
});

/** 
 * Hook to get pages array and tree - derives from raw state with memoization.
 * Use this instead of manually deriving in components.
 * 
 * PERFORMANCE: Memoizes both the pages array and tree to prevent
 * O(n) operations on every render. With 25K+ pages, this is critical.
 */
export const usePages = () => {
  const pagesById = usePagesStore((state) => state.pagesById);
  
  // Memoize the pages array - only recompute when pagesById changes
  const pages = useMemo(() => Object.values(pagesById), [pagesById]);
  
  // Memoize the tree - only rebuild when pages array identity changes
  const pageTree = useMemo(() => buildPageTree(pages), [pages]);
  
  // Return both new names and backward-compat aliases
  return { 
    pages, 
    pageTree,
  };
};

/**
 * Hook for getting recent pages (sorted by updated, non-daily).
 * More efficient than usePages() when you only need top N recent.
 * 
 * @param limit Maximum number of pages to return (default 6)
 */
export const useRecentPages = (limit: number = 6) => {
  const pagesById = usePagesStore((state) => state.pagesById);
  
  return useMemo(() => {
    return Object.values(pagesById)
      .sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime())
      .slice(0, limit);
  }, [pagesById, limit]);
};

/**
 * Hook for getting count of pages (for sidebar badges).
 * More efficient than usePages().pages.length.
 */
export const usePageCount = () => {
  const pagesById = usePagesStore((state) => state.pagesById);
  
  return useMemo(() => {
    const pages = Object.values(pagesById);
    return {
      total: pages.length,
      pages: pages.filter(n => !n.isDailyNote).length,
      daily: pages.filter(n => n.isDailyNote).length,
    };
  }, [pagesById]);
};

/**
 * Hook for getting pinned/favorite pages (sorted by pinnedOrder).
 * More efficient than filtering all pages in a component.
 * 
 * @param limit Maximum number of pinned pages to return (default unlimited)
 */
export const usePinnedPages = (limit?: number) => {
  const pagesById = usePagesStore((state) => state.pagesById);
  
  return useMemo(() => {
    const pinnedPages = Object.values(pagesById)
      .filter((p) => p.isPinned)
      .sort((a, b) => (a.pinnedOrder ?? 0) - (b.pinnedOrder ?? 0));
    
    return limit ? pinnedPages.slice(0, limit) : pinnedPages;
  }, [pagesById, limit]);
};

/**
 * Hook for getting dates that have daily pages.
 * Uses the pre-computed dailyPagesIndex for O(1) lookups.
 * More efficient than filtering all pages.
 */
export const useDailyPageDates = () => {
  const dailyPagesIndex = usePagesStore((state) => state.dailyPagesIndex);
  
  // Return array of dates (YYYY-MM-DD) - the index keys
  return useMemo(() => Object.keys(dailyPagesIndex), [dailyPagesIndex]);
};

/**
 * Hook for getting task collections (pages with viewMode='tasks').
 * Replaces the old useProjects() hook.
 */
export const useTaskCollections = () => {
  const pagesById = usePagesStore((state) => state.pagesById);
  
  return useMemo(() => {
    const taskCollections = Object.values(pagesById)
      .filter((p) => p.viewMode === 'tasks')
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return (a.created || '').localeCompare(b.created || '');
      });
    
    const taskCollectionTree = buildPageTree(taskCollections);
    
    return { taskCollections, taskCollectionTree };
  }, [pagesById]);
};