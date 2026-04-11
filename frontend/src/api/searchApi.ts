/**
 * @file searchApi.ts
 * @description Full-text search API for tasks and pages
 * @app SHARED - Search functionality across the app
 */

import { pb } from '@/lib/pocketbase';

// ============================================================================
// TYPES
// ============================================================================

export interface TaskSearchResult {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority?: string;
  parentPageId?: string;
  completed: boolean;
  rank: number;
}

export interface PageSearchResult {
  id: string;
  title: string;
  excerpt?: string;
  icon?: string;
  parentId?: string;
  viewMode?: string;
  rank: number;
}

export interface SearchResults {
  query: string;
  tasks: TaskSearchResult[];
  pages: PageSearchResult[];
}

export type SearchType = 'all' | 'tasks' | 'pages';

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Search across tasks and pages in a workspace using full-text search
 * @param query - The search query string
 * @param workspaceId - The workspace to search in
 * @param type - Optional: filter by type ('all', 'tasks', 'pages')
 * @param limit - Optional: max results per type (default 20, max 100)
 */
export async function search(
  query: string,
  workspaceId: string,
  type: SearchType = 'all',
  limit: number = 20
): Promise<SearchResults> {
  const params = new URLSearchParams({
    q: query,
    workspace: workspaceId,
    type,
    limit: String(Math.min(limit, 100)),
  });

  const response = await fetch(`${pb.baseURL}/api/search?${params}`, {
    method: 'GET',
    headers: {
      Authorization: pb.authStore.token || '',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Search failed' }));
    throw new Error(error.message || 'Search failed');
  }

  return await response.json();
}

/**
 * Search tasks only
 */
export async function searchTasks(
  query: string,
  workspaceId: string,
  limit?: number
): Promise<TaskSearchResult[]> {
  const results = await search(query, workspaceId, 'tasks', limit);
  return results.tasks;
}

/**
 * Search pages only
 */
export async function searchPages(
  query: string,
  workspaceId: string,
  limit?: number
): Promise<PageSearchResult[]> {
  const results = await search(query, workspaceId, 'pages', limit);
  return results.pages;
}
