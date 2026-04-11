/**
 * Workspace Settings Section
 * Workspace name, description, color.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useWorkspaceStore, selectCurrentWorkspace, selectIsWorkspaceOwner, selectIsWorkspaceAdmin } from '@/stores/workspaceStore';
import { Input, Button } from '@/components/ui';
import {
  SettingsSectionHeader,
  SettingsCard,
  SettingsSaveButton,
} from '@frameer/components/ui';

const COLORS = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

const WorkspaceGeneralSettings: React.FC = () => {
  const currentWorkspace = useWorkspaceStore(selectCurrentWorkspace);
  const updateWorkspace = useWorkspaceStore((s) => s.updateWorkspace);
  const isOwner = useWorkspaceStore(selectIsWorkspaceOwner);
  const isAdmin = useWorkspaceStore(selectIsWorkspaceAdmin);

  const [name, setName] = useState(currentWorkspace?.name || '');
  const [description, setDescription] = useState(currentWorkspace?.description || '');
  const [color, setColor] = useState(currentWorkspace?.color || '#3b82f6');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (currentWorkspace) {
      setName(currentWorkspace.name);
      setDescription(currentWorkspace.description || '');
      setColor(currentWorkspace.color || '#3b82f6');
    }
  }, [currentWorkspace]);

  const canEdit = isOwner || isAdmin;

  const handleSave = useCallback(async () => {
    if (!currentWorkspace || !canEdit) return;
    setIsSaving(true);
    setSaved(false);
    try {
      await updateWorkspace(currentWorkspace.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // error handling via toast could be added
    } finally {
      setIsSaving(false);
    }
  }, [currentWorkspace, name, description, color, updateWorkspace, canEdit]);

  if (!currentWorkspace) {
    return <p className="text-sm text-[var(--color-text-secondary)]">No workspace selected</p>;
  }

  return (
    <div className="space-y-4">
      {/* Preview */}
      <SettingsCard>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg font-bold"
            style={{ backgroundColor: color }}
          >
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-[var(--color-text-primary)]">{name || 'Workspace Name'}</div>
            <div className="text-xs text-[var(--color-text-secondary)]">{description || 'No description'}</div>
          </div>
        </div>
      </SettingsCard>

      {/* Fields */}
      <SettingsSectionHeader title="Details" />
      <div className="space-y-3">
        <Input type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} maxLength={50} label="Workspace name" className="w-full" />
        <Input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this workspace for?" disabled={!canEdit} maxLength={200} label="Description" className="w-full" />
      </div>

      {/* Color */}
      {canEdit && (
        <>
          <SettingsSectionHeader title="Color" />
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full transition-all ${
                  color === c ? 'ring-2 ring-offset-2 ring-[var(--color-border-default)]' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </>
      )}

      {/* Save */}
      {canEdit && (
        <SettingsSaveButton saving={isSaving} success={saved} onClick={handleSave} />
      )}
    </div>
  );
};

export default WorkspaceGeneralSettings;
