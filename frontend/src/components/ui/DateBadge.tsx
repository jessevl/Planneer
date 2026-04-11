'use client';

import React from 'react';
import dayjs from 'dayjs';
import { cn } from '@/lib/design-system';

export interface DateBadgeProps {
  date: string | null;
  className?: string;
  compact?: boolean;
}

/**
 * DateBadge - Display date with semantic coloring
 * 
 * Colors:
 * - Overdue: Subtle red
 * - Today: Green
 * - Tomorrow / this week / future: Muted gray
 * 
 * @example
 * <DateBadge date={task.dueDate} />
 */
const DateBadge: React.FC<DateBadgeProps> = ({
  date,
  className,
  compact = false,
}) => {
  if (!date) return null;

  const today = dayjs().startOf('day');
  const taskDate = dayjs(date).startOf('day');
  const diffDays = taskDate.diff(today, 'day');

  // Determine color and text
  let colorClass = '';
  let pretty = '';

  if (diffDays < 0) {
    // Overdue - subtle red
    colorClass = 'text-red-500/80 dark:text-red-400/80';
    pretty = compact ? dayjs(date).format('MMM D') : dayjs(date).format('MMM D');
  } else if (diffDays === 0) {
    // Today
    colorClass = 'text-[var(--color-state-success)]';
    pretty = 'Today';
  } else if (diffDays === 1) {
    // Tomorrow
    colorClass = 'text-[var(--color-text-secondary)]';
    pretty = 'Tomorrow';
  } else if (diffDays <= 6) {
    // This week
    colorClass = 'text-[var(--color-text-secondary)]';
    pretty = dayjs(date).format('ddd');
  } else {
    // Future
    colorClass = 'text-[var(--color-text-secondary)]';
    pretty = dayjs(date).format('MMM D');
  }

  return (
    <div className={cn('text-xs font-medium inline-flex items-center gap-1', colorClass, className)}>
      {/* Calendar icon */}
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <span>{pretty}</span>
    </div>
  );
};

export default DateBadge;
