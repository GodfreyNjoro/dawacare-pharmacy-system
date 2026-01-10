import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import dynamic from "next/dynamic";
import { RefreshCw } from "lucide-react";

const ReportsPageClient = dynamic(
  () => import("./_components/reports-page-client"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    ),
  }
);

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }
  return <ReportsPageClient />;
}
