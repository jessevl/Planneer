/**
 * @file PageActionBar.tsx
 * @description Action bar component for page editing pages
 * @app PAGES - Used by page editor views
 * 
 * A horizontal bar displayed above the page editor with:
 * - Sidebar toggle button (left side, when sidebar hidden)
 * - Custom left content slot (e.g., breadcrumbs)
 * - Save status indicator ('Saved X ago' or 'Unsaved changes')
 * - View mode toggle (Page/Collection) for page-level pages
 * - Add child page button
 * - Delete button
 * 
 * Used by:
 * - PageDetailView: Shows full controls for regular pages
 * - HomeView: Shows simplified controls for daily journal (no view mode toggle)
 * - PageEditorHeader: Embedded in the page editor header area
 */
'use client';

import React, { useMemo } from 'react';
import { IconButton, FlexGroup, TextSmall } from '@/components/ui';
import { TrashIcon, PlusIcon, SidebarIcon } from '../common/Icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { PageViewMode } from '../../types/page';

dayjs.extend(relativeTime);

// View mode icons - layout toggle between writing and browsing
const WriteModeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className || "w-4 h-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
  </svg>
);

const BrowseModeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className || "w-4 h-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

interface PageActionBarProps {
  pageId?: string | null;
  updated?: string;
  onDelete?: () => void;
  /** Whether there are unsaved changes (shows 'Unsaved changes' instead of 'Saved X ago') */
  hasChanges?: boolean;
  // Optional props for page view features (hidden for daily pages)
  showPageControls?: boolean;
  viewMode?: PageViewMode;
  onViewModeChange?: (mode: PageViewMode) => void;
  onCreateChild?: () => void;
  // Sidebar toggle
  sidebarVisible?: boolean;
  onShowSidebar?: () => void;
  /** Custom content for left side (e.g., breadcrumbs) */
  leftContent?: React.ReactNode;
}

/**
 * Unified action bar for page pages.
 * Shows: Sidebar toggle, custom left content (breadcrumbs), saved status, page controls, delete.
 * Used by PageDetailView, HomeView (daily journal), and PageEditorHeader.
 */
const PageActionBar: React.FC<PageActionBarProps> = ({
  pageId,
  updated,
  onDelete,
  hasChanges = false,
  showPageControls = false,
  viewMode,
  onViewModeChange,
  onCreateChild,
  sidebarVisible = true,
  onShowSidebar,
  leftContent,
}) => {
  const saveStatus = useMemo(() => {
    if (hasChanges) {
      return <TextSmall className="text-amber-600 dark:text-amber-400">Unsaved changes</TextSmall>;
    }
    if (updated) {
      return <TextSmall className="text-[var(--color-text-secondary)]">Saved {dayjs(updated).fromNow()}</TextSmall>;
    }
    return null;
  }, [hasChanges, updated]);

  const isCollectionMode = viewMode === 'collection';

  return (
    <FlexGroup justify="between" className="gap-4">
      {/* Left side: sidebar toggle + custom content (breadcrumbs) */}
      <FlexGroup gap="sm" align="center" className="min-w-0 flex-1">
        {!sidebarVisible && onShowSidebar && (
          <IconButton
            onClick={onShowSidebar}
            variant="ghost"
            size="sm"
            aria-label="Show sidebar"
          >
            <SidebarIcon className="w-5 h-5" />
          </IconButton>
        )}
        {leftContent}
      </FlexGroup>
      
      {/* Right side: status + actions */}
      <FlexGroup gap="sm" align="center">
        {saveStatus}
        
        {/* Layout toggle - switch between note and collection layout (hidden for daily pages and tasks pages) */}
        {showPageControls && onViewModeChange && (
          <div className="flex bg-[var(--color-surface-overlay)] rounded-lg p-0.5">
            <button
              onClick={() => onViewModeChange('note')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium transition-all ${
                !isCollectionMode
                  ? 'bg-[var(--color-surface-base)] shadow-sm text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
              }`}
              title="Note layout — focus on content editing"
            >
              <WriteModeIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs">Note</span>
            </button>
            <button
              onClick={() => onViewModeChange('collection')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium transition-all ${
                isCollectionMode
                  ? 'bg-[var(--color-surface-base)] shadow-sm text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
              }`}
              title="Collection layout — focus on sub-pages"
            >
              <BrowseModeIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs">Collection</span>
            </button>
          </div>
        )}

        {/* Add sub-page - hidden for daily pages */}
        {showPageControls && onCreateChild && (
          <IconButton
            onClick={onCreateChild}
            variant="ghost"
            size="sm"
            aria-label="Add sub-page"
            title="Add sub-page"
          >
            <PlusIcon className="w-4 h-4" />
          </IconButton>
        )}
        
        {pageId && onDelete && (
          <IconButton
            onClick={onDelete}
            variant="ghost"
            size="sm"
            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]"
            aria-label="Delete page"
          >
            <TrashIcon className="w-4 h-4" />
          </IconButton>
        )}
      </FlexGroup>
    </FlexGroup>
  );
};

export default PageActionBar;
