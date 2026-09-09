'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiDownload, FiX, FiSmartphone, FiMonitor } from 'react-icons/fi';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    if (standalone) return;

    // Detect iOS
    const ua = window.navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: boolean }).MSStream;
    setIsIOS(ios);

    // Listen for the beforeinstallprompt event (Android/Chrome)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.error('Install prompt error:', err);
    }
  }, [deferredPrompt]);

  // Don't show if already in standalone mode
  if (isStandalone) return null;

  // iOS doesn't support beforeinstallprompt, show manual instructions
  if (isIOS && !isStandalone) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm animate-slide-in-up">
        <div className="bg-white rounded-2xl shadow-2xl border border-thb-border p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center">
              <FiSmartphone className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-thb-text-primary">Install 3Boxes HRMS App</p>
              <p className="text-xs text-thb-text-secondary mt-1">
                Tap <span className="inline-flex items-center gap-0.5 font-medium">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                  Share
                </span> then &quot;Add to Home Screen&quot;
              </p>
            </div>
            <button
              onClick={() => setShowPrompt(false)}
              className="flex-shrink-0 text-thb-text-muted hover:text-thb-text-secondary"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Android/Chrome install prompt
  if (showPrompt && deferredPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm animate-slide-in-up">
        <div className="bg-white rounded-2xl shadow-2xl border border-thb-border p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center">
              <FiDownload className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-thb-text-primary">Install 3Boxes HRMS</p>
              <p className="text-xs text-thb-text-secondary mt-1">
                Install the app on your device for quick access and offline support.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleInstallClick}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-500 to-teal-600 text-white text-xs font-semibold hover:from-green-600 hover:to-teal-700 transition-all"
                >
                  Install App
                </button>
                <button
                  onClick={() => setShowPrompt(false)}
                  className="px-3 py-1.5 rounded-lg border border-thb-border text-xs text-thb-text-secondary hover:bg-slate-50 transition-all"
                >
                  Not Now
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowPrompt(false)}
              className="flex-shrink-0 text-thb-text-muted hover:text-thb-text-secondary"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
