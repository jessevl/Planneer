/**
 * @file PageHero.tsx
 * @description Capacities-inspired hero section with cover image, type badges, and properties
 * @app PAGES - Used by PageEditor, PageDetailView, TasksView
 * 
 * Features:
 * - Full-width cover with gradient fade
 * - Auto-contrast detection for text color on covers
 * - Type badges and tag pills below cover
 * - Structured metadata properties section
 * - Compact/expanded toggle for minimal view
 * - Cover picker modal with gradients, Unsplash search, upload
 * 
 * Used by:
 * - PageEditor
 * - PageDetailView
 * - TasksView
 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/design-system';
import { ImageIcon, X, Loader2, FileText, CheckSquare, Calendar, Clock, Folder, ChevronDown, ChevronUp, Tag as TagIcon, Link2, ListChecks } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useBacklinks } from '@/hooks/useBacklinks';
import { useUIStore } from '@/stores/uiStore';
import { getPageImageUrl } from '@/api/pagesApi';
import { usePagesStore } from '@/stores/pagesStore';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import PageActionBar from './PageActionBar';
import ItemIcon from '../common/ItemIcon';
import IconColorPicker from '../common/IconColorPicker';
import CoverPickerModal, { COVER_GRADIENTS } from '../common/CoverPickerModal';
import { usePageCoverActions } from '@/hooks/usePageCoverActions';
import { useSettingsStore } from '@/stores/settingsStore';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import { TagBadge, InlineTagInput, FLOATING_PANEL_SURFACE_CLASSNAME, MobileSheet } from '@/components/ui';

dayjs.extend(relativeTime);

// Re-export for legacy consumers (ui/index.ts).
export { COVER_GRADIENTS };

// Create a gradient lookup map for O(1) access
const GRADIENT_MAP = new Map(COVER_GRADIENTS.map(g => [g.value, g]));

// ============================================================================
// HOOK: Analyze image brightness for contrast detection
// ============================================================================

function useImageBrightness(imageUrl: string | null): 'light' | 'dark' | 'loading' {
  const [brightness, setBrightness] = useState<'light' | 'dark' | 'loading'>('loading');

  useEffect(() => {
    if (!imageUrl) {
      setBrightness('dark'); // No image = dark text
      return;
    }

    // Skip analysis for gradients
    if (imageUrl.startsWith('linear-gradient') || imageUrl.startsWith('radial-gradient')) {
      setBrightness('loading');
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        // Sample a small portion for performance (center-top area where title appears)
        const sampleWidth = Math.min(100, img.width);
        const sampleHeight = Math.min(50, img.height);
        canvas.width = sampleWidth;
        canvas.height = sampleHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setBrightness('light'); // Default to light text on error
          return;
        }
        
        // Draw the center-bottom portion of the image (where title overlays)
        const srcY = Math.max(0, img.height * 0.5); // Bottom half
        ctx.drawImage(
          img, 
          (img.width - sampleWidth * (img.width / sampleWidth)) / 2, srcY,
          img.width, img.height * 0.5,
          0, 0, 
          sampleWidth, sampleHeight
        );
        
        const imageData = ctx.getImageData(0, 0, sampleWidth, sampleHeight);
        const data = imageData.data;
        
        let totalBrightness = 0;
        const pixelCount = data.length / 4;
        
        for (let i = 0; i < data.length; i += 4) {
          // Calculate perceived brightness (human eye is more sensitive to green)
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          totalBrightness += (0.299 * r + 0.587 * g + 0.114 * b);
        }
        
        const avgBrightness = totalBrightness / pixelCount;
        // Threshold: below 128 is dark (use light text), above is light (use dark text)
        setBrightness(avgBrightness < 128 ? 'light' : 'dark');
      } catch {
        // CORS or other error - default to light text
        setBrightness('light');
      }
    };
    
    img.onerror = () => {
      setBrightness('light'); // Default to light text on error
    };
    
    img.src = imageUrl;
  }, [imageUrl]);

  return brightness;
}

// ============================================================================
// PAGE HERO COMPONENT
// ============================================================================

interface PageHeroProps {
  pageId: string | null;
  title: string;
  isEditingTitle?: boolean;
  onTitleChange?: (title: string) => void;
  onTitleEditStart?: () => void;
  onTitleEditEnd?: () => void;
  onTitleKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  // Cover
  coverImage?: string | null;
  coverGradient?: string | null;
  coverAttribution?: string | null;
  editableCover?: boolean;
  onCoverChange?: (cover: string | null) => void;
  // Metadata
  created?: string;
  updated?: string;
  docSize?: string;
  hasChanges?: boolean;
  onDelete?: () => void;
  hideActions?: boolean;
  // Icon
  icon?: string | null;
  color?: string | null;
  onIconChange?: (icon: string | null, color: string | null) => void;
  viewMode?: string;
  isDailyNote?: boolean;
  // Description (for tasks/collection pages)
  description?: string | null;
  onDescriptionClick?: () => void;
  // Tags
  tags?: string | null;
  onTagsChange?: (tags: string) => void;
  tagSuggestions?: string[];
  // Other
  onMarkHasChanges?: () => void;
  // Split view mode - compact layout for narrow right panel
  inSplitView?: boolean;
  /** Optional right inset for hero content wrappers; cover background remains full bleed. */
  contentRightInsetPx?: number;
  // Hide title for certain contexts (e.g., tasks view)
  hideTitle?: boolean;
  // Compact mode - minimal hero with just icon + title
  compact?: boolean;
  onToggleCompact?: (compact: boolean) => void;
}

