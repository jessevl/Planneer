/**
 * @file EditorMobileBlockSelection.tsx
 * @description Touch path for selecting whole blocks, and copying them.
 * @app PAGES - Rendered inside PageEditor for mobile/tablet
 *
 * Yoopta builds cross-block selection itself, from `mousedown` → `mousemove` →
 * `mouseup` on the editor root. Chrome Android synthesizes mouse events for a
 * tap but never for a drag, so that path cannot fire on touch and blocks are
 * simply unselectable there.
 *
 * The browser's own selection cannot fill the gap: each block is its own
 * contenteditable, and Blink confines selection extension to the editing host —
 * a dragged handle, Shift+Arrow, and even `Selection.extend` all clamp at the
 * block boundary. So the native handle can never reach the next block.
 *
 * Instead, when a text selection runs up against a block boundary — the moment
 * the user was trying to keep going — a pill offers to promote it to a whole
 * block selection. From there taps extend the range and a bar copies it.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Paths, useYooptaEditor } from '@yoopta/editor';
import { Copy, ListChecks, TextSelect, CheckCheck, X } from 'lucide-react';

/** Finger travel (px) above which a touch is a scroll, not a tap. */
const TAP_SLOP_PX = 10;
/** How long the "Copied" confirmation stays up. */
const COPIED_FEEDBACK_MS = 1600;

const BLOCK_SELECTOR = '[data-yoopta-block-id]';
/** Marks our own UI so block taps can ignore touches that land on it. */
const UI_ATTR = 'data-block-selection-ui';

type PillAnchor = {
  order: number;
  /** Viewport coordinates for the pill's centre-top. */
  left: number;
  top: number;
};

const readBlockOrder = (
  editor: ReturnType<typeof useYooptaEditor>,
  element: Element | null
): number | null => {
  const id = element?.getAttribute('data-yoopta-block-id');
  const order = id ? editor.children[id]?.meta.order : undefined;
  return typeof order === 'number' ? order : null;
};

