/**
 * @file TreeSidebarItem.tsx
 * @description Unified tree item component for hierarchical sidebar navigation
 * @app SHARED - Used across all page types
 * 
 * A reusable tree item that handles:
 * - Icon display (emoji or colored default via ItemIcon)
 * - Expand/collapse chevron for items with children
 * - Drag-and-drop for reordering and reparenting
 * - Hover actions (+ for new child, ... for properties menu)
 * - Context menu support (right-click actions)
 * - Keyboard navigation support
 * - Active state styling
 * 
 * Used by:
 * - TreeSection component which renders the full tree
 * - UnifiedSidebar for page hierarchy
 * 
 * The component is intentionally generic to support all page types
 * through the TreeItemConfig interface in TreeSection.
 */
"use client";
import React, { useCallback, memo } from 'react';
import { ChevronRightIcon, PlusIcon, SidebarCollectionIcon } from '../common/Icons';
import ItemIcon from '../common/ItemIcon';
import PageTypeDropdown from '../common/PageTypeDropdown';
import { ContextMenu, type ContextMenuItem } from '../ui';
import { cn } from '@/lib/design-system';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import { useSettingsStore } from '@/stores/settingsStore';

// 'task page' is legacy, use 'tasks' for task collection pages
export type TreeItemType = 'note' | 'tasks' | 'collection';

export interface TreeSidebarItemProps {
  /** Unique identifier */
  id: string;
  /** Parent item ID */
  parentId: string | null;
  /** Display title */
  title: string;
  /** Emoji icon (optional) */
  icon: string | null;
  /** Item color (used for default icon) */
  color: string | null;
  /** Item type determines default icon */
  itemType: TreeItemType;
  /** View mode for special indicators (collection/tasks) */
  viewMode?: string;
  /** Whether this item has children */
  hasChildren: boolean;
  /** Nesting level (0 = root) */
  level: number;
  /** Currently selected */
  isActive: boolean;
  /** Children are visible in tree */
  isExpanded: boolean;
  
  // Callbacks
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  /** Create child page - parentId is the current item's id, viewMode specifies page type */
  onCreateChild?: (parentId: string, viewMode?: import('@/types/page').PageViewMode) => void;
  /** Create task with this item as parent */
  onCreateTask?: (parentId: string) => void;
  
  // Drag-drop handlers
  onDragStart?: (id: string, parentId: string | null) => void;
  onDragEnd?: () => void;
  onDragOver?: (id: string, parentId: string | null, position: 'before' | 'inside' | 'after', event?: React.DragEvent) => void;
  onDrop?: (id: string, parentId: string | null, position: 'before' | 'inside' | 'after') => void;
  /** External drag handlers (for tree item reparenting from other sources) */
  onExternalDragOver?: (id: string, parentId: string | null, position: 'before' | 'inside' | 'after', e: React.DragEvent) => void;
  onExternalDrop?: (targetId: string, position: 'before' | 'inside' | 'after', e: React.DragEvent) => void;
  /** Task drag handlers (for dropping tasks onto task pages) */
  onTaskDragOver?: (e: React.DragEvent) => void;
  onTaskDrop?: (e: React.DragEvent) => void;
  
  // Drag-drop state (from parent)
  isDragging?: boolean;
  dropPosition?: 'before' | 'inside' | 'after' | null;
  /** Whether this item is being targeted by a task drag */
  isTaskDragTarget?: boolean;
  
  // Optional count badge (e.g., task count)
  count?: number;
  // Optional overdue count (shown as red badge)
  overdueCount?: number;
  
  // Keyboard navigation
  isFocused?: boolean;
  onKeyDown?: (e: React.KeyboardEvent, itemId: string) => void;
  
  // Context menu support
  contextMenuItems?: ContextMenuItem[];
}

/**
 * TreeSidebarItem - Unified tree item component for all page types
 * 
 * Features:
 * - Emoji icon or colored default icon
 * - Expand/collapse for items with children
 * - Drag-and-drop reordering and reparenting
 * - Hover actions (+ button, ... menu)
 * - Keyboard navigation support
 */
