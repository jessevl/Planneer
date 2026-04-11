import React, { useEffect, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '@/stores/authStore';
import { Button, Card } from '@/components/ui';
import { toastError, toastSuccess } from '@/components/ui';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

export const Route = createFileRoute('/verify-email')({
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const navigate = useNavigate();
  const { confirmVerification, isLoading, error, clearError } = useAuthStore();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setStatus('error');
      toastError('Missing verification token');
      return;
    }

    const verify = async () => {
      try {
        await confirmVerification(token);
        setStatus('success');
        toastSuccess('Email verified successfully!');
        // Redirect after a delay
        setTimeout(() => {
          navigate({ to: '/' });
        }, 3000);
      } catch (err) {
        setStatus('error');
      }
    };

    verify();
    
    return () => clearError();
  }, [confirmVerification, navigate, clearError]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--color-surface-base)]">
      <Card className="w-full max-w-md p-8 text-center">
        {status === 'verifying' && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <Loader2 className="w-12 h-12 text-[var(--color-accent-primary)] animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
              Verifying your email...
            </h2>
            <p className="text-[var(--color-text-secondary)]">
              Please wait while we confirm your email address.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <CheckCircle2 className="w-16 h-16 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
              Email Verified!
            </h2>
            <p className="text-[var(--color-text-secondary)]">
              Your email has been successfully verified. You can now use all features of Planneer.
            </p>
            <p className="text-sm text-[var(--color-text-tertiary)]">
              Redirecting you to the app...
            </p>
            <Button variant="primary" onClick={() => navigate({ to: '/' })} className="w-full">
              Go to App
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <XCircle className="w-16 h-16 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
              Verification Failed
            </h2>
            <p className="text-[var(--color-text-secondary)]">
              {error || 'The verification link is invalid or has expired.'}
            </p>
            <Button variant="secondary" onClick={() => navigate({ to: '/' })} className="w-full">
              Back to Login
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
