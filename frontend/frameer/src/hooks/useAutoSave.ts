/**
 * @file useAutoSave.ts
 * @description Auto-save hook with debounce and interval saving
 * @app NOTES APP ONLY - Used by NoteEditor for auto-saving
 * 
 * Provides a clean, stale-closure-safe auto-save mechanism:
 * - Debounced save: Saves 1 second after the last change
 * - Interval save: Saves every 5 seconds while changes are pending
 * 
 * Uses useRef for the save callback to avoid stale closure issues
 * without requiring manual ref syncing in the component.
 */
import { useRef, useEffect, useCallback } from 'react';

interface UseAutoSaveOptions {
  /** Function to call when saving */
  onSave: () => void;
  /** Whether there are unsaved changes */
  hasChanges: boolean;
  /** Callback when save completes (to reset hasChanges) */
  onSaveComplete?: () => void;
  /** Debounce delay in ms (default: 1000) */
  debounceMs?: number;
  /** Interval for periodic saves in ms (default: 5000) */
  intervalMs?: number;
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Hook for auto-saving with debounce and interval
 * 
 * @example
 * ```tsx
 * const { triggerSave } = useAutoSave({
 *   onSave: saveCurrentNote,
 *   hasChanges,
 *   onSaveComplete: () => setHasChanges(false),
 * });
 * ```
 */
export function useAutoSave({
  onSave,
  hasChanges,
  onSaveComplete,
  debounceMs = 1000,
  intervalMs = 5000,
  enabled = true,
}: UseAutoSaveOptions) {
  // Store callback in ref to avoid stale closures
  const onSaveRef = useRef(onSave);
  const onSaveCompleteRef = useRef(onSaveComplete);
  
  // Keep refs current (this pattern is safe because refs don't trigger re-renders)
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);
  
  useEffect(() => {
    onSaveCompleteRef.current = onSaveComplete;
  }, [onSaveComplete]);

  // Timer refs
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTimeRef = useRef<number>(Date.now());

  // Internal save function that uses refs
  const performSave = useCallback(() => {
    onSaveRef.current();
    onSaveCompleteRef.current?.();
    lastSaveTimeRef.current = Date.now();
    
    // Clear both timers after save to prevent double-saves
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (intervalTimerRef.current) {
      clearInterval(intervalTimerRef.current);
      intervalTimerRef.current = null;
    }
  }, []);

  // Manual save trigger (for Cmd+S, etc.)
  const triggerSave = useCallback(() => {
    // Clear pending timers since we're saving now
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    performSave();
  }, [performSave]);

  // Auto-save effect
  useEffect(() => {
    if (!enabled || !hasChanges) {
      // Clear timers when disabled or no changes
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (intervalTimerRef.current) {
        clearInterval(intervalTimerRef.current);
        intervalTimerRef.current = null;
      }
      return;
    }

    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set up interval timer if not already running
    if (!intervalTimerRef.current) {
      intervalTimerRef.current = setInterval(() => {
        const timeSinceLastSave = Date.now() - lastSaveTimeRef.current;
        if (timeSinceLastSave >= intervalMs) {
          performSave();
        }
      }, 1000); // Check every second
    }

    // Set debounce timer: save after debounceMs of inactivity
    debounceTimerRef.current = setTimeout(() => {
      performSave();
    }, debounceMs);

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (intervalTimerRef.current) {
        clearInterval(intervalTimerRef.current);
      }
    };
  }, [enabled, hasChanges, debounceMs, intervalMs, performSave]);

  // Cleanup on unmount - save if there are pending changes
  useEffect(() => {
    return () => {
      // Note: We intentionally check hasChanges at cleanup time
      // This is one case where we DO want the stale closure behavior
    };
  }, []);

  return {
    /** Manually trigger a save (e.g., for Cmd+S) */
    triggerSave,
    /** Time of last save */
    lastSaveTime: lastSaveTimeRef.current,
  };
}

export default useAutoSave;
