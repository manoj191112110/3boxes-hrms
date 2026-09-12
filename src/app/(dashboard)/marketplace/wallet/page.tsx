'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAutoSeedDemo } from '@/hooks/useAutoSeedDemo';
import { useAuthStore } from '@/store/authStore';

export default function WalletPage() {
  const [wallet, setWallet] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Pull token + employee info from the authStore instead of localStorage.
  // The authStore never persists `user` to localStorage, so the previous
  // `localStorage.getItem("user")` lookup always returned null, employeeId
  // was never set, loadWallet was never called, and the page was stuck on
  // "Loading wallet..." forever.
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const employeeId = user?.employee?.employeeId || null;

  const loadWallet = useCallback(async (empId: string): Promise<void> => {
    if (!token) return;
    try {
      setLoadError(null);
      const r = await fetch(`/api/wallet?employeeId=${empId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        setLoadError(e.error || `Failed to load wallet (HTTP ${r.status})`);
        return;
      }
      const data = await r.json();
      setWallet(data.wallet);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Network error');
    }
  }, [token]);

  // Auto-seed wellness/wallet demo data on first load
  const { seeded } = useAutoSeedDemo('wellness', () => {
    if (employeeId) loadWallet(employeeId);
  });

  // When user info (incl. employee) becomes available, or after seeding
  // completes, fetch the wallet. Also retry once if employee info isn't
  // loaded yet (e.g. fetchUser is still in flight right after login).
  const [ retriedFetchUser, setRetriedFetchUser ] = useState(false);
  useEffect(() => {
    if (token && !user?.employee && !retriedFetchUser) {
      setRetriedFetchUser(true);
      fetchUser();
      return;
    }
    if (employeeId) loadWallet(employeeId);
  }, [employeeId, token, seeded, loadWallet, user, fetchUser, retriedFetchUser]);

  // Friendly empty-states instead of being stuck on "Loading wallet..."
  if (!token) {
    return <div className="p-6 text-gray-500">Please log in to view your wallet.</div>;
  }
  if (!employeeId) {
    return (
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">My Wallet</h1>
          <p className="text-sm text-gray-600 mt-1">Multi-bucket · Co-pay logic · Tax-optimized (REQ-MKT-01/02/03/04)</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          No employee record linked to your account. Wallets are per-employee — please log in as a user with an Employee profile, or assign an Employee record to this user in the admin console.
        </div>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">My Wallet</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {loadError}
        </div>
        <button
          onClick={() => employeeId && loadWallet(employeeId)}
          className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700"
        >
          Retry
        </button>
      </div>
    );
  }
  if (!wallet) return <div className="p-6 text-gray-500">Loading wallet...</div>;
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Wallet</h1>
        <p className="text-sm text-gray-600 mt-1">Multi-bucket · Co-pay logic · Tax-optimized (REQ-MKT-01/02/03/04)</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {wallet.buckets?.map((b: any) => (
          <div key={b.id} className="bg-white border rounded-lg p-4 shadow-sm">
            <div className="flex justify-between items-start">
              <h3 className="font-semibold capitalize">{b.category.replace(/_/g, ' ')}</h3>
              <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">Employer {b.employerCoPayPct}%</span>
            </div>
            <div className="text-3xl font-bold text-gray-800 mt-2">{wallet.currency} {b.balance.toLocaleString()}</div>
            {b.expiresAt && <div className="text-xs text-gray-500 mt-1">Expires: {new Date(b.expiresAt).toLocaleDateString()}</div>}
          </div>
        ))}
      </div>
      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold mb-3">Recent Transactions</h3>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase">
            <tr><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Description</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-right">Date</th></tr>
          </thead>
          <tbody>
            {wallet.transactions?.map((t: any) => (
              <tr key={t.id} className="border-t">
                <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded ${t.type === 'credit' ? 'bg-green-100 text-green-700' : t.type === 'debit' ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>{t.type}</span></td>
                <td className="px-3 py-2">{t.description || '-'}</td>
                <td className={`px-3 py-2 text-right font-medium ${t.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>{t.type === 'debit' ? '-' : '+'}{t.amount}</td>
                <td className="px-3 py-2 text-right text-xs text-gray-500">{new Date(t.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {(!wallet.transactions || wallet.transactions.length === 0) && <tr><td colSpan={4} className="text-center text-gray-500 py-6">No transactions yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
