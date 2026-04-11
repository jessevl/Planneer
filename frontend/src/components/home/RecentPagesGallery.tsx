/**
 * @file RecentPagesGallery.tsx
 * @description Horizontal scrolling gallery of recently edited pages
 * @app SHARED - Used on HomeView as the primary content
 * 
 * Features:
 * - Horizontal scrolling gallery with PageCard components
 * - Responsive grid on mobile (2 columns), horizontal scroll on desktop
 * - Smooth scroll with scroll buttons on desktop
 * - Animated entrance for cards
 * - Empty state with call to action
 * 
 * Used by:
 * - HomeView
 */
import React from 'react';
import { FileText, Plus, ArrowRight } from 'lucide-react';
import PageCard from '../pages/PageCard';
import { Button, Panel, HorizontalScrollContainer } from '@/components/ui';
import { cn } from '@/lib/design-system';
import type { Page } from '@/types/page';

interface RecentPagesGalleryProps {
  /** Array of recent pages to display */
  pages: Page[];
  /** Handler when a page is clicked */
  onPageClick: (pageId: string) => void;
  /** Handler to create a new page */
  onCreatePage?: () => void;
  /** Handler to view all pages */
  onViewAll?: () => void;
  /** Title for the section */
  title?: string;
  /** Icon for the section header */
  icon?: React.ReactNode;
  /** Empty state message */
  emptyTitle?: string;
  emptyDescription?: string;
}

const RecentPagesGallery: React.FC<RecentPagesGalleryProps> = ({
  pages,
  onPageClick,
  onCreatePage,
  onViewAll,
  title = 'Recent',
  icon = <FileText className="w-5 h-5 text-[var(--color-interactive-text-strong)]" />,
  emptyTitle = 'No recent pages',
  emptyDescription = 'Start creating to see your recent work here',
}) => {
  // Empty state
  if (pages.length === 0) {
    return (
      <div className="mb-10">
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            {icon}
            {title}
          </h2>
        </div>
        <Panel padding="lg" className="border-[var(--color-border-default)]">
          <div className="py-8 text-center">
            <div className="w-16 h-16 bg-[var(--color-interactive-bg)] rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-[var(--color-interactive-text-strong)]" />
            </div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              {emptyTitle}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1 max-w-[240px] mx-auto">
              {emptyDescription}
            </p>
            {onCreatePage && (
              <Button variant="primary" size="sm" className="mt-4" onClick={onCreatePage}>
                <Plus className="w-4 h-4 mr-1" />
                Create Page
              </Button>
            )}
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="mb-10">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          {icon}
          {title}
        </h2>
        <div className="flex items-center gap-2">
          {onCreatePage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCreatePage}
              className="text-[var(--color-accent-primary)] hover:bg-[var(--color-surface-primary)]"
              title="Create page"
            >
              <Plus className="w-4 h-4" />
            </Button>
          )}
          {onViewAll && (
            <Button variant="ghost" size="sm" onClick={onViewAll} className="text-[var(--color-accent-primary)] hover:bg-[var(--color-surface-primary)]">
              View all
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>

      {/* Gallery Container */}
      <HorizontalScrollContainer
        gap="gap-4"
        innerPadding="pt-2 pb-2"
        arrowSize="md"
      >
        {pages.map((page, index) => (
          <div 
            key={page.id}
            className={cn(
              "flex-shrink-0 w-[220px] sm:w-[260px]",
              "animate-in fade-in slide-in-from-bottom-2"
            )}
            style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
          >
            <PageCard
              page={page}
              onClick={() => onPageClick(page.id)}
              enableSelection={false}
              draggable={false}
            />
          </div>
        ))}
      </HorizontalScrollContainer>
    </div>
  );
};

export default RecentPagesGallery;
