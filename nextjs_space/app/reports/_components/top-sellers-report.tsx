"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Package,
  DollarSign,
  Hash,
  Download,
  RefreshCw,
  Award,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface TopSeller {
  medicineId: string;
  name: string;
  category: string;
  totalQuantity: number;
  totalRevenue: number;
  transactions: number;
}

interface TopSellersData {
  summary: {
    totalMedicinesSold: number;
    totalRevenue: number;
    uniqueMedicinesSold: number;
    topMedicine: string;
  };
  topByQuantity: TopSeller[];
  topByRevenue: TopSeller[];
  categoryBreakdown: Array<{
    category: string;
    quantity: number;
    revenue: number;
  }>;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

export default function TopSellersReport() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TopSellersData | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [limit, setLimit] = useState("10");
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      params.append("limit", limit);

      const res = await fetch(`/api/reports/top-sellers?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch data");
      const result = await res.json();
      setData(result);
    } catch (error) {
      toast.error("Failed to load top sellers report");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exportToCSV = async () => {
    if (!data) return;
    setExporting(true);
    try {
      const csvRows = [
        ["Top Sellers Report"],
        [`Period: ${startDate} to ${endDate}`],
        [],
        ["Summary"],
        ["Total Medicines Sold", data.summary.totalMedicinesSold],
        ["Total Revenue", `KES ${data.summary.totalRevenue.toFixed(2)}`],
        ["Unique Medicines Sold", data.summary.uniqueMedicinesSold],
        ["Top Medicine", data.summary.topMedicine],
        [],
        ["Top Sellers by Quantity"],
        ["Rank", "Medicine", "Category", "Quantity Sold", "Revenue (KES)", "Transactions"],
        ...data.topByQuantity.map((item, idx) => [
          idx + 1,
          item.name,
          item.category,
          item.totalQuantity,
          item.totalRevenue.toFixed(2),
          item.transactions,
        ]),
        [],
        ["Top Sellers by Revenue"],
        ["Rank", "Medicine", "Category", "Revenue (KES)", "Quantity Sold", "Transactions"],
        ...data.topByRevenue.map((item, idx) => [
          idx + 1,
          item.name,
          item.category,
          item.totalRevenue.toFixed(2),
          item.totalQuantity,
          item.transactions,
        ]),
        [],
        ["Sales by Category"],
        ["Category", "Quantity Sold", "Revenue (KES)"],
        ...data.categoryBreakdown.map((cat) => [
          cat.category,
          cat.quantity,
          cat.revenue.toFixed(2),
        ]),
      ];

      const csvContent = csvRows.map((row) => row.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `top-sellers-${startDate}-to-${endDate}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Report exported successfully");
    } catch (error) {
      toast.error("Failed to export report");
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return `KES ${value.toLocaleString()}`;
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
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label>Show Top</Label>
              <Select value={limit} onValueChange={setLimit}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-100 rounded-full">
                    <Award className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Top Medicine</p>
                    <p className="text-lg font-bold truncate max-w-[150px]">
                      {data.summary.topMedicine}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 rounded-full">
                    <Package className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Units Sold</p>
                    <p className="text-2xl font-bold">
                      {data.summary.totalMedicinesSold.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-100 rounded-full">
                    <DollarSign className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold">
                      KES {(data.summary.totalRevenue / 1000).toFixed(1)}k
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-100 rounded-full">
                    <Hash className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Unique Products</p>
                    <p className="text-2xl font-bold">
                      {data.summary.uniqueMedicinesSold}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Sellers by Quantity */}
            <Card>
              <CardHeader>
                <CardTitle>Top Sellers by Quantity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.topByQuantity.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={120}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip />
                      <Bar dataKey="totalQuantity" fill="#10b981" name="Quantity" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Top Sellers by Revenue */}
            <Card>
              <CardHeader>
                <CardTitle>Top Sellers by Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.topByRevenue.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={120}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                      />
                      <Bar dataKey="totalRevenue" fill="#3b82f6" name="Revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Category Sales Distribution */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Sales by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.categoryBreakdown}
                          dataKey="revenue"
                          nameKey="category"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ category, percent }) =>
                            `${(percent * 100).toFixed(0)}%`
                          }
                        >
                          {data.categoryBreakdown.map((entry, index) => (
                            <Cell
                              key={entry.category}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {data.categoryBreakdown.map((cat, index) => (
                      <div
                        key={cat.category}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="font-medium">{cat.category}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            KES {cat.revenue.toLocaleString()}
                          </p>
                          <p className="text-sm text-gray-500">
                            {cat.quantity} units
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Sellers List */}
          <Card>
            <CardHeader>
              <CardTitle>Top {limit} Best Sellers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.topByQuantity.map((item, index) => (
                  <motion.div
                    key={item.medicineId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold">{item.name}</h4>
                      <Badge variant="outline" className="mt-1">
                        {item.category}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-emerald-600">
                        {item.totalQuantity} units
                      </p>
                      <p className="text-sm text-gray-500">
                        KES {item.totalRevenue.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      {item.transactions} sales
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </motion.div>
  );
}
