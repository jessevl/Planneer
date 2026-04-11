/**
 * @file useSwipeActions.ts
 * @description Touch swipe gesture hook for mobile actions
 * @app MOBILE - Enables swipe-to-complete and swipe-to-delete on list items
 * 
 * Provides touch-based swipe gestures for list items:
 * - Swipe right: Primary action (e.g., complete task)
 * - Swipe left: Secondary action (e.g., delete task)
 * 
 * Features:
 * - Configurable swipe threshold
 * - Visual feedback during swipe
 * - Velocity-based action trigger
 * - Haptic feedback support (via callbacks)
 * - Respects prefers-reduced-motion
 * 
 * Usage:
 * ```tsx
 * const { swipeHandlers, swipeState, containerStyle } = useSwipeActions({
 *   onSwipeRight: () => completeTask(),
 *   onSwipeLeft: () => deleteTask(),
 * });
 * 
 * return (
 *   <div {...swipeHandlers} style={containerStyle}>
 *     {content}
 *   </div>
 * );
 * ```
 */

import React, { useState, useRef, useCallback, useMemo, CSSProperties } from 'react';
import { usePrefersReducedMotion } from './useMobileDetection';

// ============================================================================
// TYPES
// ============================================================================

export interface SwipeActionsOptions {
  /** Callback when swiped right past threshold */
  onSwipeRight?: () => void;
  /** Callback when swiped left past threshold */
  onSwipeLeft?: () => void;
  /** Minimum distance (px) to trigger action (default: 80) */
  threshold?: number;
  /** Maximum allowed vertical movement (px) before swipe is cancelled (default: 30) */
  maxVerticalMovement?: number;
  /** Whether swipe actions are enabled (default: true) */
  enabled?: boolean;
  /** Callback during swipe for haptic feedback timing */
  onThresholdCrossed?: (direction: 'left' | 'right') => void;
}

export interface SwipeState {
  /** Current horizontal offset in pixels */
  offsetX: number;
  /** Whether actively swiping */
  isSwiping: boolean;
  /** Direction of current swipe */
  direction: 'left' | 'right' | null;
  /** Whether threshold has been crossed */
  thresholdCrossed: boolean;
}

export interface SwipeActionsResult {
  /** Event handlers to spread on the swipeable element */
  swipeHandlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onTouchCancel: () => void;
  };
  /** Current swipe state for visual feedback */
  swipeState: SwipeState;
  /** CSS transform style to apply to content */
  containerStyle: CSSProperties;
  /** Reset swipe state manually */
  resetSwipe: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_THRESHOLD = 80;
const DEFAULT_MAX_VERTICAL = 30;
const RESISTANCE_FACTOR = 0.5; // Resistance when past threshold

// ============================================================================
// HOOK
// ============================================================================

