'use client';

// REQ-7.2 + REQ-SEC-PAY-02 — Payroll Approval Workflow + SoD
// -----------------------------------------------------------
// Lists pending approvals for the current user's role. The same user
// who initiated the run CANNOT approve it (Segregation of Duties).

import { useEffect, useState, useCallback } from 'react';
import {
  FiCheck, FiX, FiShield, FiClock, FiRefreshCw, FiAlertTriangle,
  FiFileText, FiUserCheck,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Approval {
  id: string;
  payrollRunId: string;
  approvalStage: string;
  requestedBy: string;
  requestedAt: string;
  approverRole: string;
  approverUserId: string | null;
  status: string;
  approvedAt: string | null;
  rejectionReason: string | null;
  approvalNotes: string | null;
  sodConflictFlag: boolean;
  payrollRun?: {
    id: string; payrollPeriod: string; runType: string; runStatus: string;
    totalNetPay: number; totalEmployees: number; currencyCode: string;
    company?: { id: string; name: string; country: string | null };
  };
}

export default function PayrollApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [summary, setSummary] = useState<{ total: number; pending: number; approved: number; rejected: number; sodConflicts: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const { user } = useAuthStore();
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL('/api/payroll/approvals', window.location.origin);
      if (filter !== 'ALL') url.searchParams.set('status', filter);
      const res = await fetch(url.toString(), { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch approvals');
      const json = await res.json();
      setApprovals(json.data || []);
      if (json.summary) setSummary(json.summary);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }, [filter]);
  const cid = effectiveCompanyId();
  const scopeQuery = cid ? `companyId=${cid}&` : '';


  useEffect(() => { fetchApprovals(); }, [fetchApprovals]);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    const notes = notesById[id] || '';
    if (action === 'reject' && !notes.trim()) {
      toast.error('A reason is required when rejecting a payroll run');
      return;
    }
    setActioningId(id);
    try {
      const res = await fetch(`/api/payroll/approvals?${scopeQuery}` , {
        method: 'PATCH', headers: getAuthHeaders(),
        body: JSON.stringify({ id, action, notes }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.sodConflict) {
          toast.error(`SoD violation: ${json.error}`);
        } else {
          throw new Error(json.error || 'Action failed');
        }
      } else {
        toast.success(action === 'approve' ? 'Payroll approved' : 'Payroll rejected — returned for correction');
        setNotesById((p) => { const n = { ...p }; delete n[id]; return n; });
        fetchApprovals();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActioningId(null);
    }
  };

  const stageLabel = (s: string) => ({
    CALCULATION_REVIEW: 'Calculation Review',
    DISBURSEMENT_APPROVAL: 'Disbursement Approval',
    POST_DISBURSEMENT_AUDIT: 'Post-Disbursement Audit',
  } as Record<string, string>)[s] || s;

  const fmtCurrency = (amt: number, cur: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(amt);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiUserCheck className="w-6 h-6 text-emerald-500" />
            Payroll Approvals
          </h1>
          <p className="text-thb-text-secondary mt-1">Tenant Admin approval workflow with Segregation of Duties enforcement</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="px-3 py-2 text-sm border border-thb-border rounded-lg bg-white text-thb-text-primary">
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="ALL">All</option>
          </select>
          <button onClick={fetchApprovals} className="p-2.5 rounded-lg border border-thb-border text-thb-text-secondary hover:bg-slate-50 transition-colors">
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <SummaryCard label="Total" value={summary.total} color="slate" />
          <SummaryCard label="Pending" value={summary.pending} color="amber" />
          <SummaryCard label="Approved" value={summary.approved} color="emerald" />
          <SummaryCard label="Rejected" value={summary.rejected} color="red" />
          <SummaryCard label="SoD Conflicts" value={summary.sodConflicts} color="violet" />
        </div>
      )}

      {/* SoD Notice */}
      <div className="thb-card p-4 border-l-4 border-teal-500 bg-teal-50/30">
        <div className="flex items-start gap-3">
          <FiShield className="w-5 h-5 text-teal-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-thb-text-primary">Segregation of Duties (SoD) — REQ-SEC-PAY-02</p>
            <p className="text-xs text-thb-text-secondary mt-1">
              The user who initiates a payroll run cannot approve its disbursement. The system enforces this at approval time and refuses to record an approval if <code className="px-1 bg-slate-100 rounded">requestedBy</code> matches the approver, or if the approver's role doesn't match <code className="px-1 bg-slate-100 rounded">approverRole</code>.
              {user && (
                <> Your current role: <strong className="text-teal-700">{(user as { role?: string }).role || 'unknown'}</strong></>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Approval list */}
      {loading ? (
        <div className="thb-card p-12 text-center text-thb-text-secondary">Loading…</div>
      ) : approvals.length === 0 ? (
        <div className="thb-card p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 text-slate-400 mb-3"><FiClock className="w-8 h-8" /></div>
          <p className="text-sm text-thb-text-secondary">No {filter !== 'ALL' ? filter.toLowerCase() : ''} approvals.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map((a) => (
            <div key={a.id} className="thb-card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="px-2 py-0.5 text-xs font-semibold rounded bg-green-100 text-green-700">{stageLabel(a.approvalStage)}</span>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded ${a.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : a.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{a.status}</span>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 text-slate-700">Approver: {a.approverRole}</span>
                    {a.sodConflictFlag && <span className="px-2 py-0.5 text-xs font-semibold rounded bg-red-100 text-red-700 inline-flex items-center gap-1"><FiAlertTriangle className="w-3 h-3" /> SoD Conflict</span>}
                  </div>
                  {a.payrollRun && (
                    <div className="mt-2">
                      <p className="text-sm font-semibold text-thb-text-primary">
                        {a.payrollRun.company?.name || 'Unknown Company'} — Period {a.payrollRun.payrollPeriod}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-xs">
                        <div><span className="text-slate-500">Run Type:</span> <span className="font-semibold">{a.payrollRun.runType}</span></div>
                        <div><span className="text-slate-500">Run Status:</span> <span className="font-semibold">{a.payrollRun.runStatus}</span></div>
                        <div><span className="text-slate-500">Employees:</span> <span className="font-semibold">{a.payrollRun.totalEmployees}</span></div>
                        <div><span className="text-slate-500">Net Pay:</span> <span className="font-semibold">{fmtCurrency(a.payrollRun.totalNetPay, a.payrollRun.currencyCode)}</span></div>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-slate-400 mt-2">Requested by {a.requestedBy} on {new Date(a.requestedAt).toLocaleString()}</p>
                </div>
              </div>

              {a.status === 'PENDING' && (
                <div className="border-t border-thb-border pt-3 mt-3">
                  <textarea
                    value={notesById[a.id] || ''}
                    onChange={(e) => setNotesById((p) => ({ ...p, [a.id]: e.target.value }))}
                    placeholder={filter === 'PENDING' ? 'Notes / rejection reason (mandatory for reject)' : 'Notes'}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-thb-border rounded-lg bg-white text-thb-text-primary mb-2"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAction(a.id, 'approve')}
                      disabled={actioningId === a.id}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-sm font-medium disabled:opacity-50"
                    >
                      <FiCheck className="w-4 h-4" /> Approve
                    </button>
                    <button
                      onClick={() => handleAction(a.id, 'reject')}
                      disabled={actioningId === a.id}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium disabled:opacity-50"
                    >
                      <FiX className="w-4 h-4" /> Reject
                    </button>
                  </div>
                </div>
              )}

              {a.status !== 'PENDING' && a.approvalNotes && (
                <div className="border-t border-thb-border pt-3 mt-3 text-xs text-thb-text-secondary">
                  <strong>{a.status === 'APPROVED' ? 'Approval' : 'Rejection'} notes:</strong> {a.approvalNotes}
                  {a.approvedAt && <span className="block mt-1">at {new Date(a.approvedAt).toLocaleString()}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    slate: 'bg-slate-50 text-slate-700',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    violet: 'bg-teal-50 text-teal-700',
  };
  return (
    <div className={`thb-card p-3 ${colorMap[color] || colorMap.slate}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
