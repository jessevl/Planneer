/**
 * @file FloatingPanel.tsx
 * @description Shared floating glass panel shell for overlay side panels and inspectors
 * @app SHARED - Used by graph inspector and unified sidepanel mounts
 *
 * Features:
 * - Absolute overlay positioning with pointer-event passthrough outside the panel
 * - Shared glass surface styling for floating panels
 * - Configurable container and surface classes for inspector vs full-height sidebar use cases
 *
 * Used by:
 * - PageRelationshipGraph
 * - PagesView
 * - TasksView
 * - PageDetailView
 */
import React from 'react';

import { cn } from '@/lib/design-system';

// Keep the main desktop content surface free of backdrop/filter effects.
// Those can create the wrong containing block for Yoopta's position:fixed
// floating block actions, causing the drag handle to drift when the shell
// layout changes (for example when the left sidebar expands/collapses).
export const FLOATING_SURFACE_CLASSNAME = 'flex flex-col overflow-hidden rounded-[22px] border border-[var(--color-border-default)] bg-[color-mix(in_srgb,var(--color-surface-base)_88%,transparent)] shadow-[0_20px_70px_-34px_rgba(15,23,42,0.42)] eink-shell-surface';

export const FLOATING_PANEL_SURFACE_CLASSNAME = cn('pointer-events-auto backdrop-blur-xl', FLOATING_SURFACE_CLASSNAME);

export interface FloatingPanelProps {
  /** Panel contents rendered inside the shared floating surface. */
  children: React.ReactNode;
  /** Responsive visibility classes for the absolute overlay container. */
  visibleClassName?: string;
  /** Additional classes for the absolute overlay container. */
  containerClassName?: string;
  /** Additional classes for the floating surface element. */
  surfaceClassName?: string;
  /** Optional inline styles for the absolute overlay container. */
  containerStyle?: React.CSSProperties;
  /** Optional inline styles for the floating surface element. */
  surfaceStyle?: React.CSSProperties;
}

const FloatingPanel: React.FC<FloatingPanelProps> = ({
  children,
  visibleClassName = 'hidden lg:block',
  containerClassName,
  surfaceClassName,
  containerStyle,
  surfaceStyle,
}) => (
  <div
    className={cn('pointer-events-none absolute z-40', visibleClassName, containerClassName)}
    style={containerStyle}
  >
    <div
      className={cn(
        FLOATING_PANEL_SURFACE_CLASSNAME,
        surfaceClassName,
      )}
      style={surfaceStyle}
    >
      {children}
    </div>
  </div>
);

export default FloatingPanel;