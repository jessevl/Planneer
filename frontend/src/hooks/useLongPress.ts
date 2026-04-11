/**
 * @file useLongPress.ts
 * @description Long-press gesture hook for mobile context menus
 * @app MOBILE - Replaces right-click with long-press on touch devices
 * 
 * Provides long-press detection with:
 * - Configurable press duration
 * - Prevention of context menu on long press
 * - Cancellation on movement or scroll
 * - Visual feedback state
 * - Haptic feedback timing callback
 * 
 * Usage:
 * ```tsx
 * const { longPressHandlers, isLongPressing } = useLongPress({
 *   onLongPress: (e) => openContextMenu(e),
 *   duration: 500,
 * });
 * 
 * return <div {...longPressHandlers}>{content}</div>;
 * ```
 */

import { useRef, useCallback, useState } from 'react';
import { hapticLongPress } from '@/lib/haptics';

// ============================================================================
// TYPES
// ============================================================================

export interface LongPressOptions {
  /** Callback when long press is triggered */
  onLongPress: (event: React.TouchEvent | React.MouseEvent) => void;
  /** Optional callback on regular tap/click (not long press) */
  onClick?: (event: React.TouchEvent | React.MouseEvent) => void;
  /** Duration in ms to trigger long press (default: 500) */
  duration?: number;
  /** Maximum movement (px) before cancelling (default: 10) */
  moveThreshold?: number;
  /** Whether to prevent default context menu (default: true) */
  preventContextMenu?: boolean;
  /** Whether long press is enabled (default: true) */
  enabled?: boolean;
  /** Callback when long press starts (for haptic feedback) */
  onLongPressStart?: () => void;
}

export interface LongPressResult {
  /** Event handlers to spread on the element */
  longPressHandlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onTouchCancel: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
    onMouseDown?: (e: React.MouseEvent) => void;
    onMouseUp?: () => void;
    onMouseLeave?: () => void;
  };
  /** Whether currently in a long press state */
  isLongPressing: boolean;
  /** Whether the timer is active (press started, not yet triggered) */
  isPressing: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

import { TOUCH_GESTURES } from '@/lib/config';

const DEFAULT_DURATION = TOUCH_GESTURES.LONG_PRESS_DURATION_MS;
const DEFAULT_MOVE_THRESHOLD = TOUCH_GESTURES.LONG_PRESS_MOVE_THRESHOLD_PX;

// ============================================================================
// HOOK
// ============================================================================

export function useLongPress(options: LongPressOptions): LongPressResult {
  const {
    onLongPress,
    onClick,
    duration = DEFAULT_DURATION,
    moveThreshold = DEFAULT_MOVE_THRESHOLD,
    preventContextMenu = true,
    enabled = true,
    onLongPressStart,
  } = options;
  
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggered = useRef(false);
  const eventRef = useRef<React.TouchEvent | React.MouseEvent | null>(null);
  
  const [isPressing, setIsPressing] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false);
  
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  
  const reset = useCallback(() => {
    clearTimer();
    startPos.current = null;
    longPressTriggered.current = false;
    eventRef.current = null;
    setIsPressing(false);
    setIsLongPressing(false);
  }, [clearTimer]);
  
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) {
      return;
    }
    
    const touch = e.touches[0];
    startPos.current = { x: touch.clientX, y: touch.clientY };
    longPressTriggered.current = false;
    eventRef.current = e;
    
    setIsPressing(true);
    
    timerRef.current = setTimeout(() => {
      longPressTriggered.current = true;
      setIsLongPressing(true);
      
      // Trigger haptic feedback
      hapticLongPress();
      onLongPressStart?.();
      
      // Trigger the long press callback
      if (eventRef.current) {
        onLongPress(eventRef.current);
      }
    }, duration);
  }, [enabled, duration, onLongPress, onLongPressStart]);
  
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPressing || !startPos.current) return;
    
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - startPos.current.x);
    const deltaY = Math.abs(touch.clientY - startPos.current.y);
    
    // Cancel if moved too far
    if (deltaX > moveThreshold || deltaY > moveThreshold) {
      reset();
    }
  }, [isPressing, moveThreshold, reset]);
  
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    // If long press was triggered, don't fire click
    if (longPressTriggered.current) {
      e.preventDefault();
      e.stopPropagation();
      reset();
      return;
    }
    
    // If timer is still running, this was a tap
    if (timerRef.current && onClick) {
      // Check if target is a button, input, or other clickable element
      // If so, we don't preventDefault to allow the native click to fire
      const target = e.target as HTMLElement;
      const isClickable = target.closest('button, input, a, [role="button"], [role="checkbox"]');
      
      if (isClickable) {
        reset();
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      onClick(e);
    }
    
    reset();
  }, [onClick, reset]);
  
  const handleTouchCancel = useCallback(() => {
    reset();
  }, [reset]);
  
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (preventContextMenu) {
      e.preventDefault();
    }
  }, [preventContextMenu]);
  
  // Mouse handlers for desktop long-press (optional)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!enabled) return;
    
    // Only left click
    if (e.button !== 0) return;
    
    startPos.current = { x: e.clientX, y: e.clientY };
    longPressTriggered.current = false;
    eventRef.current = e;
    
    setIsPressing(true);
    
    timerRef.current = setTimeout(() => {
      longPressTriggered.current = true;
      setIsLongPressing(true);
      onLongPressStart?.();
      
      if (eventRef.current) {
        onLongPress(eventRef.current);
      }
    }, duration);
  }, [enabled, duration, onLongPress, onLongPressStart]);
  
  const handleMouseUp = useCallback(() => {
    if (!longPressTriggered.current && timerRef.current && onClick) {
      // Handled by native click
    }
    reset();
  }, [reset, onClick]);
  
  const handleMouseLeave = useCallback(() => {
    reset();
  }, [reset]);
  
  return {
    longPressHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchCancel,
      onContextMenu: handleContextMenu,
      onMouseDown: handleMouseDown,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseLeave,
    },
    isLongPressing,
    isPressing,
  };
}

export default useLongPress;
