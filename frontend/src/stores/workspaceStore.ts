/**
 * @file workspaceStore.ts
 * @description Workspace state management for team-based multi-tenancy
 * @app SHARED - Used across all views
 *
 * Manages:
 * - Current workspace selection
 * - List of user's workspaces
 * - Workspace CRUD operations
 * - Workspace member management
 *
 * Works with:
 * - authStore.ts - Gets current user for workspace filtering
 * - pocketbase.ts - API calls to workspace collections
 * - All domain stores filter by current workspace
 * - syncEngine - Notified of workspace changes for filtering sync operations
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { pb, safeFilter } from '@/lib/pocketbase';
import { syncEngine } from '@/lib/syncEngine/index';
import { isNetworkError } from '@/lib/errors';

// ============================================================================
// TYPES
// ============================================================================

export type WorkspaceMemberRole = 'owner' | 'admin' | 'member';

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  owner: string;
  isPersonal?: boolean;
  // Cached usage counters (maintained by backend hooks)
  pageCount?: number;
  taskCount?: number;
  storageUsed?: number;
  created: string;
  updated: string;
}

export interface WorkspaceMember {
  id: string;
  user: string;
  workspace: string;
  role: WorkspaceMemberRole;
  created: string;
  updated: string;
}

export interface WorkspaceWithRole extends Workspace {
  role: WorkspaceMemberRole;
}

// ============================================================================
// STATE INTERFACE
// ============================================================================

interface WorkspaceState {
  // Data
  workspaces: WorkspaceWithRole[];
  currentWorkspaceId: string | null;

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Computed
  currentWorkspace: WorkspaceWithRole | null;

  // Actions
  fetchWorkspaces: () => Promise<void>;
  setCurrentWorkspace: (workspaceId: string) => void;
  createWorkspace: (name: string, description?: string) => Promise<Workspace>;
  updateWorkspace: (
    id: string,
    updates: Partial<Pick<Workspace, 'name' | 'description' | 'icon' | 'color'>>
  ) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;

  // Member management
  inviteMember: (workspaceId: string, email: string, role?: WorkspaceMemberRole) => Promise<void>;
  removeMember: (workspaceId: string, userId: string) => Promise<void>;
  updateMemberRole: (
    workspaceId: string,
    userId: string,
    role: WorkspaceMemberRole
  ) => Promise<void>;

  // Initialization
  initializeWorkspace: () => Promise<void>;
  reset: () => void;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState = {
  workspaces: [],
  currentWorkspaceId: null,
  currentWorkspace: null,
  isLoading: false,
  error: null,
};

// ============================================================================
// STORE
// ============================================================================

export const useWorkspaceStore = create<WorkspaceState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // ----------------------------------------------------------------------
        // FETCH WORKSPACES
        // ----------------------------------------------------------------------
        fetchWorkspaces: async () => {
          set({ isLoading: true, error: null }, false, 'fetchWorkspaces/start');

          try {
            // Get user's workspace memberships
            const memberships = await pb.collection('workspace_members').getFullList<WorkspaceMember>({
              filter: safeFilter('user = {:userId}', { userId: pb.authStore.record?.id ?? '' }),
              expand: 'workspace',
            });

            // Map to workspaces with roles
            const workspaces: WorkspaceWithRole[] = memberships.map((m: WorkspaceMember & { expand?: { workspace: Workspace } }) => {
              const ws = m.expand?.workspace as Workspace;
              return {
                ...ws,
                role: m.role,
              };
            });

            // Update state
            set(
              {
                workspaces,
                isLoading: false,
              },
              false,
              'fetchWorkspaces/success'
            );

            // Set current workspace if not set, or update currentWorkspace object if we have a persisted ID
            const { currentWorkspaceId } = get();
            if (!currentWorkspaceId && workspaces.length > 0) {
              get().setCurrentWorkspace(workspaces[0].id);
            } else if (currentWorkspaceId) {
              // Verify current workspace is still accessible
              const stillAccessible = workspaces.some((w) => w.id === currentWorkspaceId);
              if (stillAccessible) {
                // Update currentWorkspace object now that workspaces are loaded
                get().setCurrentWorkspace(currentWorkspaceId);
              } else if (workspaces.length > 0) {
                get().setCurrentWorkspace(workspaces[0].id);
              }
            }
          } catch (e) {
            set(
              {
                error: (e as Error).message,
                isLoading: false,
              },
              false,
              'fetchWorkspaces/error'
            );
            throw e;
          }
        },

        // ----------------------------------------------------------------------
        // SET CURRENT WORKSPACE
        // ----------------------------------------------------------------------
        setCurrentWorkspace: (workspaceId: string) => {
          const { workspaces } = get();
          const workspace = workspaces.find((w) => w.id === workspaceId) || null;

          // Update sync engine to only sync this workspace's data
          syncEngine.setWorkspace(workspaceId);

          set(
            {
              currentWorkspaceId: workspaceId,
              currentWorkspace: workspace,
            },
            false,
            'setCurrentWorkspace'
          );
        },

        // ----------------------------------------------------------------------
        // CREATE WORKSPACE
        // ----------------------------------------------------------------------
        createWorkspace: async (name: string, description?: string) => {
          set({ isLoading: true, error: null }, false, 'createWorkspace/start');

          try {
            const userId = pb.authStore.record?.id;
            if (!userId) throw new Error('Not authenticated');

            // Create workspace with current user as owner
            const workspace = await pb.collection('workspaces').create<Workspace>({
              name,
              description,
              owner: userId,
            });

            // Create membership for owner
            await pb.collection('workspace_members').create<WorkspaceMember>({
              user: userId,
              workspace: workspace.id,
              role: 'owner',
            });

            // Add to local state
            const workspaceWithRole: WorkspaceWithRole = {
              ...workspace,
              role: 'owner',
            };

            set(
              (state) => ({
                workspaces: [...state.workspaces, workspaceWithRole],
                isLoading: false,
              }),
              false,
              'createWorkspace/success'
            );

            return workspace;
          } catch (e) {
            set(
              {
                error: (e as Error).message,
                isLoading: false,
              },
              false,
              'createWorkspace/error'
            );
            throw e;
          }
        },

        // ----------------------------------------------------------------------
        // UPDATE WORKSPACE
        // ----------------------------------------------------------------------
        updateWorkspace: async (id, updates) => {
          try {
            const updated = await pb.collection('workspaces').update<Workspace>(id, updates);

            set(
              (state) => ({
                workspaces: state.workspaces.map((w) =>
                  w.id === id ? { ...w, ...updated } : w
                ),
                currentWorkspace:
                  state.currentWorkspaceId === id
                    ? { ...state.currentWorkspace!, ...updated }
                    : state.currentWorkspace,
              }),
              false,
              'updateWorkspace'
            );
          } catch (e) {
            set({ error: (e as Error).message }, false, 'updateWorkspace/error');
            throw e;
          }
        },

        // ----------------------------------------------------------------------
        // DELETE WORKSPACE
        // ----------------------------------------------------------------------
        deleteWorkspace: async (id) => {
          try {
            await pb.collection('workspaces').delete(id);

            const { workspaces, currentWorkspaceId } = get();
            const remaining = workspaces.filter((w) => w.id !== id);

            set(
              {
                workspaces: remaining,
                // Switch to another workspace if current was deleted
                currentWorkspaceId:
                  currentWorkspaceId === id
                    ? remaining[0]?.id || null
                    : currentWorkspaceId,
                currentWorkspace:
                  currentWorkspaceId === id ? remaining[0] || null : get().currentWorkspace,
              },
              false,
              'deleteWorkspace'
            );
          } catch (e) {
            set({ error: (e as Error).message }, false, 'deleteWorkspace/error');
            throw e;
          }
        },

        // ----------------------------------------------------------------------
        // MEMBER MANAGEMENT
        // ----------------------------------------------------------------------
        inviteMember: async (workspaceId, email, role = 'member') => {
          try {
            // Use custom endpoint to look up user by email (bypasses users collection rules)
            const response = await fetch(`${pb.baseURL}/api/users/lookup`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': pb.authStore.token || '',
              },
              body: JSON.stringify({ email }),
            });

            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.message || 'User not found with that email');
            }

            const user = await response.json();
            const userId = user.id;

            // Create membership
            await pb.collection('workspace_members').create({
              user: userId,
              workspace: workspaceId,
              role,
            });
          } catch (e) {
            set({ error: (e as Error).message }, false, 'inviteMember/error');
            throw e;
          }
        },

        removeMember: async (workspaceId, userId) => {
          try {
            // Find the membership record
            const memberships = await pb.collection('workspace_members').getList(1, 1, {
              filter: safeFilter('workspace = {:workspaceId} && user = {:userId}', { workspaceId, userId }),
            });

            if (memberships.items.length > 0) {
              await pb.collection('workspace_members').delete(memberships.items[0].id);
            }
          } catch (e) {
            set({ error: (e as Error).message }, false, 'removeMember/error');
            throw e;
          }
        },

        updateMemberRole: async (workspaceId, userId, role) => {
          try {
            const memberships = await pb.collection('workspace_members').getList(1, 1, {
              filter: safeFilter('workspace = {:workspaceId} && user = {:userId}', { workspaceId, userId }),
            });

            if (memberships.items.length > 0) {
              await pb.collection('workspace_members').update(memberships.items[0].id, { role });
            }
          } catch (e) {
            set({ error: (e as Error).message }, false, 'updateMemberRole/error');
            throw e;
          }
        },

        // ----------------------------------------------------------------------
        // INITIALIZATION
        // ----------------------------------------------------------------------
        initializeWorkspace: async () => {
          const { fetchWorkspaces, createWorkspace, setCurrentWorkspace } = get();

          try {
            await fetchWorkspaces();
          } catch (e) {
            // OFFLINE SUPPORT: If we fail to fetch workspaces but already have a current workspace
            // and some workspaces in state (from persistence), we can proceed.
            const { workspaces, currentWorkspaceId } = get();
            
            // If it's a network error and we have cached data, just use it
            if (isNetworkError(e) && workspaces.length > 0) {
              console.warn('[Workspace] Network error during initialization, using cached data');
              if (currentWorkspaceId) {
                setCurrentWorkspace(currentWorkspaceId);
              } else {
                setCurrentWorkspace(workspaces[0].id);
              }
              return;
            }
            
            if (currentWorkspaceId && workspaces.length > 0) {
              console.warn('[Workspace] Failed to fetch workspaces, using cached data:', e);
              return;
            }
            // If we have no workspaces and no current ID, we must throw so the UI can handle it
            throw e;
          }

          const { workspaces } = get();

          // If user has no workspaces, create a default "Personal" workspace
          if (workspaces.length === 0) {
            const personal = await createWorkspace('Personal', 'Your personal workspace');
            setCurrentWorkspace(personal.id);
          }
        },

        // ----------------------------------------------------------------------
        // RESET
        // ----------------------------------------------------------------------
        reset: () => {
          set(initialState, false, 'reset');
        },
      }),
      {
        name: 'planneer-workspace',
        partialize: (state) => ({
          currentWorkspaceId: state.currentWorkspaceId,
          workspaces: state.workspaces,
        }),
      }
    ),
    { name: 'WorkspaceStore' }
  )
);

// ============================================================================
// SELECTORS
// ============================================================================

export const selectCurrentWorkspaceId = (state: WorkspaceState) => state.currentWorkspaceId;
export const selectCurrentWorkspace = (state: WorkspaceState) => state.currentWorkspace;
export const selectWorkspaces = (state: WorkspaceState) => state.workspaces;
export const selectIsWorkspaceOwner = (state: WorkspaceState) =>
  state.currentWorkspace?.role === 'owner';
export const selectIsWorkspaceAdmin = (state: WorkspaceState) =>
  state.currentWorkspace?.role === 'owner' || state.currentWorkspace?.role === 'admin';
export const selectIsPersonalWorkspace = (state: WorkspaceState) =>
  state.currentWorkspace?.isPersonal === true;

// ============================================================================
// HELPER HOOKS
// ============================================================================

/**
 * Get the current workspace ID (throws if not set)
 * Use this in API calls to ensure workspace is always set
 */
export function getCurrentWorkspaceId(): string {
  const workspaceId = useWorkspaceStore.getState().currentWorkspaceId;
  if (!workspaceId) {
    throw new Error('No workspace selected');
  }
  return workspaceId;
}

/**
 * Get the current workspace ID or null
 * Use this when you need to check if a workspace is selected
 */
export function getCurrentWorkspaceIdOrNull(): string | null {
  return useWorkspaceStore.getState().currentWorkspaceId;
}
