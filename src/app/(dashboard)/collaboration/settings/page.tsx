'use client';

import { useState, useEffect } from 'react';
import { FiSettings, FiRefreshCw, FiSave } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface CollaborationSettings {
  id: string;
  tenantId: string;
  encryptionEnabled: boolean;
  fileSharingLimitMB: number;
  messageRetentionDays: number;
  calendarSyncEnabled: boolean;
  calendarSyncProvider: string;
  emailIntegrationEnabled: boolean;
  emailProvider: string;
  autoDeleteMessages: boolean;
  maxCallDurationMin: number;
  allowExternalSharing: boolean;
  watermarkEnabled: boolean;
  updatedBy?: string;
}

const RETENTION_OPTIONS: { label: string; days: number }[] = [
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
  { label: '6 Months', days: 180 },
  { label: '1 Year', days: 365 },
  { label: 'Indefinite', days: 0 },
];

function daysToLabel(days: number): string {
  const match = RETENTION_OPTIONS.find((o) => o.days === days);
  return match ? match.label : `${days} Days`;
}

function labelToDays(label: string): number {
  const match = RETENTION_OPTIONS.find((o) => o.label === label);
  return match ? match.days : parseInt(label, 10) || 365;
}

export default function CollaborationSettingsPage() {
  const { user } = useAuthStore();
  const scopeQuery = useCompanyContextStore((s) => s.scopeQuery);
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Chat Settings
  const [encryption, setEncryption] = useState(true);
  const [fileSharingLimit, setFileSharingLimit] = useState('25');
  const [messageRetention, setMessageRetention] = useState('1 Year');
  const [autoDeleteMessages, setAutoDeleteMessages] = useState(false);
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [allowExternalSharing, setAllowExternalSharing] = useState(true);

  // Productivity
  const [calendarSync, setCalendarSync] = useState(true);
  const [calendarSyncProvider, setCalendarSyncProvider] = useState('google');
  const [emailIntegration, setEmailIntegration] = useState(false);
  const [emailProvider, setEmailProvider] = useState('smtp');

  // Calls
  const [maxCallDuration, setMaxCallDuration] = useState('60');

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const sq = scopeQuery();
      const res = await fetch(`/api/collaboration/settings${sq ? `?${sq}` : ''}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();
      const s: CollaborationSettings = data.settings;
      if (s) {
        setEncryption(s.encryptionEnabled);
        setFileSharingLimit(String(s.fileSharingLimitMB));
        setMessageRetention(daysToLabel(s.messageRetentionDays));
        setAutoDeleteMessages(s.autoDeleteMessages);
        setWatermarkEnabled(s.watermarkEnabled);
        setAllowExternalSharing(s.allowExternalSharing);
        setCalendarSync(s.calendarSyncEnabled);
        setCalendarSyncProvider(s.calendarSyncProvider || 'google');
        setEmailIntegration(s.emailIntegrationEnabled);
        setEmailProvider(s.emailProvider || 'smtp');
        setMaxCallDuration(String(s.maxCallDurationMin));
      }
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeQuery]);

  const handleRefresh = () => {
    fetchSettings();
    toast.success('Settings refreshed');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        encryptionEnabled: encryption,
        fileSharingLimitMB: parseInt(fileSharingLimit, 10) || 25,
        messageRetentionDays: labelToDays(messageRetention),
        calendarSyncEnabled: calendarSync,
        calendarSyncProvider,
        emailIntegrationEnabled: emailIntegration,
        emailProvider,
        autoDeleteMessages,
        maxCallDurationMin: parseInt(maxCallDuration, 10) || 60,
        allowExternalSharing,
        watermarkEnabled,
      };
      const res = await fetch('/api/collaboration/settings', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || 'Failed to save settings');
      }
      toast.success('Collaboration settings saved successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const selectClass =
    'w-full px-3 py-2 rounded-lg border border-thb-border text-sm text-thb-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400';
  const inputClass =
    'w-full px-3 py-2 rounded-lg border border-thb-border text-sm text-thb-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
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
            <h1 className="text-xl font-bold text-thb-text-primary">Collaboration Settings</h1>
            <p className="text-sm text-thb-text-secondary">
              Configure chat preferences and productivity integrations for your team
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
        {/* Chat Settings */}
        <div className="thb-card p-6 space-y-5">
          <h2 className="text-base font-semibold text-thb-text-primary">Chat Settings</h2>

          {/* Encryption */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Encryption</p>
              <p className="text-xs text-thb-text-muted">End-to-end encryption for all chat messages</p>
            </div>
            <button
              onClick={() => setEncryption(!encryption)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                encryption ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {encryption ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* File Sharing Limit */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-thb-text-secondary">File Sharing Limit (MB)</label>
            <input
              type="number"
              value={fileSharingLimit}
              onChange={(e) => setFileSharingLimit(e.target.value)}
              min="1"
              max="100"
              className={inputClass}
            />
            <p className="text-xs text-thb-text-muted">Maximum file size allowed for sharing in chat</p>
          </div>

          {/* Message Retention */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-thb-text-secondary">Message Retention</label>
            <select
              value={messageRetention}
              onChange={(e) => setMessageRetention(e.target.value)}
              className={selectClass}
            >
              {RETENTION_OPTIONS.map((o) => (
                <option key={o.label} value={o.label}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Auto Delete Messages */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Auto-Delete Expired Messages</p>
              <p className="text-xs text-thb-text-muted">Automatically delete messages past retention period</p>
            </div>
            <button
              onClick={() => setAutoDeleteMessages(!autoDeleteMessages)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                autoDeleteMessages ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {autoDeleteMessages ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Watermark */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Watermark</p>
              <p className="text-xs text-thb-text-muted">Apply user watermark to shared files</p>
            </div>
            <button
              onClick={() => setWatermarkEnabled(!watermarkEnabled)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                watermarkEnabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {watermarkEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* External Sharing */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Allow External Sharing</p>
              <p className="text-xs text-thb-text-muted">Allow sharing files and messages with external users</p>
            </div>
            <button
              onClick={() => setAllowExternalSharing(!allowExternalSharing)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                allowExternalSharing ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {allowExternalSharing ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>

        {/* Productivity */}
        <div className="thb-card p-6 space-y-5">
          <h2 className="text-base font-semibold text-thb-text-primary">Productivity</h2>

          {/* Calendar Sync */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Calendar Sync</p>
              <p className="text-xs text-thb-text-muted">
                Synchronize meetings and events with your team calendar
              </p>
            </div>
            <button
              onClick={() => setCalendarSync(!calendarSync)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                calendarSync ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {calendarSync ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Calendar Sync Provider */}
          {calendarSync && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-thb-text-secondary">Calendar Provider</label>
              <select
                value={calendarSyncProvider}
                onChange={(e) => setCalendarSyncProvider(e.target.value)}
                className={selectClass}
              >
                <option value="google">Google Calendar</option>
                <option value="outlook">Outlook Calendar</option>
                <option value="ical">iCal</option>
              </select>
            </div>
          )}

          {/* Email Integration */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Email Integration</p>
              <p className="text-xs text-thb-text-muted">
                Connect email to send and receive messages within the collaboration hub
              </p>
            </div>
            <button
              onClick={() => setEmailIntegration(!emailIntegration)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                emailIntegration ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {emailIntegration ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Email Provider */}
          {emailIntegration && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-thb-text-secondary">Email Provider</label>
              <select
                value={emailProvider}
                onChange={(e) => setEmailProvider(e.target.value)}
                className={selectClass}
              >
                <option value="smtp">SMTP</option>
                <option value="google">Google</option>
                <option value="outlook">Outlook</option>
              </select>
            </div>
          )}

          {/* Max Call Duration */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-thb-text-secondary">Max Call Duration (minutes)</label>
            <input
              type="number"
              value={maxCallDuration}
              onChange={(e) => setMaxCallDuration(e.target.value)}
              min="5"
              max="480"
              className={inputClass}
            />
            <p className="text-xs text-thb-text-muted">Maximum duration for video/audio calls</p>
          </div>
        </div>
      </div>
    </div>
  );
}
