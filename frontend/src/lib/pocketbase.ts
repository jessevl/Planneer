/**
 * @file pocketbase.ts
 * @description PocketBase client singleton with workspace-aware helpers
 * @app SHARED - Backend connection
 * 
 * Provides a configured PocketBase client instance with:
 * - Auto-reconnect on auth state changes
 * - LocalStorage persistence of auth token
 * - Type-safe collection accessors
 * - Workspace-scoped query helpers
 */

import PocketBase from 'pocketbase';
import type { Task } from '@/types/task';
import type { Page } from '@/types/page';
import type { Workspace, WorkspaceMember } from '@/stores/workspaceStore';

// Environment variable for PocketBase URL.
// Web production can use runtime config injection.
// Development uses the current origin so Vite proxying continues to work.
const getPocketBaseUrl = () => {
  // Check runtime config injected by Docker entrypoint
  if (typeof window !== 'undefined' && (window as any).ENV?.VITE_POCKETBASE_URL) {
    return (window as any).ENV.VITE_POCKETBASE_URL;
  }
  
  // Check build-time env var
  if (import.meta.env.VITE_POCKETBASE_URL) {
    return import.meta.env.VITE_POCKETBASE_URL;
  }

  // Production: use same origin
  if (import.meta.env.PROD) {
    return window.location.origin;
  }
  
  // Development: use current origin (will go through Vite proxy)
  // This is critical for iOS/mobile testing where 'localhost' refers to the device itself.
  // Using window.location.origin ensures we use the dev machine's IP if that's how we're accessing it.
  return window.location.origin;
};

const PB_URL = getPocketBaseUrl();

/**
 * PocketBase client singleton
 * Auth state is automatically persisted in localStorage
 */
export const pb = new PocketBase(PB_URL);

export const normalizePocketBaseAssetUrl = (assetUrl?: string | null): string | null | undefined => {
  if (!assetUrl || assetUrl.startsWith('blob:') || assetUrl.startsWith('data:')) {
    return assetUrl;
  }

  try {
    const currentBaseUrl = new URL(
      pb.baseUrl,
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
    );
    const resolvedAssetUrl = new URL(assetUrl, currentBaseUrl);

    if (!resolvedAssetUrl.pathname.startsWith('/api/files/pages/')) {
      return assetUrl;
    }

    if (resolvedAssetUrl.origin === currentBaseUrl.origin) {
      return resolvedAssetUrl.toString();
    }

    return new URL(
      `${resolvedAssetUrl.pathname}${resolvedAssetUrl.search}${resolvedAssetUrl.hash}`,
      currentBaseUrl
    ).toString();
  } catch {
    return assetUrl;
  }
};

// Global auth error listeners (for 401 Unauthorized)
type AuthErrorListener = () => void;
const authErrorListeners: AuthErrorListener[] = [];

/**
 * Subscribe to global auth errors (401).
 * Used to show "Session Expired" modal app-wide.
 */
export const onAuthError = (listener: AuthErrorListener) => {
  authErrorListeners.push(listener);
  return () => {
    const index = authErrorListeners.indexOf(listener);
    if (index !== -1) authErrorListeners.splice(index, 1);
  };
};

// Add global error handler for auth errors
pb.afterSend = (response, data) => {
  // Check if this is an auth-related error
  // We only handle 401 Unauthorized here.
  // 403 can be a permission error (not necessarily session expiry).
  // 400 is a validation error or bad request.
  const isAuthError = response.status === 401;

  if (isAuthError) {
    // Don't clear auth immediately - the session validator's proactive refresh
    // should prevent most 401s. If we get here, it means either:
    // 1. The token just expired between the proactive refresh check and this request
    // 2. The token was revoked server-side (password change, admin action)
    // 3. The server rejected the token for another reason
    //
    // Notify listeners so they can show the session expired modal.
    // The modal's "Reconnect" button will attempt authRefresh before
    // forcing a full re-login. We clear authStore only when the user
    // explicitly chooses to sign in again (via handleSessionExpiredLogin).
    authErrorListeners.forEach(l => l());
  }
  return data;
};

