"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  Building2,
  Phone,
  Mail,
  MapPin,
  Edit,
  Trash2,
  X,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Supplier {
  id: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: string;
  createdAt: string;
}

export default function SuppliersContent() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const fetchSuppliers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "10");
      if (searchQuery) params.set("search", searchQuery);

      const response = await fetch(`/api/suppliers?${params}`);
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data.suppliers);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery]);

  useEffect(() => {
    const debounce = setTimeout(fetchSuppliers, 300);
    return () => clearTimeout(debounce);
  }, [fetchSuppliers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Supplier name is required");
      return;
    }

    setIsSaving(true);
    try {
      const method = editingSupplier ? "PUT" : "POST";
      const body = editingSupplier
        ? { ...formData, id: editingSupplier.id }
        : formData;

      const response = await fetch("/api/suppliers", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast.success(
          editingSupplier ? "Supplier updated" : "Supplier created"
        );
        setShowModal(false);
        resetForm();
        fetchSuppliers();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save supplier");
      }
    } catch (error) {
      console.error("Error saving supplier:", error);
      toast.error("Failed to save supplier");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (supplier: Supplier) => {
    if (!confirm(`Are you sure you want to delete ${supplier.name}?`)) return;

    try {
      const response = await fetch(`/api/suppliers?id=${supplier.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Supplier deleted");
        fetchSuppliers();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to delete supplier");
      }
    } catch (error) {
      console.error("Error deleting supplier:", error);
      toast.error("Failed to delete supplier");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
    });
    setEditingSupplier(null);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contactPerson: supplier.contactPerson || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
    });
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-gray-600">Manage your medicine suppliers</p>
        </div>
        <Button
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Supplier
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search suppliers by name, contact, or email..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Suppliers List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto"></div>
        </div>
      ) : suppliers.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No suppliers found</p>
            <Button
              className="mt-4 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
            >
              Add First Supplier
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((supplier, index) => (
            <motion.div
              key={supplier.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-100 rounded-lg">
                        <Building2 className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {supplier.name}
                        </h3>
                        <Badge
                          variant={
                            supplier.status === "ACTIVE"
                              ? "default"
                              : "secondary"
                          }
                          className={
                            supplier.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-100 text-gray-600"
                          }
                        >
                          {supplier.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(supplier)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => handleDelete(supplier)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600">
                    {supplier.contactPerson && (
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{supplier.contactPerson}</span>
                      </div>
                    )}
                    {supplier.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        <span>{supplier.phone}</span>
                      </div>
                    )}
                    {supplier.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        <span>{supplier.email}</span>
                      </div>
                    )}
                    {supplier.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span className="truncate">{supplier.address}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
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
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? "Edit Supplier" : "Add New Supplier"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Supplier Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Enter supplier name"
              />
            </div>
            <div>
              <Label htmlFor="contactPerson">Contact Person</Label>
              <Input
                id="contactPerson"
                value={formData.contactPerson}
                onChange={(e) =>
                  setFormData({ ...formData, contactPerson: e.target.value })
                }
                placeholder="Contact person name"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="email@example.com"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="+254 XXX XXX XXX"
              />
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="Supplier address"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : editingSupplier ? "Update" : "Add"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
