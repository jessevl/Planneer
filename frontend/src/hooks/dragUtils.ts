/**
 * @file dragUtils.ts
 * @description Shared utilities for native HTML5 drag-and-drop hooks
 * @app SHARED - Used by useDragAndDrop, useListDragAndDrop, useTreeDragAndDrop
 * 
 * Consolidates common drag-and-drop functionality:
 * - Text selection prevention during drag
 * - Array reordering utilities
 * - Position calculation helpers
 * - Common type definitions
 * 
 * This keeps the individual hooks focused on their specific use cases
 * while sharing the low-level utilities.
 */
import { useEffect } from 'react';

// ============================================================================
// Common Types
// ============================================================================

/** Drop position relative to a target item */
export type DropPosition = 'before' | 'inside' | 'after';

/** Base drag state shared by all drag hooks */
export interface BaseDragState<T extends string = string> {
  /** ID of the item currently being dragged */
  draggedId: T | null;
  /** ID of the item being dragged over */
  dragOverId: T | null;
  /** Position within the drop target */
  dropPosition: DropPosition | null;
}

// ============================================================================
// Selection Prevention Hook
// ============================================================================

/**
 * Hook to prevent text selection during drag operations.
 * Disables user-select and prevents selectstart events while dragging.
 * 
 * @param isDragging - Whether a drag operation is active
 * 
 * @example
 * ```tsx
 * const [draggedId, setDraggedId] = useState<string | null>(null);
 * usePreventSelectionDuringDrag(draggedId !== null);
 * ```
 */
export function usePreventSelectionDuringDrag(isDragging: boolean): void {
  useEffect(() => {
    if (!isDragging) return;

    const preventSelection = (e: Event) => {
      e.preventDefault();
      return false;
    };

    // Disable text selection
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.addEventListener('selectstart', preventSelection);

    return () => {
      // Re-enable text selection
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      document.removeEventListener('selectstart', preventSelection);
    };
  }, [isDragging]);
}

// ============================================================================
// Array Reordering Utilities
// ============================================================================

/**
 * Compute new order array after moving an item relative to a target.
 * 
 * @param currentOrder - Current array of IDs
 * @param draggedId - ID of the item being moved
 * @param targetId - ID of the target item
 * @param position - Where to insert relative to target ('before' | 'after')
 * @returns New array with updated order
 * 
 * @example
 * ```tsx
 * const newOrder = reorderArray(['a', 'b', 'c', 'd'], 'd', 'b', 'before');
 * // Result: ['a', 'd', 'b', 'c']
 * ```
 */
export function reorderArray<T>(
  currentOrder: T[],
  draggedId: T,
  targetId: T,
  position: 'before' | 'after' = 'before'
): T[] {
  const draggedIndex = currentOrder.indexOf(draggedId);
  const targetIndex = currentOrder.indexOf(targetId);
  
  if (draggedIndex === -1 || targetIndex === -1) {
    return currentOrder;
  }

  // Remove dragged item
  const newOrder = currentOrder.filter(id => id !== draggedId);
  
  // Calculate insert position
  // If dragging forward (higher index), target moves back one after removal
  let insertIndex: number;
  if (position === 'after') {
    insertIndex = targetIndex > draggedIndex ? targetIndex : targetIndex + 1;
  } else {
    insertIndex = targetIndex > draggedIndex ? targetIndex - 1 : targetIndex;
  }
  
  newOrder.splice(insertIndex, 0, draggedId);
  return newOrder;
}

/**
 * Move an item to the end of an array.
 * 
 * @param currentOrder - Current array of IDs
 * @param draggedId - ID of the item to move
 * @returns New array with item at the end
 */
export function moveToEnd<T>(currentOrder: T[], draggedId: T): T[] {
  const newOrder = currentOrder.filter(id => id !== draggedId);
  newOrder.push(draggedId);
  return newOrder;
}

/**
 * Move an item to a specific index in an array.
 * 
 * @param currentOrder - Current array of IDs
 * @param draggedId - ID of the item to move
 * @param newIndex - Target index
 * @returns New array with item at the specified index
 */
export function moveToIndex<T>(currentOrder: T[], draggedId: T, newIndex: number): T[] {
  const newOrder = currentOrder.filter(id => id !== draggedId);
  const clampedIndex = Math.max(0, Math.min(newIndex, newOrder.length));
  newOrder.splice(clampedIndex, 0, draggedId);
  return newOrder;
}

