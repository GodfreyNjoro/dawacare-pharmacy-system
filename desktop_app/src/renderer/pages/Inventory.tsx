import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Package,
  ArrowLeft,
  AlertTriangle,
  Clock,
  Filter,
  RefreshCw,
  Cloud,
  CloudOff,
} from 'lucide-react';
import { Button, Input, Card, CardContent, CardHeader, Badge, Modal } from '../components/ui';
import { useAuth } from '../lib/auth-context';
import { useNavigate } from 'react-router-dom';

interface Medicine {
  id: string;
  name: string;
  genericName: string | null;
  manufacturer: string | null;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  reorderLevel: number;
  unitPrice: number;
  category: string;
  branchId: string | null;
  syncStatus: string;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = [
  'All Categories',
  'Tablets',
  'Capsules',
  'Syrups',
  'Injections',
  'Topicals',
  'Drops',
  'Inhalers',
  'Supplements',
  'Medical Devices',
  'Other',
];

export default function Inventory() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [medicineToDelete, setMedicineToDelete] = useState<Medicine | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchMedicines = useCallback(async () => {
    setIsLoading(true);
    try {
      // For inventory page, include out of stock medicines
      const result = await window.electronAPI.getAllMedicines({ limit: 500, includeOutOfStock: true });
      console.log('[Inventory] Fetched medicines:', result);
      if (result.success) {
        setMedicines(result.medicines || []);
      }
    } catch (error) {
      console.error('[Inventory] Error fetching medicines:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMedicines();
  }, [fetchMedicines]);

  // Filter medicines
  const filteredMedicines = medicines.filter((medicine) => {
    // Search filter
    const matchesSearch =
      medicine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (medicine.genericName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      medicine.batchNumber.toLowerCase().includes(searchQuery.toLowerCase());

    // Category filter
    const matchesCategory =
      categoryFilter === 'All Categories' || medicine.category === categoryFilter;

    // Stock filter
    let matchesStock = true;
    if (stockFilter === 'low') {
      matchesStock = medicine.quantity > 0 && medicine.quantity <= medicine.reorderLevel;
    } else if (stockFilter === 'out') {
      matchesStock = medicine.quantity === 0;
    }

    return matchesSearch && matchesCategory && matchesStock;
  });

  // Stats
  const totalMedicines = medicines.length;
  const lowStockCount = medicines.filter(
    (m) => m.quantity > 0 && m.quantity <= m.reorderLevel
  ).length;
  const outOfStockCount = medicines.filter((m) => m.quantity === 0).length;
  const expiringSoonCount = medicines.filter((m) => {
    const expiryDate = new Date(m.expiryDate);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return expiryDate <= thirtyDaysFromNow && expiryDate > new Date();
  }).length;

  const handleDelete = async () => {
    if (!medicineToDelete) return;
    try {
      const result = await window.electronAPI.deleteMedicine(medicineToDelete.id);
      if (result.success) {
        fetchMedicines();
      } else {
        alert(result.error || 'Failed to delete medicine');
      }
    } catch (error) {
      console.error('Error deleting medicine:', error);
      alert('Failed to delete medicine');
    } finally {
      setShowDeleteModal(false);
      setMedicineToDelete(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const isExpiringSoon = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return expiry <= thirtyDaysFromNow && expiry > new Date();
  };

  const isExpired = (expiryDate: string) => {
    return new Date(expiryDate) < new Date();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Inventory Management</h1>
                <p className="text-sm text-gray-500">Manage your medicine stock</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Sync Status */}
              <div className="flex items-center gap-2">
                {isOnline ? (
                  <Cloud className="w-5 h-5 text-emerald-500" />
                ) : (
                  <CloudOff className="w-5 h-5 text-gray-400" />
                )}
                <span className="text-sm text-gray-500">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <Button onClick={fetchMedicines} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button variant="primary" onClick={() => navigate('/inventory/add')}>
                <Plus className="w-4 h-4 mr-2" />
                Add Medicine
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Medicine"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{medicineToDelete?.name}</strong>? This
            action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{totalMedicines}</p>
                  <p className="text-sm text-gray-500">Total Items</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setStockFilter(stockFilter === 'low' ? 'all' : 'low')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{lowStockCount}</p>
                  <p className="text-sm text-gray-500">Low Stock</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setStockFilter(stockFilter === 'out' ? 'all' : 'out')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{outOfStockCount}</p>
                  <p className="text-sm text-gray-500">Out of Stock</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-600">{expiringSoonCount}</p>
                  <p className="text-sm text-gray-500">Expiring Soon</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by name, generic name, or batch number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <Button
                  variant={stockFilter !== 'all' ? 'primary' : 'outline'}
                  onClick={() => setStockFilter('all')}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  {stockFilter === 'all'
                    ? 'All Stock'
                    : stockFilter === 'low'
                    ? 'Low Stock'
                    : 'Out of Stock'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inventory Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
              </div>
            ) : filteredMedicines.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No medicines found</p>
                <p className="text-sm">Try adjusting your search or filters, or sync data from cloud</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Category</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Batch</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Expiry</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Quantity</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Price</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">Status</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">Sync</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredMedicines.map((medicine) => (
                      <tr key={medicine.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{medicine.name}</p>
                            {medicine.genericName && (
                              <p className="text-sm text-gray-500">{medicine.genericName}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline">{medicine.category}</Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{medicine.batchNumber}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-sm ${
                              isExpired(medicine.expiryDate)
                                ? 'text-red-600 font-medium'
                                : isExpiringSoon(medicine.expiryDate)
                                ? 'text-amber-600 font-medium'
                                : 'text-gray-600'
                            }`}
                          >
                            {formatDate(medicine.expiryDate)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`font-medium ${
                              medicine.quantity === 0
                                ? 'text-red-600'
                                : medicine.quantity <= medicine.reorderLevel
                                ? 'text-amber-600'
                                : 'text-gray-900'
                            }`}
                          >
                            {medicine.quantity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          KES {medicine.unitPrice.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {medicine.quantity === 0 ? (
                            <Badge variant="danger">Out of Stock</Badge>
                          ) : medicine.quantity <= medicine.reorderLevel ? (
                            <Badge variant="warning">Low Stock</Badge>
                          ) : isExpired(medicine.expiryDate) ? (
                            <Badge variant="danger">Expired</Badge>
                          ) : isExpiringSoon(medicine.expiryDate) ? (
                            <Badge variant="warning">Expiring</Badge>
                          ) : (
                            <Badge variant="success">In Stock</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            variant={
                              medicine.syncStatus === 'SYNCED'
                                ? 'success'
                                : medicine.syncStatus === 'PENDING_SYNC'
                                ? 'warning'
                                : 'outline'
                            }
                          >
                            {medicine.syncStatus}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              onClick={() => navigate(`/inventory/edit/${medicine.id}`)}
                              title="Edit"
                            >
                              <Edit className="w-4 h-4 text-blue-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setMedicineToDelete(medicine);
                                setShowDeleteModal(true);
                              }}
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Footer */}
        <div className="text-center text-sm text-gray-500">
          Showing {filteredMedicines.length} of {totalMedicines} medicines
        </div>
      </div>
    </div>
  );
}
