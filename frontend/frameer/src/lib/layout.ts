/**
 * @file layout.ts
 * @description Layout utility functions for common flex/grid patterns
 * @app SHARED - Used by components for consistent layouts
 * 
 * Provides pre-built layout patterns as functions that return Tailwind class strings.
 * All utilities use the cn() function for proper class merging.
 * 
 * Categories:
 * - Flex utilities: flexBetween, flexCenter, flexCol, etc.
 * - Grid utilities: gridCols, gridAutoFit, gridAutoFill
 * - Common patterns: container, section, card
 * - Spacing: stack, inline with configurable gaps
 * 
 * Usage:
 * ```
 * <div className={flexBetween('px-4')}>...</div>
 * <div className={stack('md', 'p-4')}>...</div>
 * ```
 */

import { cn } from './design-system';

// Flex utilities
export const flexBetween = (className = '') => cn('flex items-center justify-between', className);
export const flexCenter = (className = '') => cn('flex items-center justify-center', className);
export const flexStart = (className = '') => cn('flex items-center justify-start', className);
export const flexEnd = (className = '') => cn('flex items-center justify-end', className);
export const flexCol = (className = '') => cn('flex flex-col', className);
export const flexColCenter = (className = '') => cn('flex flex-col items-center justify-center', className);

// Grid utilities
export const gridCols = (cols: number, className = '') => cn(`grid grid-cols-${cols}`, className);
export const gridAutoFit = (minWidth: string, className = '') => cn(`grid grid-cols-[repeat(auto-fit,minmax(${minWidth},1fr))]`, className);
export const gridAutoFill = (minWidth: string, className = '') => cn(`grid grid-cols-[repeat(auto-fill,minmax(${minWidth},1fr))]`, className);

// ============================================================================
// CONTENT WIDTH - Single source of truth for max-width across the app
// ============================================================================
/**
 * Standard content max-width classes used throughout the app.
 * Change these values to adjust content width globally.
 */
export const CONTENT_WIDTH = {
  /** Default content width for most views (headers, content, editors) */
  default: 'max-w-5xl',
  /** Narrow content width for focused content (daily journal, sub-page lists) */
  narrow: 'max-w-3xl',
  /** Wide content width for dashboards */
  wide: 'max-w-7xl',
} as const;

/** Standard horizontal padding for content areas */
export const CONTENT_PADDING = 'px-4 md:px-6';

/** Content container with default width, centered with padding */
export const contentContainer = (width: keyof typeof CONTENT_WIDTH = 'default', className = '') => 
  cn(CONTENT_WIDTH[width], 'mx-auto', CONTENT_PADDING, className);

// Common layout patterns
export const container = (className = '') => cn('max-w-7xl mx-auto px-4 sm:px-6 lg:px-8', className);
export const section = (className = '') => cn('py-8 sm:py-12 lg:py-16', className);
export const card = (className = '') => cn('rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700', className);

// Spacing utilities
export const stack = (gap: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md', className = '') => {
  const gaps = {
    xs: 'space-y-1',
    sm: 'space-y-2',
    md: 'space-y-4',
    lg: 'space-y-6',
    xl: 'space-y-8'
  };
  return cn('flex flex-col', gaps[gap], className);
};

export const inline = (gap: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md', className = '') => {
  const gaps = {
    xs: 'space-x-1',
    sm: 'space-x-2',
    md: 'space-x-4',
    lg: 'space-x-6',
    xl: 'space-x-8'
  };
  return cn('flex items-center', gaps[gap], className);
};

// Position utilities
export const absoluteCenter = (className = '') => cn('absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2', className);
export const absoluteFull = (className = '') => cn('absolute inset-0', className);

// ============================================================================
// RESPONSIVE UTILITIES
// ============================================================================

// Basic show/hide
export const hideOnMobile = (className = '') => cn('hidden md:block', className);
export const showOnMobile = (className = '') => cn('block md:hidden', className);
export const hideOnTablet = (className = '') => cn('hidden lg:block', className);
export const showOnTablet = (className = '') => cn('block lg:hidden', className);

// Touch-specific utilities (uses CSS media queries, not JS detection)
export const showOnTouch = (className = '') => cn('hidden touch:block', className);
export const hideOnTouch = (className = '') => cn('block touch:hidden', className);
export const showOnMouse = (className = '') => cn('hidden mouse:block', className);
export const hideOnMouse = (className = '') => cn('block mouse:hidden', className);

