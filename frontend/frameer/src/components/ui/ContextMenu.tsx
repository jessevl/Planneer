import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@frameer/lib/design-system';
import { ChevronRight } from 'lucide-react';
import ToggleTile from './ToggleTile';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
  divider?: boolean;
  /** When true, renders as a toggle tile showing on/off state */
  toggled?: boolean;
  /** Submenu items — renders as an expandable section */
  children?: ContextMenuItem[];
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  children: React.ReactNode;
  className?: string;
  /** Open on click instead of right-click (useful for dropdown menus) */
  trigger?: 'click' | 'contextmenu';
  /** When true, the context menu will not open */
  disabled?: boolean;
}

/**
 * ContextMenuContent - The actual list of items used in ContextMenu
 * Can be reused in other dropdowns for consistency
 */
export const ContextMenuContent: React.FC<{
  items: ContextMenuItem[];
  onItemClick?: (item: ContextMenuItem) => void;
  className?: string;
  /** Use larger touch-friendly sizing (for mobile sheets) */
  touchFriendly?: boolean;
}> = ({ items, onItemClick, className, touchFriendly = false }) => {
  const [expandedSubmenu, setExpandedSubmenu] = useState<string | null>(null);

  // Separate toggle items from regular items for 2-column layout
  const toggleItems = items.filter(i => i.toggled !== undefined);
  const regularItems = items.filter(i => i.toggled === undefined);

  const renderRegularItem = (item: ContextMenuItem, index: number, arr: ContextMenuItem[]) => {
    const hasSubmenu = item.children && item.children.length > 0;
    const isExpanded = expandedSubmenu === item.id;

    return (
      <React.Fragment key={item.id || index}>
        {item.divider && index > 0 && (
          <div className={cn("h-px bg-[var(--color-border-default)] mx-1", touchFriendly ? "my-2" : "my-1")} />
        )}
        <button
          onClick={() => {
            if (hasSubmenu) {
              setExpandedSubmenu(isExpanded ? null : item.id);
            } else {
              onItemClick?.(item);
            }
          }}
          disabled={item.disabled}
          className={cn(
            'w-full text-left flex items-center transition-colors rounded-md',
            touchFriendly ? 'px-4 py-3.5 text-base gap-4' : 'px-3 py-2 text-sm gap-3',
            item.disabled
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-hover)]',
            item.variant === 'danger'
              ? 'text-[var(--color-state-error)]'
              : 'text-[var(--color-text-primary)]'
          )}
        >
          {item.icon && (
            <span className={cn("flex-shrink-0 flex items-center justify-center", touchFriendly ? "w-5 h-5" : "w-4 h-4")}>{item.icon}</span>
          )}
          <span className="flex-1">{item.label}</span>
          {hasSubmenu && (
            <ChevronRight className={cn("w-3.5 h-3.5 text-[var(--color-text-tertiary)] transition-transform", isExpanded && "rotate-90")} />
          )}
        </button>
        {/* Submenu children */}
        {hasSubmenu && isExpanded && (
          <div className="ml-6 border-l border-[var(--color-border-default)]">
            {item.children!.map((child, ci) => (
              <button
                key={child.id || ci}
                onClick={() => onItemClick?.(child)}
                disabled={child.disabled}
                className={cn(
                  'w-full text-left flex items-center transition-colors rounded-md',
                  touchFriendly ? 'px-4 py-3 text-base gap-4' : 'px-3 py-1.5 text-sm gap-3',
                  child.disabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-[var(--color-surface-hover)]',
                  child.variant === 'danger'
                    ? 'text-[var(--color-state-error)]'
                    : 'text-[var(--color-text-primary)]'
                )}
              >
                {child.icon && (
                  <span className="flex-shrink-0 flex items-center justify-center w-4 h-4">{child.icon}</span>
                )}
                <span className="flex-1">{child.label}</span>
              </button>
            ))}
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className={cn("flex flex-col overflow-y-auto max-h-[inherit]", className)}>
      {/* Toggle tiles in 2-column grid */}
      {toggleItems.length > 0 && (
        <>
          <div className={cn("grid gap-1.5 px-2 py-1", toggleItems.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
            {toggleItems.map((item) => (
              <ToggleTile
                key={item.id}
                active={!!item.toggled}
                onClick={() => onItemClick?.(item)}
                label={item.label}
                icon={item.icon}
                disabled={item.disabled}
              />
            ))}
          </div>
          {regularItems.length > 0 && (
            <div className="h-px bg-[var(--color-border-default)] mx-1 my-1" />
          )}
        </>
      )}

      {/* Regular items */}
      {regularItems.map((item, index) => renderRegularItem(item, index, regularItems))}
    </div>
  );
};

const ContextMenu: React.FC<ContextMenuProps> = ({ items, children, className, trigger = 'contextmenu', disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen]);

  const handleOpenMenu = (e: React.MouseEvent) => {
    if (disabled) return;
    
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 200;
    const menuHeight = items.length * 40;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const padding = 8; // Minimum distance from viewport edges

    // For click trigger, position menu below the trigger element
    if (trigger === 'click' && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      
      let x = rect.left;
      let y = rect.bottom + 4;
      
      // Horizontal adjustment
      if (x + menuWidth > viewportWidth - padding) {
        x = rect.right - menuWidth;
      }
      if (x < padding) {
        x = padding;
      }
      
      // Vertical adjustment - smart positioning for long menus
      const spaceBelow = viewportHeight - rect.bottom - padding;
      const spaceAbove = rect.top - padding;
      
      if (menuHeight <= spaceBelow) {
        // Enough space below - show below trigger
        y = rect.bottom + 4;
      } else if (menuHeight <= spaceAbove) {
        // Not enough space below, but enough above - show above
        y = rect.top - menuHeight - 4;
      } else {
        // Long menu - center vertically around the trigger element as much as possible
        y = Math.max(padding, Math.min(viewportHeight - menuHeight - padding, rect.top + rect.height/2 - menuHeight/2));
      }
      
      setPosition({ x, y });
    } else {
      // For contextmenu trigger, position at cursor with smart vertical placement
      const x = e.clientX;
      const y = e.clientY;

      // Horizontal adjustment
      let adjustedX = x;
      if (x + menuWidth > viewportWidth - padding) {
        adjustedX = x - menuWidth;
      }
      if (adjustedX < padding) {
        adjustedX = padding;
      }

      // Vertical adjustment - smart positioning for long menus
      const spaceBelow = viewportHeight - y - padding;
      const spaceAbove = y - padding;
      let adjustedY = y;
      
      if (menuHeight <= spaceBelow) {
        // Enough space below - show at cursor
        adjustedY = y;
      } else if (menuHeight <= spaceAbove) {
        // Not enough space below, but enough above - show above cursor
        adjustedY = y - menuHeight;
      } else {
        // Long menu - center vertically around cursor as much as possible
        adjustedY = Math.max(padding, Math.min(viewportHeight - menuHeight - padding, y - menuHeight / 2));
      }

      setPosition({ x: adjustedX, y: adjustedY });
    }
    
    setIsOpen(!isOpen);
  };

  const handleItemClick = (item: ContextMenuItem) => {
    if (!item.disabled) {
      item.onClick();
      setIsOpen(false);
    }
  };

  return (
    <>
      <div
        ref={triggerRef}
        onContextMenu={trigger === 'contextmenu' ? handleOpenMenu : undefined}
        onClick={trigger === 'click' ? handleOpenMenu : undefined}
        className={className}
      >
        {children}
      </div>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[999] min-w-[200px] p-1 bg-[var(--color-surface-primary)] rounded-xl shadow-lg border border-[var(--color-border-default)] animate-scale-in"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            transformOrigin: 'top left',
          }}
        >
          <ContextMenuContent 
            items={items} 
            onItemClick={handleItemClick} 
          />
        </div>,
        document.body
      )}
    </>
  );
};

export default ContextMenu;
