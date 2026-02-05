'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { PageLayout } from '@/components/ui/page-nav';
import TaxSettingsContent from './tax-settings-content';

export default function TaxPageClient() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (!mounted || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return (
    <PageLayout>
      <main className="container mx-auto px-4 py-6">
        <TaxSettingsContent />
      </main>
    </PageLayout>
  );
}
