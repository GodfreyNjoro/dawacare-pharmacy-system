import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  serverUrl: string | null;
  isAuthenticated: boolean;
  pendingChanges: number;
}

interface SyncProgress {
  stage: string;
  progress: number;
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [appVersion, setAppVersion] = useState('');
  const [dbConfig, setDbConfig] = useState<any>(null);
  const [todayStats, setTodayStats] = useState({ totalRevenue: 0, salesCount: 0 });
  
  // Sync state
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: false,
    isSyncing: false,
    lastSyncAt: null,
    serverUrl: null,
    isAuthenticated: false,
    pendingChanges: 0,
  });
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncServerUrl, setSyncServerUrl] = useState('');
  const [syncEmail, setSyncEmail] = useState('');
  const [syncPassword, setSyncPassword] = useState('');
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [syncError, setSyncError] = useState('');
  const [syncSuccess, setSyncSuccess] = useState('');

  useEffect(() => {
    loadAppInfo();
    loadSyncStatus();
    
    // Listen for sync progress updates
    const unsubscribe = window.electronAPI.onSyncProgress((data: SyncProgress) => {
      setSyncProgress(data);
      if (data.progress === 100) {
        setTimeout(() => setSyncProgress(null), 2000);
      }
    });
    
    return () => unsubscribe();
  }, []);

  const loadAppInfo = async () => {
    try {
      const versionResult = await window.electronAPI.getAppVersion();
      if (versionResult.success) {
        setAppVersion(versionResult.version);
      }

      const configResult = await window.electronAPI.getDbConfig();
      if (configResult.success) {
        setDbConfig(configResult.config);
      }

      const statsResult = await window.electronAPI.getTodayStats();
      if (statsResult.success) {
        setTodayStats(statsResult.stats);
      }
    } catch (error) {
      console.error('Error loading app info:', error);
    }
  };

  const loadSyncStatus = useCallback(async () => {
    try {
      const result = await window.electronAPI.getSyncStatus();
      if (result.success) {
        setSyncStatus(result.status);
      }
      
      const serverResult = await window.electronAPI.getSyncServer();
      if (serverResult.success && serverResult.serverUrl) {
        setSyncServerUrl(serverResult.serverUrl);
      }
    } catch (error) {
      console.error('Error loading sync status:', error);
    }
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  const handleSetupSync = async () => {
    setSyncError('');
    setSyncSuccess('');
    
    if (!syncServerUrl) {
      setSyncError('Please enter the cloud server URL');
      return;
    }
    
    // Save server URL
    const serverResult = await window.electronAPI.setSyncServer(syncServerUrl);
    if (!serverResult.success) {
      setSyncError(serverResult.error || 'Failed to save server URL');
      return;
    }
    
    // Authenticate if credentials provided
    if (syncEmail && syncPassword) {
      const authResult = await window.electronAPI.syncAuthenticate({
        email: syncEmail,
        password: syncPassword,
      });
      
      if (!authResult.success) {
        setSyncError(authResult.error || 'Authentication failed');
        return;
      }
      
      setSyncSuccess('Cloud sync configured and authenticated!');
      setSyncPassword('');
    } else {
      setSyncSuccess('Server URL saved. Enter credentials to authenticate.');
    }
    
    await loadSyncStatus();
  };

  const handleSyncDownload = async () => {
    setSyncError('');
    setSyncSuccess('');
    
    if (!syncStatus.isAuthenticated) {
      setSyncError('Please authenticate with the cloud server first');
      setShowSyncModal(true);
      return;
    }
    
    const result = await window.electronAPI.syncDownload();
    
    if (result.success) {
      setSyncSuccess(`Sync completed! Downloaded: ${result.stats.medicines} medicines, ${result.stats.customers} customers, ${result.stats.suppliers} suppliers`);
      await loadSyncStatus();
      await loadAppInfo(); // Refresh stats
    } else {
      setSyncError(result.error || 'Sync failed');
    }
  };

  const handleForceFullSync = async () => {
    setSyncError('');
    setSyncSuccess('');
    
    if (!syncStatus.isAuthenticated) {
      setSyncError('Please authenticate with the cloud server first');
      setShowSyncModal(true);
      return;
    }
    
    // First reset the sync state
    const resetResult = await window.electronAPI.syncReset();
    if (!resetResult.success) {
      setSyncError(resetResult.error || 'Failed to reset sync state');
      return;
    }
    
    // Now do a full download
    const result = await window.electronAPI.syncDownload();
    
    if (result.success) {
      setSyncSuccess(`Full sync completed! Downloaded: ${result.stats.medicines} medicines, ${result.stats.customers} customers, ${result.stats.suppliers} suppliers`);
      await loadSyncStatus();
      await loadAppInfo(); // Refresh stats
    } else {
      setSyncError(result.error || 'Sync failed');
    }
  };

  const handleSyncUpload = async () => {
    setSyncError('');
    setSyncSuccess('');
    
    if (!syncStatus.isAuthenticated) {
      setSyncError('Please authenticate with the cloud server first');
      setShowSyncModal(true);
      return;
    }
    
    const result = await window.electronAPI.syncUpload();
    
    if (result.success) {
      setSyncSuccess(`Upload completed! Synced ${result.results.salesSynced} sales, ${result.results.customersSynced} customers`);
      await loadSyncStatus();
    } else {
      setSyncError(result.error || 'Upload failed');
    }
  };

  const formatLastSync = (timestamp: string | null): string => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="bg-emerald-100 w-10 h-10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <span className="ml-3 text-xl font-bold text-gray-900">DawaCare POS</span>
              {appVersion && (
                <span className="ml-2 text-sm text-gray-500">v{appVersion}</span>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {/* Sync Status Indicator */}
              <button
                onClick={() => setShowSyncModal(true)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  syncStatus.isAuthenticated
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
                <span>{syncStatus.isAuthenticated ? 'Cloud Connected' : 'Setup Cloud Sync'}</span>
              </button>
              
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.name || user?.email}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role.toLowerCase()}</p>
              </div>
              <button
                onClick={handleLogout}
                className="btn btn-secondary text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success/Error Messages */}
        {syncSuccess && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{syncSuccess}</span>
            <button onClick={() => setSyncSuccess('')} className="text-emerald-600 hover:text-emerald-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        {syncError && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{syncError}</span>
            <button onClick={() => setSyncError('')} className="text-red-600 hover:text-red-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Sync Progress Bar */}
        {syncProgress && (
          <div className="mb-6 bg-white border border-emerald-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-emerald-700">Syncing: {syncProgress.stage}</span>
              <span className="text-sm text-emerald-600">{syncProgress.progress}%</span>
            </div>
            <div className="w-full bg-emerald-100 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${syncProgress.progress}%` }}
              ></div>
            </div>
          </div>
        )}

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome to DawaCare POS Desktop Application</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Today's Revenue</p>
                <p className="text-2xl font-bold text-gray-900">KES {todayStats.totalRevenue.toLocaleString()}</p>
              </div>
              <div className="bg-emerald-100 p-3 rounded-full">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Today's Sales</p>
                <p className="text-2xl font-bold text-gray-900">{todayStats.salesCount}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Last Sync</p>
                <p className="text-lg font-bold text-gray-900">{formatLastSync(syncStatus.lastSyncAt)}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pending Sync</p>
                <p className="text-2xl font-bold text-gray-900">{syncStatus.pendingChanges}</p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-full">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button 
              onClick={() => navigate('/pos')}
              className="flex flex-col items-center p-6 border-2 border-emerald-500 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-all"
            >
              <svg className="w-8 h-8 text-emerald-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-sm font-medium text-emerald-700">Open POS</span>
            </button>

            <button 
              onClick={handleSyncDownload}
              disabled={syncStatus.isSyncing || !syncStatus.isAuthenticated}
              className={`flex flex-col items-center p-6 border-2 rounded-lg transition-all ${
                syncStatus.isAuthenticated && !syncStatus.isSyncing
                  ? 'border-blue-500 bg-blue-50 hover:bg-blue-100'
                  : 'border-gray-200 opacity-50 cursor-not-allowed'
              }`}
            >
              <svg className={`w-8 h-8 mb-2 ${syncStatus.isAuthenticated ? 'text-blue-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className={`text-sm font-medium ${syncStatus.isAuthenticated ? 'text-blue-700' : 'text-gray-400'}`}>
                {syncStatus.isSyncing ? 'Syncing...' : 'Download Data'}
              </span>
            </button>

            <button 
              onClick={handleForceFullSync}
              disabled={syncStatus.isSyncing || !syncStatus.isAuthenticated}
              className={`flex flex-col items-center p-6 border-2 rounded-lg transition-all ${
                syncStatus.isAuthenticated && !syncStatus.isSyncing
                  ? 'border-orange-500 bg-orange-50 hover:bg-orange-100'
                  : 'border-gray-200 opacity-50 cursor-not-allowed'
              }`}
            >
              <svg className={`w-8 h-8 mb-2 ${syncStatus.isAuthenticated ? 'text-orange-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className={`text-sm font-medium ${syncStatus.isAuthenticated ? 'text-orange-700' : 'text-gray-400'}`}>
                {syncStatus.isSyncing ? 'Syncing...' : 'Force Full Sync'}
              </span>
            </button>

            <button 
              onClick={handleSyncUpload}
              disabled={syncStatus.isSyncing || !syncStatus.isAuthenticated || syncStatus.pendingChanges === 0}
              className={`flex flex-col items-center p-6 border-2 rounded-lg transition-all ${
                syncStatus.isAuthenticated && !syncStatus.isSyncing && syncStatus.pendingChanges > 0
                  ? 'border-purple-500 bg-purple-50 hover:bg-purple-100'
                  : 'border-gray-200 opacity-50 cursor-not-allowed'
              }`}
            >
              <svg className={`w-8 h-8 mb-2 ${syncStatus.isAuthenticated && syncStatus.pendingChanges > 0 ? 'text-purple-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span className={`text-sm font-medium ${syncStatus.isAuthenticated && syncStatus.pendingChanges > 0 ? 'text-purple-700' : 'text-gray-400'}`}>
                Upload Changes ({syncStatus.pendingChanges})
              </span>
            </button>

            <button className="flex flex-col items-center p-6 border-2 border-gray-200 rounded-lg hover:border-emerald-300 hover:bg-emerald-50/50 transition-all opacity-50 cursor-not-allowed">
              <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-sm font-medium text-gray-400">Reports</span>
              <span className="text-xs text-gray-400 mt-1">(Coming Soon)</span>
            </button>
          </div>
        </div>

        {/* System Info */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">System Information</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Database Type:</span>
              <span className="font-medium text-gray-900 uppercase">{dbConfig?.type || 'Unknown'}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Status:</span>
              <span className="flex items-center text-emerald-600 font-medium">
                <span className="w-2 h-2 bg-emerald-600 rounded-full mr-2"></span>
                Online - Offline Ready
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Branch:</span>
              <span className="font-medium text-gray-900">{user?.branch?.name || 'Main Branch'}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-600">Cloud Sync:</span>
              <span className={`font-medium ${syncStatus.isAuthenticated ? 'text-emerald-600' : 'text-gray-500'}`}>
                {syncStatus.isAuthenticated ? 'Connected' : 'Not Configured'}
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Sync Configuration Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="bg-emerald-600 px-6 py-4">
              <h3 className="text-lg font-bold text-white">Cloud Sync Configuration</h3>
              <p className="text-emerald-100 text-sm">Connect to DawaCare Cloud for data synchronization</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Server URL</label>
                <input
                  type="url"
                  value={syncServerUrl}
                  onChange={(e) => setSyncServerUrl(e.target.value)}
                  placeholder="https://dawacare.abacusai.app"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <p className="text-xs text-gray-500 mt-1">The URL of your DawaCare cloud instance</p>
              </div>
              
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Authentication</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Email</label>
                    <input
                      type="email"
                      value={syncEmail}
                      onChange={(e) => setSyncEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Password</label>
                    <input
                      type="password"
                      value={syncPassword}
                      onChange={(e) => setSyncPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
              
              {syncStatus.isAuthenticated && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <p className="text-sm text-emerald-700 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Connected to cloud server
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">Last sync: {formatLastSync(syncStatus.lastSyncAt)}</p>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
              <button
                onClick={() => setShowSyncModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSetupSync}
                className="px-4 py-2 text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
              >
                {syncStatus.isAuthenticated ? 'Update Configuration' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