const TreeSidebarItem: React.FC<TreeSidebarItemProps> = React.memo(({
  id,
  parentId,
  title,
  icon,
  color,
  itemType,
  viewMode,
  hasChildren,
  level,
  isActive,
  isExpanded,
  onSelect,
  onToggleExpand,
  onCreateChild,
  onCreateTask,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onExternalDragOver,
  onExternalDrop,
  onTaskDragOver,
  onTaskDrop,
  isDragging = false,
  dropPosition = null,
  isTaskDragTarget = false,
  count,
  overdueCount,
  isFocused = false,
  onKeyDown,
  contextMenuItems,
}) => {
  const [isCurrentlyDragging, setIsCurrentlyDragging] = React.useState(false);
  const dragTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const itemRef = React.useRef<HTMLLIElement>(null);
  
  // Mobile detection for larger touch targets
  const isMobile = useIsMobile();
  const isEink = useSettingsStore((s) => s.einkMode);

  const handleSelect = useCallback((e: React.MouseEvent) => {
    // Prevent selection if we're dragging
    if (isCurrentlyDragging) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    onSelect(id);
  }, [onSelect, id, isCurrentlyDragging]);

  const handleCreateChild = useCallback((viewMode?: import('@/types/page').PageViewMode) => {
    onCreateChild?.(id, viewMode);
  }, [onCreateChild, id]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    // If context menu items are provided, ContextMenu component handles this
    if (contextMenuItems && contextMenuItems.length > 0) {
      return; // Let ContextMenu handle it
    }
  }, [contextMenuItems]);

  const handleToggleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      onToggleExpand(id);
    }
  }, [onToggleExpand, id, hasChildren]);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.stopPropagation();
    window.getSelection()?.removeAllRanges();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.setData('application/x-tree-item-type', itemType);
    
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
    }
    
    setIsCurrentlyDragging(true);
    onDragStart?.(id, parentId);
  }, [onDragStart, id, parentId, itemType]);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    e.stopPropagation();
    
    dragTimeoutRef.current = setTimeout(() => {
      setIsCurrentlyDragging(false);
    }, 300);
    
    onDragEnd?.();
  }, [onDragEnd]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    
    if (!itemRef.current) return;
    
    // Check drag type first
    const isTaskDrag = e.dataTransfer.types.includes('application/x-task-id');
    
    if (isTaskDrag) {
      // Task drag - use simple task handler (no position needed)
      onTaskDragOver?.(e);
      return;
    }
    
    // Tree item drag - calculate position
    const rect = itemRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    
    let position: 'before' | 'inside' | 'after';
    if (y < height * 0.25) {
      position = 'before';
    } else if (y > height * 0.75) {
      position = 'after';
    } else {
      position = 'inside';
    }
    
    // Check if it's an external page drag (from collection view - uses 'pageId')
    const isExternalPageDrag = e.dataTransfer.types.includes('pageid') || e.dataTransfer.types.includes('noteid');
    
    if (isExternalPageDrag) {
      onExternalDragOver?.(id, parentId, position, e);
    } else {
      // Internal tree drag
      onDragOver?.(id, parentId, position, e);
    }
  }, [onDragOver, onExternalDragOver, onTaskDragOver, id, parentId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!itemRef.current) return;
    
    // Check drag type first
    const isTaskDrag = e.dataTransfer.types.includes('application/x-task-id');
    
    if (isTaskDrag) {
      // Task drop - use simple task handler
      onTaskDrop?.(e);
      return;
    }
    
    // Tree item drop - calculate position
    const rect = itemRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    
    let position: 'before' | 'inside' | 'after';
    if (y < height * 0.25) {
      position = 'before';
    } else if (y > height * 0.75) {
      position = 'after';
    } else {
      position = 'inside';
    }
    
    // Check if it's an external page drop (from collection view - uses 'pageId')
    const isExternalPageDrag = e.dataTransfer.types.includes('pageid') || e.dataTransfer.types.includes('noteid');
    
    if (isExternalPageDrag) {
      onExternalDrop?.(id, position, e);
    } else {
      // Internal tree drop
      onDrop?.(id, parentId, position);
    }
  }, [onDrop, onExternalDrop, onTaskDrop, id, parentId]);

  // Calculate indentation - items are indented by level, with base padding for icon alignment
  const basePadding = isMobile ? 16 : 12;
  const indentPx = basePadding + (level * 16);

  // Render expand/collapse indicator - now positioned at the far right
  const renderExpandButton = () => {
    if (!hasChildren) return null;
    
    const iconColorClass = isActive 
      ? 'text-[var(--color-text-primary)]' 
      : 'text-[var(--color-text-tertiary)]';

    return (
      <button
        onClick={handleToggleExpand}
        className="w-5 h-5 flex items-center justify-center hover:bg-[var(--color-surface-inset)] rounded transition-colors flex-shrink-0 ml-auto"
        aria-label={isExpanded ? 'Collapse' : 'Expand'}
      >
        <ChevronRightIcon
          className={cn(
            'w-3.5 h-3.5 transition-transform',
            iconColorClass,
            isExpanded && 'rotate-90'
          )}
        />
      </button>
    );
  };

  // Render icon (emoji or default)
  const renderIcon = () => (
    <ItemIcon
      type={itemType}
      {...(icon ? { icon } : {})}
      color={color}
      size="sm"
      className="flex-shrink-0"
    />
  );

  // Prevent text selection during drag
  const handleSelectStart = useCallback((e: Event) => {
    if (isCurrentlyDragging) {
      e.preventDefault();
    }
  }, [isCurrentlyDragging]);

  React.useEffect(() => {
    document.addEventListener('selectstart', handleSelectStart);
    return () => document.removeEventListener('selectstart', handleSelectStart);
  }, [handleSelectStart]);

  const isDropInside = dropPosition === 'inside';
  const isDropBefore = dropPosition === 'before';
  const isDropAfter = dropPosition === 'after';
  const stateClass = isEink
    ? cn(
        'eink-expanded-sidebar-item border border-transparent bg-transparent shadow-none',
        isActive
          ? 'eink-expanded-sidebar-item-active text-[var(--color-text-primary)]'
          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
      )
    : cn(
        !isTaskDragTarget && !isDropInside && isActive && 'glass-item text-[var(--color-text-primary)]',
        !isTaskDragTarget && !isDropInside && !isActive && 'glass-item-subtle text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
      );

  // Keyboard handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (onKeyDown) {
      onKeyDown(e, id);
    }
    
    if (e.key === 'Enter') {
      e.preventDefault();
      onSelect(id);
    }
    
    if (e.key === 'ArrowRight' && hasChildren && !isExpanded) {
      e.preventDefault();
      onToggleExpand(id);
    }
    
    if (e.key === 'ArrowLeft' && hasChildren && isExpanded) {
      e.preventDefault();
      onToggleExpand(id);
    }
  }, [onKeyDown, id, onSelect, onToggleExpand, hasChildren, isExpanded]);

  const itemContent = (
    <li
      ref={itemRef}
      draggable={true}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        'relative',
        isDragging && 'opacity-50'
      )}
      style={{ 
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      
      {/* Drop before indicator */}
      {isDropBefore && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--color-interactive-bg-strong)] z-10" />
      )}
      
      <div 
        onClick={handleSelect}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
        tabIndex={isFocused ? 0 : -1}
        role="treeitem"
        aria-selected={isActive}
        aria-expanded={hasChildren ? isExpanded : undefined}
        data-item-id={id}
        onMouseDown={(e) => {
          if (isCurrentlyDragging) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        style={{ paddingLeft: `${indentPx}px` }}
        className={cn(
          // Base styles - larger padding on mobile for touch targets
          'group flex items-center gap-1.5 rounded-lg font-medium transition-all cursor-pointer outline-none',
          isMobile ? 'pr-4 py-2.5 text-base gap-2' : 'pr-1.5 py-1.5 text-sm',
          
          // Focus ring
          'focus-visible:ring-2 focus-visible:ring-[var(--color-interactive-ring)] focus-visible:ring-offset-1',
          
          // Task drag target (interactive highlight - for task drops)
          isTaskDragTarget && 'glass-item ring-2 ring-[var(--color-interactive-ring)]',
          
          // Drop inside target (green - for tree item reparenting)
          !isTaskDragTarget && isDropInside && 'bg-green-100 dark:bg-green-900/30 ring-2 ring-green-500 border border-green-200 dark:border-green-600',
          stateClass
        )}
      >
        {/* Icon */}
        {renderIcon()}
        
        {/* Title */}
        <span className="flex-1 text-left truncate">
          {title || 'Untitled'}
        </span>
        
        {/* Count badge */}
        {count !== undefined && count > 0 && (
          <span className="text-xs text-[var(--color-text-secondary)] flex-shrink-0">
            {count}
          </span>
        )}
        
        {/* Overdue count badge */}
        {overdueCount !== undefined && overdueCount > 0 && (
          <span className="text-xs text-red-600 dark:text-red-400 flex-shrink-0 font-medium">
            {overdueCount}
          </span>
        )}
        
        {/* Hover actions - uses focus-within to stay visible when dropdown is open */}
        <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex items-center gap-0.5 flex-shrink-0 transition-opacity">
          {/* Add child button - shows page type dropdown */}
          {onCreateChild && (
            <PageTypeDropdown
              onSelect={(viewMode) => handleCreateChild(viewMode)}
              onCreateTask={viewMode === 'tasks' && onCreateTask ? () => onCreateTask(id) : undefined}
              title={itemType !== 'tasks' ? 'Add child page' : 'Add child'}
              size="sm"
              align="right"
              triggerClassName="flex items-center justify-center w-5 h-5 rounded hover:bg-[var(--color-surface-inset)] transition-all"
            />
          )}
        </div>
        
        {/* Expand/collapse button - far right */}
        {renderExpandButton()}
      </div>
      
      {/* Drop after indicator */}
      {isDropAfter && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-interactive-bg-strong)] z-10" />
      )}
    </li>
  );

  // Wrap with ContextMenu if items are provided
  return contextMenuItems && contextMenuItems.length > 0 ? (
    <ContextMenu items={contextMenuItems}>
      {itemContent}
    </ContextMenu>
  ) : (
    itemContent
  );
}, (prev, next) => {
  // Custom comparison to ensure memoization works even if callbacks or context menu arrays are recreated
  // but functionally identical.
  
  // 1. Compare all primitive/stable props
  if (prev.id !== next.id) return false;
  if (prev.parentId !== next.parentId) return false;
  if (prev.title !== next.title) return false;
  if (prev.icon !== next.icon) return false;
  if (prev.color !== next.color) return false;
  if (prev.itemType !== next.itemType) return false;
  if (prev.viewMode !== next.viewMode) return false;
  if (prev.hasChildren !== next.hasChildren) return false;
  if (prev.level !== next.level) return false;
  if (prev.isActive !== next.isActive) return false;
  if (prev.isExpanded !== next.isExpanded) return false;
  if (prev.isDragging !== next.isDragging) return false;
  if (prev.dropPosition !== next.dropPosition) return false;
  if (prev.isTaskDragTarget !== next.isTaskDragTarget) return false;
  if (prev.count !== next.count) return false;
  if (prev.overdueCount !== next.overdueCount) return false;
  if (prev.isFocused !== next.isFocused) return false;

  // 2. Compare context menu items (shallow check of labels/ids)
  // This is the most common cause of unnecessary re-renders in the tree
  if (prev.contextMenuItems?.length !== next.contextMenuItems?.length) return false;
  if (prev.contextMenuItems && next.contextMenuItems) {
    for (let i = 0; i < prev.contextMenuItems.length; i++) {
      if (prev.contextMenuItems[i].id !== next.contextMenuItems[i].id) return false;
      if (prev.contextMenuItems[i].label !== next.contextMenuItems[i].label) return false;
      if (prev.contextMenuItems[i].variant !== next.contextMenuItems[i].variant) return false;
      if (prev.contextMenuItems[i].toggled !== next.contextMenuItems[i].toggled) return false;
    }
  } else if (prev.contextMenuItems || next.contextMenuItems) {
    return false;
  }

  // 3. Callbacks are assumed stable if they come from stores or useCallbacks
  // We don't compare them to avoid breaking memoization when parent re-renders
  
  return true;
});

TreeSidebarItem.displayName = 'TreeSidebarItem';

export default TreeSidebarItem;