export function useSwipeActions(options: SwipeActionsOptions): SwipeActionsResult {
  const {
    onSwipeRight,
    onSwipeLeft,
    threshold = DEFAULT_THRESHOLD,
    maxVerticalMovement = DEFAULT_MAX_VERTICAL,
    enabled = true,
    onThresholdCrossed,
  } = options;
  
  const prefersReducedMotion = usePrefersReducedMotion();
  
  // Touch tracking refs
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const hasCrossedThreshold = useRef(false);
  
  // State for visual feedback
  const [swipeState, setSwipeState] = useState<SwipeState>({
    offsetX: 0,
    isSwiping: false,
    direction: null,
    thresholdCrossed: false,
  });
  
  const resetSwipe = useCallback(() => {
    startX.current = 0;
    startY.current = 0;
    currentX.current = 0;
    hasCrossedThreshold.current = false;
    setSwipeState({
      offsetX: 0,
      isSwiping: false,
      direction: null,
      thresholdCrossed: false,
    });
  }, []);
  
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;
    
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    currentX.current = touch.clientX;
    hasCrossedThreshold.current = false;
    
    setSwipeState({
      offsetX: 0,
      isSwiping: true,
      direction: null,
      thresholdCrossed: false,
    });
  }, [enabled]);
  
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enabled || !swipeState.isSwiping) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - startX.current;
    const deltaY = Math.abs(touch.clientY - startY.current);
    
    // Cancel if vertical movement exceeds threshold (user is scrolling)
    if (deltaY > maxVerticalMovement) {
      resetSwipe();
      return;
    }
    
    currentX.current = touch.clientX;
    
    // Check if we have actions for this direction
    const direction = deltaX > 0 ? 'right' : 'left';
    const hasAction = direction === 'right' ? !!onSwipeRight : !!onSwipeLeft;
    
    if (!hasAction) {
      // No action for this direction - don't move
      return;
    }
    
    // Apply resistance when past threshold
    let offset = deltaX;
    const absOffset = Math.abs(offset);
    if (absOffset > threshold) {
      const overshoot = absOffset - threshold;
      offset = (threshold + overshoot * RESISTANCE_FACTOR) * Math.sign(deltaX);
    }
    
    // Check threshold crossing for haptic feedback
    const crossedThreshold = absOffset >= threshold;
    if (crossedThreshold && !hasCrossedThreshold.current) {
      hasCrossedThreshold.current = true;
      onThresholdCrossed?.(direction);
    } else if (!crossedThreshold && hasCrossedThreshold.current) {
      hasCrossedThreshold.current = false;
    }
    
    setSwipeState({
      offsetX: offset,
      isSwiping: true,
      direction,
      thresholdCrossed: crossedThreshold,
    });
  }, [enabled, swipeState.isSwiping, maxVerticalMovement, threshold, onSwipeRight, onSwipeLeft, onThresholdCrossed, resetSwipe]);
  
  const handleTouchEnd = useCallback(() => {
    if (!enabled || !swipeState.isSwiping) return;
    
    const deltaX = currentX.current - startX.current;
    const absOffset = Math.abs(deltaX);
    const direction = deltaX > 0 ? 'right' : 'left';
    
    // Trigger action if threshold crossed
    if (absOffset >= threshold) {
      if (direction === 'right' && onSwipeRight) {
        onSwipeRight();
      } else if (direction === 'left' && onSwipeLeft) {
        onSwipeLeft();
      }
    }
    
    resetSwipe();
  }, [enabled, swipeState.isSwiping, threshold, onSwipeRight, onSwipeLeft, resetSwipe]);
  
  const handleTouchCancel = useCallback(() => {
    resetSwipe();
  }, [resetSwipe]);
  
  // Compute container style for transform
  const containerStyle = useMemo((): CSSProperties => {
    if (!swipeState.isSwiping || swipeState.offsetX === 0) {
      return {
        transform: 'translateX(0)',
        transition: prefersReducedMotion ? 'none' : 'transform 0.2s ease-out',
      };
    }
    
    return {
      transform: `translateX(${swipeState.offsetX}px)`,
      transition: 'none',
    };
  }, [swipeState.isSwiping, swipeState.offsetX, prefersReducedMotion]);
  
  const swipeHandlers = useMemo(() => ({
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel,
  }), [handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel]);
  
  return {
    swipeHandlers,
    swipeState,
    containerStyle,
    resetSwipe,
  };
}

// ============================================================================
// SWIPE ACTION BACKGROUND COMPONENT
// ============================================================================

export interface SwipeActionBackgroundProps {
  direction: 'left' | 'right';
  revealed: boolean;
  thresholdCrossed: boolean;
  icon: React.ReactNode;
  label: string;
  variant: 'success' | 'danger' | 'warning' | 'info';
  className?: string;
}

/**
 * Background component that appears behind swiped content.
 * Shows action icon and changes color when threshold is crossed.
 */
export function SwipeActionBackground({
  direction,
  revealed,
  thresholdCrossed,
  icon,
  label,
  variant,
  className = '',
}: SwipeActionBackgroundProps) {
  const variantClasses = {
    success: thresholdCrossed 
      ? 'bg-green-500 dark:bg-green-600' 
      : 'bg-green-400 dark:bg-green-700',
    danger: thresholdCrossed 
      ? 'bg-red-500 dark:bg-red-600' 
      : 'bg-red-400 dark:bg-red-700',
    warning: thresholdCrossed 
      ? 'bg-amber-500 dark:bg-amber-600' 
      : 'bg-amber-400 dark:bg-amber-700',
    info: thresholdCrossed 
      ? 'bg-blue-500 dark:bg-blue-600' 
      : 'bg-blue-400 dark:bg-blue-700',
  };
  
  if (!revealed) return null;
  
  return (
    <div 
      className={`
        absolute inset-y-0 ${direction === 'right' ? 'left-0' : 'right-0'}
        flex items-center ${direction === 'right' ? 'justify-start pl-4' : 'justify-end pr-4'}
        ${variantClasses[variant]}
        text-white
        transition-colors duration-150
        ${className}
      `}
      style={{ width: '100%' }}
      aria-hidden="true"
    >
      <div className={`
        flex items-center gap-2
        transition-transform duration-150
        ${thresholdCrossed ? 'scale-110' : 'scale-100'}
      `}>
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  );
}
