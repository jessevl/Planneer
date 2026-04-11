/**
 * @file usePWAInstall.ts
 * @description Hook to manage PWA installation prompt
 * @app SHARED - PWA install management
 * 
 * Captures the beforeinstallprompt event and provides methods to:
 * - Check if the app can be installed
 * - Trigger the install prompt
 * - Track if the app is already installed
 */

import { useState, useEffect, useCallback } from 'react';
import { useUIStore } from '@/stores/uiStore';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface UsePWAInstallReturn {
  /** Whether the app can be installed (prompt is available or manual instructions needed) */
  canInstall: boolean;
  /** Whether the app is already installed (standalone mode) */
  isInstalled: boolean;
  /** Trigger the install prompt */
  promptInstall: () => Promise<boolean>;
  /** Dismiss the install prompt (user chose not to install) */
  dismissInstall: () => void;
  /** Whether the user has dismissed the install prompt */
  isDismissed: boolean;
  /** Whether the device is iOS */
  isIOS: boolean;
  /** Whether the browser is Safari */
  isSafari: boolean;
  /** Whether the browser supports the native install prompt */
  supportsInstallPrompt: boolean;
  /** Whether the native install prompt is currently available to be triggered */
  hasDeferredPrompt: boolean;
}

const DISMISSED_KEY = 'pwa-install-dismissed';
const DISMISSED_EXPIRY_DAYS = 1;

export function usePWAInstall(): UsePWAInstallReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const { isPWAInstalled: isInstalled, isPWADismissed: isDismissed, setPWAInstalled: setIsInstalled, setPWADismissed: setIsDismissed } = useUIStore();
  const [isIOS, setIsIOS] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const [supportsInstallPrompt, setSupportsInstallPrompt] = useState(false);

  // Check device and browser info
  useEffect(() => {
    const ua = window.navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPad Pro
    const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(ua);
    
    setIsIOS(isIOSDevice);
    setIsSafari(isSafariBrowser);
    setSupportsInstallPrompt('onbeforeinstallprompt' in window);
  }, []);

  // Check if already installed
  useEffect(() => {
    const checkInstalled = () => {
      // Check display-mode: standalone
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      // Check iOS standalone mode
      const isIOSStandalone = (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone || isIOSStandalone);
    };

    checkInstalled();

    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener('change', checkInstalled);

    return () => mediaQuery.removeEventListener('change', checkInstalled);
  }, []);

  // Check if user has dismissed the prompt recently
  useEffect(() => {
    const dismissedAt = localStorage.getItem(DISMISSED_KEY);
    if (dismissedAt) {
      const dismissedDate = new Date(dismissedAt);
      const now = new Date();
      const daysSinceDismissed = (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceDismissed < DISMISSED_EXPIRY_DAYS) {
        setIsDismissed(true);
      } else {
        // Expired, clear it
        localStorage.removeItem(DISMISSED_KEY);
      }
    }
  }, []);

  // Capture the beforeinstallprompt event
  useEffect(() => {
    const handler = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if app was just installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    // Clear the deferred prompt (it can only be used once)
    setDeferredPrompt(null);

    return outcome === 'accepted';
  }, [deferredPrompt]);

  const dismissInstall = useCallback(() => {
    setIsDismissed(true);
    localStorage.setItem(DISMISSED_KEY, new Date().toISOString());
  }, []);

  // canInstall is true if:
  // 1. Not already installed
  // 2. Not dismissed
  // We show it on all browsers that aren't installed yet, 
  // as most modern browsers support some form of PWA installation.
  const canInstall = !isInstalled && !isDismissed;

  return {
    canInstall,
    isInstalled,
    promptInstall,
    dismissInstall,
    isDismissed,
    isIOS,
    isSafari,
    supportsInstallPrompt,
    hasDeferredPrompt: deferredPrompt !== null,
  };
}

export default usePWAInstall;
