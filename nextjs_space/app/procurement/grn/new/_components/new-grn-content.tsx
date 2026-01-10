"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Trash2,
  FileText,
  Package,
  Save,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

export default function NewGRNContent() {
  const router = useRouter();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [notes, setNotes] = useState("");
  const [addToInventory, setAddToInventory] = useState(true);
  const [items, setItems] = useState<GRNItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchPOs = async () => {
      try {
        const response = await fetch("/api/purchase-orders?status=SENT&limit=100");
        if (response.ok) {
          const data = await response.json();
          // Also get PARTIAL status
          const response2 = await fetch("/api/purchase-orders?status=PARTIAL&limit=100");
          if (response2.ok) {
            const data2 = await response2.json();
            setPurchaseOrders([...data.orders, ...data2.orders]);
          } else {
            setPurchaseOrders(data.orders);
          }
        }
      } catch (error) {
        console.error("Error fetching POs:", error);
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
            batchNumber: "",
            expiryDate: "",
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
        medicineName: "",
        batchNumber: "",
        expiryDate: "",
        quantityReceived: 1,
        unitCost: 0,
      },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length === 1) {
      toast.error("At least one item is required");
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

    if (!selectedPO) {
      toast.error("Please select a purchase order");
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
      toast.error(
        "Please fill in all required fields for at least one item (medicine name, batch, expiry, quantity, cost)"
      );
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/grn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      });

      if (response.ok) {
        toast.success("GRN recorded and inventory updated");
        router.push("/procurement/grn");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to record GRN");
      }
    } catch (error) {
      console.error("Error creating GRN:", error);
      toast.error("Failed to record GRN");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/procurement/grn">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Record Goods Received
          </h1>
          <p className="text-gray-600">Record received goods against a purchase order</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* PO Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Purchase Order
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <Label>Select Purchase Order *</Label>
                  <Select onValueChange={handlePOSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a purchase order" />
                    </SelectTrigger>
                    <SelectContent>
                      {purchaseOrders.map((po) => (
                        <SelectItem key={po.id} value={po.id}>
                          {po.poNumber} - {po.supplier.name} ({po.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {purchaseOrders.length === 0 && (
                    <p className="text-sm text-amber-600 mt-1">
                      No pending purchase orders found.{" "}
                      <Link
                        href="/procurement/purchase-orders/new"
                        className="underline"
                      >
                        Create a PO first
                      </Link>
                    </p>
                  )}
                </div>

                {selectedPO && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium">
                      Supplier: {selectedPO.supplier.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {selectedPO.items.length} item(s) in order
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Received Items */}
            {selectedPO && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Package className="w-5 h-5" />
                      Received Items
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addItem}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Item
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {items.map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="border rounded-lg p-4 bg-gray-50"
                      >
                        <div className="flex justify-between items-center mb-3">
                          <span className="font-medium text-gray-700">
                            Item {index + 1}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Medicine Name *</Label>
                            <Input
                              value={item.medicineName}
                              onChange={(e) =>
                                updateItem(
                                  item.id,
                                  "medicineName",
                                  e.target.value
                                )
                              }
                              placeholder="e.g., Paracetamol 500mg"
                            />
                          </div>
                          <div>
                            <Label>Batch Number *</Label>
                            <Input
                              value={item.batchNumber}
                              onChange={(e) =>
                                updateItem(
                                  item.id,
                                  "batchNumber",
                                  e.target.value
                                )
                              }
                              placeholder="e.g., BAT-2026-001"
                            />
                          </div>
                          <div>
                            <Label>Expiry Date *</Label>
                            <Input
                              type="date"
                              value={item.expiryDate}
                              onChange={(e) =>
                                updateItem(
                                  item.id,
                                  "expiryDate",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                          <div>
                            <Label>Quantity Received *</Label>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantityReceived}
                              onChange={(e) =>
                                updateItem(
                                  item.id,
                                  "quantityReceived",
                                  parseInt(e.target.value) || 0
                                )
                              }
                            />
                          </div>
                          <div>
                            <Label>Unit Cost (KES) *</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitCost || ""}
                              onChange={(e) =>
                                updateItem(
                                  item.id,
                                  "unitCost",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                            />
                          </div>
                          <div className="flex items-end">
                            <div className="text-right w-full">
                              <span className="text-sm text-gray-500">
                                Line Total
                              </span>
                              <p className="font-bold text-emerald-700">
                                KES{" "}
                                {(item.quantityReceived * item.unitCost).toFixed(
                                  2
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {selectedPO && (
              <Card>
                <CardContent className="pt-6">
                  <Label>Notes (Optional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any notes about this delivery..."
                    rows={3}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Summary */}
          {selectedPO && (
            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle>GRN Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">PO Number</span>
                      <span className="font-mono">{selectedPO.poNumber}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Items</span>
                      <span>
                        {items.filter((i) => i.medicineName).length}
                      </span>
                    </div>
                    <div className="border-t pt-2 flex justify-between text-lg font-bold">
                      <span>Total Value</span>
                      <span className="text-emerald-700">
                        KES {total.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 p-3 bg-emerald-50 rounded-lg">
                    <Checkbox
                      id="addToInventory"
                      checked={addToInventory}
                      onCheckedChange={(checked) =>
                        setAddToInventory(checked as boolean)
                      }
                    />
                    <label
                      htmlFor="addToInventory"
                      className="text-sm font-medium text-emerald-800 cursor-pointer"
                    >
                      Add items to inventory automatically
                    </label>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    disabled={isSaving || items.length === 0}
                  >
                    {isSaving ? (
                      "Recording..."
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Record GRN
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
