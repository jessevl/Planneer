/**
 * @file useVisibleCenterOffset.ts
 * @description Keeps an overlay control centred on the visible slice of a tall
 *              element instead of on the element itself.
 *
 * `absolute top-1/2` centres against the full height of the positioned
 * ancestor. When that ancestor is taller than the screen — a long list, a tall
 * board column — the midpoint sits somewhere down in the content, so the
 * control is off-screen until you scroll to it.
 *
 * This measures where the element actually overlaps its scroll container and
 * returns the centre of that overlap, in pixels from the element's own top, so
 * a control placed there stays put in the middle of the screen as you scroll.
 */
import { useCallback, useEffect, useState, type RefObject } from 'react';

/** Walks up to the element's scroll container, falling back to the viewport. */
const findScrollParent = (element: HTMLElement): HTMLElement | null => {
  let node = element.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
};

export function useVisibleCenterOffset(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean
): number | null {
  const [offset, setOffset] = useState<number | null>(null);

  const measure = useCallback(() => {
    const element = ref.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const scrollParent = findScrollParent(element);
    const viewTop = scrollParent ? scrollParent.getBoundingClientRect().top : 0;
    const viewBottom = scrollParent
      ? scrollParent.getBoundingClientRect().bottom
      : window.innerHeight;

    const visibleTop = Math.max(rect.top, viewTop);
    const visibleBottom = Math.min(rect.bottom, viewBottom);
    // Scrolled fully out of view: leave the last position rather than jumping.
    if (visibleBottom <= visibleTop) return;

    const next = Math.round((visibleTop + visibleBottom) / 2 - rect.top);
    setOffset((current) => (current === next ? current : next));
  }, [ref]);

  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element) {
      setOffset(null);
      return;
    }

    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };

    measure();

    // Capture catches scrolls on any ancestor, not just the one we found.
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);

    // Content growing or shrinking moves the midpoint too.
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    const scrollParent = findScrollParent(element);
    if (scrollParent) observer.observe(scrollParent);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      observer.disconnect();
    };
  }, [enabled, measure, ref]);

  return offset;
}

export default useVisibleCenterOffset;
