"use client";

import { useSession } from "next-auth/react";
import { Navbar } from "@/components/ui/navbar";

/**
 * PageNav component that renders Navbar only for CASHIER role.
 * For other roles, the Sidebar is rendered by AppShell, so we don't need
 * to render anything here to avoid duplicate navigation.
 */
export function PageNav() {
  const sessionData = useSession();
  const session = sessionData?.data;
  const userRole = session?.user?.role;

  // Only render Navbar for cashiers (they don't have sidebar)
  if (userRole === "CASHIER") {
    return <Navbar />;
  }

  // For other roles, sidebar is rendered by AppShell
  return null;
}