// Log PocketBase URL in development for debugging
if (!import.meta.env.PROD) {
  console.log('[PocketBase] Connected to:', PB_URL);
}

// Enable auto-cancellation of pending requests on auth state change
pb.autoCancellation(false); // Set to true if you want strict request cancellation

/**
 * Relation fields that need null → '' conversion for PocketBase writes.
 * PocketBase stores relations as strings, so null values must be empty strings.
 */
const RELATION_FIELDS = [
  'parentId',
  'taskPageId', 
  'sectionId',
  'workspace',
  'createdBy',
  'assignedTo',
  'recurringParentId',
] as const;

type RelationField = typeof RELATION_FIELDS[number];

/**
 * Generate a PocketBase-compatible ID.
 * PocketBase requires IDs to be exactly 15 alphanumeric characters.
 */
export function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 15; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/**
 * Transform a PocketBase record to frontend format.
 * 
 * With Option A (accepting PocketBase conventions), this is now a simple passthrough.
 * Empty strings represent unset values for optional fields.
 * 
 * Note: PocketBase uses `created`/`updated` field names (auto-managed).
 * Frontend types should match these names.
 */
export function pbToFrontend<T>(record: unknown): T {
  return record as T;
}

/**
 * Type-safe collection accessors
 * Use these instead of pb.collection('tasks') for better TypeScript support
 */
export const collections = {
  tasks: () => pb.collection<Task>('tasks'),
  pages: () => pb.collection<Page>('pages'),
  users: () => pb.collection('users'),
  workspaces: () => pb.collection<Workspace>('workspaces'),
  workspaceMembers: () => pb.collection<WorkspaceMember>('workspace_members'),
} as const;

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  return pb.authStore.isValid;
};

/**
 * Get current user ID (returns null if not authenticated)
 */
export const getCurrentUserId = (): string | null => {
  return pb.authStore.record?.id || null;
};

/**
 * Get current user's auth token
 */
export const getAuthToken = (): string => {
  return pb.authStore.token;
};

/**
 * Subscribe to auth state changes
 * Useful for redirecting to login when session expires
 * @returns Unsubscribe function
 */
export const onAuthChange = (callback: (isValid: boolean) => void): (() => void) => {
  return pb.authStore.onChange((token: string, model: unknown) => {
    callback(!!token && !!model);
  });
};

/**
 * Clear auth state (logout)
 */
export const clearAuth = () => {
  pb.authStore.clear();
};

// ============================================================================
// WORKSPACE-SCOPED HELPERS
// ============================================================================

/**
 * Build a parameterized filter string for workspace-scoped queries.
 * Uses pb.filter() to safely escape values and prevent injection attacks.
 * 
 * @param workspaceId - The workspace ID to filter by
 * @param additionalFilters - Additional filter conditions (will be ANDed)
 */
export function buildWorkspaceFilter(
  workspaceId: string,
  additionalFilters?: string
): string {
  // Use parameterized query to prevent injection
  const baseFilter = pb.filter('workspace = {:workspaceId}', { workspaceId });
  if (additionalFilters) {
    return `${baseFilter} && (${additionalFilters})`;
  }
  return baseFilter;
}

/**
 * Create a safe parameterized filter expression.
 * Wrapper around pb.filter() for consistent usage throughout the app.
 * 
 * @example
 * safeFilter('projectId = {:id}', { id: projectId })
 * safeFilter('completed = {:done} && dueDate >= {:date}', { done: true, date: '2024-01-01' })
 */
export function safeFilter(
  expression: string,
  params: Record<string, string | number | boolean | Date | null>
): string {
  return pb.filter(expression, params);
}

/**
 * Standard list options with workspace filter
 */
