import React, { useState, useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '@/stores/authStore';
import { Button, Input, Card } from '@/components/ui';
import { toastError, toastSuccess } from '@/components/ui';
import { Loader2, Lock, CheckCircle2 } from 'lucide-react';

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { confirmPasswordReset, isLoading, error, clearError } = useAuthStore();
  
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    // Extract token from URL hash (PocketBase default) or query params
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    
    // PocketBase usually sends the token in the hash like #/reset-password/TOKEN
    // or as a query parameter depending on how the redirect URL is configured.
    let extractedToken = params.get('token');
    
    if (!extractedToken && hash) {
      // Try to extract from hash if it looks like a token
      const parts = hash.split('/');
      extractedToken = parts[parts.length - 1];
    }

    if (extractedToken) {
      setToken(extractedToken);
    } else {
      toastError('Invalid or missing reset token');
      navigate({ to: '/' });
    }
    
    return () => clearError();
  }, [navigate, clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (password !== passwordConfirm) {
      toastError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      toastError('Password must be at least 8 characters');
      return;
    }

    try {
      await confirmPasswordReset(token, password, passwordConfirm);
      toastSuccess('Password reset successfully! You can now sign in with your new password.');
      setIsSuccess(true);
      // Wait a bit then redirect to login
      setTimeout(() => {
        navigate({ to: '/' });
      }, 3000);
    } catch (err: any) {
      // Error is handled by store
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--color-surface-base)]">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
            Password Reset Complete
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-6">
            Your password has been successfully updated. Redirecting you to the login page...
          </p>
          <Button variant="primary" onClick={() => navigate({ to: '/' })}>
            Go to Login
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--color-surface-base)]">
      <Card className="w-full max-w-md p-8">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
                Set New Password
              </h2>
              <p className="text-[var(--color-text-secondary)]">
                Please enter your new password below
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 rounded-lg text-sm">
                {error}
              </div>
            )}

            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New Password"
              required
              label="New Password"
              autoFocus
            />

            <Input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="Confirm New Password"
              required
              label="Confirm New Password"
            />

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full"
              disabled={isLoading || !password || password !== passwordConfirm}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Reset Password
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
