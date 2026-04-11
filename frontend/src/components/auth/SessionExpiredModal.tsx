/**
 * @file SessionExpiredModal.tsx
 * @description Modal shown when user's session expires
 * @app AUTH - Session expiry handling
 *
 * Displayed when:
 * - Auth token expires while using the app
 * - Token validation fails
 * - User was logged out from another device
 *
 * Features:
 * - Attempts to reconnect (re-authenticate) before forcing full re-login
 * - Clear messaging about what happened (session expired, not workspace removal)
 * - Option to continue offline if available
 */
import React, { useState } from 'react';
import { LogOut, RefreshCw, Lock, Loader2 } from 'lucide-react';
import { Modal, Button, ModalFooter } from '@/components/ui';
import { pb } from '@/lib/pocketbase';

interface SessionExpiredModalProps {
  isOpen: boolean;
  onLogin: () => void;
  onDismiss?: () => void;
  /** Optional message explaining why session expired */
  reason?: string;
}

/**
 * Modal displayed when user session expires.
 * First attempts to silently reconnect via authRefresh before requiring
 * a full sign-in.
 */
export const SessionExpiredModal: React.FC<SessionExpiredModalProps> = ({
  isOpen,
  onLogin,
  onDismiss,
  reason,
}) => {
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectFailed, setReconnectFailed] = useState(false);

  /**
   * Attempt to reconnect by refreshing the auth token.
   * If PocketBase can still refresh the session, the user doesn't need to
   * re-enter their credentials.
   */
  const handleReconnect = async () => {
    setIsReconnecting(true);
    setReconnectFailed(false);
    try {
      await pb.collection('users').authRefresh();
      // Success - token was refreshed, close the modal and reload state
      window.location.reload();
    } catch {
      // Token is truly expired or revoked - user must sign in again
      setReconnectFailed(true);
    } finally {
      setIsReconnecting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onDismiss || onLogin}
      showCloseButton={false}
      footer={
        <ModalFooter className="w-full">
          {onDismiss && (
            <Button
              variant="ghost"
              className="flex-1 justify-center border border-[var(--color-border-default)]"
              onClick={onDismiss}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Continue Offline
            </Button>
          )}
          {!reconnectFailed ? (
            <Button
              variant="primary"
              className="flex-1 justify-center shadow-lg shadow-[var(--color-interactive-shadow)]"
              onClick={handleReconnect}
              disabled={isReconnecting}
            >
              {isReconnecting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              {isReconnecting ? 'Reconnecting...' : 'Reconnect'}
            </Button>
          ) : (
            <Button
              variant="primary"
              className="flex-1 justify-center shadow-lg shadow-[var(--color-interactive-shadow)]"
              onClick={onLogin}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Sign In
            </Button>
          )}
        </ModalFooter>
      }
    >
      <div className="text-center py-4">
        {/* Icon */}
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-100 dark:bg-amber-900/30 
                      flex items-center justify-center">
          <Lock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
        </div>

        {/* Message */}
        <p className="text-[var(--color-text-secondary)] mb-2">
          {reason || 'Your session has expired. This can happen after a period of inactivity.'}
        </p>
        
        <p className="text-sm text-[var(--color-text-tertiary)]">
          {reconnectFailed
            ? 'Unable to reconnect automatically. Please sign in again to continue.'
            : 'Don\'t worry, your unsaved work will be preserved.'}
        </p>
      </div>
    </Modal>
  );
};

export default SessionExpiredModal;
