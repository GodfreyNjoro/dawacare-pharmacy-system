import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth-options';
import dynamic from 'next/dynamic';
import { RefreshCw } from 'lucide-react';

const TaxPageClient = dynamic(() => import('./_components/tax-page-client'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
    </div>
  ),
});

export default async function TaxSettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  return <TaxPageClient />;
}
