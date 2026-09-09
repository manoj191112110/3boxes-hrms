'use client';

import { useState, useEffect } from 'react';
import { FiSettings, FiRefreshCw, FiSave, FiAlertCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Settings {
  autoAssign: boolean;
  priorityEscalation: boolean;
  aiCategorization: boolean;
  slaCritical: string;
  slaHigh: string;
  slaNormal: string;
  slaLow: string;
  emailNotifications: boolean;
  autoCloseResolved: boolean;
  autoCloseDays: number;
}

const DEFAULTS: Settings = {
  autoAssign: true,
  priorityEscalation: true,
  aiCategorization: true,
  slaCritical: '30',
  slaHigh: '2',
  slaNormal: '8',
  slaLow: '24',
  emailNotifications: true,
  autoCloseResolved: true,
  autoCloseDays: 7,
};

export default function SupportSettingsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'tenant_admin';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/support-settings', { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to load settings');
      setSettings(d.settings);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load support settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleRefresh = () => {
    fetchSettings();
    toast.success('Settings refreshed');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await fetch('/api/support-settings', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(settings),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to save');
      setSettings(d.settings);
      toast.success('Support settings saved successfully');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 rounded-lg border border-thb-border text-sm text-thb-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400';

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-green-50 text-green-600">
              <FiSettings className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-thb-text-primary">Support Settings</h1>
              <p className="text-sm text-thb-text-secondary">Configure ticket routing rules and SLA response times for the helpdesk</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <div key={i} className="thb-card p-6 space-y-4 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-40" />
              <div className="h-10 bg-slate-100 rounded" />
              <div className="h-10 bg-slate-100 rounded" />
              <div className="h-10 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-green-50 text-green-600">
            <FiSettings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">Support Settings</h1>
            <p className="text-sm text-thb-text-secondary">
              Configure ticket routing rules and SLA response times for the helpdesk
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
        {/* Ticket Routing */}
        <div className="thb-card p-6 space-y-5">
          <h2 className="text-base font-semibold text-thb-text-primary">Ticket Routing</h2>

          {/* Auto-assign */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Auto-assign</p>
              <p className="text-xs text-thb-text-muted">
                Automatically route new tickets to available agents based on workload
              </p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, autoAssign: !settings.autoAssign })}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                settings.autoAssign ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {settings.autoAssign ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Priority Escalation */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Priority Escalation</p>
              <p className="text-xs text-thb-text-muted">
                Escalate unresolved high-priority tickets automatically after SLA breach
              </p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, priorityEscalation: !settings.priorityEscalation })}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                settings.priorityEscalation ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {settings.priorityEscalation ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* AI Categorization */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">AI Categorization</p>
              <p className="text-xs text-thb-text-muted">
                Use AI to auto-categorize and tag incoming support tickets
              </p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, aiCategorization: !settings.aiCategorization })}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                settings.aiCategorization ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {settings.aiCategorization ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Email Notifications */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Email Notifications</p>
              <p className="text-xs text-thb-text-muted">
                Send email notifications on ticket updates and SLA warnings
              </p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, emailNotifications: !settings.emailNotifications })}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                settings.emailNotifications ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {settings.emailNotifications ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>

        {/* SLA Configuration */}
        <div className="thb-card p-6 space-y-5">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-thb-text-primary">SLA Configuration</h2>
            <FiAlertCircle className="w-4 h-4 text-thb-text-muted" />
          </div>

          {/* Critical */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">Critical</span>
              <span className="text-sm text-thb-text-secondary">First response time</span>
            </div>
            <div className="flex items-center gap-1 w-28">
              <input
                type="number"
                value={settings.slaCritical}
                onChange={(e) => setSettings({ ...settings, slaCritical: e.target.value })}
                min="5"
                className={inputClass}
              />
              <span className="text-xs text-thb-text-muted whitespace-nowrap">min</span>
            </div>
          </div>

          {/* High */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-700">High</span>
              <span className="text-sm text-thb-text-secondary">First response time</span>
            </div>
            <div className="flex items-center gap-1 w-28">
              <input
                type="number"
                value={settings.slaHigh}
                onChange={(e) => setSettings({ ...settings, slaHigh: e.target.value })}
                min="1"
                className={inputClass}
              />
              <span className="text-xs text-thb-text-muted whitespace-nowrap">hrs</span>
            </div>
          </div>

          {/* Normal */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700">Normal</span>
              <span className="text-sm text-thb-text-secondary">First response time</span>
            </div>
            <div className="flex items-center gap-1 w-28">
              <input
                type="number"
                value={settings.slaNormal}
                onChange={(e) => setSettings({ ...settings, slaNormal: e.target.value })}
                min="1"
                className={inputClass}
              />
              <span className="text-xs text-thb-text-muted whitespace-nowrap">hrs</span>
            </div>
          </div>

          {/* Low */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-600">Low</span>
              <span className="text-sm text-thb-text-secondary">First response time</span>
            </div>
            <div className="flex items-center gap-1 w-28">
              <input
                type="number"
                value={settings.slaLow}
                onChange={(e) => setSettings({ ...settings, slaLow: e.target.value })}
                min="1"
                className={inputClass}
              />
              <span className="text-xs text-thb-text-muted whitespace-nowrap">hrs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-close Settings */}
      <div className="thb-card p-6 space-y-5">
        <h2 className="text-base font-semibold text-thb-text-primary">Auto-close Settings</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 rounded-lg border border-thb-border">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Auto-close Resolved</p>
              <p className="text-xs text-thb-text-muted">Automatically close resolved tickets after a period</p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, autoCloseResolved: !settings.autoCloseResolved })}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                settings.autoCloseResolved ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {settings.autoCloseResolved ? 'Enabled' : 'Disabled'}
            </button>
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg border border-thb-border">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Auto-close After</p>
              <p className="text-xs text-thb-text-muted">Days before auto-closing resolved tickets</p>
            </div>
            <div className="flex items-center gap-1 w-28">
              <input
                type="number"
                value={settings.autoCloseDays}
                onChange={(e) => setSettings({ ...settings, autoCloseDays: parseInt(e.target.value) || 7 })}
                min="1"
                max="30"
                className={inputClass}
              />
              <span className="text-xs text-thb-text-muted whitespace-nowrap">days</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
