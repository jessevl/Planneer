/**
 * @file index.ts
 * @description Barrel export for all Zustand stores
 * @app SHARED - Central state management exports
 * 
 * All stores are exported from here for easy imports:
 * import { useTasksStore, usePagesStore, useNavigationStore } from '@/stores';
 * 
 * Custom hooks for derived data (memoized):
 * - useTasks() - returns Task[] derived from normalized state
 * - usePages() - returns { pages, pageTree }
 * - useTaskCollections() - returns pages with viewMode='tasks' (replaces useProjects)
 * - useRecentPages(limit) - returns recent non-daily pages (optimized)
 * - usePageCount() - returns { total, pages, daily } counts
 * 
 * Combined selectors for use with useShallow:
 * - selectTaskState, selectTaskActions
 * - selectPageState, selectPageActions
 */

// Domain stores
export { 
  useTasksStore, 
  selectTasks, 
  selectTasksByPage,
  selectIncompleteTasks, 
  selectOverdueTasks, 
  selectTodayTasks,
  selectTaskState,
  selectTaskActions,
  useTasks,
} from './tasksStore';

// Pages store (unified - includes task collections)
export { 
  usePagesStore, 
  selectPages, 
  selectPageTree, 
  selectActivePage, 
  selectPageChildren, 
  selectPageAncestors, 
  selectDailyPages, 
  selectDailyPageByDate, 
  selectRootPages,
  selectTaskCollections,
  selectTaskCollectionSections,
  selectPageState,
  selectEditorState,
  selectPageActions,
  usePages,
  useTaskCollections,
  useRecentPages,
  usePageCount,
  useDailyPageDates,
} from './pagesStore';

// App state stores
export { useNavigationStore, getViewKey } from './navigationStore';
export { useUIStore, selectIsEditing, selectHasUnsavedChanges, selectIsNoteEditorFocused } from './uiStore';
export { useSettingsStore, type Theme, type ThemeVariant, type AccentColor } from './settingsStore';
export { 
  useSelectionStore, 
  selectHasSelection, 
  selectSelectionCount,
  type SelectableEntityType,
} from './selectionStore';

// Authentication store (PocketBase integration)
export { useAuthStore, setupAuthListener, type User } from './authStore';

// Workspace store (team-based multi-tenancy)
export {
  useWorkspaceStore,
  selectCurrentWorkspaceId,
  selectCurrentWorkspace,
  selectWorkspaces,
  selectIsWorkspaceOwner,
  selectIsWorkspaceAdmin,
  getCurrentWorkspaceId,
  getCurrentWorkspaceIdOrNull,
  type Workspace,
  type WorkspaceMember,
  type WorkspaceWithRole,
  type WorkspaceMemberRole,
} from './workspaceStore';

// Utility stores
export { useDeleteConfirmStore } from './deleteConfirmStore';
export { useConfirmStore, type ConfirmVariant } from './confirmStore';
export { usePomodoroStore } from './pomodoroStore';

// Sync store (offline-first)
export {
  useSyncStore,
  selectSyncStatus,
  selectSyncActions,
  computeSyncDisplayState,
  type SyncDisplayState,
  type SyncError,
} from './syncStore';

// Whisper AI store (voice transcription)
export {
  useWhisperStore,
  WHISPER_MODELS,
  getModelById,
  type WhisperModelId,
  type WhisperModel,
  type ModelDownloadProgress,
  type TranscriptChunk,
} from './whisperStore';
