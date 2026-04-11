/**
 * @file dateUtils.ts
 * @description Centralized date utilities - single source of truth for date operations
 * @app SHARED - Used by Tasks and Notes apps
 * 
 * Provides standardized date handling to eliminate inconsistent date patterns:
 * - All dates use ISO strings (YYYY-MM-DD) as the canonical format
 * - dayjs objects are used internally for calculations only
 * - Exported functions handle conversion and formatting
 * 
 * This consolidates scattered dayjs() calls and eliminates the need for
 * components to pass both `todayISO` and `todayDayjs` props.
 */
import dayjs, { Dayjs } from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import weekday from 'dayjs/plugin/weekday';
import dayOfYear from 'dayjs/plugin/dayOfYear';

dayjs.extend(isSameOrBefore);
dayjs.extend(weekday);
dayjs.extend(dayOfYear);

// ============================================================================
// Core Date Constants & Functions
// ============================================================================

/**
 * Get today's date as an ISO string (YYYY-MM-DD).
 * This is the canonical way to get "today" throughout the app.
 */
export function getTodayISO(): string {
  return dayjs().format('YYYY-MM-DD');
}

/**
 * Get today as a dayjs object at start of day.
 * Use this when you need to do date calculations.
 */
export function getToday(): Dayjs {
  return dayjs().startOf('day');
}

/**
 * Parse an ISO date string to a dayjs object.
 * Returns start of day for consistent comparisons.
 */
export function parseDate(isoDate: string): Dayjs {
  return dayjs(isoDate).startOf('day');
}

/**
 * Format a dayjs object to ISO string (YYYY-MM-DD).
 */
export function toISO(date: Dayjs): string {
  return date.format('YYYY-MM-DD');
}

// ============================================================================
// Date Comparisons
// ============================================================================

/**
 * Check if date is before today.
 */
export function isOverdue(isoDate: string | undefined): boolean {
  if (!isoDate) return false;
  return parseDate(isoDate).isBefore(getToday(), 'day');
}

/**
 * Check if date is today.
 */
export function isToday(isoDate: string | undefined): boolean {
  if (!isoDate) return false;
  return parseDate(isoDate).isSame(getToday(), 'day');
}

/**
 * Check if date is tomorrow.
 */
export function isTomorrow(isoDate: string | undefined): boolean {
  if (!isoDate) return false;
  return parseDate(isoDate).isSame(getToday().add(1, 'day'), 'day');
}

/**
 * Check if date is within this week (remaining days).
 */
export function isThisWeek(isoDate: string | undefined): boolean {
  if (!isoDate) return false;
  const date = parseDate(isoDate);
  const today = getToday();
  const endOfWeek = today.endOf('week');
  return date.isAfter(today.add(1, 'day'), 'day') && date.isSameOrBefore(endOfWeek, 'day');
}

/**
 * Get days difference from today.
 */
export function daysFromToday(isoDate: string): number {
  return parseDate(isoDate).diff(getToday(), 'day');
}

// ============================================================================
// Date Formatting
// ============================================================================

/**
 * Format date for display (e.g., "Nov 27" or "27 November").
 */
export function formatDate(isoDate: string, format: string = 'D MMMM'): string {
  return parseDate(isoDate).format(format);
}

/**
 * Format date with smart relative labels.
 * Returns "Today", "Tomorrow", "Yesterday", or formatted date.
 */
export function formatRelativeDate(isoDate: string): string {
  const today = getToday();
  const date = parseDate(isoDate);
  const diff = date.diff(today, 'day');
  
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  
  // Same year: show month and day
  if (date.year() === today.year()) {
    return date.format('MMM D');
  }
  
  // Different year: include year
  return date.format('MMM D, YYYY');
}

// ============================================================================
// Week navigation helpers (for due timelines, DailyNotes)
// ============================================================================

/**
 * Get the start of the week (Monday) containing the given date.
 * dayjs's startOf('week') returns Sunday, so we need custom logic.
 */
export function getWeekStart(isoDate: string): Dayjs {
  const date = parseDate(isoDate);
  const dayOfWeek = date.day(); // 0=Sun, 1=Mon, ..., 6=Sat
  // Calculate days to subtract to get to Monday
  // Sun(0) -> subtract 6 to get to previous Monday
  // Mon(1) -> subtract 0
  // Tue(2) -> subtract 1
  // etc.
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return date.subtract(daysToSubtract, 'day');
}

/**
 * Generate array of ISO dates for a week starting from the given week start.
 */
export function getWeekDates(weekStart: Dayjs): string[] {
  return Array.from({ length: 7 }, (_, i) => toISO(weekStart.add(i, 'day')));
}

/**
 * Check if a date is in the future (after today).
 */
export function isFuture(isoDate: string): boolean {
  return parseDate(isoDate).isAfter(getToday(), 'day');
}

/**
 * Check if date is yesterday.
 */
export function isYesterday(isoDate: string | undefined): boolean {
  if (!isoDate) return false;
  return parseDate(isoDate).isSame(getToday().subtract(1, 'day'), 'day');
}

/**
 * Check if a week start date would show future weeks only.
 * Used to limit week navigation to not go beyond current week.
 */
export function canNavigateToNextWeek(currentWeekStart: Dayjs): boolean {
  const maxWeekStart = getToday().add(1, 'week').startOf('week').add(1, 'day');
  return currentWeekStart.add(1, 'week').isBefore(maxWeekStart);
}

/**
 * Format date for journal headers (e.g., "Today", "Yesterday", "Wednesday, November 27")
 */
export function formatJournalDate(isoDate: string): string {
  if (isToday(isoDate)) return 'Today';
  if (isYesterday(isoDate)) return 'Yesterday';
  return parseDate(isoDate).format('dddd, MMMM D');
}

// ============================================================================
// Re-export dayjs for cases needing full functionality
// ============================================================================

export { dayjs };
export type { Dayjs };
