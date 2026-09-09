'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  FiSettings, FiSave, FiRefreshCw, FiInfo, FiPlus, FiTrash2,
  FiToggleLeft, FiToggleRight,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface TDSSlab {
  salaryFrom: number;
  salaryTo: number | null;
  percentage: number;
}

interface SalarySettings {
  daHra: { enabled: boolean; daPercentage: number; hraPercentage: number };
  pf: { enabled: boolean; employeeShare: number; employerShare: number; wageCeiling: number };
  esi: { enabled: boolean; employeeShare: number; employerShare: number; wageCeiling: number };
  tds: { enabled: boolean; slabs: TDSSlab[] };
  professionalTax: { enabled: boolean; monthlyAmount: number };
  gratuity: { enabled: boolean; rate: number; denominator: number };
  lwf: { enabled: boolean; employeeShare: number; employerShare: number; frequency: string };
}

const defaultSettings: SalarySettings = {
  daHra: { enabled: true, daPercentage: 0, hraPercentage: 40 },
  pf: { enabled: true, employeeShare: 12, employerShare: 12, wageCeiling: 15000 },
  esi: { enabled: false, employeeShare: 0.75, employerShare: 3.25, wageCeiling: 21000 },
  tds: { enabled: true, slabs: [
    { salaryFrom: 0, salaryTo: 250000, percentage: 0 },
    { salaryFrom: 250001, salaryTo: 500000, percentage: 5 },
    { salaryFrom: 500001, salaryTo: 1000000, percentage: 20 },
    { salaryFrom: 1000001, salaryTo: null, percentage: 30 },
  ]},
  professionalTax: { enabled: true, monthlyAmount: 200 },
  gratuity: { enabled: true, rate: 4.81, denominator: 26 },
  lwf: { enabled: false, employeeShare: 0, employerShare: 0, frequency: 'HALF_YEARLY' },
};

function SettingSection({ title, icon, enabled, onToggle, children }: {
  title: string; icon: React.ReactNode; enabled: boolean; onToggle: (v: boolean) => void; children: React.ReactNode;
}) {
  return (
    <div className="thb-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-thb-border">
        <div className="flex items-center gap-3">
          {icon}
          <h3 className="text-sm font-semibold text-thb-text-primary">{title}</h3>
        </div>
        <button onClick={() => onToggle(!enabled)} className="flex items-center gap-2 text-sm">
          {enabled ? (
            <><FiToggleRight className="w-6 h-6 text-green-500" /><span className="text-green-600 font-medium">Enabled</span></>
          ) : (
            <><FiToggleLeft className="w-6 h-6 text-slate-400" /><span className="text-slate-400 font-medium">Disabled</span></>
          )}
        </button>
      </div>
      {enabled && <div className="p-5">{children}</div>}
    </div>
  );
}

