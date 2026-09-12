'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiShield, FiLock, FiEye, FiEyeOff, FiHash, FiRefreshCw,
  FiCheck, FiAlertTriangle, FiInfo, FiTrash2, FiSave, FiPlus,
} from 'react-icons/fi';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import {
  PII_FIELDS,
  MaskingStrategy,
  PiiPolicyEntry,
  normalizeVisibleRoles,
} from '@/lib/pii-mask';

/* ────────────────────────────────────────────────────────────────────── */
/* Static metadata for each PII field                                    */
/* ────────────────────────────────────────────────────────────────────── */
const FIELD_META: Record<string, { label: string; description: string; example: string }> = {
  dob: {
    label: 'Date of Birth',
    description: 'Candidate birth date — used for age eligibility checks.',
    example: '1990-05-12',
  },
  gender: {
    label: 'Gender',
    description: 'Self-identified gender — protect to mitigate hiring bias.',
    example: 'Female',
  },
  photo: {
    label: 'Photo',
    description: 'Candidate avatar / resume photo — mask to reduce bias.',
    example: 'https://.../avatar.png',
  },
  address: {
    label: 'Address',
    description: 'Residential address — sensitive for background checks only.',
    example: '12 MG Road, Bengaluru, KA 560001',
  },
  phone: {
    label: 'Phone',
    description: 'Contact phone number.',
    example: '+91 98765 43210',
  },
  email: {
    label: 'Email',
    description: 'Contact email address.',
    example: 'jane.doe@gmail.com',
  },
  aadhaar: {
    label: 'Aadhaar (IN National ID)',
    description: '12-digit Indian national ID — highly sensitive.',
    example: '1234-5678-9012',
  },
  ssn: {
    label: 'SSN (US)',
    description: 'US Social Security Number — highly sensitive.',
    example: '123-45-6789',
  },
  sin: {
    label: 'SIN (CA)',
    description: 'Canadian Social Insurance Number — highly sensitive.',
    example: '123-456-789',
  },
};

const STRATEGY_META: Array<{
  value: MaskingStrategy;
  label: string;
  icon: React.ReactNode;
  description: string;
}> = [
  {
    value: 'full',
    label: 'Full',
    icon: <FiEye className="w-3.5 h-3.5" />,
    description: 'Show the value unchanged (default for recruiters + admins).',
  },
  {
    value: 'partial',
    label: 'Partial',
    icon: <FiEye className="w-3.5 h-3.5" />,
    description: 'Show a redacted fragment (e.g. "+91 98xxx xx123", "j****@gmail.com").',
  },
  {
    value: 'hash',
    label: 'Hash',
    icon: <FiHash className="w-3.5 h-3.5" />,
    description: 'Show a stable fingerprint ("sha256:<8 hex>") — for audit logs only.',
  },
  {
    value: 'hidden',
    label: 'Hidden',
    icon: <FiEyeOff className="w-3.5 h-3.5" />,
    description: 'Show "***MASKED***" placeholder. Recommended default for hiring panel.',
  },
];

const ROLE_OPTIONS = [
  { value: 'recruiter', label: 'Recruiter' },
  { value: 'recruiter_admin', label: 'Recruiter Admin' },
  { value: 'admin', label: 'HR Admin' },
  { value: 'tenant_admin', label: 'Tenant Admin' },
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'hiring_panel', label: 'Hiring Panel' },
  { value: 'interviewer', label: 'Interviewer' },
  { value: 'manager', label: 'Hiring Manager' },
];

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface PolicyRow extends PiiPolicyEntry {
  id: string;
  tenantId: string;
  updatedAt: string;
  updatedBy?: string | null;
}

const DEFAULT_NEW_POLICY: {
  field: string;
  maskingStrategy: MaskingStrategy;
  visibleToRoles: string[];
} = {
  field: 'dob',
  maskingStrategy: 'hidden',
  visibleToRoles: [],
};

