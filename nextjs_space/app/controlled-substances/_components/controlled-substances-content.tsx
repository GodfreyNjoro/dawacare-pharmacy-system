'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Search, Filter, Plus, Eye, CheckCircle, AlertTriangle,
  FileText, Calendar, ChevronLeft, ChevronRight, Download, RefreshCw,
  Pill, TrendingUp, TrendingDown, User, Building, Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface RegisterEntry {
  id: string;
  entryNumber: string;
  medicineId: string;
  medicineName: string;
  genericName?: string;
  batchNumber: string;
  scheduleClass: string;
  transactionType: string;
  quantityIn: number;
  quantityOut: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType?: string;
  referenceNumber?: string;
  patientName?: string;
  patientId?: string;
  prescriberName?: string;
  prescriberRegNo?: string;
  supplierName?: string;
  witnessName?: string;
  destructionMethod?: string;
  recordedByName: string;
  recordedByRole: string;
  verifiedByName?: string;
  verifiedAt?: string;
  notes?: string;
  transactionDate: string;
  createdAt: string;
  medicine?: {
    id: string;
    name: string;
    quantity: number;
    scheduleClass?: string;
  };
}

interface Stats {
  summary: {
    totalControlledMedicines: number;
    todayTransactions: number;
    monthTransactions: number;
    pendingVerifications: number;
  };
  controlledMedicines: Array<{
    id: string;
    name: string;
    genericName?: string;
    batchNumber: string;
    scheduleClass?: string;
    quantity: number;
    expiryDate: string;
  }>;
  transactionsByType: Array<{ type: string; count: number }>;
  bySchedule: Array<{ schedule: string; count: number; totalQuantity: number }>;
  lowStock: Array<{ id: string; name: string; quantity: number; reorderLevel: number; scheduleClass?: string }>;
  recentEntries: RegisterEntry[];
}

const SCHEDULE_CLASSES = [
  { value: 'SCHEDULE_I', label: 'Schedule I', color: 'bg-red-100 text-red-800' },
  { value: 'SCHEDULE_II', label: 'Schedule II', color: 'bg-orange-100 text-orange-800' },
  { value: 'SCHEDULE_III', label: 'Schedule III', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'SCHEDULE_IV', label: 'Schedule IV', color: 'bg-blue-100 text-blue-800' },
  { value: 'SCHEDULE_V', label: 'Schedule V', color: 'bg-green-100 text-green-800' },
  { value: 'PSYCHOTROPIC', label: 'Psychotropic', color: 'bg-purple-100 text-purple-800' }
];

const TRANSACTION_TYPES = [
  { value: 'RECEIPT', label: 'Receipt', icon: TrendingUp, color: 'text-green-600' },
  { value: 'SALE', label: 'Sale/Dispensing', icon: TrendingDown, color: 'text-blue-600' },
  { value: 'TRANSFER_IN', label: 'Transfer In', icon: TrendingUp, color: 'text-cyan-600' },
  { value: 'TRANSFER_OUT', label: 'Transfer Out', icon: TrendingDown, color: 'text-orange-600' },
  { value: 'ADJUSTMENT', label: 'Adjustment', icon: RefreshCw, color: 'text-gray-600' },
  { value: 'DESTRUCTION', label: 'Destruction', icon: AlertTriangle, color: 'text-red-600' },
  { value: 'RETURN', label: 'Return', icon: TrendingUp, color: 'text-purple-600' }
];

