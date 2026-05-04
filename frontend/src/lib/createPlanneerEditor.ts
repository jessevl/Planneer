/**
 * @file createPlanneerEditor.ts
 * @description Factory that wraps Yoopta's createYooptaEditor with Planneer-
 *              specific workarounds. Consolidates all monkey-patches in one
 *              place so they are easy to audit when upgrading Yoopta.
 *
 * Workarounds applied:
 *  1. toggleBlock — always passes preserveContent:true so markdown shortcuts
 *     (## , - , etc.) don't wipe block content.
 *  2. moveBlock — suppressed when a column drop is pending (dropPendingRef).
 *  3. isRemoteSlateOp — flag checked by Yoopta's Slate apply interceptor to
 *     bypass the operation wrapper during remote content sync.
 */
import { createYooptaEditor, type YooEditor } from '@yoopta/editor';
import type { DropPending } from '@/components/pages/SideDropIndicator';

function afterNextPaint(callback: () => void): void {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => callback());
    return;
  }

  callback();
}

function findScrollableAncestor(start: HTMLElement | null): HTMLElement | null {
  let current = start;

  while (current) {
    const { overflowY } = window.getComputedStyle(current);
    if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function captureActiveScrollPosition() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  const activeElement = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  const scrollContainer = findScrollableAncestor(activeElement);

  if (!scrollContainer) {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    return () => window.scrollTo(scrollX, scrollY);
  }

  const { scrollLeft, scrollTop } = scrollContainer;

  return () => {
    scrollContainer.scrollLeft = scrollLeft;
    scrollContainer.scrollTop = scrollTop;
  };
}

export interface PlanneerEditorRefs {
  /** When non-null, moveBlock is suppressed (column drop in progress) */
  dropPendingRef: React.MutableRefObject<DropPending | null>;
  /** When true, Yoopta's Slate interceptor bypasses its operation wrapper */
  isApplyingRemoteRef: React.MutableRefObject<boolean>;
}

export interface PlanneerEditor extends YooEditor {
  /** Original unwrapped moveBlock for use in column handlers */
  originalMoveBlock: YooEditor['moveBlock'];
  /** Original unwrapped toggleBlock — used by slash menu to avoid preserveContent override */
  originalToggleBlock: YooEditor['toggleBlock'];
}

function applyToggleBlockPreserveContentBehavior(editor: PlanneerEditor): void {
  const originalToggleBlock = editor.toggleBlock.bind(editor);
  editor.originalToggleBlock = originalToggleBlock;
  editor.toggleBlock = (type: string, options: Parameters<YooEditor['toggleBlock']>[1] = {}) => {
    const restoreScroll = captureActiveScrollPosition();
    const result = originalToggleBlock(type, { ...options, preserveContent: true });
    afterNextPaint(() => afterNextPaint(restoreScroll));
    return result;
  };
}

function applyMoveBlockDropGuard(
  editor: PlanneerEditor,
  refs: PlanneerEditorRefs,
): void {
  const originalMoveBlock = editor.moveBlock.bind(editor);
  editor.originalMoveBlock = originalMoveBlock;
  editor.moveBlock = (blockId: string, path: number | null) => {
    if (refs.dropPendingRef.current) return;
    try {
      originalMoveBlock(blockId, path);
    } catch {
      // Slate selection may reference stale paths after block reorders.
    }
  };
}

function attachRemoteSlateOpBridge(
  editor: PlanneerEditor,
  refs: PlanneerEditorRefs,
): void {
  (editor as any).isRemoteSlateOp = () => refs.isApplyingRemoteRef.current;
}

/**
 * Create a Yoopta editor with Planneer workarounds already applied.
 * Returns an augmented editor with `originalMoveBlock` for direct use.
 */
export function createPlanneerEditor(
  opts: Parameters<typeof createYooptaEditor>[0],
  refs: PlanneerEditorRefs,
): PlanneerEditor {
  const editor = createYooptaEditor(opts) as PlanneerEditor;

  applyToggleBlockPreserveContentBehavior(editor);
  applyMoveBlockDropGuard(editor, refs);
  attachRemoteSlateOpBridge(editor, refs);

  return editor;
}
