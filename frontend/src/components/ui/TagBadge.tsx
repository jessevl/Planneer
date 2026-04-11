/**
 * @file TagBadge.tsx
 * @description Displays a tag as a colored badge
 * 
 * Compact, pill-shaped badge with color based on tag name.
 * Used in TaskRow, PageCard, and anywhere tags are displayed.
 */
import React from 'react';
import { cn } from '@/lib/design-system';
import { getTagColor, getTagColorInContext } from '@/lib/tagUtils';
import { Tag as TagIcon, X } from 'lucide-react';

export interface TagBadgeProps {
  /** Tag name to display */
  tag: string;
  /** Optional manual color override */
  color?: string;
  /** Additional CSS classes */
  className?: string;
  /** Show icon before text */
  showIcon?: boolean;
  /** Click handler */
  onClick?: (e: React.MouseEvent) => void;
  /** Remove handler - if provided, shows an 'x' button inside the pill */
  onRemove?: (e: React.MouseEvent) => void;
  /** Compact mode - smaller padding */
  compact?: boolean;
  /** Disable default padding */
  noPadding?: boolean;
  /** Context key for unique color assignment (e.g., column ID) */
  contextKey?: string;
  /** Existing tags in context for avoiding color duplicates */
  existingTags?: string[];
}

/**
 * TagBadge - Colored pill badge for tags
 * 
 * @example
 * <TagBadge tag="work" />
 * <TagBadge tag="urgent" showIcon />
 * <TagBadge tag="important" contextKey="column-1" existingTags={['work', 'personal']} />
 */
const TagBadge: React.FC<TagBadgeProps> = ({
  tag,
  color: manualColor,
  className,
  showIcon = false,
  onClick,
  onRemove,
  compact = false,
  noPadding = false,
  contextKey,
  existingTags,
}) => {
  // Use context-aware color assignment if context is provided
  const color = contextKey 
    ? getTagColorInContext(tag, contextKey, existingTags)
    : getTagColor(tag);
  const displayName = tag.includes('::') ? tag.split('::')[0] : tag;
  
  const style = manualColor ? {
    backgroundColor: manualColor + '33', // 20% opacity
    color: manualColor,
    borderColor: manualColor + '66', // 40% opacity
    borderWidth: '1px',
  } : {};

  return (
    <span
      onClick={onClick}
      style={style}
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        'transition-all duration-150',
        !noPadding && (compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'),
        onClick && 'cursor-pointer hover:opacity-80 active:scale-95',
        !manualColor && color.bg,
        !manualColor && color.text,
        className
      )}
    >
      {showIcon && <TagIcon className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
      {displayName}
      {onRemove && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove(e);
          }}
          className="ml-0.5 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/20 transition-colors eink-header-button"
        >
          <X className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        </button>
      )}
    </span>
  );
};

export default TagBadge;