export default function ControlledSubstancesContent() {
  const [entries, setEntries] = useState<RegisterEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [scheduleFilter, setScheduleFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showNewEntryModal, setShowNewEntryModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<RegisterEntry | null>(null);
  const [activeTab, setActiveTab] = useState<'register' | 'dashboard'>('dashboard');
  
  // New entry form state
  const [formData, setFormData] = useState({
    medicineId: '',
    transactionType: 'SALE',
    quantityIn: 0,
    quantityOut: 0,
    patientName: '',
    patientId: '',
    patientAddress: '',
    prescriptionNumber: '',
    prescriberName: '',
    prescriberRegNo: '',
    supplierName: '',
    supplierLicense: '',
    witnessName: '',
    witnessRole: '',
    destructionMethod: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/controlled-substances/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);
  
  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(scheduleFilter && { scheduleClass: scheduleFilter }),
        ...(typeFilter && { transactionType: typeFilter })
      });
      
      const res = await fetch(`/api/controlled-substances?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error fetching entries:', error);
      toast.error('Failed to fetch register entries');
    } finally {
      setLoading(false);
    }
  }, [page, search, scheduleFilter, typeFilter]);
  
  useEffect(() => {
    fetchStats();
    fetchEntries();
  }, [fetchStats, fetchEntries]);
  
  const handleSubmitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.medicineId || !formData.transactionType) {
      toast.error('Please select a medicine and transaction type');
      return;
    }
    
    setSubmitting(true);
    try {
      const res = await fetch('/api/controlled-substances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        toast.success('Entry recorded successfully');
        setShowNewEntryModal(false);
        setFormData({
          medicineId: '',
          transactionType: 'SALE',
          quantityIn: 0,
          quantityOut: 0,
          patientName: '',
          patientId: '',
          patientAddress: '',
          prescriptionNumber: '',
          prescriberName: '',
          prescriberRegNo: '',
          supplierName: '',
          supplierLicense: '',
          witnessName: '',
          witnessRole: '',
          destructionMethod: '',
          notes: ''
        });
        fetchEntries();
        fetchStats();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to record entry');
      }
    } catch (error) {
      console.error('Error creating entry:', error);
      toast.error('Failed to record entry');
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleVerify = async (id: string) => {
    try {
      const res = await fetch(`/api/controlled-substances/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify' })
      });
      
      if (res.ok) {
        toast.success('Entry verified successfully');
        fetchEntries();
        fetchStats();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to verify entry');
      }
    } catch (error) {
      console.error('Error verifying entry:', error);
      toast.error('Failed to verify entry');
    }
  };
  
  const exportToCSV = () => {
    if (entries.length === 0) {
      toast.error('No entries to export');
      return;
    }
    
    const headers = [
      'Entry Number', 'Date', 'Medicine', 'Batch', 'Schedule', 'Type',
      'Qty In', 'Qty Out', 'Balance', 'Patient', 'Patient ID', 'Prescriber',
      'Recorded By', 'Verified By', 'Notes'
    ];
    
    const rows = entries.map(e => [
      e.entryNumber,
      new Date(e.transactionDate).toLocaleDateString(),
      e.medicineName,
      e.batchNumber,
      e.scheduleClass,
      e.transactionType,
      e.quantityIn,
      e.quantityOut,
      e.balanceAfter,
      e.patientName || '',
      e.patientId || '',
      e.prescriberName || '',
      e.recordedByName,
      e.verifiedByName || 'Pending',
      e.notes || ''
    ]);
    
    const csv = [headers, ...rows].map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `controlled-substances-register-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Register exported successfully');
  };
  
  const getScheduleBadge = (schedule: string) => {
    const found = SCHEDULE_CLASSES.find(s => s.value === schedule);
    return found ? (
      <Badge className={found.color}>{found.label}</Badge>
    ) : (
      <Badge variant="outline">{schedule}</Badge>
    );
  };
  
  const getTypeBadge = (type: string) => {
    const found = TRANSACTION_TYPES.find(t => t.value === type);
    if (found) {
      const Icon = found.icon;
      return (
        <span className={`flex items-center gap-1 ${found.color}`}>
          <Icon className="w-4 h-4" />
          {found.label}
        </span>
      );
    }
    return type;
  };
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-7 h-7 text-red-600" />
            Controlled Substances Register
          </h1>
          <p className="text-gray-500 mt-1">Kenya Poisons Act Compliance</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === 'dashboard' ? 'default' : 'outline'}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </Button>
          <Button
            variant={activeTab === 'register' ? 'default' : 'outline'}
            onClick={() => setActiveTab('register')}
          >
            Register
          </Button>
          <Button onClick={() => setShowNewEntryModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Entry
          </Button>
        </div>
      </div>
      
      {activeTab === 'dashboard' && stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Controlled Items</p>
                    <p className="text-2xl font-bold">{stats.summary.totalControlledMedicines}</p>
                  </div>
                  <Pill className="w-10 h-10 text-red-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Today&apos;s Transactions</p>
                    <p className="text-2xl font-bold">{stats.summary.todayTransactions}</p>
                  </div>
                  <Calendar className="w-10 h-10 text-blue-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">This Month</p>
                    <p className="text-2xl font-bold">{stats.summary.monthTransactions}</p>
                  </div>
                  <FileText className="w-10 h-10 text-green-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            
            <Card className={stats.summary.pendingVerifications > 0 ? 'border-orange-300 bg-orange-50' : ''}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Pending Verification</p>
                    <p className="text-2xl font-bold">{stats.summary.pendingVerifications}</p>
                  </div>
                  <AlertTriangle className={`w-10 h-10 opacity-50 ${stats.summary.pendingVerifications > 0 ? 'text-orange-500' : 'text-gray-400'}`} />
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Schedule */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Inventory by Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.bySchedule.map((item) => (
                    <div key={item.schedule} className="flex items-center justify-between">
                      {getScheduleBadge(item.schedule || 'UNKNOWN')}
                      <div className="text-right">
                        <span className="font-semibold">{item.count} items</span>
                        <span className="text-gray-500 ml-2">({item.totalQuantity} units)</span>
                      </div>
                    </div>
                  ))}
                  {stats.bySchedule.length === 0 && (
                    <p className="text-gray-500 text-center py-4">No controlled substances in inventory</p>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Low Stock Alert */}
            <Card className={stats.lowStock.length > 0 ? 'border-red-300' : ''}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className={stats.lowStock.length > 0 ? 'text-red-500' : 'text-gray-400'} />
                  Low Stock Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.lowStock.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2 bg-red-50 rounded">
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        {getScheduleBadge(item.scheduleClass || 'UNKNOWN')}
                      </div>
                      <div className="text-right">
                        <p className="text-red-600 font-semibold">{item.quantity} left</p>
                        <p className="text-xs text-gray-500">Reorder: {item.reorderLevel}</p>
                      </div>
                    </div>
                  ))}
                  {stats.lowStock.length === 0 && (
                    <p className="text-green-600 text-center py-4">All controlled substances are well stocked</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.recentEntries.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {getTypeBadge(entry.transactionType)}
                      <div>
                        <p className="font-medium text-gray-900">{entry.medicineName}</p>
                        <p className="text-sm text-gray-500">{entry.entryNumber}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {entry.quantityIn > 0 ? `+${entry.quantityIn}` : `-${entry.quantityOut}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(entry.transactionDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
      
      {activeTab === 'register' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search by medicine, entry number, patient..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <Select value={scheduleFilter} onValueChange={setScheduleFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Schedules" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Schedules</SelectItem>
                    {SCHEDULE_CLASSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Types</SelectItem>
                    {TRANSACTION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button variant="outline" onClick={exportToCSV}>
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Register Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : entries.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Shield className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No entries found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entry #</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medicine</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Schedule</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">In</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Out</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient/Source</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verified</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {entries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-mono text-gray-900">{entry.entryNumber}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {new Date(entry.transactionDate).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{entry.medicineName}</p>
                              <p className="text-xs text-gray-500">Batch: {entry.batchNumber}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">{getScheduleBadge(entry.scheduleClass)}</td>
                          <td className="px-4 py-3 text-sm">{getTypeBadge(entry.transactionType)}</td>
                          <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">
                            {entry.quantityIn > 0 ? `+${entry.quantityIn}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">
                            {entry.quantityOut > 0 ? `-${entry.quantityOut}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold">{entry.balanceAfter}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {entry.patientName || entry.supplierName || '-'}
                          </td>
                          <td className="px-4 py-3">
                            {entry.verifiedByName ? (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Verified
                              </Badge>
                            ) : (
                              <Badge className="bg-yellow-100 text-yellow-800">
                                Pending
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedEntry(entry);
                                  setShowDetailModal(true);
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              {!entry.verifiedByName && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleVerify(entry.id)}
                                  title="Verify Entry"
                                >
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => p + 1)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
      
      {/* New Entry Modal */}
      <Dialog open={showNewEntryModal} onOpenChange={setShowNewEntryModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Record New Entry
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmitEntry} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Controlled Medicine *</Label>
                <Select
                  value={formData.medicineId}
                  onValueChange={(v) => setFormData(f => ({ ...f, medicineId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select medicine" />
                  </SelectTrigger>
                  <SelectContent>
                    {stats?.controlledMedicines.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.scheduleClass}) - Qty: {m.quantity}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Transaction Type *</Label>
                <Select
                  value={formData.transactionType}
                  onValueChange={(v) => setFormData(f => ({ ...f, transactionType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSACTION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quantity In</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.quantityIn}
                  onChange={(e) => setFormData(f => ({ ...f, quantityIn: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label>Quantity Out</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.quantityOut}
                  onChange={(e) => setFormData(f => ({ ...f, quantityOut: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
            
            {/* Conditional fields based on transaction type */}
            {['SALE', 'RETURN'].includes(formData.transactionType) && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" /> Patient Information
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Patient Name</Label>
                    <Input
                      value={formData.patientName}
                      onChange={(e) => setFormData(f => ({ ...f, patientName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Patient ID (National ID/Passport)</Label>
                    <Input
                      value={formData.patientId}
                      onChange={(e) => setFormData(f => ({ ...f, patientId: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Prescription Number</Label>
                    <Input
                      value={formData.prescriptionNumber}
                      onChange={(e) => setFormData(f => ({ ...f, prescriptionNumber: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Prescriber Name</Label>
                    <Input
                      value={formData.prescriberName}
                      onChange={(e) => setFormData(f => ({ ...f, prescriberName: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Prescriber Reg. Number</Label>
                    <Input
                      value={formData.prescriberRegNo}
                      onChange={(e) => setFormData(f => ({ ...f, prescriberRegNo: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            )}
            
            {['RECEIPT', 'TRANSFER_IN'].includes(formData.transactionType) && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Building className="w-4 h-4" /> Supplier Information
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Supplier Name</Label>
                    <Input
                      value={formData.supplierName}
                      onChange={(e) => setFormData(f => ({ ...f, supplierName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Supplier License (PPB)</Label>
                    <Input
                      value={formData.supplierLicense}
                      onChange={(e) => setFormData(f => ({ ...f, supplierLicense: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            )}
            
            {formData.transactionType === 'DESTRUCTION' && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" /> Destruction Details (PPB Required)
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Witness Name *</Label>
                    <Input
                      value={formData.witnessName}
                      onChange={(e) => setFormData(f => ({ ...f, witnessName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Witness Role *</Label>
                    <Input
                      placeholder="e.g., PPB Inspector, Police Officer"
                      value={formData.witnessRole}
                      onChange={(e) => setFormData(f => ({ ...f, witnessRole: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Destruction Method</Label>
                    <Select
                      value={formData.destructionMethod}
                      onValueChange={(v) => setFormData(f => ({ ...f, destructionMethod: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INCINERATION">Incineration</SelectItem>
                        <SelectItem value="CHEMICAL">Chemical Treatment</SelectItem>
                        <SelectItem value="ENCAPSULATION">Encapsulation</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
            
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(f => ({ ...f, notes: e.target.value }))}
                placeholder="Additional notes or comments"
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setShowNewEntryModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Recording...</>
                ) : (
                  <><Plus className="w-4 h-4 mr-2" /> Record Entry</>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedEntry && (
          <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Entry Details: {selectedEntry.entryNumber}</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-500">Medicine</Label>
                    <p className="font-medium">{selectedEntry.medicineName}</p>
                    {selectedEntry.genericName && (
                      <p className="text-sm text-gray-500">{selectedEntry.genericName}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-gray-500">Batch Number</Label>
                    <p className="font-medium">{selectedEntry.batchNumber}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Schedule Class</Label>
                    <div className="mt-1">{getScheduleBadge(selectedEntry.scheduleClass)}</div>
                  </div>
                  <div>
                    <Label className="text-gray-500">Transaction Type</Label>
                    <div className="mt-1">{getTypeBadge(selectedEntry.transactionType)}</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Balance Before</p>
                    <p className="text-xl font-bold">{selectedEntry.balanceBefore}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Qty In</p>
                    <p className="text-xl font-bold text-green-600">+{selectedEntry.quantityIn}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Qty Out</p>
                    <p className="text-xl font-bold text-red-600">-{selectedEntry.quantityOut}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Balance After</p>
                    <p className="text-xl font-bold">{selectedEntry.balanceAfter}</p>
                  </div>
                </div>
                
                {selectedEntry.patientName && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-2">Patient Information</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-gray-500">Name:</span> {selectedEntry.patientName}</div>
                      {selectedEntry.patientId && (
                        <div><span className="text-gray-500">ID:</span> {selectedEntry.patientId}</div>
                      )}
                      {selectedEntry.prescriberName && (
                        <div><span className="text-gray-500">Prescriber:</span> {selectedEntry.prescriberName}</div>
                      )}
                      {selectedEntry.prescriberRegNo && (
                        <div><span className="text-gray-500">Reg. No:</span> {selectedEntry.prescriberRegNo}</div>
                      )}
                    </div>
                  </div>
                )}
                
                {selectedEntry.supplierName && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-2">Supplier Information</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-gray-500">Supplier:</span> {selectedEntry.supplierName}</div>
                    </div>
                  </div>
                )}
                
                {selectedEntry.witnessName && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-2 text-red-600">Destruction Witness</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-gray-500">Name:</span> {selectedEntry.witnessName}</div>
                      {selectedEntry.destructionMethod && (
                        <div><span className="text-gray-500">Method:</span> {selectedEntry.destructionMethod}</div>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Audit Trail</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Recorded By:</span>{' '}
                      {selectedEntry.recordedByName} ({selectedEntry.recordedByRole})
                    </div>
                    <div>
                      <span className="text-gray-500">Date:</span>{' '}
                      {new Date(selectedEntry.transactionDate).toLocaleString()}
                    </div>
                    <div>
                      <span className="text-gray-500">Verified By:</span>{' '}
                      {selectedEntry.verifiedByName ? (
                        <span className="text-green-600">
                          {selectedEntry.verifiedByName} ({new Date(selectedEntry.verifiedAt!).toLocaleString()})
                        </span>
                      ) : (
                        <span className="text-yellow-600">Pending Verification</span>
                      )}
                    </div>
                  </div>
                </div>
                
                {selectedEntry.notes && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-2">Notes</h4>
                    <p className="text-sm text-gray-600">{selectedEntry.notes}</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}
