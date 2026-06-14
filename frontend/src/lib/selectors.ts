/**
 * @file selectors.ts
 * @description Memoized task filtering selectors for different views
 * @app SHARED - Task filtering logic used by TasksView and TaskList
 * 
 * Provides pure functions for filtering tasks based on the current view:
 * - selectFilteredTasks: Filter tasks for a given view (inbox, today, upcoming, etc.)
 * - selectSidebarCounts: Calculate task counts for sidebar badges
 * - groupTasksBy: Group tasks by date, priority, task page, or section
 * - sortTasksWithinGroups: Sort tasks within each group by a given field
 * 
 * Task Filters (used by pill navigation):
 * - inbox: Tasks without a task page
 * - today: Tasks due today or overdue
 * - upcoming: Tasks with any due date
 * - all: All incomplete tasks
 * 
 * Also used for:
 * - task page: Tasks in a specific task page (when viewing a task page)
 */
import dayjs, { Dayjs } from 'dayjs';
import type { Task } from '../types/task';
import type { Page } from '../types/page';
import type { GroupBy } from '../types/view';
import type { TaskFilterOptions, PageFilterOptions } from '../types/view';
import { DEFAULT_TASK_FILTER_OPTIONS } from '../types/view';
import { DATE_GROUPS, categorizeDateGroup, dateGroupToDate, type DateGroupKey } from './dateGroups';
import { getTagColor } from './tagUtils';

// Task collection (pages with viewMode='tasks') type alias
type TaskCollection = Page;

// Task sort options type
export type TaskSortBy = 'date' | 'priority' | 'title' | 'created' | 'tag';
export type TaskSortDirection = 'asc' | 'desc';

/**
 * Compute the property updates needed to move a task to a given drop-target
 * group. Returns `null` if the task is already in that bucket — in that case
 * the caller should NOT update the property (otherwise e.g. a within-bucket
 * date reorder would slam the dueDate to the bucket's anchor and re-sort).
 */
export function computeTaskDropUpdates(
  task: Task,
  targetGroup: string,
  groupBy: GroupBy,
  today: Dayjs,
): Partial<Task> | null {
  switch (groupBy) {
    case 'date': {
      if (categorizeDateGroup(task.dueDate, today) === targetGroup) return null;
      return { dueDate: dateGroupToDate(targetGroup as DateGroupKey, today) };
    }
    case 'priority': {
      const current = task.priority?.toLowerCase() || 'none';
      if (current === targetGroup) return null;
      const next: Task['priority'] =
        targetGroup === 'high' ? 'High' :
        targetGroup === 'medium' ? 'Medium' :
        targetGroup === 'low' ? 'Low' : undefined;
      return { priority: next };
    }
    case 'taskPage': {
      const current = task.parentPageId || 'inbox';
      if (current === targetGroup) return null;
      return {
        parentPageId: targetGroup === 'inbox' ? undefined : targetGroup,
        sectionId: undefined,
      };
    }
    case 'section': {
      const NONE = new Set(['unsectioned', 'unassigned']);
      const current = task.sectionId || 'unsectioned';
      const normalizedTarget = NONE.has(targetGroup) ? 'unsectioned' : targetGroup;
      if (current === normalizedTarget) return null;
      return { sectionId: NONE.has(targetGroup) ? undefined : targetGroup };
    }
    case 'tag': {
      const current = (task.tag ? task.tag.split(',')[0].trim() : '') || '__no_tag__';
      if (current === targetGroup) return null;
      return { tag: targetGroup === '__no_tag__' ? undefined : targetGroup };
    }
    default:
      return null;
  }
}

// Task filter type (matches TaskFilter in navigationStore)
// 'task page' is legacy - use 'taskCollection' for pages with viewMode='tasks'
export type View = 'all' | 'inbox' | 'today' | 'upcoming' | 'taskPage' | 'taskCollection';

// ============================================================================
// TASK SORTING
// ============================================================================

const PRIORITY_ORDER: Record<string, number> = {
  'High': 1,
  'Medium': 2,
  'Low': 3,
  '': 4,
  'undefined': 4,
};

/**
 * Sort tasks by a given field and direction.
 */
