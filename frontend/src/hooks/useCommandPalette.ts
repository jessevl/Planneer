/**
 * @file useCommandPalette.ts
 * @description Global state and hook for the command palette
 * @app SHARED - Command palette state management
 * 
 * Provides:
 * - Global open/close state
 * - Keyboard shortcut listener (Cmd+K / Ctrl+K)
 * - Functions to open/close the palette
 */
import { create } from 'zustand';
import { useEffect } from 'react';

// ============================================================================
// STORE
// ============================================================================

interface CommandPaletteState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}));

// ============================================================================
// HOOK WITH KEYBOARD LISTENER
// ============================================================================

/**
 * Hook that sets up the global Cmd+K / Ctrl+K keyboard shortcut
 * Call this once in your root component
 */
export function useCommandPaletteShortcut() {
  const { toggle, close, isOpen } = useCommandPaletteStore();
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
        return;
      }
      
      // Escape to close (handled in component too, but this catches global)
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        close();
        return;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggle, close, isOpen]);
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export const openCommandPalette = () => useCommandPaletteStore.getState().open();
export const closeCommandPalette = () => useCommandPaletteStore.getState().close();
export const toggleCommandPalette = () => useCommandPaletteStore.getState().toggle();
