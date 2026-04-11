/**
 * @file types.ts
 * @description Type definitions for the BOOX page embed Yoopta plugin
 */

import type { SlateElement } from '@yoopta/editor';

import type { BooxPageEmbedData } from '@/lib/booxPageEmbed';

export interface BooxPageEmbedElementProps extends BooxPageEmbedData {
  nodeType: 'void';
}

export type BooxPageEmbedElement = SlateElement<'boox-page-embed', BooxPageEmbedElementProps>;

export type BooxPageEmbedElementMap = {
  'boox-page-embed': BooxPageEmbedElement;
};