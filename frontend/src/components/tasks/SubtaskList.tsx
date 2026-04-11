/**
 * @file SubtaskList.tsx
 * @description Subtask management component for AddTaskForm modal
 * @app TASKS APP ONLY - Embedded subtask checklist
 * 
 * Renders and manages subtasks within a task:
 * - Minimal empty state: just "+ Add subtask" button
 * - Expands to show checklist when subtasks exist or when adding
 * - Progress indicator showing completion count
 * 
 * Designed to be lightweight and embedded in the task edit modal.
 */
'use client';

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import type { Subtask } from '@/types/task';
import { Checkbox } from '@/components/ui';
import { PlusIcon, TrashIcon, ListChecksIcon } from '@/components/common/Icons';

interface SubtaskListProps {
  /** Current subtasks array */
  subtasks: Subtask[];
  /** Called when subtasks change (for local state in create mode) */
  onChange: (subtasks: Subtask[]) => void;
  /** Whether the form is in read-only mode */
  readOnly?: boolean;
}

const SubtaskList: React.FC<SubtaskListProps> = ({ subtasks, onChange, readOnly = false }) => {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Auto-expand if there are existing subtasks
  useEffect(() => {
    if (subtasks.length > 0) {
      setIsExpanded(true);
    }
  }, [subtasks.length]);

  // Calculate progress
  const completedCount = useMemo(
    () => subtasks.filter((st) => st.completed).length,
    [subtasks]
  );
  const totalCount = subtasks.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const handleAddSubtask = useCallback(() => {
    if (!newSubtaskTitle.trim()) return;

    const newSubtask: Subtask = {
      id: `subtask_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      title: newSubtaskTitle.trim(),
      completed: false,
    };

    onChange([...subtasks, newSubtask]);
    setNewSubtaskTitle('');
    inputRef.current?.focus();
  }, [newSubtaskTitle, subtasks, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddSubtask();
      }
    },
    [handleAddSubtask]
  );

  const handleToggleSubtask = useCallback(
    (subtaskId: string) => {
      onChange(
        subtasks.map((st) =>
          st.id === subtaskId ? { ...st, completed: !st.completed } : st
        )
      );
    },
    [subtasks, onChange]
  );

  const handleDeleteSubtask = useCallback(
    (subtaskId: string) => {
      onChange(subtasks.filter((st) => st.id !== subtaskId));
    },
    [subtasks, onChange]
  );

  const handleStartEdit = useCallback((subtask: Subtask) => {
    setEditingId(subtask.id);
    setEditingTitle(subtask.title);
    setTimeout(() => editInputRef.current?.focus(), 0);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingId && editingTitle.trim()) {
      onChange(
        subtasks.map((st) =>
          st.id === editingId ? { ...st, title: editingTitle.trim() } : st
        )
      );
    }
    setEditingId(null);
    setEditingTitle('');
  }, [editingId, editingTitle, subtasks, onChange]);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveEdit();
      } else if (e.key === 'Escape') {
        setEditingId(null);
        setEditingTitle('');
      }
    },
    [handleSaveEdit]
  );

  const handleExpandAndFocus = useCallback(() => {
    setIsExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  // Minimal empty state - just a button
  if (!isExpanded && subtasks.length === 0 && !readOnly) {
    return (
      <button
        type="button"
        onClick={handleExpandAndFocus}
        className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors py-1"
      >
        <PlusIcon className="w-4 h-4" />
        <span>Add subtasks</span>
      </button>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header with progress - only show if has subtasks */}
      {totalCount > 0 && (
        <div className="flex items-center gap-2">
          <ListChecksIcon className="w-4 h-4 text-[var(--color-text-tertiary)]" />
          <div className="flex-1 h-1.5 bg-[var(--color-border-default)] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ease-out rounded-full ${
                progressPercent === 100 
                  ? 'bg-green-500 dark:bg-green-400' 
                  : 'bg-[var(--color-interactive-bg-strong)]'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs text-[var(--color-text-secondary)] tabular-nums">
            {completedCount}/{totalCount}
          </span>
        </div>
      )}

      {/* Subtask list */}
      {subtasks.length > 0 && (
        <div className="space-y-0.5">
          {subtasks.map((subtask) => (
            <div
              key={subtask.id}
              className="group flex items-center gap-2 py-1 px-1 -mx-1 rounded hover:bg-[var(--color-surface-secondary)] transition-colors"
            >
              <Checkbox
                checked={subtask.completed}
                onChange={() => handleToggleSubtask(subtask.id)}
                disabled={readOnly}
                size="sm"
              />
              
              {editingId === subtask.id ? (
                <input
                  ref={editInputRef}
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={handleSaveEdit}
                  onKeyDown={handleEditKeyDown}
                  className="flex-1 text-sm bg-transparent border-none focus:outline-none focus:ring-0 text-[var(--color-text-primary)]"
                />
              ) : (
                <span
                  className={`flex-1 text-sm cursor-pointer ${
                    subtask.completed
                      ? 'line-through text-[var(--color-text-tertiary)]'
                      : 'text-[var(--color-text-secondary)]'
                  }`}
                  onClick={() => !readOnly && handleStartEdit(subtask)}
                >
                  {subtask.title}
                </span>
              )}

              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleDeleteSubtask(subtask.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-[var(--color-text-tertiary)] hover:text-red-500 dark:hover:text-red-400"
                  aria-label="Delete subtask"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add subtask input - minimal inline style */}
      {!readOnly && (
        <div className="flex items-center gap-2 py-1">
          <PlusIcon className="w-4 h-4 text-[var(--color-text-tertiary)]" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Add subtask..."
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 text-sm bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-[var(--color-text-tertiary)] text-[var(--color-text-primary)]"
          />
        </div>
      )}
    </div>
  );
};

export default SubtaskList;
