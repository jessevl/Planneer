/**
 * @file TreeSection.tsx
 * @description Generic collapsible tree section for hierarchical sidebar navigation
 * @app SHARED - Used for sidebar page tree navigation
 * 
 * A reusable component that renders a labeled, collapsible section containing
 * a tree of items. Uses TreeSidebarItem for individual items.
 * 
 * Features:
 * - Collapsible section header with item count
 * - Keyboard navigation (arrow keys, enter, space)
 * - Drag-and-drop reordering and reparenting
 * - Properties modal for item editing (via ItemPropertiesModal)
 * - Context menu with multi-selection support
 * - Open in new tab support (when tabs enabled)
 * - Configurable via TreeItemConfig to work with any tree data type
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import TreeSidebarItem from '@/components/common/TreeSidebarItem';
import PageTypeDropdown from '@/components/common/PageTypeDropdown';
import { PlusIcon } from '../common/Icons';
import { Label, type ContextMenuItem } from '@/components/ui';
import { useTreeDragAndDrop, isDescendantInTree } from '../../hooks/useTreeDragAndDrop';
import { useDeleteConfirmStore } from '@/stores/deleteConfirmStore';
import { usePageOperations } from '@/hooks/usePageOperations';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTabsStore } from '@/stores/tabsStore';
import { buildPageMenuItems } from '@/hooks/usePageContextMenu';
import type { Page, PageViewMode } from '@/types/page';

// Generic tree node interface
export interface TreeNode<T> {
  item: T;
  children: TreeNode<T>[];
}

// Configuration for how to extract data from tree items
export interface TreeItemConfig<T> {
  getId: (item: T) => string;
  getParentId: (item: T) => string | null;
  getTitle: (item: T) => string;
  getIcon: (item: T) => string | null;
  getColor: (item: T) => string | null;
  getItemType: (item: T) => 'note' | 'collection' | 'tasks';
  getViewMode?: (item: T) => PageViewMode | undefined;
  getIsPinned?: (item: T) => boolean;
  getShowChildrenInSidebar?: (item: T) => boolean | undefined;
  /** Whether this item should show children in the tree (e.g., collections don't expand) */
  shouldShowChildren?: (item: T) => boolean;
  /** Whether this item might have children (for lazy-loading hint). If true, shows expand chevron even if no children loaded. */
  mayHaveChildren?: (item: T) => boolean;
  /** Get the server-side child count (more reliable than counting tree nodes) */
  getChildCount?: (item: T) => number;
}

