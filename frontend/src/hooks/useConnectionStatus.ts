/**
 * @file useConnectionStatus.ts
 * @description Hook for monitoring network and backend connectivity
 * @app SHARED - Used across the app for connection state
 *
 * Provides:
 * - Browser online/offline detection
 * - Backend health check polling
 * - Reconnection detection with callback
 * - Connection state for UI indicators
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { pb } from '@/lib/pocketbase';
import { CONNECTION } from '@/lib/config';

export type ConnectionState = 'online' | 'offline' | 'connecting' | 'backend-down';

interface ConnectionStatus {
  /** Current connection state */
  state: ConnectionState;
  /** True if browser reports online */
  isOnline: boolean;
  /** True if backend is reachable */
  isBackendAvailable: boolean;
  /** Timestamp of last successful backend check */
  lastBackendCheck: number | null;
  /** Manually trigger a backend health check */
  checkBackend: () => Promise<boolean>;
}

interface UseConnectionStatusOptions {
  /** How often to poll backend health (ms). Default from config */
  pollInterval?: number;
  /** Callback when connection is restored */
  onReconnect?: () => void;
  /** Whether to poll backend health. Default: true */
  enablePolling?: boolean;
}

/**
 * Monitor network and backend connectivity
 * 
 * @example
 * const { state, isOnline, checkBackend } = useConnectionStatus({
 *   onReconnect: () => refetchData(),
 * });
 * 
 * if (state === 'offline') return <OfflineBanner />;
 */
export function useConnectionStatus(options: UseConnectionStatusOptions = {}): ConnectionStatus {
  const {
    pollInterval = CONNECTION.HEALTH_CHECK_POLL_INTERVAL_MS,
    onReconnect,
    enablePolling = true,
  } = options;

  const [isOnline, setIsOnline] = useState(() => 
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isBackendAvailable, setIsBackendAvailable] = useState(true);
  const [lastBackendCheck, setLastBackendCheck] = useState<number | null>(null);
  
  // Track previous state to detect reconnection
  const wasOfflineRef = useRef(false);
  const onReconnectRef = useRef(onReconnect);
  onReconnectRef.current = onReconnect;

  /**
   * Check if backend is reachable via health endpoint
   */
  const checkBackend = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`${pb.baseURL}/health`, {
        method: 'GET',
        cache: 'no-store',
        signal: AbortSignal.timeout(CONNECTION.HEALTH_CHECK_TIMEOUT_MS),
      });
      
      const available = response.ok;
      setIsBackendAvailable(available);
      setLastBackendCheck(Date.now());
      
      return available;
    } catch {
      setIsBackendAvailable(false);
      return false;
    }
  }, []);

  // Browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // When coming back online, check backend immediately
      checkBackend();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsBackendAvailable(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkBackend]);

  // Poll backend health when enabled and online
  useEffect(() => {
    if (!enablePolling || !isOnline) return;

    // Initial check
    checkBackend();

    // Set up polling interval
    const intervalId = setInterval(checkBackend, pollInterval);

    return () => clearInterval(intervalId);
  }, [enablePolling, isOnline, pollInterval, checkBackend]);

  // Detect reconnection and call callback
  useEffect(() => {
    const currentlyOffline = !isOnline || !isBackendAvailable;
    
    // If we were offline and now we're online, trigger reconnect callback
    if (wasOfflineRef.current && !currentlyOffline) {
      onReconnectRef.current?.();
    }
    
    wasOfflineRef.current = currentlyOffline;
  }, [isOnline, isBackendAvailable]);

  // Compute overall state
  const state: ConnectionState = (() => {
    if (!isOnline) return 'offline';
    if (!isBackendAvailable) return 'backend-down';
    return 'online';
  })();

  return {
    state,
    isOnline,
    isBackendAvailable,
    lastBackendCheck,
    checkBackend,
  };
}

/**
 * Simplified hook for just checking if we're connected
 */
export function useIsConnected(): boolean {
  const { state } = useConnectionStatus({ enablePolling: false });
  return state === 'online';
}
