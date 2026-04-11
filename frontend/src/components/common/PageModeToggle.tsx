/**
 * @file PageModeToggle.tsx
 * @description Shared 3-mode toggle for switching page modes (Note/Collection/Tasks)
 * @app SHARED - Used in PageActionsMenu and ItemPropertiesModal
 * 
 * Features:
 * - Shows counts for collection (subpages) and tasks modes
 * - Greyed out (but still clickable) when a mode has 0 items
 * - Caps counts at 99+
 * - Two variants: 'compact' for dropdown menus, 'card' for modals
 */
import React from 'react';
import { cn } from '@/lib/design-system';
import { toggleTileStyles } from '@/components/ui';
import { StylizedNoteIcon, StylizedCollectionIcon, StylizedTaskIcon } from './StylizedIcons';
import type { PageViewMode } from '@/types/page';

interface PageModeToggleProps {
  currentMode: PageViewMode;
  onModeChange: (mode: PageViewMode) => void;
  /** Number of child pages (shown on collection mode) */
  childCount?: number;
  /** Number of tasks (shown on tasks mode) */
  taskCount?: number;
  /** 'compact' for dropdown menus, 'card' for modals */
  variant?: 'compact' | 'card';
}

const formatCount = (count: number): string => {
  if (count === 0) return '';
  if (count > 99) return '99+';
  return String(count);
};

const modes: { mode: PageViewMode; label: string; Icon: typeof StylizedNoteIcon }[] = [
  { mode: 'note', label: 'Note', Icon: StylizedNoteIcon },
  { mode: 'collection', label: 'Collection', Icon: StylizedCollectionIcon },
  { mode: 'tasks', label: 'Tasks', Icon: StylizedTaskIcon },
];

const PageModeToggle: React.FC<PageModeToggleProps> = ({
  currentMode,
  onModeChange,
  childCount = 0,
  taskCount = 0,
  variant = 'compact',
}) => {
  const getCount = (mode: PageViewMode): number => {
    if (mode === 'collection') return childCount;
    if (mode === 'tasks') return taskCount;
    return 0; // note mode has no count
  };

  // A non-active mode is "dimmed" if it has no items to show
  const isDimmed = (mode: PageViewMode): boolean => {
    if (mode === currentMode) return false;
    if (mode === 'note') return false; // note is always available
    return getCount(mode) === 0;
  };

  if (variant === 'card') {
    return (
      <div className="grid grid-cols-3 gap-2">
        {modes.map(({ mode, label, Icon }) => {
          const count = getCount(mode);
          const countStr = formatCount(count);
          const isActive = currentMode === mode;
          const dimmed = isDimmed(mode);

          return (
            <button
              key={mode}
              type="button"
              onClick={() => onModeChange(mode)}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 px-2 py-3 rounded-xl border transition-all relative",
                isActive
                  ? `${toggleTileStyles.active} border-[var(--color-accent-emphasis)]`
                  : dimmed
                    ? "border-[var(--color-border-default)]/50 text-[var(--color-text-disabled)] hover:border-[var(--color-border-default)] hover:text-[var(--color-text-tertiary)]"
                    : "border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-default)]"
              )}
            >
              <Icon
                color={isActive ? 'var(--color-accent-primary)' : dimmed ? '#d1d5db' : '#9ca3af'}
                size="sm"
              />
              <span className="text-[11px] font-medium">{label}</span>
              {countStr && (
                <span className={cn(
                  "absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-semibold px-1",
                  isActive
                    ? "bg-[var(--color-accent-primary)] text-white"
                    : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] ring-1 ring-[var(--color-border-default)]"
                )}>
                  {countStr}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Compact variant (for dropdown menus)
  return (
    <div className="grid grid-cols-3 gap-1 bg-[var(--color-surface-secondary)]/60 rounded-lg p-1 eink-shell-surface-secondary">
      {modes.map(({ mode, label, Icon }) => {
        const count = getCount(mode);
        const countStr = formatCount(count);
        const isActive = currentMode === mode;
        const dimmed = isDimmed(mode);

        return (
          <button
            key={mode}
            onClick={() => onModeChange(mode)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-lg py-2 px-1 text-xs font-medium transition-all relative',
              isActive
                ? `${toggleTileStyles.active}`
                : dimmed
                  ? 'text-[var(--color-text-disabled)]'
                  : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-base)]/50'
            )}
          >
            <Icon
              size="sm"
              color={isActive ? 'var(--color-accent-primary)' : dimmed ? '#d1d5db' : 'currentColor'}
            />
            <span>{label}</span>
            {countStr && (
              <span className={cn(
                "absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center rounded-full text-[9px] font-bold leading-none px-0.5",
                isActive
                  ? "bg-[var(--color-accent-primary)] text-white"
                  : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] ring-1 ring-[var(--color-border-default)]"
              )}>
                {countStr}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default PageModeToggle;
