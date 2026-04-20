/**
 * @file PageRow.tsx
 * @description Flat list row component for displaying pages in list view
 * @app PAGES - Used in list view collections
 * 
 * A compact horizontal row for list layouts (inspired by Informeer's EntryCard):
 * - Flat appearance with divider-based separation (no card/panel wrapper)
 * - Two-line layout: title on line 1, type pill + breadcrumb + timestamp on line 2
 * - Subtle hover state with left accent bar on selection
 * - Context menu with multi-selection support
 * - Cmd/Ctrl+Click and Shift+Click for multi-selection
 * 
 * Used by:
 * - PageCollection (list mode)
 */
import React, { useMemo, useCallback, useState } from 'react';
import type { Page } from '../../types/page';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Text, ContextMenu, ContextMenuContent, Popover, TagBadge } from '../ui';
import { ChevronRightIcon } from '../common/Icons';
import ItemIcon from '../common/ItemIcon';
import { highlightText } from '../../lib/pageUtils';
import { usePageContextMenu } from '@/hooks/usePageContextMenu';
import { useSelectionStore } from '@/stores/selectionStore';
import { cn } from '@/lib/design-system';
import { useIsTouch, useIsMobile } from '@frameer/hooks/useMobileDetection';
import { useLongPress } from '@/hooks/useLongPress';

dayjs.extend(relativeTime);

interface PageRowProps {
  page: Page;
  onClick: (pageId: string) => void;
  /** Create a child page under this page */
  onCreateChild?: (parentId: string) => void;
  /** Create a task in this page (for task collections) */
  onCreateTask?: (parentPageId: string) => void;
  /** Search query for highlighting */
  searchQuery?: string;
  /** Whether row can be dragged (for sidebar operations) */
  draggable?: boolean;
  /** Parent page (for showing breadcrumb) */
  parentPage?: Page | null;
  /** Whether to enable multi-selection (default: true) */
  enableSelection?: boolean;
  /** Additional className */
  className?: string;
  /** Called when another page is dropped on this row to reparent */
  onPageDrop?: (droppedPageId: string, targetPageId: string) => void;
}

