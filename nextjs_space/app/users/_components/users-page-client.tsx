"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/ui/navbar";
import UsersContent from "./users-content";
import { RefreshCw } from "lucide-react";
import { hasPermission } from "@/lib/permissions";

export default function UsersPageClient() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && status === "unauthenticated") {
      router.replace("/login");
    }
    if (mounted && status === "authenticated" && !hasPermission(session?.user?.role, "VIEW_USERS")) {
      router.replace("/dashboard");
    }
  }, [mounted, status, session, router]);

  if (!mounted || status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (status === "unauthenticated" || !hasPermission(session?.user?.role, "VIEW_USERS")) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="container mx-auto px-4 py-6">
        <UsersContent />
      </main>
    </div>
  );
}
