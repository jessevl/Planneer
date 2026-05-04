/**
 * @file focusBlockAtOrder.test.ts
 * @description Regression coverage for inserted-block focus restoration.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { focusBlockAtOrder } from './focusBlockAtOrder';

describe('focusBlockAtOrder', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('focuses the block at the requested order and restores scroll position', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });

    const editor = {
      getEditorValue: () => ({
        b1: { id: 'b1', meta: { order: 0 } },
        b2: { id: 'b2', meta: { order: 1 } },
      }),
      setPath: vi.fn(),
      focusBlock: vi.fn(),
      focus: vi.fn(),
    };
    const scrollContainer = { scrollLeft: 16, scrollTop: 240 } as HTMLElement;

    expect(focusBlockAtOrder(editor as any, { order: 1, scrollContainer })).toBe('b2');
    expect(frames).toHaveLength(1);

    scrollContainer.scrollLeft = 0;
    scrollContainer.scrollTop = 0;

    frames.shift()?.(0);

    expect(editor.setPath).toHaveBeenCalledWith({ current: 1 });
    expect(editor.focusBlock).toHaveBeenCalledWith('b2');
    expect(frames).toHaveLength(1);
    expect(scrollContainer.scrollLeft).toBe(0);
    expect(scrollContainer.scrollTop).toBe(0);

    frames.shift()?.(0);

    expect(scrollContainer.scrollLeft).toBe(16);
    expect(scrollContainer.scrollTop).toBe(240);
  });

  it('falls back to editor.focus when focusBlock throws', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });

    const editor = {
      getEditorValue: () => ({ b1: { id: 'b1', meta: { order: 0 } } }),
      setPath: vi.fn(),
      focusBlock: vi.fn(() => {
        throw new Error('stale path');
      }),
      focus: vi.fn(),
    };

    focusBlockAtOrder(editor as any, { order: 0 });
    frames.shift()?.(0);

    expect(editor.focus).toHaveBeenCalledTimes(1);
  });

  it('returns null when no block matches the requested order', () => {
    const editor = {
      getEditorValue: () => ({ b1: { id: 'b1', meta: { order: 0 } } }),
      setPath: vi.fn(),
      focusBlock: vi.fn(),
      focus: vi.fn(),
    };

    expect(focusBlockAtOrder(editor as any, { order: 2 })).toBeNull();
    expect(editor.setPath).not.toHaveBeenCalled();
    expect(editor.focusBlock).not.toHaveBeenCalled();
    expect(editor.focus).not.toHaveBeenCalled();
  });
});
