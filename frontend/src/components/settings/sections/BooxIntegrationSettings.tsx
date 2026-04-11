/**
 * @file BooxIntegrationSettings.tsx
 * @description Settings section for gating the BOOX WebDAV notebook mirror integration
 * @app SHARED - Used by the global Settings modal
 *
 * Features:
 * - Workspace-level BOOX sync toggle
 * - External WebDAV credential management
 * - Manual sync and mirror status
 *
 * Used by:
 * - SettingsModal
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Input,
  SettingsCard,
  SettingsSectionHeader,
  SettingsStatusMessage,
  SettingsToggleRow,
  toastError,
  toastSuccess,
} from '@/components/ui';
import {
  fetchBooxIntegration,
  syncBooxIntegration,
  updateBooxIntegration,
  type BooxIntegrationConfig,
} from '@/api/booxApi';
import { selectCurrentWorkspaceId, selectIsWorkspaceAdmin, useWorkspaceStore } from '@/stores/workspaceStore';

const BooxIntegrationSettings: React.FC = () => {
  const workspaceId = useWorkspaceStore(selectCurrentWorkspaceId);
  const isWorkspaceAdmin = useWorkspaceStore(selectIsWorkspaceAdmin);

  const [config, setConfig] = useState<BooxIntegrationConfig | null>(null);
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rootPath, setRootPath] = useState('/');
  const [workspaceEnabled, setWorkspaceEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadConfig = async () => {
      if (!workspaceId) {
        setConfig(null);
        setServerUrl('');
        setUsername('');
        setPassword('');
        setRootPath('/');
        setWorkspaceEnabled(false);
        return;
      }

      setIsLoading(true);
      try {
        const nextConfig = await fetchBooxIntegration(workspaceId);
        if (cancelled) return;
        setConfig(nextConfig);
        setServerUrl(nextConfig.serverUrl ?? '');
        setUsername(nextConfig.username ?? '');
        setPassword('');
        setRootPath(nextConfig.rootPath || '/');
        setWorkspaceEnabled(nextConfig.enabled);
      } catch (error) {
        if (!cancelled) {
          toastError((error as Error).message || 'Failed to load BOOX integration settings');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadConfig();

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const statusMessage = useMemo(() => {
    if (!config?.lastSyncStatus) return null;
    if (config.lastSyncStatus === 'ok') {
      return {
        type: 'success' as const,
        message: config.lastSyncAt
          ? `Last sync completed successfully at ${new Date(config.lastSyncAt).toLocaleString()}`
          : 'Last sync completed successfully.',
      };
    }
    if (config.lastSyncStatus === 'error' && config.lastSyncError) {
      return {
        type: 'error' as const,
        message: config.lastSyncError,
      };
    }
    return null;
  }, [config]);

  const handleSave = async () => {
    if (!workspaceId) {
      toastError('Select a workspace before configuring BOOX integration');
      return;
    }

    setIsSaving(true);
    try {
      const saved = await updateBooxIntegration(workspaceId, {
        enabled: workspaceEnabled,
        serverUrl,
        username,
        password: password || undefined,
        rootPath,
      });
      setConfig(saved);
      setServerUrl(saved.serverUrl ?? '');
      setUsername(saved.username ?? '');
      setRootPath(saved.rootPath || '/');
      setWorkspaceEnabled(saved.enabled);
      setPassword('');
      toastSuccess('BOOX integration settings saved');
    } catch (error) {
      toastError((error as Error).message || 'Failed to save BOOX integration settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSync = async () => {
    if (!workspaceId) {
      toastError('Select a workspace before running BOOX sync');
      return;
    }

    setIsSyncing(true);
    try {
      const result = await syncBooxIntegration(workspaceId);
      setConfig(result.config);
      toastSuccess(`Synced ${result.total} BOOX notebook${result.total === 1 ? '' : 's'}`);
    } catch (error) {
      toastError((error as Error).message || 'BOOX sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="BOOX Integration"
        description="Mirror BOOX notebook PDFs into the handwritten library for this workspace."
      />

      {!workspaceId ? (
        <SettingsCard>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Select a workspace to configure BOOX sync.
          </p>
        </SettingsCard>
      ) : (
        <>
          <SettingsCard className="space-y-3">
            <SettingsToggleRow
              label="Enable BOOX sync"
              enabled={workspaceEnabled}
              onChange={setWorkspaceEnabled}
              description="Mirror PDFs from this workspace's WebDAV folder into Handwritten Notes."
            />

            <Input
              label="WebDAV server URL"
              value={serverUrl}
              onChange={(event) => setServerUrl(event.target.value)}
              placeholder="https://dav.example.com/remote.php/dav/files/you"
              disabled={!isWorkspaceAdmin || isLoading}
            />
            <Input
              label="Username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="WebDAV username"
              disabled={!isWorkspaceAdmin || isLoading}
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={config?.hasPassword ? 'Leave blank to keep current password' : 'WebDAV password'}
              disabled={!isWorkspaceAdmin || isLoading}
            />
            <Input
              label="WebDAV share path"
              value={rootPath}
              onChange={(event) => setRootPath(event.target.value)}
              placeholder="/BooxShare"
              disabled={!isWorkspaceAdmin || isLoading}
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={!isWorkspaceAdmin || isSaving || isLoading}
              >
                {isSaving ? 'Saving...' : 'Save Settings'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSync}
                disabled={!isWorkspaceAdmin || isSyncing || isLoading || !config?.configured}
              >
                {isSyncing ? 'Syncing...' : 'Run Sync'}
              </Button>
            </div>

            {!isWorkspaceAdmin ? (
              <p className="text-xs text-[var(--color-text-tertiary)]">
                Only workspace owners and admins can change BOOX sync settings.
              </p>
            ) : null}
          </SettingsCard>

          {config ? (
            <SettingsCard className="space-y-2">
              <div className="text-sm font-medium text-[var(--color-text-primary)]">Mirror status</div>
              <div className="text-sm text-[var(--color-text-secondary)]">
                Mirrored notebooks: {config.notebookCount}
              </div>
              {statusMessage ? (
                <SettingsStatusMessage type={statusMessage.type} message={statusMessage.message} />
              ) : null}
            </SettingsCard>
          ) : null}
        </>
      )}
    </div>
  );
};

export default BooxIntegrationSettings;