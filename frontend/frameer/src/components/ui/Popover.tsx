import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { cn } from '@frameer/lib/design-system';

interface PopoverProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  width?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full' | 'auto';
  position?: 'left' | 'right' | 'center';
  onClickCapture?: (e: React.MouseEvent) => void;
  padding?: 'none' | 'sm' | 'md';
}

/**
 * Popover - Floating dropdown container
 * Used for dropdowns, pickers, and floating menus
 * 
 * Automatically positions above if there's not enough space below
 */
const Popover = forwardRef<HTMLDivElement, PopoverProps>(({
  children,
  className = '',
  style,
  width = 'md',
  position = 'left',
  onClickCapture,
  padding = 'md'
}, ref) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [openUpward, setOpenUpward] = useState(false);

  // Expose the internal ref to the parent
  useImperativeHandle(ref, () => popoverRef.current!);

  useEffect(() => {
    if (popoverRef.current && !style) {
      const rect = popoverRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      // If popover is cut off at bottom and there's more space above, flip it
      if (spaceBelow < 0 && spaceAbove > -spaceBelow) {
        setOpenUpward(true);
      }
      
      // If cut off on both sides, center it on viewport
      if (spaceBelow < 0 && spaceAbove < rect.height) {
        const centerY = viewportHeight / 2;
        const popoverHeight = rect.height;
        const targetTop = centerY - popoverHeight / 2;
        popoverRef.current.style.position = 'fixed';
        popoverRef.current.style.top = `${Math.max(20, targetTop)}px`;
        popoverRef.current.style.bottom = 'auto';
      }
    }
  }, [style]);

  const widthClasses = {
    sm: 'w-36',
    md: 'w-48',
    lg: 'w-56',
    xl: 'w-64',
    '2xl': 'w-72',
    full: 'w-full',
    auto: 'w-auto'
  };

  const positionClasses = {
    left: 'left-0',
    right: 'right-0',
    center: 'left-1/2 -translate-x-1/2'
  };

  const paddingClasses = {
    none: 'p-0',
    sm: 'p-1',
    md: 'p-2'
  };

  return (
    <div
      ref={popoverRef}
      style={style}
      className={cn(
        'absolute rounded-xl border border-solid border-[var(--color-border-default)]',
        'bg-[var(--color-surface-primary)] shadow-lg',
        'z-[200]',
        !style && (openUpward ? 'bottom-full mb-2' : 'top-full mt-2'),
        width !== 'auto' && widthClasses[width],
        !style && positionClasses[position],
        paddingClasses[padding],
        className
      )}
      onClickCapture={onClickCapture}
    >
      {children}
    </div>
  );
});

export default Popover;
