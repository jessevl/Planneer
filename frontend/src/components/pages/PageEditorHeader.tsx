/**
 * @file PageEditorHeader.tsx
 * @description Header component for the page editor with title and actions
 * @app PAGES - Part of page editing experience
 * 
 * The header area of the page editor containing:
 * - Editable title (click to edit, Enter/blur to save)
 * - Page icon (emoji or colored default, click to edit via modal)
 * - PageActionBar with save status, view mode toggle, delete
 * - Document metadata (created date, doc size)
 * 
 * Used by:
 * - PageEditor component
 * - Embedded in PageDetailView and HomeView (daily journal)
 */
import React, { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import PageActionBar from './PageActionBar';
import ItemIcon from '../common/ItemIcon';

dayjs.extend(relativeTime);

interface PageEditorHeaderProps {
  pageId: string | null;
  title: string;
  hasChanges: boolean;
  isEditingTitle: boolean;
  created?: string;
  updated?: string;
  docSize: string;
  onTitleChange: (title: string) => void;
  onTitleEditStart: () => void;
  onTitleEditEnd: () => void;
  onTitleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onCancel: () => void;
  onSave: () => void;
  onDeleteClick?: () => void;
  onMarkHasChanges: () => void;
  hideActions?: boolean;
  hideBorder?: boolean;
  // Icon/color props
  icon?: string | null;
  color?: string | null;
  /** If provided, clicking the icon calls this to open a modal */
  onIconClick?: () => void;
  /** Page view mode to determine default icon type */
  viewMode?: string;
}

const PageEditorHeader: React.FC<PageEditorHeaderProps> = ({
  pageId,
  title,
  hasChanges,
  isEditingTitle,
  created,
  updated,
  docSize,
  onTitleChange,
  onTitleEditStart,
  onTitleEditEnd,
  onTitleKeyDown,
  onCancel,
  onSave,
  onDeleteClick,
  onMarkHasChanges,
  hideActions = false,
  hideBorder = false,
  icon = null,
  color = null,
  onIconClick,
  viewMode,
}) => {
  const metadata = useMemo(() => {
    const items: string[] = [];
    if (updated) {
      items.push(`Modified ${dayjs(updated).fromNow()}`);
    }
    if (created) {
      items.push(`Created ${dayjs(created).format('MMM D, YYYY')}`);
    }
    items.push(docSize);
    return items.join(' · ');
  }, [updated, created, docSize]);

  return (
    <div className="mb-4">
      <div className={hideBorder ? '' : 'pb-4 border-b border-[var(--color-border-default)]'}>
        {!hideActions && (
          <div className="mb-4">
            <PageActionBar
            pageId={pageId}
            hasChanges={hasChanges}
            updated={updated}
            onDelete={onDeleteClick}
          />
        </div>
      )}
        
        <div className="flex items-start gap-3">
          {/* Icon - clickable if onIconClick provided */}
          {onIconClick && (
            <ItemIcon
              type={viewMode === 'tasks' ? 'tasks' : viewMode === 'collection' ? 'collection' : 'note'}
              {...(icon ? { icon } : {})}
              color={color}
              size="lg"
              onClick={onIconClick}
              className="p-1"
            />
          )}

          {/* Title */}
          <div className="flex-1">
            {isEditingTitle ? (
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  onTitleChange(e.target.value);
                  onMarkHasChanges();
                }}
                onKeyDown={onTitleKeyDown}
                onBlur={onTitleEditEnd}
                onFocus={(e) => {
                  // Only select all for new/untitled pages
                  if (!title || title === 'Untitled Note' || title === 'Untitled') {
                    e.target.select();
                  }
                }}
                autoFocus
                placeholder="Page title"
                className="w-full text-2xl font-bold bg-transparent border-none outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] tracking-tight"
              />
            ) : (
              <h2
                onClick={onTitleEditStart}
                className="group cursor-text hover:text-[var(--color-text-secondary)] transition-colors text-2xl font-bold text-[var(--color-text-primary)] tracking-tight flex items-center gap-2"
              >
                <span>{title || 'Untitled'}</span>
                <svg 
                  className="w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </h2>
            )}
            
            {pageId && (
              <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">{metadata}</div>
            )}  
          </div>
        </div>
      </div>
    </div>
  );
};

export default PageEditorHeader;