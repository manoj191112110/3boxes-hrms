'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiServer,
  FiSettings,
  FiCreditCard,
  FiUsers,
  FiGitMerge,
  FiPlus,
  FiX,
  FiSearch,
  FiEdit2,
  FiTrash2,
  FiCheck,
  FiClock,
  FiLayers,
  FiHome,
  FiRefreshCw,
  FiShield,
  FiInfo,
  FiGlobe,
  FiChevronRight,
  FiBriefcase,
  FiDollarSign,
  FiMessageSquare,
  FiAlertTriangle,
} from 'react-icons/fi';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { isClientDemoMode } from '@/lib/site-mode';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';
import SrsBanner from '@/components/SrsBanner';

/* ── Types ── */
interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  plan: string;
  status: 'active' | 'trial' | 'suspended' | 'churned' | 'pending_approval' | 'inactive';
  country?: string | null;
  currency: string;
  timezone: string;
  logo?: string | null;
  maxCompaniesAllowed?: number;
  createdAt: string;
  _count?: { users: number; companyGroups: number; subscriptions: number };
  subscriptions?: { id: string; plan: { name: string; planType: string }; status: string; startDate: string; endDate: string; amount: number }[];
  users?: { id: string; name: string; email: string; role: string; status: string; lastLogin: string | null }[];
}

interface CompanyInGroup {
  id: string;
  name: string;
  code: string | null;
  status: string;
  maxEmployees?: number | null;
  plannedEmployeeCount?: number | null;
  _count: { employees: number };
}

interface CompanyGroupRow {
  id: string;
  name: string;
  tenantId: string;
  tenantName?: string | null;
  employeeLimitMode: 'per_company' | 'group_total';
  maxEmployees: number | null;
  maxCompanies: number | null;
  notes?: string | null;
  createdAt: string;
  _count?: { companies: number; employees: number };
  companies?: CompanyInGroup[];
}

interface WorkflowConfig {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  trigger: string;
  lastRun: string | null;
}

/* ── Helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function getTenantStatusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'thb-badge thb-badge-success',
    trial: 'thb-badge thb-badge-info',
    suspended: 'thb-badge thb-badge-warning',
    churned: 'thb-badge thb-badge-error',
    pending_approval: 'thb-badge thb-badge-info',
    inactive: 'thb-badge thb-badge-error',
  };
  return { className: map[status] || 'thb-badge thb-badge-info', label: status.replace('_', ' ') };
}

function getInvoiceStatusBadge(status: string) {
  const map: Record<string, string> = {
    paid: 'thb-badge thb-badge-success',
    pending: 'thb-badge thb-badge-info',
    overdue: 'thb-badge thb-badge-error',
  };
  return { className: map[status] || 'thb-badge thb-badge-info', label: status };
}

function getUserStatusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'thb-badge thb-badge-success',
    inactive: 'thb-badge thb-badge-error',
    invited: 'thb-badge thb-badge-info',
  };
  return { className: map[status] || 'thb-badge thb-badge-info', label: status };
}

function formatCurrency(amount: number, currency = 'INR') {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

/* ── Demo data for workflows (kept as demo since workflow engine isn't built yet) ── */
const demoWorkflows: WorkflowConfig[] = isClientDemoMode() ? [
  { id: '1', name: 'Leave Approval', type: 'approval', enabled: true, trigger: 'Leave request submitted', lastRun: '2026-03-03 09:00 AM' },
  { id: '2', name: 'Onboarding Flow', type: 'onboarding', enabled: true, trigger: 'New employee added', lastRun: '2026-03-01 11:30 AM' },
  { id: '3', name: 'Expense Approval', type: 'approval', enabled: true, trigger: 'Expense claim submitted', lastRun: '2026-03-02 02:15 PM' },
  { id: '4', name: 'Performance Review Cycle', type: 'review', enabled: false, trigger: 'Review cycle start date', lastRun: '2025-12-15 09:00 AM' },
  { id: '5', name: 'Probation Completion', type: 'notification', enabled: true, trigger: 'Probation period end date', lastRun: '2026-02-28 08:00 AM' },
  { id: '6', name: 'Asset Return on Exit', type: 'offboarding', enabled: true, trigger: 'Employee separation initiated', lastRun: '2026-02-20 03:45 PM' },
] : [];

