'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/store/app-store';
import { ROLE_LABELS, type UserRole } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Users, UserCheck, Building2, Truck, Hexagon, ArrowRight, Sparkles, Loader2, AlertCircle } from 'lucide-react';

const DEMO_LOGINS: { role: UserRole; name: string; email: string; password: string; icon: React.ReactNode; color: string }[] = [
  { role: 'super_admin', name: 'Super Admin', email: 'admin@3boxeshrms.com', password: 'admin123', icon: <Shield className="h-4 w-4" />, color: 'bg-red-500 hover:bg-red-600' },
  { role: 'tenant_admin', name: 'Tenant Admin', email: 'admin@marqaitechgroup.com', password: 'MarqAI@2026', icon: <Users className="h-4 w-4" />, color: 'bg-green-500 hover:bg-green-600' },
  { role: 'admin', name: 'Admin', email: 'admin@marqai.com', password: 'MarqAI@2026', icon: <UserCheck className="h-4 w-4" />, color: 'bg-emerald-500 hover:bg-emerald-600' },
];

export function LoginScreen() {
  const { login, isLoading, authError } = useAppStore();
  const [email, setEmail] = useState('admin@3boxeshrms.com');
  const [password, setPassword] = useState('admin123');
  const [mounted, setMounted] = useState(true);

  const handleLogin = async () => {
    if (email && password) {
      await login(email, password);
    }
  };

  const handleQuickLogin = async (role: UserRole, name: string, email: string, password: string) => {
    setEmail(email);
    setPassword(password);
    await login(email, password);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900" />
      
      {/* Animated background shapes - CSS animations instead of framer-motion */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-400/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

      <div className={`relative z-10 w-full max-w-md mx-4 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        {/* Logo and Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl shadow-2xl shadow-emerald-500/30 mb-4 animate-[spin_20s_linear_infinite]">
            <Hexagon className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">3Boxes HRMS</h1>
          <p className="text-emerald-200/80 mt-2 text-sm">AI-Powered Enterprise Human Resource Management</p>
        </div>

        {/* Login Card */}
        <Card className="backdrop-blur-xl bg-white/10 border-white/20 shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-xl flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-400" />
              Sign In to 3Boxes HRMS
            </CardTitle>
            <CardDescription className="text-emerald-200/70">
              Enter your credentials to access the platform
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-emerald-100 text-sm font-medium">Email</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter your email"
                type="email"
                className="bg-white/10 border-white/20 text-white placeholder:text-emerald-200/50 focus:border-emerald-400"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-emerald-100 text-sm font-medium">Password</Label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter your password"
                type="password"
                className="bg-white/10 border-white/20 text-white placeholder:text-emerald-200/50 focus:border-emerald-400"
              />
            </div>

            {authError && (
              <div className="flex items-center gap-2 text-red-300 text-sm bg-red-500/10 rounded-md p-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {authError}
              </div>
            )}

            <Button
              onClick={handleLogin}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold h-11 shadow-lg shadow-emerald-500/30"
              disabled={(!email || !password) || isLoading}
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...</>
              ) : (
                <>Sign In <ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/20" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-transparent px-2 text-emerald-200/70">Quick Demo Login</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {DEMO_LOGINS.map((demo) => (
                <button
                  key={demo.role}
                  onClick={() => handleQuickLogin(demo.role, demo.name, demo.email, demo.password)}
                  className={`${demo.color} text-white rounded-lg px-3 py-2.5 text-xs font-medium flex items-center gap-2 transition-all shadow-md hover:shadow-lg hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50`}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : demo.icon}
                  {ROLE_LABELS[demo.role]}
                </button>
              ))}
            </div>

            <p className="text-center text-emerald-200/50 text-xs mt-2">
              Database-backed authentication with real data
            </p>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-emerald-200/40 text-xs mt-6">
          &copy; 2025 3Boxes HRMS. A Proud Product of Marq AI Tech Group.
        </p>
      </div>
    </div>
  );
}
