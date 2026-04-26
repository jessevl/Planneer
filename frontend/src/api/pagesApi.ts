/**
 * @file pagesApi.ts
 * @description Unified Page API layer with PocketBase integration
 * @app UNIFIED PAGES
 *
 * Handles page CRUD operations including hierarchy management.
 * All pages belong to a workspace (team-based multi-tenancy).
 * 
 * =============================================================================
 * UNIFIED PAGES MODEL
 * =============================================================================
 * Pages have four view modes:
 * - 'note': Regular pages/documents (full editor primary)
 * - 'collection': Container for child pages (children as main focus)
 * - 'tasks': Task collection (replaces legacy projects)
 * 
 * =============================================================================
 * API DESIGN: PAGINATED + METADATA-FIRST
 * =============================================================================
 * - fetchPages(): Paginated fetch WITHOUT content (for lists/trees)
 *   - Always paginates (default 100, can override)
 *   - Always sorts by indexed field (updated desc by default)
 *   - Optionally filters by rootOnly, parentId, or viewMode
 *   - Returns hasMore flag for "Load More" UI
 * 
 * - fetchPage(): Single page WITH full content (for editor)
 * 
 * - Excerpt field is auto-computed on create/update for card previews
 * - childCount field is maintained by PocketBase hooks
 * 
 * - uploadPageImage(): Upload image to page's images field
 */
import type { Page, UpdatePageInput } from '@/types/page';
import type { ImageUploadResult } from '@/lib/imageUtils';
import { PAGES_PAGINATION } from '@/lib/config';
import {
  pb,
  collections,
  createInWorkspace,
  updateRecord,
  deleteRecord,
  pbToFrontend,
  buildWorkspaceFilter,
  safeFilter,
  batchDelete,
  batchUpdate,
} from '@/lib/pocketbase';
import { getCurrentWorkspaceIdOrNull } from '@/stores/workspaceStore';
import { PAGE_METADATA_FIELDS } from '@/lib/syncEngine/utils';

/**
 * Fields to fetch for list/card views (excludes heavy content field).
 * Derived from PAGE_METADATA_FIELDS + additional PocketBase fields.
 * Includes file metadata so pages keep attachment and preview filenames when
 * the store is refreshed from metadata-only queries.
 */
const METADATA_FIELDS = [
  'id',
  ...PAGE_METADATA_FIELDS,
  'images',
  'files',
  'thumbnail',
  'previewThumbnail',
  'sourcePageCount',
  'created',
  'updated',
  'workspace',
].join(',');

import { devLog, devWarn } from '@/lib/config';

// ============================================================================
// FETCH OPERATIONS
// ============================================================================

/**
 * Options for fetching pages (paginated, without content)
 */
export interface FetchPagesOptions {
  /** Only fetch root-level pages (parentId is null/empty). Mutually exclusive with parentId. */
  rootOnly?: boolean;
  /** Only fetch parentless Inbox pages. Mutually exclusive with rootOnly and parentId. */
  inboxOnly?: boolean;
  /** Fetch children of a specific parent ID. Mutually exclusive with rootOnly. */
  parentId?: string;
  /** Filter by view mode (e.g., 'tasks' to get only task collections) */
  viewMode?: 'page' | 'collection' | 'tasks';
  /** Sort field - must be an indexed field (default: 'updated', use 'order' for tree view) */
  sortBy?: 'updated' | 'created' | 'order' | 'title';
  /** Sort direction (default: 'desc') */
  sortDirection?: 'asc' | 'desc';
  /** Page size (default: 100) */
  pageSize?: number;
  /** Page number, 1-indexed (default: 1) */
  page?: number;
  /** Hard limit - return at most this many (for HomeView recent pages) */
  limit?: number;
}

/**
 * Result of a paginated pages fetch
 */
export interface FetchPagesResult {
  pages: Page[];
  totalItems: number;
  totalPages: number;
  page: number;
  hasMore: boolean;
}

/**
 * Fetch pages metadata (WITHOUT content) with pagination.
 * 
 * This is the primary function for loading pages in list views, sidebar trees, etc.
 * Content is always null - use fetchPage(id) to load full content for editor.
 * 
 * @param options - Filter, sort, and pagination options
 * @returns Paginated result with pages and pagination info
 */
