/**
 * @file defaults.ts
 * @description Shared theme-aware defaults for the custom Excalidraw integration
 */

export const DEFAULT_STROKE_COLORS = {
  light: '#1e1e1e',
  dark: '#e8e8e8',
} as const;

export const DEFAULT_VIEW_BACKGROUND_COLORS = {
  light: '#ffffff',
  dark: '#1a1a1a',
} as const;

export const getDefaultStrokeColor = (isDark: boolean): string => (
  isDark ? DEFAULT_STROKE_COLORS.dark : DEFAULT_STROKE_COLORS.light
);

export const isDefaultStrokeColor = (color: string | null | undefined): boolean => (
  color === DEFAULT_STROKE_COLORS.light || color === DEFAULT_STROKE_COLORS.dark
);

export const normalizeDefaultStrokeColor = (color: string | null | undefined, isDark: boolean): string | undefined => {
  if (!isDefaultStrokeColor(color)) {
    return color ?? undefined;
  }

  return getDefaultStrokeColor(isDark);
};

export const getDefaultViewBackgroundColor = (isDark: boolean): string => (
  isDark ? DEFAULT_VIEW_BACKGROUND_COLORS.dark : DEFAULT_VIEW_BACKGROUND_COLORS.light
);