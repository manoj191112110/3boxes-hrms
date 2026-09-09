'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FinanceDashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/payroll');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-4" />
        <p className="text-sm text-slate-500">Redirecting to Payroll...</p>
      </div>
    </div>
  );
}
