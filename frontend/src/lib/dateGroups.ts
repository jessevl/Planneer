/**
 * @file dateGroups.ts
 * @description Date grouping and categorization utilities
 * @app SHARED - Used by Tasks (due dates) and Pages (updated dates)
 * 
 * Provides intelligent date grouping for tasks and pages:
 * 
 * Task date groups (for task due dates):
 * - Overdue, Today, Tomorrow, This Week, Next Week, Later, Not Planned
 * - categorizeDateGroup(): Determine which group a due date belongs to
 * - dateGroupToDate(): Convert group key to ISO date (for drag-drop)
 * - getDateGroupSubtitle(): Human-readable date range ("Nov 25 - Dec 1")
 * 
 * Page date groups (for page updated dates):
 * - Today, Yesterday, This Week, Last Week, This Month, Older
 * - categorizePageDateGroup(): Determine which group an updated date belongs to
 * - generatePageDateGroups(): Generate groups that have pages
 * 
 * Used by:
 * - TaskList/KanbanView: Group tasks by due date
 * - PageCollection: Group pages by updated date
 */
import dayjs, { Dayjs } from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import weekday from 'dayjs/plugin/weekday';

dayjs.extend(isSameOrBefore);
dayjs.extend(weekday);

export type DateGroupKey = 'overdue' | 'today' | 'tomorrow' | 'thisWeek' | 'nextWeek' | 'later' | 'notPlanned';

export interface DateGroup {
  key: DateGroupKey;
  label: string;
}

export const DATE_GROUPS: DateGroup[] = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'thisWeek', label: 'This week' },
  { key: 'nextWeek', label: 'Next week' },
  { key: 'later', label: 'Later' },
  { key: 'notPlanned', label: 'Not planned' },
];

/**
 * Categorizes a task's due date into a date group.
 * 
 * @param dueDate - The due date string (YYYY-MM-DD) or undefined
 * @param today - The reference date (defaults to today)
 * @returns The date group key
 */
export function categorizeDateGroup(dueDate: string | undefined, today: Dayjs): DateGroupKey {
  if (!dueDate) return 'notPlanned';

  const taskDate = dayjs(dueDate).startOf('day');
  const todayStart = today.startOf('day');
  const daysAway = taskDate.diff(todayStart, 'day');

  if (daysAway < 0) return 'overdue';
  if (daysAway === 0) return 'today';
  if (daysAway === 1) return 'tomorrow';

  // This week: remaining days in the current calendar week (up to end of week)
  const endOfThisWeek = todayStart.endOf('week');
  if (taskDate.isSameOrBefore(endOfThisWeek, 'day')) {
    return 'thisWeek';
  }

  // Next week: the next calendar week
  const startOfNextWeek = endOfThisWeek.add(1, 'day');
  const endOfNextWeek = startOfNextWeek.endOf('week');
  if (taskDate.isSameOrBefore(endOfNextWeek, 'day')) {
    return 'nextWeek';
  }

  return 'later';
}

/**
 * Gets the date range subtitle for a date group.
 * 
 * @param groupKey - The date group key
 * @param today - The reference date (defaults to today)
 * @returns The formatted date range string or null
 */
export function getDateGroupSubtitle(groupKey: DateGroupKey, today: Dayjs): string | null {
  const todayStart = today.startOf('day');

  switch (groupKey) {
    case 'overdue':
      return null; // No subtitle for overdue
    case 'today':
      return todayStart.format('D MMMM');
    case 'tomorrow':
      return todayStart.add(1, 'day').format('D MMMM');
    case 'thisWeek': {
      const endOfWeek = todayStart.endOf('week');
      // If tomorrow is the start, show range, otherwise just end date
      const start = todayStart.add(2, 'day');
      if (start.isAfter(endOfWeek)) {
        return endOfWeek.format('D MMMM');
      }
      return `${start.format('D MMMM')} - ${endOfWeek.format('D MMMM')}`;
    }
    case 'nextWeek': {
      const startOfNextWeek = todayStart.endOf('week').add(1, 'day');
      const endOfNextWeek = startOfNextWeek.endOf('week');
      return `${startOfNextWeek.format('D MMMM')} - ${endOfNextWeek.format('D MMMM')}`;
    }
    case 'later':
      return null; // No subtitle for later
    case 'notPlanned':
      return null; // No subtitle for not planned
  }
}

/**
 * Maps a date group key to a specific date for drag-and-drop operations.
 * 
 * @param groupKey - The target date group
 * @param today - The reference date (defaults to today)
 * @returns The date string (YYYY-MM-DD) or undefined for notPlanned
 */
