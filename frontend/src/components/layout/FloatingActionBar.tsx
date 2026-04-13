/**
 * @file FloatingActionBar.tsx
 * @description Unified floating action bar for both mobile and desktop
 * @app SHARED - Modern floating navigation with glassmorphism
 * 
 * Mobile (bottom, centered pill):
 * - Menu button (opens/closes sidebar drawer)
 * - Home button  
 * - Pages button (navigate to pages root)
 * - Tasks button (navigate to tasks inbox)
 * - Search button (opens command palette)
 * - ABOVE the pill: Split + button (primary quick add, secondary submenu)
 * 
 * Desktop (bottom-right):
 * - Only the Split + button (no navigation bar)
 * 
 * Note Editing Mode (mobile only):
 * - Shows expanded formatting toolbar above keyboard
 * - Collapse button to dismiss keyboard
 * 
 * Split + Button Design:
 * - Primary (+): Context-aware quick add
 *   - On task page: Add task to that page
 *   - On tasks view (inbox/today/upcoming): Add task (with date if today/upcoming)
 *   - On page: Add child page
 *   - On collection: Add child page  
 *   - Default: Add root-level page
 * - Secondary (chevron): Opens submenu with page and task options
 * 
 * Design features:
 * - Glassmorphism (backdrop blur + transparency)
 * - Pill-shaped container for mobile nav
 * - Smooth animations
 * - Respects safe area insets
 * - z-index above sidebar drawer (z-[150])
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { createPortal } from 'react-dom';
import { useMobileLayout } from '@/contexts/MobileLayoutContext';
import { useSplitViewStore } from '@/contexts/SplitViewContext';
import { usePagesStore, type PagesState } from '@/stores/pagesStore';
import { useUIStore } from '@/stores/uiStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useNavigationStore, getViewKey, type TaskFilter } from '@/stores/navigationStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { usePomodoroStore } from '@/stores/pomodoroStore';
import { useCommandPaletteStore } from '@/hooks/useCommandPalette';
import { useIsMobile, useIsTabletDevice, useKeyboardVisibility } from '@frameer/hooks/useMobileDetection';
import { cn } from '@/lib/design-system';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { getTodayISO } from '@/lib/dateUtils';
import { toastSuccessWithAction, ToolbarFormatButton } from '@/components/ui';
import { getFloatingPanelReserveWidth, FLOATING_PANEL_GUTTER_PX } from '@/lib/layout';

// Compute inline to avoid importing the entire UnifiedSidepanel module
const UNIFIED_SIDEPANEL_FLOATING_RESERVE_WIDTH = getFloatingPanelReserveWidth(328, FLOATING_PANEL_GUTTER_PX);
import { MoveToParentPicker } from '@/components/common/MoveToParentPicker';
import {
  PlusIcon,
  SearchIcon,
  HomeIcon,
  MenuIcon,
  CheckIcon,
  ChevronDownIcon,
  PagesIcon,
  AllTasksIcon,
  ListViewIcon,
} from '@/components/common/Icons';
import {
  StylizedNoteIcon,
} from '@/components/common/StylizedIcons';
import {
  Bold as LucideBold,
  Italic as LucideItalic,
  Underline as LucideUnderline,
  Strikethrough as LucideStrikethrough,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface CreateMenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
}

// ============================================================================
// UTILITY HELPERS
// ============================================================================

/** 
 * Creates event handlers for FAB buttons that prevent focus stealing from editor.
 * Returns object with onTouchEnd, onClick, and onMouseDown handlers.
 * When dragMode is true, all events are delegated to parent container (for drag-to-select).
 */
const createFabButtonHandlers = (onClick: () => void, dragMode = false) => ({
  onTouchEnd: (e: React.TouchEvent) => {
    if (!dragMode) {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    }
    // In drag mode, don't call preventDefault/stopPropagation to let container handle it
  },
  onClick: (e: React.MouseEvent) => {
    // In drag mode, skip onClick to avoid double-triggering
    if (dragMode) return;
    e.preventDefault();
    e.stopPropagation();
    onClick();
  },
  onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
});

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Secondary action button (Home, Menu, Search, etc.) - smaller nav buttons */
const NavButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  isActive?: boolean;
  isDragHighlight?: boolean;
  dragMode?: boolean;
  fabId?: string;
  className?: string;
}> = ({ icon, label, onClick, isActive = false, isDragHighlight = false, dragMode = false, fabId, className = '' }) => {
  return (
    <button
      type="button"
      data-fab-id={fabId}
      {...createFabButtonHandlers(onClick, dragMode)}
      aria-label={label}
      className={`
        relative flex items-center justify-center
        w-12 h-12
        rounded-full
        transition-all duration-300 transition-spring
        ${(isActive || isDragHighlight)
          ? 'bg-[var(--color-accent-muted)] text-[var(--color-accent-primary)] scale-110' 
          : 'text-[var(--color-text-secondary)] active:scale-90 active:bg-white/20'
        }
        ${className}
      `}
    >
      <span className={`w-[22px] h-[22px] transition-transform duration-300 transition-spring ${(isActive || isDragHighlight) ? 'scale-110' : ''}`}>{icon}</span>
    </button>
  );
};

