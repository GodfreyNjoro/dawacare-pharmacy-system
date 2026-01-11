"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Download,
  FileText,
  FileSpreadsheet,
  History,
  RefreshCw,
  Calendar,
  Building2,
  FileCode,
  X,
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
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ExportHistory {
  id: string;
  exportType: string;
  format: string;
  dateFrom: string;
  dateTo: string;
  recordCount: number;
  fileName: string;
  status: string;
  branch?: { name: string };
  createdAt: string;
}

interface Branch {
  id: string;
  name: string;
  code: string;
}

export default function ExportsContent() {
  const { data: session } = useSession() || {};
  const [history, setHistory] = useState<ExportHistory[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportType, setExportType] = useState("");

  // Form state
  const [dateFrom, setDateFrom] = useState(
    new Date(new Date().setDate(new Date().getDate() - 30))
      .toISOString()
      .split("T")[0]
  );
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [format, setFormat] = useState("csv");

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/exports/history");
      const data = await response.json();

      if (response.ok) {
        setHistory(data.history);
      } else {
        toast.error(data.error || "Failed to fetch export history");
      }
    } catch (error) {
      console.error("Error fetching export history:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBranches = useCallback(async () => {
    try {
      const response = await fetch("/api/branches");
      const data = await response.json();

      if (response.ok) {
        setBranches(data.branches || []);
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    if (session?.user?.role === "ADMIN") {
      fetchBranches();
    }
  }, [fetchHistory, fetchBranches, session]);

  const handleExport = async (type: string) => {
    setExportType(type);
    setShowExportDialog(true);
  };

  const executeExport = async () => {
    if (!dateFrom || !dateTo) {
      toast.error("Please select date range");
      return;
    }

    try {
      setExporting(true);
      let url = "";

      switch (exportType) {
        case "sales":
          url = `/api/exports/sales?dateFrom=${dateFrom}&dateTo=${dateTo}&format=${format}`;
          break;
        case "purchases":
          url = `/api/exports/purchases?dateFrom=${dateFrom}&dateTo=${dateTo}&format=${format}`;
          break;
        case "inventory":
          url = `/api/exports/inventory?format=${format}`;
          break;
        case "tally":
          url = `/api/exports/tally?dateFrom=${dateFrom}&dateTo=${dateTo}`;
          break;
        case "sage":
          url = `/api/exports/sage?dateFrom=${dateFrom}&dateTo=${dateTo}`;
          break;
        default:
          toast.error("Invalid export type");
          return;
      }

      if (selectedBranch) {
        url += `&branchId=${selectedBranch}`;
      }

      const response = await fetch(url);

      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = response.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") || "export.csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);

        toast.success("Export completed successfully");
        setShowExportDialog(false);
        fetchHistory();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to export data");
      }
    } catch (error) {
      console.error("Error exporting data:", error);
      toast.error("Failed to export data");
    } finally {
      setExporting(false);
    }
  };

  const getExportLabel = (type: string) => {
    const labels: Record<string, string> = {
      sales: "Sales Export",
      purchases: "Purchases Export",
      inventory: "Inventory Export",
      tally: "Tally Export",
      sage: "Sage Export",
    };
    return labels[type] || type;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <Download className="h-8 w-8 text-emerald-600" />
            Accounting Exports
          </h1>
          <p className="text-gray-600 mt-1">
            Export financial data to CSV, XML, Tally, or Sage formats
          </p>
        </div>

        {/* Export Options */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => handleExport("sales")}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                Sales Export
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Export sales transactions with customer details and payment information
              </p>
              <Button
                className="mt-4 w-full bg-blue-600 hover:bg-blue-700"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExport("sales");
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Sales
              </Button>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => handleExport("purchases")}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-purple-600" />
                Purchases Export
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Export purchase orders with supplier details and receiving information
              </p>
              <Button
                className="mt-4 w-full bg-purple-600 hover:bg-purple-700"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExport("purchases");
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Purchases
              </Button>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => handleExport("inventory")}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-orange-600" />
                Inventory Export
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Export current inventory levels with stock values and expiry dates
              </p>
              <Button
                className="mt-4 w-full bg-orange-600 hover:bg-orange-700"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExport("inventory");
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Inventory
              </Button>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => handleExport("tally")}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileCode className="h-5 w-5 text-green-600" />
                Tally Export
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Export vouchers in Tally-compatible XML format for direct import
              </p>
              <Button
                className="mt-4 w-full bg-green-600 hover:bg-green-700"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExport("tally");
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export to Tally
              </Button>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => handleExport("sage")}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-teal-600" />
                Sage Export
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Export transactions in Sage-compatible CSV format for direct import
              </p>
              <Button
                className="mt-4 w-full bg-teal-600 hover:bg-teal-700"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExport("sage");
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export to Sage
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Export History */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-emerald-600" />
                Export History
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchHistory}
                disabled={loading}
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No exports yet. Start by exporting some data above.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Date
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Type
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Format
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Records
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Branch
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr key={item.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm">
                          {new Date(item.createdAt).toLocaleDateString()}
                          <br />
                          <span className="text-gray-500 text-xs">
                            {new Date(item.createdAt).toLocaleTimeString()}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline">{item.exportType}</Badge>
                        </td>
                        <td className="py-3 px-4 text-sm">{item.format}</td>
                        <td className="py-3 px-4 text-sm">{item.recordCount}</td>
                        <td className="py-3 px-4 text-sm">
                          {item.branch?.name || "All"}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={item.status === "COMPLETED" ? "default" : "secondary"}
                          >
                            {item.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getExportLabel(exportType)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {exportType !== "inventory" && (
              <>
                <div>
                  <Label>Date From</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    max={dateTo}
                  />
                </div>
                <div>
                  <Label>Date To</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    min={dateFrom}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
              </>
            )}

            {session?.user?.role === "ADMIN" && branches.length > 0 && (
              <div>
                <Label>Branch (Optional)</Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger>
                    <SelectValue placeholder="All branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All branches</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {exportType !== "tally" && exportType !== "sage" && (
              <div>
                <Label>Format</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowExportDialog(false)}
                disabled={exporting}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={executeExport}
                disabled={exporting}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {exporting ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {exporting ? "Exporting..." : "Export"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
