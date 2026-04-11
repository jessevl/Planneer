/**
 * @file TodaySectionsBoard.tsx
 * @description Home agenda board rendered with the shared kanban task view
 * @app SHARED - Used on HomeView to surface short-horizon task focus
 *
 * Features:
 * - Reuses the standard KanbanView column styling from Tasks
 * - Restricts home agenda to overdue, today, and tomorrow buckets
 * - Caps each column to five tasks with a compact overflow label
 *
 * Used by:
 * - HomeView
 */
import React, { useMemo } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui';
import KanbanView from '@/components/tasks/KanbanView';
import type { Task } from '@/types/task';
import type { Page } from '@/types/page';
import type { DateGroupKey } from '@/lib/dateGroups';

const PREVIEW_LIMIT = 5;
const HOME_AGENDA_GROUPS: DateGroupKey[] = ['overdue', 'today', 'tomorrow'];

interface TodaySectionsBoardProps {
  /** Tasks due before today */
  overdueTasks: Task[];
  /** Tasks due today */
  todayTasks: Task[];
  /** Tasks due tomorrow */
  tomorrowTasks: Task[];
  /** Today's ISO date for task row overdue handling */
  todayISO: string;
  /** Task pages for badge lookup */
  taskPages: Page[];
  /** Toggle task completion */
  onToggleComplete: (taskId: string) => void;
  /** Open a task for editing */
  onTaskClick: (taskId: string) => void;
  /** Open the Today task view */
  onViewTodayTasks: () => void;
  /** Open the Upcoming task view */
  /** Start quick task creation */
  onCreateTask: () => void;
}

const TodaySectionsBoard: React.FC<TodaySectionsBoardProps> = ({
  overdueTasks,
  todayTasks,
  tomorrowTasks,
  todayISO,
  taskPages,
  onToggleComplete,
  onTaskClick,
  onViewTodayTasks,
  onCreateTask,
}) => {
  const agendaTasks = useMemo(
    () => [...overdueTasks, ...todayTasks, ...tomorrowTasks],
    [overdueTasks, todayTasks, tomorrowTasks],
  );
  const hasTasks = agendaTasks.length > 0;
  const hiddenCounts = useMemo(
    () => ({
      overdue: Math.max(0, overdueTasks.length - PREVIEW_LIMIT),
      today: Math.max(0, todayTasks.length - PREVIEW_LIMIT),
      tomorrow: Math.max(0, tomorrowTasks.length - PREVIEW_LIMIT),
    }),
    [overdueTasks.length, todayTasks.length, tomorrowTasks.length],
  );
  const totalHiddenCount = hiddenCounts.overdue + hiddenCounts.today + hiddenCounts.tomorrow;

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text-primary)]">
          <CheckCircle2 className="h-5 w-5 text-[var(--color-accent-primary)]" />
          Agenda
        </h2>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCreateTask}
            className="text-[var(--color-accent-primary)] hover:bg-[var(--color-surface-secondary)]"
            title="Create task"
          >
            <Plus className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onViewTodayTasks}
            className="text-[var(--color-accent-primary)] hover:bg-[var(--color-surface-secondary)]"
          >
            View all
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <KanbanView
          tasks={agendaTasks}
          onToggleComplete={onToggleComplete}
          onEditTask={(taskId) => {
            if (!taskId) return;
            onTaskClick(taskId);
          }}
          groupBy="date"
          todayDate={todayISO}
          taskPages={taskPages}
          showParentPage={true}
          visibleGroupKeys={HOME_AGENDA_GROUPS}
          maxTasksPerGroup={PREVIEW_LIMIT}
          embedded={true}
          renderGroupFooter={({ groupKey, hiddenCount }) => {
            if (hiddenCount <= 0) return null;

            return (
              <p className="px-1 pt-2 text-[11px] leading-4 text-[var(--color-text-tertiary)]">
                {hiddenCount} more item{hiddenCount === 1 ? '' : 's'}
              </p>
            );
          }}
        />

        {!hasTasks && (
          <p className="px-1 pt-2 text-xs text-[var(--color-text-tertiary)]">
            Use the quick add button to plan what is next.
          </p>
        )}
      </div>
    </section>
  );
};

export default TodaySectionsBoard;