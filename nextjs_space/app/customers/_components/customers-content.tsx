"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

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
  _count?: {
    sales: number;
  };
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

export default function CustomersContent() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<CustomerDetail | null>(null);
  const [viewingStats, setViewingStats] = useState<{ totalSpent: number; totalPurchases: number } | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    dateOfBirth: "",
    gender: "",
    creditLimit: "",
    notes: "",
  });

  // Credit payment modal
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditPaymentAmount, setCreditPaymentAmount] = useState("");

  // Loyalty adjustment modal
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [loyaltyAdjustment, setLoyaltyAdjustment] = useState("");
  const [loyaltyDescription, setLoyaltyDescription] = useState("");

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
      });
      if (search) params.append("search", search);
      if (statusFilter) params.append("status", statusFilter);

      const res = await fetch(`/api/customers?${params}`);
      const data = await res.json();

      if (res.ok) {
        setCustomers(data.customers);
        setPagination(data.pagination);
      } else {
        toast.error(data.error || "Failed to fetch customers");
      }
    } catch (error) {
      console.error("Error fetching customers:", error);
      toast.error("Failed to fetch customers");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCustomers();
  };

  const openAddModal = () => {
    setEditingCustomer(null);
    setFormData({
      name: "",
      phone: "",
      email: "",
      address: "",
      dateOfBirth: "",
      gender: "",
      creditLimit: "",
      notes: "",
    });
    setShowModal(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || "",
      address: customer.address || "",
      dateOfBirth: customer.dateOfBirth ? customer.dateOfBirth.split("T")[0] : "",
      gender: customer.gender || "",
      creditLimit: customer.creditLimit.toString(),
      notes: customer.notes || "",
    });
    setShowModal(true);
  };

  const openDetailModal = async (customerId: string) => {
    try {
      const res = await fetch(`/api/customers/${customerId}`);
      const data = await res.json();
      if (res.ok) {
        setViewingCustomer(data.customer);
        setViewingStats(data.stats);
        setShowDetailModal(true);
      } else {
        toast.error(data.error || "Failed to fetch customer details");
      }
    } catch (error) {
      console.error("Error fetching customer:", error);
      toast.error("Failed to fetch customer details");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      const url = editingCustomer
        ? `/api/customers/${editingCustomer.id}`
        : "/api/customers";
      const method = editingCustomer ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : 0,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(
          editingCustomer
            ? "Customer updated successfully"
            : "Customer created successfully"
        );
        setShowModal(false);
        fetchCustomers();
      } else {
        toast.error(data.error || "Failed to save customer");
      }
    } catch (error) {
      console.error("Error saving customer:", error);
      toast.error("Failed to save customer");
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async (customer: Customer) => {
    try {
      const newStatus = customer.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        toast.success(
          newStatus === "ACTIVE"
            ? "Customer activated"
            : "Customer deactivated"
        );
        fetchCustomers();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update customer status");
      }
    } catch (error) {
      console.error("Error updating customer:", error);
      toast.error("Failed to update customer status");
    }
  };

  const handleCreditPayment = async () => {
    if (!viewingCustomer || !creditPaymentAmount) return;

    try {
      const res = await fetch(`/api/customers/${viewingCustomer.id}/credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(creditPaymentAmount),
          description: "Credit payment received",
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Credit payment recorded");
        setShowCreditModal(false);
        setCreditPaymentAmount("");
        // Refresh customer details
        openDetailModal(viewingCustomer.id);
        fetchCustomers();
      } else {
        toast.error(data.error || "Failed to record payment");
      }
    } catch (error) {
      console.error("Error recording payment:", error);
      toast.error("Failed to record payment");
    }
  };

  const handleLoyaltyAdjustment = async () => {
    if (!viewingCustomer || !loyaltyAdjustment) return;

    try {
      const res = await fetch(`/api/customers/${viewingCustomer.id}/loyalty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          points: parseInt(loyaltyAdjustment),
          description: loyaltyDescription || "Manual adjustment",
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Loyalty points adjusted");
        setShowLoyaltyModal(false);
        setLoyaltyAdjustment("");
        setLoyaltyDescription("");
        // Refresh customer details
        openDetailModal(viewingCustomer.id);
        fetchCustomers();
      } else {
        toast.error(data.error || "Failed to adjust points");
      }
    } catch (error) {
      console.error("Error adjusting points:", error);
      toast.error("Failed to adjust points");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-7 w-7 text-emerald-600" />
            Customers
          </h1>
          <p className="text-gray-600 mt-1">Manage your customer database</p>
        </div>
        <Button onClick={openAddModal} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name, phone, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" variant="outline">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Customers List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      ) : customers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-600">No customers found</p>
            <Button onClick={openAddModal} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Add First Customer
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4">
            {customers.map((customer, index) => (
              <motion.div
                key={customer.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                          <User className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{customer.name}</h3>
                            <Badge
                              variant={customer.status === "ACTIVE" ? "default" : "secondary"}
                              className={customer.status === "ACTIVE" ? "bg-green-100 text-green-800" : ""}
                            >
                              {customer.status}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5" />
                              {customer.phone}
                            </span>
                            {customer.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3.5 w-3.5" />
                                {customer.email}
                              </span>
                            )}
                            {customer.address && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {customer.address}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex gap-4 text-sm">
                          <div className="text-center">
                            <div className="flex items-center gap-1 text-amber-600">
                              <Star className="h-4 w-4" />
                              <span className="font-semibold">{customer.loyaltyPoints}</span>
                            </div>
                            <span className="text-gray-500 text-xs">Points</span>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center gap-1 text-blue-600">
                              <CreditCard className="h-4 w-4" />
                              <span className="font-semibold">{formatCurrency(customer.creditBalance)}</span>
                            </div>
                            <span className="text-gray-500 text-xs">Credit</span>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center gap-1 text-emerald-600">
                              <ShoppingCart className="h-4 w-4" />
                              <span className="font-semibold">{customer._count?.sales || 0}</span>
                            </div>
                            <span className="text-gray-500 text-xs">Purchases</span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDetailModal(customer.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(customer)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={customer.status === "ACTIVE" ? "destructive" : "default"}
                            size="sm"
                            onClick={() => handleToggleStatus(customer)}
                          >
                            {customer.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-600">
                Showing {(page - 1) * pagination.limit + 1} -{" "}
                {Math.min(page * pagination.limit, pagination.total)} of{" "}
                {pagination.total} customers
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === pagination.pages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Customer Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? "Edit Customer" : "Add New Customer"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(value) => setFormData({ ...formData, gender: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="creditLimit">Credit Limit (KES)</Label>
                <Input
                  id="creditLimit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.creditLimit}
                  onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={formLoading}>
                {formLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {editingCustomer ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Customer Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer Details
            </DialogTitle>
          </DialogHeader>
          {viewingCustomer && (
            <div className="space-y-6">
              {/* Customer Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <Star className="h-6 w-6 text-amber-500 mx-auto mb-1" />
                      <p className="text-2xl font-bold">{viewingCustomer.loyaltyPoints}</p>
                      <p className="text-sm text-gray-500">Loyalty Points</p>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => setShowLoyaltyModal(true)}
                      >
                        Adjust
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <CreditCard className="h-6 w-6 text-blue-500 mx-auto mb-1" />
                      <p className="text-2xl font-bold">{formatCurrency(viewingCustomer.creditBalance)}</p>
                      <p className="text-sm text-gray-500">Credit Balance</p>
                      {viewingCustomer.creditBalance > 0 && (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => setShowCreditModal(true)}
                        >
                          Record Payment
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <ShoppingCart className="h-6 w-6 text-emerald-500 mx-auto mb-1" />
                      <p className="text-2xl font-bold">{viewingStats?.totalPurchases || 0}</p>
                      <p className="text-sm text-gray-500">Total Purchases</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <CreditCard className="h-6 w-6 text-purple-500 mx-auto mb-1" />
                      <p className="text-2xl font-bold">{formatCurrency(viewingStats?.totalSpent || 0)}</p>
                      <p className="text-sm text-gray-500">Total Spent</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Contact Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Contact Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Phone:</span>
                      <span className="ml-2 font-medium">{viewingCustomer.phone}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Email:</span>
                      <span className="ml-2 font-medium">{viewingCustomer.email || "-"}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Address:</span>
                      <span className="ml-2 font-medium">{viewingCustomer.address || "-"}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Credit Limit:</span>
                      <span className="ml-2 font-medium">{formatCurrency(viewingCustomer.creditLimit)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Purchases */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Purchases</CardTitle>
                </CardHeader>
                <CardContent>
                  {viewingCustomer.sales.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No purchases yet</p>
                  ) : (
                    <div className="space-y-2">
                      {viewingCustomer.sales.slice(0, 5).map((sale) => (
                        <div
                          key={sale.id}
                          className="flex justify-between items-center p-2 bg-gray-50 rounded"
                        >
                          <div>
                            <span className="font-medium">{sale.invoiceNumber}</span>
                            <span className="text-gray-500 text-sm ml-2">
                              {formatDate(sale.createdAt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{sale.paymentMethod}</Badge>
                            <span className="font-semibold">{formatCurrency(sale.total)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Credit Payment Modal */}
      <Dialog open={showCreditModal} onOpenChange={setShowCreditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Credit Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Outstanding Balance</Label>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(viewingCustomer?.creditBalance || 0)}
              </p>
            </div>
            <div>
              <Label htmlFor="paymentAmount">Payment Amount (KES)</Label>
              <Input
                id="paymentAmount"
                type="number"
                min="0"
                max={viewingCustomer?.creditBalance || 0}
                step="0.01"
                value={creditPaymentAmount}
                onChange={(e) => setCreditPaymentAmount(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreditModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreditPayment} disabled={!creditPaymentAmount}>
                Record Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Loyalty Adjustment Modal */}
      <Dialog open={showLoyaltyModal} onOpenChange={setShowLoyaltyModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Loyalty Points</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Current Points</Label>
              <p className="text-2xl font-bold text-amber-600">
                {viewingCustomer?.loyaltyPoints || 0}
              </p>
            </div>
            <div>
              <Label htmlFor="loyaltyAdjustment">Points Adjustment (use negative to deduct)</Label>
              <Input
                id="loyaltyAdjustment"
                type="number"
                value={loyaltyAdjustment}
                onChange={(e) => setLoyaltyAdjustment(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="loyaltyDescription">Reason</Label>
              <Input
                id="loyaltyDescription"
                value={loyaltyDescription}
                onChange={(e) => setLoyaltyDescription(e.target.value)}
                placeholder="e.g., Bonus points, Correction"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowLoyaltyModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleLoyaltyAdjustment} disabled={!loyaltyAdjustment}>
                Adjust Points
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
