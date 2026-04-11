/**
 * @file PageTypeDropdown.tsx
 * @description Dropdown button for creating new pages with different types
 * 
 * Used in:
 * - TreeSection header (+ button)
 * - TreeSidebarItem hover actions (+ button for child pages)
 * - Any place that needs a "new page" dropdown
 * 
 * Shows page creation options: Note, Collection, and Tasks
 * 
 * INTERACTION PATTERN:
 * - Click to open menu (stays open until explicitly closed)
 * - Click outside to close
 * - Press Escape to close
 * - Menu stays open even if mouse leaves trigger area
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PlusIcon } from './Icons';
import { ListPlus } from 'lucide-react';
import { createPageOptions } from '@/lib/viewModeConfig';
import type { PageViewMode } from '@/types/page';
import { cn } from '@/lib/design-system';

interface PageTypeDropdownProps {
  /** Callback when a page type is selected */
  onSelect: (viewMode: PageViewMode) => void;
  /** Parent ID for child pages (null for root) */
  parentId?: string | null;
  /** Custom trigger button content (default: + icon) */
  trigger?: React.ReactNode;
  /** Additional classes for the trigger button */
  triggerClassName?: string;
  /** Title/tooltip for the trigger */
  title?: string;
  /** Alignment of dropdown menu */
  align?: 'left' | 'right';
  /** Size variant */
  size?: 'sm' | 'md';
  /** Stop propagation on click */
  stopPropagation?: boolean;
  /** Callback to create a task (only shown if provided) */
  onCreateTask?: () => void;
}

/**
 * PageTypeDropdown - A dropdown button for selecting page types when creating new pages
 * 
 * Uses click-to-open pattern. Menu stays open until:
 * 1. User clicks an option
 * 2. User clicks outside the dropdown
 * 3. User presses Escape
 */
const PageTypeDropdown: React.FC<PageTypeDropdownProps> = ({
  onSelect,
  parentId,
  trigger,
  triggerClassName,
  title = 'Create new page',
  align = 'right',
  size = 'sm',
  stopPropagation = true,
  onCreateTask,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown
  const closeDropdown = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is inside the dropdown container (trigger + menu)
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    };
    
    // Use click instead of mousedown for more reliable behavior
    // This prevents the menu from closing when mouse moves over other elements
    document.addEventListener('click', handleClickOutside, true);
    return () => document.removeEventListener('click', handleClickOutside, true);
  }, [isOpen, closeDropdown]);
  
  // Close dropdown on Escape key
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeDropdown();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, closeDropdown]);

  const handleTriggerClick = (e: React.MouseEvent) => {
    if (stopPropagation) {
      e.stopPropagation();
      e.preventDefault();
    }
    setIsOpen(!isOpen);
  };

  const handleOptionClick = (viewMode: PageViewMode, e: React.MouseEvent) => {
    if (stopPropagation) {
      e.stopPropagation();
    }
    onSelect(viewMode);
    setIsOpen(false);
  };

  const sizeClasses = size === 'sm' 
    ? 'w-5 h-5' 
    : 'w-6 h-6';
  
  const iconClasses = size === 'sm'
    ? 'w-3.5 h-3.5'
    : 'w-4 h-4';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={handleTriggerClick}
        className={triggerClassName || `flex items-center justify-center ${sizeClasses} rounded hover:bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors`}
        title={title}
        aria-label={title}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        {trigger || <PlusIcon className={iconClasses} />}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div 
          className={`absolute top-full mt-1 w-48 bg-[var(--color-surface-primary)] border border-[var(--color-border-default)] rounded-xl shadow-lg z-50 p-1 ${
            align === 'left' ? 'left-0' : 'right-0'
          }`}
          role="menu"
        >
          {onCreateTask && (
            <>
              <button
                onClick={(e) => {
                  if (stopPropagation) e.stopPropagation();
                  onCreateTask();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors rounded-md group/item"
                role="menuitem"
              >
                <ListPlus className="w-4 h-4" />
                <span className="font-bold">Create Task</span>
              </button>
              <div className="px-3 py-2 border-y border-[var(--color-border-default)]">
                <span className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
                  Create New
                </span>
              </div>
            </>
          )}

          {!onCreateTask && (
            /* Header */
            <div className="px-3 py-2 border-b border-[var(--color-border-default)]">
              <span className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
                Create New
              </span>
            </div>
          )}

          {/* Options */}
          {createPageOptions.map((option, index) => {
            const OptionIcon = option.icon;
            const isLast = index === createPageOptions.length - 1;
            return (
              <button
                key={option.value}
                onClick={(e) => handleOptionClick(option.value, e)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-sm text-left text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors rounded-md"
                )}
                role="menuitem"
              >
                <OptionIcon className="w-4 h-4" />
                <span className="font-medium">{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PageTypeDropdown;