// ============================================================================
// TOUCH TARGET UTILITIES
// ============================================================================

/**
 * Minimum touch target sizes (Apple HIG: 44pt, Material: 48dp)
 * These ensure interactive elements are easy to tap on touch devices.
 */
export const TOUCH_TARGET = {
  /** Minimum size for any interactive element */
  min: 'min-h-[44px] min-w-[44px]',
  /** Primary action buttons */
  primary: 'min-h-[48px] min-w-[48px]',
  /** Full button with padding (for text buttons) */
  button: 'min-h-[44px] px-4',
  /** List items need at least this height */
  listItem: 'min-h-[48px]',
  /** Icon buttons - visual size smaller but touch target expanded */
  iconButton: 'min-h-[44px] min-w-[44px]',
} as const;

/**
 * Apply minimum touch target sizing to a className
 */
export const touchTarget = (size: keyof typeof TOUCH_TARGET = 'min', className = '') => 
  cn(TOUCH_TARGET[size], className);

// ============================================================================
// SAFE AREA UTILITIES (for notched devices)
// ============================================================================

export const SAFE_AREA = {
  /** Top padding for status bar / notch */
  top: 'pt-[env(safe-area-inset-top)]',
  /** Bottom padding for home indicator */
  bottom: 'pb-[env(safe-area-inset-bottom)]',
  /** Left padding for landscape notch */
  left: 'pl-[env(safe-area-inset-left)]',
  /** Right padding for landscape notch */
  right: 'pr-[env(safe-area-inset-right)]',
  /** All sides */
  all: 'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]',
  /** Horizontal only */
  horizontal: 'pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]',
  /** Vertical only */
  vertical: 'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
} as const;

export const safeArea = (position: keyof typeof SAFE_AREA = 'all', className = '') =>
  cn(SAFE_AREA[position], className);

// ============================================================================
// MOBILE LAYOUT PATTERNS
// ============================================================================

/**
 * Bottom navigation bar container
 */
export const bottomNav = (className = '') => cn(
  'fixed bottom-0 left-0 right-0',
  'flex items-center justify-around',
  'bg-white dark:bg-gray-850',
  'border-t border-gray-200 dark:border-gray-700',
  'pb-[max(8px,env(safe-area-inset-bottom))]',
  'pt-2',
  'z-40',
  className
);

/**
 * Mobile drawer overlay backdrop
 */
export const drawerBackdrop = (className = '') => cn(
  'fixed inset-0',
  'bg-black/50 backdrop-blur-sm',
  'z-40',
  className
);

/**
 * Mobile drawer panel (slides in from left)
 */
export const drawerPanel = (className = '') => cn(
  'fixed top-0 left-0 bottom-0',
  'w-[85vw] max-w-[320px]',
  'bg-white dark:bg-gray-850',
  'shadow-2xl',
  'z-50',
  'overflow-y-auto',
  SAFE_AREA.vertical,
  className
);

/**
 * Mobile bottom sheet container
 */
export const bottomSheet = (className = '') => cn(
  'fixed bottom-0 left-0 right-0',
  'bg-white dark:bg-gray-850',
  'rounded-t-2xl',
  'shadow-2xl',
  'z-50',
  'max-h-[90vh]',
  'overflow-y-auto',
  'pb-[max(16px,env(safe-area-inset-bottom))]',
  className
);

/**
 * Mobile header with safe area
 */
export const mobileHeader = (className = '') => cn(
  'sticky top-0',
  'flex items-center gap-2',
  'px-4 py-3',
  'bg-white dark:bg-gray-850',
  'border-b border-gray-200 dark:border-gray-700',
  SAFE_AREA.top,
  'z-30',
  className
);

/**
 * Content area that accounts for bottom nav
 */
export const mobileContent = (className = '') => cn(
  'flex-1 overflow-y-auto',
  'pb-[calc(60px+env(safe-area-inset-bottom))]', // Space for bottom nav
  className
);

/**
 * Full-screen mobile panel (for task edit, etc.)
 */
export const mobileFullScreen = (className = '') => cn(
  'fixed inset-0',
  'bg-white dark:bg-gray-850',
  'z-50',
  'flex flex-col',
  SAFE_AREA.all,
  className
);