export default function SalarySettingsPage() {
  const { user } = useAuthStore();
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin' || user?.role === 'admin';

  const [settings, setSettings] = useState<SalarySettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/payroll/salary-settings?${scopeQuery}` , { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.data) setSettings(data.data);
      }
    } catch {
      toast.error('Failed to load salary settings');
    } finally {
      setLoading(false);
    }
  }, []);
  const cid = effectiveCompanyId();
  const scopeQuery = cid ? `companyId=${cid}&` : '';


  useEffect(() => { queueMicrotask(() => fetchSettings()); }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/payroll/salary-settings?${scopeQuery}` , {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        toast.success('Salary settings saved successfully');
      } else {
        toast.error('Failed to save settings');
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (section: keyof SalarySettings, field: string, value: unknown) => {
    setSettings(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="thb-card p-6 animate-pulse"><div className="h-40 bg-slate-200 rounded" /></div>
        <div className="thb-card p-6 animate-pulse"><div className="h-40 bg-slate-200 rounded" /></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiSettings className="w-6 h-6 text-green-500" />
            Salary Settings
          </h1>
          <p className="text-thb-text-secondary mt-1">Configure salary components, statutory deductions, and tax settings</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchSettings} className="p-2.5 rounded-lg border border-thb-border text-thb-text-secondary hover:bg-slate-50">
            <FiRefreshCw className="w-4 h-4" />
          </button>
          {isAdmin && (
            <button onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium text-sm">
              <FiSave className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Settings'}
            </button>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="thb-card border-l-4 border-l-green-500 bg-gradient-to-r from-green-50/50 to-white p-4">
        <div className="flex items-start gap-3">
          <FiInfo className="w-5 h-5 text-green-500 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-700">Configure salary component settings</p>
            <p className="text-xs text-green-600 mt-1">
              These settings control how salary components are calculated in the payroll system.
              Toggle each section on/off and adjust the percentages as needed. Changes will apply to new payroll runs.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DA and HRA */}
        <SettingSection
          title="DA and HRA"
          icon={<div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center"><span className="text-sm font-bold text-green-600">DH</span></div>}
          enabled={settings.daHra.enabled}
          onToggle={v => updateSetting('daHra', 'enabled', v)}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">DA (%)</label>
              <input type="number" step="0.01" value={settings.daHra.daPercentage}
                onChange={e => updateSetting('daHra', 'daPercentage', Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm" />
              <p className="text-[10px] text-thb-text-muted mt-1">Dearness Allowance as % of Basic</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">HRA (%)</label>
              <input type="number" step="0.01" value={settings.daHra.hraPercentage}
                onChange={e => updateSetting('daHra', 'hraPercentage', Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm" />
              <p className="text-[10px] text-thb-text-muted mt-1">House Rent Allowance as % of Basic (40% Non-Metro, 50% Metro)</p>
            </div>
          </div>
        </SettingSection>

        {/* Provident Fund */}
        <SettingSection
          title="Provident Fund Settings"
          icon={<div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center"><span className="text-sm font-bold text-emerald-600">PF</span></div>}
          enabled={settings.pf.enabled}
          onToggle={v => updateSetting('pf', 'enabled', v)}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Employee Share (%)</label>
              <input type="number" step="0.01" value={settings.pf.employeeShare}
                onChange={e => updateSetting('pf', 'employeeShare', Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Organization Share (%)</label>
              <input type="number" step="0.01" value={settings.pf.employerShare}
                onChange={e => updateSetting('pf', 'employerShare', Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Wage Ceiling (₹/month)</label>
              <input type="number" value={settings.pf.wageCeiling}
                onChange={e => updateSetting('pf', 'wageCeiling', Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm" />
              <p className="text-[10px] text-thb-text-muted mt-1">Max basic pay subject to PF (currently ₹15,000)</p>
            </div>
          </div>
        </SettingSection>

        {/* ESI Settings */}
        <SettingSection
          title="ESI Settings"
          icon={<div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center"><span className="text-sm font-bold text-amber-600">ESI</span></div>}
          enabled={settings.esi.enabled}
          onToggle={v => updateSetting('esi', 'enabled', v)}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Employee Share (%)</label>
              <input type="number" step="0.01" value={settings.esi.employeeShare}
                onChange={e => updateSetting('esi', 'employeeShare', Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Organization Share (%)</label>
              <input type="number" step="0.01" value={settings.esi.employerShare}
                onChange={e => updateSetting('esi', 'employerShare', Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Wage Ceiling (₹/month)</label>
              <input type="number" value={settings.esi.wageCeiling}
                onChange={e => updateSetting('esi', 'wageCeiling', Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm" />
              <p className="text-[10px] text-thb-text-muted mt-1">ESI applicable for gross salary up to ₹21,000/month</p>
            </div>
          </div>
        </SettingSection>

        {/* Professional Tax */}
        <SettingSection
          title="Professional Tax"
          icon={<div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center"><span className="text-sm font-bold text-teal-600">PT</span></div>}
          enabled={settings.professionalTax.enabled}
          onToggle={v => updateSetting('professionalTax', 'enabled', v)}
        >
          <div>
            <label className="block text-xs font-medium text-thb-text-secondary mb-1">Monthly Amount (₹)</label>
            <input type="number" value={settings.professionalTax.monthlyAmount}
              onChange={e => updateSetting('professionalTax', 'monthlyAmount', Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm" />
            <p className="text-[10px] text-thb-text-muted mt-1">Standard monthly PT deduction (varies by state, typically ₹200)</p>
          </div>
        </SettingSection>

        {/* Gratuity */}
        <SettingSection
          title="Gratuity"
          icon={<div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center"><span className="text-sm font-bold text-teal-600">GT</span></div>}
          enabled={settings.gratuity.enabled}
          onToggle={v => updateSetting('gratuity', 'enabled', v)}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Rate (% of Basic)</label>
              <input type="number" step="0.01" value={settings.gratuity.rate}
                onChange={e => updateSetting('gratuity', 'rate', Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm" />
              <p className="text-[10px] text-thb-text-muted mt-1">Standard ~4.81% of basic salary</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Denominator (working days)</label>
              <select value={settings.gratuity.denominator}
                onChange={e => updateSetting('gratuity', 'denominator', Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm">
                <option value={26}>26 (Covered under Act)</option>
                <option value={30}>30 (Not covered under Act)</option>
              </select>
            </div>
          </div>
        </SettingSection>

        {/* LWF */}
        <SettingSection
          title="Labour Welfare Fund (LWF)"
          icon={<div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center"><span className="text-sm font-bold text-rose-600">LW</span></div>}
          enabled={settings.lwf.enabled}
          onToggle={v => updateSetting('lwf', 'enabled', v)}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Employee Share (₹)</label>
              <input type="number" step="0.01" value={settings.lwf.employeeShare}
                onChange={e => updateSetting('lwf', 'employeeShare', Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Organization Share (₹)</label>
              <input type="number" step="0.01" value={settings.lwf.employerShare}
                onChange={e => updateSetting('lwf', 'employerShare', Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Frequency</label>
              <select value={settings.lwf.frequency}
                onChange={e => updateSetting('lwf', 'frequency', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm">
                <option value="MONTHLY">Monthly</option>
                <option value="HALF_YEARLY">Half-Yearly</option>
                <option value="ANNUAL">Annual</option>
              </select>
            </div>
          </div>
        </SettingSection>
      </div>

      {/* TDS Section - Full Width */}
      <SettingSection
        title="TDS (Tax Deducted at Source)"
        icon={<div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center"><span className="text-sm font-bold text-red-600">TD</span></div>}
        enabled={settings.tds.enabled}
        onToggle={v => updateSetting('tds', 'enabled', v)}
      >
        <p className="text-xs text-thb-text-secondary mb-3">Configure TDS slabs for annual salary calculation</p>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-thb-border">
                <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary">Salary From (₹)</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary">Salary To (₹)</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary">Tax Rate (%)</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-thb-text-secondary w-16">Action</th>
              </tr>
            </thead>
            <tbody>
              {settings.tds.slabs.map((slab, i) => (
                <tr key={i} className="border-b border-thb-border/50">
                  <td className="px-3 py-2">
                    <input type="number" value={slab.salaryFrom}
                      onChange={e => {
                        const newSlabs = [...settings.tds.slabs];
                        newSlabs[i] = { ...newSlabs[i], salaryFrom: Number(e.target.value) };
                        updateSetting('tds', 'slabs', newSlabs);
                      }}
                      className="w-full px-2 py-1.5 rounded border border-thb-border text-sm" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={slab.salaryTo || ''}
                      onChange={e => {
                        const newSlabs = [...settings.tds.slabs];
                        newSlabs[i] = { ...newSlabs[i], salaryTo: e.target.value ? Number(e.target.value) : null };
                        updateSetting('tds', 'slabs', newSlabs);
                      }}
                      placeholder="No limit"
                      className="w-full px-2 py-1.5 rounded border border-thb-border text-sm" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" step="0.01" value={slab.percentage}
                      onChange={e => {
                        const newSlabs = [...settings.tds.slabs];
                        newSlabs[i] = { ...newSlabs[i], percentage: Number(e.target.value) };
                        updateSetting('tds', 'slabs', newSlabs);
                      }}
                      className="w-full px-2 py-1.5 rounded border border-thb-border text-sm" />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => {
                      const newSlabs = settings.tds.slabs.filter((_, j) => j !== i);
                      updateSetting('tds', 'slabs', newSlabs);
                    }} className="p-1.5 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50">
                      <FiTrash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={() => {
          const lastSlab = settings.tds.slabs[settings.tds.slabs.length - 1];
          const newSlabs = [...settings.tds.slabs, { salaryFrom: (lastSlab?.salaryTo || 0) + 1, salaryTo: null, percentage: 0 }];
          updateSetting('tds', 'slabs', newSlabs);
        }} className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-green-600 hover:bg-green-50 border border-green-200">
          <FiPlus className="w-3.5 h-3.5" /> Add Slab
        </button>
      </SettingSection>
    </div>
  );
}
