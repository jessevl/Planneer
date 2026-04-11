/**
 * @file task.ts
 * @description Task type definition with recurring task support
 * @app TASKS APP ONLY - Core task data structure
 * 
 * Defines the Task interface used throughout the Tasks App.
 * 
 * Fields:
 * - id: Unique identifier
 * - title: Task name (required)
 * - description: Optional details
 * - dueDate: ISO date string (YYYY-MM-DD)
 * - priority: 'Low' | 'Medium' | 'High'
 * - parentPageId: Reference to parent page (task collection), null = Inbox
 * - sectionId: Reference to section within task collection (Kanban column)
 * - completed: Whether task is done
 * - subtasks: Embedded array of subtasks (lightweight, no cross-querying needed)
 * - recurrence: Pattern for recurring tasks (pattern-based, not pre-generated)
 * 
 * UNIFIED PAGES MODEL:
 * Tasks now belong to Pages with viewMode='tasks' (task collections).
 * The parentPageId field replaces the old projectId field.
 * Tasks with parentPageId=null are in the Inbox.
 * 
 * RECURRING TASKS ARCHITECTURE:
 * Tasks use a pattern-based recurrence model where:
 * 1. The recurrence pattern is stored on the task itself
 * 2. When completed, the next instance is generated with the same pattern
 * 3. Completed instances remain as separate records for history
 * 4. This avoids pre-generating hundreds of future tasks
 */

/**
 * Subtask - A lightweight embedded task item
 * 
 * Subtasks are stored directly in the parent Task to avoid
 * complex queries and keep the data model simple for PocketBase.
 * Only supports title and completion status.
 */
export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

/**
 * Recurrence type - how often the task repeats
 */
export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'yearly';

/**
 * How the recurrence ends
 */
export type RecurrenceEndType = 'never' | 'date' | 'count';

/**
 * For monthly recurrence - repeat on same day number or same weekday position
 */
export type MonthlyType = 'dayOfMonth' | 'dayOfWeek';

/**
 * Recurrence pattern for repeating tasks.
 * 
 * Stored on the task record. When a recurring task is completed,
 * a new task instance is created with the next due date calculated
 * from this pattern.
 * 
 * Examples:
 * - Daily: { type: 'daily', interval: 1, endType: 'never' }
 * - Every 2 weeks: { type: 'weekly', interval: 2, endType: 'never' }
 * - Weekdays: { type: 'weekly', interval: 1, weekDays: [1,2,3,4,5], endType: 'never' }
 * - Monthly on 15th: { type: 'monthly', interval: 1, monthlyType: 'dayOfMonth', endType: 'never' }
 * - Monthly on 2nd Tuesday: { type: 'monthly', interval: 1, monthlyType: 'dayOfWeek', endType: 'never' }
 */
export interface RecurrencePattern {
  /** Type of recurrence */
  type: RecurrenceType;
  
  /** Interval: every N days/weeks/months/years (default: 1) */
  interval: number;
  
  /** 
   * For weekly recurrence: which days of the week (0=Sunday, 6=Saturday)
   * If not set for weekly, uses the weekday of the anchor date
   */
  weekDays?: number[];
  
  /** 
   * For monthly recurrence: repeat on same day number (15th) 
   * or same weekday position (2nd Tuesday)
   */
  monthlyType?: MonthlyType;
  
  /** When the recurrence ends */
  endType: RecurrenceEndType;
  
  /** For 'date' end type: stop recurring after this date */
  endDate?: string;
  
  /** For 'count' end type: total number of occurrences */
  endCount?: number;
  
  /** Track how many times this recurring task has been completed */
  completedCount?: number;
  
  /** 
   * Original due date - anchor for calculating future dates
   * Preserves the original day/weekday even after multiple completions
   */
  anchorDate: string;
}

export interface Task {
  id: string;
  /** Workspace ID this task belongs to (required for backend) */
  workspace?: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority?: 'Low' | 'Medium' | 'High';
  /** Parent page ID (task collection), null = Inbox */
  parentPageId?: string;
  sectionId?: string;
  completed: boolean;
  /** ISO timestamp when task was completed (set automatically on toggle) */
  completedAt?: string;
  /** Embedded subtasks - lightweight checklist items */
  subtasks?: Subtask[];
  
  // ========================================================================
  // RECURRING TASK FIELDS
  // ========================================================================
  
  /** 
   * If set, this task recurs according to the pattern.
   * When completed, a new instance will be created with the next due date.
   */
  recurrence?: RecurrencePattern;
  
  /**
   * For completed recurring task instances: ID of the original task that spawned this.
   * Useful for tracking history and lineage of recurring tasks.
   */
  recurringParentId?: string;
  
  /**
   * Whether to copy subtasks (reset to uncompleted) when creating the next instance.
   * Default: true if task has subtasks
   */
  copySubtasksOnRecur?: boolean;
  
  /** Single tag for categorization (e.g., "work", "personal", "urgent") */
  tag?: string;
  
  /** Linked items — pages/tasks linked FROM this task (for bi-directional linking) */
  linkedItems?: LinkedItem[];
  
  /** Position for manual ordering */
  order?: number;
  
  /** Timestamps */
  created?: string;
  updated?: string;
}

/**
 * A linked item reference stored on a task.
 * Enables linking FROM tasks TO other pages and tasks (for backlinks).
 */
export interface LinkedItem {
  type: 'page' | 'task';
  id: string;
  title: string;
}
