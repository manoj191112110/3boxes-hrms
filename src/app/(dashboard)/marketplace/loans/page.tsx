'use client';
import { useEffect, useState, useCallback } from 'react';
import { useAutoSeedDemo } from '@/hooks/useAutoSeedDemo';
import { useAuthStore } from '@/store/authStore';

export default function LoansPage() {
  const [listings, setListings] = useState<any[]>([]);

  // Use authStore instead of localStorage — authStore never persists `user`
  // to localStorage, so the previous `localStorage.getItem("user")` lookup
  // always returned null and listings never loaded.
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const employeeId = user?.employee?.employeeId || null;

  const load = useCallback(async (empId: string): Promise<void> => {
    if (!token || !empId) return;
    try {
      const r = await fetch(`/api/loan-marketplace?employeeId=${empId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json().catch(() => ({}));
      setListings(d.listings || []);
    } catch {
      setListings([]);
    }
  }, [token]);

  // Auto-seed wellness (incl. loan listings) demo data on first load
  const { seeded } = useAutoSeedDemo('wellness', () => {
    if (employeeId) load(employeeId);
  });

  const [retriedFetchUser, setRetriedFetchUser] = useState(false);
  useEffect(() => {
    if (token && !user?.employee && !retriedFetchUser) {
      setRetriedFetchUser(true);
      fetchUser();
      return;
    }
    if (employeeId) load(employeeId);
  }, [employeeId, token, seeded, load, user, fetchUser, retriedFetchUser]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Loan Marketplace</h1>
        <p className="text-sm text-gray-600 mt-1">Pre-approved offers · e-sign consent · Garnishment (REQ-FIN-04/05/06)</p>
      </div>
      <div className="bg-green-50 border-l-4 border-green-600 p-4 text-sm">
        <b>Note:</b> HRMS is a lead generator and repayment facilitator only. No lending is done by the platform. Salary data shared via one-time expiring deep link only.
      </div>
      {!employeeId && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          No employee record linked to your account. Loan offers are per-employee — please log in as a user with an Employee profile.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {listings.map(l => (
          <div key={l.id} className="bg-white border rounded-lg p-4">
            <div className="flex justify-between">
              <h3 className="font-semibold">{l.bankName}</h3>
              <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">{l.applicationStatus.replace(/_/g, ' ')}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
              <div><div className="text-xs text-gray-500">Amount</div><div className="font-medium">{l.currency} {l.offerAmount.toLocaleString()}</div></div>
              <div><div className="text-xs text-gray-500">Rate</div><div className="font-medium">{l.interestRate}%</div></div>
              <div><div className="text-xs text-gray-500">Tenure</div><div className="font-medium">{l.tenureMonths} months</div></div>
              <div><div className="text-xs text-gray-500">EMI</div><div className="font-medium">{l.currency} {l.emiAmount}</div></div>
            </div>
            <div className="mt-3 text-xs">
              {l.consentGiven ? <span className="text-green-600">✓ Consent given · Deep link sent</span> : <span className="text-yellow-700">⏳ Awaiting e-sign consent</span>}
            </div>
            {l.garnishmentActive && <div className="mt-2 text-xs px-2 py-1 bg-red-50 text-red-700 rounded">⚠ Garnishment active — payroll auto-deducts EMI</div>}
          </div>
        ))}
        {employeeId && listings.length === 0 && <div className="col-span-full text-center text-gray-500 py-12">No pre-approved offers yet. Bank partners will appear here based on your verified employment.</div>}
      </div>
    </div>
  );
}
