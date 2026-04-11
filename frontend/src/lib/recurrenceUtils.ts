/**
 * @file recurrenceUtils.ts
 * @description Utilities for calculating recurring task dates
 * @app TASKS APP ONLY
 * 
 * Provides functions to calculate the next due date based on recurrence patterns.
 * Uses dayjs for date calculations with proper handling of edge cases like:
 * - Month-end dates (Jan 31 -> Feb 28)
 * - Weekday calculations
 * - End conditions (count, date, never)
 * 
 * Key function: getNextDueDate() - called when a recurring task is completed
 * to determine when the next instance should be due.
 */
import dayjs, { Dayjs } from 'dayjs';
import type { RecurrencePattern } from '@/types/task';
import { toISO, parseDate, getToday } from './dateUtils';

// ============================================================================
// Main Recurrence Calculation
// ============================================================================

/**
 * Calculate the next due date based on recurrence pattern.
 * Called when a recurring task is completed.
 * 
 * @param currentDueDate - The due date of the task being completed (ISO string)
 * @param pattern - The recurrence configuration
 * @returns Next due date as ISO string, or null if recurrence has ended
 * 
 * @example
 * // Daily task
 * getNextDueDate('2025-11-29', { type: 'daily', interval: 1, endType: 'never', anchorDate: '2025-11-29' })
 * // Returns: '2025-11-30'
 * 
 * @example
 * // Weekly on Mon/Wed/Fri, completed on Monday
 * getNextDueDate('2025-12-01', { type: 'weekly', interval: 1, weekDays: [1,3,5], endType: 'never', anchorDate: '2025-12-01' })
 * // Returns: '2025-12-03' (next Wednesday)
 */
export function getNextDueDate(
  currentDueDate: string,
  pattern: RecurrencePattern
): string | null {
  // Check end conditions first
  if (!canContinueRecurrence(pattern)) {
    return null;
  }

  const current = parseDate(currentDueDate);
  const today = getToday();
  let next: Dayjs;

  switch (pattern.type) {
    case 'daily':
      next = calculateNextDaily(current, pattern.interval);
      break;

    case 'weekly':
      next = calculateNextWeekly(current, pattern);
      break;

    case 'monthly':
      next = calculateNextMonthly(current, pattern);
      break;

    case 'yearly':
      next = calculateNextYearly(current, pattern.interval);
      break;

    default:
      next = current.add(pattern.interval, 'day');
  }

  // If the calculated date is in the past (task was overdue when completed),
  // advance to today or the next valid date
  if (next.isBefore(today, 'day')) {
    next = advanceToTodayOrLater(next, pattern, today);
  }

  // Final end date check
  if (pattern.endType === 'date' && pattern.endDate) {
    if (next.isAfter(parseDate(pattern.endDate), 'day')) {
      return null;
    }
  }

  return toISO(next);
}

/**
 * Check if the recurrence can continue (hasn't hit end condition)
 */
function canContinueRecurrence(pattern: RecurrencePattern): boolean {
  if (pattern.endType === 'count' && pattern.endCount) {
    const completed = pattern.completedCount || 0;
    if (completed >= pattern.endCount) {
      return false;
    }
  }
  return true;
}

// ============================================================================
// Daily Recurrence
// ============================================================================

function calculateNextDaily(current: Dayjs, interval: number): Dayjs {
  return current.add(interval, 'day');
}

// ============================================================================
// Weekly Recurrence
// ============================================================================

function calculateNextWeekly(current: Dayjs, pattern: RecurrencePattern): Dayjs {
  const { interval, weekDays } = pattern;

  // If no specific weekdays, just add interval weeks
  if (!weekDays || weekDays.length === 0) {
    return current.add(interval, 'week');
  }

  // Find the next matching weekday
  return findNextWeekDay(current, weekDays, interval);
}

/**
 * Find the next occurrence of specified weekdays.
 * 
 * For interval=1, finds the next matching day in the current or next week.
 * For interval>1, after going through all days in current week, 
 * skips to the appropriate week.
 */
function findNextWeekDay(
  from: Dayjs,
  weekDays: number[],
  interval: number
): Dayjs {
  const sortedDays = [...weekDays].sort((a, b) => a - b);
  const currentDay = from.day();

  // First, check if there's another day this week
  for (const day of sortedDays) {
    if (day > currentDay) {
      return from.day(day);
    }
  }

  // No more days this week, go to first day of next interval
  const weeksToAdd = interval;
  const nextWeekStart = from.add(weeksToAdd, 'week').startOf('week');
  
  // Return the first matching day of that week
  return nextWeekStart.day(sortedDays[0]);
}

// ============================================================================
// Monthly Recurrence
// ============================================================================

function calculateNextMonthly(current: Dayjs, pattern: RecurrencePattern): Dayjs {
  const { interval, monthlyType, anchorDate } = pattern;
  const anchor = parseDate(anchorDate);

  if (monthlyType === 'dayOfWeek') {
    // E.g., "2nd Tuesday of each month"
    return findNextMonthlyWeekday(current, anchor, interval);
  }

  // Default: same day of month (e.g., 15th)
  return findNextMonthlyDay(current, anchor, interval);
}

