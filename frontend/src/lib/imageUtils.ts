/**
 * @file imageUtils.ts
 * @description Client-side image processing for editor uploads
 * 
 * Handles:
 * - Image resizing (2048px max for full images, 512px for thumbnails)
 * - Format conversion to WebP for smaller file sizes
 * - File validation (size, type)
 * - Blob URL generation for offline placeholders
 */

import { IMAGE_PROCESSING } from './config';

/** Maximum dimension for full-size images (longest side) */
export const MAX_IMAGE_SIZE = IMAGE_PROCESSING.MAX_IMAGE_SIZE;

/** Maximum dimension for thumbnails */
export const THUMBNAIL_SIZE = IMAGE_PROCESSING.THUMBNAIL_SIZE;

/** Maximum file size before processing (10MB - will be resized down) */
export const MAX_INPUT_FILE_SIZE = IMAGE_PROCESSING.MAX_INPUT_FILE_SIZE;

/** Target file size after processing (5MB - PocketBase limit) */
export const MAX_OUTPUT_FILE_SIZE = IMAGE_PROCESSING.MAX_OUTPUT_FILE_SIZE;

/** Accepted MIME types */
export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export type AcceptedImageType = typeof ACCEPTED_IMAGE_TYPES[number];

/**
 * Image processing result
 */
export interface ProcessedImage {
  /** Processed image as File object */
  file: File;
  /** Original filename (sanitized) */
  filename: string;
  /** Width after processing */
  width: number;
  /** Height after processing */
  height: number;
  /** File size in bytes */
  size: number;
  /** MIME type (always image/webp after processing, unless GIF) */
  mimeType: string;
}

/**
 * Image upload result from server
 */
export interface ImageUploadResult {
  /** Full URL to the image */
  src: string;
  /** Image dimensions */
  sizes: {
    width: number;
    height: number;
  };
  /** Alt text (filename without extension) */
  alt: string;
  /** Thumbnail URL (512x512 from PocketBase) */
  thumbnailUrl?: string;
}

/**
 * Pending image upload for offline queue
 */
export interface PendingImageUpload {
  /** Unique ID for this upload */
  id: string;
  /** Note ID to attach image to */
  pageId: string;
  /** Workspace ID */
  workspaceId: string;
  /** Processed file as base64 (for IndexedDB storage) */
  fileBase64: string;
  /** Filename */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** Blob URL for placeholder */
  blobUrl: string;
  /** Original dimensions */
  width: number;
  height: number;
  /** Created timestamp */
  createdAt: number;
}

/**
 * Validate image file before processing
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as AcceptedImageType)) {
    return {
      valid: false,
      error: `Invalid file type: ${file.type}. Accepted types: JPEG, PNG, GIF, WebP`,
    };
  }

  // Check file size (pre-processing limit)
  if (file.size > MAX_INPUT_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum: ${MAX_INPUT_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  return { valid: true };
}

/**
 * Load image from File into an HTMLImageElement
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Calculate new dimensions maintaining aspect ratio
 */
function calculateDimensions(
  width: number,
  height: number,
  maxSize: number
): { width: number; height: number } {
  if (width <= maxSize && height <= maxSize) {
    return { width, height };
  }

  const aspectRatio = width / height;

  if (width > height) {
    return {
      width: maxSize,
      height: Math.round(maxSize / aspectRatio),
    };
  } else {
    return {
      width: Math.round(maxSize * aspectRatio),
      height: maxSize,
    };
  }
}

/**
 * Resize image using canvas
 */
async function resizeImage(
  img: HTMLImageElement,
  maxSize: number,
  mimeType: string,
  quality: number = 0.85
): Promise<{ blob: Blob; width: number; height: number }> {
  const { width, height } = calculateDimensions(img.width, img.height, maxSize);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Use better quality scaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(img, 0, 0, width, height);

  // Convert to blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      },
      mimeType,
      quality
    );
  });

  return { blob, width, height };
}

/**
 * Sanitize filename for safe storage
 */
