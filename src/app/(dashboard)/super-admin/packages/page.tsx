'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FiPackage, FiPlus, FiEdit2, FiX, FiCheck, FiGrid,
  FiList, FiStar, FiUsers, FiHardDrive, FiRefreshCw, FiTrash2,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { isClientLiveMode } from '@/lib/site-mode';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// ─── Interface matching SubscriptionPlan Prisma model ──────
interface Package {
  id: string;
  name: string;
  planType: string;
  monthlyPrice: number;
  annualPrice: number;
  employeeLimit: number;
  companyLimit: number;
  branchLimit: number;
  storageLimit: number;
  aiInterviewLimit: number;
  aiChatbotLimit: number;
  payrollEnabled: boolean;
  recruitmentEnabled: boolean;
  attendanceEnabled: boolean;
  projectEnabled: boolean;
  clientPortalEnabled: boolean;
  vendorPortalEnabled: boolean;
  mobileAppEnabled: boolean;
  apiAccessEnabled: boolean;
  whiteLabelEnabled: boolean;
  supportLevel: string;
  status: string;
  description: string | null;
  _count?: { subscriptions: number };
}

const pkgGradients: Record<string, string> = {
  Free: 'from-slate-500 to-slate-600',
  Starter: 'from-emerald-500 to-emerald-600',
  starter: 'from-emerald-500 to-emerald-600',
  Professional: 'from-green-500 to-green-600',
  professional: 'from-green-500 to-green-600',
  Enterprise: 'from-teal-500 to-teal-600',
  enterprise: 'from-teal-500 to-teal-600',
  staffing: 'from-amber-500 to-amber-600',
  white_label: 'from-rose-500 to-rose-600',
};

