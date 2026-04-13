/**
 * @file hooks/index.ts
 * @description Barrel exports for custom hooks
 */

// Auto-save
export { useAutoSave } from './useAutoSave';

// Click outside detection
export { default as useClickOutside } from './useClickOutside';

// Connection status monitoring
export { useConnectionStatus, useIsConnected, type ConnectionState } from './useConnectionStatus';

// Context menu hooks
export { usePageContextMenu, buildPageMenuItems } from './usePageContextMenu';
export type { BuildPageMenuItemsConfig } from './usePageContextMenu';
export { useTaskContextMenu } from './useTaskContextMenu';

// Drag and drop
export { useDragAndDrop } from './useDragAndDrop';
export { useTreeDragAndDrop } from './useTreeDragAndDrop';

// Hydration state
export { useHydration } from './useHydration';

// Navigation
export { useRouterNavigation } from './useRouterNavigation';

// Search
export { useSearch } from './useSearch';
export { useLocalSearch, type LocalSearchOptions, type LocalSearchResults } from './useLocalSearch';

// Command Palette
export { 
  useCommandPaletteStore, 
  useCommandPaletteShortcut,
  openCommandPalette,
  closeCommandPalette,
  toggleCommandPalette,
} from './useCommandPalette';

// Session validation
export { useSessionValidator, useIsSessionValid } from './useSessionValidator';

// Workspace access
export { useWorkspaceAccess, useHasWorkspaceAccess } from './useWorkspaceAccess';

// PWA / Service Worker
export { usePWA, type PWAState } from './usePWA';

// Responsive / Mobile detection
export {
  useMediaQuery,
  useIsMobile,
  useIsTablet,
  useIsPhoneDevice,
  useIsTabletDevice,
  useIsDesktop,
  useIsLandscapeOrientation,
  useIsTouch,
  useIsMouse,
  useIsStandalone,
  usePrefersReducedMotion,
  useResponsive,
  useResponsiveValue,
  useSidebarState,
  useKeyboardVisibility,
  BREAKPOINTS,
  type ResponsiveState,
} from '@frameer/hooks/useMobileDetection';

// Mobile gestures
export {
  useSwipeActions,
  SwipeActionBackground,
  type SwipeActionsOptions,
  type SwipeState,
  type SwipeActionsResult,
} from './useSwipeActions';

export {
  useLongPress,
  type LongPressOptions,
  type LongPressResult,
} from './useLongPress';

// Page operations (unified delete, migration, properties modal)
export {
  usePageOperations,
  getPageLabel,
  getPageLabelPlural,
  type PageDeleteOptions,
  type PageModeChangeOptions,
  type UsePageOperationsResult,
} from './usePageOperations';