function sanitizeFilename(filename: string): string {
  // Remove path components
  const basename = filename.split(/[/\\]/).pop() || 'image';
  
  // Replace unsafe characters
  const sanitized = basename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 100);

  // Ensure it has an extension
  if (!sanitized.includes('.')) {
    return `${sanitized}.webp`;
  }

  return sanitized;
}

/**
 * Process an image file for upload
 * 
 * - Validates the file
 * - Resizes to max 2048px on longest side
 * - Converts to WebP for better compression (except GIFs)
 * - Returns processed file ready for upload
 */
export async function processImageForUpload(file: File): Promise<ProcessedImage> {
  // Validate
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Load image
  const img = await loadImage(file);

  // Determine output format (keep GIF as GIF for animations)
  const isGif = file.type === 'image/gif';
  const outputMimeType = isGif ? 'image/gif' : 'image/webp';
  const outputExtension = isGif ? '.gif' : '.webp';

  // For GIFs, we don't resize (to preserve animation)
  // Just validate size and return as-is
  if (isGif) {
    if (file.size > MAX_OUTPUT_FILE_SIZE) {
      throw new Error(
        `GIF file too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. ` +
        `Maximum: ${MAX_OUTPUT_FILE_SIZE / 1024 / 1024}MB. ` +
        `GIFs cannot be resized without losing animation.`
      );
    }

    const sanitizedName = sanitizeFilename(file.name);
    return {
      file,
      filename: sanitizedName,
      width: img.width,
      height: img.height,
      size: file.size,
      mimeType: file.type,
    };
  }

  // Resize non-GIF images
  const { blob, width, height } = await resizeImage(
    img,
    MAX_IMAGE_SIZE,
    outputMimeType,
    0.85
  );

  // Check output size
  if (blob.size > MAX_OUTPUT_FILE_SIZE) {
    // Try again with lower quality
    const { blob: smallerBlob, width: w, height: h } = await resizeImage(
      img,
      MAX_IMAGE_SIZE,
      outputMimeType,
      0.7
    );

    if (smallerBlob.size > MAX_OUTPUT_FILE_SIZE) {
      // Reduce dimensions as well
      const { blob: finalBlob, width: finalW, height: finalH } = await resizeImage(
        img,
        1024, // Smaller max size
        outputMimeType,
        0.7
      );

      if (finalBlob.size > MAX_OUTPUT_FILE_SIZE) {
        throw new Error('Image too large to process. Please use a smaller image.');
      }

      const sanitizedName = sanitizeFilename(file.name).replace(/\.[^.]+$/, outputExtension);
      return {
        file: new File([finalBlob], sanitizedName, { type: outputMimeType }),
        filename: sanitizedName,
        width: finalW,
        height: finalH,
        size: finalBlob.size,
        mimeType: outputMimeType,
      };
    }

    const sanitizedName = sanitizeFilename(file.name).replace(/\.[^.]+$/, outputExtension);
    return {
      file: new File([smallerBlob], sanitizedName, { type: outputMimeType }),
      filename: sanitizedName,
      width: w,
      height: h,
      size: smallerBlob.size,
      mimeType: outputMimeType,
    };
  }

  const sanitizedName = sanitizeFilename(file.name).replace(/\.[^.]+$/, outputExtension);
  return {
    file: new File([blob], sanitizedName, { type: outputMimeType }),
    filename: sanitizedName,
    width,
    height,
    size: blob.size,
    mimeType: outputMimeType,
  };
}

/**
 * Create a blob URL for an image file (for offline placeholders)
 */
export function createBlobUrl(file: File): string {
  return URL.createObjectURL(file);
}

/**
 * Revoke a blob URL when no longer needed
 */
export function revokeBlobUrl(url: string): void {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

/**
 * Convert a File to base64 string for IndexedDB storage
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/webp;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Convert base64 string back to File
 */
export function base64ToFile(base64: string, filename: string, mimeType: string): File {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  return new File([blob], filename, { type: mimeType });
}

/**
 * Get alt text from filename
 */
export function getAltFromFilename(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '') // Remove extension
    .replace(/[_-]/g, ' ') // Replace underscores/dashes with spaces
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}
