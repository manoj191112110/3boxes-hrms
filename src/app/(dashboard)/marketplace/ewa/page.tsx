'use client';
import { useEffect, useState, useCallback } from 'react';
import { useAutoSeedDemo } from '@/hooks/useAutoSeedDemo';
import { useAuthStore } from '@/store/authStore';

export default function EWAPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [earnedToDate, setEarnedToDate] = useState(0);
  const [maxWithdrawable, setMaxWithdrawable] = useState(0);
  const [amount, setAmount] = useState(0);

  // Use authStore — localStorage "user" key was never set, so the previous
  // version never had an employeeId and never loaded any data.
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const employeeId = user?.employee?.employeeId || null;

  const load = useCallback(async (empId: string): Promise<void> => {
    if (!token || !empId) return;
    try {
      const r = await fetch(`/api/ewa?employeeId=${empId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json().catch(() => ({}));
      setRequests(d.requests || []);
      if (typeof d.earnedToDate === 'number') setEarnedToDate(d.earnedToDate);
      if (typeof d.maxWithdrawable === 'number') setMaxWithdrawable(d.maxWithdrawable);
    } catch {
      setRequests([]);
    }
  }, [token]);

  // Auto-seed wellness (incl. EWA) demo data on first load
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

  async function request(): Promise<void> {
    if (!employeeId || amount <= 0 || !token) return;
    const r = await fetch('/api/ewa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ employeeId, requestedAmount: amount }),
    });
    if (r.ok) {
      const d = await r.json();
      setEarnedToDate(d.earnedToDate);
      setMaxWithdrawable(d.maxWithdrawable);
      setAmount(0);
      load(employeeId);
      alert(`EWA approved! Fee: ${d.feeAmount}`);
    } else {
      const e = await r.json().catch(() => ({}));
      alert(e.error || 'Request failed');
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Earned Wage Access</h1>
        <p className="text-sm text-gray-600 mt-1">Real-time balance · 70% cap · Auto-settled on payroll (REQ-FIN-01/02/03)</p>
      </div>
      {!employeeId && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          No employee record linked to your account. EWA is per-employee — please log in as a user with an Employee profile.
        </div>
      )}
      <div className="bg-gradient-to-br from-yellow-500 to-orange-500 text-white rounded-lg p-6 shadow-lg">
        <div className="text-sm opacity-90">Available to withdraw (70% of earned-to-date)</div>
        <div className="text-4xl font-bold mt-1">INR {Math.max(0, maxWithdrawable).toFixed(0)}</div>
        <div className="text-xs opacity-75 mt-2">Earned to date: INR {earnedToDate.toFixed(0)} · Fee: 2% · Settles on next payroll</div>
      </div>
      {employeeId && (
        <div className="bg-white border rounded-lg p-4 flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs text-gray-600">Amount (INR)</label>
            <input type="number" value={amount} onChange={e => setAmount(parseFloat(e.target.value))} className="w-full border rounded px-3 py-2" />
          </div>
          <button onClick={request} className="px-6 py-2 bg-green-600 text-white rounded">Request Advance</button>
        </div>
      )}
      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold mb-3">History</h3>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase"><tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-right">Requested</th><th className="px-3 py-2 text-right">Fee</th><th className="px-3 py-2 text-center">Status</th></tr></thead>
          <tbody>
            {requests.map(r => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{new Date(r.createdAt).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-right">{r.currency} {r.requestedAmount}</td>
                <td className="px-3 py-2 text-right text-red-600">{r.feeAmount}</td>
                <td className="px-3 py-2 text-center"><span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">{r.status}</span></td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr><td colSpan={4} className="text-center text-gray-500 py-6">No EWA requests yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
