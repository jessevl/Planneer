/**
 * @file PdfRender.tsx
 * @description Render component for the PDF embed plugin
 * 
 * Features:
 * - Unified media input UX (consistent with Image and Bookmark plugins)
 * - Inline PDF viewer using iframe with native browser PDF support
 * - Modal viewer for full-screen PDF viewing
 * - File upload to PocketBase
 * - URL input for external PDFs
 * - Compact card view for modal-only mode
 */
import { useCallback } from 'react';
import type { PluginElementRenderProps } from '@yoopta/editor';
import { Elements, useYooptaEditor } from '@yoopta/editor';

import { MediaPlaceholder, MediaUploaderResult } from '../shared';
import { useCurrentPageId } from '@/contexts';
import type { PdfElementProps, PdfViewMode } from './types';
import PdfDocumentViewer from '@/components/common/PdfDocumentViewer';

// ============================================================================
// PDF RENDER COMPONENT
// ============================================================================

export default function PdfRender({
  attributes,
  element,
  blockId,
}: PluginElementRenderProps) {
  const editor = useYooptaEditor();
  const pageId = useCurrentPageId();
  const props = element.props as unknown as PdfElementProps;
  const { url, name, size, viewMode = 'inline', inlineHeight = 500 } = props;

  // Handle media selection from the unified MediaPlaceholder
  const handleMediaSelect = useCallback((result: MediaUploaderResult) => {
    Elements.updateElement(editor, {
      blockId,
      type: 'pdf',
      props: {
        url: result.url,
        name: result.filename,
        size: result.size,
      },
    });
  }, [editor, blockId]);

  // Toggle view mode
  const toggleViewMode = useCallback((nextMode?: PdfViewMode) => {
    const newMode: PdfViewMode = nextMode ?? (viewMode === 'inline' ? 'modal' : 'inline');
    Elements.updateElement(editor, {
      blockId,
      type: 'pdf',
      props: {
        viewMode: newMode,
      },
    });
  }, [editor, blockId, viewMode]);

  // Show placeholder if no URL (unified UX)
  if (!url) {
    return (
      <div {...attributes} contentEditable={false}>
        <MediaPlaceholder
          type="pdf"
          onMediaSelect={handleMediaSelect}
          pageId={pageId || undefined}
          readOnly={editor.readOnly}
          isUploading={false}
        />
      </div>
    );
  }

  // Prevent Slate from trying to handle selection on void elements
  const preventSlateSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Don't preventDefault on buttons/links - just stop propagation
  };

  return (
    <div 
      {...attributes} 
      contentEditable={false}
      onMouseDown={preventSlateSelection}
      onClick={preventSlateSelection}
    >
      <PdfDocumentViewer
        url={url}
        name={name}
        size={size}
        viewMode={viewMode}
        inlineHeight={inlineHeight}
        readOnly={editor.readOnly}
        onViewModeChange={toggleViewMode}
      />
    </div>
  );
}
