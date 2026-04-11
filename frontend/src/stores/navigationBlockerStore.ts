/**
 * @file navigationBlockerStore.ts
 * @description Global navigation blocker for unsaved changes protection
 * @app SHARED - Works with TanStack Router to block navigation when there are unsaved changes
 * 
 * Components register their dirty state with this store, and the router
 * uses it to block navigation and show a confirmation modal.
 * 
 * Usage:
 * 1. In your component with unsaved changes:
 *    const setNavigationDirty = useNavigationBlockerStore(s => s.setDirty);
 *    useEffect(() => { setNavigationDirty('task-pane', isDirty); }, [isDirty]);
 *    useEffect(() => () => setNavigationDirty('task-pane', false), []); // cleanup on unmount
 * 
 * 2. In the root route, the NavigationBlockerModal component handles the confirmation
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface NavigationBlockerState {
  // Map of component keys to their dirty state
  dirtyComponents: Record<string, boolean>;
  
  // Whether any component has unsaved changes
  isDirty: boolean;
  
  // Pending navigation that was blocked
  pendingNavigation: (() => void) | null;
  
  // Whether the confirmation modal is shown
  showConfirmModal: boolean;
  
  // Actions
  setDirty: (key: string, dirty: boolean) => void;
  clearDirty: (key: string) => void;
  clearAllDirty: () => void;
  
  // Navigation blocking
  blockNavigation: (proceed: () => void) => boolean;
  confirmNavigation: () => void;
  cancelNavigation: () => void;
}

export const useNavigationBlockerStore = create<NavigationBlockerState>()(
  devtools(
    (set, get) => ({
      dirtyComponents: {},
      isDirty: false,
      pendingNavigation: null,
      showConfirmModal: false,
      
      setDirty: (key: string, dirty: boolean) => {
        set(state => {
          const newDirtyComponents = { ...state.dirtyComponents, [key]: dirty };
          const isDirty = Object.values(newDirtyComponents).some(Boolean);
          return { dirtyComponents: newDirtyComponents, isDirty };
        }, false, 'setDirty');
      },
      
      clearDirty: (key: string) => {
        set(state => {
          const { [key]: _, ...rest } = state.dirtyComponents;
          const isDirty = Object.values(rest).some(Boolean);
          return { dirtyComponents: rest, isDirty };
        }, false, 'clearDirty');
      },
      
      clearAllDirty: () => {
        set({ dirtyComponents: {}, isDirty: false }, false, 'clearAllDirty');
      },
      
      // Called by navigation attempts - returns true if navigation was blocked
      blockNavigation: (proceed: () => void) => {
        const { isDirty } = get();
        if (!isDirty) {
          return false; // Allow navigation
        }
        // Block and show modal
        set({ pendingNavigation: proceed, showConfirmModal: true }, false, 'blockNavigation');
        return true;
      },
      
      // User confirmed discard - proceed with navigation
      confirmNavigation: () => {
        const { pendingNavigation } = get();
        set({ 
          dirtyComponents: {}, 
          isDirty: false, 
          showConfirmModal: false, 
          pendingNavigation: null 
        }, false, 'confirmNavigation');
        // Execute the pending navigation after clearing state
        if (pendingNavigation) {
          pendingNavigation();
        }
      },
      
      // User cancelled - stay on current page
      cancelNavigation: () => {
        set({ showConfirmModal: false, pendingNavigation: null }, false, 'cancelNavigation');
      },
    }),
    { name: 'navigation-blocker-store' }
  )
);
