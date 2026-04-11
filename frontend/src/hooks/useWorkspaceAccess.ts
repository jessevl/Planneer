/**
 * @file useWorkspaceAccess.ts
 * @description Hook for checking and validating workspace access
 * @app WORKSPACE - Access validation
 *
 * Provides:
 * - Real-time workspace access validation
 * - Detection of removal from workspace
 * - Detection of workspace deletion
 * - Subscription to workspace membership changes
 */

import { useEffect, useCallback, useRef } from 'react';
import { pb, isAuthenticated, safeFilter } from '@/lib/pocketbase';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAuthStore } from '@/stores/authStore';
import { isSessionExpired, logError } from '@/lib/errors';
import { VALIDATION } from '@/lib/config';

/** Default interval for periodic workspace access validation (15 minutes) */
const DEFAULT_VALIDATION_INTERVAL_MS = 15 * 60 * 1000;

interface UseWorkspaceAccessOptions {
  /** Callback when user is removed from current workspace */
  onAccessLost?: (reason: 'removed' | 'deleted') => void;
  /** How often to validate access (ms). Default: 15 minutes */
  validationInterval?: number;
  /** Whether to enable validation. Default: true */
  enabled?: boolean;
}

/**
 * Monitor and validate workspace access
 * 
 * This hook:
 * 1. Validates workspace membership periodically
 * 2. Subscribes to workspace_members for real-time removal detection
 * 3. Subscribes to workspaces for deletion detection
 * 4. Calls callback when access is lost
 */
export function useWorkspaceAccess(options: UseWorkspaceAccessOptions = {}): void {
  const {
    onAccessLost,
    validationInterval = DEFAULT_VALIDATION_INTERVAL_MS,
    enabled = true,
  } = options;

  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const user = useAuthStore((s) => s.user);
  const lastValidationRef = useRef<number>(0);
  
  const onAccessLostRef = useRef(onAccessLost);
  onAccessLostRef.current = onAccessLost;

  /**
   * Check if current user still has access to current workspace
   */
  const validateAccess = useCallback(async (): Promise<boolean> => {
    if (!currentWorkspaceId || !user) return true;

    // CRITICAL: Check if auth token is still valid before making the API call.
    // If the token is expired, PocketBase API rules silently filter results
    // (returning 0 items instead of 401), which would be falsely interpreted
    // as "user removed from workspace". Let the session validator handle
    // expired tokens instead.
    if (!isAuthenticated()) {
      console.info('[useWorkspaceAccess] Skipping validation - auth token invalid/expired');
      return true; // Don't report workspace error; session validator will handle auth
    }

    // If we just validated, skip this check
    const now = Date.now();
    if (now - lastValidationRef.current < validationInterval / 2) {
      return true;
    }

    try {
      // Check membership
      const memberships = await pb.collection('workspace_members').getList(1, 1, {
        filter: safeFilter('workspace = {:workspaceId} && user = {:userId}', {
          workspaceId: currentWorkspaceId,
          userId: user.id,
        }),
      });

      lastValidationRef.current = Date.now();

      if (memberships.totalItems === 0) {
        // Double-check that auth is still valid after the request.
        // An expired token could have caused PocketBase to return 0 results
        // (API rules filter silently for unauthenticated requests).
        if (!isAuthenticated()) {
          console.info('[useWorkspaceAccess] Auth became invalid during check, deferring to session validator');
          return true; // Not a workspace issue, it's an auth issue
        }
        // No membership found - user was truly removed
        onAccessLostRef.current?.('removed');
        return false;
      }

      return true;
    } catch (error) {
      // Check if this is actually a session expiry masquerading as an access error
      if (isSessionExpired(error)) {
        console.info('[useWorkspaceAccess] Session expired during access check, deferring to session validator');
        return true; // Not a workspace issue, it's an auth issue
      }
      // Check if workspace was deleted (404)
      if (isNotFoundError(error)) {
        onAccessLostRef.current?.('deleted');
        return false;
      }
      
      // Network errors - don't invalidate
      logError(error, 'useWorkspaceAccess', { action: 'validateAccess' });
      return true;
    }
  }, [currentWorkspaceId, user]);

  // Periodic validation
  useEffect(() => {
    if (!enabled || !currentWorkspaceId || !user) return;

    // Initial validation (delayed)
    const timeoutId = setTimeout(validateAccess, VALIDATION.WORKSPACE_VALIDATION_DELAY_MS);

    // Set up interval
    const intervalId = setInterval(validateAccess, validationInterval);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [enabled, currentWorkspaceId, user, validateAccess, validationInterval]);

  // Subscribe to workspace_members changes for real-time removal detection
  useEffect(() => {
    if (!enabled || !currentWorkspaceId || !user) return;

    let unsubscribe: (() => void) | undefined;

    const subscribe = async () => {
      try {
        // Subscribe to membership changes for this workspace
        await pb.collection('workspace_members').subscribe('*', (e) => {
          // Check if this event affects current user's membership
          const record = e.record as { user?: string; workspace?: string };
          
          if (record.workspace === currentWorkspaceId && record.user === user.id) {
            if (e.action === 'delete') {
              // User's membership was deleted
              onAccessLostRef.current?.('removed');
            }
          }
        });

        unsubscribe = () => {
          try {
            // Only attempt to unsubscribe if we still have a valid auth state
            // to avoid "authorization don't match" errors from PocketBase
            if (pb.authStore.isValid) {
              pb.collection('workspace_members').unsubscribe('*');
            }
          } catch (err) {
            // Ignore unsubscribe errors during cleanup
            console.warn('[useWorkspaceAccess] Failed to unsubscribe from members:', err);
          }
        };
      } catch (error) {
        logError(error, 'useWorkspaceAccess', { action: 'subscribe/members' });
      }
    };

    subscribe();

    return () => {
      unsubscribe?.();
    };
  }, [enabled, currentWorkspaceId, user]);

  // Subscribe to workspace deletion
  useEffect(() => {
    if (!enabled || !currentWorkspaceId) return;

    let unsubscribe: (() => void) | undefined;

    const subscribe = async () => {
      try {
        // Subscribe to workspace changes
        await pb.collection('workspaces').subscribe(currentWorkspaceId, (e) => {
          if (e.action === 'delete') {
            onAccessLostRef.current?.('deleted');
          }
        });

        unsubscribe = () => {
          try {
            if (pb.authStore.isValid) {
              pb.collection('workspaces').unsubscribe(currentWorkspaceId);
            }
          } catch (err) {
            console.warn('[useWorkspaceAccess] Failed to unsubscribe from workspace:', err);
          }
        };
      } catch (error) {
        logError(error, 'useWorkspaceAccess', { action: 'subscribe/workspace' });
      }
    };

    subscribe();

    return () => {
      unsubscribe?.();
    };
  }, [enabled, currentWorkspaceId]);
}

/**
 * Check if an error is a 404 Not Found
 */
function isNotFoundError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const e = error as { status?: number; message?: string };
    return e.status === 404 || e.message?.includes('not found') || false;
  }
  return false;
}

/**
 * Simple hook to check if user has access to a specific workspace
 */
export function useHasWorkspaceAccess(workspaceId: string | null): boolean {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  
  if (!workspaceId) return false;
  
  return workspaces.some((w) => w.id === workspaceId);
}
