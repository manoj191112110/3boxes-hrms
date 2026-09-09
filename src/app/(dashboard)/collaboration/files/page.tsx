'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect page — /collaboration/files now redirects to /file-manager
 * to avoid duplication. The File Manager at /file-manager is the canonical route.
 */
export default function CollaborationFilesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/file-manager');
  }, [router]);
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <p className="text-sm text-thb-text-muted">Redirecting to File Manager...</p>
    </div>
  );
}
