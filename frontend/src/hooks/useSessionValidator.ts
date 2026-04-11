/**
 * @file useSessionValidator.ts
 * @description Hook for validating auth session and handling expiry
 * @app SHARED - Session management
 *
 * Provides:
 * - Periodic session token validation
 * - Auto-refresh of auth token (if supported)
 * - Session expiry detection and handling
 * - Auth state recovery after app sleep/background
 */

import { useEffect, useRef, useCallback } from 'react';
import { pb, isAuthenticated, getCurrentUserId } from '@/lib/pocketbase';
import { useAuthStore } from '@/stores/authStore';
import { isSessionExpired, isNetworkError, logError } from '@/lib/errors';
import { VALIDATION } from '@/lib/config';

/**
 * Parse the expiration time from a PocketBase JWT token.
 * Returns the expiry timestamp in milliseconds, or 0 if parsing fails.
 */
function getTokenExpiryMs(token: string): number {
  try {
    if (!token) return 0;
    const parts = token.split('.');
    if (parts.length !== 3) return 0;
    const payload = JSON.parse(atob(parts[1]));
    if (typeof payload.exp === 'number') {
      return payload.exp * 1000; // Convert seconds to milliseconds
    }
    return 0;
  } catch {
    return 0;
  }
}

/** Refresh the token if it will expire within this many milliseconds (default: 2 days) */
const PROACTIVE_REFRESH_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000;

interface UseSessionValidatorOptions {
  /** How often to validate session (ms). Default: 60000 (1 min) */
  validationInterval?: number;
  /** Callback when session is invalid/expired */
  onSessionExpired?: () => void;
  /** Callback when session is refreshed successfully */
  onSessionRefreshed?: () => void;
}

/**
 * Validate and maintain auth session
 * 
 * This hook:
 * 1. Validates the session periodically
 * 2. Attempts to refresh tokens before expiry
 * 3. Detects and handles session expiry
 * 4. Re-validates when app returns from background
 * 
 * @example
 * useSessionValidator({
 *   onSessionExpired: () => navigate('/login'),
 * });
 */
