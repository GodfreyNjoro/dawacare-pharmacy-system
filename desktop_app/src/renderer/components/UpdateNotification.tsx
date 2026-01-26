import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

interface UpdateInfo {
  version?: string;
  releaseDate?: string;
  releaseNotes?: string;
  percent?: number;
  message?: string;
}

type UpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';

export default function UpdateNotification() {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Get current version
    window.electronAPI.getVersionInfo().then((info) => {
      setCurrentVersion(info.version);
    });

    // Listen for update status changes
    const unsubscribe = window.electronAPI.onUpdateStatus((data) => {
      console.log('[Update] Status:', data.status, data.data);
      setStatus(data.status as UpdateStatus);
      setUpdateInfo(data.data || null);

      // Show banner for important statuses
      if (['available', 'downloaded', 'error'].includes(data.status)) {
        setShowBanner(true);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleCheckUpdate = async () => {
    setStatus('checking');
    await window.electronAPI.checkForUpdates();
  };

  const handleDownload = async () => {
    setStatus('downloading');
    await window.electronAPI.downloadUpdate();
  };

  const handleInstall = () => {
    window.electronAPI.installUpdate();
  };

  const closeBanner = () => {
    setShowBanner(false);
  };

  // Don't show anything if idle and no banner
  if (status === 'idle' && !showBanner) {
    return null;
  }

  // Update available banner
  if (status === 'available' && showBanner) {
    return (
      <div className="fixed bottom-4 right-4 bg-emerald-600 text-white rounded-lg shadow-lg p-4 max-w-sm z-50 animate-slide-up">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Download className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold">Update Available</h4>
              <p className="text-sm text-emerald-100 mt-1">
                Version {updateInfo?.version} is ready to download.
              </p>
              <p className="text-xs text-emerald-200 mt-1">
                Current: v{currentVersion}
              </p>
            </div>
          </div>
          <button onClick={closeBanner} className="text-emerald-200 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleDownload}
            className="flex-1 bg-white text-emerald-700 px-3 py-1.5 rounded text-sm font-medium hover:bg-emerald-50 transition-colors"
          >
            Download Now
          </button>
          <button
            onClick={closeBanner}
            className="px-3 py-1.5 text-sm text-emerald-200 hover:text-white transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    );
  }

  // Downloading progress
  if (status === 'downloading') {
    const percent = updateInfo?.percent || 0;
    return (
      <div className="fixed bottom-4 right-4 bg-blue-600 text-white rounded-lg shadow-lg p-4 max-w-sm z-50">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-semibold">Downloading Update</h4>
            <div className="mt-2 bg-blue-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-white h-full transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="text-xs text-blue-200 mt-1">{percent.toFixed(1)}% complete</p>
          </div>
        </div>
      </div>
    );
  }

  // Downloaded - ready to install
  if (status === 'downloaded' && showBanner) {
    return (
      <div className="fixed bottom-4 right-4 bg-green-600 text-white rounded-lg shadow-lg p-4 max-w-sm z-50 animate-slide-up">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold">Update Ready</h4>
              <p className="text-sm text-green-100 mt-1">
                Version {updateInfo?.version} is ready to install.
              </p>
              <p className="text-xs text-green-200 mt-1">
                The app will restart to apply the update.
              </p>
            </div>
          </div>
          <button onClick={closeBanner} className="text-green-200 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleInstall}
            className="flex-1 bg-white text-green-700 px-3 py-1.5 rounded text-sm font-medium hover:bg-green-50 transition-colors"
          >
            Restart & Install
          </button>
          <button
            onClick={closeBanner}
            className="px-3 py-1.5 text-sm text-green-200 hover:text-white transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    );
  }

  // Error
  if (status === 'error' && showBanner) {
    return (
      <div className="fixed bottom-4 right-4 bg-red-600 text-white rounded-lg shadow-lg p-4 max-w-sm z-50 animate-slide-up">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold">Update Error</h4>
              <p className="text-sm text-red-100 mt-1">
                {updateInfo?.message || 'Failed to check for updates'}
              </p>
            </div>
          </div>
          <button onClick={closeBanner} className="text-red-200 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={handleCheckUpdate}
          className="mt-3 w-full bg-white text-red-700 px-3 py-1.5 rounded text-sm font-medium hover:bg-red-50 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Checking status (subtle indicator)
  if (status === 'checking') {
    return (
      <div className="fixed bottom-4 right-4 bg-gray-800 text-white rounded-lg shadow-lg px-4 py-2 z-50">
        <div className="flex items-center gap-2 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Checking for updates...</span>
        </div>
      </div>
    );
  }

  return null;
}
