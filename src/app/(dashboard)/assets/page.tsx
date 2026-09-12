'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import {
  FiPackage,
  FiPlus,
  FiX,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiFilter,
  FiMonitor,
  FiSmartphone,
  FiGrid, FiFileText, FiSettings, FiBarChart2,
} from 'react-icons/fi';
import ModuleDashboardShell, { DashboardTabConfig } from '@/components/ModuleDashboardShell';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import ModuleTips from '@/components/ModuleTips';
import ModuleWorkflow from '@/components/ModuleWorkflow';
import { useCompanyContextStore } from '@/store/companyContextStore';

/* ── Types ── */
interface Asset {
  id: string;
  name: string;
  assetTag: string;
  category: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  purchaseCost: number | null;
  status: string;
  condition: string;
  assignments: Array<{
    id: string;
    status: string;
    employee: { id: string; firstName: string; lastName: string; employeeId: string };
  }>;
}

/* ── Helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    available: 'thb-badge thb-badge-success',
    assigned: 'thb-badge thb-badge-info',
    under_repair: 'thb-badge thb-badge-warning',
    maintenance: 'thb-badge thb-badge-warning',
    disposed: 'thb-badge thb-badge-error',
    retired: 'thb-badge thb-badge-error',
    lost: 'thb-badge thb-badge-error',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

function formatStatus(status: string) {
  const map: Record<string, string> = {
    available: 'Available',
    assigned: 'Assigned',
    under_repair: 'Under Repair',
    maintenance: 'Maintenance',
    disposed: 'Disposed',
    retired: 'Retired',
    lost: 'Lost',
  };
  return map[status] || status;
}

function formatCategory(category: string) {
  return category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ');
}

function getCategoryIcon(category: string) {
  if (['laptop', 'desktop', 'monitor'].includes(category)) return <FiMonitor className="w-4 h-4" />;
  if (['phone', 'tablet'].includes(category)) return <FiSmartphone className="w-4 h-4" />;
  return <FiPackage className="w-4 h-4" />;
}

const CATEGORIES = ['laptop', 'desktop', 'phone', 'tablet', 'monitor', 'printer', 'furniture', 'vehicle', 'other'];
const STATUSES = ['available', 'assigned', 'under_repair', 'disposed', 'lost'];

const assetsTips = [
  { title: 'Asset Categories', description: 'Organize assets into categories like laptops, phones, and furniture for better tracking' },
  { title: 'Depreciation Tracking', description: 'Track asset depreciation over time to maintain accurate financial records' },
  { title: 'Assignment Policies', description: 'Define clear policies for asset assignment and return to prevent loss' },
  { title: 'Maintenance Schedules', description: 'Schedule regular maintenance to extend asset lifespan and prevent breakdowns' },
  { title: 'Audit Trails', description: 'Maintain complete audit trails for all asset transactions and changes' },
];

const assetsWorkflowSteps = [
  { step: 1, title: 'Register Asset', description: 'Add new asset with details like tag, category, and cost', route: '/assets' },
  { step: 2, title: 'Categorize Asset', description: 'Assign the asset to the appropriate category' },
  { step: 3, title: 'Assign to Employee', description: 'Issue the asset to an employee with proper documentation' },
  { step: 4, title: 'Schedule Maintenance', description: 'Set up regular maintenance and inspection schedules' },
  { step: 5, title: 'Track Depreciation', description: 'Monitor asset value depreciation over its lifecycle' },
  { step: 6, title: 'Process Return', description: 'Handle asset return when employee leaves or changes role' },
  { step: 7, title: 'Retire/Dispose Asset', description: 'Properly retire or dispose of assets at end of life' },
];

const initialForm = {
  name: '',
  assetTag: '',
  category: 'laptop',
  brand: '',
  model: '',
  serialNumber: '',
  purchaseDate: '',
  purchaseCost: '',
  status: 'available',
  condition: 'new',
  location: '',
  notes: '',
};

/* ── Placeholder Tabs ── */

const assetsTabs: DashboardTabConfig[] = [
  { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
  { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
  { label: 'Settings', key: 'settings', icon: <FiSettings className="w-4 h-4" />, isNew: true },
];

function AssetsReportsPlaceholder() {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg mb-4">
        <FiFileText className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-lg font-bold text-thb-text-primary mb-1">Reports & Analytics</h3>
      <p className="text-sm text-thb-text-secondary text-center max-w-md mb-4">
        Asset inventory reports, depreciation schedules, and assignment analytics
      </p>
      <a href="/assets/reports" className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
        <FiBarChart2 className="w-4 h-4" /> Go to Reports
      </a>
    </div>
  );
}

function AssetsSettingsPlaceholder() {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow-lg mb-4">
        <FiSettings className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-lg font-bold text-thb-text-primary mb-1">Settings & Configuration</h3>
      <p className="text-sm text-thb-text-secondary text-center max-w-md mb-4">
        Configure asset categories, depreciation policies, and assignment rules
      </p>
      <a href="/assets/settings" className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
        <FiSettings className="w-4 h-4" /> Go to Settings
      </a>
    </div>
  );
}

