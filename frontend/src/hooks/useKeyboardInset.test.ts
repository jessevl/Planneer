/**
 * @file useKeyboardInset.test.ts
 * @description Unit tests for the fixed-element keyboard offset, covering the
 * Android case where the browser scrolls the visual viewport up to reveal the
 * focused field.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useKeyboardInset } from './useKeyboardInset';

const LAYOUT_HEIGHT = 800;

class FakeVisualViewport extends EventTarget {
  height = LAYOUT_HEIGHT;
  offsetTop = 0;

  /** Mirrors the browser: a resize/scroll pair as the keyboard settles. */
  set(height: number, offsetTop: number) {
    this.height = height;
    this.offsetTop = offsetTop;
    this.dispatchEvent(new Event('resize'));
    this.dispatchEvent(new Event('scroll'));
  }
}

let viewport: FakeVisualViewport;

beforeEach(() => {
  viewport = new FakeVisualViewport();
  vi.stubGlobal('visualViewport', viewport);
  Object.defineProperty(window, 'innerHeight', { value: LAYOUT_HEIGHT, writable: true, configurable: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useKeyboardInset', () => {
  it('reports no inset while the keyboard is closed', async () => {
    const { result } = renderHook(() => useKeyboardInset());

    await waitFor(() => expect(result.current).toEqual({ isKeyboardOpen: false, bottomInset: 0 }));
  });

  it('offsets by the keyboard height when the visual viewport has not scrolled', async () => {
    const { result } = renderHook(() => useKeyboardInset());
    viewport.set(500, 0);

    await waitFor(() => expect(result.current).toEqual({ isKeyboardOpen: true, bottomInset: 300 }));
  });

  it('subtracts the visual viewport scroll so the bar rests on the keyboard', async () => {
    const { result } = renderHook(() => useKeyboardInset());
    // Chrome scrolled the visual viewport up by 200px to reveal the caret;
    // the visible area now ends at layout y=700, so the inset is 100 — not the
    // 300 keyboard height, which would strand the bar mid-screen.
    viewport.set(500, 200);

    await waitFor(() => expect(result.current).toEqual({ isKeyboardOpen: true, bottomInset: 100 }));
  });

  it('offsets by nothing once the visual viewport is scrolled past the keyboard', async () => {
    const { result } = renderHook(() => useKeyboardInset());
    viewport.set(500, 300);

    await waitFor(() => expect(result.current).toEqual({ isKeyboardOpen: true, bottomInset: 0 }));
  });

  it('never returns a negative inset', async () => {
    const { result } = renderHook(() => useKeyboardInset());
    viewport.set(500, 400);

    await waitFor(() => expect(result.current.bottomInset).toBe(0));
  });

  it('ignores an address bar collapse', async () => {
    const { result } = renderHook(() => useKeyboardInset());
    viewport.set(LAYOUT_HEIGHT - 100, 0);

    await waitFor(() => expect(result.current.isKeyboardOpen).toBe(false));
  });

  it('reports nothing to offset when the layout viewport itself resizes', async () => {
    // interactive-widget=resizes-content: fixed elements already sit above the
    // keyboard, so no extra offset is wanted.
    const { result } = renderHook(() => useKeyboardInset());
    (window as { innerHeight: number }).innerHeight = 500;
    viewport.set(500, 0);

    await waitFor(() => expect(result.current).toEqual({ isKeyboardOpen: false, bottomInset: 0 }));
  });

  it('detaches its listeners on unmount', async () => {
    const removeSpy = vi.spyOn(viewport, 'removeEventListener');
    const { unmount } = renderHook(() => useKeyboardInset());
    unmount();

    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
  });

  it('stays inert when the browser has no visualViewport', () => {
    vi.stubGlobal('visualViewport', undefined);
    const { result } = renderHook(() => useKeyboardInset());

    expect(result.current).toEqual({ isKeyboardOpen: false, bottomInset: 0 });
  });
});