/* ── Component ── */
export default function TenantAdminPage() {
  const { user } = useAuthStore();
  const { tenant, tenantQuota, hydrate, hydrated: ctxHydrated } = useCompanyContextStore();

  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [groups, setGroups] = useState<CompanyGroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'groups' | 'settings' | 'billing' | 'users' | 'workflows' | 'configuration'>('overview');

  // Settings editing
  const [settingsEditing, setSettingsEditing] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    name: '', domain: '', country: '', currency: 'INR', timezone: 'UTC', logo: '',
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [resettingEmployees, setResettingEmployees] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [workflows, setWorkflows] = useState<WorkflowConfig[]>(demoWorkflows);

  /* Fetch tenant info (the tenant_admin's own tenant) */
  const fetchTenantInfo = useCallback(async () => {
    const tid = user?.tenantId || user?.tenant?.id;
    if (!tid) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`/api/tenants/${tid}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const t = data.tenant || data;
        if (t && t.id) {
          setTenantInfo(t);
          setSettingsForm({
            name: t.name || '',
            domain: t.domain || '',
            country: t.country || '',
            currency: t.currency || 'INR',
            timezone: t.timezone || 'UTC',
            logo: t.logo || '',
          });
        }
      }
    } catch (e) {
      console.error('fetchTenantInfo error:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId]);

  /* Fetch group companies for this tenant */
  const fetchGroups = useCallback(async () => {
    try {
      setGroupsLoading(true);
      const res = await fetch('/api/company-groups', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups || []);
      } else {
        setGroups([]);
      }
    } catch (e) {
      console.error('fetchGroups error:', e);
      setGroups([]);
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ctxHydrated) hydrate();
    fetchTenantInfo();
    fetchGroups();
  }, [ctxHydrated, hydrate, fetchTenantInfo, fetchGroups]);

  // ─── Access guard (placed AFTER all hooks so we don't violate React's
  // rules-of-hooks. Super admins don't have a tenantId — this page is
  // scoped to a single tenant, so for them it would show empty data.
  // Redirect them to /super-admin with a helpful explainer instead.) ───
  if (user && user.role === 'super_admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-green-500/20">
          <FiShield className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-semibold text-thb-text-primary">Super admins use the Super Admin page</h2>
        <p className="text-thb-text-secondary text-sm max-w-md leading-relaxed">
          The Tenant Admin page is scoped to a single tenant (the one the logged-in
          tenant admin belongs to). Since your super admin account is platform-level
          and not tied to any specific tenant, this page would show empty data.
          Head over to the <b>Super Admin</b> page to manage all tenants, group
          companies, and companies from one place.
        </p>
        <Link
          href="/super-admin"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm shadow-sm transition-colors mt-2"
        >
          <FiServer className="w-4 h-4" /> Go to Super Admin
        </Link>
      </div>
    );
  }

  // Also handle the case where the user IS a tenant_admin but their account
  // doesn't have a tenantId or tenant object (e.g. legacy data, misconfigured account,
  // or /api/auth/me not returning tenantId). Show a clear message.
  if (user && user.role === 'tenant_admin' && !user.tenantId && !user.tenant?.id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
          <FiInfo className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-semibold text-thb-text-primary">Your account is not linked to a tenant</h2>
        <p className="text-thb-text-secondary text-sm max-w-md leading-relaxed">
          You&rsquo;re signed in as a tenant admin, but your account isn&rsquo;t
          associated with any tenant. Please ask your super admin to assign you to
          a tenant, or sign out and sign back in with a different account.
        </p>
      </div>
    );
  }

  /* Stats — derived from real data */
  const totalGroups = groups.length;
  const totalCompanies = groups.reduce((s, g) => s + (g._count?.companies || 0), 0);
  const totalEmployees = groups.reduce((s, g) => s + (g._count?.employees || 0), 0);
  const totalUsers = tenantInfo?._count?.users || tenantInfo?.users?.length || 0;
  const activeSubscriptions = tenantInfo?.subscriptions?.filter(s => s.status === 'active').length || 0;

  /* Filtered */
  const filteredGroups = groups.filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase()) || (g.notes || '').toLowerCase().includes(search.toLowerCase()));
  const filteredUsers = (tenantInfo?.users || []).filter(u => !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()) || u.role.toLowerCase().includes(search.toLowerCase()));
  const filteredWorkflows = workflows.filter(w => !search || w.name.toLowerCase().includes(search.toLowerCase()) || w.type.toLowerCase().includes(search.toLowerCase()));

  /* Settings save */
  const handleSaveSettings = async () => {
    if (!tenantInfo) return;
    try {
      setSavingSettings(true);
      const res = await fetch(`/api/tenants/${tenantInfo.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: settingsForm.name,
          domain: settingsForm.domain || null,
          country: settingsForm.country || null,
          currency: settingsForm.currency,
          timezone: settingsForm.timezone,
          logo: settingsForm.logo || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to save settings');
      }
      const data = await res.json();
      const updated = data.tenant || data;
      if (updated) setTenantInfo(updated);
      // Refresh the context store so the header reflects the new tenant name
      hydrate(true);
      setSettingsEditing(false);
      toast.success('Tenant settings saved successfully');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  /* Reset Employee Data — deletes all employees except the admin user */
  const handleResetEmployees = async () => {
    if (!tenantInfo?.slug) {
      toast.error('Tenant info not loaded yet');
      return;
    }
    try {
      setResettingEmployees(true);
      const res = await fetch('/api/admin/cleanup-employees', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ tenantSlug: tenantInfo.slug }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to reset employee data');
      }
      const data = await res.json();
      toast.success(`Deleted ${data.deleted} employees. Kept: ${data.keptEmployee || 'admin user'}.`);
      setShowResetConfirm(false);
      // Refresh groups to update employee counts
      fetchGroups();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reset employee data');
    } finally {
      setResettingEmployees(false);
    }
  };

  /* Workflow toggle */
  const toggleWorkflow = (id: string) => {
    setWorkflows(prev => prev.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w));
    const wf = workflows.find(w => w.id === id);
    toast.success(`${wf?.name} ${wf?.enabled ? 'disabled' : 'enabled'}`);
  };

  const tabs = [
    { key: 'overview' as const, label: 'Overview', icon: FiServer },
    { key: 'groups' as const, label: 'Group Companies (read-only)', icon: FiLayers },
    { key: 'settings' as const, label: 'Settings', icon: FiSettings },
    { key: 'billing' as const, label: 'Billing', icon: FiCreditCard },
    { key: 'users' as const, label: 'Users', icon: FiUsers },
    { key: 'workflows' as const, label: 'Workflows', icon: FiGitMerge },
    { key: 'configuration' as const, label: 'Configuration', icon: FiGlobe },
  ];

  const tenantName = tenantInfo?.name || tenant?.name || 'your tenant';

  return (
    <div className="space-y-6">
      {/* SRS-aligned role banner — shows what this role can/can't do per spec */}
      <SrsBanner role="tenant_admin" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiServer className="w-6 h-6 text-teal-500" />
            Tenant Admin
          </h1>
          <p className="text-thb-text-secondary mt-1 flex items-center gap-1.5 flex-wrap">
            <FiHome className="w-3.5 h-3.5" />
            <span>Managing tenant:</span>
            <span className="font-semibold text-thb-text-primary">{tenantName}</span>
            {tenantInfo?.slug && <span className="text-xs text-thb-text-muted">({tenantInfo.slug})</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { fetchTenantInfo(); fetchGroups(); }}
            className="inline-flex items-center gap-2 px-3 py-2 border border-thb-border rounded-lg text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors"
          >
            <FiRefreshCw className="w-4 h-4" /> Refresh
          </button>
          <Link
            href="/tenant-admin/group-companies"
            className="inline-flex items-center gap-2 px-3 py-2 border border-teal-200 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 font-medium text-sm shadow-sm transition-colors"
            title="View the group companies under your tenant (read-only — only super admin can create or modify)"
          >
            <FiLayers className="w-4 h-4" /> View Group Companies
          </Link>
        </div>
      </div>

      {/* Stats Cards — REAL data */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-50"><FiLayers className="w-4 h-4 text-teal-600" /></div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Group Companies</p>
              <p className="text-xl font-bold text-thb-text-primary">{totalGroups}</p>
            </div>
          </div>
        </div>
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50"><FiHome className="w-4 h-4 text-emerald-600" /></div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Companies</p>
              <p className="text-xl font-bold text-thb-text-primary">{totalCompanies}</p>
            </div>
          </div>
        </div>
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50"><FiUsers className="w-4 h-4 text-amber-600" /></div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Employees</p>
              <p className="text-xl font-bold text-thb-text-primary">{totalEmployees}</p>
            </div>
          </div>
        </div>
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50"><FiCheck className="w-4 h-4 text-emerald-600" /></div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Active Subscriptions</p>
              <p className="text-xl font-bold text-emerald-600">{activeSubscriptions}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quota Banner (if maxCompaniesAllowed is set) */}
      {tenantQuota && (
        <div className="thb-card p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
          <div className="flex items-start gap-3">
            <FiShield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold mb-0.5">Company Quota</p>
              <p className="text-xs">
                {tenantQuota.maxCompanies > 0
                  ? <>You have created <b>{tenantQuota.used}</b> of <b>{tenantQuota.maxCompanies}</b> allowed companies. <b>{tenantQuota.remaining}</b> remaining.</>
                  : <>You have created <b>{tenantQuota.used}</b> companies. <b>Unlimited</b> quota allowed.</>
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-thb-border overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.key ? 'border-teal-500 text-teal-600' : 'border-transparent text-thb-text-secondary hover:text-thb-text-primary'}`}>
            <tab.icon className="w-4 h-4" />{tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, role..." className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400" />
        </div>
      </div>

      {/* ═══ OVERVIEW TAB ═══ */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {loading ? (
            <div className="thb-card p-12 animate-pulse">
              <div className="h-4 w-32 bg-slate-200 rounded mb-4" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-8 bg-slate-100 rounded" />
                <div className="h-8 bg-slate-100 rounded" />
                <div className="h-8 bg-slate-100 rounded" />
                <div className="h-8 bg-slate-100 rounded" />
              </div>
            </div>
          ) : tenantInfo ? (
            <>
              {/* Tenant Info Card */}
              <div className="thb-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2">
                    <FiHome className="w-5 h-5 text-teal-500" /> Tenant Information
                  </h3>
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-600 bg-teal-50 rounded-lg hover:bg-teal-100"
                  >
                    <FiEdit2 className="w-3.5 h-3.5" /> Edit Settings
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-thb-text-muted">Tenant Name</p>
                    <p className="text-sm font-medium text-thb-text-primary">{tenantInfo.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-thb-text-muted">Slug</p>
                    <p className="text-sm font-medium text-thb-text-primary">{tenantInfo.slug}</p>
                  </div>
                  <div>
                    <p className="text-xs text-thb-text-muted">Domain</p>
                    <p className="text-sm font-medium text-thb-text-primary">{tenantInfo.domain || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-thb-text-muted">Plan</p>
                    <p className="text-sm font-medium text-thb-text-primary capitalize">{tenantInfo.plan}</p>
                  </div>
                  <div>
                    <p className="text-xs text-thb-text-muted">Status</p>
                    <span className={getTenantStatusBadge(tenantInfo.status).className}>{getTenantStatusBadge(tenantInfo.status).label}</span>
                  </div>
                  <div>
                    <p className="text-xs text-thb-text-muted">Country</p>
                    <p className="text-sm font-medium text-thb-text-primary">{tenantInfo.country || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-thb-text-muted">Currency</p>
                    <p className="text-sm font-medium text-thb-text-primary">{tenantInfo.currency}</p>
                  </div>
                  <div>
                    <p className="text-xs text-thb-text-muted">Timezone</p>
                    <p className="text-sm font-medium text-thb-text-primary">{tenantInfo.timezone}</p>
                  </div>
                </div>
              </div>

              {/* Group Companies Summary */}
              <div className="thb-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-thb-text-secondary flex items-center gap-2">
                    <FiLayers className="w-4 h-4 text-teal-500" /> Group Companies under this Tenant
                  </h3>
                  <Link href="/tenant-admin/group-companies" className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700">
                    View all <FiChevronRight className="w-3 h-3" />
                  </Link>
                </div>
                {groupsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="h-16 bg-slate-100/70 animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : filteredGroups.length === 0 ? (
                  <div className="text-center py-8">
                    <FiLayers className="w-10 h-10 text-thb-text-muted mx-auto mb-3 opacity-50" />
                    <p className="text-sm text-thb-text-secondary font-medium">No group companies under your tenant yet</p>
                    <p className="text-xs text-thb-text-muted mt-1 mb-4">
                      Only your <b>super admin</b> can create group companies. Please ask them to create at least one
                      group under tenant <b>{tenantName}</b> so you can induct Companies under it.
                    </p>
                    <Link
                      href="/tenant-admin/companies"
                      className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium text-xs shadow-sm"
                    >
                      <FiBriefcase className="w-3.5 h-3.5" /> Go to Companies page
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredGroups.slice(0, 5).map((g) => {
                      const empCount = g._count?.employees || 0;
                      const coCount = g._count?.companies || 0;
                      return (
                        <div key={g.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white">
                              <FiLayers className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-thb-text-primary">{g.name}</p>
                              <p className="text-xs text-thb-text-muted">{coCount} companies · {empCount} employees</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {g.maxEmployees !== null && g.maxEmployees !== undefined && g.maxEmployees > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 ring-1 ring-amber-200 text-[10px] font-semibold">
                                <FiUsers className="w-2.5 h-2.5" /> {g.employeeLimitMode === 'per_company' ? 'per-co' : 'group'}: {empCount}/{g.maxEmployees}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 text-[10px] font-semibold">
                                <FiUsers className="w-2.5 h-2.5" /> no cap
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {filteredGroups.length > 5 && (
                      <Link href="/tenant-admin/group-companies" className="block text-center text-xs font-medium text-teal-600 hover:text-teal-700 py-2">
                        View all {filteredGroups.length} group companies →
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="thb-card p-12 text-center">
              <FiInfo className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
              <p className="text-thb-text-secondary font-medium">No tenant information available</p>
              <p className="text-xs text-thb-text-muted mt-1">Your account is not linked to a tenant.</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ GROUP COMPANIES TAB ═══ */}
      {activeTab === 'groups' && (
        <div className="space-y-4">
          {/* Educational banner */}
          <div className="thb-card p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
            <div className="flex items-start gap-3">
              <FiLayers className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-900 flex-1">
                <p className="font-bold mb-2 text-sm">Multi-tenancy Hierarchy</p>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-md border border-emerald-200 font-semibold">
                    <FiHome className="w-3 h-3" /> Tenant
                  </span>
                  <span className="text-emerald-400">=</span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-md border border-teal-200 font-semibold">
                    <FiLayers className="w-3 h-3" /> Group Company (parent)
                  </span>
                  <span className="text-emerald-400">→</span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-md border border-green-200 font-semibold">
                    <FiBriefcase className="w-3 h-3" /> Company
                  </span>
                  <span className="text-emerald-400">→</span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-md border border-amber-200 font-semibold">
                    <FiUsers className="w-3 h-3" /> Employees
                  </span>
                </div>
                <p className="leading-relaxed">
                  <b>The group company name and parent tenant are the same.</b>
                  {' '}You are managing tenant <b>{tenantName}</b>, which has a companies cap set by the super admin.
                  {' '}The group companies listed below are <b>created by your super admin</b> — as a tenant admin you
                  {' '}can view them but cannot create or modify them. To induct <b>Companies</b> under any group, use the{' '}
                  <a href="/tenant-admin/companies" className="font-bold text-emerald-700 underline">Companies</a> page.
                </p>
              </div>
            </div>
          </div>

          <div className="thb-card p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
            <div className="flex items-start gap-3">
              <FiShield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900">
                <p className="font-semibold mb-1">Read-only — super-admin managed</p>
                <p>
                  Group companies under <b>{tenantName}</b> (and their employee-strength barriers) are
                  {' '}<b>created and managed by your super admin</b>. If you need a new group or a cap change,
                  {' '}please contact your super admin. You can <b>create Companies</b> under any existing group via
                  {' '}the{' '}
                  <a href="/tenant-admin/companies" className="font-bold text-amber-700 underline">Companies</a> page.
                </p>
              </div>
            </div>
          </div>

          {/* Group companies list — REAL data */}
          {groupsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="thb-card p-5 animate-pulse">
                  <div className="flex justify-between">
                    <div className="space-y-2"><div className="h-4 w-40 bg-slate-200 rounded" /><div className="h-3 w-28 bg-slate-100 rounded" /></div>
                    <div className="h-6 w-24 bg-slate-100 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="thb-card p-12 text-center">
              <FiLayers className="w-12 h-12 text-thb-text-muted mx-auto mb-3 opacity-50" />
              <p className="text-thb-text-secondary font-medium">No group companies under your tenant yet</p>
              <p className="text-xs text-thb-text-muted mt-1 mb-4">
                Only your <b>super admin</b> can create group companies. Please ask them to create at least one group
                under tenant <b>{tenantName}</b> so you can induct Companies under it.
              </p>
              <Link
                href="/tenant-admin/companies"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 rounded-lg transition-all"
              >
                <FiBriefcase className="w-4 h-4" /> Go to Companies page
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredGroups.map((g) => {
                const empCount = g._count?.employees || 0;
                const coCount = g._count?.companies || 0;
                const hasEmpCap = g.maxEmployees !== null && g.maxEmployees !== undefined && g.maxEmployees > 0;
                const hasCoCap = g.maxCompanies !== null && g.maxCompanies !== undefined && g.maxCompanies > 0;
                return (
                  <div key={g.id} className="thb-card p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white flex-shrink-0">
                          <FiLayers className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-thb-text-primary">{g.name}</h3>
                          <p className="text-sm text-thb-text-muted flex items-center gap-1.5 flex-wrap">
                            <FiHome className="w-3 h-3" /> {tenantName}
                            <span className="opacity-50">·</span> {coCount} companies
                            <span className="opacity-50">·</span> {empCount} employees
                          </p>
                          {g.notes && <p className="text-xs text-thb-text-muted italic mt-1">“{g.notes}”</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {hasEmpCap ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 ring-1 ring-amber-200 text-[11px] font-semibold">
                            <FiUsers className="w-3 h-3" />
                            {g.employeeLimitMode === 'per_company' ? 'per-co' : 'group-total'}: {empCount}/{g.maxEmployees}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 text-[11px] font-semibold">
                            <FiUsers className="w-3 h-3" /> no emp cap
                          </span>
                        )}
                        {hasCoCap && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-green-50 text-green-700 ring-1 ring-green-200 text-[11px] font-semibold">
                            <FiLayers className="w-3 h-3" /> co cap: {coCount}/{g.maxCompanies}
                          </span>
                        )}
                        <Link
                          href="/tenant-admin/group-companies"
                          className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg"
                          title="View details (read-only)"
                        >
                          <FiInfo className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>

                    {/* Companies under this group */}
                    {g.companies && g.companies.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                        {g.companies.map((c) => {
                          const cEmp = c._count?.employees || 0;
                          const cCap = c.maxEmployees;
                          const cPlan = c.plannedEmployeeCount;
                          const atCap = cCap !== null && cCap !== undefined && (cCap as number) > 0 && cEmp >= (cCap as number);
                          return (
                            <div key={c.id} className="flex items-center gap-3 text-xs text-thb-text-secondary bg-slate-50 rounded-lg p-2.5">
                              <FiHome className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-medium text-thb-text-primary">{c.name}</span>
                              {c.code && <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-semibold">{c.code}</span>}
                              <span className="ml-auto flex items-center gap-1.5">
                                <span className={atCap ? 'text-red-600 font-semibold' : ''}>{cEmp} emp</span>
                                {cPlan !== null && cPlan !== undefined && (cPlan as number) > 0 && (
                                  <span className="text-slate-400">plan: {cPlan}</span>
                                )}
                                {cCap !== null && cCap !== undefined && (cCap as number) > 0 && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-semibold">cap: {cCap}</span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-center gap-2 flex-wrap">
            <Link
              href="/tenant-admin/group-companies"
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-teal-200 bg-teal-50 text-teal-700 text-sm font-semibold rounded-lg hover:bg-teal-100 transition-all"
            >
              <FiLayers className="w-4 h-4" /> View Full Group Companies List
            </Link>
            <Link
              href="/tenant-admin/companies"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 rounded-lg transition-all"
            >
              <FiBriefcase className="w-4 h-4" /> Create a Company
            </Link>
          </div>
        </div>
      )}

      {/* ═══ SETTINGS TAB ═══ */}
      {activeTab === 'settings' && tenantInfo && (
        <div className="thb-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2">
              <FiSettings className="w-5 h-5 text-teal-500" /> Tenant Settings
            </h3>
            {!settingsEditing ? (
              <button
                onClick={() => setSettingsEditing(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-medium text-sm shadow-sm transition-colors"
              >
                <FiEdit2 className="w-4 h-4" /> Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSettingsForm({
                      name: tenantInfo.name || '',
                      domain: tenantInfo.domain || '',
                      country: tenantInfo.country || '',
                      currency: tenantInfo.currency || 'INR',
                      timezone: tenantInfo.timezone || 'UTC',
                      logo: tenantInfo.logo || '',
                    });
                    setSettingsEditing(false);
                  }}
                  className="px-4 py-2 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-medium text-sm shadow-sm transition-colors disabled:opacity-50"
                >
                  {savingSettings ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Tenant Name</label>
              {settingsEditing ? (
                <input
                  type="text"
                  value={settingsForm.name}
                  onChange={e => setSettingsForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                />
              ) : (
                <p className="text-sm text-thb-text-primary py-2.5">{tenantInfo.name}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Slug (read-only)</label>
              <p className="text-sm text-thb-text-muted py-2.5">{tenantInfo.slug}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Domain</label>
              {settingsEditing ? (
                <input
                  type="text"
                  value={settingsForm.domain}
                  onChange={e => setSettingsForm(p => ({ ...p, domain: e.target.value }))}
                  placeholder="example.com"
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                />
              ) : (
                <p className="text-sm text-thb-text-primary py-2.5">{tenantInfo.domain || '—'}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Country</label>
              {settingsEditing ? (
                <input
                  type="text"
                  value={settingsForm.country}
                  onChange={e => setSettingsForm(p => ({ ...p, country: e.target.value }))}
                  placeholder="US"
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                />
              ) : (
                <p className="text-sm text-thb-text-primary py-2.5">{tenantInfo.country || '—'}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Currency</label>
              {settingsEditing ? (
                <select
                  value={settingsForm.currency}
                  onChange={e => setSettingsForm(p => ({ ...p, currency: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                >
                  <option value="INR">INR</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option>
                </select>
              ) : (
                <p className="text-sm text-thb-text-primary py-2.5">{tenantInfo.currency}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Timezone</label>
              {settingsEditing ? (
                <input
                  type="text"
                  value={settingsForm.timezone}
                  onChange={e => setSettingsForm(p => ({ ...p, timezone: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                />
              ) : (
                <p className="text-sm text-thb-text-primary py-2.5">{tenantInfo.timezone}</p>
              )}
            </div>
          </div>

          {/* Read-only fields managed by super admin */}
          <div className="mt-6 pt-6 border-t border-thb-border">
            <h4 className="text-sm font-semibold text-thb-text-primary mb-3 flex items-center gap-2">
              <FiShield className="w-4 h-4 text-amber-500" /> Super Admin Managed
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-thb-text-muted">Plan</p>
                <p className="text-sm font-medium text-thb-text-primary capitalize">{tenantInfo.plan}</p>
                <p className="text-[10px] text-thb-text-muted mt-0.5">Contact super admin to change</p>
              </div>
              <div>
                <p className="text-xs text-thb-text-muted">Status</p>
                <span className={getTenantStatusBadge(tenantInfo.status).className}>{getTenantStatusBadge(tenantInfo.status).label}</span>
              </div>
              <div>
                <p className="text-xs text-thb-text-muted">Max Companies Allowed</p>
                <p className="text-sm font-medium text-thb-text-primary">
                  {tenantInfo.maxCompaniesAllowed && tenantInfo.maxCompaniesAllowed > 0
                    ? `${tenantInfo.maxCompaniesAllowed} companies`
                    : 'Unlimited'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DANGER ZONE — Reset Employee Data ═══ */}
      {activeTab === 'settings' && (
        <div className="thb-card border-2 border-red-200 p-6 mt-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <FiAlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-thb-text-primary">Danger Zone</h3>
              <p className="text-sm text-thb-text-secondary">Reset employee data for this tenant</p>
            </div>
          </div>

          <div className="bg-red-50/50 border border-red-100 rounded-lg p-4 mb-4">
            <p className="text-sm text-red-700 font-medium mb-2">Reset Employee Data</p>
            <p className="text-xs text-red-600 mb-3">
              This will permanently delete <strong>all employees</strong> from this tenant except the admin user
              (your account). All related data — leave requests, attendance, payroll, documents, etc. — will also be
              deleted. This action <strong>cannot be undone</strong>.
            </p>

            {!showResetConfirm ? (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-lg font-medium text-sm hover:bg-red-600 transition-colors shadow-sm"
              >
                <FiTrash2 className="w-4 h-4" />
                Reset Employee Data
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-red-700">
                  <FiAlertTriangle className="w-4 h-4" />
                  Are you sure? This will delete all employees except your admin account.
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleResetEmployees}
                    disabled={resettingEmployees}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-lg font-medium text-sm hover:bg-red-600 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {resettingEmployees ? (
                      <span className="inline-flex items-center gap-2"><FiRefreshCw className="w-4 h-4 animate-spin" /> Deleting...</span>
                    ) : (
                      <span className="inline-flex items-center gap-2"><FiTrash2 className="w-4 h-4" /> Yes, Delete All Employees</span>
                    )}
                  </button>
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    disabled={resettingEmployees}
                    className="inline-flex items-center gap-2 px-4 py-2.5 border border-thb-border rounded-lg font-medium text-sm text-thb-text-secondary hover:bg-slate-50 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ BILLING TAB ═══ */}
      {activeTab === 'billing' && (
        <div className="space-y-4">
          {/* Current Plan */}
          <div className="thb-card p-6">
            <h3 className="text-sm font-semibold text-thb-text-secondary mb-4 flex items-center gap-2">
              <FiCreditCard className="w-4 h-4 text-teal-500" /> Current Subscription
            </h3>
            {tenantInfo?.subscriptions && tenantInfo.subscriptions.length > 0 ? (
              <div className="space-y-3">
                {tenantInfo.subscriptions.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between p-4 bg-teal-50 border border-teal-200 rounded-lg">
                    <div>
                      <p className="text-lg font-bold text-teal-700">{sub.plan.name}</p>
                      <p className="text-sm text-teal-600 mt-0.5 capitalize">{sub.plan.planType.replace('_', ' ')} plan</p>
                      <p className="text-xs text-teal-600/70 mt-0.5">
                        {new Date(sub.startDate).toLocaleDateString()} → {new Date(sub.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-teal-700">{formatCurrency(sub.amount, tenantInfo.currency)}</p>
                      <span className={`thb-badge ${sub.status === 'active' ? 'thb-badge-success' : 'thb-badge-info'}`}>{sub.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FiCreditCard className="w-10 h-10 text-thb-text-muted mx-auto mb-3 opacity-50" />
                <p className="text-sm text-thb-text-secondary font-medium">No active subscriptions</p>
                <p className="text-xs text-thb-text-muted mt-1">Contact your super admin to apply a subscription plan.</p>
              </div>
            )}
          </div>

          {/* Invoice History (demo) */}
          <div className="thb-card overflow-hidden">
            <div className="p-4 border-b border-thb-border">
              <h3 className="text-sm font-semibold text-thb-text-secondary">Invoice History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-thb-border bg-slate-50/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Invoice</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Plan</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-thb-text-muted">
                    <FiInfo className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    Invoices will appear here once a subscription is active.
                  </td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ USERS TAB ═══ */}
      {activeTab === 'users' && (
        <div className="thb-card overflow-hidden">
          <div className="p-4 border-b border-thb-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-thb-text-secondary">Users in this Tenant ({filteredUsers.length})</h3>
            <Link href="/tenant-admin/rbac" className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700">
              <FiShield className="w-3.5 h-3.5" /> Manage RBAC
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-thb-border bg-slate-50/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Last Login</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-12 text-center">
                    <FiUsers className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
                    <p className="text-thb-text-secondary font-medium">No users found</p>
                  </td></tr>
                ) : (
                  filteredUsers.map(u => {
                    const statusBadge = getUserStatusBadge(u.status);
                    return (
                      <tr key={u.id} className="border-b border-thb-border/50 hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-thb-text-primary">{u.name}</td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">{u.email}</td>
                        <td className="px-4 py-3"><span className="thb-badge thb-badge-primary">{u.role}</span></td>
                        <td className="px-4 py-3"><span className={statusBadge.className}>{statusBadge.label}</span></td>
                        <td className="px-4 py-3 text-xs text-thb-text-secondary">{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ WORKFLOWS TAB ═══ */}
      {activeTab === 'workflows' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-thb-text-secondary">Workflow Configuration</h3>
            <span className="text-xs text-thb-text-muted">Workflow engine — configure and manage automation rules</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredWorkflows.map(w => (
              <div key={w.id} className="thb-card p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-thb-text-primary">{w.name}</p>
                    <p className="text-xs text-thb-text-muted mt-0.5">Trigger: {w.trigger}</p>
                  </div>
                  <button onClick={() => toggleWorkflow(w.id)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${w.enabled ? 'bg-teal-500' : 'bg-slate-300'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${w.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="thb-badge thb-badge-purple">{w.type}</span>
                  <span className={`thb-badge ${w.enabled ? 'thb-badge-success' : 'bg-slate-100 text-slate-600 thb-badge'}`}>
                    {w.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                {w.lastRun && (
                  <p className="text-xs text-thb-text-muted mt-2 flex items-center gap-1">
                    <FiClock className="w-3 h-3" /> Last run: {w.lastRun}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* ═══ CONFIGURATION TAB ═══ */}
      {activeTab === 'configuration' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-thb-text-secondary">Country, Currency & Language Configuration</h3>
              <p className="text-xs text-thb-text-muted mt-1">
                Configure which countries, currencies, and languages your tenant can access. Payroll policies, compliance, and tax slabs are auto-provisioned based on selected countries.
              </p>
            </div>
          </div>
          <Link
            href="/tenant-admin/tenant-configuration"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
          >
            <FiGlobe className="w-4 h-4" />
            Open Tenant Configuration
          </Link>
          <div className="thb-card p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-green-50 rounded-xl">
                <FiGlobe className="w-8 h-8 mx-auto text-green-500 mb-2" />
                <h4 className="font-semibold text-gray-900">Country Access</h4>
                <p className="text-xs text-gray-500 mt-1">Select which countries your operations cover. Payroll, compliance & tax policies are auto-configured.</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-xl">
                <FiDollarSign className="w-8 h-8 mx-auto text-green-500 mb-2" />
                <h4 className="font-semibold text-gray-900">Currency Setup</h4>
                <p className="text-xs text-gray-500 mt-1">Enable multi-currency payroll with exchange rate configuration and GL integration.</p>
              </div>
              <div className="text-center p-4 bg-teal-50 rounded-xl">
                <FiMessageSquare className="w-8 h-8 mx-auto text-teal-500 mb-2" />
                <h4 className="font-semibold text-gray-900">Language Support</h4>
                <p className="text-xs text-gray-500 mt-1">Enable UI localisation, document templates, and email translations in multiple languages.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
