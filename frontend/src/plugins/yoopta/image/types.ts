/**
 * @file types.ts
 * @description Type definitions for the custom Image plugin
 * Forked from @yoopta/image
 */
import type { SlateElement } from '@yoopta/editor';

export type ImageSizes = {
  width: number | string;
  height: number | string;
};

export type ImageElementProps = {
  src?: string | null;
  alt?: string | null;
  srcSet?: string | null;
  bgColor?: string | null;
  fit?: 'contain' | 'cover' | 'fill' | null;
  sizes?: ImageSizes;
  nodeType?: 'void';
};

export type ImagePluginElements = 'image';
export type ImageElement = SlateElement<'image', ImageElementProps>;

export type ImageUploadResponse = Omit<ImageElementProps, 'srcSet'>;

export type ImagePluginOptions = {
  onUpload: (file: File) => Promise<ImageUploadResponse>;
  onError?: (error: unknown) => void;
  accept?: string;
  maxSizes?: {
    maxWidth?: number | string;
    maxHeight?: number | string;
  };
};

export type ImageElementMap = {
  image: ImageElement;
};
