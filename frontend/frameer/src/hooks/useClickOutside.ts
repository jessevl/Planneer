/**
 * @file useClickOutside.ts
 * @description Hook for detecting clicks outside of specified elements
 * @app SHARED - Generic utility hook used throughout the app
 * 
 * Registers a document click listener and invokes callbacks when clicks
 * occur outside the provided ref elements.
 * 
 * Usage:
 * ```
 * useClickOutside([
 *   { ref: dropdownRef, onOutside: () => setOpen(false) },
 *   { ref: modalRef, onOutside: closeModal }
 * ]);
 * ```
 * 
 * Used by:
 * - ViewSwitcher (close dropdown on outside click)
 * - AddTaskForm (close dropdowns)
 * - Any popover/dropdown component
 */
import { useEffect, useRef } from 'react';

type RefCallback = {
  ref: React.RefObject<HTMLElement | null>;
  onOutside: (e: MouseEvent) => void;
};

/**
 * Callbacks when clicks occur outside the provided refs.
 * Accepts an array of { ref, onOutside } entries. Each onOutside is invoked
 * when a click happens that is not contained within that ref's element.
 */
export default function useClickOutside(items: RefCallback[]) {
  const itemsRef = useRef<RefCallback[]>(items);
  // keep latest array and handlers without re-subscribing the document listener
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const arr = itemsRef.current;
      for (const it of arr) {
        const el = it.ref?.current;
        if (!el) continue;
        if (!el.contains(target)) {
          try {
            it.onOutside(e);
          } catch (err) {
            console.error('useClickOutside handler error', err);
          }
        }
      }
    };
    // Use mousedown instead of click - click events can be stopped by stopPropagation
    // but mousedown fires before that
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);
}
