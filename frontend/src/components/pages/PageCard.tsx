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
import { CheckSquare, File, FileImage, FileText, FolderIcon } from 'lucide-react';
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
import { getPageFileUrl, getPageImageUrl } from '@/api/pagesApi';

import { useIsTouch } from '@frameer/hooks/useMobileDetection';
import { useLongPress } from '@/hooks/useLongPress';


dayjs.extend(relativeTime);

const PAGE_MODE_BADGE_CONFIG: Record<Page['viewMode'], { label: string; icon: React.ReactNode; className: string }> = {
  note: {
    label: 'Note',
    icon: <FileText className="h-3 w-3" />,
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
  collection: {
    label: 'Collection',
    icon: <FolderIcon className="h-3 w-3" />,
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
  tasks: {
    label: 'Tasks',
    icon: <CheckSquare className="h-3 w-3" />,
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
};

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
  /** Called when another page is dropped on this card to reparent */
  onPageDrop?: (droppedPageId: string, targetPageId: string) => void;
}

const CARD_CONFIG = { previewHeight: '168px', lines: 3, blocks: 4 };

const richPreviewClampStyle: React.CSSProperties = {
  maskImage: 'linear-gradient(to bottom, black 72%, transparent 100%)',
  WebkitMaskImage: 'linear-gradient(to bottom, black 72%, transparent 100%)',
};

type PreviewMediaItem =
  | { key: string; kind: 'image'; label: string; src: string }
  | { key: string; kind: 'file'; label: string; filename: string };

function isImageFilename(filename: string): boolean {
  return /\.(avif|gif|jpe?g|png|webp|svg)$/i.test(filename);
}

function getImageLikeFileUrl(pageId: string, filename: string): string {
  return `${getPageFileUrl(pageId, filename)}?thumb=512x512`;
}

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

  // Drop target state for reparenting pages within the same view
  const [isDropTarget, setIsDropTarget] = useState(false);

  const handleCardDragOver = useCallback((e: React.DragEvent) => {
    if (!onPageDrop) return;
    const hasPageData = e.dataTransfer.types.includes('pageid');
    if (!hasPageData) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDropTarget(true);
  }, [onPageDrop]);

  const handleCardDragLeave = useCallback((e: React.DragEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    const currentTarget = e.currentTarget as HTMLElement;
    if (!currentTarget.contains(relatedTarget)) {
      setIsDropTarget(false);
    }
  }, []);

  const handleCardDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDropTarget(false);
    if (!onPageDrop) return;
    const droppedId = e.dataTransfer.getData('text/plain');
    if (!droppedId || droppedId === page.id) return;
    onPageDrop(droppedId, page.id);
  }, [onPageDrop, page.id]);
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
  const pdfFilename = useMemo(() => {
    if (!page.previewThumbnail) {
      return null;
    }
    return page.files?.find((file) => file.toLowerCase().endsWith('.pdf')) ?? page.files?.[0] ?? null;
  }, [page.files, page.previewThumbnail]);
  const pdfThumbnailUrl = page.previewThumbnail
    ? getPageFileUrl(page.id, page.previewThumbnail)
    : null;
  const isPdfBackedPage = Boolean(pdfFilename && pdfThumbnailUrl);
  const previewMediaItems = useMemo<PreviewMediaItem[]>(() => {
    const items: PreviewMediaItem[] = [];
    const seenKeys = new Set<string>();

    const pushItem = (item: PreviewMediaItem) => {
      if (seenKeys.has(item.key) || items.length >= 3) return;
      seenKeys.add(item.key);
      items.push(item);
    };

    for (const filename of page.images) {
      pushItem({
        key: `image:${filename}`,
        kind: 'image',
        label: 'Image',
        src: getPageImageUrl(page.id, filename, true),
      });
    }

    for (const filename of page.files ?? []) {
      if (isImageFilename(filename)) {
        pushItem({
          key: `file-image:${filename}`,
          kind: 'image',
          label: 'Attachment',
          src: getImageLikeFileUrl(page.id, filename),
        });
        continue;
      }

      pushItem({
        key: `file:${filename}`,
        kind: 'file',
        label: 'Attachment',
        filename,
      });
    }

    if (page.coverImage && items.length < 3) {
      const src = page.coverImage.startsWith('http')
        ? page.coverImage
        : getPageImageUrl(page.id, page.coverImage, true);
      pushItem({
        key: `cover:${page.coverImage}`,
        kind: 'image',
        label: 'Cover',
        src,
      });
    }

    return items;
  }, [page.coverImage, page.files, page.id, page.images]);
  const hasInlineMediaPreview = previewMediaItems.length > 0 && !isCollection && !isTasks && !isPdfBackedPage;

  const updatedRelative = useMemo(() => dayjs(page.updated).fromNow(), [page.updated]);
  const pageModeBadge = PAGE_MODE_BADGE_CONFIG[page.viewMode] ?? PAGE_MODE_BADGE_CONFIG.note;
  const previewMode = isCollection
    ? 'collection'
    : isTasks
      ? 'tasks'
      : isPdfBackedPage
        ? 'pdf'
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
      onDragOver={handleCardDragOver}
      onDragLeave={handleCardDragLeave}
      onDrop={handleCardDrop}
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
          isLongPressing && 'scale-[0.98] opacity-90',
          isDropTarget && 'ring-2 ring-green-500 border-green-400 dark:border-green-600 bg-green-50/50 dark:bg-green-900/20'
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
                isPdfBackedPage ? 'p-0' : 'p-4',
              )}
              style={{ minHeight: CARD_CONFIG.previewHeight }}
            >
              <div className="flex h-full flex-col">
                {previewMode === 'collection' ? (
                  <CardPreviewCollection pageId={page.id} />
                ) : previewMode === 'tasks' ? (
                  <CardPreviewTasks pageId={page.id} />
                ) : previewMode === 'pdf' ? (
                  <PdfFirstPagePreview
                    title={page.title || 'PDF page'}
                    thumbnailUrl={pdfThumbnailUrl}
                    pageCount={page.sourcePageCount}
                  />
                ) : hasInlineMediaPreview ? (
                  <div className="flex h-full flex-col gap-3">
                    <div className="h-[56px] overflow-hidden" style={richPreviewClampStyle}>
                      <PageCardRichPreview
                        content={page.content}
                        previewBlocks={page.previewStructured ?? null}
                        fallbackText={preview || 'Open this page to continue writing, organizing, or reviewing attached materials.'}
                        maxBlocks={3}
                      />
                    </div>
                    <div
                      className="grid min-h-0 flex-1 gap-2"
                      style={{ gridTemplateColumns: `repeat(${previewMediaItems.length}, minmax(0, 1fr))` }}
                    >
                      {previewMediaItems.map((item, index) => (
                        <div
                          key={item.key}
                          className="relative min-h-0 overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-base)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                        >
                          {item.kind === 'image' ? (
                            <>
                              <img
                                src={item.src}
                                alt={item.label}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-2 py-1.5">
                                <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/35 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-white backdrop-blur-sm">
                                  <FileImage className="h-3 w-3" />
                                  {item.label}
                                </span>
                              </div>
                              {index === 2 && previewMediaItems.length === 3 && (
                                <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-r from-transparent to-[color-mix(in_srgb,var(--color-surface-base)_96%,white)]" />
                              )}
                            </>
                          ) : (
                            <div className="flex h-full flex-col justify-between bg-[linear-gradient(160deg,color-mix(in_srgb,var(--color-surface-secondary)_92%,white)_0%,var(--color-surface-base)_100%)] p-2.5">
                              <div className="min-w-0">
                                <div className="truncate text-[10px] font-medium leading-4 text-[var(--color-text-secondary)]">
                                  {item.filename}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-base)]/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
                                  <File className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">{item.label}</span>
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
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
              <div className="flex items-start gap-2">
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
            <div className="mt-1.5 space-y-1.5">
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
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                  {parentPage && (
                    <>
                      <span className="text-[11px] font-medium text-[var(--color-text-tertiary)]">
                        in:
                      </span>
                      <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-secondary)] px-2 py-1 text-[11px] text-[var(--color-text-secondary)]">
                        <ItemIcon
                          type={parentPage.viewMode as any}
                          icon={parentPage.icon}
                          color={parentPage.color}
                          size="xs"
                        />
                        <span className="max-w-[12rem] truncate text-[var(--color-text-primary)]">
                          {parentPage.title}
                        </span>
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 text-xs text-[var(--color-text-secondary)]">
                  <span>edited {updatedRelative}</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-default)] bg-[var(--color-surface-base)] px-2 py-1 text-[11px] font-medium text-[var(--color-text-secondary)]">
                    <span className="text-[var(--color-text-tertiary)]">{pageModeBadge.icon}</span>
                    {pageModeBadge.label}
                  </span>
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
