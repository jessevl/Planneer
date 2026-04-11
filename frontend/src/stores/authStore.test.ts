/**
 * @file authStore.test.ts
 * @description Tests for the auth Zustand store
 * @app SHARED - Authentication state management
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAuthStore } from './authStore';
import type { User } from './authStore';

const { mockAuthStore, mockCollection } = vi.hoisted(() => ({
  mockAuthStore: {
    clear: vi.fn(),
    isValid: true,
    record: null as User | null,
  },
  mockCollection: {
    authWithPassword: vi.fn(),
    authWithOTP: vi.fn(),
    requestOTP: vi.fn(),
    create: vi.fn(),
    getOne: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    requestPasswordReset: vi.fn(),
    confirmPasswordReset: vi.fn(),
    requestVerification: vi.fn(),
    confirmVerification: vi.fn(),
    requestEmailChange: vi.fn(),
    confirmEmailChange: vi.fn(),
  },
}));

vi.mock('@/lib/pocketbase', () => {
  return {
    pb: {
      collection: vi.fn(() => mockCollection),
      authStore: mockAuthStore,
    },
    isAuthenticated: vi.fn(() => false),
    getCurrentUserId: vi.fn(() => null),
    onAuthChange: vi.fn(),
  };
});

vi.mock('@/lib/errors', () => ({
  isSessionExpired: vi.fn(() => false),
}));

// Import the mocks after vi.mock
import { pb } from '@/lib/pocketbase';

// Helper to create mock user
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    name: 'Test User',
    verified: true,
    ...overrides,
  };
}

describe('authStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useAuthStore.setState({
      user: null,
      isLoading: false,
      lastValidatedAt: 0,
      error: null,
      pendingEmail: null,
    });
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('starts with no user and not loading', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('login', () => {
    it('logs in user successfully', async () => {
      const mockUser = createMockUser();
      (mockCollection as any).authWithPassword.mockResolvedValue({ record: mockUser });
      
      await useAuthStore.getState().login('test@example.com', 'password123');
      
      expect(pb.collection).toHaveBeenCalledWith('users');
      expect((mockCollection as any).authWithPassword).toHaveBeenCalledWith('test@example.com', 'password123');
      
      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('handles login error', async () => {
      const error = new Error('Invalid credentials');
      (mockCollection as any).authWithPassword.mockRejectedValue(error);
      
      await expect(useAuthStore.getState().login('test@example.com', 'wrong')).rejects.toThrow();
      
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Invalid credentials');
    });

    it('sets loading state during login', async () => {
      let resolveLogin: (value: any) => void;
      const loginPromise = new Promise((resolve) => { resolveLogin = resolve; });
      (mockCollection as any).authWithPassword.mockReturnValue(loginPromise);
      
      const loginAction = useAuthStore.getState().login('test@example.com', 'password');
      
      expect(useAuthStore.getState().isLoading).toBe(true);
      
      resolveLogin!({ record: createMockUser() });
      await loginAction;
      
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('logout', () => {
    it('clears user and auth store', async () => {
      useAuthStore.setState({ user: createMockUser() });
      
      await useAuthStore.getState().logout();
      
      expect((mockAuthStore as any).clear).toHaveBeenCalled();
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('register', () => {
    it('registers and logs in user', async () => {
      const mockUser = createMockUser();
      (mockCollection as any).create.mockResolvedValue(mockUser);
      (mockCollection as any).authWithPassword.mockResolvedValue({ record: mockUser });
      (mockCollection as any).requestVerification.mockResolvedValue({});
      
      await useAuthStore.getState().register('test@example.com', 'password123', 'password123', 'Test User');
      
      expect((mockCollection as any).create).toHaveBeenCalled();
      expect((mockCollection as any).authWithPassword).toHaveBeenCalledWith('test@example.com', 'password123');
      
      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isLoading).toBe(false);
    });

    it('handles registration error', async () => {
      const error = { message: 'Email already exists' };
      (mockCollection as any).create.mockRejectedValue(error);
      
      await expect(
        useAuthStore.getState().register('existing@example.com', 'password', 'password', 'Test')
      ).rejects.toEqual(error);
      
      expect(useAuthStore.getState().error).toBe('Email already exists');
    });
  });

  describe('sendPasswordReset', () => {
    it('sends password reset email', async () => {
      (mockCollection as any).requestPasswordReset.mockResolvedValue({});
      
      await useAuthStore.getState().sendPasswordReset('test@example.com');
      
      expect((mockCollection as any).requestPasswordReset).toHaveBeenCalledWith('test@example.com');
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('requestMagicLink', () => {
    it('requests OTP and sets pending email', async () => {
      (mockCollection as any).requestOTP.mockResolvedValue({});
      
      await useAuthStore.getState().requestMagicLink('test@example.com');
      
      expect((mockCollection as any).requestOTP).toHaveBeenCalledWith('test@example.com');
      expect(useAuthStore.getState().pendingEmail).toBe('test@example.com');
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('verifyMagicLink', () => {
    it('verifies OTP and authenticates user', async () => {
      const mockUser = createMockUser();
      (mockCollection as any).authWithOTP.mockResolvedValue({ record: mockUser });
      
      useAuthStore.setState({ pendingEmail: 'test@example.com' });
      
      await useAuthStore.getState().verifyMagicLink('test@example.com', '123456');
      
      expect((mockCollection as any).authWithOTP).toHaveBeenCalledWith('test@example.com', '123456');
      
      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.pendingEmail).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('updates user profile', async () => {
      const mockUser = createMockUser();
      const updatedUser = { ...mockUser, name: 'Updated Name' };
      
      useAuthStore.setState({ user: mockUser });
      (mockCollection as any).update.mockResolvedValue(updatedUser);
      
      await useAuthStore.getState().updateProfile({ name: 'Updated Name' });
      
      expect((mockCollection as any).update).toHaveBeenCalledWith('user-1', { name: 'Updated Name' });
      expect(useAuthStore.getState().user?.name).toBe('Updated Name');
    });

    it('throws error if no user is logged in', async () => {
      useAuthStore.setState({ user: null });
      
      await expect(
        useAuthStore.getState().updateProfile({ name: 'Test' })
      ).rejects.toThrow('No user logged in');
      
      expect((mockCollection as any).update).not.toHaveBeenCalled();
    });
  });

  describe('clearError', () => {
    it('clears error state', () => {
      useAuthStore.setState({ error: 'Some error' });
      
      useAuthStore.getState().clearError();
      
      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('error handling', () => {
    it('extracts field-specific errors from PocketBase', async () => {
      const pbError = {
        data: {
          email: { message: 'Email is required' },
          password: { message: 'Password is too short' },
        },
      };
      (mockCollection as any).authWithPassword.mockRejectedValue(pbError);
      
      await expect(useAuthStore.getState().login('', '')).rejects.toEqual(pbError);
      
      const error = useAuthStore.getState().error;
      expect(error).toContain('Email is required');
      expect(error).toContain('Password is too short');
    });
  });
});