const EditorMobileBlockSelection: React.FC = () => {
  const editor = useYooptaEditor();
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [pill, setPill] = useState<PillAnchor | null>(null);
  const [copied, setCopied] = useState(false);

  /** Block the range extends from, so a tap selects anchor..tapped. */
  const anchorOrderRef = useRef<number | null>(null);
  const hasSelection = selectedOrders.length > 0;
  const hasSelectionRef = useRef(hasSelection);
  hasSelectionRef.current = hasSelection;

  // ---------------------------------------------------------------- selection

  useEffect(() => {
    const sync = () => {
      const paths = Paths.getSelectedPaths(editor);
      const next = Array.isArray(paths) ? [...paths].sort((a, b) => a - b) : [];
      setSelectedOrders((current) =>
        current.length === next.length && current.every((order, i) => order === next[i])
          ? current
          : next
      );
      if (next.length === 0) anchorOrderRef.current = null;
    };

    sync();
    editor.on('path-change', sync);
    return () => editor.off('path-change', sync);
  }, [editor]);

  const selectRange = useCallback(
    (from: number, to: number) => {
      const start = Math.min(from, to);
      const end = Math.max(from, to);
      const orders = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      editor.setPath({ current: to, selected: orders });
    },
    [editor]
  );

  const clearSelection = useCallback(() => {
    anchorOrderRef.current = null;
    editor.setPath({ current: null });
  }, [editor]);

  // ------------------------------------------------------------------- pill

  const measurePill = useCallback(() => {
    // Once blocks are selected the pill has done its job.
    if (hasSelectionRef.current) {
      setPill(null);
      return;
    }

    const selection = document.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      setPill(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
    const blockElement = element?.closest?.(BLOCK_SELECTOR) ?? null;
    const order = readBlockOrder(editor, blockElement);
    if (!blockElement || order === null) {
      setPill(null);
      return;
    }

    // Only offer the promotion once the selection has run out of block to
    // cover — that is the point at which dragging the handle stops responding.
    // Measured as "no text left over" rather than by comparing boundary points,
    // which never line up: the selection ends deep inside the block's nested
    // markup while the block's own end boundary sits outside all of it.
    const leading = document.createRange();
    leading.setStart(blockElement, 0);
    leading.setEnd(range.startContainer, range.startOffset);

    const trailing = document.createRange();
    trailing.setStart(range.endContainer, range.endOffset);
    trailing.setEnd(blockElement, blockElement.childNodes.length);

    const atStart = leading.toString().trim().length === 0;
    const atEnd = trailing.toString().trim().length === 0;
    if (!atStart && !atEnd) {
      setPill(null);
      return;
    }

    const rect = blockElement.getBoundingClientRect();
    setPill({ order, left: rect.left + rect.width / 2, top: rect.bottom + 8 });
  }, [editor]);

  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measurePill();
      });
    };

    document.addEventListener('selectionchange', schedule);
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener('selectionchange', schedule);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
    };
  }, [measurePill]);

  useEffect(() => {
    if (hasSelection) setPill(null);
  }, [hasSelection]);

  const promoteToBlockSelection = useCallback(() => {
    if (!pill) return;
    const { order } = pill;

    // blur() resets the path, so drop the caret and keyboard before selecting.
    editor.blur();
    document.getSelection()?.removeAllRanges();

    anchorOrderRef.current = order;
    editor.setPath({ current: order, selected: [order] });
    setPill(null);
  }, [editor, pill]);

  // -------------------------------------------------------- tap to extend

  useEffect(() => {
    if (!hasSelection) return;

    let start: { x: number; y: number } | null = null;

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      start = touch ? { x: touch.clientX, y: touch.clientY } : null;
    };

    const onTouchEnd = (event: TouchEvent) => {
      const from = start;
      start = null;
      if (!from) return;

      const touch = event.changedTouches[0];
      if (touch) {
        const movedX = Math.abs(touch.clientX - from.x);
        const movedY = Math.abs(touch.clientY - from.y);
        if (movedX > TAP_SLOP_PX || movedY > TAP_SLOP_PX) return;
      }

      const target = event.target as Element | null;
      if (!target || target.closest(`[${UI_ATTR}]`)) return;

      const blockElement = target.closest(BLOCK_SELECTOR);
      const order = readBlockOrder(editor, blockElement);
      if (order === null) return;

      // Cancelling the tap keeps the caret out of the block, which would
      // otherwise drop the selection and re-open the keyboard.
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();

      const anchor = anchorOrderRef.current;
      if (anchor === null) {
        anchorOrderRef.current = order;
        editor.setPath({ current: order, selected: [order] });
        return;
      }
      selectRange(anchor, order);
    };

    document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    document.addEventListener('touchend', onTouchEnd, { capture: true, passive: false });

    return () => {
      document.removeEventListener('touchstart', onTouchStart, true);
      document.removeEventListener('touchend', onTouchEnd, true);
    };
  }, [editor, hasSelection, selectRange]);

  // ------------------------------------------------------------------ actions

  const allOrders = useMemo(() => {
    if (!hasSelection) return [];
    return Object.values(editor.getEditorValue())
      .map((block) => block.meta.order)
      .sort((a, b) => a - b);
  }, [editor, hasSelection, selectedOrders]);

  const selectAll = useCallback(() => {
    if (allOrders.length === 0) return;
    anchorOrderRef.current = allOrders[0];
    editor.setPath({ current: allOrders[allOrders.length - 1], selected: allOrders });
  }, [allOrders, editor]);

  const copySelection = useCallback(async () => {
    // Both serializers filter to the selected paths and sort by block order.
    const content = editor.getEditorValue();
    const html = editor.getHTML(content);
    const text = editor.getPlainText(content);

    const writeRichText = async () => {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        throw new Error('Rich clipboard unavailable');
      }
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ]);
    };

    try {
      await writeRichText();
    } catch {
      try {
        await navigator.clipboard?.writeText(text);
      } catch {
        return;
      }
    }

    setCopied(true);
  }, [editor]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (!hasSelection) setCopied(false);
  }, [hasSelection]);

  // ------------------------------------------------------------------- render

  const allSelected = hasSelection && selectedOrders.length === allOrders.length;

  return (
    <>
      {pill && !hasSelection && (
        <button
          type="button"
          {...{ [UI_ATTR]: true }}
          onClick={promoteToBlockSelection}
          className="fixed z-[160] flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[var(--color-border-default)] bg-[var(--color-surface-base)]/95 px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] shadow-lg backdrop-blur-xl"
          style={{ left: pill.left, top: pill.top }}
        >
          <TextSelect size={14} />
          Select blocks
        </button>
      )}

      {hasSelection && (
        <div
          {...{ [UI_ATTR]: true }}
          role="toolbar"
          aria-label="Block selection"
          className="fixed left-1/2 z-[160] flex -translate-x-1/2 items-center gap-1 rounded-full border border-[var(--color-border-default)] bg-[var(--color-surface-base)]/95 px-2 py-1.5 shadow-lg backdrop-blur-xl"
          // Sits above the editor FAB, which keeps the bottom slot.
          style={{ bottom: 'calc(max(1rem, env(safe-area-inset-bottom)) + 4.5rem)' }}
        >
          <span className="px-2 text-xs font-medium tabular-nums text-[var(--color-text-secondary)]">
            {selectedOrders.length} selected
          </span>

          <button
            type="button"
            onClick={selectAll}
            disabled={allSelected}
            aria-label="Select all blocks"
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-primary)] disabled:opacity-40"
          >
            <ListChecks size={14} />
            All
          </button>

          <button
            type="button"
            onClick={copySelection}
            aria-label="Copy selected blocks"
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-primary)]"
          >
            {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>

          <button
            type="button"
            onClick={clearSelection}
            aria-label="Clear selection"
            className="flex items-center justify-center rounded-full p-1.5 text-[var(--color-text-tertiary)]"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
};

export default EditorMobileBlockSelection;
