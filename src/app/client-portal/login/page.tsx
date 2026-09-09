'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { validateEmail } from '@/lib/validators';

export default function ClientPortalLogin() {
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function requestOtp(e: any) {
    e.preventDefault(); setError('');
    const emailResult = validateEmail(email);
    if (!emailResult.valid) { setError(emailResult.error!); return; }
    setLoading(true);
    const r = await fetch('/api/client-portal/auth/request-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    setLoading(false);
    if (r.ok) setStep('verify'); else setError((await r.json()).error);
  }
  async function verify(e: any) {
    e.preventDefault(); setError(''); setLoading(true);
    const r = await fetch('/api/client-portal/auth/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, otp }) });
    setLoading(false);
    if (r.ok) { const d = await r.json(); localStorage.setItem('clientPortalToken', d.token); localStorage.setItem('clientPortalUser', JSON.stringify(d.user)); window.location.href = '/client-portal/dashboard'; }
    else setError((await r.json()).error);
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-700 to-emerald-900 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🏢</div>
          <h1 className="text-2xl font-bold text-gray-800">Client Portal</h1>
          <p className="text-sm text-gray-600 mt-1">Secure access · MFA enforced · GDPR compliant</p>
        </div>
        {step === 'request' ? (
          <form onSubmit={requestOtp} className="space-y-3">
            <input type="email" placeholder="Your work email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full border rounded px-3 py-2" />
            <button disabled={loading} type="submit" className="w-full bg-green-600 text-white py-2 rounded">{loading ? 'Sending...' : 'Send OTP'}</button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-3">
            <p className="text-sm text-gray-600">Enter the 6-digit OTP sent to <b>{email}</b></p>
            <input maxLength={6} placeholder="123456" required value={otp} onChange={e => setOtp(e.target.value)} className="w-full border rounded px-3 py-2 text-center text-2xl tracking-widest font-mono" />
            <button disabled={loading} type="submit" className="w-full bg-green-600 text-white py-2 rounded">{loading ? 'Verifying...' : 'Verify & Login'}</button>
            <button type="button" onClick={() => setStep('request')} className="w-full text-sm text-gray-500">← Use different email</button>
          </form>
        )}
        {error && <div className="mt-3 text-sm text-red-600 text-center">{error}</div>}
      </div>
    </div>
  );
}
