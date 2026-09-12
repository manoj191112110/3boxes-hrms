'use client';

/**
 * Attendance Workflow Builder — dynamic multi-level approval configuration
 * + rule engine constraints (windows, caps, auto-deduction, geo/IP, QR).
 *
 * Covers the 4 request types: REGULARIZATION, WFH, HOURLY_PERMISSION, GATE_PASS.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  FiSettings, FiSave, FiRefreshCw, FiPlus, FiTrash2, FiArrowUp, FiArrowDown,
  FiZap, FiClock, FiMapPin, FiShield, FiCheckSquare, FiGitBranch, FiAlertTriangle, FiAlertCircle, FiTrendingUp, FiCalendar, FiBookOpen,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// ─── Types (mirror lib/attendance-workflow.ts) ───────────────────────
type RequestType = 'REGULARIZATION' | 'WFH' | 'HOURLY_PERMISSION' | 'GATE_PASS';

interface RuleCondition { field: string; op: string; value: string | number }
interface WorkflowLevel {
  level: number;
  actorType: string;
  label: string;
  slaHours: number;
  onSla: string;
  skipIf: RuleCondition | null;
  autoApproveIf: RuleCondition | null;
}
interface RequestRules {
  // Submission-window / cap rules
  windowDays: number;
  monthlyCap: number;
  weeklyCap: number;
  overCapAction: string;
  autoDeductThresholdHours: number;
  autoDeductLeaveDays: number;
  geoFencingEnabled: boolean;
  allowedIps: string[];
  requireQrVerification: boolean;
  // Shift & Grace policy (unified from legacy AttendancePolicyRule)
  shiftStartDefault: string;
  shiftEndDefault: string;
  breakDurationMinutes: number;
  lateGraceMinutes: number;
  earlyGraceMinutes: number;
  // Late-mark policy
  lateMarkAllowancePerMonth: number;
  lateMarkHalfDayOnExceed: boolean;
  halfDayAfterMinutes: number;
  lateMarkNotApplicableOnTour: boolean;
  // Overtime policy
  autoOvertimeEnabled: boolean;
  overtimeThresholdMinutes: number;
  // Gate-pass policy
  gatePassMaxPerMonth: number;
  gatePassHalfDayOnExceed: boolean;
  gatePassHalfDayNextDay: boolean;
  gatePassEarlyHours: number;
}
interface TypeConfig {
  levels: WorkflowLevel[];
  rules: RequestRules;
  configId: string | null;
  name: string;
  scope: string;
  updatedAt: string | null;
  // Policy document linkage + employee scope (new — unification pass)
  policyDocumentId?: string | null;
  employmentType?: string;
  branchId?: string | null;
  departmentId?: string | null;
  employeeStatus?: string;
}

const REQUEST_TYPES: { key: RequestType; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
  { key: 'REGULARIZATION', label: 'Attendance Regularization', desc: 'Missed punch / biometric error fix', icon: <FiClock className="w-4 h-4" />, color: 'amber' },
  { key: 'WFH', label: 'Work From Home', desc: 'Pre-planned or emergency remote work', icon: <FiGitBranch className="w-4 h-4" />, color: 'violet' },
  { key: 'HOURLY_PERMISSION', label: 'Hourly Permission', desc: 'Short leave 1–2h during shift', icon: <FiZap className="w-4 h-4" />, color: 'emerald' },
  { key: 'GATE_PASS', label: 'Gate Pass & OUT', desc: 'Official / personal exit passes', icon: <FiShield className="w-4 h-4" />, color: 'cyan' },
];

const ACTOR_TYPES = [
  { value: 'reporting_manager', label: 'Reporting Manager (L1)' },
  { value: 'department_head', label: 'Department Head / HOD' },
  { value: 'hr_admin', label: 'HR Administrator' },
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'vp_director', label: 'VP / Director' },
  { value: 'security', label: 'Security (Turnstile)' },
];

const CONDITION_FIELDS = [
  { value: 'durationDays', label: 'Duration (days)' },
  { value: 'monthlyCount', label: 'Monthly count (incl. this)' },
  { value: 'weeklyCount', label: 'Weekly count (incl. this)' },
  { value: 'weeklyDays', label: 'WFH days this week (incl. this)' },
  { value: 'gatePassType', label: 'Gate pass type (official/personal)' },
  { value: 'hours', label: 'Requested hours' },
];
const CONDITION_OPS = [
  { value: 'gt', label: '>' }, { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' }, { value: 'lte', label: '≤' }, { value: 'eq', label: '=' },
];

const inputCls = 'w-full px-2.5 py-1.5 border border-thb-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20';
const labelCls = 'text-[11px] font-semibold text-slate-500 uppercase tracking-wide';

const colorMap: Record<string, { chip: string; active: string }> = {
  amber: { chip: 'bg-amber-50 text-amber-700 border-amber-200', active: 'ring-2 ring-amber-400 bg-amber-50 border-amber-300' },
  violet: { chip: 'bg-violet-50 text-violet-700 border-violet-200', active: 'ring-2 ring-violet-400 bg-violet-50 border-violet-300' },
  emerald: { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', active: 'ring-2 ring-emerald-400 bg-emerald-50 border-emerald-300' },
  cyan: { chip: 'bg-cyan-50 text-cyan-700 border-cyan-200', active: 'ring-2 ring-cyan-400 bg-cyan-50 border-cyan-300' },
};

// ═════════════════════════════════════════════════════════════════════
export default function WorkflowBuilderTab({ companyId }: { companyId: string | null }) {
  const { user } = useAuthStore();
  const canEdit = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');
  const [activeType, setActiveType] = useState<RequestType>('REGULARIZATION');
  const [configs, setConfigs] = useState<Partial<Record<RequestType, TypeConfig>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  // Policy documents + branches + departments for the scope selectors
  const [policies, setPolicies] = useState<Array<{ id: string; title: string; version: string }>>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance/workflow-config${companyId ? `?companyId=${companyId}` : ''}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (res.ok) setConfigs(data.configs || {});
      else toast.error(data.error || 'Failed to load workflow configs');
    } catch {
      toast.error('Failed to load workflow configs');
    } finally { setLoading(false); }
  }, [companyId]);

  // Fetch policy documents (category=attendance) + branches + departments
  // for the scope selectors — same pattern as the employee module.
  useEffect(() => {
    const hdrs = getAuthHeaders();
    const qs = companyId ? `?companyId=${companyId}` : '';
    const sep = qs ? '&' : '?';
    Promise.allSettled([
      fetch(`/api/policies${qs}${sep}category=attendance`, { headers: hdrs }),
      fetch(`/api/branches${qs}`, { headers: hdrs }),
      fetch(`/api/departments${qs}`, { headers: hdrs }),
    ]).then(results => {
      if (results[0].status === 'fulfilled' && results[0].value.ok) {
        results[0].value.json().then((d: any) => setPolicies(d.policies || d.data || []));
      }
      if (results[1].status === 'fulfilled' && results[1].value.ok) {
        results[1].value.json().then((d: any) => setBranches(d.branches || d.data || []));
      }
      if (results[2].status === 'fulfilled' && results[2].value.ok) {
        results[2].value.json().then((d: any) => setDepartments(d.departments || d.data || []));
      }
    });
  }, [companyId]);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const cfg = configs[activeType];

  const patchConfig = (patch: Partial<TypeConfig>) => {
    setConfigs(prev => ({ ...prev, [activeType]: { ...(prev[activeType] as TypeConfig), ...patch } }));
  };
  const patchRules = (patch: Partial<RequestRules>) => {
    if (!cfg) return;
    patchConfig({ rules: { ...cfg.rules, ...patch } });
  };
  const setLevels = (levels: WorkflowLevel[]) => patchConfig({ levels });

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    try {
      const res = await fetch('/api/attendance/workflow-config', {
        method: 'PUT', headers: getAuthHeaders(),
        body: JSON.stringify({
          requestType: activeType, companyId,
          levels: cfg.levels, rules: cfg.rules,
          // Policy document + scope (new — unification pass)
          policyDocumentId: cfg.policyDocumentId || null,
          employmentType: cfg.employmentType || 'all',
          branchId: cfg.branchId || null,
          departmentId: cfg.departmentId || null,
          employeeStatus: cfg.employeeStatus || 'all',
        }),
      });
      const data = await res.json();
      if (res.ok) { toast.success(`${REQUEST_TYPES.find(t => t.key === activeType)?.label} workflow saved`); fetchConfigs(); }
      else toast.error(data.error || 'Save failed');
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  const runSweep = async () => {
    setSweeping(true);
    try {
      const res = await fetch('/api/attendance/workflow-config', {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ action: 'sla-sweep' }),
      });
      const data = await res.json();
      if (res.ok) toast.success(`SLA sweep: ${data.processed} processed (auto-approved ${data.autoApproved}, escalated ${data.autoEscalated})`);
      else toast.error(data.error || 'SLA sweep failed');
    } catch { toast.error('SLA sweep failed'); }
    finally { setSweeping(false); }
  };

  const resetToBlueprint = () => {
    // Reload from server (defaults come back when nothing is saved)
    toast('Reloading saved configuration…', { icon: 'ℹ️' });
    fetchConfigs();
  };

  return (
    <div className="space-y-4">
      {/* Intro + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-thb-text-secondary">
          Configure <b>rule constraints</b> (submission windows, caps, auto-deductions, geo/IP) and the
          <b> dynamic multi-level approval workflow</b> for every attendance request type.
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runSweep} disabled={sweeping} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-thb-border bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <FiRefreshCw className={`w-3.5 h-3.5 ${sweeping ? 'animate-spin' : ''}`} /> Run SLA Sweep
          </button>
          {canEdit && (
            <button onClick={save} disabled={saving || !cfg} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 disabled:opacity-50">
              <FiSave className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save Configuration'}
            </button>
          )}
        </div>
      </div>

      {/* Request type selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {REQUEST_TYPES.map(t => {
          const c = colorMap[t.color];
          const saved = configs[t.key];
          return (
            <button key={t.key}
              onClick={() => setActiveType(t.key)}
              className={`text-left p-3.5 rounded-xl border transition-all ${activeType === t.key ? c.active : 'border-thb-border bg-white hover:shadow-sm'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`p-1.5 rounded-lg border ${c.chip}`}>{t.icon}</span>
                <span className="text-xs font-bold text-thb-text-primary leading-tight">{t.label}</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">{t.desc}</p>
              <p className="text-[10px] mt-1.5 font-medium text-slate-400">
                {saved?.scope === 'default' ? 'Blueprint defaults' : `${saved?.levels?.length || 0} levels · custom rules`}
              </p>
            </button>
          );
        })}
      </div>

      {loading && <div className="text-center py-10 text-sm text-slate-400">Loading workflow configuration…</div>}

      {!loading && cfg && (
        <>
        {/* ─── Policy Document Linkage + Employee Scope (new — unification pass) ─── */}
        <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/30">
          <h3 className="flex items-center gap-2 text-sm font-bold text-thb-text-primary mb-1">
            <FiBookOpen className="w-4 h-4 text-teal-600" /> Policy Document & Employee Scope
          </h3>
          <p className="text-[11px] text-slate-500 mb-3">
            Link this workflow to a policy document and restrict which employees it applies to. The most specific matching config wins at submission time.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Policy document dropdown */}
            <div className="sm:col-span-2 lg:col-span-1">
              <label className={labelCls}>Policy Document (Attendance)</label>
              <select
                value={cfg.policyDocumentId || ''}
                onChange={e => patchConfig({ policyDocumentId: e.target.value || null })}
                disabled={!canEdit}
                className={`${inputCls} mt-1`}
              >
                <option value="">— Not Linked —</option>
                {policies.map(p => (
                  <option key={p.id} value={p.id}>{p.title} {p.version ? `(v${p.version})` : ''}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 mt-0.5">Pick from the Policy Documents tab (category = attendance).</p>
            </div>
            {/* Employment type */}
            <div>
              <label className={labelCls}>Employment Type</label>
              <select
                value={cfg.employmentType || 'all'}
                onChange={e => patchConfig({ employmentType: e.target.value })}
                disabled={!canEdit}
                className={`${inputCls} mt-1`}
              >
                <option value="all">All Types</option>
                <option value="full-time">Full-Time</option>
                <option value="part-time">Part-Time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
              </select>
            </div>
            {/* Employee status */}
            <div>
              <label className={labelCls}>Employee Status</label>
              <select
                value={cfg.employeeStatus || 'all'}
                onChange={e => patchConfig({ employeeStatus: e.target.value })}
                disabled={!canEdit}
                className={`${inputCls} mt-1`}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="on_leave">On Leave</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            {/* Branch */}
            <div>
              <label className={labelCls}>Branch</label>
              <select
                value={cfg.branchId || ''}
                onChange={e => patchConfig({ branchId: e.target.value || null })}
                disabled={!canEdit}
                className={`${inputCls} mt-1`}
              >
                <option value="">All Branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            {/* Department */}
            <div>
              <label className={labelCls}>Department</label>
              <select
                value={cfg.departmentId || ''}
                onChange={e => patchConfig({ departmentId: e.target.value || null })}
                disabled={!canEdit}
                className={`${inputCls} mt-1`}
              >
                <option value="">All Departments</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          {/* Scope summary chip */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className="text-slate-400 font-semibold uppercase tracking-wide">Applies to:</span>
            <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium">
              {cfg.employmentType === 'all' ? 'All employment types' : cfg.employmentType}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium">
              {cfg.employeeStatus === 'all' ? 'All statuses' : cfg.employeeStatus}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium">
              {cfg.branchId ? (branches.find(b => b.id === cfg.branchId)?.name || 'Branch') : 'All branches'}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium">
              {cfg.departmentId ? (departments.find(d => d.id === cfg.departmentId)?.name || 'Dept') : 'All departments'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* ─── Left: Rules & Constraints (Rule Engine) ─── */}
          <div className="lg:col-span-2 space-y-4">
            <div className="p-4 rounded-xl border border-thb-border bg-white">
              <h3 className="flex items-center gap-2 text-sm font-bold text-thb-text-primary mb-1">
                <FiSettings className="w-4 h-4 text-teal-600" /> Rule Constraints
              </h3>
              <p className="text-[11px] text-slate-500 mb-3">Validated before the workflow is triggered.</p>

              <div className="space-y-3.5">
                {/* Regularization window */}
                <div>
                  <label className={labelCls}>Regularization Window (days)</label>
                  <input type="number" min={0} max={90} value={cfg.rules.windowDays}
                    onChange={e => patchRules({ windowDays: Number(e.target.value) })}
                    disabled={!canEdit} className={`${inputCls} mt-1`} />
                  <p className="text-[10px] text-slate-400 mt-0.5">Missing punches must be regularized within this many days (0 = no limit).</p>
                </div>

                {/* Monthly cap */}
                <div>
                  <label className={labelCls}>Monthly Usage Cap</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <input type="number" min={0} max={60} value={cfg.rules.monthlyCap}
                      onChange={e => patchRules({ monthlyCap: Number(e.target.value) })}
                      disabled={!canEdit} className={inputCls} placeholder="0 = unlimited" />
                    <select value={cfg.rules.overCapAction || 'review'} onChange={e => patchRules({ overCapAction: e.target.value })}
                      disabled={!canEdit} className={inputCls}>
                      <option value="review">Over cap → HR review</option>
                      <option value="block">Over cap → block</option>
                    </select>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">e.g. max 3 regularizations / 4 permissions per month (0 = unlimited).</p>
                </div>

                {/* Weekly cap (WFH) */}
                {activeType === 'WFH' && (
                  <div>
                    <label className={labelCls}>WFH Days Per Week Limit</label>
                    <input type="number" min={0} max={7} value={cfg.rules.weeklyCap}
                      onChange={e => patchRules({ weeklyCap: Number(e.target.value) })}
                      disabled={!canEdit} className={`${inputCls} mt-1`} placeholder="0 = unlimited" />
                    <p className="text-[10px] text-slate-400 mt-0.5">Requests beyond this route to the Department Head (HOD).</p>
                  </div>
                )}

                {/* Auto-deduction (permission) */}
                {activeType === 'HOURLY_PERMISSION' && (
                  <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-100">
                    <label className={`${labelCls} flex items-center gap-1`}><FiZap className="w-3 h-3" /> Auto-Deduction Threshold</label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div>
                        <span className="text-[10px] text-slate-400">Monthly cumulative (h)</span>
                        <input type="number" min={0} max={40} step={0.5} value={cfg.rules.autoDeductThresholdHours}
                          onChange={e => patchRules({ autoDeductThresholdHours: Number(e.target.value) })}
                          disabled={!canEdit} className={inputCls} />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">Deduct (paid leave days)</span>
                        <input type="number" min={0} max={2} step={0.25} value={cfg.rules.autoDeductLeaveDays}
                          onChange={e => patchRules({ autoDeductLeaveDays: Number(e.target.value) })}
                          disabled={!canEdit} className={inputCls} />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">e.g. cumulative permissions exceed 4h/month → deduct 0.5 paid leave automatically.</p>
                  </div>
                )}

                {/* Geofencing & IP */}
                <div className="p-3 rounded-lg bg-violet-50/60 border border-violet-100">
                  <label className={`${labelCls} flex items-center gap-1`}><FiMapPin className="w-3 h-3" /> Geofencing & IP Restrictions</label>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs text-slate-600">Enforce whitelisted IPs for WFH / OUT</span>
                    <button onClick={() => patchRules({ geoFencingEnabled: !cfg.rules.geoFencingEnabled })}
                      disabled={!canEdit}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${cfg.rules.geoFencingEnabled ? 'bg-violet-500' : 'bg-slate-200'}`}>
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${cfg.rules.geoFencingEnabled ? 'translate-x-4.5 translate-x-[18px]' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  {cfg.rules.geoFencingEnabled && (
                    <textarea rows={2} value={(cfg.rules.allowedIps || []).join('\n')}
                      onChange={e => patchRules({ allowedIps: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
                      disabled={!canEdit} placeholder={'One IP per line, e.g.\n203.0.113.7'}
                      className={`${inputCls} mt-2 font-mono`} />
                  )}
                </div>

                {/* QR verification (gate pass) */}
                {activeType === 'GATE_PASS' && (
                  <div className="p-3 rounded-lg bg-cyan-50/60 border border-cyan-100">
                    <label className={`${labelCls} flex items-center gap-1`}><FiShield className="w-3 h-3" /> Security Turnstile QR</label>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs text-slate-600">Require QR scan verification (out/in)</span>
                      <button onClick={() => patchRules({ requireQrVerification: !cfg.rules.requireQrVerification })}
                        disabled={!canEdit}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${cfg.rules.requireQrVerification ? 'bg-cyan-500' : 'bg-slate-200'}`}>
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${cfg.rules.requireQrVerification ? 'translate-x-4.5 translate-x-[18px]' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Security scans the pass at the gate to log actual exit/entry times.</p>
                  </div>
                )}

                {/* ═══════ UNIFIED POLICY SECTIONS (absorbed from legacy AttendancePolicyRule) ═══════ */}
                <div className="pt-2 mt-2 border-t border-thb-border">
                  <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wider mb-2">Shift, Grace & Policy Rules</p>
                  <p className="text-[10px] text-slate-400 mb-3">One unified policy — every attendance request type shares these shift / grace / late-mark / OT / gate-pass parameters.</p>
                </div>

                {/* Shift & Grace */}
                <div className="p-3 rounded-lg bg-slate-50/60 border border-thb-border">
                  <label className={`${labelCls} flex items-center gap-1 mb-2`}><FiClock className="w-3 h-3" /> Shift & Grace Period</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400">Shift Start</span>
                      <input type="time" value={cfg.rules.shiftStartDefault || '09:00'}
                        onChange={e => patchRules({ shiftStartDefault: e.target.value })}
                        disabled={!canEdit} className={inputCls} />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">Shift End</span>
                      <input type="time" value={cfg.rules.shiftEndDefault || '17:30'}
                        onChange={e => patchRules({ shiftEndDefault: e.target.value })}
                        disabled={!canEdit} className={inputCls} />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">Break (min)</span>
                      <input type="number" min={0} max={120} value={cfg.rules.breakDurationMinutes ?? 30}
                        onChange={e => patchRules({ breakDurationMinutes: Number(e.target.value) })}
                        disabled={!canEdit} className={inputCls} />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">Late Grace (min)</span>
                      <input type="number" min={0} max={60} value={cfg.rules.lateGraceMinutes ?? 15}
                        onChange={e => patchRules({ lateGraceMinutes: Number(e.target.value) })}
                        disabled={!canEdit} className={inputCls} />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">Early Grace (min)</span>
                      <input type="number" min={0} max={60} value={cfg.rules.earlyGraceMinutes ?? 10}
                        onChange={e => patchRules({ earlyGraceMinutes: Number(e.target.value) })}
                        disabled={!canEdit} className={inputCls} />
                    </div>
                  </div>
                </div>

                {/* Late-mark policy */}
                <div className="p-3 rounded-lg bg-amber-50/40 border border-amber-100">
                  <label className={`${labelCls} flex items-center gap-1 mb-2`}><FiAlertTriangle className="w-3 h-3 text-amber-500" /> Late-Mark Policy</label>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <span className="text-[10px] text-slate-400">Allowance / Month</span>
                      <input type="number" min={0} max={30} value={cfg.rules.lateMarkAllowancePerMonth ?? 4}
                        onChange={e => patchRules({ lateMarkAllowancePerMonth: Number(e.target.value) })}
                        disabled={!canEdit} className={inputCls} />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">Half-Day After (min)</span>
                      <input type="number" min={0} max={120} value={cfg.rules.halfDayAfterMinutes ?? 21}
                        onChange={e => patchRules({ halfDayAfterMinutes: Number(e.target.value) })}
                        disabled={!canEdit} className={inputCls} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-600">Half-day on exceeding allowance</span>
                      <button onClick={() => patchRules({ lateMarkHalfDayOnExceed: !cfg.rules.lateMarkHalfDayOnExceed })} disabled={!canEdit}
                        className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${cfg.rules.lateMarkHalfDayOnExceed ? 'bg-amber-500' : 'bg-slate-200'}`}>
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${cfg.rules.lateMarkHalfDayOnExceed ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-600">Not applicable on Tour / OD</span>
                      <button onClick={() => patchRules({ lateMarkNotApplicableOnTour: !cfg.rules.lateMarkNotApplicableOnTour })} disabled={!canEdit}
                        className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${cfg.rules.lateMarkNotApplicableOnTour ? 'bg-amber-500' : 'bg-slate-200'}`}>
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${cfg.rules.lateMarkNotApplicableOnTour ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Overtime policy */}
                <div className="p-3 rounded-lg bg-violet-50/40 border border-violet-100">
                  <label className={`${labelCls} flex items-center gap-1 mb-2`}><FiTrendingUp className="w-3 h-3 text-violet-500" /> Overtime Policy</label>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-slate-600">Auto-detect overtime</span>
                    <button onClick={() => patchRules({ autoOvertimeEnabled: !cfg.rules.autoOvertimeEnabled })} disabled={!canEdit}
                      className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${cfg.rules.autoOvertimeEnabled ? 'bg-violet-500' : 'bg-slate-200'}`}>
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${cfg.rules.autoOvertimeEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  {cfg.rules.autoOvertimeEnabled && (
                    <div>
                      <span className="text-[10px] text-slate-400">OT Threshold (min, 480 = 8h)</span>
                      <input type="number" min={0} max={1440} value={cfg.rules.overtimeThresholdMinutes ?? 480}
                        onChange={e => patchRules({ overtimeThresholdMinutes: Number(e.target.value) })}
                        disabled={!canEdit} className={inputCls} />
                    </div>
                  )}
                </div>

                {/* Gate-pass policy (show for all types — it's tenant-wide) */}
                <div className="p-3 rounded-lg bg-cyan-50/40 border border-cyan-100">
                  <label className={`${labelCls} flex items-center gap-1 mb-2`}><FiShield className="w-3 h-3 text-cyan-500" /> Gate-Pass Policy</label>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <span className="text-[10px] text-slate-400">Max Passes / Month</span>
                      <input type="number" min={0} max={30} value={cfg.rules.gatePassMaxPerMonth ?? 1}
                        onChange={e => patchRules({ gatePassMaxPerMonth: Number(e.target.value) })}
                        disabled={!canEdit} className={inputCls} />
                      <p className="text-[9px] text-slate-400 mt-0.5">0 = unlimited</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">Early-Departure Hours</span>
                      <input type="number" min={0} max={8} value={cfg.rules.gatePassEarlyHours ?? 1}
                        onChange={e => patchRules({ gatePassEarlyHours: Number(e.target.value) })}
                        disabled={!canEdit} className={inputCls} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-600">Half-day on exceeding monthly passes</span>
                      <button onClick={() => patchRules({ gatePassHalfDayOnExceed: !cfg.rules.gatePassHalfDayOnExceed })} disabled={!canEdit}
                        className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${cfg.rules.gatePassHalfDayOnExceed ? 'bg-cyan-500' : 'bg-slate-200'}`}>
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${cfg.rules.gatePassHalfDayOnExceed ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-600">Half-day gate-pass marks next day half-day</span>
                      <button onClick={() => patchRules({ gatePassHalfDayNextDay: !cfg.rules.gatePassHalfDayNextDay })} disabled={!canEdit}
                        className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${cfg.rules.gatePassHalfDayNextDay ? 'bg-cyan-500' : 'bg-slate-200'}`}>
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${cfg.rules.gatePassHalfDayNextDay ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  </div>
                </div>
                {/* ═══════ END unified policy sections ═══════ */}
              </div>
            </div>
          </div>

          {/* ─── Right: Dynamic Workflow Builder ─── */}
          <div className="lg:col-span-3">
            <div className="p-4 rounded-xl border border-thb-border bg-white">
              <div className="flex items-center justify-between mb-1">
                <h3 className="flex items-center gap-2 text-sm font-bold text-thb-text-primary">
                  <FiGitBranch className="w-4 h-4 text-teal-600" /> Approval Workflow Levels
                </h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.scope === 'default' ? 'bg-slate-100 text-slate-500' : 'bg-teal-50 text-teal-700'}`}>
                  {cfg.scope === 'company' ? 'Company scope' : cfg.scope === 'tenant' ? 'Tenant scope' : 'Blueprint default (not saved yet)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">
                Routes by role — never by name. Levels run top → bottom; conditional levels are skipped automatically.
              </p>

              <div className="space-y-3">
                {cfg.levels.map((lvl, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-thb-border bg-slate-50/60">
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-thb-text-primary">
                        <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-[10px] flex items-center justify-center">L{idx + 1}</span>
                        Level {idx + 1}
                      </span>
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button disabled={idx === 0} onClick={() => {
                            const next = [...cfg.levels]; [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                            setLevels(next.map((l, i) => ({ ...l, level: i + 1 })));
                          }} className="p-1 rounded hover:bg-white disabled:opacity-30"><FiArrowUp className="w-3.5 h-3.5" /></button>
                          <button disabled={idx === cfg.levels.length - 1} onClick={() => {
                            const next = [...cfg.levels]; [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                            setLevels(next.map((l, i) => ({ ...l, level: i + 1 })));
                          }} className="p-1 rounded hover:bg-white disabled:opacity-30"><FiArrowDown className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setLevels(cfg.levels.filter((_, i) => i !== idx).map((l, i) => ({ ...l, level: i + 1 })))}
                            className="p-1 rounded hover:bg-rose-50 text-rose-500"><FiTrash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <label className={labelCls}>Approver (actor type)</label>
                        <select value={lvl.actorType} disabled={!canEdit}
                          onChange={e => {
                            const next = [...cfg.levels];
                            next[idx] = { ...lvl, actorType: e.target.value, label: ACTOR_TYPES.find(a => a.value === e.target.value)?.label || lvl.label };
                            setLevels(next);
                          }} className={`${inputCls} mt-1`}>
                          {ACTOR_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Display label</label>
                        <input value={lvl.label} disabled={!canEdit}
                          onChange={e => { const next = [...cfg.levels]; next[idx] = { ...lvl, label: e.target.value }; setLevels(next); }}
                          className={`${inputCls} mt-1`} />
                      </div>
                    </div>

                    {/* SLA */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                      <div>
                        <label className={labelCls}>SLA window (hours, 0 = none)</label>
                        <input type="number" min={0} max={720} value={lvl.slaHours} disabled={!canEdit}
                          onChange={e => { const next = [...cfg.levels]; next[idx] = { ...lvl, slaHours: Number(e.target.value) }; setLevels(next); }}
                          className={`${inputCls} mt-1`} />
                      </div>
                      <div>
                        <label className={labelCls}>When SLA breached</label>
                        <select value={lvl.onSla} disabled={!canEdit}
                          onChange={e => { const next = [...cfg.levels]; next[idx] = { ...lvl, onSla: e.target.value }; setLevels(next); }}
                          className={`${inputCls} mt-1`}>
                          <option value="none">No action</option>
                          <option value="auto_approve">Auto-approve (low-risk requests)</option>
                          <option value="auto_escalate">Auto-escalate to next level</option>
                        </select>
                      </div>
                    </div>

                    {/* Conditions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                      {([['skipIf', 'Skip this level when'], ['autoApproveIf', 'Auto-approve (system) when']] as const).map(([key, caption]) => {
                        const cond = lvl[key] as RuleCondition | null;
                        return (
                          <div key={key} className="p-2 rounded-lg bg-white border border-thb-border">
                            <label className={`${labelCls} flex items-center gap-1`}>
                              {key === 'skipIf' ? <FiAlertTriangle className="w-3 h-3 text-amber-500" /> : <FiCheckSquare className="w-3 h-3 text-emerald-500" />}
                              {caption}
                            </label>
                            {cond ? (
                              <div className="flex items-center gap-1 mt-1">
                                <select value={cond.field} disabled={!canEdit}
                                  onChange={e => { const next = [...cfg.levels]; next[idx] = { ...lvl, [key]: { ...cond, field: e.target.value } }; setLevels(next); }}
                                  className={inputCls}>
                                  {CONDITION_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                </select>
                                <select value={cond.op} disabled={!canEdit}
                                  onChange={e => { const next = [...cfg.levels]; next[idx] = { ...lvl, [key]: { ...cond, op: e.target.value } }; setLevels(next); }}
                                  className={`${inputCls} w-16 px-1`}>
                                  {CONDITION_OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                                <input value={String(cond.value)} disabled={!canEdit}
                                  onChange={e => { const next = [...cfg.levels]; next[idx] = { ...lvl, [key]: { ...cond, value: e.target.value } }; setLevels(next); }}
                                  className={`${inputCls} w-20`} />
                                <button onClick={() => { const next = [...cfg.levels]; next[idx] = { ...lvl, [key]: null }; setLevels(next); }}
                                  className="p-1 text-slate-400 hover:text-rose-500 shrink-0"><FiTrash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            ) : (
                              <button disabled={!canEdit}
                                onClick={() => { const next = [...cfg.levels]; next[idx] = { ...lvl, [key]: { field: 'durationDays', op: 'gt', value: 3 } }; setLevels(next); }}
                                className="mt-1 text-[11px] text-teal-600 hover:text-teal-700 font-medium inline-flex items-center gap-1">
                                <FiPlus className="w-3 h-3" /> Add condition
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {canEdit && (
                  <button onClick={() => setLevels([...cfg.levels, {
                    level: cfg.levels.length + 1, actorType: 'hr_admin', label: 'HR Administrator',
                    slaHours: 24, onSla: 'none', skipIf: null, autoApproveIf: null,
                  }])}
                    className="w-full py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-xs font-semibold text-slate-500 hover:border-teal-300 hover:text-teal-600 inline-flex items-center justify-center gap-1.5">
                    <FiPlus className="w-4 h-4" /> Add Approval Level
                  </button>
                )}
              </div>

              {/* Blueprint hint */}
              <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-thb-border text-[11px] text-slate-500 leading-relaxed">
                <b className="text-slate-600">Standard blueprint for {REQUEST_TYPES.find(t => t.key === activeType)?.label}:</b>{' '}
                {activeType === 'REGULARIZATION' && 'L1 Reporting Manager (48h escalate) → L2 HR auto-approves unless monthly cap (3) exceeded. Requests over the cap go to HR for manual review.'}
                {activeType === 'WFH' && 'L1 Reporting Manager → L2 HOD only when weekly WFH days exceed 2 → L3 VP/Director only when duration exceeds 3 days.'}
                {activeType === 'HOURLY_PERMISSION' && 'L1 Reporting Manager with 24h auto-approve SLA. Cumulative monthly hours over the threshold deduct 0.5 paid leave automatically.'}
                {activeType === 'GATE_PASS' && 'L1 Reporting Manager → L2 HR (skipped for OFFICIAL passes) → L3 Security verifies QR at the turnstile (exit + entry scans reconcile attendance).'}
              </div>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
