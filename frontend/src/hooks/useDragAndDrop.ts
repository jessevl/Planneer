/**
 * @file useDragAndDrop.ts
 * @description Simple drag-and-drop state hook for task groups
 * @app TASKS APP ONLY - Used by TaskList and KanbanView
 * 
 * A lightweight hook for managing drag state when moving tasks between groups.
 * Tracks:
 * - draggedItem: ID of the task being dragged
 * - dragOverGroup: Key of the group being hovered over
 * 
 * Used for task drag operations where dropping changes a property
 * (e.g., dragging to a date group changes dueDate, to priority changes priority).
 * 
 * For more complex tree-based drag-and-drop, see useTreeDragAndDrop.
 * For position-based list reordering, see useListDragAndDrop.
 */
import { useState, useCallback } from 'react';

export function useDragAndDrop() {
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);

  const handleDragStart = useCallback((taskId: string) => {
    setDraggedItem(taskId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverGroup(null);
  }, []);

  const handleDragOver = useCallback((groupKey: string) => {
    setDragOverGroup(groupKey);
  }, []);

  // Note: We intentionally don't clear dragOverGroup on leave.
  // This prevents flicker when dragging between columns - the highlight
  // stays on the previous column until handleDragOver fires on the new one.
  // dragOverGroup is only cleared on dragEnd (drop or cancel).
  const handleDragLeave = useCallback(() => {
    // Intentionally empty - see comment above
  }, []);

  return {
    draggedItem,
    dragOverGroup,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
  };
}
