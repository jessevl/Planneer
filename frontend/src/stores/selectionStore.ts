/**
 * @file selectionStore.ts
 * @description Universal multi-selection state management
 * @app SHARED - Used across tasks and pages for multi-select functionality
 * 
 * Provides:
 * - Multi-selection with Shift+Click range selection
 * - Cmd/Ctrl+Click toggle selection
 * - Selection by entity type (task, page)
 * - Selection contexts to prevent cross-area selection
 * - Clear selection on context change
 * 
 * Selection Contexts:
 * - 'main-tasks': Task list/kanban in main view
 * - 'main-pages': Notes grid/list in main view
 * 
 * Works with:
 * - useContextMenu hook for context-aware actions
 * - TaskRow, PageRow, PageCard components
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type SelectableEntityType = 'task' | 'page';

// Selection contexts to prevent cross-area selection
export type SelectionContext = 
  | 'main-tasks'       // Task list/kanban in main view
  | 'main-pages';      // Notes grid/list in main view

interface SelectionState {
  // Selected IDs by entity type
  selectedIds: Record<SelectableEntityType, Set<string>>;
  
  // Last clicked item (for shift-click range selection)
  lastClickedId: Record<SelectableEntityType, string | null>;
  
  // Ordered list of visible IDs (for range selection)
  visibleOrder: Record<SelectableEntityType, string[]>;
  
  // Current selection context (to prevent cross-area selection)
  activeContext: SelectionContext | null;
  
  // Selection mode (for mobile/touch where modifiers aren't available)
  selectionMode: boolean;
  
  // Actions
  setSelectionMode: (enabled: boolean) => void;
  select: (type: SelectableEntityType, id: string, options?: SelectOptions) => void;
  deselect: (type: SelectableEntityType, id: string) => void;
  toggleSelect: (type: SelectableEntityType, id: string, context?: SelectionContext) => void;
  selectRange: (type: SelectableEntityType, fromId: string, toId: string) => void;
  selectAll: (type: SelectableEntityType) => void;
  clearSelection: (type?: SelectableEntityType) => void;
  setVisibleOrder: (type: SelectableEntityType, ids: string[]) => void;
  isSelected: (type: SelectableEntityType, id: string) => boolean;
  getSelectedIds: (type: SelectableEntityType) => string[];
  getSelectionCount: (type: SelectableEntityType) => number;
  
  // Handle click with modifiers (Shift, Cmd/Ctrl) and context
  handleItemClick: (
    type: SelectableEntityType,
    id: string,
    event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean },
    context?: SelectionContext
  ) => void;
}

interface SelectOptions {
  additive?: boolean; // Add to existing selection (Cmd/Ctrl+Click)
  range?: boolean;    // Range select (Shift+Click)
  exclusive?: boolean; // Clear others and select only this
}

const createEmptySelection = (): Record<SelectableEntityType, Set<string>> => ({
  task: new Set(),
  page: new Set(),
});

const createEmptyLastClicked = (): Record<SelectableEntityType, string | null> => ({
  task: null,
  page: null,
});

const createEmptyVisibleOrder = (): Record<SelectableEntityType, string[]> => ({
  task: [],
  page: [],
});

export const useSelectionStore = create<SelectionState>()(
  devtools(
    (set, get) => ({
      selectedIds: createEmptySelection(),
      lastClickedId: createEmptyLastClicked(),
      visibleOrder: createEmptyVisibleOrder(),
      activeContext: null,
      selectionMode: false,

      setSelectionMode: (enabled) => {
        if (!enabled) {
          get().clearSelection();
        }
        set({ selectionMode: enabled }, false, 'setSelectionMode');
      },

      select: (type, id, options = {}) => {
        set((state) => {
          const newSelected = options.additive || options.range
            ? new Set(state.selectedIds[type])
            : new Set<string>();
          
          newSelected.add(id);
          
          const nextSelectedIds = {
            ...state.selectedIds,
            [type]: newSelected,
          };

          // Auto-enable selection mode if something is selected
          const hasAnySelection = Object.values(nextSelectedIds).some(set => set.size > 0);
          
          return {
            selectedIds: nextSelectedIds,
            lastClickedId: {
              ...state.lastClickedId,
              [type]: id,
            },
            selectionMode: hasAnySelection,
          };
        }, false, `select/${type}`);
      },

      deselect: (type, id) => {
        set((state) => {
          const newSelected = new Set(state.selectedIds[type]);
          newSelected.delete(id);
          
          const nextSelectedIds = {
            ...state.selectedIds,
            [type]: newSelected,
          };

          // Auto-disable selection mode if nothing is selected
          const hasAnySelection = Object.values(nextSelectedIds).some(set => set.size > 0);

          return {
            selectedIds: nextSelectedIds,
            selectionMode: hasAnySelection,
          };
        }, false, `deselect/${type}`);
      },

      toggleSelect: (type, id, context?) => {
        const { selectedIds, activeContext } = get();
        
        // If context provided and different from active, clear all first
        if (context && activeContext && context !== activeContext) {
          get().clearSelection();
          get().select(type, id);
          set({ activeContext: context }, false, 'toggleSelect/newContext');
          return;
        }
        
        if (selectedIds[type].has(id)) {
          get().deselect(type, id);
        } else {
          get().select(type, id, { additive: true });
        }
        
        if (context) {
          set({ activeContext: context }, false, 'toggleSelect/setContext');
        }
      },

      selectRange: (type, fromId, toId) => {
        const { visibleOrder, selectedIds } = get();
        const order = visibleOrder[type];
        
        const fromIndex = order.indexOf(fromId);
        const toIndex = order.indexOf(toId);
        
        if (fromIndex === -1 || toIndex === -1) return;
        
        const start = Math.min(fromIndex, toIndex);
        const end = Math.max(fromIndex, toIndex);
        
        const rangeIds = order.slice(start, end + 1);
        const newSelected = new Set(selectedIds[type]);
        rangeIds.forEach(id => newSelected.add(id));
        
        const nextSelectedIds = {
          ...get().selectedIds,
          [type]: newSelected,
        };

        set({
          selectedIds: nextSelectedIds,
          selectionMode: true, // Range select always results in selection
        }, false, `selectRange/${type}`);
      },

      selectAll: (type) => {
        const { visibleOrder } = get();
        set({
          selectedIds: {
            ...get().selectedIds,
            [type]: new Set(visibleOrder[type]),
          },
          selectionMode: visibleOrder[type].length > 0,
        }, false, `selectAll/${type}`);
      },

      clearSelection: (type?) => {
        if (type) {
          const nextSelectedIds = {
            ...get().selectedIds,
            [type]: new Set(),
          };
          
          const hasAnySelection = Object.values(nextSelectedIds).some(set => set.size > 0);

          set({
            selectedIds: nextSelectedIds,
            lastClickedId: {
              ...get().lastClickedId,
              [type]: null,
            },
            selectionMode: hasAnySelection,
          }, false, `clearSelection/${type}`);
        } else {
          set({
            selectedIds: createEmptySelection(),
            lastClickedId: createEmptyLastClicked(),
            activeContext: null,
            selectionMode: false,
          }, false, 'clearSelection/all');
        }
      },

      setVisibleOrder: (type, ids) => {
        set({
          visibleOrder: {
            ...get().visibleOrder,
            [type]: ids,
          },
        }, false, `setVisibleOrder/${type}`);
      },

      isSelected: (type, id) => {
        return get().selectedIds[type].has(id);
      },

      getSelectedIds: (type) => {
        return Array.from(get().selectedIds[type]);
      },

      getSelectionCount: (type) => {
        return get().selectedIds[type].size;
      },

      handleItemClick: (type, id, event, context?) => {
        const { lastClickedId, selectedIds, activeContext, selectionMode } = get();
        
        // If context provided and different from active, clear all selections first
        if (context && activeContext && context !== activeContext) {
          get().clearSelection();
        }
        
        // Update active context if provided
        if (context && context !== activeContext) {
          set({ activeContext: context }, false, 'handleItemClick/setContext');
        }
        
        const isAlreadySelected = selectedIds[type].has(id);
        
        // Selection mode or Cmd/Ctrl + Click: Toggle selection
        if (selectionMode || event.metaKey || event.ctrlKey) {
          get().toggleSelect(type, id, context);
          return;
        }
        
        // Shift + Click: Range selection
        if (event.shiftKey && lastClickedId[type]) {
          get().selectRange(type, lastClickedId[type]!, id);
          return;
        }
        
        // Regular click: If multiple selected and clicking a selected item, 
        // keep selection (for context menu). Otherwise, select only this item.
        if (isAlreadySelected && selectedIds[type].size > 1) {
          // Keep current selection, just update lastClickedId
          set({
            lastClickedId: {
              ...get().lastClickedId,
              [type]: id,
            },
          }, false, 'handleItemClick/keepSelection');
          return;
        }
        
        // Clear and select just this item
        get().select(type, id, { exclusive: true });
      },
    }),
    { name: 'planneer-selection' }
  )
);

// Selector for checking if any items are selected
export const selectHasSelection = (type: SelectableEntityType) => (state: SelectionState) =>
  state.selectedIds[type].size > 0;

// Selector for getting selection count
export const selectSelectionCount = (type: SelectableEntityType) => (state: SelectionState) =>
  state.selectedIds[type].size;
