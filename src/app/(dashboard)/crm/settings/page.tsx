'use client';

import { useState } from 'react';
import { FiSettings, FiRefreshCw, FiSave } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

export default function CRMSettingsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [saving, setSaving] = useState(false);

  // Pipeline Configuration
  const [autoAssignLeads, setAutoAssignLeads] = useState(true);
  const [leadScoring, setLeadScoring] = useState(true);
  const [dealAutoArchival, setDealAutoArchival] = useState(false);

  // Communication Defaults
  const [emailTracking, setEmailTracking] = useState(true);
  const [autoFollowUp, setAutoFollowUp] = useState(false);

  const handleRefresh = () => {
    setAutoAssignLeads(true);
    setLeadScoring(true);
    setDealAutoArchival(false);
    setEmailTracking(true);
    setAutoFollowUp(false);
    toast.success('Settings refreshed to defaults');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      toast.success('CRM settings saved successfully');
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
            <h1 className="text-xl font-bold text-thb-text-primary">CRM Settings</h1>
            <p className="text-sm text-thb-text-secondary">
              Configure pipeline rules and communication defaults for your sales team
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
        {/* Pipeline Configuration */}
        <div className="thb-card p-6 space-y-5">
          <h2 className="text-base font-semibold text-thb-text-primary">Pipeline Configuration</h2>

          {/* Auto-assign Leads */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Auto-assign Leads</p>
              <p className="text-xs text-thb-text-muted">
                Distribute incoming leads to sales reps based on round-robin rules
              </p>
            </div>
            <button
              onClick={() => setAutoAssignLeads(!autoAssignLeads)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                autoAssignLeads ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {autoAssignLeads ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Lead Scoring */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Lead Scoring</p>
              <p className="text-xs text-thb-text-muted">
                Automatically score leads based on engagement and profile data
              </p>
            </div>
            <button
              onClick={() => setLeadScoring(!leadScoring)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                leadScoring ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {leadScoring ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Deal Auto-archival */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Deal Auto-archival</p>
              <p className="text-xs text-thb-text-muted">
                Automatically archive deals with no activity for 90+ days
              </p>
            </div>
            <button
              onClick={() => setDealAutoArchival(!dealAutoArchival)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                dealAutoArchival ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {dealAutoArchival ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>

        {/* Communication Defaults */}
        <div className="thb-card p-6 space-y-5">
          <h2 className="text-base font-semibold text-thb-text-primary">Communication Defaults</h2>

          {/* Email Tracking */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Email Tracking</p>
              <p className="text-xs text-thb-text-muted">
                Track email opens and clicks for CRM-sent communications
              </p>
            </div>
            <button
              onClick={() => setEmailTracking(!emailTracking)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                emailTracking ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {emailTracking ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Auto Follow-up */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Auto-follow-up</p>
              <p className="text-xs text-thb-text-muted">
                Send automated follow-up emails when leads go cold
              </p>
            </div>
            <button
              onClick={() => setAutoFollowUp(!autoFollowUp)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                autoFollowUp ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {autoFollowUp ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
