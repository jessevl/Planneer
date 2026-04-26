/**
 * @file uiStore.ts
 * @description UI state management with Zustand
 * @app SHARED - Manages editing state, modals, and navigation guards
 * 
 * Unified store for:
 * - Task editing state (editingTaskId, isCreatingTask, formDirty)
 * - Task Page editing state (isCreatingTaskPage, editingTaskPageId, managingSectionsTaskPageId)
 * - Modal management (activeModal, modalData)
 * - Unsaved changes protection (pendingNavigation)
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { useNavigationStore } from './navigationStore';

export type ModalType =
  | 'confirm-discard'
  | 'add-taskPage'
  | 'edit-taskPage'
  | 'manage-sections'
  | 'rename-page'
  | 'delete-confirm'
  | 'item-properties';

interface PendingNavigation {
  type: 'view' | 'task' | 'page';
  target: string | null;
}

// Page move picker state
interface PageMoveState {
  pageId: string;
  pageTitle: string;
}

// Settings modal section types (mirrors SettingsModal.tsx)
export type SettingsSection = 'general' | 'account' | 'storage' | 'ai-models' | 'workspace-general' | 'workspace-members' | 'workspace-data' | 'workspace-danger' | 'productivity' | 'pomodoro' | 'about';

interface SettingsModalState {
  isOpen: boolean;
  section: SettingsSection;
}

interface UIState {
  // Task Editing State
  editingTaskId: string | null;
  isCreatingTask: boolean;
  formDirty: boolean;

  // Task Page Editing State (Legacy: Project)
  isCreatingTaskPage: boolean;
  editingTaskPageId: string | null;
  managingSectionsTaskPageId: string | null;
  
  // Page Editor Focus State (for FAB text formatting button)
  isPageEditorFocused: boolean;
  
  // Active text marks in editor (for showing active state in FAB toolbar)
  activeTextMarks: Set<string>;
  
  // Page move picker state (for moving pages to collections)
  pageMoveTarget: PageMoveState | null;

  // Task Pane State (for split view reading panes)
  taskPaneTaskId: string | null;
  taskPaneMode: 'create' | 'edit' | null;
  taskPaneDefaults: {
    defaultDueDate?: string;
    defaultTaskPageId?: string;
    defaultSection?: string;
    defaultTags?: string[];
    defaultPriority?: 'Low' | 'Medium' | 'High';
  } | null;

  // Modals
  activeModal: ModalType | null;
  modalData: Record<string, unknown>;

  // Pending Navigation (for unsaved changes protection)
  pendingNavigation: PendingNavigation | null;
  
  // Task creation defaults (for context-aware creation)
  taskCreationDefaults: { 
    defaultDueDate?: string;
    defaultTaskPageId?: string;
    defaultSection?: string;
    defaultTags?: string[];
    defaultPriority?: 'Low' | 'Medium' | 'High';
  } | null;

  // PWA Install State
  isPWAInstalled: boolean;
  isPWADismissed: boolean;
  setPWAInstalled: (installed: boolean) => void;
  setPWADismissed: (dismissed: boolean) => void;

  // Task Actions
  startEditingTask: (id: string) => void;
  stopEditingTask: () => void;
  startCreatingTask: (defaults?: { defaultDueDate?: string; defaultTaskPageId?: string; defaultSection?: string; defaultTags?: string[]; defaultPriority?: 'Low' | 'Medium' | 'High' }) => void;
  stopCreatingTask: () => void;
  openTaskInContext: (id: string) => void;
  createTaskInContext: (defaults?: { defaultDueDate?: string; defaultTaskPageId?: string; defaultSection?: string; defaultTags?: string[]; defaultPriority?: 'Low' | 'Medium' | 'High' } | null) => void;
  setFormDirty: (dirty: boolean) => void;

  // Task Page Actions (Legacy: Project)
  startCreatingTaskPage: () => void;
  stopCreatingTaskPage: () => void;
  startEditingTaskPage: (id: string) => void;
  stopEditingTaskPage: () => void;
  openSectionManager: (taskPageId: string) => void;
  closeSectionManager: () => void;
  
  // Page Editor Focus (for FAB text formatting button)
  setPageEditorFocused: (focused: boolean) => void;
  
  // Active text marks
  setActiveTextMarks: (marks: Set<string>) => void;
  
  // Page move picker
  openPageMovePicker: (pageId: string, pageTitle: string) => void;
  closePageMovePicker: () => void;

  // Task Pane Actions
  openTaskPane: (mode: 'create' | 'edit', taskId?: string | null, defaults?: UIState['taskPaneDefaults']) => void;
  closeTaskPane: () => void;

  // Settings Modal (global access from anywhere)
  settingsModal: SettingsModalState;
  openSettingsModal: (section?: SettingsSection) => void;
  closeSettingsModal: () => void;

  // Modal Actions
  openModal: (type: ModalType, data?: Record<string, unknown>) => void;
  closeModal: () => void;

  // Navigation Guards
  requestNavigation: (nav: PendingNavigation) => boolean;
  confirmDiscard: () => void;
  cancelDiscard: () => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    (set, get) => ({
      // Initial state
      editingTaskId: null,
      isCreatingTask: false,
      formDirty: false,
      isCreatingTaskPage: false,
      editingTaskPageId: null,
      managingSectionsTaskPageId: null,
      isPageEditorFocused: false,
      activeTextMarks: new Set<string>(),
      pageMoveTarget: null,
      taskPaneTaskId: null,
      taskPaneMode: null,
      taskPaneDefaults: null,
      settingsModal: { isOpen: false, section: 'general' },
      activeModal: null,
      modalData: {},
      pendingNavigation: null,
      taskCreationDefaults: null,
      isPWAInstalled: false,
      isPWADismissed: false,

      // PWA Actions
      setPWAInstalled: (installed) => set({ isPWAInstalled: installed }),
      setPWADismissed: (dismissed) => set({ isPWADismissed: dismissed }),

      // Task editing
      startEditingTask: (id) => {
        const { formDirty, editingTaskId } = get();
        if (formDirty && editingTaskId !== id) {
          set(
            {
              pendingNavigation: { type: 'task', target: id },
              activeModal: 'confirm-discard',
            },
            false,
            'startEditingTask/unsaved'
          );
          return;
        }
        set({ editingTaskId: id, isCreatingTask: false, formDirty: false }, false, 'startEditingTask');
      },

      stopEditingTask: () => {
        set(
          {
            editingTaskId: null,
            isCreatingTask: false,
            formDirty: false,
          },
          false,
          'stopEditingTask'
        );
      },

      startCreatingTask: (defaults) =>
        set(
          {
            isCreatingTask: true,
            editingTaskId: null,
            formDirty: false,
            taskCreationDefaults: defaults || null,
          },
          false,
          'startCreatingTask'
        ),

      stopCreatingTask: () => set({ isCreatingTask: false, formDirty: false, taskCreationDefaults: null }, false, 'stopCreatingTask'),

      openTaskInContext: (id) => {
        const { sidePanelOpen, openSidePanel } = useNavigationStore.getState();

        if (sidePanelOpen) {
          openSidePanel('task-editor');
          get().openTaskPane('edit', id);
          return;
        }

        get().startEditingTask(id);
      },

      createTaskInContext: (defaults = null) => {
        const { sidePanelOpen, openSidePanel } = useNavigationStore.getState();

        if (sidePanelOpen) {
          openSidePanel('task-editor');
          get().openTaskPane('create', null, defaults ?? undefined);
          return;
        }

        get().startCreatingTask(defaults ?? undefined);
      },

      setFormDirty: (dirty) => set({ formDirty: dirty }, false, 'setFormDirty'),

      // Task Page editing (Legacy: Project)
      startCreatingTaskPage: () =>
        set({ isCreatingTaskPage: true, editingTaskPageId: null }, false, 'startCreatingTaskPage'),
      stopCreatingTaskPage: () => set({ isCreatingTaskPage: false }, false, 'stopCreatingTaskPage'),
      startEditingTaskPage: (id) =>
        set({ editingTaskPageId: id, isCreatingTaskPage: false }, false, 'startEditingTaskPage'),
      stopEditingTaskPage: () => set({ editingTaskPageId: null }, false, 'stopEditingTaskPage'),

      openSectionManager: (taskPageId) =>
        set(
          {
            managingSectionsTaskPageId: taskPageId,
            activeModal: 'manage-sections',
          },
          false,
          'openSectionManager'
        ),
      closeSectionManager: () =>
        set(
          {
            managingSectionsTaskPageId: null,
            activeModal: null,
          },
          false,
          'closeSectionManager'
        ),
        
      // Page editor focus
      setPageEditorFocused: (focused) =>
        set({ isPageEditorFocused: focused }, false, 'setPageEditorFocused'),
        
      // Active text marks
      setActiveTextMarks: (marks) =>
        set({ activeTextMarks: marks }, false, 'setActiveTextMarks'),
        
      // Page move picker
      openPageMovePicker: (pageId, pageTitle) =>
        set({ pageMoveTarget: { pageId, pageTitle } }, false, 'openPageMovePicker'),
      closePageMovePicker: () =>
        set({ pageMoveTarget: null }, false, 'closePageMovePicker'),

      // Task Pane Actions
      openTaskPane: (mode, taskId = null, defaults = null) =>
        set(
          { 
            taskPaneMode: mode, 
            taskPaneTaskId: taskId, 
            taskPaneDefaults: defaults,
            // Automatically stop modal editing when pane opens to avoid dual-editing UI
            editingTaskId: null,
            isCreatingTask: false,
          }, 
          false, 
          'openTaskPane'
        ),
      closeTaskPane: () =>
        set(
          { 
            taskPaneMode: null, 
            taskPaneTaskId: null, 
            taskPaneDefaults: null 
          }, 
          false, 
          'closeTaskPane'
        ),

      // Settings Modal (global access)
      openSettingsModal: (section = 'general') =>
        set({ settingsModal: { isOpen: true, section } }, false, 'openSettingsModal'),
      closeSettingsModal: () =>
        set({ settingsModal: { isOpen: false, section: 'general' } }, false, 'closeSettingsModal'),

      // Modals
      openModal: (type, data = {}) => set({ activeModal: type, modalData: data }, false, 'openModal'),
      closeModal: () => set({ activeModal: null, modalData: {} }, false, 'closeModal'),

      // Navigation guards for unsaved changes
      requestNavigation: (nav) => {
        if (get().formDirty) {
          set(
            {
              pendingNavigation: nav,
              activeModal: 'confirm-discard',
            },
            false,
            'requestNavigation'
          );
          return false;
        }
        return true;
      },

      confirmDiscard: () => {
        set(
          {
            activeModal: null,
            pendingNavigation: null,
            formDirty: false,
            editingTaskId: null,
            isCreatingTask: false,
          },
          false,
          'confirmDiscard'
        );
      },

      cancelDiscard: () =>
        set(
          {
            activeModal: null,
            pendingNavigation: null,
          },
          false,
          'cancelDiscard'
        ),
    }),
    { name: 'UIStore' }
  )
);

// Selectors
export const selectIsEditing = (state: UIState) => state.editingTaskId !== null || state.isCreatingTask;

export const selectHasUnsavedChanges = (state: UIState) => state.formDirty;

export const selectIsPageEditorFocused = (state: UIState) => state.isPageEditorFocused;

/** @deprecated Use selectIsPageEditorFocused */
export const selectIsNoteEditorFocused = selectIsPageEditorFocused;

/**
 * Legacy Aliases for Project -> Task Page refactor
 */
export const useUIStoreLegacy = () => {
  const store = useUIStore();
  return {
    ...store,
    /** @deprecated Use isCreatingTaskPage */
    isCreatingProject: store.isCreatingTaskPage,
    /** @deprecated Use editingTaskPageId */
    editingProjectId: store.editingTaskPageId,
    /** @deprecated Use managingSectionsTaskPageId */
    managingSectionsProjectId: store.managingSectionsTaskPageId,
    /** @deprecated Use startCreatingTaskPage */
    startCreatingProject: store.startCreatingTaskPage,
    /** @deprecated Use stopCreatingTaskPage */
    stopCreatingProject: store.stopCreatingTaskPage,
    /** @deprecated Use startEditingTaskPage */
    startEditingProject: store.startEditingTaskPage,
    /** @deprecated Use stopEditingTaskPage */
    stopEditingProject: store.stopEditingTaskPage,
    /** @deprecated Use isPageEditorFocused */
    isNoteEditorFocused: store.isPageEditorFocused,
    /** @deprecated Use setPageEditorFocused */
    setNoteEditorFocused: store.setPageEditorFocused,
  };
};