/** Split Add Button - Primary + for quick add, secondary chevron for submenu */
const SplitAddButton: React.FC<{
  onPrimaryClick: () => void;
  onSecondaryClick: () => void;
  isMenuOpen: boolean;
  size?: 'sm' | 'md' | 'lg';
  primaryLabel?: string;
  primaryAriaLabel?: string;
  secondaryAriaLabel?: string;
  noShadow?: boolean;
}> = ({
  onPrimaryClick,
  onSecondaryClick,
  isMenuOpen,
  size = 'md',
  primaryLabel,
  primaryAriaLabel,
  secondaryAriaLabel,
  noShadow = false,
}) => {
  const sizeClasses = {
    sm: 'h-11',
    md: 'h-12',
    lg: 'h-13',
  };
  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-7 h-7',
  };
  const primaryPadding = {
    sm: 'px-3',
    md: 'px-4',
    lg: 'px-5',
  };
  
  return (
    <div className={`
      flex items-stretch
      ${sizeClasses[size]}
      rounded-full
      bg-[var(--color-fab-bg)] hover:bg-[var(--color-fab-bg-hover)]
      border border-[var(--color-fab-border)]
      ${noShadow ? '' : 'shadow-lg shadow-[var(--color-fab-glow)]'}
      overflow-hidden
      backdrop-blur-sm
      transition-all duration-200
    `}>
      {/* Primary button - quick add based on context */}
      <button
        type="button"
        {...createFabButtonHandlers(onPrimaryClick)}
        aria-label={primaryAriaLabel || primaryLabel || 'Quick add'}
        className={`
          flex items-center justify-center gap-1.5
          ${primaryPadding[size]}
          text-[var(--color-fab-text)]
          hover:brightness-110 active:brightness-110
          transition-all duration-150
        `}
      >
        <PlusIcon className={iconSizes[size]} />
        {primaryLabel && size === 'lg' && (
          <span className="text-sm font-medium pr-1">{primaryLabel}</span>
        )}
      </button>

      <div className="w-px bg-white/20" />
      
      {/* Secondary button - opens submenu */}
      <button
        type="button"
        {...createFabButtonHandlers(onSecondaryClick)}
        aria-label={secondaryAriaLabel || (isMenuOpen ? 'Close menu' : 'More options')}
        aria-expanded={isMenuOpen}
        className={`
          flex items-center justify-center
          px-2.5
          text-[var(--color-fab-text)]
          hover:brightness-110 active:brightness-110
          transition-all duration-200
          ${isMenuOpen ? 'rotate-180' : 'rotate-0'}
        `}
      >
        <ChevronDownIcon className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />
      </button>
    </div>
  );
};

