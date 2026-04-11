/**
 * @file MobileLayoutContext.tsx
 * @description Context for mobile layout state and actions
 * @app MOBILE - Provides mobile-specific layout controls to child components
 * 
 * This context allows views and components to:
 * - Check if we're on mobile
 * - Open the mobile drawer (sidebar)
 * - Access other mobile-specific state
 */

import React, { createContext, useContext } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface MobileLayoutContextValue {
  /** Whether the current viewport is mobile (<768px) */
  isMobile: boolean;
  /** Function to open the mobile drawer (sidebar) */
  onOpenDrawer: () => void;
  /** Function to close the mobile drawer (sidebar) */
  onCloseDrawer: () => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const MobileLayoutContext = createContext<MobileLayoutContextValue | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

interface MobileLayoutProviderProps {
  children: React.ReactNode;
  value: MobileLayoutContextValue;
}

export const MobileLayoutProvider: React.FC<MobileLayoutProviderProps> = ({
  children,
  value,
}) => {
  return (
    <MobileLayoutContext.Provider value={value}>
      {children}
    </MobileLayoutContext.Provider>
  );
};

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to access mobile layout context
 * Returns null if not within a MobileLayoutProvider (i.e., on desktop)
 */
export function useMobileLayout(): MobileLayoutContextValue | null {
  return useContext(MobileLayoutContext);
}

/**
 * Hook that safely provides mobile layout controls
 * Falls back to no-op functions if not in mobile context
 */
export function useMobileLayoutSafe(): MobileLayoutContextValue {
  const context = useContext(MobileLayoutContext);
  return context ?? {
    isMobile: false,
    onOpenDrawer: () => {},
    onCloseDrawer: () => {},
  };
}
