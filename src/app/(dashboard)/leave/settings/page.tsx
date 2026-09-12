'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect /leave/settings → /leave/leave-policy (which now has both
 * Policy Documents and Policy Config as tabs).
 */
export default function LeaveSettingsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/leave/leave-policy');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mx-auto mb-4" />
        <p className="text-sm text-slate-500">Redirecting to Leave Policy & Settings...</p>
      </div>
    </div>
  );
}
