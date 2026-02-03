import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  AlertTriangle,
  Package,
  FileText,
  Plus,
  Search,
  Filter,
  RefreshCw,
  ArrowLeft,
  CheckCircle,
  Clock,
  Eye,
  ChevronDown,
  ChevronUp,
  Pill,
  Calendar,
} from 'lucide-react';
import { Button, Input, Card, CardContent, Badge, Modal } from '../components/ui';
import { useAuth } from '../lib/auth-context';
import { hasPermission } from '../lib/permissions';

// Schedule class colors
const SCHEDULE_COLORS: Record<string, string> = {
  SCHEDULE_I: 'bg-red-100 text-red-800',
  SCHEDULE_II: 'bg-orange-100 text-orange-800',
  SCHEDULE_III: 'bg-yellow-100 text-yellow-800',
  SCHEDULE_IV: 'bg-blue-100 text-blue-800',
  SCHEDULE_V: 'bg-green-100 text-green-800',
  PSYCHOTROPIC: 'bg-purple-100 text-purple-800',
};

// Transaction type colors
const TRANSACTION_COLORS: Record<string, string> = {
  RECEIPT: 'bg-green-100 text-green-800',
  SALE: 'bg-blue-100 text-blue-800',
  TRANSFER_IN: 'bg-cyan-100 text-cyan-800',
  TRANSFER_OUT: 'bg-amber-100 text-amber-800',
  ADJUSTMENT: 'bg-gray-100 text-gray-800',
  DESTRUCTION: 'bg-red-100 text-red-800',
  RETURN: 'bg-purple-100 text-purple-800',
};

interface DashboardStats {
  totalControlled: number;
  totalQuantity: number;
  recentTransactions: number;
  pendingVerifications: number;
  lowStockControlled: number;
  bySchedule: Array<{
    scheduleClass: string;
    count: number;
    quantity: number;
  }>;
}

interface RegisterEntry {
  id: string;
  entryNumber: string;
  medicineName: string;
  genericName: string | null;
  batchNumber: string;
  scheduleClass: string;
  transactionType: string;
  quantityIn: number;
  quantityOut: number;
  balanceBefore: number;
  balanceAfter: number;
  patientName: string | null;
  prescriberName: string | null;
  supplierName: string | null;
  recordedBy: string;
  recordedByName: string;
  verifiedByName: string | null;
  verifiedAt: string | null;
  transactionDate: string;
  notes: string | null;
  medicine: {
    id: string;
    name: string;
    quantity: number;
  };
}

interface ControlledMedicine {
  id: string;
  name: string;
  genericName: string | null;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  scheduleClass: string | null;
  isControlled: boolean;
}

