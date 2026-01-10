"use client";

import { useEffect, useState } from "react";
import { Package, AlertTriangle, Clock, DollarSign, RefreshCw } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { AlertList } from "@/components/ui/alert-list";
import { RecentActivity } from "@/components/ui/recent-activity";
import { motion } from "framer-motion";

interface DashboardStats {
  totalMedicines: number;
  lowStockCount: number;
  expiringCount: number;
  totalInventoryValue: number;
  lowStockMedicines: Array<{
    id: string;
    name: string;
    quantity: number;
    reorderLevel: number;
    category: string;
  }>;
  expiringItems: Array<{
    id: string;
    name: string;
    expiryDate: string;
    category: string;
  }>;
  recentActivity: Array<{
    id: string;
    name: string;
    category: string;
    updatedAt: string;
    createdAt: string;
  }>;
}

export default function DashboardContent() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStats = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/medicines/stats");
      if (!response.ok) throw new Error("Failed to fetch stats");
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error("Error fetching stats:", err);
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 text-emerald-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{error}</p>
          <button
            onClick={fetchStats}
            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Overview of your pharmacy inventory
          </p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Medicines"
          value={stats?.totalMedicines ?? 0}
          icon={Package}
          color="blue"
        />
        <StatCard
          title="Low Stock Items"
          value={stats?.lowStockCount ?? 0}
          icon={AlertTriangle}
          color="red"
        />
        <StatCard
          title="Expiring Soon (30 days)"
          value={stats?.expiringCount ?? 0}
          icon={Clock}
          color="yellow"
        />
        <StatCard
          title="Inventory Value"
          value={stats?.totalInventoryValue ?? 0}
          icon={DollarSign}
          color="green"
          prefix="$"
        />
      </div>

      {/* Alerts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <AlertList
          title="Low Stock Alerts"
          items={(stats?.lowStockMedicines ?? []).map((item) => ({
            id: item?.id ?? "",
            name: item?.name ?? "Unknown",
            quantity: item?.quantity ?? 0,
            reorderLevel: item?.reorderLevel ?? 10,
            category: item?.category ?? "Uncategorized",
          }))}
          type="lowStock"
        />
        <AlertList
          title="Expiring Soon"
          items={(stats?.expiringItems ?? []).map((item) => ({
            id: item?.id ?? "",
            name: item?.name ?? "Unknown",
            expiryDate: item?.expiryDate ?? "",
            category: item?.category ?? "Uncategorized",
          }))}
          type="expiring"
        />
        <RecentActivity items={stats?.recentActivity ?? []} />
      </div>
    </div>
  );
}
