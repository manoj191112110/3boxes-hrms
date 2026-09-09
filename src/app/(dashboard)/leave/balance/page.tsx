'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiPieChart, FiCalendar, FiRefreshCw,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface LeaveBalance {
  type: string;
  code: string;
  total: number;
  used: number;
  pending: number;
  color: string;
  lightColor: string;
  textColor: string;
}

interface LeaveHistory {
  id: string;
  type: string;
  from: string;
  to: string;
  days: number;
  status: string;
}

/* ── Helpers ── */
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'Approved': case 'approved': return 'thb-badge thb-badge-success';
    case 'Pending': case 'pending': return 'thb-badge thb-badge-warning';
    case 'Rejected': case 'rejected': return 'thb-badge thb-badge-error';
    default: return 'thb-badge thb-badge-info';
  }
}

const BALANCE_COLORS = [
  { color: 'bg-green-500', lightColor: 'bg-green-100', textColor: 'text-green-600' },
  { color: 'bg-rose-500', lightColor: 'bg-rose-100', textColor: 'text-rose-600' },
  { color: 'bg-emerald-500', lightColor: 'bg-emerald-100', textColor: 'text-emerald-600' },
  { color: 'bg-amber-500', lightColor: 'bg-amber-100', textColor: 'text-amber-600' },
  { color: 'bg-cyan-500', lightColor: 'bg-cyan-100', textColor: 'text-cyan-600' },
  { color: 'bg-violet-500', lightColor: 'bg-violet-100', textColor: 'text-violet-600' },
];

export default function LeaveBalancePage() {
  useAuthStore();
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);

  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [history, setHistory] = useState<LeaveHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const sq = scopeQuery();
      // Fetch leave balances
      const balRes = await fetch(`/api/leave/balance${sq ? `?${sq}` : ''}`, { headers: getAuthHeaders() });
      if (balRes.ok) {
        const balData = await balRes.json();
        const rawBalances = balData.balances || balData.leaveBalances || [];
        const mapped = rawBalances.map((b: Record<string, unknown>, idx: number) => {
          const colors = BALANCE_COLORS[idx % BALANCE_COLORS.length];
          return {
            type: String(b.leaveTypeName || b.type || b.name || ''),
            code: String(b.leaveTypeCode || b.code || ''),
            total: Number(b.total || b.annualQuota || 0),
            used: Number(b.used || 0),
            pending: Number(b.pending || 0),
            ...colors,
          };
        });
        setBalances(mapped);
      }
    } catch {
      // API may not exist yet — show empty state
      setBalances([]);
    }

    try {
      const sq = scopeQuery();
      // Fetch recent leave history
      const histRes = await fetch(`/api/leave?limit=5&status=all${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      if (histRes.ok) {
        const histData = await histRes.json();
        const rawHistory = histData.leaves || histData.applications || [];
        const mappedHistory = rawHistory.map((l: Record<string, unknown>) => ({
          id: String(l.id),
          type: String(l.leaveTypeName || l.type || ''),
          from: String(l.startDate || l.from || ''),
          to: String(l.endDate || l.to || ''),
          days: Number(l.totalDays || l.days || 0),
          status: String(l.status || '').replace(/^\w/, c => c.toUpperCase()),
        }));
        setHistory(mappedHistory);
      }
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [scopeQuery, selectedTenantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return <div className="text-center py-12 text-slate-400">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-green-50">
            <FiPieChart className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">My Leave Balance</h1>
            <p className="text-sm text-thb-text-secondary">Overview of your leave entitlements and usage</p>
          </div>
        </div>
        <button onClick={fetchData} className="inline-flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-slate-800 rounded-lg text-sm transition-colors" title="Refresh">
          <FiRefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Leave Balance Cards */}
      {balances.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <FiPieChart className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p>No leave balance data available.</p>
          <p className="text-xs text-slate-400 mt-1">Leave balances will appear once leave types are configured.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {balances.map((lb) => {
            const available = lb.total - lb.used - lb.pending;
            const usagePercent = lb.total > 0 ? Math.round((lb.used / lb.total) * 100) : 0;
            return (
              <div key={lb.code} className="thb-card p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${lb.lightColor} flex items-center justify-center`}>
                      <FiCalendar className={`w-5 h-5 ${lb.textColor}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-thb-text-primary">{lb.type}</h3>
                      <p className={`text-2xl font-bold ${lb.textColor}`}>{available} <span className="text-sm font-normal text-thb-text-muted">available</span></p>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-thb-text-secondary">Usage</span>
                    <span className="text-xs font-medium text-thb-text-primary">{usagePercent}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${lb.color} transition-all duration-500`}
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-thb-border">
                  <div className="text-center">
                    <p className="text-lg font-bold text-thb-text-primary">{lb.total}</p>
                    <p className="text-xs text-thb-text-muted">Total</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-thb-text-primary">{lb.used}</p>
                    <p className="text-xs text-thb-text-muted">Used</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-thb-text-primary">{available}</p>
                    <p className="text-xs text-thb-text-muted">Available</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent Leave History */}
      <div className="thb-card">
        <div className="px-5 py-4 border-b border-thb-border">
          <h2 className="font-semibold text-thb-text-primary">Recent Leave History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-thb-border bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Type</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">From</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">To</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Days</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500">No recent leave history</td></tr>
              ) : history.map((item) => (
                <tr key={item.id} className="border-b border-thb-border last:border-b-0 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-sm text-thb-text-primary font-medium">{item.type}</td>
                  <td className="px-5 py-3 text-sm text-thb-text-secondary">{formatDate(item.from)}</td>
                  <td className="px-5 py-3 text-sm text-thb-text-secondary">{formatDate(item.to)}</td>
                  <td className="px-5 py-3 text-sm text-thb-text-primary text-center">{item.days}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={getStatusBadge(item.status)}>{item.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
