import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import { hasPermission } from "@/lib/permissions";
import dynamic from "next/dynamic";
import { RefreshCw } from "lucide-react";

const UsersPageClient = dynamic(
  () => import("./_components/users-page-client"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    ),
  }
);

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }
  
  // Check if user has permission to view users
  if (!hasPermission(session.user?.role, "VIEW_USERS")) {
    redirect("/dashboard");
  }
  
  return <UsersPageClient />;
}
