/**
 * @file PageCard.tsx
 * @description Card component for displaying pages in grid view with multi-selection
 * @app PAGES - Used in collection/kanban views
 * 
 * A visual card representation of a page for grid layouts:
 * - Icon (emoji or colored default) with click-to-edit support
 * - Title with optional search term highlighting
 * - Content preview (extracted plain text from Yoopta JSON)
 * - Relative timestamp ('Updated 2 hours ago')
 * - Child count badge with subtle stack effect
 * - Context menu (properties, delete) with multi-selection support
 * - Cmd/Ctrl+Click and Shift+Click for multi-selection
 * 
 * Configurable card sizes: small, medium, large (affects height and preview lines).
 * Supports drag for moving to sidebar locations.
 * 
 * Used by:
 * - PageCollection (grid mode)
 */
import React, { useMemo, useCallback, useState } from 'react';
import type { Page } from '../../types/page';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Card, H3, ContextMenu, ContextMenuContent, Popover, TagBadge } from '../ui';
import ItemIcon from '../common/ItemIcon';
import { extractPagePreview, highlightText } from '../../lib/pageUtils';
import { usePageContextMenu } from '@/hooks/usePageContextMenu';
import { useSelectionStore } from '@/stores/selectionStore';
import { cn } from '@/lib/design-system';
import CardPreviewCollection from '@/components/pages/CardPreviewCollection';
import CardPreviewTasks from '@/components/pages/CardPreviewTasks';
import PageCardRichPreview from '@/components/pages/PageCardRichPreview';
import PdfFirstPagePreview from '@/components/common/PdfFirstPagePreview';
import { getPageFileUrl } from '@/api/pagesApi';

import { useIsTouch } from '@frameer/hooks/useMobileDetection';
import { useLongPress } from '@/hooks/useLongPress';


dayjs.extend(relativeTime);

interface PageCardProps {
  page: Page;
  onClick: (pageId: string) => void;
  /** Create a child page under this page */
  onCreateChild?: (parentId: string) => void;
  /** Create a task in this page (for task collections) */
  onCreateTask?: (parentPageId: string) => void;
  /** Search query for highlighting */
  searchQuery?: string;
  /** Whether card can be dragged (for sidebar operations) */
  draggable?: boolean;
  /** Parent page (for showing breadcrumb) */
  parentPage?: Page | null;
  /** Whether to enable multi-selection (default: true) */
  enableSelection?: boolean;
  /** Whether to show the preview area (default: true) */
  showExcerpt?: boolean;
}

