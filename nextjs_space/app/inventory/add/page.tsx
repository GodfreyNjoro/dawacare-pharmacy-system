import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import dynamic from "next/dynamic";

const AddMedicinePageClient = dynamic(
  () => import("./_components/add-medicine-page-client"),
  { ssr: false, loading: () => <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" /></div> }
);

export default async function AddMedicinePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return <AddMedicinePageClient />;
}
