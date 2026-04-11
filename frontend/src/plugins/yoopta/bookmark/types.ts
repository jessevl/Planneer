/**
 * @file types.ts
 * @description Type definitions for the Bookmark Card plugin
 * 
 * Bookmark cards are rich link previews similar to Notion's bookmark blocks.
 * They display the page title, description, favicon, and optionally an image.
 */
import type { SlateElement } from '@yoopta/editor';

// ============================================================================
// ELEMENT PROPS
// ============================================================================

export interface BookmarkElementProps {
  nodeType: 'void';
  /** The original URL */
  url: string;
  /** Page title from meta tags */
  title?: string;
  /** Page description from meta tags */
  description?: string;
  /** Favicon URL */
  favicon?: string;
  /** Open Graph image URL */
  image?: string;
  /** Site name (e.g., "GitHub") */
  siteName?: string;
  /** Whether metadata has been fetched */
  fetched: boolean;
  /** Whether metadata fetch failed */
  error?: boolean;
}

// ============================================================================
// ELEMENT TYPES
// ============================================================================

export type BookmarkElement = SlateElement<'bookmark', BookmarkElementProps>;

export type BookmarkElementMap = {
  bookmark: BookmarkElement;
};

// ============================================================================
// METADATA TYPES
// ============================================================================

export interface LinkMetadata {
  url: string;
  title?: string;
  description?: string;
  favicon?: string;
  image?: string;
  siteName?: string;
}
