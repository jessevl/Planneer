/**
 * @file PageCellPicker.tsx
 * @description Inline page picker for table cells
 * 
 * Allows users to:
 * - Select an existing subpage (child of the current page)
 * - Create a new subpage inline
 * - Click on linked page to navigate
 * 
 * Cell value stores the page ID, displays the page title.
 */
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FileText, Plus, X, ExternalLink } from 'lucide-react';
import { useFloating, offset, flip, shift, autoUpdate, size } from '@floating-ui/react';
import { cn } from '@/lib/design-system';
import { Popover } from '@/components/ui';
import { MobileSheet } from '@/components/ui';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import { usePagesStore } from '@/stores/pagesStore';
import { useNavigate } from '@tanstack/react-router';

export interface PageCellPickerProps {
  /** Current page ID value */
  value: string;
  /** Callback when page selection changes */
  onChange: (pageId: string) => void;
  /** Parent page ID (to show only subpages of this page) */
  parentPageId: string | null;
  /** Placeholder text */
  placeholder?: string;
  /** Auto-focus on mount */
  autoFocus?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const PageCellPicker: React.FC<PageCellPickerProps> = ({
  value,
  onChange,
  parentPageId,
  placeholder = 'Link page...',
  autoFocus = false,
  className,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  // Access pages store
  const pagesById = usePagesStore((s) => s.pagesById);
  const getChildren = usePagesStore((s) => s.getChildren);
  const createPage = usePagesStore((s) => s.createPage);

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
            width: `${Math.max(240, rects.reference.width)}px`,
            maxWidth: '360px',
          });
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
    strategy: 'fixed',
  });

  // Get the currently linked page
  const linkedPage = useMemo(() => {
    if (!value) return null;
    return pagesById[value] || null;
  }, [value, pagesById]);

  // Get available subpages (children of the parent page)
  const availablePages = useMemo(() => {
    if (!parentPageId) return [];
    return getChildren(parentPageId).filter((p) => p.viewMode !== 'tasks'); // Exclude task collections
  }, [parentPageId, getChildren]);

  // Filter pages based on search
  const filteredPages = useMemo(() => {
    const searchLower = inputValue.toLowerCase().trim();
    if (!searchLower) {
      // Show all available pages, excluding the currently linked one
      return availablePages.filter((p) => p.id !== value);
    }
    return availablePages.filter((p) => {
      const titleLower = p.title.toLowerCase();
      return titleLower.includes(searchLower) && p.id !== value;
    });
  }, [availablePages, inputValue, value]);

  // Check if current input would create a new page
  const isNewPage = useMemo(() => {
    const trimmed = inputValue.trim().toLowerCase();
    if (!trimmed) return false;
    return !availablePages.some((p) => p.title.toLowerCase() === trimmed);
  }, [inputValue, availablePages]);

  // Select an existing page
  const selectPage = useCallback(
    (pageId: string) => {
      onChange(pageId);
      setInputValue('');
      setShowDropdown(false);
      setIsFocused(false);
      inputRef.current?.blur();
    },
    [onChange]
  );

  // Create a new subpage (without navigating to it)
  const createNewPage = useCallback(() => {
    const title = inputValue.trim();
    if (!title || !parentPageId) return;

    // Save ALL current draft state to restore after creation
    // (createPage sets activePageId, draftTitle, draftContent which would affect the current page)
    const state = usePagesStore.getState();
    const savedState = {
      activePageId: state.activePageId,
      draftTitle: state.draftTitle,
      draftContent: state.draftContent,
      isDirty: state.isDirty,
      isNewlyCreated: state.isNewlyCreated,
      isContentLoading: state.isContentLoading,
    };
    
    const newPage = createPage({
      title,
      parentId: parentPageId,
      viewMode: 'note',
    });

    // Restore ALL draft state to prevent affecting the current page
    usePagesStore.setState(savedState);
    
    onChange(newPage.id);
    setInputValue('');
    setShowDropdown(false);
    setIsFocused(false);
    inputRef.current?.blur();
  }, [inputValue, parentPageId, createPage, onChange]);

  // Clear the linked page
  const clearPage = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange('');
    },
    [onChange]
  );

  // Navigate to the linked page
  const navigateToPage = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (linkedPage) {
        navigate({ to: '/pages/$id', params: { id: linkedPage.id } });
      }
    },
    [linkedPage, navigate]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const totalOptions = filteredPages.length + (isNewPage ? 1 : 0);

      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          if (isNewPage && highlightedIndex === 0) {
            // Create new page
            createNewPage();
          } else if (filteredPages.length > 0) {
            // Select highlighted page
            const pageIndex = isNewPage ? highlightedIndex - 1 : highlightedIndex;
            if (filteredPages[pageIndex]) {
              selectPage(filteredPages[pageIndex].id);
            }
          } else if (inputValue.trim() && isNewPage) {
            // Create new page
            createNewPage();
          }
          break;

        case 'Backspace':
          if (inputValue === '' && linkedPage) {
            // Clear linked page
            onChange('');
          }
          break;

        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          setHighlightedIndex((prev) => Math.min(prev + 1, totalOptions - 1));
          break;

        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          setHighlightedIndex((prev) => Math.max(prev - 1, 0));
          break;

        case 'Escape':
          setShowDropdown(false);
          setInputValue('');
          break;
      }
    },
    [filteredPages, isNewPage, highlightedIndex, inputValue, linkedPage, createNewPage, selectPage, onChange]
  );

  // Show dropdown when focused and has pages or input for new page
  useEffect(() => {
    setShowDropdown(isFocused && (filteredPages.length > 0 || isNewPage || availablePages.length > 0));
  }, [isFocused, filteredPages.length, isNewPage, availablePages.length]);

  // Focus mobile input when sheet opens
  useEffect(() => {
    if (isMobile && showDropdown && mobileInputRef.current) {
      const timer = setTimeout(() => {
        mobileInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isMobile, showDropdown]);

  // Reset highlighted index when input changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [inputValue]);

  // Auto-focus handling
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Dropdown content component
  const DropdownContent = ({ inputRefProp }: { inputRefProp?: React.RefObject<HTMLInputElement | null> }) => (
    <div className="p-1">
      {/* Search input for mobile */}
      {isMobile && (
        <div className="p-2 border-b border-[var(--color-border-primary)]">
          <input
            ref={mobileInputRef}
            type="text"
            className="w-full px-3 py-2 text-sm bg-[var(--color-surface-secondary)] border border-[var(--color-border-primary)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]"
            placeholder="Search or create page..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
      )}

      {/* Create new option */}
      {isNewPage && inputValue.trim() && (
        <button
          type="button"
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded transition-colors',
            highlightedIndex === 0
              ? 'bg-[var(--color-accent-muted)] text-[var(--color-accent-primary)]'
              : 'hover:bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]'
          )}
          onMouseDown={(e) => {
            e.preventDefault();
            createNewPage();
          }}
          onMouseEnter={() => setHighlightedIndex(0)}
        >
          <Plus className="w-4 h-4" />
          <span>Create "{inputValue.trim()}"</span>
        </button>
      )}

      {/* Available pages */}
      {filteredPages.length > 0 ? (
        <div className="max-h-60 overflow-y-auto">
          {filteredPages.map((page, index) => {
            const optionIndex = isNewPage ? index + 1 : index;
            const isHighlighted = highlightedIndex === optionIndex;
            return (
              <button
                key={page.id}
                type="button"
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded transition-colors',
                  isHighlighted
                    ? 'bg-[var(--color-accent-muted)] text-[var(--color-accent-primary)]'
                    : 'hover:bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]'
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectPage(page.id);
                }}
                onMouseEnter={() => setHighlightedIndex(optionIndex)}
              >
                <FileText className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                <span className="truncate">{page.title || 'Untitled'}</span>
              </button>
            );
          })}
        </div>
      ) : !isNewPage && (
        <div className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">
          {availablePages.length === 0
            ? 'No subpages available. Create one!'
            : 'No matching pages'}
        </div>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      {/* Display linked page or input */}
      <div
        ref={refs.setReference}
        className={cn(
          'flex items-center gap-1 min-h-[32px] px-2 py-1 rounded cursor-text',
          isFocused
            ? 'ring-2 ring-[var(--color-accent-primary)] bg-[var(--color-surface-base)]'
            : 'hover:bg-[var(--color-surface-secondary)]'
        )}
        onClick={() => {
          if (!linkedPage) {
            inputRef.current?.focus();
          }
        }}
      >
        {linkedPage ? (
          <div className="flex items-center gap-1.5 group flex-1 min-w-0">
            <FileText className="w-4 h-4 text-[var(--color-text-tertiary)] flex-shrink-0" />
            <span
              className="text-sm text-[var(--color-text-primary)] truncate flex-1 hover:text-[var(--color-accent-primary)] cursor-pointer"
              onClick={navigateToPage}
            >
              {linkedPage.title || 'Untitled'}
            </span>
            <button
              type="button"
              onClick={navigateToPage}
              className="p-0.5 rounded hover:bg-[var(--color-surface-overlay)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              title="Open page"
            >
              <ExternalLink className="w-3 h-3 text-[var(--color-text-tertiary)]" />
            </button>
            <button
              type="button"
              onClick={clearPage}
              className="p-0.5 rounded hover:bg-[var(--color-surface-overlay)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              title="Remove link"
            >
              <X className="w-3 h-3 text-[var(--color-text-tertiary)]" />
            </button>
          </div>
        ) : (
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent text-sm outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
            placeholder={placeholder}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              // Delay blur to allow click events on dropdown
              setTimeout(() => {
                setIsFocused(false);
                setShowDropdown(false);
                setInputValue('');
              }, 150);
            }}
            onKeyDown={handleKeyDown}
          />
        )}
      </div>

      {/* Desktop dropdown */}
      {showDropdown && !isMobile && (
        <Popover
          ref={refs.setFloating}
          style={floatingStyles}
          width="auto"
          padding="none"
          className="z-[9999]"
        >
          <DropdownContent />
        </Popover>
      )}

      {/* Mobile sheet */}
      {isMobile && (
        <MobileSheet
          isOpen={showDropdown}
          onClose={() => {
            setShowDropdown(false);
            setInputValue('');
          }}
          title="Link Page"
        >
          <DropdownContent inputRefProp={mobileInputRef} />
        </MobileSheet>
      )}
    </div>
  );
};

export default PageCellPicker;
