/**
 * @file view.ts
 * @description View display types shared across apps
 * @app SHARED - Used by both Tasks and Notes apps
 * 
 * Defines common view configuration types:
 * 
 * - ViewMode: Display style ('list' or 'kanban'/grid)
 * - GroupBy: How items are grouped in list view
 *   - 'none': No grouping
 *   - 'date': Group by due date (tasks) or updated date (pages)
 *   - 'priority': Group by priority level (tasks only)
 *   - 'task page': Group by task page (tasks only)
 *   - 'section': Group by section (tasks in task page view only)
 *   - 'tag': Group by tag (tasks and pages)
 *   - 'parentPage': Group by parent page (unified pages model)
 * - TaskSortBy: How tasks are sorted within groups
 *   - 'date': Sort by due date
 *   - 'priority': Sort by priority level
 *   - 'title': Sort alphabetically
 *   - 'created': Sort by creation date
 *   - 'tag': Sort by tag
 * - TaskFilterOptions: Inline filter state for task views
 * - PageFilterOptions: Inline filter state for page/collection views
 * 
 * These are stored per-view in localStorage via viewPreferences.ts.
 */
export type ViewMode = 'list' | 'kanban' | 'table' | 'graph';
export type GroupBy = 'none' | 'date' | 'priority' | 'taskPage' | 'section' | 'tag' | 'parentPage';
export type TaskSortBy = 'date' | 'priority' | 'title' | 'created' | 'tag';
export type SortDirection = 'asc' | 'desc';

/**
 * Active filter criteria for task views.
 * An empty array value means "no filter on that criterion" (show all).
 */
export interface TaskFilterOptions {
  /** Filter to specific priorities. Empty = show all priorities. */
  priorities: ('High' | 'Medium' | 'Low')[];
  /** Filter to specific tags. Empty = show all tags. */
  tags: string[];
  /** Filter by due date status. 'all' = no filter. */
  dueDateFilter: 'all' | 'has_due' | 'no_due' | 'overdue';
}

/**
 * Active filter criteria for page/collection views.
 */
export interface PageFilterOptions {
  /** Filter by page type. 'all' = no filter. */
  filterBy: 'all' | 'notes' | 'collections' | 'tasks' | 'handwritten';
  /** Filter to specific tags. Empty = show all tags. */
  tags: string[];
}

/** Default task filter options (no active filters) */
export const DEFAULT_TASK_FILTER_OPTIONS: TaskFilterOptions = {
  priorities: [],
  tags: [],
  dueDateFilter: 'all',
};

/** Default page filter options (no active filters) */
export const DEFAULT_PAGE_FILTER_OPTIONS: PageFilterOptions = {
  filterBy: 'all',
  tags: [],
};

/** Check if task filter options are all defaults (no active filters) */
export function isDefaultTaskFilterOptions(opts: TaskFilterOptions): boolean {
  return opts.priorities.length === 0 && opts.tags.length === 0 && opts.dueDateFilter === 'all';
}

/** Count active task filter criteria (for badge display) */
export function countActiveTaskFilters(opts: TaskFilterOptions, showCompleted: boolean): number {
  let count = 0;
  if (opts.priorities.length > 0) count++;
  if (opts.tags.length > 0) count++;
  if (opts.dueDateFilter !== 'all') count++;
  if (showCompleted) count++;
  return count;
}

/** Check if page filter options are all defaults (no active filters) */
export function isDefaultPageFilterOptions(opts: PageFilterOptions): boolean {
  return opts.filterBy === 'all' && opts.tags.length === 0;
}

/** Count active page filter criteria (for badge display) */
export function countActivePageFilters(opts: PageFilterOptions): number {
  let count = 0;
  if (opts.filterBy !== 'all') count++;
  if (opts.tags.length > 0) count++;
  return count;
}
