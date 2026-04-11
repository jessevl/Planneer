/**
 * @file SubtaskBadge.tsx
 * @description Displays subtask progress as a compact badge (e.g., "2/5")
 * @app TASKS APP ONLY - Shows subtask completion status
 * 
 * A compact badge showing completed/total subtask count with a checklist icon.
 * Designed to be displayed alongside other badges in TaskRow.
 * 
 * Visual states:
 * - Gray when no subtasks are completed
 * - Green when all subtasks are completed
 * - Blue accent when partially completed
 */
import React from 'react';
import { ListChecksIcon } from '../common/Icons';

interface SubtaskBadgeProps {
  /** Total number of subtasks */
  total: number;
  /** Number of completed subtasks */
  completed: number;
  /** Optional additional CSS classes */
  className?: string;
}

const SubtaskBadge: React.FC<SubtaskBadgeProps> = ({ total, completed, className = '' }) => {
  // Don't render if no subtasks
  if (total === 0) return null;

  const isComplete = completed === total;
  const hasProgress = completed > 0 && completed < total;

  // Color styling based on progress
  const colorClasses = isComplete
    ? 'text-[var(--color-state-success)] bg-[var(--color-state-success)]/10'
    : hasProgress
      ? 'text-[var(--color-accent-fg)] bg-[var(--color-accent-muted)]'
      : 'text-[var(--color-text-tertiary)] bg-[var(--color-surface-tertiary)]';

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${colorClasses} ${className}`}
      title={`${completed} of ${total} subtasks completed`}
    >
      <ListChecksIcon className="w-3 h-3" />
      <span>{completed}/{total}</span>
    </span>
  );
};

export default SubtaskBadge;
