/**
 * @file savedView.ts
 * @description Saved view type definitions - embedded in page objects
 * @app PAGES - Used by task pages and collection pages
 * 
 * Saved views allow users to save combinations of:
 * - View mode (list, kanban, table)
 * - Grouping settings
 * - Sort settings
 * - Show/hide options
 * 
 * Saved views are stored directly on the page object as a JSON field.
 * This eliminates the need for a separate collection/store/API.
 */

import type { ViewMode, GroupBy, TaskSortBy, SortDirection, TaskFilterOptions, PageFilterOptions } from './view';
import { DEFAULT_TASK_FILTER_OPTIONS, DEFAULT_PAGE_FILTER_OPTIONS } from './view';

/**
 * Configuration for a saved task view (used on pages with viewMode='tasks')
 */
export interface TaskViewConfig {
  viewMode: ViewMode;
  groupBy: GroupBy;
  showCompleted: boolean;
  sortBy: TaskSortBy;
  sortDirection: SortDirection;
  /** Active filter options - undefined means no saved filters (treat as defaults) */
  filterOptions?: TaskFilterOptions;
}

/**
 * Configuration for a saved page collection view (used on pages with viewMode='collection')
 */
export interface CollectionViewConfig {
  viewMode: ViewMode;
  groupBy: 'none' | 'date';
  sortBy: 'updated' | 'created' | 'title';
  sortDirection: SortDirection;
  showExcerpts: boolean;
  /** Active filter options - undefined means no saved filters (treat as defaults) */
  filterOptions?: PageFilterOptions;
}

/**
 * A saved view embedded in a page object
 * 
 * Stored in page.savedViews JSON array
 */
export interface PageSavedView {
  /** Unique identifier (client-generated UUID) */
  id: string;
  /** Display name (e.g., "My Priorities", "High Priority First") */
  name: string;
  /** Sort order among saved views (0-based) */
  order: number;
  /** Optional Lucide icon name */
  icon: string | null;
  /** Optional color (hex or tailwind class) */
  color?: string | null;
  /** View configuration - depends on page viewMode */
  config: TaskViewConfig | CollectionViewConfig;
}

/**
 * Default task view configuration
 */
export const DEFAULT_TASK_VIEW_CONFIG: TaskViewConfig = {
  viewMode: 'list',
  groupBy: 'none',
  showCompleted: false,
  sortBy: 'date',
  sortDirection: 'desc',
  filterOptions: DEFAULT_TASK_FILTER_OPTIONS,
};

/**
 * Default collection view configuration
 */
export const DEFAULT_COLLECTION_VIEW_CONFIG: CollectionViewConfig = {
  viewMode: 'list',
  groupBy: 'date',
  sortBy: 'updated',
  sortDirection: 'desc',
  showExcerpts: true,
  filterOptions: DEFAULT_PAGE_FILTER_OPTIONS,
};

/**
 * Generate a unique ID for a saved view
 */
export function generateSavedViewId(): string {
  return `sv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
