/**
 * @file usePageCoverActions.ts
 * @description Hook bundling cover-mutation handlers for a single page
 * @app SHARED - Used by PageHero and PageMetaPanel
 *
 * Centralises the gradient/upload/Unsplash cover flows so any UI surface
 * that edits a page cover stays in lockstep with backend + store updates.
 */
import { useCallback, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { usePagesStore } from '@/stores/pagesStore';
import type { Page } from '@/types/page';

export interface UsePageCoverActions {
  isUploading: boolean;
  removeCover: () => Promise<void>;
  selectGradient: (gradientValue: string) => Promise<void>;
  uploadImage: (file: File | Blob, filename?: string) => Promise<void>;
  selectUnsplashImage: (imageUrl: string, attribution: string, downloadLocation?: string) => Promise<void>;
}

export function usePageCoverActions(pageId: string | null): UsePageCoverActions {
  const [isUploading, setIsUploading] = useState(false);

  const removeCover = useCallback(async () => {
    if (!pageId) return;
    try {
      const formData = new FormData();
      formData.append('coverImage', '');
      formData.append('coverGradient', '');
      formData.append('coverAttribution', '');
      await pb.collection('pages').update(pageId, formData);
      usePagesStore.getState().updatePage(pageId, { coverImage: null, coverGradient: null, coverAttribution: null });
    } catch (error) {
      console.error('Failed to remove cover:', error);
    }
  }, [pageId]);

  const selectGradient = useCallback(async (gradientValue: string) => {
    if (!pageId) return;
    try {
      const formData = new FormData();
      formData.append('coverImage', '');
      formData.append('coverGradient', gradientValue);
      formData.append('coverAttribution', '');
      await pb.collection('pages').update(pageId, formData);
      usePagesStore.getState().updatePage(pageId, { coverGradient: gradientValue, coverImage: null, coverAttribution: null });
    } catch (error) {
      console.error('Failed to set gradient cover:', error);
    }
  }, [pageId]);

  const uploadImage = useCallback(async (file: File | Blob, filename?: string) => {
    if (!pageId) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      const uploadFile = file instanceof Blob && !(file instanceof File)
        ? new File([file], filename || 'cover.jpg', { type: file.type })
        : file;
      formData.append('coverImage', uploadFile);
      formData.append('coverGradient', '');
      formData.append('coverAttribution', '');
      const result = await pb.collection('pages').update<Page>(pageId, formData);
      usePagesStore.getState().updatePage(pageId, {
        coverImage: result.coverImage || null,
        coverGradient: null,
        coverAttribution: null,
      });
    } catch (error) {
      console.error('Failed to upload cover:', error);
    } finally {
      setIsUploading(false);
    }
  }, [pageId]);

  const selectUnsplashImage = useCallback(async (imageUrl: string, attribution: string, downloadLocation?: string) => {
    if (!pageId) return;
    setIsUploading(true);
    try {
      if (downloadLocation) {
        const response = await fetch(`${pb.baseURL}/api/pages/${pageId}/unsplash-cover`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': pb.authStore.token,
          },
          body: JSON.stringify({
            downloadUrl: downloadLocation,
            attribution,
          }),
        });

        if (!response.ok) {
          let errorDetail = response.statusText;
          try {
            const errBody = await response.json();
            errorDetail = errBody.message || errorDetail;
          } catch { /* ignore parse errors */ }
          throw new Error(`Failed to set Unsplash cover: ${errorDetail}`);
        }

        try {
          const updatedPage = await response.json();
          if (updatedPage?.coverImage) {
            usePagesStore.getState().updatePage(pageId, {
              coverImage: updatedPage.coverImage,
              coverGradient: null,
              coverAttribution: attribution,
            });
          }
        } catch {
          // Response may not be JSON — SSE will reconcile.
        }
      } else {
        console.error('Cannot set cover: no download_location provided for Unsplash image');
      }
    } catch (error) {
      console.error('Failed to set Unsplash image:', error);
    } finally {
      setIsUploading(false);
    }
    // Intentionally do not silence imageUrl; some callers may pass it for fallback.
    void imageUrl;
  }, [pageId]);

  return { isUploading, removeCover, selectGradient, uploadImage, selectUnsplashImage };
}
