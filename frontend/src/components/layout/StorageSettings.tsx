/**
 * @file StorageSettings.tsx
 * @description Storage management settings component
 * @app SHARED - Settings panel for offline storage management
 *
 * Features:
 * - Shows storage size breakdown (tasks, pages)
 * - Note content retention dropdown
 * - Download all for offline functionality
 * - Clear all data button with confirmation
 * - Database statistics
 * - PWA service worker status and update controls
 */
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Database, 
  HardDrive, 
  Trash2, 
  FileText, 
  CheckSquare, 
  FolderOpen,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Wifi,
  WifiOff,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  CloudDownload
} from 'lucide-react';
import { Button, Select } from '@/components/ui';
import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore } from '@/stores/settingsStore';
import { 
  getDbStats, 
  estimateStorageSize, 
  clearAllOfflineData,
  purgeOldPageContent
} from '@/lib/offlineDb';
import { getCurrentWorkspaceIdOrNull } from '@/stores/workspaceStore';
import { OFFLINE_STORAGE } from '@/lib/config';
import { usePWA } from '@/hooks/usePWA';
import { syncEngine, type DownloadProgressCallback } from '@/lib/syncEngine/index';

interface StorageStats {
  tasks: number;
  pages: number;
  pagesWithContent: number;
  taskCollections: number;
  pendingOps: number;
}

interface StorageSize {
  tasks: number;
  pages: number;
  syncQueue: number;
  imageQueue: number;
  total: number;
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Download All for Offline section component
 */
const DownloadAllSection: React.FC<{ onComplete?: () => void }> = ({ onComplete }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<{
    stage: string;
    current: number;
    total: number;
    message: string;
  } | null>(null);
  const [result, setResult] = useState<{
    tasks: number;
    pages: number;
    pagesWithContent: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    setProgress(null);
    setResult(null);
    setError(null);

    try {
      const summary = await syncEngine.downloadAllForOffline((prog) => {
        setProgress({
          stage: prog.stage,
          current: prog.current,
          total: prog.total,
          message: prog.message,
        });
      });
      setResult(summary);
      onComplete?.();
    } catch (e) {
      console.error('Download all failed:', e);
      setError(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setIsDownloading(false);
      setProgress(null);
    }
  }, [onComplete]);

  const progressPercent = progress && progress.total > 0 
    ? Math.round((progress.current / progress.total) * 100) 
    : 0;

  return (
    <div className="p-4 bg-[var(--color-surface-inset)] rounded-xl border border-[var(--color-border-default)]">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
          <CloudDownload className="w-5 h-5 text-green-600 dark:text-green-400" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-[var(--color-text-primary)]">
            Download All for Offline
          </h4>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Download all pages and tasks for complete offline access
          </p>
        </div>
      </div>

      {isDownloading && progress && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-[var(--color-text-secondary)] mb-1">
            <span>{progress.message}</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full bg-[var(--color-border-default)] rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {result && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Download complete!</span>
          </div>
          <p className="text-sm text-green-600 dark:text-green-400 mt-1">
            {result.tasks} tasks, {result.pages} pages ({result.pagesWithContent} with content)
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <XCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Download failed</span>
          </div>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
        </div>
      )}

      <Button
        variant="secondary"
        onClick={handleDownload}
        disabled={isDownloading}
        className="w-full flex items-center justify-center gap-2"
      >
        {isDownloading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Downloading...
          </>
        ) : (
          <>
            <CloudDownload className="w-4 h-4" />
            Download All Data
          </>
        )}
      </Button>
    </div>
  );
};

/**
 * Storage settings panel for Settings modal
 */
