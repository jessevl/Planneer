'use client';

import React from 'react';
import { ListViewIcon, CardViewIcon, TableViewIcon } from '../common/Icons';
import type { ViewMode } from '@/types/view';

interface ViewLayoutToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  className?: string;
  /** Whether to show the table view option (default: true) */
  showTable?: boolean;
}

/**
 * Icon-only toggle for switching between list, card/kanban, and table views.
 * Styled to match ViewSwitcher button aesthetic.
 * Used in pages collection pages, recent pages, and task views.
 */
const ViewLayoutToggle: React.FC<ViewLayoutToggleProps> = ({
  viewMode,
  onViewModeChange,
  className = '',
  showTable = true,
}) => {
  return (
    <div className={`flex items-center gap-0.5 p-0.5 bg-[var(--color-surface-secondary)] rounded-lg ${className}`}>
      <button
        onClick={() => onViewModeChange('list')}
        className={`p-1.5 rounded-md transition-colors ${
          viewMode === 'list'
            ? 'text-[var(--color-text-primary)] bg-[var(--color-surface-base)] shadow-sm'
            : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
        }`}
        title="List view"
        aria-label="List view"
      >
        <ListViewIcon className="w-4 h-4" />
      </button>
      <button
        onClick={() => onViewModeChange('kanban')}
        className={`p-1.5 rounded-md transition-colors ${
          viewMode === 'kanban'
            ? 'text-[var(--color-text-primary)] bg-[var(--color-surface-base)] shadow-sm'
            : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
        }`}
        title="Card view"
        aria-label="Card view"
      >
        <CardViewIcon className="w-4 h-4" />
      </button>
      {showTable && (
        <button
          onClick={() => onViewModeChange('table')}
          className={`p-1.5 rounded-md transition-colors ${
            viewMode === 'table'
              ? 'text-[var(--color-text-primary)] bg-[var(--color-surface-base)] shadow-sm'
              : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
          }`}
          title="Table view"
          aria-label="Table view"
        >
          <TableViewIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default ViewLayoutToggle;