export function sortTasks(
  tasks: Task[],
  sortBy: TaskSortBy,
  direction: TaskSortDirection = 'asc'
): Task[] {
  const sorted = [...tasks].sort((a, b) => {
    let compare = 0;
    switch (sortBy) {
      case 'date':
        // Tasks without dates go last
        if (!a.dueDate && !b.dueDate) compare = 0;
        else if (!a.dueDate) compare = 1;
        else if (!b.dueDate) compare = -1;
        else compare = dayjs(a.dueDate).valueOf() - dayjs(b.dueDate).valueOf();
        break;
      case 'priority':
        compare = (PRIORITY_ORDER[a.priority || ''] ?? 4) - (PRIORITY_ORDER[b.priority || ''] ?? 4);
        break;
      case 'title':
        compare = (a.title || '').localeCompare(b.title || '');
        break;
      case 'created':
        compare = dayjs(a.created).valueOf() - dayjs(b.created).valueOf();
        break;
      case 'tag':
        // Tasks without tags go last
        if (!a.tag && !b.tag) compare = 0;
        else if (!a.tag) compare = 1;
        else if (!b.tag) compare = -1;
        else compare = (a.tag || '').localeCompare(b.tag || '');
        break;
    }
    const primary = direction === 'asc' ? compare : -compare;
    if (primary !== 0) return primary;
    // Manual order tiebreaker — always ascending so drag-position is intuitive
    // regardless of primary sort direction. Tasks without an order go last.
    const ao = a.order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.order ?? Number.MAX_SAFE_INTEGER;
    return ao - bo;
  });
  return sorted;
}

/**
 * Sort tasks within each group.
 */
export function sortTasksWithinGroups(
  groups: Record<string, TaskGroup>,
  sortBy: TaskSortBy,
  direction: TaskSortDirection = 'asc'
): Record<string, TaskGroup> {
  const result: Record<string, TaskGroup> = {};
  for (const key of Object.keys(groups)) {
    result[key] = {
      ...groups[key],
      tasks: sortTasks(groups[key].tasks, sortBy, direction),
    };
  }
  return result;
}

// ============================================================================
// TASK GROUPING
// ============================================================================

export interface TaskGroup {
  label: string;
  tasks: Task[];
  color?: string;
}

/**
 * Group tasks by date, priority, task page, or section.
 * Single function used by both TaskList and KanbanView.
 */