export interface TreeSectionProps<T> {
  /** Section label (e.g., "Pages", "Collections") */
  label: string;
  /** The tree structure to render */
  tree: TreeNode<T>[];
  /** Flat list of all items (for lookups) */
  items: T[];
  /** Configuration for extracting data from items */
  config: TreeItemConfig<T>;
  /** Currently expanded item IDs */
  expandedIds: Set<string>;
  /** Currently selected item ID */
  selectedId: string | null;
  /** Currently focused item ID (for keyboard nav) */
  focusedId?: string | null;
  /** Item type for the properties modal - always 'page' now */
  itemType?: 'page';
  /** Callbacks */
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  /** Create child page - parentId is null for root, viewMode specifies page type */
  onCreateChild?: (parentId: string | null, viewMode?: import('@/types/page').PageViewMode) => void;
  /** Create task in a task collection page */
  onCreateTask?: (parentPageId: string) => void;
  onUpdate?: (id: string, updates: { 
    title?: string; 
    icon?: string | null; 
    color?: string | null; 
    parentId?: string | null; 
    viewMode?: string;
    isPinned?: boolean;
    showChildrenInSidebar?: boolean;
  }) => void;
  onCreate?: (data: { title?: string; icon?: string | null; color?: string | null; parentId?: string | null }) => void;
  /** Delete callback - cascade: true means delete all descendants, false means move children to root */
  onDelete?: (id: string, cascade?: boolean) => void;
  /** Pin/unpin callback */
  onPin?: (id: string, isPinned: boolean) => void;
  /** Get current pin state for an item */
  getIsPinned?: (id: string) => boolean;
  onReorder?: (draggedId: string, targetId: string, parentId: string | null, position: 'before' | 'after') => void;
  onReparent?: (draggedId: string, newParentId: string) => void;
  /** Optional count per item */
  counts?: Record<string, number>;
  /** Optional overdue count per item */
  overdueCounts?: Record<string, number>;
  /** Data attribute prefix for keyboard nav (e.g., "note" -> data-note-id, "item" -> data-item-id) */
  dataAttrPrefix?: string;
  /** Whether to show external drag handlers (for pages) */
  enableExternalDrag?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Whether the section starts open */
  defaultOpen?: boolean;
  /** Optional content to render before the tree items (e.g., Inbox link) */
  prefixContent?: React.ReactNode;
  /** Task drop handler - called when a task is dropped on an item */
  onTaskDrop?: (taskPageId: string, e: React.DragEvent) => void;
  /** Task drag over handler - called when a task is dragged over an item */
  onTaskDragOver?: (taskPageId: string, e: React.DragEvent) => void;
  /** ID of the task page currently being dragged over with a task */
  taskDragOverId?: string | null;
  /** Function to check if an item might have children (for lazy-loading hint). Takes precedence over config.mayHaveChildren. */
  mayHaveChildrenFn?: (id: string) => boolean;
  /** Function to check if a parent has more children to load (pagination) */
  parentHasMoreFn?: (parentId: string) => boolean;
  /** Callback to load more children for a parent */
  onLoadMoreChildren?: (parentId: string) => void;
  /** Whether there are more root-level items to load */
  hasMoreRoot?: boolean;
  /** Callback to load more root-level items */
  onLoadMoreRoot?: () => void;
  /** Hide the add button in section header (create via context menu or FAB instead) */
  hideHeaderAdd?: boolean;
}

