/**
 * @file ExcalidrawRender.tsx
 * @description Main render component for Excalidraw whiteboard blocks
 * @app PAGES - Inline whiteboard blocks in notes
 *
 * Two modes:
 * 1. Inline card - compact preview with thumbnail/placeholder
 * 2. Fullscreen edit - lazy-loaded Excalidraw canvas overlay
 *
 * Used by:
 * - ExcalidrawPlugin (Yoopta void block render)
 */
import React, { useCallback, useState } from 'react';
import type { PluginElementRenderProps } from '@yoopta/editor';
import { Elements, useYooptaEditor, useYooptaReadOnly } from '@yoopta/editor';

import ExcalidrawInlineCard from './ExcalidrawInlineCard';
import type { ExcalidrawElementProps } from './types';

const ExcalidrawFullscreen = React.lazy(() => import('./ExcalidrawFullscreen'));

// ============================================================================
// RENDER COMPONENT
// ============================================================================

export default function ExcalidrawRender({
  attributes,
  element,
  blockId,
  children,
}: PluginElementRenderProps) {
  const editor = useYooptaEditor();
  const isReadOnly = useYooptaReadOnly();
  const props = element.props as unknown as ExcalidrawElementProps;
  const { snapshot, elementCount, thumbnailUrl, lastEdited } = props;

  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleOpen = useCallback(() => {
    if (isReadOnly) return;
    setIsFullscreen(true);
  }, [isReadOnly]);

  const handleClose = useCallback(
    (updatedSnapshot: string, updatedElementCount: number, updatedThumbnailUrl: string | null) => {
      setIsFullscreen(false);
      Elements.updateElement(editor, {
        blockId,
        type: 'whiteboard',
        props: {
          snapshot: updatedSnapshot,
          elementCount: updatedElementCount,
          thumbnailUrl: updatedThumbnailUrl ?? thumbnailUrl,
          lastEdited: new Date().toISOString(),
        },
      });
    },
    [editor, blockId, thumbnailUrl],
  );

  return (
    <div contentEditable={false} draggable={false} {...attributes}>
      <ExcalidrawInlineCard
        snapshot={snapshot}
        elementCount={elementCount}
        thumbnailUrl={thumbnailUrl}
        lastEdited={lastEdited}
        isReadOnly={isReadOnly}
        onOpen={handleOpen}
      />

      {isFullscreen && (
        <React.Suspense
          fallback={
            <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-white dark:bg-gh-canvas-default">
              <div className="text-sm text-gray-500 dark:text-gh-fg-muted">Loading whiteboard…</div>
            </div>
          }
        >
          <ExcalidrawFullscreen
            snapshot={snapshot}
            blockId={blockId}
            onClose={handleClose}
          />
        </React.Suspense>
      )}

      {children}
    </div>
  );
}
