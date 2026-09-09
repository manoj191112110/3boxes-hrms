'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  FiMail, FiLock, FiArrowRight, FiArrowLeft, FiGrid, FiEye, FiEyeOff, FiCheck,
} from 'react-icons/fi';
import { validateEmail } from '@/lib/validators';

type Tab = 'password' | 'otp';

export default function CandidateLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [accountChecked, setAccountChecked] = useState(false);
  const [accountHasPassword, setAccountHasPassword] = useState(false);

  // Pre-fill email from query string (e.g. /candidate-portal/login?email=foo@bar.com)
  useEffect(() => {
    const e = searchParams.get('email');
    if (e) setEmail(e);
    const oauthErr = searchParams.get('oauth_error');
    if (oauthErr) {
      setOauthError(oauthErr);
      toast.error('Google sign-in failed. Please try OTP or password instead.');
    }
  }, [searchParams]);

  // When email changes and looks valid, check account to decide default tab
  useEffect(() => {
    if (!email || !validateEmail(email).valid) {
      setAccountChecked(false);
      setAccountHasPassword(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/candidate-portal/auth/check-account?email=${encodeURIComponent(email)}`);
        if (!r.ok) return;
        const d = await r.json();
        if (cancelled) return;
        setAccountChecked(true);
        setAccountHasPassword(!!d.hasPassword);
        // Auto-switch tab based on what's available:
        // - If password exists, default to password tab
        // - Otherwise, default to OTP tab
        if (d.hasPassword && tab === 'otp') setTab('password');
        else if (!d.hasPassword && tab === 'password' && !d.exists) {
          // New user — show OTP tab so they can register
          setTab('otp');
        }
      } catch {
        // ignore — user can still try either tab
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const loginWithPassword = async () => {
    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      toast.error(emailResult.error!);
      return;
    }
    if (!password.trim()) {
      toast.error('Password is required');
      return;
    }
    setLoading(true);
    try {
      const r = await fetch('/api/candidate-portal/auth/login-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (d.needsPasswordSetup) {
          toast.error(d.error || 'Please set up a password first via OTP.');
          setTab('otp');
        } else {
          throw new Error(d.error || 'Login failed');
        }
        return;
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('tb_candidate_token', d.token);
        localStorage.setItem('tb_candidate_email', email);
      }
      toast.success('Welcome back!');
      router.push('/candidate-portal/dashboard');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const requestOtp = async () => {
    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      toast.error(emailResult.error!);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch('/api/candidate-portal/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setStep('verify');
      if (d.devOtp) setDevOtp(d.devOtp);
      toast.success('OTP sent — check your email');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/candidate-portal/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      if (typeof window !== 'undefined') {
        localStorage.setItem('tb_candidate_token', d.token);
        localStorage.setItem('tb_candidate_email', email);
      }
      toast.success('Welcome!');
      // If user has no password yet, redirect to set-password page
      if (d.needsPasswordSetup) {
        router.push(`/candidate-portal/set-password?token=${encodeURIComponent(d.token)}&email=${encodeURIComponent(email)}`);
      } else {
        router.push('/candidate-portal/dashboard');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  // OTP sub-step state
  const [step, setStep] = useState<'request' | 'verify'>('request');

  // Start Google OAuth flow
  const loginWithGoogle = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      toast.error('Google sign-in is not configured. Please use OTP or password.');
      return;
    }
    const redirectUri = `${window.location.origin}/api/candidate-portal/auth/oauth-callback`;
    const scope = 'openid email profile';
    const state = Math.random().toString(36).slice(2);
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('prompt', 'select_account');
    window.location.href = authUrl.toString();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-white to-sky-50 p-4">
      {/* Back navigation */}
      <div className="fixed top-4 left-4 flex items-center gap-2 text-xs">
        <Link
          href="/careers"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/80 backdrop-blur border border-slate-200 text-slate-600 hover:text-teal-700 hover:border-teal-200 transition-colors shadow-sm"
        >
          <FiArrowLeft className="w-3.5 h-3.5" /> Back to Careers
        </Link>
      </div>
      <div className="fixed top-4 right-4 flex items-center gap-2 text-xs">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/80 backdrop-blur border border-slate-200 text-slate-600 hover:text-sky-700 hover:border-sky-200 transition-colors shadow-sm"
          title="HR / Admin login"
        >
          <FiGrid className="w-3.5 h-3.5" /> HRMS Login
        </Link>
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-sky-500 text-white mb-3 shadow-lg">
            <FiMail className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Candidate Portal</h1>
          <p className="text-sm text-slate-500 mt-1">Track your applications, interviews, and resume insights</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
          {/* Email — always visible */}
          <div>
            <label className="text-xs font-medium text-slate-700 uppercase tracking-wider">Email Address</label>
            <div className="mt-1 relative">
              <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  if (tab === 'password' && password) loginWithPassword();
                  else if (tab === 'otp' && step === 'request') requestOtp();
                }}
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">Use the same email you applied with.</p>
            {accountChecked && accountHasPassword && tab === 'otp' && (
              <p className="text-[11px] text-emerald-600 mt-1">
                <FiCheck className="inline w-3 h-3" /> A password is set for this account — you can use the Password tab for faster login.
              </p>
            )}
            {accountChecked && !accountHasPassword && tab === 'password' && (
              <p className="text-[11px] text-amber-600 mt-1">
                No password set yet. Use OTP once to set up a password for future logins.
              </p>
            )}
          </div>

          {/* Tabs */}
          <div className="flex rounded-lg bg-slate-100 p-1">
            <button
              onClick={() => setTab('password')}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === 'password' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Password
            </button>
            <button
              onClick={() => setTab('otp')}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === 'otp' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              OTP
            </button>
          </div>

          {tab === 'password' ? (
            <>
              <div>
                <label className="text-xs font-medium text-slate-700 uppercase tracking-wider">Password</label>
                <div className="mt-1 relative">
                  <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-9 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    onKeyDown={(e) => e.key === 'Enter' && password && loginWithPassword()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                onClick={loginWithPassword}
                disabled={loading || !email || !password}
                className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
              >
                {loading ? 'Signing in…' : <>Sign In <FiArrowRight className="w-4 h-4" /></>}
              </button>
              <div className="flex items-center justify-between text-xs">
                <button
                  onClick={() => setTab('otp')}
                  className="text-slate-500 hover:text-teal-600 hover:underline"
                >
                  Use OTP instead
                </button>
                <Link href="/candidate-portal/forgot-password" className="text-slate-500 hover:text-teal-600 hover:underline">
                  Forgot password?
                </Link>
              </div>
            </>
          ) : (
            <>
              {step === 'request' ? (
                <>
                  <button
                    onClick={requestOtp}
                    disabled={loading || !email}
                    className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
                  >
                    {loading ? 'Sending…' : <>Send OTP <FiArrowRight className="w-4 h-4" /></>}
                  </button>
                  <p className="text-[11px] text-slate-400 text-center">
                    We&apos;ll send a 6-digit code to your email. After you verify it once, you&apos;ll be asked to set a password for future logins.
                  </p>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-medium text-slate-700 uppercase tracking-wider">Enter OTP</label>
                    <div className="mt-1 relative">
                      <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                        onKeyDown={(e) => e.key === 'Enter' && otp.length === 6 && verifyOtp()}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5">A 6-digit code was sent to {email}.</p>
                    {devOtp && (
                      <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                        <p className="text-[11px] text-amber-700 leading-relaxed">
                          <strong>Demo mode:</strong> Email delivery is not configured yet. Your OTP is{' '}
                          <button
                            onClick={() => { setOtp(devOtp); }}
                            className="font-mono font-bold text-amber-900 underline hover:text-amber-950"
                          >
                            {devOtp}
                          </button>
                          <span className="text-amber-600"> (click to auto-fill)</span>
                        </p>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={verifyOtp}
                    disabled={loading || otp.length !== 6}
                    className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
                  >
                    {loading ? 'Verifying…' : <>Verify & Continue <FiArrowRight className="w-4 h-4" /></>}
                  </button>
                  <button
                    onClick={() => { setStep('request'); setOtp(''); setDevOtp(null); }}
                    className="w-full text-xs text-slate-500 hover:text-slate-700"
                  >
                    ← Use a different email
                  </button>
                </>
              )}
            </>
          )}

          {/* Divider */}
          <div className="relative pt-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-[11px] uppercase tracking-wider text-slate-400">or continue with</span>
            </div>
          </div>

          {/* Social logins */}
          <button
            onClick={loginWithGoogle}
            className="w-full flex items-center justify-center gap-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          {oauthError && (
            <p className="text-[11px] text-red-600 text-center">
              Google sign-in failed: {oauthError}. Please try another method.
            </p>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-4">
          By signing in you agree to our <a href="/recruitment/pii-policy" className="underline">PII & Privacy Policy</a>.
        </p>
        <p className="text-center text-[11px] mt-2">
          <Link href="/careers" className="text-teal-600 hover:underline">← Browse open positions</Link>
          <span className="mx-2 text-slate-300">·</span>
          <Link href="/login" className="text-slate-500 hover:text-sky-600 hover:underline">HR / Admin login</Link>
        </p>
      </div>
    </div>
  );
}
