"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Settings,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  X,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface AccountMapping {
  id: string;
  accountType: string;
  accountCode: string;
  accountName: string;
  description: string | null;
  tallyLedger: string | null;
  sageLedger: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const ACCOUNT_TYPES = [
  { value: "SALES_REVENUE", label: "Sales Revenue" },
  { value: "SALES_TAX", label: "Sales Tax" },
  { value: "INVENTORY_ASSET", label: "Inventory Asset" },
  { value: "COGS", label: "Cost of Goods Sold" },
  { value: "PURCHASE", label: "Purchase" },
  { value: "CASH", label: "Cash" },
  { value: "BANK", label: "Bank" },
  { value: "ACCOUNTS_PAYABLE", label: "Accounts Payable" },
  { value: "ACCOUNTS_RECEIVABLE", label: "Accounts Receivable" },
];

export default function AccountMappingsContent() {
  const [mappings, setMappings] = useState<AccountMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingMapping, setEditingMapping] = useState<AccountMapping | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    accountType: "",
    accountCode: "",
    accountName: "",
    description: "",
    tallyLedger: "",
    sageLedger: "",
    isActive: true,
  });

  const fetchMappings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/account-mappings");
      const data = await response.json();

      if (response.ok) {
        setMappings(data.mappings);
      } else {
        toast.error(data.error || "Failed to fetch account mappings");
      }
    } catch (error) {
      console.error("Error fetching account mappings:", error);
      toast.error("Failed to fetch account mappings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMappings();
  }, [fetchMappings]);

  const handleOpenDialog = (mapping?: AccountMapping) => {
    if (mapping) {
      setEditingMapping(mapping);
      setFormData({
        accountType: mapping.accountType,
        accountCode: mapping.accountCode,
        accountName: mapping.accountName,
        description: mapping.description || "",
        tallyLedger: mapping.tallyLedger || "",
        sageLedger: mapping.sageLedger || "",
        isActive: mapping.isActive,
      });
    } else {
      setEditingMapping(null);
      setFormData({
        accountType: "",
        accountCode: "",
        accountName: "",
        description: "",
        tallyLedger: "",
        sageLedger: "",
        isActive: true,
      });
    }
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingMapping(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.accountType || !formData.accountCode || !formData.accountName) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const url = editingMapping
        ? `/api/account-mappings/${editingMapping.id}`
        : "/api/account-mappings";
      const method = editingMapping ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(
          editingMapping
            ? "Account mapping updated successfully"
            : "Account mapping created successfully"
        );
        handleCloseDialog();
        fetchMappings();
      } else {
        toast.error(data.error || "Failed to save account mapping");
      }
    } catch (error) {
      console.error("Error saving account mapping:", error);
      toast.error("Failed to save account mapping");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this account mapping?")) {
      return;
    }

    try {
      const response = await fetch(`/api/account-mappings/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Account mapping deleted successfully");
        fetchMappings();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete account mapping");
      }
    } catch (error) {
      console.error("Error deleting account mapping:", error);
      toast.error("Failed to delete account mapping");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <Settings className="h-8 w-8 text-emerald-600" />
              Chart of Accounts
            </h1>
            <p className="text-gray-600 mt-1">
              Configure account mappings for exports to accounting software
            </p>
          </div>
          <Button
            onClick={() => handleOpenDialog()}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Mapping
          </Button>
        </div>

        {/* Mappings Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        ) : mappings.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center h-64">
              <Settings className="h-16 w-16 text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg">No account mappings configured</p>
              <Button
                onClick={() => handleOpenDialog()}
                className="mt-4 bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Mapping
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {mappings.map((mapping) => (
              <Card key={mapping.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {ACCOUNT_TYPES.find((t) => t.value === mapping.accountType)?.label ||
                          mapping.accountType}
                      </CardTitle>
                      <p className="text-sm text-gray-500 mt-1">
                        Code: {mapping.accountCode}
                      </p>
                    </div>
                    <Badge variant={mapping.isActive ? "default" : "secondary"}>
                      {mapping.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-gray-500">Account Name:</p>
                      <p className="font-medium">{mapping.accountName}</p>
                    </div>
                    {mapping.tallyLedger && (
                      <div>
                        <p className="text-gray-500">Tally Ledger:</p>
                        <p className="font-medium">{mapping.tallyLedger}</p>
                      </div>
                    )}
                    {mapping.sageLedger && (
                      <div>
                        <p className="text-gray-500">Sage Ledger:</p>
                        <p className="font-medium">{mapping.sageLedger}</p>
                      </div>
                    )}
                    {mapping.description && (
                      <div>
                        <p className="text-gray-500">Description:</p>
                        <p className="text-gray-700">{mapping.description}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(mapping)}
                      className="flex-1"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(mapping.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </motion.div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingMapping ? "Edit Account Mapping" : "Add Account Mapping"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Account Type *</Label>
                <Select
                  value={formData.accountType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, accountType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Account Code *</Label>
                <Input
                  value={formData.accountCode}
                  onChange={(e) =>
                    setFormData({ ...formData, accountCode: e.target.value })
                  }
                  placeholder="e.g., 4000"
                />
              </div>
            </div>

            <div>
              <Label>Account Name *</Label>
              <Input
                value={formData.accountName}
                onChange={(e) =>
                  setFormData({ ...formData, accountName: e.target.value })
                }
                placeholder="e.g., Sales Revenue"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Optional description"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tally Ledger Name</Label>
                <Input
                  value={formData.tallyLedger}
                  onChange={(e) =>
                    setFormData({ ...formData, tallyLedger: e.target.value })
                  }
                  placeholder="e.g., Sales Account"
                />
              </div>
              <div>
                <Label>Sage Ledger Code</Label>
                <Input
                  value={formData.sageLedger}
                  onChange={(e) =>
                    setFormData({ ...formData, sageLedger: e.target.value })
                  }
                  placeholder="e.g., 4000"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData({ ...formData, isActive: e.target.checked })
                }
                className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
              />
              <Label htmlFor="isActive">Active</Label>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle className="h-4 w-4 mr-2" />
                {editingMapping ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
