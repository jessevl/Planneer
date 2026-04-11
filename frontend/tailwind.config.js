/** @type {import('tailwindcss').Config} */

/**
 * Color Palette - Inlined from colors.ts for Tailwind compatibility
 * 
 * Note: These colors are duplicated in src/lib/colors.ts for TypeScript usage.
 * This is necessary because Tailwind requires CommonJS format.
 * 
 * To change colors: Edit src/lib/colors.ts and copy values here.
 */
const colorPalette = {
  // Primary Brand Colors - Original Tailwind blues (unchanged for light mode)
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',  // Main brand blue
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },

  // Neutral Grays - Original light mode, GitHub-inspired dark mode
  gray: {
    50: '#f9fafb',   // Light mode - unchanged
    100: '#f3f4f6',  // Light mode - unchanged
    200: '#e5e7eb',  // Light mode - unchanged
    300: '#d1d5db',  // Light mode - unchanged
    400: '#9ca3af',  // Light mode - unchanged
    500: '#6b7280',  // Light mode - unchanged
    600: '#4b5563',  // Light mode - unchanged
    700: '#30363d',  // Dark: GitHub border-default
    750: '#21262d',  // Dark: GitHub canvas-overlay
    800: '#161b22',  // Dark: GitHub canvas-subtle
    850: '#0d1117',  // Dark: GitHub canvas-default
    900: '#010409',  // Dark: GitHub canvas-inset
  },

  // Semantic Colors - Original light, GitHub-inspired dark
  success: {
    DEFAULT: '#10b981',  // Original emerald
    light: '#6ee7b7',
    dark: '#3fb950',     // GitHub green for dark mode
  },
  warning: {
    DEFAULT: '#f59e0b',  // Original amber
    light: '#fbbf24',
    dark: '#d29922',     // GitHub yellow for dark mode
  },
  danger: {
    DEFAULT: '#ef4444',  // Original red
    light: '#f87171',
    dark: '#f85149',     // GitHub red for dark mode
  },
  info: {
    DEFAULT: '#3b82f6',  // Original blue
    light: '#60a5fa',
    dark: '#58a6ff',     // GitHub blue for dark mode
  },
};

module.exports = {
  darkMode: 'class',
  safelist: [
    // Custom gray shades
    'bg-gray-750',
    'bg-gray-850',
    'hover:bg-gray-750',
    'hover:bg-gray-850',
    'dark:bg-gray-750',
    'dark:bg-gray-850',
    'dark:hover:bg-gray-750',
    'dark:hover:bg-gray-850',
    // Priority colors for TaskCheckbox (dynamically generated from border classes)
    'bg-red-500',
    'bg-orange-500',
    'bg-blue-500',
    'bg-gray-400',
    // Priority border colors
    'border-red-500',
    'border-orange-500',
    'border-blue-500',
    'border-gray-400',
  ],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/plugins/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/@yoopta/themes-shadcn/dist/**/*.{js,mjs}',
  ],
  theme: {
    // Custom screens with device-capability queries
    screens: {
      'xs': '480px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
      // Semantic aliases for clarity
      'tablet': '768px',
      'desktop': '1024px',
      // Device capability queries
      'touch': { 'raw': '(hover: none) and (pointer: coarse)' },
      'mouse': { 'raw': '(hover: hover) and (pointer: fine)' },
      'standalone': { 'raw': '(display-mode: standalone)' },
    },
    extend: {
      colors: {
        ...colorPalette, // Single source of truth from designTokens.ts
        // shadcn/ui-compatible tokens required by @yoopta/themes-shadcn
        // (code block language/theme pickers, tabs, callout options, todo checkboxes)
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        // primary: merge shadcn DEFAULT/foreground with colorPalette shades
        // DEFAULT now maps through @theme → --color-accent-primary for theme-awareness
        primary: {
          ...colorPalette.primary,
          DEFAULT: 'var(--color-accent-primary, hsl(var(--primary)))',
          foreground: '#ffffff',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
      },
      ringOffsetColor: {
        background: 'hsl(var(--background))',
      },
      // Semantic spacing scales
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '100': '25rem',
        '112': '28rem',
        '128': '32rem',
      },
      // Animation utilities
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out forwards',
        'fade-out': 'fadeOut 0.2s ease-in-out forwards',
        'slide-up': 'slideUp 0.3s ease-out forwards',
        'slide-down': 'slideDown 0.3s ease-out forwards',
        'slide-in-left': 'slideInLeft 0.2s ease-out forwards',
        'slide-in-right': 'slideInRight 0.2s ease-out forwards',
        'slide-in-bottom': 'slideInBottom 0.3s ease-out forwards',
        'slide-out-left': 'slideOutLeft 0.2s ease-in forwards',
        'slide-out-right': 'slideOutRight 0.2s ease-in forwards',
        'slide-out-bottom': 'slideOutBottom 0.3s ease-in forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideInBottom: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        slideOutLeft: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        slideOutRight: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(100%)' },
        },
        slideOutBottom: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
    },
  },
  plugins: [],
}