export interface WorkspaceScopedOptions {
  workspaceId: string;
  filter?: string;
  sort?: string;
  expand?: string;
  /** Comma-separated list of fields to fetch (omit for all fields) */
  fields?: string;
}

/** Default batch size for getFullList to prevent unbounded queries */
const DEFAULT_BATCH_SIZE = 200;

/** Maximum records to fetch in a single request (safety limit) */
const MAX_RECORDS_LIMIT = 5000;

/**
 * Fetch all records from a collection, scoped to workspace.
 * Transforms PocketBase records to frontend format (timestamps, null fields).
 * 
 * Uses batched fetching with a hard limit to prevent memory issues.
 * For most personal productivity use cases, users have <1000 items per collection.
 * 
 * @throws Error if result exceeds MAX_RECORDS_LIMIT
 */
export async function fetchAllInWorkspace<T>(
  collectionName: 'tasks' | 'pages' | 'pages',
  options: WorkspaceScopedOptions
): Promise<T[]> {
  const { workspaceId, filter, sort, expand, fields } = options;
  
  const fullFilter = buildWorkspaceFilter(workspaceId, filter);
  
  // First, check count to prevent unbounded queries
  const countResult = await pb.collection(collectionName).getList(1, 1, {
    filter: fullFilter,
    fields: 'id', // Minimal data for count check
  });
  
  if (countResult.totalItems > MAX_RECORDS_LIMIT) {
    throw new Error(
      `Query would return ${countResult.totalItems} records, exceeding limit of ${MAX_RECORDS_LIMIT}. ` +
      `Use fetchPaginatedInWorkspace instead.`
    );
  }
  
  const result = await pb.collection(collectionName).getFullList({
    filter: fullFilter,
    sort: sort || '-created',
    expand,
    fields,
    batch: DEFAULT_BATCH_SIZE,
  });
  
  // Transform each record to frontend format
  return result.map(record => pbToFrontend<T>(record));
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}

/**
 * Fetch paginated records from a collection, scoped to workspace.
 * Use this for views that can handle pagination (e.g., completed tasks history).
 */
export async function fetchPaginatedInWorkspace<T>(
  collectionName: 'tasks' | 'pages' | 'pages',
  options: WorkspaceScopedOptions & { page?: number; perPage?: number }
): Promise<PaginatedResult<T>> {
  const { workspaceId, filter, sort, expand, page = 1, perPage = 50 } = options;
  
  const fullFilter = buildWorkspaceFilter(workspaceId, filter);
  
  const result = await pb.collection(collectionName).getList(page, perPage, {
    filter: fullFilter,
    sort: sort || '-created',
    expand,
  });
  
  return {
    items: result.items.map(record => pbToFrontend<T>(record)),
    page: result.page,
    perPage: result.perPage,
    totalItems: result.totalItems,
    totalPages: result.totalPages,
  };
}

/** Fields that PocketBase auto-manages (timestamps) */
const AUTO_MANAGED_FIELDS = ['created', 'updated'] as const;

/** Fields that are PocketBase metadata and should never be sent in write operations */
const POCKETBASE_METADATA_FIELDS = [
  'collectionId',
  'collectionName', 
  'expand',
] as const;

/**
 * Transform frontend data to PocketBase-compatible format.
 * - Strips auto-managed timestamp fields (created, updated)
 * - Strips PocketBase metadata fields (collectionId, collectionName, expand)
 * - Strips internal sync metadata (underscore-prefixed fields)
 * - Converts null to empty string for relation fields (PocketBase requirement)
 * - Optionally keeps 'id' for create operations (PocketBase allows custom IDs)
 * - Optionally skips 'workspace' for update operations (immutable field)
 */
