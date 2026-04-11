/**
 * @file ToggleTile.tsx
 * @description Reusable on/off toggle tile with unified styling
 * @app SHARED - Used in ContextMenuContent, PageActionsMenu, and anywhere
 *   a compact on/off toggle with icon + label is needed.
 *
 * Active state:  accent border, subtle accent background, accent ring
 * Inactive state: default border, secondary text, hover surface
 *
 * Intentionally kept simple — this is not a generic button.
 */
import React from 'react';
import { cn } from '@frameer/lib/design-system';

export interface ToggleTileProps {
  /** Whether the tile is in the "on" state */
  active: boolean;
  /** Click handler */
  onClick: () => void;
  /** Primary label */
  label: string;
  /** Optional icon (rendered at 14px) */
  icon?: React.ReactNode;
  /** Show "On"/"Off" sublabel (default: true) */
  showSublabel?: boolean;
  /** Disabled state */
  disabled?: boolean;
  className?: string;
}

/** Shared class strings so consumers can compose if needed */
export const toggleTileStyles = {
  base: 'flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs transition-colors',
  active:
    'border-[var(--color-accent-emphasis)] bg-[var(--color-accent-subtle)] text-[var(--color-accent-fg)] ring-1 ring-[var(--color-accent-emphasis)]/30',
  inactive:
    'border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]',
  disabled: 'opacity-50 cursor-not-allowed',
  sublabelActive: 'text-[var(--color-accent-emphasis)]',
  sublabelInactive: 'text-[var(--color-text-tertiary)]',
} as const;

const ToggleTile: React.FC<ToggleTileProps> = ({
  active,
  onClick,
  label,
  icon,
  showSublabel = true,
  disabled = false,
  className,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      toggleTileStyles.base,
      active ? toggleTileStyles.active : toggleTileStyles.inactive,
      disabled && toggleTileStyles.disabled,
      className,
    )}
  >
    {icon && (
      <span className="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center">
        {icon}
      </span>
    )}
    <div className="flex flex-col items-start leading-tight">
      <span className="font-medium">{label}</span>
      {showSublabel && (
        <span
          className={cn(
            'text-[10px]',
            active ? toggleTileStyles.sublabelActive : toggleTileStyles.sublabelInactive,
          )}
        >
          {active ? 'On' : 'Off'}
        </span>
      )}
    </div>
  </button>
);

export default ToggleTile;
