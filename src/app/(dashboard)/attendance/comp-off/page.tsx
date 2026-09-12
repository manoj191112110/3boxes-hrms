'use client';

import { useEffect, useState, useCallback } from 'react';
import { FiGift, FiRefreshCw, FiAlertTriangle, FiClock } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';
import ModuleTips from '@/components/ModuleTips';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface CompOff {
  id: string;
  earnedDate: string;
  hours: number;
  source: string;
  expiryDate: string | null;
  used: number;
  status: string;
}

export default function CompOffPage() {
  const { user } = useAuthStore();
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');

  const [items, setItems] = useState<CompOff[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const sq = scopeQuery();
      const r = await fetch(`/api/attendance/comp-off?limit=100${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setItems(d.compOffs || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [scopeQuery, selectedTenantId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const totalHours = items.filter(c => c.status === 'active').reduce((s, c) => s + (c.hours - c.used), 0);
  const expiringSoon = items.filter(c => {
    if (!c.expiryDate || c.status !== 'active') return false;
    const days = (new Date(c.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days <= 14 && days > 0;
  });

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FiGift className="w-6 h-6 text-emerald-500" />
            Comp-Off Leave Balance
          </h1>
          <p className="text-sm text-slate-500 mt-1">Overtime converted to compensatory leave · Expires in 90 days</p>
        </div>
        <button onClick={fetchItems} className="3boxes-btn-secondary flex items-center gap-2">
          <FiRefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <ModuleTips moduleKey="attendance-comp-off">
        <p><strong>REQ-OT-03:</strong> When your approved Overtime Request has payoutPreference = comp_off, the OT hours are credited here as compensatory leave. Comp-offs expire 90 days after the earn date — use them or lose them.</p>
      </ModuleTips>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-xs uppercase tracking-wider text-slate-500">Available Hours</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{totalHours}h</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-xs uppercase tracking-wider text-slate-500">Total Comp-Offs Earned</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{items.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-xs uppercase tracking-wider text-amber-600">Expiring ≤14 days</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{expiringSoon.length}</p>
        </div>
      </div>

      {expiringSoon.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <FiAlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">You have {expiringSoon.length} comp-off(s) expiring soon</p>
            <p className="text-xs text-amber-700 mt-0.5">Apply for leave using these comp-offs before they expire to avoid losing them.</p>
          </div>
        </div>
      )}

      <div className="thb-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Earned Date</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Source</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Hours</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Used</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Remaining</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Expiry</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">Loading...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500">
                  <FiGift className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  No comp-offs earned yet. Submit an Overtime Request with comp-off preference to earn one.
                </td></tr>
              ) : items.map(c => {
                const remaining = c.hours - c.used;
                const daysToExpiry = c.expiryDate ? Math.floor((new Date(c.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                const isExpiringSoon = daysToExpiry !== null && daysToExpiry <= 14 && daysToExpiry > 0 && c.status === 'active';
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{fmtDate(c.earnedDate)}</td>
                    <td className="px-4 py-3 text-slate-700 capitalize">{c.source.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-slate-700">{c.hours}h</td>
                    <td className="px-4 py-3 text-slate-700">{c.used}h</td>
                    <td className="px-4 py-3 text-slate-700 font-medium">{remaining}h</td>
                    <td className="px-4 py-3 text-slate-700">
                      {fmtDate(c.expiryDate)}
                      {isExpiringSoon && <span className="ml-1 text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">{daysToExpiry}d left</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`thb-badge ${
                        c.status === 'active' ? 'thb-badge-success' :
                        c.status === 'expired' ? 'thb-badge-error' :
                        c.status === 'used' ? 'bg-slate-100 text-slate-600 thb-badge' : 'thb-badge-info'
                      }`}>{c.status.replace('_', ' ')}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
