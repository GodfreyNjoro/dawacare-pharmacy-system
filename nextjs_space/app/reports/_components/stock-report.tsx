"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Package,
  AlertTriangle,
  XCircle,
  Clock,
  DollarSign,
  Download,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { toast } from "sonner";

interface Medicine {
  id: string;
  name: string;
  category: string;
  quantity: number;
  minStockLevel: number;
  sellingPrice: number;
  expiryDate: string;
  batchNumber: string;
  status: string;
  isLowStock: boolean;
  isOutOfStock: boolean;
  isExpiringSoon: boolean;
  isExpired: boolean;
}

interface StockData {
  summary: {
    totalProducts: number;
    totalValue: number;
    lowStockCount: number;
    outOfStockCount: number;
    expiringSoonCount: number;
    expiredCount: number;
  };
  medicines: Medicine[];
  stockByCategory: Array<{
    category: string;
    count: number;
    totalQuantity: number;
    totalValue: number;
  }>;
  categories: string[];
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const statusColors: Record<string, string> = {
  normal: "bg-emerald-100 text-emerald-800",
  low_stock: "bg-amber-100 text-amber-800",
  out_of_stock: "bg-red-100 text-red-800",
  expiring_soon: "bg-orange-100 text-orange-800",
  expired: "bg-gray-100 text-gray-800",
};

export default function StockReport() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StockData | null>(null);
  const [category, setCategory] = useState("all");
  const [stockStatus, setStockStatus] = useState("all");
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category && category !== "all") params.append("category", category);
      if (stockStatus) params.append("stockStatus", stockStatus);

      const res = await fetch(`/api/reports/stock?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch data");
      const result = await res.json();
      setData(result);
    } catch (error) {
      toast.error("Failed to load stock report");
    } finally {
      setLoading(false);
    }
  }, [category, stockStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exportToCSV = async () => {
    if (!data) return;
    setExporting(true);
    try {
      const csvRows = [
        ["Stock Report"],
        [`Generated: ${new Date().toLocaleDateString()}`],
        [],
        ["Summary"],
        ["Total Products", data.summary.totalProducts],
        ["Total Stock Value", `KES ${data.summary.totalValue.toFixed(2)}`],
        ["Low Stock Items", data.summary.lowStockCount],
        ["Out of Stock Items", data.summary.outOfStockCount],
        ["Expiring Soon", data.summary.expiringSoonCount],
        ["Expired Items", data.summary.expiredCount],
        [],
        ["Stock by Category"],
        ["Category", "Products", "Total Qty", "Value (KES)"],
        ...data.stockByCategory.map((c) => [
          c.category,
          c.count,
          c.totalQuantity,
          c.totalValue.toFixed(2),
        ]),
        [],
        ["Medicine Details"],
        ["Name", "Category", "Batch", "Quantity", "Min Stock", "Price (KES)", "Expiry", "Status"],
        ...data.medicines.map((m) => [
          m.name,
          m.category,
          m.batchNumber,
          m.quantity,
          m.minStockLevel,
          m.sellingPrice.toFixed(2),
          new Date(m.expiryDate).toLocaleDateString(),
          m.status,
        ]),
      ];

      const csvContent = csvRows.map((row) => row.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stock-report-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Report exported successfully");
    } catch (error) {
      toast.error("Failed to export report");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {data?.categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Stock Status</Label>
              <Select value={stockStatus} onValueChange={setStockStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="low">Low Stock</SelectItem>
                  <SelectItem value="out">Out of Stock</SelectItem>
                  <SelectItem value="expiring">Expiring Soon</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={fetchData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={exportToCSV} disabled={exporting}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <Package className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Total Products</p>
                    <p className="text-xl font-bold">
                      {data.summary.totalProducts}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <DollarSign className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Stock Value</p>
                    <p className="text-xl font-bold">
                      KES {(data.summary.totalValue / 1000).toFixed(0)}k
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Low Stock</p>
                    <p className="text-xl font-bold">
                      {data.summary.lowStockCount}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <XCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Out of Stock</p>
                    <p className="text-xl font-bold">
                      {data.summary.outOfStockCount}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Clock className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Expiring Soon</p>
                    <p className="text-xl font-bold">
                      {data.summary.expiringSoonCount}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <XCircle className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Expired</p>
                    <p className="text-xl font-bold">
                      {data.summary.expiredCount}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stock by Category Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Stock Value by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.stockByCategory} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                      />
                      <YAxis dataKey="category" type="category" width={100} />
                      <Tooltip
                        formatter={(value: number) => [
                          `KES ${value.toLocaleString()}`,
                          "Value",
                        ]}
                      />
                      <Bar dataKey="totalValue" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Category Distribution Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Products by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.stockByCategory}
                        dataKey="count"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ category, percent }) =>
                          `${category} ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {data.stockByCategory.map((entry, index) => (
                          <Cell
                            key={entry.category}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Medicine Table */}
          <Card>
            <CardHeader>
              <CardTitle>Inventory Details ({data.medicines.length} items)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medicine</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">Min Level</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.medicines.slice(0, 50).map((med) => (
                      <TableRow key={med.id}>
                        <TableCell className="font-medium">{med.name}</TableCell>
                        <TableCell>{med.category}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {med.batchNumber}
                        </TableCell>
                        <TableCell className="text-right">
                          {med.quantity}
                        </TableCell>
                        <TableCell className="text-right">
                          {med.minStockLevel}
                        </TableCell>
                        <TableCell className="text-right">
                          KES {med.sellingPrice.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {new Date(med.expiryDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={statusColors[med.status] || "bg-gray-100"}
                          >
                            {med.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {data.medicines.length > 50 && (
                  <p className="text-sm text-gray-500 mt-4 text-center">
                    Showing 50 of {data.medicines.length} items. Export for full list.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </motion.div>
  );
}
