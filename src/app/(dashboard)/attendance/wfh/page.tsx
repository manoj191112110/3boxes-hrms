'use client';

import { useEffect, useState, useCallback } from 'react';
import { FiHome, FiPlus, FiRefreshCw, FiCheckCircle, FiXCircle, FiInfo, FiCalendar, FiMapPin, FiClock, FiPhone, FiFileText, FiUpload, FiAlertCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';
import ModuleTips from '@/components/ModuleTips';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface WfhRequest {
  id: string;
  requestType: string;
  startDate: string;
  endDate: string | null;
  totalDays: number;
  reason: string;
  reasonCategory: string;
  remoteLocation: string;
  expectedHours: number;
  availableForMeetings: boolean;
  emergencyContact: string;
  alternateEmail: string;
  approverComments: string | null;
  status: string;
  createdAt: string;
  employee?: { id: string; firstName: string; lastName: string; employeeId: string; department?: { name: string } };
  approver?: { firstName: string; lastName: string };
}

const REQUEST_TYPES = [
  { value: 'full_day', label: 'Full Day WFH' },
  { value: 'half_day', label: 'Half Day WFH' },
  { value: 'temporary', label: 'Temporary WFH' },
  { value: 'permanent', label: 'Permanent WFH' },
  { value: 'hybrid', label: 'Hybrid Schedule' },
];

const REASON_CATEGORIES = [
  { value: 'personal', label: 'Personal' },
  { value: 'medical', label: 'Medical' },
  { value: 'travel', label: 'Travel' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'weather', label: 'Weather' },
  { value: 'other', label: 'Other' },
];

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'thb-badge thb-badge-warning',
    approved: 'thb-badge thb-badge-success',
    rejected: 'thb-badge thb-badge-error',
    cancelled: 'thb-badge thb-badge-info',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/* Calculate working days between two dates (excluding weekends) */
function calcWorkingDays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export default function WfhPage() {
  const { user } = useAuthStore();
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');

  const [items, setItems] = useState<WfhRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    requestType: 'full_day',
    startDate: today,
    endDate: today,
    reason: '',
    reasonCategory: 'personal',
    expectedHours: 8,
    availableForMeetings: true,
    remoteLocation: '',
    emergencyContact: '',
    alternateEmail: '',
    approverComments: '',
  });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const sq = scopeQuery();
      const r = await fetch(`/api/attendance/wfh?limit=100${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to load');
      setItems(d.requests || d.data || []);
    } catch {
      // API might not exist yet — show empty state
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [scopeQuery, selectedTenantId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Auto-set end date for permanent/hybrid
  useEffect(() => {
    if (form.requestType === 'permanent' || form.requestType === 'hybrid') {
      // Set end date far in the future (1 year) for permanent/hybrid
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);
      setForm(f => ({ ...f, endDate: future.toISOString().split('T')[0] }));
    }
  }, [form.requestType]);

  const workingDays = form.startDate && form.endDate ? calcWorkingDays(form.startDate, form.endDate) : 0;
  const needsHrApproval = workingDays > 3;
  const isPermanentOrHybrid = form.requestType === 'permanent' || form.requestType === 'hybrid';

  const handleSubmit = async () => {
    if (!form.startDate || !form.reason || form.reason.trim().length < 20) {
      toast.error('Please fill all required fields (reason must be at least 20 characters)');
      return;
    }
    if (!isPermanentOrHybrid && !form.endDate) {
      toast.error('End date is required');
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        requestType: form.requestType,
        startDate: form.startDate,
        endDate: isPermanentOrHybrid ? null : form.endDate,
        reason: form.reason,
        reasonCategory: form.reasonCategory,
        expectedHours: form.expectedHours,
        availableForMeetings: form.availableForMeetings,
        remoteLocation: form.remoteLocation,
        emergencyContact: form.emergencyContact,
        alternateEmail: form.alternateEmail,
        approverComments: form.approverComments,
      };
      const r = await fetch('/api/attendance/wfh', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to submit');
      toast.success('WFH request submitted successfully');
      setShowForm(false);
      setShowPreview(false);
      setForm({
        requestType: 'full_day',
        startDate: today,
        endDate: today,
        reason: '',
        reasonCategory: 'personal',
        expectedHours: 8,
        availableForMeetings: true,
        remoteLocation: '',
        emergencyContact: '',
        alternateEmail: '',
        approverComments: '',
      });
      fetchItems();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (id: string, action: 'approved' | 'rejected' | 'cancelled') => {
    try {
      const r = await fetch(`/api/attendance/wfh/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: action }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      toast.success(`Request ${action}`);
      fetchItems();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const reqTypeLabel = (v: string) => REQUEST_TYPES.find(t => t.value === v)?.label || v;
  const catLabel = (v: string) => REASON_CATEGORIES.find(c => c.value === v)?.label || v;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FiHome className="w-6 h-6 text-cyan-500" />
            Work From Home
          </h1>
          <p className="text-sm text-slate-500 mt-1">Apply for work-from-home requests · Manager & HR approval workflow</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setShowPreview(false); }} className="3boxes-btn-primary flex items-center gap-2">
          <FiPlus className="w-4 h-4" /> Apply WFH
        </button>
      </div>

      <ModuleTips moduleKey="attendance-wfh">
        <p><strong>REQ-WFH-01:</strong> WFH requests for more than 3 consecutive working days require HR approval in addition to your manager&apos;s approval. Ensure your remote location has stable internet connectivity. Attendance will be tracked via check-in during WFH days.</p>
      </ModuleTips>

      {/* New WFH Request Form */}
      {showForm && !showPreview && (
        <div className="thb-card p-6 border-l-4 border-l-cyan-500">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-slate-800">New WFH Request</h2>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700">✕</button>
          </div>

          {/* Employee Info (auto-filled) */}
          <div className="mb-5 p-3 bg-slate-50 rounded-lg">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Employee Details</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><span className="text-slate-500">Name:</span> <span className="font-medium text-slate-700">{user?.firstName || ''} {user?.lastName || ''}</span></div>
              <div><span className="text-slate-500">ID:</span> <span className="font-medium text-slate-700">{user?.employeeId || '—'}</span></div>
              <div><span className="text-slate-500">Department:</span> <span className="font-medium text-slate-700">{(user as Record<string, unknown>)?.departmentName as string || '—'}</span></div>
              <div><span className="text-slate-500">Email:</span> <span className="font-medium text-slate-700">{user?.email || '—'}</span></div>
            </div>
          </div>

          {/* Request Details */}
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Request Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Request Type *</label>
              <select value={form.requestType} onChange={e => setForm({ ...form, requestType: e.target.value })} className="3boxes-input w-full">
                {REQUEST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Start Date *</label>
              <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="3boxes-input w-full" min={today} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{isPermanentOrHybrid ? 'End Date (N/A)' : 'End Date *'}</label>
              <input type="date" value={isPermanentOrHybrid ? '' : form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="3boxes-input w-full" min={form.startDate} disabled={isPermanentOrHybrid} />
              {isPermanentOrHybrid && <p className="text-[10px] text-slate-400 mt-0.5">Open-ended for permanent/hybrid arrangements</p>}
            </div>
          </div>

          {workingDays > 0 && !isPermanentOrHybrid && (
            <div className={`mt-3 p-3 rounded-lg border ${needsHrApproval ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
              <p className={`text-sm font-medium ${needsHrApproval ? 'text-amber-700' : 'text-green-700'}`}>
                <FiInfo className="w-4 h-4 inline mr-1" />
                {needsHrApproval
                  ? <>Total: <strong>{workingDays} working day(s)</strong> — HR approval required (more than 3 days)</>
                  : <>Total: <strong>{workingDays} working day(s)</strong> — Manager approval only</>}
              </p>
            </div>
          )}
          {isPermanentOrHybrid && (
            <div className="mt-3 p-3 bg-teal-50 border border-teal-200 rounded-lg">
              <p className="text-sm font-medium text-teal-700">
                <FiAlertCircle className="w-4 h-4 inline mr-1" />
                <strong>{reqTypeLabel(form.requestType)}</strong> arrangement — Both manager and HR approval required. This will be reviewed periodically.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Reason Category *</label>
              <select value={form.reasonCategory} onChange={e => setForm({ ...form, reasonCategory: e.target.value })} className="3boxes-input w-full">
                {REASON_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Reason * <span className="font-normal text-slate-400">(min 20 chars)</span></label>
              <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="3boxes-input w-full" rows={3} placeholder="Describe why you need to work from home..." />
              <p className="text-[10px] text-slate-400 mt-0.5">{form.reason.length}/20 min characters</p>
            </div>
          </div>

          {/* Work Arrangement */}
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 mt-5">Work Arrangement</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Expected Working Hours</label>
              <input type="number" value={form.expectedHours} onChange={e => setForm({ ...form, expectedHours: Number(e.target.value) })} className="3boxes-input w-full" min={1} max={12} />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" id="avail-meetings" checked={form.availableForMeetings} onChange={e => setForm({ ...form, availableForMeetings: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500" />
              <label htmlFor="avail-meetings" className="text-sm text-slate-700">Available for Meetings</label>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1"><FiMapPin className="w-3 h-3" /> Remote Work Location</label>
              <input type="text" value={form.remoteLocation} onChange={e => setForm({ ...form, remoteLocation: e.target.value })} className="3boxes-input w-full" placeholder="e.g. Home, Co-working space" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1"><FiPhone className="w-3 h-3" /> Emergency Contact Number</label>
              <input type="tel" value={form.emergencyContact} onChange={e => setForm({ ...form, emergencyContact: e.target.value })} className="3boxes-input w-full" placeholder="+91 ..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1"><FiClock className="w-3 h-3" /> Alternate Email (optional)</label>
              <input type="email" value={form.alternateEmail} onChange={e => setForm({ ...form, alternateEmail: e.target.value })} className="3boxes-input w-full" placeholder="personal@email.com" />
            </div>
          </div>

          {/* Supporting Document */}
          <div className="mt-4">
            <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1"><FiUpload className="w-3 h-3" /> Supporting Document (optional)</label>
            <input type="file" className="3boxes-input w-full text-sm file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100" accept=".pdf,.jpg,.png,.doc,.docx" />
            <p className="text-[10px] text-slate-400 mt-0.5">PDF, JPG, PNG or DOC — max 5 MB</p>
          </div>

          {/* Approval Comments */}
          <div className="mt-4">
            <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1"><FiFileText className="w-3 h-3" /> Comments for Approver</label>
            <textarea value={form.approverComments} onChange={e => setForm({ ...form, approverComments: e.target.value })} className="3boxes-input w-full" rows={2} placeholder="Any additional information for your manager/HR..." />
          </div>

          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setShowForm(false)} className="3boxes-btn-secondary">Cancel</button>
            <button onClick={() => setShowPreview(true)} className="3boxes-btn-primary flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700">
              <FiInfo className="w-4 h-4" /> Preview & Submit
            </button>
          </div>
        </div>
      )}

      {/* Preview & Submit */}
      {showForm && showPreview && (
        <div className="thb-card p-6 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Review Your WFH Request</h2>
            <button onClick={() => setShowPreview(false)} className="text-slate-400 hover:text-slate-700 text-sm">← Edit</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div><span className="text-slate-500">Type:</span> <strong className="text-slate-800">{reqTypeLabel(form.requestType)}</strong></div>
            <div><span className="text-slate-500">Start:</span> <strong className="text-slate-800">{fmtDate(form.startDate)}</strong></div>
            <div><span className="text-slate-500">End:</span> <strong className="text-slate-800">{isPermanentOrHybrid ? 'Open-ended' : fmtDate(form.endDate)}</strong></div>
            {!isPermanentOrHybrid && <div><span className="text-slate-500">Working Days:</span> <strong className="text-slate-800">{workingDays}</strong></div>}
            <div><span className="text-slate-500">Category:</span> <strong className="text-slate-800">{catLabel(form.reasonCategory)}</strong></div>
            <div><span className="text-slate-500">Hours/Day:</span> <strong className="text-slate-800">{form.expectedHours}</strong></div>
            <div><span className="text-slate-500">Meetings:</span> <strong className="text-slate-800">{form.availableForMeetings ? 'Available' : 'Not Available'}</strong></div>
            <div><span className="text-slate-500">Location:</span> <strong className="text-slate-800">{form.remoteLocation || '—'}</strong></div>
            <div><span className="text-slate-500">Emergency:</span> <strong className="text-slate-800">{form.emergencyContact || '—'}</strong></div>
          </div>
          <div className="mt-3 text-sm"><span className="text-slate-500">Reason:</span> <span className="text-slate-800">{form.reason}</span></div>
          {form.approverComments && <div className="mt-1 text-sm"><span className="text-slate-500">Comments:</span> <span className="text-slate-800">{form.approverComments}</span></div>}

          {/* Approval chain preview */}
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs font-semibold text-amber-700 mb-2">Approval Chain</p>
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center">1</span>
                <span className="text-slate-700">Manager Approval</span>
                <FiClock className="w-3 h-3 text-amber-500" />
              </div>
              {(needsHrApproval || isPermanentOrHybrid) && (
                <div className="flex items-center gap-1.5">
                  <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center">2</span>
                  <span className="text-slate-700">HR Approval</span>
                  <FiClock className="w-3 h-3 text-amber-500" />
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setShowPreview(false)} className="3boxes-btn-secondary">← Edit</button>
            <button onClick={handleSubmit} disabled={submitting} className="3boxes-btn-primary flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700">
              {submitting ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiCheckCircle className="w-4 h-4" />}
              Submit WFH Request
            </button>
          </div>
        </div>
      )}

      {/* My WFH History */}
      <div className="thb-card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <FiCalendar className="w-4 h-4 text-cyan-500" />
            {isAdmin ? 'Team WFH Requests' : 'My WFH Requests'}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {isAdmin && <th className="text-left px-4 py-3 font-semibold text-slate-700">Employee</th>}
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Start</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">End</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Days</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Reason</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Location</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={isAdmin ? 10 : 9} className="text-center py-8 text-slate-400">Loading...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={isAdmin ? 10 : 9} className="text-center py-12">
                  <FiHome className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">No WFH requests yet</p>
                  <p className="text-xs text-slate-400 mt-1">Click &quot;Apply WFH&quot; to submit your first request</p>
                </td></tr>
              ) : items.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  {isAdmin && <td className="px-4 py-3 text-slate-700">{r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—'}</td>}
                  <td className="px-4 py-3 text-slate-700">{reqTypeLabel(r.requestType)}</td>
                  <td className="px-4 py-3 text-slate-700">{fmtDate(r.startDate)}</td>
                  <td className="px-4 py-3 text-slate-700">{r.endDate ? fmtDate(r.endDate) : 'Open-ended'}</td>
                  <td className="px-4 py-3 text-slate-700">{r.totalDays || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">{r.reason}</td>
                  <td className="px-4 py-3 text-slate-600">{r.remoteLocation || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={getStatusBadge(r.status)}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status === 'pending' && !isAdmin && (
                      <button onClick={() => handleAction(r.id, 'cancelled')} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded text-xs" title="Cancel">
                        Cancel
                      </button>
                    )}
                    {r.status === 'pending' && isAdmin && (
                      <div className="flex justify-end gap-1">
                        <button onClick={() => handleAction(r.id, 'approved')} className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded" title="Approve">
                          <FiCheckCircle className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleAction(r.id, 'rejected')} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded" title="Reject">
                          <FiXCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}
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
