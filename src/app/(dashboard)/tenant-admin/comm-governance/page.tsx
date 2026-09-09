'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FiMessageSquare, FiClock, FiSave, FiRefreshCw, FiZap,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface CommunicationPolicy {
  id: string;
  policyKey: string;
  policyValue: string;
  appliesToRoomType: string | null;
  isActive: boolean;
}

export default function CommGovernancePage() {
  const [policies, setPolicies] = useState<CommunicationPolicy[]>([]);
  const [loading, setLoading] = useState(false);
  const [edits, setEdits] = useState<Record<string, { value: string; appliesTo: string | null }>>({});

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/collaboration/communication-policies', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setPolicies(data.policies || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  const handleSave = async (policyKey: string) => {
    const edit = edits[policyKey];
    if (!edit) return;
    try {
      let policyValue: unknown = edit.value;
      // Try to parse as JSON for structured values
      try {
        policyValue = JSON.parse(edit.value);
      } catch {
        // Keep as string
      }

      const res = await fetch('/api/collaboration/communication-policies', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          policyKey,
          policyValue,
          appliesToRoomType: edit.appliesTo,
        }),
      });
      if (res.ok) {
        toast.success('Policy updated');
        setEdits((prev) => {
          const next = { ...prev };
          delete next[policyKey];
          return next;
        });
        fetchPolicies();
      } else {
        toast.error('Failed to update policy');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const renderPolicyEditor = (policy: CommunicationPolicy) => {
    const edit = edits[policy.policyKey];
    const currentValue = edit?.value ?? policy.policyValue;
    const currentAppliesTo = edit?.appliesTo ?? policy.appliesToRoomType;

    let description = '';
    let editableFields: JSX.Element | null = null;

    if (policy.policyKey === 'announcement_creators') {
      description = 'Define which roles can create Company-Wide announcement channels.';
      try {
        const parsed = JSON.parse(currentValue);
        const roles = (parsed.allowed_roles || []).join(', ');
        editableFields = (
          <input
            type="text"
            value={roles}
            onChange={(e) => {
              const newRoles = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
              setEdits((prev) => ({
                ...prev,
                [policy.policyKey]: {
                  value: JSON.stringify({ allowed_roles: newRoles }),
                  appliesTo: currentAppliesTo,
                },
              }));
            }}
            placeholder="tenant_admin, hr_admin"
            className="w-full px-2 py-1 text-xs border border-thb-border rounded font-mono"
          />
        );
      } catch {
        editableFields = (
          <textarea
            value={currentValue}
            onChange={(e) => setEdits((prev) => ({ ...prev, [policy.policyKey]: { value: e.target.value, appliesTo: currentAppliesTo } }))}
            rows={3}
            className="w-full px-2 py-1 text-xs border border-thb-border rounded font-mono"
          />
        );
      }
    } else if (policy.policyKey === 'message_retention') {
      description = 'Set rules for auto-deleting chat histories (e.g. "Delete messages older than 1 year"). Use null for no auto-delete.';
      try {
        const parsed = JSON.parse(currentValue);
        editableFields = (
          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-thb-text-muted">Default retention (days, blank = no delete)</label>
              <input
                type="number"
                value={parsed.default_days ?? ''}
                onChange={(e) => setEdits((prev) => ({
                  ...prev,
                  [policy.policyKey]: {
                    value: JSON.stringify({ ...parsed, default_days: e.target.value ? parseInt(e.target.value, 10) : null }),
                    appliesTo: currentAppliesTo,
                  },
                }))}
                className="w-full px-2 py-1 text-xs border border-thb-border rounded"
              />
            </div>
          </div>
        );
      } catch {
        editableFields = (
          <textarea
            value={currentValue}
            onChange={(e) => setEdits((prev) => ({ ...prev, [policy.policyKey]: { value: e.target.value, appliesTo: currentAppliesTo } }))}
            rows={3}
            className="w-full px-2 py-1 text-xs border border-thb-border rounded font-mono"
          />
        );
      }
    } else if (policy.policyKey === 'file_retention') {
      description = 'Set rules for auto-deleting or archiving old files (cleanup_after_days_inactive).';
      try {
        const parsed = JSON.parse(currentValue);
        editableFields = (
          <div>
            <label className="text-[10px] text-thb-text-muted">Cleanup files inactive for (days)</label>
            <input
              type="number"
              value={parsed.cleanup_after_days_inactive ?? 90}
              onChange={(e) => setEdits((prev) => ({
                ...prev,
                [policy.policyKey]: {
                  value: JSON.stringify({ ...parsed, cleanup_after_days_inactive: e.target.value ? parseInt(e.target.value, 10) : null }),
                  appliesTo: currentAppliesTo,
                },
              }))}
              className="w-full px-2 py-1 text-xs border border-thb-border rounded"
            />
          </div>
        );
      } catch {
        editableFields = (
          <textarea
            value={currentValue}
            onChange={(e) => setEdits((prev) => ({ ...prev, [policy.policyKey]: { value: e.target.value, appliesTo: currentAppliesTo } }))}
            rows={3}
            className="w-full px-2 py-1 text-xs border border-thb-border rounded font-mono"
          />
        );
      }
    }

    return (
      <div key={policy.id} className="thb-card p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold text-thb-text-primary flex items-center gap-2">
              {policy.policyKey.replace(/_/g, ' ')}
              {policy.appliesToRoomType && (
                <span className="px-1.5 py-0.5 text-[10px] rounded bg-slate-100 text-slate-700">
                  applies to: {policy.appliesToRoomType}
                </span>
              )}
            </h3>
            <p className="text-xs text-thb-text-muted mt-1">{description}</p>
          </div>
          {edit && (
            <button
              onClick={() => handleSave(policy.policyKey)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-700"
            >
              <FiSave className="w-3 h-3" />
              Save
            </button>
          )}
        </div>
        {editableFields}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiMessageSquare className="w-6 h-6 text-green-500" />
            Communication Governance
          </h1>
          <p className="text-sm text-thb-text-secondary mt-1">
            Define who can create announcement channels and set rules for auto-deleting chat histories
          </p>
        </div>
        <button
          onClick={fetchPolicies}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-thb-text-secondary hover:bg-slate-100 rounded-md"
        >
          <FiRefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="thb-card p-8 text-center text-sm text-thb-text-muted">Loading...</div>
      ) : (
        <div className="space-y-3">
          {policies.map(renderPolicyEditor)}
        </div>
      )}

      <div className="p-4 rounded-lg bg-green-50 border border-green-100 flex items-start gap-2">
        <FiZap className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-green-800">
          <strong>Tenant Admin capability.</strong> These policies apply to all chat rooms and files in your tenant.
          Announcement channels can only be created by the roles listed above. Message retention auto-deletes
          messages older than the specified number of days (use null/blank for no auto-delete).
        </div>
      </div>
    </div>
  );
}
