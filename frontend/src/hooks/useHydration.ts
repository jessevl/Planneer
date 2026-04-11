/**
 * @file useHydration.ts
 * @description Hook to handle Zustand store hydration for SSR compatibility
 * @app SHARED - Used to enable SSR with persisted Zustand stores
 * 
 * When using Zustand with persist middleware and SSR:
 * 1. Server renders with initial state (no localStorage)
 * 2. Client hydrates from localStorage
 * 3. This mismatch causes hydration errors
 * 
 * Solution: Track hydration state and only render client-specific
 * content after stores have rehydrated from localStorage.
 * 
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const isHydrated = useHydration();
 *   if (!isHydrated) return <LoadingSkeleton />;
 *   return <ActualContent />;
 * }
 * ```
 */
import { useEffect, useState } from 'react';

/**
 * Hook that returns true once Zustand stores have hydrated from localStorage.
 * Use this to conditionally render content that depends on persisted state.
 */
export function useHydration(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Stores hydrate synchronously on first client render
    // This effect runs after hydration is complete
    setHydrated(true);
  }, []);

  return hydrated;
}

/**
 * Alternative: Check if we're in a browser environment
 * Useful for conditional logic that doesn't need full hydration
 */
export function useIsBrowser(): boolean {
  const [isBrowser, setIsBrowser] = useState(false);

  useEffect(() => {
    setIsBrowser(true);
  }, []);

  return isBrowser;
}

export default useHydration;
