/**
 * @file useLongPress.test.ts
 * @description Tests for the useLongPress hook
 * @app MOBILE - Touch long-press detection
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLongPress } from './useLongPress';

// Mock haptics
vi.mock('@/lib/haptics', () => ({
  hapticLongPress: vi.fn(),
}));

// Mock config
vi.mock('@/lib/config', () => ({
  TOUCH_GESTURES: {
    LONG_PRESS_DURATION_MS: 500,
    LONG_PRESS_MOVE_THRESHOLD_PX: 10,
  },
}));

describe('useLongPress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('returns long press handlers', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));
    
    expect(result.current.longPressHandlers).toBeDefined();
    expect(result.current.longPressHandlers.onTouchStart).toBeDefined();
    expect(result.current.longPressHandlers.onTouchEnd).toBeDefined();
    expect(result.current.longPressHandlers.onTouchMove).toBeDefined();
    expect(result.current.longPressHandlers.onContextMenu).toBeDefined();
  });

  it('starts with isLongPressing false', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));
    
    expect(result.current.isLongPressing).toBe(false);
    expect(result.current.isPressing).toBe(false);
  });

  it('triggers long press after duration', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => 
      useLongPress({ onLongPress, duration: 500 })
    );
    
    // Simulate touch start
    act(() => {
      const touchEvent = {
        touches: [{ clientX: 100, clientY: 100 }],
        target: document.createElement('div'),
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as React.TouchEvent;
      
      result.current.longPressHandlers.onTouchStart(touchEvent);
    });
    
    expect(result.current.isPressing).toBe(true);
    expect(onLongPress).not.toHaveBeenCalled();
    
    // Advance timer past duration
    act(() => {
      vi.advanceTimersByTime(500);
    });
    
    expect(onLongPress).toHaveBeenCalled();
    expect(result.current.isLongPressing).toBe(true);
  });

  it('cancels long press on touch end before duration', () => {
    const onLongPress = vi.fn();
    const onClick = vi.fn();
    const { result } = renderHook(() => 
      useLongPress({ onLongPress, onClick, duration: 500 })
    );
    
    const target = document.createElement('div');
    
    // Touch start
    act(() => {
      const startEvent = {
        touches: [{ clientX: 100, clientY: 100 }],
        target,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as React.TouchEvent;
      
      result.current.longPressHandlers.onTouchStart(startEvent);
    });
    
    // Advance but not enough
    act(() => {
      vi.advanceTimersByTime(200);
    });
    
    // Touch end
    act(() => {
      const endEvent = {
        changedTouches: [{ clientX: 100, clientY: 100 }],
        target,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as React.TouchEvent;
      
      result.current.longPressHandlers.onTouchEnd(endEvent);
    });
    
    expect(onLongPress).not.toHaveBeenCalled();
    expect(result.current.isPressing).toBe(false);
    expect(result.current.isLongPressing).toBe(false);
  });

  it('cancels long press on movement beyond threshold', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => 
      useLongPress({ onLongPress, duration: 500, moveThreshold: 10 })
    );
    
    // Touch start
    act(() => {
      const startEvent = {
        touches: [{ clientX: 100, clientY: 100 }],
        target: document.createElement('div'),
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as React.TouchEvent;
      
      result.current.longPressHandlers.onTouchStart(startEvent);
    });
    
    expect(result.current.isPressing).toBe(true);
    
    // Move beyond threshold
    act(() => {
      const moveEvent = {
        touches: [{ clientX: 120, clientY: 100 }], // 20px movement
        preventDefault: vi.fn(),
      } as unknown as React.TouchEvent;
      
      result.current.longPressHandlers.onTouchMove(moveEvent);
    });
    
    expect(result.current.isPressing).toBe(false);
    
    // Advance timer - should not trigger
    act(() => {
      vi.advanceTimersByTime(500);
    });
    
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('allows small movement within threshold', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => 
      useLongPress({ onLongPress, duration: 500, moveThreshold: 10 })
    );
    
    // Touch start
    act(() => {
      const startEvent = {
        touches: [{ clientX: 100, clientY: 100 }],
        target: document.createElement('div'),
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as React.TouchEvent;
      
      result.current.longPressHandlers.onTouchStart(startEvent);
    });
    
    // Small movement within threshold
    act(() => {
      const moveEvent = {
        touches: [{ clientX: 105, clientY: 103 }], // ~6px movement
        preventDefault: vi.fn(),
      } as unknown as React.TouchEvent;
      
      result.current.longPressHandlers.onTouchMove(moveEvent);
    });
    
    // Should still be pressing
    expect(result.current.isPressing).toBe(true);
    
    // Advance timer - should trigger
    act(() => {
      vi.advanceTimersByTime(500);
    });
    
    expect(onLongPress).toHaveBeenCalled();
  });

  it('cancels on touch cancel', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));
    
    // Touch start
    act(() => {
      const startEvent = {
        touches: [{ clientX: 100, clientY: 100 }],
        target: document.createElement('div'),
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as React.TouchEvent;
      
      result.current.longPressHandlers.onTouchStart(startEvent);
    });
    
    expect(result.current.isPressing).toBe(true);
    
    // Touch cancel
    act(() => {
      result.current.longPressHandlers.onTouchCancel();
    });
    
    expect(result.current.isPressing).toBe(false);
    
    // Advance timer - should not trigger
    act(() => {
      vi.advanceTimersByTime(500);
    });
    
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('prevents context menu when configured', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => 
      useLongPress({ onLongPress, preventContextMenu: true })
    );
    
    const contextEvent = {
      preventDefault: vi.fn(),
    } as unknown as React.MouseEvent;
    
    result.current.longPressHandlers.onContextMenu(contextEvent);
    
    expect(contextEvent.preventDefault).toHaveBeenCalled();
  });

  it('respects enabled flag', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => 
      useLongPress({ onLongPress, enabled: false })
    );
    
    // Touch start - should not start pressing
    act(() => {
      const startEvent = {
        touches: [{ clientX: 100, clientY: 100 }],
        target: document.createElement('div'),
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as React.TouchEvent;
      
      result.current.longPressHandlers.onTouchStart(startEvent);
    });
    
    expect(result.current.isPressing).toBe(false);
    
    act(() => {
      vi.advanceTimersByTime(500);
    });
    
    expect(onLongPress).not.toHaveBeenCalled();
  });
});
