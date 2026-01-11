import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import dynamic from "next/dynamic";
import { RefreshCw } from "lucide-react";

const AccountMappingsPageClient = dynamic(
  () => import("./_components/account-mappings-page-client"),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    ),
  }
);

export default async function AccountMappingsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  // Only admins can access this page
  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return <AccountMappingsPageClient />;
}
