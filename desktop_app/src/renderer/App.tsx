import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import SetupWizard from './pages/SetupWizard';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import { AuthProvider, useAuth } from './lib/auth-context';

function AppContent() {
  const [dbConfigured, setDbConfigured] = useState<boolean | null>(null);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    checkDatabaseConfig();
  }, []);

  const checkDatabaseConfig = async () => {
    try {
      console.log('[App] Checking database configuration...');
      const result = await window.electronAPI.getDbConfig();
      console.log('[App] Database config result:', result);
      // Only consider configured if database is actually initialized and connected
      const isConfigured = result.success && result.config !== null && result.isInitialized;
      console.log('[App] Database configured:', isConfigured);
      setDbConfigured(isConfigured);
    } catch (error) {
      console.error('[App] Error checking database config:', error);
      setDbConfigured(false);
    }
  };

  // Show loading state
  if (dbConfigured === null || authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-blue-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading DawaCare POS...</p>
        </div>
      </div>
    );
  }

  // Show setup wizard if database not configured
  if (!dbConfigured) {
    return (
      <Routes>
        <Route path="/setup" element={<SetupWizard onComplete={() => setDbConfigured(true)} />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    );
  }

  // Show login if not authenticated
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Show main app if authenticated
  return (
    <Routes>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/pos" element={<POS />} />
      <Route path="*" element={<Navigate to="/pos" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
