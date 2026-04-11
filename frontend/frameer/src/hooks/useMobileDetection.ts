/**
 * @file useMobileDetection.ts
 * @description Responsive detection hooks for mobile, tablet, and desktop layouts
 * @app SHARED - Core responsive infrastructure
 * 
 * Provides reactive hooks that respond to viewport changes, orientation, and
 * device capabilities.
 *
 * Layout policy:
 * - Phones always use mobile layouts, regardless of orientation.
 * - Desktop devices always use desktop layouts, regardless of window width.
 * - Tablets use mobile layouts in portrait and desktop layouts in landscape.
 * - Use useIsTabletDevice() when you need tablet device detection regardless of layout.
 * 
 * Viewport breakpoints (aligned with Tailwind, retained for pure media queries):
 * - Mobile viewport: < 768px (md breakpoint)
 * - Tablet viewport: 768px - 1023px
 * - Desktop viewport: >= 1024px (lg breakpoint)
 * 
 * Usage:
 * ```tsx
 * const { isMobile, isTablet, isDesktop, isTouch } = useResponsive();
 * 
 * // Or individual hooks for performance (only subscribes to one query)
 * const isMobile = useIsMobile();
 * ```
 */

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';

// ============================================================================
// BREAKPOINTS - Single source of truth, matches tailwind.config.js
// ============================================================================

export const BREAKPOINTS = {
  xs: 480,
  sm: 640,
  md: 768,   // Mobile < md
  tablet: 768,
  lg: 1024,  // Desktop >= lg
  xl: 1280,
  '2xl': 1536,
} as const;

// ============================================================================
// MEDIA QUERY UTILITIES
// ============================================================================

/**
 * Create a media query string for minimum width
 */
const minWidth = (px: number) => `(min-width: ${px}px)`;

/**
 * Create a media query string for maximum width
 */
const maxWidth = (px: number) => `(max-width: ${px - 1}px)`;

/**
 * Create a media query string for a width range
 */
const betweenWidth = (minPx: number, maxPx: number) => 
  `(min-width: ${minPx}px) and (max-width: ${maxPx - 1}px)`;

// Predefined queries
const QUERIES = {
  mobile: maxWidth(BREAKPOINTS.md),           // < 768px
  tablet: betweenWidth(BREAKPOINTS.md, BREAKPOINTS.lg), // 768px - 1023px
  desktop: minWidth(BREAKPOINTS.lg),          // >= 1024px
  landscape: '(orientation: landscape)',
  touch: '(hover: none) and (pointer: coarse)',
  mouse: '(hover: hover) and (pointer: fine)',
  standalone: '(display-mode: standalone)',
  reducedMotion: '(prefers-reduced-motion: reduce)',
  darkMode: '(prefers-color-scheme: dark)',
} as const;

type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: {
    mobile?: boolean;
  };
};

const subscribeToViewportChanges = (callback: () => void) => {
  window.addEventListener('resize', callback, { passive: true });
  window.addEventListener('orientationchange', callback);
  return () => {
    window.removeEventListener('resize', callback);
    window.removeEventListener('orientationchange', callback);
  };
};

const getDeviceSnapshot = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isLandscape: false,
      isPhone: false,
      isTablet: false,
    };
  }

  const navigatorWithUAData = navigator as NavigatorWithUserAgentData;
  const ua = (navigator.userAgent || '').toLowerCase();
  const platform = (navigator.platform || '').toLowerCase();
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const screenWidth = window.screen?.width || window.innerWidth || 0;
  const screenHeight = window.screen?.height || window.innerHeight || 0;
  const shortestScreenSide = Math.min(screenWidth, screenHeight);
  const uaDataMobile = navigatorWithUAData.userAgentData?.mobile === true;
  const isLandscape = window.matchMedia
    ? window.matchMedia(QUERIES.landscape).matches
    : window.innerWidth > window.innerHeight;

  const isIPad = ua.includes('ipad') || (platform === 'macintel' && maxTouchPoints > 1);
  const isAndroid = ua.includes('android');
  const isAndroidPhone = isAndroid && (ua.includes('mobile') || uaDataMobile);
  const isAndroidTablet = isAndroid && !isAndroidPhone;
  const isIPhone = ua.includes('iphone') || ua.includes('ipod');
  const isWindowsPhone = ua.includes('windows phone');
  const isAmazonTablet = /silk|kindle|kfot|kftt|kfjwa|kfsowi/.test(ua);
  const isGenericTablet = /tablet|playbook/.test(ua);

  const isPhone = isIPhone || isWindowsPhone || isAndroidPhone || uaDataMobile;
  const isTablet = maxTouchPoints > 0 && (
    isIPad
    || isAndroidTablet
    || isAmazonTablet
    || isGenericTablet
    || (!isPhone && shortestScreenSide >= BREAKPOINTS.tablet && shortestScreenSide < BREAKPOINTS.lg)
  );

  return {
    isLandscape,
    isPhone,
    isTablet,
  };
};

