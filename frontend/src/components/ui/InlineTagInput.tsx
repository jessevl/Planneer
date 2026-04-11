/**
 * @file InlineTagInput.tsx
 * @description Seamless inline tag input for table cells
 * 
 * Provides a Notion-like tag editing experience:
 * - Type to search/create tags
 * - Enter/comma to confirm tag
 * - Backspace removes last tag when input is empty
 * - Click tag to remove
 * - Auto-suggestions from existing tags in column
 * - Works for both single-select and multi-select
 * - Prioritizes existing matching suggestions over creating new tags
 * 
 * Optimized for inline table editing and task forms.
 */
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Check } from 'lucide-react';
import { useFloating, offset, flip, shift, autoUpdate, size } from '@floating-ui/react';
import { cn } from '@/lib/design-system';
import { TagBadge } from '@/components/ui';
import { Popover } from '@/components/ui';
import { MobileSheet } from '@/components/ui';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import { getTagColor, TAG_COLORS } from '@/lib/tagUtils';

export interface InlineTagInputProps {
  /** Current value(s) - comma-separated for multi-select */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Whether multiple tags are allowed */
  isMulti?: boolean;
  /** Existing tags in this column for suggestions */
  existingTags: string[];
  /** Placeholder text */
  placeholder?: string;
  /** Auto-focus on mount */
  autoFocus?: boolean;
  /** Additional CSS classes for the container */
  className?: string;
  /** Context key for unique color assignment (e.g., column ID) */
  contextKey?: string;
}

