'use client';

import { useState } from 'react';
import { FiSettings, FiRefreshCw, FiSave } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

export default function AssetSettingsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [saving, setSaving] = useState(false);

  // Depreciation Configuration
  const [depreciationMethod, setDepreciationMethod] = useState('straight-line');
  const [tagPrefix, setTagPrefix] = useState('AST-');

  // Allocation Rules
  const [autoAssignOnOnboarding, setAutoAssignOnOnboarding] = useState(true);
  const [maintenanceReminders, setMaintenanceReminders] = useState(true);
  const [auditTrail, setAuditTrail] = useState(true);

  const handleRefresh = () => {
    setDepreciationMethod('straight-line');
    setTagPrefix('AST-');
    setAutoAssignOnOnboarding(true);
    setMaintenanceReminders(true);
    setAuditTrail(true);
    toast.success('Settings refreshed to defaults');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      toast.success('Asset settings saved successfully');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const selectClass =
    'w-full px-3 py-2 rounded-lg border border-thb-border text-sm text-thb-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400';
  const inputClass =
    'w-full px-3 py-2 rounded-lg border border-thb-border text-sm text-thb-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-green-50 text-green-600">
            <FiSettings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">Asset Settings</h1>
            <p className="text-sm text-thb-text-secondary">
              Configure depreciation methods and asset allocation rules
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors"
          >
            <FiRefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          {isAdmin && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiSave className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Depreciation Configuration */}
        <div className="thb-card p-6 space-y-5">
          <h2 className="text-base font-semibold text-thb-text-primary">Depreciation Configuration</h2>

          <div className="space-y-1">
            <label className="text-sm font-medium text-thb-text-secondary">Depreciation Method</label>
            <select
              value={depreciationMethod}
              onChange={(e) => setDepreciationMethod(e.target.value)}
              className={selectClass}
            >
              <option value="straight-line">Straight-Line</option>
              <option value="declining-balance">Declining Balance</option>
              <option value="sum-of-years">Sum-of-Years&apos; Digits</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-thb-text-secondary">Tag Prefix</label>
            <input
              type="text"
              value={tagPrefix}
              onChange={(e) => setTagPrefix(e.target.value)}
              placeholder="e.g. AST-"
              className={inputClass}
            />
            <p className="text-xs text-thb-text-muted">Prefix used for auto-generating asset tags</p>
          </div>
        </div>

        {/* Allocation Rules */}
        <div className="thb-card p-6 space-y-5">
          <h2 className="text-base font-semibold text-thb-text-primary">Allocation Rules</h2>

          {/* Auto-assign on Onboarding */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Auto-assign on Onboarding</p>
              <p className="text-xs text-thb-text-muted">Automatically allocate default assets to new employees</p>
            </div>
            <button
              onClick={() => setAutoAssignOnOnboarding(!autoAssignOnOnboarding)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                autoAssignOnOnboarding ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {autoAssignOnOnboarding ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Maintenance Reminders */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Maintenance Reminders</p>
              <p className="text-xs text-thb-text-muted">Send scheduled maintenance alerts to asset custodians</p>
            </div>
            <button
              onClick={() => setMaintenanceReminders(!maintenanceReminders)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                maintenanceReminders ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {maintenanceReminders ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Audit Trail */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Audit Trail</p>
              <p className="text-xs text-thb-text-muted">Maintain a full history log for all asset transactions</p>
            </div>
            <button
              onClick={() => setAuditTrail(!auditTrail)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                auditTrail ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {auditTrail ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
