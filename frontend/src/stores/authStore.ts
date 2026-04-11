/**
 * @file authStore.ts
 * @description Authentication state management
 * @app SHARED - User authentication
 * 
 * Manages user authentication state including:
 * - Login/logout
 * - Registration
 * - Password reset
 * - Current user profile
 * - Auth state persistence (via PocketBase authStore)
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { pb, isAuthenticated, getCurrentUserId, onAuthChange } from '@/lib/pocketbase';
import { isSessionExpired } from '@/lib/errors';

/**
 * Extract error message from PocketBase error response
 * PocketBase errors can have nested field errors in data object
 */
function getErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  
  // Handle PocketBase ClientResponseError
  if (typeof error === 'object' && error !== null) {
    const err = error as any;
    
    // PocketBase validation errors have a data object with field-specific errors
    if (err.data && typeof err.data === 'object') {
      const fieldErrors = Object.entries(err.data)
        .filter(([, value]: any) => value?.message)
        .map(([key, value]: any) => `${key}: ${value.message}`);
      
      if (fieldErrors.length > 0) return fieldErrors.join(' ');
    }
    
    if (err.message) return err.message;
  }
  
  if (typeof error === 'string') return error;
  
  return fallback;
}

export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  avatar?: string;
  verified: boolean;
  // Custom fields
  timezone?: string;
  theme?: 'light' | 'dark' | 'system';
  sidebarLayout?: 'default' | 'compact';
  pomodoroSettings?: {
    workDuration: number;
    breakDuration: number;
    longBreakDuration: number;
    sessionsBeforeLongBreak: number;
  };
  preferences?: Record<string, unknown>;
}

