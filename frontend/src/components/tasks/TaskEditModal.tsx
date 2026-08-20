/**
 * @file TaskEditModal.tsx
 * @description Modal wrapper for task creation and editing
 * @app TASKS APP ONLY - Modal interface for AddTaskForm
 * 
 * Wraps AddTaskForm in a modal dialog for creating and editing tasks.
 * Provides a cleaner, more focused editing experience compared to inline editing.
 * 
 * Features:
 * - Clean modal design with close button
 * - Supports both create and edit modes
 * - Handles dirty state for unsaved changes protection
 * - Keyboard support (Escape to close)
 * - Mobile: Uses MobileSheet for bottom sheet presentation
 * 
 * Note: Task creation is handled directly by AddTaskForm via the store.
 * This modal just provides the wrapper and handles close/dirty state.
 */
import React, { useCallback, useState } from 'react';
import { Modal, MobileSheet, ModalFooter, Button } from '@/components/ui';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import { cn } from '@/lib/design-system';
import AddTaskForm, { type TaskSaveStatus } from './AddTaskForm';
import SaveStatusDot from './SaveStatusDot';
import ConfirmDiscardModal from '../common/ConfirmDiscardModal';
import type { Task } from '@/types/task';
import type { Page } from '@/types/page';
import type { View } from '@/lib/selectors';

// Task collections are now Page type with viewMode='tasks'
type TaskCollection = Page;

export interface TaskEditModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Mode: 'create' for new task, 'edit' for existing task */
  mode: 'create' | 'edit';
  /** The task being edited (only for edit mode) */
  task?: Task | null;
  /** Available task collections (pages with viewMode='tasks') for assignment */
  taskPages: TaskCollection[];
  /** Currently selected task page ID (for defaulting new tasks) */
  selectedTaskPageId?: string | null;
  /** Current view (for smart defaults) */
  currentView?: View;
  /** Default due date override (e.g., for DailyJournalView) */
  defaultDueDate?: string;
  /** Default section ID (for kanban column creation) */
  defaultSection?: string;
  /** Default tag (for kanban tag column creation) */
  defaultTag?: string;
  /** Default priority (for kanban priority column creation) */
  defaultPriority?: 'Low' | 'Medium' | 'High';
  /** Called when modal should close */
  onClose: () => void;
  /** Called when an existing task is saved. `options.auto` is set for
   *  debounced auto-saves, as opposed to an explicit Save click. */
  onSaveTask?: (task: Task, options?: { auto?: boolean }) => void;
  /** Called when task is deleted */
  onDeleteTask?: () => void;
  /** Called when dirty state changes */
  onDirtyChange?: (dirty: boolean) => void;
}