const PageRow: React.FC<PageRowProps> = React.memo(({ 
  page, 
  onClick, 
  onCreateChild,
  onCreateTask,
  searchQuery = '',
  draggable = false,
  parentPage = null,
  enableSelection = true,
  className,
  onPageDrop,
}) => {
  // Use childCount from page object (maintained by backend)
  const childCount = page.childCount || 0;
  
  // Multi-selection and context menu
  const { menuItems, handleClick: handleSelectionClick, isSelected } = usePageContextMenu({
    page,
    onCreateChild,
    onCreateTask,
    childCount,
  });
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  const selectionMode = useSelectionStore((s) => s.selectionMode);
  const toggleSelect = useSelectionStore((s) => s.toggleSelect);
  
  // Touch/mobile detection
  const isTouch = useIsTouch();
  const isMobile = useIsMobile();
  
  // Long press context menu state for mobile
  const [showMobileContextMenu, setShowMobileContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  // Track when menu just opened to prevent immediate close on touch end
  const menuJustOpenedRef = React.useRef(false);
  
  // Long press handler for mobile context menu
  const { longPressHandlers, isLongPressing } = useLongPress({
    onLongPress: (e) => {
      // Toggle selection on long press for mobile
      toggleSelect('page', page.id);
      
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    },
    onClick: () => {
      // If in selection mode, toggle selection on click
      if (selectionMode) {
        toggleSelect('page', page.id);
        return;
      }
      
      onClick(page.id);
    },
    enabled: isTouch && enableSelection,
    duration: 500,
  });

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', page.id);
    e.dataTransfer.setData('pageId', page.id);
  };

  // Drop target state for reparenting pages within the same view
  const [isDropTarget, setIsDropTarget] = useState(false);

  const handleRowDragOver = useCallback((e: React.DragEvent) => {
    if (!onPageDrop) return;
    const hasPageData = e.dataTransfer.types.includes('pageid');
    if (!hasPageData) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDropTarget(true);
  }, [onPageDrop]);

  const handleRowDragLeave = useCallback((e: React.DragEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    const currentTarget = e.currentTarget as HTMLElement;
    if (!currentTarget.contains(relatedTarget)) {
      setIsDropTarget(false);
    }
  }, []);

  const handleRowDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDropTarget(false);
    if (!onPageDrop) return;
    const droppedId = e.dataTransfer.getData('text/plain');
    if (!droppedId || droppedId === page.id) return;
    onPageDrop(droppedId, page.id);
  }, [onPageDrop, page.id]);

  const updatedRelative = useMemo(() => dayjs(page.updated).fromNow(), [page.updated]);

  // Handle click - if modifier key is pressed, handle selection; otherwise navigate
  const handleRowClick = useCallback((e: React.MouseEvent) => {
    // Prevent mouse events on touch devices to avoid double-triggering with useLongPress
    if (isTouch) return;

    if (enableSelection && (selectionMode || e.metaKey || e.ctrlKey || e.shiftKey)) {
      e.preventDefault();
      e.stopPropagation();
      
      if (selectionMode) {
        toggleSelect('page', page.id);
      } else {
        handleSelectionClick(e);
      }
    } else {
      // Clear selection and navigate
      if (enableSelection) {
        clearSelection('page');
      }
      onClick(page.id);
    }
  }, [isTouch, enableSelection, selectionMode, toggleSelect, handleSelectionClick, clearSelection, onClick, page.id]);
  
  // Handle mobile context menu item click
  const handleMobileMenuItemClick = useCallback((item: typeof menuItems[0]) => {
    setShowMobileContextMenu(false);
    item.onClick();
  }, []);

  const isCollection = page.viewMode === 'collection';
  const isTasks = page.viewMode === 'tasks';
  
  // ViewMode pill label
  const viewModeLabel = useMemo(() => {
    switch (page.viewMode) {
      case 'note': return page.isDailyNote ? 'Daily Note' : 'Note';
      case 'collection': return childCount > 0 ? `Collection (${childCount})` : 'Collection';
      case 'tasks': return 'Tasks';
      default: return page.isDailyNote ? 'Daily Note' : 'Note';
    }
  }, [page.viewMode, childCount, page.isDailyNote]);
  
  // Determine icon type
  const iconType = page.isDailyNote ? 'daily' : isTasks ? 'tasks' : isCollection ? 'collection' : 'note';

  const rowContent = (
    <article
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragOver={handleRowDragOver}
      onDragLeave={handleRowDragLeave}
      onDrop={handleRowDrop}
      {...(isTouch ? longPressHandlers : {})}
      className={cn(
        'group relative cursor-pointer',
        'transition-all duration-200',
        isMobile ? 'px-4 py-3.5' : 'px-4 py-2.5',
        enableSelection && isSelected
          ? 'bg-[var(--color-interactive-bg)]/50'
          : 'hover:bg-[var(--color-surface-hover)]',
        draggable && 'cursor-grab active:cursor-grabbing',
        isLongPressing && 'scale-[0.98] opacity-90',
        isDropTarget && 'ring-2 ring-green-500 bg-green-50/50 dark:bg-green-900/20 rounded-lg',
        className
      )}
      onClick={handleRowClick}
    >
      {/* Mobile context menu portal */}
      {showMobileContextMenu && isTouch && menuItems.length > 0 && (
        <>
          <div 
            className="fixed inset-0 z-[200]" 
            onPointerDown={() => {
              if (menuJustOpenedRef.current) return;
              setShowMobileContextMenu(false);
            }}
          />
          <Popover
            style={{
              position: 'fixed',
              left: `${Math.min(contextMenuPosition.x, window.innerWidth - 220)}px`,
              top: `${Math.min(contextMenuPosition.y, window.innerHeight - (menuItems.length * 44 + 16))}px`,
            }}
            width="auto"
            padding="sm"
            className="min-w-[200px] animate-fade-in"
          >
            <ContextMenuContent
              items={menuItems}
              onItemClick={(item) => handleMobileMenuItemClick(item)}
            />
          </Popover>
        </>
      )}

      {/* Left accent bar when selected */}
      {enableSelection && isSelected && (
        <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-[var(--color-accent-fg)]" />
      )}

      {/* Floating selection checkbox - top right */}
      {enableSelection && (selectionMode || isSelected || !isTouch) && (
        <div className={cn(
          "absolute top-2 right-2 z-10 transition-opacity duration-200 flex items-center justify-center",
          !selectionMode && !isSelected && !isTouch ? "opacity-0 group-hover:opacity-100" : "opacity-100"
        )}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelect('page', page.id)}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-[var(--color-border-default)] text-[var(--color-interactive-text-strong)] focus:ring-[var(--color-interactive-ring)] bg-[var(--color-surface-base)]"
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 flex items-center justify-center self-start mt-0.5">
          <ItemIcon
            type={iconType}
            icon={page.icon}
            color={page.color}
            size="sm"
          />
        </div>
        
        {/* Two-line content */}
        <div className="flex-1 min-w-0">
          {/* Line 1: Title */}
          <Text className="truncate leading-snug text-[var(--color-text-primary)]">
            {searchQuery ? highlightText(page.title, searchQuery) : page.title}
          </Text>
          
          {/* Line 2: Type pill + parent breadcrumb + timestamp */}
          <div className="flex items-center gap-2 mt-0.5">
            {/* ViewMode pill */}
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)] border border-[var(--color-border-subtle)] flex-shrink-0">
              {viewModeLabel}
            </span>

            {/* Parent breadcrumb */}
            {parentPage && (
              <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-tertiary)] flex-shrink-0">
                <ChevronRightIcon className="w-3 h-3" />
                <ItemIcon
                  type={parentPage.viewMode as any}
                  icon={parentPage.icon}
                  color={parentPage.color}
                  size="xs"
                />
                <span className="truncate max-w-[120px]">{parentPage.title}</span>
              </span>
            )}

            {/* Timestamp */}
            <span className="text-xs text-[var(--color-text-tertiary)] whitespace-nowrap ml-auto">{updatedRelative}</span>
          </div>
          {/* Tags (shown if page has any) */}
          {page.tags && (
            <div className="flex flex-wrap gap-1 mt-1">
              {page.tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                <TagBadge key={tag} tag={tag} compact />
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );

  // Desktop: wrap with context menu, Mobile: uses long press (handled inline above)
  if (enableSelection && menuItems.length > 0 && !isTouch) {
    return <ContextMenu items={menuItems}>{rowContent}</ContextMenu>;
  }

  return rowContent;
});

PageRow.displayName = 'PageRow';

export default PageRow;