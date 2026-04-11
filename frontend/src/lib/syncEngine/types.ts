/**
 * @file syncEngine/types.ts
 * @description Type definitions for the sync engine
 */

import type { Task } from '@/types/task';
import type { Page } from '@/types/page';

// ============================================================================
// SYNC STATE
// ============================================================================

export interface SyncEngineState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: number | null;
  errors: SyncError[];
}

export interface SyncError {
  operation: string;
  message: string;
  timestamp: number;
  recordId?: string;
}

// ============================================================================
// EVENTS
// ============================================================================

export type SyncEventType =
  | 'online'
  | 'offline'
  | 'sync-start'
  | 'sync-complete'
  | 'sync-error'
  | 'pending-change'
  | 'remote-change'
  | 'data-loaded'           // Fired when initial data load completes
  | 'tasks-changed'         // Fired when tasks data changes (local or remote)
  | 'pages-changed';        // Fired when pages data changes (local or remote)

export interface SyncEvent {
  type: SyncEventType;
  data?: unknown;
}

export type SyncEventListener = (event: SyncEvent) => void;

// ============================================================================
// DATA CHANGE EVENTS
// ============================================================================

/**
 * Data change event payload for store updates.
 */
export interface DataChangeEvent<T> {
  action: 'create' | 'update' | 'delete' | 'bulk-load';
  record?: T;
  records?: T[];
  recordId?: string;
}

// ============================================================================
// OPERATION TYPES
// ============================================================================

export type OperationType = 'create' | 'update' | 'delete';

// ============================================================================
// LOAD RESULT
// ============================================================================

export interface LoadInitialDataResult {
  tasks: Task[];
  pages: Page[];
  fromCache: boolean;
  pagesPagination?: { hasMore: boolean; totalItems: number };
}

/**
 * Options for loadInitialData
 */
export interface LoadInitialDataOptions {
  /** Force a full refresh, ignoring delta sync. Used for PWA resume. */
  forceFullRefresh?: boolean;
}

// ============================================================================
// PAGES PAGINATION
// ============================================================================

export interface PagesPaginationResult {
  pages: Page[];
  hasMore: boolean;
  totalItems: number;
}
