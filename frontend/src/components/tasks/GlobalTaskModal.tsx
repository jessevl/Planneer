/**
 * @file GlobalTaskModal.tsx
 * @description Global task edit modal that listens to uiStore.editingTaskId
 * @app GLOBAL - Allows editing tasks from anywhere in the app
 * 
 * This modal is rendered in the root layout and uses the uiStore's
 * editingTaskId to determine when to show. This is the single source
 * of truth for task editing - other views should NOT render their own modal.
 * 
 * Default behaviors by context:
 * - Project page: task page set, no date
 * - Inbox: no task page, no date
 * - Today/Upcoming: today's date, no task page
 * - All Tasks: no task page, no date
 * - Home/Daily Journal: today's date, no task page
 */
import React, { useMemo, useCallback, useEffect } from 'react';
import TaskEditModal from './TaskEditModal';
import { useUIStore } from '@/stores/uiStore';
import { useTasksStore } from '@/stores/tasksStore';
import { usePagesStore, type PagesState } from '@/stores/pagesStore';
import { useNavigationBlockerStore } from '@/stores/navigationBlockerStore';
import type { Task } from '@/types/task';
import type { View } from '@/lib/selectors';

const GlobalTaskModal: React.FC = () => {
  // Get editing state from uiStore
  const editingTaskId = useUIStore((s) => s.editingTaskId);
  const isCreatingTask = useUIStore((s) => s.isCreatingTask);
  const taskCreationDefaults = useUIStore((s) => s.taskCreationDefaults);
  const stopEditingTask = useUIStore((s) => s.stopEditingTask);
  const stopCreatingTask = useUIStore((s) => s.stopCreatingTask);
  const setFormDirty = useUIStore((s) => s.setFormDirty);
  
  // Get task data
  const tasksById = useTasksStore((s) => s.tasksById);
  const updateTask = useTasksStore((s) => s.updateTask);
  const deleteTask = useTasksStore((s) => s.deleteTask);
  
  // Get task-capable pages: pages in tasks view mode OR pages that have tasks assigned
  const pagesById = usePagesStore((s: PagesState) => s.pagesById);
  const taskPages = useMemo(() => {
    const taskParentIds = new Set(
      Object.values(tasksById).map(t => t.parentPageId).filter(Boolean)
    );
    return Object.values(pagesById).filter(
      p => p.viewMode === 'tasks' || taskParentIds.has(p.id)
    );
  }, [pagesById, tasksById]);
  
  // Derive the task being edited
  const editingTask = useMemo(() => {
    if (!editingTaskId) return null;
    return tasksById[editingTaskId] || null;
  }, [editingTaskId, tasksById]);
  
  // Show for both editing and creating
  const isOpen = editingTaskId !== null || isCreatingTask;
  const mode = isCreatingTask ? 'create' : 'edit';
  
  // Determine defaults from taskCreationDefaults
  // If defaultTaskPageId is set, we're in task page view
  // If defaultDueDate is set (today/upcoming), use that view context
  const selectedTaskPageId = taskCreationDefaults?.defaultTaskPageId || null;
  const currentView: View = taskCreationDefaults?.defaultTaskPageId 
    ? 'taskPage' 
    : taskCreationDefaults?.defaultDueDate 
      ? 'today'  // triggers date default in AddTaskForm
      : 'all';   // no defaults
  
  const handleClose = useCallback(() => {
    if (isCreatingTask) {
      stopCreatingTask();
    } else {
      stopEditingTask();
    }
    setFormDirty(false);
  }, [isCreatingTask, stopCreatingTask, stopEditingTask, setFormDirty]);
  
  const handleSaveTask = useCallback((task: Task) => {
    // updateTask takes (id, updates) - pass the full task as updates
    updateTask(task.id, task);
    handleClose();
  }, [updateTask, handleClose]);
  
  const handleDeleteTask = useCallback(() => {
    if (editingTask?.id) {
      deleteTask(editingTask.id);
      handleClose();
    }
  }, [editingTask?.id, deleteTask, handleClose]);
  
  // Track form dirty state
  const formDirty = useUIStore((s) => s.formDirty);
  const setNavigationDirty = useNavigationBlockerStore(s => s.setDirty);
  
  // Register dirty state with global navigation blocker
  useEffect(() => {
    setNavigationDirty('global-task-modal', formDirty && isOpen);
  }, [formDirty, isOpen, setNavigationDirty]);

  // Reset dirty state when task changes or creation mode changes
  useEffect(() => {
    setFormDirty(false);
  }, [editingTaskId, isCreatingTask, setFormDirty]);

  // Cleanup on unmount - clear dirty state
  useEffect(() => {
    return () => {
      setNavigationDirty('global-task-modal', false);
    };
  }, [setNavigationDirty]);
  
  const handleDirtyChange = useCallback((dirty: boolean) => {
    setFormDirty(dirty);
  }, [setFormDirty]);
  
  // Don't render if not open
  if (!isOpen) return null;
  
  return (
    <TaskEditModal
      isOpen={isOpen}
      mode={mode}
      task={editingTask}
      taskPages={taskPages}
      selectedTaskPageId={selectedTaskPageId}
      currentView={currentView}
      defaultDueDate={taskCreationDefaults?.defaultDueDate}
      defaultSection={taskCreationDefaults?.defaultSection}
      defaultTag={taskCreationDefaults?.defaultTags?.[0]}
      defaultPriority={taskCreationDefaults?.defaultPriority}
      onClose={handleClose}
      onSaveTask={handleSaveTask}
      onDeleteTask={handleDeleteTask}
      onDirtyChange={handleDirtyChange}
    />
  );
};

export default GlobalTaskModal;
