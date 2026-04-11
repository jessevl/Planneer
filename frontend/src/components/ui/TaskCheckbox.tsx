'use client';

import React from 'react';
import { cn } from '@/lib/design-system';
import { priorityClasses } from '@/lib/design-system';
import { hapticTaskComplete } from '@/lib/haptics';

export interface TaskCheckboxProps {
  /** Whether the task is completed */
  completed: boolean;
  /** Task priority for border and fill color */
  priority?: string;
  /** Called when checkbox is toggled */
  onChange: () => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional className */
  className?: string;
}

/**
 * TaskCheckbox - Circular checkbox with priority-colored border
 * 
 * Used by TaskRow, CompactTaskRow, KanbanView, and InternalLinkRender for consistent task completion UI.
 * - Not completed: Priority-colored circle outline (empty inside)
 * - Completed: Priority-colored circle outline with filled circle inside
 * 
 * NOTE: Uses inline styles for border to ensure visibility in contexts where
 * Tailwind classes may be overridden (e.g., inside Yoopta editor).
 * 
 * @example
 * <TaskCheckbox
 *   completed={task.completed}
 *   priority={task.priority}
 *   onChange={() => toggleComplete(task.id)}
 *   size="md"
 * />
 */
const TaskCheckbox: React.FC<TaskCheckboxProps> = ({
  completed,
  priority,
  onChange,
  size = 'md',
  className,
}) => {
  const sizeStyles = {
    sm: { button: 'w-4 h-4', inner: 'w-2 h-2' },
    md: { button: 'w-5 h-5', inner: 'w-2.5 h-2.5' },
    lg: { button: 'w-6 h-6', inner: 'w-3 h-3' },
  };

  const priorityStyle = priorityClasses(priority);
  const borderColor = priorityStyle.hex;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Trigger haptic feedback when completing a task (not uncompleting)
    if (!completed) {
      hapticTaskComplete();
    }
    onChange();
  };

  // Handle touch events explicitly to prevent parent long press handlers from intercepting
  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    // Note: The actual toggle is handled by onClick which fires after touchEnd
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onTouchEnd={handleTouchEnd}
      role="checkbox"
      aria-checked={completed}
      className={cn(
        sizeStyles[size].button,
        'rounded-full flex items-center justify-center flex-shrink-0',
        'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-emphasis)] focus:ring-offset-1',
        'transition-all hover:scale-110',
        'bg-transparent',
        'hover:opacity-80',
        className
      )}
      // Use inline styles for border to ensure visibility in all contexts
      // (Tailwind classes can be overridden by editor/parent CSS resets)
      style={{
        borderWidth: '2px',
        borderStyle: 'solid',
        borderColor: borderColor,
      }}
      title={completed ? 'Mark incomplete' : 'Mark complete'}
    >
      {/* Filled inner circle when completed */}
      {completed && (
        <span 
          className={cn(sizeStyles[size].inner, 'rounded-full')}
          style={{ backgroundColor: borderColor }}
        />
      )}
    </button>
  );
};

export default TaskCheckbox;
