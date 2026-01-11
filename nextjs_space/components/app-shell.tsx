"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, ReactNode } from "react";
import { Navbar } from "@/components/ui/navbar";
import { Sidebar } from "@/components/ui/sidebar";
import { RefreshCw } from "lucide-react";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [mounted, setMounted] = useState(false);
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status;
  const router = useRouter();
  const pathname = usePathname();

  const userRole = session?.user?.role;
  const isCashier = userRole === "CASHIER";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && status === "unauthenticated" && pathname !== "/login") {
      router.replace("/login");
    }
  }, [mounted, status, pathname, router]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  if (!session && pathname !== "/login") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  // Cashiers get top navbar, others get sidebar
  if (session && isCashier) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        {children}
      </div>
    );
  }

  // Non-cashiers get sidebar layout
  return (
    <div className="min-h-screen bg-gray-50">
      {session && <Sidebar />}
      <div className={session ? "ml-64" : ""}>
        {children}
      </div>
    </div>
  );
}
