/**
 * @file DueTimelineStrip.tsx
 * @description Compact 7-day due-count timeline for home and upcoming task views
 * @app SHARED - Used by HomeView and TasksView
 *
 * Features:
 * - 7-day rolling due-count summary
 * - Horizontal desktop layout and vertical mobile layout
 * - Optional date selection and scroll-to-date behavior
 * - Compact styling for embedding inside larger surfaces
 *
 * Used by:
 * - TodaySectionsBoard
 * - TasksView
 */
import React, { useMemo } from 'react';
import { cn } from '@/lib/design-system';
import { dayjs } from '@/lib/dateUtils';
import type { Task } from '@/types/task';

interface DueTimelineStripProps {
  /** Tasks that should be counted across the upcoming days */
  tasks: Task[];
  /** Starting day for the strip */
  todayISO: string;
  /** Highlighted day for selection-aware contexts */
  highlightedDate?: string | null;
  /** Number of days to show */
  days?: number;
  /** Called when a day is selected */
  onSelectDate?: (iso: string) => void;
  /** Called after selecting a day, usually to scroll */
  onScrollToDate?: (iso: string) => void;
  /** Remove the outer border when embedded in another bordered surface */
  hideBorder?: boolean;
  /** Additional wrapper classes */
  className?: string;
  /** Alternate layout for narrow side-rail usage */
  layout?: 'default' | 'rail';
  /** Remove desktop inner padding for edge-to-edge embedding */
  flushDesktop?: boolean;
}

interface TimelineBucket {
  iso: string;
  label: string;
  shortDate: string;
  count: number;
  isToday: boolean;
}