/**
 * Find the same day of month in the next interval month.
 * Handles month-end edge cases (Jan 31 -> Feb 28).
 */
function findNextMonthlyDay(
  current: Dayjs,
  anchor: Dayjs,
  interval: number
): Dayjs {
  const targetDay = anchor.date();
  let next = current.add(interval, 'month');

  // Handle months with fewer days
  const daysInMonth = next.daysInMonth();
  if (targetDay > daysInMonth) {
    next = next.date(daysInMonth);
  } else {
    next = next.date(targetDay);
  }

  return next;
}

/**
 * Find the same weekday position in the next interval month.
 * E.g., "2nd Tuesday" -> find 2nd Tuesday of next month.
 */
function findNextMonthlyWeekday(
  current: Dayjs,
  anchor: Dayjs,
  interval: number
): Dayjs {
  const weekdayPosition = getWeekdayPosition(anchor);
  const targetWeekday = anchor.day();

  const next = current.add(interval, 'month').startOf('month');

  // Find the nth occurrence of the weekday in the target month
  return findNthWeekdayOfMonth(next, targetWeekday, weekdayPosition);
}

/**
 * Get which occurrence of its weekday a date is (1st, 2nd, 3rd, 4th, 5th)
 */
function getWeekdayPosition(date: Dayjs): number {
  return Math.ceil(date.date() / 7);
}

/**
 * Find the nth occurrence of a weekday in a given month.
 */
function findNthWeekdayOfMonth(
  monthStart: Dayjs,
  weekday: number,
  position: number
): Dayjs {
  // Find first occurrence of the weekday
  let first = monthStart.day(weekday);
  if (first.isBefore(monthStart, 'day')) {
    first = first.add(1, 'week');
  }

  // Add weeks to get to the nth occurrence
  const result = first.add(position - 1, 'week');

  // If position is 5 and the month doesn't have a 5th occurrence, use the last one
  if (result.month() !== monthStart.month()) {
    return first.add(position - 2, 'week');
  }

  return result;
}

// ============================================================================
// Yearly Recurrence
// ============================================================================

function calculateNextYearly(current: Dayjs, interval: number): Dayjs {
  return current.add(interval, 'year');
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * When completing an overdue recurring task, advance to today or the next
 * valid date according to the pattern.
 */
function advanceToTodayOrLater(
  calculated: Dayjs,
  pattern: RecurrencePattern,
  today: Dayjs
): Dayjs {
  // For daily tasks, just return today
  if (pattern.type === 'daily') {
    return today;
  }

  // For weekly with specific days, find next matching day from today
  if (pattern.type === 'weekly' && pattern.weekDays?.length) {
    return findNextWeekDayFromDate(today, pattern.weekDays);
  }

  // For other patterns, calculate from today
  return today;
}

/**
 * Find the next matching weekday on or after a given date.
 */
function findNextWeekDayFromDate(from: Dayjs, weekDays: number[]): Dayjs {
  const sortedDays = [...weekDays].sort((a, b) => a - b);
  const currentDay = from.day();

  // Check today first
  if (sortedDays.includes(currentDay)) {
    return from;
  }

  // Find next matching day
  for (const day of sortedDays) {
    if (day > currentDay) {
      return from.day(day);
    }
  }

  // Wrap to next week
  return from.add(1, 'week').day(sortedDays[0]);
}

// ============================================================================
// Pattern Helpers for UI
// ============================================================================

/**
 * Get a human-readable description of a recurrence pattern.
 */
export function describeRecurrence(pattern: RecurrencePattern): string {
  const { type, interval, weekDays, endType, endDate, endCount } = pattern;

  let base = '';
  
  switch (type) {
    case 'daily':
      base = interval === 1 ? 'Daily' : `Every ${interval} days`;
      break;
    case 'weekly':
      if (weekDays?.length) {
        const dayNames = weekDays.map(d => DAY_NAMES_SHORT[d]).join(', ');
        base = interval === 1 
          ? `Weekly on ${dayNames}` 
          : `Every ${interval} weeks on ${dayNames}`;
      } else {
        base = interval === 1 ? 'Weekly' : `Every ${interval} weeks`;
      }
      break;
    case 'monthly':
      base = interval === 1 ? 'Monthly' : `Every ${interval} months`;
      break;
    case 'yearly':
      base = interval === 1 ? 'Yearly' : `Every ${interval} years`;
      break;
  }

  // Add end condition
  if (endType === 'date' && endDate) {
    base += ` until ${endDate}`;
  } else if (endType === 'count' && endCount) {
    const remaining = endCount - (pattern.completedCount || 0);
    base += ` (${remaining} left)`;
  }

  return base;
}

/** Short day names for weekday selection UI */
export const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
