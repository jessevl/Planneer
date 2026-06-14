/**
 * @file useDragAndDrop.ts
 * @description Drag-and-drop state for task groups (used by TaskList, KanbanView).
 *
 * - draggedItem / dragOverGroup: group-level state used by group containers to
 *   highlight the hovered bucket and apply group property changes on drop.
 * - dropTargetTaskId / dropPosition: row-level state used to show an indicator
 *   between cards and to compute the manual `order` on drop.
 */
import { useState, useCallback } from 'react';

/**
 * Compute 'before' vs 'after' from the cursor's Y relative to the event's
 * currentTarget (the drop-zone wrapper). The wrapper's padding extends the
 * hit area into the gap between cards so the entire gap is captured.
 */
export function computeRowDropPosition(e: React.DragEvent): 'before' | 'after' {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  return (e.clientY - rect.top) < rect.height / 2 ? 'before' : 'after';
}

/**
 * Build the post-drop ordered id list for the target group: drop the dragged
 * task out of the list (if present) and re-insert it relative to the target.
 */
export function computeReorderedIds(
  tasksInGroup: { id: string }[],
  draggedItemId: string,
  targetTaskId: string,
  position: 'before' | 'after',
): string[] {
  const ids = tasksInGroup.filter((t) => t.id !== draggedItemId).map((t) => t.id);
  let idx = ids.indexOf(targetTaskId);
  if (idx === -1) idx = ids.length;
  ids.splice(position === 'before' ? idx : idx + 1, 0, draggedItemId);
  return ids;
}

export function useDragAndDrop() {
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);
  const [dropTargetTaskId, setDropTargetTaskId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);

  const handleDragStart = useCallback((taskId: string) => {
    setDraggedItem(taskId);
    // Clear any stale row-drop state from a previous (possibly cancelled) drag.
    setDropTargetTaskId(null);
    setDropPosition(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverGroup(null);
    setDropTargetTaskId(null);
    setDropPosition(null);
  }, []);

  const handleDragOver = useCallback((groupKey: string) => {
    setDragOverGroup(groupKey);
  }, []);

  // No-op on leave: keeping the previous group highlighted until the next
  // dragover fires prevents flicker as the cursor crosses between columns.
  const handleDragLeave = useCallback(() => {}, []);

  const handleRowDragOver = useCallback((taskId: string, position: 'before' | 'after') => {
    setDropTargetTaskId(taskId);
    setDropPosition(position);
  }, []);

  return {
    draggedItem,
    dragOverGroup,
    dropTargetTaskId,
    dropPosition,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleRowDragOver,
  };
}