export async function fetchPages(options?: FetchPagesOptions): Promise<FetchPagesResult> {
  const sortBy = options?.sortBy ?? 'updated';
  const sortDirection = options?.sortDirection ?? 'desc';
  const sortPrefix = sortDirection === 'desc' ? '-' : '';
  
  // All queries respect pagination from config
  // Use options.pageSize to override, or fall back to global PAGE_SIZE
  const pageSize = options?.limit ?? options?.pageSize ?? PAGES_PAGINATION.PAGE_SIZE;
  const page = options?.page ?? 1;

  const workspaceId = getCurrentWorkspaceIdOrNull();
  if (!workspaceId) {
    devWarn('[pagesApi] No workspace selected, returning empty pages');
    return { pages: [], totalItems: 0, totalPages: 0, page: 1, hasMore: false };
  }

  // Build filter conditions
  const filters: string[] = [];
  
  if (options?.rootOnly) {
    // Root-only query for sidebar tree - exclude daily notes and Inbox pages.
    filters.push(`(parentId = '' || parentId = null)`);
    filters.push(`isTopLevel = true`);
    filters.push(`isDailyNote = false`);
  }
  if (options?.inboxOnly) {
    filters.push(`(parentId = '' || parentId = null)`);
    filters.push(`isTopLevel = false`);
    filters.push(`isDailyNote = false`);
  }
  if (options?.parentId) {
    filters.push(safeFilter('parentId = {:parentId}', { parentId: options.parentId }));
  }
  if (options?.viewMode) {
    filters.push(safeFilter('viewMode = {:viewMode}', { viewMode: options.viewMode }));
  }

  const result = await pb.collection('pages').getList(page, pageSize, {
    filter: filters.length > 0 
      ? buildWorkspaceFilter(workspaceId, filters.join(' && '))
      : buildWorkspaceFilter(workspaceId),
    sort: `${sortPrefix}${sortBy}`,
    fields: METADATA_FIELDS,
  });
  
  const pages = result.items.map(record => ({
    ...pbToFrontend<Page>(record as Record<string, unknown>),
    content: null,
  }));
  
  return {
    pages,
    totalItems: result.totalItems,
    totalPages: result.totalPages,
    page: result.page,
    hasMore: result.page < result.totalPages,
  };
}

/**
 * Fetch all page IDs for the current workspace.
 * Used for reconciliation/purging of deleted pages.
 */
export async function fetchAllPageIds(): Promise<string[]> {
  const workspaceId = getCurrentWorkspaceIdOrNull();
  if (!workspaceId) return [];

  try {
    const result = await pb.collection('pages').getFullList({
      filter: buildWorkspaceFilter(workspaceId),
      fields: 'id',
    });

    return result.map(record => record.id);
  } catch (e) {
    console.error('[pagesApi] fetchAllPageIds error:', e);
    throw e; // Rethrow to prevent accidental purge
  }
}

/**
 * Fetch all task collections (pages with viewMode='tasks').
 * Used for task parent page picker dropdown.
 * Returns minimal fields for efficiency.
 */
export async function fetchTaskCollections(): Promise<Page[]> {
  const workspaceId = getCurrentWorkspaceIdOrNull();
  if (!workspaceId) return [];

  try {
    const result = await pb.collection('pages').getFullList({
      filter: buildWorkspaceFilter(workspaceId, "viewMode = 'tasks'"),
      sort: 'order,title',
    });

    return result.map(record => pbToFrontend<Page>(record as Record<string, unknown>));
  } catch (e) {
    console.error('[pagesApi] fetchTaskCollections error:', e);
    return [];
  }
}

/**
 * Fetch a single page by ID (WITH full content for editor)
 */
export async function fetchPage(id: string): Promise<Page | null> {
  try {
    const result = await pb.collection('pages').getOne(id);
    const page = pbToFrontend<Page>(result as Record<string, unknown>);
    return page;
  } catch (e) {
    // Don't log auto-cancellation errors - they're expected when user navigates quickly
    const isAutoCancelled = e instanceof Error && e.message.includes('autocancelled');
    if (!isAutoCancelled) {
      console.error('[pagesApi] fetchPage error:', e);
    }
    return null;
  }
}

