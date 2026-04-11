/**
 * @file commands.ts
 * @description Commands for the Bookmark Card plugin
 */
import type { YooEditor } from '@yoopta/editor';
import { Blocks } from '@yoopta/editor';

import type { BookmarkElementProps } from './types';

// ============================================================================
// COMMAND TYPES
// ============================================================================

export type BookmarkCommands = {
  /**
   * Update bookmark metadata after it's been fetched
   */
  updateBookmarkMetadata: (
    editor: YooEditor,
    blockId: string,
    metadata: Partial<BookmarkElementProps>
  ) => void;
};

// ============================================================================
// COMMAND IMPLEMENTATIONS
// ============================================================================

export const BookmarkCommands: BookmarkCommands = {
  updateBookmarkMetadata: (
    editor: YooEditor,
    blockId: string,
    metadata: Partial<BookmarkElementProps>
  ) => {
    const block = editor.children[blockId];
    if (!block) return;

    const element = block.value[0];
    if (!element) return;

    const currentProps = (element as any).props || {};

    Blocks.updateBlock(editor, blockId, {
      value: [{
        ...element,
        props: {
          ...currentProps,
          ...metadata,
        },
      }],
    });
  },
};
