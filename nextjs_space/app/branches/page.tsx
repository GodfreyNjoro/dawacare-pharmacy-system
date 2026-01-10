import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import dynamic from "next/dynamic";
import { RefreshCw } from "lucide-react";

const BranchesPageClient = dynamic(
  () => import("./_components/branches-page-client"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    ),
  }
);

export default async function BranchesPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  // Only admins can access branch management
  if (session.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return <BranchesPageClient />;
}
