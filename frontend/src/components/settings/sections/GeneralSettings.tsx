/**
 * General Settings Section
 * Theme, color style, and accent color configuration.
 */

import React from 'react';
import { useSettingsStore, type Theme, type AccentColor, type ThemeVariant } from '@/stores/settingsStore';
import {
  SegmentedControl,
  SettingsSectionHeader,
  SettingsSeparator,
} from '@frameer/components/ui';

type EinkModeSetting = 'off' | 'on';

const GeneralSettings: React.FC = () => {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const themeVariant = useSettingsStore((s) => s.themeVariant);
  const setThemeVariant = useSettingsStore((s) => s.setThemeVariant);
  const einkMode = useSettingsStore((s) => s.einkMode);
  const setEinkMode = useSettingsStore((s) => s.setEinkMode);
  const accentColor = useSettingsStore((s) => s.accentColor);
  const setAccentColor = useSettingsStore((s) => s.setAccentColor);
  const autoColor = themeVariant === 'warm' ? '#E8705F' : '#3b82f6';
  const autoDarkColor = themeVariant === 'warm' ? '#F0887A' : '#58a6ff';

  const accentOptions: { value: AccentColor; label: string; color: string; darkColor: string }[] = [
    { value: null, label: 'Auto', color: autoColor, darkColor: autoDarkColor },
    { value: 'coral', label: 'Coral', color: '#E8705F', darkColor: '#F0887A' },
    { value: 'honey', label: 'Honey', color: '#f59e0b', darkColor: '#fbbf24' },
    { value: 'blue', label: 'Blue', color: '#3b82f6', darkColor: '#58a6ff' },
    { value: 'green', label: 'Green', color: '#22c55e', darkColor: '#4ade80' },
    { value: 'red', label: 'Red', color: '#ef4444', darkColor: '#f87171' },
    { value: 'purple', label: 'Purple', color: '#a855f7', darkColor: '#c084fc' },
    { value: 'pink', label: 'Pink', color: '#ec4899', darkColor: '#f472b6' },
    { value: 'teal', label: 'Teal', color: '#14b8a6', darkColor: '#2dd4bf' },
    { value: 'stone', label: 'Stone', color: '#78716c', darkColor: '#a8a29e' },
  ];

  return (
    <div className="space-y-4">
      {/* Theme */}
      <SettingsSectionHeader title="Theme" />
      <SegmentedControl<Theme>
        options={[
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
          { value: 'system', label: 'System' },
        ]}
        value={theme}
        onChange={setTheme}
      />

      <SettingsSectionHeader title="E-Ink Mode" />
      <SegmentedControl<EinkModeSetting>
        options={[
          { value: 'off', label: 'Off' },
          { value: 'on', label: 'On' },
        ]}
        value={einkMode ? 'on' : 'off'}
        onChange={(value) => setEinkMode(value === 'on')}
      />
      <p className="text-xs text-[var(--color-text-tertiary)]">
        {einkMode
          ? 'High-contrast monochrome tokens are active. Tone and accent controls are disabled while e-ink mode is on.'
          : 'Enable a dedicated monochrome mode for e-ink and e-paper devices.'}
      </p>

      <SettingsSeparator />

      {/* Color Style */}
      <SettingsSectionHeader title="Color Style" />
      {einkMode ? (
        <p className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-secondary)] px-3 py-2 text-xs text-[var(--color-text-tertiary)]">
          Tone selection is unavailable while e-ink mode is enabled.
        </p>
      ) : (
        <>
          <SegmentedControl<ThemeVariant>
            options={[
              { value: 'warm', label: 'Warm' },
              { value: 'cool', label: 'Cool' },
            ]}
            value={themeVariant}
            onChange={setThemeVariant}
          />
          <p className="text-xs text-[var(--color-text-tertiary)]">
            {themeVariant === 'warm'
              ? 'Warm cream surfaces with coral accents'
              : 'GitHub-inspired blues and cool grays'}
          </p>
        </>
      )}

      <SettingsSeparator />

      {/* Accent Color */}
      <SettingsSectionHeader title="Accent Color" />
      {einkMode ? (
        <p className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-secondary)] px-3 py-2 text-xs text-[var(--color-text-tertiary)]">
          Accent colors are disabled while e-ink mode is enabled.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {accentOptions.map((option) => {
            const isSelected = accentColor === option.value;
            return (
              <button
                key={option.value ?? 'auto'}
                onClick={() => setAccentColor(option.value)}
                className={`
                  flex items-center gap-1.5 rounded-lg bg-[var(--color-surface-secondary)] px-2.5 py-1.5 text-xs font-medium transition-all
                  ${isSelected
                    ? 'ring-2 ring-offset-1 ring-offset-[var(--color-surface-base)] ring-[var(--color-fab-bg)]'
                    : 'hover:bg-[var(--color-surface-tertiary)]'
                  }
                `}
                title={option.label}
                type="button"
              >
                <span
                  className="h-3.5 w-3.5 rounded-full shadow-sm"
                  style={{
                    background: `linear-gradient(135deg, ${option.color} 0%, ${option.darkColor} 100%)`,
                  }}
                />
                <span className="text-[var(--color-text-secondary)]">{option.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <SettingsSeparator />
    </div>
  );
};

export default GeneralSettings;
