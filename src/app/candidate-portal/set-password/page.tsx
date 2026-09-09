'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { FiLock, FiCheck, FiArrowRight, FiEye, FiEyeOff, FiArrowLeft } from 'react-icons/fi';
import { validatePasswordStrength } from '@/lib/validators';

/**
 * Set Password page — shown after a candidate's first OTP login if they
 * have not yet set a password. The candidate JWT from verify-otp is passed
 * in the URL so the set-password API can authenticate the request without
 * requiring the user to re-OTP.
 */
export default function SetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      toast.error('Session expired — please log in again.');
      router.replace('/candidate-portal/login');
    }
  }, [token, router]);

  const pwStrength = validatePasswordStrength(password);
  const strength = pwStrength.score;
  const strengthLabel = pwStrength.label;
  const strengthColor = ['bg-slate-200', 'bg-red-400', 'bg-amber-400', 'bg-sky-400', 'bg-emerald-500'][strength];

  const submit = async () => {
    if (!pwStrength.valid) {
      toast.error(pwStrength.error!);
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const r = await fetch('/api/candidate-portal/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to set password');
      toast.success('Password set — you can now log in with it next time.');
      setDone(true);
      // The candidate JWT from OTP is still valid for 24h, so we can go straight to the dashboard.
      setTimeout(() => router.push('/candidate-portal/dashboard'), 1500);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-white to-sky-50 p-4">
      <div className="fixed top-4 left-4 flex items-center gap-2 text-xs">
        <Link
          href="/candidate-portal/login"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/80 backdrop-blur border border-slate-200 text-slate-600 hover:text-teal-700 hover:border-teal-200 transition-colors shadow-sm"
        >
          <FiArrowLeft className="w-3.5 h-3.5" /> Back to Login
        </Link>
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white mb-3 shadow-lg">
            <FiLock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Set Your Password</h1>
          <p className="text-sm text-slate-500 mt-1">
            {email ? <>for <span className="font-medium text-slate-700">{email}</span></> : null}
            <br />
            Set a password so you can log in faster next time — no OTP needed.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
          {done ? (
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mb-3">
                <FiCheck className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">All set!</h2>
              <p className="text-sm text-slate-500 mt-1">Taking you to your dashboard…</p>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium text-slate-700 uppercase tracking-wider">New Password</label>
                <div className="mt-1 relative">
                  <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full pl-9 pr-9 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    onKeyDown={(e) => e.key === 'Enter' && confirm && submit()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPw ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                  </button>
                </div>
                {password && (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded ${i < strength ? strengthColor : 'bg-slate-100'}`}
                        />
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{strengthLabel}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 uppercase tracking-wider">Confirm Password</label>
                <div className="mt-1 relative">
                  <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter your password"
                    className="w-full pl-9 pr-9 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    onKeyDown={(e) => e.key === 'Enter' && password && confirm && submit()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showConfirm ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                  </button>
                </div>
                {confirm && password !== confirm && (
                  <p className="text-[11px] text-red-500 mt-1">Passwords do not match</p>
                )}
              </div>

              <button
                onClick={submit}
                disabled={loading || !pwStrength.valid || password !== confirm}
                className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
              >
                {loading ? 'Setting password…' : <>Set Password & Continue <FiArrowRight className="w-4 h-4" /></>}
              </button>

              <button
                onClick={() => router.push('/candidate-portal/dashboard')}
                className="w-full text-xs text-slate-500 hover:text-slate-700"
              >
                Skip for now — I&apos;ll set it later
              </button>
            </>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-4">
          Tip: use a mix of letters, numbers, and symbols for a stronger password.
        </p>
      </div>
    </div>
  );
}
