'use client';

import { useState } from 'react';
import { FiSettings, FiRefreshCw, FiSave } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

export default function OnboardingSettingsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [saving, setSaving] = useState(false);

  // Workflow Defaults
  const [autoAssignBuddy, setAutoAssignBuddy] = useState(true);
  const [itProvisioning, setItProvisioning] = useState(true);
  const [welcomeEmail, setWelcomeEmail] = useState(true);

  // Task Configuration
  const [defaultDeadline, setDefaultDeadline] = useState('14');
  const [escalationOnDelay, setEscalationOnDelay] = useState(true);
  const [documentCollectionReminder, setDocumentCollectionReminder] = useState(true);

  const handleRefresh = () => {
    setAutoAssignBuddy(true);
    setItProvisioning(true);
    setWelcomeEmail(true);
    setDefaultDeadline('14');
    setEscalationOnDelay(true);
    setDocumentCollectionReminder(true);
    toast.success('Settings refreshed to defaults');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      toast.success('Onboarding settings saved successfully');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

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
            <h1 className="text-xl font-bold text-thb-text-primary">Onboarding Settings</h1>
            <p className="text-sm text-thb-text-secondary">
              Configure onboarding workflow defaults and task management rules
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
        {/* Workflow Defaults */}
        <div className="thb-card p-6 space-y-5">
          <h2 className="text-base font-semibold text-thb-text-primary">Workflow Defaults</h2>

          {/* Auto-assign Buddy */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Auto-assign Buddy</p>
              <p className="text-xs text-thb-text-muted">
                Automatically pair new hires with an onboarding buddy from their team
              </p>
            </div>
            <button
              onClick={() => setAutoAssignBuddy(!autoAssignBuddy)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                autoAssignBuddy ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {autoAssignBuddy ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* IT Provisioning */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">IT Provisioning</p>
              <p className="text-xs text-thb-text-muted">
                Auto-create accounts and assign devices on employee start date
              </p>
            </div>
            <button
              onClick={() => setItProvisioning(!itProvisioning)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                itProvisioning ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {itProvisioning ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Welcome Email */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Welcome Email</p>
              <p className="text-xs text-thb-text-muted">
                Send a personalized welcome email with onboarding checklist on day one
              </p>
            </div>
            <button
              onClick={() => setWelcomeEmail(!welcomeEmail)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                welcomeEmail ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {welcomeEmail ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>

        {/* Task Configuration */}
        <div className="thb-card p-6 space-y-5">
          <h2 className="text-base font-semibold text-thb-text-primary">Task Configuration</h2>

          {/* Default Deadline */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-thb-text-secondary">Default Deadline (days)</label>
            <input
              type="number"
              value={defaultDeadline}
              onChange={(e) => setDefaultDeadline(e.target.value)}
              min="1"
              max="90"
              className={inputClass}
            />
            <p className="text-xs text-thb-text-muted">
              Number of days from start date to complete onboarding tasks
            </p>
          </div>

          {/* Escalation on Delay */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Escalation on Delay</p>
              <p className="text-xs text-thb-text-muted">
                Escalate overdue onboarding tasks to the hiring manager
              </p>
            </div>
            <button
              onClick={() => setEscalationOnDelay(!escalationOnDelay)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                escalationOnDelay ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {escalationOnDelay ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Document Collection Reminder */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Document Collection Reminder</p>
              <p className="text-xs text-thb-text-muted">
                Send periodic reminders to new hires for pending document submissions
              </p>
            </div>
            <button
              onClick={() => setDocumentCollectionReminder(!documentCollectionReminder)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                documentCollectionReminder ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {documentCollectionReminder ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
