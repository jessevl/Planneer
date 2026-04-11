/**
 * @file design-system.ts
 * @description Centralized design tokens, utilities, and semantic styling
 * @app SHARED - Design foundation used by all components
 * 
 * This file contains all semantic design tokens for Planneer:
 * - Semantic color classes (priority colors, status colors, etc.)
 * - Typography classes and component styles
 * - The `cn()` utility for combining Tailwind classes
 * - `priorityClasses()` helper for task priority styling
 * 
 * THEMING SYSTEM:
 * Colors are defined as CSS custom properties in globals.css using the @theme directive.
 * Components use semantic tokens like `text-[var(--color-text-primary)]` or 
 * `bg-[var(--color-surface-base)]` which automatically adapt to light/dark mode.
 * 
 * Semantic Token Categories:
 * - Surfaces: --color-surface-{base|secondary|tertiary|overlay|inset}
 * - Text: --color-text-{primary|secondary|tertiary|disabled}
 * - Borders: --color-border-{default|subtle}
 * - Accents: --color-accent-{primary|secondary|muted}
 * - States: --color-{success|warning|danger}
 */

// Import from the TypeScript color palette file
import { colorPalette } from './colors';

// Re-export for components that need raw color values
export { colorPalette };

// ============================================================================
// SEMANTIC COLOR CLASSES (built from colorPalette)
// Using theme classes from globals.css @theme directive
// ============================================================================

export const colors = {
  // Priority Colors (P1-P4) - Original colors
  priority: {
    p1: {
      border: 'border-red-500',
      text: 'text-red-500',
      bg: 'bg-red-500/10',
      hex: colorPalette.danger.DEFAULT,
    },
    p2: {
      border: 'border-orange-500',
      text: 'text-orange-500',
      bg: 'bg-orange-500/10',
      hex: colorPalette.warning.DEFAULT,
    },
    p3: {
      border: 'border-blue-500',
      text: 'text-blue-500',
      bg: 'bg-blue-500/10',
      hex: colorPalette.primary[500],
    },
    p4: {
      border: 'border-gray-400',
      text: 'text-gray-400',
      bg: 'bg-gray-400/10',
      hex: colorPalette.gray[400],
    },
  },

  // Text Colors - Using semantic CSS custom properties
  text: {
    primary: 'text-[var(--color-text-primary)]',
    secondary: 'text-[var(--color-text-secondary)]',
    tertiary: 'text-[var(--color-text-tertiary)]',
    disabled: 'text-[var(--color-text-disabled)]',
    inverse: 'text-white dark:text-gray-900',
    link: 'text-[var(--color-accent-primary)]',
    success: 'text-[var(--color-success)]',
    warning: 'text-[var(--color-warning)]',
    error: 'text-[var(--color-danger)]',
  },

  // Background Colors - Using semantic CSS custom properties
  background: {
    primary: 'bg-[var(--color-surface-base)]',
    secondary: 'bg-[var(--color-surface-secondary)]',
    tertiary: 'bg-[var(--color-surface-tertiary)]',
    hover: 'hover:bg-[var(--color-surface-secondary)]',
    active: 'bg-[var(--color-accent-muted)]',
    inverse: 'bg-gray-900 dark:bg-white',
    appSidebar: 'bg-[var(--color-surface-inset)]',
    contentSidebar: 'bg-[var(--color-surface-secondary)]',
  },

  // Border Colors - Using semantic CSS custom properties
  border: {
    default: 'border-[var(--color-border-default)]',
    light: 'border-[var(--color-border-subtle)]',
    medium: 'border-[var(--color-border-default)]',
    strong: 'border-[var(--color-text-disabled)]',
    primary: 'border-[var(--color-accent-primary)]',
    focus: 'border-[var(--color-accent-primary)]',
    subtle: 'border-[var(--color-border-subtle)]',
  },
} as const;

// ============================================================================
// SPACING
// ============================================================================

