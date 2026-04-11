/**
 * @file viewPreferences.ts
 * @description Per-view preference persistence utilities
 * @app SHARED - Used by both Tasks and Notes for view settings
 * 
 * Each view (today, inbox, project_X, etc.) has its own preferences:
 * - viewMode: 'list' or 'kanban'
 * - groupBy: 'date', 'priority', 'task page', 'section', or 'none'
 * - showCompleted: boolean
 * 
 * Functions:
 * - getViewKey: Generate storage key from view name and project ID
 * - loadViewPreferences: Load preferences from localStorage
 * - saveViewPreferences: Save preferences to localStorage
 * 
 * Storage key format: `viewPrefs_{viewKey}` where viewKey is:
 * - View name for standard views ("today", "inbox")
 * - "task page_{id}" for project views
 */
import type { ViewMode, GroupBy } from '../types/view';
import type { View } from './selectors';

export const getViewKey = (view: View, taskPageId: string | null) => {
  if (view === 'taskPage' && taskPageId) {
    return `project_${taskPageId}`;
  }
  return view;
};

export const loadViewPreferences = (
  viewKey: string
): { viewMode: ViewMode; groupBy: GroupBy; showCompleted: boolean } => {
  if (typeof window === 'undefined')
    return { viewMode: 'list', groupBy: 'date', showCompleted: true };

  try {
    const saved = localStorage.getItem(`viewPrefs_${viewKey}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        viewMode: parsed.viewMode || 'list',
        groupBy: parsed.groupBy || 'date',
        showCompleted: parsed.showCompleted ?? true,
      };
    }
  } catch (e) {
    // ignore errors
  }
  return { viewMode: 'list', groupBy: 'date', showCompleted: true };
};

export const saveViewPreferences = (
  viewKey: string,
  viewMode: ViewMode,
  groupBy: GroupBy,
  showCompleted: boolean
) => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(
      `viewPrefs_${viewKey}`,
      JSON.stringify({ viewMode, groupBy, showCompleted })
    );
  } catch (e) {
    // ignore errors
  }
};
