'use client';
import { useEffect, useState, useCallback } from 'react';
import { useAutoSeedDemo } from '@/hooks/useAutoSeedDemo';
import { useAuthStore } from '@/store/authStore';

export default function GiftingPage() {
  const [tab, setTab] = useState<'gifts' | 'kudos'>('gifts');
  const [gifts, setGifts] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);

  // Use authStore — fixes "no token provided" + missing employeeId.
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const employeeId = user?.employee?.employeeId || null;

  const load = useCallback(async (empId: string | null): Promise<void> => {
    if (!token) return;
    try {
      if (tab === 'gifts') {
        const r = await fetch('/api/gifts', { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json().catch(() => ({}));
        setGifts(d.gifts || []);
      } else {
        const r = await fetch(`/api/recognition?employeeId=${empId || ''}`, { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json().catch(() => ({}));
        setLedger(d.ledger || []);
      }
    } catch {
      // silent — page will show empty state
    }
  }, [tab, token]);

  // Auto-seed wellness (incl. gifts + kudos) demo data on first load
  const { seeded } = useAutoSeedDemo('wellness', () => load(employeeId));

  const [retriedFetchUser, setRetriedFetchUser] = useState(false);
  useEffect(() => {
    if (token && !user?.employee && !retriedFetchUser) {
      setRetriedFetchUser(true);
      fetchUser();
      return;
    }
    load(employeeId);
  }, [tab, employeeId, token, seeded, load, user, fetchUser, retriedFetchUser]);

  async function runMilestones(): Promise<void> {
    if (!token) return;
    const r = await fetch('/api/gifts/milestone-scan', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json().catch(() => ({}));
    alert(`Milestone scan: ${d.totalSent || 0} gifts sent (birthdays: ${d.birthdayGifts || 0}, anniversaries: ${d.anniversaryGifts || 0})`);
    load(employeeId);
  }
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Gifting & Rewards</h1>
          <p className="text-sm text-gray-600 mt-1">Milestone automation · P2P kudos · Wallet redemption (REQ-GFT-01/02/03)</p>
        </div>
        <button onClick={runMilestones} className="px-4 py-2 bg-teal-600 text-white rounded">⚡ Run Milestone Scan</button>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setTab('gifts')} className={`px-4 py-2 rounded ${tab === 'gifts' ? 'bg-green-600 text-white' : 'bg-gray-100'}`}>My Gifts</button>
        <button onClick={() => setTab('kudos')} className={`px-4 py-2 rounded ${tab === 'kudos' ? 'bg-green-600 text-white' : 'bg-gray-100'}`}>My Kudos Points</button>
      </div>
      {tab === 'gifts' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {gifts.map(g => (
            <div key={g.id} className="bg-white border rounded-lg p-4">
              <div className="text-2xl mb-1">{g.triggerEvent === 'birthday' ? '🎂' : g.triggerEvent === 'work_anniversary' ? '🎉' : '🎁'}</div>
              <h3 className="font-semibold capitalize text-sm">{g.triggerEvent.replace(/_/g, ' ')}</h3>
              <p className="text-xs text-gray-600 mt-1">{g.message}</p>
              {g.product && <p className="text-xs text-green-600 mt-2">{g.product.name}</p>}
              {g.voucherCode && <div className="mt-2 text-xs font-mono bg-gray-100 px-2 py-1 rounded">Code: {g.voucherCode}</div>}
              <div className="mt-2 text-xs text-gray-500">{new Date(g.createdAt).toLocaleDateString()}</div>
            </div>
          ))}
          {gifts.length === 0 && <div className="col-span-full text-center text-gray-500 py-12">No gifts received yet</div>}
        </div>
      )}
      {tab === 'kudos' && (
        <div className="bg-white border rounded-lg p-4">
          <div className="text-3xl font-bold text-teal-600">{ledger.length > 0 ? ledger[0].balanceAfter : 0} <span className="text-base text-gray-600">kudos points</span></div>
          <table className="min-w-full text-sm mt-4">
            <thead className="bg-gray-50 text-xs uppercase"><tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Source</th><th className="px-3 py-2 text-right">Points</th><th className="px-3 py-2 text-right">Balance</th></tr></thead>
            <tbody>
              {ledger.map(l => (
                <tr key={l.id} className="border-t">
                  <td className="px-3 py-2">{new Date(l.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{l.source}</td>
                  <td className="px-3 py-2 text-right text-green-600">+{l.points}</td>
                  <td className="px-3 py-2 text-right font-medium">{l.balanceAfter}</td>
                </tr>
              ))}
              {ledger.length === 0 && <tr><td colSpan={4} className="text-center text-gray-500 py-6">No kudos yet — give one to a peer!</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
