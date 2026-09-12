'use client';
import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { validateEmail } from '@/lib/validators';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      toast.error(emailResult.error!);
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    setMagicLink(null);
    try {
      const r = await fetch('/api/candidate-portal/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || 'Failed to send reset link');
        return;
      }
      setMessage(d.message || 'If an account exists for that email, a password-reset link has been sent. The link expires in 30 minutes.');
      if (d.magicLink) setMagicLink(d.magicLink);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

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
          <h1 className="text-2xl font-bold text-white">Reset your password</h1>
          <p className="text-sm text-slate-400 mt-1">We'll email you a secure magic link to log back in.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
          {message ? (
            <div className="text-center space-y-4">
              <div className="text-5xl">📧</div>
              <div className="text-sm text-gray-700">{message}</div>
              {magicLink && (
                <div className="space-y-2">
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 text-left">
                    <strong>Demo mode:</strong> Email delivery is not configured yet.
                    Use the link below to log in directly:
                  </div>
                  <a
                    href={magicLink}
                    className="inline-block w-full px-4 py-2.5 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-md text-sm hover:from-green-700 hover:to-teal-700 font-medium"
                  >
                    Open Magic Link →
                  </a>
                  <details className="text-left">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">Or copy the link manually</summary>
                    <input
                      readOnly
                      value={magicLink}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      className="w-full mt-1 text-[10px] font-mono border border-gray-200 rounded px-2 py-1 bg-gray-50 text-gray-600"
                    />
                  </details>
                </div>
              )}
              <Link href="/candidate-portal/login" className="inline-block px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700">
                Back to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="you@example.com"
                />
              </div>
              {error && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 bg-emerald-600 text-white rounded-md text-sm hover:bg-emerald-700 disabled:bg-gray-400"
              >
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
              <div className="text-xs text-gray-500 text-center">
                The magic link expires in 30 minutes for security.
              </div>
            </form>
          )}

          <div className="border-t pt-4 text-center">
            <Link href="/candidate-portal/login" className="text-xs text-green-600 hover:underline">
              ← Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
