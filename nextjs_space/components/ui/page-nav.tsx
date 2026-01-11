"use client";

import { useSession } from "next-auth/react";
import { Navbar } from "@/components/ui/navbar";
import { Sidebar } from "@/components/ui/sidebar";
import { ReactNode } from "react";

/**
 * PageNav component that renders appropriate navigation based on user role.
 * - Cashiers get the top Navbar (simpler, POS-focused interface)
 * - Other roles get the left Sidebar (full navigation)
 */
export function PageNav() {
  const sessionData = useSession();
  const session = sessionData?.data;
  const userRole = session?.user?.role;

  if (!session) return null;

  // Cashiers get top navbar
  if (userRole === "CASHIER") {
    return <Navbar />;
  }

  // Other roles get sidebar
  return <Sidebar />;
}

/**
 * PageLayout wrapper that provides appropriate layout based on user role.
 * Adds left margin for sidebar users.
 */
export function PageLayout({ children }: { children: ReactNode }) {
  const sessionData = useSession();
  const session = sessionData?.data;
  const userRole = session?.user?.role;

  const isCashier = userRole === "CASHIER";

  return (
    <div className={`min-h-screen bg-gray-50 ${!isCashier && session ? "ml-64" : ""}`}>
      <PageNav />
      {children}
    </div>
  );
}
