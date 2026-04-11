'use client';

import React from 'react';
import { cn } from '@/lib/design-system';
import { LucideIcon } from '@/components/ui';
import { StylizedTaskIcon } from '@/components/common/StylizedIcons';

export interface PageBadgeProps {
  pageTitle: string;
  pageColor?: string;
  pageIcon?: string | null;
  sectionName?: string;
  className?: string;
  compact?: boolean;
}

/**
 * PageBadge - Display task page and optional section
 * 
 * @example
 * <PageBadge 
 *   pageTitle="Work" 
 *   pageColor="#3b82f6"
 *   pageIcon="Briefcase"
 *   sectionName="In Progress"
 * />
 */
const PageBadge: React.FC<PageBadgeProps> = ({
  pageTitle,
  pageColor,
  pageIcon,
  sectionName,
  className,
  compact = false,
}) => {
  return (
    <div className={cn('inline-flex min-w-0 max-w-full items-center gap-1 text-xs font-medium', className)}>
      {/* Page icon (Lucide) or fallback task icon */}
      {pageIcon ? (
        <LucideIcon 
          name={pageIcon} 
          className="h-3 w-3 flex-shrink-0" 
          style={pageColor ? { color: pageColor } : undefined}
        />
      ) : (
        <StylizedTaskIcon color={pageColor} size="sm" />
      )}
      
      {/* Page name */}
      <span className="truncate text-[var(--color-text-secondary)]" style={pageColor ? { color: pageColor } : undefined}>
        {pageTitle}
      </span>

      {/* Section name */}
      {sectionName && !compact && (
        <>
          <span className="text-[var(--color-text-tertiary)]">/</span>
          <span className="text-[var(--color-text-tertiary)]">{sectionName}</span>
        </>
      )}
    </div>
  );
};

export default PageBadge;
