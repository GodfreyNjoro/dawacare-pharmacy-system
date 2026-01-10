"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Receipt,
  Calendar,
  Filter,
  Eye,
  TrendingUp,
  Banknote,
  CreditCard,
  Smartphone,
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
import Link from "next/link";

interface SaleItem {
  id: string;
  medicineName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Sale {
  id: string;
  invoiceNumber: string;
  customerName: string | null;
  customerPhone: string | null;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  soldBy: string | null;
  createdAt: string;
  items: SaleItem[];
}

interface Stats {
  today: { total: number; count: number };
  week: { total: number; count: number };
  month: { total: number; count: number };
  allTime: { total: number; count: number };
}

const PAYMENT_ICONS: Record<string, React.ReactNode> = {
  CASH: <Banknote className="w-4 h-4" />,
  CARD: <CreditCard className="w-4 h-4" />,
  MPESA: <Smartphone className="w-4 h-4" />,
};

export default function SalesContent() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/sales/stats");
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    };
    fetchStats();
  }, []);

  // Fetch sales
  const fetchSales = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "10");
      if (searchQuery) params.set("search", searchQuery);
      if (paymentFilter) params.set("paymentMethod", paymentFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const response = await fetch(`/api/sales?${params}`);
      if (response.ok) {
        const data = await response.json();
        setSales(data.sales);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error("Error fetching sales:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery, paymentFilter, startDate, endDate]);

  useEffect(() => {
    const debounce = setTimeout(fetchSales, 300);
    return () => clearTimeout(debounce);
  }, [fetchSales]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 lg:p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sales History</h1>
            <p className="text-gray-600">View and manage all sales transactions</p>
          </div>
          <Link href="/pos">
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Receipt className="w-4 h-4 mr-2" />
              New Sale
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Today</p>
                    <p className="text-lg font-bold text-gray-900">
                      KES {stats.today.total.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-600">
                      {stats.today.count} sales
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">This Week</p>
                    <p className="text-lg font-bold text-gray-900">
                      KES {stats.week.total.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-600">
                      {stats.week.count} sales
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Banknote className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">This Month</p>
                    <p className="text-lg font-bold text-gray-900">
                      KES {stats.month.total.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-600">
                      {stats.month.count} sales
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Receipt className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">All Time</p>
                    <p className="text-lg font-bold text-gray-900">
                      KES {stats.allTime.total.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-600">
                      {stats.allTime.count} sales
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by invoice or customer..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9"
                />
              </div>
              <Select
                value={paymentFilter}
                onValueChange={(v) => {
                  setPaymentFilter(v === "all" ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Payment Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                  <SelectItem value="MPESA">M-Pesa</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                placeholder="Start Date"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                placeholder="End Date"
              />
            </div>
          </CardContent>
        </Card>

        {/* Sales List */}
        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto"></div>
                <p className="mt-4 text-gray-500">Loading sales...</p>
              </div>
            ) : sales.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No sales found</p>
                <Link href="/pos">
                  <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700">
                    Make First Sale
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {sales.map((sale, index) => (
                  <motion.div
                    key={sale.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono font-bold text-emerald-700">
                            {sale.invoiceNumber}
                          </span>
                          <Badge
                            variant="secondary"
                            className="flex items-center gap-1"
                          >
                            {PAYMENT_ICONS[sale.paymentMethod]}
                            {sale.paymentMethod}
                          </Badge>
                          <Badge
                            variant={
                              sale.paymentStatus === "PAID"
                                ? "default"
                                : "destructive"
                            }
                            className={
                              sale.paymentStatus === "PAID"
                                ? "bg-emerald-100 text-emerald-700"
                                : ""
                            }
                          >
                            {sale.paymentStatus}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600">
                          <span>{formatDate(sale.createdAt)}</span>
                          {sale.customerName && (
                            <span className="ml-3">
                              Customer: {sale.customerName}
                            </span>
                          )}
                          {sale.soldBy && (
                            <span className="ml-3">By: {sale.soldBy}</span>
                          )}
                        </div>
                        <div className="mt-2 text-sm text-gray-500">
                          {sale.items.length} item(s):{" "}
                          {sale.items
                            .slice(0, 3)
                            .map((item) => item.medicineName)
                            .join(", ")}
                          {sale.items.length > 3 && " ..."}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">
                            KES {sale.total.toFixed(2)}
                          </p>
                          {sale.discount > 0 && (
                            <p className="text-xs text-red-600">
                              Discount: KES {sale.discount.toFixed(2)}
                            </p>
                          )}
                        </div>
                        <Link href={`/sales/${sale.id}`}>
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
    </div>
  );
}