const InlineTagInput: React.FC<InlineTagInputProps> = ({
  value,
  onChange,
  isMulti = false,
  existingTags,
  placeholder = 'Type to add...',
  autoFocus = false,
  className,
  contextKey,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const { refs, floatingStyles } = useFloating({
    placement: 'bottom-start',
    open: showDropdown && !isMobile,
    onOpenChange: setShowDropdown,
    middleware: [
      offset(5), 
      flip(), 
      shift(),
      size({
        apply({ rects, elements }) {
          Object.assign(elements.floating.style, {
            width: `${Math.max(200, rects.reference.width)}px`,
            maxWidth: '320px',
          });
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
    strategy: 'fixed',
  });

  // Parse current tags from value
  const currentTags = useMemo(() => {
    if (!value) return [];
    return value.split(',').map(t => t.trim()).filter(Boolean);
  }, [value]);

  // Filter suggestions based on input
  const suggestions = useMemo(() => {
    const uniqueTags = Array.from(new Set(existingTags));
    const searchLower = inputValue.toLowerCase().trim();
    
    if (!searchLower) {
      // Show all unique tags, excluding already selected ones for multi-select
      return uniqueTags.filter(tag => isMulti ? !currentTags.includes(tag) : true);
    }
    
    return uniqueTags.filter(tag => {
      const tagLower = tag.toLowerCase();
      const matchesSearch = tagLower.includes(searchLower);
      const notSelected = isMulti ? !currentTags.includes(tag) : true;
      return matchesSearch && notSelected;
    });
  }, [existingTags, inputValue, currentTags, isMulti]);

  // Check if current input would create a new tag
  const isNewTag = useMemo(() => {
    const trimmed = inputValue.trim().toLowerCase();
    if (!trimmed) return false;
    return !existingTags.some(t => t.toLowerCase() === trimmed);
  }, [inputValue, existingTags]);

  // Add a tag
  const addTag = useCallback((tagName: string) => {
    const normalizedTag = tagName.trim();
    if (!normalizedTag) return;

    if (isMulti) {
      // Add to existing tags if not already present
      if (!currentTags.includes(normalizedTag)) {
        const newTags = [...currentTags, normalizedTag];
        onChange(newTags.join(', '));
      }
    } else {
      // Single select - replace
      onChange(normalizedTag);
      setShowDropdown(false);
      setIsFocused(false);
      inputRef.current?.blur();
    }
    
    setInputValue('');
    setHighlightedIndex(0);
    
    // Keep focus for multi-select
    if (isMulti && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentTags, isMulti, onChange]);

  // Remove a tag
  const removeTag = useCallback((tagToRemove: string) => {
    if (isMulti) {
      const newTags = currentTags.filter(t => t !== tagToRemove);
      onChange(newTags.join(', '));
    } else {
      onChange('');
    }
    inputRef.current?.focus();
  }, [currentTags, isMulti, onChange]);

  // Handle keyboard navigation
  // IMPORTANT: Existing suggestions are prioritized over "Create new" option
  // When there are matching existing tags, they appear first in the list
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const totalOptions = suggestions.length + (isNewTag ? 1 : 0);
    
    switch (e.key) {
      case 'Enter':
      case ',':
        e.preventDefault();
        e.stopPropagation();
        // Prioritize existing suggestions over creating new
        if (suggestions.length > 0 && highlightedIndex < suggestions.length) {
          // Select highlighted existing suggestion
          addTag(suggestions[highlightedIndex]);
        } else if (isNewTag) {
          // Create new tag only if no existing match or explicitly selected
          addTag(inputValue.trim());
        } else if (inputValue.trim()) {
          // Fall back to typed value
          addTag(inputValue.trim());
        }
        break;
        
      case 'Tab':
        // Tab should select the highlighted suggestion without creating new
        if (suggestions.length > 0 && highlightedIndex < suggestions.length) {
          e.preventDefault();
          addTag(suggestions[highlightedIndex]);
        } else if (isNewTag && inputValue.trim()) {
          e.preventDefault();
          addTag(inputValue.trim());
        }
        break;
        
      case 'Backspace':
        if (inputValue === '' && currentTags.length > 0) {
          // Remove last tag
          removeTag(currentTags[currentTags.length - 1]);
        }
        break;
        
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        setHighlightedIndex(prev => Math.min(prev + 1, totalOptions - 1));
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        break;
        
      case 'Escape':
        setShowDropdown(false);
        setInputValue('');
        break;
    }
  }, [suggestions, isNewTag, highlightedIndex, inputValue, currentTags, addTag, removeTag]);

  // Show dropdown when focused and has suggestions or input
  useEffect(() => {
    setShowDropdown(isFocused && (suggestions.length > 0 || isNewTag));
  }, [isFocused, suggestions.length, isNewTag]);

  // Focus mobile input when sheet opens
  useEffect(() => {
    if (isMobile && showDropdown && mobileInputRef.current) {
      // Delay focus to allow sheet animation to complete
      const timer = setTimeout(() => {
        mobileInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isMobile, showDropdown]);

  // Reset highlighted index when suggestions change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [inputValue]);

  // Handle click outside - must check both the container and the portaled floating element
  const floatingRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        (!floatingRef.current || !floatingRef.current.contains(target))
      ) {
        setShowDropdown(false);
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div 
      ref={(node) => {
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        refs.setReference(node);
      }}
      className={cn(
        "relative rounded-[inherit]",
        // Only expand to full width on mobile, or when there are tags
        isMobile || currentTags.length > 0 ? "w-full" : "w-fit"
      )}
    >
      {/* Tags + Input Container */}
      <div 
        className={cn(
          'flex flex-wrap items-center gap-1 transition-colors cursor-text',
          // Default padding if no className provided
          !className && 'min-h-[32px] px-1 py-0.5 rounded w-full',
          // Use provided className for padding/sizing when not a full tag
          className && (!isMulti && currentTags.length > 0 && !isFocused ? 'p-0 rounded-[inherit] w-full h-full' : cn(className, 'rounded-[inherit]')),
          isFocused && 'bg-[var(--color-interactive-bg)]/50',
          // Ensure it doesn't grow too much on desktop if empty
          !isMobile && currentTags.length === 0 && "w-fit"
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Existing Tags */}
        {currentTags.map((tag) => (
          <TagBadge 
            key={tag} 
            tag={tag} 
            compact={isMulti || isFocused} 
            onRemove={() => removeTag(tag)}
            noPadding={!isMulti && !isFocused}
            contextKey={contextKey}
            existingTags={existingTags}
            className={cn(
              !isMulti && !isFocused && "w-full h-full !rounded-[inherit] text-sm font-semibold border-none",
              !isMulti && !isFocused && (className?.includes('justify-end') ? "justify-end" : "justify-between"),
              !isMulti && !isFocused && (className || "px-3 py-1.5"),
              !isMulti && !isFocused && "flex" // Use flex instead of inline-flex to fill
            )}
          />
        ))}
        
        {/* Input - always visible for multi, or when no value for single, OR when focused */}
        {(isMulti || currentTags.length === 0 || isFocused) && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onKeyDown={handleKeyDown}
            placeholder={currentTags.length === 0 ? placeholder : ''}
            autoFocus={autoFocus}
            className={cn(
              'flex-1 bg-transparent text-sm outline-none',
              className?.includes('justify-end') && 'text-right',
              currentTags.length === 0 
                ? 'placeholder:text-xs placeholder:font-medium placeholder:opacity-40 group-hover:placeholder:opacity-60 placeholder:transition-opacity'
                : 'placeholder:text-[var(--color-text-tertiary)]',
              // If single tag and focused, add some padding to match the button look
              !isMulti && currentTags.length > 0 && isFocused && "px-1"
            )}
          />
        )}
      </div>

      {/* Dropdown Content - Shared between Popover and MobileSheet */}
      {/* IMPORTANT: Existing suggestions appear FIRST to prioritize selecting them */}
      {(() => {
        const content = (
          <div className="p-2 flex flex-wrap gap-2">
            {/* Existing tag suggestions - FIRST to prioritize selection */}
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
                    addTag(tag);
                  }}
                  onClick={() => {
                    if (isMobile) addTag(tag);
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

            {/* Create new tag option - LAST to de-prioritize */}
            {isNewTag && (
              <button
                type="button"
                onMouseDown={(e) => {
                  if (!isMobile) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                  addTag(inputValue.trim());
                }}
                onClick={() => {
                  if (isMobile) addTag(inputValue.trim());
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
                  tag={inputValue.trim()} 
                  contextKey={contextKey}
                  existingTags={existingTags}
                />
              </button>
            )}

            {/* Empty state */}
            {suggestions.length === 0 && !isNewTag && (
              <div className="w-full px-2 py-4 text-xs text-[var(--color-text-tertiary)] text-center">
                Type to create a new tag
              </div>
            )}
          </div>
        );

        if (isMobile) {
          return (
            <MobileSheet
              isOpen={showDropdown}
              onClose={() => {
                setShowDropdown(false);
                setIsFocused(false);
              }}
              title={isMulti ? "Select Tags" : "Select Tag"}
            >
              <div className="p-4">
                {/* Selected Tags Preview in Mobile Sheet */}
                {isMulti && currentTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4 p-2 bg-[var(--color-surface-secondary)] rounded-lg border border-[var(--color-border-default)]">
                    {currentTags.map((tag) => (
                      <TagBadge 
                        key={tag} 
                        tag={tag} 
                        onRemove={() => removeTag(tag)}
                        contextKey={contextKey}
                        existingTags={existingTags}
                      />
                    ))}
                  </div>
                )}

                <div className="mb-4">
                  <input
                    ref={mobileInputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search or create tag..."
                    className="w-full px-3 py-2 bg-[var(--color-surface-secondary)] rounded-lg outline-none text-sm"
                  />
                </div>
                <div className="max-h-[40vh] overflow-y-auto">
                  {content}
                </div>
              </div>
            </MobileSheet>
          );
        }

        if (showDropdown) {
          return createPortal(
            <Popover 
              ref={(node) => {
                refs.setFloating(node);
                floatingRef.current = node;
              }}
              style={floatingStyles}
              width="auto" 
              padding="none"
              className="max-h-[200px] overflow-y-auto z-[9999]"
              onClickCapture={(e) => e.stopPropagation()}
            >
              {content}
            </Popover>,
            document.body
          );
        }

        return null;
      })()}
    </div>
  );
};

export default InlineTagInput;
