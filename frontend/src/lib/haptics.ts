/**
 * @file haptics.ts
 * @description Haptic feedback utilities for mobile devices
 * 
 * Provides vibration feedback for touch interactions on supported devices.
 * Falls back gracefully on devices without vibration support.
 */

type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

const hapticPatterns: Record<HapticType, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 30,
  success: [10, 50, 20],
  warning: [20, 30, 20],
  error: [30, 50, 30, 50, 30],
  selection: 5,
};

/**
 * Check if haptic feedback is available
 */
export function isHapticSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/**
 * Trigger haptic feedback
 * @param type - Type of haptic feedback
 */
export function haptic(type: HapticType = 'light'): void {
  if (!isHapticSupported()) return;
  
  try {
    const pattern = hapticPatterns[type];
    navigator.vibrate(pattern);
  } catch {
    // Silently fail - haptics are enhancement only
  }
}

/**
 * Trigger haptic feedback on task completion
 */
export function hapticTaskComplete(): void {
  haptic('success');
}

/**
 * Trigger haptic feedback on long press
 */
export function hapticLongPress(): void {
  haptic('medium');
}

/**
 * Trigger haptic feedback on drag start
 */
export function hapticDragStart(): void {
  haptic('light');
}

/**
 * Trigger haptic feedback on drag drop
 */
export function hapticDragDrop(): void {
  haptic('medium');
}

/**
 * Trigger haptic feedback on selection
 */
export function hapticSelection(): void {
  haptic('selection');
}

/**
 * Trigger haptic feedback on error
 */
export function hapticError(): void {
  haptic('error');
}

/**
 * Trigger haptic feedback on warning
 */
export function hapticWarning(): void {
  haptic('warning');
}
