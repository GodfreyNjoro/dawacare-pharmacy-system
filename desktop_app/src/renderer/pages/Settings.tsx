import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Database,
  Server,
  HardDrive,
  Cloud,
  RefreshCw,
  Save,
  AlertTriangle,
  CheckCircle,
  Settings as SettingsIcon,
  Info,
  Download,
  RotateCcw,
  Upload,
  Sparkles,
} from 'lucide-react';
import { Button, Input, Card, CardContent, CardHeader, Badge } from '../components/ui';
import { useAuth } from '../lib/auth-context';
import { useNavigate } from 'react-router-dom';

type DatabaseType = 'sqlite' | 'postgresql';

interface PostgresConfig {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
}

interface SyncConfig {
  cloudUrl: string;
  branchCode: string;
}

interface SyncProgress {
  stage: string;
  progress: number;
}

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  // Database state
  const [currentDbType, setCurrentDbType] = useState<DatabaseType>('sqlite');
  const [newDbType, setNewDbType] = useState<DatabaseType>('sqlite');
  const [postgresConfig, setPostgresConfig] = useState<PostgresConfig>({
    host: 'localhost',
    port: '5432',
    database: 'dawacare',
    username: 'postgres',
    password: '',
  });
  
  // Sync state
  const [syncConfig, setSyncConfig] = useState<SyncConfig>({
    cloudUrl: 'https://dawacare.abacusai.app',
    branchCode: '',
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  
  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showRestartWarning, setShowRestartWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Update check state (admin only)
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateCheckResult, setUpdateCheckResult] = useState<{ status: string; message: string } | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  
  // Check if user is admin
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    loadCurrentConfig();
    
    // Get current version
    window.electronAPI.getVersionInfo().then((info) => {
      setCurrentVersion(info.version);
    });
    
    // Listen for sync progress updates
    const unsubscribe = window.electronAPI.onSyncProgress?.((data: SyncProgress) => {
      setSyncProgress(data);
      if (data.progress === 100) {
        setTimeout(() => setSyncProgress(null), 2000);
      }
    });
    
    // Listen for update status changes
    const unsubscribeUpdate = window.electronAPI.onUpdateStatus?.((data: { status: string; data?: any }) => {
      setIsCheckingUpdate(false);
      if (data.status === 'available') {
        setUpdateCheckResult({ 
          status: 'available', 
          message: `Update available: v${data.data?.version}` 
        });
      } else if (data.status === 'not-available') {
        setUpdateCheckResult({ 
          status: 'not-available', 
          message: 'You are running the latest version!' 
        });
      } else if (data.status === 'error') {
        setUpdateCheckResult({ 
          status: 'error', 
          message: data.data?.message || 'Failed to check for updates' 
        });
      }
    });
    
    return () => {
      unsubscribe?.();
      unsubscribeUpdate?.();
    };
  }, []);

  const loadCurrentConfig = async () => {
    try {
      setIsLoading(true);
      const result = await window.electronAPI.getDbConfig();
      if (result.success && result.config) {
        const dbType = result.config.type === 'postgresql' ? 'postgresql' : 'sqlite';
        setCurrentDbType(dbType);
        setNewDbType(dbType);
        
        // Load postgres config if available
        if (result.config.type === 'postgresql' && result.config.connectionString) {
          try {
            const url = new URL(result.config.connectionString.replace('postgresql://', 'http://'));
            setPostgresConfig({
              host: url.hostname || 'localhost',
              port: url.port || '5432',
              database: url.pathname.slice(1) || 'dawacare',
              username: url.username || 'postgres',
              password: url.password || '',
            });
          } catch {
            // Keep defaults
          }
        }
      }
      
      // Load sync config
      const syncResult = await window.electronAPI.getSyncConfig();
      if (syncResult.success && syncResult.config) {
        setSyncConfig({
          cloudUrl: syncResult.config.cloudUrl || 'https://dawacare.abacusai.app',
          branchCode: syncResult.config.branchCode || '',
        });
      }
      
      // Check sync authentication status
      const statusResult = await window.electronAPI.getSyncStatus();
      if (statusResult.success) {
        setIsAuthenticated(statusResult.status?.isAuthenticated || false);
      }
    } catch (err) {
      console.error('Error loading config:', err);
      setError('Failed to load current configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncDownload = async () => {
    setError(null);
    setSuccessMessage(null);
    
    if (!isAuthenticated) {
      setError('Please set up cloud sync from the Dashboard first');
      return;
    }
    
    setIsSyncing(true);
    try {
      const result = await window.electronAPI.syncDownload();
      
      if (result.success) {
        setSuccessMessage(`Download completed! Synced: ${result.stats?.medicines || 0} medicines, ${result.stats?.customers || 0} customers, ${result.stats?.suppliers || 0} suppliers`);
      } else {
        setError(result.error || 'Download failed');
      }
    } catch (err: any) {
      setError(err.message || 'Download failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleForceFullSync = async () => {
    setError(null);
    setSuccessMessage(null);
    
    if (!isAuthenticated) {
      setError('Please set up cloud sync from the Dashboard first');
      return;
    }
    
    setIsSyncing(true);
    try {
      // First reset the sync state
      const resetResult = await window.electronAPI.syncReset();
      if (!resetResult.success) {
        setError(resetResult.error || 'Failed to reset sync state');
        setIsSyncing(false);
        return;
      }
      
      // Now do a full download
      const result = await window.electronAPI.syncDownload();
      
      if (result.success) {
        setSuccessMessage(`Full sync completed! Downloaded: ${result.stats?.medicines || 0} medicines, ${result.stats?.customers || 0} customers, ${result.stats?.suppliers || 0} suppliers`);
      } else {
        setError(result.error || 'Sync failed');
      }
    } catch (err: any) {
      setError(err.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const config = newDbType === 'sqlite' 
        ? { type: 'sqlite' as const }
        : {
            type: 'postgresql' as const,
            connectionString: `postgresql://${postgresConfig.username}:${postgresConfig.password}@${postgresConfig.host}:${postgresConfig.port}/${postgresConfig.database}`,
          };
      
      const result = await window.electronAPI.testDatabaseConnection(config);
      setTestResult({ success: result.success, message: result.message || (result.success ? 'Connection successful!' : 'Connection failed') });
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Connection test failed' });
    } finally {
      setIsTesting(false);
    }
  };

  const saveDbConfig = async () => {
    if (newDbType !== currentDbType) {
      setShowRestartWarning(true);
      return;
    }
    await doSaveConfig();
  };

  const doSaveConfig = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const config = newDbType === 'sqlite' 
        ? { type: 'sqlite' as const }
        : {
            type: 'postgresql' as const,
            connectionString: `postgresql://${postgresConfig.username}:${postgresConfig.password}@${postgresConfig.host}:${postgresConfig.port}/${postgresConfig.database}`,
          };
      
      const result = await window.electronAPI.configureDatabase(config);
      if (result.success) {
        setCurrentDbType(newDbType);
        setSuccessMessage('Database configuration saved successfully!');
        setShowRestartWarning(false);
        
        // If database type changed, suggest restart
        if (newDbType !== currentDbType) {
          setSuccessMessage('Database configuration saved. Please restart the application for changes to take effect.');
        }
      } else {
        setError(result.message || 'Failed to save configuration');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const saveSyncConfig = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const result = await window.electronAPI.saveSyncConfig(syncConfig);
      if (result.success) {
        setSuccessMessage('Sync configuration saved!');
      } else {
        setError(result.message || 'Failed to save sync config');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save sync config');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle manual update check (admin only)
  const handleCheckForUpdates = async () => {
    setIsCheckingUpdate(true);
    setUpdateCheckResult(null);
    try {
      await window.electronAPI.checkForUpdates();
    } catch (err: any) {
      setIsCheckingUpdate(false);
      setUpdateCheckResult({ 
        status: 'error', 
        message: err.message || 'Failed to check for updates' 
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <SettingsIcon className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Settings</h1>
                <p className="text-sm text-gray-500">Configure database and sync options</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Success/Error Messages */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-green-800">{successMessage}</p>
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Database Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold">Database Configuration</h2>
              <Badge variant={currentDbType === 'sqlite' ? 'success' : 'info'}>
                Current: {currentDbType === 'sqlite' ? 'SQLite' : 'PostgreSQL'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Database Type Selection */}
            <div className="grid grid-cols-2 gap-4">
              {/* SQLite Option */}
              <label
                className={`relative flex flex-col p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  newDbType === 'sqlite'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="dbType"
                  value="sqlite"
                  checked={newDbType === 'sqlite'}
                  onChange={() => setNewDbType('sqlite')}
                  className="sr-only"
                />
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    newDbType === 'sqlite' ? 'bg-emerald-100' : 'bg-gray-100'
                  }`}>
                    <HardDrive className={`w-5 h-5 ${newDbType === 'sqlite' ? 'text-emerald-600' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">SQLite (Recommended)</h3>
                    <p className="text-sm text-gray-500">Local file-based database</p>
                  </div>
                </div>
                <ul className="text-sm text-gray-600 space-y-1 ml-13">
                  <li>✓ No setup required</li>
                  <li>✓ Works offline</li>
                  <li>✓ Fast and lightweight</li>
                </ul>
              </label>

              {/* PostgreSQL Option */}
              <label
                className={`relative flex flex-col p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  newDbType === 'postgresql'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="dbType"
                  value="postgresql"
                  checked={newDbType === 'postgresql'}
                  onChange={() => setNewDbType('postgresql')}
                  className="sr-only"
                />
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    newDbType === 'postgresql' ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <Server className={`w-5 h-5 ${newDbType === 'postgresql' ? 'text-blue-600' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">PostgreSQL</h3>
                    <p className="text-sm text-gray-500">External database server</p>
                  </div>
                </div>
                <ul className="text-sm text-gray-600 space-y-1 ml-13">
                  <li>✓ Multi-user support</li>
                  <li>✓ Scalable</li>
                  <li>✓ Advanced features</li>
                </ul>
              </label>
            </div>

            {/* PostgreSQL Configuration */}
            {newDbType === 'postgresql' && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  PostgreSQL Connection Details
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Host</label>
                    <Input
                      value={postgresConfig.host}
                      onChange={(e) => setPostgresConfig({ ...postgresConfig, host: e.target.value })}
                      placeholder="localhost"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                    <Input
                      value={postgresConfig.port}
                      onChange={(e) => setPostgresConfig({ ...postgresConfig, port: e.target.value })}
                      placeholder="5432"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Database</label>
                    <Input
                      value={postgresConfig.database}
                      onChange={(e) => setPostgresConfig({ ...postgresConfig, database: e.target.value })}
                      placeholder="dawacare"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                    <Input
                      value={postgresConfig.username}
                      onChange={(e) => setPostgresConfig({ ...postgresConfig, username: e.target.value })}
                      placeholder="postgres"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <Input
                      type="password"
                      value={postgresConfig.password}
                      onChange={(e) => setPostgresConfig({ ...postgresConfig, password: e.target.value })}
                      placeholder="Enter password"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Test Result */}
            {testResult && (
              <div className={`p-4 rounded-lg flex items-center gap-3 ${
                testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                {testResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                )}
                <span className={testResult.success ? 'text-green-800' : 'text-red-800'}>
                  {testResult.message}
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t">
              <Button variant="outline" onClick={testConnection} disabled={isTesting}>
                {isTesting ? (
                  <><RefreshCw className="w-4 h-4 animate-spin mr-2" /> Testing...</>
                ) : (
                  <><Database className="w-4 h-4 mr-2" /> Test Connection</>
                )}
              </Button>
              <Button variant="primary" onClick={saveDbConfig} disabled={isSaving}>
                {isSaving ? (
                  <><RefreshCw className="w-4 h-4 animate-spin mr-2" /> Saving...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" /> Save Configuration</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Cloud Sync Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold">Cloud Sync Configuration</h2>
              <Badge variant={isAuthenticated ? 'success' : 'secondary'}>
                {isAuthenticated ? 'Connected' : 'Not Connected'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <p className="text-sm text-blue-800">
                Configure cloud sync to synchronize data with the DawaCare web application.
                This allows you to work offline and sync changes when connected.
              </p>
            </div>
            
            {/* Sync Progress Bar */}
            {syncProgress && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
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
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cloud Server URL</label>
                <Input
                  value={syncConfig.cloudUrl}
                  onChange={(e) => setSyncConfig({ ...syncConfig, cloudUrl: e.target.value })}
                  placeholder="https://dawacare.abacusai.app"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch Code</label>
                <Input
                  value={syncConfig.branchCode}
                  onChange={(e) => setSyncConfig({ ...syncConfig, branchCode: e.target.value })}
                  placeholder="e.g., MAIN, BR001"
                />
                <p className="text-xs text-gray-500 mt-1">The branch code identifies this POS terminal in the cloud system</p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t">
              <Button variant="primary" onClick={saveSyncConfig} disabled={isSaving}>
                {isSaving ? (
                  <><RefreshCw className="w-4 h-4 animate-spin mr-2" /> Saving...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" /> Save Sync Settings</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Data Sync Operations */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Download className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-semibold">Data Sync Operations</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isAuthenticated && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                <p className="text-sm text-amber-800">
                  Please set up and authenticate cloud sync from the Dashboard before using these operations.
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              {/* Download Data */}
              <div className="border rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Download className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Download Data</h3>
                    <p className="text-sm text-gray-500">Sync new data from cloud</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  Downloads only new or updated data from the cloud since your last sync.
                </p>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={handleSyncDownload}
                  disabled={isSyncing || !isAuthenticated}
                >
                  {isSyncing ? (
                    <><RefreshCw className="w-4 h-4 animate-spin mr-2" /> Syncing...</>
                  ) : (
                    <><Download className="w-4 h-4 mr-2" /> Download Data</>
                  )}
                </Button>
              </div>

              {/* Force Full Sync */}
              <div className="border rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <RotateCcw className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Force Full Sync</h3>
                    <p className="text-sm text-gray-500">Re-download all data</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  Clears local sync state and downloads all data from scratch. Use if data seems incomplete.
                </p>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={handleForceFullSync}
                  disabled={isSyncing || !isAuthenticated}
                >
                  {isSyncing ? (
                    <><RefreshCw className="w-4 h-4 animate-spin mr-2" /> Syncing...</>
                  ) : (
                    <><RotateCcw className="w-4 h-4 mr-2" /> Force Full Sync</>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* App Updates Section - Admin Only */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-semibold">App Updates</h2>
                <Badge variant="info">Admin Only</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-purple-600 mt-0.5" />
                <div>
                  <p className="text-sm text-purple-800">
                    Check for new versions of DawaCare POS. Updates include bug fixes, new features, and security improvements.
                  </p>
                  <p className="text-sm text-purple-600 mt-1 font-medium">
                    Current version: v{currentVersion}
                  </p>
                </div>
              </div>
              
              {/* Update Check Result */}
              {updateCheckResult && (
                <div className={`p-4 rounded-lg flex items-center gap-3 ${
                  updateCheckResult.status === 'available' 
                    ? 'bg-emerald-50 border border-emerald-200'
                    : updateCheckResult.status === 'not-available'
                    ? 'bg-blue-50 border border-blue-200'
                    : 'bg-red-50 border border-red-200'
                }`}>
                  {updateCheckResult.status === 'available' ? (
                    <Sparkles className="w-5 h-5 text-emerald-600" />
                  ) : updateCheckResult.status === 'not-available' ? (
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  )}
                  <span className={
                    updateCheckResult.status === 'available' 
                      ? 'text-emerald-800'
                      : updateCheckResult.status === 'not-available'
                      ? 'text-blue-800'
                      : 'text-red-800'
                  }>
                    {updateCheckResult.message}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-4 border-t">
                <Button 
                  variant="primary" 
                  onClick={handleCheckForUpdates} 
                  disabled={isCheckingUpdate}
                >
                  {isCheckingUpdate ? (
                    <><RefreshCw className="w-4 h-4 animate-spin mr-2" /> Checking...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> Check for Updates</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Restart Warning Modal */}
        {showRestartWarning && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Database Change Warning</h3>
                  <p className="text-sm text-gray-500">This action requires attention</p>
                </div>
              </div>
              <p className="text-gray-600 mb-6">
                Changing the database type will require a restart of the application. 
                Any unsaved data may be lost. Are you sure you want to continue?
              </p>
              <div className="flex items-center justify-end gap-3">
                <Button variant="outline" onClick={() => setShowRestartWarning(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={doSaveConfig}>
                  Continue & Save
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
