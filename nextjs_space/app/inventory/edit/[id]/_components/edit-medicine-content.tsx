"use client";

import { useEffect, useState } from "react";
import { MedicineForm } from "@/components/ui/medicine-form";
import { Edit, RefreshCw, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface EditMedicineContentProps {
  medicineId: string;
}

interface MedicineData {
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

export default function EditMedicineContent({
  medicineId,
}: EditMedicineContentProps) {
  const [medicine, setMedicine] = useState<MedicineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchMedicine = async () => {
      try {
        const response = await fetch(`/api/medicines/${medicineId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch medicine");
        }
        const data = await response.json();

        // Format data for form
        setMedicine({
          name: data?.name ?? "",
          genericName: data?.genericName ?? "",
          manufacturer: data?.manufacturer ?? "",
          batchNumber: data?.batchNumber ?? "",
          expiryDate: data?.expiryDate
            ? new Date(data.expiryDate).toISOString().split("T")[0]
            : "",
          quantity: (data?.quantity ?? 0).toString(),
          reorderLevel: (data?.reorderLevel ?? 10).toString(),
          unitPrice: (data?.unitPrice ?? 0).toString(),
          category: data?.category ?? "",
        });
      } catch (err) {
        console.error("Error fetching medicine:", err);
        setError("Failed to load medicine details");
      } finally {
        setLoading(false);
      }
    };

    if (medicineId) {
      fetchMedicine();
    }
  }, [medicineId]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12">
        <div className="flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="w-10 h-10 text-emerald-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading medicine details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12">
        <div className="flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">{error}</p>
            <Link
              href="/inventory"
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Back to Inventory
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-200">
        <div className="p-3 bg-blue-100 rounded-lg">
          <Edit className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Medicine</h1>
          <p className="text-gray-500">Update the medicine details</p>
        </div>
      </div>
      {medicine && (
        <MedicineForm
          initialData={medicine}
          isEditing={true}
          medicineId={medicineId}
        />
      )}
    </div>
  );
}
