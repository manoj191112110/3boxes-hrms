'use client';

/**
 * Unified Attendance Requests — Regularization | WFH | Hourly Permission | Gate Pass
 *  - Employees: apply (dynamic form per type), track status + approval timeline
 *  - Approvers: inbox with approve/reject at the current workflow level
 *  - Admins: all requests + gate-pass QR scan console
 */

import { useCallback, useEffect, useState } from 'react';
import {
  FiPlus, FiRefreshCw, FiClock, FiGitBranch, FiZap, FiShield, FiCheckCircle,
  FiXCircle, FiEye, FiX, FiArrowRight, FiList,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import ModuleTips from '@/components/ModuleTips';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

type RequestType = 'REGULARIZATION' | 'WFH' | 'HOURLY_PERMISSION' | 'GATE_PASS';

const TYPE_META: Record<RequestType, { label: string; icon: React.ReactNode; color: string }> = {
  REGULARIZATION: { label: 'Regularization', icon: <FiClock className="w-4 h-4" />, color: 'amber' },
  WFH: { label: 'Work From Home', icon: <FiGitBranch className="w-4 h-4" />, color: 'violet' },
  HOURLY_PERMISSION: { label: 'Hourly Permission', icon: <FiZap className="w-4 h-4" />, color: 'emerald' },
  GATE_PASS: { label: 'Gate Pass', icon: <FiShield className="w-4 h-4" />, color: 'cyan' },
};

interface Approval {
  id: string; level: number; actorType: string; actorName?: string; actorUserId?: string | null;
  status: string; comments?: string | null; slaAt?: string | null; actedAt?: string | null;
  verifiedBy?: string | null; scanLog?: { outAt?: string; inAt?: string } | null;
}
interface AttRequest {
  id: string; requestType: RequestType; subtype?: string | null;
  startDate: string; endDate?: string | null; payload?: Record<string, unknown>;
  reason: string; status: string; currentLevel: number; systemActions?: string | null;
  qrToken?: string | null; createdAt: string;
  employee?: { id: string; firstName: string; lastName: string; employeeId: string; email: string };
  approvals?: Approval[];
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  completed: 'bg-teal-50 text-teal-700 border-teal-200',
};
const STEP_STYLES: Record<string, { icon: React.ReactNode; cls: string }> = {
  pending: { icon: <FiClock className="w-3.5 h-3.5" />, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { icon: <FiCheckCircle className="w-3.5 h-3.5" />, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  auto_approved: { icon: <FiZap className="w-3.5 h-3.5" />, cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  auto_escalated: { icon: <FiArrowRight className="w-3.5 h-3.5" />, cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  verified: { icon: <FiShield className="w-3.5 h-3.5" />, cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  skipped: { icon: <FiX className="w-3.5 h-3.5" />, cls: 'bg-slate-50 text-slate-400 border-slate-200' },
  rejected: { icon: <FiXCircle className="w-3.5 h-3.5" />, cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

function fmtD(v?: string | null) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDT(v?: string | null) {
  if (!v) return '—';
  return new Date(v).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AttendanceRequestsPage() {
  const { user } = useAuthStore();
  const isAdmin = ['super_admin', 'tenant_admin', 'admin', 'hr_admin'].includes(user?.role || '');
  const [scope, setScope] = useState<'mine' | 'inbox' | 'all'>('mine');
  const [items, setItems] = useState<AttRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<AttRequest | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [comments, setComments] = useState('');
  const [scanToken, setScanToken] = useState('');
  const [scanType, setScanType] = useState<'out' | 'in'>('out');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance/requests?scope=${scope}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (res.ok) setItems(data.requests || []);
      else toast.error(data.error || 'Failed to load requests');
    } catch { toast.error('Failed to load requests'); }
    finally { setLoading(false); }
  }, [scope]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const act = async (id: string, action: 'approve' | 'reject' | 'cancel') => {
    setActionBusy(true);
    try {
      const res = await fetch(`/api/attendance/requests/${id}`, {
        method: 'PATCH', headers: getAuthHeaders(),
        body: JSON.stringify({ action, comments }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Done');
        setDetail(null); setComments('');
        fetchItems();
      } else toast.error(data.error || 'Action failed');
    } catch { toast.error('Action failed'); }
    finally { setActionBusy(false); }
  };

  const gateScan = async () => {
    if (!scanToken.trim()) return toast.error('Enter the QR token from the pass');
    setActionBusy(true);
    try {
      const res = await fetch('/api/attendance/requests/gate-scan', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ token: scanToken.trim(), scanType }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Scan logged');
        setScanToken('');
        fetchItems();
      } else toast.error(data.error || 'Scan failed');
    } catch { toast.error('Scan failed'); }
    finally { setActionBusy(false); }
  };

  const isSecurityDesk = isAdmin || ['security', 'it_admin'].includes(user?.role || '');

  return (
    <div className="space-y-5">
      <ModuleTips moduleKey="attendance_requests" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-50"><FiList className="w-5 h-5 text-teal-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">Attendance Requests & Approvals</h1>
            <p className="text-sm text-thb-text-secondary">Regularization · WFH · Hourly Permission · Gate Pass — multi-level workflow</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchItems} className="p-2.5 rounded-xl border border-thb-border bg-white hover:bg-slate-50"><FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 shadow-sm">
            <FiPlus className="w-4 h-4" /> New Request
          </button>
        </div>
      </div>

      {/* Scope tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {([['mine', 'My Requests'], ['inbox', 'Approvals Inbox'], ...(isAdmin ? [['all', 'All Requests'] as const] : [])] as [string, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setScope(key as 'mine' | 'inbox' | 'all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${scope === key ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Gate scan console */}
      {isSecurityDesk && (
        <div className="p-4 rounded-xl border border-cyan-200 bg-cyan-50/50">
          <h3 className="flex items-center gap-2 text-sm font-bold text-cyan-800 mb-2"><FiShield className="w-4 h-4" /> Security Turnstile — Gate Pass QR Scan</h3>
          <div className="flex flex-wrap items-center gap-2">
            <input value={scanToken} onChange={e => setScanToken(e.target.value)} placeholder="GP-XXXX-YYYY"
              className="px-3 py-2 border border-cyan-200 rounded-lg text-sm font-mono w-56 focus:outline-none focus:ring-2 focus:ring-cyan-400/30" />
            <select value={scanType} onChange={e => setScanType(e.target.value as 'out' | 'in')}
              className="px-3 py-2 border border-cyan-200 rounded-lg text-sm bg-white">
              <option value="out">Log EXIT (out)</option>
              <option value="in">Log ENTRY (in)</option>
            </select>
            <button onClick={gateScan} disabled={actionBusy}
              className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-700 disabled:opacity-50">
              Verify Scan
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {loading && <div className="text-center py-14 text-sm text-slate-400">Loading requests…</div>}
        {!loading && items.length === 0 && (
          <div className="text-center py-14">
            <FiList className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400">{scope === 'inbox' ? 'Nothing waiting for your approval.' : 'No requests yet — raise one with “New Request”.'}</p>
          </div>
        )}
        {items.map(r => {
          const meta = TYPE_META[r.requestType];
          const pendingMine = scope === 'inbox';
          return (
            <div key={r.id} className="p-4 rounded-xl border border-thb-border bg-white hover:shadow-sm transition-shadow">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className={`p-2 rounded-lg border ${
                    meta.color === 'amber' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                    meta.color === 'violet' ? 'bg-violet-50 text-violet-600 border-violet-200' :
                    meta.color === 'emerald' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                    'bg-cyan-50 text-cyan-600 border-cyan-200'}`}>{meta.icon}</span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-thb-text-primary">{meta.label}</span>
                      {r.subtype && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase font-semibold">{r.subtype}</span>}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${STATUS_STYLES[r.status] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>{r.status.replace('_', ' ')}</span>
                      {r.status === 'pending' && r.currentLevel > 0 && <span className="text-[10px] text-slate-400">at Level {r.currentLevel}</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {scope !== 'mine' && r.employee && <><b>{r.employee.firstName} {r.employee.lastName}</b> · </>}
                      {fmtD(r.startDate)}{r.endDate && r.endDate !== r.startDate ? ` → ${fmtD(r.endDate)}` : ''}
                      {' · '}{r.reason.length > 70 ? r.reason.slice(0, 70) + '…' : r.reason}
                    </p>
                    {r.qrToken && (r.status === 'approved' || r.status === 'completed') && (
                      <p className="text-[11px] font-mono mt-1 text-cyan-700">QR: {r.qrToken}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {pendingMine && (
                    <>
                      <button onClick={() => act(r.id, 'reject')} disabled={actionBusy}
                        className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 text-xs font-semibold hover:bg-rose-50 disabled:opacity-50">Reject</button>
                      <button onClick={() => act(r.id, 'approve')} disabled={actionBusy}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50">Approve</button>
                    </>
                  )}
                  <button onClick={() => setDetail(r)} className="p-2 rounded-lg border border-thb-border text-slate-500 hover:bg-slate-50" title="View details">
                    <FiEye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* New request modal */}
      {showForm && <NewRequestModal onClose={() => setShowForm(false)} onDone={() => { setShowForm(false); fetchItems(); }} />}

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-thb-text-primary flex items-center gap-2">
                {TYPE_META[detail.requestType].icon} {TYPE_META[detail.requestType].label}
                {detail.subtype && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase font-semibold">{detail.subtype}</span>}
              </h3>
              <button onClick={() => setDetail(null)} className="p-1.5 rounded-lg hover:bg-slate-100"><FiX className="w-4 h-4" /></button>
            </div>

            {/* Facts */}
            <div className="grid grid-cols-2 gap-3 text-xs mb-4">
              <div><span className="text-slate-400">Employee</span><p className="font-semibold text-thb-text-primary">{detail.employee ? `${detail.employee.firstName} ${detail.employee.lastName}` : '—'}</p></div>
              <div><span className="text-slate-400">Status</span><p className="font-semibold capitalize">{detail.status.replace('_', ' ')}</p></div>
              <div><span className="text-slate-400">Date</span><p className="font-semibold">{fmtD(detail.startDate)}{detail.endDate && detail.endDate !== detail.startDate ? ` → ${fmtD(detail.endDate)}` : ''}</p></div>
              <div><span className="text-slate-400">Submitted</span><p className="font-semibold">{fmtDT(detail.createdAt)}</p></div>
              {detail.payload?.hours !== undefined && <div><span className="text-slate-400">Hours</span><p className="font-semibold">{String(detail.payload.hours)}h</p></div>}
              {detail.payload?.punchType && <div><span className="text-slate-400">Punch</span><p className="font-semibold">{String(detail.payload.punchType)} at {fmtDT(String(detail.payload.requestedTime))}</p></div>}
              {detail.payload?.destination && <div><span className="text-slate-400">Destination</span><p className="font-semibold">{String(detail.payload.destination)}</p></div>}
              {detail.payload?.remoteLocation && <div><span className="text-slate-400">Remote location</span><p className="font-semibold">{String(detail.payload.remoteLocation)}</p></div>}
            </div>
            <div className="p-3 rounded-lg bg-slate-50 text-xs text-slate-600 mb-4">
              <span className="text-slate-400 font-semibold">Reason: </span>{detail.reason}
            </div>

            {/* QR token for approved gate passes */}
            {detail.requestType === 'GATE_PASS' && detail.qrToken && (
              <div className="p-3 mb-4 rounded-lg bg-cyan-50 border border-cyan-200 text-center">
                <p className="text-[10px] uppercase font-bold text-cyan-700 tracking-wide mb-1">Gate Pass QR Token</p>
                <p className="text-lg font-mono font-bold text-cyan-800 tracking-widest">{detail.qrToken}</p>
                {detail.payload?.actualOutTime && (
                  <p className="text-[11px] text-cyan-700 mt-1">
                    Out: {fmtDT(String(detail.payload.actualOutTime))}
                    {detail.payload.actualInTime ? ` · In: ${fmtDT(String(detail.payload.actualInTime))}` : ' · Entry scan pending'}
                  </p>
                )}
              </div>
            )}

            {/* Approval timeline */}
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Approval Workflow</h4>
            <div className="space-y-2 mb-4">
              {(detail.approvals || []).map(a => {
                const st = STEP_STYLES[a.status] || STEP_STYLES.pending;
                return (
                  <div key={a.id} className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${st.cls}`}>
                    <span className="mt-0.5">{st.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">L{a.level} · {a.actorName || a.actorType.replace(/_/g, ' ')}</p>
                      <p className="text-[11px] opacity-80">{a.status.replace(/_/g, ' ')}{a.actedAt ? ` · ${fmtDT(a.actedAt)}` : a.slaAt ? ` · SLA ${fmtDT(a.slaAt)}` : ''}</p>
                      {a.comments && <p className="text-[11px] italic opacity-70 mt-0.5">“{a.comments}”</p>}
                      {a.scanLog?.outAt && <p className="text-[11px] mt-0.5">Gate out {fmtDT(a.scanLog.outAt)}{a.scanLog.inAt ? ` · in ${fmtDT(a.scanLog.inAt)}` : ''}</p>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* System actions log */}
            {detail.systemActions && (
              <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-100 text-[11px] text-emerald-800 mb-4">
                <b>System actions:</b> {(() => { try { return JSON.parse(detail.systemActions).actions.join(' · '); } catch { return detail.systemActions; } })()}
              </div>
            )}

            {/* Actions */}
            {detail.status === 'pending' && (
              <div className="space-y-2">
                <textarea rows={2} value={comments} onChange={e => setComments(e.target.value)} placeholder="Comments (optional)"
                  className="w-full px-3 py-2 border border-thb-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
                <div className="flex gap-2 justify-end">
                  {scope === 'mine' ? (
                    <button onClick={() => act(detail.id, 'cancel')} disabled={actionBusy}
                      className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50">Cancel Request</button>
                  ) : (
                    <>
                      <button onClick={() => act(detail.id, 'reject')} disabled={actionBusy}
                        className="px-4 py-2 rounded-lg border border-rose-200 text-rose-600 text-xs font-semibold hover:bg-rose-50 disabled:opacity-50">Reject</button>
                      <button onClick={() => act(detail.id, 'approve')} disabled={actionBusy}
                        className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50">Approve & Advance</button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
//  New Request Modal — dynamic form per request type
// ═════════════════════════════════════════════════════════════════════
function NewRequestModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState<RequestType | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!type) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = { requestType: type, reason: form.reason, subtype: form.subtype };
      if (type === 'REGULARIZATION') { body.date = form.date; body.punchType = form.punchType || 'check_in'; body.requestedTime = `${form.date}T${form.requestedTime}`; }
      if (type === 'WFH') { body.startDate = form.startDate; body.endDate = form.endDate || form.startDate; body.remoteLocation = form.remoteLocation; }
      if (type === 'HOURLY_PERMISSION') { body.date = form.date; body.startTime = form.startTime; body.endTime = form.endTime; }
      if (type === 'GATE_PASS') { body.date = form.date; body.departureTime = form.departureTime; body.expectedReturn = form.expectedReturn; body.destination = form.destination; }
      const res = await fetch('/api/attendance/requests', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Request submitted');
        if (data.systemMessage) toast(data.systemMessage, { icon: '⚙️', duration: 6000 });
        onDone();
      } else toast.error(data.error || 'Submission failed');
    } catch { toast.error('Submission failed'); }
    finally { setBusy(false); }
  };

  const inp = 'w-full px-3 py-2 border border-thb-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-thb-text-primary">New Attendance Request</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><FiX className="w-4 h-4" /></button>
        </div>

        {!type ? (
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(TYPE_META) as RequestType[]).map(t => {
              const m = TYPE_META[t];
              return (
                <button key={t} onClick={() => setType(t)}
                  className="p-4 rounded-xl border border-thb-border text-left hover:border-teal-300 hover:bg-teal-50/40 transition-colors">
                  <span className={`inline-flex p-2 rounded-lg mb-2 ${
                    m.color === 'amber' ? 'bg-amber-50 text-amber-600' : m.color === 'violet' ? 'bg-violet-50 text-violet-600' :
                    m.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' : 'bg-cyan-50 text-cyan-600'}`}>{m.icon}</span>
                  <p className="text-sm font-bold text-thb-text-primary">{m.label}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {t === 'REGULARIZATION' && 'Fix a missed punch / biometric error'}
                    {t === 'WFH' && 'Work from home (full or half day)'}
                    {t === 'HOURLY_PERMISSION' && 'Short leave for 1–4 hours'}
                    {t === 'GATE_PASS' && 'Official or personal OUT pass'}
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            <button onClick={() => setType(null)} className="text-xs text-teal-600 hover:text-teal-700 font-medium">← change type</button>

            {type === 'REGULARIZATION' && (
              <>
                <div><label className="text-xs font-semibold text-slate-500">Date of missing punch</label><input type="date" value={form.date || ''} onChange={e => set('date', e.target.value)} className={`${inp} mt-1`} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs font-semibold text-slate-500">Punch type</label>
                    <select value={form.punchType || 'check_in'} onChange={e => set('punchType', e.target.value)} className={`${inp} mt-1`}>
                      <option value="check_in">Check-in</option><option value="check_out">Check-out</option>
                    </select></div>
                  <div><label className="text-xs font-semibold text-slate-500">Actual time</label><input type="time" value={form.requestedTime || ''} onChange={e => set('requestedTime', e.target.value)} className={`${inp} mt-1`} /></div>
                </div>
              </>
            )}

            {type === 'WFH' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs font-semibold text-slate-500">From</label><input type="date" value={form.startDate || ''} onChange={e => set('startDate', e.target.value)} className={`${inp} mt-1`} /></div>
                  <div><label className="text-xs font-semibold text-slate-500">To</label><input type="date" value={form.endDate || ''} onChange={e => set('endDate', e.target.value)} className={`${inp} mt-1`} /></div>
                </div>
                <div><label className="text-xs font-semibold text-slate-500">Remote location (optional)</label><input value={form.remoteLocation || ''} onChange={e => set('remoteLocation', e.target.value)} placeholder="e.g. Home — Hyderabad" className={`${inp} mt-1`} /></div>
              </>
            )}

            {type === 'HOURLY_PERMISSION' && (
              <>
                <div><label className="text-xs font-semibold text-slate-500">Date</label><input type="date" value={form.date || ''} onChange={e => set('date', e.target.value)} className={`${inp} mt-1`} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs font-semibold text-slate-500">From</label><input type="time" value={form.startTime || ''} onChange={e => set('startTime', e.target.value)} className={`${inp} mt-1`} /></div>
                  <div><label className="text-xs font-semibold text-slate-500">To</label><input type="time" value={form.endTime || ''} onChange={e => set('endTime', e.target.value)} className={`${inp} mt-1`} /></div>
                </div>
              </>
            )}

            {type === 'GATE_PASS' && (
              <>
                <div><label className="text-xs font-semibold text-slate-500">Pass type</label>
                  <select value={form.subtype || 'official'} onChange={e => set('subtype', e.target.value)} className={`${inp} mt-1`}>
                    <option value="official">Official (client visit, work errand)</option>
                    <option value="personal">Personal</option>
                  </select></div>
                <div><label className="text-xs font-semibold text-slate-500">Date</label><input type="date" value={form.date || ''} onChange={e => set('date', e.target.value)} className={`${inp} mt-1`} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs font-semibold text-slate-500">Departure</label><input type="time" value={form.departureTime || ''} onChange={e => set('departureTime', e.target.value)} className={`${inp} mt-1`} /></div>
                  <div><label className="text-xs font-semibold text-slate-500">Expected return</label><input type="time" value={form.expectedReturn || ''} onChange={e => set('expectedReturn', e.target.value)} className={`${inp} mt-1`} /></div>
                </div>
                <div><label className="text-xs font-semibold text-slate-500">Destination</label><input value={form.destination || ''} onChange={e => set('destination', e.target.value)} placeholder="e.g. Client office — Hitech City" className={`${inp} mt-1`} /></div>
              </>
            )}

            <div><label className="text-xs font-semibold text-slate-500">Reason *</label>
              <textarea rows={3} value={form.reason || ''} onChange={e => set('reason', e.target.value)} placeholder="Brief reason for this request…" className={`${inp} mt-1`} /></div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50">Cancel</button>
              <button onClick={submit} disabled={busy || !form.reason} className="px-5 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 disabled:opacity-50">
                {busy ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
