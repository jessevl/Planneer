/**
 * @file settingsStore.ts
 * @description Global app settings with Zustand
 * @app SHARED - App-wide settings accessible from SettingsModal
 * 
 * Settings include:
 * - theme: 'system' | 'light' | 'dark'
 * - themeVariant: 'warm' | 'cool' (warm is default)
 * - einkMode: Dedicated monochrome mode for e-ink devices
 * - accentColor: Custom accent color override (null = use theme default: coral for warm, blue for cool)
 * - offlineSettings: Controls offline data retention
 * - tabsEnabled: Preserved for future browser-style tab support (currently dormant)
 */
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type Theme = 'system' | 'light' | 'dark';
export type ThemeVariant = 'warm' | 'cool';

/**
 * Accent color options for UI elements like FAB, buttons, focus rings
 * null = use theme default (coral for warm, blue for cool)
 * 'coral' = warm coral (inspired by stik.ink) — default for warm themes
 * 'honey' = warm golden (formerly 'amber')
 */
export type AccentColor = 'coral' | 'honey' | 'blue' | 'green' | 'red' | 'purple' | 'pink' | 'teal' | 'stone' | null;

/**
 * Tab retention policy when closing the app
 */
export type TabRetentionPolicy = 'all' | 'pinned-only' | 'none';

/**
 * Offline data retention settings.
 * Controls what data is stored locally for offline access.
 */
export interface OfflineSettings {
  /**
   * How many days of note content to keep offline.
   * - 0: Metadata only (content fetched on demand)
   * - 7/14/30: Keep content for pages updated in last N days
   */
  noteContentRetentionDays: 0 | 7 | 14 | 30;
}

export interface SidebarSettings {
  /** Number of recent pages shown in sidebar quick access. */
  recentPagesCount: 3 | 5 | 8 | 12;
}

interface SettingsState {
  theme: Theme;
  themeVariant: ThemeVariant;
  einkMode: boolean;
  accentColor: AccentColor;
  offlineSettings: OfflineSettings;
  sidebar: SidebarSettings;
  /** Preserved for future browser-style tab support. Hidden in the UI for now. */
  tabsEnabled: boolean;
  /** Preserved flag for future tab setting rollout. */
  tabsEnabledExplicitlySet: boolean;
  /** Preserved tab retention policy for future tab setting rollout. */
  tabRetentionPolicy: TabRetentionPolicy;

  // Actions
  setTheme: (theme: Theme) => void;
  setThemeVariant: (variant: ThemeVariant) => void;
  setEinkMode: (enabled: boolean) => void;
  setAccentColor: (color: AccentColor) => void;
  setOfflineSettings: (settings: Partial<OfflineSettings>) => void;
  setSidebarSettings: (settings: Partial<SidebarSettings>) => void;
  setTabsEnabled: (enabled: boolean) => void;
  setTabRetentionPolicy: (policy: TabRetentionPolicy) => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS = {
  theme: 'system' as Theme,
  themeVariant: 'warm' as ThemeVariant,
  einkMode: false,
  accentColor: null as AccentColor, // null = use theme default (coral for warm, blue for cool)
  offlineSettings: {
    noteContentRetentionDays: 7, // Default: keep 7 days of note content
  } as OfflineSettings,
  sidebar: {
    recentPagesCount: 5,
  } as SidebarSettings,
  tabsEnabled: false,
  tabsEnabledExplicitlySet: false,
  tabRetentionPolicy: 'all' as TabRetentionPolicy, // Default: keep all tabs
};

export const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      (set, get) => ({
        ...DEFAULT_SETTINGS,

        setTheme: (theme) => set({ theme }, false, 'setTheme'),

        setThemeVariant: (variant) => set({ themeVariant: variant }, false, 'setThemeVariant'),

        setEinkMode: (enabled) => set(
          (state) => ({
            einkMode: enabled,
            accentColor: enabled ? null : state.accentColor,
          }),
          false,
          'setEinkMode'
        ),
        
        setAccentColor: (color) => set(
          (state) => ({ accentColor: state.einkMode ? null : color }),
          false,
          'setAccentColor'
        ),

        setOfflineSettings: (settings) => set(
          (state) => ({
            offlineSettings: { ...state.offlineSettings, ...settings },
          }),
          false,
          'setOfflineSettings'
        ),

        setSidebarSettings: (settings) => set(
          (state) => ({
            sidebar: { ...state.sidebar, ...settings },
          }),
          false,
          'setSidebarSettings'
        ),

        setTabsEnabled: (enabled) => set(
          { tabsEnabled: enabled, tabsEnabledExplicitlySet: true },
          false,
          'setTabsEnabled'
        ),

        setTabRetentionPolicy: (policy) => set(
          { tabRetentionPolicy: policy },
          false,
          'setTabRetentionPolicy'
        ),

        resetSettings: () => set(DEFAULT_SETTINGS, false, 'resetSettings'),
      }),
      {
        name: 'planneer-settings',
        version: 8, // v8: add sidebar recent pages settings
        migrate: (persisted: any, version: number) => {
          if (version === 0) {
            // v0→v1: Rename old 'amber' (golden) accent to 'honey'
            if (persisted?.accentColor === 'amber') {
              persisted.accentColor = 'honey';
            }
          }
          if (version <= 1) {
            // v1→v2: Rename 'amber' (coral) accent to 'coral'
            if (persisted?.accentColor === 'amber') {
              persisted.accentColor = 'coral';
            }
          }
          if (version <= 3 && persisted?.panelLayout) {
            delete persisted.panelLayout;
          }
          if (version <= 4 && persisted) {
            persisted.tabsEnabled = false;
            persisted.tabsEnabledExplicitlySet = false;
          }
          if (version <= 5 && persisted) {
            if (persisted.themeVariant === 'eink') {
              persisted.themeVariant = 'warm';
              persisted.einkMode = true;
              persisted.accentColor = null;
            } else if (typeof persisted.einkMode !== 'boolean') {
              persisted.einkMode = false;
            }
          }
          if (version <= 7 && persisted && typeof persisted.sidebar !== 'object') {
            persisted.sidebar = { recentPagesCount: 5 };
          }
          return persisted;
        },
        onRehydrateStorage: () => (state) => {
          if (state) {
            state.tabsEnabled = false;
            state.tabsEnabledExplicitlySet = false;
          }
        },
      }
    ),
    { name: 'SettingsStore' }
  )
);
