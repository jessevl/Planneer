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

/** Window in which a beforeinput line break following a handled Enter is ignored. */
const ENTER_DEDUPE_MS = 300;

/**
 * Calls `onEnter` for Android soft-keyboard Enter presses that never surface as
 * a usable `keydown`.
 *
 * While an IME is composing (predictive text, autocorrect), Android delivers
 * `keydown` as keyCode 229 / key "Unidentified", so a `key === 'Enter'` check
 * misses it. The line break still arrives as a `beforeinput` with inputType
 * `insertLineBreak`, which is what this listens for. Native rather than React's
 * `onBeforeInput`, whose synthetic event does not carry `inputType`.
 */
const useAndroidEnterFallback = (
  ref: React.RefObject<HTMLInputElement | null>,
  onEnter: () => void,
  lastEnterAtRef: React.RefObject<number>,
  /** Whether the input is currently rendered — re-attaches when it mounts. */
  enabled: boolean
) => {
  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;

    const onBeforeInput = (event: InputEvent) => {
      if (event.inputType !== 'insertLineBreak') return;
      event.preventDefault();
      if (Date.now() - lastEnterAtRef.current < ENTER_DEDUPE_MS) return;
      lastEnterAtRef.current = Date.now();
      onEnter();
    };

    node.addEventListener('beforeinput', onBeforeInput);
    return () => node.removeEventListener('beforeinput', onBeforeInput);
  }, [ref, onEnter, lastEnterAtRef, enabled]);
};

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
  const lastAddEnterAtRef = useRef(0);
  const lastEditEnterAtRef = useRef(0);

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
        lastAddEnterAtRef.current = Date.now();
        handleAddSubtask();
      }
    },
    [handleAddSubtask]
  );

  useAndroidEnterFallback(inputRef, handleAddSubtask, lastAddEnterAtRef, !readOnly && (isExpanded || subtasks.length > 0));

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
        lastEditEnterAtRef.current = Date.now();
        handleSaveEdit();
      } else if (e.key === 'Escape') {
        setEditingId(null);
        setEditingTitle('');
      }
    },
    [handleSaveEdit]
  );

  useAndroidEnterFallback(editInputRef, handleSaveEdit, lastEditEnterAtRef, editingId !== null);

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
        <div className="max-h-[min(40vh,18rem)] space-y-0.5 overflow-y-auto pr-1">
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
                  // Saving ends the edit, so "done" (which dismisses the
                  // keyboard) rather than the focus-advancing "next" Android
                  // picks by default inside a multi-field form.
                  enterKeyHint="done"
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
            // The input lives inside the task <form> with further fields after
            // it, so without this Android's IME shows a "Next" action that
            // jumps focus to the tag field instead of firing Enter.
            // "enter" maps to IME_ACTION_NONE: Enter reaches onKeyDown and the
            // keyboard stays open for the next subtask.
            enterKeyHint="enter"
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
