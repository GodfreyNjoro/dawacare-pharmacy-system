import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  FileCheck,
  Eye,
  Building2,
  Calendar,
  Package,
  ChevronLeft,
  Loader2,
} from 'lucide-react';

interface GRNItem {
  id: string;
  medicineName: string;
  quantityReceived: number;
  unitCost: number;
  total: number;
}

interface GRN {
  id: string;
  grnNumber: string;
  purchaseOrderId: string;
  purchaseOrder: {
    id: string;
    poNumber: string;
    supplier: { name: string };
  };
  receivedDate: string;
  receivedBy: string | null;
  status: string;
  createdAt: string;
  items: GRNItem[];
}

const STATUS_COLORS: Record<string, string> = {
  RECEIVED: 'bg-emerald-100 text-emerald-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  REJECTED: 'bg-red-100 text-red-700',
};

export default function GRNList() {
  const navigate = useNavigate();
  const [grns, setGrns] = useState<GRN[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchGRNs = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.getGRNsPaginated({
        page,
        limit: 10,
        search: searchQuery || undefined,
      });

      if (result.success) {
        setGrns(result.grns);
        setTotalPages(result.pagination.totalPages);
      } else {
        console.error('Error fetching GRNs:', result.error);
      }
    } catch (error) {
      console.error('Error fetching GRNs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery]);

  useEffect(() => {
    const debounce = setTimeout(fetchGRNs, 300);
    return () => clearTimeout(debounce);
  }, [fetchGRNs]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const totalReceived = (items: GRNItem[]) => {
    return items.reduce((sum, item) => sum + item.total, 0);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Goods Received Notes</h1>
              <p className="text-sm text-gray-600">Track received goods and update inventory</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/procurement/grn/new')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Record GRN
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Search */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by GRN or PO number..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* GRN List */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">Received Goods</h2>
          </div>
          <div className="p-4">
            {isLoading ? (
              <div className="text-center py-12">
                <Loader2 className="w-10 h-10 animate-spin mx-auto text-emerald-600" />
              </div>
            ) : grns.length === 0 ? (
              <div className="text-center py-12">
                <FileCheck className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No goods received notes found</p>
                <button
                  className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                  onClick={() => navigate('/procurement/grn/new')}
                >
                  Record First GRN
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {grns.map((grn) => (
                  <div
                    key={grn.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono font-bold text-emerald-700">
                            {grn.grnNumber}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[grn.status] || 'bg-gray-100 text-gray-700'}`}
                          >
                            {grn.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <FileCheck className="w-4 h-4" />
                            PO: {grn.purchaseOrder?.poNumber || 'N/A'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Building2 className="w-4 h-4" />
                            {grn.purchaseOrder?.supplier?.name || 'Unknown'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(grn.receivedDate)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Package className="w-4 h-4" />
                            {grn.items.length} item(s)
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">
                            KES {totalReceived(grn.items).toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">
                            Received by: {grn.receivedBy || 'Unknown'}
                          </p>
                        </div>
                        <button
                          onClick={() => navigate(`/procurement/grn/${grn.id}`)}
                          className="flex items-center gap-1 px-3 py-1.5 border rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-4">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1.5 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1.5 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
