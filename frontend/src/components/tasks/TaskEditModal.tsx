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
import { Modal, MobileSheet, ModalFooter } from '@/components/ui';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import AddTaskForm from './AddTaskForm';
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
  /** Called when an existing task is saved */
  onSaveTask?: (task: Task) => void;
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

  // Handle successful task save - close modal after
  const handleSaveTask = useCallback((updatedTask: Task) => {
    onSaveTask?.(updatedTask);
    setIsDirty(false);
    onClose();
  }, [onSaveTask, onClose]);

  // Handle cancel - show confirm if dirty
  const handleCancel = useCallback(() => {
    if (isDirty) {
      setShowConfirmDiscard(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

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
    />
  );

  const footer = (
    <ModalFooter
      onCancel={handleCancel}
      onDelete={mode === 'edit' ? onDeleteTask : undefined}
      submitLabel={mode === 'create' ? 'Create Task' : 'Save'}
      formId="add-task-form"
    />
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
          preventSwipeClose={isDirty}
          closeOnBackdropClick={!isDirty}
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
