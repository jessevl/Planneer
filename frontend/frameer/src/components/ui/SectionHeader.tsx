import React from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { Label } from './Typography';

interface SectionHeaderProps {
  label: string;
  subtitle?: string;
  color?: string;
  className?: string;
  /** Count to display next to label */
  count?: number;
  /** Collapsible state - if provided, shows expand/collapse chevron */
  isExpanded?: boolean;
  /** Callback when header is clicked (for collapsible sections) */
  onToggle?: () => void;
  /** Callback when add button is clicked */
  onAdd?: () => void;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ 
  label, 
  subtitle, 
  color,
  className = '',
  count,
  isExpanded,
  onToggle,
  onAdd,
}) => {
  const isCollapsible = onToggle !== undefined;
  
  return (
    <div 
      className={`flex items-center gap-2 mb-3 ${isCollapsible ? 'cursor-pointer' : ''} ${className}`}
      onClick={isCollapsible ? onToggle : undefined}
    >
      {isCollapsible && (
        <button className="p-0.5 rounded hover:bg-[var(--color-surface-hover)]">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-[var(--color-text-tertiary)]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[var(--color-text-tertiary)]" />
          )}
        </button>
      )}
      {color && (
        <div
          className="w-3 h-3 rounded-full border border-[var(--color-border-emphasis)]"
          style={{ backgroundColor: color }}
        />
      )}
      <Label className="!text-xs !font-bold !uppercase !tracking-wide">
        {label}
      </Label>
      {subtitle && (
        <span className="ml-1 text-xs font-normal text-[var(--color-text-tertiary)]">
          {subtitle}
        </span>
      )}
      {count !== undefined && (
        <span className="text-xs font-medium text-[var(--color-text-tertiary)]">
          {count}
        </span>
      )}
      {onAdd && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          className="ml-auto p-1 rounded-full hover:bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors flex items-center justify-center"
          aria-label={`Add item to ${label}`}
        >
          <Plus size={14} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
};

export default SectionHeader;
