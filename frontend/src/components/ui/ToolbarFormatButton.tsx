/**
 * @file ToolbarFormatButton.tsx
 * @description Shared format button for glass-style text formatting toolbars.
 * @app SHARED - Used by EditorFloatingToolbar (desktop) and FloatingActionBar (mobile)
 *
 * Features:
 * - Consistent rounded-lg shape with hover/active states
 * - Lucide icon support with uniform sizing
 * - Touch-safe handlers (preventDefault to avoid stealing editor focus)
 * - Active state matches accent color treatment
 *
 * Used by:
 * - EditorFloatingToolbar (desktop text selection toolbar)
 * - FloatingActionBar (mobile editor toolbar)
 */
import React from 'react';
import { cn } from '@/lib/design-system';

export interface ToolbarFormatButtonProps {
  /** Accessible label */
  label: string;
  /** Whether this format is currently active on the selection */
  isActive?: boolean;
  /** Click/tap handler */
  onClick: () => void;
  /** Icon or label content */
  children: React.ReactNode;
  /** Additional classes */
  className?: string;
}

/**
 * Shared format button used across all glass-toolbar instances.
 * Styled to match the Excalidraw toolbar button aesthetic.
 */
const ToolbarFormatButton: React.FC<ToolbarFormatButtonProps> = React.memo(({
  label,
  isActive = false,
  onClick,
  children,
  className,
}) => {
  const handlePress = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  };

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isActive}
      onMouseDown={handlePress}
      onTouchEnd={handlePress}
      className={cn(
        'flex items-center justify-center w-8 h-8 rounded-full',
        'transition-all duration-150 ease-out',
        'active:scale-95',
        isActive
          ? 'bg-[var(--color-accent-primary)] text-white shadow-sm'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-accent-muted)] hover:text-[var(--color-text-primary)]',
        className,
      )}
    >
      {children}
    </button>
  );
});

ToolbarFormatButton.displayName = 'ToolbarFormatButton';

export default ToolbarFormatButton;
