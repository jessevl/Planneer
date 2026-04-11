import { pb } from '@/lib/pocketbase';

export const BOOX_AUTO_SYNC_STALE_MS = 5 * 60 * 1000;

const booxSyncInFlight = new Map<string, Promise<BooxSyncResult | null>>();

export interface BooxIntegrationConfig {
  enabled: boolean;
  serverUrl: string;
  username: string;
  rootPath: string;
  hasPassword: boolean;
  lastSyncAt: string;
  lastSyncStatus: string;
  lastSyncError: string;
  notebookCount: number;
  configured: boolean;
}

export interface UpdateBooxIntegrationInput {
  enabled: boolean;
  serverUrl: string;
  username: string;
  password?: string;
  rootPath: string;
  clearPassword?: boolean;
}

export interface BooxSyncResult {
  config: BooxIntegrationConfig;
  created: number;
  updated: number;
  deleted: number;
  total: number;
}

export async function fetchBooxIntegration(workspaceId: string): Promise<BooxIntegrationConfig> {
  return pb.send(`/api/workspaces/${workspaceId}/boox-integration`, {
    method: 'GET',
  }) as Promise<BooxIntegrationConfig>;
}

export async function updateBooxIntegration(
  workspaceId: string,
  input: UpdateBooxIntegrationInput,
): Promise<BooxIntegrationConfig> {
  return pb.send(`/api/workspaces/${workspaceId}/boox-integration`, {
    method: 'POST',
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json',
    },
  }) as Promise<BooxIntegrationConfig>;
}

export async function syncBooxIntegration(workspaceId: string): Promise<BooxSyncResult> {
  return pb.send(`/api/workspaces/${workspaceId}/boox-integration/sync`, {
    method: 'POST',
  }) as Promise<BooxSyncResult>;
}

/** Returns true when BOOX is configured but hasn't synced within BOOX_AUTO_SYNC_STALE_MS. */
export function shouldAutoSyncBoox(config: Pick<BooxIntegrationConfig, 'enabled' | 'configured' | 'lastSyncAt'>): boolean {
  if (!config.enabled || !config.configured) {
    return false;
  }

  if (!config.lastSyncAt) {
    return true;
  }

  const lastSyncMs = Date.parse(config.lastSyncAt);
  if (!Number.isFinite(lastSyncMs)) {
    return true;
  }

  return (Date.now() - lastSyncMs) >= BOOX_AUTO_SYNC_STALE_MS;
}

/**
 * Trigger a BOOX sync only when the config is stale (>5 min since last sync).
 * Deduplicates concurrent calls per workspace — safe to call from multiple spots.
 * Returns `null` if BOOX is disabled, unconfigured, or already fresh.
 */
export async function ensureBooxIntegrationFresh(workspaceId: string): Promise<BooxSyncResult | null> {
  const existing = booxSyncInFlight.get(workspaceId);
  if (existing) {
    return existing;
  }

  const request = (async () => {
    const config = await fetchBooxIntegration(workspaceId);
    if (!shouldAutoSyncBoox(config)) {
      return null;
    }

    return syncBooxIntegration(workspaceId);
  })().finally(() => {
    booxSyncInFlight.delete(workspaceId);
  });

  booxSyncInFlight.set(workspaceId, request);
  return request;
}