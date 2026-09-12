'use client';

/**
 * /employees/approval-config
 *
 * Approver configuration for BOTH employee-module workflows:
 *   1. Profile Update Workflow        — who approves employee profile-change requests
 *   2. Probation → Confirmation       — who approves probation confirmation decisions
 *
 * Chains are stored in EmployeeWorkflowConfig (workflowType =
 * 'update_profile' | 'probation_confirmation'). Until a chain is configured,
 * the built-in defaults apply (Profile: Reporting Manager → HR Admin;
 * Probation: HR Review → MD/Admin Final Confirmation).
 */
import { useCallback, useEffect, useState } from 'react';
import {
  FiArrowLeft, FiSettings, FiPlus, FiTrash2, FiArrowUp, FiArrowDown, FiSave, FiInfo, FiCheckCircle,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

type ApproverType = 'reporting_manager' | 'hr_admin' | 'tenant_admin' | 'specific_user' | 'finance';

const APPROVER_TYPES: { value: ApproverType; label: string; hint: string }[] = [
  { value: 'reporting_manager', label: 'Reporting Manager', hint: "The employee's assigned reporting manager" },
  { value: 'hr_admin', label: 'HR Admin', hint: 'All active HR / Admin users' },
  { value: 'tenant_admin', label: 'MD / Tenant Admin', hint: 'Super admin & tenant admin users' },
  { value: 'finance', label: 'Finance', hint: 'Finance role users' },
  { value: 'specific_user', label: 'Specific User', hint: 'One named approver' },
];

interface Tier { approverType: ApproverType; approverUserId: string | null; approverName: string | null }

const DEFAULT_TIERS: Record<'update_profile' | 'probation_confirmation', Tier[]> = {
  update_profile: [
    { approverType: 'reporting_manager', approverUserId: null, approverName: 'Reporting Manager' },
    { approverType: 'hr_admin', approverUserId: null, approverName: 'HR Admin' },
  ],
  probation_confirmation: [
    { approverType: 'hr_admin', approverUserId: null, approverName: 'HR Review' },
    { approverType: 'tenant_admin', approverUserId: null, approverName: 'MD/Admin Final Confirmation' },
  ],
};

interface UserOption { id: string; name: string; code: string }

function TierBuilder({
  tiers, setTiers, users,
}: {
  tiers: Tier[];
  setTiers: (t: Tier[]) => void;
  users: UserOption[];
}) {
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= tiers.length) return;
    const next = [...tiers];
    [next[i], next[j]] = [next[j], next[i]];
    setTiers(next);
  };
  return (
    <div className="space-y-2">
      {tiers.map((t, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-thb-border bg-slate-50/60 px-3 py-2.5">
          <span className="w-6 h-6 rounded-full bg-teal-600 text-white text-xs font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
          <select
            value={t.approverType}
            onChange={(e) => {
              const next = [...tiers];
              const type = e.target.value as ApproverType;
              next[i] = { approverType: type, approverUserId: type === 'specific_user' ? next[i].approverUserId : null, approverName: APPROVER_TYPES.find((a) => a.value === type)?.label || type };
              setTiers(next);
            }}
            className="px-2.5 py-1.5 border border-thb-border rounded-lg text-xs bg-white min-w-[150px]"
          >
            {APPROVER_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
          {t.approverType === 'specific_user' && (
            <select
              value={t.approverUserId || ''}
              onChange={(e) => { const next = [...tiers]; next[i] = { ...next[i], approverUserId: e.target.value || null }; setTiers(next); }}
              className="px-2.5 py-1.5 border border-thb-border rounded-lg text-xs bg-white min-w-[180px]"
            >
              <option value="">Select approver…</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}{u.code ? ` · ${u.code}` : ''}</option>)}
            </select>
          )}
          <span className="text-[10px] text-thb-text-muted flex-1 min-w-[120px]">{APPROVER_TYPES.find((a) => a.value === t.approverType)?.hint}</span>
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30" title="Move up"><FiArrowUp className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === tiers.length - 1} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30" title="Move down"><FiArrowDown className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => setTiers(tiers.filter((_, j) => j !== i))} disabled={tiers.length <= 1} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-30" title="Remove tier"><FiTrash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      ))}
      {tiers.length < 6 && (
        <button
          type="button"
          onClick={() => setTiers([...tiers, { approverType: 'hr_admin', approverUserId: null, approverName: 'HR Admin' }])}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-thb-border text-xs text-thb-text-secondary hover:bg-slate-50"
        >
          <FiPlus className="w-3.5 h-3.5" /> Add Approval Tier
        </button>
      )}
    </div>
  );
}

