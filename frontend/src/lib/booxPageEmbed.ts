/**
 * @file booxPageEmbed.ts
 * @description Shared helpers and types for BOOX page embed blocks
 * @app PAGES - Used by the BOOX picker modal and Yoopta BOOX page embed plugin
 */

export const BOOX_PAGE_EMBED_BLOCK_TYPE = 'BooxPageEmbed';

export interface BooxPageEmbedData {
  notebookId: string;
  notebookPageId: string;
  notebookTitle: string;
  pageNumber: number;
  previewImageUrl: string;
  sourcePdfUrl: string;
  sourceModifiedAt: string;
}

export function createBooxNotebookPageId(notebookId: string, pageNumber: number): string {
  return `${notebookId}:page:${Math.max(1, Math.trunc(pageNumber))}`;
}

export function clampBooxPageNumber(pageNumber: number, maxPages?: number | null): number {
  const normalized = Number.isFinite(pageNumber) ? Math.max(1, Math.trunc(pageNumber)) : 1;
  if (!maxPages || !Number.isFinite(maxPages) || maxPages < 1) {
    return normalized;
  }

  return Math.min(normalized, Math.trunc(maxPages));
}

export function buildBooxSourcePdfPageUrl(sourcePdfUrl: string, pageNumber: number): string {
  const cleanUrl = sourcePdfUrl.split('#')[0] ?? sourcePdfUrl;
  return `${cleanUrl}#page=${clampBooxPageNumber(pageNumber)}`;
}