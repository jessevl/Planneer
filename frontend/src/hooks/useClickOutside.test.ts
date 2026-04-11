/**
 * @file useClickOutside.test.ts
 * @description Unit tests for useClickOutside hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRef } from 'react';
import useClickOutside from './useClickOutside';

describe('useClickOutside', () => {
  let container: HTMLDivElement;
  let inside: HTMLDivElement;
  let outside: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    inside = document.createElement('div');
    outside = document.createElement('div');
    container.appendChild(inside);
    container.appendChild(outside);
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('calls onOutside when clicking outside the ref element', () => {
    const onOutside = vi.fn();
    
    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement>(inside);
      useClickOutside([{ ref, onOutside }]);
      return ref;
    });
    
    // Simulate click outside
    const event = new MouseEvent('mousedown', { bubbles: true });
    outside.dispatchEvent(event);
    
    expect(onOutside).toHaveBeenCalledTimes(1);
  });

  it('does not call onOutside when clicking inside the ref element', () => {
    const onOutside = vi.fn();
    
    renderHook(() => {
      const ref = useRef<HTMLElement>(inside);
      useClickOutside([{ ref, onOutside }]);
      return ref;
    });
    
    // Simulate click inside
    const event = new MouseEvent('mousedown', { bubbles: true });
    inside.dispatchEvent(event);
    
    expect(onOutside).not.toHaveBeenCalled();
  });

  it('handles multiple refs', () => {
    const onOutside1 = vi.fn();
    const onOutside2 = vi.fn();
    const inside2 = document.createElement('div');
    container.appendChild(inside2);
    
    renderHook(() => {
      const ref1 = useRef<HTMLElement>(inside);
      const ref2 = useRef<HTMLElement>(inside2);
      useClickOutside([
        { ref: ref1, onOutside: onOutside1 },
        { ref: ref2, onOutside: onOutside2 },
      ]);
    });
    
    // Click inside ref1 (outside ref2)
    const event = new MouseEvent('mousedown', { bubbles: true });
    inside.dispatchEvent(event);
    
    expect(onOutside1).not.toHaveBeenCalled();
    expect(onOutside2).toHaveBeenCalledTimes(1);
  });

  it('handles null refs gracefully', () => {
    const onOutside = vi.fn();
    
    expect(() => {
      renderHook(() => {
        const ref = useRef<HTMLElement | null>(null);
        useClickOutside([{ ref, onOutside }]);
      });
      
      const event = new MouseEvent('mousedown', { bubbles: true });
      outside.dispatchEvent(event);
    }).not.toThrow();
  });

  it('cleans up listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
    const onOutside = vi.fn();
    
    const { unmount } = renderHook(() => {
      const ref = useRef<HTMLElement>(inside);
      useClickOutside([{ ref, onOutside }]);
    });
    
    unmount();
    
    expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });
});