export const spacing = {
  // Component Padding
  padding: {
    xs: 'p-1',
    sm: 'p-2',
    md: 'p-3',
    lg: 'p-4',
    xl: 'p-6',
    '2xl': 'p-8',
  },

  // Horizontal Padding
  px: {
    xs: 'px-1',
    sm: 'px-2',
    md: 'px-3',
    lg: 'px-4',
    xl: 'px-6',
    '2xl': 'px-8',
  },

  // Vertical Padding
  py: {
    xs: 'py-1',
    sm: 'py-2',
    md: 'py-3',
    lg: 'py-4',
    xl: 'py-6',
    '2xl': 'py-8',
  },

  // Gap (for flex/grid)
  gap: {
    xs: 'gap-1',
    sm: 'gap-2',
    md: 'gap-3',
    lg: 'gap-4',
    xl: 'gap-6',
    '2xl': 'gap-8',
  },

  // Margin
  margin: {
    xs: 'm-1',
    sm: 'm-2',
    md: 'm-3',
    lg: 'm-4',
    xl: 'm-6',
    '2xl': 'm-8',
  },
} as const;

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const typography = {
  // Font Families
  fontFamily: {
    sans: 'font-sans',
    mono: 'font-mono',
  },

  // Font Sizes
  fontSize: {
    xs: 'text-xs',      // 0.75rem / 12px
    sm: 'text-sm',      // 0.875rem / 14px
    base: 'text-base',  // 1rem / 16px
    lg: 'text-lg',      // 1.125rem / 18px
    xl: 'text-xl',      // 1.25rem / 20px
    '2xl': 'text-2xl',  // 1.5rem / 24px
    '3xl': 'text-3xl',  // 1.875rem / 30px
    '4xl': 'text-4xl',  // 2.25rem / 36px
  },

  // Font Weights
  fontWeight: {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
  },

  // Line Heights
  lineHeight: {
    none: 'leading-none',
    tight: 'leading-tight',
    normal: 'leading-normal',
    relaxed: 'leading-relaxed',
  },

  // Letter Spacing
  letterSpacing: {
    tighter: 'tracking-tighter',
    tight: 'tracking-tight',
    normal: 'tracking-normal',
    wide: 'tracking-wide',
  },
} as const;

// ============================================================================
// BORDERS & RADIUS
// ============================================================================

export const borders = {
  // Border Width
  width: {
    none: 'border-0',
    default: 'border',
    2: 'border-2',
    4: 'border-4',
  },

  // Border Radius
  radius: {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    '2xl': 'rounded-2xl',
    full: 'rounded-full',
  },

  // Border Styles
  style: {
    solid: 'border-solid',
    dashed: 'border-dashed',
    dotted: 'border-dotted',
  },
} as const;

// ============================================================================
// SHADOWS (Deprecated - Use borders instead)
// ============================================================================

export const shadows = {
  none: 'shadow-none',
  sm: 'shadow-none', // Replaced with borders
  md: 'shadow-none', // Replaced with borders
  lg: 'shadow-none', // Replaced with borders
  xl: 'shadow-none', // Replaced with borders
  '2xl': 'shadow-none', // Replaced with borders
  inner: 'shadow-none', // Replaced with borders
} as const;

// ============================================================================
// GLASS MORPHISM (Deprecated - Use solid backgrounds)
// ============================================================================

export const glass = {
  // Deprecated: Use solid backgrounds instead
  opacity: {
    subtle: {
      light: 'bg-white',
      dark: 'dark:bg-[#0d1117]',  // GitHub: canvas-default
    },
    light: {
      light: 'bg-white',
      dark: 'dark:bg-[#0d1117]',  // GitHub: canvas-default
    },
    medium: {
      light: 'bg-white',
      dark: 'dark:bg-[#0d1117]',  // GitHub: canvas-default
    },
    heavy: {
      light: 'bg-white',
      dark: 'dark:bg-[#0d1117]',  // GitHub: canvas-default
    },
  },

  // Deprecated: No blur effects
  blur: {
    sm: '',
    md: '',
    lg: '',
    xl: '',
    '2xl': '',
  },

  // Use subtle borders instead - GitHub themed
  border: {
    light: 'border border-gray-200 dark:border-[#30363d]',   // GitHub: border-default
    medium: 'border border-gray-300 dark:border-[#484f58]',  // GitHub: border-muted
  },
} as const;

// ============================================================================
// TRANSITIONS
// ============================================================================

export const transitions = {
  duration: {
    fast: 'duration-150',
    normal: 'duration-200',
    slow: 'duration-300',
  },

  timing: {
    ease: 'ease-in-out',
    linear: 'ease-linear',
    in: 'ease-in',
    out: 'ease-out',
  },

  property: {
    all: 'transition-all',
    colors: 'transition-colors',
    opacity: 'transition-opacity',
    transform: 'transition-transform',
  },
} as const;

