/**
 * @file types.ts
 * @description Type definitions for the Excalidraw whiteboard plugin
 *
 * Excalidraw whiteboards are void blocks that store the scene data
 * (elements + appState) as a JSON string. Inline display shows a compact card;
 * fullscreen editing renders the Excalidraw canvas.
 */
import type { SlateElement } from '@yoopta/editor';

// ============================================================================
// ELEMENT PROPS
// ============================================================================

export interface ExcalidrawElementProps {
  nodeType: 'void';
  /** Serialized Excalidraw scene data (JSON string of { elements, appState, files }) */
  snapshot: string | null;
  /** Number of elements on the canvas (for inline card display) */
  elementCount: number;
  /** Thumbnail URL (uploaded image via API) */
  thumbnailUrl: string | null;
  /** Last-edited timestamp ISO string (for display) */
  lastEdited: string | null;
}

// ============================================================================
// ELEMENT TYPES
// ============================================================================

export type ExcalidrawBlockElement = SlateElement<'whiteboard', ExcalidrawElementProps>;

export type ExcalidrawElementMap = {
  whiteboard: ExcalidrawBlockElement;
};
