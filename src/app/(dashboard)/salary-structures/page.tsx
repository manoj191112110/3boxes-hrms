'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Salary Structures has been consolidated into CTC Templates under Payroll.
 * This page redirects to /payroll/ctc-templates to avoid duplication.
 */
export default function SalaryStructuresRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/payroll/ctc-templates');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-4" />
        <p className="text-thb-text-secondary text-sm">Redirecting to CTC Templates...</p>
        <p className="text-thb-text-muted text-xs mt-1">
          Salary Structures is now part of Payroll &rarr; CTC Templates
        </p>
      </div>
    </div>
  );
}
