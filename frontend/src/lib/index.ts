/**
 * @file lib/index.ts
 * @description Library utilities exports
 * 
 * Re-exports commonly used utilities for convenient imports.
 */

// ============================================================================
// OFFLINE SYNC EXPORTS
// ============================================================================

// CRDT utilities
export {
  type HLCTimestamp,
  type CRDTMetadata,
  type SyncStatus,
  HybridLogicalClock,
  compareHLC,
  isHLCGreater,
  maxHLC,
  serializeHLC,
  deserializeHLC,
  getHLC,
  tick,
  receive,
  mergeRecords,
  mergeYooptaContent,
  detectChangedBlocks,
  TASK_CRDT_FIELDS,
  PAGE_CRDT_FIELDS,
} from './crdt';

// Offline database
export {
  offlineDb,
  type OfflineTask,
  type OfflinePage,
  type SyncOperation,
  type SyncCollection,
  getPendingOperations,
  getPendingCount,
  loadHLCState,
  saveHLCState,
  clearWorkspaceData,
  clearAllOfflineData,
  getDbStats,
} from './offlineDb';

// Sync engine
export {
  syncEngine,
  initializeSyncEngine,
  type SyncEngineState,
  type SyncError,
  type SyncEvent,
  type SyncEventType,
} from './syncEngine';

// Sync adapters (offline-first wrappers)
export {
  // Task adapters
  offlineCreateTask,
  offlineUpdateTask,
  offlineDeleteTask,
  loadOfflineTasks,
  type CreateTaskInput,
  
  // Page adapters
  offlineCreatePage,
  offlineUpdatePage,
  offlineDeletePage,
  loadOfflinePages,
  
  // Helpers
  isSyncReady,
  syncLocalWithServer,
} from './syncAdapter';

// Icon utilities for consistent styling
export {
  ICON_STROKE_WIDTH,
  ICON_SIZES,
  ICON_SIZE_CLASSES,
  type IconSize,
  getIconProps,
  getIconSize,
  getIconSizeClass,
  iconDefaults,
  iconContextProps,
} from './iconUtils';

// Haptic feedback utilities
export {
  haptic,
  hapticTaskComplete,
  hapticLongPress,
  hapticDragStart,
  hapticDragDrop,
  hapticSelection,
} from './haptics';