const StorageSettings: React.FC = () => {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [size, setSize] = useState<StorageSize | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const [purgeResult, setPurgeResult] = useState<string | null>(null);

  const { offlineSettings, setOfflineSettings } = useSettingsStore(
    useShallow((s) => ({
      offlineSettings: s.offlineSettings,
      setOfflineSettings: s.setOfflineSettings,
    }))
  );
  const noteContentRetentionDays = offlineSettings.noteContentRetentionDays;

  // Load storage stats
  const loadStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dbStats, storageSize] = await Promise.all([
        getDbStats(),
        estimateStorageSize(),
      ]);
      setStats(dbStats);
      setSize(storageSize);
    } catch (e) {
      console.error('Failed to load storage stats:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Handle retention change
  const handleRetentionChange = useCallback((value: string) => {
    const days = parseInt(value, 10) as 0 | 7 | 14 | 30;
    setOfflineSettings({ noteContentRetentionDays: days });
  }, [setOfflineSettings]);

  // Handle clear all data
  const handleClearData = useCallback(async () => {
    setIsClearing(true);
    setClearError(null);
    try {
      await clearAllOfflineData();
      await loadStats();
      setShowClearConfirm(false);
    } catch (e) {
      console.error('Failed to clear data:', e);
      setClearError('Failed to clear data. Please try again.');
    } finally {
      setIsClearing(false);
    }
  }, [loadStats]);

  // Handle purge old content
  const handlePurgeContent = useCallback(async () => {
    const workspaceId = getCurrentWorkspaceIdOrNull();
    if (!workspaceId) return;

    setIsPurging(true);
    setPurgeResult(null);
    try {
      const days = noteContentRetentionDays || 7; // Default to 7 days if not set
      const purged = await purgeOldPageContent(workspaceId, days);
      setPurgeResult(`Purged content from ${purged} pages`);
      await loadStats();
    } catch (e) {
      console.error('Failed to purge content:', e);
      setPurgeResult('Failed to purge content');
    } finally {
      setIsPurging(false);
    }
  }, [noteContentRetentionDays, loadStats]);

  // Retention options
  const retentionOptions = [
    { value: '0', label: 'Metadata only (load on demand)' },
    { value: '7', label: 'Last 7 days' },
    { value: '14', label: 'Last 14 days' },
    { value: '30', label: 'Last 30 days' },
  ];

  const currentRetention = noteContentRetentionDays === null ? '0' : String(noteContentRetentionDays);

  // PWA status
  const pwa = usePWA();
  const formatLastCheck = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
          Storage & Offline
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Manage offline data and storage usage
        </p>
      </div>

      {/* PWA Status Section */}
      <div className="p-4 bg-[var(--color-surface-inset)] rounded-xl border border-[var(--color-border-default)]">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-lg ${pwa.isRegistered ? 'bg-green-100 dark:bg-green-900/30' : 'bg-[var(--color-surface-secondary)]'}`}>
            {pwa.isRegistered ? (
              <Wifi className="w-5 h-5 text-green-600 dark:text-green-400" />
            ) : (
              <WifiOff className="w-5 h-5 text-[var(--color-text-secondary)]" />
            )}
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-[var(--color-text-primary)]">
              Service Worker
            </h4>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {pwa.error ? pwa.error : pwa.isRegistered ? 'Active & caching assets' : 'Not registered'}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Offline Ready Status - improved messaging */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              {pwa.hasController || pwa.isOfflineReady ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-[var(--color-text-tertiary)]" />
              )}
              <span className="text-sm text-[var(--color-text-primary)]">Offline Ready</span>
            </div>
            <span className={`text-sm font-medium ${pwa.hasController || pwa.isOfflineReady ? 'text-green-600 dark:text-green-400' : 'text-[var(--color-text-secondary)]'}`}>
              {pwa.hasController || pwa.isOfflineReady ? 'Yes' : 'No'}
            </span>
          </div>

          {/* Service Worker State (debug info) */}
          {pwa.swState && (
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${
                  pwa.swState === 'activated' ? 'bg-green-500' :
                  pwa.swState === 'installed' ? 'bg-yellow-500' :
                  pwa.swState === 'installing' ? 'bg-[var(--color-interactive-bg-strong)]' :
                  'bg-[var(--color-text-tertiary)]'
                }`} />
                <span className="text-sm text-[var(--color-text-primary)]">SW State</span>
              </div>
              <span className="text-sm text-[var(--color-text-primary)] capitalize">
                {pwa.swState}
              </span>
            </div>
          )}

          {/* Controller Status */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {pwa.hasController ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                )}
                <span className="text-sm text-[var(--color-text-primary)] font-medium">Active Controller</span>
              </div>
              <span className={`text-sm font-medium ${pwa.hasController ? 'text-green-600 dark:text-green-400' : 'text-[var(--color-text-secondary)]'}`}>
                {pwa.hasController ? 'Yes' : 'No'}
              </span>
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
              When a service worker "controls" the page, it intercepts network requests to serve data from the local cache. 
              This is essential for the app to function correctly while offline.
            </p>
          </div>

          {/* Last Update Check */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-[var(--color-text-tertiary)]" />
              <span className="text-sm text-[var(--color-text-primary)]">Last checked</span>
            </div>
            <span className="text-sm text-[var(--color-text-primary)]">
              {formatLastCheck(pwa.lastUpdateCheck)}
            </span>
          </div>

          {/* Update Available */}
          {pwa.needsUpdate && (
            <div className="flex items-center justify-between py-2 px-3 bg-[var(--color-info-bg)] rounded-lg border border-[var(--color-info-border)]">
              <div className="flex items-center gap-3">
                <Download className="w-4 h-4 text-[var(--color-info-fg)]" />
                <span className="text-sm font-medium text-[var(--color-info-fg)]">Update available!</span>
              </div>
              <Button
                size="sm"
                onClick={pwa.applyUpdate}
                className="bg-[var(--color-interactive-bg-strong)] hover:opacity-90 text-white"
              >
                Update Now
              </Button>
            </div>
          )}

          {/* Info about update behavior */}
          <div className="pt-1 text-xs text-[var(--color-text-secondary)]">
            <p>After checking, updates install in background. Some browsers auto-refresh; others require manual refresh.</p>
          </div>

          {/* Check for Updates Button */}
          <div className="pt-2">
            <Button
              variant="secondary"
              onClick={pwa.checkForUpdate}
              disabled={pwa.isChecking || !pwa.isRegistered}
              className="w-full flex items-center justify-center gap-2"
            >
              {pwa.isChecking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Check for Updates
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Storage overview */}
      <div className="p-4 bg-[var(--color-surface-inset)] rounded-xl border border-[var(--color-border-default)]">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-[var(--color-interactive-bg)] rounded-lg">
            <HardDrive className="w-5 h-5 text-[var(--color-interactive-text-strong)]" />
          </div>
          <div>
            <h4 className="font-medium text-[var(--color-text-primary)]">
              Local Storage
            </h4>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {isLoading ? 'Calculating...' : size ? formatBytes(size.total) : 'Unknown'}
            </p>
          </div>
          <button
            onClick={loadStats}
            disabled={isLoading}
            className="ml-auto p-2 rounded-lg hover:bg-[var(--color-surface-secondary)] transition-colors"
            aria-label="Refresh stats"
          >
            <RefreshCw className={`w-4 h-4 text-[var(--color-text-secondary)] ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-secondary)]" />
          </div>
        ) : stats && size ? (
          <div className="space-y-3">
            {/* Tasks */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <CheckSquare className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                <span className="text-sm text-[var(--color-text-primary)]">Tasks</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {stats.tasks}
                </span>
                <span className="text-xs text-[var(--color-text-secondary)] ml-2">
                  ({formatBytes(size.tasks)})
                </span>
              </div>
            </div>

            {/* Pages (Notes) */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                <span className="text-sm text-[var(--color-text-primary)]">Pages</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {stats.pages}
                </span>
                <span className="text-xs text-[var(--color-text-secondary)] ml-2">
                  ({stats.pagesWithContent} with content, {formatBytes(size.pages)})
                </span>
              </div>
            </div>

            {/* Task Collections */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <FolderOpen className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                <span className="text-sm text-[var(--color-text-primary)]">Task Collections</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {stats.taskCollections}
                </span>
                <span className="text-xs text-[var(--color-text-secondary)] ml-2">
                  (included in pages)
                </span>
              </div>
            </div>

            {/* Pending ops */}
            {stats.pendingOps > 0 && (
              <div className="flex items-center justify-between py-2 text-amber-600 dark:text-amber-400">
                <div className="flex items-center gap-3">
                  <Database className="w-4 h-4" />
                  <span className="text-sm">Pending sync</span>
                </div>
                <span className="text-sm font-medium">
                  {stats.pendingOps} operation{stats.pendingOps !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Note content retention */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
          Note Content Caching
        </label>
        <p className="text-sm text-[var(--color-text-secondary)] mb-3">
          How long to keep page content cached locally for offline access.
        </p>
        <div className="flex gap-3">
          <select
            value={currentRetention}
            onChange={(e) => handleRetentionChange(e.target.value)}
            className="flex-1 px-3 py-2 text-sm bg-[var(--color-surface-base)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-interactive-ring)]"
          >
            {retentionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            onClick={handlePurgeContent}
            disabled={isPurging || noteContentRetentionDays === null}
            className="flex items-center gap-2"
          >
            {isPurging ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Purge Old
          </Button>
        </div>
        {purgeResult && (
          <p className="mt-2 text-sm text-green-600 dark:text-green-400">
            {purgeResult}
          </p>
        )}
      </div>

      {/* Download All for Offline */}
      <DownloadAllSection onComplete={loadStats} />

      {/* Clear all data */}
      <div className="p-4 border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-red-700 dark:text-red-400 mb-1">
              Clear All Offline Data
            </h4>
            <p className="text-sm text-red-600 dark:text-red-300 mb-3">
              This will delete all cached data including any unsynced changes.
              Your data on the server will not be affected.
            </p>
            
            {!showClearConfirm ? (
              <Button
                variant="secondary"
                onClick={() => setShowClearConfirm(true)}
                className="border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40"
              >
                Clear Data
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  Are you sure? This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setShowClearConfirm(false)}
                    disabled={isClearing}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleClearData}
                    disabled={isClearing}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    {isClearing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Clearing...
                      </>
                    ) : (
                      'Yes, Clear All Data'
                    )}
                  </Button>
                </div>
                {clearError && (
                  <p className="text-sm text-red-600">{clearError}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StorageSettings;
