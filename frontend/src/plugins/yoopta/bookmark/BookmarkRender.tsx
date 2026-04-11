/**
 * @file BookmarkRender.tsx
 * @description Render component for the Bookmark Card plugin
 * 
 * Displays a link preview card with:
 * - Favicon (via Google's favicon service - no CORS issues)
 * - Title (extracted from URL path)
 * - Site name
 */
import { useCallback, useMemo } from 'react';
import type { PluginElementRenderProps } from '@yoopta/editor';
import { Elements, useYooptaEditor } from '@yoopta/editor';
import { ExternalLink, Globe } from 'lucide-react';

import { MediaPlaceholder, MediaUploaderResult } from '../shared';
import { getFaviconUrl } from './fetchMetadata';
import type { BookmarkElementProps } from './types';

// ============================================================================
// HELPERS
// ============================================================================

function getSiteNameFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.replace(/^www\./, '').split('.');
    if (parts.length >= 2) {
      const name = parts[0];
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    return hostname;
  } catch {
    return '';
  }
}

function getTitleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      const lastPart = pathParts[pathParts.length - 1];
      const cleaned = lastPart
        .replace(/[-_]/g, ' ')
        .replace(/\.[a-z]+$/i, '')
        .trim();
      
      if (cleaned.length > 3) {
        return cleaned
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
    }
    return getSiteNameFromUrl(url);
  } catch {
    return url;
  }
}

function getDisplayUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// ============================================================================
// BOOKMARK CARD COMPONENT
// ============================================================================

export default function BookmarkRender({
  attributes,
  element,
  blockId,
}: PluginElementRenderProps) {
  const editor = useYooptaEditor();
  const props = element.props as unknown as BookmarkElementProps;
  const { url } = props;

  // Compute display values from URL (no async needed)
  const displayData = useMemo(() => {
    if (!url) return null;
    return {
      title: getTitleFromUrl(url),
      siteName: getSiteNameFromUrl(url),
      favicon: getFaviconUrl(url),
      displayUrl: getDisplayUrl(url),
    };
  }, [url]);

  // Handle media selection from the unified MediaPlaceholder
  const handleMediaSelect = useCallback((result: MediaUploaderResult) => {
    Elements.updateElement(editor, {
      blockId,
      type: 'bookmark',
      props: {
        url: result.url,
      },
    });
  }, [editor, blockId]);

  const handleOpenLink = useCallback(() => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [url]);

  // Prevent Slate from trying to handle selection on void elements
  const preventSlateSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Show placeholder if no URL
  if (!url || !displayData) {
    return (
      <div {...attributes} contentEditable={false}>
        <MediaPlaceholder
          type="bookmark"
          onMediaSelect={handleMediaSelect}
          readOnly={editor.readOnly}
        />
      </div>
    );
  }

  return (
    <div 
      {...attributes} 
      contentEditable={false}
      onMouseDown={preventSlateSelection}
      onClick={preventSlateSelection}
    >
      <div
        onClick={handleOpenLink}
        className="yoopta-plugin-card group relative flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-[var(--color-border-default)] cursor-pointer transition-colors"
      >
        {/* Favicon */}
        <div className="flex-shrink-0 w-6 h-6 rounded bg-[var(--color-surface-secondary)] flex items-center justify-center overflow-hidden">
          {displayData.favicon ? (
            <img
              src={displayData.favicon}
              alt=""
              className="w-4 h-4"
              onError={(e) => {
                // Hide image on error, show globe icon
                (e.target as HTMLImageElement).style.display = 'none';
                const parent = (e.target as HTMLImageElement).parentElement;
                if (parent) {
                  const icon = document.createElement('div');
                  icon.innerHTML = '<svg class="w-5 h-5 text-[var(--color-text-tertiary)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
                  parent.appendChild(icon);
                }
              }}
            />
          ) : (
            <Globe className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <span className="font-medium text-sm text-[var(--color-text-primary)] truncate">
            {displayData.title}
          </span>
          <span className="text-xs text-[var(--color-text-tertiary)]">•</span>
          <span className="text-xs text-[var(--color-text-tertiary)] truncate">
            {displayData.displayUrl}
          </span>
        </div>

        {/* External link icon */}
        <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <ExternalLink className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
        </div>
      </div>
    </div>
  );
}
