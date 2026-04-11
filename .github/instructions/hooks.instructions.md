---
applyTo: 'frontend/src/hooks/**/*.ts'
---

# Custom Hooks Guidelines

## File Structure

```typescript
/**
 * @file useHookName.ts
 * @description Brief description
 * @app TASKS|PAGES|SHARED
 * 
 * @example
 * const { isPressed, handlers } = useLongPress(callback, 500);
 */
import { useState, useCallback } from 'react';

export interface UseHookNameOptions {
  delay?: number;
  onStart?: () => void;
}

export interface UseHookNameReturn {
  isActive: boolean;
  handlers: {
    onPointerDown: (e: PointerEvent) => void;
    onPointerUp: () => void;
  };
}

export function useHookName(
  callback: () => void,
  options: UseHookNameOptions = {}
): UseHookNameReturn {
  // Implementation
}
```

## Existing Hooks

Before creating new hooks, check these existing ones:

| Hook | Purpose |
|------|---------|
| `useLongPress` | Long-press detection for touch |
| `useClickOutside` | Detect clicks outside element |
| `useAutoSave` | Debounced autosave logic |
| `useIsTouch` | Detect touch device |
| `useTaskContextMenu` | Task context menu state |
| `usePageContextMenu` | Page context menu state |

## Planned Hooks

These hooks should be created to reduce duplication:

### `useSelectable`

Consolidates selection/context menu patterns from TaskRow, CompactTaskRow, PageRow, PageCard:

```typescript
interface UseSelectableOptions<T> {
  item: T;
  getId: (item: T) => string;
  selectionStore: SelectionStore;
  onContextMenu?: (item: T) => void;
}

interface UseSelectableReturn {
  isSelected: boolean;
  handleRowClick: (e: React.MouseEvent) => void;
  longPressHandlers: LongPressHandlers;
  isTouchHoldActive: boolean;
}

export function useSelectable<T>(options: UseSelectableOptions<T>): UseSelectableReturn {
  const isTouch = useIsTouch();
  const selectionMode = useSelectionStore((s) => s.selectionMode);
  
  // Consolidate ~80 lines of duplicated logic
}
```

## Testing Hooks

Use React Testing Library's `renderHook`:

```typescript
import { renderHook, act } from '@testing-library/react';
import { useLongPress } from './useLongPress';

describe('useLongPress', () => {
  it('triggers callback after delay', async () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    
    const { result } = renderHook(() => useLongPress(callback, { delay: 500 }));
    
    act(() => {
      result.current.handlers.onPointerDown({ button: 0 } as any);
    });
    
    expect(callback).not.toHaveBeenCalled();
    
    act(() => {
      vi.advanceTimersByTime(500);
    });
    
    expect(callback).toHaveBeenCalledTimes(1);
    
    vi.useRealTimers();
  });
});
```

## Rules

1. **Single Responsibility**: One hook = one concern
2. **Return Typed Objects**: Always define return interface
3. **Memoize Handlers**: Use `useCallback` for event handlers
4. **Document Usage**: Include @example in JSDoc
5. **Test Coverage**: All hooks need tests
