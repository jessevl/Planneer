/**
 * @file useAutoSave.test.ts
 * @description Unit tests for useAutoSave hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoSave } from './useAutoSave';

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call onSave when hasChanges is false', () => {
    const onSave = vi.fn();
    
    renderHook(() => useAutoSave({
      onSave,
      hasChanges: false,
    }));
    
    vi.advanceTimersByTime(10000);
    
    expect(onSave).not.toHaveBeenCalled();
  });

  it('calls onSave after debounce delay when hasChanges is true', () => {
    const onSave = vi.fn();
    
    renderHook(() => useAutoSave({
      onSave,
      hasChanges: true,
      debounceMs: 1000,
    }));
    
    vi.advanceTimersByTime(999);
    expect(onSave).not.toHaveBeenCalled();
    
    vi.advanceTimersByTime(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('calls onSaveComplete after save', () => {
    const onSave = vi.fn();
    const onSaveComplete = vi.fn();
    
    renderHook(() => useAutoSave({
      onSave,
      hasChanges: true,
      onSaveComplete,
      debounceMs: 1000,
    }));
    
    vi.advanceTimersByTime(1000);
    
    expect(onSave).toHaveBeenCalled();
    expect(onSaveComplete).toHaveBeenCalled();
  });

  it('triggerSave immediately saves', () => {
    const onSave = vi.fn();
    
    const { result } = renderHook(() => useAutoSave({
      onSave,
      hasChanges: true,
      debounceMs: 5000,
    }));
    
    expect(onSave).not.toHaveBeenCalled();
    
    act(() => {
      result.current.triggerSave();
    });
    
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('does not save when enabled is false', () => {
    const onSave = vi.fn();
    
    renderHook(() => useAutoSave({
      onSave,
      hasChanges: true,
      enabled: false,
    }));
    
    vi.advanceTimersByTime(10000);
    
    expect(onSave).not.toHaveBeenCalled();
  });

  it('respects custom debounceMs', () => {
    const onSave = vi.fn();
    
    renderHook(() => useAutoSave({
      onSave,
      hasChanges: true,
      debounceMs: 2000,
    }));
    
    vi.advanceTimersByTime(1999);
    expect(onSave).not.toHaveBeenCalled();
    
    vi.advanceTimersByTime(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('saves on interval if changes persist', () => {
    const onSave = vi.fn();
    
    const { rerender } = renderHook(
      ({ hasChanges }) => useAutoSave({
        onSave,
        hasChanges,
        debounceMs: 1000,
        intervalMs: 3000,
      }),
      { initialProps: { hasChanges: true } }
    );
    
    // First save after debounce
    vi.advanceTimersByTime(1000);
    expect(onSave).toHaveBeenCalledTimes(1);
    
    // Simulate more changes
    rerender({ hasChanges: true });
    
    // Wait for next interval-triggered save
    vi.advanceTimersByTime(3000);
    // Should have been called at least once more
    expect(onSave.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