export default function PiiPolicyAdminPage() {
  const { user } = useAuthStore();
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');

  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // For each existing policy row, track an in-flight edit copy.
  const [drafts, setDrafts] = useState<Record<string, { maskingStrategy: MaskingStrategy; visibleToRoles: string[] }>>({});

  // For creating a new policy on a field that has no policy yet.
  const [newPolicy, setNewPolicy] = useState({ ...DEFAULT_NEW_POLICY });
  const [showNewForm, setShowNewForm] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchPolicies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ats/pii-policy', { headers: getAuthHeaders() });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to load PII policies');
      }
      const data = await res.json();
      const rows: PolicyRow[] = (data.policies || []).map((p: PiiPolicyEntry & { id: string; tenantId: string; updatedAt: string; updatedBy?: string | null }) => ({
        ...p,
        visibleToRoles: normalizeVisibleRoles(p.visibleToRoles),
      }));
      setPolicies(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load PII policies');
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  // Compute the set of fields that already have a policy — used to gate the
  // new-policy form so we don't let the user pick a duplicate.
  const fieldsWithPolicy = new Set(policies.map(p => p.field));
  const fieldsWithoutPolicy = PII_FIELDS.filter(f => !fieldsWithPolicy.has(f));

  const startEdit = (p: PolicyRow) => {
    setDrafts(prev => ({
      ...prev,
      [p.id]: { maskingStrategy: p.maskingStrategy, visibleToRoles: [...normalizeVisibleRoles(p.visibleToRoles)] },
    }));
  };

  const cancelEdit = (id: string) => {
    setDrafts(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const updateDraft = (id: string, patch: Partial<{ maskingStrategy: MaskingStrategy; visibleToRoles: string[] }>) => {
    setDrafts(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), ...patch },
    }));
  };

  const saveDraft = async (id: string) => {
    const draft = drafts[id];
    if (!draft) return;
    setSavingId(id);
    try {
      const res = await fetch(`/api/ats/pii-policy/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          maskingStrategy: draft.maskingStrategy,
          visibleToRoles: draft.visibleToRoles,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to update policy');
      }
      toast.success('PII policy updated');
      cancelEdit(id);
      fetchPolicies();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update policy');
    } finally {
      setSavingId(null);
    }
  };

  const deletePolicy = async (id: string, field: string) => {
    if (!confirm(`Delete the PII policy for "${field}"? This will revert to the default (hidden) strategy for hiring-panel members.`)) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(`/api/ats/pii-policy/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to delete policy');
      }
      toast.success('PII policy deleted');
      fetchPolicies();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete policy');
    } finally {
      setDeletingId(null);
    }
  };

  const createPolicy = async () => {
    if (!newPolicy.field) {
      toast.error('Pick a field first');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/ats/pii-policy', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          field: newPolicy.field,
          maskingStrategy: newPolicy.maskingStrategy,
          visibleToRoles: newPolicy.visibleToRoles,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to create policy');
      }
      toast.success('PII policy created');
      setShowNewForm(false);
      setNewPolicy({ ...DEFAULT_NEW_POLICY });
      fetchPolicies();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create policy');
    } finally {
      setCreating(false);
    }
  };

  /* ── Access guard ── */
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-thb-text-secondary">
        Loading...
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-red-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/20">
          <FiLock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-semibold text-thb-text-primary">Admins only</h2>
        <p className="text-thb-text-secondary text-sm max-w-md">
          Only tenant admins, HR admins, and super admins can configure candidate PII masking policies.
        </p>
        <Link href="/recruitment" className="text-green-600 hover:underline text-sm font-medium">
          Back to Recruitment
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiShield className="w-6 h-6 text-emerald-500" />
            PII Masking Policy
          </h1>
          <p className="text-thb-text-secondary mt-1">
            Configure how candidate PII fields are shown to each role in the recruitment funnel (REQ-SEC-REC-03).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPolicies}
            className="inline-flex items-center gap-2 px-3 py-2.5 border border-thb-border rounded-lg text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors"
          >
            <FiRefreshCw className="w-4 h-4" /> Refresh
          </button>
          {fieldsWithoutPolicy.length > 0 && (
            <button
              onClick={() => setShowNewForm(s => !s)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium text-sm shadow-sm shadow-emerald-500/25 transition-colors"
            >
              <FiPlus className="w-4 h-4" /> New Policy
            </button>
          )}
        </div>
      </div>

      {/* Compliance callout */}
      <div className="thb-card p-4 border-l-4 border-l-amber-400 bg-amber-50/40">
        <div className="flex items-start gap-3">
          <FiAlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-thb-text-secondary leading-relaxed">
            <p className="font-medium text-thb-text-primary mb-1">Why this matters</p>
            Masking personally-identifying information (DOB, gender, photo, address, national IDs) for
            hiring-panel members is required for <strong>fair-hiring compliance</strong> (GDPR Art. 5,
            CCPA, EU AI Act Art. 10 bias-mitigation). Recruiters + HR admins always see full values
            unless explicitly overridden here. Hiring panel members (interviewers, hiring managers)
            are masked by default.
          </div>
        </div>
      </div>

      {/* New policy form */}
      {showNewForm && (
        <div className="thb-card border-l-4 border-l-emerald-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-thb-text-primary">Create PII Policy</h2>
              <button onClick={() => setShowNewForm(false)} className="text-thb-text-muted hover:text-thb-text-primary text-sm font-medium">
                Cancel
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Field <span className="text-red-500 font-bold">*</span></label>
                <select
                  value={newPolicy.field}
                  onChange={e => setNewPolicy(p => ({ ...p, field: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                >
                  {fieldsWithoutPolicy.map(f => (
                    <option key={f} value={f}>{FIELD_META[f]?.label || f}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Masking Strategy <span className="text-red-500 font-bold">*</span></label>
                <select
                  value={newPolicy.maskingStrategy}
                  onChange={e => setNewPolicy(p => ({ ...p, maskingStrategy: e.target.value as MaskingStrategy }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                >
                  {STRATEGY_META.map(s => (
                    <option key={s.value} value={s.value}>{s.label} — {s.description.slice(0, 60)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">
                  Visible-to Roles (optional whitelist)
                </label>
                <div className="flex flex-wrap gap-2 p-2 border border-thb-border rounded-lg max-h-32 overflow-y-auto">
                  {ROLE_OPTIONS.map(r => {
                    const checked = newPolicy.visibleToRoles.includes(r.value);
                    return (
                      <label key={r.value} className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => {
                            setNewPolicy(p => ({
                              ...p,
                              visibleToRoles: e.target.checked
                                ? [...p.visibleToRoles, r.value]
                                : p.visibleToRoles.filter(v => v !== r.value),
                            }));
                          }}
                          className="w-3.5 h-3.5 rounded border-thb-border text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-thb-text-secondary">{r.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-thb-border">
              <button
                onClick={() => setShowNewForm(false)}
                className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createPolicy}
                disabled={creating}
                className="px-6 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 shadow-sm shadow-emerald-500/25 transition-colors inline-flex items-center gap-2"
              >
                {creating ? 'Creating...' : (<><FiSave className="w-4 h-4" /> Create Policy</>)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing policies list */}
      {loading ? (
        <div className="thb-card p-8 text-center text-thb-text-muted">
          <FiRefreshCw className="w-6 h-6 animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading PII policies...</p>
        </div>
      ) : policies.length === 0 ? (
        <div className="thb-card p-12 text-center">
          <FiShield className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary font-medium">No PII policies configured yet</p>
          <p className="text-sm text-thb-text-muted mt-1">
            Until you add explicit policies, all PII fields are masked with the default <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">hidden</code> strategy for hiring-panel members.
          </p>
          {fieldsWithoutPolicy.length > 0 && (
            <button
              onClick={() => setShowNewForm(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium text-sm shadow-sm shadow-emerald-500/25 transition-colors"
            >
              <FiPlus className="w-4 h-4" /> Configure first field
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {policies.map(p => {
            const meta = FIELD_META[p.field] || { label: p.field, description: '', example: '' };
            const draft = drafts[p.id];
            const isEditing = !!draft;
            const strategyMeta = STRATEGY_META.find(s => s.value === (draft?.maskingStrategy || p.maskingStrategy));
            const visibleRoles = draft?.visibleToRoles || normalizeVisibleRoles(p.visibleToRoles);

            return (
              <div key={p.id} className="thb-card">
                <div className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-semibold text-thb-text-primary">{meta.label}</h3>
                        <code className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-mono text-thb-text-secondary">{p.field}</code>
                      </div>
                      <p className="text-xs text-thb-text-muted mt-1">{meta.description}</p>
                      {meta.example && (
                        <p className="text-[11px] text-thb-text-muted mt-1">
                          <span className="font-medium">Example value:</span> <code className="bg-slate-50 px-1 py-0.5 rounded">{meta.example}</code>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!isEditing ? (
                        <>
                          <button
                            onClick={() => startEdit(p)}
                            className="px-3 py-1.5 border border-thb-border rounded-lg text-xs font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deletePolicy(p.id, p.field)}
                            disabled={deletingId === p.id}
                            className="p-1.5 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                            title="Delete policy"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => saveDraft(p.id)}
                            disabled={savingId === p.id}
                            className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors inline-flex items-center gap-1"
                          >
                            {savingId === p.id ? 'Saving...' : (<><FiCheck className="w-3.5 h-3.5" /> Save</>)}
                          </button>
                          <button
                            onClick={() => cancelEdit(p.id)}
                            className="px-3 py-1.5 border border-thb-border rounded-lg text-xs font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-thb-border">
                    {/* Masking strategy */}
                    <div>
                      <label className="block text-[11px] font-semibold text-thb-text-secondary uppercase tracking-wider mb-1.5">
                        Masking Strategy
                      </label>
                      {!isEditing ? (
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${
                            p.maskingStrategy === 'full' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' :
                            p.maskingStrategy === 'partial' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' :
                            p.maskingStrategy === 'hash' ? 'bg-teal-50 text-teal-700 ring-1 ring-teal-200' :
                            'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                          }`}>
                            {strategyMeta?.icon} {strategyMeta?.label}
                          </span>
                          <span className="text-xs text-thb-text-muted">{strategyMeta?.description}</span>
                        </div>
                      ) : (
                        <select
                          value={draft.maskingStrategy}
                          onChange={e => updateDraft(p.id, { maskingStrategy: e.target.value as MaskingStrategy })}
                          className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                        >
                          {STRATEGY_META.map(s => (
                            <option key={s.value} value={s.value}>{s.label} — {s.description}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Visible-to roles */}
                    <div>
                      <label className="block text-[11px] font-semibold text-thb-text-secondary uppercase tracking-wider mb-1.5">
                        Visible-to Roles {visibleRoles.length === 0 && <span className="text-thb-text-muted normal-case font-normal">(default: recruiter+)</span>}
                      </label>
                      {!isEditing ? (
                        visibleRoles.length === 0 ? (
                          <p className="text-xs text-thb-text-muted">
                            No explicit whitelist — recruiters + admins see full; everyone else gets the masking strategy above.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {visibleRoles.map(r => (
                              <span key={r} className="inline-flex items-center px-2 py-0.5 rounded-md bg-green-50 text-green-700 text-[11px] font-semibold ring-1 ring-green-100">
                                {ROLE_OPTIONS.find(o => o.value === r)?.label || r}
                              </span>
                            ))}
                          </div>
                        )
                      ) : (
                        <div className="flex flex-wrap gap-2 p-2 border border-thb-border rounded-lg max-h-28 overflow-y-auto">
                          {ROLE_OPTIONS.map(r => {
                            const checked = visibleRoles.includes(r.value);
                            return (
                              <label key={r.value} className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={e => {
                                    const next = e.target.checked
                                      ? [...visibleRoles, r.value]
                                      : visibleRoles.filter(v => v !== r.value);
                                    updateDraft(p.id, { visibleToRoles: next });
                                  }}
                                  className="w-3.5 h-3.5 rounded border-thb-border text-emerald-600 focus:ring-emerald-500"
                                />
                                <span className="text-thb-text-secondary">{r.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Meta footer */}
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-thb-border text-[11px] text-thb-text-muted">
                    <FiInfo className="w-3.5 h-3.5" />
                    <span>
                      Last updated {p.updatedAt ? new Date(p.updatedAt).toLocaleString() : '—'}
                      {p.updatedBy && ` · by ${p.updatedBy}`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer help */}
      <div className="thb-card p-5 bg-slate-50/40">
        <div className="flex items-start gap-3">
          <FiInfo className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-thb-text-secondary leading-relaxed">
            <p className="font-medium text-thb-text-primary mb-1">How masking is applied</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Recruiters + HR admins see <strong>full values</strong> by default (their role shortcut).</li>
              <li>If a field has a <strong>visibleToRoles</strong> whitelist, only roles in the whitelist see full values; everyone else is masked with the field&apos;s strategy.</li>
              <li>Fields with no explicit policy default to <code className="bg-slate-100 px-1 py-0.5 rounded">hidden</code> for hiring-panel members.</li>
              <li>The <code className="bg-slate-100 px-1 py-0.5 rounded">hash</code> strategy is for audit logs — the value is replaced by a stable fingerprint that cannot be reversed but allows cross-row joins.</li>
              <li>Masking runs client-side in <code className="bg-slate-100 px-1 py-0.5 rounded">/recruitment</code> before rendering; the raw value never leaves the server response unless the viewer is authorized.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
