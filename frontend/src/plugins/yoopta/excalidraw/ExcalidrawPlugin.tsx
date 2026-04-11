/**
 * @file ExcalidrawPlugin.tsx
 * @description Yoopta void-block plugin for Excalidraw whiteboards
 * @app PAGES - Inline drawing blocks inside notes
 *
 * Features:
 * - Compact inline card with thumbnail preview
 * - Fullscreen Excalidraw editor (lazy-loaded)
 * - Scene data stored as opaque JSON in block props
 * - Thumbnail uploaded via API on editor close
 *
 * Used by:
 * - PageEditor.tsx (registered in basePlugins)
 */
import { YooptaPlugin } from '@yoopta/editor';
import { WhiteboardIcon } from '@/components/common/Icons';

import ExcalidrawRender from './ExcalidrawRender';
import type { ExcalidrawElementMap, ExcalidrawElementProps } from './types';

// ============================================================================
// PLUGIN DEFINITION
// ============================================================================

const ExcalidrawPlugin = new YooptaPlugin<ExcalidrawElementMap>({
  type: 'Whiteboard',
  elements: {
    whiteboard: {
      render: ExcalidrawRender,
      props: {
        nodeType: 'void',
        snapshot: null,
        elementCount: 0,
        thumbnailUrl: null,
        lastEdited: null,
      } as ExcalidrawElementProps,
    },
  },
  options: {
    display: {
      title: 'Whiteboard',
      description: 'Draw and diagram with Excalidraw',
      icon: <WhiteboardIcon className="w-6 h-6" />,
    },
  },
});

export { ExcalidrawPlugin };
export type { ExcalidrawElementProps, ExcalidrawElementMap };
