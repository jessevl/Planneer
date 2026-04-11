/**
 * @file tasksStore.test.ts
 * @description Unit tests for tasks store
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { selectTaskPreviewStatsByPage, useTasksStore } from './tasksStore';
import type { Task, Subtask } from '@/types/task';

// Mock the sync adapter
vi.mock('@/lib/syncAdapter', () => ({
  offlineCreateTask: vi.fn(),
  offlineUpdateTask: vi.fn().mockResolvedValue(undefined),
  offlineDeleteTask: vi.fn().mockResolvedValue(undefined),
}));

// Mock the sync engine
vi.mock('@/lib/syncEngine/index', () => ({
  syncEngine: {
    recordTaskChange: vi.fn(),
  },
}));

// Helper to create a mock task
function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test Task',
    description: '',
    dueDate: '2025-01-15',
    priority: 'Medium',
    completed: false,
    completedAt: null,
    parentPageId: null,
    sectionId: null,
    subtasks: [],
    order: 0,
    created: '2025-01-15T00:00:00Z',
    updated: '2025-01-15T00:00:00Z',
    ...overrides,
  } as Task;
}

describe('tasksStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));

    // Reset store to initial state
    useTasksStore.setState({
      tasksById: {},
      taskOrder: [],
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('applyBulkLoad', () => {
    it('loads tasks into store', () => {
      const tasks = [
        createMockTask({ id: 'task-1', title: 'Task 1' }),
        createMockTask({ id: 'task-2', title: 'Task 2' }),
      ];
      
      useTasksStore.getState().applyBulkLoad(tasks);
      
      const state = useTasksStore.getState();
      expect(Object.keys(state.tasksById)).toHaveLength(2);
      expect(state.tasksById['task-1'].title).toBe('Task 1');
      expect(state.tasksById['task-2'].title).toBe('Task 2');
      expect(state.isLoading).toBe(false);
    });

    it('replaces existing tasks (authoritative load)', () => {
      // Set initial task
      useTasksStore.setState({
        tasksById: { 'task-1': createMockTask({ id: 'task-1', title: 'Original' }) },
        taskOrder: ['task-1'],
      });
      
      // Load new tasks (this should replace existing)
      const newTasks = [createMockTask({ id: 'task-2', title: 'New Task' })];
      useTasksStore.getState().applyBulkLoad(newTasks);
      
      const state = useTasksStore.getState();
      expect(Object.keys(state.tasksById)).toHaveLength(1);
      expect(state.tasksById['task-1']).toBeUndefined();
      expect(state.tasksById['task-2'].title).toBe('New Task');
    });
  });

  describe('applyRemoteChange', () => {
    it('handles create action', () => {
      const newTask = createMockTask({ id: 'task-new', title: 'New Task' });
      
      useTasksStore.getState().applyRemoteChange({
        action: 'create',
        record: newTask,
        recordId: newTask.id,
      });
      
      const state = useTasksStore.getState();
      expect(state.tasksById['task-new']).toBeDefined();
      expect(state.tasksById['task-new'].title).toBe('New Task');
      expect(state.taskOrder).toContain('task-new');
    });

    it('handles update action', () => {
      // Set initial task
      useTasksStore.setState({
        tasksById: { 'task-1': createMockTask({ id: 'task-1', title: 'Original' }) },
        taskOrder: ['task-1'],
      });
      
      const updatedTask = createMockTask({ id: 'task-1', title: 'Updated' });
      
      useTasksStore.getState().applyRemoteChange({
        action: 'update',
        record: updatedTask,
        recordId: updatedTask.id,
      });
      
      expect(useTasksStore.getState().tasksById['task-1'].title).toBe('Updated');
    });

    it('handles delete action', () => {
      // Set initial task
      useTasksStore.setState({
        tasksById: { 'task-1': createMockTask({ id: 'task-1' }) },
        taskOrder: ['task-1'],
      });
      
      useTasksStore.getState().applyRemoteChange({
        action: 'delete',
        recordId: 'task-1',
      });
      
      const state = useTasksStore.getState();
      expect(state.tasksById['task-1']).toBeUndefined();
      expect(state.taskOrder).not.toContain('task-1');
    });

    it('ignores create for existing task', () => {
      const existingTask = createMockTask({ id: 'task-1', title: 'Existing' });
      useTasksStore.setState({
        tasksById: { 'task-1': existingTask },
        taskOrder: ['task-1'],
      });
      
      const duplicateTask = createMockTask({ id: 'task-1', title: 'Duplicate' });
      
      useTasksStore.getState().applyRemoteChange({
        action: 'create',
        record: duplicateTask,
        recordId: duplicateTask.id,
      });
      
      // Should not override existing
      expect(useTasksStore.getState().tasksById['task-1'].title).toBe('Existing');
    });
  });

  describe('updateTask', () => {
    it('updates task in store', () => {
      const task = createMockTask({ id: 'task-1', title: 'Original', priority: 'Low' });
      useTasksStore.setState({
        tasksById: { 'task-1': task },
        taskOrder: ['task-1'],
      });
      
      useTasksStore.getState().updateTask('task-1', { title: 'Updated', priority: 'High' });
      
      const updatedTask = useTasksStore.getState().tasksById['task-1'];
      expect(updatedTask.title).toBe('Updated');
      expect(updatedTask.priority).toBe('High');
    });

    it('does nothing for non-existent task', () => {
      useTasksStore.getState().updateTask('non-existent', { title: 'Updated' });
      
      expect(useTasksStore.getState().tasksById['non-existent']).toBeUndefined();
    });
  });

  describe('deleteTask', () => {
    it('removes task from store', () => {
      const task = createMockTask({ id: 'task-1' });
      useTasksStore.setState({
        tasksById: { 'task-1': task },
        taskOrder: ['task-1'],
      });
      
      useTasksStore.getState().deleteTask('task-1');
      
      expect(useTasksStore.getState().tasksById['task-1']).toBeUndefined();
      expect(useTasksStore.getState().taskOrder).not.toContain('task-1');
    });
  });

  describe('toggleComplete', () => {
    it('toggles completion status', () => {
      const task = createMockTask({ id: 'task-1', completed: false });
      useTasksStore.setState({
        tasksById: { 'task-1': task },
        taskOrder: ['task-1'],
      });
      
      useTasksStore.getState().toggleComplete('task-1');
      
      expect(useTasksStore.getState().tasksById['task-1'].completed).toBe(true);
      expect(useTasksStore.getState().tasksById['task-1'].completedAt).toBeDefined();
    });

    it('toggles back to incomplete', () => {
      const task = createMockTask({ id: 'task-1', completed: true, completedAt: '2025-01-15T12:00:00Z' });
      useTasksStore.setState({
        tasksById: { 'task-1': task },
        taskOrder: ['task-1'],
      });
      
      useTasksStore.getState().toggleComplete('task-1');
      
      expect(useTasksStore.getState().tasksById['task-1'].completed).toBe(false);
      expect(useTasksStore.getState().tasksById['task-1'].completedAt).toBeUndefined();
    });
  });

  describe('subtask operations', () => {
    it('addSubtask adds a subtask to task', () => {
      const task = createMockTask({ id: 'task-1', subtasks: [] });
      useTasksStore.setState({
        tasksById: { 'task-1': task },
        taskOrder: ['task-1'],
      });
      
      const subtaskId = useTasksStore.getState().addSubtask('task-1', 'New Subtask');
      
      const updatedTask = useTasksStore.getState().tasksById['task-1'];
      expect(updatedTask.subtasks).toHaveLength(1);
      expect(updatedTask.subtasks![0].title).toBe('New Subtask');
      expect(updatedTask.subtasks![0].id).toBe(subtaskId);
    });

    it('toggleSubtask toggles subtask completion', () => {
      const subtask: Subtask = { id: 'sub-1', title: 'Subtask', completed: false };
      const task = createMockTask({ id: 'task-1', subtasks: [subtask] });
      useTasksStore.setState({
        tasksById: { 'task-1': task },
        taskOrder: ['task-1'],
      });
      
      useTasksStore.getState().toggleSubtask('task-1', 'sub-1');
      
      expect(useTasksStore.getState().tasksById['task-1'].subtasks![0].completed).toBe(true);
    });

    it('deleteSubtask removes subtask', () => {
      const subtask: Subtask = { id: 'sub-1', title: 'Subtask', completed: false };
      const task = createMockTask({ id: 'task-1', subtasks: [subtask] });
      useTasksStore.setState({
        tasksById: { 'task-1': task },
        taskOrder: ['task-1'],
      });
      
      useTasksStore.getState().deleteSubtask('task-1', 'sub-1');
      
      expect(useTasksStore.getState().tasksById['task-1'].subtasks).toHaveLength(0);
    });
  });

  describe('moveTaskToPage', () => {
    it('moves task to a different page', () => {
      const task = createMockTask({ id: 'task-1', parentPageId: 'page-1', sectionId: 'section-1' });
      useTasksStore.setState({
        tasksById: { 'task-1': task },
        taskOrder: ['task-1'],
      });
      
      useTasksStore.getState().moveTaskToPage('task-1', 'page-2', 'section-2');
      
      const movedTask = useTasksStore.getState().tasksById['task-1'];
      expect(movedTask.parentPageId).toBe('page-2');
      expect(movedTask.sectionId).toBe('section-2');
    });

    it('moves task to inbox (null parentPageId)', () => {
      const task = createMockTask({ id: 'task-1', parentPageId: 'page-1' });
      useTasksStore.setState({
        tasksById: { 'task-1': task },
        taskOrder: ['task-1'],
      });
      
      useTasksStore.getState().moveTaskToPage('task-1', null);
      
      expect(useTasksStore.getState().tasksById['task-1'].parentPageId).toBeUndefined();
    });
  });

  describe('batch operations', () => {
    it('clearCompletedTasks removes completed tasks', () => {
      const tasks = {
        'task-1': createMockTask({ id: 'task-1', completed: true }),
        'task-2': createMockTask({ id: 'task-2', completed: false }),
        'task-3': createMockTask({ id: 'task-3', completed: true }),
      };
      useTasksStore.setState({
        tasksById: tasks,
        taskOrder: ['task-1', 'task-2', 'task-3'],
      });
      
      useTasksStore.getState().clearCompletedTasks();
      
      const state = useTasksStore.getState();
      expect(state.tasksById['task-1']).toBeUndefined();
      expect(state.tasksById['task-2']).toBeDefined();
      expect(state.tasksById['task-3']).toBeUndefined();
    });

    it('updateTasks updates multiple tasks', () => {
      const tasks = {
        'task-1': createMockTask({ id: 'task-1', priority: 'Low' }),
        'task-2': createMockTask({ id: 'task-2', priority: 'Low' }),
      };
      useTasksStore.setState({
        tasksById: tasks,
        taskOrder: ['task-1', 'task-2'],
      });
      
      useTasksStore.getState().updateTasks(['task-1', 'task-2'], { priority: 'High' });
      
      expect(useTasksStore.getState().tasksById['task-1'].priority).toBe('High');
      expect(useTasksStore.getState().tasksById['task-2'].priority).toBe('High');
    });

    it('deleteTasks removes multiple tasks', () => {
      const tasks = {
        'task-1': createMockTask({ id: 'task-1' }),
        'task-2': createMockTask({ id: 'task-2' }),
        'task-3': createMockTask({ id: 'task-3' }),
      };
      useTasksStore.setState({
        tasksById: tasks,
        taskOrder: ['task-1', 'task-2', 'task-3'],
      });
      
      useTasksStore.getState().deleteTasks(['task-1', 'task-3']);
      
      const state = useTasksStore.getState();
      expect(state.tasksById['task-1']).toBeUndefined();
      expect(state.tasksById['task-2']).toBeDefined();
      expect(state.tasksById['task-3']).toBeUndefined();
    });
  });

  describe('selectors', () => {
    it('aggregates preview stats by page without scanning in components', () => {
      const tasks = {
        'task-1': createMockTask({
          id: 'task-1',
          title: 'Write launch brief',
          parentPageId: 'page-1',
          dueDate: '2025-01-10',
          created: '2025-01-10T08:00:00Z',
        }),
        'task-2': createMockTask({
          id: 'task-2',
          title: 'Review backlog',
          parentPageId: 'page-1',
          dueDate: '2025-01-18',
          created: '2025-01-12T08:00:00Z',
        }),
        'task-3': createMockTask({
          id: 'task-3',
          title: 'Add customer quotes',
          parentPageId: 'page-1',
          dueDate: undefined,
          created: '2025-01-16T08:00:00Z',
          subtasks: [
            { id: 'sub-1', title: 'Draft bullets', completed: true },
            { id: 'sub-2', title: 'Review copy', completed: false },
          ],
        }),
        'task-4': createMockTask({
          id: 'task-4',
          title: 'Archive rollout checklist',
          parentPageId: 'page-1',
          completed: true,
          completedAt: '2025-01-14T09:00:00Z',
          dueDate: undefined,
          created: '2025-01-14T08:00:00Z',
        }),
        'task-5': createMockTask({
          id: 'task-5',
          title: 'Sync with design',
          parentPageId: 'page-2',
          dueDate: '2025-01-30',
          created: '2025-01-13T08:00:00Z',
        }),
      };

      useTasksStore.setState({
        tasksById: tasks,
        taskOrder: ['task-1', 'task-2', 'task-3', 'task-4', 'task-5'],
      });

      const stats = selectTaskPreviewStatsByPage('page-1')(useTasksStore.getState());

      expect(stats).toEqual({
        totalCount: 4,
        openCount: 3,
        overdueOpenCount: 1,
        dueSoonCount: 1,
        undatedOpenCount: 1,
        recentlyCompletedCount: 1,
        latestTask: {
          id: 'task-3',
          title: 'Add customer quotes',
          dueDate: undefined,
          completed: false,
          priority: 'Medium',
          created: '2025-01-16T08:00:00Z',
          subtaskProgress: {
            total: 2,
            completed: 1,
          },
        },
      });
    });
  });

  describe('reset', () => {
    it('resets store to initial state', () => {
      useTasksStore.setState({
        tasksById: { 'task-1': createMockTask() },
        taskOrder: ['task-1'],
        isLoading: true,
        error: 'Some error',
      });
      
      useTasksStore.getState().reset();
      
      const state = useTasksStore.getState();
      expect(Object.keys(state.tasksById)).toHaveLength(0);
      expect(state.taskOrder).toHaveLength(0);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });
});
