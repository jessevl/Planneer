/**
 * @file usePWA.ts
 * @description PWA service worker management hook
 * @app SHARED - Provides SW registration status and update controls
 * 
 * Features:
 * - Tracks service worker registration status
 * - Detects when updates are available
 * - Provides manual update trigger
 * - Shows offline-ready status
 * - More detailed state for debugging
 * 
 * Uses workbox-window for proper SW lifecycle management.
 */

import { useState, useEffect, useCallback } from 'react';
import { Workbox, messageSW } from 'workbox-window';

export interface PWAState {
  /** Whether the service worker is registered and active */
  isRegistered: boolean;
  /** Whether the app is ready for offline use (all assets cached) */
  isOfflineReady: boolean;
  /** Whether an update is available and waiting */
  needsUpdate: boolean;
  /** Whether we're currently checking for updates */
  isChecking: boolean;
  /** Last time we checked for updates */
  lastUpdateCheck: Date | null;
  /** Error message if registration failed */
  error: string | null;
  /** The workbox instance for advanced control */
  wb: Workbox | null;
  /** Current service worker state for debugging */
  swState: 'installing' | 'installed' | 'activating' | 'activated' | 'redundant' | 'none' | null;
  /** Whether there's a controlling service worker (true means offline should work) */
  hasController: boolean;
  /** Version info from the service worker (if available) */
  version: string | null;
  /** Time since the service worker was activated */
  activeSince: Date | null;
}

interface UsePWAReturn extends PWAState {
  /** Manually check for updates */
  checkForUpdate: () => Promise<void>;
  /** Apply the waiting update (will reload the page) */
  applyUpdate: () => Promise<void>;
  /** Skip waiting and activate new SW immediately */
  skipWaiting: () => Promise<void>;
}

// Store for cross-component state
let globalWb: Workbox | null = null;
let globalState: PWAState = {
  isRegistered: false,
  isOfflineReady: false,
  needsUpdate: false,
  isChecking: false,
  lastUpdateCheck: null,
  error: null,
  wb: null,
  swState: null,
  hasController: false,
  version: null,
  activeSince: null,
};
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach(fn => fn());
}

function updateState(partial: Partial<PWAState>) {
  globalState = { ...globalState, ...partial };
  notifyListeners();
}

// Check existing service worker state on page load
async function checkExistingServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      // Check if we have a controlling service worker (can work offline)
      const hasController = !!navigator.serviceWorker.controller;
      
      // Determine SW state
      let swState: PWAState['swState'] = 'none';
      if (registration.active) {
        swState = 'activated';
      } else if (registration.waiting) {
        swState = 'installed';
      } else if (registration.installing) {
        swState = 'installing';
      }
      
      // If there's an active or controlling SW, we can work offline
      const isOfflineReady = hasController || !!registration.active;
      
      updateState({
        isRegistered: !!registration.active,
        isOfflineReady,
        hasController,
        swState,
        needsUpdate: !!registration.waiting,
      });
    }
  } catch (err) {
    console.warn('[PWA] Error checking existing service worker:', err);
  }
}

// Initialize the service worker once
function initServiceWorker() {
  if (globalWb) return; // Already initialized
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) {
    updateState({ error: 'Service workers not supported' });
    return;
  }
  
  // Check existing SW state first
  checkExistingServiceWorker();
  
  // Check if there's already a controller (means we can work offline)
  if (navigator.serviceWorker.controller) {
    updateState({ 
      hasController: true,
      isOfflineReady: true,
    });
  }
  
  // Only register in production
  if (import.meta.env.DEV) {
    updateState({ error: 'PWA disabled in development' });
    return;
  }
  
  const wb = new Workbox('/sw.js');
  globalWb = wb;
  updateState({ wb });
  
  // Listen for the service worker to be installed
  wb.addEventListener('installed', (event) => {
    if (event.isUpdate) {
      console.log('[PWA] New version installed, waiting to activate');
      updateState({ needsUpdate: true, swState: 'installed' });
    } else {
      console.log('[PWA] Service worker installed for the first time');
      updateState({ isOfflineReady: true, swState: 'installed' });
    }
  });
  
  // Listen for the service worker to become active
  wb.addEventListener('activated', (event) => {
    const now = new Date();
    if (event.isUpdate) {
      console.log('[PWA] New version activated');
      updateState({ 
        swState: 'activated', 
        activeSince: now,
        needsUpdate: false,
      });
      // Reload to use the new version
      window.location.reload();
    } else {
      console.log('[PWA] Service worker activated');
      updateState({ 
        isRegistered: true, 
        isOfflineReady: true, 
        hasController: true,
        swState: 'activated',
        activeSince: now,
      });
    }
  });
  
  // Listen for waiting service worker
  wb.addEventListener('waiting', () => {
    console.log('[PWA] New version waiting to activate');
    updateState({ needsUpdate: true, swState: 'installed' });
  });
  
  // Listen for controlling service worker
  wb.addEventListener('controlling', () => {
    console.log('[PWA] Service worker is now controlling the page');
    updateState({ isRegistered: true, hasController: true, isOfflineReady: true });
  });
  
  // Register the service worker
  wb.register()
    .then((registration) => {
      console.log('[PWA] Service worker registered:', registration);
      const now = new Date();
      updateState({ 
        isRegistered: true, 
        lastUpdateCheck: now,
      });
      
      // Check if there's already a waiting worker
      if (registration?.waiting) {
        updateState({ needsUpdate: true, swState: 'installed' });
      }
      
      // Check if there's an active worker (can work offline)
      if (registration?.active) {
        updateState({ 
          isOfflineReady: true, 
          swState: 'activated',
          activeSince: now,
        });
      }
    })
    .catch((err) => {
      console.error('[PWA] Service worker registration failed:', err);
      updateState({ error: `Registration failed: ${err.message}` });
    });
}

/**
 * Hook for PWA service worker management.
 * Provides registration status, update detection, and manual update controls.
 */
export function usePWA(): UsePWAReturn {
  const [, forceUpdate] = useState({});
  
  useEffect(() => {
    // Initialize SW on first mount
    initServiceWorker();
    
    // Subscribe to state changes
    const listener = () => forceUpdate({});
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  
  const checkForUpdate = useCallback(async () => {
    if (!globalWb) return;
    
    updateState({ isChecking: true });
    try {
      await globalWb.update();
      updateState({ 
        isChecking: false, 
        lastUpdateCheck: new Date(),
      });
    } catch (err) {
      console.error('[PWA] Update check failed:', err);
      updateState({ 
        isChecking: false,
        error: `Update check failed: ${(err as Error).message}`,
      });
    }
  }, []);
  
  const skipWaiting = useCallback(async () => {
    if (!globalWb) return;
    
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration?.waiting) {
      // Tell the waiting SW to skip waiting
      await messageSW(registration.waiting, { type: 'SKIP_WAITING' });
    }
  }, []);
  
  const applyUpdate = useCallback(async () => {
    await skipWaiting();
    // The 'controlling' event will trigger a reload
  }, [skipWaiting]);
  
  return {
    ...globalState,
    checkForUpdate,
    applyUpdate,
    skipWaiting,
  };
}

export default usePWA;
