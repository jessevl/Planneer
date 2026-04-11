/**
 * @file syncStore.ts
 * @description Zustand store for sync state management
 * @app SHARED - Provides sync status to UI components
 *
 * Tracks:
 * - Online/offline status
 * - Sync progress
 * - Pending operation count
 * - Sync errors
 *
 * Integrates with syncEngine to:
 * - Reflect current sync state
 * - Route data change events to domain stores
 * - Handle initial data loading through sync engine
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { syncEngine, initializeSyncEngine, type SyncEvent, type DataChangeEvent } from '@/lib/syncEngine/index';
import { getPendingCount } from '@/lib/offlineDb';
import { getCurrentWorkspaceIdOrNull } from '@/stores/workspaceStore';
import { useTasksStore } from './tasksStore';
import { usePagesStore } from './pagesStore';
import type { Task } from '@/types/task';
import type { Page } from '@/types/page';

// ============================================================================
// TYPES
// ============================================================================

export interface SyncError {
  id: string;
  message: string;
  operation?: string;
  recordId?: string;
  timestamp: number;
}

interface SyncState {
  // Connection state
  isOnline: boolean;
  isBackendAvailable: boolean;

  // Sync state
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: number | null;

  // Errors
  errors: SyncError[];
  maxErrors: number;

  // Initialization
  isInitialized: boolean;
  isDataLoaded: boolean;

  // Actions
  initialize: () => Promise<void>;
  /** Load initial data through sync engine (IndexedDB first, then server) */
  loadInitialData: (workspaceId: string) => Promise<{ fromCache: boolean }>;
  /** Start realtime sync (SSE subscriptions) */
  startRealtimeSync: () => void;
  /** Stop realtime sync */
  stopRealtimeSync: () => void;
  shutdown: () => void;
  setOnline: (online: boolean) => void;
  setBackendAvailable: (available: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setPendingCount: (count: number) => void;
  updatePendingCount: () => Promise<void>;
  setLastSyncAt: (timestamp: number) => void;
  addError: (error: Omit<SyncError, 'id' | 'timestamp'>) => void;
  clearErrors: () => void;
  dismissError: (id: string) => void;
  triggerSync: () => Promise<void>;
}

// ============================================================================
// STORE
// ============================================================================