export const PageHero: React.FC<PageHeroProps> = ({
  pageId,
  title,
  isEditingTitle,
  onTitleChange,
  onTitleEditStart,
  onTitleEditEnd,
  onTitleKeyDown,
  coverImage,
  coverGradient,
  coverAttribution,
  editableCover = false,
  onCoverChange,
  created,
  updated,
  docSize,
  hasChanges = false,
  onDelete,
  hideActions = false,
  icon,
  color,
  onIconChange,
  viewMode,
  isDailyNote,
  description,
  onDescriptionClick,
  tags,
  onTagsChange,
  tagSuggestions = [],
  onMarkHasChanges,
  inSplitView = false,
  contentRightInsetPx = 0,
  compact = false,
  onToggleCompact,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [showIconPopup, setShowIconPopup] = useState(false);
  const [iconPopupPos, setIconPopupPos] = useState<{ top: number; left: number } | null>(null);
  const iconAnchorRef = useRef<HTMLDivElement>(null);
  const iconPopupRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const coverActions = usePageCoverActions(pageId);
  const isUploading = coverActions.isUploading;

  // Prioritize gradient over image
  const cover = coverGradient || coverImage;
  const isGradient = !!coverGradient && (coverGradient.startsWith('linear') || coverGradient.startsWith('radial'));
  const isExternalImage = !!coverGradient && coverGradient.startsWith('http');
  const hasCover = !!cover;
  const isNoteLikeView = !viewMode || viewMode === 'note' || isDailyNote;
  const parsedTags = useMemo(
    () => tags?.split(',').map((tag) => tag.trim()).filter(Boolean) ?? [],
    [tags],
  );
  const tagColorUniverse = useMemo(
    () => Array.from(new Set([...tagSuggestions, ...parsedTags])).sort(),
    [parsedTags, tagSuggestions],
  );
  const needsCoverOverlayClearance = hasCover && Boolean(coverAttribution || editableCover);
  const expandedContentOffsetClass = hasCover
    ? needsCoverOverlayClearance
      ? 'pt-[calc(10rem+env(safe-area-inset-top))] md:pt-[calc(12.5rem+env(safe-area-inset-top))] pb-4'
      : 'pt-[calc(8.5rem+0.5rem)] md:pt-[calc(10rem+0.5rem)] pb-4'
    : 'pt-[calc(var(--header-height)+1.5rem)] pb-4';
  
  // Build the image URL for brightness analysis
  const imageUrl = useMemo(() => {
    if (!cover) return null;
    if (isExternalImage) return coverGradient;
    if (isGradient) return null;
    
    // If it's an external URL in coverImage (legacy/fallback), use it directly
    if (cover.startsWith('http')) return cover;
    return pageId ? getPageImageUrl(pageId, cover) : null;
  }, [cover, isGradient, isExternalImage, coverGradient, pageId]);

  // Analyze image brightness for contrast detection
  const imageBrightness = useImageBrightness(imageUrl);
  const theme = useSettingsStore(s => s.theme);
  
  // Text color: in dark mode with cover, always white; otherwise use image analysis
  const isLightText = useMemo(() => {
    if (!hasCover) return false;
    
    // Determine if we're in dark mode
    const isDarkMode = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDarkMode) return true;
    
    if (isGradient) {
      // Use map lookup instead of array find for O(1) performance
      const gradient = GRADIENT_MAP.get(cover!);
      return gradient?.isDark ?? true;
    }
    
    // For images (including external ones), use brightness analysis (default to light text while loading)
    return imageBrightness === 'loading' ? true : imageBrightness === 'light';
  }, [hasCover, isGradient, cover, imageBrightness, theme]);

  const contentInsetStyle: React.CSSProperties = {
    paddingLeft: 'var(--layout-left-inset, 0px)',
    paddingRight: contentRightInsetPx > 0 ? `${contentRightInsetPx}px` : 'var(--layout-right-inset, 0px)',
  };

  // Build the cover style
  const coverStyle = useMemo(() => {
    if (!cover) return null;
    
    if (isGradient) {
      return { background: cover };
    }
    
    // It's an image (file or external URL)
    return { 
      backgroundImage: `url(${imageUrl})`, 
      backgroundSize: 'cover', 
      backgroundPosition: 'center center'  // Center vertically
    };
  }, [cover, isGradient, imageUrl]);

  // Metadata items for display
  const metadataItems = useMemo(() => {
    const items: { icon: React.ReactNode; label: string; key: string }[] = [];
    if (updated) {
      items.push({ 
        icon: <Clock size={12} className="flex-shrink-0" />, 
        label: dayjs(updated).fromNow(),
        key: 'updated'
      });
    }
    if (created) {
      items.push({ 
        icon: <Calendar size={12} className="flex-shrink-0" />, 
        label: dayjs(created).format('MMM D, YYYY'),
        key: 'created'
      });
    }
    return items;
  }, [updated, created]);
  
  // ViewMode icon and label
  const viewModeInfo = useMemo(() => {
    switch (viewMode) {
      case 'note': return { icon: <FileText size={12} />, label: isDailyNote ? 'Daily Note' : 'Note' };
      case 'collection': return { icon: <Folder size={12} />, label: 'Collection' };
      case 'tasks': return { icon: <CheckSquare size={12} />, label: 'Tasks' };
      default: return { icon: <FileText size={12} />, label: isDailyNote ? 'Daily Note' : 'Note' };
    }
  }, [viewMode, isDailyNote]);

  // Cover handlers — shared with the meta sidepanel via usePageCoverActions.
  const handleRemoveCover = useCallback(async () => {
    await coverActions.removeCover();
    setShowPicker(false);
  }, [coverActions]);

  const handleSelectGradient = useCallback(async (gradientValue: string) => {
    await coverActions.selectGradient(gradientValue);
    setShowPicker(false);
  }, [coverActions]);

  const handleUploadImage = useCallback(async (file: File | Blob, filename?: string) => {
    await coverActions.uploadImage(file, filename);
    const next = usePagesStore.getState().pagesById[pageId ?? '']?.coverImage ?? null;
    onCoverChange?.(next);
    setShowPicker(false);
  }, [coverActions, onCoverChange, pageId]);

  const handleSelectUnsplashImage = useCallback(async (imageUrl: string, attribution: string, downloadLocation?: string) => {
    await coverActions.selectUnsplashImage(imageUrl, attribution, downloadLocation);
    setShowPicker(false);
  }, [coverActions]);

  useEffect(() => {
    if (!showIconPopup || isMobile) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        (!iconAnchorRef.current || !iconAnchorRef.current.contains(target)) &&
        (!iconPopupRef.current || !iconPopupRef.current.contains(target))
      ) {
        setShowIconPopup(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showIconPopup, isMobile]);

  const iconPickerContent = onIconChange ? (
    <IconColorPicker
      icon={icon ?? null}
      color={color ?? null}
      onChange={onIconChange}
      onIconSelected={() => setShowIconPopup(false)}
    />
  ) : null;

  const openIconPopup = useCallback(() => {
    if (iconAnchorRef.current) {
      const rect = iconAnchorRef.current.getBoundingClientRect();
      setIconPopupPos({ top: rect.bottom + 8, left: rect.left });
    }
    setShowIconPopup(true);
  }, []);

  const iconPopupPortal = onIconChange && showIconPopup && !isMobile && iconPopupPos
    ? createPortal(
        <div
          ref={iconPopupRef}
          style={{ position: 'fixed', top: iconPopupPos.top, left: iconPopupPos.left, zIndex: 9999 }}
          className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-primary)] shadow-lg overflow-hidden"
        >
          {iconPickerContent}
        </div>,
        document.body
      )
    : null;

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* ================================================================
          COMPACT MODE - minimal inline hero with just icon + title
          ================================================================ */}
      {compact ? (
        <div
          className={cn(
            'relative z-10',
            'pt-[calc(var(--header-height)+0.35rem)] pb-2'
          )}
          style={contentInsetStyle}
        >
            <div className="max-w-5xl mx-auto px-4 md:px-6">
              {/* Action bar */}
              {!hideActions && pageId && (
                <div className="mb-2">
                  <PageActionBar
                    pageId={pageId}
                    hasChanges={hasChanges}
                    updated={updated}
                    onDelete={onDelete}
                  />
                </div>
              )}

            <div className={cn(
              'flex items-center gap-3 min-w-0',
              'pb-3 border-b border-[var(--color-border-default)]/35',
              isNoteLikeView ? 'md:px-6' : 'md:px-0'
            )}>
              {/* Icon */}
              <div ref={iconAnchorRef} className="flex-shrink-0">
                <ItemIcon
                  type={viewMode === 'tasks' ? 'tasks' : viewMode === 'collection' ? 'collection' : 'note'}
                  {...(icon ? { icon } : {})}
                  color={color}
                  size="md"
                  {...(onIconChange ? { onClick: openIconPopup } : {})}
                  className="p-0.5"
                />
              </div>
              {onIconChange && isMobile && (
                <MobileSheet isOpen={showIconPopup} onClose={() => { setShowIconPopup(false); }} title="Icon & Color">
                  {iconPickerContent}
                </MobileSheet>
              )}

              {/* Title */}
              <div className="flex-1 min-w-0">
                {isEditingTitle ? (
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => {
                      onTitleChange?.(e.target.value);
                      onMarkHasChanges?.();
                    }}
                    onKeyDown={onTitleKeyDown}
                    onBlur={onTitleEditEnd}
                    onFocus={(e) => {
                      if (!title || title === 'Untitled Page' || title === 'Untitled') {
                        e.target.select();
                      }
                    }}
                    autoFocus
                    placeholder="Untitled"
                    className="w-full text-lg font-semibold bg-transparent border-none outline-none tracking-tight text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
                  />
                ) : (
                  <h2
                    onClick={onTitleEditStart}
                    className="cursor-text text-lg font-semibold tracking-tight text-[var(--color-text-primary)] hover:text-[var(--color-text-secondary)] transition-colors truncate"
                  >
                    {title || 'Untitled'}
                  </h2>
                )}
              </div>

              {/* Compact metadata */}
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)] flex-shrink-0">
                {viewModeInfo && (
                  <span className="flex items-center gap-1">
                    {viewModeInfo.icon}
                    <span className="hidden sm:inline">{viewModeInfo.label}</span>
                  </span>
                )}
                {updated && (
                  <span className="hidden md:inline">{dayjs(updated).fromNow()}</span>
                )}
              </div>

              {onToggleCompact && (
                <button
                  onClick={() => onToggleCompact(false)}
                  className="p-1 rounded text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] transition-colors flex-shrink-0"
                  title="Expand hero"
                >
                  <ChevronDown size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ================================================================
           EXPANDED MODE - full Capacities-inspired hero
           ================================================================ */
        <>
          {/* Cover background */}
          {hasCover && (
            <div className="absolute inset-x-0 top-0 z-0 overflow-hidden h-[calc(200px+env(safe-area-inset-top))] md:h-[calc(300px+env(safe-area-inset-top))]">
              <div 
                className="w-full h-full"
                style={coverStyle || undefined}
              />
              {/* Gradient fade to page background */}
              <div className="absolute inset-x-0 bottom-0 h-48 md:h-64 bg-gradient-to-t from-[var(--color-surface-base)] to-transparent" />
            </div>
          )}

          {/* Unsplash attribution */}
          {hasCover && coverAttribution && (() => {
            try {
              const attr = JSON.parse(coverAttribution);
              const linkClasses = cn(
                'text-xs opacity-80 hover:opacity-100 transition-opacity underline decoration-1 underline-offset-2',
                isLightText ? 'text-white' : 'text-black'
              );
              const dropShadow = {
                filter: isLightText 
                  ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.9)) drop-shadow(0 4px 16px rgba(0,0,0,0.7))'
                  : 'drop-shadow(0 2px 8px rgba(255,255,255,0.9)) drop-shadow(0 4px 16px rgba(255,255,255,0.7))'
              };
              const photographerLink = attr.link && !attr.link.includes('utm_source=')
                ? (attr.link.includes('?') ? `${attr.link}&utm_source=planneer&utm_medium=referral` : `${attr.link}?utm_source=planneer&utm_medium=referral`)
                : attr.link;
              const unsplashLink = 'https://unsplash.com/?utm_source=planneer&utm_medium=referral';
              return (
                <div className="absolute top-[calc(var(--header-height)+env(safe-area-inset-top)+0.25rem)] md:top-20 left-0 right-0 z-[5] pointer-events-none" style={contentInsetStyle}>
                  <div className="max-w-5xl mx-auto px-4 md:px-6">
                    <span className={cn('text-xs', isLightText ? 'text-white' : 'text-black')} style={dropShadow}>
                      Photo by{' '}
                      <a href={photographerLink} target="_blank" rel="noopener noreferrer" className={cn(linkClasses, 'pointer-events-auto')} style={dropShadow}>
                        {attr.name}
                      </a>
                      {' '}on{' '}
                      <a href={unsplashLink} target="_blank" rel="noopener noreferrer" className={cn(linkClasses, 'pointer-events-auto')} style={dropShadow}>
                        Unsplash
                      </a>
                    </span>
                  </div>
                </div>
              );
            } catch {
              return (
                <div className="absolute top-[calc(var(--header-height)+env(safe-area-inset-top)+0.25rem)] md:top-20 left-0 right-0 z-[5] pointer-events-none" style={contentInsetStyle}>
                  <div className="max-w-5xl mx-auto px-4 md:px-6">
                    <span className={cn('text-xs opacity-80', isLightText ? 'text-white' : 'text-black')} style={{
                      filter: isLightText 
                        ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.9)) drop-shadow(0 4px 16px rgba(0,0,0,0.7))'
                        : 'drop-shadow(0 2px 8px rgba(255,255,255,0.9)) drop-shadow(0 4px 16px rgba(255,255,255,0.7))'
                    }}>
                      {coverAttribution}
                    </span>
                  </div>
                </div>
              );
            }
          })()}

          {/* Content area */}
          <div className={cn('relative z-10', expandedContentOffsetClass)} style={contentInsetStyle}>
            <div className="max-w-5xl mx-auto px-4 md:px-6">
              {/* Action bar */}
              {!hideActions && pageId && (
                <div className="mb-3">
                  <PageActionBar
                    pageId={pageId}
                    hasChanges={hasChanges}
                    updated={updated}
                    onDelete={onDelete}
                  />
                </div>
              )}

              {/* Hero card */}
              <div
                className={cn(
                  'transition-all',
                  hasCover
                    ? cn(FLOATING_PANEL_SURFACE_CLASSNAME, 'p-5')
                    : cn(
                        'pb-4',
                        isNoteLikeView ? 'md:px-6' : 'md:px-0'
                      )
                )}
                style={hasCover ? { backgroundImage: 'none' } : undefined}
              >
                {/* Type badges row */}
                {pageId && (
                  <div className="flex items-center gap-2 mb-3 overflow-x-auto scrollbar-hide">
                    {/* View mode badge */}
                    {viewModeInfo && (
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full flex-shrink-0',
                        'bg-[var(--color-accent-muted)] text-[var(--color-accent-primary)]'
                      )}>
                        {viewModeInfo.icon}
                        {viewModeInfo.label}
                      </span>
                    )}

                    {onToggleCompact && (
                      <button
                        onClick={() => onToggleCompact(true)}
                        className="ml-auto p-1 rounded text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] transition-colors flex-shrink-0"
                        title="Compact hero"
                      >
                        <ChevronUp size={14} />
                      </button>
                    )}
                  </div>
                )}

                {/* Title row with icon */}
                <div className="flex items-center gap-3 min-w-0">
                  {/* Icon */}
                  <div ref={iconAnchorRef} className="flex-shrink-0">
                    <ItemIcon
                      type={viewMode === 'tasks' ? 'tasks' : viewMode === 'collection' ? 'collection' : 'note'}
                      {...(icon ? { icon } : {})}
                      color={color}
                      size="xl"
                      {...(onIconChange ? { onClick: openIconPopup } : {})}
                    />
                  </div>
                  {onIconChange && isMobile && (
                    <MobileSheet isOpen={showIconPopup} onClose={() => { setShowIconPopup(false); }} title="Icon & Color">
                      {iconPickerContent}
                    </MobileSheet>
                  )}

                  {/* Title + metadata */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {isEditingTitle ? (
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => {
                            onTitleChange?.(e.target.value);
                            onMarkHasChanges?.();
                          }}
                          onKeyDown={onTitleKeyDown}
                          onBlur={onTitleEditEnd}
                          onFocus={(e) => {
                            if (!title || title === 'Untitled Page' || title === 'Untitled') {
                              e.target.select();
                            }
                          }}
                          autoFocus
                          placeholder="Untitled"
                          className="w-full text-3xl font-bold bg-transparent border-none outline-none tracking-tight text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
                        />
                      ) : (
                        <h1
                          onClick={onTitleEditStart}
                          className="group cursor-text transition-colors text-3xl font-bold tracking-tight flex items-center gap-2 text-[var(--color-text-primary)] hover:text-[var(--color-text-secondary)] min-w-0"
                        >
                          <span className="truncate">{title || 'Untitled'}</span>
                          <svg 
                            className="w-5 h-5 opacity-0 group-hover:opacity-40 transition-opacity flex-shrink-0"
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </h1>
                      )}

                      {/* Add cover button */}
                      {editableCover && !hasCover && !isEditingTitle && (
                        <button
                          onClick={() => setShowPicker(true)}
                          className={cn(
                            'flex items-center gap-1 px-2 py-1 text-xs rounded transition-all flex-shrink-0',
                            isHovering 
                              ? 'opacity-100 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-overlay)]' 
                              : 'opacity-0'
                          )}
                        >
                          <ImageIcon size={12} />
                          <span>Add cover</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Properties section - structured metadata rows */}
                {pageId && (
                  <div className={cn(
                    'mt-2 pt-2',
                    hasCover ? 'border-t border-white/20 dark:border-[var(--color-border-default)]/20' : 'border-t border-[var(--color-border-default)]/30'
                  )}>
                    <div className="space-y-2">
                      {/* Metadata property rows */}
                      {metadataItems.map((item) => (
                        <div key={item.key} className="flex items-center gap-3 text-sm min-h-[28px]">
                          <span className="flex items-center gap-1.5 w-24 flex-shrink-0 text-[var(--color-text-tertiary)]">
                            {item.icon}
                            <span className="capitalize">{item.key === 'updated' ? 'Updated' : 'Created'}</span>
                          </span>
                          <span className="text-[var(--color-text-secondary)]">{item.label}</span>
                        </div>
                      ))}

                      {/* Tags row - always visible for editing */}
                      <div className="flex items-center gap-3 text-sm min-h-[28px]">
                        <span className="flex items-center gap-1.5 w-24 flex-shrink-0 text-[var(--color-text-tertiary)]">
                          <TagIcon size={12} className="flex-shrink-0" />
                          <span>Tags</span>
                        </span>
                        <div className="flex-1 min-w-0">
                          {onTagsChange ? (
                            <InlineTagInput
                              value={tags || ''}
                              onChange={onTagsChange}
                              existingTags={tagColorUniverse}
                              isMulti
                              placeholder="Add tags..."
                              contextKey={pageId ? `page-tags-${pageId}` : undefined}
                              className="min-h-0 px-0 py-0"
                            />
                          ) : (
                            <div className="flex flex-wrap gap-1 py-0.5">
                              {parsedTags.length > 0 ? (
                                parsedTags.map(tag => (
                                  <TagBadge
                                    key={tag}
                                    tag={tag}
                                    compact
                                    contextKey={pageId ? `page-tags-${pageId}` : undefined}
                                    existingTags={tagColorUniverse}
                                  />
                                ))
                              ) : (
                                <span className="text-[var(--color-text-disabled)] italic text-xs py-0.5">No tags</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Backlinks row */}
                      <BacklinksRow pageId={pageId} />

                      {/* Description row */}
                      {onDescriptionClick && !inSplitView && (
                        <button
                          onClick={onDescriptionClick}
                          className="flex items-center gap-3 text-sm w-full text-left group min-h-[28px]"
                        >
                          <span className="flex items-center gap-1.5 w-24 flex-shrink-0 text-[var(--color-text-tertiary)]">
                            <FileText size={12} className="flex-shrink-0" />
                            <span>Description</span>
                          </span>
                          <span className="flex-1 min-w-0">
                            {description ? (
                              <span className="text-[var(--color-text-secondary)] line-clamp-2">
                                {description}
                              </span>
                            ) : (
                              <span className="text-[var(--color-text-disabled)] italic group-hover:text-[var(--color-text-tertiary)] transition-colors">
                                Add a description...
                              </span>
                            )}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Cover controls */}
          {hasCover && editableCover && (
            <div className={cn(
              'absolute left-0 right-0 transition-opacity z-10',
              'top-[calc(80px+env(safe-area-inset-top))] md:top-24',
              isHovering ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )} style={contentInsetStyle}>
              <div className="max-w-5xl mx-auto px-4 md:px-6 flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowPicker(true)}
                  disabled={isUploading}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white bg-black/50 hover:bg-black/70 dark:bg-white/20 dark:hover:bg-white/30 rounded shadow-sm backdrop-blur-sm border border-white/20 transition-colors eink-overlay-control"
                >
                  {isUploading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                  Change cover
                </button>
                <button
                  onClick={handleRemoveCover}
                  disabled={isUploading}
                  className="p-1.5 text-white bg-black/50 hover:bg-black/70 dark:bg-white/20 dark:hover:bg-white/30 rounded shadow-sm backdrop-blur-sm border border-white/20 transition-colors eink-overlay-control"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Cover picker modal */}
      <CoverPickerModal
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        isUploading={isUploading}
        onSelectGradient={handleSelectGradient}
        onSelectImage={handleSelectUnsplashImage}
        onUploadImage={handleUploadImage}
      />


      {/* Icon popup portal - rendered at body level to escape overflow clipping */}
      {iconPopupPortal}
    </div>
  );
};

// ============================================================================
// BACKLINKS ROW
// ============================================================================

const BacklinksRow: React.FC<{ pageId: string | null }> = ({ pageId }) => {
  const backlinks = useBacklinks(pageId);
  const navigate = useNavigate();
  const openTaskInContext = useUIStore((s) => s.openTaskInContext);

  if (backlinks.length === 0) return null;

  return (
    <div className="flex items-start gap-3 text-sm min-h-[28px]">
      <span className="flex items-center gap-1.5 w-24 flex-shrink-0 text-[var(--color-text-tertiary)] mt-0.5">
        <Link2 size={12} className="flex-shrink-0" />
        <span>Backlinks</span>
      </span>
      <div className="flex-1 min-w-0 flex flex-wrap gap-1.5">
        {backlinks.map((bl) => (
          <button
            key={bl.sourceId}
            onClick={() => {
              if (bl.sourceType === 'task') {
                openTaskInContext(bl.sourceId);
              } else {
                navigate({ to: '/pages/$id', params: { id: bl.sourceId } });
              }
            }}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded-md bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors max-w-[200px] truncate"
          >
            {bl.sourceType === 'task' ? (
              <ListChecks size={12} className="flex-shrink-0 text-[var(--color-text-tertiary)]" />
            ) : (
              <ItemIcon
                type={bl.sourceViewMode === 'tasks' ? 'tasks' : bl.sourceViewMode === 'collection' ? 'collection' : 'note'}
                icon={bl.sourceIcon}
                color={bl.sourceColor}
                size="xs"
              />
            )}
            <span className="truncate">{bl.sourceTitle}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// SIMPLE COVER BANNER (for task/collection modes)
// ============================================================================

interface CoverBannerProps {
  pageId: string;
  cover?: string | null;
  className?: string;
}

/**
 * Simple cover display banner for task collections and collection pages.
 * No editing UI - just displays the cover with gradient fade.
 */
export const CoverBanner: React.FC<CoverBannerProps> = ({
  pageId,
  cover,
  className,
}) => {
  if (!cover) return null;

  const isGradient = cover.startsWith('linear-gradient') || cover.startsWith('radial-gradient');
  const isExternalImage = cover.startsWith('http');
  
  const imageUrl = isExternalImage ? cover : (!isGradient ? getPageImageUrl(pageId, cover) : null);
  
  const coverStyle = isGradient
    ? { background: cover }
    : { 
        backgroundImage: `url(${imageUrl})`, 
        backgroundSize: 'cover', 
        backgroundPosition: 'center center' 
      };

  return (
    <div className={cn('relative w-full h-32 overflow-hidden', className)}>
      <div className="w-full h-full" style={coverStyle} />
      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[var(--color-surface-base)] to-transparent" />
    </div>
  );
};

// Export the brightness hook for external use
export { useImageBrightness };

export default PageHero;
