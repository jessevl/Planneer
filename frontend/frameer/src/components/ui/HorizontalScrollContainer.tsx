/**
 * @file HorizontalScrollContainer.tsx
 * @description Reusable horizontal scroll container with navigation arrows
 * @app SHARED - Used by sidebar pinned items, home favorites, etc.
 * 
 * Features:
 * - Hidden scrollbar with smooth scrolling
 * - Left/right navigation arrows that fade in/out
 * - Arrows only show when there's more content to scroll
 * - Smooth scroll animation when clicking arrows
 * 
 * Used by:
 * - UnifiedSidebar (pinned items)
 * - FavoritesSection (home page)
 */
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@frameer/lib/design-system';

interface HorizontalScrollContainerProps {
  /** Content to render inside the scroll container */
  children: React.ReactNode;
  /** Additional classes for the outer wrapper */
  className?: string;
  /** Additional classes for the inner scrollable container */
  scrollClassName?: string;
  /** Gap between items (Tailwind class like 'gap-2' or 'gap-2.5') */
  gap?: string;
  /** Padding inside the scroll container */
  innerPadding?: string;
  /** Size of the arrow buttons */
  arrowSize?: 'sm' | 'md';
  /** Whether to show arrows (default true) */
  showArrows?: boolean;
}

const HorizontalScrollContainer: React.FC<HorizontalScrollContainerProps> = ({
  children,
  className,
  scrollClassName,
  gap = 'gap-2',
  innerPadding = 'py-2',
  arrowSize = 'sm',
  showArrows = true,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  const handleScrollBy = useCallback((direction: 'left' | 'right') => {
    const container = scrollRef.current;
    if (!container) return;
    const amount = Math.max(120, container.clientWidth * 0.6);
    container.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    updateScrollState();
    const container = scrollRef.current;
    if (!container) return;
    
    const resizeObserver = new ResizeObserver(() => updateScrollState());
    resizeObserver.observe(container);
    
    return () => resizeObserver.disconnect();
  }, [updateScrollState, children]);

  const arrowClasses = arrowSize === 'sm' 
    ? 'w-6 h-6 p-1' 
    : 'w-8 h-8 p-1.5';
  
  const iconClasses = arrowSize === 'sm' 
    ? 'w-4 h-4' 
    : 'w-5 h-5';

  return (
    <div className={cn("relative overflow-visible", className)}>
      <div
        ref={scrollRef}
        onScroll={updateScrollState}
        className={cn(
          "overflow-x-auto overflow-y-visible scrollbar-hide scroll-smooth touch-pan-x",
          scrollClassName
        )}
      >
        <div className={cn("flex", gap, innerPadding)} style={{ minWidth: 'max-content', touchAction: 'pan-x' }}>
          {children}
        </div>
      </div>

      {/* Left scroll arrow */}
      {showArrows && (
        <button
          onClick={() => handleScrollBy('left')}
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 z-10",
            "flex items-center justify-center rounded-full",
            "bg-[var(--color-surface-base)]",
            "border border-[var(--color-border-subtle)]",
            "text-[var(--color-text-secondary)]",
            "hover:bg-[var(--color-surface-overlay)]",
            "hover:text-[var(--color-text-primary)]",
            "shadow-sm hover:shadow",
            "transition-all duration-200",
            canScrollLeft ? "opacity-100" : "opacity-0 pointer-events-none",
            arrowClasses
          )}
          aria-label="Scroll left"
        >
          <ChevronLeft className={iconClasses} />
        </button>
      )}

      {/* Right scroll arrow */}
      {showArrows && (
        <button
          onClick={() => handleScrollBy('right')}
          className={cn(
            "absolute right-0 top-1/2 -translate-y-1/2 z-10",
            "flex items-center justify-center rounded-full",
            "bg-[var(--color-surface-base)]",
            "border border-[var(--color-border-subtle)]",
            "text-[var(--color-text-secondary)]",
            "hover:bg-[var(--color-surface-overlay)]",
            "hover:text-[var(--color-text-primary)]",
            "shadow-sm hover:shadow",
            "transition-all duration-200",
            canScrollRight ? "opacity-100" : "opacity-0 pointer-events-none",
            arrowClasses
          )}
          aria-label="Scroll right"
        >
          <ChevronRight className={iconClasses} />
        </button>
      )}
    </div>
  );
};

export default HorizontalScrollContainer;