export const useSyncStore = create<SyncState>()(
  devtools(
    (set, get) => ({
      // Initial state
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isBackendAvailable: true,
      isSyncing: false,
      pendingCount: 0,
      lastSyncAt: null,
      errors: [],
      maxErrors: 10,
      isInitialized: false,
      isDataLoaded: false,

      // Initialize sync engine and subscribe to events
      initialize: async () => {
        if (get().isInitialized) return;

        // Initialize the sync engine
        await initializeSyncEngine();

        // Subscribe to sync events
        syncEngine.subscribe((event: SyncEvent) => {
          switch (event.type) {
            case 'online':
              set({ isOnline: true }, false, 'sync/online');
              break;
            case 'offline':
              set({ isOnline: false }, false, 'sync/offline');
              break;
            case 'sync-start':
              set({ isSyncing: true }, false, 'sync/start');
              break;
            case 'sync-complete': {
              const data = event.data as { pendingCount: number } | undefined;
              // pendingCount of -1 means "don't update" (used for SSE receives)
              const newState: Partial<SyncState> = {
                isSyncing: false,
                lastSyncAt: Date.now(),
              };
              if (data?.pendingCount !== undefined && data.pendingCount >= 0) {
                newState.pendingCount = data.pendingCount;
              }
              set(newState, false, 'sync/complete');
              break;
            }
            case 'sync-error': {
              const errorData = event.data as { message: string; operation?: string; recordId?: string } | undefined;
              if (errorData) {
                get().addError(errorData);
              }
              set({ isSyncing: false }, false, 'sync/error');
              break;
            }
            case 'pending-change':
              get().updatePendingCount();
              break;
            case 'data-loaded':
              // Initial data load complete - handled by __root.tsx
              break;
              
            // Route data change events to appropriate stores
            case 'tasks-changed': {
              const taskEvent = event.data as DataChangeEvent<Task>;
              if (taskEvent.action === 'bulk-load' && taskEvent.records) {
                useTasksStore.getState().applyBulkLoad(taskEvent.records);
              } else {
                useTasksStore.getState().applyRemoteChange(taskEvent);
              }
              break;
            }
            case 'pages-changed': {
              const pageEvent = event.data as DataChangeEvent<Page> & { pagination?: { hasMore: boolean; totalItems: number } };
              if (pageEvent.action === 'bulk-load' && pageEvent.records) {
                usePagesStore.getState().applyBulkLoad(pageEvent.records, pageEvent.pagination);
              } else {
                usePagesStore.getState().applyRemoteChange(pageEvent);
              }
              break;
            }
            case 'remote-change':
              // Legacy event - no longer used
              break;
          }
        });

        // Get initial pending count for current workspace
        const workspaceId = getCurrentWorkspaceIdOrNull();
        const pendingCount = await getPendingCount(workspaceId || undefined);
        set({ isInitialized: true, pendingCount }, false, 'sync/initialized');
      },

      // Load initial data through sync engine
      loadInitialData: async (workspaceId) => {
        // Set loading state on stores
        useTasksStore.getState().setLoading(true);
        usePagesStore.getState().setLoading(true);

        try {
          // Load data through sync engine (IndexedDB first, then server)
          const result = await syncEngine.loadInitialData(workspaceId);
          set({ isDataLoaded: true }, false, 'sync/dataLoaded');
          return { fromCache: result.fromCache };
        } catch (error) {
          // Reset loading state on error
          useTasksStore.getState().setLoading(false);
          usePagesStore.getState().setLoading(false);
          throw error;
        }
      },

      // Start realtime sync (SSE subscriptions)
      startRealtimeSync: () => {
        syncEngine.startRealtimeSync();
      },

      // Stop realtime sync
      stopRealtimeSync: () => {
        syncEngine.stopRealtimeSync();
      },

      setOnline: (online) => set({ isOnline: online }, false, 'sync/setOnline'),

      setBackendAvailable: (available) =>
        set({ isBackendAvailable: available }, false, 'sync/setBackendAvailable'),

      setSyncing: (syncing) => set({ isSyncing: syncing }, false, 'sync/setSyncing'),

      setPendingCount: (count) => set({ pendingCount: count }, false, 'sync/setPendingCount'),

      updatePendingCount: async () => {
        const workspaceId = getCurrentWorkspaceIdOrNull();
        const count = await getPendingCount(workspaceId || undefined);
        set({ pendingCount: count }, false, 'sync/updatePendingCount');
      },

      setLastSyncAt: (timestamp) => set({ lastSyncAt: timestamp }, false, 'sync/setLastSyncAt'),

      addError: (error) => {
        const { errors, maxErrors } = get();
        const newError: SyncError = {
          ...error,
          id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: Date.now(),
        };

        // Keep only the most recent errors
        const updatedErrors = [newError, ...errors].slice(0, maxErrors);
        set({ errors: updatedErrors }, false, 'sync/addError');
      },

      clearErrors: () => set({ errors: [] }, false, 'sync/clearErrors'),

      dismissError: (id) => {
        const { errors } = get();
        set(
          { errors: errors.filter((e) => e.id !== id) },
          false,
          'sync/dismissError'
        );
      },

      triggerSync: async () => {
        const { isOnline, isSyncing } = get();
        if (!isOnline || isSyncing) return;

        try {
          const workspaceId = getCurrentWorkspaceIdOrNull();
          await syncEngine.forceSync(workspaceId || undefined);
        } catch (error) {
          console.error('[syncStore] Sync failed:', error);
        }
      },

      shutdown: () => {
        syncEngine.stopRealtimeSync();
        syncEngine.destroy();
        set({ isInitialized: false, isDataLoaded: false }, false, 'sync/shutdown');
      },
    }),
    { name: 'SyncStore' }
  )
);

// ============================================================================
// SELECTORS
// ============================================================================

/**
 * Select sync status for display.
 */
export const selectSyncStatus = (state: SyncState) => ({
  isOnline: state.isOnline,
  isBackendAvailable: state.isBackendAvailable,
  isSyncing: state.isSyncing,
  pendingCount: state.pendingCount,
  lastSyncAt: state.lastSyncAt,
  hasErrors: state.errors.length > 0,
});

/**
 * Select sync actions.
 */
export const selectSyncActions = (state: SyncState) => ({
  triggerSync: state.triggerSync,
  clearErrors: state.clearErrors,
  dismissError: state.dismissError,
});

/**
 * Compute overall sync state for UI.
 */
export type SyncDisplayState = 'synced' | 'syncing' | 'pending' | 'offline' | 'error';

export function computeSyncDisplayState(state: SyncState): SyncDisplayState {
  if (!state.isOnline) return 'offline';
  if (state.errors.length > 0) return 'error';
  if (state.isSyncing) return 'syncing';
  if (state.pendingCount > 0) return 'pending';
  return 'synced';
}