const TaskEditModal: React.FC<TaskEditModalProps> = ({
  isOpen,
  mode,
  task,
  taskPages,
  selectedTaskPageId,
  currentView = 'all',
  defaultDueDate,
  defaultSection,
  defaultTag,
  defaultPriority,
  onClose,
  onSaveTask,
  onDeleteTask,
  onDirtyChange,
}) => {
  const isMobile = useIsMobile();
  const [isDirty, setIsDirty] = useState(false);
  const [showConfirmDiscard, setShowConfirmDiscard] = useState(false);
  const [saveStatus, setSaveStatus] = useState<TaskSaveStatus>('idle');

  // Track dirty state locally and notify parent
  const handleDirtyChange = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
    onDirtyChange?.(dirty);
  }, [onDirtyChange]);

  // Handle successful task creation - close modal
  const handleTaskCreated = useCallback(() => {
    setIsDirty(false);
    onClose();
  }, [onClose]);

  // Handle successful task save. Auto-saves (from the debounced editor)
  // persist in the background without closing the modal; only an explicit
  // Save click closes it.
  const handleSaveTask = useCallback((updatedTask: Task, options?: { auto?: boolean }) => {
    onSaveTask?.(updatedTask, options);
    if (options?.auto) return;
    setIsDirty(false);
    onClose();
  }, [onSaveTask, onClose]);

  // Handle cancel. Existing tasks auto-save as you type, so there is
  // nothing to discard — just close. Only a brand-new (unsaved) task needs
  // a discard confirmation.
  const handleCancel = useCallback(() => {
    if (isDirty && mode === 'create') {
      setShowConfirmDiscard(true);
    } else {
      setIsDirty(false);
      onClose();
    }
  }, [isDirty, mode, onClose]);

  // Handle discard confirmation
  const handleConfirmDiscard = useCallback(() => {
    setShowConfirmDiscard(false);
    setIsDirty(false);
    onClose();
  }, [onClose]);

  // Handle cancel discard (go back to editing)
  const handleCancelDiscard = useCallback(() => {
    setShowConfirmDiscard(false);
  }, []);

  if (!isOpen) return null;

  const formContent = (
    <AddTaskForm
      mode={mode}
      initialTask={task}
      taskPages={taskPages}
      selectedTaskPageId={selectedTaskPageId}
      currentView={currentView}
      defaultDueDate={defaultDueDate}
      defaultSection={defaultSection}
      defaultTag={defaultTag}
      defaultPriority={defaultPriority}
      onTaskCreated={handleTaskCreated}
      onSaveTask={handleSaveTask}
      onDelete={onDeleteTask}
      onCancel={handleCancel}
      onDirtyChange={handleDirtyChange}
      onSaveStatusChange={setSaveStatus}
    />
  );

  // Create mode keeps the standard Cancel/Create Task footer. Edit mode gets
  // a custom layout: existing tasks auto-save as you type, so "Cancel" would
  // be misleading — instead there's an always-enabled "Close" plus a "Save"
  // that's only clickable while there's a pending change to flush, with the
  // Save button itself showing the auto-save status (pulsing dot -> check).
  const footer = mode === 'create' ? (
    <ModalFooter
      onCancel={handleCancel}
      submitLabel="Create Task"
      formId="add-task-form"
    />
  ) : (
    <div className={cn('flex items-center gap-2 w-full', isMobile ? 'flex-col' : 'justify-between')}>
      <div className={isMobile ? 'w-full' : ''}>
        {onDeleteTask && (
          <Button
            type="button"
            onClick={onDeleteTask}
            variant="danger-outline"
            size={isMobile ? 'lg' : 'md'}
            className={isMobile ? 'w-full' : ''}
          >
            Delete
          </Button>
        )}
      </div>
      <div className={cn('flex items-center gap-2', isMobile && 'w-full')}>
        <Button
          type="button"
          onClick={handleCancel}
          variant="ghost"
          size={isMobile ? 'lg' : 'md'}
          className={cn('border border-[var(--color-border-default)]', isMobile && 'flex-1')}
        >
          Close
        </Button>
        <Button
          type="submit"
          form="add-task-form"
          variant="primary"
          size={isMobile ? 'lg' : 'md'}
          disabled={!isDirty}
          className={cn('shadow-lg shadow-[var(--color-interactive-bg-strong)]/20', isMobile && 'flex-1')}
        >
          <SaveStatusDot status={saveStatus} />
          Save
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile: Use MobileSheet for bottom sheet presentation */}
      {isMobile ? (
        <MobileSheet
          isOpen={isOpen}
          onClose={handleCancel}
          title={mode === 'create' ? 'New Task' : 'Edit Task'}
          maxHeight="85vh"
          preventSwipeClose={isDirty && mode === 'create'}
          closeOnBackdropClick={mode === 'edit' || !isDirty}
        >
          <div className="p-4">
            {formContent}
            <div className="mt-6">
              {footer}
            </div>
          </div>
        </MobileSheet>
      ) : (
        /* Desktop: Use Modal */
        <Modal
          isOpen={isOpen}
          onClose={handleCancel}
          size="2xl"
          mobileFullScreen={false}
          title={mode === 'create' ? 'New Task' : 'Edit Task'}
          footer={footer}
        >
          {formContent}
        </Modal>
      )}

      <ConfirmDiscardModal
        open={showConfirmDiscard}
        onCancel={handleCancelDiscard}
        onDiscard={handleConfirmDiscard}
        message="You have unsaved changes. Discard them?"
      />
    </>
  );
};

export default TaskEditModal;
