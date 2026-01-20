import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Receipt,
  Calendar,
  Filter,
  Eye,
  TrendingUp,
  Banknote,
  CreditCard,
  Smartphone,
  ArrowLeft,
  RefreshCw,
  X,
} from 'lucide-react';
import { Button, Input, Card, CardContent, CardHeader, Badge, Modal } from '../components/ui';
import { useAuth } from '../lib/auth-context';
import { useNavigate } from 'react-router-dom';

interface SaleItem {
  id: string;
  medicineName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Sale {
  id: string;
  invoiceNumber: string;
  customerName: string | null;
  customerPhone: string | null;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  soldBy: string | null;
  createdAt: string;
  items: SaleItem[];
}

interface Stats {
  today: { total: number; count: number };
  week: { total: number; count: number };
  month: { total: number; count: number };
  allTime: { total: number; count: number };
}

const PAYMENT_ICONS: Record<string, React.ReactNode> = {
  CASH: <Banknote className="w-4 h-4" />,
  CARD: <CreditCard className="w-4 h-4" />,
  MPESA: <Smartphone className="w-4 h-4" />,
};

export default function SalesHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [sales, setSales] = useState<Sale[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const result = await window.electronAPI.getSalesStats();
        if (result.success) {
          setStats(result.stats);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };
    fetchStats();
  }, []);

  // Fetch sales
  const fetchSales = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.getAllSales({
        page,
        limit: 10,
        search: searchQuery || undefined,
        paymentMethod: paymentFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      if (result.success) {
        setSales(result.sales);
        setTotalPages(result.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery, paymentFilter, startDate, endDate]);

  useEffect(() => {
    const debounce = setTimeout(fetchSales, 300);
    return () => clearTimeout(debounce);
  }, [fetchSales]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
                <h1 className="text-xl font-bold text-gray-900">Sales History</h1>
                <p className="text-sm text-gray-500">View and manage sales transactions</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={fetchSales} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button variant="primary" onClick={() => navigate('/pos')}>
                <Receipt className="w-4 h-4 mr-2" />
                New Sale
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Today</p>
                    <p className="text-lg font-bold text-gray-900">
                      KES {stats.today.total.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">{stats.today.count} sales</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">This Week</p>
                    <p className="text-lg font-bold text-gray-900">
                      KES {stats.week.total.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">{stats.week.count} sales</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Banknote className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">This Month</p>
                    <p className="text-lg font-bold text-gray-900">
                      KES {stats.month.total.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">{stats.month.count} sales</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">All Time</p>
                    <p className="text-lg font-bold text-gray-900">
                      KES {stats.allTime.total.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">{stats.allTime.count} sales</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by invoice or customer..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9"
                />
              </div>
              <select
                value={paymentFilter}
                onChange={(e) => {
                  setPaymentFilter(e.target.value);
                  setPage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">All Methods</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="MPESA">M-Pesa</option>
              </select>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                placeholder="Start Date"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                placeholder="End Date"
              />
            </div>
          </CardContent>
        </Card>

        {/* Sales List */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Transactions</h3>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-10 h-10 mx-auto text-gray-400 animate-spin" />
                <p className="mt-4 text-gray-500">Loading sales...</p>
              </div>
            ) : sales.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No sales found</p>
                <Button
                  className="mt-4"
                  variant="primary"
                  onClick={() => navigate('/pos')}
                >
                  Make First Sale
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {sales.map((sale) => (
                  <div
                    key={sale.id}
                    className="p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono font-bold text-emerald-700">
                            {sale.invoiceNumber}
                          </span>
                          <Badge variant="outline" className="flex items-center gap-1">
                            {PAYMENT_ICONS[sale.paymentMethod]}
                            {sale.paymentMethod}
                          </Badge>
                          <Badge
                            variant={
                              sale.paymentStatus === 'PAID'
                                ? 'success'
                                : sale.paymentStatus === 'VOIDED'
                                ? 'danger'
                                : 'warning'
                            }
                          >
                            {sale.paymentStatus}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600">
                          <span>{formatDate(sale.createdAt)}</span>
                          {sale.customerName && (
                            <span className="ml-3">Customer: {sale.customerName}</span>
                          )}
                          {sale.soldBy && (
                            <span className="ml-3">By: {sale.soldBy}</span>
                          )}
                        </div>
                        <div className="mt-2 text-sm text-gray-500">
                          {sale.items.length} item(s):{' '}
                          {sale.items
                            .slice(0, 3)
                            .map((item) => item.medicineName)
                            .join(', ')}
                          {sale.items.length > 3 && ' ...'}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">
                            KES {sale.total.toFixed(2)}
                          </p>
                          {sale.discount > 0 && (
                            <p className="text-xs text-red-600">
                              Discount: KES {sale.discount.toFixed(2)}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => navigate(`/invoice/${sale.id}`)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 p-4">
                    <Button
                      variant="outline"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next
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
