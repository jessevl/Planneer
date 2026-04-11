/**
 * @file ImageComponent.tsx
 * @description Image display component with zoom functionality
 * Custom styling for Planneer with dark mode support
 */
import type { CSSProperties } from 'react';
import { Fragment, useEffect, useState } from 'react';
import { UI } from '@/plugins/yoopta/editor-ui/ui-compat';
import type { RenderElementProps } from 'slate-react';
import { cn } from '@/lib/design-system';
import type { ImageElementProps } from '../types';

type ImageComponentProps = Omit<ImageElementProps, 'sizes'> & {
  width: number | string;
  height: number | string;
  layout?: 'fill' | 'responsive' | 'intrinsic' | 'fixed';
} & Pick<RenderElementProps, 'attributes' | 'children'>;

const ZOOM_STYLES: CSSProperties = {
  position: 'fixed',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  width: '100%',
  height: '100%',
  zIndex: 999,
  maxWidth: '90vw',
  maxHeight: '90vh',
  cursor: 'zoom-out',
};

export const ImageComponent = ({
  width,
  height,
  src,
  alt,
  fit,
  bgColor,
  attributes,
  children,
  layout = 'intrinsic',
}: ImageComponentProps) => {
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isZoomed) {
        setIsZoomed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZoomed]);

  // Map fit values to CSS object-fit
  const objectFit = fit === 'contain' ? 'contain' : fit === 'cover' ? 'cover' : 'fill';
  
  let style: CSSProperties = {
    objectFit,
    backgroundColor: bgColor || 'transparent',
    cursor: 'zoom-in',
  };

  const isResponsive = layout === 'responsive';

  if (isResponsive) {
    style.width = '100%';
    style.height = 'auto';
  } else if (['fixed', 'fill', 'intrinsic'].includes(layout)) {
    style.width = '100%';
    style.height = '100%';
  }

  if (isZoomed) {
    style = { ...style, ...ZOOM_STYLES };
  }

  const handleImageClick = () => {
    setIsZoomed((prev) => !prev);
  };

  return (
    <div
      className={cn(
        'yoopta-plugin-card relative rounded-md overflow-hidden border transition-colors',
        isZoomed && 'z-[1000]'
      )}
      data-layout={layout}
      {...attributes}
    >
      {src && (
        <img
          src={src}
          width={width}
          height={height}
          alt={alt || ''}
          decoding="async"
          loading="eager"
          style={style}
          onClick={handleImageClick}
          className="rounded-[inherit]"
        />
      )}
      {children}
      {alt && (
        <div
          className={cn(
            'absolute bottom-2 left-2 px-1.5 py-0.5 rounded text-xs font-medium',
            'bg-black/70 text-white',
            'border border-transparent'
          )}
          title={alt}
        >
          ALT
        </div>
      )}
      {isZoomed && (
        <UI.Portal id="image-zoom">
          <UI.Overlay
            onClick={handleImageClick}
            lockScroll
            className="bg-[var(--color-surface-overlay)]"
          >
            <Fragment />
          </UI.Overlay>
        </UI.Portal>
      )}
    </div>
  );
};