const CARD_CONFIG = { previewHeight: '168px', lines: 3, blocks: 4 };
const PageCard: React.FC<PageCardProps> = React.memo(({ 
  page, 
  onClick, 
  onCreateChild,
  onCreateTask,
  searchQuery = '',
  draggable = false,
  parentPage = null,
  enableSelection = true,
  showExcerpt = true,
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
  
  // Touch detection for mobile context menu
  const isTouch = useIsTouch();
  
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
  const isCollection = page.viewMode === 'collection';
  const isTasks = page.viewMode === 'tasks';
  const tagList = useMemo(
    () => (page.tags ? page.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : []),
    [page.tags]
  );
  const visibleTags = useMemo(() => tagList.slice(0, 3), [tagList]);
  const hiddenTagCount = tagList.length - visibleTags.length;
  
  // Use excerpt if available (from metadata fetch), otherwise extract from content
  const preview = useMemo(() => {
    if (page.excerpt) return page.excerpt;
    if (page.content) return extractPagePreview(page.content, CARD_CONFIG.lines);
    return '';
  }, [page.content, page.excerpt]);
  const hasStructuredPreview = Boolean(page.previewStructured && page.previewStructured.length > 0);
  const booxPdfFilename = useMemo(() => {
    if (page.sourceOrigin !== 'boox' || page.sourceItemType !== 'notebook') {
      return null;
    }
    return page.files?.find((file) => file.toLowerCase().endsWith('.pdf')) ?? page.files?.[0] ?? null;
  }, [page.files, page.sourceItemType, page.sourceOrigin]);
  const booxPdfUrl = booxPdfFilename ? getPageFileUrl(page.id, booxPdfFilename) : null;
  const booxThumbUrl = (page.sourceOrigin === 'boox' && page.previewThumbnail)
    ? getPageFileUrl(page.id, page.previewThumbnail)
    : null;
  const isBooxNotebook = page.sourceOrigin === 'boox' && page.sourceItemType === 'notebook';

  const createdDate = useMemo(() => dayjs(page.created).format('MMM D, YYYY'), [page.created]);
  const updatedRelative = useMemo(() => dayjs(page.updated).fromNow(), [page.updated]);
  const previewMode = isCollection
    ? 'collection'
    : isTasks
      ? 'tasks'
      : isBooxNotebook
        ? 'boox'
        : (page.content || hasStructuredPreview || preview)
          ? 'note'
          : 'meta';
  const metaPreviewItems = useMemo(() => {
    const items: string[] = [];

    if (page.isDailyNote) {
      items.push('Journal anchor');
    }
    if (tagList.length > 0) {
      items.push(`${tagList.length} tag${tagList.length === 1 ? '' : 's'}`);
    }
    if (page.images.length > 0) {
      items.push(`${page.images.length} image${page.images.length === 1 ? '' : 's'}`);
    }
    if (childCount > 0 && !isCollection) {
      items.push(`${childCount} child page${childCount === 1 ? '' : 's'}`);
    }
    if (items.length === 0) {
      items.push(page.viewMode === 'tasks' ? 'No tasks yet' : 'No content yet');
    }

    return items.slice(0, 3);
  }, [childCount, isCollection, page.images.length, page.isDailyNote, page.viewMode, tagList.length]);
  
  // Determine icon type
  const iconType = page.isDailyNote ? 'daily' : isTasks ? 'tasks' : isCollection ? 'collection' : 'note';

  // Handle click - if modifier key is pressed, handle selection; otherwise navigate
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    // Prevent mouse events on touch devices to avoid double-triggering with useLongPress
    // BUT allow clicks if selection is disabled (e.g., in horizontal galleries)
    if (isTouch && enableSelection) return;

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



  // Stack effect needs extra padding to show stacked layers
  const stackPadding = isCollection && childCount > 0 ? (childCount >= 2 ? 'pb-2 pr-2' : 'pb-1 pr-1') : '';

  const cardContent = (
    <div 
      className={`relative ${stackPadding}`}
      draggable={draggable}
      onDragStart={handleDragStart}
      {...(isTouch ? longPressHandlers : {})}
    >
      {/* Mobile context menu portal */}
      {showMobileContextMenu && isTouch && menuItems.length > 0 && (
        <>
          {/* Backdrop to close menu */}
          <div 
            className="fixed inset-0 z-[200]" 
            onPointerDown={() => {
              // Ignore if menu just opened (prevents close on touch end after long press)
              if (menuJustOpenedRef.current) return;
              setShowMobileContextMenu(false);
            }}
          />
          {/* Context menu */}
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
      

      
      {/* Stack effect for collections with children - shows layered cards behind */}
      {isCollection && childCount > 0 && (
        <>
          {childCount >= 2 && (
            <div 
              className="absolute bg-[var(--color-surface-base)] border border-[var(--color-border-default)] rounded-xl shadow-sm"
              style={{ top: 8, left: 8, right: 0, bottom: 0 }}
            />
          )}
          <div 
            className="absolute bg-[var(--color-surface-base)] border border-[var(--color-border-default)] rounded-xl shadow-sm"
            style={{ top: 4, left: 4, right: childCount >= 2 ? 4 : 0, bottom: childCount >= 2 ? 4 : 0 }}
          />
        </>
      )}

      <Card
        className={cn(
          'group relative z-10 cursor-pointer overflow-hidden p-0 transition-all duration-200 hover:border-[var(--color-interactive-border)] card-hover',
          '',
          draggable && 'cursor-grab active:cursor-grabbing',
          enableSelection && isSelected && 'bg-[var(--color-interactive-bg)]/50 ring-1 ring-[var(--color-interactive-ring)]',
          isLongPressing && 'scale-[0.98] opacity-90'
        )}
      >
        {/* Clickable wrapper to capture mouse events */}
        <div className="flex h-full flex-col" onClick={handleCardClick}>
          {/* Selection Checkbox */}
          {enableSelection && (selectionMode || isSelected) && (
            <div className="absolute top-3 right-3 z-20 animate-in fade-in zoom-in-95 duration-200">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelect('page', page.id)}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 rounded border-[var(--color-border-default)] text-[var(--color-interactive-text-strong)] focus:ring-[var(--color-interactive-ring)] bg-[var(--color-surface-base)]"
              />
            </div>
          )}
          {enableSelection && !selectionMode && !isSelected && !isTouch && (
            <div className="absolute top-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <input
                type="checkbox"
                checked={false}
                onChange={() => toggleSelect('page', page.id)}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 rounded border-[var(--color-border-default)] text-[var(--color-interactive-text-strong)] focus:ring-[var(--color-interactive-ring)] bg-[var(--color-surface-base)]"
              />
            </div>
          )}

          {/* Summary body */}
          {showExcerpt && (
            <div 
              className={cn(
                'relative overflow-hidden bg-[color-mix(in_srgb,var(--color-surface-base)_58%,var(--color-surface-inset))]',
                'h-[168px]',
                isBooxNotebook ? 'p-0' : 'p-4',
              )}
              style={{ minHeight: CARD_CONFIG.previewHeight }}
            >
              <div className="flex h-full flex-col">
                {previewMode === 'collection' ? (
                  <CardPreviewCollection pageId={page.id} />
                ) : previewMode === 'tasks' ? (
                  <CardPreviewTasks pageId={page.id} />
                ) : previewMode === 'boox' ? (
                  <PdfFirstPagePreview
                    title={page.title || 'BOOX notebook'}
                    thumbnailUrl={booxThumbUrl}
                    pageCount={page.sourcePageCount}
                  />
                ) : previewMode === 'note' ? (
                  <PageCardRichPreview
                    content={page.content}
                    previewBlocks={page.previewStructured ?? null}
                    fallbackText={preview}
                    maxBlocks={CARD_CONFIG.blocks}
                  />
                ) : (
                  <div className="flex h-full flex-col justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      {metaPreviewItems.map((item) => (
                        <span
                          key={item}
                          className="inline-flex items-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-base)]/80 px-2 py-1 text-[11px] font-medium text-[var(--color-text-secondary)]"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Open this page to add structure, notes, or linked work.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Title and metadata */}
            <div className="flex min-h-0 flex-1 flex-col p-4">
              <div className="mb-2 flex items-start gap-2">
              <div className="mt-0.5 flex-shrink-0">
                <ItemIcon
                  type={iconType}
                  icon={page.icon}
                  color={page.color}
                  size="sm"
                />
              </div>
              <div className="flex-1 min-w-0 flex items-start gap-2">
                <H3 className="!text-base !md:text-base line-clamp-2">
                  {searchQuery ? highlightText(page.title, searchQuery) : page.title}
                </H3>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col justify-between gap-3">
              <div className="space-y-1.5">
                {/* Parent breadcrumb */}
                {parentPage && (
                  <div className="flex items-center gap-1.5">
                    <ItemIcon
                      type={parentPage.viewMode as any}
                      icon={parentPage.icon}
                      color={parentPage.color}
                      size="xs"
                    />
                    <span className="truncate text-xs text-[var(--color-text-secondary)]">
                      {parentPage.title}
                    </span>
                  </div>
                )}
                <div className="text-sm text-[var(--color-text-secondary)]">
                  {createdDate}
                </div>
              </div>

              <div className="space-y-1.5">
                {visibleTags.length > 0 && (
                  <div className="flex min-h-[28px] flex-wrap gap-1 overflow-hidden">
                    {visibleTags.map((tag) => (
                      <TagBadge key={tag} tag={tag} compact />
                    ))}
                    {hiddenTagCount > 0 && (
                      <span className="inline-flex items-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-secondary)] px-2 py-1 text-[11px] text-[var(--color-text-secondary)]">
                        +{hiddenTagCount}
                      </span>
                    )}
                  </div>
                )}
                <div className="text-xs text-[var(--color-text-secondary)]">
                  edited {updatedRelative}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );

  // Desktop: wrap with context menu, Mobile: uses long press (handled inline above)
  return menuItems.length > 0 && !isTouch ? (
    <ContextMenu items={menuItems}>
      {cardContent}
    </ContextMenu>
  ) : (
    cardContent
  );
});

PageCard.displayName = 'PageCard';

export default PageCard;
