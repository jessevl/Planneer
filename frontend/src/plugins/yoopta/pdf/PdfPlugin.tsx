/**
 * @file PdfPlugin.tsx
 * @description Yoopta plugin for embedding PDF documents
 * 
 * Features:
 * - Upload or link external PDFs
 * - Inline viewer using browser's native PDF support
 * - Full-screen modal viewer
 * - Compact card view option
 */
import { YooptaPlugin } from '@yoopta/editor';

import PdfRender from './PdfRender';
import type { PdfElementMap, PdfElementProps } from './types';

// ============================================================================
// PLUGIN DEFINITION
// ============================================================================

const PdfPlugin = new YooptaPlugin<PdfElementMap>({
  type: 'Pdf',
  elements: {
    pdf: {
      render: PdfRender,
      props: {
        nodeType: 'void',
        url: '',
        name: undefined,
        size: undefined,
        viewMode: 'inline',
        inlineHeight: 500,
      } as PdfElementProps,
    },
  },
  options: {
    display: {
      title: 'PDF (Alpha)',
      description: 'Embed a PDF document',
    },
    shortcuts: ['pdf', 'document'],
  },
});

export { PdfPlugin };
export type { PdfElementProps, PdfElementMap };
