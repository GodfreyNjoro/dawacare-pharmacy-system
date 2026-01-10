"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  DollarSign,
  ShoppingCart,
  Package,
  TrendingUp,
  Download,
  RefreshCw,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  LineChart,
  Line,
} from "recharts";
import { toast } from "sonner";

interface SalesData {
  summary: {
    totalRevenue: number;
    totalTransactions: number;
    totalItems: number;
    averageTransaction: number;
  };
  chartData: Array<{
    period: string;
    revenue: number;
    transactions: number;
    items: number;
  }>;
  paymentBreakdown: Array<{
    method: string;
    total: number;
    count: number;
  }>;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function SalesReport() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SalesData | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [groupBy, setGroupBy] = useState("day");
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      params.append("groupBy", groupBy);

      const res = await fetch(`/api/reports/sales?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch data");
      const result = await res.json();
      setData(result);
    } catch (error) {
      toast.error("Failed to load sales report");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, groupBy]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exportToCSV = async () => {
    if (!data) return;
    setExporting(true);
    try {
      const csvRows = [
        ["Sales Report"],
        [`Period: ${startDate} to ${endDate}`],
        [],
        ["Summary"],
        ["Total Revenue", `KES ${data.summary.totalRevenue.toFixed(2)}`],
        ["Total Transactions", data.summary.totalTransactions],
        ["Total Items Sold", data.summary.totalItems],
        ["Average Transaction", `KES ${data.summary.averageTransaction.toFixed(2)}`],
        [],
        ["Sales by Period"],
        ["Period", "Revenue (KES)", "Transactions", "Items Sold"],
        ...data.chartData.map((d) => [d.period, d.revenue.toFixed(2), d.transactions, d.items]),
        [],
        ["Payment Method Breakdown"],
        ["Method", "Total (KES)", "Count"],
        ...data.paymentBreakdown.map((p) => [p.method, p.total.toFixed(2), p.count]),
      ];

      const csvContent = csvRows.map((row) => row.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales-report-${startDate}-to-${endDate}.csv`;
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
              <Label>Group By</Label>
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
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
                    <DollarSign className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold">
                      KES {data.summary.totalRevenue.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 rounded-full">
                    <ShoppingCart className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Transactions</p>
                    <p className="text-2xl font-bold">
                      {data.summary.totalTransactions.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-100 rounded-full">
                    <Package className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Items Sold</p>
                    <p className="text-2xl font-bold">
                      {data.summary.totalItems.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-100 rounded-full">
                    <TrendingUp className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Avg Transaction</p>
                    <p className="text-2xl font-bold">
                      KES {data.summary.averageTransaction.toFixed(0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Trend */}
            <Card className="col-span-1 lg:col-span-2">
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="period"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) =>
                          groupBy === "month"
                            ? value
                            : value.substring(5)
                        }
                      />
                      <YAxis
                        tickFormatter={(value) =>
                          `${(value / 1000).toFixed(0)}k`
                        }
                      />
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ fill: "#10b981" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Transactions Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Transactions & Items Sold</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="period"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) => value.substring(5)}
                      />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="transactions"
                        fill="#3b82f6"
                        name="Transactions"
                      />
                      <Bar dataKey="items" fill="#10b981" name="Items" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Payment Methods Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Methods</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.paymentBreakdown}
                        dataKey="total"
                        nameKey="method"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ method, percent }) =>
                          `${method} ${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {data.paymentBreakdown.map((entry, index) => (
                          <Cell
                            key={entry.method}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </motion.div>
  );
}
