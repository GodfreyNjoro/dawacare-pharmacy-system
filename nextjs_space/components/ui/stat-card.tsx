"use client";

import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  color: "green" | "red" | "yellow" | "blue";
  prefix?: string;
  suffix?: string;
}

const colorClasses = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  red: "bg-red-50 text-red-700 border-red-200",
  yellow: "bg-amber-50 text-amber-700 border-amber-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
};

const iconColors = {
  green: "bg-emerald-100 text-emerald-600",
  red: "bg-red-100 text-red-600",
  yellow: "bg-amber-100 text-amber-600",
  blue: "bg-blue-100 text-blue-600",
};

export function StatCard({
  title,
  value,
  icon: Icon,
  color,
  prefix = "",
  suffix = "",
}: StatCardProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 1000;
    const steps = 60;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`rounded-xl border p-6 shadow-sm ${colorClasses[color]} hover:shadow-md transition-shadow`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{title}</p>
          <p className="text-3xl font-bold mt-2">
            {prefix}
            {typeof displayValue === "number" && prefix === "$"
              ? displayValue.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : displayValue.toLocaleString()}
            {suffix}
          </p>
        </div>
        <div className={`p-3 rounded-full ${iconColors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </motion.div>
  );
}