const useDeviceSnapshot = (selector: (snapshot: ReturnType<typeof getDeviceSnapshot>) => boolean): boolean => {
  const subscribe = useCallback((callback: () => void) => subscribeToViewportChanges(callback), []);
  const getSnapshot = useCallback(() => selector(getDeviceSnapshot()), [selector]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
};

// ============================================================================
// CORE HOOK: useMediaQuery
// ============================================================================

/**
 * Subscribe to a CSS media query with SSR-safe behavior.
 * Uses useSyncExternalStore for concurrent-safe subscriptions.
 * 
 * @param query - CSS media query string
 * @returns boolean indicating if the query matches
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', callback);
      return () => mql.removeEventListener('change', callback);
    },
    [query]
  );

  const getSnapshot = useCallback(() => {
    return window.matchMedia(query).matches;
  }, [query]);

  const getServerSnapshot = useCallback(() => {
    // Default to mobile-first on server (most restrictive)
    return false;
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// ============================================================================
// INDIVIDUAL BREAKPOINT HOOKS
// ============================================================================

/**
 * Returns true when the current device should use the mobile layout.
 * Phones always match; tablets match only in portrait.
 */
export function useIsMobile(): boolean {
  const isPhoneDevice = useIsPhoneDevice();
  const isTabletDevice = useIsTabletDevice();
  const isLandscape = useIsLandscapeOrientation();
  return isPhoneDevice || (isTabletDevice && !isLandscape);
}

/**
 * Returns true when a tablet should use the mobile layout.
 * This is tablet portrait mode, not generic tablet device detection.
 */
export function useIsTablet(): boolean {
  const isTabletDevice = useIsTabletDevice();
  const isLandscape = useIsLandscapeOrientation();
  return isTabletDevice && !isLandscape;
}

/**
 * Returns true for phone-class devices regardless of orientation.
 */
export function useIsPhoneDevice(): boolean {
  return useDeviceSnapshot((snapshot) => snapshot.isPhone);
}

/**
 * Returns true for physical tablet-class devices regardless of layout mode or viewport size.
 * This prevents narrow desktop windows from being treated as tablets.
 */
export function useIsTabletDevice(): boolean {
  return useDeviceSnapshot((snapshot) => snapshot.isTablet);
}

/**
 * Returns true when the current device is in landscape orientation.
 */
export function useIsLandscapeOrientation(): boolean {
  return useDeviceSnapshot((snapshot) => snapshot.isLandscape);
}

/**
 * Returns true when the current device should use the desktop layout.
 * Desktop devices always match; tablets match in landscape.
 */
export function useIsDesktop(): boolean {
  const isPhoneDevice = useIsPhoneDevice();
  const isTabletDevice = useIsTabletDevice();
  const isLandscape = useIsLandscapeOrientation();
  return !isPhoneDevice && (!isTabletDevice || isLandscape);
}

/**
 * Returns true when device has touch as primary input
 */
export function useIsTouch(): boolean {
  return useMediaQuery(QUERIES.touch);
}

/**
 * Returns true when device has mouse/trackpad as primary input
 */
export function useIsMouse(): boolean {
  return useMediaQuery(QUERIES.mouse);
}

/**
 * Returns true when app is running in standalone mode (installed PWA or Capacitor)
 */
export function useIsStandalone(): boolean {
  return useMediaQuery(QUERIES.standalone);
}

/**
 * Returns true when user prefers reduced motion
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery(QUERIES.reducedMotion);
}

// ============================================================================
// COMBINED RESPONSIVE HOOK
// ============================================================================

export interface ResponsiveState {
  /** Current device uses the mobile layout */
  isMobile: boolean;
  /** Current device is a tablet in portrait/mobile layout mode */
  isTablet: boolean;
  /** Current device uses the desktop layout */
  isDesktop: boolean;
  /** Physical phone device regardless of orientation */
  isPhoneDevice: boolean;
  /** Physical tablet device regardless of orientation */
  isTabletDevice: boolean;
  /** Current orientation is landscape */
  isLandscape: boolean;
  /** Touch is primary input (phones, tablets) */
  isTouch: boolean;
  /** Mouse/trackpad is primary input */
  isMouse: boolean;
  /** Running as installed app (PWA or Capacitor) */
  isStandalone: boolean;
  /** User prefers reduced motion */
  prefersReducedMotion: boolean;
  /** Current device uses the mobile layout (phone or tablet portrait) */
  isMobileOrTablet: boolean;
  /** Current viewport width in pixels */
  viewportWidth: number;
}

