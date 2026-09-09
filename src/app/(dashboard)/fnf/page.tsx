'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * F&F Settlement has been consolidated under Payroll.
 * This page redirects to /payroll/fnf to avoid duplication.
 */
export default function FNFRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/payroll/fnf');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-4" />
        <p className="text-thb-text-secondary text-sm">Redirecting to F&F Settlement...</p>
        <p className="text-thb-text-muted text-xs mt-1">
          F&F Settlement is now part of Payroll &rarr; F&F Settlement
        </p>
      </div>
    </div>
  );
}
