/**
 * @file PageActionsMenu.tsx
 * @description Unified dropdown menu for page actions and inline property editing
 *
 * Shows a "..." button that opens a dropdown with:
 * - Inline property editors (Color, Icon, Page Mode)
 * - Pin/Unpin
 * - Show/Hide subpages in sidebar
 * - Export to Markdown / CSV
 * - Delete (styled in red)
 *
 * Uses the unified usePageActions hook for action definitions
 * while adding inline property editors specific to this menu.
 *
 * Used in UnifiedHeader for both mobile and desktop.
 */
'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { MoreVertical, Sparkles, ChevronDown, ChevronRight, FolderInput, Download, Trash2 } from 'lucide-react';
import { Popover, MobileSheet, IconPicker, LucideIcon, ToggleTile } from '@/components/ui';
import { cn } from '@/lib/design-system';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import { usePagesStore } from '@/stores/pagesStore';
import { useTasksStore } from '@/stores/tasksStore';
import { usePageActions } from '@/hooks/usePageActions';
import PageModeToggle from '@/components/common/PageModeToggle';
import type { Page, PageViewMode } from '@/types/page';

// Preset colors (same as used in the former ItemPropertiesModal)
const PRESET_COLORS = [
  { color: '#ef4444', name: 'Red' },
  { color: '#f97316', name: 'Orange' },
  { color: '#eab308', name: 'Yellow' },
  { color: '#22c55e', name: 'Green' },
  { color: '#14b8a6', name: 'Teal' },
  { color: '#0ea5e9', name: 'Sky' },
  { color: '#3b82f6', name: 'Blue' },
  { color: '#6366f1', name: 'Indigo' },
  { color: '#8b5cf6', name: 'Violet' },
  { color: '#a855f7', name: 'Purple' },
  { color: '#ec4899', name: 'Pink' },
  { color: '#64748b', name: 'Slate' },
];

interface PageActionsMenuProps {
  /** The page to show actions for */
  page: Page;
  /** Called when page should be deleted */
  onDelete?: () => void;
}

/**
 * PageActionsMenu - Dropdown menu for page actions + inline property editors
 */
