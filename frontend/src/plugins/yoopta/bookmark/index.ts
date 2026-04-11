/**
 * @file index.ts
 * @description Exports for the Bookmark Card plugin
 */
export { BookmarkPlugin, BookmarkCommands } from './BookmarkPlugin';
export type { BookmarkElementProps, BookmarkElementMap, LinkMetadata } from './types';
export { fetchLinkMetadata, getFaviconUrl } from './fetchMetadata';
