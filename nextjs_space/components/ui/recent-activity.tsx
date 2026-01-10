"use client";

import { Activity, Plus, Edit } from "lucide-react";
import { motion } from "framer-motion";

interface ActivityItem {
  id: string;
  name: string;
  category?: string;
  updatedAt?: string;
  createdAt?: string;
}

interface RecentActivityProps {
  items: ActivityItem[];
}

export function RecentActivity({ items }: RecentActivityProps) {
  const safeItems = items ?? [];

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const isRecentlyCreated = (item: ActivityItem) => {
    if (!item?.createdAt || !item?.updatedAt) return false;
    const created = new Date(item.createdAt).getTime();
    const updated = new Date(item.updatedAt).getTime();
    return Math.abs(updated - created) < 1000;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
    >
      <div className="px-4 py-3 border-b bg-gray-50 border-gray-200">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-700">Recent Activity</h3>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {safeItems.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <p className="text-sm">No recent activity</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {safeItems.map((item) => (
              <li
                key={item?.id ?? Math.random()}
                className="px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-full ${
                      isRecentlyCreated(item)
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-blue-100 text-blue-600"
                    }`}
                  >
                    {isRecentlyCreated(item) ? (
                      <Plus className="w-4 h-4" />
                    ) : (
                      <Edit className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {item?.name ?? "Unknown"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {isRecentlyCreated(item) ? "Added" : "Updated"} •{" "}
                      {item?.category ?? "Uncategorized"}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {formatDate(item?.updatedAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}
