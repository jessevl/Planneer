/**
 * @file GlassToolbar.tsx
 * @description Reusable glass-pill toolbar container with frosted backdrop blur.
 * @app SHARED - Used by ExcalidrawToolbar, FloatingActionBar, and any future toolbar.
 *
 * Wraps children in a rounded, semi-transparent container with backdrop blur,
 * matching the design system's glass aesthetic. The visual style is defined by the
 * `.glass-toolbar` CSS class in globals.css — this component is a convenient
 * React wrapper around it.
 */
import React from 'react';
import { cn } from '@/lib/design-system';

export interface GlassToolbarProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const GlassToolbar = React.forwardRef<HTMLDivElement, GlassToolbarProps>(
  ({ children, className, style }, ref) => (
    <div
      ref={ref}
      className={cn('glass-toolbar', className)}
      style={style}
    >
      {children}
    </div>
  ),
);

GlassToolbar.displayName = 'GlassToolbar';

export default GlassToolbar;