export function useSessionValidator(options: UseSessionValidatorOptions = {}): void {
  const {
    validationInterval = 60000, // 1 minute
    onSessionExpired,
    onSessionRefreshed,
  } = options;

  const lastValidatedAt = useAuthStore((s) => s.lastValidatedAt);
  const lastValidationRef = useRef<number>(0);
  const onSessionExpiredRef = useRef(onSessionExpired);
  const onSessionRefreshedRef = useRef(onSessionRefreshed);
  
  // Keep refs updated
  onSessionExpiredRef.current = onSessionExpired;
  onSessionRefreshedRef.current = onSessionRefreshed;

  /**
   * Check if the auth token needs proactive refresh (approaching expiry).
   * Returns true if the token exists but will expire within PROACTIVE_REFRESH_THRESHOLD_MS.
   */
  const tokenNeedsRefresh = useCallback((): boolean => {
    const token = pb.authStore.token;
    if (!token) return false;
    const expiryMs = getTokenExpiryMs(token);
    if (expiryMs === 0) return false;
    return (expiryMs - Date.now()) < PROACTIVE_REFRESH_THRESHOLD_MS;
  }, []);

  /**
   * Check if the auth token has already expired (locally, by parsing JWT exp).
   * pb.authStore.isValid does this too, but we use this for explicit checks.
   */
  const isTokenExpired = useCallback((): boolean => {
    const token = pb.authStore.token;
    if (!token) return true;
    const expiryMs = getTokenExpiryMs(token);
    if (expiryMs === 0) return true;
    return Date.now() >= expiryMs;
  }, []);

  /**
   * Validate current session by checking token and user data
   */
  const validateSession = useCallback(async (): Promise<boolean> => {
    // If there's no token at all, session is invalid
    if (!pb.authStore.token) {
      return false;
    }

    // If the token has expired locally, skip the API call
    // (the server will reject it anyway, and afterSend would clear authStore)
    if (isTokenExpired()) {
      return false;
    }

    // If we just validated (e.g. during app init), skip this check
    const now = Date.now();
    const timeSinceLastValidation = now - Math.max(lastValidationRef.current, lastValidatedAt);
    if (timeSinceLastValidation < validationInterval / 2) {
      return true;
    }

    try {
      // Try to fetch current user to validate token
      const userId = getCurrentUserId();
      if (!userId) {
        return false;
      }

      // This will throw if token is invalid
      await pb.collection('users').getOne(userId);
      lastValidationRef.current = Date.now();
      
      return true;
    } catch (error) {
      if (isSessionExpired(error)) {
        logError(error, 'SessionValidator', { action: 'validateSession' });
        return false;
      }
      
      // OFFLINE SUPPORT: If it's a network error, assume session is still valid
      if (isNetworkError(error)) {
        return true;
      }

      // Other errors - don't invalidate session but log it
      console.warn('[SessionValidator] Validation failed:', error);
      return true;
    }
  }, [isTokenExpired]);

  /**
   * Attempt to refresh the auth token.
   * Note: We check for token presence (not isAuthenticated/isValid) because
   * an expired JWT will cause isValid to return false, but authRefresh
   * may still work on the server if the token is recently expired.
   */
  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (!pb.authStore.token) {
      return false;
    }

    try {
      // PocketBase's authRefresh will refresh the token if valid
      await pb.collection('users').authRefresh();
      onSessionRefreshedRef.current?.();
      return true;
    } catch (error) {
      if (isSessionExpired(error)) {
        return false;
      }
      
      // OFFLINE SUPPORT: If it's a network error, just skip refresh
      if (isNetworkError(error)) {
        return true;
      }

      return false;
    }
  }, []);

  /**
   * Handle detected session expiry.
   * 
   * IMPORTANT: Notify parent BEFORE clearing auth state.
   * This ensures the session expired modal shows up before user is set to null,
   * which would otherwise trigger the "user became null → go to login" transition.
   */
  const handleSessionExpired = useCallback(async () => {
    // Notify parent first (shows session expired modal)
    onSessionExpiredRef.current?.();
    // Don't logout here - let the modal's "Sign In" button handle it.
    // The modal shows a "Reconnect" option that attempts authRefresh first.
  }, []);

  /**
   * Full validation with proactive refresh and recovery
   */
  const fullValidation = useCallback(async () => {
    try {
      // Step 1: Proactively refresh token if it's approaching expiry
      // This prevents most session expirations from ever happening
      if (tokenNeedsRefresh()) {
        console.info('[SessionValidator] Token approaching expiry, refreshing proactively');
        const refreshed = await refreshSession();
        if (refreshed) {
          lastValidationRef.current = Date.now();
          return; // Token refreshed, no further validation needed
        }
        // Refresh failed - continue to validation to determine state
      }

      const isValid = await validateSession();
      
      if (!isValid) {
        // Token is expired or invalid. Check if we have a token to attempt refresh with.
        // Note: Don't rely on isAuthenticated() here because pb.authStore.isValid
        // checks JWT exp locally and returns false for expired tokens, even though
        // the token string still exists and authRefresh might still work on the server.
        const hasToken = !!pb.authStore.token;
        
        if (hasToken) {
          // Try to refresh - PocketBase may accept a recently-expired token
          const refreshed = await refreshSession();
          if (refreshed) {
            console.info('[SessionValidator] Token refreshed after validation failure');
            return;
          }
        }

        // Session is truly expired and unrecoverable
        handleSessionExpired();
      }
    } catch (error) {
      // Network errors - log but don't invalidate
      logError(error, 'SessionValidator', { action: 'fullValidation' });
    }
  }, [tokenNeedsRefresh, validateSession, refreshSession, handleSessionExpired]);

  // Periodic validation
  useEffect(() => {
    if (!isAuthenticated()) return;

    // Initial validation (slightly delayed to avoid startup race)
    const timeoutId = setTimeout(fullValidation, VALIDATION.SESSION_VALIDATION_DELAY_MS);

    // Set up interval
    const intervalId = setInterval(fullValidation, validationInterval);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [fullValidation, validationInterval]);

  // Validate when window regains focus (app wakes from background)
  useEffect(() => {
    const handleFocus = () => {
      // Only re-validate if enough time has passed
      const timeSinceLastValidation = Date.now() - lastValidationRef.current;
      if (timeSinceLastValidation > validationInterval / 2) {
        fullValidation();
      }
    };

    // Also validate when page becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleFocus();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fullValidation, validationInterval]);
}

/**
 * Hook to check if session is still valid (one-time check)
 * Useful for protecting routes or actions
 */
export function useIsSessionValid(): boolean {
  const user = useAuthStore((s) => s.user);
  return isAuthenticated() && user !== null;
}
