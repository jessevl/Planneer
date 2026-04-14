/**
 * @file TagPickerMenu.tsx
 * @description Shared tag suggestion picker content for inline and popover editing
 * @app SHARED - Used by InlineTagInput, PageEditor, UnifiedSidepanel
 *
 * Features:
 * - Reuses the same suggestion and create-new tag UI across contexts
 * - Supports highlighted keyboard selection state
 * - Renders existing tags with TagBadge styling
 * - Handles desktop mouse-down selection without stealing focus
 *
 * Used by:
 * - InlineTagInput
 * - PageEditor
 * - UnifiedSidepanel
 */
import React from 'react';
import { Check, Plus } from 'lucide-react';
import { cn } from '@/lib/design-system';
import TagBadge from './TagBadge';

interface TagPickerMenuProps {
  /** Suggested existing tags to choose from. */
  suggestions: string[];
  /** Already selected tags for the current entity. */
  currentTags: string[];
  /** Zero-based highlighted option index for keyboard navigation. */
  highlightedIndex: number;
  /** Whether the current query should offer a create-new action. */
  canCreate: boolean;
  /** Current freeform tag query. */
  query: string;
  /** Existing tags used by TagBadge for consistent color mapping. */
  existingTags: string[];
  /** Optional tag color context key. */
  contextKey?: string;
  /** Whether the picker is rendered in a mobile interaction context. */
  isMobile?: boolean;
  /** Called when an existing tag is selected. */
  onSelectTag: (tag: string) => void;
  /** Called when a new tag should be created. */
  onCreateTag: (tag: string) => void;
}

const TagPickerMenu: React.FC<TagPickerMenuProps> = ({
  suggestions,
  currentTags,
  highlightedIndex,
  canCreate,
  query,
  existingTags,
  contextKey,
  isMobile = false,
  onSelectTag,
  onCreateTag,
}) => {
  const trimmedQuery = query.trim();

  return (
    <div className="p-2 flex flex-wrap gap-2">
      {suggestions.map((tag, idx) => {
        const isHighlighted = highlightedIndex === idx;
        const isSelected = currentTags.includes(tag);

        return (
          <button
            key={tag}
            type="button"
            onMouseDown={(e) => {
              if (!isMobile) {
                e.preventDefault();
                e.stopPropagation();
              }
              onSelectTag(tag);
            }}
            onClick={() => {
              if (isMobile) onSelectTag(tag);
            }}
            className={cn(
              'flex items-center gap-2 p-0.5 rounded-full transition-all',
              isHighlighted
                ? 'ring-2 ring-[var(--color-interactive-ring)] ring-offset-1 ring-offset-[var(--color-surface-base)]'
                : 'hover:scale-105',
              isSelected && 'opacity-50'
            )}
          >
            <TagBadge
              tag={tag}
              className="!text-sm !px-3 !py-1.5"
              contextKey={contextKey}
              existingTags={existingTags}
            />
            {isSelected && <Check className="w-3 h-3 ml-auto text-[var(--color-interactive-text-strong)] sr-only" />}
          </button>
        );
      })}

      {canCreate && trimmedQuery && (
        <button
          type="button"
          onMouseDown={(e) => {
            if (!isMobile) {
              e.preventDefault();
              e.stopPropagation();
            }
            onCreateTag(trimmedQuery);
          }}
          onClick={() => {
            if (isMobile) onCreateTag(trimmedQuery);
          }}
          className={cn(
            'flex items-center gap-2 px-2 py-1.5 rounded-lg border border-dashed border-[var(--color-border-default)] transition-colors',
            highlightedIndex === suggestions.length
              ? 'bg-[var(--color-interactive-bg)] border-[var(--color-interactive-border)]'
              : 'hover:bg-[var(--color-surface-secondary)]'
          )}
        >
          <Plus className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
          <span className="text-xs text-[var(--color-text-secondary)]">Create</span>
          <TagBadge
            tag={trimmedQuery}
            contextKey={contextKey}
            existingTags={existingTags}
          />
        </button>
      )}

      {suggestions.length === 0 && !canCreate && (
        <div className="w-full px-2 py-4 text-xs text-[var(--color-text-tertiary)] text-center">
          Type to create a new tag
        </div>
      )}
    </div>
  );
};

export default TagPickerMenu;
