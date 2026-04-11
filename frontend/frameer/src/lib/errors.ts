/**
 * @file errors.ts
 * @description Centralized error handling utilities for the application
 * @app SHARED - Error handling infrastructure
 *
 * Provides:
 * - Custom error classes for different error types
 * - Error classification (network, auth, validation, etc.)
 * - User-friendly error message extraction
 * - Error logging utilities
 */

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Categories of errors for UI handling
 */
export type ErrorCategory =
  | 'network'      // Network connectivity issues
  | 'auth'         // Authentication/authorization errors
  | 'validation'   // Input validation errors
  | 'not_found'    // Resource not found
  | 'conflict'     // Conflict (e.g., concurrent edits)
  | 'permission'   // Permission denied
  | 'server'       // Server-side errors
  | 'unknown';     // Unknown/unclassified errors

/**
 * Structured error info for UI display
 */
export interface ErrorInfo {
  category: ErrorCategory;
  message: string;
  details?: string;
  code?: string | number;
  retryable: boolean;
}

// ============================================================================
// CUSTOM ERROR CLASSES
// ============================================================================

/**
 * Base application error with structured info
 */
export class AppError extends Error {
  public readonly category: ErrorCategory;
  public readonly details?: string;
  public readonly code?: string | number;
  public readonly retryable: boolean;

  constructor(
    message: string,
    category: ErrorCategory = 'unknown',
    options?: {
      details?: string;
      code?: string | number;
      retryable?: boolean;
    }
  ) {
    super(message);
    this.name = 'AppError';
    this.category = category;
    this.details = options?.details;
    this.code = options?.code;
    this.retryable = options?.retryable ?? false;
  }

  toErrorInfo(): ErrorInfo {
    return {
      category: this.category,
      message: this.message,
      details: this.details,
      code: this.code,
      retryable: this.retryable,
    };
  }
}

/**
 * Network-related errors (offline, timeout, etc.)
 */
export class NetworkError extends AppError {
  constructor(message = 'Network connection failed', details?: string) {
    super(message, 'network', { details, retryable: true });
    this.name = 'NetworkError';
  }
}

/**
 * Authentication errors (invalid credentials, expired session)
 */
export class AuthError extends AppError {
  constructor(message = 'Authentication failed', code?: string | number) {
    super(message, 'auth', { code, retryable: false });
    this.name = 'AuthError';
  }
}

/**
 * Session expired error - special case of AuthError
 */
export class SessionExpiredError extends AuthError {
  constructor() {
    super('Your session has expired. Please sign in again.', 401);
    this.name = 'SessionExpiredError';
  }
}

/**
 * Workspace access errors (removed from workspace, workspace deleted)
 */
export class WorkspaceAccessError extends AppError {
  public readonly workspaceId?: string;

  constructor(message: string, workspaceId?: string) {
    super(message, 'permission', { retryable: false });
    this.name = 'WorkspaceAccessError';
    this.workspaceId = workspaceId;
  }
}

/**
 * Page content format errors (malformed/incompatible editor data)
 */
export class PageContentError extends AppError {
  constructor(message: string) {
    super(message, 'validation', { 
      retryable: false,
      details: 'The page content may have been created with an incompatible version of the app.',
    });
    this.name = 'PageContentError';
  }
}

/** @deprecated Use PageContentError */
export const NoteContentError = PageContentError;

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

/**
 * HTTP status code to error category mapping
 */
const STATUS_CODE_CATEGORIES: Record<number, ErrorCategory> = {
  0: 'network',
  400: 'validation',
  401: 'auth',
  403: 'permission',
  404: 'not_found',
  409: 'conflict',
  422: 'validation',
  429: 'network',
  500: 'server',
  502: 'server',
  503: 'server',
  504: 'network',
};

/**
 * Classify an error by its characteristics
 */
export function classifyError(error: unknown): ErrorCategory {
  if (error instanceof AppError) {
    return error.category;
  }

  if (error instanceof TypeError && error.message.includes('fetch')) {
    return 'network';
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Network errors
    if (
      message.includes('network') ||
      message.includes('offline') ||
      message.includes('failed to fetch') ||
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('autocancelled')
    ) {
      return 'network';
    }

    // Auth errors
    if (
      message.includes('unauthorized') ||
      message.includes('authentication') ||
      message.includes('token') ||
      message.includes('session')
    ) {
      return 'auth';
    }

    // Permission errors
    if (message.includes('forbidden') || message.includes('permission')) {
      return 'permission';
    }

    // Not found errors
    if (message.includes('not found') || message.includes('404')) {
      return 'not_found';
    }
  }

  // Check for PocketBase error structure
  if (isObjectWithProperty(error, 'status')) {
    const status = (error as { status: number }).status;
    if (STATUS_CODE_CATEGORIES[status]) {
      return STATUS_CODE_CATEGORIES[status];
    }
  }

  return 'unknown';
}

// ============================================================================
// ERROR MESSAGE EXTRACTION
// ============================================================================

