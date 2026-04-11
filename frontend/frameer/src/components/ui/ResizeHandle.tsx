import React from 'react';
import { cn } from '@frameer/lib/design-system';

interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Reusable ResizeHandle component that matches the sidebar resizer styling.
 */
export const ResizeHandle: React.FC<ResizeHandleProps> = ({
  onMouseDown,
  className,
  style,
}) => {
  return (
    <div
      onMouseDown={onMouseDown}
      className={cn(
        "absolute top-0 bottom-0 w-2 cursor-col-resize bg-transparent group z-40 hover:bg-[var(--color-interactive-bg)]/50 transition-colors -right-1",
        className
      )}
      style={{ touchAction: 'none', ...style }}
    >
      <div className="h-full mx-auto w-0.5 bg-[var(--color-border-default)] opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
    </div>
  );
};
