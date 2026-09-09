'use client';

import { useState, useEffect } from 'react';
import { FiSettings, FiAlertCircle, FiSave, FiEdit2, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

interface SettingItem {
  id: string;
  category: string;
  key: string;
  value: string;
  dataType: string;
  description?: string | null;
  isEditable: boolean;
  isSecret: boolean;
  version: number;
  previousValue?: string | null;
}

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

const GOVERNANCE_SETTING_DEFS: { key: string; label: string; description: string; dataType: string; defaultValue: string }[] = [
  { key: 'auto_approve_low_risk', label: 'Auto-Approve Low Risk Workflows', description: 'Automatically approve low-risk workflow steps without manual review', dataType: 'boolean', defaultValue: 'false' },
  { key: 'policy_review_reminder_days', label: 'Policy Review Reminder (Days)', description: 'Number of days before policy expiry to send review reminder', dataType: 'number', defaultValue: '30' },
  { key: 'compliance_audit_frequency', label: 'Compliance Audit Frequency', description: 'How often compliance audits are run (daily, weekly, monthly)', dataType: 'string', defaultValue: 'monthly' },
  { key: 'workflow_timeout_hours', label: 'Workflow Timeout (Hours)', description: 'Hours before a pending workflow step is flagged as timed out', dataType: 'number', defaultValue: '48' },
  { key: 'enable_audit_trail', label: 'Enable Audit Trail', description: 'Record all governance-related actions in the audit log', dataType: 'boolean', defaultValue: 'true' },
  { key: 'max_policy_versions', label: 'Max Policy Versions', description: 'Maximum number of historical policy versions to retain', dataType: 'number', defaultValue: '10' },
  { key: 'notification_on_compliance_breach', label: 'Notify on Compliance Breach', description: 'Send notifications when compliance score drops below threshold', dataType: 'boolean', defaultValue: 'true' },
  { key: 'compliance_threshold_percent', label: 'Compliance Threshold (%)', description: 'Minimum compliance percentage before alerting', dataType: 'number', defaultValue: '80' },
];

export default function GovernanceSettingsPage() {
  const { token, user } = useAuthStore();
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin' || user?.role === 'admin';

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/governance-settings?category=governance', { headers: getAuthHeaders() });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to fetch settings (${res.status})`);
      }
      const data = await res.json();
      setSettings(data.settings || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load settings';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      /* eslint-disable react-hooks/set-state-in-effect */
      fetchSettings();
    }
  }, [token]);

  // Merge DB settings with defaults for display
  const allSettings = GOVERNANCE_SETTING_DEFS.map(def => {
    const dbSetting = settings.find(s => s.key === def.key);
    return {
      key: def.key,
      label: def.label,
      description: def.description,
      dataType: def.dataType,
      value: dbSetting?.value ?? def.defaultValue,
      id: dbSetting?.id ?? null,
      isEditable: dbSetting?.isEditable ?? true,
      version: dbSetting?.version ?? 0,
      previousValue: dbSetting?.previousValue ?? null,
    };
  });

  const startEdit = (key: string, value: string) => {
    setEditingKey(key);
    setEditValue(value);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue('');
  };

  const saveSetting = async (key: string, id: string | null) => {
    setSaving(true);
    try {
      const def = GOVERNANCE_SETTING_DEFS.find(d => d.key === key);
      const body: Record<string, unknown> = {
        key,
        value: editValue,
        category: 'governance',
        dataType: def?.dataType || 'string',
        description: def?.description,
      };
      if (id) body.id = id;

      const res = await fetch('/api/governance-settings', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save setting');
      }

      toast.success('Setting updated');
      setEditingKey(null);
      setEditValue('');
      fetchSettings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const renderValue = (dataType: string, value: string) => {
    if (dataType === 'boolean') {
      return value === 'true' ? (
        <span className="inline-flex items-center gap-1 text-emerald-600 text-sm font-medium">Yes</span>
      ) : (
        <span className="inline-flex items-center gap-1 text-slate-400 text-sm font-medium">No</span>
      );
    }
    return <span className="text-sm text-thb-text-primary">{value}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-green-50">
          <FiSettings className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-thb-text-primary">Governance Settings</h1>
          <p className="text-sm text-thb-text-secondary">Configure governance module preferences and thresholds</p>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <FiSettings className="w-8 h-8 animate-spin text-green-400" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="thb-card p-8 text-center">
          <FiAlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-600 font-medium">{error}</p>
        </div>
      )}

      {/* Settings List */}
      {!loading && !error && (
        <div className="space-y-3">
          {allSettings.map(setting => (
            <div key={setting.key} className="thb-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-thb-text-primary">{setting.label}</p>
                    {setting.version > 0 && (
                      <span className="text-[10px] text-thb-text-muted bg-slate-100 px-1.5 py-0.5 rounded">v{setting.version}</span>
                    )}
                  </div>
                  <p className="text-xs text-thb-text-muted">{setting.description}</p>
                  <div className="mt-2">
                    {editingKey === setting.key ? (
                      <div className="flex items-center gap-2">
                        {setting.dataType === 'boolean' ? (
                          <select
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            className="px-3 py-1.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                          >
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
                        ) : (
                          <input
                            type={setting.dataType === 'number' ? 'number' : 'text'}
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            className="px-3 py-1.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 w-48"
                          />
                        )}
                        <button
                          onClick={() => saveSetting(setting.key, setting.id)}
                          disabled={saving}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                        >
                          <FiSave className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-thb-border text-thb-text-secondary rounded-lg text-xs font-medium hover:bg-slate-50"
                        >
                          <FiX className="w-3.5 h-3.5" /> Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        {renderValue(setting.dataType, setting.value)}
                        {setting.previousValue && (
                          <span className="text-[10px] text-thb-text-muted">(was: {setting.previousValue})</span>
                        )}
                        {isAdmin && setting.isEditable && (
                          <button
                            onClick={() => startEdit(setting.key, setting.value)}
                            className="p-1.5 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors"
                            title="Edit"
                          >
                            <FiEdit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${setting.dataType === 'boolean' ? 'bg-blue-50 text-blue-700' : setting.dataType === 'number' ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                    {setting.dataType}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
