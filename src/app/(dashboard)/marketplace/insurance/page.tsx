'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import SeedEcosystemButton from '@/components/SeedEcosystemButton';
import { useAutoSeedDemo } from '@/hooks/useAutoSeedDemo';
import { useAuthStore } from '@/store/authStore';

export default function InsurancePage() {
  const [policies, setPolicies] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);

  // Use authStore token — fixes "no token provided" error.
  const token = useAuthStore((s) => s.token);

  const load = useCallback(async (): Promise<void> => {
    if (!token) return;
    try {
      const [p, c] = await Promise.all([
        fetch('/api/insurance/policies', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/insurance/claims', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [pd, cd] = await Promise.all([p.json().catch(() => ({})), c.json().catch(() => ({}))]);
      setPolicies(pd.policies || []);
      setClaims(cd.claims || []);
    } catch {
      // silent
    }
  }, [token]);

  // Auto-seed wellness + insurance demo data on first load
  const { seeded } = useAutoSeedDemo('wellness', () => load());

  useEffect(() => { load(); }, [load, seeded]);
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Insurance Top-Up</h1>
          <p className="text-sm text-gray-600 mt-1">Group + voluntary · AI claims assistant · Payroll deduction (REQ-INS-01..05)</p>
        </div>
        <SeedEcosystemButton module="wellness" label="Seed Wellness & Insurance Data" />
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
        💡 The wellness seed also populates EWA requests, loan marketplace listings, gifts, reward points, and financial stress flags — all powered by the same module.
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold mb-3">Active Policies</h3>
          {policies.map(p => (
            <div key={p.id} className="border-b last:border-0 py-2">
              <div className="flex justify-between">
                <span className="font-medium">{p.policyType.replace(/_/g, ' ')}</span>
                <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">{p.providerName}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">Coverage: {p.premiumCurrency} {p.coverageAmount.toLocaleString()} · Premium: {p.premiumAmount}/mo · {p.paymentMode}</div>
            </div>
          ))}
          {policies.length === 0 && <div className="text-gray-500 text-sm py-4">No active policies</div>}
        </div>
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold mb-3">Recent Claims (AI-Assisted)</h3>
          {claims.map(c => (
            <div key={c.id} className="border-b last:border-0 py-2">
              <div className="flex justify-between">
                <span className="font-medium">Claim #{c.id.slice(-6)}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${c.status === 'approved' || c.status === 'paid' ? 'bg-green-100 text-green-700' : c.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{c.status}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">Amount: {c.claimAmount} · AI Confidence: {((c.aiConfidence || 0) * 100).toFixed(0)}%</div>
            </div>
          ))}
          {claims.length === 0 && <div className="text-gray-500 text-sm py-4">No claims filed</div>}
        </div>
      </div>
    </div>
  );
}