interface AuthState {
  // State
  user: User | null;
  isLoading: boolean;
  lastValidatedAt: number; // Timestamp of last successful server-side auth check
  error: string | null;
  pendingEmail: string | null; // For Magic Link flow

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, passwordConfirm: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  confirmPasswordReset: (token: string, password: string, passwordConfirm: string) => Promise<void>;
  requestVerification: (email: string) => Promise<void>;
  confirmVerification: (token: string) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string, newPasswordConfirm: string) => Promise<void>;
  changeEmail: (newEmail: string, password: string) => Promise<void>;
  confirmEmailChange: (token: string, password: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  
  // Magic Link authentication
  requestMagicLink: (email: string) => Promise<void>;
  verifyMagicLink: (email: string, otp: string) => Promise<void>;
  
  // Initialization
  initializeAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set, get) => ({
      user: null,
      isLoading: true,
      lastValidatedAt: 0,
      error: null,
      pendingEmail: null,

      /**
       * Initialize auth state from PocketBase authStore
       * Call this on app startup
       * 
       * OFFLINE SUPPORT: If we're offline but have a valid local auth token,
       * use the cached auth data instead of fetching from server.
       */
      initializeAuth: async () => {
        set({ isLoading: true }, false, 'initializeAuth/start');
        
        try {
          if (isAuthenticated()) {
            // Load current user data
            const userId = getCurrentUserId();
            if (userId) {
              try {
                const userData = await pb.collection('users').getOne(userId);
                set({ 
                  user: userData as unknown as User, 
                  isLoading: false,
                  lastValidatedAt: Date.now()
                }, false, 'initializeAuth/success');
              } catch (fetchError) {
                // If it's a session expiry, we must clear auth
                if (isSessionExpired(fetchError)) {
                  console.warn('[Auth] Session expired during initialization, clearing auth');
                  pb.authStore.clear();
                  set({ user: null, isLoading: false, lastValidatedAt: 0 }, false, 'initializeAuth/expired');
                  return;
                }

                // If it's a 400/404 on the user record, it's also likely a session issue
                const status = (fetchError as any)?.status;
                if (status === 400 || status === 404) {
                  console.warn('[Auth] User record not found or access denied, clearing auth');
                  pb.authStore.clear();
                  set({ user: null, isLoading: false, lastValidatedAt: 0 }, false, 'initializeAuth/invalid');
                  return;
                }

                // OFFLINE SUPPORT: For other errors (network, etc.), if we have valid auth,
                // use the locally cached auth record
                console.warn('[Auth] Failed to fetch user data, using cached auth:', fetchError);
                const cachedRecord = pb.authStore.record;
                if (cachedRecord) {
                  set({ 
                    user: cachedRecord as unknown as User, 
                    isLoading: false 
                  }, false, 'initializeAuth/cached');
                } else {
                  // No cached record, clear auth
                  set({ user: null, isLoading: false }, false, 'initializeAuth/noCache');
                }
              }
            } else {
              set({ user: null, isLoading: false }, false, 'initializeAuth/noUser');
            }
          } else {
            set({ user: null, isLoading: false, lastValidatedAt: 0 }, false, 'initializeAuth/unauthenticated');
          }
        } catch (error) {
          console.error('Auth initialization error:', error);
          // Even on error, try to use cached auth
          const cachedRecord = pb.authStore.record;
          if (cachedRecord && pb.authStore.isValid) {
            set({ 
              user: cachedRecord as unknown as User, 
              isLoading: false 
            }, false, 'initializeAuth/errorWithCache');
          } else {
            set({ 
              user: null, 
              isLoading: false,
              error: 'Failed to initialize authentication'
            }, false, 'initializeAuth/error');
          }
        }
      },

      /**
       * Log in with email and password
       */
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null }, false, 'login/start');
        const normalizedEmail = email.trim().toLowerCase();
        
        try {
          const authData = await pb.collection('users').authWithPassword(normalizedEmail, password);
          
          set({ 
            user: authData.record as unknown as User, 
            isLoading: false 
          }, false, 'login/success');
        } catch (error: unknown) {
          const errorMessage = getErrorMessage(error, 'Login failed');
          set({ 
            error: errorMessage, 
            isLoading: false 
          }, false, 'login/error');
          throw error;
        }
      },

      /**
       * Request Magic Link (OTP) for passwordless login
       */
      requestMagicLink: async (email: string) => {
        set({ isLoading: true, error: null }, false, 'requestMagicLink/start');
        
        try {
          await pb.collection('users').requestOTP(email);
          set({ 
            pendingEmail: email,
            isLoading: false 
          }, false, 'requestMagicLink/success');
        } catch (error: unknown) {
          const errorMessage = getErrorMessage(error, 'Failed to send code');
          set({ 
            error: errorMessage, 
            isLoading: false 
          }, false, 'requestMagicLink/error');
          throw error;
        }
      },

      /**
       * Verify Magic Link OTP and complete authentication
       */
      verifyMagicLink: async (email: string, otp: string) => {
        set({ isLoading: true, error: null }, false, 'verifyMagicLink/start');
        
        try {
          const authData = await pb.collection('users').authWithOTP(email, otp);
          set({ 
            user: authData.record as unknown as User, 
            pendingEmail: null,
            isLoading: false 
          }, false, 'verifyMagicLink/success');
        } catch (error: unknown) {
          const errorMessage = getErrorMessage(error, 'Invalid or expired code');
          set({ 
            error: errorMessage, 
            isLoading: false 
          }, false, 'verifyMagicLink/error');
          throw error;
        }
      },

      /**
       * Register a new user account
       */
      register: async (email: string, password: string, passwordConfirm: string, name: string) => {
        set({ isLoading: true, error: null }, false, 'register/start');
        
        try {
          // Create user account
          const user = await pb.collection('users').create({
            email,
            password,
            passwordConfirm,
            name,
            username: email.split('@')[0], // Use email prefix as username
            // Set default preferences
            theme: 'system',
            sidebarLayout: 'default',
            pomodoroSettings: {
              workDuration: 25,
              breakDuration: 5,
              longBreakDuration: 15,
              sessionsBeforeLongBreak: 4,
            },
          });

          // Send verification email (optional - configure in PocketBase)
          try {
            await pb.collection('users').requestVerification(email);
          } catch (e) {
            // Verification email failed, but account is created - not critical
            console.warn('Verification email failed:', e);
          }

          // Auto-login after registration
          await get().login(email, password);
          
          set({ isLoading: false }, false, 'register/success');
        } catch (error: unknown) {
          const errorMessage = getErrorMessage(error, 'Registration failed');
          set({ 
            error: errorMessage, 
            isLoading: false 
          }, false, 'register/error');
          throw error;
        }
      },

      /**
       * Log out current user
       */
      logout: async () => {
        pb.authStore.clear();
        set({ user: null, error: null }, false, 'logout');
      },

      /**
       * Send password reset email
       */
      sendPasswordReset: async (email: string) => {
        set({ isLoading: true, error: null }, false, 'sendPasswordReset/start');
        
        try {
          await pb.collection('users').requestPasswordReset(email);
          set({ isLoading: false }, false, 'sendPasswordReset/success');
        } catch (error: unknown) {
          const errorMessage = getErrorMessage(error, 'Password reset request failed');
          set({ 
            error: errorMessage, 
            isLoading: false 
          }, false, 'sendPasswordReset/error');
          throw error;
        }
      },

      /**
       * Confirm password reset with token
       */
      confirmPasswordReset: async (token: string, password: string, passwordConfirm: string) => {
        set({ isLoading: true, error: null }, false, 'confirmPasswordReset/start');
        
        try {
          await pb.collection('users').confirmPasswordReset(token, password, passwordConfirm);
          set({ isLoading: false }, false, 'confirmPasswordReset/success');
        } catch (error: unknown) {
          const errorMessage = getErrorMessage(error, 'Password reset failed');
          set({ 
            error: errorMessage, 
            isLoading: false 
          }, false, 'confirmPasswordReset/error');
          throw error;
        }
      },

      /**
       * Request email verification
       */
      requestVerification: async (email: string) => {
        set({ error: null }, false, 'requestVerification/start');
        
        try {
          await pb.collection('users').requestVerification(email);
        } catch (error: unknown) {
          const errorMessage = getErrorMessage(error, 'Verification request failed');
          set({ 
            error: errorMessage
          }, false, 'requestVerification/error');
          throw error;
        }
      },

      /**
       * Confirm email verification with token
       */
      confirmVerification: async (token: string) => {
        set({ error: null }, false, 'confirmVerification/start');
        
        try {
          await pb.collection('users').confirmVerification(token);
          
          // If user is logged in, update their verified status locally
          const { user } = get();
          if (user) {
            set({ user: { ...user, verified: true } });
          }
        } catch (error: unknown) {
          const errorMessage = getErrorMessage(error, 'Verification failed');
          set({ 
            error: errorMessage
          }, false, 'confirmVerification/error');
          throw error;
        }
      },

      /**
       * Update user profile
       */
      updateProfile: async (updates: Partial<User>) => {
        const { user } = get();
        if (!user) throw new Error('No user logged in');

        set({ error: null }, false, 'updateProfile/start');
        
        try {
          const updatedUser = await pb.collection('users').update(user.id, updates);
          
          set({ 
            user: updatedUser as unknown as User
          }, false, 'updateProfile/success');
        } catch (error: unknown) {
          const errorMessage = getErrorMessage(error, 'Profile update failed');
          set({ 
            error: errorMessage
          }, false, 'updateProfile/error');
          throw error;
        }
      },

      /**
       * Change user password
       */
      changePassword: async (oldPassword: string, newPassword: string, newPasswordConfirm: string) => {
        const { user } = get();
        if (!user) throw new Error('No user logged in');

        set({ error: null }, false, 'changePassword/start');
        
        try {
          await pb.collection('users').update(user.id, {
            oldPassword,
            password: newPassword,
            passwordConfirm: newPasswordConfirm,
          });
        } catch (error: unknown) {
          const errorMessage = getErrorMessage(error, 'Password change failed');
          set({ 
            error: errorMessage
          }, false, 'changePassword/error');
          throw error;
        }
      },

      /**
       * Change user email
       */
      changeEmail: async (newEmail: string, password: string) => {
        const { user } = get();
        if (!user) throw new Error('No user logged in');

        set({ error: null }, false, 'changeEmail/start');
        
        try {
          await pb.collection('users').requestEmailChange(newEmail, password);
        } catch (error: unknown) {
          const errorMessage = getErrorMessage(error, 'Email change request failed');
          set({ 
            error: errorMessage
          }, false, 'changeEmail/error');
          throw error;
        }
      },

      /**
       * Confirm email change with token
       */
      confirmEmailChange: async (token: string, password: string) => {
        set({ isLoading: true, error: null }, false, 'confirmEmailChange/start');
        
        try {
          await pb.collection('users').confirmEmailChange(token, password);
          
          // After email change, the user is usually logged out by PocketBase 
          // or their token becomes invalid. We should clear local state.
          pb.authStore.clear();
          set({ user: null, isLoading: false }, false, 'confirmEmailChange/success');
        } catch (error: unknown) {
          const errorMessage = getErrorMessage(error, 'Email change confirmation failed');
          set({ 
            error: errorMessage, 
            isLoading: false 
          }, false, 'confirmEmailChange/error');
          throw error;
        }
      },

      /**
       * Delete user account
       */
      deleteAccount: async (password: string) => {
        const { user } = get();
        if (!user) throw new Error('No user logged in');

        set({ error: null }, false, 'deleteAccount/start');
        
        try {
          // Verify password first by trying to re-authenticate
          await pb.collection('users').authWithPassword(user.email, password);
          
          // Delete the user record
          await pb.collection('users').delete(user.id);
          
          // Clear local auth state
          pb.authStore.clear();
          set({ user: null }, false, 'deleteAccount/success');
        } catch (error: unknown) {
          const errorMessage = getErrorMessage(error, 'Account deletion failed. Please check your password.');
          set({ 
            error: errorMessage
          }, false, 'deleteAccount/error');
          throw error;
        }
      },

      clearError: () => set({ error: null }, false, 'clearError'),
    }),
    { name: 'AuthStore' }
  )
);

/**
 * Set up auth state change listener
 * Call this in your app's root component
 * @returns Unsubscribe function
 */
export const setupAuthListener = (): (() => void) => {
  return onAuthChange((isValid) => {
    if (!isValid) {
      // User logged out or session expired
      useAuthStore.setState({ user: null });
    }
  });
};