export function groupTasksBy(
  tasks: Task[],
  groupBy: GroupBy,
  today: Dayjs,
  taskPages: TaskCollection[]
): Record<string, TaskGroup> {
  const groups: Record<string, TaskGroup> = {};

  switch (groupBy) {
    case 'date':
      // Initialize all date groups
      DATE_GROUPS.forEach(g => {
        groups[g.key] = { label: g.label, tasks: [] };
      });
      for (const task of tasks) {
        const groupKey = categorizeDateGroup(task.dueDate, today);
        groups[groupKey].tasks.push(task);
      }
      break;

    case 'priority':
      groups['high'] = { label: 'High Priority', tasks: [], color: '#EF4444' };
      groups['medium'] = { label: 'Medium Priority', tasks: [], color: '#F59E0B' };
      groups['low'] = { label: 'Low Priority', tasks: [], color: '#3B82F6' };
      groups['none'] = { label: 'No Priority', tasks: [], color: '#6B7280' };
      for (const task of tasks) {
        const priority = task.priority?.toLowerCase() || 'none';
        (groups[priority] || groups['none']).tasks.push(task);
      }
      break;

    case 'taskPage':
      for (const taskPage of taskPages) {
        groups[taskPage.id] = { label: taskPage.title, tasks: [], color: taskPage.color || undefined };
      }
      groups['inbox'] = { label: 'Inbox', tasks: [], color: '#6B7280' };
      for (const task of tasks) {
        const taskPageId = task.parentPageId || 'inbox';
        if (!groups[taskPageId]) {
          groups[taskPageId] = { label: 'Unknown', tasks: [] };
        }
        groups[taskPageId].tasks.push(task);
      }
      break;

    case 'section': {
      // Get sections from the first project that has tasks
      let projectForSections: TaskCollection | undefined;
      for (const task of tasks) {
        const taskPageId = task.parentPageId;
        if (taskPageId) {
          projectForSections = taskPages.find(p => p.id === taskPageId);
          if (projectForSections) break;
        }
      }
      if (projectForSections?.sections) {
        for (const section of projectForSections.sections.sort((a, b) => a.order - b.order)) {
          groups[section.id] = { 
            label: section.name, 
            tasks: [], 
            color: section.color || projectForSections.color || undefined 
          };
        }
      }
      groups['unassigned'] = { label: 'Unassigned', tasks: [], color: '#9CA3AF' };
      for (const task of tasks) {
        const sectionId = task.sectionId || 'unassigned';
        if (!groups[sectionId]) {
          groups[sectionId] = { label: 'Unknown', tasks: [] };
        }
        groups[sectionId].tasks.push(task);
      }
      break;
    }

    case 'tag': {
      // Group by tag - collect all unique tags first
      const tagSet = new Set<string>();
      for (const task of tasks) {
        if (task.tag) {
          task.tag.split(',').map(t => t.trim()).filter(Boolean).forEach(t => tagSet.add(t));
        }
      }
      // Sort tags alphabetically
      const sortedTags = Array.from(tagSet).sort();
      // Create groups for each tag
      for (const tag of sortedTags) {
        const tagColor = getTagColor(tag);
        groups[tag] = { label: tag, tasks: [], color: tagColor.hex };
      }
      // Add 'no tag' group
      groups['__no_tag__'] = { label: 'No Tag', tasks: [], color: '#9CA3AF' };
      // Assign tasks to groups — use first tag as the primary group key
      for (const task of tasks) {
        const firstTag = task.tag ? task.tag.split(',')[0].trim() : '';
        const groupKey = firstTag || '__no_tag__';
        if (!groups[groupKey]) {
          groups[groupKey] = { label: groupKey, tasks: [] };
        }
        groups[groupKey].tasks.push(task);
      }
      break;
    }

    default:
      groups['all'] = { label: 'All Tasks', tasks: [...tasks] };
  }

  return groups;
}

// ============================================================================
// TASK SELECTORS
// ============================================================================

export function selectFilteredTasks(tasks: Task[], view: View, selectedTaskPageId: string | null, todayISO: string): Task[] {
  const today = dayjs(todayISO);
  switch (view) {
    case 'inbox':
      return tasks.filter(t => !t.parentPageId && !t.completed);
    case 'today':
      return tasks.filter(t => !t.completed && t.dueDate && (dayjs(t.dueDate).isSame(today, 'day') || dayjs(t.dueDate).isBefore(today, 'day')));
    case 'upcoming':
      return tasks.filter(t => !t.completed && !!t.dueDate);
    case 'taskPage':
      return selectedTaskPageId ? tasks.filter(t => (t.parentPageId ?? '') === selectedTaskPageId) : [];
    case 'all':
    default:
      return tasks.filter(t => !t.completed);
  }
}

export function selectSidebarCounts(tasks: Task[], todayISO: string): {
  allCount: number;
  inboxCount: number;
  todayCount: number;
  upcomingCount: number;
  completedCount: number;
  overdueCount: number;
  taskPageCounts: Record<string, number>;
  taskPageOverdueCounts: Record<string, number>;
  inboxOverdueCount: number;
} {
  const today = dayjs(todayISO).startOf('day');
  let allCount = 0, inboxCount = 0, todayCount = 0, upcomingCount = 0, completedCount = 0, overdueCount = 0;
  let inboxOverdueCount = 0;
  const taskPageCounts: Record<string, number> = {};
  const taskPageOverdueCounts: Record<string, number> = {};

  for (const t of tasks) {
    const isDone = t.completed;
    if (isDone) {
      completedCount++;
      continue;
    }
    // unfinished
    allCount++;
    
    const isOverdue = t.dueDate && dayjs(t.dueDate).startOf('day').isBefore(today, 'day');
    const taskPageId = t.parentPageId;
    
    if (!taskPageId) {
      inboxCount++;
      if (isOverdue) inboxOverdueCount++;
    }
    if (taskPageId) {
      taskPageCounts[taskPageId] = (taskPageCounts[taskPageId] || 0) + 1;
      if (isOverdue) {
        taskPageOverdueCounts[taskPageId] = (taskPageOverdueCounts[taskPageId] || 0) + 1;
      }
    }
    if (t.dueDate) {
      const due = dayjs(t.dueDate).startOf('day');
      if (due.isSame(today, 'day')) todayCount++;
      if (due.isBefore(today, 'day')) overdueCount++;
      // Upcoming = any task with a due date (matches selectFilteredTasks 'upcoming')
      upcomingCount++;
    }
  }

  return { allCount, inboxCount, todayCount, upcomingCount, completedCount, overdueCount, taskPageCounts, taskPageOverdueCounts, inboxOverdueCount };
}

