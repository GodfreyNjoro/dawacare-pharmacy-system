import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import dynamic from "next/dynamic";

const AuditLogsPageClient = dynamic(
  () => import("./_components/audit-logs-page-client"),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    ),
  }
);

export default async function AuditLogsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  // Only admins can access audit logs
  if (session.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return <AuditLogsPageClient />;
}
