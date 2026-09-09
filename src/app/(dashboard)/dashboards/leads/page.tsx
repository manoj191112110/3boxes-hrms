'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LeadsDashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/crm/leads');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mx-auto mb-4" />
        <p className="text-sm text-slate-500">Redirecting to Leads...</p>
      </div>
    </div>
  );
}
