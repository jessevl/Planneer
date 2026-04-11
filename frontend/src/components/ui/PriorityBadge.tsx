'use client';

import React from 'react';
import { cn, getPriorityColor } from '@/lib/design-system';

export interface PriorityBadgeProps {
  priority: 1 | 2 | 3 | 4;
  showLabel?: boolean;
  className?: string;
}

const priorityLabels = {
  1: 'P1',
  2: 'P2',
  3: 'P3',
  4: 'P4',
};

/**
 * PriorityBadge - Display priority with color coding
 * 
 * @example
 * <PriorityBadge priority={task.priority} showLabel />
 */
const PriorityBadge: React.FC<PriorityBadgeProps> = ({
  priority,
  showLabel = true,
  className,
}) => {
  const colors = getPriorityColor(priority);

  if (!showLabel) {
    // Just a colored dot
    return (
      <div
        className={cn('w-2 h-2 rounded-full flex-shrink-0', colors.bg, className)}
        aria-label={`Priority ${priority}`}
      />
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold',
        colors.bg,
        colors.text,
        className
      )}
    >
      <div className={cn('w-1.5 h-1.5 rounded-full', colors.text)} style={{ backgroundColor: colors.hex }} />
      {priorityLabels[priority]}
    </div>
  );
};

export default PriorityBadge;