const DueTimelineStrip: React.FC<DueTimelineStripProps> = React.memo(({
  tasks,
  todayISO,
  highlightedDate,
  days = 7,
  onSelectDate,
  onScrollToDate,
  hideBorder = false,
  className,
  layout = 'default',
  flushDesktop = false,
}) => {
  const timelineDays = useMemo<TimelineBucket[]>(() => {
    const start = dayjs(todayISO).startOf('day');

    return Array.from({ length: days }, (_, index) => {
      const date = start.add(index, 'day');
      const iso = date.format('YYYY-MM-DD');

      return {
        iso,
        label: index === 0 ? 'Today' : date.format('ddd'),
        shortDate: date.format('D MMM'),
        count: tasks.filter((task) => task.dueDate === iso).length,
        isToday: index === 0,
      };
    });
  }, [days, tasks, todayISO]);

  const maxCount = useMemo(() => Math.max(...timelineDays.map((day) => day.count), 1), [timelineDays]);
  const isInteractive = Boolean(onSelectDate || onScrollToDate);

  const handleActivate = (iso: string) => {
    onSelectDate?.(iso);
    onScrollToDate?.(iso);
  };

  if (layout === 'rail') {
    return (
      <div
        className={cn(
          'grid h-full min-h-full grid-rows-7 self-stretch bg-[var(--color-surface-primary)]',
          !hideBorder && 'border border-[var(--color-border-default)]',
          className,
        )}
      >
        {timelineDays.map((day) => {
          const isActive = highlightedDate ? highlightedDate === day.iso : day.isToday;
          const intensity = day.count === 0 ? 0 : Math.max(day.count / maxCount, 0.28);
          const barHeight = `clamp(16px, ${Math.max(intensity * 100, 28)}%, calc(100% - 6px))`;

          return (
            <button
              key={day.iso}
              type="button"
              onClick={() => handleActivate(day.iso)}
              className={cn(
                'm-1 flex min-h-0 items-stretch gap-2 rounded-2xl border px-2.5 py-2 text-left transition-colors',
                isInteractive && 'hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-base)]',
                isActive
                  ? 'border-[var(--color-accent-primary)]/20 bg-[var(--color-accent-primary)]/6'
                  : 'border-[var(--color-border-default)] bg-[var(--color-surface-primary)]',
              )}
            >
              <div className="min-w-0 flex-1 py-0.5">
                <div className={cn(
                  'text-[10px] font-semibold uppercase tracking-[0.16em]',
                  isActive ? 'text-[var(--color-accent-primary)]' : 'text-[var(--color-text-tertiary)]',
                )}>
                  {day.isToday ? 'Now' : day.label}
                </div>

                <div className="mt-0.5 text-[10px] text-[var(--color-text-secondary)]">
                  {day.isToday ? dayjs(day.iso).format('D MMM') : dayjs(day.iso).format('D')}
                </div>
              </div>

              <div className="flex min-h-0 self-stretch items-end justify-center pt-1 pb-0.5">
                <div
                  className={cn(
                    'flex w-7 items-center justify-center rounded-full text-[11px] font-semibold leading-none transition-[height] duration-300',
                    day.count > 0
                      ? 'bg-[var(--color-accent-primary)] text-white'
                      : 'border border-dashed border-[var(--color-border-default)] bg-[var(--color-surface-base)] text-[var(--color-text-tertiary)]',
                  )}
                  style={{ height: day.count > 0 ? barHeight : '16px' }}
                >
                  {day.count}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-[20px] bg-[var(--color-surface-primary)]',
        !hideBorder && 'border border-[var(--color-border-default)]',
        className,
      )}
    >
      <div className="space-y-1.5 p-2 lg:hidden">
        {timelineDays.map((day) => {
          const isActive = highlightedDate ? highlightedDate === day.iso : day.isToday;
          const intensity = day.count === 0 ? 0 : Math.max(day.count / maxCount, 0.28);
          const barHeight = `${Math.min(18 + intensity * 24, 36)}px`;

          return (
            <button
              key={day.iso}
              type="button"
              onClick={() => handleActivate(day.iso)}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition-colors',
                isInteractive && 'hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-base)]',
                isActive
                  ? 'border-[var(--color-accent-primary)]/20 bg-[var(--color-accent-primary)]/6'
                  : 'border-[var(--color-border-default)] bg-[var(--color-surface-primary)]',
              )}
            >
              <div className="min-w-0 flex flex-1 items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-[11px] font-semibold uppercase tracking-[0.18em]',
                    isActive ? 'text-[var(--color-accent-primary)]' : 'text-[var(--color-text-tertiary)]',
                  )}>
                    {day.label}
                  </span>
                  <span className="text-sm text-[var(--color-text-secondary)]">{day.shortDate}</span>
                </div>

                <div className="flex items-end gap-2">
                  <div className="flex h-[44px] items-end justify-center pt-1">
                    <div
                      className={cn(
                        'flex w-8 items-center justify-center rounded-full text-xs font-semibold leading-none transition-[height] duration-300',
                        day.count > 0
                          ? 'bg-[var(--color-accent-primary)] text-white'
                          : 'border border-dashed border-[var(--color-border-default)] bg-[var(--color-surface-base)] text-[var(--color-text-tertiary)]',
                      )}
                      style={{ height: day.count > 0 ? barHeight : '16px' }}
                    >
                      {day.count}
                    </div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className={cn(
        flushDesktop
          ? 'hidden grid-cols-7 gap-2 lg:grid'
          : 'hidden grid-cols-7 gap-2 p-2 lg:grid lg:p-3',
      )}>
        {timelineDays.map((day) => {
          const isActive = highlightedDate ? highlightedDate === day.iso : day.isToday;
          const intensity = day.count === 0 ? 0 : Math.max(day.count / maxCount, 0.24);
          const barHeight = `${Math.min(18 + intensity * 28, 40)}px`;

          return (
            <button
              key={day.iso}
              type="button"
              onClick={() => handleActivate(day.iso)}
              className={cn(
                'flex min-w-0 items-center justify-between gap-3 rounded-2xl border px-2.5 py-2 text-left transition-colors',
                isInteractive && 'hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-base)]',
                isActive
                  ? 'border-[var(--color-accent-primary)]/20 bg-[var(--color-accent-primary)]/6'
                  : 'border-[var(--color-border-default)] bg-[var(--color-surface-primary)]',
              )}
            >
              <div className="min-w-0">
                <div className={cn(
                  'text-[10px] font-semibold uppercase tracking-[0.18em]',
                  isActive ? 'text-[var(--color-accent-primary)]' : 'text-[var(--color-text-tertiary)]',
                )}>
                  {day.label}
                </div>
                <div className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">
                  {day.shortDate}
                </div>
              </div>

              <div className="flex items-end gap-2">
                <div className="flex h-[46px] items-end justify-center pt-1">
                  <div
                    className={cn(
                      'flex w-8 items-center justify-center rounded-full text-xs font-semibold leading-none transition-[height] duration-300',
                      day.count > 0
                        ? 'bg-[var(--color-accent-primary)] text-white'
                        : 'border border-dashed border-[var(--color-border-default)] bg-[var(--color-surface-base)] text-[var(--color-text-tertiary)]',
                    )}
                    style={{ height: day.count > 0 ? barHeight : '16px' }}
                  >
                    {day.count}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});

DueTimelineStrip.displayName = 'DueTimelineStrip';

export default DueTimelineStrip;