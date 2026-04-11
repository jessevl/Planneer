/**
 * Color Palette - Single Source of Truth
 * 
 * 🎯 ALL color values are defined here.
 * 
 * LIGHT MODE: Uses original Tailwind colors (unchanged)
 * DARK MODE: Uses GitHub-inspired colors for backgrounds/borders
 * 
 * GitHub Dark Mode Reference (for dark:* classes):
 * - #0d1117 = canvas-default (main background)
 * - #161b22 = canvas-subtle (sidebar, cards)
 * - #21262d = canvas-overlay (hover states)
 * - #010409 = canvas-inset (deepest background)
 * - #30363d = border-default
 * - #21262d = border-subtle
 * - #484f58 = border-muted
 * - #e6edf3 = fg-default (primary text)
 * - #8b949e = fg-muted (secondary text)
 * - #6e7681 = fg-subtle (tertiary text)
 * - #58a6ff = accent-fg (links, active states)
 * - #3fb950 = success-fg (green text)
 * - #f85149 = danger-fg (red text)
 * - #d29922 = attention-fg (yellow/warning)
 * 
 * This file is imported by:
 * 1. design-system.ts → Used by components
 * 2. tailwind.config.js → Used by Tailwind (duplicated due to CommonJS requirement)
 * 
 * To change colors: Edit this file, then copy values to tailwind.config.js
 */

export const colorPalette = {
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
} as const;
