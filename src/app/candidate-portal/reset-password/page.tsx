'use client';
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const email = searchParams.get('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !email) {
      setError('Invalid reset link — token or email is missing.');
      return;
    }
    // Auto-submit the token immediately (magic-link login)
    (async () => {
      setLoading(true);
      try {
        const r = await fetch('/api/candidate-portal/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, token }),
        });
        const d = await r.json();
        if (!r.ok) {
          setError(d.error || 'Reset failed');
          return;
        }
        // Store the candidate JWT and redirect to dashboard
        if (typeof window !== 'undefined') {
          localStorage.setItem('tb_candidate_token', d.token);
        }
        router.push('/candidate-portal/dashboard');
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Network error');
      } finally {
        setLoading(false);
      }
    })();
  }, [token, email, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-teal-600 items-center justify-center mb-3">
            <svg viewBox="0 0 35 11" className="w-7 h-3" fill="none">
              <rect x="0" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
              <rect x="13" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
              <rect x="26" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Verifying your reset link…</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6 text-center">
          {loading && (
            <div className="space-y-3">
              <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto"></div>
              <div className="text-sm text-gray-600">Verifying token and logging you in…</div>
            </div>
          )}
          {error && (
            <div className="space-y-3">
              <div className="text-5xl">⚠️</div>
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>
              <Link href="/candidate-portal/forgot-password" className="inline-block px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700">
                Request a new link
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
