/**
 * @file syncEngine.ts
 * @description Re-exports from the modular syncEngine
 * 
 * This file maintains backward compatibility with existing imports.
 * The actual implementation is now in the syncEngine/ directory.
 */

export {
  // Main singleton and initializer
  syncEngine,
  initializeSyncEngine,
  
  // Types
  type SyncEngineState,
  type SyncError,
  type SyncEventType,
  type SyncEvent,
  type SyncEventListener,
  type DataChangeEvent,
  type LoadInitialDataResult,
  type PagesPaginationResult,
  type DownloadProgressCallback,
} from './syncEngine/index';
