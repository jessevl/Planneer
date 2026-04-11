import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { pb } from '@/lib/pocketbase';
import { isNetworkError } from '@/lib/errors';

interface AppConfig {
  isClosedBeta: boolean;
  hasUnsplashConfig: boolean;
}

interface ConfigState {
  config: AppConfig;
  isLoading: boolean;
  isFetching: boolean; // Track active fetch to prevent redundancy
  error: string | null;
  fetchConfig: () => Promise<void>;
}

export const useConfigStore = create<ConfigState>()(
  devtools(
    persist(
      (set, get) => ({
        config: {
          isClosedBeta: true, // Default to true until fetched
          hasUnsplashConfig: false,
        },
        isLoading: true,
        isFetching: false,
        error: null,
        fetchConfig: async () => {
          // Prevent multiple simultaneous fetches
          if (get().isFetching) return;

          try {
            set({ isFetching: true, error: null });
            
            // Use PocketBase base URL to ensure it goes to the correct backend
            const response = await fetch(`${pb.baseURL}/api/config`);
            
            if (!response.ok) {
              throw new Error(`Failed to fetch app configuration: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Handle potential field mismatch between backend versions
            const config: AppConfig = {
              isClosedBeta: data.isClosedBeta ?? true,
              hasUnsplashConfig: data.hasUnsplashConfig ?? (!!data.unsplashAccessKey),
            };
            
            set({ config, isLoading: false, isFetching: false });
          } catch (error) {
            // OFFLINE SUPPORT: If it's a network error, don't set the error state
            // if we already have a config (from persistence)
            if (isNetworkError(error)) {
              console.warn('[Config] Network error fetching config, using cached version');
              set({ isLoading: false, isFetching: false });
              return;
            }

            console.error('Error fetching config:', error);
            set({ 
              error: error instanceof Error ? error.message : 'Unknown error', 
              isLoading: false,
              isFetching: false
            });
          }
        },
      }),
      { 
        name: 'planneer-config',
        // Only persist the config object
        partialize: (state) => ({ config: state.config }),
      }
    ),
    { name: 'ConfigStore' }
  )
);
