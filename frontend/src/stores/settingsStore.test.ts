/**
 * @file settingsStore.test.ts
 * @description Unit tests for settings store
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from './settingsStore';

describe('settingsStore', () => {
  beforeEach(() => {
    // Reset store to defaults
    useSettingsStore.getState().resetSettings();
  });

  describe('theme', () => {
    it('defaults to system theme', () => {
      expect(useSettingsStore.getState().theme).toBe('system');
    });

    it('sets theme to light', () => {
      useSettingsStore.getState().setTheme('light');
      expect(useSettingsStore.getState().theme).toBe('light');
    });

    it('sets theme to dark', () => {
      useSettingsStore.getState().setTheme('dark');
      expect(useSettingsStore.getState().theme).toBe('dark');
    });

    it('sets theme to system', () => {
      useSettingsStore.getState().setTheme('dark');
      useSettingsStore.getState().setTheme('system');
      expect(useSettingsStore.getState().theme).toBe('system');
    });
  });

  describe('offlineSettings', () => {
    it('has default retention of 7 days', () => {
      expect(useSettingsStore.getState().offlineSettings.noteContentRetentionDays).toBe(7);
    });

    it('updates offline settings', () => {
      useSettingsStore.getState().setOfflineSettings({ noteContentRetentionDays: 30 });
      expect(useSettingsStore.getState().offlineSettings.noteContentRetentionDays).toBe(30);
    });

    it('can set to metadata only (0 days)', () => {
      useSettingsStore.getState().setOfflineSettings({ noteContentRetentionDays: 0 });
      expect(useSettingsStore.getState().offlineSettings.noteContentRetentionDays).toBe(0);
    });
  });

  describe('resetSettings', () => {
    it('resets all settings to defaults', () => {
      useSettingsStore.getState().setTheme('dark');
      useSettingsStore.getState().setOfflineSettings({ noteContentRetentionDays: 30 });
      
      useSettingsStore.getState().resetSettings();
      
      const state = useSettingsStore.getState();
      expect(state.theme).toBe('system');
      expect(state.offlineSettings.noteContentRetentionDays).toBe(7);
      expect(state.sidebar.recentPagesCount).toBe(5);
    });
  });
});
