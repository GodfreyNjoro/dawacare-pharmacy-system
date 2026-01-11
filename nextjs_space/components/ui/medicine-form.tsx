"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import Link from "next/link";

interface MedicineFormData {
  name: string;
  genericName: string;
  manufacturer: string;
  batchNumber: string;
  expiryDate: string;
  quantity: string;
  reorderLevel: string;
  unitPrice: string;
  category: string;
}

interface MedicineFormProps {
  initialData?: MedicineFormData;
  isEditing?: boolean;
  medicineId?: string;
}

const CATEGORIES = [
  "Antibiotics",
  "Painkillers",
  "Vitamins",
  "Antacids",
  "Antihistamines",
  "Cardiovascular",
  "Diabetes",
  "Dermatological",
  "Respiratory",
  "Other",
];

export function MedicineForm({
  initialData,
  isEditing = false,
  medicineId,
}: MedicineFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState<MedicineFormData>({
    name: "",
    genericName: "",
    manufacturer: "",
    batchNumber: "",
    expiryDate: "",
    quantity: "",
    reorderLevel: "10",
    unitPrice: "",
    category: "",
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleChange = (field: keyof MedicineFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const validateForm = (): string | null => {
    if (!formData.name?.trim()) return "Medicine name is required";
    if (!formData.batchNumber?.trim()) return "Batch number is required";
    if (!formData.expiryDate) return "Expiry date is required";
    if (!formData.quantity?.trim()) return "Quantity is required";
    if (!formData.unitPrice?.trim()) return "Unit price is required";
    if (!formData.category) return "Category is required";

    const quantity = parseInt(formData.quantity);
    if (isNaN(quantity) || quantity < 0) return "Quantity must be a positive number";

    const price = parseFloat(formData.unitPrice);
    if (isNaN(price) || price <= 0) return "Unit price must be greater than 0";

    if (!isEditing) {
      const expiryDate = new Date(formData.expiryDate);
      if (expiryDate <= new Date()) return "Expiry date must be in the future";
    }

    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const url = isEditing ? `/api/medicines/${medicineId}` : "/api/medicines";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          quantity: parseInt(formData.quantity),
          reorderLevel: parseInt(formData.reorderLevel ?? "10"),
          unitPrice: parseFloat(formData.unitPrice),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to save medicine");
      }

      router.push("/inventory");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Medicine Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Medicine Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name ?? ""}
            onChange={(e) => handleChange("name", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
            placeholder="Enter medicine name"
          />
        </div>

        {/* Generic Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Generic Name
          </label>
          <input
            type="text"
            value={formData.genericName ?? ""}
            onChange={(e) => handleChange("genericName", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
            placeholder="Enter generic name"
          />
        </div>

        {/* Manufacturer */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Manufacturer
          </label>
          <input
            type="text"
            value={formData.manufacturer ?? ""}
            onChange={(e) => handleChange("manufacturer", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
            placeholder="Enter manufacturer"
          />
        </div>

        {/* Batch Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Batch Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.batchNumber ?? ""}
            onChange={(e) => handleChange("batchNumber", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
            placeholder="Enter batch number"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Category <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.category ?? ""}
            onChange={(e) => handleChange("category", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors bg-white"
          >
            <option value="">Select category</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Expiry Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Expiry Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={formData.expiryDate ?? ""}
            onChange={(e) => handleChange("expiryDate", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
          />
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quantity in Stock <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="0"
            value={formData.quantity ?? ""}
            onChange={(e) => handleChange("quantity", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
            placeholder="Enter quantity"
          />
        </div>

        {/* Reorder Level */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reorder Level
          </label>
          <input
            type="number"
            min="0"
            value={formData.reorderLevel ?? "10"}
            onChange={(e) => handleChange("reorderLevel", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
            placeholder="Enter reorder level"
          />
        </div>

        {/* Unit Price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Unit Price (KES) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={formData.unitPrice ?? ""}
            onChange={(e) => handleChange("unitPrice", e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
            placeholder="Enter unit price"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-6 border-t border-gray-200">
        <Link
          href="/inventory"
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Inventory
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {isEditing ? "Update Medicine" : "Add Medicine"}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