/** Individual create menu item - icon only with tooltip on hover */
const CreateMenuItemButton: React.FC<{
  item: CreateMenuItem;
  index: number;
  total: number;
  isVisible: boolean;
}> = ({ item, index, total, isVisible }) => {
  const delay = isVisible ? index * 40 : (total - index - 1) * 30;
  const [showTooltip, setShowTooltip] = React.useState(false);
  
  return (
    <div className="relative">
      <button
        type="button"
        {...createFabButtonHandlers(item.action)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          flex items-center justify-center
          w-10 h-10
          rounded-xl
          transition-all ease-out
          hover:bg-[var(--color-fab-bg-hover)]/20
          active:scale-95
          text-[var(--color-fab-text)]
          ${isVisible 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-4 pointer-events-none'
          }
        `}
        style={{ 
          transitionDuration: '250ms',
          transitionDelay: `${delay}ms`,
        }}
        tabIndex={isVisible ? 0 : -1}
        aria-hidden={!isVisible}
        aria-label={item.label}
      >
        <span className="w-5 h-5 flex items-center justify-center">{item.icon}</span>
      </button>
      
      {/* Tooltip */}
      {showTooltip && isVisible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 rounded px-2 py-1 text-xs whitespace-nowrap pointer-events-none z-50 bg-black/85 text-white shadow-lg">
          {item.label}
        </div>
      )}
    </div>
  );
};

/** Create menu popup - simple horizontal list of page type options */
const CreateMenu: React.FC<{
  isOpen: boolean;
  items: CreateMenuItem[];
  position?: 'center' | 'right';
}> = ({ isOpen, items, position = 'center' }) => {
  const positionClasses = position === 'center' 
    ? 'left-1/2 -translate-x-1/2' 
    : 'right-0';
  
  return (
    <div
      className={`
        absolute bottom-full ${positionClasses} mb-3
        flex flex-col items-center gap-2
        transition-all duration-300 ease-out
        ${isOpen 
          ? 'opacity-100 scale-100' 
          : 'opacity-0 scale-95 pointer-events-none'
        }
      `}
      role="menu"
      aria-label="Create new item"
    >
      {/* Main create menu */}
      <div
        className="
          flex items-center gap-1
          px-2 py-2
          bg-[var(--color-surface-glass)]
          backdrop-blur-xl
          border border-[var(--color-border-secondary)]/50
          rounded-2xl
          shadow-lg shadow-black/10
          eink-shell-surface
        "
      >
        {items.map((item, index) => (
          <CreateMenuItemButton
            key={item.id}
            item={item}
            index={index}
            total={items.length}
            isVisible={isOpen}
          />
        ))}
      </div>
    </div>
  );
};

/** Format button - uses shared ToolbarFormatButton for consistent styling */
// (Imported from @/components/ui and used directly in the editor toolbar section below)

/** Text formatting menu popup - appears above the format button when editing */
const FormatMenu: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  // Dispatch custom events to the editor for formatting
  const dispatchFormatEvent = useCallback((format: string) => {
    window.dispatchEvent(new CustomEvent('fab-format', { detail: { format } }));
  }, []);
  
  const dispatchInsertEvent = useCallback((blockType: string) => {
    window.dispatchEvent(new CustomEvent('fab-insert', { detail: { blockType } }));
    onClose();
  }, [onClose]);
  
  const handleBold = () => dispatchFormatEvent('bold');
  const handleItalic = () => dispatchFormatEvent('italic');
  const handleUnderline = () => dispatchFormatEvent('underline');
  const handleStrike = () => dispatchFormatEvent('strike');
  const handleTodo = () => dispatchInsertEvent('TodoList');
  const handleList = () => dispatchInsertEvent('BulletedList');
  const handleSlash = () => dispatchInsertEvent('slash');
  
  return (
    <div
      className={`
        absolute bottom-full left-0 mb-3
        flex items-center gap-0.5
        px-1.5 py-1.5
        bg-[var(--color-surface-glass)]
        backdrop-blur-xl
        border border-[var(--color-border-secondary)]/50
        rounded-full
        shadow-lg shadow-black/10
        eink-shell-surface
        transition-all duration-300 ease-out
        ${isOpen 
          ? 'opacity-100 scale-100' 
          : 'opacity-0 scale-95 pointer-events-none'
        }
      `}
      role="menu"
      aria-label="Text formatting"
    >
      {/* Text formatting buttons */}
      <ToolbarFormatButton label="Bold" onClick={handleBold}>
        <LucideBold size={16} />
      </ToolbarFormatButton>
      <ToolbarFormatButton label="Italic" onClick={handleItalic}>
        <LucideItalic size={16} />
      </ToolbarFormatButton>
      <ToolbarFormatButton label="Underline" onClick={handleUnderline}>
        <LucideUnderline size={16} />
      </ToolbarFormatButton>
      <ToolbarFormatButton label="Strikethrough" onClick={handleStrike}>
        <LucideStrikethrough size={16} />
      </ToolbarFormatButton>
      
      <div className="w-px h-5 bg-[var(--color-border-secondary)] mx-0.5" />
      
      {/* Quick insert buttons */}
      <ToolbarFormatButton label="Add todo" onClick={handleTodo}>
        <CheckIcon className="w-4 h-4" />
      </ToolbarFormatButton>
      <ToolbarFormatButton label="Add list" onClick={handleList}>
        <ListViewIcon className="w-4 h-4" />
      </ToolbarFormatButton>
      
      <div className="w-px h-5 bg-[var(--color-border-secondary)] mx-0.5" />
      
      {/* Insert block button */}
      <button
        type="button"
        {...createFabButtonHandlers(handleSlash)}
        className="flex items-center justify-center px-2 h-8 rounded-lg bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface-tertiary)] active:bg-[var(--color-surface-tertiary)] text-[var(--color-text-primary)] font-medium text-xs transition-colors whitespace-nowrap"
      >
        Insert
      </button>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const FloatingActionBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const isTabletDevice = useIsTabletDevice();
  const mobileLayout = useMobileLayout();
  const { isKeyboardOpen, keyboardHeight } = useKeyboardVisibility();
  const usesPortableEditorToolbar = isMobile || isTabletDevice;
  
  // Shared container classes for mobile FAB sections
  const mobileContainerClasses = `
    flex items-center gap-1
    px-2 py-1.5
    glass-panel-nav
    eink-shell-surface
    shadow-lg
    transition-all duration-300 ease-out
  `;
  
  // State
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [formatMenuOpen, setFormatMenuOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // State for "Move to parent" sheet after creating a page
  const [moveSheetOpen, setMoveSheetOpen] = useState(false);
  const [newlyCreatedPage, setNewlyCreatedPage] = useState<{ id: string; title: string } | null>(null);
  
  // iOS-style drag-to-select state
  const [dragHighlightId, setDragHighlightId] = useState<string | null>(null);
  const actionMapRef = React.useRef<Map<string, () => void>>(new Map());
  const navContainerRef = React.useRef<HTMLDivElement>(null);
  
  // Slider position state for smooth morphing effect
  const [sliderStyle, setSliderStyle] = useState<{
    left: number;
    width: number;
    opacity: number;
  }>({ left: 0, width: 52, opacity: 0 });
  
  // Stores
  const requestNavigation = useUIStore((s) => s.requestNavigation);
  const createTaskInContext = useUIStore((s) => s.createTaskInContext);
  const isPageEditorFocused = useUIStore((s) => s.isPageEditorFocused);
  const setPageEditorFocused = useUIStore((s) => s.setPageEditorFocused);
  const activeTextMarks = useUIStore((s) => s.activeTextMarks);
  const pageMoveTarget = useUIStore((s) => s.pageMoveTarget);
  const closePageMovePicker = useUIStore((s) => s.closePageMovePicker);
  const createPage = usePagesStore((s: PagesState) => s.createPage);
  const selectPage = usePagesStore((s: PagesState) => s.selectPage);
  const openCommandPalette = useCommandPaletteStore((s) => s.open);
  const closeCommandPalette = useCommandPaletteStore((s) => s.close);
  const isCommandPaletteOpen = useCommandPaletteStore((s) => s.isOpen);
  const pagesById = usePagesStore((s) => s.pagesById);
  
  // Split view context (for creating children in split view panel)
  const splitViewParentId = useSplitViewStore((s) => s.parentPageId);
  const splitViewCreateChild = useSplitViewStore((s) => s.onCreateChild);
  const isImmersive = usePomodoroStore((s) => s.isImmersive);
  
  // Reading pane detection logic for shifting FAB on desktop
  // We must subscribe to the underlying state values to ensure re-renders when they change
  // Navigation store
  const sidePanelOpen = useNavigationStore((s) => s.sidePanelOpen);
  
  const isPage = location.pathname.startsWith('/pages');
  const isTasks = location.pathname.startsWith('/tasks');
  
  const pageIdId = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments[0] === 'pages') {
      if (segments[1]) return segments[1];
    }
    
    if (segments[0] === 'tasks' && segments[1]) {
      const filter = segments[1];
      if (!['inbox', 'today', 'upcoming', 'all'].includes(filter)) {
        return filter;
      }
    }
    return null;
  }, [location.pathname]);

  const fabPage = pageIdId ? pagesById[pageIdId] : null;

  // Determine if a split view detail pane is currently visible on the right
  // This affects both FAB positioning (shift) and creation logic (side panels vs modals)
  const isSplitViewActive = useMemo(
    () => !isMobile && sidePanelOpen && (isPage || isTasks),
    [isMobile, isPage, isTasks, sidePanelOpen],
  );

  // Determine the shift width based on which detail pane is active
  const fabShiftWidth = useMemo(() => {
    if (!isSplitViewActive) return 0;

    // Use the shared floating sidepanel reserve width so the FAB clears the
    // actual docked panel footprint, including its gutter.
    return UNIFIED_SIDEPANEL_FLOATING_RESERVE_WIDTH;
  }, [isSplitViewActive, location.pathname]);

  // Selection state (to hide add button when multi-selecting)
  const hasSelection = useSelectionStore(s => 
    Object.values(s.selectedIds).some(set => set.size > 0)
  );
  
  // PWA install banner state (to offset/hide add button when banner is showing)
  // canInstall is true when !isInstalled && !isDismissed, so we just need canInstall
  const { canInstall } = usePWAInstall();
  const isPWABannerVisible = isMobile && canInstall;
  
  // Current route state
  const currentPath = location.pathname;
  const isHome = currentPath === '/';
  const isGraph = currentPath === '/graph';
  
  // Check if we're viewing a specific page - handles both /pages/id and /tasks/id
  const currentPageId = pageIdId;
  const currentPage = fabPage;
  const isPageView = isPage || (isTasks && !!pageIdId);
  
  // Check if we're editing a note (for showing format button)
  const isEditingNote = usesPortableEditorToolbar && isPageEditorFocused && isPage && currentPage?.viewMode === 'note';
  
  // Handler to exit editor mode (blur and dismiss keyboard)
  const handleExitEditorMode = useCallback(() => {
    // Blur active element to dismiss keyboard
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    
    // Clear selection to ensure cursor is removed on mobile
    window.getSelection()?.removeAllRanges();
    
    // Reset editor focused state
    setPageEditorFocused(false);
  }, [setPageEditorFocused]);
  
  // Close menus on escape
  useEffect(() => {
    if (!createMenuOpen && !formatMenuOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setCreateMenuOpen(false);
        setFormatMenuOpen(false);
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [createMenuOpen, formatMenuOpen]);
  
  // ============================================================================
  // HANDLERS
  // ============================================================================
  
  const handleToggleCreateMenu = useCallback(() => {
    setFormatMenuOpen(false);
    setCreateMenuOpen(prev => !prev);
  }, []);
  
  const handleToggleFormatMenu = useCallback(() => {
    setCreateMenuOpen(false);
    setFormatMenuOpen(prev => !prev);
  }, []);
  
  // ============================================================================
  // iOS-STYLE DRAG GESTURE HANDLERS
  // ============================================================================
  
  // Update slider position based on the highlighted button
  const updateSliderPosition = useCallback((fabId: string | null) => {
    if (!fabId || !navContainerRef.current) {
      setSliderStyle(prev => ({ ...prev, opacity: 0 }));
      return;
    }
    
    const button = navContainerRef.current.querySelector(`[data-fab-id="${fabId}"]`);
    if (button) {
      const containerRect = navContainerRef.current.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      const left = buttonRect.left - containerRect.left;
      const width = buttonRect.width;
      
      setSliderStyle({
        left,
        width,
        opacity: 1,
      });
    }
  }, []);
  
  const handleContainerTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const button = element?.closest('[data-fab-id]');
    const fabId = button?.getAttribute('data-fab-id');
    
    if (fabId) {
      setDragHighlightId(fabId);
      updateSliderPosition(fabId);
    }
  }, [updateSliderPosition]);
  
  const handleContainerTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const button = element?.closest('[data-fab-id]');
    const fabId = button?.getAttribute('data-fab-id');
    
    if (fabId !== dragHighlightId) {
      setDragHighlightId(fabId || null);
      updateSliderPosition(fabId || null);
    }
  }, [dragHighlightId, updateSliderPosition]);
  
  const handleContainerTouchEnd = useCallback(() => {
    if (dragHighlightId) {
      const action = actionMapRef.current.get(dragHighlightId);
      if (action) {
        action();
      }
    }
    setDragHighlightId(null);
    setSliderStyle(prev => ({ ...prev, opacity: 0 }));
  }, [dragHighlightId]);
  
  const handleNavigateHome = useCallback(() => {
    const canNavigate = requestNavigation({ type: 'view', target: 'home' });
    if (canNavigate) {
      // Close other panels when switching tabs
      mobileLayout?.onCloseDrawer?.();
      setIsDrawerOpen(false);
      setCreateMenuOpen(false);
      setPageEditorFocused(false);
      closeCommandPalette();
      navigate({ to: '/' });
    }
  }, [requestNavigation, navigate, mobileLayout, closeCommandPalette, setPageEditorFocused]);
  
  const handleToggleMenu = useCallback(() => {
    // Close command palette and create menu when opening sidebar
    closeCommandPalette();
    setCreateMenuOpen(false);
    
    if (isDrawerOpen) {
      mobileLayout?.onCloseDrawer?.();
      setIsDrawerOpen(false);
    } else {
      mobileLayout?.onOpenDrawer?.();
      setIsDrawerOpen(true);
    }
  }, [isDrawerOpen, mobileLayout, closeCommandPalette]);
  
  // Sync drawer state - reset when drawer is closed externally
  useEffect(() => {
    if (!isMobile) return;
    
    const checkDrawerState = () => {
      const drawerExists = document.querySelector('[role="dialog"][aria-modal="true"]');
      if (!drawerExists && isDrawerOpen) {
        setIsDrawerOpen(false);
      }
    };
    
    const timer = setInterval(checkDrawerState, 200);
    return () => clearInterval(timer);
  }, [isDrawerOpen, isMobile]);
  
  const handleToggleSearch = useCallback(() => {
    // Toggle command palette - close if already open
    if (isCommandPaletteOpen) {
      closeCommandPalette();
    } else {
      // Close drawer and create menu when opening search palette
      mobileLayout?.onCloseDrawer?.();
      setIsDrawerOpen(false);
      setCreateMenuOpen(false);
      openCommandPalette();
    }
  }, [isCommandPaletteOpen, openCommandPalette, closeCommandPalette, mobileLayout]);
  
  // Context-aware creation: determine where to add new items
  // - If in a collection: add as child of collection
  // - If in a note that's inside a collection: add as sibling (to the parent collection)
  // - Task pages use their own creation logic
  const getContextParentId = useCallback((): string | null => {
    if (!currentPage) return null;
    
    // If viewing a collection, add as child of that collection
    if (currentPage.viewMode === 'collection') {
      return currentPage.id;
    }
    
    // If viewing a note that has a parent, add as sibling (to parent)
    // This means if you're in "Collection > My Note" and click create, 
    // the new item goes into Collection, not into My Note
    if ((currentPage.viewMode === 'note') && currentPage.parentId) {
      return currentPage.parentId;
    }
    
    return null;
  }, [currentPage]);
  
  // Helper: Show toast with "Move" action after creating a page
  const showMoveToast = useCallback((page: { id: string; title: string }) => {
    toastSuccessWithAction(
      `"${page.title || 'Untitled'}" created`,
      {
        label: 'Move',
        onClick: () => {
          setNewlyCreatedPage(page);
          setMoveSheetOpen(true);
        },
      }
    );
  }, []);
  
  // Helper to check if creating a child should use split view
  const shouldUseSplitView = useCallback((parentId: string | null): boolean => {
    // If we're at the root (/pages) and in split view mode, we want to open
    // the new page in the side panel even if parentId is null.
    const isAtPagesRootInSplitView = parentId === null && splitViewParentId === null && splitViewCreateChild;
    
    return !!((parentId && parentId === splitViewParentId && splitViewCreateChild) || isAtPagesRootInSplitView);
  }, [splitViewParentId, splitViewCreateChild]);
  
  const handleCreateNote = useCallback(() => {
    setCreateMenuOpen(false);
    const parentId = getContextParentId();
    
    // If we're in split view and creating child of the split view parent, use split view
    if (shouldUseSplitView(parentId)) {
      splitViewCreateChild!(parentId, 'note');
      return;
    }
    
    const newPage = createPage({ 
      title: 'Untitled', 
      parentId,
      viewMode: 'note',
    });
    selectPage(newPage.id, true);
    navigate({ to: '/pages/$id', params: { id: newPage.id } });
    // Show move toast only if page was created without a parent
    if (!parentId) {
      showMoveToast(newPage);
    }
  }, [createPage, selectPage, navigate, getContextParentId, showMoveToast, shouldUseSplitView, splitViewCreateChild]);
  
  const handleCreateTask = useCallback(() => {
    setCreateMenuOpen(false);
    
    // If we're viewing a task page, create task in that page
    if (currentPage?.viewMode === 'tasks') {
      const defaults = { defaultTaskPageId: currentPage.id };
      createTaskInContext(defaults);
    } else {
      // Navigate to tasks inbox and start creating
      if (!currentPath.startsWith('/tasks')) {
        navigate({ to: '/tasks/$filter', params: { filter: 'inbox' } });
        setTimeout(() => {
          createTaskInContext();
        }, 100);
      } else {
        // We are already on /tasks
        createTaskInContext();
      }
    }
  }, [createTaskInContext, currentPath, currentPage, navigate]);
  
  // Navigate to pages root
  const handleNavigatePages = useCallback(() => {
    const canNavigate = requestNavigation({ type: 'view', target: 'pages' });
    if (canNavigate) {
      mobileLayout?.onCloseDrawer?.();
      setIsDrawerOpen(false);
      setCreateMenuOpen(false);
      setPageEditorFocused(false);
      closeCommandPalette();
      navigate({ to: '/pages' });
    }
  }, [requestNavigation, mobileLayout, closeCommandPalette, navigate, setPageEditorFocused]);
  
  // Navigate to tasks inbox
  const taskFilterFromStore = useNavigationStore((state) => state.taskFilter);

  const handleNavigateTasks = useCallback(() => {
    const canNavigate = requestNavigation({ type: 'view', target: 'tasks' });
    if (canNavigate) {
      mobileLayout?.onCloseDrawer?.();
      setIsDrawerOpen(false);
      setCreateMenuOpen(false);
      setPageEditorFocused(false);
      closeCommandPalette();
      navigate({ to: '/tasks/$filter', params: { filter: taskFilterFromStore || 'all' } });
    }
  }, [requestNavigation, mobileLayout, closeCommandPalette, navigate, taskFilterFromStore, setPageEditorFocused]);
  
  // ============================================================================
  // CONTEXT-AWARE QUICK ADD (Primary + button action)
  // ============================================================================
  const handleContextAwareQuickAdd = useCallback(() => {
    // Determine what to create based on current context
    
    // 0. If on the root pages list in split view, always create a new root-level page in the side panel
    if (currentPath === '/pages' && shouldUseSplitView(null)) {
      splitViewCreateChild!(null, 'note');
      return;
    }
    
    // 1. If on a task page, add a task to that page
    if (currentPage?.viewMode === 'tasks') {
      const defaults = { defaultTaskPageId: currentPage.id };
      createTaskInContext(defaults);
      return;
    }
    
    // 2. If on tasks view (inbox/today/upcoming/all), add a task
    if (currentPath.startsWith('/tasks')) {
      const filter = currentPath.replace('/tasks/', '');
      // For today or upcoming, set today's date
      const defaults = (filter === 'today' || filter === 'upcoming') 
        ? { defaultDueDate: getTodayISO() } 
        : {};

      createTaskInContext(defaults);
      return;
    }
    
    // 3. If on a note that has a parent (is a child), add sibling note to same parent
    if (currentPage?.viewMode === 'note' && currentPage.parentId) {
      // Check if parent is the split view parent
      if (shouldUseSplitView(currentPage.parentId)) {
        splitViewCreateChild!(currentPage.parentId, 'note');
        return;
      }
      const newPage = createPage({ 
        title: 'Untitled', 
        parentId: currentPage.parentId,
        viewMode: 'note',
      });
      selectPage(newPage.id, true);
      navigate({ to: '/pages/$id', params: { id: newPage.id } });
      return;
    }
    
    // 4. If on a collection, add child note
    if (currentPage?.viewMode === 'collection') {
      // Check if collection is the split view parent
      if (shouldUseSplitView(currentPage.id)) {
        splitViewCreateChild!(currentPage.id, 'note');
        return;
      }
      const newPage = createPage({ 
        title: 'Untitled', 
        parentId: currentPage.id,
        viewMode: 'note',
      });
      selectPage(newPage.id, true);
      navigate({ to: '/pages/$id', params: { id: newPage.id } });
      return;
    }
    
    // 5. If on a standalone note (no parent), add child note
    if (currentPage?.viewMode === 'note' && !currentPage.parentId) {
      if (shouldUseSplitView(currentPage.id)) {
        splitViewCreateChild!(currentPage.id, 'note');
        return;
      }
      const newPage = createPage({ 
        title: 'Untitled', 
        parentId: currentPage.id,
        viewMode: 'note',
      });
      selectPage(newPage.id, true);
      navigate({ to: '/pages/$id', params: { id: newPage.id } });
      return;
    }
    
    // 6. Default: create root-level note
    if (shouldUseSplitView(null)) {
      splitViewCreateChild!(null, 'note');
      return;
    }
    
    const newPage = createPage({ 
      title: 'Untitled', 
      viewMode: 'note',
    });
    selectPage(newPage.id, true);
    navigate({ to: '/pages/$id', params: { id: newPage.id } });
    // Show move toast for root-level pages
    showMoveToast(newPage);
  }, [currentPage, currentPath, createTaskInContext, createPage, selectPage, navigate, showMoveToast, shouldUseSplitView, splitViewCreateChild]);
  
  // Get label for primary add button based on context
  const getPrimaryAddLabel = useCallback((): string | undefined => {
    if (currentPage?.viewMode === 'tasks') return undefined; // Just show +
    if (currentPath.startsWith('/tasks')) return undefined;
    if (currentPage?.viewMode === 'note') return undefined;
    if (currentPage?.viewMode === 'collection') return undefined;
    return undefined;
  }, [currentPage, currentPath]);
  
  // Create menu items - icons are lighter in dark mode for better contrast
  const theme = useSettingsStore(s => s.theme);
  const isDarkMode = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const iconColor = isDarkMode ? '#94a3b8' : '#64748b'; // slate-400 dark, slate-500 light
  
  const createMenuItems = useMemo<CreateMenuItem[]>(() => [
    {
      id: 'note',
      label: 'Page',
      icon: <StylizedNoteIcon size="md" color={iconColor} />,
      action: handleCreateNote,
    },
    {
      id: 'task',
      label: 'Task',
      icon: <CheckIcon className="w-5 h-5" />,
      action: handleCreateTask,
    },
  ], [iconColor, handleCreateNote, handleCreateTask]);
  
  // Update action map for drag gestures - after all handlers are defined
  useEffect(() => {
    actionMapRef.current.clear();
    actionMapRef.current.set('menu', handleToggleMenu);
    actionMapRef.current.set('home', handleNavigateHome);
    actionMapRef.current.set('pages', handleNavigatePages);
    actionMapRef.current.set('tasks', handleNavigateTasks);
    actionMapRef.current.set('search', handleToggleSearch);
    actionMapRef.current.set('bold', () => window.dispatchEvent(new CustomEvent('fab-format', { detail: { format: 'bold' } })));
    actionMapRef.current.set('italic', () => window.dispatchEvent(new CustomEvent('fab-format', { detail: { format: 'italic' } })));
    actionMapRef.current.set('underline', () => window.dispatchEvent(new CustomEvent('fab-format', { detail: { format: 'underline' } })));
    actionMapRef.current.set('strike', () => window.dispatchEvent(new CustomEvent('fab-format', { detail: { format: 'strike' } })));
    actionMapRef.current.set('insert', () => window.dispatchEvent(new CustomEvent('fab-insert', { detail: { blockType: 'slash' } })));
    actionMapRef.current.set('close', handleExitEditorMode);
  }, [handleToggleMenu, handleNavigateHome, handleNavigatePages, handleNavigateTasks, handleToggleSearch, handleExitEditorMode]);
  
  const handleOverlayClick = useCallback(() => {
    setCreateMenuOpen(false);
    setFormatMenuOpen(false);
  }, []);
  
  // Don't render during SSR
  if (typeof document === 'undefined') return null;
  
  // FAB always shows on mobile and desktop
  
  // Calculate bottom position based on keyboard visibility
  // When keyboard is open, position FAB above it
  const getMobileBottomPosition = () => {
    if (isKeyboardOpen && keyboardHeight > 0) {
      // Position above keyboard - use visual viewport offset
      // The keyboardHeight already accounts for the difference between window and viewport
      return `${keyboardHeight + 8}px`;
    }
    // Default position at bottom - closer to the edge for easier thumb reach
    // Use max() to ensure minimum 1rem offset even without safe area insets
    return 'max(1rem, env(safe-area-inset-bottom))';
  };

  const renderEditorToolbar = () => (
    <div className={mobileContainerClasses} role="toolbar" aria-label="Text formatting">
      <div className="flex items-center gap-0.5">
        <ToolbarFormatButton
          label="Bold"
          onClick={() => window.dispatchEvent(new CustomEvent('fab-format', { detail: { format: 'bold' } }))}
          isActive={activeTextMarks.has('bold')}
        >
          <LucideBold size={16} />
        </ToolbarFormatButton>
        <ToolbarFormatButton
          label="Italic"
          onClick={() => window.dispatchEvent(new CustomEvent('fab-format', { detail: { format: 'italic' } }))}
          isActive={activeTextMarks.has('italic')}
        >
          <LucideItalic size={16} />
        </ToolbarFormatButton>
        <ToolbarFormatButton
          label="Underline"
          onClick={() => window.dispatchEvent(new CustomEvent('fab-format', { detail: { format: 'underline' } }))}
          isActive={activeTextMarks.has('underline')}
        >
          <LucideUnderline size={16} />
        </ToolbarFormatButton>
        <ToolbarFormatButton
          label="Strike"
          onClick={() => window.dispatchEvent(new CustomEvent('fab-format', { detail: { format: 'strike' } }))}
          isActive={activeTextMarks.has('strike')}
        >
          <LucideStrikethrough size={16} />
        </ToolbarFormatButton>

        <div className="mx-1 h-5 w-px bg-[var(--color-border-secondary)]" />

        <SplitAddButton
          onPrimaryClick={() => window.dispatchEvent(new CustomEvent('fab-insert', { detail: { blockType: 'slash' } }))}
          onSecondaryClick={handleExitEditorMode}
          isMenuOpen={false}
          size="sm"
          primaryAriaLabel="Insert block"
          secondaryAriaLabel="Minimize editor toolbar"
        />
      </div>
    </div>
  );
  
  // ============================================================================
  // MOBILE LAYOUT - Unified morphing FAB
  // ============================================================================
  if (isMobile) {
    return createPortal(
      <>
        {/* Backdrop overlay when menu is open */}
        {(createMenuOpen || formatMenuOpen) && (
          <div
            className="fixed inset-0 z-[140] bg-black/10 backdrop-blur-[1px] transition-opacity duration-200 eink-modal-backdrop"
            onClick={handleOverlayClick}
            aria-hidden="true"
          />
        )}
        
        {/* Bottom fixed container: nav bar (left) + split add button (right) */}
        <div
          className={`
            fixed z-[150]
            transition-all duration-300 ease-out
            left-1/2 -translate-x-1/2
            ${isEditingNote 
              ? 'w-auto max-w-[calc(100vw-2rem)]' 
              : 'w-[calc(100vw-2rem)] max-w-md'
            }
            ${isImmersive ? 'opacity-0 scale-95 pointer-events-none translate-y-10' : 'opacity-100 scale-100 translate-y-0'}
          `}
          style={{
            bottom: getMobileBottomPosition(),
          }}
        >
          <div className="relative flex items-center justify-center w-full">
            {/* Editor Toolbar - shown when editing */}
            <div
              className={cn(
                'transition-all duration-300 ease-in-out',
                isEditingNote ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none absolute',
              )}
            >
              {renderEditorToolbar()}
            </div>

            {/* Navigation Bar - shown when not editing */}
            <div 
              className={`
                transition-all duration-300 ease-in-out
                ${!isEditingNote 
                  ? 'opacity-100 scale-100' 
                  : 'opacity-0 scale-95 pointer-events-none absolute'
                }
                ${(hasSelection || isPWABannerVisible) ? 'opacity-0 scale-90 pointer-events-none' : ''}
              `}
            >
              <div className="relative">
                <CreateMenu 
                  isOpen={createMenuOpen} 
                  items={createMenuItems} 
                  position="right"
                />
                <div 
                  ref={navContainerRef}
                  className={`${mobileContainerClasses} relative`}
                  role="navigation"
                  aria-label="Navigation"
                  onTouchStart={handleContainerTouchStart}
                  onTouchMove={handleContainerTouchMove}
                  onTouchEnd={handleContainerTouchEnd}
                >
                  {/* Sliding indicator - hidden since NavButtons now have their own active background */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-12 rounded-full bg-[var(--color-accent-muted)] pointer-events-none"
                    style={{
                      left: sliderStyle.left,
                      width: sliderStyle.width,
                      opacity: 0,
                      transition: 'left 180ms cubic-bezier(0.4, 0, 0.2, 1), width 180ms cubic-bezier(0.4, 0, 0.2, 1), opacity 120ms ease-out',
                    }}
                  />
                  <NavButton
                    fabId="menu"
                    icon={<MenuIcon className="w-full h-full" />}
                    label={isDrawerOpen ? 'Close menu' : 'Open menu'}
                    onClick={handleToggleMenu}
                    isActive={isDrawerOpen && !isCommandPaletteOpen}
                    isDragHighlight={dragHighlightId === 'menu'}
                    dragMode={isMobile}
                  />
                  
                  <NavButton
                    fabId="home"
                    icon={<HomeIcon className="w-full h-full" />}
                    label="Home"
                    onClick={handleNavigateHome}
                    isActive={isHome && !isDrawerOpen && !isCommandPaletteOpen}
                    isDragHighlight={dragHighlightId === 'home'}
                    dragMode={isMobile}
                  />

                  <NavButton
                    fabId="pages"
                    icon={<PagesIcon className="w-full h-full" />}
                    label="Pages"
                    onClick={handleNavigatePages}
                    isActive={currentPath.startsWith('/pages') && !isDrawerOpen && !isCommandPaletteOpen}
                    isDragHighlight={dragHighlightId === 'pages'}
                    dragMode={isMobile}
                  />

                  <NavButton
                    fabId="tasks"
                    icon={<CheckIcon className="w-full h-full" />}
                    label="Tasks"
                    onClick={handleNavigateTasks}
                    isActive={currentPath.startsWith('/tasks') && !isDrawerOpen && !isCommandPaletteOpen}
                    isDragHighlight={dragHighlightId === 'tasks'}
                    dragMode={isMobile}
                  />
                  
                  <NavButton
                    fabId="search"
                    icon={<SearchIcon className="w-full h-full" />}
                    label="Search"
                    onClick={handleToggleSearch}
                    isActive={isCommandPaletteOpen && !isDrawerOpen}
                    isDragHighlight={dragHighlightId === 'search'}
                    dragMode={isMobile}
                  />

                  {!isGraph && (
                    <>
                      <div className="w-px h-5 bg-[var(--color-border-secondary)] mx-1" />

                      <SplitAddButton
                        onPrimaryClick={handleContextAwareQuickAdd}
                        onSecondaryClick={handleToggleCreateMenu}
                        isMenuOpen={createMenuOpen}
                        size="sm"
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Move to parent picker - after creating a new page */}
        {newlyCreatedPage && (
          <MoveToParentPicker
            isOpen={moveSheetOpen}
            onClose={() => {
              setMoveSheetOpen(false);
              setNewlyCreatedPage(null);
            }}
            pageId={newlyCreatedPage.id}
            pageTitle={newlyCreatedPage.title}
          />
        )}
        
        {/* Move to parent picker - triggered from header */}
        {pageMoveTarget && (
          <MoveToParentPicker
            isOpen={!!pageMoveTarget}
            onClose={closePageMovePicker}
            pageId={pageMoveTarget.pageId}
            pageTitle={pageMoveTarget.pageTitle}
          />
        )}
      </>,
      document.body
    );
  }
  
  // ============================================================================
  // DESKTOP LAYOUT - Only show split + button (no navigation bar)
  // ============================================================================
  if (isGraph) {
    return null;
  }

  if (isTabletDevice && isEditingNote) {
    return createPortal(
      <div
        className={cn(
          'fixed left-1/2 z-[150] w-auto max-w-[calc(100vw-2rem)] -translate-x-1/2 transition-all duration-300 ease-out',
          isImmersive ? 'pointer-events-none translate-y-10 scale-95 opacity-0' : 'translate-y-0 scale-100 opacity-100',
        )}
        style={{ bottom: getMobileBottomPosition() }}
      >
        {renderEditorToolbar()}
      </div>,
      document.body,
    );
  }

  return createPortal(
    <>
      {/* Backdrop overlay when menu is open */}
      {createMenuOpen && (
        <div
          className="fixed inset-0 z-[140] bg-black/5 transition-opacity duration-200 eink-modal-backdrop"
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
      )}
      
      {/* Split Add Button - bottom right corner */}
      <div
        className={cn(
          "fixed bottom-6 z-[150] transition-all duration-300 ease-in-out",
          !isSplitViewActive && "right-6"
        )}
        style={isSplitViewActive ? { right: `${fabShiftWidth + 24}px` } : undefined}
        role="navigation"
        aria-label="Quick add"
      >
        <div className="relative">
          <CreateMenu 
            isOpen={createMenuOpen} 
            items={createMenuItems} 
            position="right"
          />
          <SplitAddButton
            onPrimaryClick={handleContextAwareQuickAdd}
            onSecondaryClick={handleToggleCreateMenu}
            isMenuOpen={createMenuOpen}
            size="md"
          />
        </div>
      </div>
      
      {/* Move to parent picker (shown after creating a page) */}
      {newlyCreatedPage && (
        <MoveToParentPicker
          isOpen={moveSheetOpen}
          onClose={() => {
            setMoveSheetOpen(false);
            setNewlyCreatedPage(null);
          }}
          pageId={newlyCreatedPage.id}
          pageTitle={newlyCreatedPage.title}
        />
      )}
      
      {/* Move to parent picker - triggered from header */}
      {pageMoveTarget && (
        <MoveToParentPicker
          isOpen={!!pageMoveTarget}
          onClose={closePageMovePicker}
          pageId={pageMoveTarget.pageId}
          pageTitle={pageMoveTarget.pageTitle}
        />
      )}
    </>,
    document.body
  );
};

export default FloatingActionBar;
