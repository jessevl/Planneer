/**
 * @file iconUtils.ts
 * @description Icon consistency utilities for standardized icon styling
 * @app SHARED - Used across all components for consistent icon appearance
 * 
 * This file provides utilities for ensuring consistent icon styling:
 * - Standard stroke width for all icons
 * - Size presets matching the design system
 * - Icon wrapper components for consistent styling
 * 
 * Lucide icons default to strokeWidth=2, but we standardize at 1.75 for
 * a slightly lighter, more modern appearance while maintaining clarity.
 */

/**
 * Standard icon stroke width for consistency across the app.
 * 1.75 is slightly lighter than Lucide's default of 2, giving
 * a more refined appearance while maintaining readability.
 */
export const ICON_STROKE_WIDTH = 1.75;

/**
 * Standard icon sizes matching the design system spacing
 */
export const ICON_SIZES = {
  xs: 12,    // Extra small - inline with small text
  sm: 14,    // Small - inline with body text
  md: 16,    // Medium - default for most UI
  default: 16,
  lg: 18,    // Large - buttons, headers
  xl: 20,    // Extra large - prominent actions
  '2xl': 24, // 2X Large - hero icons
  '3xl': 32, // 3X Large - empty states
} as const;

/**
 * Icon size classes for Tailwind
 */
export const ICON_SIZE_CLASSES = {
  xs: 'w-3 h-3',      // 12px
  sm: 'w-3.5 h-3.5',  // 14px
  md: 'w-4 h-4',      // 16px
  default: 'w-4 h-4',
  lg: 'w-[18px] h-[18px]', // 18px
  xl: 'w-5 h-5',      // 20px
  '2xl': 'w-6 h-6',   // 24px
  '3xl': 'w-8 h-8',   // 32px
} as const;

export type IconSize = keyof typeof ICON_SIZES;

/**
 * Get standard icon props for consistent styling
 * @param size - Icon size preset
 * @returns Object with className and strokeWidth
 */
export function getIconProps(size: IconSize = 'default') {
  return {
    className: ICON_SIZE_CLASSES[size],
    strokeWidth: ICON_STROKE_WIDTH,
  };
}

/**
 * Get icon size in pixels
 * @param size - Icon size preset
 * @returns Size in pixels
 */
export function getIconSize(size: IconSize = 'default'): number {
  return ICON_SIZES[size];
}

/**
 * Get icon size class
 * @param size - Icon size preset
 * @returns Tailwind class string
 */
export function getIconSizeClass(size: IconSize = 'default'): string {
  return ICON_SIZE_CLASSES[size];
}

/**
 * Standard props for Lucide icons to ensure consistency
 * Use this as a spread: <SomeIcon {...iconDefaults} />
 */
export const iconDefaults = {
  strokeWidth: ICON_STROKE_WIDTH,
} as const;

/**
 * Icon props for different common contexts
 */
export const iconContextProps = {
  /** For buttons - slightly larger, standard stroke */
  button: {
    className: 'w-4 h-4',
    strokeWidth: ICON_STROKE_WIDTH,
  },
  /** For navigation items - larger with standard stroke */
  nav: {
    className: 'w-5 h-5',
    strokeWidth: ICON_STROKE_WIDTH,
  },
  /** For inline with text - matches text size */
  inline: {
    className: 'w-4 h-4 inline-block align-text-bottom',
    strokeWidth: ICON_STROKE_WIDTH,
  },
  /** For headers and titles */
  header: {
    className: 'w-5 h-5',
    strokeWidth: ICON_STROKE_WIDTH,
  },
  /** For empty states - large and light */
  emptyState: {
    className: 'w-12 h-12',
    strokeWidth: 1.5,
  },
  /** For list items */
  listItem: {
    className: 'w-4 h-4 flex-shrink-0',
    strokeWidth: ICON_STROKE_WIDTH,
  },
  /** For badges/tags - smaller */
  badge: {
    className: 'w-3 h-3',
    strokeWidth: 2, // Slightly heavier for small sizes
  },
} as const;
