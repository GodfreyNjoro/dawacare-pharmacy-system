import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  Edit,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Star,
  CreditCard,
  ShoppingCart,
  X,
  User,
  ArrowLeft,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { Button, Input, Card, CardContent, CardHeader, Badge, Modal } from '../components/ui';
import { useAuth } from '../lib/auth-context';
import { useNavigate } from 'react-router-dom';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  loyaltyPoints: number;
  creditBalance: number;
  creditLimit: number;
  status: string;
  notes: string | null;
  createdAt: string;
}

interface CustomerDetail extends Customer {
  sales: Array<{
    id: string;
    invoiceNumber: string;
    total: number;
    createdAt: string;
    paymentMethod: string;
  }>;
  loyaltyTransactions: Array<{
    id: string;
    type: string;
    points: number;
    description: string | null;
    createdAt: string;
  }>;
  creditTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    description: string | null;
    createdAt: string;
  }>;
}

export default function Customers() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<CustomerDetail | null>(null);
  const [viewingStats, setViewingStats] = useState<{ totalSpent: number; totalPurchases: number } | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    dateOfBirth: '',
    gender: '',
    creditLimit: '',
    notes: '',
  });

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.getCustomersPaginated({
        page,
        limit: 10,
        search: search || undefined,
        status: statusFilter || undefined,
      });

      if (result.success) {
        setCustomers(result.customers);
        setPagination(result.pagination);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    const debounce = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(debounce);
  }, [fetchCustomers]);

  const openAddModal = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
      dateOfBirth: '',
      gender: '',
      creditLimit: '',
      notes: '',
    });
    setShowModal(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      address: customer.address || '',
      dateOfBirth: customer.dateOfBirth ? customer.dateOfBirth.split('T')[0] : '',
      gender: customer.gender || '',
      creditLimit: customer.creditLimit.toString(),
      notes: customer.notes || '',
    });
    setShowModal(true);
  };

  const openDetailModal = async (customerId: string) => {
    try {
      const result = await window.electronAPI.getCustomerDetails(customerId);
      if (result.success) {
        setViewingCustomer(result.customer);
        setViewingStats(result.stats);
        setShowDetailModal(true);
      }
    } catch (error) {
      console.error('Error fetching customer:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      const data = {
        ...formData,
        creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : 0,
      };

      let result;
      if (editingCustomer) {
        result = await window.electronAPI.updateCustomer(editingCustomer.id, data);
      } else {
        result = await window.electronAPI.createCustomer(data);
      }

      if (result.success) {
        setShowModal(false);
        fetchCustomers();
      } else {
        alert(result.error || 'Failed to save customer');
      }
    } catch (error) {
      console.error('Error saving customer:', error);
      alert('Failed to save customer');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async (customer: Customer) => {
    try {
      const result = await window.electronAPI.toggleCustomerStatus(customer.id);
      if (result.success) {
        fetchCustomers();
      }
    } catch (error) {
      console.error('Error toggling customer status:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return `KES ${amount.toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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
                <h1 className="text-xl font-bold text-gray-900">Customer Management</h1>
                <p className="text-sm text-gray-500">Manage your customers and loyalty</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={fetchCustomers} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button variant="primary" onClick={openAddModal}>
                <Plus className="w-4 h-4 mr-2" />
                Add Customer
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingCustomer ? 'Edit Customer' : 'Add Customer'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select Gender</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
              <Input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit</label>
              <Input
                type="number"
                value={formData.creditLimit}
                onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={formLoading}>
              {formLoading ? 'Saving...' : editingCustomer ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Customer Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Customer Details"
      >
        {viewingCustomer && (
          <div className="space-y-6">
            {/* Customer Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-medium">{viewingCustomer.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium">{viewingCustomer.phone}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{viewingCustomer.email || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <Badge variant={viewingCustomer.status === 'ACTIVE' ? 'success' : 'danger'}>
                  {viewingCustomer.status}
                </Badge>
              </div>
            </div>

            {/* Stats */}
            {viewingStats && (
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-3 text-center">
                    <Star className="w-5 h-5 mx-auto text-amber-500 mb-1" />
                    <p className="text-lg font-bold">{viewingCustomer.loyaltyPoints}</p>
                    <p className="text-xs text-gray-500">Loyalty Points</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <ShoppingCart className="w-5 h-5 mx-auto text-emerald-500 mb-1" />
                    <p className="text-lg font-bold">{viewingStats.totalPurchases}</p>
                    <p className="text-xs text-gray-500">Purchases</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <CreditCard className="w-5 h-5 mx-auto text-blue-500 mb-1" />
                    <p className="text-lg font-bold">{formatCurrency(viewingStats.totalSpent)}</p>
                    <p className="text-xs text-gray-500">Total Spent</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Recent Sales */}
            <div>
              <h4 className="font-medium mb-2">Recent Purchases</h4>
              {viewingCustomer.sales.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {viewingCustomer.sales.map((sale) => (
                    <div key={sale.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <p className="font-mono text-sm">{sale.invoiceNumber}</p>
                        <p className="text-xs text-gray-500">{formatDate(sale.createdAt)}</p>
                      </div>
                      <p className="font-medium">{formatCurrency(sale.total)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No purchases yet</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Search and Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Search by name, phone, or email..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Customers List */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
              </div>
            ) : customers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No customers found</p>
                <Button className="mt-4" variant="primary" onClick={openAddModal}>
                  Add First Customer
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Customer</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Contact</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Loyalty</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Credit</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">Status</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {customers.map((customer) => (
                      <tr key={customer.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{customer.name}</p>
                              <p className="text-sm text-gray-500">Since {formatDate(customer.createdAt)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            <p className="flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {customer.phone}
                            </p>
                            {customer.email && (
                              <p className="flex items-center gap-1 text-gray-500">
                                <Mail className="w-3 h-3" /> {customer.email}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Star className="w-4 h-4 text-amber-500" />
                            <span className="font-medium">{customer.loyaltyPoints}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className={customer.creditBalance > 0 ? 'text-red-600 font-medium' : ''}>
                            {formatCurrency(customer.creditBalance)}
                          </p>
                          <p className="text-xs text-gray-500">Limit: {formatCurrency(customer.creditLimit)}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={customer.status === 'ACTIVE' ? 'success' : 'danger'}>
                            {customer.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              onClick={() => openDetailModal(customer.id)}
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => openEditModal(customer)}
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => handleToggleStatus(customer)}
                              title={customer.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                            >
                              {customer.status === 'ACTIVE' ? (
                                <ToggleRight className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <ToggleLeft className="w-4 h-4 text-gray-400" />
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 p-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {page} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                      disabled={page === pagination.totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
