"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  Edit,
  Trash2,
  AlertTriangle,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { DeleteModal } from "./delete-modal";

interface Medicine {
  id: string;
  name: string;
  genericName?: string;
  manufacturer?: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  reorderLevel: number;
  unitPrice: number;
  category: string;
}

interface MedicineTableProps {
  medicines: Medicine[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  sortBy: string;
  sortOrder: string;
  onSort: (field: string) => void;
  onPageChange: (page: number) => void;
  onDelete: (id: string) => Promise<void>;
}

export function MedicineTable({
  medicines,
  pagination,
  sortBy,
  sortOrder,
  onSort,
  onPageChange,
  onDelete,
}: MedicineTableProps) {
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    id: string;
    name: string;
  }>({ isOpen: false, id: "", name: "" });
  const [isDeleting, setIsDeleting] = useState(false);

  const safeMedicines = medicines ?? [];
  const safePagination = pagination ?? { total: 0, page: 1, limit: 10, totalPages: 1 };

  const isLowStock = (med: Medicine) => (med?.quantity ?? 0) <= (med?.reorderLevel ?? 10);

  const isExpiringSoon = (dateStr?: string) => {
    if (!dateStr) return false;
    const expiry = new Date(dateStr);
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return expiry <= thirtyDays && expiry > now;
  };

  const isExpired = (dateStr?: string) => {
    if (!dateStr) return false;
    const expiry = new Date(dateStr);
    return expiry < new Date();
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteModal({ isOpen: true, id, name });
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete?.(deleteModal.id);
    } finally {
      setIsDeleting(false);
      setDeleteModal({ isOpen: false, id: "", name: "" });
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <ChevronDown className="w-4 h-4 opacity-30" />;
    return sortOrder === "asc" ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  const sortableHeaders = [
    { key: "name", label: "Medicine Name" },
    { key: "category", label: "Category" },
    { key: "batchNumber", label: "Batch #" },
    { key: "quantity", label: "Qty" },
    { key: "unitPrice", label: "Price" },
    { key: "expiryDate", label: "Expiry" },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {sortableHeaders.map((header) => (
                <th
                  key={header.key}
                  className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => onSort?.(header.key)}
                >
                  <div className="flex items-center gap-1">
                    {header.label}
                    <SortIcon field={header.key} />
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Status
              </th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {safeMedicines.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                  No medicines found
                </td>
              </tr>
            ) : (
              safeMedicines.map((medicine) => (
                <tr
                  key={medicine?.id ?? Math.random()}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">
                        {medicine?.name ?? "Unknown"}
                      </p>
                      {medicine?.genericName && (
                        <p className="text-sm text-gray-500">
                          {medicine.genericName}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                      {medicine?.category ?? "N/A"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm">
                    {medicine?.batchNumber ?? "N/A"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`font-semibold ${
                        isLowStock(medicine)
                          ? "text-red-600"
                          : "text-gray-900"
                      }`}
                    >
                      {medicine?.quantity ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    ${(medicine?.unitPrice ?? 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-sm ${
                        isExpired(medicine?.expiryDate)
                          ? "text-red-600 font-semibold"
                          : isExpiringSoon(medicine?.expiryDate)
                          ? "text-amber-600 font-semibold"
                          : "text-gray-600"
                      }`}
                    >
                      {medicine?.expiryDate
                        ? new Date(medicine.expiryDate).toLocaleDateString()
                        : "N/A"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isLowStock(medicine) && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
                          <AlertTriangle className="w-3 h-3" />
                          Low Stock
                        </span>
                      )}
                      {isExpiringSoon(medicine?.expiryDate) && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                          <Clock className="w-3 h-3" />
                          Expiring
                        </span>
                      )}
                      {isExpired(medicine?.expiryDate) && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
                          <AlertTriangle className="w-3 h-3" />
                          Expired
                        </span>
                      )}
                      {!isLowStock(medicine) &&
                        !isExpiringSoon(medicine?.expiryDate) &&
                        !isExpired(medicine?.expiryDate) && (
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">
                            Good
                          </span>
                        )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/inventory/edit/${medicine?.id}`}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() =>
                          handleDeleteClick(
                            medicine?.id ?? "",
                            medicine?.name ?? "Unknown"
                          )
                        }
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {safePagination.totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <p className="text-sm text-gray-600">
            Showing {(safePagination.page - 1) * safePagination.limit + 1} to{" "}
            {Math.min(
              safePagination.page * safePagination.limit,
              safePagination.total
            )}{" "}
            of {safePagination.total} results
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange?.(safePagination.page - 1)}
              disabled={safePagination.page === 1}
              className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-600">
              Page {safePagination.page} of {safePagination.totalPages}
            </span>
            <button
              onClick={() => onPageChange?.(safePagination.page + 1)}
              disabled={safePagination.page === safePagination.totalPages}
              className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <DeleteModal
        isOpen={deleteModal.isOpen}
        medicineName={deleteModal.name}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, id: "", name: "" })}
        isDeleting={isDeleting}
      />
    </div>
  );
}
