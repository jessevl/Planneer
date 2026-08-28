/**
 * @file useVisibleCenterOffset.test.ts
 * @description Unit tests for centring overlay controls on the visible slice of
 * an element taller than its scroll container.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { useVisibleCenterOffset } from './useVisibleCenterOffset';

const VIEW_HEIGHT = 600;
/** Scroll container starts below a header, as in TasksView. */
const VIEW_TOP = 100;

let scroller: HTMLDivElement;
let element: HTMLDivElement;

/** Places the element at `top` with `height`, both in viewport coordinates. */
const layout = (top: number, height: number) => {
  element.getBoundingClientRect = () =>
    ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
};

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );

  scroller = document.createElement('div');
  scroller.style.overflowY = 'auto';
  element = document.createElement('div');
  scroller.appendChild(element);
  document.body.appendChild(scroller);

  scroller.getBoundingClientRect = () =>
    ({
      top: VIEW_TOP,
      bottom: VIEW_TOP + VIEW_HEIGHT,
      height: VIEW_HEIGHT,
      left: 0, right: 0, width: 0, x: 0, y: VIEW_TOP, toJSON: () => ({}),
    }) as DOMRect;
});

afterEach(() => {
  scroller.remove();
  vi.unstubAllGlobals();
});

const renderOffset = () => {
  const ref = createRef<HTMLElement>();
  (ref as { current: HTMLElement | null }).current = element;
  return renderHook(() => useVisibleCenterOffset(ref, true));
};

describe('useVisibleCenterOffset', () => {
  it('centres on the visible slice of an element taller than the viewport', async () => {
    // 3000px board starting at the top of the scroll container: only the first
    // 600px are on screen, so the midpoint is 300px down — not 1500.
    layout(VIEW_TOP, 3000);
    const { result } = renderOffset();

    await waitFor(() => expect(result.current).toBe(300));
  });

  it('follows the visible slice as the page scrolls', async () => {
    layout(VIEW_TOP, 3000);
    const { result } = renderOffset();
    await waitFor(() => expect(result.current).toBe(300));

    // Scrolled down 900px: visible slice is now 900..1500 of the element.
    layout(VIEW_TOP - 900, 3000);
    window.dispatchEvent(new Event('scroll'));

    await waitFor(() => expect(result.current).toBe(1200));
  });

  it('falls back to the true midpoint when the element fits on screen', async () => {
    layout(VIEW_TOP + 100, 200);
    const { result } = renderOffset();

    await waitFor(() => expect(result.current).toBe(100));
  });

  it('clamps to the container when the element starts above it', async () => {
    // Element top is scrolled past the container's top edge.
    layout(VIEW_TOP - 400, 1000);
    const { result } = renderOffset();

    // Visible slice is element-y 400..1000, midpoint 700.
    await waitFor(() => expect(result.current).toBe(700));
  });

  it('holds its last position once scrolled out of view', async () => {
    layout(VIEW_TOP, 3000);
    const { result } = renderOffset();
    await waitFor(() => expect(result.current).toBe(300));

    layout(VIEW_TOP + VIEW_HEIGHT + 50, 3000);
    window.dispatchEvent(new Event('scroll'));

    await waitFor(() => expect(result.current).toBe(300));
  });

  it('reports nothing while disabled', () => {
    const ref = createRef<HTMLElement>();
    (ref as { current: HTMLElement | null }).current = element;
    layout(VIEW_TOP, 3000);
    const { result } = renderHook(() => useVisibleCenterOffset(ref, false));

    expect(result.current).toBeNull();
  });

  it('measures against the viewport when nothing scrolls', async () => {
    document.body.appendChild(element);
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true, configurable: true });
    layout(0, 3000);
    const { result } = renderOffset();

    await waitFor(() => expect(result.current).toBe(400));
  });
});
