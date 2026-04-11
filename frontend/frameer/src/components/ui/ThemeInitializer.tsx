import { useEffect } from "react";

export type ThemeMode = "system" | "light" | "dark";
export type ThemeVariant = "warm" | "cool";
export type AccentColor = "coral" | "amber" | "blue" | "green" | "red" | "purple" | "pink" | "teal" | "stone" | null;

export interface ThemeInitializerProps {
  theme: ThemeMode;
  themeVariant: ThemeVariant;
  einkMode?: boolean;
  accentColor?: AccentColor;
}

const ACCENT_CLASSES = ["accent-coral", "accent-amber", "accent-blue", "accent-green", "accent-red", "accent-purple", "accent-pink", "accent-teal", "accent-stone"];

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
      ? hex.split("").map((char) => `${char}${char}`).join("")
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

  const [r = "0", g = "0", b = "0"] = rgbMatch[1]
    .split(",")
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

  return `#${[mixed.r, mixed.g, mixed.b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
};

const syncPwaThemeColor = () => {
  const root = document.documentElement;
  const styles = window.getComputedStyle(root);
  const accent = styles.getPropertyValue("--color-accent-primary").trim();
  const surface = styles.getPropertyValue("--color-surface-app").trim();
  const isDark = root.classList.contains("dark");
  const parsedAccent = parseCssColor(accent);
  const parsedSurface = parseCssColor(surface);

  const themeColor = isDark && parsedAccent && parsedSurface
    ? blendColors(parsedSurface, parsedAccent, 0.28)
    : accent || "#E8705F";

  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute("content", themeColor);
  });
};

export default function ThemeInitializer({
  theme,
  themeVariant,
  einkMode = false,
  accentColor = null,
}: ThemeInitializerProps) {
  useEffect(() => {
    const root = document.documentElement;
    const defaultAccentByVariant = {
      warm: "coral",
      cool: "blue",
      eink: "stone",
    } as const;

    root.classList.remove("theme-warm", "theme-cool", "theme-eink");
    ACCENT_CLASSES.forEach((cls) => root.classList.remove(cls));

    if (einkMode) {
      root.classList.add("theme-eink");
    } else if (themeVariant === "cool") {
      root.classList.add("theme-cool");
    }

    const effectiveAccent = accentColor ?? (einkMode ? "stone" : defaultAccentByVariant[themeVariant]);
    root.classList.add(`accent-${effectiveAccent}`);

    syncPwaThemeColor();
  }, [accentColor, einkMode, themeVariant]);

  useEffect(() => {
    const root = document.documentElement;
    const apply = (isDark: boolean) => {
      if (isDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }

      syncPwaThemeColor();
    };

    if (theme === "dark") {
      apply(true);
      return;
    }

    if (theme === "light") {
      apply(false);
      return;
    }

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    apply(mql.matches);
    const handler = (event: MediaQueryListEvent) => apply(event.matches);
    mql.addEventListener?.("change", handler);
    return () => mql.removeEventListener?.("change", handler);
  }, [theme]);

  return null;
}