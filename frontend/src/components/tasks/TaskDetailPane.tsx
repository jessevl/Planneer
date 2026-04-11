/**
 * @file TaskDetailPane.tsx
 * @description Side pane for viewing and editing task details
 * @app TASKS - Replaces modal when reading pane is enabled
 * 
 * Displays the same content as TaskEditModal but in a persistent side pane.
 * Used when the task detail pane toggle is enabled in TasksView.
 * 
 * Features:
 * - Vertical single-column layout for task editing
 * - Header with task title and close button
 * - Supports both create and edit modes
 * - Empty state when no task is selected
 * - Registers dirty state with global navigation blocker
 */
import React, { useCallback, useState, useEffect } from 'react';
import { X, Check, Trash2, SquareCheck } from 'lucide-react';
import AddTaskForm from './AddTaskForm';
import ConfirmDiscardModal from '../common/ConfirmDiscardModal';
import { Button } from '@/components/ui';
import type { Task } from '@/types/task';
import type { Page } from '@/types/page';
import type { View } from '@/lib/selectors';
import { useTasksStore } from '@/stores/tasksStore';
import { useNavigationBlockerStore } from '@/stores/navigationBlockerStore';
import UnifiedHeader from '../layout/UnifiedHeader';

type TaskCollection = Page;

export interface TaskDetailPaneProps {
  /** Mode: 'create' for new task, 'edit' for existing task, null for empty state */
  mode: 'create' | 'edit' | null;
  /** The task being edited (only for edit mode) */
  task?: Task | null;
  /** Available task collections for assignment */
  taskPages: TaskCollection[];
  /** Currently selected task page ID */
  selectedTaskPageId?: string | null;
  /** Current view for smart defaults */
  currentView?: View;
  /** Default due date override */
  defaultDueDate?: string;
  /** Default section ID */
  defaultSection?: string;
  /** Default tag */
  defaultTag?: string;
  /** Default priority */
  defaultPriority?: 'Low' | 'Medium' | 'High';
  /** Called when pane should close / clear selection */
  onClose: () => void;
  /** Called when an existing task is saved */
  onSaveTask?: (task: Task) => void;
  /** Called when task is deleted */
  onDeleteTask?: () => void;
  /** Called when dirty state changes (for parent navigation guards) */
  onDirtyChange?: (isDirty: boolean) => void;
  /** Hide the internal floating header when embedded in another panel */
  showHeader?: boolean;
}

const TaskDetailPane: React.FC<TaskDetailPaneProps> = ({
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
  onDirtyChange: onDirtyChangeProp,
  showHeader = true,
}) => {
  const [isDirty, setIsDirty] = useState(false);
  const [showConfirmDiscard, setShowConfirmDiscard] = useState(false);
  const deleteTask = useTasksStore((state) => state.deleteTask);
  const updateTask = useTasksStore((state) => state.updateTask);
  const setNavigationDirty = useNavigationBlockerStore(s => s.setDirty);

  // Register dirty state with global navigation blocker
  useEffect(() => {
    setNavigationDirty('task-detail-pane', !!mode && isDirty);
  }, [isDirty, mode, setNavigationDirty]);

  // Cleanup on unmount - clear dirty state
  useEffect(() => {
    return () => {
      setNavigationDirty('task-detail-pane', false);
    };
  }, [setNavigationDirty]);

  // Reset dirty state when task changes or mode changes
  useEffect(() => {
    setIsDirty(false);
  }, [task?.id, mode]);

  // Track dirty state and notify parent
  const handleDirtyChange = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
    onDirtyChangeProp?.(dirty);
  }, [onDirtyChangeProp]);

  // Handle successful task creation
  const handleTaskCreated = useCallback(() => {
    setIsDirty(false);
    onClose();
  }, [onClose]);

  // Handle successful task save
  const handleSaveTask = useCallback((updatedTask: Task) => {
    // Update the task in the store
    updateTask(updatedTask.id, {
      title: updatedTask.title,
      description: updatedTask.description,
      dueDate: updatedTask.dueDate,
      priority: updatedTask.priority,
      parentPageId: updatedTask.parentPageId,
      sectionId: updatedTask.sectionId,
      subtasks: updatedTask.subtasks,
      recurrence: updatedTask.recurrence,
      tag: updatedTask.tag,
    });
    // Also notify parent if callback provided
    onSaveTask?.(updatedTask);
    setIsDirty(false);
    onClose();
  }, [updateTask, onSaveTask, onClose]);

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

  // Handle delete
  const handleDelete = useCallback(() => {
    if (task) {
      deleteTask(task.id);
      onDeleteTask?.();
      onClose();
    }
  }, [task, deleteTask, onDeleteTask, onClose]);

  // Empty state when no task is selected
  if (!mode) {
    return (
      <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center bg-[var(--color-surface-primary)]">
        <div className="text-center text-[var(--color-text-secondary)]">
          <SquareCheck className="w-16 h-16 mx-auto mb-4 opacity-30" strokeWidth={1.5} />
          <p className="text-lg font-medium mb-1">Select a task</p>
          <p className="text-sm">Choose a task from the list to view its details</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[var(--color-surface-primary)]">
      {showHeader ? (
        <div className="sticky top-0 z-30">
          <UnifiedHeader
            currentTitle={mode === 'create' ? 'New Task' : 'Edit Task'}
            className="border-b-0 bg-[var(--color-surface-primary)]/70 backdrop-blur-xl"
            breadcrumbs={[]}
            onTitleClick={undefined}
            inSplitView={true}
            additionalActionsRight={
              <button
                onClick={handleCancel}
                className="rounded-lg p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-secondary)]"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            }
          />
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={showHeader ? 'flex min-h-full flex-col px-4 pb-4 pt-[48px]' : 'flex min-h-full flex-col px-4 py-3'}>
          <AddTaskForm
            key={mode === 'create' ? 'create' : `edit-${task?.id}`}
            mode={mode}
            initialTask={task}
            taskPages={taskPages}
            selectedTaskPageId={selectedTaskPageId}
            currentView={currentView}
            defaultDueDate={defaultDueDate}
            defaultSection={defaultSection}
            defaultTag={defaultTag}
            defaultPriority={defaultPriority}
            layout="single-column"
            onTaskCreated={handleTaskCreated}
            onSaveTask={handleSaveTask}
            onDelete={handleDelete}
            onCancel={handleCancel}
            onDirtyChange={handleDirtyChange}
          />
        </div>
      </div>

      {/* Footer with actions */}
      <div className="mt-auto flex-shrink-0 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-primary)] px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            {mode === 'edit' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Delete
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button 
              variant="primary" 
              size="sm" 
              type="submit" 
              form="add-task-form"
            >
              <Check className="w-4 h-4 mr-1.5" />
              {mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </div>
        </div>
      </div>

      {/* Confirm discard modal */}
      <ConfirmDiscardModal
        open={showConfirmDiscard}
        onCancel={() => setShowConfirmDiscard(false)}
        onDiscard={handleConfirmDiscard}
        message="You have unsaved changes. Discard them?"
      />
    </div>
  );
};

export default TaskDetailPane;
