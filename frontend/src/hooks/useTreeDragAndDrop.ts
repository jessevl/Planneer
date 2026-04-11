/**
 * @file useTreeDragAndDrop.ts
 * @description Drag-and-drop hook for hierarchical tree structures
 * @app SHARED - Used by TreeSection for both pages and projects sidebar
 * 
 * A specialized hook for drag-and-drop in tree/hierarchical structures:
 * - Position-based dropping (before/inside/after)
 * - Reordering siblings (before/after drops)
 * - Reparenting by dropping inside another item
 * - Prevents invalid drops (can't drop into descendants)
 * - External drag support (dragging from outside the tree)
 * 
 * Uses shared utilities from dragUtils.ts for:
 * - Text selection prevention
 * - Tree descendant checking
 * 
 * Used by:
 * - TreeSection component for sidebar navigation
 * - NotesSidebar (note hierarchy)
 * - TasksSidebar (task page hierarchy)
 */
import { useState, useCallback } from 'react';
import { 
  usePreventSelectionDuringDrag, 
  isDescendantInTree as isDescendantUtil,
  type DropPosition 
} from './dragUtils';

// Re-export for backwards compatibility
export type { DropPosition } from './dragUtils';
export { isDescendantInTree } from './dragUtils';

interface TreeDragState<T extends string = string> {
  /** ID of the item currently being dragged */
  draggedId: T | null;
  /** Parent ID of the dragged item */
  draggedParentId: T | null;
  /** ID of the item being dragged over */
  dragOverId: T | null;
  /** Position within the drop target (before/inside/after) */
  dropPosition: DropPosition | null;
  /** Whether an external item is being dragged over */
  isExternalDragOver: boolean;
}

interface UseTreeDragAndDropOptions<T extends string = string> {
  /** Called when reordering items at the same level (before/after) */
  onReorder?: (draggedId: T, targetId: T, targetParentId: T | null, position: 'before' | 'after') => void;
  /** Called when moving an item to be a child of another (inside) - works for both internal and external drops */
  onReparent?: (draggedId: T, newParentId: T) => void;
  /** Function to check if target is a descendant of source (prevents invalid reparenting) */
  isDescendant?: (targetId: T, sourceId: T) => boolean;
}

interface UseTreeDragAndDropReturn<T extends string = string> {
  /** Current drag state */
  state: TreeDragState<T>;
  /** Start dragging an item */
  handleDragStart: (id: T, parentId: T | null) => void;
  /** End the drag operation */
  handleDragEnd: () => void;
  /** Handle drag over an item with position detection (internal drag) */
  handleDragOver: (id: T, parentId: T | null, position: DropPosition) => void;
  /** Handle drop on an item (internal drag) */
  handleDrop: (targetId: T, targetParentId: T | null, position: DropPosition) => void;
  /** Handle external drag over an item (from another component) */
  handleExternalDragOver: (id: T, parentId: T | null, position: DropPosition, e: React.DragEvent) => void;
  /** Handle external drop on an item (from another component) */
  handleExternalDrop: (targetId: T, position: DropPosition, e: React.DragEvent) => void;
  /** Check if an item is being dragged */
  isDragging: (id: T) => boolean;
  /** Get the drop position for an item (null if not being dragged over) */
  getDropPosition: (id: T) => DropPosition | null;
  /** Check if external drag is over this item */
  isExternalDragOverItem: (id: T) => boolean;
}

/**
 * Drag-and-drop hook for tree/hierarchical structures.
 * Supports position-based dropping (before/inside/after) for:
 * - Reordering items at the same level (before/after)
 * - Reparenting items by dropping inside another item
 * 
 * Used by sidebar note tree where items can be nested.
 */
export function useTreeDragAndDrop<T extends string = string>(
  options: UseTreeDragAndDropOptions<T> = {}
): UseTreeDragAndDropReturn<T> {
  const { onReorder, onReparent, isDescendant } = options;

  const [state, setState] = useState<TreeDragState<T>>({
    draggedId: null,
    draggedParentId: null,
    dragOverId: null,
    dropPosition: null,
    isExternalDragOver: false,
  });

  // Use shared hook to prevent text selection during drag
  usePreventSelectionDuringDrag(state.draggedId !== null);

  const handleDragStart = useCallback((id: T, parentId: T | null) => {
    setState(prev => ({
      ...prev,
      draggedId: id,
      draggedParentId: parentId,
      isExternalDragOver: false,
    }));
  }, []);

  const handleDragEnd = useCallback(() => {
    setState({
      draggedId: null,
      draggedParentId: null,
      dragOverId: null,
      dropPosition: null,
      isExternalDragOver: false,
    });
  }, []);

  const handleDragOver = useCallback((id: T, parentId: T | null, position: DropPosition) => {
    setState(prev => {
      // Can't drag over self (internal drag only)
      if (!prev.draggedId || prev.draggedId === id) {
        return { ...prev, dragOverId: null, dropPosition: null };
      }

      // Can't drop inside own descendant
      if (position === 'inside' && isDescendant?.(id, prev.draggedId)) {
        return { ...prev, dragOverId: null, dropPosition: null };
      }

      return {
        ...prev,
        dragOverId: id,
        dropPosition: position,
        isExternalDragOver: false,
      };
    });
  }, [isDescendant]);

  // Handle external drag over (from another component like collection view)
  const handleExternalDragOver = useCallback((id: T, parentId: T | null, position: DropPosition, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // For external drags, we don't have state.draggedId, so we allow any drop
    // The actual validation happens on drop
    setState(prev => {
      // If we're doing an internal drag, defer to handleDragOver
      if (prev.draggedId) {
        return prev;
      }
      
      return {
        ...prev,
        dragOverId: id,
        dropPosition: position,
        isExternalDragOver: true,
      };
    });
  }, []);

  // Handle external drop (from another component)
  const handleExternalDrop = useCallback((targetId: T, position: DropPosition, e: React.DragEvent) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain') as T;
    
    if (!draggedId || draggedId === targetId) {
      handleDragEnd();
      return;
    }

    // For external drops, we only support reparenting (dropping inside a target)
    // This makes the dropped item a child of the target
    if (position === 'inside') {
      onReparent?.(draggedId, targetId);
    }
    // Note: We don't support before/after for external drops since we don't know
    // the original parent of the dragged item

    handleDragEnd();
  }, [onReparent, handleDragEnd]);

  const handleDrop = useCallback((targetId: T, targetParentId: T | null, position: DropPosition) => {
    const { draggedId, draggedParentId } = state;
    
    if (!draggedId || draggedId === targetId) {
      handleDragEnd();
      return;
    }

    if (position === 'inside') {
      // Reparent: make dragged item a child of target
      onReparent?.(draggedId, targetId);
    } else {
      // Reorder: before or after target
      // This works for both same-parent reordering AND cross-parent moves
      // The handler should update parentId if needed based on targetParentId
      onReorder?.(draggedId, targetId, targetParentId, position);
    }

    handleDragEnd();
  }, [state, onReorder, onReparent, handleDragEnd]);

  const isDragging = useCallback((id: T) => state.draggedId === id, [state.draggedId]);
  
  const getDropPosition = useCallback((id: T) => 
    state.dragOverId === id ? state.dropPosition : null,
  [state.dragOverId, state.dropPosition]);

  const isExternalDragOverItem = useCallback((id: T) => 
    state.isExternalDragOver && state.dragOverId === id,
  [state.isExternalDragOver, state.dragOverId]);

  return {
    state,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    handleExternalDragOver,
    handleExternalDrop,
    isDragging,
    getDropPosition,
    isExternalDragOverItem,
  };
}
