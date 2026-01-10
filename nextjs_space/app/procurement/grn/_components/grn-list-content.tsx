"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  FileCheck,
  Eye,
  Building2,
  Calendar,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface Supplier {
  id: string;
  name: string;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplier: Supplier;
}

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
  purchaseOrder: PurchaseOrder;
  receivedDate: string;
  receivedBy: string | null;
  status: string;
  createdAt: string;
  items: GRNItem[];
}

const STATUS_COLORS: Record<string, string> = {
  RECEIVED: "bg-emerald-100 text-emerald-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  REJECTED: "bg-red-100 text-red-700",
};

export default function GRNListContent() {
  const [grns, setGrns] = useState<GRN[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchGRNs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "10");
      if (searchQuery) params.set("search", searchQuery);

      const response = await fetch(`/api/grn?${params}`);
      if (response.ok) {
        const data = await response.json();
        setGrns(data.grns);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error("Error fetching GRNs:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery]);

  useEffect(() => {
    const debounce = setTimeout(fetchGRNs, 300);
    return () => clearTimeout(debounce);
  }, [fetchGRNs]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const totalReceived = (items: GRNItem[]) => {
    return items.reduce((sum, item) => sum + item.total, 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Goods Received Notes</h1>
          <p className="text-gray-600">Track received goods and update inventory</p>
        </div>
        <Link href="/procurement/grn/new">
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            Record GRN
          </Button>
        </Link>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by GRN or PO number..."
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

      {/* GRN List */}
      <Card>
        <CardHeader>
          <CardTitle>Received Goods</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto"></div>
            </div>
          ) : grns.length === 0 ? (
            <div className="text-center py-12">
              <FileCheck className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No goods received notes found</p>
              <Link href="/procurement/grn/new">
                <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700">
                  Record First GRN
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {grns.map((grn, index) => (
                <motion.div
                  key={grn.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono font-bold text-emerald-700">
                          {grn.grnNumber}
                        </span>
                        <Badge className={STATUS_COLORS[grn.status]}>
                          {grn.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <FileCheck className="w-4 h-4" />
                          PO: {grn.purchaseOrder.poNumber}
                        </span>
                        <span className="flex items-center gap-1">
                          <Building2 className="w-4 h-4" />
                          {grn.purchaseOrder.supplier.name}
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
                          Received by: {grn.receivedBy || "Unknown"}
                        </p>
                      </div>
                      <Link href={`/procurement/grn/${grn.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