const PageActionsMenu: React.FC<PageActionsMenuProps> = ({
  page,
  onDelete,
}) => {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showExportSub, setShowExportSub] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePage = usePagesStore((s) => s.updatePage);

  // Subscribe to latest page data from the store so toggle tiles update visually
  const livePage = usePagesStore((s) => s.pagesById[page.id]) ?? page;

  // Compute task count from store
  const tasksById = useTasksStore((s) => s.tasksById);
  const taskCount = useMemo(() => {
    return Object.values(tasksById).filter(t => t.parentPageId === page.id).length;
  }, [page.id, tasksById]);
  const childCount = page.childCount || 0;

  // Unified actions
  const actions = usePageActions({ page, onDelete, childCount, taskCount });

  // Close on click outside (desktop only)
  useEffect(() => {
    if (!isOpen || isMobile) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowColorPicker(false);
        setShowIconPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isMobile]);

  // Reset sub-pickers when menu closes
  useEffect(() => {
    if (!isOpen) {
      setShowColorPicker(false);
      setShowIconPicker(false);
      setShowExportSub(false);
    }
  }, [isOpen]);

  const handleToggleViewMode = useCallback((mode: PageViewMode) => {
    updatePage(page.id, { viewMode: mode });
  }, [page.id, updatePage]);

  const handleSelectColor = useCallback((color: string) => {
    updatePage(page.id, { color });
    setShowColorPicker(false);
  }, [page.id, updatePage]);

  const handleSelectIcon = useCallback((icon: string | null) => {
    updatePage(page.id, { icon });
    if (icon === null) setShowIconPicker(false);
  }, [page.id, updatePage]);

  // Toggle handlers for sidebar children
  const showChildrenInSidebar = livePage.showChildrenInSidebar ?? (livePage.viewMode === 'note');
  const handleToggleSidebarChildren = useCallback(() => {
    const currentShow = livePage.showChildrenInSidebar ?? (livePage.viewMode === 'note');
    updatePage(page.id, { showChildrenInSidebar: !currentShow });
  }, [page.id, livePage.showChildrenInSidebar, livePage.viewMode, updatePage]);

  // Get individual export actions from the hook
  const exportMarkdownAction = useMemo(() => actions.exportMarkdown(), [actions]);
  const exportCSVAction = useMemo(() => actions.exportCSV(), [actions]);
  const deleteActionItem = useMemo(() => actions.delete({ divider: false }), [actions]);

  const showLayoutToggle = !page.isDailyNote;
  const isReadOnlyMirror = page.isReadOnly && Boolean(page.sourceOrigin);
  const currentViewMode = page.viewMode || 'note';
  const selectedColorName = PRESET_COLORS.find(c => c.color === page.color)?.name || 'Custom';

  // Shared row style for all interactive rows (consistent typography)
  const rowClass = (active?: boolean) => cn(
    'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors',
    active
      ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]'
      : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]'
  );

  const iconClass = 'w-4 h-4 text-[var(--color-text-tertiary)]';

  // ---- Inline property section ----
  const propertiesSection = (
    <div className={cn('px-2 pb-1', isMobile ? 'pt-1' : 'pt-2')}>
      {isReadOnlyMirror && (
        <div className="mb-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-secondary)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
          This mirrored page is read-only. Title and page mode are managed by the external source.
        </div>
      )}

      {/* Color row */}
      {!isReadOnlyMirror && (
        <button
          type="button"
          onClick={() => { setShowColorPicker(!showColorPicker); setShowIconPicker(false); }}
          className={rowClass(showColorPicker)}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-4 h-4 rounded-full border border-white/50 shadow-sm"
              style={{ backgroundColor: page.color || '#3b82f6' }}
            />
            <span>Color</span>
          </div>
          <span className="text-[var(--color-text-tertiary)] text-xs">{selectedColorName}</span>
        </button>
      )}

      {/* Color picker dropdown */}
      {!isReadOnlyMirror && showColorPicker && (
        <div className="px-1 py-2">
          <div className="grid grid-cols-6 gap-1.5">
            {PRESET_COLORS.map(({ color: c, name }) => (
              <button
                key={c}
                type="button"
                onClick={() => handleSelectColor(c)}
                className={cn(
                  'w-7 h-7 rounded-lg transition-all hover:scale-110',
                  page.color === c && 'ring-2 ring-offset-1 ring-[var(--color-text-primary)] ring-offset-[var(--color-surface-base)]'
                )}
                style={{ backgroundColor: c }}
                title={name}
              >
                {page.color === c && (
                  <svg className="w-3.5 h-3.5 m-auto text-white drop-shadow-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Icon row */}
      {!isReadOnlyMirror && (
        <button
          type="button"
          onClick={() => { setShowIconPicker(!showIconPicker); setShowColorPicker(false); }}
          className={rowClass(showIconPicker)}
        >
          <div className="flex items-center gap-2.5">
            {page.icon ? (
              <LucideIcon name={page.icon} className="w-4 h-4" style={{ color: page.color || '#6b7280' }} />
            ) : (
              <Sparkles className={iconClass} />
            )}
            <span>Icon</span>
          </div>
          <div className="flex items-center gap-1 text-[var(--color-text-tertiary)]">
            <span className="text-xs">{page.icon || 'Auto'}</span>
            <ChevronDown className={cn('w-3 h-3 transition-transform', showIconPicker && 'rotate-180')} />
          </div>
        </button>
      )}

      {/* Icon picker dropdown */}
      {!isReadOnlyMirror && showIconPicker && (
        <div className="py-1 px-0.5">
          <IconPicker
            selectedIcon={page.icon}
            onChange={(iconName) => {
              handleSelectIcon(iconName);
              if (iconName !== null) setShowIconPicker(false);
            }}
            allowClear
            previewColor={page.color || undefined}
            compact
          />
        </div>
      )}

      {/* Page mode toggle */}
      {showLayoutToggle && !isReadOnlyMirror && (
        <>
          <div className={cn('h-px bg-[var(--color-border-default)] -mx-2', isMobile ? 'my-2' : 'my-1.5')} />
          <span className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-widest px-3 block mb-1">
            Page mode
          </span>
          <div className="mb-1 px-1">
            <PageModeToggle
              currentMode={currentViewMode}
              onModeChange={handleToggleViewMode}
              childCount={childCount}
              taskCount={taskCount}
              variant="compact"
            />
          </div>
        </>
      )}

      {/* Separator before toggle tiles */}
      <div className={cn('h-px bg-[var(--color-border-default)] -mx-2', isMobile ? 'my-2' : 'my-1.5')} />

      {/* Pin & Sidebar toggles - compact square tiles */}
      <div className="grid grid-cols-1 gap-1.5 py-1 px-1">
        <ToggleTile
          active={!!showChildrenInSidebar}
          onClick={handleToggleSidebarChildren}
          label="Subpages"
          icon={<FolderInput className="w-3.5 h-3.5" />}
        />
      </div>

      <div className={cn('h-px bg-[var(--color-border-default)] -mx-2', isMobile ? 'my-1.5' : 'my-1')} />
    </div>
  );

  // ---- Action rows (consistent with rowClass) ----
  const actionsSection = (
    <div className="px-2 pb-2">
      {/* Export submenu */}
      <div>
        <button
          type="button"
          onClick={() => setShowExportSub(!showExportSub)}
          className={rowClass(showExportSub)}
        >
          <div className="flex items-center gap-2.5">
            <Download className={iconClass} />
            <span>Export</span>
          </div>
          <ChevronRight className={cn('w-3.5 h-3.5 text-[var(--color-text-tertiary)] transition-transform', showExportSub && 'rotate-90')} />
        </button>

        {showExportSub && (
          <div className="ml-6 border-l border-[var(--color-border-default)]">
            <button
              type="button"
              onClick={() => { setIsOpen(false); exportMarkdownAction.onClick(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              <span>As Markdown</span>
            </button>
            {exportCSVAction && (
              <button
                type="button"
                onClick={() => { setIsOpen(false); exportCSVAction.onClick(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
              >
                <span>As CSV</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Separator before delete */}
      <div className="h-px bg-[var(--color-border-default)] -mx-2 my-1" />

      {/* Delete */}
      {onDelete && <button
        type="button"
        onClick={() => { setIsOpen(false); deleteActionItem.onClick(); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-[var(--color-state-error,#ef4444)] hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
        <span>Delete</span>
      </button>}
    </div>
  );

  const menuContent = (
    <>
      {propertiesSection}
      {actionsSection}
    </>
  );

  // Mobile: use MobileSheet
  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center justify-center w-8 h-8 rounded-full text-[var(--color-text-secondary)] hover:bg-white/50 dark:hover:bg-white/10 transition-all"
          aria-label="Page actions"
          title="Page actions"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        <MobileSheet
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Page Actions"
        >
          {menuContent}
        </MobileSheet>
      </>
    );
  }

  // Desktop: use Popover
  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded-full transition-all',
          isOpen
            ? 'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]'
            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]'
        )}
        aria-label="Page actions"
        title="Page actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <Popover position="right" width="lg" padding="sm">
          {menuContent}
        </Popover>
      )}
    </div>
  );
};

export default PageActionsMenu;
