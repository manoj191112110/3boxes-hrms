'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiCheckSquare } from 'react-icons/fi';

export default function OnboardingTasksPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/onboarding');
  }, [router]);
  
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-4" />
        <p className="text-sm text-thb-text-secondary">Redirecting...</p>
      </div>
    </div>
  );
}
