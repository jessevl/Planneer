/**
 * Pomodoro Settings Section
 * Focus timer durations, auto-start options.
 */

import React from 'react';
import { usePomodoroStore } from '@/stores/pomodoroStore';
import { Select, Toggle } from '@/components/ui';
import {
  SettingsSectionHeader,
  SettingsCard,
  SettingsToggleRow,
  SettingsNumberInput,
  SettingsSeparator,
} from '@frameer/components/ui';

const PomodoroSettings: React.FC = () => {
  const settings = usePomodoroStore((s) => s.settings);
  const updateSettings = usePomodoroStore((s) => s.updateSettings);

  return (
    <div className="space-y-4">
      {/* Durations */}
      <SettingsSectionHeader title="Session Durations" />
      <SettingsCard>
        <div className="grid grid-cols-3 gap-3">
          {([
            { key: 'workDuration', label: 'Work', min: 1, max: 60 },
            { key: 'breakDuration', label: 'Short Break', min: 1, max: 30 },
            { key: 'longBreakDuration', label: 'Long Break', min: 1, max: 60 },
          ] as const).map(({ key, label, min, max }) => (
            <div key={key}>
              <label className="block text-xs text-[var(--color-text-tertiary)] mb-1">{label}</label>
              <div className="flex items-center gap-1.5">
                <SettingsNumberInput
                  value={settings[key]}
                  min={min}
                  max={max}
                  onChange={(v) => updateSettings({ [key]: v })}
                  className="w-full text-center"
                />
                <span className="text-xs text-[var(--color-text-tertiary)]">min</span>
              </div>
            </div>
          ))}
        </div>
      </SettingsCard>

      {/* Sessions before long break */}
      <SettingsSectionHeader title="Long Break Interval" />
      <Select
        value={String(settings.sessionsBeforeLongBreak)}
        options={[2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `${n} sessions` }))}
        onChange={(val) => updateSettings({ sessionsBeforeLongBreak: parseInt(val) })}
        size="md"
      />

      <SettingsSeparator />

      {/* Auto-start */}
      <SettingsSectionHeader title="Auto-start" />
      <SettingsCard>
        <SettingsToggleRow
          label="Auto-start breaks"
          enabled={settings.autoStartBreaks}
          onChange={(v) => updateSettings({ autoStartBreaks: v })}
        />
        <SettingsSeparator />
        <SettingsToggleRow
          label="Auto-start work sessions"
          enabled={settings.autoStartWork}
          onChange={(v) => updateSettings({ autoStartWork: v })}
        />
      </SettingsCard>
    </div>
  );
};

export default PomodoroSettings;