/**
 * Default messages for error categories
 */
const DEFAULT_MESSAGES: Record<ErrorCategory, string> = {
  network: 'Unable to connect. Please check your internet connection.',
  auth: 'Authentication failed. Please sign in again.',
  validation: 'Please check your input and try again.',
  not_found: 'The requested item was not found.',
  conflict: 'This item was modified by someone else. Please refresh and try again.',
  permission: 'You don\'t have permission to perform this action.',
  server: 'Something went wrong on our end. Please try again later.',
  unknown: 'An unexpected error occurred.',
};

/**
 * Extract a user-friendly error message from any error
 */
export function getErrorMessage(error: unknown, fallback?: string): string {
  // Already a string
  if (typeof error === 'string') {
    return error;
  }

  // Handle session expiry specifically for better UX
  if (isSessionExpired(error)) {
    return DEFAULT_MESSAGES['auth'];
  }

  // AppError with message
  if (error instanceof AppError) {
    return error.message;
  }

  // Standard Error
  if (error instanceof Error) {
    // Don't expose technical messages to users
    const message = error.message;
    
    // Filter out technical error messages
    if (
      message.includes('fetch') ||
      message.includes('ECONNREFUSED') ||
      message.includes('autocancelled')
    ) {
      return DEFAULT_MESSAGES[classifyError(error)];
    }

    return message;
  }

  // PocketBase error with message
  if (isObjectWithProperty(error, 'message')) {
    return (error as { message: string }).message;
  }

  // PocketBase validation errors with data object
  if (isObjectWithProperty(error, 'data')) {
    const data = (error as { data: Record<string, { message?: string }> }).data;
    const fieldErrors = Object.entries(data)
      .filter(([, value]) => value?.message)
      .map(([, value]) => value.message);
    
    if (fieldErrors.length > 0) {
      return fieldErrors.join(' ');
    }
  }

  // Use fallback or category default
  if (fallback) {
    return fallback;
  }

  return DEFAULT_MESSAGES[classifyError(error)];
}

/**
 * Extract detailed error info for debugging/logging
 */
export function getErrorDetails(error: unknown): string | undefined {
  if (error instanceof AppError && error.details) {
    return error.details;
  }

  if (error instanceof Error) {
    // Include stack trace in development
    if (import.meta.env.DEV && error.stack) {
      return error.stack.split('\n').slice(0, 3).join('\n');
    }
    return error.message;
  }

  if (isObjectWithProperty(error, 'originalError')) {
    return getErrorDetails((error as { originalError: unknown }).originalError);
  }

  return undefined;
}

/**
 * Convert any error to structured ErrorInfo
 */
export function toErrorInfo(error: unknown): ErrorInfo {
  if (error instanceof AppError) {
    return error.toErrorInfo();
  }

  const category = classifyError(error);

  return {
    category,
    message: getErrorMessage(error),
    details: getErrorDetails(error),
    retryable: category === 'network' || category === 'server',
  };
}

// ============================================================================
// ERROR CHECKING UTILITIES
// ============================================================================

/**
 * Check if error indicates session expiry
 */
export function isSessionExpired(error: unknown): boolean {
  if (error instanceof SessionExpiredError) {
    return true;
  }

  if (isObjectWithProperty(error, 'status')) {
    const status = (error as { status: number }).status;
    
    // 401 is standard Unauthorized
    if (status === 401) {
      return true;
    }

    // 403 is Forbidden. In PocketBase, this can mean:
    // 1. Token is expired/invalid and guest access is denied by API rules
    // 2. User is authenticated but doesn't have permission for this specific record
    // We only treat it as session expired if the message suggests an auth issue.
    if (status === 403 && isObjectWithProperty(error, 'message')) {
      const msg = (error as { message: string }).message.toLowerCase();
      if (
        msg.includes('invalid') || 
        msg.includes('expired') || 
        msg.includes('authorization') ||
        msg.includes('token')
      ) {
        return true;
      }
    }

    return false;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('token is expired') ||
      message.includes('session expired') ||
      message.includes('invalid or expired')
    );
  }

  return false;
}

/**
 * Check if error is due to network connectivity
 */
export function isNetworkError(error: unknown): boolean {
  return classifyError(error) === 'network';
}

/**
 * Check if error is retryable
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.retryable;
  }
  
  const category = classifyError(error);
  return category === 'network' || category === 'server';
}

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

/**
 * Log an error with context
 */
export function logError(
  error: unknown,
  context?: string,
  extra?: Record<string, unknown>
): void {
  const info = toErrorInfo(error);
  const prefix = context ? `[${context}]` : '[Error]';

  // In production, you might send this to an error tracking service
  console.error(prefix, {
    category: info.category,
    message: info.message,
    details: info.details,
    ...extra,
  });

  // Log the original error in development
  if (import.meta.env.DEV) {
    console.error('Original error:', error);
  }
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

function isObjectWithProperty<K extends string>(
  value: unknown,
  key: K
): value is Record<K, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    key in value
  );
}
