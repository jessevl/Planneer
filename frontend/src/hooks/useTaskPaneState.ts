/**
 * @file useTaskPaneState.ts
 * @description Manages task editor pane state with dirty-change guard
 *
 * Synchronises the UI store's task-pane values into a local snapshot,
 * prompting a discard confirmation when the user switches tasks with
 * unsaved edits. Extracted from UnifiedSidepanel to keep the component slim.
 *
 * Used by:
 * - UnifiedSidepanel
 */
import React from 'react';
import { useUIStore } from '@/stores/uiStore';

export interface TaskPaneSnapshot {
  mode: 'create' | 'edit' | null;
  taskId: string | null;
  defaults: {
    defaultDueDate?: string;
    defaultTaskPageId?: string;
    defaultSection?: string;
    defaultTags?: string[];
    defaultPriority?: 'Low' | 'Medium' | 'High';
  } | null;
}

function snapshotKey(s: TaskPaneSnapshot): string {
  return `${s.mode ?? 'none'}:${s.taskId ?? 'none'}`;
}

const EMPTY_SNAPSHOT: TaskPaneSnapshot = { mode: null, taskId: null, defaults: null };

export function useTaskPaneState() {
  const taskPaneMode = useUIStore((s) => s.taskPaneMode);
  const taskPaneTaskId = useUIStore((s) => s.taskPaneTaskId);
  const taskPaneDefaults = useUIStore((s) => s.taskPaneDefaults);
  const openTaskPane = useUIStore((s) => s.openTaskPane);
  const closeTaskPane = useUIStore((s) => s.closeTaskPane);

  const [snapshot, setSnapshot] = React.useState<TaskPaneSnapshot>({
    mode: taskPaneMode,
    taskId: taskPaneTaskId,
    defaults: taskPaneDefaults,
  });
  const [dirty, setDirty] = React.useState(false);
  const [showDiscard, setShowDiscard] = React.useState(false);
  const pendingRef = React.useRef<TaskPaneSnapshot | null>(null);
  const dirtyRef = React.useRef(dirty);
  const snapshotRef = React.useRef(snapshot);

  dirtyRef.current = dirty;
  snapshotRef.current = snapshot;

  // Sync store → local snapshot (with dirty guard)
  React.useEffect(() => {
    const next: TaskPaneSnapshot = {
      mode: taskPaneMode,
      taskId: taskPaneTaskId,
      defaults: taskPaneDefaults,
    };

    if (snapshotKey(snapshot) === snapshotKey(next) && snapshot.defaults === next.defaults) {
      return;
    }

    if (dirty && snapshot.mode) {
      pendingRef.current = next;
      setShowDiscard(true);
      return;
    }

    setSnapshot(next);
  }, [dirty, snapshot, taskPaneMode, taskPaneTaskId, taskPaneDefaults]);

  /** Clear the editor and close the pane (no discard guard). */
  const close = React.useCallback(() => {
    setDirty(false);
    setSnapshot(EMPTY_SNAPSHOT);
    closeTaskPane();
  }, [closeTaskPane]);

  /** Reset the editor, honoring the dirty guard. */
  const reset = React.useCallback(() => {
    if (dirtyRef.current && snapshotRef.current.mode) {
      pendingRef.current = EMPTY_SNAPSHOT;
      setShowDiscard(true);
      return;
    }
    setDirty(false);
    setSnapshot(EMPTY_SNAPSHOT);
    closeTaskPane();
  }, [closeTaskPane]);

  /** Accept the discard and apply the pending change. */
  const discard = React.useCallback(() => {
    setShowDiscard(false);
    setDirty(false);
    const pending = pendingRef.current;
    pendingRef.current = null;

    if (pending) {
      setSnapshot(pending);
      if (pending.mode) {
        openTaskPane(pending.mode, pending.taskId, pending.defaults ?? undefined);
      } else {
        closeTaskPane();
      }
      return;
    }

    close();
  }, [close, closeTaskPane, openTaskPane]);

  /** Cancel the discard and keep editing. */
  const keepEditing = React.useCallback(() => {
    setShowDiscard(false);
    pendingRef.current = null;
    const currentSnapshot = snapshotRef.current;
    if (currentSnapshot.mode) {
      openTaskPane(currentSnapshot.mode, currentSnapshot.taskId, currentSnapshot.defaults ?? undefined);
    }
  }, [openTaskPane]);

  return { snapshot, dirty, setDirty, showDiscard, reset, close, discard, keepEditing };
}
