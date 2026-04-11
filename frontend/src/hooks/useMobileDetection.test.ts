/**
 * @file useMobileDetection.test.ts
 * @description Tests for responsive detection hooks
 * @app SHARED - Core responsive infrastructure
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useMediaQuery,
  useIsMobile,
  useIsTablet,
  useIsTabletDevice,
  useIsDesktop,
  useIsTouch,
  BREAKPOINTS,
} from '@frameer/hooks/useMobileDetection';

// Mock matchMedia
const createMatchMediaMock = (matches: boolean) => ({
  matches,
  media: '',
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
});

describe('useMobileDetection', () => {
  let originalMatchMedia: typeof window.matchMedia;
  let originalUserAgent: PropertyDescriptor | undefined;
  let originalPlatform: PropertyDescriptor | undefined;
  let originalMaxTouchPoints: PropertyDescriptor | undefined;
  let originalScreen: PropertyDescriptor | undefined;

  const setNavigatorValue = (key: 'userAgent' | 'platform' | 'maxTouchPoints', value: string | number) => {
    Object.defineProperty(window.navigator, key, {
      configurable: true,
      value,
    });
  };

  const setScreenSize = (width: number, height: number) => {
    Object.defineProperty(window, 'screen', {
      configurable: true,
      value: {
        width,
        height,
      },
    });
  };

  const setViewport = ({
    userAgent,
    platform = 'MacIntel',
    maxTouchPoints = 0,
    screenWidth,
    screenHeight,
    landscape,
    touch = maxTouchPoints > 0,
  }: {
    userAgent: string;
    platform?: string;
    maxTouchPoints?: number;
    screenWidth: number;
    screenHeight: number;
    landscape: boolean;
    touch?: boolean;
  }) => {
    setNavigatorValue('userAgent', userAgent);
    setNavigatorValue('platform', platform);
    setNavigatorValue('maxTouchPoints', maxTouchPoints);
    setScreenSize(screenWidth, screenHeight);

    window.matchMedia = vi.fn().mockImplementation((query: string) => {
      if (query.includes('orientation: landscape')) {
        return createMatchMediaMock(landscape);
      }
      if (query.includes('hover: none') || query.includes('pointer: coarse')) {
        return createMatchMediaMock(touch);
      }
      return createMatchMediaMock(false);
    });
  };

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    originalUserAgent = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');
    originalPlatform = Object.getOwnPropertyDescriptor(window.navigator, 'platform');
    originalMaxTouchPoints = Object.getOwnPropertyDescriptor(window.navigator, 'maxTouchPoints');
    originalScreen = Object.getOwnPropertyDescriptor(window, 'screen');
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;

    if (originalUserAgent) {
      Object.defineProperty(window.navigator, 'userAgent', originalUserAgent);
    }
    if (originalPlatform) {
      Object.defineProperty(window.navigator, 'platform', originalPlatform);
    }
    if (originalMaxTouchPoints) {
      Object.defineProperty(window.navigator, 'maxTouchPoints', originalMaxTouchPoints);
    }
    if (originalScreen) {
      Object.defineProperty(window, 'screen', originalScreen);
    }
  });

  describe('useMediaQuery', () => {
    it('returns true when query matches', () => {
      window.matchMedia = vi.fn().mockImplementation(() => 
        createMatchMediaMock(true)
      );
      
      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
      
      expect(result.current).toBe(true);
    });

    it('returns false when query does not match', () => {
      window.matchMedia = vi.fn().mockImplementation(() => 
        createMatchMediaMock(false)
      );
      
      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
      
      expect(result.current).toBe(false);
    });

    it('subscribes to media query changes', () => {
      const mockMql = createMatchMediaMock(false);
      window.matchMedia = vi.fn().mockImplementation(() => mockMql);
      
      renderHook(() => useMediaQuery('(min-width: 768px)'));
      
      expect(mockMql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('unsubscribes on unmount', () => {
      const mockMql = createMatchMediaMock(false);
      window.matchMedia = vi.fn().mockImplementation(() => mockMql);
      
      const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'));
      unmount();
      
      expect(mockMql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });
  });

  describe('useIsMobile', () => {
    it('returns true for phones even in landscape', () => {
      setViewport({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        platform: 'iPhone',
        maxTouchPoints: 5,
        screenWidth: 844,
        screenHeight: 390,
        landscape: true,
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(true);
    });

    it('returns true for tablets in portrait', () => {
      setViewport({
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)',
        platform: 'MacIntel',
        maxTouchPoints: 5,
        screenWidth: 820,
        screenHeight: 1180,
        landscape: false,
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(true);
    });
  });

  describe('useIsTablet', () => {
    it('returns true only for tablets in portrait/mobile layout', () => {
      setViewport({
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)',
        platform: 'MacIntel',
        maxTouchPoints: 5,
        screenWidth: 820,
        screenHeight: 1180,
        landscape: false,
      });

      const { result } = renderHook(() => useIsTablet());

      expect(result.current).toBe(true);
    });
  });

  describe('useIsTabletDevice', () => {
    it('returns true for tablets regardless of orientation', () => {
      setViewport({
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)',
        platform: 'MacIntel',
        maxTouchPoints: 5,
        screenWidth: 1180,
        screenHeight: 820,
        landscape: true,
      });

      const { result } = renderHook(() => useIsTabletDevice());

      expect(result.current).toBe(true);
    });
  });

  describe('useIsDesktop', () => {
    it('returns true for tablets in landscape', () => {
      setViewport({
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)',
        platform: 'MacIntel',
        maxTouchPoints: 5,
        screenWidth: 1180,
        screenHeight: 820,
        landscape: true,
      });

      const { result } = renderHook(() => useIsDesktop());

      expect(result.current).toBe(true);
    });

    it('returns true for desktop devices regardless of narrow window width', () => {
      setViewport({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)',
        platform: 'MacIntel',
        maxTouchPoints: 0,
        screenWidth: 700,
        screenHeight: 1100,
        landscape: false,
        touch: false,
      });

      const { result } = renderHook(() => useIsDesktop());

      expect(result.current).toBe(true);
    });
  });

  describe('useIsTouch', () => {
    it('returns true for touch devices', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => {
        const isTouchQuery = query.includes('hover: none');
        return createMatchMediaMock(isTouchQuery);
      });
      
      const { result } = renderHook(() => useIsTouch());
      
      expect(result.current).toBe(true);
    });
  });

  describe('BREAKPOINTS', () => {
    it('has correct breakpoint values', () => {
      expect(BREAKPOINTS.md).toBe(768);
      expect(BREAKPOINTS.lg).toBe(1024);
      expect(BREAKPOINTS.tablet).toBe(768);
    });
  });
});
