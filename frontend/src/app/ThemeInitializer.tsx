"use client";
import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';

// Suppress React 19 ref warning from Yoopta (third-party library not yet updated)
// Also suppress Slate DOM resolution errors that happen during editor mounting/unmounting
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const originalError = console.error;
  console.error = (...args) => {
    const errorMsg = typeof args[0] === 'string' ? args[0] : '';
    
    // Suppress React 19 ref warning
    if (errorMsg.includes('Accessing element.ref was removed in React 19')) {
      return;
    }
    
    // Suppress Slate DOM resolution errors during editor transitions
    // These are non-critical - they happen when focus is called during mount/unmount
    if (errorMsg.includes('Cannot resolve a DOM node from Slate node')) {
      return;
    }
    
    originalError.apply(console, args);
  };
}

// All possible accent color classes
const ACCENT_CLASSES = ['accent-coral', 'accent-honey', 'accent-blue', 'accent-green', 'accent-red', 'accent-purple', 'accent-pink', 'accent-teal', 'accent-stone'];

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

const clampChannel = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const parseCssColor = (value: string): RgbColor | null => {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const hexMatch = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    const expanded = hex.length === 3
      ? hex.split('').map((char) => `${char}${char}`).join('')
      : hex;

    return {
      r: parseInt(expanded.slice(0, 2), 16),
      g: parseInt(expanded.slice(2, 4), 16),
      b: parseInt(expanded.slice(4, 6), 16),
    };
  }

  const rgbMatch = normalized.match(/^rgba?\(([^)]+)\)$/i);
  if (!rgbMatch) {
    return null;
  }

  const [r = '0', g = '0', b = '0'] = rgbMatch[1]
    .split(',')
    .map((part) => part.trim());

  return {
    r: Number.parseFloat(r),
    g: Number.parseFloat(g),
    b: Number.parseFloat(b),
  };
};

const blendColors = (base: RgbColor, tint: RgbColor, tintWeight: number): string => {
  const baseWeight = 1 - tintWeight;
  const mixed = {
    r: clampChannel((base.r * baseWeight) + (tint.r * tintWeight)),
    g: clampChannel((base.g * baseWeight) + (tint.g * tintWeight)),
    b: clampChannel((base.b * baseWeight) + (tint.b * tintWeight)),
  };

  return `#${[mixed.r, mixed.g, mixed.b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
};

const ensureMetaTag = (name: string, media?: string): HTMLMetaElement => {
  const selector = media
    ? `meta[name="${name}"][media="${media}"]`
    : `meta[name="${name}"]:not([media])`;
  const existing = document.head.querySelector<HTMLMetaElement>(selector);

  if (existing) {
    return existing;
  }

  const meta = document.createElement('meta');
  meta.setAttribute('name', name);
  if (media) {
    meta.setAttribute('media', media);
  }
  document.head.appendChild(meta);
  return meta;
};

const resolveThemeColor = (root: HTMLElement, forceDark: boolean): string => {
  const hadDarkClass = root.classList.contains('dark');

  if (forceDark !== hadDarkClass) {
    root.classList.toggle('dark', forceDark);
  }

  const styles = window.getComputedStyle(root);
  const accentColor = styles.getPropertyValue('--color-accent-primary').trim();
  const surfaceColor = styles.getPropertyValue('--color-surface-app').trim();
  const parsedAccent = parseCssColor(accentColor);
  const parsedSurface = parseCssColor(surfaceColor);

  const themeColor = forceDark && parsedAccent && parsedSurface
    ? blendColors(parsedSurface, parsedAccent, 0.28)
    : accentColor || '#E8705F';

  if (forceDark !== hadDarkClass) {
    root.classList.toggle('dark', hadDarkClass);
  }

  return themeColor;
};

const syncPwaThemeColor = () => {
  const root = document.documentElement;
  const currentIsDark = root.classList.contains('dark');
  const lightThemeColor = resolveThemeColor(root, false);
  const darkThemeColor = resolveThemeColor(root, true);
  const currentThemeColor = currentIsDark ? darkThemeColor : lightThemeColor;

  ensureMetaTag('theme-color').setAttribute('content', currentThemeColor);
  ensureMetaTag('theme-color', '(prefers-color-scheme: light)').setAttribute('content', lightThemeColor);
  ensureMetaTag('theme-color', '(prefers-color-scheme: dark)').setAttribute('content', darkThemeColor);
};

export default function ThemeInitializer() {
  const theme = useSettingsStore((s) => s.theme);
  const themeVariant = useSettingsStore((s) => s.themeVariant);
  const einkMode = useSettingsStore((s) => s.einkMode);
  const accentColor = useSettingsStore((s) => s.accentColor);

  // Handle theme tone and dedicated e-ink mode.
  useEffect(() => {
    const root = document.documentElement;
    const defaultAccentByVariant = {
      warm: 'coral',
      cool: 'blue',
    } as const;
    // Remove any existing variant class
    root.classList.remove('theme-warm', 'theme-cool', 'theme-eink');
    // Add the current theme class. Warm remains the default token set.
    if (einkMode) {
      root.classList.add('theme-eink');
    } else if (themeVariant === 'cool') {
      root.classList.add('theme-cool');
    }
    // Remove any existing accent classes first
    ACCENT_CLASSES.forEach(cls => root.classList.remove(cls));

    if (!einkMode) {
      const effectiveAccent = accentColor ?? defaultAccentByVariant[themeVariant];
      root.classList.add(`accent-${effectiveAccent}`);
    }

    syncPwaThemeColor();
  }, [accentColor, einkMode, themeVariant]);

  useEffect(() => {
    const root = document.documentElement;
    const apply = (isDark: boolean) => {
      root.classList.toggle('dark', isDark);
      syncPwaThemeColor();
    };

    if (theme === 'dark') {
      apply(true);
      return;
    }
    if (theme === 'light') {
      apply(false);
      return;
    }
    // system: follow prefers-color-scheme
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    apply(mql.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mql.addEventListener?.('change', handler);
    return () => mql.removeEventListener?.('change', handler);
  }, [theme]);

  return null;
}
