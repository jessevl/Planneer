/**
 * @file ExcalidrawInlineCard.tsx
 * @description Compact inline card preview for whiteboard blocks
 * @app PAGES - Shown in note editor when whiteboard is collapsed
 *
 * Features:
 * - Thumbnail preview when available
 * - Element count and last-edited metadata
 * - Click-to-edit placeholder when empty
 * - Read-only display support
 *
 * Used by:
 * - ExcalidrawRender.tsx
 */
import React from 'react';
import { WhiteboardIcon, EditIcon } from '@/components/common/Icons';
import { cn } from '@/lib/design-system';
import { normalizePocketBaseAssetUrl } from '@/lib/pocketbase';

// ============================================================================
// TYPES
// ============================================================================

interface ExcalidrawInlineCardProps {
  snapshot: string | null;
  elementCount: number;
  thumbnailUrl: string | null;
  lastEdited: string | null;
  isReadOnly: boolean;
  onOpen: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ============================================================================
// COMPONENT
// ============================================================================

const ExcalidrawInlineCard: React.FC<ExcalidrawInlineCardProps> = React.memo(
  ({ snapshot, elementCount, thumbnailUrl, lastEdited, isReadOnly, onOpen }) => {
    const isEmpty = !snapshot;
    const normalizedThumbnailUrl = normalizePocketBaseAssetUrl(thumbnailUrl);

    // Empty state — click to start drawing
    if (isEmpty) {
      if (isReadOnly) return null;
      return (
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            'yoopta-plugin-card yoopta-plugin-card--dashed w-full rounded-lg py-8 px-4',
            'flex flex-col items-center justify-center gap-2',
            'border border-dashed',
            'text-[var(--color-text-secondary)]',
            'hover:text-[var(--color-accent-primary)]',
            'transition-colors cursor-pointer group',
          )}
        >
          <div className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center',
            'bg-[var(--color-surface-tertiary)]',
            'group-hover:bg-[var(--color-surface-secondary)]',
            'transition-colors',
          )}>
            <WhiteboardIcon className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </div>
          <span className="text-sm font-medium">Click to start drawing</span>
        </button>
      );
    }

    // Populated card with optional thumbnail
    return (
      <button
        type="button"
        onClick={isReadOnly ? undefined : onOpen}
        className={cn(
          'yoopta-plugin-card w-full rounded-lg overflow-hidden text-left',
          'border',
          !isReadOnly && 'cursor-pointer',
          'transition-colors group',
        )}
      >
        {/* Thumbnail preview */}
        {normalizedThumbnailUrl && (
          <div className="w-full h-40 overflow-hidden bg-[var(--color-surface-base)]">
            <img
              src={normalizedThumbnailUrl}
              alt="Whiteboard preview"
              className="w-full h-full object-contain"
              loading="lazy"
            />
          </div>
        )}

        {/* Info bar */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
            'bg-[var(--color-surface-tertiary)]',
            'group-hover:bg-[var(--color-surface-secondary)]',
            'transition-colors',
          )}>
            <WhiteboardIcon className="w-4 h-4 text-[var(--color-text-secondary)]" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              Whiteboard
            </span>
            <span className="text-xs text-[var(--color-text-secondary)] ml-2">
              {elementCount} {elementCount === 1 ? 'element' : 'elements'}
              {lastEdited ? ` · ${formatRelativeTime(lastEdited)}` : ''}
            </span>
          </div>
          {!isReadOnly && (
            <EditIcon className="w-4 h-4 text-[var(--color-text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </button>
    );
  },
);

ExcalidrawInlineCard.displayName = 'ExcalidrawInlineCard';

export default ExcalidrawInlineCard;
