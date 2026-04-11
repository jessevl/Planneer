/**
 * @file usePWAInstall.test.ts
 * @description Tests for the usePWAInstall hook
 * @app SHARED - PWA install management
 */
import { describe, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePWAInstall } from './usePWAInstall';
import { useUIStore } from '@/stores/uiStore';

const mockMatchMedia = vi.fn();

describe('usePWAInstall', () => {
  beforeEach(() => {
    useUIStore.setState({ isPWAInstalled: false, isPWADismissed: false });

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

    Object.defineProperty(window, 'onbeforeinstallprompt', {
      writable: true,
      value: null,
    });

    localStorage.clear();
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('captures the install prompt when available', async () => {
    const { result } = renderHook(() => usePWAInstall());

    await waitFor(() => {
      expect(result.current.canInstall).toBe(true);
      expect(result.current.supportsInstallPrompt).toBe(true);
      expect(result.current.hasDeferredPrompt).toBe(false);
    });

    const event = new Event('beforeinstallprompt');
    Object.assign(event, { preventDefault: vi.fn() });
    window.dispatchEvent(event);

    await waitFor(() => {
      expect(result.current.hasDeferredPrompt).toBe(true);
    });
  });
});