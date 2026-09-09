'use client';

import { useState } from 'react';
import { FiSettings, FiRefreshCw, FiSave } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

export default function ExternalSettingsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [saving, setSaving] = useState(false);

  // Client Preferences
  const [autoCreateSOW, setAutoCreateSOW] = useState(true);
  const [clientPortalAccess, setClientPortalAccess] = useState(false);

  // Vendor Preferences
  const [onboardingApproval, setOnboardingApproval] = useState(true);
  const [autoComplianceCheck, setAutoComplianceCheck] = useState(true);

  const handleRefresh = () => {
    setAutoCreateSOW(true);
    setClientPortalAccess(false);
    setOnboardingApproval(true);
    setAutoComplianceCheck(true);
    toast.success('Settings refreshed to defaults');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      toast.success('External settings saved successfully');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-green-50 text-green-600">
            <FiSettings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">External Settings</h1>
            <p className="text-sm text-thb-text-secondary">
              Manage client and vendor preferences and onboarding workflows
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
        {/* Client Preferences */}
        <div className="thb-card p-6 space-y-5">
          <h2 className="text-base font-semibold text-thb-text-primary">Client Preferences</h2>

          {/* Auto-create SOW */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Auto-create SOW</p>
              <p className="text-xs text-thb-text-muted">
                Automatically generate a Statement of Work when a client deal is won
              </p>
            </div>
            <button
              onClick={() => setAutoCreateSOW(!autoCreateSOW)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                autoCreateSOW ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {autoCreateSOW ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Client Portal Access */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Client Portal Access</p>
              <p className="text-xs text-thb-text-muted">
                Allow clients to log in and view their project status and invoices
              </p>
            </div>
            <button
              onClick={() => setClientPortalAccess(!clientPortalAccess)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                clientPortalAccess ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {clientPortalAccess ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>

        {/* Vendor Preferences */}
        <div className="thb-card p-6 space-y-5">
          <h2 className="text-base font-semibold text-thb-text-primary">Vendor Preferences</h2>

          {/* Onboarding Approval */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Onboarding Approval</p>
              <p className="text-xs text-thb-text-muted">
                Require manager approval before a new vendor is activated
              </p>
            </div>
            <button
              onClick={() => setOnboardingApproval(!onboardingApproval)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                onboardingApproval ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {onboardingApproval ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Auto Compliance Check */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Auto-compliance Check</p>
              <p className="text-xs text-thb-text-muted">
                Automatically verify vendor compliance documents on upload
              </p>
            </div>
            <button
              onClick={() => setAutoComplianceCheck(!autoComplianceCheck)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                autoComplianceCheck ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {autoComplianceCheck ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
