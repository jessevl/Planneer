/**
 * @file NavigationBlocker.tsx
 * @description Global navigation blocker component that prevents navigation when there are unsaved changes
 * @app SHARED - Used in root layout to block all navigation
 * 
 * This component:
 * 1. Uses TanStack Router's useBlocker to intercept navigation
 * 2. Shows a confirmation modal when navigation is blocked
 * 3. Integrates with navigationBlockerStore for dirty state management
 */
import { useBlocker } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useNavigationBlockerStore } from '@/stores/navigationBlockerStore';
import ConfirmDiscardModal from '@/components/common/ConfirmDiscardModal';

export function NavigationBlocker() {
  const isDirty = useNavigationBlockerStore(s => s.isDirty);
  const showConfirmModal = useNavigationBlockerStore(s => s.showConfirmModal);
  const confirmNavigation = useNavigationBlockerStore(s => s.confirmNavigation);
  const cancelNavigation = useNavigationBlockerStore(s => s.cancelNavigation);

  // Use TanStack Router's useBlocker
  const { proceed, reset, status } = useBlocker({
    condition: isDirty,
  });

  // When blocker is triggered, show our modal
  useEffect(() => {
    if (status === 'blocked') {
      // Store the proceed function so we can call it when user confirms
      useNavigationBlockerStore.setState({ 
        showConfirmModal: true, 
        pendingNavigation: proceed 
      });
    }
  }, [status, proceed]);

  // Handle confirm - proceed with navigation
  const handleDiscard = () => {
    confirmNavigation();
  };

  // Handle cancel - reset blocker and stay on page
  const handleCancel = () => {
    reset?.();
    cancelNavigation();
  };

  // Also handle beforeunload for browser refresh/close
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore custom messages, but this triggers the dialog
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  return (
    <ConfirmDiscardModal
      open={showConfirmModal}
      onDiscard={handleDiscard}
      onCancel={handleCancel}
      message="You have unsaved changes. Are you sure you want to leave? Your changes will be lost."
    />
  );
}
