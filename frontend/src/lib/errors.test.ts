/**
 * @file errors.test.ts
 * @description Tests for error handling utilities
 * @app SHARED - Error handling infrastructure
 */
import { describe, it, expect } from 'vitest';
import {
  AppError,
  NetworkError,
  AuthError,
  SessionExpiredError,
  WorkspaceAccessError,
  PageContentError,
  classifyError,
  getErrorMessage,
  getErrorDetails,
  toErrorInfo,
  isSessionExpired,
  isNetworkError,
  isRetryable,
  logError,
} from './errors';

describe('errors', () => {
  describe('AppError', () => {
    it('creates error with message and category', () => {
      const error = new AppError('Test error', 'validation');
      
      expect(error.message).toBe('Test error');
      expect(error.category).toBe('validation');
      expect(error.name).toBe('AppError');
      expect(error.retryable).toBe(false);
    });

    it('supports additional options', () => {
      const error = new AppError('Test error', 'network', {
        details: 'Additional details',
        code: 500,
        retryable: true,
      });
      
      expect(error.details).toBe('Additional details');
      expect(error.code).toBe(500);
      expect(error.retryable).toBe(true);
    });

    it('converts to ErrorInfo', () => {
      const error = new AppError('Test error', 'server', {
        details: 'Details',
        code: 500,
        retryable: true,
      });
      
      const info = error.toErrorInfo();
      
      expect(info.category).toBe('server');
      expect(info.message).toBe('Test error');
      expect(info.details).toBe('Details');
      expect(info.code).toBe(500);
      expect(info.retryable).toBe(true);
    });
  });

  describe('NetworkError', () => {
    it('creates network error with defaults', () => {
      const error = new NetworkError();
      
      expect(error.name).toBe('NetworkError');
      expect(error.category).toBe('network');
      expect(error.retryable).toBe(true);
      expect(error.message).toBe('Network connection failed');
    });

    it('accepts custom message and details', () => {
      const error = new NetworkError('Connection timeout', 'Server took too long');
      
      expect(error.message).toBe('Connection timeout');
      expect(error.details).toBe('Server took too long');
    });
  });

  describe('AuthError', () => {
    it('creates auth error', () => {
      const error = new AuthError('Invalid credentials', 401);
      
      expect(error.name).toBe('AuthError');
      expect(error.category).toBe('auth');
      expect(error.retryable).toBe(false);
      expect(error.code).toBe(401);
    });
  });

  describe('SessionExpiredError', () => {
    it('creates session expired error', () => {
      const error = new SessionExpiredError();
      
      expect(error.name).toBe('SessionExpiredError');
      expect(error.category).toBe('auth');
      expect(error.code).toBe(401);
      expect(error.message).toContain('session has expired');
    });
  });

  describe('WorkspaceAccessError', () => {
    it('creates workspace access error', () => {
      const error = new WorkspaceAccessError('Access denied', 'workspace-123');
      
      expect(error.name).toBe('WorkspaceAccessError');
      expect(error.category).toBe('permission');
      expect(error.workspaceId).toBe('workspace-123');
    });
  });

  describe('PageContentError', () => {
    it('creates page content error', () => {
      const error = new PageContentError('Invalid content format');
      
      expect(error.name).toBe('PageContentError');
      expect(error.category).toBe('validation');
      expect(error.details).toContain('incompatible version');
    });
  });

  describe('classifyError', () => {
    it('classifies AppError by category', () => {
      const error = new AppError('Test', 'validation');
      expect(classifyError(error)).toBe('validation');
    });

    it('classifies TypeError with fetch as network', () => {
      const error = new TypeError('Failed to fetch');
      expect(classifyError(error)).toBe('network');
    });

    it('classifies network-related messages', () => {
      expect(classifyError(new Error('Network error'))).toBe('network');
      expect(classifyError(new Error('offline'))).toBe('network');
      expect(classifyError(new Error('timeout occurred'))).toBe('network');
    });

    it('classifies auth-related messages', () => {
      expect(classifyError(new Error('unauthorized access'))).toBe('auth');
      expect(classifyError(new Error('authentication failed'))).toBe('auth');
      expect(classifyError(new Error('invalid token'))).toBe('auth');
    });

    it('classifies permission-related messages', () => {
      expect(classifyError(new Error('forbidden'))).toBe('permission');
      expect(classifyError(new Error('permission denied'))).toBe('permission');
    });

    it('classifies not found messages', () => {
      expect(classifyError(new Error('not found'))).toBe('not_found');
      expect(classifyError(new Error('404 error'))).toBe('not_found');
    });

    it('classifies by HTTP status code', () => {
      expect(classifyError({ status: 400 })).toBe('validation');
      expect(classifyError({ status: 401 })).toBe('auth');
      expect(classifyError({ status: 403 })).toBe('permission');
      expect(classifyError({ status: 404 })).toBe('not_found');
      expect(classifyError({ status: 500 })).toBe('server');
    });

    it('returns unknown for unclassified errors', () => {
      expect(classifyError(new Error('random error'))).toBe('unknown');
      expect(classifyError('string error')).toBe('unknown');
      expect(classifyError(null)).toBe('unknown');
    });
  });

  describe('getErrorMessage', () => {
    it('returns string errors as-is', () => {
      expect(getErrorMessage('Test error')).toBe('Test error');
    });

    it('extracts message from AppError', () => {
      const error = new AppError('App error message', 'validation');
      expect(getErrorMessage(error)).toBe('App error message');
    });

    it('extracts message from Error', () => {
      const error = new Error('Standard error');
      expect(getErrorMessage(error)).toBe('Standard error');
    });

    it('extracts message from PocketBase-like errors', () => {
      const error = { message: 'PocketBase error' };
      expect(getErrorMessage(error)).toBe('PocketBase error');
    });

    it('extracts field errors from PocketBase validation', () => {
      const error = {
        data: {
          email: { message: 'Email is required' },
          password: { message: 'Password too short' },
        },
      };
      const message = getErrorMessage(error);
      expect(message).toContain('Email is required');
      expect(message).toContain('Password too short');
    });

    it('uses fallback for unknown errors', () => {
      expect(getErrorMessage(null, 'Fallback')).toBe('Fallback');
    });
  });

  describe('toErrorInfo', () => {
    it('converts AppError to ErrorInfo', () => {
      const error = new NetworkError('Connection failed', 'Details');
      const info = toErrorInfo(error);
      
      expect(info.category).toBe('network');
      expect(info.message).toBe('Connection failed');
      expect(info.details).toBe('Details');
      expect(info.retryable).toBe(true);
    });

    it('converts regular Error to ErrorInfo', () => {
      const error = new Error('Something went wrong');
      const info = toErrorInfo(error);
      
      expect(info.category).toBe('unknown');
      expect(info.message).toBe('Something went wrong');
      expect(info.retryable).toBe(false);
    });

    it('marks network and server errors as retryable', () => {
      expect(toErrorInfo(new Error('network error')).retryable).toBe(true);
      expect(toErrorInfo({ status: 500 }).retryable).toBe(true);
    });
  });

  describe('isSessionExpired', () => {
    it('returns true for SessionExpiredError', () => {
      expect(isSessionExpired(new SessionExpiredError())).toBe(true);
    });

    it('returns true for 401 status', () => {
      expect(isSessionExpired({ status: 401 })).toBe(true);
    });

    it('returns false for other errors', () => {
      expect(isSessionExpired(new Error('random'))).toBe(false);
      expect(isSessionExpired({ status: 500 })).toBe(false);
    });
  });

  describe('isNetworkError', () => {
    it('returns true for NetworkError', () => {
      expect(isNetworkError(new NetworkError())).toBe(true);
    });

    it('returns true for network-related errors', () => {
      expect(isNetworkError(new Error('Failed to fetch'))).toBe(true);
      expect(isNetworkError(new Error('offline'))).toBe(true);
    });

    it('returns false for non-network errors', () => {
      expect(isNetworkError(new Error('validation error'))).toBe(false);
    });
  });

  describe('isAuthError', () => {
    it('classifies auth errors correctly', () => {
      const authError = new AuthError('Invalid credentials');
      expect(classifyError(authError)).toBe('auth');
    });

    it('classifies 401 status as auth', () => {
      expect(classifyError({ status: 401 })).toBe('auth');
    });

    it('does not classify random errors as auth', () => {
      expect(classifyError(new Error('random'))).not.toBe('auth');
    });
  });

  describe('isRetryable', () => {
    it('returns true for network errors', () => {
      expect(isRetryable(new NetworkError())).toBe(true);
    });

    it('returns true for server errors', () => {
      expect(isRetryable({ status: 500 })).toBe(true);
    });

    it('returns false for auth errors', () => {
      expect(isRetryable(new AuthError())).toBe(false);
    });

    it('returns false for validation errors', () => {
      expect(isRetryable({ status: 400 })).toBe(false);
    });
  });

  describe('getErrorDetails', () => {
    it('returns details from AppError', () => {
      const error = new AppError('Message', 'validation', { details: 'Extra info' });
      expect(getErrorDetails(error)).toBe('Extra info');
    });

    it('returns stack trace for plain errors', () => {
      const details = getErrorDetails(new Error('Plain error'));
      expect(details).toContain('Error: Plain error');
    });
  });
});
