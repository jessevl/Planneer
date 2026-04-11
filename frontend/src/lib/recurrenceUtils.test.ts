/**
 * @file recurrenceUtils.test.ts
 * @description Unit tests for recurring task date calculations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getNextDueDate, describeRecurrence } from './recurrenceUtils';
import type { RecurrencePattern } from '@/types/task';

// Mock date for consistent testing - 2025-01-15 (Wednesday)
const MOCK_TODAY = '2025-01-15';

describe('recurrenceUtils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getNextDueDate', () => {
    describe('daily recurrence', () => {
      it('returns next day for daily interval 1', () => {
        const pattern: RecurrencePattern = {
          type: 'daily',
          interval: 1,
          endType: 'never',
          anchorDate: '2025-01-15',
        };
        
        const next = getNextDueDate('2025-01-15', pattern);
        expect(next).toBe('2025-01-16');
      });

      it('returns day + interval for daily interval > 1', () => {
        const pattern: RecurrencePattern = {
          type: 'daily',
          interval: 3,
          endType: 'never',
          anchorDate: '2025-01-15',
        };
        
        const next = getNextDueDate('2025-01-15', pattern);
        expect(next).toBe('2025-01-18');
      });

      it('crosses month boundary correctly', () => {
        const pattern: RecurrencePattern = {
          type: 'daily',
          interval: 1,
          endType: 'never',
          anchorDate: '2025-01-31',
        };
        
        const next = getNextDueDate('2025-01-31', pattern);
        expect(next).toBe('2025-02-01');
      });
    });

    describe('weekly recurrence', () => {
      it('adds one week for simple weekly', () => {
        const pattern: RecurrencePattern = {
          type: 'weekly',
          interval: 1,
          endType: 'never',
          anchorDate: '2025-01-15',
        };
        
        const next = getNextDueDate('2025-01-15', pattern);
        expect(next).toBe('2025-01-22');
      });

      it('adds multiple weeks for interval > 1', () => {
        const pattern: RecurrencePattern = {
          type: 'weekly',
          interval: 2,
          endType: 'never',
          anchorDate: '2025-01-15',
        };
        
        const next = getNextDueDate('2025-01-15', pattern);
        expect(next).toBe('2025-01-29');
      });

      it('finds next weekday in same week', () => {
        // Wednesday Jan 15, weekdays: Mon(1), Wed(3), Fri(5)
        const pattern: RecurrencePattern = {
          type: 'weekly',
          interval: 1,
          weekDays: [1, 3, 5], // Mon, Wed, Fri
          endType: 'never',
          anchorDate: '2025-01-15',
        };
        
        // Completing Wednesday should give Friday
        const next = getNextDueDate('2025-01-15', pattern);
        expect(next).toBe('2025-01-17'); // Friday
      });

      it('wraps to next week when no more days in current week', () => {
        // Friday Jan 17, weekdays: Mon(1), Wed(3), Fri(5)
        const pattern: RecurrencePattern = {
          type: 'weekly',
          interval: 1,
          weekDays: [1, 3, 5],
          endType: 'never',
          anchorDate: '2025-01-17',
        };
        
        // Completing Friday should give Monday of next week
        const next = getNextDueDate('2025-01-17', pattern);
        expect(next).toBe('2025-01-20'); // Monday
      });
    });

    describe('monthly recurrence', () => {
      it('same day next month', () => {
        const pattern: RecurrencePattern = {
          type: 'monthly',
          interval: 1,
          endType: 'never',
          anchorDate: '2025-01-15',
        };
        
        const next = getNextDueDate('2025-01-15', pattern);
        expect(next).toBe('2025-02-15');
      });

      it('handles month-end edge case (Jan 31 -> Feb 28)', () => {
        const pattern: RecurrencePattern = {
          type: 'monthly',
          interval: 1,
          endType: 'never',
          anchorDate: '2025-01-31',
        };
        
        const next = getNextDueDate('2025-01-31', pattern);
        expect(next).toBe('2025-02-28'); // Feb 2025 has 28 days
      });

      it('handles leap year (Jan 31 -> Feb 29 in 2024)', () => {
        // Set mock time to 2024 for this test
        vi.setSystemTime(new Date('2024-01-31T12:00:00Z'));
        
        const pattern: RecurrencePattern = {
          type: 'monthly',
          interval: 1,
          endType: 'never',
          anchorDate: '2024-01-31',
        };
        
        const next = getNextDueDate('2024-01-31', pattern);
        expect(next).toBe('2024-02-29'); // 2024 is a leap year
        
        // Reset to original mock date
        vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
      });

      it('adds multiple months for interval > 1', () => {
        const pattern: RecurrencePattern = {
          type: 'monthly',
          interval: 3,
          endType: 'never',
          anchorDate: '2025-01-15',
        };
        
        const next = getNextDueDate('2025-01-15', pattern);
        expect(next).toBe('2025-04-15');
      });

      it('handles dayOfWeek monthly (2nd Tuesday)', () => {
        // Jan 14, 2025 is the 2nd Tuesday of January
        const pattern: RecurrencePattern = {
          type: 'monthly',
          interval: 1,
          monthlyType: 'dayOfWeek',
          endType: 'never',
          anchorDate: '2025-01-14', // 2nd Tuesday
        };
        
        const next = getNextDueDate('2025-01-14', pattern);
        expect(next).toBe('2025-02-11'); // 2nd Tuesday of Feb
      });
    });

    describe('yearly recurrence', () => {
      it('same date next year', () => {
        const pattern: RecurrencePattern = {
          type: 'yearly',
          interval: 1,
          endType: 'never',
          anchorDate: '2025-01-15',
        };
        
        const next = getNextDueDate('2025-01-15', pattern);
        expect(next).toBe('2026-01-15');
      });

      it('adds multiple years for interval > 1', () => {
        const pattern: RecurrencePattern = {
          type: 'yearly',
          interval: 2,
          endType: 'never',
          anchorDate: '2025-01-15',
        };
        
        const next = getNextDueDate('2025-01-15', pattern);
        expect(next).toBe('2027-01-15');
      });

      it('handles Feb 29 on leap year to non-leap year', () => {
        const pattern: RecurrencePattern = {
          type: 'yearly',
          interval: 1,
          endType: 'never',
          anchorDate: '2024-02-29',
        };
        
        const next = getNextDueDate('2024-02-29', pattern);
        // dayjs typically returns Feb 28 for non-leap years
        expect(next).toBe('2025-02-28');
      });
    });

    describe('end conditions', () => {
      it('returns null when end count reached', () => {
        const pattern: RecurrencePattern = {
          type: 'daily',
          interval: 1,
          endType: 'count',
          endCount: 3,
          completedCount: 3, // Already completed 3 times
          anchorDate: '2025-01-15',
        };
        
        const next = getNextDueDate('2025-01-15', pattern);
        expect(next).toBeNull();
      });

      it('continues when count not yet reached', () => {
        const pattern: RecurrencePattern = {
          type: 'daily',
          interval: 1,
          endType: 'count',
          endCount: 3,
          completedCount: 2,
          anchorDate: '2025-01-15',
        };
        
        const next = getNextDueDate('2025-01-15', pattern);
        expect(next).toBe('2025-01-16');
      });

      it('returns null when end date passed', () => {
        const pattern: RecurrencePattern = {
          type: 'daily',
          interval: 1,
          endType: 'date',
          endDate: '2025-01-16',
          anchorDate: '2025-01-15',
        };
        
        // Next would be Jan 17, but end date is Jan 16
        const next = getNextDueDate('2025-01-16', pattern);
        expect(next).toBeNull();
      });

      it('continues when end date not yet passed', () => {
        const pattern: RecurrencePattern = {
          type: 'daily',
          interval: 1,
          endType: 'date',
          endDate: '2025-01-20',
          anchorDate: '2025-01-15',
        };
        
        const next = getNextDueDate('2025-01-15', pattern);
        expect(next).toBe('2025-01-16');
      });
    });

    describe('overdue task handling', () => {
      it('advances to today for overdue daily task', () => {
        const pattern: RecurrencePattern = {
          type: 'daily',
          interval: 1,
          endType: 'never',
          anchorDate: '2025-01-10',
        };
        
        // Task was due Jan 10, completing it on Jan 15
        // The function calculates next = Jan 10 + 1 = Jan 11
        // Since Jan 11 is in the past, it advances to today (Jan 15)
        const next = getNextDueDate('2025-01-10', pattern);
        expect(next).toBe('2025-01-15'); // Advances to today
      });
    });
  });
});
