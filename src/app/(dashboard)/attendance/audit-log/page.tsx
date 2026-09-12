'use client';

import { useEffect, useState, useCallback } from 'react';
import { FiLock, FiRefreshCw, FiEye } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';
import ModuleTips from '@/components/ModuleTips';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface AuditLog {
  id: string;
  action: string;
  beforeData: unknown;
  afterData: unknown;
  changedBy: string;
  changedByIp: string | null;
  reason: string | null;
  createdAt: string;
  employee: { id: string; firstName: string; lastName: string; employeeId: string };
}

export default function AuditLogPage() {
  const { user } = useAuthStore();
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');

  const [items, setItems] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('');
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (filterAction) params.set('action', filterAction);
      const sq = scopeQuery();
      const r = await fetch(`/api/attendance/audit-log?${params.toString()}${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setItems(d.auditLogs || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [filterAction, scopeQuery, selectedTenantId]);

  useEffect(() => { if (isAdmin) fetchItems(); }, [fetchItems, isAdmin]);

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <FiLock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">Attendance Audit Logs are restricted to admins.</p>
      </div>
    );
  }

  const fmtDateTime = (d: string) => new Date(d).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FiLock className="w-6 h-6 text-slate-600" />
            Attendance Audit Trail
          </h1>
          <p className="text-sm text-slate-500 mt-1">Append-only log of every attendance change · original + changed data + IP</p>
        </div>
        <button onClick={fetchItems} className="3boxes-btn-secondary flex items-center gap-2">
          <FiRefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <ModuleTips moduleKey="attendance-audit-log">
        <p><strong>REQ-SEC-ATT-04:</strong> Every change to an employee&apos;s attendance record (manual edit, regularization approval, shift change, mass correction) retains the original raw data alongside the changed data, timestamp, and IP address of the person who made the change. Entries are append-only and never edited or deleted.</p>
      </ModuleTips>

      <div className="bg-white rounded-xl p-4 border border-slate-200">
        <div className="flex items-center gap-3">
          <select value={filterAction} onChange={e => setFilterAction(e.target.value)} className="3boxes-input min-w-[200px]">
            <option value="">All actions</option>
            <option value="manual_edit">Manual edit</option>
            <option value="regularization_approved">Regularization approved</option>
            <option value="shift_change">Shift change</option>
            <option value="mass_correction">Mass correction</option>
          </select>
        </div>
      </div>

      <div className="thb-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Timestamp</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Employee</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Action</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Changed By</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">IP</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Reason</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-700">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">Loading...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500">No audit entries yet</td></tr>
              ) : items.map(l => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700 text-xs">{fmtDateTime(l.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-700">{l.employee ? `${l.employee.firstName} ${l.employee.lastName}` : '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">{l.action.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 text-xs font-mono">{l.changedBy}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs font-mono">{l.changedByIp || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate text-xs">{l.reason || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setSelected(l)} className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded" title="View diff">
                      <FiEye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Diff modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200 sticky top-0 bg-white">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Audit Diff</h2>
                <p className="text-xs text-slate-500">{selected.action.replace(/_/g, ' ')} · {fmtDateTime(selected.createdAt)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-2">Before</h3>
                <pre className="text-xs bg-red-50 p-3 rounded-lg overflow-x-auto text-red-900">{JSON.stringify(selected.beforeData, null, 2) || '— (no prior record)'}</pre>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">After</h3>
                <pre className="text-xs bg-emerald-50 p-3 rounded-lg overflow-x-auto text-emerald-900">{JSON.stringify(selected.afterData, null, 2) || '—'}</pre>
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 text-xs text-slate-600 space-y-1">
              <p><strong>Employee:</strong> {selected.employee?.firstName} {selected.employee?.lastName} ({selected.employee?.employeeId})</p>
              <p><strong>Changed by:</strong> {selected.changedBy} · IP: {selected.changedByIp || '—'}</p>
              <p><strong>Reason:</strong> {selected.reason || '—'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
