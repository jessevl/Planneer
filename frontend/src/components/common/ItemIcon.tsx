/**
 * @file ItemIcon.tsx
 * @description Universal icon component for displaying item icons (pages, task pages, collections)
 * @app SHARED - Used across all page types
 * 
 * Renders the appropriate icon based on item type:
 * - Custom Lucide icon if provided (takes precedence)
 * - Stylized themed icon with color if no custom icon
 * - Special icons for daily notes (calendar icon)
 * 
 * Used in:
 * - Sidebar tree items (UnifiedSidebar via TreeSidebarItem)
 * - Page cards and rows
 * - Task Page badges and breadcrumbs
 * - ItemPropertiesModal icon picker
 */
"use client";
import React from 'react';
import { StylizedNoteIcon, StylizedCollectionIcon, StylizedTaskIcon } from './StylizedIcons';
import { CalendarIcon } from './Icons';
import { LucideIcon } from '@/components/ui';

export type ItemIconType = 'note' | 'collection' | 'daily' | 'tasks';

export interface ItemIconProps {
  /** Type of item - determines default icon style */
  type: ItemIconType;
  /** Custom emoji icon (takes precedence over color) */
  icon?: string | null;
  /** Color for the default stylized icon */
  color?: string | null;
  /** Size of the icon */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Additional CSS classes */
  className?: string;
  /** Click handler - if provided, icon becomes a button */
  onClick?: () => void;
  /** Whether this is clickable (shows hover state even without onClick) */
  clickable?: boolean;
}

// Size mappings
// Size mappings for Lucide icons
const LUCIDE_SIZE_CLASSES = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
};

const SPECIAL_ICON_CLASSES = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
};

// Map our sizes to StylizedIcon sizes
const STYLIZED_SIZE_MAP: Record<string, 'sm' | 'md' | 'lg'> = {
  xs: 'sm',
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  xl: 'lg',
};

/**
 * ItemIcon - Universal icon component for pages, task pages, and collections
 * 
 * Renders:
 * - Custom emoji if provided
 * - Stylized themed icon based on type and color if no emoji
 * - Special icons for daily notes
 * 
 * Can be clickable to trigger icon editing via ItemPropertiesModal
 */
const ItemIcon: React.FC<ItemIconProps> = ({
  type,
  icon,
  color,
  size = 'md',
  className = '',
  onClick,
  clickable = false,
}) => {
  const isClickable = onClick || clickable;
  
  // Render the icon content
  const renderIcon = () => {
    // Custom Lucide icon takes precedence
    if (icon && icon.trim()) {
      return (
        <LucideIcon 
          name={icon} 
          className={LUCIDE_SIZE_CLASSES[size]}
          style={{ color: color || '#64748b' }}
        />
      );
    }
    
    // Daily pages get a calendar icon
    if (type === 'daily') {
      return (
        <CalendarIcon className={`${SPECIAL_ICON_CLASSES[size]} text-blue-500 dark:text-blue-400`} />
      );
    }
    
    // Collection type - folder-like icon
    if (type === 'collection') {
      return (
        <StylizedCollectionIcon 
          color={color} 
          size={STYLIZED_SIZE_MAP[size]} 
        />
      );
    }
    
    // Tasks type - task collection icon
    if (type === 'tasks') {
      return (
        <StylizedTaskIcon 
          color={color}
          size={STYLIZED_SIZE_MAP[size]}
        />
      );
    }
    
    // Note type - two-tone circle
    if (type === 'note') {
      return (
        <StylizedNoteIcon 
          color={color} 
          size={STYLIZED_SIZE_MAP[size]} 
        />
      );
    }
    
    // Default: note type - document icon
    return (
      <StylizedNoteIcon 
        color={color} 
        size={STYLIZED_SIZE_MAP[size]} 
      />
    );
  };

  // Wrapper styles
  const wrapperClasses = isClickable
    ? `inline-flex items-center justify-center rounded-md transition-colors cursor-pointer hover:bg-[var(--color-surface-secondary)] ${className}`
    : `inline-flex items-center justify-center ${className}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={wrapperClasses}
        title="Change icon"
      >
        {renderIcon()}
      </button>
    );
  }

  return (
    <span className={wrapperClasses}>
      {renderIcon()}
    </span>
  );
};

export default ItemIcon;
