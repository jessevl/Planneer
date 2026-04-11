/**
 * @file BooxPageEmbedPlugin.tsx
 * @description Yoopta plugin for embedding a single mirrored BOOX notebook page
 */

import { YooptaPlugin } from '@yoopta/editor';

import BooxPageEmbedRender from './BooxPageEmbedRender';
import type { BooxPageEmbedElementMap, BooxPageEmbedElementProps } from './types';

const BooxPageEmbedPlugin = new YooptaPlugin<BooxPageEmbedElementMap>({
  type: 'BooxPageEmbed',
  elements: {
    'boox-page-embed': {
      render: BooxPageEmbedRender,
      props: {
        nodeType: 'void',
        notebookId: '',
        notebookPageId: '',
        notebookTitle: '',
        pageNumber: 1,
        previewImageUrl: '',
        sourcePdfUrl: '',
        sourceModifiedAt: '',
      } as BooxPageEmbedElementProps,
    },
  },
  options: {
    display: {
      title: 'BOOX Page',
      description: 'Embed a page from a synced BOOX notebook',
    },
    shortcuts: ['boox', 'notebook', 'handwriting'],
  },
});

export { BooxPageEmbedPlugin };