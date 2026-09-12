'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  FiMail, FiLock, FiEye, FiEyeOff, FiArrowRight,
  FiChevronDown, FiChevronUp, FiSmartphone, FiDownload,
  FiMonitor, FiX, FiCheck, FiWifi,
  FiRefreshCw, FiShield, FiZap, FiGlobe,
  FiUsers, FiSettings, FiCpu, FiStar,
  FiPlay, FiArrowLeft, FiBriefcase, FiExternalLink,
  FiTarget, FiTrendingUp, FiGrid, FiUserCheck, FiCreditCard,
} from 'react-icons/fi';
import { HiShieldCheck } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { isClientLiveMode } from '@/lib/site-mode';
import { validateEmail, validatePasswordRequired } from '@/lib/validators';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showMobileApp, setShowMobileApp] = useState(false);
  const [tenantInfo, setTenantInfo] = useState<{ name: string; slug: string; logo?: string | null } | null>(null);
  const [loginMode, setLoginMode] = useState<'user' | 'candidate'>('user');
  // Candidate login state
  const [candidateEmail, setCandidateEmail] = useState('');
  const [candidatePassword, setCandidatePassword] = useState('');
  const [candidateShowPassword, setCandidateShowPassword] = useState(false);
  const [candidateError, setCandidateError] = useState('');
  const [candidateOtp, setCandidateOtp] = useState('');
  const [candidateTab, setCandidateTab] = useState<'password' | 'otp'>('password');
  const [candidateStep, setCandidateStep] = useState<'request' | 'verify'>('request');
  const [candidateDevOtp, setCandidateDevOtp] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showDemoLogins, setShowDemoLogins] = useState(false);
  const [isDemoSite, setIsDemoSite] = useState(false);
  const [isPlatformSite, setIsPlatformSite] = useState(false);
  const [demoCredentials, setDemoCredentials] = useState<any>(null);
  const [demoLoading, setDemoLoading] = useState(false);

  // Detect tenant from subdomain (e.g., marqaitechgroup.3boxeshrms.com)
  useEffect(() => {
    const detectTenant = async () => {
      try {
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
        if (parts.length >= 3) {
          const sub = parts[0].toLowerCase();
          if (!['www', 'api', 'app', 'admin', 'mail', 'ftp', 'localhost'].includes(sub)) {
            const res = await fetch(`/api/public/tenant-info?slug=${encodeURIComponent(sub)}`);
            if (res.ok) {
              const data = await res.json();
              if (data.tenant) {
                setTenantInfo(data.tenant);
              }
            }
          }
        }
      } catch {
        // Silently ignore - tenant detection is best-effort
      }
    };
    detectTenant();
  }, []);

  // Detect site type and load appropriate credentials
  // Four site types:
  // 1. Demo site (nexus-hrms-mu.vercel.app) — has sample data with demo credentials
  // 2. Platform/main site (3boxeshrms.com) — super admin login for tenant management
  // 3. Tenant/client sites (*.3boxeshrms.com) — actual client data, branded login
  // 4. Unknown — generic login form
  useEffect(() => {
    const hostname = window.location.hostname;
    setIsDemoSite(
      hostname === 'nexus-hrms-mu.vercel.app' ||
      hostname === '3boxes-hrms-mu.vercel.app'
    );
    setIsPlatformSite(
      hostname === '3boxeshrms.com' ||
      hostname === 'www.3boxeshrms.com'
    );
  }, []);

  // Fetch demo credentials from API
  const fetchDemoCredentials = async () => {
    if (demoCredentials || demoLoading) return;
    setDemoLoading(true);
    try {
      const res = await fetch('/api/public/demo-credentials');
      if (res.ok) {
        const data = await res.json();
        setDemoCredentials(data);
      }
    } catch (e) {
      console.error('Failed to fetch demo credentials:', e);
    } finally {
      setDemoLoading(false);
    }
  };

  // Detect platform and PWA install capability
  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: boolean }).MSStream);
    setIsAndroid(/Android/.test(ua));

    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    // Auto-fix EH2R branding in database on login page load
    fetch('/api/fix-tenant', { method: 'POST' }).catch(() => {});

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handlePWAInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        toast.success('3Boxes HRMS app installed successfully!');
        setDeferredPrompt(null);
      }
    } catch (err) {
      console.error('Install error:', err);
    }
  }, [deferredPrompt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      setError(emailResult.error!);
      toast.error(emailResult.error!);
      return;
    }

    const passwordResult = validatePasswordRequired(password);
    if (!passwordResult.valid) {
      setError(passwordResult.error!);
      toast.error(passwordResult.error!);
      return;
    }

    setIsSubmitting(true);

    try {
      const success = await login(email, password);
      if (success) {
        toast.success('Welcome back! Redirecting...');
        // Redirect based on role:
        // Super admin → /super-admin (platform control center)
        // All other roles → /home (tenant dashboard)
        const { user } = useAuthStore.getState();
        if (user?.role === 'super_admin') {
          router.push('/super-admin');
        } else {
          router.push('/home');
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Candidate login handlers ───
  const handleCandidateLoginPassword = async () => {
    const emailResult = validateEmail(candidateEmail);
    if (!emailResult.valid) {
      setCandidateError(emailResult.error!);
      return;
    }
    if (!candidatePassword.trim()) {
      setCandidateError('Password is required');
      return;
    }
    setIsSubmitting(true);
    setCandidateError('');
    try {
      const r = await fetch('/api/candidate-portal/auth/login-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: candidateEmail, password: candidatePassword }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (d.needsPasswordSetup) {
          setCandidateError('Please set up a password first via OTP.');
          setCandidateTab('otp');
        } else {
          throw new Error(d.error || 'Login failed');
        }
        return;
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('tb_candidate_token', d.token);
        localStorage.setItem('tb_candidate_email', candidateEmail);
      }
      toast.success('Welcome back! Redirecting to candidate portal...');
      router.push('/candidate-portal/dashboard');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Login failed';
      setCandidateError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCandidateRequestOtp = async () => {
    const emailResult = validateEmail(candidateEmail);
    if (!emailResult.valid) {
      setCandidateError(emailResult.error!);
      return;
    }
    setIsSubmitting(true);
    setCandidateError('');
    try {
      const r = await fetch('/api/candidate-portal/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: candidateEmail }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setCandidateStep('verify');
      if (d.devOtp) setCandidateDevOtp(d.devOtp);
      toast.success('OTP sent — check your email');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to send OTP';
      setCandidateError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCandidateVerifyOtp = async () => {
    if (candidateOtp.length !== 6) {
      setCandidateError('Please enter the 6-digit OTP');
      return;
    }
    setIsSubmitting(true);
    setCandidateError('');
    try {
      const r = await fetch('/api/candidate-portal/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: candidateEmail, otp: candidateOtp }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Verification failed');
      if (typeof window !== 'undefined') {
        localStorage.setItem('tb_candidate_token', d.token);
        localStorage.setItem('tb_candidate_email', candidateEmail);
      }
      if (d.needsPasswordSetup) {
        toast.success('OTP verified! Please set up a password.');
        router.push(`/candidate-portal/set-password?token=${encodeURIComponent(d.token)}&email=${encodeURIComponent(candidateEmail)}`);
      } else {
        toast.success('Welcome! Redirecting to candidate portal...');
        router.push('/candidate-portal/dashboard');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Verification failed';
      setCandidateError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const ThreeBoxesLogo = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) => {
    const dims = { sm: 'w-6 h-6', md: 'w-9 h-9', lg: 'w-12 h-12', xl: 'w-16 h-16' };
    const boxSize = { sm: 8, md: 11, lg: 15, xl: 19 };
    const gap = { sm: 1.5, md: 2, lg: 2.5, xl: 3 };
    const rx = { sm: 2, md: 2.5, lg: 3, xl: 4 };
    const s = boxSize[size];
    const g = gap[size];
    const r = rx[size];
    const totalW = (s * 3) + (g * 2);
    const totalH = s;

    return (
      <svg viewBox={`0 0 ${totalW} ${totalH}`} className={dims[size]} fill="none">
        <rect x="0" y="0" width={s} height={s} rx={r} fill="#059669" />
        <rect x={s + g} y="0" width={s} height={s} rx={r} fill="#10B981" />
        <rect x={(s + g) * 2} y="0" width={s} height={s} rx={r} fill="#22C55E" />
      </svg>
    );
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      {/* ===== LEFT PANEL — Branding & Features ===== */}
      <div className="hidden lg:flex lg:w-[55%] xl:w-[58%] relative flex-col justify-between">
        {/* Deep gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0B1120] via-[#0F2D1A] to-[#0F2E1A]" />

        {/* Animated mesh pattern */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />

        {/* Glowing orbs */}
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-green-500/15 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-15%] left-[-5%] w-[400px] h-[400px] bg-emerald-500/15 rounded-full blur-[100px]" />
        <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] bg-emerald-500/10 rounded-full blur-[80px]" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between h-full p-10 xl:p-14">
          {/* Top — Logo & Brand */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              {tenantInfo?.logo ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={tenantInfo.logo} alt={tenantInfo.name} className="w-16 h-16 rounded-xl object-contain bg-white p-2" />
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      {tenantInfo.name}
                    </h1>
                    <p className="text-[11px] text-slate-400 tracking-[0.2em] uppercase font-medium">
                      Powered by 3Boxes <span className="text-green-400">HRMS</span>
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/logo-3boxes-hrms.png" alt="3Boxes HRMS" className="w-16 h-16 rounded-xl object-contain bg-white p-2" />
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      3Boxes <span className="text-green-400">HRMS</span>
                    </h1>
                    <p className="text-[11px] text-slate-400 tracking-[0.2em] uppercase font-medium">
                      {isPlatformSite ? 'Super Admin &middot; Platform Control' : 'People \u00b7 Process \u00b7 Technology'}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Center — Hero messaging */}
          <div className="max-w-lg">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] mb-6">
              <span className={`w-1.5 h-1.5 rounded-full ${isPlatformSite ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-400 animate-pulse-subtle'}`} />
              <span className="text-[11px] text-emerald-300 font-semibold tracking-wide">
                {isPlatformSite ? 'PLATFORM CONTROL CENTER' : 'AI-POWERED PLATFORM'}
              </span>
              {isPlatformSite && (
                <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-1.5 py-0.5 rounded-full tracking-wider">
                  LIVE
                </span>
              )}
              {isDemoSite && (
                <span className="text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30 px-1.5 py-0.5 rounded-full tracking-wider">
                  DEMO
                </span>
              )}
            </div>

            <h2 className="text-4xl xl:text-5xl font-extrabold text-white leading-[1.1] mb-6">
              {isPlatformSite ? (
                <>
                  Manage All
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400">
                    Tenants & Operations
                  </span>
                </>
              ) : (
                <>
                  Transform Your
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400">
                    HR Operations
                  </span>
                </>
              )}
            </h2>

            <p className="text-slate-300/80 text-base leading-relaxed mb-10 max-w-md">
              {isPlatformSite
                ? 'The central platform control center for managing all tenants, approving trial registrations, controlling subscriptions, and overseeing the entire 3Boxes HRMS ecosystem. Only live production data — no demo or dummy data.'
                : 'The next-generation SaaS HRMS platform — empowering businesses to manage people, streamline processes, and leverage technology seamlessly. A Proud Product of Marq AI Tech Group.'
              }
            </p>

            {/* Three Pillars — Different for Super Admin */}
            <div className="grid grid-cols-3 gap-4 mb-10">
              {isPlatformSite ? (
                <>
                  <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm">
                    <div className="w-10 h-10 rounded-lg bg-green-500/15 flex items-center justify-center mb-3">
                      <FiUsers className="w-5 h-5 text-green-400" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">Tenants</h3>
                    <p className="text-[11px] text-slate-400 leading-relaxed">View, configure, and manage all tenant organizations</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center mb-3">
                      <FiUserCheck className="w-5 h-5 text-emerald-400" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">Approvals</h3>
                    <p className="text-[11px] text-slate-400 leading-relaxed">Trial registration, domain, and subscription approvals</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center mb-3">
                      <FiCreditCard className="w-5 h-5 text-emerald-400" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">Subscriptions</h3>
                    <p className="text-[11px] text-slate-400 leading-relaxed">Plan management, billing, and renewal cycle control</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm">
                    <div className="w-10 h-10 rounded-lg bg-green-500/15 flex items-center justify-center mb-3">
                      <FiUsers className="w-5 h-5 text-green-400" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">People</h3>
                    <p className="text-[11px] text-slate-400 leading-relaxed">Employee lifecycle, engagement & growth management</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center mb-3">
                      <FiSettings className="w-5 h-5 text-emerald-400" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">Process</h3>
                    <p className="text-[11px] text-slate-400 leading-relaxed">Automated workflows, compliance & approvals</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center mb-3">
                      <FiCpu className="w-5 h-5 text-emerald-400" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">Technology</h3>
                    <p className="text-[11px] text-slate-400 leading-relaxed">AI interviews, analytics & smart automation</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Bottom — Social proof & Trust */}
          <div>
            <div className="flex items-center gap-6 mb-6">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {['bg-green-500', 'bg-emerald-500', 'bg-green-500', 'bg-amber-500'].map((c, i) => (
                    <div key={i} className={`w-8 h-8 rounded-full ${c} border-2 border-[#0F1D3A] flex items-center justify-center text-[10px] font-bold text-white`}>
                      {['SK', 'AP', 'MJ', 'RK'][i]}
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">2,500+ Companies</p>
                  <p className="text-[10px] text-slate-400">Trust 3Boxes HRMS</p>
                </div>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="flex items-center gap-1.5">
                {[...Array(5)].map((_, i) => (
                  <FiStar key={i} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                ))}
                <span className="text-xs font-semibold text-white ml-1">4.9/5</span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <FiShield className="w-3.5 h-3.5 text-slate-400" />
                SOC 2 Compliant
              </span>
              <span className="flex items-center gap-1.5">
                <FiGlobe className="w-3.5 h-3.5 text-slate-400" />
                GDPR Ready
              </span>
              <span className="flex items-center gap-1.5">
                <FiZap className="w-3.5 h-3.5 text-slate-400" />
                99.9% Uptime
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== RIGHT PANEL — Login Form ===== */}
      <div className="w-full lg:w-[45%] xl:w-[42%] flex items-center justify-center bg-white relative">
        {/* Subtle pattern for right panel */}
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #10B981 1px, transparent 0)`,
          backgroundSize: '24px 24px',
        }} />

        <div className="relative z-10 w-full max-w-md px-8 py-10">
          {/* Mobile-only brand header */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-2.5 mb-3">
              {tenantInfo?.logo ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={tenantInfo.logo} alt={tenantInfo.name} className="w-12 h-12 rounded-lg object-contain bg-white p-1.5" />
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    <span className="gradient-text">{tenantInfo.name}</span>
                  </h1>
                </>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/logo-3boxes-hrms.png" alt="3Boxes HRMS" className="w-12 h-12 rounded-lg object-contain bg-white p-1.5" />
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    <span className="gradient-text">3Boxes</span>
                    <span className="text-green-500 ml-1 text-lg font-extrabold">HRMS</span>
                  </h1>
                </>
              )}
            </div>
            <p className="text-[11px] text-slate-400 tracking-[0.2em] uppercase font-medium">
              People &middot; Process &middot; Technology
            </p>
          </div>

          {/* Mode Toggle: HR/Admin vs Candidate — HIDDEN on platform site (super admin only) */}
          {!isPlatformSite && (
          <div className="flex rounded-xl bg-slate-100 p-1 mb-6">
            <button
              onClick={() => setLoginMode('user')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                loginMode === 'user' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <FiGrid className="w-4 h-4" /> HR / Admin
              </span>
            </button>
            <button
              onClick={() => setLoginMode('candidate')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                loginMode === 'candidate' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <FiBriefcase className="w-4 h-4" /> Candidate
              </span>
            </button>
          </div>
          )}

          {/* Form header */}
          <div className="mb-8">
            {isPlatformSite && !tenantInfo && (
              <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-white">
                    <FiShield className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">3Boxes HRMS Super Admin</p>
                    <p className="text-[10px] text-slate-400">Platform Control Center</p>
                  </div>
                </div>
              </div>
            )}
            {tenantInfo && !isPlatformSite && (
              <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100">
                <div className="flex items-center gap-2.5">
                  {tenantInfo.logo ? (
                    <img src={tenantInfo.logo} alt={tenantInfo.name} className="w-10 h-10 rounded-lg object-contain bg-white p-1" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                      {tenantInfo.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-slate-800">{tenantInfo.name}</p>
                    <p className="text-[10px] text-slate-400">Organization Portal</p>
                  </div>
                </div>
              </div>
            )}
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              {isPlatformSite ? 'Super Admin Login' : loginMode === 'user' ? 'Welcome back' : 'Candidate Portal'}
            </h2>
            <p className="text-sm text-slate-500">
              {isPlatformSite
                ? 'Manage all tenants, approve trials, and control subscriptions'
                : loginMode === 'user'
                  ? tenantInfo
                    ? `Sign in to ${tenantInfo.name} to continue`
                    : 'Sign in to your account to continue'
                  : 'Track your applications, optimize your resume, and find matching jobs'}
            </p>
            {/* LIVE mode indicator under Super Admin Login header */}
            {isPlatformSite && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-semibold text-emerald-700">LIVE PRODUCTION</span>
                <span className="text-[9px] text-emerald-600">— Real data only</span>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && loginMode === 'user' && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200/80 animate-slide-in-down">
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}
          {candidateError && loginMode === 'candidate' && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200/80 animate-slide-in-down">
              <p className="text-sm text-red-700 font-medium">{candidateError}</p>
            </div>
          )}

          {/* ─── CANDIDATE LOGIN FORM ─── */}
          {loginMode === 'candidate' && !isPlatformSite && (
            <div className="space-y-5">
              {/* Candidate Email */}
              <div>
                <label htmlFor="candidate-email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <FiMail className="h-[18px] w-[18px] text-slate-400" />
                  </div>
                  <input
                    id="candidate-email"
                    type="email"
                    value={candidateEmail}
                    onChange={(e) => {
                      setCandidateEmail(e.target.value);
                      if (candidateError) setCandidateError('');
                    }}
                    placeholder="you@example.com"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 focus:bg-white transition-all text-sm"
                    autoComplete="email"
                    disabled={isSubmitting}
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">Use the email you applied with.</p>
              </div>

              {/* Candidate Tab Toggle: Password / OTP */}
              <div className="flex rounded-lg bg-slate-100 p-1">
                <button
                  onClick={() => setCandidateTab('password')}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    candidateTab === 'password' ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Password
                </button>
                <button
                  onClick={() => setCandidateTab('otp')}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    candidateTab === 'otp' ? 'bg-white text-green-700 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  OTP
                </button>
              </div>

              {candidateTab === 'password' ? (
                <>
                  {/* Candidate Password */}
                  <div>
                    <label htmlFor="candidate-password" className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <FiLock className="h-[18px] w-[18px] text-slate-400" />
                      </div>
                      <input
                        id="candidate-password"
                        type={candidateShowPassword ? 'text' : 'password'}
                        value={candidatePassword}
                        onChange={(e) => {
                          setCandidatePassword(e.target.value);
                          if (candidateError) setCandidateError('');
                        }}
                        placeholder="Enter your password"
                        className="w-full pl-11 pr-12 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 focus:bg-white transition-all text-sm"
                        autoComplete="current-password"
                        disabled={isSubmitting}
                        onKeyDown={(e) => e.key === 'Enter' && handleCandidateLoginPassword()}
                      />
                      <button
                        type="button"
                        onClick={() => setCandidateShowPassword(!candidateShowPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                      >
                        {candidateShowPassword ? <FiEyeOff className="h-[18px] w-[18px]" /> : <FiEye className="h-[18px] w-[18px]" />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCandidateLoginPassword}
                    disabled={isSubmitting || !candidateEmail || !candidatePassword}
                    className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 text-white font-semibold text-sm shadow-lg shadow-green-500/25 hover:shadow-xl hover:from-green-600 hover:to-teal-600 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Signing in...
                      </>
                    ) : (
                      <>Sign In <FiArrowRight className="h-4 w-4" /></>
                    )}
                  </button>
                  <div className="text-center">
                    <Link href="/candidate-portal/forgot-password" className="text-xs text-emerald-500 hover:text-green-700 hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  {candidateStep === 'request' ? (
                    <button
                      type="button"
                      onClick={handleCandidateRequestOtp}
                      disabled={isSubmitting || !candidateEmail}
                      className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 text-white font-semibold text-sm shadow-lg shadow-green-500/25 hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Sending OTP...
                        </>
                      ) : (
                        <>Send OTP <FiArrowRight className="h-4 w-4" /></>
                      )}
                    </button>
                  ) : (
                    <>
                      <div>
                        <label htmlFor="candidate-otp" className="block text-sm font-semibold text-slate-700 mb-1.5">
                          Enter OTP
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <FiLock className="h-[18px] w-[18px] text-slate-400" />
                          </div>
                          <input
                            id="candidate-otp"
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={candidateOtp}
                            onChange={(e) => setCandidateOtp(e.target.value.replace(/\D/g, ''))}
                            placeholder="123456"
                            className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 tracking-[0.5em] font-mono text-sm"
                            onKeyDown={(e) => e.key === 'Enter' && handleCandidateVerifyOtp()}
                            disabled={isSubmitting}
                          />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1.5">A 6-digit code was sent to {candidateEmail}.</p>
                        {candidateDevOtp && (
                          <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                            <p className="text-[11px] text-amber-700 leading-relaxed">
                              <strong>Demo mode:</strong> Your OTP is{' '}
                              <button
                                onClick={() => setCandidateOtp(candidateDevOtp)}
                                className="font-mono font-bold text-amber-900 underline hover:text-amber-950"
                              >
                                {candidateDevOtp}
                              </button>
                              <span className="text-amber-600"> (click to auto-fill)</span>
                            </p>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleCandidateVerifyOtp}
                        disabled={isSubmitting || candidateOtp.length !== 6}
                        className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 text-white font-semibold text-sm shadow-lg disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                      >
                        {isSubmitting ? 'Verifying...' : <>Verify & Continue <FiArrowRight className="h-4 w-4" /></>}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setCandidateStep('request'); setCandidateOtp(''); setCandidateDevOtp(null); }}
                        className="w-full text-xs text-slate-500 hover:text-slate-700"
                      >
                        ← Use a different email
                      </button>
                    </>
                  )}
                </>
              )}

              {/* Candidate Portal features */}
              <div className="pt-4 border-t border-slate-100 mt-4">
                <p className="text-[11px] text-slate-500 font-semibold mb-2 uppercase tracking-wider">What you get:</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: FiZap, text: 'AI Resume Builder' },
                    { icon: FiTarget, text: 'Job Matching' },
                    { icon: FiTrendingUp, text: 'Application Tracking' },
                    { icon: FiGlobe, text: 'External Job Search' },
                  ].map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <f.icon className="w-3.5 h-3.5 text-emerald-500" />
                      {f.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── HR/ADMIN LOGIN FORM ─── */}
          {(loginMode === 'user' || isPlatformSite) && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Email Address <span className="text-red-500 font-bold">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <FiMail className="h-[18px] w-[18px] text-slate-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder={isPlatformSite ? "superadmin@3boxeshrms.com" : "you@company.com"}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 focus:bg-white transition-all text-sm"
                  autoComplete="email"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                  Password <span className="text-red-500 font-bold">*</span>
                </label>
                {!isPlatformSite && (
                  <button type="button" className="text-xs font-medium text-green-500 hover:text-green-700 transition-colors">
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <FiLock className="h-[18px] w-[18px] text-slate-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Enter your password"
                  className="w-full pl-11 pr-12 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 focus:bg-white transition-all text-sm"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? (
                    <FiEyeOff className="h-[18px] w-[18px]" />
                  ) : (
                    <FiEye className="h-[18px] w-[18px]" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember me — hidden on platform site (super admin) */}
            {!isPlatformSite && (
            <div className="flex items-center gap-2">
              <input
                id="remember"
                type="checkbox"
                className="w-4 h-4 rounded border-slate-300 text-green-500 focus:ring-green-500/20"
              />
              <label htmlFor="remember" className="text-sm text-slate-500">
                Keep me signed in for 30 days
              </label>
            </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-green-500 via-emerald-500 to-teal-600 text-white font-semibold text-sm shadow-lg shadow-green-500/25 hover:shadow-xl hover:shadow-green-500/30 hover:from-green-600 hover:via-emerald-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:ring-offset-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-lg"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  {isPlatformSite ? 'Sign In as Super Admin' : 'Sign In'}
                  <FiArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            {/* Demo Login Credentials — shown ONLY on demo site (nexus-hrms-mu.vercel.app), NOT on platform or tenant subdomains */}
            {isDemoSite && !tenantInfo && (
            <div className="mt-4 w-full rounded-xl border border-amber-200/60 bg-gradient-to-r from-amber-50/50 to-orange-50/50 overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  const newState = !showDemoLogins;
                  setShowDemoLogins(newState);
                  if (newState && !demoCredentials) fetchDemoCredentials();
                }}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-amber-50/80 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white flex-shrink-0">
                    <FiUsers className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">Login Credentials</span>
                </div>
                {showDemoLogins ? (
                  <FiChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <FiChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>
              {showDemoLogins && (
                <div className="px-4 pb-3 space-y-2">
                  <p className="text-[10px] text-slate-500 mb-2">Click any role to auto-fill credentials.</p>
                  
                  {demoLoading && (
                    <div className="flex items-center gap-2 py-2">
                      <FiRefreshCw className="w-3 h-3 animate-spin text-amber-500" />
                      <span className="text-[10px] text-slate-400">Loading credentials...</span>
                    </div>
                  )}

                  {/* Demo Site — show ONLY super admins + tenant admins with company details */}
                  {demoCredentials?.site === 'demo' && (
                    <>
                      <p className="text-[10px] font-semibold text-slate-600 mt-1 px-1">Super Admins</p>
                      {demoCredentials.superAdmins?.map((u: any) => (
                        <button
                          key={u.email}
                          type="button"
                          onClick={() => {
                            setEmail(u.email);
                            setPassword('MarqAI@2026');
                            setLoginMode('user');
                            toast.success(`Filled: ${u.functionalRole}`, { duration: 2000 });
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/70 hover:bg-white border border-slate-100 hover:border-amber-200 transition-all text-left group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-slate-700 group-hover:text-amber-700 transition-colors">{u.functionalRole}</p>
                            <p className="text-[9px] text-slate-400 truncate">{u.email}</p>
                          </div>
                          <span className="text-[8px] font-medium bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                            Super Admin
                          </span>
                        </button>
                      ))}
                      <p className="text-[10px] font-semibold text-slate-600 mt-2 px-1">Tenant Admins</p>
                      {demoCredentials.tenantAdmins?.map((u: any) => (
                        <button
                          key={u.email}
                          type="button"
                          onClick={() => {
                            setEmail(u.email);
                            setPassword('MarqAI@2026');
                            setLoginMode('user');
                            toast.success(`Filled: ${u.tenant} Admin`, { duration: 2000 });
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/70 hover:bg-white border border-slate-100 hover:border-amber-200 transition-all text-left group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-slate-700 group-hover:text-amber-700 transition-colors">{u.tenant}</p>
                            <p className="text-[9px] text-slate-400 truncate">{u.email}</p>
                          </div>
                          <span className="text-[8px] font-medium bg-green-100 text-green-600 px-1.5 py-0.5 rounded">
                            Tenant Admin
                          </span>
                        </button>
                      ))}
                      {demoCredentials.employees?.length > 0 && (
                        <>
                          <p className="text-[10px] font-semibold text-slate-600 mt-2 px-1">Employees (Self-Service)</p>
                          {demoCredentials.employees.map((u: any) => (
                            <button
                              key={u.email}
                              type="button"
                              onClick={() => {
                                setEmail(u.email);
                                setPassword('MarqAI@2026');
                                setLoginMode('user');
                                toast.success('Filled: Employee Self-Service', { duration: 2000 });
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/70 hover:bg-white border border-slate-100 hover:border-amber-200 transition-all text-left group"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-semibold text-slate-700 group-hover:text-amber-700 transition-colors">{u.name}</p>
                                <p className="text-[9px] text-slate-400 truncate">{u.email}{u.department ? ` · ${u.department}` : ''}</p>
                              </div>
                              <span className="text-[8px] font-medium bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">
                                Employee
                              </span>
                            </button>
                          ))}
                        </>
                      )}
                    </>
                  )}

                  {/* Fallback if no API response yet — only super admin + tenant admins */}
                  {!demoCredentials && !demoLoading && (
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEmail('superadmin@3boxeshrms.com');
                          setPassword('MarqAI@2026');
                          setLoginMode('user');
                          toast.success('Filled: Super Admin', { duration: 2000 });
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/70 hover:bg-white border border-slate-100 hover:border-amber-200 transition-all text-left group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-slate-700 group-hover:text-amber-700">Super Admin</p>
                          <p className="text-[9px] text-slate-400 truncate">superadmin@3boxeshrms.com</p>
                        </div>
                        <span className="text-[8px] font-medium bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Super Admin</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEmail('admin@marqaitechgroup.com');
                          setPassword('MarqAI@2026');
                          setLoginMode('user');
                          toast.success('Filled: Tenant Admin', { duration: 2000 });
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/70 hover:bg-white border border-slate-100 hover:border-amber-200 transition-all text-left group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-slate-700 group-hover:text-amber-700">Tenant Admin</p>
                          <p className="text-[9px] text-slate-400 truncate">admin@marqaitechgroup.com</p>
                        </div>
                        <span className="text-[8px] font-medium bg-green-100 text-green-600 px-1.5 py-0.5 rounded">Tenant Admin</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            )}

            {/* Super Admin capabilities + LIVE MODE indicator — shown ONLY on platform site (3boxeshrms.com) */}
            {isPlatformSite && !tenantInfo && (
            <div className="mt-4 w-full rounded-xl border border-emerald-200/60 bg-gradient-to-r from-emerald-50/80 to-green-50/50 overflow-hidden">
              {/* LIVE PRODUCTION badge */}
              <div className="px-4 py-2 bg-emerald-600/10 border-b border-emerald-200/40 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-700 tracking-wide uppercase">Live Production Environment</span>
                <span className="text-[9px] text-emerald-600/70 ml-auto">Real data only — No demo/dummy data</span>
              </div>
              <div className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { icon: <FiUsers className="w-3 h-3" />, label: 'Tenant Management' },
                    { icon: <FiUserCheck className="w-3 h-3" />, label: 'Trial Approvals' },
                    { icon: <FiCreditCard className="w-3 h-3" />, label: 'Subscriptions' },
                    { icon: <FiSettings className="w-3 h-3" />, label: 'Platform Config' },
                  ].map((item) => (
                    <span key={item.label} className="inline-flex items-center gap-1 text-[9px] text-slate-500 bg-slate-100/80 px-1.5 py-0.5 rounded">
                      {item.icon}{item.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            )}

            {/* Job Portal / Career Link — hidden on platform site (super admin) */}
            {!isPlatformSite && (
            <Link
              href="/careers"
              className="group block w-full mt-4 px-4 py-3 rounded-xl border border-green-100 bg-gradient-to-r from-green-50/60 to-emerald-50/60 hover:from-green-50 hover:to-emerald-50 hover:border-green-200 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white flex-shrink-0">
                  <FiBriefcase className="w-4 h-4" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-bold text-slate-900 group-hover:text-green-700 transition-colors">
                    Looking for a job? Browse Openings
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    Candidates (registered or not) can view roles &amp; apply with resume — no account needed
                  </p>
                </div>
                <FiArrowRight className="w-4 h-4 text-green-500 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
            )}

            {/* Free Trial Registration Link — shown ONLY on demo site, NOT on platform or tenant subdomains */}
            {!tenantInfo && !isPlatformSite && (
            <Link
              href="/register"
              className="group block w-full mt-3 px-4 py-3 rounded-xl border border-green-100 bg-gradient-to-r from-green-50/60 to-emerald-50/60 hover:from-green-50 hover:to-emerald-50 hover:border-green-200 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white flex-shrink-0">
                  <FiZap className="w-4 h-4" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-bold text-slate-900 group-hover:text-green-700 transition-colors">
                    New Company? Start Free Trial
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    15-day free trial — no credit card required. Explore all features.
                  </p>
                </div>
                <FiArrowRight className="w-4 h-4 text-green-500 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
            )}
          </form>
          )}

          {/* Mobile App Download — Native Flutter App + PWA */}
          {!isPlatformSite && (
          <div className="mt-8 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowMobileApp(!showMobileApp)}
              className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-emerald-200 hover:border-emerald-400 bg-emerald-50/40 hover:bg-emerald-50/70 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-md shadow-emerald-500/20">
                  <FiSmartphone className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-slate-800">Get the 3Boxes HRMS App</p>
                  <p className="text-[11px] text-emerald-600 font-medium">Native Android & iOS · Free download</p>
                </div>
              </div>
              {showMobileApp ? (
                <FiChevronUp className="w-5 h-5 text-emerald-500 group-hover:text-emerald-600" />
              ) : (
                <FiChevronDown className="w-5 h-5 text-emerald-500 group-hover:text-emerald-600" />
              )}
            </button>

            {showMobileApp && (
              <div className="mt-4 space-y-3 animate-slide-in-down">
                {/* Native App Download Buttons */}
                <div className="space-y-2.5">
                  {/* Android APK Download */}
                  <a
                    href="/downloads/"
                    download
                    className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-green-700 transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                        <path d="M17.523 15.341a.641.641 0 01-.64.641.641.641 0 01-.64-.64c0-.354.287-.641.64-.641.354 0 .64.287.64.64zm-10.246 0a.641.641 0 01-.64.641.641.641 0 01-.64-.64c0-.354.287-.641.64-.641.354 0 .64.287.64.64z" fill="white"/>
                        <path d="M7.414 14.166l-2.548 1.506a.64.64 0 01-.876-.228.64.64 0 01.228-.876l2.548-1.506a.64.64 0 01.876.228.64.64 0 01-.228.876zm9.172 0a.64.64 0 01.228-.876l2.548-1.506a.64.64 0 01.876.228.64.64 0 01-.228.876l-2.548 1.506a.64.64 0 01-.876-.228z" fill="white"/>
                        <path d="M7.988 10.348l-2.66-4.56a.64.64 0 01.228-.876.64.64 0 01.876.228l2.66 4.56a.64.64 0 01-.228.876.64.64 0 01-.876-.228zm8.024 0a.64.64 0 01-.876.228.64.64 0 01-.228-.876l2.66-4.56a.64.64 0 01.876-.228.64.64 0 01-.228.876z" fill="white"/>
                        <path d="M12 2.5c-.354 0-.64.287-.64.64v5.12c0 .354.287.64.64.64s.64-.287.64-.64V3.14c0-.354-.287-.64-.64-.64z" fill="white"/>
                        <rect x="6.64" y="9.38" width="10.72" height="6.82" rx="1.5" fill="white" opacity="0.3"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">Download for Android</p>
                      <p className="text-[11px] text-white/80">APK file · Direct install · v1.0.0</p>
                    </div>
                    <FiDownload className="w-5 h-5 shrink-0" />
                  </a>

                  {/* iOS - Coming Soon */}
                  <div className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-gradient-to-r from-slate-600 to-slate-700 text-white opacity-90">
                    <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83" fill="white"/>
                        <path d="M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" fill="white"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">iOS App</p>
                      <p className="text-[11px] text-white/70">Coming soon on App Store</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">SOON</span>
                  </div>
                </div>

                {/* PWA Install option */}
                {deferredPrompt && !isStandalone && (
                  <div className="pt-1">
                    <p className="text-[11px] text-slate-400 mb-2 flex items-center gap-1">
                      <span className="w-full h-px bg-slate-200 flex-1" />
                      <span className="px-2">or install as web app</span>
                      <span className="w-full h-px bg-slate-200 flex-1" />
                    </p>
                    <button
                      onClick={handlePWAInstall}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-all"
                    >
                      <FiDownload className="w-4 h-4" />
                      Install PWA (Web App)
                    </button>
                  </div>
                )}

                {/* App Features */}
                <div className="pt-2">
                  <p className="text-[11px] font-semibold text-slate-600 mb-2">App Features</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-indigo-50/50">
                      <FiZap className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <p className="text-[10px] font-medium text-slate-700">Native Performance</p>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50/50">
                      <FiWifi className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <p className="text-[10px] font-medium text-slate-700">Offline Mode</p>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-violet-50/50">
                      <FiRefreshCw className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                      <p className="text-[10px] font-medium text-slate-700">Auto Updates</p>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50/50">
                      <FiShield className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <p className="text-[10px] font-medium text-slate-700">Secure & Encrypted</p>
                    </div>
                  </div>
                </div>

                {/* Install instructions */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-600 mb-1.5">How to install (Android)</p>
                  <ol className="text-[10px] text-slate-500 space-y-1 list-decimal list-inside">
                    <li>Tap <strong>&quot;Download for Android&quot;</strong> above</li>
                    <li>Open the downloaded APK file</li>
                    <li>Allow installation from unknown sources if prompted</li>
                    <li>Tap <strong>&quot;Install&quot;</strong> and open the app</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
          )}


          {/* Third-Party Job Portals */}
          {loginMode === 'candidate' && (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-3">
                <FiGlobe className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-700">Explore Opportunities</h3>
              </div>
              <p className="text-xs text-slate-400 mb-3">Browse jobs across top portals</p>
              <div className="grid grid-cols-2 gap-2">
                <a href="https://www.linkedin.com/jobs" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-green-50 hover:border-green-200 transition-all group">
                  <div className="w-8 h-8 rounded-lg bg-[#0A66C2] flex items-center justify-center text-white text-[10px] font-bold shrink-0">in</div>
                  <div className="min-w-0"><p className="text-xs font-semibold text-slate-700 truncate">LinkedIn</p><p className="text-[10px] text-slate-400">Professional network</p></div>
                  <FiExternalLink className="w-3 h-3 text-slate-300 group-hover:text-green-500 ml-auto shrink-0" />
                </a>
                <a href="https://www.naukri.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-green-50 hover:border-green-200 transition-all group">
                  <div className="w-8 h-8 rounded-lg bg-[#4A90D9] flex items-center justify-center text-white text-[10px] font-bold shrink-0">N</div>
                  <div className="min-w-0"><p className="text-xs font-semibold text-slate-700 truncate">Naukri</p><p className="text-[10px] text-slate-400">India&apos;s #1 job site</p></div>
                  <FiExternalLink className="w-3 h-3 text-slate-300 group-hover:text-green-500 ml-auto shrink-0" />
                </a>
                <a href="https://www.indeed.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-green-50 hover:border-green-200 transition-all group">
                  <div className="w-8 h-8 rounded-lg bg-[#2557A7] flex items-center justify-center text-white text-[10px] font-bold shrink-0">IN</div>
                  <div className="min-w-0"><p className="text-xs font-semibold text-slate-700 truncate">Indeed</p><p className="text-[10px] text-slate-400">Global job search</p></div>
                  <FiExternalLink className="w-3 h-3 text-slate-300 group-hover:text-green-500 ml-auto shrink-0" />
                </a>
                <a href="https://www.glassdoor.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-green-50 hover:border-green-200 transition-all group">
                  <div className="w-8 h-8 rounded-lg bg-[#0CAA41] flex items-center justify-center text-white text-[10px] font-bold shrink-0">G</div>
                  <div className="min-w-0"><p className="text-xs font-semibold text-slate-700 truncate">Glassdoor</p><p className="text-[10px] text-slate-400">Reviews &amp; jobs</p></div>
                  <FiExternalLink className="w-3 h-3 text-slate-300 group-hover:text-green-500 ml-auto shrink-0" />
                </a>
              </div>
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                <a href="https://www.monster.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors text-[11px] text-slate-500 hover:text-slate-700">Monster <FiExternalLink className="w-2.5 h-2.5" /></a>
                <a href="https://www.foundit.in" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors text-[11px] text-slate-500 hover:text-slate-700">Foundit <FiExternalLink className="w-2.5 h-2.5" /></a>
              </div>
            </div>
          )}
          {/* Footer */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <HiShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                Enterprise-grade security
              </div>
              <p className="text-[11px] text-slate-400">
                &copy; {new Date().getFullYear()} 3Boxes HRMS · A Proud Product of Marq AI Tech Group
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