function prepareForPocketBase<T extends Record<string, unknown>>(
  data: T,
  options: { keepId?: boolean; skipWorkspace?: boolean } = {}
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    // Skip auto-managed timestamp fields
    if (AUTO_MANAGED_FIELDS.includes(key as typeof AUTO_MANAGED_FIELDS[number])) continue;
    // Skip PocketBase metadata fields
    if (POCKETBASE_METADATA_FIELDS.includes(key as typeof POCKETBASE_METADATA_FIELDS[number])) continue;
    // Skip internal sync metadata (underscore-prefixed fields like _syncStatus, _hlc, etc.)
    if (key.startsWith('_')) continue;
    // Skip 'id' unless explicitly kept (for create with custom ID)
    if (key === 'id' && !options.keepId) continue;
    // Skip 'workspace' for updates (immutable field)
    if (key === 'workspace' && options.skipWorkspace) continue;
    
    // Convert null to empty string for relations (PocketBase requirement for writes)
    if (RELATION_FIELDS.includes(key as RelationField) && value === null) {
      result[key] = '';
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Create a record with workspace field auto-populated.
 * Uses the client-provided ID to enable optimistic updates.
 * Returns transformed record in frontend format.
 */
export async function createInWorkspace<T>(
  collectionName: 'tasks' | 'pages' | 'pages',
  workspaceId: string,
  data: Record<string, unknown>
): Promise<T> {
  // Keep the client-side ID for optimistic update consistency
  const prepared = prepareForPocketBase(data, { keepId: true });
  const payload = {
    ...prepared,
    workspace: workspaceId,
  };
  
  try {
    const result = await pb.collection(collectionName).create(payload);
    return pbToFrontend<T>(result);
  } catch (err) {
    // Log the full error including validation details from PocketBase
    const pbError = err as { data?: Record<string, unknown>; message?: string };
    console.error(`[pocketbase] createInWorkspace failed for ${collectionName}:`, {
      payload,
      error: err,
      validationErrors: pbError?.data,
      message: pbError?.message,
    });
    throw err;
  }
}

/**
 * Update a record.
 * Returns transformed record in frontend format.
 */
export async function updateRecord<T>(
  collectionName: 'tasks' | 'pages' | 'pages',
  id: string,
  data: Record<string, unknown>
): Promise<T> {
  // Skip workspace on updates - it's immutable
  const prepared = prepareForPocketBase(data, { skipWorkspace: true });
  const result = await pb.collection(collectionName).update(id, prepared);
  return pbToFrontend<T>(result);
}

/**
 * Delete a record
 */
export async function deleteRecord(
  collectionName: 'tasks' | 'pages' | 'pages',
  id: string
): Promise<void> {
  await pb.collection(collectionName).delete(id);
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

type CollectionName = 'tasks' | 'pages' | 'pages';

interface BatchUpdateItem {
  id: string;
  data: Record<string, unknown>;
}

/**
 * Batch update multiple records using PocketBase's batch API.
 * This sends a single request instead of N individual requests.
 * 
 * @param collectionName - The collection to update
 * @param updates - Array of { id, data } objects
 * @returns Array of updated records in frontend format
 */
export async function batchUpdate<T>(
  collectionName: CollectionName,
  updates: BatchUpdateItem[]
): Promise<T[]> {
  if (updates.length === 0) return [];
  
  const batch = pb.createBatch();
  
  for (const { id, data } of updates) {
    const prepared = prepareForPocketBase(data);
    batch.collection(collectionName).update(id, prepared);
  }
  
  const results = await batch.send();
  return results.map(r => pbToFrontend<T>(r));
}

/**
 * Batch delete multiple records using PocketBase's batch API.
 * This sends a single request instead of N individual requests.
 * 
 * @param collectionName - The collection to delete from
 * @param ids - Array of record IDs to delete
 */
export async function batchDelete(
  collectionName: CollectionName,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return;
  
  const batch = pb.createBatch();
  
  for (const id of ids) {
    batch.collection(collectionName).delete(id);
  }
  
  await batch.send();
}