function TreeSection<T>({
  label,
  tree,
  items,
  config,
  expandedIds,
  selectedId,
  focusedId: externalFocusedId,
  itemType = 'page',
  onSelect,
  onToggleExpand,
  onCreateChild,
  onCreateTask,
  onUpdate,
  onCreate,
  onDelete,
  onPin,
  getIsPinned,
  onReorder,
  onReparent,
  counts,
  overdueCounts,
  dataAttrPrefix = 'item',
  enableExternalDrag = false,
  emptyMessage = 'No items yet',
  defaultOpen = true,
  prefixContent,
  onTaskDrop,
  onTaskDragOver,
  taskDragOverId,
  mayHaveChildrenFn,
  parentHasMoreFn,
  onLoadMoreChildren,
  hasMoreRoot,
  onLoadMoreRoot,
  hideHeaderAdd = false,
}: TreeSectionProps<T>) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [focusedId, setFocusedId] = useState<string | null>(externalFocusedId ?? null);
  const [isRootDropZoneActive, setIsRootDropZoneActive] = useState(false);
  
  // Use centralized page operations hook for task counting and migration (for deletion)
  const { countTasksForPage, migrateTasksToInbox } = usePageOperations();

  // Delete confirmation
  const requestDelete = useDeleteConfirmStore((s) => s.requestDelete);

  // Helper to count all descendants of an item
  const countDescendants = useCallback((itemId: string): number => {
    const findNode = (nodes: TreeNode<T>[]): TreeNode<T> | null => {
      for (const node of nodes) {
        if (config.getId(node.item) === itemId) return node;
        const found = findNode(node.children);
        if (found) return found;
      }
      return null;
    };
    
    const countChildren = (node: TreeNode<T>): number => {
      let count = node.children.length;
      for (const child of node.children) {
        count += countChildren(child);
      }
      return count;
    };
    
    const node = findNode(tree);
    return node ? countChildren(node) : 0;
  }, [tree, config]);

  // Descendant checker
  const checkIsDescendant = useCallback((targetId: string, sourceId: string): boolean => {
    return isDescendantInTree(
      tree,
      targetId,
      sourceId,
      (node) => config.getId(node.item),
      (node) => node.children
    );
  }, [tree, config]);

  // Drag-and-drop
  const {
    state: dragState,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    handleExternalDragOver,
    handleExternalDrop,
    isDragging,
    getDropPosition,
  } = useTreeDragAndDrop<string>({
    onReorder: (draggedId, targetId, targetParentId, position) => {
      onReorder?.(draggedId, targetId, targetParentId, position);
    },
    onReparent: (draggedId, newParentId) => {
      onReparent?.(draggedId, newParentId);
    },
    isDescendant: checkIsDescendant,
  });

  // Clear root drop zone when drag ends
  useEffect(() => {
    if (!dragState.draggedId) {
      setIsRootDropZoneActive(false);
    }
  }, [dragState.draggedId]);

  // Flatten tree for keyboard navigation
  const flattenedIds = useMemo(() => {
    const result: string[] = [];
    const traverse = (nodes: TreeNode<T>[]) => {
      for (const node of nodes) {
        const id = config.getId(node.item);
        result.push(id);
        const isExpanded = expandedIds?.has(id) ?? false;
        const shouldShow = config.shouldShowChildren?.(node.item) ?? true;
        if (isExpanded && shouldShow && node.children.length > 0) {
          traverse(node.children);
        }
      }
    };
    traverse(tree);
    return result;
  }, [tree, expandedIds, config]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, itemId: string) => {
    const currentIndex = flattenedIds.indexOf(itemId);
    if (currentIndex === -1) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = Math.min(currentIndex + 1, flattenedIds.length - 1);
      const nextId = flattenedIds[nextIndex];
      setFocusedId(nextId);
      setTimeout(() => {
        const element = document.querySelector(`[data-${dataAttrPrefix}-id="${nextId}"]`) as HTMLElement;
        element?.focus();
      }, 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = Math.max(currentIndex - 1, 0);
      const prevId = flattenedIds[prevIndex];
      setFocusedId(prevId);
      setTimeout(() => {
        const element = document.querySelector(`[data-${dataAttrPrefix}-id="${prevId}"]`) as HTMLElement;
        element?.focus();
      }, 0);
    }
  }, [flattenedIds, dataAttrPrefix]);

  // Root drop zone handlers
  const handleRootDropZoneDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsRootDropZoneActive(true);
  }, []);

  const handleRootDropZoneDragLeave = useCallback((e: React.DragEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    const currentTarget = e.currentTarget as HTMLElement;
    if (!currentTarget.contains(relatedTarget)) {
      setIsRootDropZoneActive(false);
    }
  }, []);

  const handleRootDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsRootDropZoneActive(false);
    const draggedId = dragState.draggedId;
    if (!draggedId || !onUpdate) return;
    onUpdate(draggedId, { parentId: null });
    handleDragEnd();
  }, [dragState.draggedId, onUpdate, handleDragEnd]);



  // Generate context menu items for an item
  const getContextMenuItems = useCallback((itemId: string): ContextMenuItem[] => {
    const treeItem = items.find(i => config.getId(i) === itemId);
    if (!treeItem) return [];
    
    const viewMode = config.getViewMode?.(treeItem);
    const tabsEnabled = useSettingsStore.getState().tabsEnabled;
    const openTab = useTabsStore.getState().openTab;
    const isPinned = getIsPinned?.(itemId) ?? false;
    const showChildren = config.shouldShowChildren?.(treeItem) ?? true;
    const pageChildCount = config.getChildCount 
      ? config.getChildCount(treeItem) 
      : countDescendants(itemId);
    const taskCount = viewMode === 'tasks' ? countTasksForPage(itemId) : 0;
    const totalChildCount = pageChildCount + taskCount;

    return buildPageMenuItems({
      isMultiSelect: false,
      selectionCount: 1,
      tabsEnabled,
      isPinned,
      showChildrenInSidebar: showChildren,

      onOpenInNewTab: tabsEnabled ? () => {
        openTab({
          title: config.getTitle(treeItem),
          path: `/pages/${itemId}`,
          icon: config.getIcon(treeItem),
          color: config.getColor(treeItem),
          pageId: itemId,
          type: 'page',
        });
      } : undefined,

      onCreateChild: onCreateChild ? () => onCreateChild(itemId) : undefined,

      onCreateTask: (onCreateTask && viewMode === 'tasks') ? () => onCreateTask(itemId) : undefined,

      onTogglePin: onPin ? () => onPin(itemId, !isPinned) : undefined,

      onToggleShowChildren: onUpdate ? () => onUpdate(itemId, { showChildrenInSidebar: !showChildren }) : undefined,

      onDelete: onDelete ? () => {
        requestDelete({
          itemType: 'page',
          count: 1,
          hasChildren: totalChildCount > 0,
          childCount: totalChildCount,
          onConfirm: (cascade: boolean) => {
            if (!cascade && viewMode === 'tasks' && taskCount > 0) {
              migrateTasksToInbox(itemId);
            }
            onDelete(itemId, cascade);
          },
        });
      } : undefined,
    });
  }, [onDelete, onPin, getIsPinned, requestDelete, countDescendants, items, config, countTasksForPage, migrateTasksToInbox, onCreateChild, onCreateTask, onUpdate]);

  // Render tree node
  const renderTreeNode = (node: TreeNode<T>, level: number = 0): React.ReactNode => {
    const item = node.item;
    const id = config.getId(item);
    const isActive = selectedId === id;
    const itemIsDragging = isDragging(id);
    const dropPosition = getDropPosition(id);
    const isFocused = focusedId === id;
    const nodeItemType = config.getItemType(item);
    // Show expand chevron if children exist OR if item might have children (lazy-loading)
    const hasLoadedChildren = node.children.length > 0;
    // Use prop function if provided, otherwise fall back to config, otherwise false
    const mayHaveChildren = mayHaveChildrenFn 
      ? mayHaveChildrenFn(id) 
      : (config.mayHaveChildren?.(item) ?? false);
    
    // Respect the sidebar visibility setting
    const shouldShowChildren = config.shouldShowChildren?.(item) ?? true;
    const hasChildren = (hasLoadedChildren || mayHaveChildren) && shouldShowChildren;
    
    // Only consider expanded if the item actually has (or might have) children
    // This prevents stale expandedIds from showing an incorrect expanded state
    const isExpanded = hasChildren && expandedIds?.has(id);
    const isTaskTarget = taskDragOverId === id;
    const contextMenuItems = getContextMenuItems(id);

    return (
      <React.Fragment key={id}>
        <TreeSidebarItem
          id={id}
          parentId={config.getParentId(item)}
          title={config.getTitle(item)}
          icon={config.getIcon(item)}
          color={config.getColor(item)}
          itemType={nodeItemType}
          viewMode={config.getViewMode?.(item)}
          hasChildren={hasChildren}
          level={level}
          isActive={isActive}
          isExpanded={isExpanded}
          onSelect={onSelect}
          onToggleExpand={onToggleExpand}
          onCreateChild={onCreateChild}
          onCreateTask={onCreateTask}

          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onExternalDragOver={enableExternalDrag ? handleExternalDragOver : undefined}
          onExternalDrop={enableExternalDrag ? handleExternalDrop : undefined}
          onTaskDragOver={onTaskDragOver ? (e) => onTaskDragOver(id, e) : undefined}
          onTaskDrop={onTaskDrop ? (e) => onTaskDrop(id, e) : undefined}
          isDragging={itemIsDragging}
          dropPosition={dropPosition}
          isTaskDragTarget={isTaskTarget}
          count={counts?.[id]}
          overdueCount={overdueCounts?.[id]}
          isFocused={isFocused}
          onKeyDown={handleKeyDown}
          contextMenuItems={contextMenuItems}
        />
        {shouldShowChildren && isExpanded && hasLoadedChildren && (
          <ul className="relative" style={{ marginLeft: '16px' }}>
            {/* Depth indicator line for this level */}
            <div className="absolute top-0 bottom-0 left-2 w-px bg-[var(--color-border-default)]" />
            {node.children.map((child) => renderTreeNode(child, level + 1))}
            {/* Load More button for paginated children */}
            {parentHasMoreFn?.(id) && onLoadMoreChildren && (
              <li>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLoadMoreChildren(id);
                  }}
                  className="flex items-center gap-1 w-full py-2 text-xs text-[var(--color-accent-fg)] hover:text-[var(--color-accent-emphasis)] hover:bg-[var(--color-surface-hover)] rounded transition-colors touch-manipulation"
                  style={{ paddingLeft: `${(level + 1) * 12 + 20}px` }}
                >
                  <span className="text-[10px]">•••</span>
                  <span>Load more</span>
                </button>
              </li>
            )}
          </ul>
        )}
      </React.Fragment>
    );
  };

  return (
    <div>
        <div className={`flex items-center justify-between mb-1 ${isMobile ? 'px-4' : 'px-1'}`}>
          <Label>
            {label}
          </Label>
          {!hideHeaderAdd && (onCreate || onCreateChild) && (
            onCreate ? (
              <button
                onClick={() => onCreate({})}
                className="p-1 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
                title={`Create new ${label.slice(0, -1).toLowerCase()}`}
                aria-label={`Create new ${label.slice(0, -1).toLowerCase()}`}
              >
                <PlusIcon className="w-4 h-4" />
              </button>
            ) : (
              <PageTypeDropdown
                onSelect={(viewMode) => onCreateChild?.(null, viewMode)}
                title={`Create new ${label.slice(0, -1).toLowerCase()}`}
                align="right"
                size="sm"
              />
            )
          )}
        </div>

        {isOpen && (
          <>
            {/* Prefix content (e.g., Inbox link) */}
            {prefixContent && (
              <div className="mb-1">
                {prefixContent}
              </div>
            )}

            {tree.length > 0 && (
              <ul className="space-y-0">
                {tree.map((node) => renderTreeNode(node, 0))}
                {/* Root-level Load More button */}
                {hasMoreRoot && onLoadMoreRoot && (
                  <li>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onLoadMoreRoot();
                      }}
                      className="flex items-center gap-1 w-full py-2 text-xs text-[var(--color-accent-fg)] hover:text-[var(--color-accent-emphasis)] hover:bg-[var(--color-surface-hover)] rounded transition-colors touch-manipulation"
                      style={{ paddingLeft: '20px' }}
                    >
                      <span className="text-[10px]">•••</span>
                      <span>Load more</span>
                    </button>
                  </li>
                )}
              </ul>
            )}
          </>
        )}

        {/* Root drop zone */}
        {isOpen && dragState.draggedId && dragState.draggedParentId && (
          <div
            onDragOver={handleRootDropZoneDragOver}
            onDragLeave={handleRootDropZoneDragLeave}
            onDrop={handleRootDrop}
            className={`mx-2 mt-1 py-2 px-3 rounded-lg border-2 border-dashed transition-all text-center text-xs ${
              isRootDropZoneActive
                ? 'border-[var(--color-accent-emphasis)] bg-[var(--color-accent-muted)] text-[var(--color-accent-fg)]'
                : 'border-[var(--color-border-default)] text-[var(--color-text-disabled)]'
            }`}
          >
            Drop here to move to root
          </div>
        )}

        {isOpen && tree.length === 0 && !prefixContent && (
          <div className={`${isMobile ? 'px-4' : 'px-1'} py-2 text-xs text-[var(--color-text-tertiary)] italic`}>
            {emptyMessage}
          </div>
        )}
    </div>
  );
}

export default TreeSection;
