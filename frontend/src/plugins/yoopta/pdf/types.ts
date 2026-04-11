/**
 * @file types.ts
 * @description Type definitions for the PDF embed plugin
 * 
 * PDF embeds can display PDFs inline in the document or open them in a modal.
 * Supports both uploaded files and external URLs.
 */
import type { SlateElement } from '@yoopta/editor';

// ============================================================================
// ELEMENT PROPS
// ============================================================================

export type PdfViewMode = 'inline' | 'modal';

export interface PdfElementProps {
  nodeType: 'void';
  /** URL to the PDF (can be external or uploaded to PocketBase) */
  url: string;
  /** Display name for the PDF */
  name?: string;
  /** File size in bytes (for display) */
  size?: number;
  /** How to display the PDF: inline or modal-only */
  viewMode: PdfViewMode;
  /** Height of inline viewer in pixels */
  inlineHeight?: number;
}

// ============================================================================
// ELEMENT TYPES
// ============================================================================

export type PdfElement = SlateElement<'pdf', PdfElementProps>;

export type PdfElementMap = {
  pdf: PdfElement;
};
