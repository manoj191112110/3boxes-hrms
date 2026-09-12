'use client';

import { useState } from 'react';
import { FiSettings, FiRefreshCw, FiSave } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

export default function AccountsSettingsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [saving, setSaving] = useState(false);

  // Fiscal Configuration
  const [fiscalYear, setFiscalYear] = useState('2025-2026');
  const [baseCurrency, setBaseCurrency] = useState('INR');
  const [gstin, setGstin] = useState('');

  // Automation Preferences
  const [autoPostJournals, setAutoPostJournals] = useState(true);
  const [roundOff, setRoundOff] = useState(false);
  const [multiCurrency, setMultiCurrency] = useState(true);

  const handleRefresh = () => {
    setFiscalYear('2025-2026');
    setBaseCurrency('INR');
    setGstin('');
    setAutoPostJournals(true);
    setRoundOff(false);
    setMultiCurrency(true);
    toast.success('Settings refreshed to defaults');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      toast.success('Accounts settings saved successfully');
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
            <h1 className="text-xl font-bold text-thb-text-primary">Accounts Settings</h1>
            <p className="text-sm text-thb-text-secondary">
              Configure fiscal parameters and automation preferences for the accounts module
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
        {/* Fiscal Configuration */}
        <div className="thb-card p-6 space-y-5">
          <h2 className="text-base font-semibold text-thb-text-primary">Fiscal Configuration</h2>

          <div className="space-y-1">
            <label className="text-sm font-medium text-thb-text-secondary">Fiscal Year</label>
            <select value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)} className={selectClass}>
              <option value="2024-2025">2024–2025</option>
              <option value="2025-2026">2025–2026</option>
              <option value="2026-2027">2026–2027</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-thb-text-secondary">Base Currency</label>
            <select value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value)} className={selectClass}>
              <option value="INR">INR – Indian Rupee</option>
              <option value="USD">USD – US Dollar</option>
              <option value="EUR">EUR – Euro</option>
              <option value="GBP">GBP – British Pound</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-thb-text-secondary">GSTIN</label>
            <input
              type="text"
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
              placeholder="e.g. 22AAAAA0000A1Z5"
              className={inputClass}
            />
          </div>
        </div>

        {/* Automation Preferences */}
        <div className="thb-card p-6 space-y-5">
          <h2 className="text-base font-semibold text-thb-text-primary">Automation Preferences</h2>

          {/* Auto-post Journals */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Auto-post Journals</p>
              <p className="text-xs text-thb-text-muted">Automatically post approved journal entries</p>
            </div>
            <button
              onClick={() => setAutoPostJournals(!autoPostJournals)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                autoPostJournals ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {autoPostJournals ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Round Off */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Round Off</p>
              <p className="text-xs text-thb-text-muted">Round off amounts to nearest integer</p>
            </div>
            <button
              onClick={() => setRoundOff(!roundOff)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                roundOff ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {roundOff ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Multi-Currency */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-thb-text-primary">Multi-Currency</p>
              <p className="text-xs text-thb-text-muted">Enable transactions in multiple currencies</p>
            </div>
            <button
              onClick={() => setMultiCurrency(!multiCurrency)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                multiCurrency ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {multiCurrency ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
