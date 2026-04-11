/**
 * @file uiStore.test.ts
 * @description Tests for UI state management
 * @app SHARED - UI state testing
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from './uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useUIStore.setState({
      editingTaskId: null,
      isCreatingTask: false,
      formDirty: false,
      isCreatingTaskPage: false,
      editingTaskPageId: null,
      managingSectionsTaskPageId: null,
      isPageEditorFocused: false,
      activeTextMarks: new Set(),
      pageMoveTarget: null,
      taskPaneTaskId: null,
      taskPaneMode: null,
      taskPaneDefaults: null,
      activeModal: null,
      modalData: {},
      pendingNavigation: null,
      settingsModal: { isOpen: false, section: 'general' },
    });
  });

  describe('task editing state', () => {
    it('starts editing a task', () => {
      const { startEditingTask } = useUIStore.getState();
      
      startEditingTask('task-123');
      
      expect(useUIStore.getState().editingTaskId).toBe('task-123');
    });

    it('stops editing a task', () => {
      const { startEditingTask, stopEditingTask } = useUIStore.getState();
      
      startEditingTask('task-123');
      stopEditingTask();
      
      expect(useUIStore.getState().editingTaskId).toBeNull();
    });

    it('starts creating a task', () => {
      const { startCreatingTask } = useUIStore.getState();
      
      startCreatingTask();
      expect(useUIStore.getState().isCreatingTask).toBe(true);
    });

    it('starts creating a task with defaults', () => {
      const { startCreatingTask } = useUIStore.getState();
      
      startCreatingTask({ defaultDueDate: '2025-01-06' });
      expect(useUIStore.getState().isCreatingTask).toBe(true);
    });

    it('stops creating a task', () => {
      const { startCreatingTask, stopCreatingTask } = useUIStore.getState();
      
      startCreatingTask();
      stopCreatingTask();
      expect(useUIStore.getState().isCreatingTask).toBe(false);
    });

    it('sets form dirty state', () => {
      const { setFormDirty } = useUIStore.getState();
      
      setFormDirty(true);
      expect(useUIStore.getState().formDirty).toBe(true);
      
      setFormDirty(false);
      expect(useUIStore.getState().formDirty).toBe(false);
    });
  });

  describe('task page editing state', () => {
    it('starts creating task page', () => {
      const { startCreatingTaskPage } = useUIStore.getState();
      
      startCreatingTaskPage();
      expect(useUIStore.getState().isCreatingTaskPage).toBe(true);
    });

    it('stops creating task page', () => {
      const { startCreatingTaskPage, stopCreatingTaskPage } = useUIStore.getState();
      
      startCreatingTaskPage();
      stopCreatingTaskPage();
      expect(useUIStore.getState().isCreatingTaskPage).toBe(false);
    });

    it('starts editing task page', () => {
      const { startEditingTaskPage } = useUIStore.getState();
      
      startEditingTaskPage('project-123');
      expect(useUIStore.getState().editingTaskPageId).toBe('project-123');
    });

    it('stops editing task page', () => {
      const { startEditingTaskPage, stopEditingTaskPage } = useUIStore.getState();
      
      startEditingTaskPage('project-123');
      stopEditingTaskPage();
      expect(useUIStore.getState().editingTaskPageId).toBeNull();
    });

    it('opens section manager', () => {
      const { openSectionManager } = useUIStore.getState();
      
      openSectionManager('project-123');
      expect(useUIStore.getState().managingSectionsTaskPageId).toBe('project-123');
    });

    it('closes section manager', () => {
      const { openSectionManager, closeSectionManager } = useUIStore.getState();
      
      openSectionManager('project-123');
      closeSectionManager();
      expect(useUIStore.getState().managingSectionsTaskPageId).toBeNull();
    });
  });

  describe('page editor focus', () => {
    it('sets page editor focused state', () => {
      const { setPageEditorFocused } = useUIStore.getState();
      
      setPageEditorFocused(true);
      expect(useUIStore.getState().isPageEditorFocused).toBe(true);
      
      setPageEditorFocused(false);
      expect(useUIStore.getState().isPageEditorFocused).toBe(false);
    });

    it('sets active text marks', () => {
      const { setActiveTextMarks } = useUIStore.getState();
      
      setActiveTextMarks(new Set(['bold', 'italic']));
      
      expect(useUIStore.getState().activeTextMarks.has('bold')).toBe(true);
      expect(useUIStore.getState().activeTextMarks.has('italic')).toBe(true);
    });
  });

  describe('task pane state', () => {
    it('opens task pane for editing', () => {
      const { openTaskPane } = useUIStore.getState();
      
      openTaskPane('edit', 'task-123');
      
      expect(useUIStore.getState().taskPaneMode).toBe('edit');
      expect(useUIStore.getState().taskPaneTaskId).toBe('task-123');
    });

    it('opens task pane for creating', () => {
      const { openTaskPane } = useUIStore.getState();
      
      openTaskPane('create');
      
      expect(useUIStore.getState().taskPaneMode).toBe('create');
    });

    it('opens task pane with defaults', () => {
      const { openTaskPane } = useUIStore.getState();
      
      openTaskPane('create', null, { defaultDueDate: '2025-01-06' });
      
      expect(useUIStore.getState().taskPaneDefaults?.defaultDueDate).toBe('2025-01-06');
    });

    it('closes task pane', () => {
      const { openTaskPane, closeTaskPane } = useUIStore.getState();
      
      openTaskPane('edit', 'task-123');
      closeTaskPane();
      
      expect(useUIStore.getState().taskPaneTaskId).toBeNull();
      expect(useUIStore.getState().taskPaneMode).toBeNull();
    });
  });

  describe('page move picker', () => {
    it('opens page move picker', () => {
      const { openPageMovePicker } = useUIStore.getState();
      
      openPageMovePicker('page-123', 'My Page');
      
      expect(useUIStore.getState().pageMoveTarget).toEqual({
        pageId: 'page-123',
        pageTitle: 'My Page',
      });
    });

    it('closes page move picker', () => {
      const { openPageMovePicker, closePageMovePicker } = useUIStore.getState();
      
      openPageMovePicker('page-123', 'My Page');
      closePageMovePicker();
      
      expect(useUIStore.getState().pageMoveTarget).toBeNull();
    });
  });

  describe('modals', () => {
    it('opens a modal with data', () => {
      const { openModal } = useUIStore.getState();
      
      openModal('confirm-discard', { message: 'Discard changes?' });
      
      expect(useUIStore.getState().activeModal).toBe('confirm-discard');
      expect(useUIStore.getState().modalData).toEqual({ message: 'Discard changes?' });
    });

    it('closes a modal', () => {
      const { openModal, closeModal } = useUIStore.getState();
      
      openModal('confirm-discard', {});
      closeModal();
      
      expect(useUIStore.getState().activeModal).toBeNull();
    });
  });

  describe('settings modal', () => {
    it('opens settings modal', () => {
      const { openSettingsModal } = useUIStore.getState();
      
      openSettingsModal('account');
      
      const { settingsModal } = useUIStore.getState();
      expect(settingsModal.isOpen).toBe(true);
      expect(settingsModal.section).toBe('account');
    });

    it('opens settings modal with default section', () => {
      const { openSettingsModal } = useUIStore.getState();
      
      openSettingsModal();
      
      expect(useUIStore.getState().settingsModal.isOpen).toBe(true);
      expect(useUIStore.getState().settingsModal.section).toBe('general');
    });

    it('closes settings modal', () => {
      const { openSettingsModal, closeSettingsModal } = useUIStore.getState();
      
      openSettingsModal('account');
      closeSettingsModal();
      
      expect(useUIStore.getState().settingsModal.isOpen).toBe(false);
    });
  });
});