/**
 * Fetch only the 'updated' timestamp for a page.
 * Used to check if remote changed before doing a full fetch (Option 1 optimization).
 * Returns null if page doesn't exist (404).
 * Throws on other errors (network, auth, etc.) so caller can handle appropriately.
 */
export async function fetchPageMetadata(id: string): Promise<{ updated: string } | null> {
  try {
    const result = await pb.collection('pages').getOne(id, {
      fields: 'updated',
    });
    return { updated: result.updated as string };
  } catch (e) {
    // 404 = page doesn't exist - return null
    if (e && typeof e === 'object' && 'status' in e && e.status === 404) {
      return null;
    }
    // All other errors should be thrown so caller can handle them
    // (e.g., network error, auth error, etc.)
    throw e;
  }
}

/**
 * Fetch pages WITH content that were updated within the last N days.
 * Used for offline content caching based on user's retention setting.
 * 
 * @param days - Number of days to look back (7, 14, 30)
 * @returns All pages updated within the time range, with full content
 */
export async function fetchRecentPagesWithContent(days: number): Promise<Page[]> {
  const workspaceId = getCurrentWorkspaceIdOrNull();
  if (!workspaceId) return [];

  // Calculate cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffISO = cutoffDate.toISOString();

  try {
    // Fetch all recent pages with content (no pagination - we want all for offline)
    const pages: Page[] = [];
    let page = 1;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore) {
      const result = await pb.collection('pages').getList(page, pageSize, {
        filter: buildWorkspaceFilter(workspaceId, safeFilter('updated >= {:cutoff}', { cutoff: cutoffISO })),
        sort: '-updated',
        // No fields restriction = full content included
      });

      pages.push(...result.items.map(record => pbToFrontend<Page>(record as Record<string, unknown>)));
      hasMore = page < result.totalPages;
      page++;
    }

    devLog(`[pagesApi] Fetched ${pages.length} pages with content from last ${days} days`);
    return pages;
  } catch (e) {
    console.error('[pagesApi] fetchRecentPagesWithContent error:', e);
    return [];
  }
}

/**
 * Fetch pages metadata (WITHOUT content) updated since a given timestamp.
 * Used for delta sync - only fetch what's changed since last sync.
 * 
 * @param since - ISO timestamp to fetch updates from
 * @returns All pages updated since the timestamp (metadata only)
 */
export async function fetchPagesSince(since: string): Promise<{ pages: Page[]; serverTimestamp: string }> {
  const workspaceId = getCurrentWorkspaceIdOrNull();
  if (!workspaceId) return { pages: [], serverTimestamp: new Date().toISOString() };

  try {
    const pages: Page[] = [];
    let page = 1;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore) {
      const result = await pb.collection('pages').getList(page, pageSize, {
        filter: buildWorkspaceFilter(workspaceId, safeFilter('updated > {:since}', { since })),
        sort: '-updated',
        fields: METADATA_FIELDS,
      });

      pages.push(...result.items.map(record => ({
        ...pbToFrontend<Page>(record as Record<string, unknown>),
        content: null,
      })));
      hasMore = page < result.totalPages;
      page++;
    }

    devLog(`[pagesApi] Fetched ${pages.length} pages updated since ${since}`);
    return { 
      pages, 
      serverTimestamp: new Date().toISOString(),
    };
  } catch (e) {
    console.error('[pagesApi] fetchPagesSince error:', e);
    return { pages: [], serverTimestamp: new Date().toISOString() };
  }
}

/**
 * Fetch daily note by date
 */
export async function fetchDailyPage(date: string): Promise<Page | null> {
  const workspaceId = getCurrentWorkspaceIdOrNull();
  if (!workspaceId) return null;

  try {
    const result = await pb.collection('pages').getList(1, 1, {
      filter: buildWorkspaceFilter(workspaceId, safeFilter('isDailyNote = true && dailyNoteDate = {:date}', { date })),
    });
    
    if (result.items.length === 0) return null;
    return pbToFrontend<Page>(result.items[0] as Record<string, unknown>);
  } catch (e) {
    console.error('[pagesApi] fetchDailyPage error:', e);
    return null;
  }
}

