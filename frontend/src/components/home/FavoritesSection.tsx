/**
 * @file FavoritesSection.tsx
 * @description Pinned/favorite pages displayed as icon tiles with context menu
 * @app SHARED - Used on HomeView for quick access to pinned pages
 * 
 * Features:
 * - Grid of 72×72 icon tiles with glassmorphic hover effect
 * - Page type indicator badge in corner
 * - Quick-add FAB button on hover (create subpage or task)
 * - Full right-click context menu via usePageContextMenu
 * - Click to navigate
 * - Staggered entrance animation
 * 
 * Used by:
 * - HomeView
 */
import React from 'react';
import { Star, Plus } from 'lucide-react';
import ItemIcon from '../common/ItemIcon';
import { CheckIcon } from '../common/Icons';
import { ContextMenu } from '@/components/ui';
import { usePageContextMenu } from '@/hooks/usePageContextMenu';
import type { Page } from '@/types/page';

interface FavoritesSectionProps {
  /** Array of pinned/favorite pages */
  pages: Page[];
  /** Handler when a page is clicked */
  onPageClick: (pageId: string) => void;
  /** Handler to create a child page */
  onCreateChild?: (parentId: string) => void;
  /** Handler to create a task in a task collection */
  onCreateTask?: (parentPageId: string) => void;
}

/** Map viewMode to ItemIcon type */
const getIconType = (page: Page) => {
  if (page.isDailyNote) return 'daily' as const;
  if (page.viewMode === 'tasks') return 'tasks' as const;
  if (page.viewMode === 'collection') return 'collection' as const;
  return 'note' as const;
};

/** Single favorite tile with context menu */
const FavoriteTile: React.FC<{
  page: Page;
  index: number;
  onPageClick: (pageId: string) => void;
  onCreateChild?: (parentId: string) => void;
  onCreateTask?: (parentPageId: string) => void;
}> = ({ page, index, onPageClick, onCreateChild, onCreateTask }) => {
  const { menuItems } = usePageContextMenu({
    page,
    onCreateChild,
    onCreateTask,
    childCount: page.childCount || 0,
  });

  return (
    <ContextMenu items={menuItems}>
      <div
        className="relative group"
        style={{ animationDelay: `${index * 30}ms`, animationFillMode: 'both' }}
      >
        <button
          onClick={() => onPageClick(page.id)}
          className="
            pinned-item
            flex flex-col items-center justify-center gap-2
            w-[72px] h-[72px]
            rounded-xl text-center text-xs
            transition-all duration-200 ease-out
            relative
            text-[var(--color-text-primary)]
            active:scale-95
            animate-in fade-in slide-in-from-bottom-1
          "
        >
          {/* Page type indicator badge */}
          <div className="absolute top-1.5 left-1.5 w-4 h-4 flex items-center justify-center">
            {page.viewMode === 'tasks' ? (
              <CheckIcon className="w-2.5 h-2.5 text-[var(--color-text-secondary)]" />
            ) : page.viewMode === 'collection' ? (
              <svg className="w-2.5 h-2.5 text-[var(--color-text-secondary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 8C4 6.89543 4.89543 6 6 6H9L10.5 8H18C19.1046 8 20 8.89543 20 10V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V8Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg className="w-2.5 h-2.5 text-[var(--color-text-secondary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 3H6C5.44772 3 5 3.44772 5 4V20C5 20.5523 5.44772 21 6 21H18C18.5523 21 19 20.5523 19 20V8L14 3ZM14 3V7C14 7.55228 14.4477 8 15 8H19M8 12H16M8 16H13" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>

          <ItemIcon
            type={getIconType(page)}
            icon={page.icon}
            color={page.color}
            size="lg"
          />
          <span className="truncate font-medium w-full px-1 leading-tight">
            {page.title || 'Untitled'}
          </span>
        </button>

        {/* Quick create overlay - FAB-style button on hover */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (page.viewMode === 'tasks') {
                onCreateTask?.(page.id);
              } else {
                onCreateChild?.(page.id);
              }
            }}
            className="absolute -top-2 -right-2 
                       w-6 h-6 rounded-full
                       flex items-center justify-center
                       bg-[var(--color-accent-primary)]
                       hover:bg-[var(--color-accent-hover)]
                       text-white
                       opacity-0 group-hover:opacity-100 
                       scale-75 group-hover:scale-100
                       transition-all duration-200 ease-out
                       shadow-lg shadow-[var(--color-accent-primary)]/30
                       hover:shadow-xl hover:shadow-[var(--color-accent-primary)]/40
                       hover:ring-2 hover:ring-[var(--color-accent-primary)]/50
                       focus-visible:opacity-100
                       active:scale-90
                       z-10"
            title={page.viewMode === 'tasks' ? 'Create task' : 'Create subpage'}
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
      </div>
    </ContextMenu>
  );
};

const FavoritesSection: React.FC<FavoritesSectionProps> = ({
  pages,
  onPageClick,
  onCreateChild,
  onCreateTask,
}) => {
  if (pages.length === 0) return null;

  return (
    <div className="mb-8 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <Star className="w-5 h-5 text-[var(--color-accent-primary)]" />
          Favorites
        </h2>
      </div>

      {/* Icon tiles grid */}
      <div className="mt-4 flex flex-wrap gap-2.5">
        {pages.map((page, index) => (
          <FavoriteTile
            key={page.id}
            page={page}
            index={index}
            onPageClick={onPageClick}
            onCreateChild={onCreateChild}
            onCreateTask={onCreateTask}
          />
        ))}
      </div>
    </div>
  );
};

export default FavoritesSection;
