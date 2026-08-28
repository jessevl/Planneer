/**
 * @file useKeyboardInset.ts
 * @description Bottom inset for `position: fixed` elements that must sit just
 *              above the on-screen keyboard.
 *
 * `useKeyboardVisibility` reports the keyboard's *size* (`window.innerHeight -
 * visualViewport.height`), which is not the same as the offset a fixed element
 * needs. Fixed elements are laid out against the layout viewport, and when the
 * keyboard opens the browser also scrolls the visual viewport up to reveal the
 * focused field. Offsetting by the full keyboard height on top of that scroll
 * lifts the element roughly twice as far as intended — it ends up floating in
 * the middle of the screen instead of resting on the keyboard.
 *
 * The correct offset is how much of the layout viewport sits below the visible
 * area: `innerHeight - visualViewport.height - visualViewport.offsetTop`. That
 * also stays correct under `interactive-widget=resizes-content`, where the
 * layout viewport itself shrinks and the answer is simply 0.
 */
import { useEffect, useState } from 'react';

export interface KeyboardInsetState {
  /** Whether an on-screen keyboard (rather than a browser chrome change) is up. */
  isKeyboardOpen: boolean;
  /**
   * Layout-viewport pixels hidden below the visible area. Use directly as the
   * `bottom` of a fixed element to park it on top of the keyboard.
   */
  bottomInset: number;
}

/**
 * Height loss below which the change is attributed to browser chrome (address
 * bar collapsing) rather than a keyboard.
 */
const KEYBOARD_THRESHOLD_PX = 150;

const INITIAL_STATE: KeyboardInsetState = { isKeyboardOpen: false, bottomInset: 0 };

export function useKeyboardInset(): KeyboardInsetState {
  const [state, setState] = useState<KeyboardInsetState>(INITIAL_STATE);

  useEffect(() => {
    const viewport = typeof window === 'undefined' ? null : window.visualViewport;
    if (!viewport) return;

    let frame = 0;

    const measure = () => {
      frame = 0;
      // visualViewport height/offsetTop are already in CSS pixels of the layout
      // viewport, so they need no scale conversion.
      const hiddenBelow = window.innerHeight - viewport.height - viewport.offsetTop;
      const bottomInset = Math.max(0, Math.round(hiddenBelow));
      const isKeyboardOpen = window.innerHeight - viewport.height > KEYBOARD_THRESHOLD_PX;

      setState((current) =>
        current.isKeyboardOpen === isKeyboardOpen && current.bottomInset === bottomInset
          ? current
          : { isKeyboardOpen, bottomInset }
      );
    };

    // The keyboard animates in, firing resize/scroll on every frame; coalesce.
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    viewport.addEventListener('resize', schedule);
    viewport.addEventListener('scroll', schedule);
    measure();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', schedule);
      viewport.removeEventListener('scroll', schedule);
    };
  }, []);

  return state;
}

export default useKeyboardInset;
