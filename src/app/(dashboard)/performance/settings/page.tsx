'use client';

import { useState } from 'react';
import { FiSettings, FiSave, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

export default function PerformanceSettingsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin' || user?.role === 'admin';
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      toast.success('Performance settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiSettings className="w-5 h-5 text-green-500" /> Performance Settings
          </h1>
          <p className="text-sm text-thb-text-secondary mt-1">Configure appraisal cycles, rating scales, and review settings</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => toast.success('Settings refreshed')} className="p-2.5 rounded-lg border border-thb-border text-thb-text-secondary hover:bg-slate-50">
            <FiRefreshCw className="w-4 h-4" />
          </button>
          {isAdmin && (
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 text-sm font-medium">
              <FiSave className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Settings'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="thb-card p-5">
          <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Appraisal Cycle</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Review Cycle Frequency</label>
              <select className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm">
                <option>Quarterly</option>
                <option>Half-Yearly</option>
                <option>Annual</option>
              </select>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-thb-text-primary">360 Feedback</p>
                <p className="text-xs text-thb-text-muted">Enable multi-rater feedback</p>
              </div>
              <button className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Enabled</button>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-thb-text-primary">Self-assessment</p>
                <p className="text-xs text-thb-text-muted">Require self-evaluation before review</p>
              </div>
              <button className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Enabled</button>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-thb-text-primary">Goal alignment</p>
                <p className="text-xs text-thb-text-muted">Link individual goals to company OKRs</p>
              </div>
              <button className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Enabled</button>
            </div>
          </div>
        </div>

        <div className="thb-card p-5">
          <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Rating Scale</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Rating Scale Type</label>
              <select className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm">
                <option>1-5 Scale</option>
                <option>1-10 Scale</option>
                <option>Custom</option>
              </select>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-thb-text-primary">Bell curve normalization</p>
                <p className="text-xs text-thb-text-muted">Force distribution across ratings</p>
              </div>
              <button className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">Disabled</button>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-thb-text-primary">Manager override</p>
                <p className="text-xs text-thb-text-muted">Allow managers to adjust final rating</p>
              </div>
              <button className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">Disabled</button>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-thb-text-primary">Calibration sessions</p>
                <p className="text-xs text-thb-text-muted">Require calibration before final ratings</p>
              </div>
              <button className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Enabled</button>
            </div>
          </div>
        </div>
      </div>

      <div className="thb-card p-5">
        <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Review Reminders</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Start reminder</p>
              <p className="text-xs text-thb-text-muted">Notify at cycle start</p>
            </div>
            <button className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Enabled</button>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Mid-cycle nudge</p>
              <p className="text-xs text-thb-text-muted">Reminder at half-way point</p>
            </div>
            <button className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Enabled</button>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Deadline alert</p>
              <p className="text-xs text-thb-text-muted">3 days before due date</p>
            </div>
            <button className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Enabled</button>
          </div>
        </div>
      </div>
    </div>
  );
}
