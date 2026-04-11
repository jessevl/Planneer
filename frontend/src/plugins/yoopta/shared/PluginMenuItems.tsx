/**
 * @file PluginMenuItems.tsx
 * @description Shared menu item primitives for Yoopta plugin context menus.
 *
 * Used by:
 * - AdvancedTableBlockOptions
 * - AdvancedTableColumnOptions
 * - AdvancedTableRowOptions
 *
 * Provides `PluginMenuItem` (flex row with icon + label + optional right slot)
 * and `PluginMenuSeparator` (horizontal divider), matching the ViewSwitcher style.
 */
import React from 'react';
import { cn } from '@/lib/design-system';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';

// ── PluginMenuItem ──────────────────────────────────────────────────────────

export interface PluginMenuItemProps {
  /** Called when the item is clicked */
  onClick: () => void;
  children: React.ReactNode;
  /** Highlight the item as the currently active selection */
  active?: boolean;
  /** Render as a destructive / danger action */
  destructive?: boolean;
  className?: string;
}

export const PluginMenuItem: React.FC<PluginMenuItemProps> = ({
  onClick,
  children,
  active = false,
  destructive = false,
  className,
}) => {
  const isMobile = useIsMobile();

  return (
    <button
      type="button"
      className={cn(
        'w-full flex items-center gap-2 text-left transition-colors rounded-md',
        isMobile ? 'px-4 py-3.5 text-base gap-3' : 'px-3 py-2 text-sm',
        active
          ? 'bg-[var(--color-interactive-bg)] text-[var(--color-interactive-text-strong)]'
          : destructive
            ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10'
            : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-hover)]',
        className,
      )}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
};

// ── PluginMenuSeparator ─────────────────────────────────────────────────────

export const PluginMenuSeparator: React.FC = () => {
  const isMobile = useIsMobile();
  return (
    <div
      className={cn(
        'h-px bg-[var(--color-border-default)]',
        isMobile ? 'my-2' : 'my-1',
      )}
    />
  );
};
