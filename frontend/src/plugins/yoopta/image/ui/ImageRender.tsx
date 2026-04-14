/**
 * @file ImageRender.tsx
 * @description Main image block render component
 * Custom styling for Planneer with dark mode support
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PluginElementRenderProps } from '@yoopta/editor';
import {
  Elements,
  useBlockData,
  useBlockSelected,
  useYooptaEditor,
  useYooptaPluginOptions,
  useYooptaReadOnly,
} from '@yoopta/editor';
import type { ResizableProps } from 're-resizable';
import { Resizable } from 're-resizable';
import { cn } from '@/lib/design-system';
import { normalizePocketBaseAssetUrl } from '@/lib/pocketbase';

import { ImageBlockOptions } from './ImageBlockOptions';
import { ImageComponent } from './ImageComponent';
import { Placeholder } from './Placeholder';
import { Resizer } from './Resizer';
import type { ImagePluginOptions } from '../types';

export const ImageRender = (props: PluginElementRenderProps) => {
  const { element, blockId, children, attributes } = props;
  const { src, alt, srcSet, bgColor, fit, sizes: propSizes } = element.props || {};
  const blockData = useBlockData(blockId);
  const editor = useYooptaEditor();
  const isReadOnly = useYooptaReadOnly();

  const pluginOptions = useYooptaPluginOptions<ImagePluginOptions>('Image');

  const [sizes, setSizes] = useState({
    width: propSizes?.width || 650,
    height: propSizes?.height || 440,
  });

  useEffect(
    () =>
      setSizes({
        width: propSizes?.width || 650,
        height: propSizes?.height || 440,
      }),
    [propSizes?.width, propSizes?.height]
  );

  const blockSelected = useBlockSelected({ blockId });
  const normalizedSrc = normalizePocketBaseAssetUrl(src);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const lastNormalizedSizeRef = useRef<string | null>(null);

  useEffect(() => {
    if (!normalizedSrc) {
      setAspectRatio(null);
      return;
    }

    const image = new window.Image();
    image.onload = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        setAspectRatio(image.naturalHeight / image.naturalWidth);
      }
    };
    image.src = normalizedSrc;
  }, [normalizedSrc]);

  const currentWidth = typeof sizes.width === 'number' ? sizes.width : parseInt(String(sizes.width), 10) || 650;
  const computedHeight = aspectRatio ? Math.round(currentWidth * aspectRatio) : sizes.height;

  useEffect(() => {
    if (!aspectRatio) return;

    setSizes((prev) => {
      const nextHeight = Math.round(currentWidth * aspectRatio);
      if (prev.height === nextHeight) return prev;
      return { ...prev, height: nextHeight };
    });
  }, [aspectRatio, currentWidth]);

  useEffect(() => {
    if (!aspectRatio) return;

    const nextHeight = Math.round(currentWidth * aspectRatio);
    const sizeKey = `${currentWidth}x${nextHeight}`;

    if (lastNormalizedSizeRef.current === `${blockId}:${sizeKey}`) {
      return;
    }

    const storedWidth = propSizes?.width ?? currentWidth;
    const storedHeight = propSizes?.height ?? nextHeight;
    const widthDiff = Math.abs(storedWidth - currentWidth);
    const heightDiff = Math.abs(storedHeight - nextHeight);

    if (widthDiff <= 1 && heightDiff <= 1) {
      lastNormalizedSizeRef.current = `${blockId}:${sizeKey}`;
      return;
    }

    lastNormalizedSizeRef.current = `${blockId}:${sizeKey}`;
    Elements.updateElement(editor, {
      blockId,
      type: 'image',
      props: {
        sizes: { width: currentWidth, height: nextHeight },
      },
    });
  }, [aspectRatio, blockId, currentWidth, editor, propSizes?.height, propSizes?.width]);

  const resizeProps: ResizableProps = useMemo(
    () => ({
      minWidth: 160,
      size: { width: sizes.width, height: computedHeight },
      maxWidth: pluginOptions?.maxSizes?.maxWidth || 800,
      maxHeight: pluginOptions?.maxSizes?.maxHeight || 720,
      lockAspectRatio: true,
      resizeRatio: 2,
      enable: {
        left: !isReadOnly,
        right: !isReadOnly,
      },
      handleStyles: {
        left: { left: 0 },
        right: { right: 0 },
      },
      onResize: (_e, _direction, ref) => {
        if (isReadOnly) return;
        setSizes({ width: ref.offsetWidth, height: ref.offsetHeight });
      },
      onResizeStop: (_e, _direction, ref) => {
        if (isReadOnly) return;
        Elements.updateElement(editor, {
          blockId,
          type: 'image',
          props: {
            sizes: { width: ref.offsetWidth, height: ref.offsetHeight },
          },
        });
      },
      handleComponent: {
        left: isReadOnly ? <></> : <Resizer position="left" />,
        right: isReadOnly ? <></> : <Resizer position="right" />,
      },
    }),
    [sizes.width, computedHeight, isReadOnly, editor, blockId, pluginOptions?.maxSizes]
  );

  if (!normalizedSrc) {
    if (isReadOnly) return <></>;

    return (
      <Placeholder attributes={attributes} blockId={blockId}>
        {children}
      </Placeholder>
    );
  }

  const currentAlign = blockData?.meta?.align || 'center';
  // Use margin-based alignment on the Resizable itself — avoids flex layout
  // conflicts that break re-resizable's drag handles.
  const alignClass = currentAlign === 'left'
    ? 'mr-auto'
    : currentAlign === 'right'
      ? 'ml-auto'
      : 'mx-auto';

  return (
    <div
      contentEditable={false}
      draggable={false}
      className="mt-0 mb-4 relative group yoopta-image max-w-full"
    >
      <Resizable {...resizeProps} className={cn('my-0', alignClass)}>
        {blockSelected && (
          <div
            className="absolute pointer-events-none inset-0 z-[81] rounded-md ring-2 ring-[var(--color-accent-primary)] ring-inset"
          />
        )}
        <ImageComponent
          src={normalizedSrc}
          alt={alt}
          srcSet={srcSet}
          fit={fit}
          width={sizes?.width}
          bgColor={bgColor}
          height={computedHeight}
          attributes={attributes}
        >
          {children}
        </ImageComponent>
        {!isReadOnly && (
          <ImageBlockOptions block={blockData} editor={editor} props={element.props} />
        )}
      </Resizable>
    </div>
  );
};
