import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  FileText,
  Package,
  Save,
  CheckCircle,
  Loader2,
} from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
}

interface POItem {
  id: string;
  medicineName: string;
  genericName: string | null;
  quantity: number;
  receivedQty: number;
  unitCost: number;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplier: Supplier;
  status: string;
  items: POItem[];
}

interface GRNItem {
  id: string;
  medicineName: string;
  batchNumber: string;
  expiryDate: string;
  quantityReceived: number;
  unitCost: number;
}

export default function NewGRN() {
  const navigate = useNavigate();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [notes, setNotes] = useState('');
  const [addToInventory, setAddToInventory] = useState(true);
  const [items, setItems] = useState<GRNItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [isLoadingPOs, setIsLoadingPOs] = useState(true);

  useEffect(() => {
    const fetchPOs = async () => {
      setIsLoadingPOs(true);
      try {
        const result = await window.electronAPI.getPendingPurchaseOrders();
        if (result.success) {
          setPurchaseOrders(result.orders);
        }
      } catch (error) {
        console.error('Error fetching POs:', error);
      } finally {
        setIsLoadingPOs(false);
      }
    };
    fetchPOs();
  }, []);

  const handlePOSelect = (poId: string) => {
    const po = purchaseOrders.find((p) => p.id === poId);
    if (po) {
      setSelectedPO(po);
      // Pre-fill items from PO
      setItems(
        po.items
          .filter((item) => item.receivedQty < item.quantity)
          .map((item) => ({
            id: item.id,
            medicineName: item.medicineName,
            batchNumber: '',
            expiryDate: '',
            quantityReceived: item.quantity - item.receivedQty,
            unitCost: item.unitCost,
          }))
      );
    }
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        id: Date.now().toString(),
        medicineName: '',
        batchNumber: '',
        expiryDate: '',
        quantityReceived: 1,
        unitCost: 0,
      },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length === 1) {
      setError('At least one item is required');
      return;
    }
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (
    id: string,
    field: keyof GRNItem,
    value: string | number
  ) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const total = items.reduce(
    (sum, item) => sum + item.quantityReceived * item.unitCost,
    0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedPO) {
      setError('Please select a purchase order');
      return;
    }

    const validItems = items.filter(
      (item) =>
        item.medicineName.trim() &&
        item.batchNumber.trim() &&
        item.expiryDate &&
        item.quantityReceived > 0 &&
        item.unitCost > 0
    );

    if (validItems.length === 0) {
      setError(
        'Please fill in all required fields for at least one item (medicine name, batch, expiry, quantity, cost)'
      );
      return;
    }

    setIsSaving(true);
    try {
      const result = await window.electronAPI.createGRN({
        purchaseOrderId: selectedPO.id,
        items: validItems.map((item) => ({
          medicineName: item.medicineName,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate,
          quantityReceived: item.quantityReceived,
          unitCost: item.unitCost,
        })),
        notes: notes || null,
        addToInventory,
      });

      if (result.success) {
        navigate('/procurement/grn');
      } else {
        setError(result.error || 'Failed to record GRN');
      }
    } catch (error) {
      console.error('Error creating GRN:', error);
      setError('Failed to record GRN');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/procurement/grn')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Record Goods Received</h1>
            <p className="text-sm text-gray-600">Record received goods against a purchase order</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6 max-w-4xl mx-auto">
        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
        )}

        {/* Purchase Order Selection */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Select Purchase Order</h2>
          {isLoadingPOs ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
              <p className="text-sm text-gray-500 mt-2">Loading purchase orders...</p>
            </div>
          ) : purchaseOrders.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No pending purchase orders found</p>
              <p className="text-sm text-gray-400 mt-1">
                Create a purchase order and mark it as SENT first
              </p>
              <button
                type="button"
                onClick={() => navigate('/procurement/purchase-orders/new')}
                className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Create Purchase Order
              </button>
            </div>
          ) : (
            <select
              value={selectedPO?.id || ''}
              onChange={(e) => handlePOSelect(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">Select a purchase order</option>
              {purchaseOrders.map((po) => (
                <option key={po.id} value={po.id}>
                  {po.poNumber} - {po.supplier?.name} ({po.status})
                </option>
              ))}
            </select>
          )}

          {selectedPO && (
            <div className="mt-4 p-4 bg-emerald-50 rounded-lg">
              <div className="flex items-center gap-2 text-emerald-700 mb-2">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Selected: {selectedPO.poNumber}</span>
              </div>
              <p className="text-sm text-gray-600">
                Supplier: {selectedPO.supplier?.name} | Status: {selectedPO.status}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Items to receive: {selectedPO.items.filter(i => i.receivedQty < i.quantity).length}
              </p>
            </div>
          )}
        </div>

        {/* Items */}
        {selectedPO && items.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Items Received</h2>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="border rounded-lg p-4 bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">
                      Item {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Medicine Name *
                      </label>
                      <input
                        type="text"
                        value={item.medicineName}
                        onChange={(e) => updateItem(item.id, 'medicineName', e.target.value)}
                        placeholder="Medicine name"
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Batch Number *
                      </label>
                      <input
                        type="text"
                        value={item.batchNumber}
                        onChange={(e) => updateItem(item.id, 'batchNumber', e.target.value)}
                        placeholder="e.g., BTH-2024-001"
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Expiry Date *
                      </label>
                      <input
                        type="date"
                        value={item.expiryDate}
                        onChange={(e) => updateItem(item.id, 'expiryDate', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Quantity Received *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantityReceived}
                        onChange={(e) => updateItem(item.id, 'quantityReceived', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Unit Cost (KES) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitCost}
                        onChange={(e) => updateItem(item.id, 'unitCost', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Item Total
                      </label>
                      <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium">
                        KES {(item.quantityReceived * item.unitCost).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes & Options */}
        {selectedPO && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Additional notes about received goods..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="addToInventory"
                    checked={addToInventory}
                    onChange={(e) => setAddToInventory(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                  />
                  <label htmlFor="addToInventory" className="text-sm font-medium text-gray-700">
                    Add items to inventory automatically
                  </label>
                </div>
                <p className="text-xs text-gray-500 ml-7">
                  When enabled, received items will be added to medicine inventory
                  with a 30% markup on unit cost for selling price.
                </p>
                <div className="border-t pt-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total Received Value:</span>
                    <span className="text-emerald-600">KES {total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {selectedPO && (
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => navigate('/procurement/grn')}
              className="px-6 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Record GRN
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
