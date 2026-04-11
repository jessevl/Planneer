/**
 * Workspace Danger Zone Section
 * Leave workspace, delete workspace.
 */

import React, { useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore, selectCurrentWorkspace, selectIsWorkspaceOwner } from '@/stores/workspaceStore';
import { useAuthStore } from '@/stores/authStore';
import { Input, Button } from '@/components/ui';
import {
  SettingsSectionHeader,
  SettingsStatusMessage,
  SettingsActionButton,
  SettingsCollapsible,
} from '@frameer/components/ui';
import { LogOut, Trash2 } from 'lucide-react';

interface Props {
  onClose: () => void;
}

const WorkspaceDangerSettings: React.FC<Props> = ({ onClose }) => {
  const currentWorkspace = useWorkspaceStore(selectCurrentWorkspace);
  const deleteWorkspace = useWorkspaceStore((s) => s.deleteWorkspace);
  const isOwner = useWorkspaceStore(selectIsWorkspaceOwner);
  const { removeMember } = useWorkspaceStore(useShallow((s) => ({ removeMember: s.removeMember })));
  const currentUser = useAuthStore((s) => s.user);

  const [confirmDelete, setConfirmDelete] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = useCallback(async () => {
    if (!currentWorkspace || confirmDelete !== currentWorkspace.name) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteWorkspace(currentWorkspace.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete workspace');
    } finally {
      setIsDeleting(false);
    }
  }, [currentWorkspace, confirmDelete, deleteWorkspace, onClose]);

  const handleLeave = useCallback(async () => {
    if (!currentWorkspace || !currentUser) return;
    setIsLeaving(true);
    setError(null);
    try {
      await removeMember(currentWorkspace.id, currentUser.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave workspace');
    } finally {
      setIsLeaving(false);
    }
  }, [currentWorkspace, currentUser, removeMember, onClose]);

  if (!currentWorkspace) {
    return <p className="text-sm text-[var(--color-text-secondary)]">No workspace selected</p>;
  }

  return (
    <div className="space-y-4">
      <SettingsSectionHeader title="Danger Zone" description="Irreversible actions" />

      {error && <SettingsStatusMessage type="error" message={error} />}

      {/* Leave workspace */}
      {!isOwner && (
        <SettingsActionButton
          onClick={handleLeave}
          disabled={isLeaving}
          loading={isLeaving}
          icon={<LogOut size={14} />}
          label={isLeaving ? 'Leaving...' : 'Leave Workspace'}
          variant="danger"
        />
      )}

      {/* Delete workspace */}
      {isOwner && (
        <SettingsCollapsible title="Delete Workspace" description="Permanently delete all data">
          <p className="text-sm text-red-600 dark:text-red-400">
            Type <strong>{currentWorkspace.name}</strong> to confirm:
          </p>
          <Input
            type="text"
            value={confirmDelete}
            onChange={(e) => setConfirmDelete(e.target.value)}
            placeholder={currentWorkspace.name}
            className="w-full max-w-xs"
          />
          <Button
            variant="danger-outline"
            onClick={handleDelete}
            disabled={isDeleting || confirmDelete !== currentWorkspace.name}
          >
            {isDeleting ? 'Deleting...' : 'Delete Workspace'}
          </Button>
        </SettingsCollapsible>
      )}
    </div>
  );
};

export default WorkspaceDangerSettings;
