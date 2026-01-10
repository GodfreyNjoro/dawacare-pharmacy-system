"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Package, TrendingUp, FileSpreadsheet } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SalesReport from "./sales-report";
import StockReport from "./stock-report";
import TopSellersReport from "./top-sellers-report";

export default function ReportsContent() {
  const [activeTab, setActiveTab] = useState("sales");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="text-gray-600 mt-1">
          View detailed reports and analytics for your pharmacy
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-xl grid-cols-3 mb-6">
          <TabsTrigger value="sales" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Sales Report</span>
            <span className="sm:hidden">Sales</span>
          </TabsTrigger>
          <TabsTrigger value="stock" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Stock Report</span>
            <span className="sm:hidden">Stock</span>
          </TabsTrigger>
          <TabsTrigger value="top-sellers" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Top Sellers</span>
            <span className="sm:hidden">Top</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <SalesReport />
        </TabsContent>

        <TabsContent value="stock">
          <StockReport />
        </TabsContent>

        <TabsContent value="top-sellers">
          <TopSellersReport />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
