/**
 * @file PropertyRow.tsx
 * @description Reusable property row component for modal sidebars
 * @app SHARED - Used in AddTaskForm, ItemPropertiesModal, CreateWorkspaceModal
 * 
 * A clickable row that displays a property with:
 * - Icon on the left
 * - Label text
 * - Value or "Empty" placeholder on the right
 * - Chevron indicator
 * - Active state highlighting (blue)
 */
import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@frameer/lib/design-system';

export interface PropertyRowProps {
  /** Property label text */
  label: string;
  /** Icon element (usually a Lucide icon) */
  icon: React.ReactNode;
  /** Current value to display (optional) */
  value?: React.ReactNode;
  /** Click handler */
  onClick?: () => void;
  /** Whether this row is in active/selected state */
  active?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * PropertyRow - Clickable property row for modal sidebars
 * 
 * Used in split-panel modal layouts for properties like:
 * - Due date, Priority, Project (AddTaskForm)
 * - Color, Icon, Page Type (ItemPropertiesModal)
 * - Color (CreateWorkspaceModal)
 */
const PropertyRow: React.FC<PropertyRowProps> = ({ 
  label, 
  icon, 
  value, 
  onClick, 
  active, 
  className 
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all group border",
      active 
        ? "bg-[var(--color-accent-muted)] text-[var(--color-accent-fg)] border-[var(--color-accent-emphasis)]/30" 
        : "hover:bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)] border-transparent",
      className
    )}
  >
    <div className="flex items-center gap-2.5">
      <div className={cn(
        "transition-colors", 
        active 
          ? "text-[var(--color-accent-fg)]" 
          : "text-[var(--color-text-disabled)] group-hover:text-[var(--color-text-secondary)]"
      )}>
        {icon}
      </div>
      <span className="text-sm font-medium">{label}</span>
    </div>
    <div className="flex items-center gap-1.5 max-w-[120px]">
      {value ? (
        <span className={cn(
          "text-sm font-semibold truncate", 
          active ? "text-[var(--color-accent-fg)]" : "text-[var(--color-text-primary)]"
        )}>
          {value}
        </span>
      ) : (
        <span className="text-xs font-medium opacity-40 group-hover:opacity-60 transition-opacity">
          Empty
        </span>
      )}
      <ChevronRight className="w-3.5 h-3.5 opacity-20 group-hover:opacity-40 transition-opacity" />
    </div>
  </button>
);

export default PropertyRow;
