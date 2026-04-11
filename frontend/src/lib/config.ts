/**
 * @file config.ts
 * @description Central configuration for app-wide settings
 * @app SHARED - Used across the application
 * 
 * All configurable limits, timeouts, and feature flags should be defined here
 * for easy adjustment during development and testing.
 */

// ============================================================================
// PAGINATION SETTINGS
// ============================================================================

/**
 * Pagination configuration for pages
 * 
 * To test lazy-loading, set USE_TEST_PAGE_SIZE to true and adjust TEST_PAGE_SIZE.
 * For production, set USE_TEST_PAGE_SIZE to false.
 */
const PAGES_USE_TEST_PAGE_SIZE = false;
const PAGES_DEFAULT_PAGE_SIZE = 1000;
const PAGES_TEST_PAGE_SIZE = 2;

export const PAGES_PAGINATION = {
  /** Default page size for paginated page fetches (All Pages view, Load More) */
  DEFAULT_PAGE_SIZE: PAGES_DEFAULT_PAGE_SIZE,
  
  /** Page size for testing lazy-loading */
  TEST_PAGE_SIZE: PAGES_TEST_PAGE_SIZE,
  
  /** Whether to use test page size */
  USE_TEST_PAGE_SIZE: PAGES_USE_TEST_PAGE_SIZE,
  
  /** Effective page size based on test mode (computed once at module load) */
  PAGE_SIZE: PAGES_USE_TEST_PAGE_SIZE ? PAGES_TEST_PAGE_SIZE : PAGES_DEFAULT_PAGE_SIZE,
  
  /** Max pages to show in HomeView recent section */
  HOME_RECENT_LIMIT: 3,
} as const;

/**
 * Pagination configuration for tasks
 */
export const TASKS_PAGINATION = {
  /** Default page size for task fetches */
  DEFAULT_PAGE_SIZE: 1000,
};

// ============================================================================
// AUTO-SAVE SETTINGS
// ============================================================================

export const AUTO_SAVE = {
  /** Debounce delay for auto-saving note content (ms) */
  DEBOUNCE_MS: 1000,
};

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
  
  /** Duration to show "reconnected" banner (ms) */
  RECONNECTED_BANNER_DURATION_MS: 3000,
  
  /** Delay before focus on mount (ms) - for animation settle */
  FOCUS_DELAY_MS: 50,
  
  /** Delay for mount animations (ms) */
  MOUNT_ANIMATION_DELAY_MS: 10,
  
  /** Duration for flash animations (e.g., date picker flash) (ms) */
  FLASH_ANIMATION_DURATION_MS: 600,
};

// ============================================================================
// CONNECTION & SYNC SETTINGS
// ============================================================================

export const CONNECTION = {
  /** How often to poll backend health check (ms). Default: 30 seconds */
  HEALTH_CHECK_POLL_INTERVAL_MS: 30000,
  
  /** Timeout for health check requests (ms) */
  HEALTH_CHECK_TIMEOUT_MS: 5000,
  
  /** Delay before sync engine processes queue (ms) - debounce rapid changes */
  SYNC_DEBOUNCE_MS: 100,
  
  /** Delay after pushing to server before clearing "syncing" flag (ms)
   * Prevents SSE echo from overwriting just-pushed data */
  SYNC_SSE_IGNORE_DELAY_MS: 500,
};

// ============================================================================
// RETRY SETTINGS
// ============================================================================

export const RETRY = {
  /** Maximum number of retry attempts for failed operations */
  MAX_RETRIES: 3,
  
  /** Initial delay between retries (ms) */
  INITIAL_DELAY_MS: 1000,
  
  /** Maximum delay between retries (ms) */
  MAX_DELAY_MS: 10000,
  
  /** Backoff multiplier for exponential backoff */
  BACKOFF_FACTOR: 2,
  
  /** Maximum backoff delay for sync queue operations (ms) */
  SYNC_QUEUE_MAX_BACKOFF_MS: 60000,
};

// ============================================================================
// VALIDATION SETTINGS
// ============================================================================

