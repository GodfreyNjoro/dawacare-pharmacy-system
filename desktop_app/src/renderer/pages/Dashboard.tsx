import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { hasPermission } from '../lib/permissions';

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
              <img src={new URL('../assets/logo.png', import.meta.url).href} alt="DawaCare Logo" className="w-10 h-10" />
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

            {/* Inventory - Admin & Pharmacist only */}
            {hasPermission(user?.role, 'VIEW_INVENTORY') && (
              <button 
                onClick={() => navigate('/inventory')}
                className="flex flex-col items-center p-6 border-2 border-cyan-500 bg-cyan-50 rounded-lg hover:bg-cyan-100 transition-all"
              >
                <svg className="w-8 h-8 text-cyan-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <span className="text-sm font-medium text-cyan-700">Inventory</span>
              </button>
            )}

            <button 
              onClick={() => navigate('/sales')}
              className="flex flex-col items-center p-6 border-2 border-indigo-500 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-all"
            >
              <svg className="w-8 h-8 text-indigo-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              <span className="text-sm font-medium text-indigo-700">Sales History</span>
            </button>

            <button 
              onClick={() => navigate('/customers')}
              className="flex flex-col items-center p-6 border-2 border-pink-500 bg-pink-50 rounded-lg hover:bg-pink-100 transition-all"
            >
              <svg className="w-8 h-8 text-pink-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="text-sm font-medium text-pink-700">Customers</span>
            </button>

            {/* Reports - Admin & Pharmacist only */}
            {hasPermission(user?.role, 'VIEW_REPORTS') && (
              <button 
                onClick={() => navigate('/admin/reports')}
                className="flex flex-col items-center p-6 border-2 border-sky-500 bg-sky-50 rounded-lg hover:bg-sky-100 transition-all"
              >
                <svg className="w-8 h-8 text-sky-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="text-sm font-medium text-sky-700">Reports</span>
              </button>
            )}

            {/* Controlled Substances - Admin & Pharmacist only */}
            {hasPermission(user?.role, 'VIEW_CONTROLLED_SUBSTANCES') && (
              <button 
                onClick={() => navigate('/controlled-substances')}
                className="flex flex-col items-center p-6 border-2 border-purple-500 bg-purple-50 rounded-lg hover:bg-purple-100 transition-all"
              >
                <svg className="w-8 h-8 text-purple-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="text-sm font-medium text-purple-700">Controlled</span>
              </button>
            )}
          </div>
        </div>

        {/* Procurement Section - Admin & Pharmacist only */}
        {hasPermission(user?.role, 'VIEW_SUPPLIERS') && (
          <div className="card mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Procurement</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <button 
                onClick={() => navigate('/procurement/suppliers')}
                className="flex flex-col items-center p-6 border-2 border-teal-500 bg-teal-50 rounded-lg hover:bg-teal-100 transition-all"
              >
                <svg className="w-8 h-8 text-teal-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="text-sm font-medium text-teal-700">Suppliers</span>
              </button>

              <button 
                onClick={() => navigate('/procurement/purchase-orders')}
                className="flex flex-col items-center p-6 border-2 border-amber-500 bg-amber-50 rounded-lg hover:bg-amber-100 transition-all"
              >
                <svg className="w-8 h-8 text-amber-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm font-medium text-amber-700">Purchase Orders</span>
              </button>

              <button 
                onClick={() => navigate('/procurement/grn')}
                className="flex flex-col items-center p-6 border-2 border-lime-500 bg-lime-50 rounded-lg hover:bg-lime-100 transition-all"
              >
                <svg className="w-8 h-8 text-lime-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span className="text-sm font-medium text-lime-700">Goods Received</span>
              </button>
            </div>
          </div>
        )}

        {/* Admin Section - Admin only */}
        {hasPermission(user?.role, 'VIEW_USERS') && (
          <div className="card mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Administration</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <button 
                onClick={() => navigate('/admin/users')}
                className="flex flex-col items-center p-6 border-2 border-violet-500 bg-violet-50 rounded-lg hover:bg-violet-100 transition-all"
              >
                <svg className="w-8 h-8 text-violet-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span className="text-sm font-medium text-violet-700">Users</span>
              </button>

              <button 
                onClick={() => navigate('/admin/branches')}
                className="flex flex-col items-center p-6 border-2 border-rose-500 bg-rose-50 rounded-lg hover:bg-rose-100 transition-all"
              >
                <svg className="w-8 h-8 text-rose-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="text-sm font-medium text-rose-700">Branches</span>
              </button>

              <button 
                onClick={() => navigate('/admin/settings')}
                className="flex flex-col items-center p-6 border-2 border-gray-500 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all"
              >
                <svg className="w-8 h-8 text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Settings</span>
              </button>
            </div>
          </div>
        )}

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
              <span className="font-medium text-gray-900">{user?.branchId ? `Branch ${user.branchId.slice(0,8)}` : 'Main Branch'}</span>
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
