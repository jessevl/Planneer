/**
 * @file syncEngine/imageUpload.ts
 * @description Handles image upload queueing and processing for offline support
 * 
 * Flow:
 * 1. User pastes/drops image in editor
 * 2. Image is processed (resized) and queued in IndexedDB
 * 3. Blob URL is returned immediately for editor placeholder
 * 4. When online, images are uploaded and blob URLs replaced with real URLs
 */

import {
  queueImageUpload,
  dequeueImageUpload,
  getPendingImageUploads,
  getImageUploadByBlobUrl,
  markImageUploadFailed,
  type PendingImageUpload,
} from '../offlineDb';
import {
  processImageForUpload,
  createBlobUrl,
  revokeBlobUrl,
  fileToBase64,
  base64ToFile,
  type ImageUploadResult,
} from '../imageUtils';
import { uploadPageImage, getPageImageUrl } from '@/api/pagesApi';
import { devLog } from '../config';

// Backward compatibility aliases
const uploadNoteImage = uploadPageImage;
const getNoteImageUrl = getPageImageUrl;

/**
 * Result of queueing an image for upload
 */
export interface QueuedImageResult {
  /** Blob URL to use as placeholder */
  blobUrl: string;
  /** Upload ID for tracking */
  uploadId: string;
  /** Image dimensions */
  width: number;
  height: number;
}

/**
 * Queue an image for upload. 
 * Returns immediately with a blob URL for the editor.
 * The actual upload happens in the background when online.
 * 
 * @param file - Raw image file from user input
 * @param pageId - Page to attach image to
 * @param workspaceId - Current workspace
 * @returns Blob URL and upload metadata
 */
export async function queueImageForUpload(
  file: File,
  pageId: string,
  workspaceId: string
): Promise<QueuedImageResult> {
  // Process image (resize, convert to webp)
  const processed = await processImageForUpload(file);

  // Create blob URL for immediate display
  const blobUrl = createBlobUrl(processed.file);

  // Convert to base64 for IndexedDB storage
  const fileBase64 = await fileToBase64(processed.file);

  // Queue for upload
  const uploadId = await queueImageUpload({
    pageId,
    workspaceId,
    fileBase64,
    filename: processed.filename,
    mimeType: processed.mimeType,
    blobUrl,
    width: processed.width,
    height: processed.height,
  });

  return {
    blobUrl,
    uploadId,
    width: processed.width,
    height: processed.height,
  };
}

/**
 * Process a single pending image upload.
 * 
 * @param upload - The pending upload to process
 * @returns Upload result with real URL, or null if failed
 */
export async function processImageUpload(
  upload: PendingImageUpload
): Promise<ImageUploadResult | null> {
  try {
    // Convert base64 back to File
    const file = base64ToFile(upload.fileBase64, upload.filename, upload.mimeType);

    // Get page ID (use pageId, fall back to deprecated noteId)
    const pageId = upload.pageId || upload.pageId;
    if (!pageId) {
      throw new Error('No pageId or pageId found in upload');
    }

    // Upload to PocketBase
    const result = await uploadNoteImage(
      pageId,
      file,
      upload.width,
      upload.height
    );

    // Remove from queue
    await dequeueImageUpload(upload.id);

    // Revoke blob URL
    revokeBlobUrl(upload.blobUrl);

    return result;
  } catch (error) {
    devLog(`[ImageUpload] Failed to upload ${upload.id}:`, error);
    await markImageUploadFailed(
      upload.id,
      error instanceof Error ? error.message : 'Unknown error'
    );
    return null;
  }
}

/**
 * Process all pending image uploads for a workspace.
 * 
 * @param workspaceId - Workspace to process uploads for
 * @returns Map of blob URLs to real URLs for content replacement
 */
export async function processAllPendingImageUploads(
  workspaceId: string
): Promise<Map<string, string>> {
  const uploads = await getPendingImageUploads(workspaceId);
  const urlMap = new Map<string, string>();

  for (const upload of uploads) {
    const result = await processImageUpload(upload);
    if (result) {
      urlMap.set(upload.blobUrl, result.src);
    }
  }

  return urlMap;
}

/**
 * Check if a URL is a blob URL (pending upload).
 */
export function isBlobUrl(url: string): boolean {
  return url.startsWith('blob:');
}

/**
 * Get the real URL for a blob URL if the upload has completed.
 * Returns the blob URL if upload is still pending.
 */
export async function resolveImageUrl(blobUrl: string): Promise<string> {
  if (!isBlobUrl(blobUrl)) {
    return blobUrl;
  }

  // Check if this blob URL is still in the queue
  const upload = await getImageUploadByBlobUrl(blobUrl);
  if (upload) {
    // Still pending - return blob URL
    return blobUrl;
  }

  // Upload completed - blob URL is no longer valid
  // This shouldn't happen in normal flow as content should be updated
  devLog(`[ImageUpload] Blob URL not found in queue: ${blobUrl}`);
  return blobUrl;
}

/**
 * Replace blob URLs in note content with real URLs.
 * Used after processing pending uploads.
 * 
 * @param content - Yoopta JSON content string
 * @param urlMap - Map of blob URLs to real URLs
 * @returns Updated content string
 */
export function replaceBlobUrlsInContent(
  content: string | null,
  urlMap: Map<string, string>
): string | null {
  if (!content || urlMap.size === 0) {
    return content;
  }

  let updatedContent = content;
  for (const [blobUrl, realUrl] of urlMap) {
    // Replace all occurrences (escaped for JSON)
    const escapedBlobUrl = blobUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    updatedContent = updatedContent.replace(new RegExp(escapedBlobUrl, 'g'), realUrl);
  }

  return updatedContent;
}

/**
 * Count pending image uploads for a workspace.
 */
export async function getPendingImageUploadCount(workspaceId: string): Promise<number> {
  const uploads = await getPendingImageUploads(workspaceId);
  return uploads.length;
}
