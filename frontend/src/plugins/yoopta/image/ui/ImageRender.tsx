/**
 * @file ImageRender.tsx
 * @description Main image block render component
 * Custom styling for Planneer with dark mode support
 */
import { useEffect, useMemo, useState } from 'react';
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

  const resizeProps: ResizableProps = useMemo(
    () => ({
      minWidth: 300,
      size: { width: sizes.width, height: sizes.height },
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
    [sizes.width, sizes.height, isReadOnly, editor, blockId, pluginOptions?.maxSizes]
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
      className="mt-0 mb-4 relative group yoopta-image"
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
          height={sizes?.height}
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
