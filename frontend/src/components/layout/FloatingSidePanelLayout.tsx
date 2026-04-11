/**
 * @file FloatingSidePanelLayout.tsx
 * @description Desktop layout controller for floating side panels with optional rail and pin behavior
 * @app SHARED - Used by the root desktop layout and right utility sidepanes
 *
 * Features:
 * - Supports left rail/expanded/pinned layouts and right open/closed overlays via one API
 * - Computes content reserve width for collapsed rail, open overlay, or pinned expanded layout
 * - Dismisses temporary overlays on outside click when requested
 * - Applies smooth width and content-inset transitions
 * - Portals right-side panels to the root desktop container
 *
 * Used by:
 * - __root.tsx
 * - PagesView
 * - TasksView
 * - PageDetailView
 */
import React, { useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

import { getFloatingPanelLayout, getLeftInsetStyle, getRightInsetStyle } from '@/lib/layout';
import FloatingPanel from '@/components/ui/FloatingPanel';
import { cn } from '@/lib/design-system';
import { useDesktopFloatingPanelContext } from '@/contexts/DesktopFloatingPanelContext';
import { useIsDesktop, useIsMobile } from '@frameer/hooks/useMobileDetection';

interface FloatingSidePanelLayoutProps {
  side: 'left' | 'right';
  isOpen: boolean;
  onOpenChange?: (open: boolean) => void;
  pinned?: boolean;
  collapsedWidth?: number;
  railWidth: number;
  defaultExpandedWidth: number;
  expandedWidth?: number;
  onExpandedWidthChange?: (width: number) => void;
  gutterPx: number;
  applyContentInset?: boolean;
  renderPanel: (args: { mode: 'collapsed' | 'expanded'; width: number; setWidth: (width: number) => void; isOpen: boolean; pinned: boolean }) => React.ReactNode;
  children: React.ReactNode | ((args: { reserveWidth: number }) => React.ReactNode);
  className?: string;
  contentClassName?: string;
}

const FloatingSidePanelLayout: React.FC<FloatingSidePanelLayoutProps> = ({
  side,
  isOpen,
  onOpenChange,
  pinned = false,
  collapsedWidth,
  railWidth,
  defaultExpandedWidth,
  expandedWidth,
  onExpandedWidthChange,
  gutterPx,
  applyContentInset = true,
  renderPanel,
  children,
  className,
  contentClassName,
}) => {
  const isDesktop = useIsDesktop();
  const isMobile = useIsMobile();
  const canShowPanel = side === 'left' ? !isMobile : isDesktop;
  const [internalExpandedWidth, setInternalExpandedWidth] = useState(defaultExpandedWidth);
  const currentExpandedWidth = expandedWidth ?? internalExpandedWidth;
  const setWidth = onExpandedWidthChange ?? setInternalExpandedWidth;
  const collapsedPanelWidth = collapsedWidth ?? railWidth;
  const surfaceWidth = canShowPanel ? (isOpen ? currentExpandedWidth : collapsedPanelWidth) : 0;
  const reservePanelWidth = canShowPanel
    ? (collapsedPanelWidth > 0
        ? (isOpen && pinned ? currentExpandedWidth : collapsedPanelWidth)
        : (isOpen ? currentExpandedWidth : 0))
    : 0;
  const shouldRenderPanel = canShowPanel && (side === 'right' || surfaceWidth > 0);
  const panelLayoutGeometry = shouldRenderPanel ? getFloatingPanelLayout(side, surfaceWidth, gutterPx) : null;
  const reserveWidth = reservePanelWidth > 0 ? getFloatingPanelLayout(side, reservePanelWidth, gutterPx).reserveWidth : 0;

  const { rightPanelPortalElement, setRightPanelReserve } = useDesktopFloatingPanelContext();
  const isPortalled = side === 'right';

  useLayoutEffect(() => {
    if (isPortalled) {
      setRightPanelReserve(reserveWidth);
      return () => setRightPanelReserve(0);
    }

    setRightPanelReserve(0);
    return undefined;
  }, [isPortalled, reserveWidth, setRightPanelReserve]);

  // In portalled mode, children get reserveWidth=0 (root handles spacing)
  const effectiveReserveWidth = isPortalled ? 0 : reserveWidth;
  const renderedChildren = typeof children === 'function'
    ? children({ reserveWidth: effectiveReserveWidth })
    : children;

  const contentInsetStyle = applyContentInset && !isPortalled
    ? (side === 'left' ? getLeftInsetStyle(reserveWidth) : getRightInsetStyle(reserveWidth))
    : undefined;
  const shouldRenderDismissOverlay = false;
  const dismissOverlayStyle = shouldRenderDismissOverlay
    ? (side === 'left'
        ? { left: `${surfaceWidth + gutterPx}px` }
        : { right: `${surfaceWidth + gutterPx}px` })
    : undefined;

  const panelNode = panelLayoutGeometry ? (
    <FloatingPanel
      visibleClassName="block"
      surfaceClassName={cn(
        'h-full transition-[width,box-shadow,opacity,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
        side === 'right'
          ? (isOpen
              ? 'opacity-100'
              : 'opacity-0 shadow-none border-transparent')
          : null,
      )}
      containerStyle={panelLayoutGeometry.containerStyle}
      surfaceStyle={panelLayoutGeometry.surfaceStyle}
    >
      {renderPanel({
        mode: isOpen ? 'expanded' : 'collapsed',
        width: currentExpandedWidth,
        setWidth,
        isOpen,
        pinned,
      })}
    </FloatingPanel>
  ) : null;

  return (
    <div className={cn('relative flex flex-1 overflow-hidden', className)}>
      {shouldRenderDismissOverlay && onOpenChange ? (
        <button
          type="button"
          aria-label={`Close ${side} panel`}
          className="absolute inset-0 z-10 hidden lg:block bg-transparent"
          style={dismissOverlayStyle}
          onClick={() => onOpenChange(false)}
        />
      ) : null}

      {/* Render panel inline or portalled to root depending on layout mode */}
      {isPortalled && rightPanelPortalElement
        ? createPortal(panelNode, rightPanelPortalElement)
        : panelNode
      }

      <div
        className={cn(
          'flex-1 min-w-0 overflow-visible transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          contentClassName,
        )}
        style={contentInsetStyle}
      >
        {renderedChildren}
      </div>
    </div>
  );
};

export default FloatingSidePanelLayout;