function WorkflowCard({
  type, title, subtitle, defaultValueNote, users,
}: {
  type: 'update_profile' | 'probation_confirmation';
  title: string;
  subtitle: string;
  defaultValueNote: string;
  users: UserOption[];
}) {
  const [tiers, setTiers] = useState<Tier[]>(DEFAULT_TIERS[type]);
  const [configured, setConfigured] = useState(false);
  const [configName, setConfigName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/employees/workflow-config?type=${type}`, { headers: getAuthHeaders() });
        const data = await res.json();
        const cfg = (data.configs || []).find((c: { isActive?: boolean }) => c.isActive !== false);
        if (cfg && Array.isArray(cfg.parsedConfig?.tiers) && cfg.parsedConfig.tiers.length) {
          setTiers(cfg.parsedConfig.tiers);
          setConfigured(true);
          setConfigName(cfg.name || '');
        }
      } catch { /* keep defaults */ } finally { setLoading(false); }
    })();
  }, [type]);

  const save = async () => {
    if (tiers.some((t) => t.approverType === 'specific_user' && !t.approverUserId)) {
      toast.error('Every "Specific User" tier needs a selected approver');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/employees/workflow-config', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ workflowType: type, tiers, name: configName || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setConfigured(true);
      toast.success(data.message || 'Approval workflow saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <div className="thb-card p-6">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center"><FiSettings className="w-4.5 h-4.5 text-teal-600" /></div>
          <div>
            <h3 className="text-sm font-semibold text-thb-text-primary">{title}</h3>
            <p className="text-xs text-thb-text-muted">{subtitle}</p>
          </div>
        </div>
        {configured && !loading && (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium shrink-0">
            <FiCheckCircle className="w-3 h-3" /> Custom chain active
          </span>
        )}
      </div>
      {loading ? (
        <p className="text-xs text-thb-text-muted py-6 text-center">Loading configuration…</p>
      ) : (
        <>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-sky-50 border border-sky-100 mb-4">
            <FiInfo className="w-3.5 h-3.5 text-sky-600 mt-0.5 shrink-0" />
            <p className="text-[11px] text-sky-800">{configured ? 'A custom approval chain is active. Requests route through the tiers below in order — only the final tier completes the workflow.' : `No custom chain configured yet — the built-in default applies: ${defaultValueNote}. Configure tiers below to override it.`}</p>
          </div>
          <TierBuilder tiers={tiers} setTiers={setTiers} users={users} />
          <div className="flex justify-end mt-4">
            <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 disabled:opacity-50">
              <FiSave className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save Approval Chain'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function ApprovalConfigPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isAdmin = ['super_admin', 'tenant_admin', 'admin', 'hr_admin', 'company_hr_admin'].includes(user?.role || '');
  const [users, setUsers] = useState<UserOption[]>([]);

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/employees?limit=500', { headers: getAuthHeaders() });
      const data = await res.json();
      const list = (data.employees || data.data || []) as Array<{ id: string; firstName?: string; lastName?: string; employeeId?: string; userId?: string | null }>;
      setUsers(list
        .filter((e) => e.userId)
        .map((e) => ({ id: e.userId as string, name: `${e.firstName || ''} ${e.lastName || ''}`.trim() || 'Unnamed', code: e.employeeId || '' })));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { if (isAdmin) loadUsers(); }, [isAdmin, loadUsers]);

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="thb-card p-8 text-center">
          <FiSettings className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-thb-text-secondary">Only administrators can configure approval workflows.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/employees')} className="p-2 rounded-lg border border-thb-border hover:bg-slate-50"><FiArrowLeft className="w-4 h-4" /></button>
        <div>
          <h1 className="text-lg font-semibold text-thb-text-primary">Approval Workflow Configuration</h1>
          <p className="text-xs text-thb-text-muted">Configure who approves profile-update requests and probation confirmations. Chains apply tenant-wide.</p>
        </div>
      </div>

      <WorkflowCard
        type="update_profile"
        title="Profile Update Workflow"
        subtitle="Approver chain for employee profile-change requests (high-risk fields)"
        defaultValueNote="Tier 1: Reporting Manager → Tier 2: HR Admin"
        users={users}
      />

      <WorkflowCard
        type="probation_confirmation"
        title="Probation → Confirmation Workflow"
        subtitle="Approver chain for probation end / employee confirmation decisions"
        defaultValueNote="Stage 1: HR Review → Stage 2: MD/Admin Final Confirmation"
        users={users}
      />

      <div className="thb-card p-4">
        <p className="text-[11px] text-thb-text-muted">
          <span className="font-semibold text-thb-text-secondary">How chaining works:</span> each request starts at Tier 1. When a tier records its decision (approve / extend / reject), the request moves to the next tier. Only the final tier&apos;s decision is applied — confirming a probation updates the employee status to &quot;Confirmed&quot;, and the final approval of a profile change applies the new value to the employee record. Super admins / tenant admins can act at any tier.
        </p>
      </div>
    </div>
  );
}
