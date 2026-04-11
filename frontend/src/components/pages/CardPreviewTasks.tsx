/**
 * @file CardPreviewTasks.tsx
 * @description Split task preview for task page cards in grid view
 * @app PAGES - Used by PageCard when viewMode='tasks'
 *
 * Features:
 * - Highlights the most recently added task in the preview body
 * - Shows full task stats in a compact right-side column
 *
 * Used by:
 * - PageCard (excerpt area for task pages)
 */
import React, { useMemo } from 'react';
import { ListTodo, AlertTriangle, Clock, CalendarOff, Sparkles } from 'lucide-react';
import { DateBadge, SubtaskBadge } from '@/components/ui';
import { cn, priorityClasses } from '@/lib/design-system';
import { selectTaskPreviewStatsByPage, type TaskPreviewLatestTask, useTasksStore } from '@/stores/tasksStore';

interface CardPreviewTasksProps {
  /** Parent page ID for the task page being previewed */
  pageId: string;
}

const CardPreviewTasks: React.FC<CardPreviewTasksProps> = React.memo(({ pageId }) => {
  const statsSelector = useMemo(() => selectTaskPreviewStatsByPage(pageId), [pageId]);
  const stats = useTasksStore(statsSelector);
  const latestTask = stats.latestTask;

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
    <div className="flex h-full gap-2 overflow-hidden">
      <LatestTaskPreview task={latestTask} className="basis-2/3" />
      <StatsRail
        className="basis-1/3"
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

interface LatestTaskPreviewProps {
  /** Most recently created task for the page */
  task: TaskPreviewLatestTask | null;
  /** Optional class name for layout composition */
  className?: string;
}

const LatestTaskPreview: React.FC<LatestTaskPreviewProps> = ({ task, className }) => {
  if (!task) {
    return (
      <div className={cn('flex h-full flex-col justify-center rounded-xl border border-dashed border-[var(--color-border-default)] bg-[var(--color-surface-base)]/60 px-3 py-4', className)}>
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Latest task</span>
        <p className="mt-2 text-sm font-medium text-[var(--color-text-primary)]">Add the first task to see a live preview here.</p>
      </div>
    );
  }

  const priorityStyle = priorityClasses(task.priority);

  return (
    <div className={cn('flex h-full min-w-0 flex-col rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-base)]/80 px-3 py-3.5', className)}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
        <span>Latest task</span>
      </div>
      <div className="mt-3 min-w-0 flex flex-1 flex-col justify-between gap-4">
        <div className="flex items-start gap-3">
          <TaskStatusDot
            completed={task.completed}
            borderColor={priorityStyle.hex}
          />
          <p className={cn('line-clamp-4 text-base font-semibold leading-6 text-[var(--color-text-primary)]', task.completed && 'text-[var(--color-text-secondary)] line-through')}>
            {task.title || 'Untitled task'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-[var(--color-text-secondary)]">
          {task.dueDate ? <DateBadge date={task.dueDate} /> : null}
          {task.subtaskProgress ? (
            <SubtaskBadge
              total={task.subtaskProgress.total}
              completed={task.subtaskProgress.completed}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};

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
    <div className={cn('flex h-full flex-col justify-between rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-base)]/60 px-2.5 py-2', className)}>
      {items.map((item) => (
        <StatRow key={item.label} {...item} />
      ))}
    </div>
);

interface TaskStatusDotProps {
  /** Whether the task is completed */
  completed: boolean;
  /** Border color inherited from task priority */
  borderColor: string;
}

const TaskStatusDot: React.FC<TaskStatusDotProps> = ({ completed, borderColor }) => (
  <span
    aria-hidden="true"
    className="mt-1 h-4 w-4 flex-shrink-0 rounded-full border-2"
    style={{
      borderColor,
      backgroundColor: completed ? borderColor : 'transparent',
    }}
  />
);

const StatRow: React.FC<StatItem> = ({ icon: Icon, label, value, tone = 'default' }) => (
  <div
    className={cn(
      'flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[10px] text-[var(--color-text-secondary)]',
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
