import React, { useState, useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '@/stores/authStore';
import { Button, Input, Card } from '@/components/ui';
import { toastError, toastSuccess } from '@/components/ui';
import { Loader2, Mail, CheckCircle2 } from 'lucide-react';

export const Route = createFileRoute('/confirm-email-change')({
  component: ConfirmEmailChangePage,
});

function ConfirmEmailChangePage() {
  const navigate = useNavigate();
  const { confirmEmailChange, isLoading, error, clearError } = useAuthStore();
  
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const extractedToken = params.get('token');

    if (extractedToken) {
      setToken(extractedToken);
    } else {
      toastError('Invalid or missing confirmation token');
      navigate({ to: '/' });
    }
    
    return () => clearError();
  }, [navigate, clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      await confirmEmailChange(token, password);
      toastSuccess('Email changed successfully! Please sign in with your new email.');
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
            Email Changed
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-6">
            Your email address has been successfully updated. Redirecting you to the login page...
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
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-[var(--color-interactive-bg)] rounded-full">
                  <Mail className="w-8 h-8 text-[var(--color-accent-primary)]" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
                Confirm Email Change
              </h2>
              <p className="text-[var(--color-text-secondary)]">
                Please enter your password to confirm the change to your new email address.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 rounded-lg text-sm">
                {error}
              </div>
            )}

            <Input
              label="Current Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoFocus
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={isLoading || !password}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Confirming...
                </>
              ) : (
                'Confirm Email Change'
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