/**
 * Fetch total count of all pages (efficient - fetches no data, just count)
 */
export async function fetchPagesCount(): Promise<number> {
  const workspaceId = getCurrentWorkspaceIdOrNull();
  if (!workspaceId) return 0;

  try {
    // Request page 1 with 1 item but only get the id field - we just want totalItems
    const result = await pb.collection('pages').getList(1, 1, {
      filter: buildWorkspaceFilter(workspaceId),
      fields: 'id',
    });
    return result.totalItems;
  } catch (e) {
    console.error('[pagesApi] fetchPagesCount error:', e);
    return 0;
  }
}

/**
 * Fetch ALL pages metadata (without content) for complete offline caching.
 * This includes all pages regardless of parent/hierarchy - used for:
 * - Initial complete load
 * - "Download All for Offline" feature
 * - Ensuring pinned pages at any level are available
 * 
 * @returns All pages with metadata, content is null
 */
export async function fetchAllPagesMetadata(): Promise<Page[]> {
  const workspaceId = getCurrentWorkspaceIdOrNull();
  if (!workspaceId) return [];

  try {
    const pages: Page[] = [];
    let page = 1;
    const pageSize = 200; // Larger batches for efficiency
    let hasMore = true;

    while (hasMore) {
      const result = await pb.collection('pages').getList(page, pageSize, {
        filter: buildWorkspaceFilter(workspaceId),
        sort: 'order,-updated',
        fields: METADATA_FIELDS,
      });

      pages.push(...result.items.map(record => ({
        ...pbToFrontend<Page>(record as Record<string, unknown>),
        content: null,
      })));
      hasMore = page < result.totalPages;
      page++;
    }

    devLog(`[pagesApi] Fetched all ${pages.length} pages metadata`);
    return pages;
  } catch (e) {
    console.error('[pagesApi] fetchAllPagesMetadata error:', e);
    return [];
  }
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Create a new page in a workspace.
 * Excerpt should already be computed by the store before calling this.
 * @param data - Page data (workspace is optional - will use current if not provided)
 */
export async function createPage(
  data: Omit<Page, 'workspace'> & { workspace?: string }
): Promise<Page> {
  const workspaceId = data.workspace || getCurrentWorkspaceIdOrNull();
  if (!workspaceId) throw new Error('No workspace selected');

  return createInWorkspace<Page>('pages', workspaceId, data);
}

/**
 * Update an existing page.
 * Excerpt should already be computed by the store if content was updated.
 */
export async function updatePage(
  id: string,
  updates: UpdatePageInput
): Promise<Page> {
  const now = new Date().toISOString();
  return updateRecord<Page>('pages', id, { ...updates, updated: now });
}

/**
 * Block-level patch request for efficient page updates (Option 2C).
 * Instead of sending full content, sends only changed blocks.
 */
export interface PagePatchRequest {
  /** Blocks to upsert (create or update) - keyed by block ID */
  blocks?: Record<string, unknown>;
  /** Block IDs to delete */
  deleted?: string[];
  /** Block IDs with only order changes - maps to new order value (bandwidth optimization) */
  blockOrders?: Record<string, number>;
  /** Metadata fields to update (title, parentId, etc.) */
  metadata?: Partial<Pick<Page, 'title' | 'parentId' | 'isTopLevel' | 'icon' | 'color' | 'order' | 'viewMode' | 'childrenViewMode' | 'isExpanded' | 'isDailyNote' | 'dailyNoteDate' | 'excerpt' | 'collectionSortBy' | 'collectionSortDirection' | 'collectionGroupBy' | 'sections' | 'tasksViewMode' | 'tasksGroupBy' | 'showCompletedTasks' | 'showExcerpts' | 'savedViews' | 'activeSavedViewId'>>;
}

/**
 * Apply block-level patches to a page (Option 2C).
 * Sends only changed blocks instead of full content - ~90% bandwidth reduction.
 * 
 * @param id - Page ID
 * @param patch - Block patches and optional metadata updates
 * @returns Updated page metadata (content is omitted to save bandwidth)
 */
export async function patchPage(id: string, patch: PagePatchRequest): Promise<Omit<Page, 'content'> & { content?: undefined }> {
  const response = await pb.send(`/api/pages/${id}/patch`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return pbToFrontend<Omit<Page, 'content'>>(response as Record<string, unknown>);
}

/**
 * Delete a page
 */
export async function deletePage(id: string): Promise<void> {
  return deleteRecord('pages', id);
}

// ============================================================================
// HIERARCHY OPERATIONS
// ============================================================================

/**
 * Move orphaned child pages to Inbox when their parent is deleted.
 * Returns the IDs of pages that were moved to Inbox.
 */
export async function moveOrphanedPagesToRoot(
  parentId: string
): Promise<string[]> {
  const workspaceId = getCurrentWorkspaceIdOrNull();
  if (!workspaceId) return [];

  // Find all children using paginated fetch
  const result = await fetchPages({ parentId });
  const children = result.pages;

  // Update each to remove parent
  await Promise.all(
    children.map((p) =>
      updatePage(p.id, { parentId: null, isTopLevel: false })
    )
  );

  return children.map((p) => p.id);
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Batch delete pages (for cascade delete)
 * Uses PocketBase batch API - single request instead of N requests.
 */
export async function batchDeletePages(ids: string[]): Promise<void> {
  await batchDelete('pages', ids);
}

/**
 * Batch update pages (for reordering)
 * Uses PocketBase batch API - single request instead of N requests.
 */
export async function batchUpdatePages(
  updates: Array<{ id: string; updates: UpdatePageInput }>
): Promise<void> {
  await batchUpdate('pages', updates.map(({ id, updates: u }) => ({ id, data: u as Record<string, unknown> })));
}

// ============================================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================================

/**
 * Extended SSE event data that includes changed block info for patch updates
 */
export interface PageSSEEvent {
  action: 'create' | 'update' | 'delete';
  page: Page;
  /** Changed blocks with their content (only present for patch updates) */
  changedBlocks?: Record<string, unknown>;
  /** Block IDs that were deleted (only present for patch updates) */
  deletedBlocks?: string[];
  /** Block IDs with only order changes - maps to new order value */
  blockOrders?: Record<string, number>;
}

/**
 * Subscribe to page changes in the current workspace
 * Uses server-side filtering to only receive events for the current workspace.
 * @returns Unsubscribe function
 */
export function subscribeToPages(
  callback: (action: 'create' | 'update' | 'delete', page: Page, changedBlocks?: Record<string, unknown>, deletedBlocks?: string[], blockOrders?: Record<string, number>) => void
): () => void {
  const workspaceId = getCurrentWorkspaceIdOrNull();
  if (!workspaceId) return () => {};

  // Use server-side filter to only receive events for current workspace
  pb.collection('pages').subscribe(
    '*',
    (e) => {
      const page = e.record as unknown as Page;
      // Extract changedBlocks, deletedBlocks, and blockOrders from the SSE event data
      // These are added by our custom OnRealtimeMessageSend hook for block-level updates
      const eventData = e as unknown as Record<string, unknown>;
      const changedBlocks = eventData.changedBlocks as Record<string, unknown> | undefined;
      const deletedBlocks = eventData.deletedBlocks as string[] | undefined;
      const blockOrders = eventData.blockOrders as Record<string, number> | undefined;
      
      callback(
        e.action as 'create' | 'update' | 'delete', 
        page,
        changedBlocks,
        deletedBlocks,
        blockOrders
      );
    },
    {
      filter: buildWorkspaceFilter(workspaceId),
    }
  );

  return () => {
    try {
      if (pb.authStore.isValid) {
        pb.collection('pages').unsubscribe('*');
      }
    } catch (err) {
      console.warn('[pagesApi] Failed to unsubscribe from pages:', err);
    }
  };
}

// ============================================================================
// IMAGE UPLOAD
// ============================================================================

/**
 * Get the full URL for an image stored in a page's images field.
 * 
 * @param pageId - The page record ID
 * @param filename - The image filename (from page.images array)
 * @param thumbnail - If true, returns thumbnail URL (512x512)
 * @returns Full URL to the image
 */
export function getPageImageUrl(
  pageId: string,
  filename: string,
  thumbnail: boolean = false
): string {
  const baseUrl = pb.baseUrl;
  const thumbQuery = thumbnail ? '?thumb=512x512' : '';
  return `${baseUrl}/api/files/pages/${pageId}/${filename}${thumbQuery}`;
}

/**
 * Upload an image to a page's images field.
 * 
 * This appends the image to the page's existing images array.
 * PocketBase handles file storage and generates thumbnails automatically.
 * 
 * @param pageId - The page to attach the image to
 * @param file - The processed image file (should be resized before calling)
 * @returns Upload result with URLs and dimensions
 */
export async function uploadPageImage(
  pageId: string,
  file: File,
  width: number,
  height: number
): Promise<ImageUploadResult> {
  // Create FormData with the image file
  const formData = new FormData();
  
  // PocketBase's file field with + prefix appends to array instead of replacing
  formData.append('images+', file);

  // Update the page with the new image
  const result = await pb.collection('pages').update(pageId, formData);
  const updatedPage = pbToFrontend<Page>(result as Record<string, unknown>);

  // The new image will be the last one in the array
  const images = updatedPage.images || [];
  const uploadedFilename = images[images.length - 1];

  if (!uploadedFilename) {
    throw new Error('Image upload failed: no filename returned');
  }

  // Generate URLs
  const src = getPageImageUrl(pageId, uploadedFilename);
  const thumbnailUrl = getPageImageUrl(pageId, uploadedFilename, true);

  // Extract alt text from filename
  const alt = file.name
    .replace(/\.[^.]+$/, '') // Remove extension
    .replace(/[_-]/g, ' ') // Replace underscores/dashes with spaces
    .trim();

  return {
    src,
    sizes: { width, height },
    alt,
    thumbnailUrl,
  };
}

/**
 * Remove an image from a page's images field.
 * 
 * @param pageId - The page to remove the image from
 * @param filename - The image filename to remove
 */
export async function removePageImage(pageId: string, filename: string): Promise<void> {
  // PocketBase's file field with - prefix removes from array
  const formData = new FormData();
  formData.append('images-', filename);

  await pb.collection('pages').update(pageId, formData);
}

// =============================================================================
// FILE OPERATIONS (PDFs, Documents)
// =============================================================================

/**
 * Result of a file upload operation.
 */
export interface FileUploadResult {
  src: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
}

/**
 * Get the full URL for a file stored in a page's files field.
 * 
 * @param pageId - The page record ID
 * @param filename - The file filename (from page.files array)
 * @returns Full URL to the file
 */
export function getPageFileUrl(pageId: string, filename: string): string {
  const baseUrl = pb.baseUrl;
  return `${baseUrl}/api/files/pages/${pageId}/${filename}`;
}

/**
 * Upload a file (PDF, document) to a page's files field.
 * 
 * This appends the file to the page's existing files array.
 * 
 * @param pageId - The page to attach the file to
 * @param file - The file to upload
 * @returns Upload result with URL and metadata
 */
export async function uploadPageFile(
  pageId: string,
  file: File
): Promise<FileUploadResult> {
  // Create FormData with the file
  const formData = new FormData();
  
  // PocketBase's file field with + prefix appends to array instead of replacing
  formData.append('files+', file);

  // Update the page with the new file
  const result = await pb.collection('pages').update(pageId, formData);
  const updatedPage = pbToFrontend<Page>(result as Record<string, unknown>);

  // The new file will be the last one in the array
  const files = (updatedPage as any).files || [];
  const uploadedFilename = files[files.length - 1];

  if (!uploadedFilename) {
    throw new Error('File upload failed: no filename returned');
  }

  // Generate URL
  const src = getPageFileUrl(pageId, uploadedFilename);

  return {
    src,
    filename: uploadedFilename,
    originalName: file.name,
    mimeType: file.type,
    size: file.size,
  };
}

/**
 * Remove a file from a page's files field.
 * 
 * @param pageId - The page to remove the file from
 * @param filename - The file filename to remove
 */
export async function removePageFile(pageId: string, filename: string): Promise<void> {
  // PocketBase's file field with - prefix removes from array
  const formData = new FormData();
  formData.append('files-', filename);

  await pb.collection('pages').update(pageId, formData);
}