export default function ControlledSubstances() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'register' | 'medicines'>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [registerEntries, setRegisterEntries] = useState<RegisterEntry[]>([]);
  const [controlledMedicines, setControlledMedicines] = useState<ControlledMedicine[]>([]);
  const [modalMedicines, setModalMedicines] = useState<ControlledMedicine[]>([]); // For modal dropdown
  const [searchQuery, setSearchQuery] = useState('');
  const [scheduleFilter, setScheduleFilter] = useState('all');
  const [transactionFilter, setTransactionFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // New Entry Modal
  const [showNewEntryModal, setShowNewEntryModal] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<ControlledMedicine | null>(null);
  const [isLoadingModalMedicines, setIsLoadingModalMedicines] = useState(false);
  const [entryForm, setEntryForm] = useState({
    transactionType: 'SALE',
    quantityOut: 0,
    quantityIn: 0,
    patientName: '',
    patientId: '',
    prescriberName: '',
    prescriberRegNo: '',
    supplierName: '',
    supplierLicense: '',
    witnessName: '',
    witnessRole: '',
    destructionMethod: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [entryError, setEntryError] = useState('');

  // Fetch Dashboard Stats
  const fetchDashboard = useCallback(async () => {
    try {
      const result = await window.electronAPI.getControlledDashboard();
      if (result.success) {
        setDashboardStats(result.stats);
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    }
  }, []);

  // Fetch Register Entries
  const fetchRegister = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.getControlledRegister({
        page: currentPage,
        limit: 20,
        search: searchQuery,
        scheduleClass: scheduleFilter,
        transactionType: transactionFilter,
      });
      if (result.success) {
        setRegisterEntries(result.entries);
        setTotalPages(result.totalPages);
      }
    } catch (error) {
      console.error('Error fetching register:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchQuery, scheduleFilter, transactionFilter]);

  // Fetch Controlled Medicines
  const fetchMedicines = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.getControlledMedicines({
        page: currentPage,
        limit: 20,
        search: searchQuery,
        scheduleClass: scheduleFilter,
      });
      if (result.success) {
        setControlledMedicines(result.medicines);
        setTotalPages(result.totalPages);
      }
    } catch (error) {
      console.error('Error fetching medicines:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchQuery, scheduleFilter]);

  // Fetch all controlled medicines for modal dropdown
  const fetchModalMedicines = useCallback(async () => {
    setIsLoadingModalMedicines(true);
    try {
      const result = await window.electronAPI.getControlledMedicines({
        page: 1,
        limit: 1000, // Get all controlled medicines for dropdown
        search: '',
        scheduleClass: 'all',
      });
      if (result.success) {
        setModalMedicines(result.medicines);
      }
    } catch (error) {
      console.error('Error fetching modal medicines:', error);
    } finally {
      setIsLoadingModalMedicines(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (activeTab === 'register') {
      fetchRegister();
    } else if (activeTab === 'medicines') {
      fetchMedicines();
    }
  }, [activeTab, fetchRegister, fetchMedicines]);

  // Fetch medicines when modal opens
  useEffect(() => {
    if (showNewEntryModal && modalMedicines.length === 0) {
      fetchModalMedicines();
    }
  }, [showNewEntryModal, modalMedicines.length, fetchModalMedicines]);

  const handleNewEntry = async () => {
    if (!selectedMedicine) {
      setEntryError('Please select a medicine');
      return;
    }

    setIsSubmitting(true);
    setEntryError('');

    try {
      const result = await window.electronAPI.createControlledEntry({
        medicineId: selectedMedicine.id,
        transactionType: entryForm.transactionType,
        quantityIn: entryForm.quantityIn || 0,
        quantityOut: entryForm.quantityOut || 0,
        patientName: entryForm.patientName || undefined,
        patientId: entryForm.patientId || undefined,
        prescriberName: entryForm.prescriberName || undefined,
        prescriberRegNo: entryForm.prescriberRegNo || undefined,
        supplierName: entryForm.supplierName || undefined,
        supplierLicense: entryForm.supplierLicense || undefined,
        witnessName: entryForm.witnessName || undefined,
        witnessRole: entryForm.witnessRole || undefined,
        destructionMethod: entryForm.destructionMethod || undefined,
        notes: entryForm.notes || undefined,
        recordedBy: user?.id || '',
        recordedByName: user?.name || user?.email || '',
        recordedByRole: user?.role || 'PHARMACIST',
      });

      if (result.success) {
        setShowNewEntryModal(false);
        setSelectedMedicine(null);
        setEntryForm({
          transactionType: 'SALE',
          quantityOut: 0,
          quantityIn: 0,
          patientName: '',
          patientId: '',
          prescriberName: '',
          prescriberRegNo: '',
          supplierName: '',
          supplierLicense: '',
          witnessName: '',
          witnessRole: '',
          destructionMethod: '',
          notes: '',
        });
        fetchDashboard();
        if (activeTab === 'register') fetchRegister();
        if (activeTab === 'medicines') fetchMedicines();
      } else {
        setEntryError(result.error || 'Failed to create entry');
      }
    } catch (error: any) {
      setEntryError(error.message || 'Error creating entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyEntry = async (entry: RegisterEntry) => {
    try {
      const result = await window.electronAPI.verifyControlledEntry({
        entryId: entry.id,
        verifiedBy: user?.id || '',
        verifiedByName: user?.name || user?.email || '',
      });

      if (result.success) {
        fetchRegister();
        fetchDashboard();
      }
    } catch (error) {
      console.error('Error verifying entry:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/dashboard')}
                className="mr-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="bg-purple-100 w-10 h-10 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
              <span className="ml-3 text-xl font-bold text-gray-900">Controlled Substances Register</span>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.name || user?.email}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role?.toLowerCase()}</p>
              </div>
              <button onClick={() => logout()} className="btn btn-secondary text-sm">
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'dashboard'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => { setActiveTab('register'); setCurrentPage(1); }}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'register'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Register
            </button>
            <button
              onClick={() => { setActiveTab('medicines'); setCurrentPage(1); }}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'medicines'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Controlled Medicines
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && dashboardStats && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Total Controlled Items</p>
                      <p className="text-2xl font-bold text-gray-900">{dashboardStats.totalControlled}</p>
                    </div>
                    <div className="bg-purple-100 p-3 rounded-full">
                      <Package className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Total Quantity</p>
                      <p className="text-2xl font-bold text-gray-900">{dashboardStats.totalQuantity}</p>
                    </div>
                    <div className="bg-blue-100 p-3 rounded-full">
                      <Pill className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Pending Verification</p>
                      <p className="text-2xl font-bold text-gray-900">{dashboardStats.pendingVerifications}</p>
                    </div>
                    <div className="bg-amber-100 p-3 rounded-full">
                      <Clock className="w-6 h-6 text-amber-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Low Stock Alert</p>
                      <p className="text-2xl font-bold text-red-600">{dashboardStats.lowStockControlled}</p>
                    </div>
                    <div className="bg-red-100 p-3 rounded-full">
                      <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Schedule Breakdown */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Breakdown by Schedule</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {dashboardStats.bySchedule.map((item) => (
                    <div key={item.scheduleClass} className="text-center p-4 rounded-lg bg-gray-50">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mb-2 ${SCHEDULE_COLORS[item.scheduleClass] || 'bg-gray-100 text-gray-800'}`}>
                        {item.scheduleClass?.replace('_', ' ')}
                      </span>
                      <p className="text-2xl font-bold text-gray-900">{item.count}</p>
                      <p className="text-sm text-gray-500">items</p>
                      <p className="text-sm text-gray-600 mt-1">Qty: {item.quantity}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Transactions */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Transactions (Last 30 Days)</h3>
                  <span className="text-2xl font-bold text-purple-600">{dashboardStats.recentTransactions}</span>
                </div>
                <p className="text-gray-600">Entries recorded in the controlled substances register over the past 30 days.</p>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setShowNewEntryModal(true)}
                className="flex items-center justify-center p-6 bg-purple-50 border-2 border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
              >
                <Plus className="w-6 h-6 text-purple-600 mr-2" />
                <span className="text-purple-700 font-medium">New Register Entry</span>
              </button>
              <button
                onClick={() => setActiveTab('register')}
                className="flex items-center justify-center p-6 bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <FileText className="w-6 h-6 text-blue-600 mr-2" />
                <span className="text-blue-700 font-medium">View Full Register</span>
              </button>
              <button
                onClick={() => setActiveTab('medicines')}
                className="flex items-center justify-center p-6 bg-green-50 border-2 border-green-200 rounded-lg hover:bg-green-100 transition-colors"
              >
                <Package className="w-6 h-6 text-green-600 mr-2" />
                <span className="text-green-700 font-medium">Manage Medicines</span>
              </button>
            </div>
          </div>
        )}

        {/* Register Tab */}
        {activeTab === 'register' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search entries..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
              <select
                value={scheduleFilter}
                onChange={(e) => { setScheduleFilter(e.target.value); setCurrentPage(1); }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Schedules</option>
                <option value="SCHEDULE_I">Schedule I</option>
                <option value="SCHEDULE_II">Schedule II</option>
                <option value="SCHEDULE_III">Schedule III</option>
                <option value="SCHEDULE_IV">Schedule IV</option>
                <option value="SCHEDULE_V">Schedule V</option>
                <option value="PSYCHOTROPIC">Psychotropic</option>
              </select>
              <select
                value={transactionFilter}
                onChange={(e) => { setTransactionFilter(e.target.value); setCurrentPage(1); }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Transactions</option>
                <option value="RECEIPT">Receipt</option>
                <option value="SALE">Sale</option>
                <option value="TRANSFER_IN">Transfer In</option>
                <option value="TRANSFER_OUT">Transfer Out</option>
                <option value="ADJUSTMENT">Adjustment</option>
                <option value="DESTRUCTION">Destruction</option>
                <option value="RETURN">Return</option>
              </select>
              <button
                onClick={() => setShowNewEntryModal(true)}
                className="btn btn-primary flex items-center"
              >
                <Plus className="w-5 h-5 mr-2" />
                New Entry
              </button>
            </div>

            {/* Register Table */}
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
                  </div>
                ) : registerEntries.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No register entries found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entry #</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medicine</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Schedule</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">In</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Out</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Balance</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recorded By</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verified</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {registerEntries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-mono text-gray-900">{entry.entryNumber}</td>
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-gray-900">{entry.medicineName}</div>
                              <div className="text-xs text-gray-500">{entry.batchNumber}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${SCHEDULE_COLORS[entry.scheduleClass] || 'bg-gray-100 text-gray-800'}`}>
                                {entry.scheduleClass?.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${TRANSACTION_COLORS[entry.transactionType] || 'bg-gray-100 text-gray-800'}`}>
                                {entry.transactionType}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-green-600 font-medium">
                              {entry.quantityIn > 0 ? `+${entry.quantityIn}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-red-600 font-medium">
                              {entry.quantityOut > 0 ? `-${entry.quantityOut}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-center text-sm font-bold text-gray-900">
                              {entry.balanceAfter}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">{entry.recordedByName}</td>
                            <td className="px-4 py-3">
                              {entry.verifiedByName ? (
                                <span className="flex items-center text-green-600 text-sm">
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  {entry.verifiedByName}
                                </span>
                              ) : (
                                <span className="flex items-center text-amber-600 text-sm">
                                  <Clock className="w-4 h-4 mr-1" />
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {formatDate(entry.transactionDate)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {!entry.verifiedByName && entry.recordedBy !== user?.id && (
                                <button
                                  onClick={() => handleVerifyEntry(entry)}
                                  className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                                >
                                  Verify
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border rounded-lg disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border rounded-lg disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {/* Medicines Tab */}
        {activeTab === 'medicines' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search controlled medicines..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
              <select
                value={scheduleFilter}
                onChange={(e) => { setScheduleFilter(e.target.value); setCurrentPage(1); }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Schedules</option>
                <option value="SCHEDULE_I">Schedule I</option>
                <option value="SCHEDULE_II">Schedule II</option>
                <option value="SCHEDULE_III">Schedule III</option>
                <option value="SCHEDULE_IV">Schedule IV</option>
                <option value="SCHEDULE_V">Schedule V</option>
                <option value="PSYCHOTROPIC">Psychotropic</option>
              </select>
            </div>

            {/* Medicines Grid */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
              </div>
            ) : controlledMedicines.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No controlled medicines found</p>
                <p className="text-sm text-gray-400 mt-2">Mark medicines as controlled in the Inventory page</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {controlledMedicines.map((medicine) => (
                  <Card key={medicine.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900">{medicine.name}</h4>
                          {medicine.genericName && (
                            <p className="text-sm text-gray-500">{medicine.genericName}</p>
                          )}
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${SCHEDULE_COLORS[medicine.scheduleClass || ''] || 'bg-gray-100 text-gray-800'}`}>
                          {medicine.scheduleClass?.replace('_', ' ') || 'Not Set'}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Batch:</span>
                          <span className="font-mono text-gray-900">{medicine.batchNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Quantity:</span>
                          <span className={`font-bold ${medicine.quantity <= 10 ? 'text-red-600' : 'text-gray-900'}`}>
                            {medicine.quantity}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Expiry:</span>
                          <span className="text-gray-900">
                            {new Date(medicine.expiryDate).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedMedicine(medicine);
                          setShowNewEntryModal(true);
                        }}
                        className="mt-4 w-full py-2 px-4 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors text-sm font-medium"
                      >
                        Record Transaction
                      </button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border rounded-lg disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border rounded-lg disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* New Entry Modal */}
      <Modal
        isOpen={showNewEntryModal}
        onClose={() => {
          setShowNewEntryModal(false);
          setSelectedMedicine(null);
          setEntryError('');
        }}
        title="New Controlled Substance Entry"
      >
        <div className="space-y-4">
          {entryError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {entryError}
            </div>
          )}

          {/* Medicine Selection */}
          {!selectedMedicine ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Controlled Medicine</label>
              {isLoadingModalMedicines ? (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="w-5 h-5 text-purple-600 animate-spin mr-2" />
                  <span className="text-gray-500">Loading medicines...</span>
                </div>
              ) : modalMedicines.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  <p>No controlled medicines found.</p>
                  <p className="text-sm mt-1">Please add controlled medicines in the Medicines tab first.</p>
                </div>
              ) : (
                <select
                  onChange={(e) => {
                    const med = modalMedicines.find((m) => m.id === e.target.value);
                    setSelectedMedicine(med || null);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">-- Select a controlled medicine --</option>
                  {modalMedicines.map((med) => (
                    <option key={med.id} value={med.id}>
                      {med.name} - {med.batchNumber} (Qty: {med.quantity})
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-purple-900">{selectedMedicine.name}</h4>
                  <p className="text-sm text-purple-700">Batch: {selectedMedicine.batchNumber}</p>
                  <p className="text-sm text-purple-700">Current Qty: {selectedMedicine.quantity}</p>
                </div>
                <button
                  onClick={() => setSelectedMedicine(null)}
                  className="text-purple-600 hover:text-purple-800 text-sm"
                >
                  Change
                </button>
              </div>
            </div>
          )}

          {/* Transaction Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Transaction Type</label>
            <select
              value={entryForm.transactionType}
              onChange={(e) => setEntryForm({ ...entryForm, transactionType: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="SALE">Sale / Dispensing</option>
              <option value="RECEIPT">Receipt from Supplier</option>
              <option value="TRANSFER_IN">Transfer In</option>
              <option value="TRANSFER_OUT">Transfer Out</option>
              <option value="ADJUSTMENT">Stock Adjustment</option>
              <option value="DESTRUCTION">Destruction</option>
              <option value="RETURN">Return</option>
            </select>
          </div>

          {/* Quantity Fields */}
          <div className="grid grid-cols-2 gap-4">
            {['RECEIPT', 'TRANSFER_IN', 'RETURN'].includes(entryForm.transactionType) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quantity In</label>
                <input
                  type="number"
                  min="0"
                  value={entryForm.quantityIn}
                  onChange={(e) => setEntryForm({ ...entryForm, quantityIn: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            )}
            {['SALE', 'TRANSFER_OUT', 'DESTRUCTION', 'ADJUSTMENT'].includes(entryForm.transactionType) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quantity Out</label>
                <input
                  type="number"
                  min="0"
                  value={entryForm.quantityOut}
                  onChange={(e) => setEntryForm({ ...entryForm, quantityOut: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            )}
          </div>

          {/* Sale/Dispensing Fields */}
          {entryForm.transactionType === 'SALE' && (
            <div className="space-y-4 border-t pt-4">
              <h5 className="font-medium text-gray-700">Patient Information (Required for PPB)</h5>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name</label>
                  <input
                    type="text"
                    value={entryForm.patientName}
                    onChange={(e) => setEntryForm({ ...entryForm, patientName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Patient ID</label>
                  <input
                    type="text"
                    value={entryForm.patientId}
                    onChange={(e) => setEntryForm({ ...entryForm, patientId: e.target.value })}
                    placeholder="National ID"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prescriber Name</label>
                  <input
                    type="text"
                    value={entryForm.prescriberName}
                    onChange={(e) => setEntryForm({ ...entryForm, prescriberName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prescriber Reg. No.</label>
                  <input
                    type="text"
                    value={entryForm.prescriberRegNo}
                    onChange={(e) => setEntryForm({ ...entryForm, prescriberRegNo: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Receipt Fields */}
          {entryForm.transactionType === 'RECEIPT' && (
            <div className="space-y-4 border-t pt-4">
              <h5 className="font-medium text-gray-700">Supplier Information</h5>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name</label>
                  <input
                    type="text"
                    value={entryForm.supplierName}
                    onChange={(e) => setEntryForm({ ...entryForm, supplierName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier License</label>
                  <input
                    type="text"
                    value={entryForm.supplierLicense}
                    onChange={(e) => setEntryForm({ ...entryForm, supplierLicense: e.target.value })}
                    placeholder="PPB License No."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Destruction Fields */}
          {entryForm.transactionType === 'DESTRUCTION' && (
            <div className="space-y-4 border-t pt-4">
              <h5 className="font-medium text-gray-700">Destruction Details (Required for PPB)</h5>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Witness Name</label>
                  <input
                    type="text"
                    value={entryForm.witnessName}
                    onChange={(e) => setEntryForm({ ...entryForm, witnessName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Witness Role</label>
                  <input
                    type="text"
                    value={entryForm.witnessRole}
                    onChange={(e) => setEntryForm({ ...entryForm, witnessRole: e.target.value })}
                    placeholder="e.g., PPB Inspector"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Destruction Method</label>
                  <select
                    value={entryForm.destructionMethod}
                    onChange={(e) => setEntryForm({ ...entryForm, destructionMethod: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select method...</option>
                    <option value="INCINERATION">Incineration</option>
                    <option value="CHEMICAL">Chemical Destruction</option>
                    <option value="LANDFILL">Approved Landfill</option>
                    <option value="OTHER">Other (specify in notes)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={entryForm.notes}
              onChange={(e) => setEntryForm({ ...entryForm, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              placeholder="Additional notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              onClick={() => {
                setShowNewEntryModal(false);
                setSelectedMedicine(null);
                setEntryError('');
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleNewEntry}
              disabled={isSubmitting || !selectedMedicine}
              className="btn btn-primary disabled:opacity-50 flex items-center"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Record Entry'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