// ============================================================================
// Position Detection
// ============================================================================

/**
 * Determine drop position based on mouse Y position within an element.
 * Divides element into three zones: top third (before), middle third (inside), bottom third (after).
 * 
 * @param e - Drag event
 * @param element - Target element
 * @param allowInside - Whether to allow 'inside' position (for nesting)
 * @returns Drop position
 */
export function getDropPositionFromEvent(
  e: React.DragEvent,
  element: HTMLElement,
  allowInside: boolean = true
): DropPosition {
  const rect = element.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const height = rect.height;
  
  if (allowInside) {
    // Three zones: before (top 25%), inside (middle 50%), after (bottom 25%)
    if (y < height * 0.25) return 'before';
    if (y > height * 0.75) return 'after';
    return 'inside';
  } else {
    // Two zones: before (top 50%), after (bottom 50%)
    return y < height * 0.5 ? 'before' : 'after';
  }
}

/**
 * Check if mouse has left a container element.
 * Useful for dragLeave handlers to avoid false triggers from child elements.
 * 
 * @param e - Drag event
 * @returns Whether the mouse is outside the container
 */
export function hasLeftContainer(e: React.DragEvent): boolean {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const { clientX: x, clientY: y } = e;
  return x < rect.left || x > rect.right || y < rect.top || y > rect.bottom;
}

// ============================================================================
// Tree Utilities
// ============================================================================

/**
 * Check if a node is a descendant of another in a tree structure.
 * Prevents invalid operations like dropping a parent into its own child.
 * 
 * @param tree - The tree to search
 * @param targetId - The potential descendant ID
 * @param ancestorId - The potential ancestor ID
 * @param getId - Function to get ID from a node
 * @param getChildren - Function to get children from a node
 * @returns Whether targetId is a descendant of ancestorId
 * 
 * @example
 * ```tsx
 * const isInvalid = isDescendantInTree(
 *   noteTree,
 *   dropTargetId,
 *   draggedId,
 *   (n) => n.id,
 *   (n) => n.children
 * );
 * if (isInvalid) return; // Can't drop into own descendant
 * ```
 */
export function isDescendantInTree<N, T extends string = string>(
  tree: N[],
  targetId: T,
  ancestorId: T,
  getId: (node: N) => T,
  getChildren: (node: N) => N[]
): boolean {
  const findAndCheck = (nodes: N[]): boolean => {
    for (const node of nodes) {
      if (getId(node) === ancestorId) {
        // Found ancestor, now check if targetId is in its descendants
        const checkDescendants = (n: N): boolean => {
          if (getId(n) === targetId) return true;
          return getChildren(n).some(checkDescendants);
        };
        return getChildren(node).some(checkDescendants);
      }
      if (findAndCheck(getChildren(node))) return true;
    }
    return false;
  };
  return findAndCheck(tree);
}

// ============================================================================
// DataTransfer Helpers
// ============================================================================

/**
 * Set up dataTransfer for a drag operation.
 * Standardizes how we store dragged item data.
 * 
 * @param e - Drag start event
 * @param id - ID of the dragged item
 * @param type - Optional type identifier (e.g., 'task', 'note', 'project')
 */
export function setDragData(
  e: React.DragEvent,
  id: string,
  type?: string
): void {
  // Use 'copyMove' instead of 'move' for broad WebView compatibility.
  e.dataTransfer.effectAllowed = 'copyMove';
  e.dataTransfer.setData('text/plain', id);
  if (type) {
    e.dataTransfer.setData('application/x-drag-type', type);
    // Also set a type-specific key so we can detect the type during dragover
    // (dataTransfer.getData() is protected during dragover, but types array is readable)
    e.dataTransfer.setData(`application/x-${type}-id`, id);
  }
}

/**
 * Get dragged item ID from dataTransfer.
 * 
 * @param e - Drag or drop event
 * @returns The dragged item ID, or null if not found
 */
export function getDragData(e: React.DragEvent): string | null {
  return e.dataTransfer.getData('text/plain') || null;
}

/**
 * Get dragged item type from dataTransfer.
 * 
 * @param e - Drag or drop event
 * @returns The drag type, or null if not set
 */
export function getDragType(e: React.DragEvent): string | null {
  return e.dataTransfer.getData('application/x-drag-type') || null;
}
