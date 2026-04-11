/**
 * Workspace Members Settings Section
 * Invite, manage roles, remove members.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore, selectCurrentWorkspace, selectIsWorkspaceOwner, type WorkspaceMemberRole } from '@/stores/workspaceStore';
import { useAuthStore } from '@/stores/authStore';
import { Input, Button, Select } from '@/components/ui';
import {
  SettingsSectionHeader,
  SettingsStatusMessage,
} from '@frameer/components/ui';
import { Users, Crown, Shield, X } from 'lucide-react';
import { pb } from '@/lib/pocketbase';

interface WorkspaceMemberWithUser {
  id: string;
  user: string;
  workspace: string;
  role: WorkspaceMemberRole;
  created: string;
  expand?: {
    user?: {
      id: string;
      email: string;
      name?: string;
      avatar?: string;
    };
  };
}

const WorkspaceMembersSettings: React.FC = () => {
  const currentWorkspace = useWorkspaceStore(selectCurrentWorkspace);
  const isOwner = useWorkspaceStore(selectIsWorkspaceOwner);
  const { inviteMember, removeMember, updateMemberRole } = useWorkspaceStore(
    useShallow((s) => ({
      inviteMember: s.inviteMember,
      removeMember: s.removeMember,
      updateMemberRole: s.updateMemberRole,
    }))
  );
  const currentUser = useAuthStore((s) => s.user);

  const [members, setMembers] = useState<WorkspaceMemberWithUser[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceMemberRole>('member');
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentWorkspace) return;
    const fetchMembers = async () => {
      setIsLoadingMembers(true);
      try {
        const response = await fetch(`${pb.baseURL}/api/workspaces/${currentWorkspace.id}/members`, {
          headers: { 'Authorization': pb.authStore.token || '' },
        });
        if (!response.ok) throw new Error('Failed to fetch members');
        setMembers(await response.json());
      } catch (err) {
        console.error('Failed to fetch members:', err);
      } finally {
        setIsLoadingMembers(false);
      }
    };
    fetchMembers();
  }, [currentWorkspace]);

  const refreshMembers = useCallback(async () => {
    if (!currentWorkspace) return;
    const response = await fetch(`${pb.baseURL}/api/workspaces/${currentWorkspace.id}/members`, {
      headers: { 'Authorization': pb.authStore.token || '' },
    });
    if (response.ok) setMembers(await response.json());
  }, [currentWorkspace]);

  const handleInvite = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !inviteEmail.trim()) return;
    setIsInviting(true);
    setError(null);
    try {
      await inviteMember(currentWorkspace.id, inviteEmail.trim(), inviteRole);
      setInviteEmail('');
      await refreshMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite member');
    } finally {
      setIsInviting(false);
    }
  }, [currentWorkspace, inviteEmail, inviteRole, inviteMember, refreshMembers]);

  const handleRemoveMember = useCallback(async (userId: string) => {
    if (!currentWorkspace) return;
    try {
      await removeMember(currentWorkspace.id, userId);
      setMembers((prev) => prev.filter((m) => m.user !== userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  }, [currentWorkspace, removeMember]);

  const handleRoleChange = useCallback(async (userId: string, newRole: WorkspaceMemberRole) => {
    if (!currentWorkspace) return;
    try {
      await updateMemberRole(currentWorkspace.id, userId, newRole);
      setMembers((prev) => prev.map((m) => (m.user === userId ? { ...m, role: newRole } : m)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
  }, [currentWorkspace, updateMemberRole]);

  const getRoleIcon = (role: WorkspaceMemberRole) => {
    switch (role) {
      case 'owner': return <Crown className="w-4 h-4 text-amber-500" />;
      case 'admin': return <Shield className="w-4 h-4 text-[var(--color-interactive-text-strong)]" />;
      default: return <Users className="w-4 h-4 text-[var(--color-text-tertiary)]" />;
    }
  };

  if (!currentWorkspace) {
    return <p className="text-sm text-[var(--color-text-secondary)]">No workspace selected</p>;
  }

  return (
    <div className="space-y-4">
      {error && <SettingsStatusMessage type="error" message={error} />}

      {/* Invite */}
      {isOwner && (
        <>
          <SettingsSectionHeader title="Invite" />
          <form onSubmit={handleInvite} className="flex gap-2">
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="flex-1"
            />
            <Select
              value={inviteRole}
              onChange={(value) => setInviteRole(value as WorkspaceMemberRole)}
              size="md"
              options={[
                { value: 'member', label: 'Member' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
            <Button type="submit" variant="primary" disabled={isInviting || !inviteEmail.trim()}>
              {isInviting ? '...' : 'Invite'}
            </Button>
          </form>
        </>
      )}

      {/* Members list */}
      <SettingsSectionHeader title="Members" />
      <div className="space-y-1.5">
        {isLoadingMembers ? (
          <p className="text-sm text-[var(--color-text-secondary)] py-4 text-center">Loading...</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)] py-4 text-center">No members found</p>
        ) : (
          members.map((member) => {
            const user = member.expand?.user;
            const isCurrentUser = user?.id === currentUser?.id;
            const canManage = isOwner && !isCurrentUser && member.role !== 'owner';

            return (
              <div key={member.id} className="flex items-center gap-3 p-2.5 bg-[var(--color-surface-secondary)] rounded-lg">
                <div className="w-7 h-7 rounded-full bg-[var(--color-surface-overlay)] flex items-center justify-center text-xs font-medium text-[var(--color-text-secondary)]">
                  {user?.avatar ? (
                    <img src={pb.files.getURL(user, user.avatar)} alt="" className="w-7 h-7 rounded-full" />
                  ) : (
                    (user?.name || user?.email || '?').charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {user?.name || user?.email || 'Unknown'}
                  </span>
                  {isCurrentUser && <span className="text-xs text-[var(--color-text-secondary)] ml-1">(you)</span>}
                </div>
                <div className="flex items-center gap-2">
                  {getRoleIcon(member.role)}
                  {canManage ? (
                    <Select
                      value={member.role}
                      onChange={(value) => handleRoleChange(member.user, value as WorkspaceMemberRole)}
                      size="sm"
                      options={[
                        { value: 'member', label: 'Member' },
                        { value: 'admin', label: 'Admin' },
                      ]}
                    />
                  ) : (
                    <span className="text-xs text-[var(--color-text-secondary)] capitalize">{member.role}</span>
                  )}
                </div>
                {canManage && (
                  <button
                    onClick={() => handleRemoveMember(member.user)}
                    className="p-1 text-[var(--color-text-tertiary)] hover:text-red-500 rounded transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default WorkspaceMembersSettings;
