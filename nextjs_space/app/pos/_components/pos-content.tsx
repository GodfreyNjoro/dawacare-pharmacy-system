"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Smartphone,
  Receipt,
  CheckCircle,
  AlertCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Medicine {
  id: string;
  name: string;
  genericName: string | null;
  manufacturer: string | null;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  unitPrice: number;
  category: string;
}

interface CartItem {
  medicine: Medicine;
  quantity: number;
}

interface Sale {
  id: string;
  invoiceNumber: string;
  total: number;
  items: Array<{
    medicineName: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

const PAYMENT_METHODS = [
  { id: "CASH", label: "Cash", icon: Banknote },
  { id: "CARD", label: "Card", icon: CreditCard },
  { id: "MPESA", label: "M-Pesa", icon: Smartphone },
];

export default function POSContent() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);

  // Fetch medicines
  const fetchMedicines = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      params.set("limit", "100");

      const response = await fetch(`/api/medicines?${params}`);
      if (response.ok) {
        const data = await response.json();
        // Filter out medicines with 0 stock
        setMedicines(data.medicines.filter((m: Medicine) => m.quantity > 0));
      }
    } catch (error) {
      console.error("Error fetching medicines:", error);
    }
  }, [searchQuery]);

  useEffect(() => {
    const debounce = setTimeout(fetchMedicines, 300);
    return () => clearTimeout(debounce);
  }, [fetchMedicines]);

  // Add to cart
  const addToCart = (medicine: Medicine) => {
    const existing = cart.find((item) => item.medicine.id === medicine.id);
    if (existing) {
      if (existing.quantity >= medicine.quantity) {
        toast.error("Cannot add more than available stock");
        return;
      }
      setCart(
        cart.map((item) =>
          item.medicine.id === medicine.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([...cart, { medicine, quantity: 1 }]);
    }
    toast.success(`Added ${medicine.name} to cart`);
  };

  // Update quantity
  const updateQuantity = (medicineId: string, delta: number) => {
    setCart(
      cart
        .map((item) => {
          if (item.medicine.id === medicineId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > item.medicine.quantity) {
              toast.error("Cannot exceed available stock");
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Remove from cart
  const removeFromCart = (medicineId: string) => {
    setCart(cart.filter((item) => item.medicine.id !== medicineId));
  };

  // Calculate totals
  const subtotal = cart.reduce(
    (sum, item) => sum + item.medicine.unitPrice * item.quantity,
    0
  );
  const total = Math.max(0, subtotal - discount);

  // Process sale
  const processSale = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((item) => ({
            medicineId: item.medicine.id,
            quantity: item.quantity,
          })),
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          discount,
          paymentMethod,
          notes: notes || undefined,
        }),
      });

      if (response.ok) {
        const sale = await response.json();
        setLastSale(sale);
        setShowSuccess(true);
        // Reset cart and form
        setCart([]);
        setCustomerName("");
        setCustomerPhone("");
        setDiscount(0);
        setNotes("");
        // Refresh medicines list
        fetchMedicines();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to process sale");
      }
    } catch (error) {
      console.error("Error processing sale:", error);
      toast.error("Failed to process sale");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Success Modal */}
      <AnimatePresence>
        {showSuccess && lastSale && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowSuccess(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Sale Completed!
                </h3>
                <p className="text-gray-600 mb-4">
                  Invoice: {lastSale.invoiceNumber}
                </p>
                <div className="bg-gray-50 rounded-lg p-4 mb-4 text-left">
                  <div className="space-y-2 text-sm">
                    {lastSale.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>
                          {item.medicineName} x{item.quantity}
                        </span>
                        <span>KES {item.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t mt-3 pt-3 font-bold flex justify-between">
                    <span>Total</span>
                    <span>KES {lastSale.total.toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowSuccess(false)}
                  >
                    Close
                  </Button>
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                      window.open(`/sales/${lastSale.id}`, "_blank");
                    }}
                  >
                    <Receipt className="w-4 h-4 mr-2" />
                    View Invoice
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto p-4 lg:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Point of Sale</h1>
          <p className="text-gray-600">Search medicines and create sales</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Medicine Search & List */}
          <div className="lg:col-span-2 space-y-4">
            {/* Search Bar */}
            <Card>
              <CardContent className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search medicines by name, generic name, or batch number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-12 text-lg"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Medicine Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {medicines.length === 0 ? (
                <div className="col-span-2 text-center py-12 text-gray-500">
                  {searchQuery
                    ? "No medicines found matching your search"
                    : "Start typing to search for medicines"}
                </div>
              ) : (
                medicines.map((medicine) => {
                  const isLowStock = medicine.quantity <= 10;
                  const isExpiringSoon =
                    new Date(medicine.expiryDate) <
                    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                  const cartItem = cart.find(
                    (item) => item.medicine.id === medicine.id
                  );

                  return (
                    <motion.div
                      key={medicine.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.02 }}
                    >
                      <Card
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          cartItem
                            ? "ring-2 ring-emerald-500 bg-emerald-50"
                            : ""
                        }`}
                        onClick={() => addToCart(medicine)}
                      >
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="font-semibold text-gray-900">
                                {medicine.name}
                              </h3>
                              {medicine.genericName && (
                                <p className="text-sm text-gray-500">
                                  {medicine.genericName}
                                </p>
                              )}
                            </div>
                            <Badge
                              variant="secondary"
                              className="bg-emerald-100 text-emerald-700"
                            >
                              KES {medicine.unitPrice.toFixed(2)}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">
                              Batch: {medicine.batchNumber}
                            </span>
                            <div className="flex items-center gap-2">
                              {isLowStock && (
                                <Badge
                                  variant="destructive"
                                  className="text-xs"
                                >
                                  Low Stock
                                </Badge>
                              )}
                              {isExpiringSoon && (
                                <Badge
                                  variant="outline"
                                  className="text-xs text-amber-600 border-amber-600"
                                >
                                  Expiring Soon
                                </Badge>
                              )}
                              <span
                                className={`font-medium ${
                                  isLowStock
                                    ? "text-red-600"
                                    : "text-gray-700"
                                }`}
                              >
                                Stock: {medicine.quantity}
                              </span>
                            </div>
                          </div>
                          {cartItem && (
                            <div className="mt-2 pt-2 border-t flex items-center justify-between">
                              <span className="text-sm text-emerald-700 font-medium">
                                In Cart: {cartItem.quantity}
                              </span>
                              <Plus className="w-4 h-4 text-emerald-600" />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>

          {/* Cart Panel */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Cart
                  {cart.length > 0 && (
                    <Badge className="ml-auto bg-emerald-600">
                      {cart.length} items
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cart.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>Cart is empty</p>
                    <p className="text-sm">Click on medicines to add them</p>
                  </div>
                ) : (
                  <>
                    {/* Cart Items */}
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {cart.map((item) => (
                        <motion.div
                          key={item.medicine.id}
                          layout
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="bg-gray-50 rounded-lg p-3"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-medium text-sm">
                              {item.medicine.name}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                              onClick={() => removeFromCart(item.medicine.id)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() =>
                                  updateQuantity(item.medicine.id, -1)
                                }
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="w-8 text-center font-medium">
                                {item.quantity}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() =>
                                  updateQuantity(item.medicine.id, 1)
                                }
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                            <span className="font-medium text-emerald-700">
                              KES{" "}
                              {(
                                item.medicine.unitPrice * item.quantity
                              ).toFixed(2)}
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Customer Info */}
                    <div className="border-t pt-4 space-y-3">
                      <Input
                        placeholder="Customer Name (optional)"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                      />
                      <Input
                        placeholder="Phone Number (optional)"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                      />
                    </div>

                    {/* Payment Method */}
                    <div className="border-t pt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Payment Method
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {PAYMENT_METHODS.map((method) => (
                          <Button
                            key={method.id}
                            variant={
                              paymentMethod === method.id
                                ? "default"
                                : "outline"
                            }
                            className={`flex-col h-auto py-3 ${
                              paymentMethod === method.id
                                ? "bg-emerald-600 hover:bg-emerald-700"
                                : ""
                            }`}
                            onClick={() => setPaymentMethod(method.id)}
                          >
                            <method.icon className="w-5 h-5 mb-1" />
                            <span className="text-xs">{method.label}</span>
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Discount */}
                    <div className="border-t pt-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Discount:</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={discount || ""}
                          onChange={(e) =>
                            setDiscount(parseFloat(e.target.value) || 0)
                          }
                          className="w-24 h-8"
                          placeholder="0.00"
                        />
                        <span className="text-sm text-gray-600">KES</span>
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <Input
                        placeholder="Notes (optional)"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>

                    {/* Totals */}
                    <div className="border-t pt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal</span>
                        <span>KES {subtotal.toFixed(2)}</span>
                      </div>
                      {discount > 0 && (
                        <div className="flex justify-between text-sm text-red-600">
                          <span>Discount</span>
                          <span>- KES {discount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total</span>
                        <span className="text-emerald-700">
                          KES {total.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Complete Sale Button */}
                    <Button
                      className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-lg"
                      onClick={processSale}
                      disabled={isLoading || cart.length === 0}
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <span className="animate-spin">⏳</span>
                          Processing...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5" />
                          Complete Sale
                        </span>
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
