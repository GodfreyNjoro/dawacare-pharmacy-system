"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageNav } from "@/components/ui/page-nav";
import { MedicineForm } from "@/components/ui/medicine-form";
import { Plus, RefreshCw } from "lucide-react";

export default function AddMedicinePageClient() {
  const [mounted, setMounted] = useState(false);
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status;
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && status === "unauthenticated") {
      router.replace("/login");
    }
  }, [mounted, status, router]);

  if (!mounted || status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageNav />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-200">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <Plus className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Add New Medicine</h1>
              <p className="text-gray-500">Enter the details of the new medicine</p>
            </div>
          </div>
          <MedicineForm />
        </div>
      </main>
    </div>
  );
}
