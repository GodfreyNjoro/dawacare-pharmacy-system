"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { PageLayout } from "@/components/ui/page-nav";
import ExportsContent from "./exports-content";

export default function ExportsPageClient() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (!isMounted || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <PageLayout>
      <ExportsContent />
    </PageLayout>
  );
}