export default function PackagesPage() {
  const { user } = useAuthStore();
  const isLive = isClientLiveMode();
  const currencySymbol = isLive ? '₹' : '$';

  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', planType: 'starter', monthlyPrice: 0, annualPrice: 0,
    employeeLimit: 50, companyLimit: 1, branchLimit: 5, storageLimit: 1000,
    aiInterviewLimit: 10, aiChatbotLimit: 100,
    payrollEnabled: true, recruitmentEnabled: true, attendanceEnabled: true,
    projectEnabled: false, clientPortalEnabled: false, vendorPortalEnabled: false,
    mobileAppEnabled: false, apiAccessEnabled: false, whiteLabelEnabled: false,
    supportLevel: 'email', status: 'active' as string, description: '',
  });

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/subscriptions/plans', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setPackages(data.plans || []);
      } else {
        toast.error('Failed to load packages');
      }
    } catch (err) {
      console.error('Failed to fetch packages:', err);
      toast.error('Failed to load packages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPackages(); }, [fetchPackages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.planType) { toast.error('Package name and type are required'); return; }
    try {
      const headers = getAuthHeaders();
      if (editingId) {
        const res = await fetch(`/api/subscriptions/plans/${editingId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(form),
        });
        if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Update failed'); return; }
        toast.success('Package updated');
      } else {
        const res = await fetch('/api/subscriptions/plans', {
          method: 'POST',
          headers,
          body: JSON.stringify(form),
        });
        if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Create failed'); return; }
        toast.success('Package created');
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ name: '', planType: 'starter', monthlyPrice: 0, annualPrice: 0, employeeLimit: 50, companyLimit: 1, branchLimit: 5, storageLimit: 1000, aiInterviewLimit: 10, aiChatbotLimit: 100, payrollEnabled: true, recruitmentEnabled: true, attendanceEnabled: true, projectEnabled: false, clientPortalEnabled: false, vendorPortalEnabled: false, mobileAppEnabled: false, apiAccessEnabled: false, whiteLabelEnabled: false, supportLevel: 'email', status: 'active', description: '' });
      fetchPackages();
    } catch (err) {
      toast.error('Operation failed');
    }
  };

  const handleEdit = (pkg: Package) => {
    setEditingId(pkg.id);
    setForm({
      name: pkg.name, planType: pkg.planType, monthlyPrice: pkg.monthlyPrice, annualPrice: pkg.annualPrice,
      employeeLimit: pkg.employeeLimit, companyLimit: pkg.companyLimit, branchLimit: pkg.branchLimit,
      storageLimit: pkg.storageLimit, aiInterviewLimit: pkg.aiInterviewLimit, aiChatbotLimit: pkg.aiChatbotLimit,
      payrollEnabled: pkg.payrollEnabled, recruitmentEnabled: pkg.recruitmentEnabled, attendanceEnabled: pkg.attendanceEnabled,
      projectEnabled: pkg.projectEnabled, clientPortalEnabled: pkg.clientPortalEnabled, vendorPortalEnabled: pkg.vendorPortalEnabled,
      mobileAppEnabled: pkg.mobileAppEnabled, apiAccessEnabled: pkg.apiAccessEnabled, whiteLabelEnabled: pkg.whiteLabelEnabled,
      supportLevel: pkg.supportLevel, status: pkg.status, description: pkg.description || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this package? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/subscriptions/plans/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Delete failed'); return; }
      toast.success('Package deleted');
      fetchPackages();
    } catch { toast.error('Delete failed'); }
  };

  const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400';
  const cbCls = 'rounded border-slate-300 text-green-600 focus:ring-green-500';

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="thb-card p-6 bg-gradient-to-r from-teal-600 via-teal-500 to-pink-500 border-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3"><FiPackage className="w-7 h-7" /> Package Management</h1>
            <p className="text-teal-100 mt-1 text-sm">
              {isLive ? 'Live subscription packages (INR pricing)' : 'Define and manage subscription packages for your platform'}
            </p>
          </div>
          <div className="flex gap-2">
            <div className="flex bg-white/20 backdrop-blur rounded-lg p-0.5">
              <button onClick={() => setViewMode('cards')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'cards' ? 'bg-white text-teal-700' : 'text-white hover:bg-white/10'}`}><FiGrid className="w-4 h-4" /></button>
              <button onClick={() => setViewMode('table')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'table' ? 'bg-white text-teal-700' : 'text-white hover:bg-white/10'}`}><FiList className="w-4 h-4" /></button>
            </div>
            <button onClick={fetchPackages} disabled={loading} className="inline-flex items-center gap-2 px-3 py-2.5 bg-white/20 backdrop-blur text-white rounded-lg font-medium text-sm hover:bg-white/30 transition-colors disabled:opacity-50">
              <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: '', planType: 'starter', monthlyPrice: 0, annualPrice: 0, employeeLimit: 50, companyLimit: 1, branchLimit: 5, storageLimit: 1000, aiInterviewLimit: 10, aiChatbotLimit: 100, payrollEnabled: true, recruitmentEnabled: true, attendanceEnabled: true, projectEnabled: false, clientPortalEnabled: false, vendorPortalEnabled: false, mobileAppEnabled: false, apiAccessEnabled: false, whiteLabelEnabled: false, supportLevel: 'email', status: 'active', description: '' }); }} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/20 backdrop-blur text-white rounded-lg font-medium text-sm hover:bg-white/30 transition-colors">
              <FiPlus className="w-4 h-4" /> Add Package
            </button>
          </div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="thb-card border-l-4 border-l-teal-500 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-thb-text-primary">{editingId ? 'Edit Package' : 'Add Package'}</h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="p-1.5 text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 rounded-lg"><FiX className="w-4 h-4" /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Package Name</label><input className={inputCls} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Professional" /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Plan Type</label><select className={inputCls} value={form.planType} onChange={(e) => setForm((p) => ({ ...p, planType: e.target.value }))}><option value="starter">Starter</option><option value="professional">Professional</option><option value="enterprise">Enterprise</option><option value="global_enterprise">Global Enterprise</option><option value="staffing">Staffing</option><option value="white_label">White Label</option></select></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Monthly Price ({currencySymbol})</label><input type="number" className={inputCls} value={form.monthlyPrice} onChange={(e) => setForm((p) => ({ ...p, monthlyPrice: Number(e.target.value) }))} /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Annual Price ({currencySymbol})</label><input type="number" className={inputCls} value={form.annualPrice} onChange={(e) => setForm((p) => ({ ...p, annualPrice: Number(e.target.value) }))} /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Employee Limit</label><input type="number" className={inputCls} value={form.employeeLimit} onChange={(e) => setForm((p) => ({ ...p, employeeLimit: Number(e.target.value) }))} /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Company Limit</label><input type="number" className={inputCls} value={form.companyLimit} onChange={(e) => setForm((p) => ({ ...p, companyLimit: Number(e.target.value) }))} /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Branch Limit</label><input type="number" className={inputCls} value={form.branchLimit} onChange={(e) => setForm((p) => ({ ...p, branchLimit: Number(e.target.value) }))} /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Storage Limit (MB)</label><input type="number" className={inputCls} value={form.storageLimit} onChange={(e) => setForm((p) => ({ ...p, storageLimit: Number(e.target.value) }))} /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Support Level</label><select className={inputCls} value={form.supportLevel} onChange={(e) => setForm((p) => ({ ...p, supportLevel: e.target.value }))}><option value="email">Email</option><option value="priority">Priority</option><option value="dedicated">Dedicated</option></select></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Status</label><select className={inputCls} value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}><option value="active">Active</option><option value="archived">Archived</option></select></div>
            <div className="sm:col-span-2 lg:col-span-3"><label className="block text-xs font-medium text-thb-text-secondary mb-1">Description</label><input className={inputCls} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
            <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['payrollEnabled','recruitmentEnabled','attendanceEnabled','projectEnabled','clientPortalEnabled','vendorPortalEnabled','mobileAppEnabled','apiAccessEnabled','whiteLabelEnabled'] as const).map((key) => (
                <label key={key} className="flex items-center gap-1.5 text-xs text-thb-text-secondary">
                  <input type="checkbox" checked={form[key] as boolean} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.checked }))} className={cbCls} />
                  {key.replace('Enabled','')}
                </label>
              ))}
            </div>
            <div className="flex items-end gap-2"><button type="submit" className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg font-medium text-sm hover:bg-green-600 transition-colors"><FiCheck className="w-4 h-4" />{editingId ? 'Update' : 'Create'}</button></div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="thb-card p-8 text-center text-thb-text-muted">
          <FiRefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
          <p className="text-sm">Loading packages...</p>
        </div>
      ) : packages.length === 0 ? (
        <div className="thb-card p-8 text-center text-thb-text-muted">
          <FiPackage className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">No packages found. Create one to get started.</p>
        </div>
      ) : viewMode === 'cards' ? (
        /* Cards View */
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          {packages.map((pkg) => (
            <div key={pkg.id} className={`thb-card overflow-hidden ${pkg.status === 'archived' ? 'opacity-60' : ''}`}>
              <div className={`bg-gradient-to-r ${pkgGradients[pkg.name] || pkgGradients[pkg.planType] || 'from-slate-500 to-slate-600'} p-4 text-white`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">{pkg.name}</h3>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/20 uppercase font-semibold">{pkg.planType}</span>
                </div>
                <p className="text-2xl font-bold mt-2">{currencySymbol}{pkg.monthlyPrice.toLocaleString('en-IN')}<span className="text-sm font-normal opacity-80">/mo</span></p>
                <p className="text-xs opacity-80 mt-1">{pkg.description || `${pkg.planType} plan`}</p>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-thb-text-secondary"><FiUsers className="w-3.5 h-3.5" /> {pkg.employeeLimit >= 9999 ? 'Unlimited' : pkg.employeeLimit} employees</span>
                  <span className="flex items-center gap-1 text-thb-text-secondary"><FiHardDrive className="w-3.5 h-3.5" /> {(pkg.storageLimit / 1000).toFixed(1)} GB</span>
                </div>
                <div className="space-y-1.5">
                  {pkg.payrollEnabled && <div className="flex items-center gap-2 text-xs text-thb-text-secondary"><FiCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> Payroll</div>}
                  {pkg.recruitmentEnabled && <div className="flex items-center gap-2 text-xs text-thb-text-secondary"><FiCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> Recruitment</div>}
                  {pkg.attendanceEnabled && <div className="flex items-center gap-2 text-xs text-thb-text-secondary"><FiCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> Attendance</div>}
                  {pkg.projectEnabled && <div className="flex items-center gap-2 text-xs text-thb-text-secondary"><FiCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> Projects</div>}
                  {pkg.apiAccessEnabled && <div className="flex items-center gap-2 text-xs text-thb-text-secondary"><FiCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> API Access</div>}
                  <p className="text-[10px] text-thb-text-muted">{pkg._count?.subscriptions || 0} active subscription{(pkg._count?.subscriptions || 0) !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-thb-border">
                  <span className={`thb-badge ${pkg.status === 'active' ? 'thb-badge-success' : 'thb-badge-warning'}`}>{pkg.status}</span>
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(pkg)} className="inline-flex items-center gap-1 text-green-500 hover:text-green-700 text-xs font-medium"><FiEdit2 className="w-3.5 h-3.5" /> Edit</button>
                    <button onClick={() => handleDelete(pkg.id)} className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 text-xs font-medium"><FiTrash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Comparison Table */
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-thb-text-muted border-b border-thb-border bg-slate-50">
                <th className="px-4 py-3 font-medium">Feature</th>
                {packages.filter((p) => p.status === 'active').map((pkg) => (
                  <th key={pkg.id} className="px-4 py-3 font-medium text-center">{pkg.name}</th>
                ))}
              </tr></thead>
              <tbody>
                <tr className="border-b border-slate-50"><td className="px-4 py-3 text-thb-text-secondary font-medium">Monthly Price</td>{packages.filter((p) => p.status === 'active').map((pkg) => <td key={pkg.id} className="px-4 py-3 text-center font-bold text-thb-text-primary">{currencySymbol}{pkg.monthlyPrice.toLocaleString('en-IN')}/mo</td>)}</tr>
                <tr className="border-b border-slate-50"><td className="px-4 py-3 text-thb-text-secondary font-medium">Annual Price</td>{packages.filter((p) => p.status === 'active').map((pkg) => <td key={pkg.id} className="px-4 py-3 text-center font-bold text-thb-text-primary">{currencySymbol}{pkg.annualPrice.toLocaleString('en-IN')}/yr</td>)}</tr>
                <tr className="border-b border-slate-50"><td className="px-4 py-3 text-thb-text-secondary font-medium flex items-center gap-1"><FiUsers className="w-3.5 h-3.5" /> Employee Limit</td>{packages.filter((p) => p.status === 'active').map((pkg) => <td key={pkg.id} className="px-4 py-3 text-center text-thb-text-primary">{pkg.employeeLimit >= 9999 ? 'Unlimited' : pkg.employeeLimit}</td>)}</tr>
                <tr className="border-b border-slate-50"><td className="px-4 py-3 text-thb-text-secondary font-medium flex items-center gap-1"><FiHardDrive className="w-3.5 h-3.5" /> Storage</td>{packages.filter((p) => p.status === 'active').map((pkg) => <td key={pkg.id} className="px-4 py-3 text-center text-thb-text-primary">{(pkg.storageLimit / 1000).toFixed(1)} GB</td>)}</tr>
                {['payrollEnabled','recruitmentEnabled','attendanceEnabled','projectEnabled','clientPortalEnabled','mobileAppEnabled','apiAccessEnabled','whiteLabelEnabled'].map((feat) => (
                  <tr key={feat} className="border-b border-slate-50">
                    <td className="px-4 py-3 text-thb-text-secondary">{feat.replace('Enabled','')}</td>
                    {packages.filter((p) => p.status === 'active').map((pkg) => (
                      <td key={pkg.id} className="px-4 py-3 text-center">{(pkg as Record<string, unknown>)[feat] ? <FiCheck className="w-4 h-4 text-emerald-500 mx-auto" /> : <span className="text-thb-text-muted">—</span>}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
