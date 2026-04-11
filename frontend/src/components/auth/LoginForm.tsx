/**
 * @file LoginForm.tsx
 * @description Authentication form with multiple sign-in methods
 * @app ROOT - Authentication UI
 *
 * Supports:
 * - Magic Link (OTP) authentication
 * - Email/password login
 * - User registration
 */
import React, { useState, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { Button, Input, Card } from '@/components/ui';
import { toastError, toastSuccess } from '@/components/ui';
import { Mail, Lock, ArrowLeft, Loader2, UserPlus, KeyRound, Home } from 'lucide-react';

type AuthMode = 'choice' | 'magic-link' | 'password' | 'verify-otp' | 'register' | 'forgot-password';

interface LoginFormProps {
  /** Optional callback to navigate back to landing page */
  onBack?: () => void;
}

const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const LoginForm: React.FC<LoginFormProps> = ({ onBack }) => {
  const [mode, setMode] = useState<AuthMode>('choice');
  const { config } = useConfigStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const {
    isLoading,
    error,
    pendingEmail,
    requestMagicLink,
    verifyMagicLink,
    login,
    register,
    sendPasswordReset,
    clearError,
  } = useAuthStore(useShallow(state => ({
    isLoading: state.isLoading,
    error: state.error,
    pendingEmail: state.pendingEmail,
    requestMagicLink: state.requestMagicLink,
    verifyMagicLink: state.verifyMagicLink,
    login: state.login,
    register: state.register,
    sendPasswordReset: state.sendPasswordReset,
    clearError: state.clearError,
  })));

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return;

    try {
      await sendPasswordReset(normalizedEmail);
      toastSuccess('Password reset email sent! Please check your inbox.');
      setMode('password');
    } catch (err: any) {
      toastError(err.message || 'Failed to send password reset email');
    }
  };

  const handleRequestMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return;

    try {
      await requestMagicLink(normalizedEmail);
      setMode('verify-otp');
      toastSuccess('Verification code sent to your email');
    } catch (err: any) {
      // Error is handled and displayed by store
      toastError(err.message || 'Failed to send magic link');
      console.error('Magic link request failed:', err);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || !pendingEmail) return;

    try {
      await verifyMagicLink(pendingEmail, otp);
      toastSuccess('Successfully signed in');
      // Success - auth store will update, parent will redirect
    } catch (err: any) {
      // Error is handled and displayed by store
      toastError(err.message || 'Invalid verification code');
      console.error('OTP verification failed:', err);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password.trim()) return;

    try {
      await login(normalizedEmail, password);
      toastSuccess('Successfully signed in');
      // Success - auth store will update, parent will redirect
    } catch (err: any) {
      // Error is handled and displayed by store
      toastError(err.message || 'Login failed. Please check your credentials.');
      console.error('Login failed:', err);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const normalizedEmail = normalizeEmail(email);
    
    if (!normalizedEmail || !password.trim() || !passwordConfirm.trim() || !name.trim()) {
      setLocalError('Please fill in all fields');
      return;
    }

    if (password !== passwordConfirm) {
      setLocalError('Passwords do not match');
      return;
    }
    
    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }

    try {
      await register(normalizedEmail, password, passwordConfirm, name.trim());
      toastSuccess('Account created successfully! Welcome to Planneer.');
      // Success - auto-login happens in store, parent will redirect
    } catch (err: any) {
      // Error is handled and displayed by store
      toastError(err.message || 'Registration failed');
      console.error('Registration failed:', err);
    }
  };

  // Clear store error when user starts typing
  useEffect(() => {
    if (error) {
      clearError();
    }
  }, [email, password, name, otp]);

  const handleModeChange = (newMode: AuthMode) => {
    clearError();
    setLocalError(null);
    setMode(newMode);
    setOtp('');
    setPassword('');
    setPasswordConfirm('');
  };

  // Choice screen
  if (mode === 'choice') {
    return (
      <div className="flex items-center justify-center min-h-full p-4 bg-[var(--color-surface-base)]">
        <Card className="w-full max-w-md p-8">
          <div className="space-y-6">
            {/* Back to landing page button */}
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="flex items-center text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to home
              </button>
            )}
            
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <img src="/icons/app-icon-no-backdrop.svg" alt="Planneer Logo" className="w-16 h-16" />
              </div>
              <h2 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
                Welcome to Planneer
              </h2>
              <p className="text-[var(--color-text-secondary)]">
                Sign in to access your workspace
              </p>
            </div>

            <div className="space-y-3">
              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={() => handleModeChange('magic-link')}
              >
                <KeyRound className="w-4 h-4" />
                Continue with Magic Link
              </Button>

              <Button
                variant="secondary"
                size="md"
                className="w-full"
                onClick={() => handleModeChange('password')}
              >
                <Lock className="w-4 h-4" />
                Sign in with Password
              </Button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[var(--color-border-default)]" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
                    New to Planneer?
                  </span>
                </div>
              </div>

              {config.isClosedBeta ? (
                <div className="p-4 rounded-lg bg-[var(--color-info-bg)] border border-[var(--color-info-border)] text-center">
                  <p className="text-sm text-[var(--color-info-fg)] font-medium">
                    Closed Beta
                  </p>
                  <p className="text-xs text-[var(--color-info-fg)]/70 mt-1">
                    Registrations are currently restricted to invited users only.
                  </p>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  size="md"
                  className="w-full"
                  onClick={() => handleModeChange('register')}
                >
                  <UserPlus className="w-4 h-4" />
                  Create an Account
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Magic Link email entry
  if (mode === 'magic-link') {
    return (
      <div className="flex items-center justify-center min-h-full p-4 bg-[var(--color-surface-base)]">
        <Card className="w-full max-w-md p-8">
          <form onSubmit={handleRequestMagicLink}>
            <div className="space-y-6">
              <div>
                <button
                  type="button"
                  onClick={() => handleModeChange('choice')}
                  className="flex items-center text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </button>
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
                  Sign in with Magic Link
                </h2>
                <p className="text-[var(--color-text-secondary)]">
                  We'll send you a one-time code to sign in
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {localError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 rounded-lg text-sm">
                  {localError}
                </div>
              )}

              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="email"
                autoFocus
                inputMode="email"
                spellCheck={false}
                required
                label="Email address"
              />

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full"
                disabled={isLoading || !email.trim()}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Send Magic Link
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  // OTP verification
  if (mode === 'verify-otp') {
    return (
      <div className="flex items-center justify-center min-h-full p-4 bg-[var(--color-surface-base)]">
        <Card className="w-full max-w-md p-8">
          <form onSubmit={handleVerifyOTP}>
            <div className="space-y-6">
              <div>
                <button
                  type="button"
                  onClick={() => handleModeChange('magic-link')}
                  className="flex items-center text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </button>
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
                  Check your email
                </h2>
                <p className="text-[var(--color-text-secondary)]">
                  We sent a code to <strong className="text-[var(--color-text-primary)]">{pendingEmail}</strong>
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <Input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                autoFocus
                required
                maxLength={6}
                label="Verification code"
                className="text-center text-2xl tracking-[0.5em] font-mono"
              />

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full"
                disabled={isLoading || otp.length < 6}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify & Sign In'
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => handleRequestMagicLink({ preventDefault: () => {} } as React.FormEvent)}
                  disabled={isLoading}
                  className="text-sm text-[var(--color-interactive-text-strong)] hover:underline disabled:opacity-50 transition-opacity"
                >
                  Resend code
                </button>
              </div>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  // Password login
  if (mode === 'password') {
    return (
      <div className="flex items-center justify-center min-h-full p-4 bg-[var(--color-surface-base)]">
        <Card className="w-full max-w-md p-8">
          <form onSubmit={handlePasswordLogin}>
            <div className="space-y-6">
              <div>
                <button
                  type="button"
                  onClick={() => handleModeChange('choice')}
                  className="flex items-center text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </button>
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
                  Sign in with Password
                </h2>
                <p className="text-[var(--color-text-secondary)]">
                  Enter your credentials to access your account
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="email"
                autoFocus
                inputMode="email"
                spellCheck={false}
                required
                label="Email address"
              />

              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                label="Password"
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleModeChange('forgot-password')}
                  className="text-sm text-[var(--color-interactive-text-strong)] hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full"
                disabled={isLoading || !email.trim() || !password.trim()}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>

              <div className="text-center text-sm">
                <span className="text-[var(--color-text-secondary)]">Don't have an account? </span>
                {config.isClosedBeta ? (
                  <span className="text-[var(--color-text-secondary)] font-medium italic">
                    Registrations restricted
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleModeChange('register')}
                    className="text-[var(--color-interactive-text-strong)] font-medium hover:underline"
                  >
                    Sign up
                  </button>
                )}
              </div>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  // Forgot Password
  if (mode === 'forgot-password') {
    return (
      <div className="flex items-center justify-center min-h-full p-4 bg-[var(--color-surface-base)]">
        <Card className="w-full max-w-md p-8">
          <form onSubmit={handleForgotPassword}>
            <div className="space-y-6">
              <div>
                <button
                  type="button"
                  onClick={() => handleModeChange('password')}
                  className="flex items-center text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back to login
                </button>
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
                  Reset Password
                </h2>
                <p className="text-[var(--color-text-secondary)]">
                  Enter your email and we'll send you a link to reset your password
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="email"
                autoFocus
                inputMode="email"
                spellCheck={false}
                required
                label="Email address"
              />

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full"
                disabled={isLoading || !email.trim()}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  // Registration form
  if (mode === 'register') {
    if (config.isClosedBeta) {
      return (
        <div className="flex items-center justify-center min-h-full p-4 bg-[var(--color-surface-base)]">
          <Card className="w-full max-w-md p-8">
            <div className="space-y-6">
              <div>
                <button
                  type="button"
                  onClick={() => handleModeChange('choice')}
                  className="flex items-center text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </button>
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
                  Closed Beta
                </h2>
                <p className="text-[var(--color-text-secondary)]">
                  Registrations are temporarily disabled.
                </p>
              </div>

              <div className="p-6 rounded-xl bg-[var(--color-info-bg)] border border-[var(--color-info-border)] text-center">
                <Lock className="w-12 h-12 text-[var(--color-info-fg)] mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-[var(--color-info-fg)] mb-2">
                  Invite Only
                </h3>
                <p className="text-sm text-[var(--color-info-fg)]/80 leading-relaxed">
                  Planneer is currently in a closed beta phase. We are slowly rolling out access to ensure the best experience for everyone.
                </p>
                <div className="mt-6">
                  <a 
                    href="mailto:hello@planneer.app" 
                    className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[var(--color-interactive-bg-strong)] text-white text-sm font-medium hover:opacity-90 transition-colors"
                  >
                    Request an Invite
                  </a>
                </div>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center min-h-full p-4 bg-[var(--color-surface-base)]">
        <Card className="w-full max-w-md p-8">
          <form onSubmit={handleRegister}>
            <div className="space-y-6">
              <div>
                <button
                  type="button"
                  onClick={() => handleModeChange('choice')}
                  className="flex items-center text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </button>
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
                  Create an Account
                </h2>
                <p className="text-[var(--color-text-secondary)]">
                  Join Planneer and start organizing your life
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Name"
                required
                label="Full Name"
              />

              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                label="Email address"
              />

              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                label="Password"
              />

              <Input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="••••••••"
                required
                label="Confirm Password"
              />

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full"
                disabled={isLoading || !name.trim() || !email.trim() || !password.trim() || !passwordConfirm.trim()}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>

              <div className="text-center text-sm">
                <span className="text-[var(--color-text-secondary)]">Already have an account? </span>
                <button
                  type="button"
                  onClick={() => handleModeChange('password')}
                  className="text-[var(--color-interactive-text-strong)] font-medium hover:underline"
                >
                  Sign in
                </button>
              </div>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  return null;
};

export default LoginForm;
