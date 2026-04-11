/**
 * @file FileUploader.tsx
 * @description File upload component for images
 * Custom styling for Planneer with dark mode support
 */
import { Elements, useYooptaEditor, useYooptaPluginOptions } from '@yoopta/editor';
import { cn } from '@/lib/design-system';
import type { ImageElementProps, ImagePluginElements, ImagePluginOptions } from '../types';
import { limitSizes } from '../limitSizes';

type Props = {
  onClose: () => void;
  blockId: string;
  accept?: string;
  onSetLoading: (loading: boolean) => void;
};

export const FileUploader = ({ 
  accept = 'image/*', 
  onClose, 
  blockId, 
  onSetLoading 
}: Props) => {
  const options = useYooptaPluginOptions<ImagePluginOptions>('Image');
  const editor = useYooptaEditor();

  const upload = async (file: File) => {
    if (!options?.onUpload) {
      console.warn('onUpload not provided');
      return;
    }
    onClose();
    onSetLoading(true);

    try {
      const data = await options.onUpload(file);
      const src = data.src && !data.src.startsWith('blob:')
        ? `${data.src}${data.src.includes('?') ? '&' : '?'}v=${Date.now()}`
        : data.src;
      const defaultImageProps = editor.plugins.Image.elements.image.props as ImageElementProps;
      const sizes = data.sizes || defaultImageProps.sizes;
      const maxSizes = (editor.plugins.Image.options as ImagePluginOptions)?.maxSizes;
      const limitedSizes = limitSizes(sizes!, {
        width: maxSizes!.maxWidth!,
        height: maxSizes!.maxHeight!,
      });

      Elements.updateElement(editor, {
        blockId,
        type: 'image',
        props: {
          src,
          alt: data.alt,
          sizes: limitedSizes,
          bgColor: data.bgColor || defaultImageProps.bgColor,
          fit: data.fit || defaultImageProps.fit || 'fill',
        },
      });
    } catch (error) {
      options?.onError?.(error);
    } finally {
      onSetLoading(false);
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
  };

  return (
    <div
      className={cn(
        'w-full h-9 rounded-lg cursor-pointer',
        'border border-dashed border-[var(--color-border-secondary)]',
        'hover:border-[var(--color-border-primary)]',
        'transition-colors'
      )}
    >
      <label
        htmlFor="image-uploader"
        className={cn(
          'flex items-center justify-center w-full h-full',
          'text-sm font-medium cursor-pointer',
          'text-[var(--color-text-secondary)]'
        )}
      >
        <input
          type="file"
          id="image-uploader"
          className="absolute invisible"
          accept={options?.accept || accept}
          onChange={onChange}
          multiple={false}
        />
        Upload image
      </label>
    </div>
  );
};