/**
 * Comprehensive responsive state hook.
 * 
 * Note: This subscribes to multiple media queries. For components that only
 * need one check, prefer the individual hooks (useIsMobile, etc.) for better performance.
 * 
 * @returns ResponsiveState object with all responsive flags
 */
export function useResponsive(): ResponsiveState {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isDesktop = useIsDesktop();
  const isPhoneDevice = useIsPhoneDevice();
  const isTabletDevice = useIsTabletDevice();
  const isLandscape = useIsLandscapeOrientation();
  const isTouch = useMediaQuery(QUERIES.touch);
  const isMouse = useMediaQuery(QUERIES.mouse);
  const isStandalone = useMediaQuery(QUERIES.standalone);
  const prefersReducedMotion = useMediaQuery(QUERIES.reducedMotion);
  
  // Viewport width for edge cases where breakpoints aren't enough
  const [viewportWidth, setViewportWidth] = useState(() => 
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    isMobile,
    isTablet,
    isDesktop,
    isPhoneDevice,
    isTabletDevice,
    isLandscape,
    isTouch,
    isMouse,
    isStandalone,
    prefersReducedMotion,
    isMobileOrTablet: isMobile || isTablet,
    viewportWidth,
  };
}

// ============================================================================
// UTILITY: CONDITIONAL RENDERING HELPER
// ============================================================================

/**
 * Returns appropriate value based on current viewport
 * 
 * @example
 * const columns = useResponsiveValue({ mobile: 1, tablet: 2, desktop: 4 });
 */
export function useResponsiveValue<T>(values: {
  mobile: T;
  tablet?: T;
  desktop?: T;
}): T {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  
  if (isMobile) return values.mobile;
  if (isTablet) return values.tablet ?? values.mobile;
  return values.desktop ?? values.tablet ?? values.mobile;
}

// ============================================================================
// SIDEBAR STATE HOOK (for mobile drawer behavior)
// ============================================================================

/**
 * Manages sidebar visibility state with responsive defaults.
 * - Desktop: sidebar visible by default
 * - Mobile/Tablet: sidebar hidden by default (drawer mode)
 * 
 * @returns [isOpen, toggle, open, close]
 */
export function useSidebarState(): [
  boolean, 
  () => void, 
  () => void, 
  () => void
] {
  const isDesktop = useIsDesktop();
  const [isOpen, setIsOpen] = useState(false);

  // Auto-close sidebar when switching from desktop to mobile
  useEffect(() => {
    if (!isDesktop) {
      setIsOpen(false);
    }
  }, [isDesktop]);

  const toggle = useCallback(() => setIsOpen(prev => !prev), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // On desktop, sidebar is always "open" (visible)
  const effectiveIsOpen = isDesktop ? true : isOpen;

  return [effectiveIsOpen, toggle, open, close];
}

// ============================================================================
// KEYBOARD VISIBILITY HOOK (for mobile keyboard handling)
// ============================================================================

export interface KeyboardState {
  /** Whether the virtual keyboard is visible */
  isKeyboardOpen: boolean;
  /** Height of the keyboard in pixels (0 if not visible) */
  keyboardHeight: number;
}

/**
 * Detects when the mobile virtual keyboard is open using the Visual Viewport API.
 * This is essential for positioning elements like FABs above the keyboard.
 * 
 * @returns KeyboardState object with keyboard visibility and height
 */
export function useKeyboardVisibility(): KeyboardState {
  const [keyboardState, setKeyboardState] = useState<KeyboardState>({
    isKeyboardOpen: false,
    keyboardHeight: 0,
  });
  
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) {
      return;
    }
    
    const viewport = window.visualViewport;
    
    const handleResize = () => {
      // The keyboard is considered open when the visual viewport height
      // is significantly smaller than the window height
      const windowHeight = window.innerHeight;
      const viewportHeight = viewport.height;
      const heightDiff = windowHeight - viewportHeight;
      
      // Consider keyboard open if viewport is more than 150px smaller than window
      // (accounts for address bar changes vs actual keyboard)
      const isOpen = heightDiff > 150;
      
      setKeyboardState({
        isKeyboardOpen: isOpen,
        keyboardHeight: isOpen ? heightDiff : 0,
      });
    };
    
    viewport.addEventListener('resize', handleResize);
    viewport.addEventListener('scroll', handleResize);
    
    // Initial check
    handleResize();
    
    return () => {
      viewport.removeEventListener('resize', handleResize);
      viewport.removeEventListener('scroll', handleResize);
    };
  }, []);
  
  return keyboardState;
}
