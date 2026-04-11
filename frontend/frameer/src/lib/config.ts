/**
 * @file config.ts
 * @description Central configuration for Frameer framework
 * 
 * All configurable limits, timeouts, and feature flags should be defined here
 * for easy adjustment during development and testing.
 */

// ============================================================================
// UI SETTINGS
// ============================================================================

export const UI = {
  /** Debounce delay for search input (ms) */
  SEARCH_DEBOUNCE_MS: 300,
  
  /** Animation duration for transitions (ms) */
  ANIMATION_DURATION_MS: 200,
  
  /** Duration to show success messages (ms) */
  SUCCESS_MESSAGE_DURATION_MS: 2000,
  
  /** Delay before focus on mount (ms) - for animation settle */
  FOCUS_DELAY_MS: 50,
  
  /** Delay for mount animations (ms) */
  MOUNT_ANIMATION_DELAY_MS: 10,
  
  /** Duration for flash animations (e.g., date picker flash) (ms) */
  FLASH_ANIMATION_DURATION_MS: 600,
};

// ============================================================================
// TOUCH GESTURE SETTINGS
// ============================================================================

export const TOUCH_GESTURES = {
  /** Duration for long press gesture detection (ms) */
  LONG_PRESS_DURATION_MS: 500,
  
  /** Maximum movement (px) before long press is cancelled */
  LONG_PRESS_MOVE_THRESHOLD_PX: 10,
  
  /** Minimum swipe distance to trigger action (px) */
  SWIPE_THRESHOLD_PX: 50,
};

// ============================================================================
// AUTO-SAVE SETTINGS
// ============================================================================

export const AUTO_SAVE = {
  /** Debounce delay for auto-saving content (ms) */
  DEBOUNCE_MS: 1000,
};

// ============================================================================
// APP CONFIGURATION
// ============================================================================

/**
 * App-specific configuration. Override these values in your application
 * to customize Frameer's behavior.
 */
export const APP_CONFIG = {
  /** App name used as prefix for localStorage keys to avoid conflicts */
  storagePrefix: 'frameer',
};

/**
 * Configure the app-specific settings for Frameer.
 * Call this early in your app initialization.
 * 
 * @example
 * import { configureFrameer } from '@frameer/lib/config';
 * configureFrameer({ storagePrefix: 'myapp' });
 */
export function configureFrameer(config: Partial<typeof APP_CONFIG>) {
  Object.assign(APP_CONFIG, config);
}
