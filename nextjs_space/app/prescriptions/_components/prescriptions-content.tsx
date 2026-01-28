"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Plus,
  Search,
  Eye,
  ClipboardList,
  User,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Stethoscope,
  Pill,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface PrescriptionItem {
  id: string;
  medicineName: string;
  quantityPrescribed: number;
  quantityDispensed: number;
  isControlled: boolean;
}

interface Prescription {
  id: string;
  prescriptionNumber: string;
  patientName: string;
  patientPhone: string | null;
  patientAge: number | null;
  patientGender: string | null;
  diagnosis: string | null;
  status: string;
  priority: string;
  issueDate: string;
  expiryDate: string;
  refillsAllowed: number;
  refillsUsed: number;
  prescriber: {
    id: string;
    name: string;
    registrationNumber: string;
    facility: string | null;
  };
  customer: {
    id: string;
    name: string;
    phone: string;
  } | null;
  items: PrescriptionItem[];
  _count: {
    dispensings: number;
  };
  createdAt: string;
}

export default function PrescriptionsContent() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Record<string, number>>({});

  const fetchPrescriptions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
      });
      if (searchTerm) params.append("search", searchTerm);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);

      const res = await fetch(`/api/prescriptions?${params}`);
      const data = await res.json();
      if (res.ok) {
        setPrescriptions(data.prescriptions);
        setTotalPages(data.pagination.totalPages);
        setTotal(data.pagination.total);
        setStats(data.stats || {});
      } else {
        toast.error(data.error || "Failed to fetch prescriptions");
      }
    } catch {
      toast.error("Failed to fetch prescriptions");
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, statusFilter]);

  useEffect(() => {
    fetchPrescriptions();
  }, [fetchPrescriptions]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>;
      case "PARTIAL":
        return <Badge className="bg-blue-100 text-blue-700">Partial</Badge>;
      case "DISPENSED":
        return <Badge className="bg-green-100 text-green-700">Dispensed</Badge>;
      case "EXPIRED":
        return <Badge className="bg-red-100 text-red-700">Expired</Badge>;
      case "CANCELLED":
        return <Badge className="bg-gray-100 text-gray-700">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "STAT":
        return <Badge className="bg-red-600 text-white">STAT</Badge>;
      case "URGENT":
        return <Badge className="bg-orange-100 text-orange-700">Urgent</Badge>;
      default:
        return null;
    }
  };

  const isExpiringSoon = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  };

  const isExpired = (expiryDate: string) => {
    return new Date(expiryDate) < new Date();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prescriptions</h1>
          <p className="text-gray-500">Manage and dispense patient prescriptions</p>
        </div>
        <Link href="/prescriptions/new">
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            New Prescription
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.PENDING || 0}</div>
          <div className="text-sm text-gray-500">Pending</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.PARTIAL || 0}</div>
          <div className="text-sm text-gray-500">Partial</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.DISPENSED || 0}</div>
          <div className="text-sm text-gray-500">Dispensed</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{stats.EXPIRED || 0}</div>
          <div className="text-sm text-gray-500">Expired</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-gray-600">{total}</div>
          <div className="text-sm text-gray-500">Total</div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search RX#, patient, prescriber..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
            <SelectTrigger>
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="PARTIAL">Partial</SelectItem>
              <SelectItem value="DISPENSED">Dispensed</SelectItem>
              <SelectItem value="EXPIRED">Expired</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-sm text-gray-500 flex items-center">
            {total} prescription{total !== 1 ? "s" : ""} found
          </div>
        </div>
      </Card>

      {/* Prescriptions List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      ) : prescriptions.length === 0 ? (
        <Card className="p-12 text-center">
          <ClipboardList className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No prescriptions found</h3>
          <p className="text-gray-500 mb-4">Create a new prescription to get started</p>
          <Link href="/prescriptions/new">
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" />
              New Prescription
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {prescriptions.map((prescription) => (
            <motion.div
              key={prescription.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className={`p-4 hover:shadow-md transition-shadow ${
                isExpired(prescription.expiryDate) && prescription.status !== "DISPENSED" && prescription.status !== "CANCELLED"
                  ? "border-red-300 bg-red-50"
                  : isExpiringSoon(prescription.expiryDate) && prescription.status !== "DISPENSED" && prescription.status !== "CANCELLED"
                  ? "border-yellow-300 bg-yellow-50"
                  : ""
              }`}>
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="font-mono font-semibold text-emerald-700">
                        {prescription.prescriptionNumber}
                      </span>
                      {getStatusBadge(prescription.status)}
                      {getPriorityBadge(prescription.priority)}
                      {prescription.items.some(i => i.isControlled) && (
                        <Badge className="bg-purple-100 text-purple-700">Controlled</Badge>
                      )}
                      {isExpired(prescription.expiryDate) && prescription.status !== "DISPENSED" && prescription.status !== "CANCELLED" && (
                        <Badge className="bg-red-600 text-white">EXPIRED</Badge>
                      )}
                      {isExpiringSoon(prescription.expiryDate) && prescription.status !== "DISPENSED" && prescription.status !== "CANCELLED" && (
                        <Badge className="bg-yellow-600 text-white">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Expiring Soon
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Patient Info */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-gray-900">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{prescription.patientName}</span>
                          {prescription.patientAge && (
                            <span className="text-sm text-gray-500">
                              ({prescription.patientAge} yrs, {prescription.patientGender})
                            </span>
                          )}
                        </div>
                        {prescription.diagnosis && (
                          <p className="text-sm text-gray-500 ml-6">{prescription.diagnosis}</p>
                        )}
                      </div>

                      {/* Prescriber Info */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-gray-700">
                          <Stethoscope className="w-4 h-4 text-gray-400" />
                          <span>{prescription.prescriber.name}</span>
                        </div>
                        <p className="text-sm text-gray-500 ml-6">
                          {prescription.prescriber.facility || prescription.prescriber.registrationNumber}
                        </p>
                      </div>
                    </div>

                    {/* Medicines */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {prescription.items.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-sm ${
                            item.isControlled
                              ? "bg-purple-50 text-purple-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          <Pill className="w-3 h-3" />
                          {item.medicineName}
                          <span className="text-xs text-gray-500">
                            ({item.quantityDispensed}/{item.quantityPrescribed})
                          </span>
                          {item.quantityDispensed >= item.quantityPrescribed ? (
                            <CheckCircle className="w-3 h-3 text-green-500" />
                          ) : item.quantityDispensed > 0 ? (
                            <Clock className="w-3 h-3 text-blue-500" />
                          ) : null}
                        </div>
                      ))}
                      {prescription.items.length > 3 && (
                        <span className="text-sm text-gray-500">
                          +{prescription.items.length - 3} more
                        </span>
                      )}
                    </div>

                    {/* Dates */}
                    <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Issued: {formatDate(prescription.issueDate)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Expires: {formatDate(prescription.expiryDate)}
                      </span>
                      {prescription.refillsAllowed > 0 && (
                        <span>
                          Refills: {prescription.refillsUsed}/{prescription.refillsAllowed}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Link href={`/prescriptions/${prescription.id}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </Link>
                    {(prescription.status === "PENDING" || prescription.status === "PARTIAL") && 
                     !isExpired(prescription.expiryDate) && (
                      <Link href={`/prescriptions/${prescription.id}?dispense=true`}>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                          Dispense
                        </Button>
                      </Link>
                    )}
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
    </div>
  );
}
