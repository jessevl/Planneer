/**
 * @file TaskViewPills.tsx
 * @description Pill navigation for task filtering in the main content area
 * @app TASKS - Used in TasksView for quick filter switching
 * 
 * Displays horizontal pill buttons for filtering tasks (desktop/tablet):
 * - Inbox: Tasks without a task page
 * - Today: Tasks due today or overdue
 * - Upcoming: Tasks with any due date
 * - All Tasks: All tasks
 * 
 * On mobile, displays as a 2x2 grid with larger touch targets for better accessibility.
 * 
 * Uses TanStack Router Links for URL-based navigation.
 * Pills show count badges when counts are provided.
 */
import React from 'react';
import { Link } from '@tanstack/react-router';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import { InboxIcon, TodayIcon, JournalCalendarIcon, AllTasksIcon } from '../common/Icons';
import type { TaskFilter } from '@/stores/navigationStore';

interface TaskViewPillsProps {
  /** Currently active filter */
  activeFilter: TaskFilter;
  /** Optional counts for each filter */
  counts?: {
    inbox?: number;
    today?: number;
    upcoming?: number;
    all?: number;
  };
}

interface PillConfig {
  id: TaskFilter;
  label: string;
  icon: React.ReactNode;
}

const pills: PillConfig[] = [
  { id: 'inbox', label: 'Inbox', icon: <InboxIcon className="w-4 h-4" /> },
  { id: 'today', label: 'Today', icon: <TodayIcon className="w-4 h-4" /> },
  { id: 'upcoming', label: 'Upcoming', icon: <JournalCalendarIcon className="w-4 h-4" /> },
  { id: 'all', label: 'All Tasks', icon: <AllTasksIcon className="w-4 h-4" /> },
];

const TaskViewPills: React.FC<TaskViewPillsProps> = ({
  activeFilter,
  counts = {},
}) => {
  const isMobile = useIsMobile();

  return (
    <div className={isMobile ? 'grid grid-cols-2 gap-2' : 'flex items-center gap-1.5'}>
      {pills.map((pill) => {
        const isActive = activeFilter === pill.id;
        const count = counts[pill.id];
        
        return (
          <Link
            key={pill.id}
            to="/tasks/$filter"
            params={{ filter: pill.id }}
            className={`
              flex items-center gap-2 
              ${isMobile ? 'px-4 py-3.5 justify-center' : 'px-3 py-1.5'} 
              rounded-xl text-sm font-medium 
              transition-colors border no-underline
              ${isActive
                ? 'bg-[var(--color-interactive-bg)] text-[var(--color-interactive-text)] border-[var(--color-interactive-border)]'
                : 'text-[var(--color-text-secondary)] border-[var(--color-border-default)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]'
              }
            `}
          >
            <span className={isActive ? 'text-[var(--color-interactive-text-strong)]' : 'text-[var(--color-text-tertiary)]'}>
              {pill.icon}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="whitespace-nowrap">{pill.label}</span>
              {count !== undefined && count > 0 && (
                <span className={`
                  px-1.5 py-0.5 text-[10px] rounded-lg min-w-[18px] text-center font-bold
                  ${isActive 
                    ? 'bg-[var(--color-interactive-bg)] text-[var(--color-interactive-text)] border border-[var(--color-interactive-border)]' 
                    : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)] border border-[var(--color-border-default)]'
                  }
                `}>
                  {count}
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
};

export default TaskViewPills;
