'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FiSettings, FiToggleLeft, FiToggleRight, FiSave, FiRefreshCw,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/* Default settings used before API data loads */
const DEFAULTS: Record<string, any> = {
  autoPublish: true,
  requisitionApproval: true,
  resumeParsingAI: false,
  offerTemplate: 'Standard',
  backgroundCheck: true,
  probationPeriod: 90,
  noticePeriod: 30,
  referralBonus: 0,
  maxInterviewRounds: 5,
  skillAssessment: true,
  documentVerification: true,
  offerExpiry: 7,
  aiScreening: false,
  videoInterview: false,
  candidatePortal: true,
  emailNotifications: true,
  smsNotifications: false,
  hiringFreeze: false,
  piiRetention: 6,
};

export default function RecruitmentSettingsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin' || user?.role === 'admin';

  const [settings, setSettings] = useState<Record<string, any>>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/recruitment-settings', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSettings((prev) => ({ ...prev, ...data.settings }));
      } else {
        toast.error('Failed to load settings');
      }
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => fetchSettings()); }, [fetchSettings]);

  const updateSetting = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/recruitment-settings', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ settings }),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings((prev) => ({ ...prev, ...data.settings }));
        toast.success('Recruitment settings saved successfully');
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed to save settings');
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  /** Reusable toggle row */
  function ToggleRow({ label, description, settingKey, topBorder = false }: {
    label: string; description: string; settingKey: string; topBorder?: boolean;
  }) {
    const val = !!settings[settingKey];
    return (
      <div className={`flex items-center justify-between ${topBorder ? 'pt-4 border-t border-thb-border' : ''}`}>
        <div>
          <p className="text-sm font-medium text-thb-text-primary">{label}</p>
          <p className="text-xs text-thb-text-muted mt-0.5">{description}</p>
        </div>
        <button
          onClick={() => updateSetting(settingKey, !val)}
          disabled={!isAdmin}
          className="flex items-center gap-2 text-sm"
        >
          {val ? (
            <><FiToggleRight className="w-6 h-6 text-green-500" /><span className="text-green-600 font-medium">On</span></>
          ) : (
            <><FiToggleLeft className="w-6 h-6 text-slate-400" /><span className="text-slate-400 font-medium">Off</span></>
          )}
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-green-50">
            <FiSettings className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">Recruitment Settings</h1>
            <p className="text-sm text-thb-text-secondary">Loading settings...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="thb-card p-6 animate-pulse space-y-4">
              <div className="h-5 w-40 bg-slate-200 rounded" />
              <div className="h-4 w-64 bg-slate-100 rounded" />
              <div className="h-4 w-56 bg-slate-100 rounded" />
              <div className="h-4 w-48 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-green-50">
            <FiSettings className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">Recruitment Settings</h1>
            <p className="text-sm text-thb-text-secondary">Configure job posting defaults and hiring workflow</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchSettings}
            className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"
            title="Refresh"
          >
            <FiRefreshCw className="w-4 h-4" />
          </button>
          {isAdmin && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <FiSave className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Job Posting Defaults */}
        <div className="thb-card overflow-hidden">
          <div className="px-5 py-4 border-b border-thb-border bg-slate-50">
            <h3 className="font-semibold text-thb-text-primary">Job Posting Defaults</h3>
            <p className="text-xs text-thb-text-muted mt-0.5">Default settings for new job postings</p>
          </div>
          <div className="p-5 space-y-5">
            <ToggleRow
              label="Auto-publish to Job Boards"
              description="Automatically publish approved requisitions to configured job boards"
              settingKey="autoPublish"
            />
            <ToggleRow
              label="Requisition Approval"
              description="Require manager approval before job posting goes live"
              settingKey="requisitionApproval"
              topBorder
            />
            <ToggleRow
              label="Resume Parsing AI"
              description="Use AI to automatically extract and structure candidate data from resumes"
              settingKey="resumeParsingAI"
              topBorder
            />
            <ToggleRow
              label="AI Screening"
              description="Enable AI-based candidate screening and ranking"
              settingKey="aiScreening"
              topBorder
            />
            <ToggleRow
              label="Hiring Freeze"
              description="Block new job postings when hiring freeze is active"
              settingKey="hiringFreeze"
              topBorder
            />
          </div>
        </div>

        {/* Hiring Workflow */}
        <div className="thb-card overflow-hidden">
          <div className="px-5 py-4 border-b border-thb-border bg-slate-50">
            <h3 className="font-semibold text-thb-text-primary">Hiring Workflow</h3>
            <p className="text-xs text-thb-text-muted mt-0.5">Configure the hiring and onboarding workflow</p>
          </div>
          <div className="p-5 space-y-5">
            {/* Offer Letter Template */}
            <div>
              <label className="block text-sm font-medium text-thb-text-primary mb-1.5">Offer Letter Template</label>
              <select
                value={settings.offerTemplate || 'Standard'}
                onChange={(e) => updateSetting('offerTemplate', e.target.value)}
                disabled={!isAdmin}
                className="w-full px-3 py-2 border border-thb-border rounded-lg text-sm text-thb-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 disabled:opacity-60"
              >
                <option value="Standard">Standard</option>
                <option value="Senior">Senior / Executive</option>
                <option value="Contract">Contract / Freelance</option>
                <option value="Intern">Intern</option>
              </select>
              <p className="text-xs text-thb-text-muted mt-1">Default offer letter template for new hires</p>
            </div>

            <ToggleRow
              label="Background Check Required"
              description="Initiate background verification for all new hires"
              settingKey="backgroundCheck"
              topBorder
            />

            <ToggleRow
              label="Skill Assessment"
              description="Enable skill assessment tests for candidates"
              settingKey="skillAssessment"
              topBorder
            />

            <ToggleRow
              label="Document Verification"
              description="Require document verification before onboarding"
              settingKey="documentVerification"
              topBorder
            />

            {/* PII Data Retention */}
            <div className="pt-4 border-t border-thb-border">
              <label className="block text-sm font-medium text-thb-text-primary mb-1.5">PII Data Retention (Months)</label>
              <input
                type="number"
                value={settings.piiRetention ?? 6}
                onChange={(e) => updateSetting('piiRetention', Number(e.target.value))}
                min={1}
                disabled={!isAdmin}
                className="w-full max-w-[200px] px-3 py-2 border border-thb-border rounded-lg text-sm text-thb-text-primary focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 disabled:opacity-60"
              />
              <p className="text-xs text-thb-text-muted mt-1">How long to retain candidate PII data after rejection</p>
            </div>
          </div>
        </div>

        {/* Interview & Communication */}
        <div className="thb-card overflow-hidden">
          <div className="px-5 py-4 border-b border-thb-border bg-slate-50">
            <h3 className="font-semibold text-thb-text-primary">Interview & Communication</h3>
            <p className="text-xs text-thb-text-muted mt-0.5">Interview settings and notification preferences</p>
          </div>
          <div className="p-5 space-y-5">
            {/* Max Interview Rounds */}
            <div>
              <label className="block text-sm font-medium text-thb-text-primary mb-1.5">Max Interview Rounds</label>
              <input
                type="number"
                value={settings.maxInterviewRounds ?? 5}
                onChange={(e) => updateSetting('maxInterviewRounds', Number(e.target.value))}
                min={1}
                max={20}
                disabled={!isAdmin}
                className="w-full max-w-[200px] px-3 py-2 border border-thb-border rounded-lg text-sm text-thb-text-primary focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 disabled:opacity-60"
              />
              <p className="text-xs text-thb-text-muted mt-1">Maximum number of interview rounds per candidate</p>
            </div>

            <ToggleRow
              label="Video Interview"
              description="Enable video interview scheduling via integrated providers"
              settingKey="videoInterview"
              topBorder
            />

            <ToggleRow
              label="Email Notifications"
              description="Send email notifications for recruitment events"
              settingKey="emailNotifications"
              topBorder
            />

            <ToggleRow
              label="SMS Notifications"
              description="Send SMS notifications for recruitment events"
              settingKey="smsNotifications"
              topBorder
            />
          </div>
        </div>

        {/* Onboarding & Offboarding */}
        <div className="thb-card overflow-hidden">
          <div className="px-5 py-4 border-b border-thb-border bg-slate-50">
            <h3 className="font-semibold text-thb-text-primary">Onboarding & Periods</h3>
            <p className="text-xs text-thb-text-muted mt-0.5">Probation, notice period, and offer expiry settings</p>
          </div>
          <div className="p-5 space-y-5">
            {/* Probation Period */}
            <div>
              <label className="block text-sm font-medium text-thb-text-primary mb-1.5">Probation Period (Days)</label>
              <input
                type="number"
                value={settings.probationPeriod ?? 90}
                onChange={(e) => updateSetting('probationPeriod', Number(e.target.value))}
                min={0}
                disabled={!isAdmin}
                className="w-full max-w-[200px] px-3 py-2 border border-thb-border rounded-lg text-sm text-thb-text-primary focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 disabled:opacity-60"
              />
              <p className="text-xs text-thb-text-muted mt-1">Default probation period for new hires</p>
            </div>

            {/* Notice Period */}
            <div className="pt-4 border-t border-thb-border">
              <label className="block text-sm font-medium text-thb-text-primary mb-1.5">Notice Period (Days)</label>
              <input
                type="number"
                value={settings.noticePeriod ?? 30}
                onChange={(e) => updateSetting('noticePeriod', Number(e.target.value))}
                min={0}
                disabled={!isAdmin}
                className="w-full max-w-[200px] px-3 py-2 border border-thb-border rounded-lg text-sm text-thb-text-primary focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 disabled:opacity-60"
              />
              <p className="text-xs text-thb-text-muted mt-1">Standard notice period</p>
            </div>

            {/* Offer Expiry */}
            <div className="pt-4 border-t border-thb-border">
              <label className="block text-sm font-medium text-thb-text-primary mb-1.5">Offer Expiry (Days)</label>
              <input
                type="number"
                value={settings.offerExpiry ?? 7}
                onChange={(e) => updateSetting('offerExpiry', Number(e.target.value))}
                min={1}
                disabled={!isAdmin}
                className="w-full max-w-[200px] px-3 py-2 border border-thb-border rounded-lg text-sm text-thb-text-primary focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 disabled:opacity-60"
              />
              <p className="text-xs text-thb-text-muted mt-1">Number of days before an offer letter expires</p>
            </div>

            {/* Referral Bonus */}
            <div className="pt-4 border-t border-thb-border">
              <label className="block text-sm font-medium text-thb-text-primary mb-1.5">Referral Bonus</label>
              <input
                type="number"
                value={settings.referralBonus ?? 0}
                onChange={(e) => updateSetting('referralBonus', Number(e.target.value))}
                min={0}
                disabled={!isAdmin}
                className="w-full max-w-[200px] px-3 py-2 border border-thb-border rounded-lg text-sm text-thb-text-primary focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 disabled:opacity-60"
              />
              <p className="text-xs text-thb-text-muted mt-1">Default referral bonus amount for successful hires</p>
            </div>

            <ToggleRow
              label="Candidate Portal"
              description="Enable candidate self-service portal for application tracking"
              settingKey="candidatePortal"
              topBorder
            />
          </div>
        </div>
      </div>
    </div>
  );
}
