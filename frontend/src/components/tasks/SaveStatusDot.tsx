/**
 * @file SaveStatusDot.tsx
 * @description Small status glyph embedded in the task Save button
 * @app TASKS APP ONLY - Used in TaskEditModal / TaskDetailPane Save buttons
 *
 * Modeled on the saved-views pill indicator (SavedViewsBar.tsx's ViewPill):
 * a fixed-size slot holding a pulsing dot while a change is pending, and a
 * checkmark the rest of the time. Here both layers share the slot and
 * cross-fade / scale via CSS transitions, so the dot visually morphs into
 * the checkmark instead of being swapped out. The checkmark stays visible
 * at idle (rather than hiding) so the slot's width is always occupied —
 * otherwise the Save button's label reads off-center.
 */
import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/design-system';
import type { TaskSaveStatus } from './AddTaskForm';

interface SaveStatusDotProps {
  status: TaskSaveStatus;
  className?: string;
}

const SaveStatusDot: React.FC<SaveStatusDotProps> = ({ status, className }) => (
  <span className={cn('relative inline-flex items-center justify-center w-3.5 h-3.5 flex-shrink-0', className)} aria-live="polite">
    <span
      className={cn(
        'absolute w-1.5 h-1.5 rounded-full bg-current transition-all duration-300 ease-out',
        status === 'saving' ? 'opacity-100 scale-100 animate-pulse' : 'opacity-0 scale-0'
      )}
    />
    <Check
      strokeWidth={3}
      className={cn(
        'absolute w-3.5 h-3.5 transition-all duration-300 ease-out',
        status !== 'saving' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
      )}
    />
  </span>
);

export default SaveStatusDot;
