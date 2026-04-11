/**
 * @file useIsDarkMode.test.ts
 * @description Tests for the useIsDarkMode hook
 * @app SHARED - Theme detection
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIsDarkMode } from './useIsDarkMode';
import { useSettingsStore } from '@/stores/settingsStore';

// Mock matchMedia
const mockMatchMedia = vi.fn();

describe('useIsDarkMode', () => {
  beforeEach(() => {
    // Reset settings store
    useSettingsStore.setState({ theme: 'light' });
    
    // Setup matchMedia mock
    mockMatchMedia.mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when theme is light', () => {
    useSettingsStore.setState({ theme: 'light' });
    
    const { result } = renderHook(() => useIsDarkMode());
    
    expect(result.current).toBe(false);
  });

  it('returns true when theme is dark', () => {
    useSettingsStore.setState({ theme: 'dark' });
    
    const { result } = renderHook(() => useIsDarkMode());
    
    expect(result.current).toBe(true);
  });

  it('returns true when theme is system and system prefers dark', () => {
    useSettingsStore.setState({ theme: 'system' });
    
    mockMatchMedia.mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    
    const { result } = renderHook(() => useIsDarkMode());
    
    expect(result.current).toBe(true);
  });

  it('returns false when theme is system and system prefers light', () => {
    useSettingsStore.setState({ theme: 'system' });
    
    mockMatchMedia.mockImplementation((query: string) => ({
      matches: false, // prefers light
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    
    const { result } = renderHook(() => useIsDarkMode());
    
    expect(result.current).toBe(false);
  });
});
