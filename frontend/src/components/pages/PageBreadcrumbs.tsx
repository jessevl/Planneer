/**
 * @file PageBreadcrumbs.tsx
 * @description Breadcrumb navigation for hierarchical pages
 * @app PAGES - Navigation aid for nested pages
 * 
 * Displays the ancestor chain for a page allowing navigation up the hierarchy.
 * Shows: Home > ... > Parent Page > Current Page
 * 
 * Features:
 * - Optional home icon/link at start
 * - Auto-collapse with '...' when too many items
 * - Clickable items for navigation
 * - Chevron separators
 * 
 * Used in:
 * - PageDetailView action bar (via leftContent prop)
 * - PageEditorHeader for context
 */
import React from 'react';
import type { PageBreadcrumb } from '../../types/page';
import { ChevronRightIcon, HomeIcon } from '../common/Icons';
import { LucideIcon } from '@/components/ui';

interface PageBreadcrumbsProps {
  breadcrumbs: PageBreadcrumb[];
  onNavigate: (pageId: string) => void;
  onNavigateHome?: () => void;
  className?: string;
  /** Show home icon at start */
  showHomeLink?: boolean;
  /** Maximum number of items to show before collapsing */
  maxItems?: number;
}

/**
 * PageBreadcrumbs - Display navigation path for hierarchical pages
 * Shows: Home > ... > Parent Page > Current Page
 * 
 * @example
 * <PageBreadcrumbs 
 *   breadcrumbs={ancestorChain} 
 *   onNavigate={navigateToPage}
 *   onNavigateHome={goHome}
 *   showHomeLink
 *   maxItems={3}
 * />
 */
const PageBreadcrumbs: React.FC<PageBreadcrumbsProps> = ({
  breadcrumbs,
  onNavigate,
  onNavigateHome,
  className = '',
  showHomeLink = false,
  maxItems = 4,
}) => {
  if (breadcrumbs.length === 0 && !showHomeLink) return null;

  // Collapse middle items if too many
  let displayBreadcrumbs = breadcrumbs;
  let isCollapsed = false;
  
  if (breadcrumbs.length > maxItems) {
    // Keep first and last (maxItems - 1) items
    displayBreadcrumbs = [
      breadcrumbs[0],
      ...breadcrumbs.slice(-(maxItems - 2))
    ];
    isCollapsed = true;
  }

  return (
    <nav 
      className={`flex items-center gap-1 text-sm overflow-hidden ${className}`} 
      aria-label="Breadcrumb"
    >
      {/* Home link */}
      {showHomeLink && onNavigateHome && (
        <>
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-overlay)] transition-all flex-shrink-0"
            aria-label="Go to All Pages"
          >
            <HomeIcon className="w-3.5 h-3.5" />
          </button>
          {breadcrumbs.length > 0 && (
            <ChevronRightIcon className="w-3 h-3 text-[var(--color-text-disabled)] flex-shrink-0" />
          )}
        </>
      )}
      
      {displayBreadcrumbs.map((crumb, index) => {
        const isFirst = index === 0;
        const showEllipsis = isCollapsed && isFirst && displayBreadcrumbs.length > 1;
        
        return (
          <React.Fragment key={crumb.id}>
            {index > 0 && (
              <ChevronRightIcon className="w-3 h-3 text-[var(--color-text-disabled)] flex-shrink-0" />
            )}
            
            {/* All breadcrumbs are ancestors (parents) - all clickable */}
            <button
              onClick={() => onNavigate(crumb.id)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-overlay)] transition-all max-w-[150px]"
            >
              {crumb.icon && <LucideIcon name={crumb.icon} className="w-3.5 h-3.5 flex-shrink-0" />}
              <span className="truncate">{crumb.title || 'Untitled'}</span>
            </button>
            
            {/* Show ellipsis after first item if collapsed */}
            {showEllipsis && (
              <>
                <ChevronRightIcon className="w-3 h-3 text-[var(--color-text-disabled)] flex-shrink-0" />
                <span className="px-2 py-1 text-[var(--color-text-disabled)]">...</span>
              </>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default PageBreadcrumbs;
