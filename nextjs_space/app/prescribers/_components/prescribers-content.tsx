"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Stethoscope,
  Building2,
  Phone,
  Mail,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Prescriber {
  id: string;
  name: string;
  registrationNumber: string;
  councilType: string;
  specialization: string | null;
  facility: string | null;
  facilityAddress: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  verifiedAt: string | null;
  notes: string | null;
  createdAt: string;
  _count?: {
    prescriptions: number;
  };
}

const COUNCIL_TYPES = [
  { value: "KMPDC", label: "Kenya Medical Practitioners & Dentists Council" },
  { value: "NCK", label: "Nursing Council of Kenya" },
  { value: "KPHC", label: "Kenya Pharmacy & Poisons Board" },
  { value: "KMLTTB", label: "Kenya Medical Laboratory Technicians & Technologists Board" },
  { value: "COK", label: "Clinical Officers Council" },
  { value: "OTHER", label: "Other" },
];

export default function PrescribersContent() {
  const [prescribers, setPrescribers] = useState<Prescriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [councilFilter, setCouncilFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedPrescriber, setSelectedPrescriber] = useState<Prescriber | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    registrationNumber: "",
    councilType: "",
    specialization: "",
    facility: "",
    facilityAddress: "",
    phone: "",
    email: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchPrescribers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
      });
      if (searchTerm) params.append("search", searchTerm);
      if (statusFilter) params.append("status", statusFilter);
      if (councilFilter) params.append("councilType", councilFilter);

      const res = await fetch(`/api/prescribers?${params}`);
      const data = await res.json();
      if (res.ok) {
        setPrescribers(data.prescribers);
        setTotalPages(data.pagination.totalPages);
        setTotal(data.pagination.total);
      } else {
        toast.error(data.error || "Failed to fetch prescribers");
      }
    } catch {
      toast.error("Failed to fetch prescribers");
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, statusFilter, councilFilter]);

  useEffect(() => {
    fetchPrescribers();
  }, [fetchPrescribers]);

  const resetForm = () => {
    setFormData({
      name: "",
      registrationNumber: "",
      councilType: "",
      specialization: "",
      facility: "",
      facilityAddress: "",
      phone: "",
      email: "",
      notes: "",
    });
    setSelectedPrescriber(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (prescriber: Prescriber) => {
    setSelectedPrescriber(prescriber);
    setFormData({
      name: prescriber.name,
      registrationNumber: prescriber.registrationNumber,
      councilType: prescriber.councilType,
      specialization: prescriber.specialization || "",
      facility: prescriber.facility || "",
      facilityAddress: prescriber.facilityAddress || "",
      phone: prescriber.phone || "",
      email: prescriber.email || "",
      notes: prescriber.notes || "",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.registrationNumber || !formData.councilType) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      const url = "/api/prescribers";
      const method = selectedPrescriber ? "PUT" : "POST";
      const body = selectedPrescriber
        ? { id: selectedPrescriber.id, ...formData }
        : formData;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(selectedPrescriber ? "Prescriber updated" : "Prescriber added");
        setModalOpen(false);
        resetForm();
        fetchPrescribers();
      } else {
        toast.error(data.error || "Failed to save prescriber");
      }
    } catch {
      toast.error("Failed to save prescriber");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPrescriber) return;

    try {
      const res = await fetch(`/api/prescribers?id=${selectedPrescriber.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Prescriber deleted");
        setDeleteModalOpen(false);
        setSelectedPrescriber(null);
        fetchPrescribers();
      } else {
        toast.error(data.error || "Failed to delete prescriber");
      }
    } catch {
      toast.error("Failed to delete prescriber");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-green-100 text-green-700">Active</Badge>;
      case "INACTIVE":
        return <Badge className="bg-gray-100 text-gray-700">Inactive</Badge>;
      case "SUSPENDED":
        return <Badge className="bg-red-100 text-red-700">Suspended</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getCouncilLabel = (code: string) => {
    return COUNCIL_TYPES.find(c => c.value === code)?.label || code;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prescribers</h1>
          <p className="text-gray-500">Manage registered doctors, nurses, and other healthcare providers</p>
        </div>
        <Button onClick={openAddModal} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Prescriber
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search name, reg. number..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Select value={councilFilter} onValueChange={(v) => { setCouncilFilter(v); setCurrentPage(1); }}>
            <SelectTrigger>
              <SelectValue placeholder="All Councils" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Councils</SelectItem>
              {COUNCIL_TYPES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
            <SelectTrigger>
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-sm text-gray-500 flex items-center">
            {total} prescriber{total !== 1 ? "s" : ""} found
          </div>
        </div>
      </Card>

      {/* Prescribers List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      ) : prescribers.length === 0 ? (
        <Card className="p-12 text-center">
          <Stethoscope className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No prescribers found</h3>
          <p className="text-gray-500 mb-4">Add your first prescriber to start managing prescriptions</p>
          <Button onClick={openAddModal} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Prescriber
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {prescribers.map((prescriber) => (
            <motion.div
              key={prescriber.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <Stethoscope className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{prescriber.name}</h3>
                        {getStatusBadge(prescriber.status)}
                      </div>
                      <p className="text-sm text-gray-500">
                        {prescriber.councilType}: {prescriber.registrationNumber}
                      </p>
                      {prescriber.specialization && (
                        <p className="text-sm text-gray-500">{prescriber.specialization}</p>
                      )}
                      <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                        {prescriber.facility && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5" />
                            {prescriber.facility}
                          </span>
                        )}
                        {prescriber.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />
                            {prescriber.phone}
                          </span>
                        )}
                        {prescriber.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5" />
                            {prescriber.email}
                          </span>
                        )}
                        {prescriber._count && (
                          <span className="flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" />
                            {prescriber._count.prescriptions} prescriptions
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(prescriber)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        setSelectedPrescriber(prescriber);
                        setDeleteModalOpen(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-gray-500">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPrescriber ? "Edit Prescriber" : "Add New Prescriber"}
            </DialogTitle>
            <DialogDescription>
              {selectedPrescriber
                ? "Update the prescriber details below"
                : "Enter the details of the healthcare provider"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Dr. John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registrationNumber">Registration Number *</Label>
                <Input
                  id="registrationNumber"
                  value={formData.registrationNumber}
                  onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                  placeholder="A12345"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="councilType">Regulatory Council *</Label>
                <Select
                  value={formData.councilType}
                  onValueChange={(v) => setFormData({ ...formData, councilType: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select council" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNCIL_TYPES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="specialization">Specialization</Label>
                <Input
                  id="specialization"
                  value={formData.specialization}
                  onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                  placeholder="General Practice, Pediatrics, etc."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="facility">Facility / Hospital</Label>
                <Input
                  id="facility"
                  value={formData.facility}
                  onChange={(e) => setFormData({ ...formData, facility: e.target.value })}
                  placeholder="Kenyatta National Hospital"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="facilityAddress">Facility Address</Label>
                <Input
                  id="facilityAddress"
                  value={formData.facilityAddress}
                  onChange={(e) => setFormData({ ...formData, facilityAddress: e.target.value })}
                  placeholder="Hospital Road, Nairobi"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+254 700 123 456"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="doctor@hospital.co.ke"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about the prescriber"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Check className="w-4 h-4 mr-2" />
                {saving ? "Saving..." : selectedPrescriber ? "Update" : "Add Prescriber"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Prescriber</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedPrescriber?.name}?
              {selectedPrescriber?._count?.prescriptions && selectedPrescriber._count.prescriptions > 0 && (
                <span className="block mt-2 text-yellow-600">
                  This prescriber has {selectedPrescriber._count.prescriptions} prescription(s) and will be deactivated instead of deleted.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