function AssetsPageContent() {
  return (
    <ModuleDashboardShell
      moduleKey="assets"
      moduleLabel="Assets & IT"
      moduleIcon={<FiPackage className="w-5 h-5 text-white" />}
      gradientColor="from-slate-500 to-gray-600"
      tabs={assetsTabs}
      overviewContent={<AssetsContent />}
      children={{
        reports: <AssetsReportsPlaceholder />,
        settings: <AssetsSettingsPlaceholder />,
      }}
    />
  );
}

export default function AssetsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-slate-500 border-t-transparent rounded-full" /></div>}>
      <AssetsPageContent />
    </Suspense>
  );
}

/* ── Component ── */
function AssetsContent() {
  const { user } = useAuthStore();
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  /* Fetch data */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();

      const params = new URLSearchParams({ limit: '100' });
      if (filterCategory) params.set('category', filterCategory);
      if (filterStatus) params.set('status', filterStatus);

      const assetsRes = await fetch(`/api/assets?${scopeQuery}${params.toString()}` , { headers });

      if (assetsRes.ok) {
        const data = await assetsRes.json();
        setAssets(data.assets || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterStatus]);
  const cid = effectiveCompanyId();
  const scopeQuery = cid ? `companyId=${cid}&` : '';


  useEffect(() => { queueMicrotask(() => fetchData()); }, [fetchData]);

  /* Filter by search */
  const filteredAssets = assets.filter(a => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      a.name.toLowerCase().includes(s) ||
      a.assetTag.toLowerCase().includes(s) ||
      (a.serialNumber || '').toLowerCase().includes(s)
    );
  });

  /* Form handlers */
  const handleAddNew = () => {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(true);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleEdit = (asset: Asset) => {
    setForm({
      name: asset.name,
      assetTag: asset.assetTag,
      category: asset.category,
      brand: asset.brand || '',
      model: asset.model || '',
      serialNumber: asset.serialNumber || '',
      purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : '',
      purchaseCost: asset.purchaseCost?.toString() || '',
      status: asset.status,
      condition: asset.condition || 'new',
      location: '',
      notes: '',
    });
    setEditingId(asset.id);
    setShowForm(true);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(initialForm);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.assetTag || !form.category) {
      toast.error('Please fill in all required fields (Name, Asset Tag, Category)');
      return;
    }
    try {
      setSubmitting(true);
      const body: Record<string, unknown> = {
        name: form.name,
        assetTag: form.assetTag,
        category: form.category,
        brand: form.brand || null,
        model: form.model || null,
        serialNumber: form.serialNumber || null,
        purchaseDate: form.purchaseDate || null,
        purchaseCost: form.purchaseCost ? parseFloat(form.purchaseCost) : null,
        condition: form.condition || 'new',
        status: form.status,
      };

      if (editingId) {
        const res = await fetch(`/api/assets/${editingId}?${scopeQuery}` , {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify(body),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to update'); }
        toast.success('Asset updated successfully');
      } else {
        const res = await fetch(`/api/assets?${scopeQuery}` , {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(body),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to create'); }
        toast.success('Asset created successfully');
      }

      handleCancelForm();
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save asset');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleting(true);
      const res = await fetch(`/api/assets/${id}?${scopeQuery}` , {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to delete'); }
      toast.success('Asset deleted successfully');
      setDeleteConfirmId(null);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete asset');
    } finally {
      setDeleting(false);
    }
  };

  const getAssignedEmployee = (asset: Asset) => {
    if (asset.assignments && asset.assignments.length > 0 && asset.assignments[0].status === 'assigned') {
      const emp = asset.assignments[0].employee;
      return `${emp.firstName} ${emp.lastName}`;
    }
    return '—';
  };

  const colCount = isAdmin ? 8 : 7;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiPackage className="w-6 h-6 text-teal-500" />
            Assets
          </h1>
          <p className="text-thb-text-secondary mt-1">Manage company assets and equipment</p>
        </div>
        {isAdmin && (
          <button onClick={handleAddNew} className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors">
            <FiPlus className="w-4 h-4" />
            Add Asset
          </button>
        )}
      </div>

      <ModuleTips moduleKey="assets" title="Assets Tips" tips={assetsTips} userRole={user?.role} />
      <ModuleWorkflow moduleKey="assets" title="How to Manage Company Assets" subtitle="Follow this workflow to manage assets throughout their lifecycle" steps={assetsWorkflowSteps} accentColor="blue" userRole={user?.role} />

      {/* Filters & Search */}
      <div className="thb-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
            <input
              type="text"
              placeholder="Search by name, asset tag, or serial number..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <FiFilter className="w-4 h-4 text-thb-text-muted" />
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{formatCategory(c)}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
            >
              <option value="">All Statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Embedded Form */}
      {showForm && (
        <div id="crud-form" className="thb-card border-l-4 border-l-green-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">
                {editingId ? 'Edit Asset' : 'Add New Asset'}
              </h2>
              <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Name <span className="text-red-500 font-bold">*</span></label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="Asset name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Asset Tag <span className="text-red-500 font-bold">*</span></label>
                <input type="text" value={form.assetTag} onChange={e => setForm(p => ({ ...p, assetTag: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="e.g. AST-001" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Category <span className="text-red-500 font-bold">*</span></label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                  {CATEGORIES.map(c => <option key={c} value={c}>{formatCategory(c)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Brand</label>
                <input type="text" value={form.brand} onChange={e => setForm(p => ({ ...p, brand: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="Brand name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Model</label>
                <input type="text" value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="Model name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Serial Number</label>
                <input type="text" value={form.serialNumber} onChange={e => setForm(p => ({ ...p, serialNumber: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="Serial number" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Purchase Date</label>
                <input type="date" value={form.purchaseDate} onChange={e => setForm(p => ({ ...p, purchaseDate: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Purchase Cost</label>
                <input type="number" step="0.01" value={form.purchaseCost} onChange={e => setForm(p => ({ ...p, purchaseCost: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Condition</label>
                <select value={form.condition} onChange={e => setForm(p => ({ ...p, condition: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                  {['new', 'good', 'fair', 'poor'].map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                  {STATUSES.map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Location</label>
                <input type="text" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="Office location" />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 resize-none" placeholder="Additional notes..." />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-thb-border">
              <button onClick={handleCancelForm} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 shadow-sm shadow-green-500/25 transition-colors">
                {submitting ? 'Saving...' : editingId ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assets Table */}
      <div className="thb-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-thb-border bg-slate-50/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Asset Tag</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Brand / Model</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Assigned To</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Location</th>
                {isAdmin && (
                  <th className="text-right px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-thb-border/50 animate-pulse">
                    <td className="px-4 py-3"><div className="h-3 w-16 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-24 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-16 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-20 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-16 bg-slate-200 rounded-full" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-20 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-20 bg-slate-200 rounded" /></td>
                    {isAdmin && <td className="px-4 py-3"><div className="h-3 w-16 bg-slate-200 rounded ml-auto" /></td>}
                  </tr>
                ))
              ) : filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-12 text-center">
                    <FiPackage className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
                    <p className="text-thb-text-secondary font-medium">No assets found</p>
                    <p className="text-sm text-thb-text-muted mt-1">
                      {search || filterCategory || filterStatus ? 'Try adjusting your filters' : 'Add your first asset to get started'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredAssets.map(asset => (
                  <tr key={asset.id} className="border-b border-thb-border/50 hover:bg-slate-50/50 transition-colors">
                    {deleteConfirmId === asset.id ? (
                      <td colSpan={colCount} className="px-4 py-3 bg-red-50">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-red-700 font-medium">Are you sure you want to delete &quot;{asset.name}&quot;?</span>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleDelete(asset.id)} disabled={deleting} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">
                              {deleting ? 'Deleting...' : 'Confirm'}
                            </button>
                            <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-500">{getCategoryIcon(asset.category)}</span>
                            <span className="text-sm font-mono font-medium text-green-600">{asset.assetTag}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-thb-text-primary">{asset.name}</td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">{formatCategory(asset.category)}</td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">
                          {asset.brand || asset.model ? `${asset.brand || ''} ${asset.model || ''}`.trim() : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={getStatusBadge(asset.status)}>{formatStatus(asset.status)}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">{getAssignedEmployee(asset)}</td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">—</td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => handleEdit(asset)} className="p-2 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Edit">
                                <FiEdit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => setDeleteConfirmId(asset.id)} className="p-2 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete">
                                <FiTrash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
