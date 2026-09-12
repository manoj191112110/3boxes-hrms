'use client';

/**
 * /employees/update-requests
 *
 * Employee profile-update workflow inbox:
 *   - My Requests   — requests the current employee submitted
 *   - Approvals     — requests waiting for MY approval (current tier)
 *   - All           — every request (admins)
 * Plus a "Request Change" modal to submit a profile-change request.
 * Low-risk fields apply immediately; high-risk fields route through the
 * configured approval chain (/employees/approval-config).
 */
import { useCallback, useEffect, useState } from 'react';
import {
  FiArrowLeft, FiPlus, FiRefreshCw, FiCheck, FiX, FiInbox, FiSend, FiClock, FiCheckCircle, FiXCircle, FiChevronDown,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// Editable fields (matches the API's FIELD_SENSITIVITY classification)
const REQUESTABLE_FIELDS: { field: string; label: string; category: string }[] = [
  { field: 'phone', label: 'Phone Number', category: 'Contact (applies directly)' },
  { field: 'address', label: 'Address', category: 'Contact (applies directly)' },
  { field: 'city', label: 'City', category: 'Contact (applies directly)' },
  { field: 'state', label: 'State', category: 'Contact (applies directly)' },
  { field: 'zipCode', label: 'ZIP Code', category: 'Contact (applies directly)' },
  { field: 'country', label: 'Country', category: 'Contact (applies directly)' },
  { field: 'personalEmail', label: 'Personal Email', category: 'Contact (applies directly)' },
  { field: 'emergencyContactName', label: 'Emergency Contact Name', category: 'Contact (applies directly)' },
  { field: 'emergencyContactPhone', label: 'Emergency Contact Phone', category: 'Contact (applies directly)' },
  { field: 'firstName', label: 'First Name', category: 'Personal (approval required)' },
  { field: 'lastName', label: 'Last Name', category: 'Personal (approval required)' },
  { field: 'dateOfBirth', label: 'Date of Birth', category: 'Personal (approval required)' },
  { field: 'gender', label: 'Gender', category: 'Personal (approval required)' },
  { field: 'maritalStatus', label: 'Marital Status', category: 'Personal (approval required)' },
  { field: 'nationality', label: 'Nationality', category: 'Personal (approval required)' },
  { field: 'bankName', label: 'Bank Name', category: 'Financial (approval required)' },
  { field: 'bankAccountNo', label: 'Bank Account Number', category: 'Financial (approval required)' },
  { field: 'bankIfscCode', label: 'Bank IFSC Code', category: 'Financial (approval required)' },
  { field: 'panNumber', label: 'PAN Number', category: 'KYC (approval required)' },
  { field: 'aadhaarNumber', label: 'Aadhaar Number', category: 'KYC (approval required)' },
  { field: 'taxId', label: 'Tax ID', category: 'KYC (approval required)' },
];

interface ApprovalStep { id: string; tier: number; approverType: string; approverName?: string; status: string; comments?: string | null; actedAt?: string | null }
interface UpdateRequest {
  id: string; fieldName: string; fieldLabel?: string; category: string;
  oldValue?: string; newValue?: string; reason?: string;
  status: string; currentTier: number; requestedAt?: string;
  approvalSteps?: ApprovalStep[];
  employee?: { id: string; firstName: string; lastName: string; employeeId: string };
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'thb-badge thb-badge-warning',
    approved: 'thb-badge thb-badge-success',
    applied: 'thb-badge thb-badge-success',
    rejected: 'thb-badge thb-badge-error',
    cancelled: 'thb-badge thb-badge-info',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

function RequestCard({ r, canAct, onAct }: { r: UpdateRequest; canAct: boolean; onAct: (id: string, action: 'approve' | 'reject') => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="thb-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-thb-text-primary truncate">{r.fieldLabel || r.fieldName}</p>
          <p className="text-[11px] text-thb-text-muted">
            {r.employee ? `${r.employee.firstName} ${r.employee.lastName} · ${r.employee.employeeId} · ` : ''}
            {r.requestedAt ? new Date(r.requestedAt).toLocaleString() : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={statusBadge(r.status)}>{r.status}</span>
          <button onClick={() => setOpen(!open)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><FiChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} /></button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2.5 text-xs">
        <div className="rounded-lg bg-slate-50 px-3 py-2"><span className="text-[10px] text-thb-text-muted block mb-0.5">Current</span><span className="text-thb-text-secondary break-all">{r.oldValue || '—'}</span></div>
        <div className="rounded-lg bg-teal-50/60 px-3 py-2"><span className="text-[10px] text-thb-text-muted block mb-0.5">Requested</span><span className="text-teal-800 font-medium break-all">{r.newValue || '—'}</span></div>
      </div>
      {r.reason && <p className="text-[11px] text-thb-text-muted mt-2"><span className="font-medium">Reason:</span> {r.reason}</p>}

      {open && (
        <div className="mt-3 border-t border-thb-border pt-3 space-y-1.5">
          {(r.approvalSteps || []).sort((a, b) => a.tier - b.tier).map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-thb-text-secondary">Tier {s.tier} · {s.approverName || s.approverType}</span>
              <span className={s.status === 'approved' ? 'text-emerald-600' : s.status === 'rejected' ? 'text-red-500' : s.status === 'pending' ? 'text-amber-600' : 'text-slate-400'}>
                {s.status}{s.actedAt ? ` · ${new Date(s.actedAt).toLocaleDateString()}` : ''}{s.comments ? ` · "${s.comments}"` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {canAct && r.status === 'pending' && (
        <div className="flex items-center gap-2 mt-3">
          <button onClick={() => onAct(r.id, 'approve')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700"><FiCheck className="w-3.5 h-3.5" /> Approve</button>
          <button onClick={() => onAct(r.id, 'reject')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100"><FiX className="w-3.5 h-3.5" /> Reject</button>
        </div>
      )}
    </div>
  );
}

function NewRequestModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [field, setField] = useState('');
  const [newValue, setNewValue] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/employees?limit=500', { headers: getAuthHeaders() });
        const data = await res.json();
        const list = (data.employees || data.data || []) as Array<{ id: string; firstName?: string; lastName?: string; employeeId?: string }>;
        const mapped = list.map((e) => ({ id: e.id, name: `${e.firstName || ''} ${e.lastName || ''}`.trim() || 'Unnamed', code: e.employeeId || '' }));
        setEmployees(mapped);
        if (mapped.length === 1) setEmployeeId(mapped[0].id);
      } catch { /* ignore */ }
    })();
  }, []);

  const submit = async () => {
    if (!employeeId || !field || !newValue.trim()) { toast.error('Employee, field, and new value are required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/employees/update-requests', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ employeeId, fieldName: field, newValue: newValue.trim(), reason: reason || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit');
      toast.success(data.message || 'Request submitted');
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally { setSaving(false); }
  };

  const groups = [...new Set(REQUESTABLE_FIELDS.map((f) => f.category))];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-thb-border"><h3 className="font-semibold text-sm">Request Profile Change</h3><button onClick={onClose}><FiX className="w-5 h-5 text-slate-400" /></button></div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Employee *</label>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
              <option value="">Select employee…</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}{e.code ? ` · ${e.code}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Field *</label>
            <select value={field} onChange={(e) => setField(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
              <option value="">Select field…</option>
              {groups.map((g) => (
                <optgroup key={g} label={g}>
                  {REQUESTABLE_FIELDS.filter((f) => f.category === g).map((f) => <option key={f.field} value={f.field}>{f.label}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">New Value *</label><input value={newValue} onChange={(e) => setNewValue(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Reason</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <p className="text-[10px] text-slate-400">Low-risk contact fields apply immediately. High-risk fields (personal / financial / KYC) route through the configured approval chain.</p>
        </div>
        <div className="flex justify-end gap-3 px-5 py-4 border-t"><button onClick={onClose} className="px-4 py-2 text-sm text-slate-600">Cancel</button><button onClick={submit} disabled={saving} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Submitting…' : 'Submit Request'}</button></div>
      </div>
    </div>
  );
}

export default function UpdateRequestsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [scope, setScope] = useState<'mine' | 'inbox' | 'all'>('inbox');
  const [requests, setRequests] = useState<UpdateRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const isAdmin = ['super_admin', 'tenant_admin', 'admin', 'hr_admin', 'company_hr_admin'].includes(user?.role || '');

  const load = useCallback(async (s: 'mine' | 'inbox' | 'all') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/employees/update-requests?scope=${s}`, { headers: getAuthHeaders() });
      const data = await res.json();
      setRequests(data.requests || []);
    } catch { toast.error('Failed to load requests'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(scope); }, [scope, load]);

  const act = async (id: string, action: 'approve' | 'reject') => {
    const comments = window.prompt(`Comments for this ${action}? (optional)`) || '';
    try {
      const res = await fetch(`/api/employees/update-requests/${id}`, {
        method: 'PATCH', headers: getAuthHeaders(),
        body: JSON.stringify({ action, comments }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(data.message || `Request ${action}d`);
      load(scope);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const tabs: { key: 'mine' | 'inbox' | 'all'; label: string; icon: React.ReactNode }[] = [
    { key: 'inbox', label: 'My Approvals', icon: <FiInbox className="w-3.5 h-3.5" /> },
    { key: 'mine', label: 'My Requests', icon: <FiSend className="w-3.5 h-3.5" /> },
    ...(isAdmin ? [{ key: 'all' as const, label: 'All Requests', icon: <FiClock className="w-3.5 h-3.5" /> }] : []),
  ];

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/employees')} className="p-2 rounded-lg border border-thb-border hover:bg-slate-50"><FiArrowLeft className="w-4 h-4" /></button>
          <div>
            <h1 className="text-lg font-semibold text-thb-text-primary">Profile Update Requests</h1>
            <p className="text-xs text-thb-text-muted">Employee profile-change requests and their approval progress.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load(scope)} className="p-2 rounded-lg border border-thb-border hover:bg-slate-50" title="Refresh"><FiRefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700"><FiPlus className="w-3.5 h-3.5" /> Request Change</button>
        </div>
      </div>

      <div className="flex gap-2">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setScope(t.key)} className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium ${scope === t.key ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-thb-text-muted py-10 text-center">Loading…</p>
      ) : requests.length === 0 ? (
        <div className="thb-card p-10 text-center">
          {scope === 'inbox' ? <FiInbox className="w-10 h-10 text-slate-300 mx-auto mb-3" /> : <FiCheckCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />}
          <p className="text-sm font-medium text-thb-text-secondary">No requests here</p>
          <p className="text-xs text-thb-text-muted mt-1">{scope === 'inbox' ? 'Nothing is waiting for your approval right now.' : 'Use "Request Change" to submit a profile update.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => <RequestCard key={r.id} r={r} canAct={scope === 'inbox'} onAct={act} />)}
        </div>
      )}

      {showNew && <NewRequestModal onClose={() => setShowNew(false)} onDone={() => { setShowNew(false); load(scope); }} />}
    </div>
  );
}
