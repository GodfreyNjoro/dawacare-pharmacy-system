import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import SetupWizard from './pages/SetupWizard';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import SalesHistory from './pages/SalesHistory';
import Invoice from './pages/Invoice';
import Customers from './pages/Customers';
import MedicineForm from './pages/MedicineForm';
import Suppliers from './pages/Suppliers';
import PurchaseOrders from './pages/PurchaseOrders';
import NewPurchaseOrder from './pages/NewPurchaseOrder';
import PurchaseOrderView from './pages/PurchaseOrderView';
import GRNList from './pages/GRNList';
import NewGRN from './pages/NewGRN';
import Users from './pages/Users';
import Branches from './pages/Branches';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import ControlledSubstances from './pages/ControlledSubstances';
import AuditLogs from './pages/AuditLogs';
import UpdateNotification from './components/UpdateNotification';
import AIPharmacistChat from './components/AIPharmacistChat';
import { AuthProvider, useAuth } from './lib/auth-context';
import { hasPermission } from './lib/permissions';

// Permission-protected route component
function ProtectedRoute({ 
  element, 
  permission, 
  role 
}: { 
  element: React.ReactElement; 
  permission: string; 
  role: string | undefined;
}) {
  if (!hasPermission(role, permission as any)) {
    return <Navigate to="/pos" replace />;
  }
  return element;
}

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
  const userRole = user?.role;
  
  return (
    <Routes>
      {/* Core Routes - All Roles */}
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/pos" element={<POS />} />
      <Route path="/sales" element={<SalesHistory />} />
      <Route path="/invoice/:id" element={<Invoice />} />
      <Route path="/customers" element={<Customers />} />
      
      {/* Inventory - Admin & Pharmacist Only */}
      <Route path="/inventory" element={
        <ProtectedRoute element={<Inventory />} permission="VIEW_INVENTORY" role={userRole} />
      } />
      <Route path="/inventory/add" element={
        <ProtectedRoute element={<MedicineForm />} permission="ADD_MEDICINE" role={userRole} />
      } />
      <Route path="/inventory/edit/:id" element={
        <ProtectedRoute element={<MedicineForm />} permission="EDIT_MEDICINE" role={userRole} />
      } />
      
      {/* Controlled Substances - Admin & Pharmacist Only (Kenya Poisons Act) */}
      <Route path="/controlled-substances" element={
        <ProtectedRoute element={<ControlledSubstances />} permission="VIEW_CONTROLLED_SUBSTANCES" role={userRole} />
      } />
      
      {/* Procurement Routes - Admin & Pharmacist Only */}
      <Route path="/procurement/suppliers" element={
        <ProtectedRoute element={<Suppliers />} permission="VIEW_SUPPLIERS" role={userRole} />
      } />
      <Route path="/procurement/purchase-orders" element={
        <ProtectedRoute element={<PurchaseOrders />} permission="VIEW_PURCHASE_ORDERS" role={userRole} />
      } />
      <Route path="/procurement/purchase-orders/new" element={
        <ProtectedRoute element={<NewPurchaseOrder />} permission="CREATE_PURCHASE_ORDER" role={userRole} />
      } />
      <Route path="/procurement/purchase-orders/:id" element={
        <ProtectedRoute element={<PurchaseOrderView />} permission="VIEW_PURCHASE_ORDERS" role={userRole} />
      } />
      <Route path="/procurement/grn" element={
        <ProtectedRoute element={<GRNList />} permission="VIEW_GRN" role={userRole} />
      } />
      <Route path="/procurement/grn/new" element={
        <ProtectedRoute element={<NewGRN />} permission="CREATE_GRN" role={userRole} />
      } />
      
      {/* Admin Routes - Admin Only */}
      <Route path="/admin/users" element={
        <ProtectedRoute element={<Users />} permission="VIEW_USERS" role={userRole} />
      } />
      <Route path="/admin/branches" element={
        <ProtectedRoute element={<Branches />} permission="VIEW_BRANCHES" role={userRole} />
      } />
      <Route path="/admin/reports" element={
        <ProtectedRoute element={<Reports />} permission="VIEW_REPORTS" role={userRole} />
      } />
      <Route path="/admin/settings" element={
        <ProtectedRoute element={<Settings />} permission="VIEW_SETTINGS" role={userRole} />
      } />
      <Route path="/admin/audit-logs" element={
        <ProtectedRoute element={<AuditLogs />} permission="VIEW_AUDIT_LOGS" role={userRole} />
      } />
      
      <Route path="*" element={<Navigate to="/pos" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
      <UpdateNotification />
      <AIPharmacistChat />
    </AuthProvider>
  );
}

export default App;
