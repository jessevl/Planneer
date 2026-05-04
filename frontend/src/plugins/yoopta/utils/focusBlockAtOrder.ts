/**
 * @file focusBlockAtOrder.ts
 * @description Restores a real caret inside a newly inserted Yoopta block
 *              without letting focus operations jump the surrounding scroll
 *              container.
 */
import type { YooEditor } from '@yoopta/editor';

type FocusableYooptaEditor = Pick<
  YooEditor,
  'focus' | 'focusBlock' | 'getEditorValue' | 'setPath'
>;

interface FocusBlockAtOrderOptions {
  order: number;
  scrollContainer?: Pick<HTMLElement, 'scrollLeft' | 'scrollTop'> | null;
}

type YooptaBlockLike = {
  id?: string;
  meta?: {
    order?: number;
  };
};

function afterNextPaint(callback: () => void): void {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => callback());
    return;
  }

  callback();
}

function captureScrollPosition(scrollContainer?: Pick<HTMLElement, 'scrollLeft' | 'scrollTop'> | null) {
  if (!scrollContainer) return () => {};

  const { scrollLeft, scrollTop } = scrollContainer;

  return () => {
    scrollContainer.scrollLeft = scrollLeft;
    scrollContainer.scrollTop = scrollTop;
  };
}

export function focusBlockAtOrder(
  editor: FocusableYooptaEditor,
  { order, scrollContainer }: FocusBlockAtOrderOptions,
): string | null {
  const block = Object.values(editor.getEditorValue() ?? {}).find((candidate) => {
    const value = candidate as YooptaBlockLike;
    return typeof value?.id === 'string' && value.meta?.order === order;
  }) as YooptaBlockLike | undefined;

  if (!block?.id) return null;

  const blockId = block.id;

  const restoreScroll = captureScrollPosition(scrollContainer ?? null);

  afterNextPaint(() => {
    try {
      editor.setPath({ current: order });
    } catch {
      // Best-effort: some Yoopta paths can be temporarily stale during inserts.
    }

    try {
      editor.focusBlock(blockId);
    } catch {
      try {
        editor.focus();
      } catch {
        // Ignore focus failures while the editor is still reconciling.
      }
    }

    afterNextPaint(restoreScroll);
  });

  return blockId;
}
