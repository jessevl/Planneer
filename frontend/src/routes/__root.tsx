/**
 * @file __root.tsx
 * @description Root layout route - wraps all pages with sidebar and global modals
 * @app ROOT - TanStack Router root layout
 * 
 * Authentication flow (simplified state machine):
 * 1. 'initializing' - Check if backend is available, initialize auth
 * 2. 'unauthenticated' - Backend available, user not logged in → show login
 * 3. 'loading-data' - Authenticated (or dev mode), loading domain data
 * 4. 'ready' - Data loaded, show app
 * 5. 'error' - Failed to load data, show error with retry
 * 
 * Phase 6 additions:
 * - Session validation and expiry handling
 * - Connection status monitoring
 * - Workspace access error handling
 * - Global error boundary
 */
import { createRootRoute, Outlet, useNavigate, useLocation } from '@tanstack/react-router';
import { lazy, Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import UnifiedSidebar from '@/components/layout/UnifiedSidebar';
import MobileDrawer from '@/components/layout/MobileDrawer';
import FloatingActionBar from '@/components/layout/FloatingActionBar';
import ConfirmDeleteModal from '@/components/common/ConfirmDeleteModal';
import ConfirmModal from '@/components/common/ConfirmModal';
import { ErrorBanner } from '@/components/ui';
import { ToastContainer } from '@/components/ui';

// Lazy-loaded modals and overlays (shown conditionally / rarely)
const CommandPalette = lazy(() => import('@/components/common/CommandPalette'));
const PWAInstallBanner = lazy(() => import('@/components/common/PWAInstallBanner'));
const GlobalTaskModal = lazy(() => import('@/components/tasks/GlobalTaskModal'));
const BulkActionBar = lazy(() => import('@/components/tasks/BulkActionBar').then(m => ({ default: m.BulkActionBar })));
import { LANDING_URL } from '@/lib/config';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { NavigationBlocker } from '@/components/common/NavigationBlocker';
import { useHydration } from '@/hooks/useHydration';
import { useIsDesktop, useIsMobile, useIsStandalone } from '@frameer/hooks/useMobileDetection';
import { useSyncStore } from '@/stores/syncStore';
import { useSessionValidator } from '@/hooks/useSessionValidator';
import { useWorkspaceAccess } from '@/hooks/useWorkspaceAccess';
import { useCommandPaletteShortcut, useCommandPaletteStore } from '@/hooks/useCommandPalette';
import { useNavigationStore } from '@/stores/navigationStore';
import { useAuthStore, setupAuthListener } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { useTasksStore } from '@/stores/tasksStore';
import { usePagesStore, type PagesState } from '@/stores/pagesStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { syncEngine } from '@/lib/syncEngine/index';
import { onAuthError, pb } from '@/lib/pocketbase';
import { isSessionExpired, logError } from '@/lib/errors';
import { ensureBooxIntegrationFresh } from '@/api/booxApi';
import { devLog } from '@/lib/config';
import { MobileLayoutProvider } from '@/contexts/MobileLayoutContext';
import { PageTransition } from '@/components/layout/PageTransition';
import { cn } from '@/lib/design-system';
import { FLOATING_SURFACE_CLASSNAME } from '@/components/ui';
import { UNIFIED_SIDEBAR_DEFAULT_EXPANDED_WIDTH, UNIFIED_SIDEBAR_FLOATING_GUTTER, UNIFIED_SIDEBAR_RAIL_WIDTH } from '@/components/layout/UnifiedSidebar';
import { getFloatingPanelReserveWidth, FLOATING_PANEL_GUTTER_PX } from '@/lib/layout';
import FloatingSidePanelLayout from '@/components/layout/FloatingSidePanelLayout';
import { DesktopFloatingPanelContext, useDesktopFloatingPanelProvider } from '@/contexts/DesktopFloatingPanelContext';

type IdleCallbackHandle = number;

const warmLikelyNextViews = () => {
  void Promise.allSettled([
    import('@/views/PagesView'),
    import('@/views/TasksView'),
    import('@/components/pages/PageEditor'),
    import('@/components/layout/UnifiedSidepanel'),
  ]);
};

const scheduleIdleWarmup = (callback: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {};

  if ('requestIdleCallback' in window) {
    const handle = window.requestIdleCallback(() => callback(), { timeout: 2500 }) as IdleCallbackHandle;

    return () => {
      if ('cancelIdleCallback' in window) {
        window.cancelIdleCallback(handle);
      }
    };
  }

  const handle = globalThis.setTimeout(callback, 1200);
  return () => globalThis.clearTimeout(handle);
};

// Compute sidepanel reserve inline to avoid importing the entire UnifiedSidepanel module
const UNIFIED_SIDEPANEL_FLOATING_RESERVE_WIDTH = getFloatingPanelReserveWidth(328, FLOATING_PANEL_GUTTER_PX);

// Lazy load LoginForm - only needed for unauthenticated users
const LoginForm = lazy(() => import('@/components/auth/LoginForm').then(m => ({ default: m.LoginForm })));

// Lazy load SessionExpiredModal - only needed when session expires
const SessionExpiredModal = lazy(() => import('@/components/auth/SessionExpiredModal').then(m => ({ default: m.SessionExpiredModal })));

// Lazy load WorkspaceAccessErrorModal - only needed on workspace access errors
const WorkspaceAccessErrorModal = lazy(() => import('@/components/workspace/WorkspaceAccessErrorModal').then(m => ({ default: m.WorkspaceAccessErrorModal })));

// Lazy load devtools in development
const TanStackRouterDevtools =
  process.env.NODE_ENV === 'production'
    ? () => null
    : lazy(() =>
        import('@tanstack/react-router-devtools').then((res) => ({
          default: res.TanStackRouterDevtools,
        }))
      );

export const Route = createRootRoute({
  component: RootLayout,
});

type AppState = 'initializing' | 'unauthenticated' | 'loading-data' | 'ready' | 'error';

type WorkspaceErrorType = 'removed' | 'deleted' | 'not_found' | null;

function RootLayout() {
  const isHydrated = useHydration();
  const isDesktop = useIsDesktop();
  const isMobile = useIsMobile();
  const isStandalone = useIsStandalone();
  const sidebarVisible = useNavigationStore((s) => s.sidebarVisible);
  const sidebarPinned = useNavigationStore((s) => s.sidebarPinned);
  const sidePanelOpen = useNavigationStore((s) => s.sidePanelOpen);
  const setSidebarVisible = useNavigationStore((s) => s.setSidebarVisible);
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  const setSelectionMode = useSelectionStore((s) => s.setSelectionMode);
  const navigate = useNavigate();
  const location = useLocation();

  // Clear selection on navigation
  useEffect(() => {
    clearSelection();
    setSelectionMode(false);
  }, [location.pathname, clearSelection, setSelectionMode]);

  const desktopFloatingPanelValue = useDesktopFloatingPanelProvider();
  const gutter = UNIFIED_SIDEBAR_FLOATING_GUTTER;
  const supportsFloatingRightPanel = location.pathname.startsWith('/tasks') || location.pathname.startsWith('/pages');
  const fallbackRightPanelReserve = isDesktop && supportsFloatingRightPanel && sidePanelOpen
    ? UNIFIED_SIDEPANEL_FLOATING_RESERVE_WIDTH
    : 0;
  const effectiveRightPanelReserve = desktopFloatingPanelValue.rightPanelReserve > 0
    ? desktopFloatingPanelValue.rightPanelReserve
    : fallbackRightPanelReserve;

  const renderSidebarPanel = useCallback(
    ({ mode, width, setWidth }: { mode: 'collapsed' | 'expanded'; width: number; setWidth: (width: number) => void }) => (
      <UnifiedSidebar
        mode={mode === 'expanded' ? 'expanded' : 'rail'}
        width={width}
        onWidthChange={setWidth}
      />
    ),
    [],
  );

  // Mobile drawer state (separate from desktop sidebar visibility)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  
  // Command palette state and keyboard shortcut
  const { isOpen: commandPaletteOpen, close: closeCommandPalette } = useCommandPaletteStore();
  useCommandPaletteShortcut();
  
  // Simple state machine
  const [appState, setAppState] = useState<AppState>('initializing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [backendAvailable, setBackendAvailable] = useState(false);
  
  // Session and workspace error states
  const [showSessionExpired, setShowSessionExpired] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<WorkspaceErrorType>(null);

  // Track initialization - use a module-level flag to survive HMR
  // The ref alone doesn't work because HMR can recreate stores while keeping refs
  const initRef = useRef(false);
  const routeWarmupRef = useRef(false);
  const pendingAuthRecoveryRef = useRef<Promise<boolean> | null>(null);
  // Track current workspace to detect switches
  const prevWorkspaceIdRef = useRef<string | null>(null);
  
  // Auth state
  const { user, authLoading, initializeAuth, logout } = useAuthStore(
    useShallow((s) => ({
      user: s.user,
      authLoading: s.isLoading,
      initializeAuth: s.initializeAuth,
      logout: s.logout,
    }))
  );
  
  // Workspace state
  const { currentWorkspaceId, workspaces, setCurrentWorkspace } = useWorkspaceStore(
    useShallow((s) => ({
      currentWorkspaceId: s.currentWorkspaceId,
      workspaces: s.workspaces,
      setCurrentWorkspace: s.setCurrentWorkspace,
    }))
  );
  
  // Session validation - validates auth token periodically and on focus
  useSessionValidator({
    validationInterval: 60000, // Check every minute
    onSessionExpired: () => {
      const authState = useAuthStore.getState();
      if (Date.now() - authState.lastValidatedAt < 10000) {
        return;
      }

      // Clear any workspace error - session expiry takes priority
      setWorkspaceError(null);
      setShowSessionExpired(true);
    },
  });
  
  // Workspace access validation - detects removal from workspace
  // Disabled when session expired modal is showing to prevent false "removed" errors
  useWorkspaceAccess({
    onAccessLost: (reason) => {
      // Don't show workspace error if session expired is already showing
      if (!showSessionExpired) {
        setWorkspaceError(reason);
      }
    },
    enabled: appState === 'ready' && !!user && !showSessionExpired,
  });

  useEffect(() => {
    if (appState !== 'ready' || routeWarmupRef.current) return;

    routeWarmupRef.current = true;
    return scheduleIdleWarmup(warmLikelyNextViews);
  }, [appState]);
  
  // Handle session expired - go to login
  const handleSessionExpiredLogin = useCallback(async () => {
    setShowSessionExpired(false);
    await logout();
    setAppState('unauthenticated');
  }, [logout]);
  
  // Handle workspace access errors
  const handleWorkspaceSwitchOnError = useCallback(() => {
    setWorkspaceError(null);
    // Switch to first available workspace
    if (workspaces.length > 0) {
      const firstWorkspace = workspaces[0];
      setCurrentWorkspace(firstWorkspace.id);
    }
  }, [workspaces, setCurrentWorkspace]);
  
  const handleGoHomeOnWorkspaceError = useCallback(() => {
    setWorkspaceError(null);
    navigate({ to: '/' });
  }, [navigate]);

  // Listen for global auth errors (401) from PocketBase client
  useEffect(() => {
    const unsubscribe = onAuthError(() => {
      const authState = useAuthStore.getState();
      if (showSessionExpired || !authState.user) return;
      if (Date.now() - authState.lastValidatedAt < 10000) return;

      if (!pendingAuthRecoveryRef.current) {
        pendingAuthRecoveryRef.current = (async () => {
          try {
            await pb.collection('users').authRefresh();
            return true;
          } catch {
            return false;
          } finally {
            pendingAuthRecoveryRef.current = null;
          }
        })();
      }

      void pendingAuthRecoveryRef.current.then((recovered) => {
        if (recovered || showSessionExpired || !useAuthStore.getState().user) return;
        setWorkspaceError(null);
        setShowSessionExpired(true);
      });
    });
    return unsubscribe;
  }, [showSessionExpired]);

  // Watch for user becoming null (logout/expiry)
  // If user is null but we're in a state that requires auth, go to unauthenticated state
  // Exception: if showSessionExpired is true, we stay in ready state to show the modal
  useEffect(() => {
    if (!user && appState === 'ready' && !showSessionExpired) {
      setAppState('unauthenticated');
    }
  }, [user, appState, showSessionExpired]);
  
  // Initialize app on mount
  useEffect(() => {
    if (initRef.current || !isHydrated) return;
    initRef.current = true;
    
    const init = async () => {
      try {
        // Check if backend is available by attempting auth init
        await initializeAuth();
        setBackendAvailable(true);
        
        // If user is authenticated, proceed to load data
        if (useAuthStore.getState().user) {
          setAppState('loading-data');
        } else {
          setAppState('unauthenticated');
        }
      } catch {
        // Backend not available - dev mode with mock data
        setBackendAvailable(false);
        setAppState('loading-data');
      }
    };
    
    init();
    
    // Set up auth state listener (returns unsubscribe function)
    const unsubscribe = setupAuthListener();
    return unsubscribe;
  }, [isHydrated, initializeAuth]);
  
  // Fetch domain data when entering 'loading-data' state
  useEffect(() => {
    if (appState !== 'loading-data') return;
    
    const loadData = async () => {
      try {
        // NOTE: We use getState() inside async functions intentionally.
        // After awaits, we need fresh state, not stale closure values from render time.
        
        // If authenticated, initialize workspace first
        const authState = useAuthStore.getState();
        if (authState.user) {
          await useWorkspaceStore.getState().initializeWorkspace();
        }
        
        // Get current workspace ID
        const workspaceId = useWorkspaceStore.getState().currentWorkspaceId;
        if (!workspaceId && authState.user) {
          // No workspace - this shouldn't happen, but handle it
          throw new Error('No workspace available');
        }
        
        // Check if stores already have data (e.g., preserved across HMR)
        const tasksState = useTasksStore.getState();
        const pagesState = usePagesStore.getState();
        
        const storesEmpty = Object.keys(tasksState.tasksById).length === 0 &&
          Object.keys(pagesState.pagesById).length === 0;
        
        // Only load if stores are empty (skip for HMR recovery)
        if (storesEmpty && workspaceId) {
          // Initialize sync engine first
          await useSyncStore.getState().initialize();
          
          // Load data through sync engine (IndexedDB first, then server)
          // This handles offline-first: shows cached data immediately,
          // then fetches from server and merges with CRDT
          await useSyncStore.getState().loadInitialData(workspaceId);
          
          // Load children for any previously-expanded pages (from persisted state)
          await usePagesStore.getState().loadChildrenForExpandedPages();
        }
        
        setAppState('ready');
      } catch (error) {
        // Check for specific error types
        if (isSessionExpired(error)) {
          const authState = useAuthStore.getState();
          if (Date.now() - authState.lastValidatedAt < 10000) {
            setAppState('ready');
            return;
          }

          setShowSessionExpired(true);
          return;
        }
        
        // Log the error
        logError(error, 'RootLayout/loadData');
        
        const message = error instanceof Error ? error.message : 'Unknown error';
        
        // Check for workspace access errors
        if (message.includes('not a member') || message.includes('permission')) {
          setWorkspaceError('removed');
          return;
        }
        if (message.includes('not found') || message.includes('deleted')) {
          setWorkspaceError('not_found');
          return;
        }
        
        setErrorMessage(message);
        setAppState('error');
      }
    };
    
    loadData();
  }, [appState]);

  useEffect(() => {
    if (appState !== 'ready' || !currentWorkspaceId) {
      return;
    }

    let cancelled = false;

    ensureBooxIntegrationFresh(currentWorkspaceId)
      .then((result) => {
        if (result && !cancelled) {
          return usePagesStore.getState().loadPages({ sortBy: 'updated', sortDirection: 'desc' });
        }
      })
      .catch((error) => devLog('[BOOX] auto-refresh skipped', error));

    return () => { cancelled = true; };
  }, [appState, currentWorkspaceId]);
  
  // Visibility-based sync is handled by the SyncEngine's own visibilitychange listener
  // (skips <30s hides, delta sync for 30s-5min, full refresh for 5min+)

  // Start real-time sync when ready
  useEffect(() => {
    if (appState !== 'ready') return;
    
    // Start SSE subscriptions through sync engine
    // The sync engine was already initialized during data loading
    useSyncStore.getState().startRealtimeSync();
    
    return () => {
      // Stop SSE subscriptions on cleanup
      useSyncStore.getState().stopRealtimeSync();
    };
  }, [appState]);
  
  // Handle user login (transition from unauthenticated → loading-data)
  useEffect(() => {
    if (appState === 'unauthenticated' && user) {
      setAppState('loading-data');
    }
  }, [appState, user]);
  
  // Handle user logout (transition from authenticated states → unauthenticated)
  useEffect(() => {
    const isAuthenticatedState = appState === 'ready' || appState === 'loading-data';
    if (isAuthenticatedState && !user && backendAvailable) {
      // User logged out - reset stores and go to login
      useTasksStore.getState().reset();
      usePagesStore.getState().reset();
      useWorkspaceStore.getState().reset();
      useNavigationStore.getState().resetViewPreferences();
      setAppState('unauthenticated');
    }
  }, [appState, user, backendAvailable]);
  
  // Handle workspace switch - clear data and refetch when workspace changes
  useEffect(() => {
    // Skip on initial load (when prevWorkspaceIdRef is null)
    if (prevWorkspaceIdRef.current === null) {
      prevWorkspaceIdRef.current = currentWorkspaceId;
      return;
    }
    
    // If workspace changed and we're in ready state, refetch data
    if (currentWorkspaceId && currentWorkspaceId !== prevWorkspaceIdRef.current && appState === 'ready') {
      devLog('[Workspace] Switching from', prevWorkspaceIdRef.current, 'to', currentWorkspaceId);
      prevWorkspaceIdRef.current = currentWorkspaceId;
      
      // Reset all stores to initial state
      useTasksStore.getState().reset();
      usePagesStore.getState().reset();
      
      // Navigate to home page when switching workspaces
      navigate({ to: '/' });
      
      // Trigger data reload
      setAppState('loading-data');
    }
  }, [currentWorkspaceId, appState, navigate]);
  
  // Helper to clear all error states
  const clearAllErrors = useCallback(() => {
    setErrorMessage(null);
    useTasksStore.setState({ error: null });
    usePagesStore.setState({ error: null });
  }, []);
  
  // Retry handler - reset to loading state
  const handleRetry = useCallback(() => {
    clearAllErrors();
    setAppState('loading-data');
  }, [clearAllErrors]);
  
  // Dismiss error (shows app with potentially empty data)
  const handleDismissError = useCallback(() => {
    clearAllErrors();
    setAppState('ready');
  }, [clearAllErrors]);

  // Render based on state machine
  if (!isHydrated || appState === 'initializing') {
    return (
      <div className="fixed inset-0 bg-[var(--color-surface-base)] flex items-center justify-center">
        <div className="animate-pulse text-[var(--color-text-tertiary)]">Loading...</div>
      </div>
    );
  }
  
  if (backendAvailable && (appState === 'unauthenticated' || authLoading)) {
    if (authLoading) {
      return (
        <div className="fixed inset-0 bg-[var(--color-surface-base)] flex items-center justify-center">
          <div className="animate-pulse text-[var(--color-text-tertiary)]">Authenticating...</div>
        </div>
      );
    }
    
    // Show login form for unauthenticated users on the app subdomain
    return (
      <Suspense fallback={
        <div className="fixed inset-0 bg-[var(--color-surface-base)] flex items-center justify-center">
          <div className="animate-pulse text-[var(--color-text-tertiary)]">Loading...</div>
        </div>
      }>
        <LoginForm onBack={() => window.location.href = LANDING_URL} />
        <ToastContainer />
      </Suspense>
    );
  }
  
  if (appState === 'error') {
    return (
      <div className="fixed inset-0 bg-[var(--color-surface-base)] flex flex-col">
        <ErrorBanner
          message="Failed to connect to server"
          details={errorMessage || undefined}
          onRetry={handleRetry}
          onDismiss={handleDismissError}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8">
            <p className="text-[var(--color-text-secondary)] mb-4">
              Unable to load your data. Please check that the backend server is running.
            </p>
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-[var(--color-interactive-bg-strong)] text-white rounded-md hover:brightness-110 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
        <ToastContainer />
      </div>
    );
  }
  
  if (appState === 'loading-data') {
    return (
      <div className="fixed inset-0 bg-[var(--color-surface-base)] flex items-center justify-center">
        <div className="animate-pulse text-[var(--color-text-tertiary)]">Loading workspace...</div>
        <ToastContainer />
      </div>
    );
  }

  // appState === 'ready'
  return (
    <ErrorBoundary context="RootLayout">
      <MobileLayoutProvider value={{ 
        isMobile, 
        onOpenDrawer: () => setMobileDrawerOpen(true),
        onCloseDrawer: () => setMobileDrawerOpen(false),
      }}>
        {/* 
          Use fixed positioning with lvh (Large Viewport Height) to ensure the app
          fills the entire screen including behind safe areas on iOS PWA.
          
          Desktop: Layered layout with paper-style main content
          Mobile: Traditional flat layout
        */}
        <div 
          className={`fixed top-0 left-0 right-0 bottom-0 w-screen flex flex-col overflow-hidden ${
            isMobile 
              ? 'bg-[var(--color-surface-base)]' 
              : 'layout-background'
          }`}
          style={{ minHeight: '100lvh', height: '100lvh' }}
        >
          <div
            className="flex flex-1 overflow-hidden"
          >
            {/* Mobile Drawer - slides in from left side on mobile */}
            {isMobile && (
              <MobileDrawer
                isOpen={mobileDrawerOpen}
                onClose={() => setMobileDrawerOpen(false)}
                position="left"
              >
                <UnifiedSidebar />
              </MobileDrawer>
            )}
            
            {/* Main content area - Paper surface on desktop, flat on mobile */}
            {isMobile ? (
              <main className="flex-1 flex flex-col overflow-hidden bg-[var(--color-surface-base)]">
                <ErrorBoundary context="MainContent">
                  <PageTransition>
                    <Outlet />
                  </PageTransition>
                </ErrorBoundary>
              </main>
            ) : (
              <DesktopFloatingPanelContext.Provider value={desktopFloatingPanelValue}>
                <div className="flex flex-col flex-1 overflow-hidden">
                  <FloatingSidePanelLayout
                    side="left"
                    isOpen={sidebarVisible}
                    onOpenChange={setSidebarVisible}
                    pinned={sidebarPinned}
                    collapsedWidth={UNIFIED_SIDEBAR_RAIL_WIDTH}
                    railWidth={UNIFIED_SIDEBAR_RAIL_WIDTH}
                    defaultExpandedWidth={UNIFIED_SIDEBAR_DEFAULT_EXPANDED_WIDTH}
                    gutterPx={gutter}
                    contentClassName="flex flex-col"
                    renderPanel={renderSidebarPanel}
                  >
                    <div
                      ref={desktopFloatingPanelValue.setRightPanelPortalElement}
                      className="absolute inset-0 pointer-events-none z-20"
                    />
                    <div
                      className="flex-1 flex flex-col overflow-hidden transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                      style={{
                        marginLeft: -gutter,
                        paddingLeft: gutter,
                        paddingTop: `max(${gutter}px, env(safe-area-inset-top))`,
                        paddingBottom: gutter,
                        paddingRight: effectiveRightPanelReserve > 0
                          ? effectiveRightPanelReserve
                          : `max(${gutter}px, env(safe-area-inset-right))`,
                      }}
                    >
                      <main className={cn(
                        FLOATING_SURFACE_CLASSNAME,
                        'flex-1 flex flex-col overflow-hidden',
                      )} style={{ margin: 0 }}>
                        <ErrorBoundary context="MainContent">
                          <PageTransition>
                            <Outlet />
                          </PageTransition>
                        </ErrorBoundary>
                      </main>
                    </div>
                  </FloatingSidePanelLayout>
                </div>
              </DesktopFloatingPanelContext.Provider>
            )}
          </div>
          
          {/* Floating Action Bar - always rendered, handles its own mobile/desktop display */}
          <FloatingActionBar />
        </div>
        
        {/* Global modals */}
        <ConfirmDeleteModal />
        <ConfirmModal />
        <Suspense fallback={null}>
          <GlobalTaskModal />
          <BulkActionBar />
        </Suspense>
        
        {/* Navigation blocker for unsaved changes */}
        <NavigationBlocker />
        
        {/* PWA Install Banner */}
        <Suspense fallback={null}>
          <PWAInstallBanner />
        </Suspense>
        
        {/* Toast Notifications */}
        <ToastContainer />
        
        {/* Command Palette */}
        <Suspense fallback={null}>
          <CommandPalette 
            isOpen={commandPaletteOpen} 
            onClose={closeCommandPalette} 
          />
        </Suspense>
        
        {/* Session expired modal */}
        <Suspense fallback={null}>
          <SessionExpiredModal
            isOpen={showSessionExpired}
            onLogin={handleSessionExpiredLogin}
          />
        </Suspense>
        
        {/* Workspace access error modal */}
        <Suspense fallback={null}>
          {workspaceError && (
            <WorkspaceAccessErrorModal
              isOpen={!!workspaceError}
              errorType={workspaceError}
              onSwitchWorkspace={handleWorkspaceSwitchOnError}
              onGoHome={handleGoHomeOnWorkspaceError}
            />
          )}
        </Suspense>
        
        {/* Router devtools - only in development */}
        <Suspense fallback={null}>
          <TanStackRouterDevtools position="bottom-right" />
        </Suspense>
      </MobileLayoutProvider>
    </ErrorBoundary>
  );
}
