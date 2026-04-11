/**
 * Account Settings Section
 * Profile, email, password, verification, sign-out, delete account.
 */

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useShallow } from 'zustand/react/shallow';
import { Input, Button, toastError, toastSuccess } from '@/components/ui';
import {
  SettingsSectionHeader,
  SettingsCard,
  SettingsStatusMessage,
  SettingsCollapsible,
  SettingsActionButton,
} from '@frameer/components/ui';
import { Mail, Lock, LogOut, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface AccountSettingsProps {
  onClose: () => void;
}

const AccountSettings: React.FC<AccountSettingsProps> = ({ onClose }) => {
  const { user, logout, updateProfile, changePassword, changeEmail, requestVerification, deleteAccount } = useAuthStore(
    useShallow((s) => ({
      user: s.user,
      logout: s.logout,
      updateProfile: s.updateProfile,
      changePassword: s.changePassword,
      changeEmail: s.changeEmail,
      requestVerification: s.requestVerification,
      deleteAccount: s.deleteAccount,
    }))
  );

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  // Email
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);

  // Password
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Verification
  const [isSendingVerification, setIsSendingVerification] = useState(false);

  // Delete
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      onClose();
      toastSuccess('Signed out successfully');
    } catch {
      toastError('Logout failed');
      setIsLoggingOut(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name === user?.name) return;
    setIsUpdatingProfile(true);
    try {
      await updateProfile({ name: name.trim() });
      toastSuccess('Profile updated successfully');
    } catch {
      toastError('Failed to update profile');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) { toastError('Please enter a new email address'); return; }
    if (!emailPassword.trim()) { toastError('Please enter your current password to confirm'); return; }
    setIsUpdatingEmail(true);
    try {
      await changeEmail(newEmail.trim(), emailPassword);
      toastSuccess(`Verification email sent to ${newEmail}`);
      setNewEmail('');
      setEmailPassword('');
    } catch (error: any) {
      toastError(error.message || 'Failed to request email change');
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword) { toastError('Please enter your current password'); return; }
    if (!newPassword) { toastError('Please enter a new password'); return; }
    if (newPassword !== newPasswordConfirm) { toastError('New passwords do not match'); return; }
    if (newPassword.length < 8) { toastError('New password must be at least 8 characters'); return; }
    setIsUpdatingPassword(true);
    try {
      await changePassword(oldPassword, newPassword, newPasswordConfirm);
      toastSuccess('Password updated successfully');
      setOldPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (error: any) {
      toastError(error.message || 'Failed to update password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleResendVerification = async () => {
    if (!user?.email) return;
    setIsSendingVerification(true);
    try {
      await requestVerification(user.email);
      toastSuccess('Verification email sent');
    } catch {
      toastError('Failed to send verification email');
    } finally {
      setIsSendingVerification(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletePassword) return;
    setIsDeletingAccount(true);
    try {
      await deleteAccount(deletePassword);
      toastSuccess('Account deleted successfully');
      onClose();
    } catch (error: any) {
      toastError(error.message || 'Failed to delete account');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Verification status */}
      {user && !user.verified && (
        <SettingsStatusMessage type="error" message="Email not verified — check your inbox or resend below" />
      )}
      {user && user.verified && (
        <div className="flex items-center gap-2 p-2 rounded-lg text-sm bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400">
          <CheckCircle2 size={14} /> Email verified
        </div>
      )}

      {/* Profile */}
      <SettingsSectionHeader title="Profile" />
      <SettingsCard>
        <form onSubmit={handleUpdateProfile} className="space-y-3">
          <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your Name" />
          <div className="flex justify-end">
            <Button type="submit" variant="primary" size="sm" disabled={isUpdatingProfile || !name.trim() || name === user?.name}>
              {isUpdatingProfile ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </SettingsCard>

      {/* Email */}
      <SettingsCollapsible title="Change Email" description={user?.email}>
        <form onSubmit={handleChangeEmail} className="space-y-3">
          <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new-email@example.com" />
          <Input type="password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} placeholder="Current password" />
          <div className="flex justify-end">
            <Button type="submit" variant="secondary" size="sm" disabled={isUpdatingEmail}>
              {isUpdatingEmail ? 'Updating...' : 'Change Email'}
            </Button>
          </div>
        </form>
      </SettingsCollapsible>

      {/* Password */}
      <SettingsCollapsible title="Change Password">
        <form onSubmit={handleChangePassword} className="space-y-3">
          <Input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="Current password" />
          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" />
          <Input type="password" value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} placeholder="Confirm new password" />
          <div className="flex justify-end">
            <Button type="submit" variant="secondary" size="sm" disabled={isUpdatingPassword}>
              {isUpdatingPassword ? 'Updating...' : 'Update Password'}
            </Button>
          </div>
        </form>
      </SettingsCollapsible>

      {/* Verification */}
      {user && !user.verified && (
        <SettingsActionButton
          onClick={handleResendVerification}
          disabled={isSendingVerification}
          loading={isSendingVerification}
          icon={<AlertCircle size={14} />}
          label={isSendingVerification ? 'Sending...' : 'Resend Verification Email'}
        />
      )}

      {/* Sign Out */}
      <SettingsActionButton
        onClick={handleLogout}
        disabled={isLoggingOut}
        loading={isLoggingOut}
        icon={<LogOut size={14} />}
        label={isLoggingOut ? 'Signing out...' : 'Sign Out'}
      />

      {/* Danger Zone */}
      <SettingsCollapsible title="Danger Zone" description="Irreversible account actions">
        {!showDeleteConfirm ? (
          <SettingsActionButton
            onClick={() => setShowDeleteConfirm(true)}
            icon={<Trash2 size={14} />}
            label="Delete My Account"
            variant="danger"
          />
        ) : (
          <form onSubmit={handleDeleteAccount} className="space-y-3">
            <p className="text-sm text-red-600 dark:text-red-400">Enter your password to confirm permanent deletion:</p>
            <Input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} placeholder="Password" autoFocus />
            <div className="flex gap-2">
              <Button type="submit" variant="primary" className="bg-red-600 hover:bg-red-700 text-white border-transparent" disabled={isDeletingAccount || !deletePassword}>
                {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); }} disabled={isDeletingAccount}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </SettingsCollapsible>
    </div>
  );
};

export default AccountSettings;