// ============================================================================
// TASK FILTER OPTIONS - Inline filter criteria applied on top of view filter
// ============================================================================

/**
 * Apply inline TaskFilterOptions to a task array.
 * Used on all task views (global filters + task pages).
 * 
 * @param tasks - Tasks to filter (already filtered by view/showCompleted)
 * @param opts - Active filter criteria
 * @param todayISO - Today's date for overdue calculation
 */
export function applyTaskFilterOptions(
  tasks: Task[],
  opts: TaskFilterOptions,
  todayISO: string
): Task[] {
  let result = tasks;

  // Priority filter
  if (opts.priorities.length > 0) {
    result = result.filter(t => {
      const p = t.priority || '';
      return opts.priorities.some(fp => fp === p);
    });
  }

  // Tag filter
  if (opts.tags.length > 0) {
    result = result.filter(t => {
      if (!t.tag) return false;
      const taskTags = t.tag.split(',').map(s => s.trim()).filter(Boolean);
      return opts.tags.some(ft => taskTags.includes(ft));
    });
  }

  // Due date filter
  if (opts.dueDateFilter !== 'all') {
    const today = dayjs(todayISO).startOf('day');
    switch (opts.dueDateFilter) {
      case 'has_due':
        result = result.filter(t => !!t.dueDate);
        break;
      case 'no_due':
        result = result.filter(t => !t.dueDate);
        break;
      case 'overdue':
        result = result.filter(t => {
          if (!t.dueDate) return false;
          return dayjs(t.dueDate).startOf('day').isBefore(today, 'day');
        });
        break;
    }
  }

  return result;
}

/**
 * Apply PageFilterOptions to a page array.
 * Used on All Pages view and collection pages.
 */
export function applyPageFilterOptions(
  pages: Page[],
  opts: PageFilterOptions
): Page[] {
  let result = pages;

  // Type filter
  if (opts.filterBy !== 'all') {
    switch (opts.filterBy) {
      case 'notes':
        result = result.filter(p => p.viewMode === 'note' && !p.isDailyNote);
        break;
      case 'collections':
        result = result.filter(p => p.viewMode === 'collection');
        break;
      case 'tasks':
        result = result.filter(p => p.viewMode === 'tasks');
        break;
    }
  }

  // Tag filter
  if (opts.tags.length > 0) {
    result = result.filter(p => {
      if (!p.tags) return false;
      const pageTags = p.tags.split(',').map(s => s.trim()).filter(Boolean);
      return opts.tags.some(ft => pageTags.includes(ft));
    });
  }

  return result;
}

/**
 * Collect all unique tags from a task array (for tag filter suggestions).
 */
export function collectTaskTags(tasks: Task[]): string[] {
  const tagSet = new Set<string>();
  for (const t of tasks) {
    if (t.tag) {
      t.tag.split(',').map(s => s.trim()).filter(Boolean).forEach(tag => tagSet.add(tag));
    }
  }
  return Array.from(tagSet).sort();
}

/**
 * Collect all unique tags from a page array (for tag filter suggestions).
 */
export function collectPageTags(pages: Page[]): string[] {
  const tagSet = new Set<string>();
  for (const p of pages) {
    if (p.tags) {
      p.tags.split(',').map(s => s.trim()).filter(Boolean).forEach(tag => tagSet.add(tag));
    }
  }
  return Array.from(tagSet).sort();
}

// ============================================================================
// NOTE SELECTORS
// ============================================================================

// Notes have no overlap with tasks - they use separate filtering and grouping logic
// Note filtering is handled in NoteCollection component based on viewMode, groupBy, sortBy
