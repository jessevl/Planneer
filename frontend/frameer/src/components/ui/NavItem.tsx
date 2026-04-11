'use client';

import React from 'react';
import { cn } from '@frameer/lib/design-system';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';

export interface NavItemProps {
  icon?: React.ReactNode;
  label: string;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
  compact?: boolean;
  einkMode?: boolean;
}

/**
 * NavItem - Standardized navigation item for sidebars
 * 
 * @example
 * <NavItem 
 *   icon={<InboxIcon />} 
 *   label="Inbox" 
 *   isActive={currentView === 'inbox'}
 *   badge={<Badge>3</Badge>}
 *   onClick={() => navigateToView('inbox')}
 * />
 */
const NavItem: React.FC<NavItemProps> = ({
  icon,
  label,
  subtitle,
  badge,
  isActive = false,
  onClick,
  className,
  compact = false,
  einkMode = false,
}) => {
  const isMobile = useIsMobile();

  const stateClass = einkMode
    ? cn(
        'eink-expanded-sidebar-item border border-transparent bg-transparent shadow-none',
        isActive
          ? 'eink-expanded-sidebar-item-active text-[var(--color-text-primary)]'
          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
      )
    : cn(
        isActive && 'glass-item text-[var(--color-text-primary)]',
        !isActive && 'glass-item-subtle text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
      );
  
  return (
    <button
      onClick={onClick}
      className={cn(
        // Base styles
        'group w-full flex items-center',
        compact ? 'gap-2' : 'gap-3',
        // Larger padding on mobile for better touch targets, increased vertical padding
        isMobile ? 'px-4 py-3 text-base' : (subtitle ? 'px-3 py-2 text-sm' : 'px-3 py-1.5 text-sm'),
        'rounded-lg font-medium transition-all text-left',
        stateClass,
        
        // Custom overrides
        className
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      {/* Icon */}
      {icon && (
        <span className={cn("flex-shrink-0", subtitle ? "self-center" : undefined)}>
          {icon}
        </span>
      )}

      {/* Label + Subtitle */}
      <span className={cn("flex-1", subtitle ? "flex flex-col gap-0" : "")}>
        <span>{label}</span>
        {subtitle && (
          <span className="text-[11px] font-normal leading-tight text-[var(--color-text-tertiary)] opacity-80">
            {subtitle}
          </span>
        )}
      </span>

      {/* Badge */}
      {badge && badge}
    </button>
  );
};

export default NavItem;
