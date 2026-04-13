/**
 * @file useSessionValidator.test.ts
 * @description Regression tests for useSessionValidator
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { mockUsersCollection, mockAuthStoreState } = vi.hoisted(() => ({
  mockUsersCollection: {
    getOne: vi.fn(),
    authRefresh: vi.fn(),
  },
  mockAuthStoreState: {
    token: '',
    record: null as { id: string } | null,
  },
}));

vi.mock('@/lib/pocketbase', () => ({
  pb: {
    authStore: mockAuthStoreState,
    collection: vi.fn(() => mockUsersCollection),
  },
  isAuthenticated: vi.fn(() => Boolean(mockAuthStoreState.token && mockAuthStoreState.record)),
  getCurrentUserId: vi.fn(() => mockAuthStoreState.record?.id ?? null),
  onAuthChange: vi.fn(),
}));

vi.mock('@/lib/errors', () => ({
  isSessionExpired: vi.fn((error: { status?: number } | undefined) => error?.status === 401),
  isNetworkError: vi.fn(() => false),
  logError: vi.fn(),
}));

import { useAuthStore, type User } from '@/stores/authStore';
import { useSessionValidator } from './useSessionValidator';

function createToken(expiresAtMs: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ exp: Math.floor(expiresAtMs / 1000) }));
  return `${header}.${payload}.signature`;
}

function createUser(id: string): User {
  return {
    id,
    email: `${id}@example.com`,
    username: id,
    name: id,
    verified: true,
  };
}

describe('useSessionValidator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-13T09:00:00.000Z'));
    vi.clearAllMocks();

    mockAuthStoreState.token = '';
    mockAuthStoreState.record = null;
    useAuthStore.setState({
      user: null,
      isLoading: false,
      lastValidatedAt: 0,
      error: null,
      pendingEmail: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('restarts validation timing when a new session logs in', async () => {
    mockAuthStoreState.token = createToken(Date.now() + 60 * 60 * 1000);
    mockAuthStoreState.record = { id: 'stale-user' };
    act(() => {
      useAuthStore.setState({
        user: createUser('stale-user'),
        lastValidatedAt: 0,
        isLoading: false,
        error: null,
        pendingEmail: null,
      });
    });

    mockUsersCollection.getOne.mockRejectedValue({ status: 401 });
    mockUsersCollection.authRefresh.mockRejectedValue({ status: 401 });

    const onSessionExpired = vi.fn();
    const { rerender } = renderHook(() => useSessionValidator({ onSessionExpired }));

    mockAuthStoreState.token = createToken(Date.now() + 60 * 60 * 1000);
    mockAuthStoreState.record = { id: 'fresh-user' };
    act(() => {
      useAuthStore.setState({
        user: createUser('fresh-user'),
        lastValidatedAt: Date.now(),
        isLoading: false,
        error: null,
        pendingEmail: null,
      });
    });

    act(() => {
      rerender();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(mockUsersCollection.getOne).not.toHaveBeenCalled();
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('records successful refreshes as recent validations', async () => {
    mockAuthStoreState.token = createToken(Date.now() + 60 * 60 * 1000);
    mockAuthStoreState.record = { id: 'user-1' };
    act(() => {
      useAuthStore.setState({
        user: createUser('user-1'),
        lastValidatedAt: 0,
        isLoading: false,
        error: null,
        pendingEmail: null,
      });
    });

    mockUsersCollection.authRefresh.mockResolvedValue({});

    renderHook(() => useSessionValidator({ validationInterval: 60000 }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(useAuthStore.getState().lastValidatedAt).toBe(Date.now());
  });
});