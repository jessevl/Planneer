/**
 * @file CardPreviewTasks.tsx
 * @description Split task preview for task page cards in grid view
 * @app PAGES - Used by PageCard when viewMode='tasks'
 *
 * Features:
 * - Shows compact task health stats without crowding the card preview
 *
 * Used by:
 * - PageCard (excerpt area for task pages)
 */
import React, { useMemo } from 'react';
import { ListTodo, AlertTriangle, Clock, CalendarOff } from 'lucide-react';
import { cn } from '@/lib/design-system';
import { selectTaskPreviewStatsByPage, type TaskPreviewLatestTask, useTasksStore } from '@/stores/tasksStore';

interface CardPreviewTasksProps {
  /** Parent page ID for the task page being previewed */
  pageId: string;
}

const CardPreviewTasks: React.FC<CardPreviewTasksProps> = React.memo(({ pageId }) => {
  const statsSelector = useMemo(() => selectTaskPreviewStatsByPage(pageId), [pageId]);
  const stats = useTasksStore(statsSelector);
  if (stats.totalCount === 0) {
    return (
      <div className="flex h-full flex-col justify-center rounded-xl border border-dashed border-[var(--color-border-default)] bg-[var(--color-surface-base)]/70 px-3 py-4 text-center">
        <ListTodo className="mx-auto mb-2 h-5 w-5 text-[var(--color-text-secondary)]" />
        <p className="text-xs font-medium text-[var(--color-text-primary)]">No tasks yet</p>
        <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">Add tasks to build a lightweight queue here.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-base)]/70 p-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        <ListTodo className="h-3.5 w-3.5" strokeWidth={1.8} />
        <span>Task page</span>
      </div>
      <StatsRail
        className="grid flex-1 grid-cols-2 gap-2"
        items={[
          { icon: ListTodo, label: 'Open', value: stats.openCount },
          { icon: AlertTriangle, label: 'Overdue', value: stats.overdueOpenCount, tone: 'urgent' },
          { icon: Clock, label: '7 days', value: stats.dueSoonCount },
          { icon: CalendarOff, label: 'No date', value: stats.undatedOpenCount },
        ]}
      />
    </div>
  );
});

CardPreviewTasks.displayName = 'CardPreviewTasks';

interface StatsRailProps {
  /** Compact stat rows shown on the right side of the preview */
  items: Array<StatItem>;
  /** Optional class name for layout composition */
  className?: string;
}

interface StatItem {
  icon: React.FC<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: number;
  tone?: 'default' | 'urgent';
}

const StatsRail: React.FC<StatsRailProps> = ({ items, className }) => (
    <div className={cn(className)}>
      {items.map((item) => (
        <StatRow key={item.label} {...item} />
      ))}
    </div>
);

const StatRow: React.FC<StatItem> = ({ icon: Icon, label, value, tone = 'default' }) => (
  <div
    className={cn(
      'flex items-center gap-1.5 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-secondary)]/45 px-2.5 py-2 text-[10px] text-[var(--color-text-secondary)]',
      tone === 'urgent' && 'bg-red-50/70 text-red-700 dark:bg-red-500/10 dark:text-red-300'
    )}
  >
    <Icon className="h-3 w-3 flex-shrink-0" strokeWidth={1.8} />
    <span className="truncate uppercase tracking-[0.14em]">{label}</span>
    <span className={cn('ml-auto font-semibold text-[var(--color-text-primary)]', tone === 'urgent' && 'text-red-700 dark:text-red-300')}>
      {value}
    </span>
  </div>
);

export default CardPreviewTasks;
