/**
 * @file insertBlockWithFocus.ts
 * @description Shared Yoopta block insertion helper that restores a real
 *              caret after insertion when the block is placed at a known order.
 */
import type { YooEditor } from '@yoopta/editor';
import { focusBlockAtOrder } from './focusBlockAtOrder';

type ScrollContainerLike = Pick<HTMLElement, 'scrollLeft' | 'scrollTop'> | null;

type InsertableYooptaEditor = Pick<
  YooEditor,
  'focus' | 'focusBlock' | 'getEditorValue' | 'insertBlock' | 'setPath'
> & {
  path?: {
    current?: number | null;
  };
};

interface InsertBlockWithFocusOptions {
  order?: number | null;
  scrollContainer?: ScrollContainerLike;
}

function focusEditorFallback(editor: Pick<YooEditor, 'focus'>): void {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => {
      try {
        editor.focus();
      } catch {
        // Ignore focus failures while Yoopta is still reconciling.
      }
    });
    return;
  }

  try {
    editor.focus();
  } catch {
    // Ignore focus failures while Yoopta is still reconciling.
  }
}

export function insertBlockWithFocus(
  editor: InsertableYooptaEditor,
  blockType: string,
  { order, scrollContainer }: InsertBlockWithFocusOptions = {},
): number | null {
  if (order !== null && order !== undefined) {
    editor.insertBlock(blockType, { at: order, focus: false });

    const focusedBlockId = focusBlockAtOrder(editor, {
      order,
      scrollContainer: scrollContainer ?? null,
    });

    if (!focusedBlockId) {
      focusEditorFallback(editor);
    }

    return order;
  }

  editor.insertBlock(blockType, { focus: true });
  return null;
}

export function insertBlockAtCurrentPath(
  editor: InsertableYooptaEditor,
  blockType: string,
  options?: Omit<InsertBlockWithFocusOptions, 'order'>,
): number | null {
  return insertBlockWithFocus(editor, blockType, {
    order: editor.path?.current ?? null,
    scrollContainer: options?.scrollContainer,
  });
}