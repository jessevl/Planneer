/**
 * @file BookmarkPlugin.tsx
 * @description Yoopta plugin for bookmark cards (rich link previews)
 * 
 * Similar to Notion's bookmark blocks, this plugin creates a rich preview
 * of external links including:
 * - Favicon
 * - Page title
 * - Description
 * - Open Graph image (optional)
 */
import { YooptaPlugin } from '@yoopta/editor';

import BookmarkRender from './BookmarkRender';
import { BookmarkCommands } from './commands';
import type { BookmarkElementMap, BookmarkElementProps } from './types';

// ============================================================================
// PLUGIN DEFINITION
// ============================================================================

const BookmarkPlugin = new YooptaPlugin<BookmarkElementMap>({
  type: 'Bookmark',
  elements: {
    bookmark: {
      render: BookmarkRender,
      props: {
        nodeType: 'void',
        url: '',
        title: undefined,
        description: undefined,
        favicon: undefined,
        image: undefined,
        siteName: undefined,
        fetched: false,
        error: false,
      } as BookmarkElementProps,
    },
  },
  options: {
    display: {
      title: 'Bookmark',
      description: 'Save a link as a visual bookmark',
    },
    shortcuts: ['bookmark', 'link-preview'],
  },
  commands: BookmarkCommands,
});

export { BookmarkPlugin, BookmarkCommands };
export type { BookmarkElementProps, BookmarkElementMap };
