/**
 * @file deleteConfirmStore.ts
 * @description Global delete confirmation state management
 * @app SHARED - Used for confirming deletions of tasks and pages
 * 
 * Provides a centralized way to show delete confirmation modals from anywhere.
 * The actual deletion is performed by the caller via a callback.
 * 
 * Usage:
 * 1. Call requestDelete() with items to delete and a callback
 * 2. ConfirmDeleteModal (rendered at app level) shows the confirmation
 * 3. On confirm, the callback is executed and modal closes
 * 4. On cancel, modal closes without action
 * 
 * For pages with children (child pages or tasks), the modal can show cascade options:
 * - "Delete only" - moves children to root level / inbox
 * - "Delete all" - deletes item and all descendants
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// Simplified to just 'task' and 'page' - pages include all page types (note, collection, tasks)
export type DeleteItemType = 'task' | 'page';

interface DeleteConfirmState {
  // Whether the modal is open
  isOpen: boolean;
  
  // Type of items being deleted (for message customization)
  itemType: DeleteItemType;
  
  // Number of items being deleted
  count: number;
  
  // Optional custom message
  customMessage?: string;
  
  // Whether to show cascade options (for items with children)
  hasChildren: boolean;
  
  // Number of children that would be affected
  childCount: number;
  
  // Whether some children are tasks (vs pages) - for accurate messaging
  hasTaskChildren: boolean;
  
  // Callback to execute on confirmation (receives cascade boolean)
  onConfirm: ((cascade: boolean) => void) | null;
  
  // Actions
  requestDelete: (options: {
    itemType: DeleteItemType;
    count: number;
    customMessage?: string;
    hasChildren?: boolean;
    childCount?: number;
    hasTaskChildren?: boolean;
    onConfirm: (cascade: boolean) => void;
  }) => void;
  
  confirm: (cascade: boolean) => void;
  cancel: () => void;
}

export const useDeleteConfirmStore = create<DeleteConfirmState>()(
  devtools(
    (set, get) => ({
      isOpen: false,
      itemType: 'task',
      count: 1,
      customMessage: undefined,
      hasChildren: false,
      childCount: 0,
      hasTaskChildren: false,
      onConfirm: null,
      
      requestDelete: ({ itemType, count, customMessage, hasChildren = false, childCount = 0, hasTaskChildren = false, onConfirm }) => {
        set({
          isOpen: true,
          itemType,
          count,
          customMessage,
          hasChildren,
          childCount,
          hasTaskChildren,
          onConfirm,
        }, false, 'requestDelete');
      },
      
      confirm: (cascade: boolean) => {
        const { onConfirm } = get();
        if (onConfirm) {
          onConfirm(cascade);
        }
        set({
          isOpen: false,
          onConfirm: null,
          customMessage: undefined,
          hasChildren: false,
          childCount: 0,
          hasTaskChildren: false,
        }, false, 'confirm');
      },
      
      cancel: () => {
        set({
          isOpen: false,
          onConfirm: null,
          customMessage: undefined,
          hasChildren: false,
          childCount: 0,
          hasTaskChildren: false,
        }, false, 'cancel');
      },
    }),
    { name: 'planneer-delete-confirm' }
  )
);

/**
 * Helper to get the appropriate label for item type
 */
export function getDeleteItemLabel(itemType: DeleteItemType, count: number): string {
  const labels: Record<DeleteItemType, { singular: string; plural: string }> = {
    task: { singular: 'task', plural: 'tasks' },
    page: { singular: 'page', plural: 'pages' },
  };
  
  const label = labels[itemType];
  return count === 1 ? label.singular : label.plural;
}