// ============================================================================
// COMPONENT-SPECIFIC TOKENS
// ============================================================================

export const components = {
  // Button Variants - Original light mode, GitHub dark mode
  button: {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white border border-blue-600 hover:border-blue-700',
    secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-200 hover:border-gray-300 dark:bg-[#21262d] dark:hover:bg-[#30363d] dark:text-[#e6edf3] dark:border-[#30363d] dark:hover:border-[#484f58]',
    ghost: 'bg-transparent hover:bg-gray-100 text-gray-700 border border-transparent hover:border-gray-200 dark:text-[#8b949e] dark:hover:bg-[#21262d] dark:hover:border-[#30363d] dark:hover:text-[#e6edf3]',
    danger: 'bg-red-600 hover:bg-red-700 text-white border border-red-600 hover:border-red-700',
    success: 'bg-green-600 hover:bg-green-700 text-white border border-green-600 hover:border-green-700',
  },

  // Input States - Original light mode, GitHub dark mode
  input: {
    base: 'bg-white dark:bg-[#0d1117] border focus:outline-none focus:ring-0',
    default: 'border-gray-300 dark:border-[#30363d]',
    focus: 'focus:border-blue-500 dark:focus:border-[#58a6ff]',
    error: 'border-red-500 focus:border-red-500',
    disabled: 'opacity-50 cursor-not-allowed',
  },

  // Badge Variants - Original light mode, GitHub dark mode
  badge: {
    default: 'bg-gray-100 text-gray-700 border border-gray-200 dark:bg-[#21262d] dark:text-[#8b949e] dark:border-[#30363d]',
    primary: 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-[#1f6feb26] dark:text-[#58a6ff] dark:border-[#1f6feb]',
    success: 'bg-green-50 text-green-700 border border-green-200 dark:bg-[#23863626] dark:text-[#3fb950] dark:border-[#238636]',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-[#9e6a0326] dark:text-[#d29922] dark:border-[#9e6a03]',
    error: 'bg-red-50 text-red-700 border border-red-200 dark:bg-[#da363326] dark:text-[#f85149] dark:border-[#da3633]',
  },

  // Navigation Item States - Original light mode, GitHub dark mode
  navItem: {
    base: 'px-3 py-2 rounded-lg text-sm font-medium transition-colors border',
    inactive: 'text-gray-700 dark:text-[#8b949e] hover:bg-gray-100 dark:hover:bg-[#21262d] border-transparent',
    active: 'bg-blue-50 dark:bg-[#1f6feb26] border-blue-200 dark:border-[#1f6feb] text-blue-700 dark:text-[#58a6ff]',
  },

  // App Sidebar Icon States
  appIcon: {
    base: 'p-3 rounded-lg transition-colors border',
    inactive: 'text-gray-400 dark:text-gray-500 hover:bg-gray-700 hover:text-gray-200 border-transparent',
    active: 'bg-gray-700 text-white border-gray-600',
  },
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Combine multiple class strings
 */
export const cn = (...classes: (string | undefined | null | false)[]) => {
  return classes.filter(Boolean).join(' ');
};

/**
 * Get priority color classes
 */
export const getPriorityColor = (priority: 1 | 2 | 3 | 4) => {
  const key = `p${priority}` as keyof typeof colors.priority;
  return colors.priority[key];
};

/**
 * Get priority classes by string name (legacy API compatibility)
 * Supports: 'high', 'medium', 'low', 'none' OR 'p1', 'p2', 'p3', 'p4'
 */
export const priorityClasses = (priority?: string) => {
  if (!priority) return colors.priority.p4;
  
  // Map legacy names to new priority system
  const priorityMap: Record<string, keyof typeof colors.priority> = {
    'high': 'p1',
    'medium': 'p2',
    'low': 'p3',
    'none': 'p4',
    'p1': 'p1',
    'p2': 'p2',
    'p3': 'p3',
    'p4': 'p4',
  };
  
  const key = priorityMap[priority.toLowerCase()] || 'p4';
  return colors.priority[key];
};

/**
 * Get text color class by semantic name
 */
export const getTextColor = (variant: keyof typeof colors.text) => {
  return colors.text[variant];
};

/**
 * Get background color class by semantic name
 */
export const getBackgroundColor = (variant: keyof typeof colors.background) => {
  return colors.background[variant];
};
