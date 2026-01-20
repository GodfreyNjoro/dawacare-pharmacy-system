import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

type ReportTab = 'sales' | 'stock' | 'top-sellers' | 'export';

interface SalesData {
  summary: {
    totalRevenue: number;
    totalTransactions: number;
    totalItems: number;
    averageTransaction: number;
  };
  chartData: Array<{
    period: string;
    revenue: number;
    transactions: number;
    items: number;
  }>;
  paymentBreakdown: Array<{
    method: string;
    total: number;
    count: number;
  }>;
}

interface StockData {
  items: Array<{
    id: string;
    name: string;
    genericName: string | null;
    category: string | null;
    batchNumber: string | null;
    quantity: number;
    reorderLevel: number;
    unitPrice: number;
    expiryDate: string | null;
    status: string;
  }>;
  summary: {
    totalItems: number;
    totalValue: number;
    lowStockCount: number;
    outOfStockCount: number;
    expiringCount: number;
  };
  categories: string[];
}

interface TopSeller {
  id: string;
  name: string;
  genericName: string | null;
  category: string | null;
  totalQuantity: number;
  totalRevenue: number;
}

export default function Reports() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ReportTab>('sales');
  const [loading, setLoading] = useState(true);
  
  // Sales Report State
  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');

  // Stock Report State
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out' | 'expiring'>('all');
  const [stockCategory, setStockCategory] = useState('');
  const [stockSearch, setStockSearch] = useState('');

  // Top Sellers State
  const [topSellers, setTopSellers] = useState<TopSeller[]>([]);
  const [topLimit, setTopLimit] = useState(10);

  // Export State
  const [exportType, setExportType] = useState<'sales' | 'purchases' | 'inventory'>('sales');
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState('');

  const fetchSalesReport = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.getSalesReport({ startDate, endDate, groupBy });
      if (result.success) {
        setSalesData(result);
      }
    } catch (err) {
      console.error('Error fetching sales report:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, groupBy]);

  const fetchStockReport = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.getStockReport({ 
        status: stockFilter, 
        category: stockCategory, 
        search: stockSearch 
      });
      if (result.success) {
        setStockData(result);
      }
    } catch (err) {
      console.error('Error fetching stock report:', err);
    } finally {
      setLoading(false);
    }
  }, [stockFilter, stockCategory, stockSearch]);

  const fetchTopSellers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.getTopSellersReport({ 
        startDate, 
        endDate, 
        limit: topLimit 
      });
      if (result.success) {
        setTopSellers(result.topSellers);
      }
    } catch (err) {
      console.error('Error fetching top sellers:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, topLimit]);

  useEffect(() => {
    if (activeTab === 'sales') fetchSalesReport();
    else if (activeTab === 'stock') fetchStockReport();
    else if (activeTab === 'top-sellers') fetchTopSellers();
    else setLoading(false);
  }, [activeTab, fetchSalesReport, fetchStockReport, fetchTopSellers]);

  const handleExport = async () => {
    setExporting(true);
    setExportSuccess('');
    try {
      const result = await window.electronAPI.exportAccountingData({
        type: exportType,
        startDate,
        endDate,
      });
      if (result.success) {
        // Download the CSV
        const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${exportType}_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setExportSuccess(`Exported ${result.rowCount} rows successfully!`);
      }
    } catch (err) {
      console.error('Error exporting:', err);
    } finally {
      setExporting(false);
    }
  };

  const getStockStatusBadge = (status: string) => {
    switch (status) {
      case 'OUT_OF_STOCK': return 'bg-red-100 text-red-700';
      case 'LOW_STOCK': return 'bg-yellow-100 text-yellow-700';
      case 'EXPIRING': return 'bg-orange-100 text-orange-700';
      default: return 'bg-green-100 text-green-700';
    }
  };

  const tabs = [
    { id: 'sales' as ReportTab, label: 'Sales Report', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'stock' as ReportTab, label: 'Stock Report', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
    { id: 'top-sellers' as ReportTab, label: 'Top Sellers', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
    { id: 'export' as ReportTab, label: 'Export Data', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button onClick={() => navigate('/dashboard')} className="text-gray-500 hover:text-gray-700 mr-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h1 className="text-xl font-bold text-gray-900">Reports & Analytics</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="card mb-6">
          <div className="flex flex-wrap gap-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sales Report */}
        {activeTab === 'sales' && (
          <>
            {/* Filters */}
            <div className="card mb-6">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Group By</label>
                  <select
                    value={groupBy}
                    onChange={(e) => setGroupBy(e.target.value as 'day' | 'week' | 'month')}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="day">Daily</option>
                    <option value="week">Weekly</option>
                    <option value="month">Monthly</option>
                  </select>
                </div>
                <button onClick={fetchSalesReport} className="btn btn-primary">
                  Generate Report
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
              </div>
            ) : salesData && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="card">
                    <div className="text-sm text-gray-600">Total Revenue</div>
                    <div className="text-2xl font-bold text-emerald-600">
                      KES {salesData.summary.totalRevenue.toLocaleString()}
                    </div>
                  </div>
                  <div className="card">
                    <div className="text-sm text-gray-600">Transactions</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {salesData.summary.totalTransactions}
                    </div>
                  </div>
                  <div className="card">
                    <div className="text-sm text-gray-600">Items Sold</div>
                    <div className="text-2xl font-bold text-purple-600">
                      {salesData.summary.totalItems}
                    </div>
                  </div>
                  <div className="card">
                    <div className="text-sm text-gray-600">Avg. Transaction</div>
                    <div className="text-2xl font-bold text-orange-600">
                      KES {salesData.summary.averageTransaction.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Payment Breakdown */}
                <div className="card mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Payment Methods</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {salesData.paymentBreakdown.map(pm => (
                      <div key={pm.method} className="bg-gray-50 rounded-lg p-4">
                        <div className="text-sm text-gray-600">{pm.method}</div>
                        <div className="text-xl font-bold">KES {pm.total.toLocaleString()}</div>
                        <div className="text-sm text-gray-500">{pm.count} transactions</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Chart Data Table */}
                <div className="card overflow-hidden">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Period Breakdown</h3>
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Transactions</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Items</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {salesData.chartData.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-900">{row.period}</td>
                          <td className="px-4 py-3 text-right text-gray-900">KES {row.revenue.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{row.transactions}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{row.items}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {/* Stock Report */}
        {activeTab === 'stock' && (
          <>
            {/* Filters */}
            <div className="card mb-6">
              <div className="flex flex-wrap gap-4">
                <input
                  type="text"
                  placeholder="Search medicines..."
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                  className="flex-1 min-w-48 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
                <select
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value as typeof stockFilter)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">All Stock</option>
                  <option value="low">Low Stock</option>
                  <option value="out">Out of Stock</option>
                  <option value="expiring">Expiring Soon</option>
                </select>
                {stockData && stockData.categories.length > 0 && (
                  <select
                    value={stockCategory}
                    onChange={(e) => setStockCategory(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">All Categories</option>
                    {stockData.categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
              </div>
            ) : stockData && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                  <div className="card">
                    <div className="text-sm text-gray-600">Total Items</div>
                    <div className="text-2xl font-bold text-gray-900">{stockData.summary.totalItems}</div>
                  </div>
                  <div className="card">
                    <div className="text-sm text-gray-600">Total Value</div>
                    <div className="text-2xl font-bold text-emerald-600">
                      KES {stockData.summary.totalValue.toLocaleString()}
                    </div>
                  </div>
                  <div className="card">
                    <div className="text-sm text-gray-600">Low Stock</div>
                    <div className="text-2xl font-bold text-yellow-600">{stockData.summary.lowStockCount}</div>
                  </div>
                  <div className="card">
                    <div className="text-sm text-gray-600">Out of Stock</div>
                    <div className="text-2xl font-bold text-red-600">{stockData.summary.outOfStockCount}</div>
                  </div>
                  <div className="card">
                    <div className="text-sm text-gray-600">Expiring Soon</div>
                    <div className="text-2xl font-bold text-orange-600">{stockData.summary.expiringCount}</div>
                  </div>
                </div>

                {/* Stock Table */}
                <div className="card overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medicine</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {stockData.items.slice(0, 50).map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{item.name}</div>
                            {item.genericName && <div className="text-sm text-gray-500">{item.genericName}</div>}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.category || '-'}</td>
                          <td className="px-4 py-3 text-right text-gray-900">{item.quantity}</td>
                          <td className="px-4 py-3 text-right text-gray-600">KES {item.unitPrice.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-gray-900">
                            KES {(item.quantity * item.unitPrice).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStockStatusBadge(item.status)}`}>
                              {item.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {stockData.items.length > 50 && (
                    <div className="text-center py-4 text-gray-500">Showing first 50 of {stockData.items.length} items</div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* Top Sellers */}
        {activeTab === 'top-sellers' && (
          <>
            {/* Filters */}
            <div className="card mb-6">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Top</label>
                  <select
                    value={topLimit}
                    onChange={(e) => setTopLimit(Number(e.target.value))}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <button onClick={fetchTopSellers} className="btn btn-primary">
                  Generate Report
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Top {topLimit} Selling Products</h3>
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medicine</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity Sold</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {topSellers.map((item, index) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-bold text-emerald-600">{index + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{item.name}</div>
                          {item.genericName && <div className="text-sm text-gray-500">{item.genericName}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.category || '-'}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{item.totalQuantity}</td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-600">
                          KES {item.totalRevenue.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {topSellers.length === 0 && (
                  <div className="text-center py-8 text-gray-500">No sales data for the selected period</div>
                )}
              </div>
            )}
          </>
        )}

        {/* Export Data */}
        {activeTab === 'export' && (
          <div className="card">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Export Accounting Data</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Export Type</label>
                  <select
                    value={exportType}
                    onChange={(e) => setExportType(e.target.value as typeof exportType)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="sales">Sales Report</option>
                    <option value="purchases">Purchase Orders</option>
                    <option value="inventory">Inventory Valuation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="w-full btn btn-primary"
                >
                  {exporting ? 'Exporting...' : 'Export to CSV'}
                </button>
                {exportSuccess && (
                  <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
                    {exportSuccess}
                  </div>
                )}
              </div>
              <div className="bg-gray-50 rounded-lg p-6">
                <h4 className="font-medium text-gray-900 mb-4">Export Information</h4>
                <div className="space-y-3 text-sm text-gray-600">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 mr-2 text-emerald-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span><strong>Sales Report:</strong> Invoice details, customer info, payment methods, and totals</span>
                  </div>
                  <div className="flex items-start">
                    <svg className="w-5 h-5 mr-2 text-emerald-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span><strong>Purchase Orders:</strong> PO numbers, suppliers, items, and costs</span>
                  </div>
                  <div className="flex items-start">
                    <svg className="w-5 h-5 mr-2 text-emerald-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span><strong>Inventory:</strong> Stock levels, valuation, and expiry dates</span>
                  </div>
                </div>
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Tip:</strong> Export files are in CSV format and can be opened in Excel or any spreadsheet application.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
