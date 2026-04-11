/**
 * @file editorColors.ts
 * @description Centralized color schemes for the Yoopta editor
 *
 * Used by:
 * - AdvancedTable ColorPicker (cell/row/column background colors)
 * - AdvancedTable element renders (resolveColor for dynamic backgrounds)
 *
 * Uses a SINGLE unified color palette optimized for both light and dark modes.
 */

// ============================================================================
// UNIFIED EDITOR COLORS
// ============================================================================

export interface EditorColor {
  name: string;
  /** Text color for highlights - undefined means use default */
  textColor?: string;
  /** Light mode background color */
  bgLight: string;
  /** Dark mode background color */
  bgDark: string;
}

/**
 * Unified color palette used for both text highlights and table backgrounds.
 * 7 colors (excluding Default) that work well in both contexts.
 */
export const EDITOR_COLORS: EditorColor[] = [
  { name: 'Yellow', textColor: '#713f12', bgLight: '#fef9c3', bgDark: 'rgba(254, 240, 138, 0.25)' },
  { name: 'Green', textColor: '#14532d', bgLight: '#dcfce7', bgDark: 'rgba(134, 239, 172, 0.25)' },
  { name: 'Blue', textColor: '#1e3a8a', bgLight: '#dbeafe', bgDark: 'rgba(147, 197, 253, 0.25)' },
  { name: 'Purple', textColor: '#581c87', bgLight: '#f3e8ff', bgDark: 'rgba(216, 180, 254, 0.25)' },
  { name: 'Pink', textColor: '#831843', bgLight: '#fce7f3', bgDark: 'rgba(249, 168, 212, 0.25)' },
  { name: 'Red', textColor: '#7f1d1d', bgLight: '#fee2e2', bgDark: 'rgba(252, 165, 165, 0.25)' },
  { name: 'Orange', textColor: '#7c2d12', bgLight: '#ffedd5', bgDark: 'rgba(253, 186, 116, 0.25)' },
];

// ============================================================================
// TABLE BACKGROUND COLORS (derived from EDITOR_COLORS)
// ============================================================================

/**
 * Get background colors for table cells/rows/columns.
 * Uses the same colors as text highlights for consistency.
 * @param isDark - Whether dark mode is active
 * @returns Array of color strings
 */
export function getTableBackgroundColors(isDark: boolean): string[] {
  return EDITOR_COLORS.map(c => isDark ? c.bgDark : c.bgLight);
}

/**
 * Resolves a color name to its background and text colors for the current theme.
 * @param colorName - The name of the color (e.g., 'Yellow')
 * @param isDark - Whether dark mode is active
 * @returns Object with bg and text colors, or null if not found
 */
export function resolveColor(colorName: string | null | undefined, isDark: boolean): { bg: string; text: string } | null {
  if (!colorName) return null;
  
  const color = EDITOR_COLORS.find(c => c.name === colorName);
  if (!color) {
    // Fallback for legacy hex colors if any
    if (colorName.startsWith('#') || colorName.startsWith('rgba') || colorName.startsWith('rgb')) {
      return { bg: colorName, text: 'inherit' };
    }
    return null;
  }

  if (isDark) {
    return {
      bg: color.bgDark,
      text: color.textColor || 'inherit',
    };
  }

  return {
    bg: color.bgLight,
    text: color.textColor || 'inherit'
  };
}