export function dateGroupToDate(groupKey: DateGroupKey, today: Dayjs): string | undefined {
  const todayStart = today.startOf('day');

  switch (groupKey) {
    case 'overdue':
      // Set to yesterday
      return todayStart.subtract(1, 'day').format('YYYY-MM-DD');
    case 'today':
      return todayStart.format('YYYY-MM-DD');
    case 'tomorrow':
      return todayStart.add(1, 'day').format('YYYY-MM-DD');
    case 'thisWeek':
      // Set to the end of this week
      return todayStart.endOf('week').format('YYYY-MM-DD');
    case 'nextWeek':
      // Set to the start of next week
      return todayStart.endOf('week').add(1, 'day').format('YYYY-MM-DD');
    case 'later':
      // Set to 2 weeks from now
      return todayStart.add(14, 'day').format('YYYY-MM-DD');
    case 'notPlanned':
      return undefined;
  }
}

// ============================================================================
// PAGE DATE GROUPS (Backward-looking)
// ============================================================================

export type PageDateGroupKey = 
  | 'today' 
  | 'yesterday' 
  | 'previous7days' 
  | 'previous30days'
  | string; // months like '2025-11', '2025-10', or years like '2024', '2023'

export interface PageDateGroup {
  key: PageDateGroupKey;
  label: string;
  order: number;
}

/**
 * Categorizes a page's date (creation or update) into a backward-looking date group.
 * 
 * @param pageDate - The page date string (ISO format)
 * @param today - The reference date (defaults to today)
 * @returns The page date group key
 */
export function categorizePageDateGroup(pageDate: string, today: Dayjs): PageDateGroupKey {
  const pageDay = dayjs(pageDate).startOf('day');
  const todayStart = today.startOf('day');
  const daysAgo = todayStart.diff(pageDay, 'day');

  // Today
  if (daysAgo === 0) return 'today';
  
  // Yesterday
  if (daysAgo === 1) return 'yesterday';
  
  // Previous 7 days (2-7 days ago)
  if (daysAgo >= 2 && daysAgo <= 7) return 'previous7days';
  
  // Previous 30 days (8-30 days ago)
  if (daysAgo >= 8 && daysAgo <= 30) return 'previous30days';
  
  const pageYear = pageDay.year();
  const pageMonth = pageDay.month(); // 0-indexed
  const currentYear = todayStart.year();
  
  // Same year, but older than 30 days - group by month
  if (pageYear === currentYear) {
    return `${pageYear}-${String(pageMonth + 1).padStart(2, '0')}`;
  }
  
  // Previous years - group by year
  return String(pageYear);
}

/**
 * Generates all relevant page date groups for a set of pages.
 * 
 * @param pages - Array of page dates
 * @param today - The reference date (defaults to today)
 * @returns Ordered array of page date groups
 */
export function generatePageDateGroups(pages: { date: string }[], today: Dayjs): PageDateGroup[] {
  const groups = new Map<string, PageDateGroup>();
  const currentYear = today.year();
  
  // Process all pages to find which groups we need
  pages.forEach(page => {
    const groupKey = categorizePageDateGroup(page.date, today);
    
    if (!groups.has(groupKey)) {
      let label = '';
      let order = 0;
      
      if (groupKey === 'today') {
        label = 'Today';
        order = 0;
      } else if (groupKey === 'yesterday') {
        label = 'Yesterday';
        order = 1;
      } else if (groupKey === 'previous7days') {
        label = 'Previous 7 days';
        order = 2;
      } else if (groupKey === 'previous30days') {
        label = 'Previous 30 days';
        order = 3;
      } else if (groupKey.includes('-')) {
        // Month group (e.g., '2025-11')
        const [year, month] = groupKey.split('-');
        const monthDate = dayjs(`${year}-${month}-01`);
        label = monthDate.format('MMMM YYYY');
        // Order by year and month (more recent first)
        order = 100 + (currentYear - parseInt(year)) * 12 + (11 - parseInt(month));
      } else {
        // Year group (e.g., '2024')
        label = groupKey;
        // Order by year (more recent first)
        order = 1000 + (currentYear - parseInt(groupKey));
      }
      
      groups.set(groupKey, { key: groupKey, label, order });
    }
  });
  
  // Sort by order
  return Array.from(groups.values()).sort((a, b) => a.order - b.order);
}

// Legacy aliases for backward compatibility
export type NoteDateGroupKey = PageDateGroupKey;
export type NoteDateGroup = PageDateGroup;
export const categorizeNoteDateGroup = categorizePageDateGroup;
export const generateNoteDateGroups = generatePageDateGroups;
