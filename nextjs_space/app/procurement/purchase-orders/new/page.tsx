import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import dynamic from "next/dynamic";

const NewPOPageClient = dynamic(
  () => import("./_components/new-po-page-client"),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    ),
  }
);

export default async function NewPurchaseOrderPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return <NewPOPageClient />;
}