export const VALIDATION = {
  /** Delay before validating session on mount (ms) */
  SESSION_VALIDATION_DELAY_MS: 1000,
  
  /** Delay before validating workspace access (ms) */
  WORKSPACE_VALIDATION_DELAY_MS: 5000,
};

// ============================================================================
// SUBTASK SETTINGS
// ============================================================================

export const SUBTASKS = {
  /** Debounce delay for syncing subtask changes (ms) - batches rapid edits */
  SYNC_DELAY_MS: 500,
};

// ============================================================================
// OFFLINE STORAGE SETTINGS
// ============================================================================

export const OFFLINE_STORAGE = {
  /** Time after which cached note content is considered stale (ms) - 5 minutes */
  NOTE_CONTENT_STALE_AFTER_MS: 5 * 60 * 1000,
  
  /** Default note content retention options (days) */
  NOTE_CONTENT_RETENTION_OPTIONS: [0, 7, 14, 30] as const,
};

// ============================================================================
// UNSPLASH INTEGRATION
// ============================================================================

/**
 * Unsplash API configuration for cover image search
 * Set UNSPLASH_ACCESS_KEY in your environment to enable Unsplash integration
 * Get your access key from: https://unsplash.com/developers
 */
export const UNSPLASH_CONFIG = {
  /** Unsplash API base URL (now proxied through backend for security) */
  apiUrl: '/api/unsplash',
  
  /** Number of results per page */
  perPage: 12,
  
  /** Preferred image orientation for covers */
  orientation: 'landscape' as const,
} as const;

// ============================================================================
// IMAGE PROCESSING SETTINGS
// ============================================================================

export const IMAGE_PROCESSING = {
  /** Maximum dimension for full-size images (longest side) */
  MAX_IMAGE_SIZE: 2048,
  
  /** Maximum dimension for thumbnails */
  THUMBNAIL_SIZE: 512,
  
  /** Maximum file size before processing (10MB - will be resized down) */
  MAX_INPUT_FILE_SIZE: 10 * 1024 * 1024,
  
  /** Target file size after processing (5MB - PocketBase limit) */
  MAX_OUTPUT_FILE_SIZE: 5 * 1024 * 1024,
} as const;

// ============================================================================
// FORM VALIDATION SETTINGS
// ============================================================================

export const FORM_VALIDATION = {
  /** Maximum length for task titles */
  TASK_TITLE_MAX_LENGTH: 200,
  
  /** Maximum length for task descriptions */
  TASK_DESCRIPTION_MAX_LENGTH: 2000,
} as const;

// ============================================================================
// TOUCH & GESTURE SETTINGS
// ============================================================================

export const TOUCH_GESTURES = {
  /** Duration to trigger long press (ms) */
  LONG_PRESS_DURATION_MS: 500,
  
  /** Maximum movement before cancelling long press (px) */
  LONG_PRESS_MOVE_THRESHOLD_PX: 10,
} as const;

// ============================================================================
// SIDEBAR SETTINGS
// ============================================================================

export const SIDEBAR = {
  /** Default sidebar width (px) */
  DEFAULT_WIDTH_PX: 272,
  
  /** Minimum sidebar width (px) */
  MIN_WIDTH_PX: 200,
  
  /** Maximum sidebar width (px) */
  MAX_WIDTH_PX: 480,
} as const;

// ============================================================================
// EXTERNAL URLS
// ============================================================================

/**
 * Landing page URL
 * In production, the landing page is on a separate subdomain (planneer.app)
 * In development, we use the local /landing/ path
 */
export const LANDING_URL = import.meta.env.PROD 
  ? 'https://planneer.app' 
  : '/landing/';

// ============================================================================
// DEVELOPMENT LOGGING
// ============================================================================

/**
 * Check if running in development mode
 */
export const isDev = import.meta.env.DEV;

/**
 * Log only in development mode
 * Use for verbose debugging that shouldn't appear in production
 */
export function devLog(prefix: string, ...args: unknown[]): void {
  if (isDev) {
    console.log(prefix, ...args);
  }
}

/**
 * Warning log only in development mode
 */
export function devWarn(prefix: string, ...args: unknown[]): void {
  if (isDev) {
    console.warn(prefix, ...args);
  }
}
