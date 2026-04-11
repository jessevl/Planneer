/**
 * @file selectionStore.test.ts
 * @description Tests for universal multi-selection state management
 * @app SHARED - Selection state testing
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useSelectionStore } from './selectionStore';

describe('selectionStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useSelectionStore.setState({
      selectedIds: { task: new Set(), page: new Set() },
      lastClickedId: { task: null, page: null },
      visibleOrder: { task: [], page: [] },
      activeContext: null,
      selectionMode: false,
    });
  });

  describe('selection mode', () => {
    it('toggles selection mode', () => {
      const { setSelectionMode } = useSelectionStore.getState();
      
      setSelectionMode(true);
      expect(useSelectionStore.getState().selectionMode).toBe(true);
      
      setSelectionMode(false);
      expect(useSelectionStore.getState().selectionMode).toBe(false);
    });

    it('clears selection when disabling selection mode', () => {
      const { select, setSelectionMode } = useSelectionStore.getState();
      
      select('task', 'task-1');
      select('task', 'task-2', { additive: true });
      
      setSelectionMode(false);
      
      expect(useSelectionStore.getState().getSelectedIds('task')).toHaveLength(0);
    });
  });

  describe('select', () => {
    it('selects a single item', () => {
      const { select, isSelected } = useSelectionStore.getState();
      
      select('task', 'task-1');
      
      expect(useSelectionStore.getState().isSelected('task', 'task-1')).toBe(true);
    });

    it('replaces selection by default', () => {
      const { select, getSelectedIds } = useSelectionStore.getState();
      
      select('task', 'task-1');
      select('task', 'task-2');
      
      const selected = useSelectionStore.getState().getSelectedIds('task');
      expect(selected).toHaveLength(1);
      expect(selected).toContain('task-2');
    });

    it('adds to selection with additive option', () => {
      const { select, getSelectedIds } = useSelectionStore.getState();
      
      select('task', 'task-1');
      select('task', 'task-2', { additive: true });
      
      const selected = useSelectionStore.getState().getSelectedIds('task');
      expect(selected).toHaveLength(2);
      expect(selected).toContain('task-1');
      expect(selected).toContain('task-2');
    });

    it('maintains separate selections by type', () => {
      const { select, getSelectedIds } = useSelectionStore.getState();
      
      select('task', 'task-1');
      select('page', 'page-1');
      
      expect(useSelectionStore.getState().getSelectedIds('task')).toContain('task-1');
      expect(useSelectionStore.getState().getSelectedIds('page')).toContain('page-1');
    });
  });

  describe('deselect', () => {
    it('removes item from selection', () => {
      const { select, deselect, isSelected } = useSelectionStore.getState();
      
      select('task', 'task-1');
      select('task', 'task-2', { additive: true });
      deselect('task', 'task-1');
      
      expect(useSelectionStore.getState().isSelected('task', 'task-1')).toBe(false);
      expect(useSelectionStore.getState().isSelected('task', 'task-2')).toBe(true);
    });
  });

  describe('toggleSelect', () => {
    it('toggles item selection', () => {
      const { toggleSelect, isSelected } = useSelectionStore.getState();
      
      toggleSelect('task', 'task-1');
      expect(useSelectionStore.getState().isSelected('task', 'task-1')).toBe(true);
      
      toggleSelect('task', 'task-1');
      expect(useSelectionStore.getState().isSelected('task', 'task-1')).toBe(false);
    });
  });

  describe('clearSelection', () => {
    it('clears all selections for a type', () => {
      const { select, clearSelection, getSelectedIds } = useSelectionStore.getState();
      
      select('task', 'task-1');
      select('task', 'task-2', { additive: true });
      clearSelection('task');
      
      expect(useSelectionStore.getState().getSelectedIds('task')).toHaveLength(0);
    });

    it('clears all selections when no type specified', () => {
      const { select, clearSelection, getSelectedIds } = useSelectionStore.getState();
      
      select('task', 'task-1');
      select('page', 'page-1');
      clearSelection();
      
      expect(useSelectionStore.getState().getSelectedIds('task')).toHaveLength(0);
      expect(useSelectionStore.getState().getSelectedIds('page')).toHaveLength(0);
    });
  });

  describe('selectAll', () => {
    it('selects all items in visible order', () => {
      const { setVisibleOrder, selectAll, getSelectedIds } = useSelectionStore.getState();
      
      setVisibleOrder('task', ['task-1', 'task-2', 'task-3']);
      selectAll('task');
      
      const selected = useSelectionStore.getState().getSelectedIds('task');
      expect(selected).toHaveLength(3);
      expect(selected).toContain('task-1');
      expect(selected).toContain('task-2');
      expect(selected).toContain('task-3');
    });
  });

  describe('visibleOrder', () => {
    it('sets visible order for range selection', () => {
      const { setVisibleOrder } = useSelectionStore.getState();
      
      setVisibleOrder('task', ['task-1', 'task-2', 'task-3']);
      
      expect(useSelectionStore.getState().visibleOrder.task).toEqual(['task-1', 'task-2', 'task-3']);
    });
  });

  describe('selectRange', () => {
    it('selects range of items', () => {
      const { setVisibleOrder, selectRange, getSelectedIds } = useSelectionStore.getState();
      
      setVisibleOrder('task', ['task-1', 'task-2', 'task-3', 'task-4', 'task-5']);
      selectRange('task', 'task-2', 'task-4');
      
      const selected = useSelectionStore.getState().getSelectedIds('task');
      expect(selected).toHaveLength(3);
      expect(selected).toContain('task-2');
      expect(selected).toContain('task-3');
      expect(selected).toContain('task-4');
    });

    it('handles reversed range', () => {
      const { setVisibleOrder, selectRange, getSelectedIds } = useSelectionStore.getState();
      
      setVisibleOrder('task', ['task-1', 'task-2', 'task-3', 'task-4', 'task-5']);
      selectRange('task', 'task-4', 'task-2');
      
      const selected = useSelectionStore.getState().getSelectedIds('task');
      expect(selected).toHaveLength(3);
    });
  });

  describe('getSelectionCount', () => {
    it('returns count of selected items', () => {
      const { select, getSelectionCount } = useSelectionStore.getState();
      
      expect(useSelectionStore.getState().getSelectionCount('task')).toBe(0);
      
      select('task', 'task-1');
      select('task', 'task-2', { additive: true });
      
      expect(useSelectionStore.getState().getSelectionCount('task')).toBe(2);
    });
  });

  describe('handleItemClick', () => {
    it('handles simple click', () => {
      const { handleItemClick, getSelectedIds } = useSelectionStore.getState();
      
      handleItemClick('task', 'task-1', { shiftKey: false, metaKey: false, ctrlKey: false });
      
      expect(useSelectionStore.getState().getSelectedIds('task')).toContain('task-1');
    });

    it('handles cmd/ctrl click for additive selection', () => {
      const { handleItemClick, getSelectedIds } = useSelectionStore.getState();
      
      handleItemClick('task', 'task-1', { shiftKey: false, metaKey: false, ctrlKey: false });
      handleItemClick('task', 'task-2', { shiftKey: false, metaKey: true, ctrlKey: false });
      
      const selected = useSelectionStore.getState().getSelectedIds('task');
      expect(selected).toHaveLength(2);
    });

    it('handles shift click for range selection', () => {
      const { setVisibleOrder, handleItemClick, getSelectedIds } = useSelectionStore.getState();
      
      setVisibleOrder('task', ['task-1', 'task-2', 'task-3', 'task-4']);
      handleItemClick('task', 'task-1', { shiftKey: false, metaKey: false, ctrlKey: false });
      handleItemClick('task', 'task-3', { shiftKey: true, metaKey: false, ctrlKey: false });
      
      const selected = useSelectionStore.getState().getSelectedIds('task');
      // handleItemClick with shift may include both endpoints at minimum
      expect(selected.length).toBeGreaterThanOrEqual(2);
      expect(selected).toContain('task-1');
      expect(selected).toContain('task-3');
    });
  });
});
