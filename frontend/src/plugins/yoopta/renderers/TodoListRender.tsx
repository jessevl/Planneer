/**
 * @file TodoListRender.tsx
 * @description Custom TodoList element render with visible checkbox
 * @app PAGES - Used by PageEditor to extend the stock TodoList plugin
 *
 * The stock @yoopta/lists TodoList plugin renders <ul><li>{children}</li></ul>
 * with a `checked` prop but NO visible checkbox.
 *
 * This custom render toggles on mousedown/touchend to avoid requiring caret
 * focus and CSS-only styling via app tokens (no Tailwind utility generation
 * dependencies).
 */
import { useCallback, useEffect, useRef } from 'react';
import type { PluginElementRenderProps } from '@yoopta/editor';
import { Elements, useBlockData, useYooptaEditor, useYooptaReadOnly } from '@yoopta/editor';

/** Max finger travel (px) between touchstart and touchend that still counts as a tap. */
const TAP_SLOP_PX = 10;
/** Window in which synthesized mouse events following a handled tap are ignored. */
const TOUCH_MOUSE_GUARD_MS = 700;

/**
 * Custom TodoList element render with a theme-aware checkbox.
 * Uses the `aria-label` attribute so our globals.css styles can target
 * checked/unchecked states independently.
 */
export const TodoListRender = (props: PluginElementRenderProps) => {
  const { attributes, children, element, blockId } = props;
  const editor = useYooptaEditor();
  const blockData = useBlockData(blockId);
  const isReadOnly = useYooptaReadOnly();
  const checked = !!element.props?.checked;
  const depth = Number((blockData as any)?.meta?.depth ?? 0);
  const safeDepth = Number.isFinite(depth) && depth > 0 ? depth : 0;
  const marginLeft = `${0.75 + safeDepth * 1}rem`;

  const checkboxStyle = {
    width: '1.25rem',
    height: '1.25rem',
    minWidth: '1.25rem',
    minHeight: '1.25rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderRadius: '0.25rem',
    borderStyle: 'solid',
    borderWidth: '2px',
    borderColor: checked
      ? 'var(--color-accent-primary, #3b82f6)'
      : 'hsl(var(--input))',
    backgroundColor: checked
      ? 'var(--color-accent-primary, #3b82f6)'
      : 'hsl(var(--background))',
    color: checked ? '#fff' : 'hsl(var(--input))',
    boxShadow: checked ? 'none' : 'inset 0 0 0 1px hsl(var(--input))',
    cursor: isReadOnly ? 'default' : 'pointer',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
    transition: 'background-color 150ms, border-color 150ms, transform 120ms',
  } as const;

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastTouchToggleAtRef = useRef(0);

  const toggle = useCallback(() => {
    if (isReadOnly) return;

    // Use Elements.updateElement — the proper Yoopta API that goes through
    // Slate's transform pipeline, ensuring immediate visual re-render.
    Elements.updateElement(editor, {
      blockId,
      type: 'todo-list',
      props: { checked: !checked },
    });
  }, [editor, blockId, checked, isReadOnly]);

  const onToggle = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // The touch handler below already toggled and cancelled the tap; the
    // browser-synthesized mouse events must not toggle a second time.
    if (Date.now() - lastTouchToggleAtRef.current < TOUCH_MOUSE_GUARD_MS) return;
    toggle();
  };

  // Touch handling lives on native listeners instead of React's onTouch* props:
  // React registers touchstart/touchmove passively on its root container, so a
  // preventDefault() from a synthetic touch handler is ignored.
  //
  // Cancelling the *touchend* suppresses the whole compatibility tap — the
  // synthesized mouse events, the click, and Chrome's tap-to-focus. Without it
  // Android re-opens the soft keyboard for the editable (which keeps DOM focus
  // even after the keyboard was dismissed) and scrolls the stale caret — often
  // in a block far from the checkbox — back into view.
  // touchstart stays uncancelled so a scroll gesture starting on the checkbox
  // still scrolls; the slop check below keeps that scroll from toggling.
  useEffect(() => {
    const node = buttonRef.current;
    if (!node || isReadOnly) return;

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;

      // Cancelling the tap is not enough on its own: Android re-shows the IME
      // for whichever editable still holds DOM focus (dismissing the keyboard
      // with the back gesture does not blur it), then scrolls its stale caret
      // into view. Giving up that focus before the gesture is processed leaves
      // Chrome with no editable to raise the keyboard for.
      const active = document.activeElement as HTMLElement | null;
      if (active?.isContentEditable) active.blur();
      document.getSelection()?.removeAllRanges();
    };

    const onTouchEnd = (event: TouchEvent) => {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (!start) return;

      const touch = event.changedTouches[0];
      if (touch) {
        const movedX = Math.abs(touch.clientX - start.x);
        const movedY = Math.abs(touch.clientY - start.y);
        if (movedX > TAP_SLOP_PX || movedY > TAP_SLOP_PX) return;
      }

      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
      lastTouchToggleAtRef.current = Date.now();
      toggle();
    };

    const onTouchCancel = () => {
      touchStartRef.current = null;
    };

    node.addEventListener('touchstart', onTouchStart, { passive: true });
    node.addEventListener('touchend', onTouchEnd, { passive: false });
    node.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      node.removeEventListener('touchstart', onTouchStart);
      node.removeEventListener('touchend', onTouchEnd);
      node.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [toggle, isReadOnly]);

  return (
    <div
      {...attributes}
      data-element-type="todo-list"
      data-checked={checked}
      style={{
        marginTop: '0.25rem',
        marginBottom: '0.25rem',
        marginLeft,
        paddingLeft: 0,
        lineHeight: 1.75,
        listStyleType: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '0.25rem' }}>
        <button
          ref={buttonRef}
          type="button"
          contentEditable={false}
          onMouseDown={onToggle}
          aria-label={checked ? 'Mark as unchecked' : 'Mark as checked'}
          tabIndex={-1}
          style={checkboxStyle}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {checked && <path d="M2 6L5 9L10 3" strokeWidth="2.4" />}
          </svg>
        </button>
        <span style={{ flex: 1, minHeight: '1.25rem', display: 'flex', alignItems: 'center', lineHeight: '1.25rem', textDecoration: checked ? 'line-through' : undefined, color: checked ? 'var(--color-text-tertiary, hsl(var(--muted-foreground)))' : undefined }}>
          {children}
        </span>
      </div>
    </div>
  );
};

/**
 * Element map compatible with TodoList.extend({ elements: ... }).
 * Drop-in replacement for ListsUI.TodoList.
 */
export const CustomTodoListElements = {
  'todo-list': {
    render: TodoListRender,
  },
};
