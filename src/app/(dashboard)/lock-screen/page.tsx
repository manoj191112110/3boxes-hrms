'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { validatePasswordRequired } from '@/lib/validators';

export default function LockScreenPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const userName = user?.name || user?.email || 'User';
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const pwResult = validatePasswordRequired(password);
    if (!pwResult.valid) {
      toast.error(pwResult.error!);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email, password }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          localStorage.setItem('tb_token', data.token);
        }
        toast.success('Welcome back!');
        router.push('/home');
      } else {
        toast.error('Incorrect password. Please try again.');
      }
    } catch {
      toast.error('Failed to unlock. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-green-950 to-slate-900 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-green-500/5 rounded-full blur-3xl" />
      </div>

      {/* Lock Screen Card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/20 p-8">
          {/* Brand */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-green-500/20 ring-1 ring-white/10">
              <svg viewBox="0 0 35 11" className="w-5 h-3" fill="none">
                <rect x="0" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
                <rect x="13" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
                <rect x="26" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
              </svg>
            </div>
            <span className="text-lg font-bold text-slate-800">3Boxes <span className="text-xs font-semibold text-emerald-500">HRMS</span></span>
          </div>

          {/* Lock Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
              <FiLock className="w-5 h-5 text-emerald-500" />
            </div>
          </div>

          {/* Welcome back */}
          <h2 className="text-2xl font-bold text-center text-slate-800 mb-1">Welcome back!</h2>

          {/* Avatar */}
          <div className="flex justify-center my-5">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-emerald-500/25 ring-4 ring-white">
              {initials}
            </div>
          </div>

          {/* User Name */}
          <h6 className="text-lg font-semibold text-center text-slate-700 mb-6">{userName}</h6>

          {/* Password Form */}
          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter Your Password"
                className="w-full px-4 py-3 pr-12 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-medium text-sm hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 shadow-lg shadow-emerald-500/25 transition-all"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Logout link */}
          <div className="mt-4 text-center">
            <button
              onClick={handleLogout}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Or sign in as a different user
            </button>
          </div>
        </div>

        {/* Footer links */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <a href="#" className="text-xs text-white/40 hover:text-white/60 transition-colors">Terms & Condition</a>
          <span className="text-white/20">&middot;</span>
          <a href="#" className="text-xs text-white/40 hover:text-white/60 transition-colors">Privacy</a>
          <span className="text-white/20">&middot;</span>
          <a href="#" className="text-xs text-white/40 hover:text-white/60 transition-colors">Help</a>
        </div>
      </div>
    </div>
  );
}
