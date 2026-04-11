/**
 * @file syncEngine/contentLoader.ts
 * @description Page content loading and management
 */

import * as pagesApi from '@/api/pagesApi';
import type { Page } from '@/types/page';
import { getLocalPage } from '../offlineDb';
import { updatePageWithContent } from './dataLoader';
import { stripPageMetadata, is404Error } from './utils';
import { devLog } from '../config';

/**
 * Result of ensurePageContent operation.
 */
export interface PageContentResult {
  page: Page | null;
  /** True if we have content (either full or partial) */
  contentAvailableOffline: boolean;
  /** True if content was built from SSE patches only (never fully fetched) */
  contentMayBeIncomplete: boolean;
}

// Backward compatibility alias
export type NoteContentResult = PageContentResult;

/**
 * Ensure a page has content loaded (for editor).
 * 
 * This is called when opening a page. It:
 * 1. Checks if we have content locally
 * 2. If online and page is synced, fetches fresh content and merges with CRDT
 * 3. If page is pending sync (created offline), uses local content
 * 4. Returns the page with content
 * 
 * @param pageId - The page ID to load content for
 * @param isOnline - Whether we're currently online
 * @param forceRefresh - If true, always fetch from server (use on page reload)
 * @returns Object with the page and content availability status
 */
export async function ensurePageContent(
  pageId: string,
  isOnline: boolean,
  forceRefresh = false
): Promise<PageContentResult> {
  if (!pageId) {
    devLog(`[SyncEngine] ensurePageContent: Invalid pageId provided`);
    return { page: null, contentAvailableOffline: false, contentMayBeIncomplete: false };
  }
  
  const local = await getLocalPage(pageId);
  
  if (!local) {
    devLog(`[SyncEngine] ensurePageContent: Page ${pageId} not found locally`);
    return { page: null, contentAvailableOffline: false, contentMayBeIncomplete: false };
  }

  // If offline, return what we have (even if no content)
  // Content is "available" if we have cached content locally
  // Content is "incomplete" if we have content from SSE but never did a full fetch
  if (!isOnline) {
    const hasContent = local._hasContent === true;
    const hasDoneFullFetch = (local._contentFetchedAt || 0) > 0;
    const mayBeIncomplete = hasContent && !hasDoneFullFetch;
    devLog(`[SyncEngine] Offline - returning cached page ${pageId} (hasContent: ${hasContent}, mayBeIncomplete: ${mayBeIncomplete})`);
    return { 
      page: stripPageMetadata(local) as Page, 
      contentAvailableOffline: hasContent,
      contentMayBeIncomplete: mayBeIncomplete,
    };
  }

  // If page has pending changes (e.g., created offline), use local content
  // Don't fetch from server as it may not exist there yet
  if (local._syncStatus === 'pending') {
    devLog(`[SyncEngine] Page ${pageId} has pending changes - using local content`);
    return { page: stripPageMetadata(local) as Page, contentAvailableOffline: true, contentMayBeIncomplete: false };
  }

  // OPTIMIZATION: Check if we already have fresh content (unless forceRefresh)
  // If we have content and it was fetched recently, skip the server fetch
  if (!forceRefresh && local._hasContent && local._contentFetchedAt) {
    try {
      // Check if remote changed since our last fetch
      const remoteMetadata = await pagesApi.fetchPageMetadata(pageId);
      if (remoteMetadata) {
        const remoteUpdatedAt = new Date(remoteMetadata.updated).getTime();
        if (remoteUpdatedAt <= local._contentFetchedAt) {
          devLog(`[SyncEngine] Page ${pageId} - using cached content (no remote changes)`);
          return { page: stripPageMetadata(local) as Page, contentAvailableOffline: true, contentMayBeIncomplete: false };
        }
        devLog(`[SyncEngine] Page ${pageId} - remote changed, fetching fresh content`);
      }
    } catch (error) {
      // If metadata check fails, fall through to full fetch
      devLog(`[SyncEngine] Page ${pageId} - metadata check failed, fetching full content`);
    }
  }

  // Fetch fresh content when online and page is synced
  try {
    devLog(`[SyncEngine] Fetching fresh content for page ${pageId}${forceRefresh ? ' (forced)' : ''}`);
    const serverPage = await pagesApi.fetchPage(pageId);
    
    if (!serverPage) {
      devLog(`[SyncEngine] Server returned null for page ${pageId} - using local`);
      const hasDoneFullFetch = (local._contentFetchedAt || 0) > 0;
      return { 
        page: stripPageMetadata(local) as Page, 
        contentAvailableOffline: local._hasContent === true,
        contentMayBeIncomplete: local._hasContent === true && !hasDoneFullFetch,
      };
    }

    // Update local with fresh content
    await updatePageWithContent(serverPage);
    
    // Return the merged version - after full fetch, content is complete
    const updated = await getLocalPage(pageId);
    if (updated) {
      return { page: stripPageMetadata(updated) as Page, contentAvailableOffline: true, contentMayBeIncomplete: false };
    }
    
    return { page: serverPage, contentAvailableOffline: true, contentMayBeIncomplete: false };
  } catch (error) {
    // 404 is expected if page was created offline and not yet synced
    // or if there's a race condition during sync
    if (is404Error(error)) {
      devLog(`[SyncEngine] Page ${pageId} not found on server (404) - using local content`);
    } else {
      devLog(`[SyncEngine] Failed to fetch page content:`, error);
    }
    // Return cached version on any error
    const hasDoneFullFetch = (local._contentFetchedAt || 0) > 0;
    return { 
      page: stripPageMetadata(local) as Page, 
      contentAvailableOffline: local._hasContent === true,
      contentMayBeIncomplete: local._hasContent === true && !hasDoneFullFetch,
    };
  }
}

// Backward compatibility alias
export const ensureNoteContent = ensurePageContent;
