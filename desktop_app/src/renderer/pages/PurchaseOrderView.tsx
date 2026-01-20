import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Package,
  FileText,
  Send,
  Loader2,
  Trash2,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

interface PurchaseOrderItem {
  id: string;
  medicineName: string;
  genericName: string | null;
  quantity: number;
  receivedQty: number;
  unitCost: number;
  total: number;
  category: string | null;
}

interface GRN {
  id: string;
  grnNumber: string;
  receivedDate: string;
  status: string;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplier: Supplier;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  notes: string | null;
  expectedDate: string | null;
  createdBy: string | null;
  createdAt: string;
  items: PurchaseOrderItem[];
  grns: GRN[];
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SENT: 'bg-blue-100 text-blue-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  RECEIVED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export default function PurchaseOrderView() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const result = await window.electronAPI.getPurchaseOrderById(id);
        if (result.success) {
          setOrder(result.order);
        } else {
          console.error('Error fetching order:', result.error);
        }
      } catch (error) {
        console.error('Error fetching order:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!order) return;
    setIsUpdating(true);
    try {
      const result = await window.electronAPI.updatePurchaseOrderStatus({
        id: order.id,
        status: newStatus,
      });
      if (result.success) {
        setOrder({ ...order, status: newStatus });
      } else {
        alert(result.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!order) return;
    if (!confirm(`Are you sure you want to delete ${order.poNumber}?`)) return;

    try {
      const result = await window.electronAPI.deletePurchaseOrder(order.id);
      if (result.success) {
        navigate('/procurement/purchase-orders');
      } else {
        alert(result.error || 'Failed to delete order');
      }
    } catch (error) {
      console.error('Error deleting order:', error);
      alert('Failed to delete order');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <FileText className="w-16 h-16 text-gray-300 mb-4" />
        <p className="text-gray-500">Purchase order not found</p>
        <button
          onClick={() => navigate('/procurement/purchase-orders')}
          className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          Back to Orders
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/procurement/purchase-orders')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-gray-900">{order.poNumber}</h1>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[order.status]}`}
                >
                  {order.status}
                </span>
              </div>
              <p className="text-sm text-gray-600">Purchase Order Details</p>
            </div>
          </div>
          <div className="flex gap-2">
            {order.status === 'DRAFT' && (
              <>
                <button
                  onClick={() => handleStatusUpdate('SENT')}
                  disabled={isUpdating}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Mark as Sent
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </>
            )}
            {(order.status === 'SENT' || order.status === 'PARTIAL') && (
              <button
                onClick={() => navigate('/procurement/grn/new')}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Receive Goods
              </button>
            )}
            {order.status === 'DRAFT' && (
              <button
                onClick={() => handleStatusUpdate('CANCELLED')}
                disabled={isUpdating}
                className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        {/* Order Info */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Order Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-500">Supplier</p>
              <div className="flex items-center gap-2 mt-1">
                <Building2 className="w-4 h-4 text-gray-400" />
                <span className="font-medium">{order.supplier?.name}</span>
              </div>
              {order.supplier?.phone && (
                <p className="text-sm text-gray-500 mt-1">{order.supplier.phone}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500">Created Date</p>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="font-medium">{formatDate(order.createdAt)}</span>
              </div>
            </div>
            {order.expectedDate && (
              <div>
                <p className="text-sm text-gray-500">Expected Delivery</p>
                <div className="flex items-center gap-2 mt-1">
                  <Package className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">{formatDate(order.expectedDate)}</span>
                </div>
              </div>
            )}
          </div>
          {order.notes && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500">Notes</p>
              <p className="mt-1 text-gray-700">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Order Items</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Medicine</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Category</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600">Qty</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600">Received</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600">Unit Cost</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-3 px-2">
                      <div className="font-medium">{item.medicineName}</div>
                      {item.genericName && (
                        <div className="text-xs text-gray-500">{item.genericName}</div>
                      )}
                    </td>
                    <td className="py-3 px-2 text-gray-600">{item.category || '-'}</td>
                    <td className="py-3 px-2 text-right">{item.quantity}</td>
                    <td className="py-3 px-2 text-right">
                      <span
                        className={`${
                          item.receivedQty >= item.quantity
                            ? 'text-emerald-600'
                            : item.receivedQty > 0
                            ? 'text-amber-600'
                            : 'text-gray-400'
                        }`}
                      >
                        {item.receivedQty}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">KES {item.unitCost.toFixed(2)}</td>
                    <td className="py-3 px-2 text-right font-medium">KES {item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t">
                  <td colSpan={5} className="py-3 px-2 text-right font-medium">Subtotal:</td>
                  <td className="py-3 px-2 text-right font-medium">KES {order.subtotal.toFixed(2)}</td>
                </tr>
                {order.tax > 0 && (
                  <tr>
                    <td colSpan={5} className="py-2 px-2 text-right text-gray-600">Tax:</td>
                    <td className="py-2 px-2 text-right">KES {order.tax.toFixed(2)}</td>
                  </tr>
                )}
                <tr className="border-t">
                  <td colSpan={5} className="py-3 px-2 text-right text-lg font-bold">Total:</td>
                  <td className="py-3 px-2 text-right text-lg font-bold text-emerald-600">
                    KES {order.total.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* GRNs */}
        {order.grns && order.grns.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Goods Received Notes</h2>
            <div className="space-y-2">
              {order.grns.map((grn) => (
                <div
                  key={grn.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/procurement/grn/${grn.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-emerald-600" />
                    <span className="font-mono font-medium">{grn.grnNumber}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">
                      {formatDate(grn.receivedDate)}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        grn.status === 'RECEIVED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {grn.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
