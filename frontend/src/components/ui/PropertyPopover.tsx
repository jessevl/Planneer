/**
 * @file PropertyPopover.tsx
 * @description Popover wrapper anchored to a PropertyRow trigger
 * @app SHARED - Used by AddTaskForm and PageMetaPanel for property pickers
 *
 * Renders a floating popover positioned below (or above, when space is tight)
 * the anchor element. When `usePortal` is set, renders via a fixed-position
 * portal so the popover escapes overflow-clipping scroll containers — useful
 * inside single-column sidepanels.
 */
import React from 'react';
import { createPortal } from 'react-dom';
import { Popover } from '@/components/ui';

interface PropertyPopoverProps {
  /** Ref to the trigger element used to position the popover. */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Whether the popover is visible. */
  open: boolean;
  /** Popover contents. */
  children: React.ReactNode;
  /**
   * When true, the popover renders via a fixed-position portal so it can
   * escape overflow-clipping containers. Defaults to false (inline Popover).
   */
  usePortal?: boolean;
  /** Optional override width when using portal mode. */
  portalWidth?: number;
}

const PropertyPopover: React.FC<PropertyPopoverProps> = ({
  anchorRef,
  open,
  children,
  usePortal,
  portalWidth,
}) => {
  const [portalStyle, setPortalStyle] = React.useState<React.CSSProperties | null>(null);

  React.useLayoutEffect(() => {
    if (!open || !usePortal) { setPortalStyle(null); return; }
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const width = portalWidth ?? rect.width;
    setPortalStyle(
      spaceBelow < 240
        ? { bottom: window.innerHeight - rect.top + 4, left: rect.left, width }
        : { top: rect.bottom + 4, left: rect.left, width }
    );
  }, [open, usePortal, anchorRef, portalWidth]);

  if (!open) return null;

  if (usePortal) {
    if (!portalStyle) return null;
    return createPortal(
      <div
        style={{ position: 'fixed', zIndex: 9999, ...portalStyle }}
        className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-primary)] shadow-lg p-2"
        onMouseDown={e => e.stopPropagation()}
      >
        {children}
      </div>,
      document.body
    );
  }

  return <Popover width="full">{children}</Popover>;
};

export default PropertyPopover;
