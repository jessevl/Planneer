/**
 * @file ImageBlockOptions.tsx
 * @description Block options toolbar for image blocks - renders as a floating
 *   toolbar overlay on the image that appears on hover/focus.
 * 
 * In v6, the old ExtendedBlockActions wrapper became BlockOptions (a compound
 * dropdown component requiring Trigger/Content). Since image options are best
 * displayed as an inline toolbar on the image itself, we render them as a
 * simple absolutely-positioned bar instead of using BlockOptions.
 * 
 * @app PAGES - Used by ImageRender
 */
import { useState } from 'react';
import { flip, inline, offset, shift, useFloating } from '@floating-ui/react';
import {
  Blocks,
  Elements,
  useYooptaPluginOptions,
} from '@yoopta/editor';
import { UI } from '@/plugins/yoopta/editor-ui/ui-compat';
import type { YooEditor, YooptaBlockData } from '@yoopta/editor';
import { cn } from '@/lib/design-system';
import { normalizePocketBaseAssetUrl } from '@/lib/pocketbase';
import { 
  AlignLeftIcon, 
  AlignCenterIcon, 
  AlignRightIcon, 
  DownloadIcon,
  CheckIcon,
} from '@/components/common/Icons';
import { InputAltText } from './InputAltText';
import { Loader } from './Loader';
import { limitSizes } from '../limitSizes';
import type { ImageElementProps, ImagePluginElements, ImagePluginOptions } from '../types';

const ALIGN_ICONS = {
  left: AlignLeftIcon,
  center: AlignCenterIcon,
  right: AlignRightIcon,
};

type Props = {
  editor: YooEditor;
  block: YooptaBlockData;
  props?: ImageElementProps;
};

