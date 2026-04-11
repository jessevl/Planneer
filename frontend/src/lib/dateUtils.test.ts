/**
 * @file dateUtils.test.ts
 * @description Unit tests for date utility functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getTodayISO,
  getToday,
  parseDate,
  toISO,
  isOverdue,
  isToday,
  isTomorrow,
  isThisWeek,
  daysFromToday,
  formatDate,
  formatRelativeDate,
  getWeekStart,
  getWeekDates,
  isFuture,
  isYesterday,
  formatJournalDate,
  dayjs,
} from './dateUtils';

// Mock date for consistent testing
// We'll use 2025-01-15 (Wednesday) as "today"
const MOCK_TODAY = '2025-01-15';

describe('dateUtils', () => {
  beforeEach(() => {
    // Mock dayjs to return a fixed date
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getTodayISO', () => {
    it('returns today as ISO string', () => {
      expect(getTodayISO()).toBe(MOCK_TODAY);
    });
  });

  describe('getToday', () => {
    it('returns today as dayjs object at start of day', () => {
      const today = getToday();
      expect(today.format('YYYY-MM-DD')).toBe(MOCK_TODAY);
      expect(today.hour()).toBe(0);
      expect(today.minute()).toBe(0);
    });
  });

  describe('parseDate', () => {
    it('parses ISO date string correctly', () => {
      const date = parseDate('2025-01-20');
      expect(date.format('YYYY-MM-DD')).toBe('2025-01-20');
    });

    it('returns start of day', () => {
      const date = parseDate('2025-01-20');
      expect(date.hour()).toBe(0);
      expect(date.minute()).toBe(0);
    });
  });

  describe('toISO', () => {
    it('formats dayjs to ISO string', () => {
      const date = dayjs('2025-01-20');
      expect(toISO(date)).toBe('2025-01-20');
    });
  });

  describe('isOverdue', () => {
    it('returns true for dates before today', () => {
      expect(isOverdue('2025-01-14')).toBe(true);
      expect(isOverdue('2025-01-10')).toBe(true);
    });

    it('returns false for today', () => {
      expect(isOverdue(MOCK_TODAY)).toBe(false);
    });

    it('returns false for future dates', () => {
      expect(isOverdue('2025-01-16')).toBe(false);
      expect(isOverdue('2025-02-01')).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isOverdue(undefined)).toBe(false);
    });
  });

  describe('isToday', () => {
    it('returns true for today', () => {
      expect(isToday(MOCK_TODAY)).toBe(true);
    });

    it('returns false for other dates', () => {
      expect(isToday('2025-01-14')).toBe(false);
      expect(isToday('2025-01-16')).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isToday(undefined)).toBe(false);
    });
  });

  describe('isTomorrow', () => {
    it('returns true for tomorrow', () => {
      expect(isTomorrow('2025-01-16')).toBe(true);
    });

    it('returns false for today', () => {
      expect(isTomorrow(MOCK_TODAY)).toBe(false);
    });

    it('returns false for other dates', () => {
      expect(isTomorrow('2025-01-17')).toBe(false);
      expect(isTomorrow('2025-01-14')).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isTomorrow(undefined)).toBe(false);
    });
  });

  describe('isYesterday', () => {
    it('returns true for yesterday', () => {
      expect(isYesterday('2025-01-14')).toBe(true);
    });

    it('returns false for today', () => {
      expect(isYesterday(MOCK_TODAY)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isYesterday(undefined)).toBe(false);
    });
  });

  describe('isThisWeek', () => {
    // 2025-01-15 is Wednesday, endOfWeek (Sunday) is 2025-01-18 in dayjs default locale
    // isThisWeek returns true for dates AFTER tomorrow but within the week
    it('returns true for dates after tomorrow in same week', () => {
      expect(isThisWeek('2025-01-17')).toBe(true); // Friday
      expect(isThisWeek('2025-01-18')).toBe(true); // Saturday (end of week)
    });

    it('returns false for today', () => {
      expect(isThisWeek(MOCK_TODAY)).toBe(false);
    });

    it('returns false for tomorrow', () => {
      expect(isThisWeek('2025-01-16')).toBe(false);
    });

    it('returns false for dates outside week', () => {
      expect(isThisWeek('2025-01-19')).toBe(false); // Sunday (next week in dayjs)
      expect(isThisWeek('2025-01-20')).toBe(false);
      expect(isThisWeek('2025-01-14')).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isThisWeek(undefined)).toBe(false);
    });
  });

  describe('isFuture', () => {
    it('returns true for future dates', () => {
      expect(isFuture('2025-01-16')).toBe(true);
      expect(isFuture('2025-02-01')).toBe(true);
    });

    it('returns false for today', () => {
      expect(isFuture(MOCK_TODAY)).toBe(false);
    });

    it('returns false for past dates', () => {
      expect(isFuture('2025-01-14')).toBe(false);
    });
  });

  describe('daysFromToday', () => {
    it('returns 0 for today', () => {
      expect(daysFromToday(MOCK_TODAY)).toBe(0);
    });

    it('returns positive for future dates', () => {
      expect(daysFromToday('2025-01-16')).toBe(1);
      expect(daysFromToday('2025-01-20')).toBe(5);
    });

    it('returns negative for past dates', () => {
      expect(daysFromToday('2025-01-14')).toBe(-1);
      expect(daysFromToday('2025-01-10')).toBe(-5);
    });
  });

  describe('formatDate', () => {
    it('formats with default pattern', () => {
      expect(formatDate('2025-01-15')).toBe('15 January');
    });

    it('formats with custom pattern', () => {
      expect(formatDate('2025-01-15', 'MMM D')).toBe('Jan 15');
      expect(formatDate('2025-01-15', 'YYYY-MM-DD')).toBe('2025-01-15');
    });
  });

  describe('formatRelativeDate', () => {
    it('returns "Today" for today', () => {
      expect(formatRelativeDate(MOCK_TODAY)).toBe('Today');
    });

    it('returns "Tomorrow" for tomorrow', () => {
      expect(formatRelativeDate('2025-01-16')).toBe('Tomorrow');
    });

    it('returns "Yesterday" for yesterday', () => {
      expect(formatRelativeDate('2025-01-14')).toBe('Yesterday');
    });

    it('returns formatted date for same year', () => {
      expect(formatRelativeDate('2025-02-01')).toBe('Feb 1');
      expect(formatRelativeDate('2025-12-25')).toBe('Dec 25');
    });

    it('includes year for different year', () => {
      expect(formatRelativeDate('2024-01-15')).toBe('Jan 15, 2024');
      expect(formatRelativeDate('2026-06-01')).toBe('Jun 1, 2026');
    });
  });

  describe('formatJournalDate', () => {
    it('returns "Today" for today', () => {
      expect(formatJournalDate(MOCK_TODAY)).toBe('Today');
    });

    it('returns "Yesterday" for yesterday', () => {
      expect(formatJournalDate('2025-01-14')).toBe('Yesterday');
    });

    it('returns full day name for other dates', () => {
      expect(formatJournalDate('2025-01-13')).toBe('Monday, January 13');
      expect(formatJournalDate('2025-01-20')).toBe('Monday, January 20');
    });
  });

  describe('getWeekStart', () => {
    // 2025-01-15 is Wednesday, week starts on Monday 2025-01-13
    it('returns Monday for dates in that week', () => {
      expect(toISO(getWeekStart('2025-01-15'))).toBe('2025-01-13'); // Wednesday
      expect(toISO(getWeekStart('2025-01-13'))).toBe('2025-01-13'); // Monday
      expect(toISO(getWeekStart('2025-01-19'))).toBe('2025-01-13'); // Sunday
    });

    it('handles Sunday correctly (goes to previous Monday)', () => {
      expect(toISO(getWeekStart('2025-01-12'))).toBe('2025-01-06'); // Sunday -> previous Monday
    });
  });

  describe('getWeekDates', () => {
    it('returns 7 consecutive ISO dates', () => {
      const weekStart = getWeekStart('2025-01-15'); // Monday Jan 13
      const dates = getWeekDates(weekStart);
      
      expect(dates).toHaveLength(7);
      expect(dates[0]).toBe('2025-01-13'); // Monday
      expect(dates[1]).toBe('2025-01-14'); // Tuesday
      expect(dates[2]).toBe('2025-01-15'); // Wednesday
      expect(dates[3]).toBe('2025-01-16'); // Thursday
      expect(dates[4]).toBe('2025-01-17'); // Friday
      expect(dates[5]).toBe('2025-01-18'); // Saturday
      expect(dates[6]).toBe('2025-01-19'); // Sunday
    });
  });
});
