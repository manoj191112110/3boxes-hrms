'use client';

import { useState, useEffect } from 'react';
import {
  FiSettings, FiMail, FiFileText, FiGift, FiCheckCircle, FiCircle,
  FiSave, FiRefreshCw, FiUsers, FiSend, FiShield, FiMonitor,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface CommItem {
  label: string;
  description: string;
  enabled: boolean;
}

interface DocItem {
  label: string;
  requirement: string;
}

interface Settings {
  communicationItems: CommItem[];
  documentChecklist: DocItem[];
  autoAssignBuddy: boolean;
  sendWelcomeEmail: boolean;
  autoCreateAccounts: boolean;
  bgvOnAccept: boolean;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  'Offer Letter Email': FiMail,
  'Document Collection Portal': FiFileText,
  'Welcome Kit': FiGift,
};

export default function PreboardingSettingsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'tenant_admin';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/preboarding-settings', { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to load settings');
      setSettings(d.settings);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load preboarding settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const toggleComm = (idx: number) => {
    if (!settings) return;
    const updated = settings.communicationItems.map((item, i) =>
      i === idx ? { ...item, enabled: !item.enabled } : item
    );
    setSettings({ ...settings, communicationItems: updated });
  };

  const toggleDocRequirement = (idx: number) => {
    if (!settings) return;
    const updated = settings.documentChecklist.map((item, i) =>
      i === idx ? { ...item, requirement: item.requirement === 'Required' ? 'Optional' : 'Required' } : item
    );
    setSettings({ ...settings, documentChecklist: updated });
  };

  const toggleSetting = (key: keyof Settings) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: !settings[key] });
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const r = await fetch('/api/preboarding-settings', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(settings),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to save');
      setSettings(d.settings);
      toast.success('Preboarding settings saved successfully');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = () => { fetchSettings(); toast.success('Settings refreshed'); };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-green-50">
            <FiSettings className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">Preboarding Settings</h1>
            <p className="text-sm text-thb-text-secondary">Configure pre-joining communication and document requirements</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <div key={i} className="thb-card p-6 space-y-4 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-40" />
              <div className="h-12 bg-slate-100 rounded" />
              <div className="h-12 bg-slate-100 rounded" />
              <div className="h-12 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-green-50">
            <FiSettings className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">Preboarding Settings</h1>
            <p className="text-sm text-thb-text-secondary">Configure pre-joining communication and document requirements</p>
          </div>
        </div>
        <div className="thb-card p-8 text-center">
          <FiSettings className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <p className="text-sm text-thb-text-muted">Unable to load settings. Please try refreshing.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-green-50">
            <FiSettings className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">Preboarding Settings</h1>
            <p className="text-sm text-thb-text-secondary">Configure pre-joining communication and document requirements</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pre-joining Communication */}
        <div className="thb-card overflow-hidden">
          <div className="px-5 py-4 border-b border-thb-border bg-slate-50">
            <h3 className="font-semibold text-thb-text-primary">Pre-joining Communication</h3>
            <p className="text-xs text-thb-text-muted mt-0.5">Configure automated touchpoints with new hires</p>
          </div>
          <div className="divide-y divide-thb-border">
            {settings.communicationItems.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <FiMail className="w-8 h-8 text-thb-text-muted mx-auto mb-2" />
                <p className="text-sm text-thb-text-muted">No communication items configured</p>
              </div>
            ) : (
              settings.communicationItems.map((item, idx) => {
                const Icon = ICON_MAP[item.label] || FiMail;
                return (
                  <div key={item.label} className="flex items-center gap-4 px-5 py-4">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${item.enabled ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-thb-text-primary">{item.label}</p>
                      <p className="text-xs text-thb-text-muted mt-0.5">{item.description}</p>
                    </div>
                    <button
                      onClick={() => toggleComm(idx)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${item.enabled ? 'bg-green-500' : 'bg-slate-200'}`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${item.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Document Checklist */}
        <div className="thb-card overflow-hidden">
          <div className="px-5 py-4 border-b border-thb-border bg-slate-50">
            <h3 className="font-semibold text-thb-text-primary">Document Checklist</h3>
            <p className="text-xs text-thb-text-muted mt-0.5">Required documents from pre-joiners before day one</p>
          </div>
          <div className="divide-y divide-thb-border">
            {settings.documentChecklist.length === 0 ? (
                <div className="px-5 py-6 text-center">
                  <FiFileText className="w-8 h-8 text-thb-text-muted mx-auto mb-2" />
                  <p className="text-sm text-thb-text-muted">No document checklist items configured</p>
                </div>
            ) : (
              settings.documentChecklist.map((doc, idx) => {
                const Icon = doc.requirement === 'Required' ? FiCheckCircle : FiCircle;
                const isRequired = doc.requirement === 'Required';
                return (
                  <div key={doc.label} className="flex items-center gap-4 px-5 py-4">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isRequired ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-thb-text-primary">{doc.label}</p>
                    </div>
                    <button
                      onClick={() => toggleDocRequirement(idx)}
                      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${isRequired ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      {doc.requirement}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Additional Settings */}
      <div className="thb-card p-6 space-y-5">
        <h2 className="text-base font-semibold text-thb-text-primary">Additional Settings</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Auto-assign Buddy */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-thb-border">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${settings.autoAssignBuddy ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                <FiUsers className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-sm font-medium text-thb-text-primary">Auto-assign Buddy</p>
                <p className="text-xs text-thb-text-muted">Assign an onboarding buddy automatically</p>
              </div>
            </div>
            <button
              onClick={() => toggleSetting('autoAssignBuddy')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.autoAssignBuddy ? 'bg-green-500' : 'bg-slate-200'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${settings.autoAssignBuddy ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Send Welcome Email */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-thb-border">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${settings.sendWelcomeEmail ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                <FiSend className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-sm font-medium text-thb-text-primary">Send Welcome Email</p>
                <p className="text-xs text-thb-text-muted">Send welcome email on offer acceptance</p>
              </div>
            </div>
            <button
              onClick={() => toggleSetting('sendWelcomeEmail')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.sendWelcomeEmail ? 'bg-green-500' : 'bg-slate-200'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${settings.sendWelcomeEmail ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Auto-create Accounts */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-thb-border">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${settings.autoCreateAccounts ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                <FiMonitor className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-sm font-medium text-thb-text-primary">Auto-create Accounts</p>
                <p className="text-xs text-thb-text-muted">Provision IT accounts before day one</p>
              </div>
            </div>
            <button
              onClick={() => toggleSetting('autoCreateAccounts')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.autoCreateAccounts ? 'bg-green-500' : 'bg-slate-200'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${settings.autoCreateAccounts ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* BGV on Accept */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-thb-border">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${settings.bgvOnAccept ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                <FiShield className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-sm font-medium text-thb-text-primary">BGV on Accept</p>
                <p className="text-xs text-thb-text-muted">Start background verification on offer acceptance</p>
              </div>
            </div>
            <button
              onClick={() => toggleSetting('bgvOnAccept')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.bgvOnAccept ? 'bg-green-500' : 'bg-slate-200'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${settings.bgvOnAccept ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
