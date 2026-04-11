/**
 * @file PWAInstallBanner.tsx
 * @description Banner prompting users to install the PWA
 * @app SHARED - PWA installation UI
 * 
 * Shows a dismissible banner when the app can be installed as a PWA.
 * Automatically hidden when:
 * - App is already installed
 * - User has dismissed the banner recently
 * - Browser doesn't support install prompt
 */

import React, { useState } from 'react';
import { X, Download, Smartphone, Share, PlusSquare, Info } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';

const PWAInstallBanner: React.FC = () => {
  const { 
    canInstall, 
    isInstalled, 
    promptInstall, 
    dismissInstall, 
    isDismissed,
    isIOS,
    isSafari,
    supportsInstallPrompt,
    hasDeferredPrompt
  } = usePWAInstall();
  const isMobile = useIsMobile();
  const [showInstructions, setShowInstructions] = useState(false);

  // Don't show if already installed, dismissed, or can't install
  if (isInstalled || isDismissed || !canInstall) {
    return null;
  }

  const handleInstall = async () => {
    if (supportsInstallPrompt && hasDeferredPrompt) {
      await promptInstall();
    } else {
      setShowInstructions(true);
    }
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:bottom-4 md:w-80 z-150 animate-slide-in-bottom">
      <div className="bg-[var(--color-surface-base)] border border-[var(--color-border-default)] rounded-xl shadow-lg p-4 overflow-hidden">
        {!showInstructions ? (
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="flex-shrink-0 w-10 h-10 bg-[var(--color-interactive-bg)] rounded-lg flex items-center justify-center">
              {isMobile ? (
                <Smartphone className="w-5 h-5 text-[var(--color-interactive-text-strong)]" />
              ) : (
                <Download className="w-5 h-5 text-[var(--color-interactive-text-strong)]" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Install Planneer
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                {isMobile
                  ? 'Add to your home screen for quick access'
                  : 'Install the app for offline access and notifications'
                }
              </p>
              
              {/* Actions */}
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleInstall}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-[var(--color-interactive-bg-strong)] hover:brightness-110 rounded-lg transition-colors"
                >
                  {supportsInstallPrompt && hasDeferredPrompt ? 'Install' : 'How to install'}
                </button>
                <button
                  onClick={dismissInstall}
                  className="px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  Not now
                </button>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={dismissInstall}
              className="flex-shrink-0 p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                <Info className="w-4 h-4 text-[var(--color-interactive-text-strong)]" />
                How to Install
              </h3>
              <button
                onClick={() => setShowInstructions(false)}
                className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-[var(--color-text-secondary)]">
              {isIOS ? (
                <>
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded bg-[var(--color-surface-secondary)] flex items-center justify-center flex-shrink-0">
                      <Share className="w-3 h-3" />
                    </div>
                    <p>Tap the <strong>Share</strong> button in the browser toolbar.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded bg-[var(--color-surface-secondary)] flex items-center justify-center flex-shrink-0">
                      <PlusSquare className="w-3 h-3" />
                    </div>
                    <p>Scroll down and tap <strong>Add to Home Screen</strong>.</p>
                  </div>
                </>
              ) : isMobile ? (
                <>
                  <p>1. Open your browser menu (usually three dots or lines).</p>
                  <p>2. Look for <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>
                </>
              ) : (
                <>
                  <p>1. Open your browser menu (usually three dots or lines).</p>
                  <p>2. Look for <strong>Install Planneer</strong> or <strong>App &gt; Install Planneer</strong>.</p>
                  <p>3. On some browsers, look for an install icon in the address bar.</p>
                </>
              )}
            </div>

            <button
              onClick={dismissInstall}
              className="w-full py-2 text-xs font-medium text-white bg-[var(--color-interactive-bg-strong)] hover:brightness-110 rounded-lg transition-colors"
            >
              Got it
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PWAInstallBanner;
