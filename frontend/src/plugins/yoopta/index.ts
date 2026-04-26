/**
 * @file index.ts
 * @description Exports for custom Yoopta editor plugins
 *
 * This folder contains custom and forked plugins for the Yoopta block editor:
 * - InternalLink: Links to tasks and pages within the workspace
 * - CustomImagePlugin: Forked image plugin with Planneer design system
 * - AdvancedTable: Enhanced table with colors, sorting, and formulas
 * - TableOfContentsPlugin: Dynamic TOC from document headings
 * - BookmarkPlugin: Rich link preview cards
 * - PdfPlugin: Inline PDF embedding
 * - ScribblePlugin: Inline handwriting pages with fullscreen ink editing
 * - TranscriptionPlugin: Voice-to-text via local Whisper AI
 * - TodoListRender: Custom checkbox render for TodoList
 * - actionMenuData: Shared block type data for action menus
 *
 * These plugins are used by PageEditor.tsx
 */

// Internal Link Plugin
export { default as InternalLink } from './InternalLinkPlugin';
export type { InternalLinkElementProps } from './InternalLinkPlugin';

// Internal Link Render (for the plugin)
export { default as InternalLinkRender } from './InternalLinkRender';

// Table of Contents Plugin - dynamic TOC from headings
export {
  default as TableOfContentsPlugin,
  TableOfContentsCommands,
} from './TableOfContentsPlugin';

// ============================================
// FORKED / CUSTOM PLUGINS
// ============================================

// Custom Image Plugin - complete fork with Planneer design system
export { CustomImagePlugin, ImageCommands } from './image';
export type { ImageElementProps, ImagePluginOptions } from './image/types';

// Advanced Table Plugin - enhanced table with colors, sorting, and formulas
export {
  AdvancedTablePlugin,
  AdvancedTableCommands,
  type AdvancedTableElement,
  type AdvancedTableCellElement,
  type AdvancedTableRowElement,
} from './advanced-table';

// Bookmark Plugin - rich link preview cards like Notion
export {
  BookmarkPlugin,
  BookmarkCommands,
  type BookmarkElementProps,
} from './bookmark';

// PDF Plugin - embed PDF documents inline or in modal
export {
  PdfPlugin,
  type PdfElementProps,
} from './pdf';

// Scribble Plugin - finite handwriting pages with fullscreen editing
export {
  ScribblePlugin,
  ScribbleCommands,
  type ScribbleElementMap,
  type ScribbleElementProps,
  type ScribbleSnapshot,
  type ScribbleStroke,
  type ScribbleTool,
} from './scribble';

// Transcription Plugin - voice-to-text using local Whisper AI
export {
  TranscriptionPlugin,
  TranscriptionCommands,
  type TranscriptionElementMap,
  type TranscriptionProps,
  type TranscriptionChunk,
} from './transcription';

// Excalidraw Whiteboard Plugin - inline drawing blocks
export {
  ExcalidrawPlugin,
  type ExcalidrawElementProps,
  type ExcalidrawElementMap,
} from './excalidraw';

// Shared action menu data - used by both desktop and mobile action menus
export {
  BLOCK_OPTIONS,
  GROUP_ORDER,
  groupBlockOptions,
  getBlockIcon,
  getBlockShortcut,
  type BlockOption,
  type BlockGroup,
} from './shared/menu/actionMenuData';
