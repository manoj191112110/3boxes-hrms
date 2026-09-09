'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * OAuth Bridge — receives the candidate JWT from the OAuth callback
 * (server route) via query params, stores it in localStorage, then
 * redirects to the dashboard. We need this client-side hop because
 * server routes can't set localStorage.
 */
export default function OAuthBridgePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const email = searchParams.get('email');
    const name = searchParams.get('name');
    if (!token) {
      setError('No token received from OAuth provider.');
      return;
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('tb_candidate_token', token);
      if (email) localStorage.setItem('tb_candidate_email', email);
      if (name) localStorage.setItem('tb_candidate_name', name);
    }
    router.replace('/candidate-portal/dashboard');
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-white to-sky-50 p-4">
      <div className="w-full max-w-md text-center">
        <div className="animate-spin h-10 w-10 border-4 border-teal-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <h1 className="text-lg font-semibold text-slate-800">Signing you in…</h1>
        <p className="text-sm text-slate-500 mt-1">Completing your Google sign-in.</p>
        {error && (
          <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>
        )}
      </div>
    </div>
  );
}
