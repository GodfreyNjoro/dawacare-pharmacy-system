"use client";

import { AlertTriangle, Clock, Package } from "lucide-react";
import { motion } from "framer-motion";

interface AlertItem {
  id: string;
  name: string;
  quantity?: number;
  reorderLevel?: number;
  expiryDate?: string;
  category?: string;
}

interface AlertListProps {
  title: string;
  items: AlertItem[];
  type: "lowStock" | "expiring";
}

export function AlertList({ title, items, type }: AlertListProps) {
  const safeItems = items ?? [];

  const getExpiryDays = (dateStr?: string) => {
    if (!dateStr) return 0;
    const expiry = new Date(dateStr);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
    >
      <div
        className={`px-4 py-3 border-b ${
          type === "lowStock"
            ? "bg-red-50 border-red-200"
            : "bg-amber-50 border-amber-200"
        }`}
      >
        <div className="flex items-center gap-2">
          {type === "lowStock" ? (
            <Package className="w-5 h-5 text-red-600" />
          ) : (
            <Clock className="w-5 h-5 text-amber-600" />
          )}
          <h3
            className={`font-semibold ${
              type === "lowStock" ? "text-red-700" : "text-amber-700"
            }`}
          >
            {title}
          </h3>
          <span
            className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${
              type === "lowStock"
                ? "bg-red-100 text-red-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {safeItems.length}
          </span>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {safeItems.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <p className="text-sm">No alerts at this time</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {safeItems.map((item) => (
              <li
                key={item?.id ?? Math.random()}
                className="px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {item?.name ?? "Unknown"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {item?.category ?? "Uncategorized"}
                    </p>
                  </div>
                  {type === "lowStock" ? (
                    <div className="text-right">
                      <p className="text-red-600 font-semibold">
                        {item?.quantity ?? 0} left
                      </p>
                      <p className="text-xs text-gray-500">
                        Reorder: {item?.reorderLevel ?? 10}
                      </p>
                    </div>
                  ) : (
                    <div className="text-right">
                      <p
                        className={`font-semibold ${
                          getExpiryDays(item?.expiryDate) <= 7
                            ? "text-red-600"
                            : "text-amber-600"
                        }`}
                      >
                        {getExpiryDays(item?.expiryDate)} days
                      </p>
                      <p className="text-xs text-gray-500">
                        {item?.expiryDate
                          ? new Date(item.expiryDate).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}