export const ImageBlockOptions = ({ editor, block, props: imageProps }: Props) => {
  const options = useYooptaPluginOptions<ImagePluginOptions>('Image');
  const [isAltTextOpen, setIsAltTextOpen] = useState(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [altText, setAltText] = useState<string>(imageProps?.alt || '');

  const { refs, floatingStyles } = useFloating({
    placement: 'left',
    open: isAltTextOpen,
    onOpenChange: setIsAltTextOpen,
    middleware: [inline(), flip(), shift(), offset(10)],
  });

  const onSetLoading = (state: boolean) => setLoading(state);
  const onSetAltText = (text: string) => setAltText(text);

  const onSaveAltText = () => {
    if (!altText) return;
    Elements.updateElement(editor, {
      blockId: block.id,
      type: 'image',
      props: { alt: altText },
    });
    setIsAltTextOpen(false);
  };

  const onDeleteAltText = () => {
    setAltText('');
    Elements.updateElement(editor, {
      blockId: block.id,
      type: 'image',
      props: { alt: '' },
    });
    setIsAltTextOpen(false);
  };

  const onCover = () => {
    Elements.updateElement(editor, {
      blockId: block.id,
      type: 'image',
      props: { fit: 'cover' },
    });
  };

  const onFit = () => {
    Elements.updateElement(editor, {
      blockId: block.id,
      type: 'image',
      props: { fit: 'contain' },
    });
  };

  const onFill = () => {
    Elements.updateElement(editor, {
      blockId: block.id,
      type: 'image',
      props: { fit: 'fill' },
    });
  };

  const onDownload = () => {
    if (!imageProps || !imageProps.src) return;
    const normalizedSrc = normalizePocketBaseAssetUrl(imageProps.src);
    if (!normalizedSrc) return;
    const link = document.createElement('a');
    link.href = normalizedSrc;
    link.download = imageProps.alt || normalizedSrc;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currentAlign = block?.meta?.align || 'center';
  const AlignIcon = ALIGN_ICONS[currentAlign as keyof typeof ALIGN_ICONS] || AlignCenterIcon;

  const onToggleAlign = () => {
    const aligns = ['left', 'center', 'right'] as const;
    if (!block) return;
    const nextAlign = aligns[(aligns.indexOf(currentAlign as typeof aligns[number]) + 1) % aligns.length];
    Blocks.updateBlock(editor, block.id, { meta: { ...block.meta, align: nextAlign } });
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!options?.onUpload) {
      throw new Error('onUpload not provided in plugin options.');
    }

    const file = e.target.files?.[0];
    if (!file) return;

    onSetLoading(true);

    try {
      const data = await options.onUpload(file);
      const defaultImageProps = editor.plugins.Image.elements.image.props as ImageElementProps;
      const maxSizes = (editor.plugins.Image.options as ImagePluginOptions | undefined)?.maxSizes;
      const normalizedSizes = data.sizes && maxSizes
        ? limitSizes(data.sizes, {
            width: maxSizes.maxWidth ?? data.sizes.width,
            height: maxSizes.maxHeight ?? data.sizes.height,
          })
        : data.sizes || defaultImageProps.sizes;

      Elements.updateElement(editor, {
        blockId: block.id,
        type: 'image',
        props: {
          src: data.src,
          alt: data.alt,
          sizes: normalizedSizes,
          bgColor: imageProps?.bgColor || data.bgColor || defaultImageProps.bgColor,
          fit: imageProps?.fit || data.fit || defaultImageProps.fit || 'fill',
        },
      });
    } catch (error) {
      console.error('Failed to upload image:', error);
    } finally {
      onSetLoading(false);
    }
  };

  const buttonClass = cn(
    'flex items-center justify-center p-1.5 rounded',
    'text-white/90 hover:text-white',
    'hover:bg-white/20',
    'transition-colors'
  );

  const activeClass = 'bg-white/20 text-white';

  return (
    <div
      className={cn(
        'absolute bottom-2 left-1/2 -translate-x-1/2 z-[90]',
        'flex items-center gap-0.5 px-1 py-0.5 rounded-lg',
        'bg-black/70 backdrop-blur-sm shadow-lg',
        'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
        'pointer-events-none group-hover:pointer-events-auto'
      )}
      contentEditable={false}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Fit options */}
      <button
        type="button"
        className={cn(buttonClass, imageProps?.fit === 'contain' && activeClass)}
        onClick={onFit}
        title="Fit"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18M15 3v18" />
        </svg>
      </button>
      <button
        type="button"
        className={cn(buttonClass, imageProps?.fit === 'fill' && activeClass)}
        onClick={onFill}
        title="Fill"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      </button>
      <button
        type="button"
        className={cn(buttonClass, imageProps?.fit === 'cover' && activeClass)}
        onClick={onCover}
        title="Cover"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 15l5-5 4 4 8-8" />
        </svg>
      </button>

      {/* Divider */}
      <div className="w-px h-4 bg-white/30 mx-0.5" />

      {/* Alt text */}
      <button
        type="button"
        className={cn(buttonClass, isAltTextOpen && activeClass)}
        ref={refs.setReference}
        onClick={() => setIsAltTextOpen(!isAltTextOpen)}
        title="Alt text"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 7V4h16v3M9 20h6M12 4v16" />
        </svg>
      </button>

      {isAltTextOpen && (
        <InputAltText
          value={altText}
          onChange={onSetAltText}
          floatingStyles={floatingStyles}
          onClose={() => setIsAltTextOpen(false)}
          refs={refs}
          onDelete={onDeleteAltText}
          onSave={onSaveAltText}
        />
      )}

      {/* Replace image */}
      <label
        htmlFor={`image-replace-uploader-${block.id}`}
        className={cn(buttonClass, 'cursor-pointer', loading && 'opacity-50 cursor-wait')}
        title="Replace image"
      >
        <input
          type="file"
          accept={options?.accept}
          multiple={false}
          id={`image-replace-uploader-${block.id}`}
          className="absolute hidden"
          onChange={onUpload}
          disabled={loading}
        />
        {loading ? (
          <Loader width={16} height={16} />
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 16h5v5" />
          </svg>
        )}
      </label>

      {/* Divider */}
      <div className="w-px h-4 bg-white/30 mx-0.5" />

      {/* Alignment */}
      <button
        type="button"
        className={buttonClass}
        onClick={onToggleAlign}
        title={`Alignment: ${currentAlign}`}
      >
        <AlignIcon className="w-4 h-4" />
      </button>

      {/* Download */}
      <button
        type="button"
        className={buttonClass}
        onClick={onDownload}
        title="Download"
      >
        <DownloadIcon className="w-4 h-4" />
      </button>
    </div>
  );
};
