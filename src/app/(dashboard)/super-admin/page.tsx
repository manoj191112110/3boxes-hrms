'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  FiServer, FiUsers, FiPlus, FiEdit2, FiEye, FiTrash2,
  FiX, FiSearch, FiRefreshCw, FiCreditCard, FiShield,
  FiGlobe, FiSettings, FiDollarSign, FiLayers, FiHome,
  FiActivity, FiClock, FiFileText,
  FiChevronLeft, FiChevronRight as FiChevronRightIcon,
  FiCheck, FiCalendar, FiDatabase, FiChevronDown, FiInfo,
  FiTrendingUp, FiMail, FiBriefcase, FiAlertTriangle, FiDownload,
  FiFilter, FiKey,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';
import { isClientLiveMode } from '@/lib/site-mode';
import { isTenantHiddenClient, PLATFORM_PLACEHOLDER_NAME } from '@/lib/tenant-filter';
import SrsBanner from '@/components/SrsBanner';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// ─── Interfaces ───────────────────────────────────────────
interface Tenant {
  id: string; name: string; slug: string; domain: string | null; plan: string; status: string;
  country: string | null; currency: string; timezone: string; createdAt: string; logo?: string | null;
  maxCompaniesAllowed?: number;
  _count?: { users: number; companyGroups: number; subscriptions: number; employees?: number };
  subscriptions?: { id: string; plan: { name: string }; status: string; startDate: string; endDate: string; amount: number }[];
  companyGroups?: { id: string; name: string; companies: { id: string; name: string; code: string | null; _count: { departments: number; branches: number; employees: number } }[] }[];
  users?: { id: string; name: string; email: string; role: string; status: string; lastLogin: string | null }[];
  employees?: { id: string; firstName: string; lastName: string; email: string; employeeId: string | null; status: string; department: string | null; designation: string | null; phone: string | null; createdAt: string; company?: { id: string; name: string } | null }[];
}

interface CompanyGroupRow {
  id: string;
  name: string;
  tenantId: string;
  tenantName?: string | null;
  tenantSlug?: string | null;
  employeeLimitMode: 'per_company' | 'group_total';
  maxEmployees: number | null;
  maxCompanies: number | null;
  notes?: string | null;
  createdAt: string;
  _count?: { companies: number; employees: number };
  companies?: {
    id: string;
    name: string;
    code: string | null;
    status: string;
    maxEmployees?: number | null;
    plannedEmployeeCount?: number | null;
    _count: { employees: number };
  }[];
}

interface SubscriptionPlan {
  id: string; name: string; planType: string; monthlyPrice: number; annualPrice: number;
  employeeLimit: number; companyLimit: number; branchLimit: number; storageLimit: number;
  aiInterviewLimit: number; aiChatbotLimit: number;
  payrollEnabled: boolean; recruitmentEnabled: boolean; attendanceEnabled: boolean;
  projectEnabled: boolean; clientPortalEnabled: boolean; vendorPortalEnabled: boolean;
  mobileAppEnabled: boolean; apiAccessEnabled: boolean; whiteLabelEnabled: boolean;
  supportLevel: string; status: string; description: string | null;
  _count?: { subscriptions: number };
}

interface AuditLog {
  id: string; userId: string; action: string; module: string; details: string; createdAt: string;
  user?: { id: string; name: string; email: string };
}

interface DashboardData {
  totalTenants: number; activeTenants: number; suspendedTenants: number; inactiveTenants: number;
  totalGroupCompanies?: number; totalCompanies: number; totalEmployees: number; totalRevenue: number; platformHealth: number;
  recentActivity: AuditLog[];
  // Dynamic chart & list data
  companiesByMonth?: { month: string; companies: number }[];
  revenueByMonth?: { month: string; revenue: number }[];
  topPlans?: { name: string; planType: string; count: number; total: number }[];
  recentTransactions?: { id: string; company: string; amount: string; status: string; date: string; currency: string }[];
  recentlyRegistered?: { id: string; name: string; plan: string; date: string }[];
  expiringSubscriptions?: { id: string; company: string; plan: string; expiredDate: string; email: string; tenantId: string }[];
  currencySymbol?: string;
  currencyCode?: string;
}

// ─── Badge Helpers ────────────────────────────────────────
const planBadgeCls: Record<string, string> = {
  starter: 'thb-badge thb-badge-info',
  professional: 'thb-badge thb-badge-primary',
  enterprise: 'thb-badge thb-badge-purple',
  global_enterprise: 'thb-badge thb-badge-purple',
  staffing: 'thb-badge thb-badge-warning',
  white_label: 'thb-badge thb-badge-error',
};

const statusBadgeCls: Record<string, string> = {
  active: 'thb-badge thb-badge-success',
  suspended: 'thb-badge thb-badge-warning',
  inactive: 'thb-badge thb-badge-error',
  pending_approval: 'thb-badge thb-badge-info',
};

const planTypeLabel: Record<string, string> = {
  starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise',
  global_enterprise: 'Global Enterprise', staffing: 'Staffing', white_label: 'White Label',
};

// ─── Main Component ───────────────────────────────────────
export default function SuperAdminPage() {
  const { user } = useAuthStore();
  const { hydrate: hydrateContext } = useCompanyContextStore();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tenants' | 'groups' | 'plans' | 'audit' | 'backups'>('dashboard');

  // Dashboard state
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashLoading, setDashLoading] = useState(true);

  // Tenant state
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [tenantSearch, setTenantSearch] = useState('');
  const [tenantStatusFilter, setTenantStatusFilter] = useState('');
  const [showTenantForm, setShowTenantForm] = useState(false);
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingTenant, setDeletingTenant] = useState(false);
  const [viewingTenantId, setViewingTenantId] = useState<string | null>(null);
  const [viewingTenant, setViewingTenant] = useState<Tenant | null>(null);
  const [submittingTenant, setSubmittingTenant] = useState(false);
  const [tenantForm, setTenantForm] = useState({
    name: '', slug: '', domain: '', plan: 'starter', country: '', currency: 'INR', timezone: 'UTC',
    adminName: '', adminEmail: '', adminPassword: '',
    maxCompaniesAllowed: 0, // 0 = unlimited
  });

  // Company Groups state (super admin creates group companies with employee strength barriers)
  const [groups, setGroups] = useState<CompanyGroupRow[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [submittingGroup, setSubmittingGroup] = useState(false);
  // Tenant filter for the Group Companies tab — lets the super admin scope the
  // groups list to a single tenant (so they can clearly see each tenant's
  // settings). Empty string = show groups across ALL tenants.
  const [groupTenantFilter, setGroupTenantFilter] = useState<string>('');
  const [groupForm, setGroupForm] = useState({
    tenantId: '',
    name: '',
    employeeLimitMode: 'group_total' as 'per_company' | 'group_total',
    maxEmployees: 0, // 0 = unlimited (will be sent as null)
    maxCompanies: 0, // 0 = unlimited (will be sent as null)
    notes: '',
  });

  // Plan state
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [showPlanForm, setShowPlanForm] = useState(false);

  // Reset & Backup state
  const [resettingTenantEmployees, setResettingTenantEmployees] = useState<string | null>(null);
  const [backingUpTenant, setBackingUpTenant] = useState<string | null>(null);
  const [purgingTenantDuplicates, setPurgingTenantDuplicates] = useState<string | null>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [deletePlanConfirmId, setDeletePlanConfirmId] = useState<string | null>(null);
  const [deletingPlan, setDeletingPlan] = useState(false);
  const [viewingPlanId, setViewingPlanId] = useState<string | null>(null);
  const [viewingPlan, setViewingPlan] = useState<SubscriptionPlan | null>(null);
  const [submittingPlan, setSubmittingPlan] = useState(false);
  const [planForm, setPlanForm] = useState({
    name: '', planType: 'starter', description: '',
    monthlyPrice: 0, annualPrice: 0,
    employeeLimit: 50, companyLimit: 1, branchLimit: 5, storageLimit: 1000,
    aiInterviewLimit: 10, aiChatbotLimit: 100,
    payrollEnabled: true, recruitmentEnabled: true, attendanceEnabled: true,
    projectEnabled: false, clientPortalEnabled: false, vendorPortalEnabled: false,
    mobileAppEnabled: false, apiAccessEnabled: false, whiteLabelEnabled: false,
    supportLevel: 'email', status: 'active',
  });

  // ─── Apply Plan (subscription) state ───
  // Lets the super admin pick a plan + a tenant (a.k.a. "group company parent")
  // and create a Subscription record linking them.
  const [showApplyPlan, setShowApplyPlan] = useState<string | null>(null); // planId when open
  const [applyForm, setApplyForm] = useState({
    tenantId: '',
    billingCycle: 'monthly' as 'monthly' | 'annual',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    amount: 0,
    autoRenew: true,
  });
  const [applyingPlan, setApplyingPlan] = useState(false);

  // Audit state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditAction, setAuditAction] = useState('');
  const [auditModule, setAuditModule] = useState('');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');
  const [auditSearch, setAuditSearch] = useState('');

  // Cleanup demo data state
  const [cleaningUp, setCleaningUp] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<Record<string, unknown> | null>(null);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [cleanupTargetSlug, setCleanupTargetSlug] = useState('');

  const formRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);

  // ─── Data Fetching ──────────────────────────────────────
  const fetchDashboard = useCallback(async () => {
    try {
      setDashLoading(true);
      const res = await fetch('/api/super-admin/dashboard', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDashboard(data);
      }
    } catch { toast.error('Failed to load dashboard'); }
    finally { setDashLoading(false); }
  }, []);

  const fetchTenants = useCallback(async () => {
    try {
      setTenantsLoading(true);
      const params = new URLSearchParams();
      if (tenantSearch) params.set('search', tenantSearch);
      if (tenantStatusFilter) params.set('status', tenantStatusFilter);
      const res = await fetch(`/api/tenants?${params.toString()}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const all = Array.isArray(data) ? data : data.tenants || [];
        // Defense-in-depth: filter out hidden tenants on the client side too
        setTenants(all.filter((t: Tenant) =>
          !isTenantHiddenClient(t.slug) && !(t.name || '').includes(PLATFORM_PLACEHOLDER_NAME)
        ));
      }
    } catch { toast.error('Failed to load tenants'); }
    finally { setTenantsLoading(false); }
  }, [tenantSearch, tenantStatusFilter]);

  const fetchPlans = useCallback(async () => {
    try {
      setPlansLoading(true);
      const res = await fetch('/api/subscriptions/plans', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setPlans(Array.isArray(data) ? data : data.plans || []);
      }
    } catch { toast.error('Failed to load plans'); }
    finally { setPlansLoading(false); }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    try {
      setAuditLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(auditPage));
      params.set('limit', '15');
      if (auditAction) params.set('action', auditAction);
      if (auditModule) params.set('module', auditModule);
      if (auditStartDate) params.set('startDate', auditStartDate);
      if (auditEndDate) params.set('endDate', auditEndDate);
      const res = await fetch(`/api/super-admin/audit-logs?${params.toString()}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
        setAuditTotalPages(data.pagination?.totalPages || 1);
        setAuditTotal(data.pagination?.total || 0);
      }
    } catch { toast.error('Failed to load audit logs'); }
    finally { setAuditLoading(false); }
  }, [auditPage, auditAction, auditModule, auditStartDate, auditEndDate]);

  // ─── Cleanup Demo Data ────────────────────────────────────
  const handleCleanupDemoData = useCallback(async (tenantSlug: string) => {
    try {
      setCleaningUp(true);
      setCleanupResult(null);
      const res = await fetch('/api/admin/cleanup-sample-data', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ tenantSlug }),
      });
      const data = await res.json();
      if (res.ok) {
        setCleanupResult(data);
        toast.success(`Demo data cleaned for ${tenantSlug}`);
        fetchDashboard();
        fetchTenants();
      } else {
        toast.error(data.error || 'Cleanup failed');
      }
    } catch {
      toast.error('Failed to clean up demo data');
    } finally {
      setCleaningUp(false);
      setShowCleanupConfirm(false);
    }
  }, [fetchDashboard, fetchTenants]);

  useEffect(() => {
    queueMicrotask(() => fetchDashboard());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'tenants' || activeTab === 'groups') queueMicrotask(() => fetchTenants());
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'plans') queueMicrotask(() => fetchPlans());
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'groups') queueMicrotask(() => fetchGroups());
  }, [activeTab, groupTenantFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'audit') queueMicrotask(() => fetchAuditLogs());
  }, [activeTab, auditPage, auditAction, auditModule, auditStartDate, auditEndDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch backup records
  const fetchBackups = useCallback(async () => {
    try {
      setBackupsLoading(true);
      const res = await fetch('/api/admin/backup-tenant', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups || []);
      }
    } catch {
      // ignore
    } finally {
      setBackupsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'backups') queueMicrotask(() => fetchBackups());
  }, [activeTab, fetchBackups]);

  // Scroll to view/form panel
  useEffect(() => {
    if (viewingTenantId || viewingPlanId) {
      setTimeout(() => viewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  }, [viewingTenantId, viewingPlanId]);

  useEffect(() => {
    if (showTenantForm || showPlanForm) {
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  }, [showTenantForm, showPlanForm]);

  // ─── Tenant Handlers ────────────────────────────────────
  const handleViewTenant = async (id: string) => {
    try {
      const res = await fetch(`/api/tenants/${id}`, { headers: getAuthHeaders() });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || `Failed to load tenant (HTTP ${res.status})`);
        return;
      }
      const data = await res.json();
      // API returns { tenant: {...} }. Fall back to data for safety.
      const tenant = data.tenant || data;
      if (!tenant || !tenant.id) {
        toast.error('Tenant details not found in response');
        return;
      }
      setViewingTenant(tenant);
      setViewingTenantId(id);
      setShowTenantForm(false);
      setEditingTenantId(null);
      // Scroll into view on next tick so the panel is visible to the user
      setTimeout(() => viewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (err) {
      console.error('handleViewTenant error:', err);
      toast.error('Failed to load tenant details');
    }
  };

  const handleEditTenant = (tenant: Tenant) => {
    setEditingTenantId(tenant.id);
    setShowTenantForm(true);
    setViewingTenantId(null);
    setViewingTenant(null);
    setTenantForm({
      name: tenant.name, slug: tenant.slug, domain: tenant.domain || '',
      plan: tenant.plan, country: tenant.country || '', currency: tenant.currency,
      timezone: tenant.timezone, adminName: '', adminEmail: '', adminPassword: '',
      maxCompaniesAllowed: tenant.maxCompaniesAllowed ?? 0,
    });
  };

  const handleEditTenantFromView = () => {
    if (viewingTenant) {
      handleEditTenant(viewingTenant);
    }
  };

  const handleCancelTenantForm = () => {
    setShowTenantForm(false);
    setEditingTenantId(null);
    setTenantForm({ name: '', slug: '', domain: '', plan: 'starter', country: '', currency: 'INR', timezone: 'UTC', adminName: '', adminEmail: '', adminPassword: '', maxCompaniesAllowed: 0 });
  };

  const handleSubmitTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantForm.name || !tenantForm.slug) {
      toast.error('Name and slug are required');
      return;
    }
    if (!editingTenantId && (!tenantForm.adminName || !tenantForm.adminEmail || !tenantForm.adminPassword)) {
      toast.error('Admin name, email, and password are required for new tenants');
      return;
    }
    setSubmittingTenant(true);
    try {
      const url = editingTenantId ? `/api/tenants/${editingTenantId}` : '/api/tenants';
      const method = editingTenantId ? 'PATCH' : 'POST';
      // Always send maxCompaniesAllowed (0 = unlimited) so the questionnaire value is persisted
      const body = editingTenantId
        ? {
            name: tenantForm.name, slug: tenantForm.slug, domain: tenantForm.domain || null,
            plan: tenantForm.plan, country: tenantForm.country || null,
            currency: tenantForm.currency, timezone: tenantForm.timezone,
            maxCompaniesAllowed: Number(tenantForm.maxCompaniesAllowed) || 0,
          }
        : { ...tenantForm, maxCompaniesAllowed: Number(tenantForm.maxCompaniesAllowed) || 0 };
      const res = await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success(editingTenantId ? 'Tenant updated' : 'Tenant created');
      handleCancelTenantForm();
      fetchTenants();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Operation failed'); }
    finally { setSubmittingTenant(false); }
  };

  const handleDeleteTenant = async (id: string) => {
    setDeletingTenant(true);
    try {
      const res = await fetch(`/api/tenants/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Tenant deleted');
      setDeleteConfirmId(null);
      fetchTenants();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Delete failed'); }
    finally { setDeletingTenant(false); }
  };

  const handleTenantStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/tenants/${id}`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ status: newStatus }) });
      if (!res.ok) throw new Error('Failed');
      toast.success(`Tenant ${newStatus === 'active' ? 'activated' : 'suspended'}`);
      fetchTenants();
    } catch { toast.error('Action failed'); }
  };

  // ─── Reset Tenant Employees ────────────────────────────
  const handleResetTenantEmployees = async (slug: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ALL employees from "${name}" except the admin user? This cannot be undone.`)) return;
    try {
      setResettingTenantEmployees(slug);
      const res = await fetch('/api/admin/cleanup-employees', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ tenantSlug: slug }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed');
      }
      const data = await res.json();
      toast.success(`Deleted ${data.deleted} employees from ${name}. Kept: ${data.keptEmployee || 'admin'}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reset employees');
    } finally {
      setResettingTenantEmployees(null);
    }
  };

  // ─── Backup Tenant Database ────────────────────────────
  const handleBackupTenantDB = async (slug: string, name: string) => {
    try {
      setBackingUpTenant(slug);
      const res = await fetch('/api/admin/backup-tenant', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ tenantSlug: slug }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed');
      }
      const data = await res.json();
      toast.success(`Backup completed for ${name}. ${data.totalRecords || 0} records saved to repository.`);
      // Refresh backup list if we're on the backups tab
      fetchBackups();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to backup database');
    } finally {
      setBackingUpTenant(null);
    }
  };

  // ─── Purge Duplicate Employees & Sync Users ────────────────────────────
  // One-click fix for:
  //   1. Duplicate employee records in the credentials page (same email, different IDs)
  //   2. Password reset not working (user exists in both DBs but password only
  //      updated in one)
  // The endpoint finds duplicate Employee rows and deletes the orphans (keeping
  // the one with a userId / login account), and syncs passwords from the tenant
  // DB → platform DB so login (which checks platform DB first) always uses the
  // most recently reset password.
  const handlePurgeDuplicates = async (slug: string, name: string) => {
    if (!confirm(`Purge duplicate employee records and sync user passwords for "${name}"?\n\nThis will:\n• Delete duplicate employee records (keeping the one with a login account)\n• Sync passwords from tenant DB → platform DB so login works correctly\n\nThis is safe and cannot break anything.`)) return;
    try {
      setPurgingTenantDuplicates(slug);
      const res = await fetch(`/api/admin/purge-duplicates?tenantSlug=${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed');
      }
      const data = await res.json();
      const s = data.summary || {};
      toast.success(
        `Purge complete: deleted ${s.duplicateEmployeesDeleted || 0} duplicates, synced ${s.duplicateUsersSynced || 0} users.`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to purge duplicates');
    } finally {
      setPurgingTenantDuplicates(null);
    }
  };

  // ─── Reset All Demo Passwords ────────────────────────────
  // Bulk-reset ALL users in the demo tenant to a known password ('MarqAI@2026'
  // by default). Updates BOTH the tenant DB and platform DB so login works.
  // Use this when demo login credentials don't work after a re-seed.
  const [resettingPasswords, setResettingPasswords] = useState<string | null>(null);
  const handleResetAllPasswords = async (slug: string, name: string) => {
    const pwd = prompt(`Reset ALL user passwords in "${name}" to a known password?\n\nEnter the new password (or click OK to use default 'MarqAI@2026'):`, 'MarqAI@2026');
    if (!pwd) return;
    try {
      setResettingPasswords(slug);
      const res = await fetch(`/api/admin/reset-demo-passwords?tenantSlug=${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed');
      }
      const data = await res.json();
      const s = data.summary || {};
      toast.success(
        `Reset complete: ${s.tenantDbUpdated || 0} users updated in tenant DB, ${s.platformDbUpdated || 0} synced to platform DB. Password: '${s.password}'`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reset passwords');
    } finally {
      setResettingPasswords(null);
    }
  };

  // ─── Company Group Handlers ───────────────────────────
  const fetchGroups = useCallback(async () => {
    try {
      setGroupsLoading(true);
      // Pass ?tenantId= filter when the super admin has selected a specific tenant.
      // Without the filter, the API returns groups across ALL tenants.
      const url = groupTenantFilter
        ? `/api/company-groups?tenantId=${encodeURIComponent(groupTenantFilter)}`
        : '/api/company-groups';
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const allGroups = data.groups || [];
        // Defense-in-depth: filter out groups belonging to hidden tenants
        setGroups(allGroups.filter((g: CompanyGroupRow) =>
          !isTenantHiddenClient(g.tenantSlug || '') && !(g.tenantName || '').includes(PLATFORM_PLACEHOLDER_NAME)
        ));
      } else {
        setGroups([]);
      }
    } catch {
      toast.error('Failed to load group companies');
      setGroups([]);
    } finally {
      setGroupsLoading(false);
    }
  }, [groupTenantFilter]);

  const handleCancelGroupForm = () => {
    setShowGroupForm(false);
    setEditingGroupId(null);
    setGroupForm({ tenantId: '', name: '', employeeLimitMode: 'group_total', maxEmployees: 0, maxCompanies: 0, notes: '' });
  };

  const handleEditGroup = (g: CompanyGroupRow) => {
    setEditingGroupId(g.id);
    setShowGroupForm(true);
    setGroupForm({
      tenantId: g.tenantId,
      name: g.name,
      employeeLimitMode: g.employeeLimitMode === 'per_company' ? 'per_company' : 'group_total',
      maxEmployees: g.maxEmployees ?? 0,
      maxCompanies: g.maxCompanies ?? 0,
      notes: g.notes || '',
    });
  };

  const handleSubmitGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupForm.name.trim()) { toast.error('Group company name is required'); return; }
    if (!groupForm.tenantId) { toast.error('Please select a tenant under which to create this group'); return; }
    setSubmittingGroup(true);
    try {
      const payload = {
        tenantId: groupForm.tenantId,
        name: groupForm.name.trim(),
        employeeLimitMode: groupForm.employeeLimitMode,
        maxEmployees: Number(groupForm.maxEmployees) > 0 ? Number(groupForm.maxEmployees) : null,
        maxCompanies: Number(groupForm.maxCompanies) > 0 ? Number(groupForm.maxCompanies) : null,
        notes: groupForm.notes?.trim() || null,
      };
      const url = editingGroupId ? `/api/company-groups/${editingGroupId}` : '/api/company-groups';
      const method = editingGroupId ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success(editingGroupId ? 'Group company updated' : 'Group company created');
      handleCancelGroupForm();
      // Re-fetch the groups list (this page's view) AND refresh the company
      // context store so the header CompanySwitcher reflects the new group.
      fetchGroups();
      hydrateContext(true);
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Operation failed'); }
    finally { setSubmittingGroup(false); }
  };

  const handleDeleteGroup = async (id: string, name: string) => {
    if (!confirm(`Delete group company "${name}"? This is only allowed if the group has no companies attached.`)) return;
    try {
      const res = await fetch(`/api/company-groups/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Group company deleted');
      fetchGroups();
      hydrateContext(true);
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Delete failed'); }
  };

  // ─── Apply Plan (subscription) Handler ───────────────────
  // Creates a Subscription record linking a plan to a tenant. The tenant
  // dropdown shows all tenants — i.e. the "group company parent" names that
  // the subscription plan can be applied to.
  const openApplyPlan = (plan: SubscriptionPlan) => {
    setShowApplyPlan(plan.id);
    const today = new Date();
    const end = new Date(today);
    end.setFullYear(end.getFullYear() + 1);
    setApplyForm({
      tenantId: tenants[0]?.id || '',
      billingCycle: 'monthly',
      startDate: today.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      amount: plan.monthlyPrice,
      autoRenew: true,
    });
  };

  const handleSubmitApplyPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyForm.tenantId) { toast.error('Please select a tenant (group company parent)'); return; }
    if (!applyForm.startDate || !applyForm.endDate) { toast.error('Start and end dates are required'); return; }
    if (!showApplyPlan) return;
    setApplyingPlan(true);
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          planId: showApplyPlan,
          tenantId: applyForm.tenantId,
          billingCycle: applyForm.billingCycle,
          startDate: applyForm.startDate,
          endDate: applyForm.endDate,
          amount: Number(applyForm.amount) || 0,
          autoRenew: applyForm.autoRenew,
        }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed'); }
      const tenantName = tenants.find((t) => t.id === applyForm.tenantId)?.name || 'tenant';
      toast.success(`Plan applied to "${tenantName}" successfully`);
      setShowApplyPlan(null);
      fetchPlans();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to apply plan');
    } finally {
      setApplyingPlan(false);
    }
  };

  // ─── Plan Handlers ──────────────────────────────────────
  const handleViewPlan = async (id: string) => {
    try {
      const res = await fetch(`/api/subscriptions/plans/${id}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setViewingPlan(data.plan || data);
        setViewingPlanId(id);
        setShowPlanForm(false);
        setEditingPlanId(null);
      }
    } catch { toast.error('Failed to load plan details'); }
  };

  const handleEditPlan = (plan: SubscriptionPlan) => {
    setEditingPlanId(plan.id);
    setShowPlanForm(true);
    setViewingPlanId(null);
    setViewingPlan(null);
    setPlanForm({
      name: plan.name, planType: plan.planType, description: plan.description || '',
      monthlyPrice: plan.monthlyPrice, annualPrice: plan.annualPrice,
      employeeLimit: plan.employeeLimit, companyLimit: plan.companyLimit,
      branchLimit: plan.branchLimit, storageLimit: plan.storageLimit,
      aiInterviewLimit: plan.aiInterviewLimit, aiChatbotLimit: plan.aiChatbotLimit,
      payrollEnabled: plan.payrollEnabled, recruitmentEnabled: plan.recruitmentEnabled,
      attendanceEnabled: plan.attendanceEnabled, projectEnabled: plan.projectEnabled,
      clientPortalEnabled: plan.clientPortalEnabled, vendorPortalEnabled: plan.vendorPortalEnabled,
      mobileAppEnabled: plan.mobileAppEnabled, apiAccessEnabled: plan.apiAccessEnabled,
      whiteLabelEnabled: plan.whiteLabelEnabled, supportLevel: plan.supportLevel,
      status: plan.status,
    });
  };

  const handleEditPlanFromView = () => {
    if (viewingPlan) handleEditPlan(viewingPlan);
  };

  const handleCancelPlanForm = () => {
    setShowPlanForm(false);
    setEditingPlanId(null);
    setPlanForm({
      name: '', planType: 'starter', description: '',
      monthlyPrice: 0, annualPrice: 0,
      employeeLimit: 50, companyLimit: 1, branchLimit: 5, storageLimit: 1000,
      aiInterviewLimit: 10, aiChatbotLimit: 100,
      payrollEnabled: true, recruitmentEnabled: true, attendanceEnabled: true,
      projectEnabled: false, clientPortalEnabled: false, vendorPortalEnabled: false,
      mobileAppEnabled: false, apiAccessEnabled: false, whiteLabelEnabled: false,
      supportLevel: 'email', status: 'active',
    });
  };

  const handleSubmitPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planForm.name || !planForm.planType) {
      toast.error('Name and plan type are required');
      return;
    }
    setSubmittingPlan(true);
    try {
      const url = editingPlanId ? `/api/subscriptions/plans/${editingPlanId}` : '/api/subscriptions/plans';
      const method = editingPlanId ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(planForm) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success(editingPlanId ? 'Plan updated' : 'Plan created');
      handleCancelPlanForm();
      fetchPlans();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Operation failed'); }
    finally { setSubmittingPlan(false); }
  };

  const handleDeletePlan = async (id: string) => {
    setDeletingPlan(true);
    try {
      const res = await fetch(`/api/subscriptions/plans/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Plan deleted');
      setDeletePlanConfirmId(null);
      fetchPlans();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Delete failed'); }
    finally { setDeletingPlan(false); }
  };

  // ─── Access Guard ───────────────────────────────────────
  if (user?.role !== 'super_admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <FiShield className="w-16 h-16 text-thb-text-muted" />
        <h2 className="text-xl font-semibold text-thb-text-primary">Access Restricted</h2>
        <p className="text-thb-text-secondary">This page is only accessible to Super Admins.</p>
      </div>
    );
  }

  // ─── Tab Config ─────────────────────────────────────────
  const tabs = [
    { key: 'dashboard' as const, label: 'Dashboard', icon: <FiActivity className="w-4 h-4" /> },
    { key: 'tenants' as const, label: 'Tenants', icon: <FiServer className="w-4 h-4" /> },
    { key: 'groups' as const, label: 'Group Companies', icon: <FiLayers className="w-4 h-4" /> },
    { key: 'plans' as const, label: 'Subscription Plans', icon: <FiCreditCard className="w-4 h-4" /> },
    { key: 'audit' as const, label: 'Audit Logs', icon: <FiFileText className="w-4 h-4" /> },
    { key: 'backups' as const, label: 'Backup Repository', icon: <FiDatabase className="w-4 h-4" /> },
  ];

  // ─── Input/Select helpers ───────────────────────────────
  const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400';
  const labelCls = 'block text-xs font-medium text-thb-text-secondary mb-1';
  const selectCls = 'w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 bg-white';

  // ═════════════════════════════════════════════════════════
  //  RENDER
  // ═════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary">Super Admin Dashboard</h1>
          <p className="text-thb-text-secondary mt-1">Platform management &amp; tenant administration</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {/* Quick tenant switcher — visible on every tab so super admin can
              quickly switch the "active tenant" they're inspecting. */}
          {tenants.length > 0 && (
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-semibold text-thb-text-muted uppercase tracking-wider">Viewing tenant:</label>
              <select
                value={groupTenantFilter}
                onChange={(e) => setGroupTenantFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-thb-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 cursor-pointer max-w-[220px]"
                title="Filter Group Companies tab by tenant"
              >
                <option value="">All tenants ({tenants.length})</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {activeTab === 'tenants' && !showTenantForm && (
            <button onClick={() => { setShowTenantForm(true); setEditingTenantId(null); setTenantForm({ name: '', slug: '', domain: '', plan: 'starter', country: '', currency: 'INR', timezone: 'UTC', adminName: '', adminEmail: '', adminPassword: '', maxCompaniesAllowed: 0 }); }} className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white hover:bg-green-600 shadow-sm shadow-green-500/25 rounded-lg font-medium text-sm transition-colors">
              <FiPlus className="w-4 h-4" /> Add Tenant
            </button>
          )}
          {activeTab === 'groups' && !showGroupForm && (
            <button
              onClick={() => {
                setShowGroupForm(true);
                setEditingGroupId(null);
                setGroupForm({ tenantId: groupTenantFilter || tenants[0]?.id || '', name: '', employeeLimitMode: 'group_total', maxEmployees: 0, maxCompanies: 0, notes: '' });
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-500 text-white hover:bg-teal-600 shadow-sm shadow-teal-500/25 rounded-lg font-medium text-sm transition-colors"
            >
              <FiPlus className="w-4 h-4" /> New Group Company
            </button>
          )}
          {activeTab === 'plans' && !showPlanForm && (
            <button onClick={() => { setShowPlanForm(true); setEditingPlanId(null); setPlanForm({ name: '', planType: 'starter', description: '', monthlyPrice: 0, annualPrice: 0, employeeLimit: 50, companyLimit: 1, branchLimit: 5, storageLimit: 1000, aiInterviewLimit: 10, aiChatbotLimit: 100, payrollEnabled: true, recruitmentEnabled: true, attendanceEnabled: true, projectEnabled: false, clientPortalEnabled: false, vendorPortalEnabled: false, mobileAppEnabled: false, apiAccessEnabled: false, whiteLabelEnabled: false, supportLevel: 'email', status: 'active' }); }} className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white hover:bg-green-600 shadow-sm shadow-green-500/25 rounded-lg font-medium text-sm transition-colors">
              <FiPlus className="w-4 h-4" /> Add Plan
            </button>
          )}
        </div>
      </div>

      {/* SRS-aligned role banner — shows what this role can/can't do per spec */}
      <SrsBanner role="super_admin" />

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit overflow-x-auto">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.key ? 'bg-white shadow-sm text-thb-text-primary' : 'text-thb-text-secondary hover:text-thb-text-primary'}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB 1: DASHBOARD ═══ */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Empty-state CTA */}
          {dashboard && dashboard.totalTenants === 0 && (
            <div className="thb-card p-6 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center flex-shrink-0">
                  <FiDatabase className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-emerald-900">Welcome to your Super Admin dashboard</h3>
                  <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                    Your platform doesn&rsquo;t have any tenants yet. Use the <b>Tenants</b> tab to create your first tenant, 
                    or wait for trial registrations to come in for approval.
                  </p>
                </div>
              </div>
            </div>
          )}
          {dashLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="thb-card p-5 animate-pulse">
                  <div className="h-4 w-24 bg-slate-200 rounded mb-2" />
                  <div className="h-8 w-16 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          ) : dashboard ? (
            <>
              {/* ─── Welcome Banner ─── */}
              <div className="thb-card p-6 bg-gradient-to-r from-green-600 via-teal-600 to-teal-600 border-0 overflow-hidden relative">
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-4 right-8 w-32 h-32 bg-white rounded-full blur-3xl" />
                  <div className="absolute bottom-2 left-12 w-24 h-24 bg-white rounded-full blur-2xl" />
                </div>
                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      Welcome back, {user?.name || 'Super Admin'}
                    </h2>
                    <p className="text-green-100 mt-1 text-sm">
                      Here&apos;s what&apos;s happening across your 3Boxes HRMS platform today.
                    </p>
                  </div>
                </div>
              </div>

              {/* ─── Stat Cards (Dynamic) ─── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="thb-card p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-thb-text-muted">Total Companies</p>
                      <p className="text-2xl font-bold text-thb-text-primary mt-1">{dashboard.totalCompanies}</p>
                      <div className="flex items-center gap-1 mt-1"><FiTrendingUp className="w-3 h-3 text-emerald-500" /><span className="text-[10px] text-emerald-600 font-medium">{dashboard.activeTenants}/{dashboard.totalTenants} active</span></div>
                    </div>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-50 text-green-500"><FiBriefcase className="w-5 h-5" /></div>
                  </div>
                </div>
                <div className="thb-card p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-thb-text-muted">Active Tenants</p>
                      <p className="text-2xl font-bold text-thb-text-primary mt-1">{dashboard.activeTenants}</p>
                      <div className="flex items-center gap-1 mt-1"><FiTrendingUp className="w-3 h-3 text-emerald-500" /><span className="text-[10px] text-emerald-600 font-medium">{dashboard.activeTenants}/{dashboard.totalTenants} tenants active</span></div>
                    </div>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-500"><FiActivity className="w-5 h-5" /></div>
                  </div>
                </div>
                <div className="thb-card p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-thb-text-muted">Total Tenants</p>
                      <p className="text-2xl font-bold text-thb-text-primary mt-1">{dashboard.totalTenants}</p>
                      <div className="flex gap-1 mt-1">
                        <span className="thb-badge thb-badge-success text-[10px]">{dashboard.activeTenants} active</span>
                        <span className="thb-badge thb-badge-warning text-[10px]">{dashboard.suspendedTenants} suspended</span>
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-teal-50 text-teal-500"><FiUsers className="w-5 h-5" /></div>
                  </div>
                </div>
                <div className="thb-card p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-thb-text-muted">Total Earnings</p>
                      <p className="text-2xl font-bold text-thb-text-primary mt-1">{dashboard.currencySymbol || (isClientLiveMode() ? '₹' : '$')}{dashboard.totalRevenue.toLocaleString()}</p>
                      <div className="flex items-center gap-1 mt-1"><FiTrendingUp className="w-3 h-3 text-emerald-500" /><span className="text-[10px] text-emerald-600 font-medium">{dashboard.currencyCode || (isClientLiveMode() ? 'INR' : 'USD')}</span></div>
                    </div>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-500"><FiDollarSign className="w-5 h-5" /></div>
                  </div>
                </div>
              </div>

              {/* ─── Charts Row (Dynamic) ─── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Companies Chart */}
                <div className="thb-card p-5">
                  <h3 className="font-semibold text-thb-text-primary mb-4 flex items-center gap-2"><FiBriefcase className="w-4 h-4" /> Tenants by Month</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboard.companiesByMonth && dashboard.companiesByMonth.length > 0 ? dashboard.companiesByMonth : [{ month: '-', companies: 0 }]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94A3B8" />
                        <YAxis tick={{ fontSize: 12 }} stroke="#94A3B8" allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="companies" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Revenue Chart */}
                <div className="thb-card p-5">
                  <h3 className="font-semibold text-thb-text-primary mb-4 flex items-center gap-2"><FiTrendingUp className="w-4 h-4" /> Revenue Trend</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dashboard.revenueByMonth && dashboard.revenueByMonth.length > 0 ? dashboard.revenueByMonth : [{ month: '-', revenue: 0 }]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94A3B8" />
                        <YAxis tick={{ fontSize: 12 }} stroke="#94A3B8" tickFormatter={(v) => `${dashboard.currencySymbol || (isClientLiveMode() ? '₹' : '$')}${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(value: number) => [`${dashboard.currencySymbol || (isClientLiveMode() ? '₹' : '$')}${value.toLocaleString()}`, 'Revenue']} />
                        <defs>
                          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="revenue" stroke="#8B5CF6" strokeWidth={2} fill="url(#revenueGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* ─── Bottom Row: Top Plans + Recent Transactions + Recently Registered (Dynamic) ─── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top Plans */}
                <div className="thb-card p-5">
                  <h3 className="font-semibold text-thb-text-primary mb-4 flex items-center gap-2"><FiLayers className="w-4 h-4" /> Top Plans</h3>
                  {(!dashboard.topPlans || dashboard.topPlans.length === 0) ? (
                    <p className="text-sm text-thb-text-muted text-center py-4">No active plans</p>
                  ) : (
                  <div className="space-y-4">
                    {dashboard.topPlans.map((plan) => {
                      const barColors: Record<string, string> = { enterprise: 'bg-teal-500', global_enterprise: 'bg-teal-500', professional: 'bg-green-500', starter: 'bg-emerald-500', staffing: 'bg-amber-500', white_label: 'bg-purple-500' };
                      return (
                      <div key={plan.name}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-thb-text-primary font-medium">{plan.name}</span>
                          <span className="text-thb-text-muted">{plan.count} subscriber{plan.count !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${barColors[plan.planType] || 'bg-blue-500'}`} style={{ width: `${plan.total > 0 ? (plan.count / plan.total) * 100 : 0}%` }} />
                        </div>
                      </div>
                      );
                    })}
                  </div>
                  )}
                </div>

                {/* Recent Transactions (Dynamic) */}
                <div className="thb-card p-5">
                  <h3 className="font-semibold text-thb-text-primary mb-4 flex items-center gap-2"><FiCreditCard className="w-4 h-4" /> Recent Transactions</h3>
                  {(!dashboard.recentTransactions || dashboard.recentTransactions.length === 0) ? (
                    <p className="text-sm text-thb-text-muted text-center py-4">No transactions</p>
                  ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto">
                    {dashboard.recentTransactions.map((txn) => {
                      const sym = txn.currency === 'INR' ? '₹' : '$';
                      return (
                      <div key={txn.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-thb-text-primary font-medium truncate">{txn.company}</p>
                          <p className="text-[10px] text-thb-text-muted">{txn.date}</p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <p className="text-sm font-semibold text-thb-text-primary">{sym}{Number(txn.amount).toLocaleString()}</p>
                          <span className={`thb-badge text-[10px] ${txn.status === 'paid' ? 'thb-badge-success' : txn.status === 'pending' ? 'thb-badge-warning' : txn.status === 'overdue' ? 'thb-badge-error' : 'thb-badge-info'}`}>{txn.status}</span>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                  )}
                </div>

                {/* Recently Registered (Dynamic) */}
                <div className="thb-card p-5">
                  <h3 className="font-semibold text-thb-text-primary mb-4 flex items-center gap-2"><FiUsers className="w-4 h-4" /> Recently Registered</h3>
                  {(!dashboard.recentlyRegistered || dashboard.recentlyRegistered.length === 0) ? (
                    <p className="text-sm text-thb-text-muted text-center py-4">No recent registrations</p>
                  ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto">
                    {dashboard.recentlyRegistered.map((reg) => (
                      <div key={reg.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-500 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">
                          {reg.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-thb-text-primary font-medium truncate">{reg.name}</p>
                          <p className="text-[10px] text-thb-text-muted">{reg.date}</p>
                        </div>
                        <span className="thb-badge thb-badge-info text-[10px]">{reg.plan}</span>
                      </div>
                    ))}
                  </div>
                  )}
                </div>
              </div>

              {/* ─── Expiring Subscriptions (Dynamic) ─── */}
              <div className="thb-card p-5">
                <h3 className="font-semibold text-thb-text-primary mb-4 flex items-center gap-2"><FiClock className="w-4 h-4" /> Expiring Subscriptions</h3>
                {(!dashboard.expiringSubscriptions || dashboard.expiringSubscriptions.length === 0) ? (
                  <p className="text-sm text-thb-text-muted text-center py-4">No expiring subscriptions</p>
                ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {dashboard.expiringSubscriptions.map((exp) => (
                    <div key={exp.id} className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                          {exp.company[0]}
                        </div>
                        <div>
                          <p className="text-sm text-thb-text-primary font-medium">{exp.company}</p>
                          <p className="text-[10px] text-thb-text-muted">{exp.plan} · Expires {exp.expiredDate}</p>
                        </div>
                      </div>
                      {exp.email && (
                      <button
                        onClick={() => toast.success(`Reminder sent to ${exp.email}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-colors"
                      >
                        <FiMail className="w-3.5 h-3.5" /> Send Reminder
                      </button>
                      )}
                    </div>
                  ))}
                </div>
                )}
              </div>

              {/* ─── Original KPI + Activity (compact) ─── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Compact KPI */}
                <div className="thb-card p-5">
                  <h3 className="font-semibold text-thb-text-primary mb-4 flex items-center gap-2"><FiServer className="w-4 h-4" /> Platform Overview</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-[10px] text-thb-text-muted">Total Tenants</p>
                      <p className="text-lg font-bold text-thb-text-primary">{dashboard.totalTenants}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-[10px] text-thb-text-muted">Group Companies</p>
                      <p className="text-lg font-bold text-thb-text-primary">{dashboard.totalGroupCompanies ?? 0}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-[10px] text-thb-text-muted">Total Employees</p>
                      <p className="text-lg font-bold text-thb-text-primary">{dashboard.totalEmployees}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-[10px] text-thb-text-muted">Health</p>
                      <p className="text-lg font-bold text-emerald-600">{dashboard.platformHealth}%</p>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="thb-card p-5">
                  <h3 className="font-semibold text-thb-text-primary mb-4 flex items-center gap-2"><FiClock className="w-4 h-4" /> Recent Activity</h3>
                  {dashboard.recentActivity.length === 0 ? (
                    <div className="text-center py-6 text-thb-text-muted"><FiFileText className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm">No recent activity</p></div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {dashboard.recentActivity.map((log) => (
                        <div key={log.id} className="flex items-start gap-2 p-2 rounded-lg bg-slate-50">
                          <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">
                            {log.user?.name?.[0] || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-thb-text-primary font-medium">{log.user?.name || 'System'}</p>
                            <p className="text-[10px] text-thb-text-secondary truncate">{log.details || log.action}</p>
                          </div>
                          <span className="thb-badge thb-badge-info text-[9px] flex-shrink-0">{log.action.replace(/_/g, ' ')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
          {/* ═══ CLEANUP DEMO DATA ═══ */}
          <div className="thb-card p-6 border-amber-200 bg-amber-50/30">
            <h3 className="font-semibold text-thb-text-primary mb-3 flex items-center gap-2">
              <FiTrash2 className="w-4 h-4 text-amber-600" /> Cleanup Demo / Sample Data
            </h3>
            <p className="text-xs text-thb-text-secondary mb-4 leading-relaxed">
              Remove all dummy/sample/demo data from production tenants. This keeps structural data
              (companies, departments, master configs) but deletes sample employees, transactions,
              and all auto-seeded ecosystem data. The demo site (nexus-hrms-mu.vercel.app) is NOT affected.
            </p>
            {tenants.length === 0 ? (
              <p className="text-xs text-slate-500">No tenants found. Create tenants first.</p>
            ) : !showCleanupConfirm ? (
              <div className="flex flex-wrap gap-2">
                {tenants.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setCleanupTargetSlug(t.slug); setShowCleanupConfirm(true); }}
                    disabled={cleaningUp}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 shadow-sm disabled:opacity-60"
                  >
                    <FiTrash2 className="w-4 h-4" /> {cleaningUp ? 'Cleaning...' : `Clean ${t.name}`}
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-white rounded-lg border border-amber-300 space-y-2">
                <p className="text-sm font-semibold text-amber-800">
                  Confirm: Delete all demo/sample data for tenant &quot;{cleanupTargetSlug}&quot;?
                </p>
                <p className="text-xs text-amber-700">This action cannot be undone. Structural data (companies, configs) will be preserved.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCleanupDemoData(cleanupTargetSlug)}
                    disabled={cleaningUp}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
                  >
                    {cleaningUp ? 'Cleaning...' : 'Yes, Delete Demo Data'}
                  </button>
                  <button
                    onClick={() => setShowCleanupConfirm(false)}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {cleanupResult && (
              <div className="mt-3 p-3 bg-white rounded-lg border border-green-200">
                <p className="text-xs font-semibold text-green-800 mb-1">Cleanup completed:</p>
                <pre className="text-[10px] text-green-700 overflow-auto max-h-40">{JSON.stringify(cleanupResult, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ TAB 2: TENANTS ═══ */}
      {activeTab === 'tenants' && (
        <div className="space-y-4">
          {/* View Tenant Panel */}
          {viewingTenantId && viewingTenant && (
            <div ref={viewRef} className="thb-card border-l-4 border-l-emerald-500 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-thb-text-primary">Tenant Details</h3>
                <div className="flex gap-2">
                  <button onClick={handleEditTenantFromView} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100"><FiEdit2 className="w-3.5 h-3.5" /> Edit</button>
                  <button onClick={() => { setViewingTenantId(null); setViewingTenant(null); }} className="p-1.5 text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 rounded-lg"><FiX className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div><p className="text-xs text-thb-text-muted">Name</p><p className="text-sm font-medium text-thb-text-primary">{viewingTenant.name}</p></div>
                <div><p className="text-xs text-thb-text-muted">Slug</p><p className="text-sm font-medium text-thb-text-primary">{viewingTenant.slug}</p></div>
                <div><p className="text-xs text-thb-text-muted">Domain</p><p className="text-sm font-medium text-thb-text-primary">{viewingTenant.domain || '—'}</p></div>
                <div><p className="text-xs text-thb-text-muted">Plan</p><span className={planBadgeCls[viewingTenant.plan] || 'thb-badge thb-badge-info'}>{planTypeLabel[viewingTenant.plan] || viewingTenant.plan}</span></div>
                <div><p className="text-xs text-thb-text-muted">Status</p><span className={statusBadgeCls[viewingTenant.status] || 'thb-badge thb-badge-info'}>{viewingTenant.status}</span></div>
                <div><p className="text-xs text-thb-text-muted">Country</p><p className="text-sm font-medium text-thb-text-primary">{viewingTenant.country || '—'}</p></div>
                <div><p className="text-xs text-thb-text-muted">Currency</p><p className="text-sm font-medium text-thb-text-primary">{viewingTenant.currency}</p></div>
                <div><p className="text-xs text-thb-text-muted">Timezone</p><p className="text-sm font-medium text-thb-text-primary">{viewingTenant.timezone}</p></div>
                <div><p className="text-xs text-thb-text-muted">Created</p><p className="text-sm font-medium text-thb-text-primary">{new Date(viewingTenant.createdAt).toLocaleDateString()}</p></div>
                <div className="sm:col-span-2 lg:col-span-2">
                  <p className="text-xs text-thb-text-muted">Max companies allowed for tenant admin</p>
                  <p className="text-sm font-medium text-thb-text-primary flex items-center gap-2">
                    <FiShield className="w-3.5 h-3.5 text-amber-500" />
                    {viewingTenant.maxCompaniesAllowed && viewingTenant.maxCompaniesAllowed > 0
                      ? `${viewingTenant.maxCompaniesAllowed} companies max`
                      : 'Unlimited (no cap)'}
                    <span className="text-xs text-thb-text-muted font-normal">
                      · {viewingTenant._count?.companyGroups || 0} groups created so far
                    </span>
                  </p>
                </div>
              </div>

              {/* Company Groups */}
              {viewingTenant.companyGroups && viewingTenant.companyGroups.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-thb-text-primary mb-3 flex items-center gap-2"><FiGlobe className="w-4 h-4" /> Company Groups</h4>
                  <div className="space-y-3">
                    {viewingTenant.companyGroups.map((cg) => {
                      // Defensive: `companies` may be missing in some fallback
                      // API responses. Default to an empty array so we never
                      // throw "Cannot read properties of undefined (reading 'length')".
                      const companies = Array.isArray(cg.companies) ? cg.companies : [];
                      return (
                        <div key={cg.id} className="border border-thb-border rounded-lg p-4">
                          <p className="text-sm font-semibold text-thb-text-primary mb-2">{cg.name}</p>
                          {companies.length > 0 ? (
                            <div className="space-y-2">
                              {companies.map((comp) => {
                                const depts = comp._count?.departments ?? 0;
                                const branches = comp._count?.branches ?? 0;
                                const employees = comp._count?.employees ?? 0;
                                return (
                                  <div key={comp.id} className="flex items-center gap-4 text-xs text-thb-text-secondary bg-slate-50 rounded-lg p-2.5">
                                    <span className="font-medium text-thb-text-primary">{comp.name}</span>
                                    {comp.code && <span className="thb-badge thb-badge-info text-[10px]">{comp.code}</span>}
                                    <span>{depts} depts</span>
                                    <span>{branches} branches</span>
                                    <span>{employees} employees</span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : <p className="text-xs text-thb-text-muted">No companies inducted under this group yet</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Users */}
              {viewingTenant.users && viewingTenant.users.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-thb-text-primary mb-3 flex items-center gap-2"><FiUsers className="w-4 h-4" /> Users ({viewingTenant.users.length})</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-xs text-thb-text-muted border-b border-thb-border">
                        <th className="pb-2 pr-4">Name</th><th className="pb-2 pr-4">Email</th><th className="pb-2 pr-4">Role</th><th className="pb-2 pr-4">Status</th><th className="pb-2">Last Login</th>
                      </tr></thead>
                      <tbody>
                        {viewingTenant.users.map((u) => (
                          <tr key={u.id} className="border-b border-slate-50">
                            <td className="py-2 pr-4 text-thb-text-primary font-medium">{u.name}</td>
                            <td className="py-2 pr-4 text-thb-text-secondary">{u.email}</td>
                            <td className="py-2 pr-4"><span className="thb-badge thb-badge-info text-[10px]">{u.role}</span></td>
                            <td className="py-2 pr-4"><span className={statusBadgeCls[u.status] || 'thb-badge thb-badge-info'}>{u.status}</span></td>
                            <td className="py-2 text-thb-text-muted">{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Employees */}
              {viewingTenant.employees && viewingTenant.employees.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-thb-text-primary mb-3 flex items-center gap-2"><FiBriefcase className="w-4 h-4" /> Employees ({viewingTenant.employees.length})</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-xs text-thb-text-muted border-b border-thb-border">
                        <th className="pb-2 pr-4">Emp ID</th><th className="pb-2 pr-4">Name</th><th className="pb-2 pr-4">Email</th><th className="pb-2 pr-4">Designation</th><th className="pb-2 pr-4">Department</th><th className="pb-2 pr-4">Company</th><th className="pb-2 pr-4">Status</th><th className="pb-2">Phone</th>
                      </tr></thead>
                      <tbody>
                        {viewingTenant.employees.map((emp) => (
                          <tr key={emp.id} className="border-b border-slate-50">
                            <td className="py-2 pr-4 text-thb-text-secondary font-mono text-xs">{emp.employeeId || '—'}</td>
                            <td className="py-2 pr-4 text-thb-text-primary font-medium">{emp.firstName} {emp.lastName}</td>
                            <td className="py-2 pr-4 text-thb-text-secondary">{emp.email || '—'}</td>
                            <td className="py-2 pr-4 text-thb-text-secondary">{emp.designation || '—'}</td>
                            <td className="py-2 pr-4 text-thb-text-secondary">{emp.department || '—'}</td>
                            <td className="py-2 pr-4 text-thb-text-secondary">{emp.company?.name || '—'}</td>
                            <td className="py-2 pr-4"><span className={statusBadgeCls[emp.status] || 'thb-badge thb-badge-info'}>{emp.status}</span></td>
                            <td className="py-2 text-thb-text-muted">{emp.phone || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Subscriptions */}
              {viewingTenant.subscriptions && viewingTenant.subscriptions.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-thb-text-primary mb-3 flex items-center gap-2"><FiCreditCard className="w-4 h-4" /> Subscriptions</h4>
                  <div className="space-y-2">
                    {viewingTenant.subscriptions.map((sub) => (
                      <div key={sub.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg text-sm">
                        <span className="font-medium text-thb-text-primary">{sub.plan.name}</span>
                        <span className="thb-badge thb-badge-info text-[10px]">{sub.status}</span>
                        <span className="text-thb-text-muted text-xs">{new Date(sub.startDate).toLocaleDateString()} — {new Date(sub.endDate).toLocaleDateString()}</span>
                        <span className="text-thb-text-primary font-medium ml-auto">${sub.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tenant Form */}
          {showTenantForm && (
            <div ref={formRef} className="thb-card border-l-4 border-l-green-500 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-thb-text-primary">{editingTenantId ? 'Edit Tenant' : 'Create Tenant'}</h3>
                <button onClick={handleCancelTenantForm} className="p-1.5 text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 rounded-lg"><FiX className="w-4 h-4" /></button>
              </div>
              <form onSubmit={handleSubmitTenant} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div><label className={labelCls}>Name *</label><input required value={tenantForm.name} onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })} className={inputCls} placeholder="Tenant name" /></div>
                  <div><label className={labelCls}>Slug *</label><input required value={tenantForm.slug} onChange={(e) => setTenantForm({ ...tenantForm, slug: e.target.value })} className={inputCls} placeholder="tenant-slug" /></div>
                  <div><label className={labelCls}>Domain</label><input value={tenantForm.domain} onChange={(e) => setTenantForm({ ...tenantForm, domain: e.target.value })} className={inputCls} placeholder="example.com" /></div>
                  <div><label className={labelCls}>Plan</label>
                    <select value={tenantForm.plan} onChange={(e) => setTenantForm({ ...tenantForm, plan: e.target.value })} className={selectCls}>
                      <option value="starter">Starter</option><option value="professional">Professional</option><option value="enterprise">Enterprise</option><option value="global_enterprise">Global Enterprise</option><option value="staffing">Staffing</option><option value="white_label">White Label</option>
                    </select>
                  </div>
                  <div><label className={labelCls}>Country</label><input value={tenantForm.country} onChange={(e) => setTenantForm({ ...tenantForm, country: e.target.value })} className={inputCls} placeholder="US" /></div>
                  <div><label className={labelCls}>Currency</label>
                    <select value={tenantForm.currency} onChange={(e) => setTenantForm({ ...tenantForm, currency: e.target.value })} className={selectCls}>
                      <option value="INR">INR</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option>
                    </select>
                  </div>
                  <div><label className={labelCls}>Timezone</label><input value={tenantForm.timezone} onChange={(e) => setTenantForm({ ...tenantForm, timezone: e.target.value })} className={inputCls} placeholder="UTC" /></div>
                </div>

                {/* ─── Multi-tenancy questionnaire: max companies allowed for tenant admin ─── */}
                <div className="pt-4 border-t border-thb-border">
                  <h4 className="text-sm font-semibold text-thb-text-primary mb-1 flex items-center gap-2">
                    <FiShield className="w-4 h-4 text-amber-500" /> Company Quota for Tenant Admin
                  </h4>
                  <p className="text-xs text-thb-text-muted mb-3">
                    How many companies should this tenant admin be allowed to create under their tenant?
                    Set <b>0</b> for unlimited. Once the limit is reached, the tenant admin will be blocked
                    from creating more companies.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Max companies allowed</label>
                      <input
                        type="number"
                        min={0}
                        value={tenantForm.maxCompaniesAllowed}
                        onChange={(e) => setTenantForm({ ...tenantForm, maxCompaniesAllowed: parseInt(e.target.value) || 0 })}
                        className={inputCls}
                        placeholder="0 = unlimited"
                      />
                    </div>
                    <div className="flex items-end">
                      <p className="text-[11px] text-thb-text-muted leading-snug pb-2.5">
                        {Number(tenantForm.maxCompaniesAllowed) === 0
                          ? 'Unlimited companies allowed for this tenant.'
                          : `Tenant admin can create up to ${tenantForm.maxCompaniesAllowed} compan${tenantForm.maxCompaniesAllowed === 1 ? 'y' : 'ies'} under this tenant.`}
                        <br />Use the <b>Group Companies</b> tab to set per-group employee-strength barriers.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Admin User (create only) */}
                {!editingTenantId && (
                  <div className="pt-4 border-t border-thb-border">
                    <h4 className="text-sm font-semibold text-thb-text-primary mb-3 flex items-center gap-2"><FiSettings className="w-4 h-4" /> Admin User</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div><label className={labelCls}>Admin Name *</label><input required value={tenantForm.adminName} onChange={(e) => setTenantForm({ ...tenantForm, adminName: e.target.value })} className={inputCls} placeholder="Admin name" /></div>
                      <div><label className={labelCls}>Admin Email *</label><input required type="email" value={tenantForm.adminEmail} onChange={(e) => setTenantForm({ ...tenantForm, adminEmail: e.target.value })} className={inputCls} placeholder="admin@company.com" /></div>
                      <div><label className={labelCls}>Admin Password *</label><input required type="password" value={tenantForm.adminPassword} onChange={(e) => setTenantForm({ ...tenantForm, adminPassword: e.target.value })} className={inputCls} placeholder="••••••••" /></div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={handleCancelTenantForm} className="px-4 py-2 text-sm font-medium text-thb-text-secondary bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
                  <button type="submit" disabled={submittingTenant} className="px-4 py-2 text-sm font-medium text-white bg-green-500 hover:bg-green-600 shadow-sm shadow-green-500/25 rounded-lg disabled:opacity-50">
                    {submittingTenant ? 'Saving...' : editingTenantId ? 'Update Tenant' : 'Create Tenant'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 max-w-sm w-full">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
              <input value={tenantSearch} onChange={(e) => setTenantSearch(e.target.value)} placeholder="Search tenants..." className={inputCls.replace('w-full', 'w-full pl-9')} />
            </div>
            <select value={tenantStatusFilter} onChange={(e) => setTenantStatusFilter(e.target.value)} className={selectCls.replace('w-full', 'w-auto min-w-[140px]')}>
              <option value="">All Status</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="inactive">Inactive</option><option value="pending_approval">Pending</option>
            </select>
            <button onClick={() => fetchTenants()} className="p-2.5 border border-thb-border rounded-lg hover:bg-slate-50"><FiRefreshCw className="w-4 h-4 text-thb-text-muted" /></button>
          </div>

          {/* Tenant List */}
          {tenantsLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="thb-card p-5 animate-pulse"><div className="flex justify-between"><div className="space-y-2"><div className="h-4 w-32 bg-slate-200 rounded" /><div className="h-3 w-24 bg-slate-100 rounded" /></div><div className="h-6 w-20 bg-slate-100 rounded-full" /></div></div>))}</div>
          ) : tenants.length === 0 ? (
            <div className="thb-card p-12 text-center"><FiServer className="w-12 h-12 text-thb-text-muted mx-auto mb-3 opacity-50" /><p className="text-thb-text-secondary">No tenants found</p><p className="text-xs text-thb-text-muted mt-1">Create a new tenant to get started</p></div>
          ) : (
            <div className="space-y-3">
              {tenants.map((t) => (
                <div key={t.id} className="thb-card p-5">
                  {deleteConfirmId === t.id ? (
                    <div className="flex items-center justify-between bg-red-50 -m-5 p-5 rounded-xl">
                      <div><p className="text-sm font-semibold text-red-800">Delete &ldquo;{t.name}&rdquo;?</p><p className="text-xs text-red-600">This action cannot be undone.</p></div>
                      <div className="flex gap-2">
                        <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 text-xs font-medium text-thb-text-secondary bg-white rounded-lg hover:bg-slate-50">Cancel</button>
                        <button onClick={() => handleDeleteTenant(t.id)} disabled={deletingTenant} className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50">{deletingTenant ? 'Deleting...' : 'Delete'}</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">{t.name[0]}</div>
                          <div>
                            <h3 className="font-semibold text-thb-text-primary">{t.name}</h3>
                            <p className="text-sm text-thb-text-muted">{t.slug} {t.domain ? `· ${t.domain}` : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={planBadgeCls[t.plan] || 'thb-badge thb-badge-info'}>{planTypeLabel[t.plan] || t.plan}</span>
                          <span className={statusBadgeCls[t.status] || 'thb-badge thb-badge-info'}>{t.status}</span>
                          {t.country && <span className="text-xs text-thb-text-muted">{t.country}</span>}
                          {t.maxCompaniesAllowed !== undefined && t.maxCompaniesAllowed > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 ring-1 ring-amber-200 text-[10px] font-semibold" title="Max companies this tenant admin can create">
                              <FiShield className="w-2.5 h-2.5" /> cap: {t.maxCompaniesAllowed} cos
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                        <span className="text-xs text-thb-text-muted">{new Date(t.createdAt).toLocaleDateString()}</span>
                        <span className="text-slate-200">·</span>
                        <span className="text-xs text-thb-text-muted">{t._count?.users || 0} users</span>
                        <div className="ml-auto flex items-center gap-2 flex-wrap">
                          <button onClick={() => handleViewTenant(t.id)} className="p-1.5 text-thb-text-muted hover:text-green-600 hover:bg-green-50 rounded-lg" title="View"><FiEye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleEditTenant(t)} className="p-1.5 text-thb-text-muted hover:text-green-600 hover:bg-green-50 rounded-lg" title="Edit"><FiEdit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleResetTenantEmployees(t.slug, t.name)} disabled={resettingTenantEmployees === t.slug} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50" title="Delete all employees except admin">
                            {resettingTenantEmployees === t.slug ? <FiRefreshCw className="w-3 h-3 animate-spin" /> : <FiAlertTriangle className="w-3 h-3" />}
                            Reset
                          </button>
                          <button onClick={() => handlePurgeDuplicates(t.slug, t.name)} disabled={purgingTenantDuplicates === t.slug} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 disabled:opacity-50" title="Purge duplicate employees and sync user passwords across DBs">
                            {purgingTenantDuplicates === t.slug ? <FiRefreshCw className="w-3 h-3 animate-spin" /> : <FiFilter className="w-3 h-3" />}
                            Purge Dups
                          </button>
                          <button onClick={() => handleResetAllPasswords(t.slug, t.name)} disabled={resettingPasswords === t.slug} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 disabled:opacity-50" title="Reset ALL user passwords to 'MarqAI@2026' (tenant DB + platform DB)">
                            {resettingPasswords === t.slug ? <FiRefreshCw className="w-3 h-3 animate-spin" /> : <FiKey className="w-3 h-3" />}
                            Reset Pwd
                          </button>
                          <button onClick={() => handleBackupTenantDB(t.slug, t.name)} disabled={backingUpTenant === t.slug} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50" title="Backup tenant database">
                            {backingUpTenant === t.slug ? <FiRefreshCw className="w-3 h-3 animate-spin" /> : <FiDownload className="w-3 h-3" />}
                            Backup
                          </button>
                          <button onClick={() => setDeleteConfirmId(t.id)} className="p-1.5 text-thb-text-muted hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete"><FiTrash2 className="w-3.5 h-3.5" /></button>
                          {t.status === 'active' ? (
                            <button onClick={() => handleTenantStatusChange(t.id, 'suspended')} className="px-2.5 py-1 text-[11px] font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100">Suspend</button>
                          ) : t.status === 'suspended' || t.status === 'pending_approval' ? (
                            <button onClick={() => handleTenantStatusChange(t.id, 'active')} className="px-2.5 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100">Activate</button>
                          ) : null}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB 2.5: GROUP COMPANIES (super admin sets employee strength barriers) ═══ */}
      {activeTab === 'groups' && (
        <div className="space-y-4">
          {/* Data model hierarchy banner — explains the Tenant → Group Company → Company relationship */}
          <div className="thb-card p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
            <div className="flex items-start gap-3">
              <FiLayers className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-900 flex-1">
                <p className="font-bold mb-2 text-sm">Multi-tenancy Hierarchy</p>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-md border border-emerald-200 font-semibold">
                    <FiServer className="w-3 h-3" /> Tenant
                  </span>
                  <span className="text-emerald-400">→</span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-md border border-teal-200 font-semibold">
                    <FiLayers className="w-3 h-3" /> Group Company
                  </span>
                  <span className="text-emerald-400">→</span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-md border border-green-200 font-semibold">
                    <FiHome className="w-3 h-3" /> Company
                  </span>
                  <span className="text-emerald-400">→</span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-md border border-amber-200 font-semibold">
                    <FiUsers className="w-3 h-3" /> Employees
                  </span>
                </div>
                <p className="leading-relaxed">
                  <b>Tenant</b> (parent) has a <b>companies cap</b> (max companies allowed under all its groups).
                  {' '}<b>Group Company</b> sits under a Tenant and has an <b>employee-strength barrier</b> (per-company or group-total).
                  {' '}<b>Company</b> sits under a Group Company and has its own per-company <b>employee cap</b>.
                  {' '}Tenant admins can only see and manage their own tenant&apos;s groups and companies.
                </p>
              </div>
            </div>
          </div>

          {/* Educational banner */}
          <div className="thb-card p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
            <div className="flex items-start gap-3">
              <FiShield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900">
                <p className="font-semibold mb-1">Employee Strength Barriers</p>
                <p>
                  Create group companies under each tenant and cap how many employees they can hold. Choose
                  <b> per-company </b> mode (cap applies to EACH company) or <b>group-total</b> mode (cap applies to
                  the SUM across all companies in the group). The tenant admin will be blocked from creating more
                  companies or loading more employees beyond these limits.
                </p>
              </div>
            </div>
          </div>

          {/* Create/Edit Group Form */}
          {showGroupForm && (
            <div className="thb-card border-l-4 border-l-teal-500 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2">
                  <FiLayers className="w-4 h-4 text-teal-500" />
                  {editingGroupId ? 'Edit Group Company' : 'Create Group Company'}
                </h3>
                <button onClick={handleCancelGroupForm} className="p-1.5 text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 rounded-lg"><FiX className="w-4 h-4" /></button>
              </div>
              <form onSubmit={handleSubmitGroup} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Tenant (group company&apos;s parent) *</label>
                    <select
                      value={groupForm.tenantId}
                      onChange={(e) => setGroupForm({ ...groupForm, tenantId: e.target.value })}
                      required
                      className={selectCls}
                      disabled={!!editingGroupId}
                    >
                      <option value="">— Select a tenant —</option>
                      {tenants.map((t) => (
                        <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
                      ))}
                    </select>
                    {editingGroupId && <p className="text-[11px] text-thb-text-muted mt-1">Tenant cannot be changed after creation.</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Group Company Name *</label>
                    <input
                      value={groupForm.name}
                      onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                      required
                      placeholder="e.g., Acme Group"
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-thb-border">
                  <h4 className="text-sm font-semibold text-thb-text-primary mb-1 flex items-center gap-2">
                    <FiUsers className="w-4 h-4 text-amber-500" /> Employee Strength Barrier
                  </h4>
                  <p className="text-xs text-thb-text-muted mb-3">
                    Set a cap on how many employees can be loaded under this group. Leave 0 for unlimited.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Limit mode</label>
                      <select
                        value={groupForm.employeeLimitMode}
                        onChange={(e) => setGroupForm({ ...groupForm, employeeLimitMode: e.target.value as 'per_company' | 'group_total' })}
                        className={selectCls}
                      >
                        <option value="group_total">Group total — cap = SUM across all companies in this group</option>
                        <option value="per_company">Per company — cap applies to EACH company in this group</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Max employees (0 = unlimited)</label>
                      <input
                        type="number"
                        min={0}
                        value={groupForm.maxEmployees}
                        onChange={(e) => setGroupForm({ ...groupForm, maxEmployees: parseInt(e.target.value) || 0 })}
                        className={inputCls}
                        placeholder="e.g., 500"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-thb-border">
                  <h4 className="text-sm font-semibold text-thb-text-primary mb-1 flex items-center gap-2">
                    <FiLayers className="w-4 h-4 text-green-500" /> Company Cap (optional)
                  </h4>
                  <p className="text-xs text-thb-text-muted mb-3">
                    Optionally cap how many companies can be inducted under this group. Leave 0 for unlimited.
                    (The tenant-level maxCompaniesAllowed still applies on top of this.)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Max companies in this group (0 = unlimited)</label>
                      <input
                        type="number"
                        min={0}
                        value={groupForm.maxCompanies}
                        onChange={(e) => setGroupForm({ ...groupForm, maxCompanies: parseInt(e.target.value) || 0 })}
                        className={inputCls}
                        placeholder="e.g., 5"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Admin notes (optional)</label>
                      <input
                        value={groupForm.notes}
                        onChange={(e) => setGroupForm({ ...groupForm, notes: e.target.value })}
                        className={inputCls}
                        placeholder="e.g., Sales cluster — cap at 200 staff"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={handleCancelGroupForm} className="px-4 py-2 text-sm font-medium text-thb-text-secondary bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
                  <button type="submit" disabled={submittingGroup} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-500 hover:bg-teal-600 shadow-sm shadow-teal-500/25 rounded-lg disabled:opacity-50">
                    {submittingGroup ? 'Saving...' : editingGroupId ? 'Update Group' : 'Create Group'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tenant filter + Search + refresh */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-md">
                <FiHome className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted pointer-events-none" />
                <select
                  value={groupTenantFilter}
                  onChange={(e) => {
                    setGroupTenantFilter(e.target.value);
                    // fetchGroups will be triggered by the useEffect on activeTab change above,
                    // but since we're already on the tab, we need to trigger it manually.
                    // The useCallback dependency on groupTenantFilter will refresh on next render.
                  }}
                  className="w-full pl-9 pr-8 py-2.5 rounded-lg border border-thb-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 appearance-none cursor-pointer"
                >
                  <option value="">All tenants ({tenants.length})</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.slug})
                    </option>
                  ))}
                </select>
                <FiChevronRightIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 rotate-90 pointer-events-none" />
              </div>
              <button onClick={() => fetchGroups()} className="p-2.5 border border-thb-border rounded-lg hover:bg-slate-50" title="Refresh">
                <FiRefreshCw className="w-4 h-4 text-thb-text-muted" />
              </button>
            </div>
            <p className="text-xs text-thb-text-muted">
              {groupTenantFilter
                ? `Showing groups for: ${tenants.find(t => t.id === groupTenantFilter)?.name || 'selected tenant'}`
                : `${groups.length} group companies across all tenants`}
            </p>
          </div>

          {/* Groups list */}
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
          ) : groups.length === 0 ? (
            <div className="thb-card p-12 text-center">
              <FiLayers className="w-12 h-12 text-thb-text-muted mx-auto mb-3 opacity-50" />
              <p className="text-thb-text-secondary">No group companies created yet</p>
              <p className="text-xs text-thb-text-muted mt-1">Create a group company under a tenant to set employee-strength barriers.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((g) => (
                <div key={g.id} className="thb-card p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        <FiLayers className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-thb-text-primary">{g.name}</h3>
                        <p className="text-sm text-thb-text-muted flex items-center gap-1.5 flex-wrap">
                          <FiHome className="w-3 h-3" /> Tenant: <span className="font-medium text-thb-text-secondary">{g.tenantName || g.tenantId}</span>
                          <span className="opacity-50">·</span> {g._count?.companies || 0} companies
                          <span className="opacity-50">·</span> {g._count?.employees || 0} employees
                        </p>
                        {g.notes && <p className="text-xs text-thb-text-muted italic mt-1">“{g.notes}”</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Employee strength badge */}
                      {g.maxEmployees !== null && g.maxEmployees !== undefined && g.maxEmployees > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 ring-1 ring-amber-200 text-[11px] font-semibold">
                          <FiUsers className="w-3 h-3" />
                          {g.employeeLimitMode === 'per_company' ? 'per-co' : 'group-total'}: {g._count?.employees || 0}/{g.maxEmployees}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 text-[11px] font-semibold">
                          <FiUsers className="w-3 h-3" /> no emp cap
                        </span>
                      )}
                      {/* Company cap badge */}
                      {g.maxCompanies !== null && g.maxCompanies !== undefined && g.maxCompanies > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-green-50 text-green-700 ring-1 ring-green-200 text-[11px] font-semibold">
                          <FiLayers className="w-3 h-3" /> co cap: {g._count?.companies || 0}/{g.maxCompanies}
                        </span>
                      )}
                      <button onClick={() => handleEditGroup(g)} className="p-1.5 text-thb-text-muted hover:text-teal-600 hover:bg-teal-50 rounded-lg" title="Edit"><FiEdit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDeleteGroup(g.id, g.name)} className="p-1.5 text-thb-text-muted hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete"><FiTrash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>

                  {/* Companies under this group */}
                  {g.companies && g.companies.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                      {g.companies.map((c) => {
                        const empCount = c._count?.employees || 0;
                        const cap = c.maxEmployees;
                        const plan = c.plannedEmployeeCount;
                        const atCap = cap !== null && cap !== undefined && cap > 0 && empCount >= cap;
                        return (
                          <div key={c.id} className="flex items-center gap-3 text-xs text-thb-text-secondary bg-slate-50 rounded-lg p-2.5">
                            <FiServer className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-medium text-thb-text-primary">{c.name}</span>
                            {c.code && <span className="thb-badge thb-badge-info text-[10px]">{c.code}</span>}
                            <span className="ml-auto flex items-center gap-1.5">
                              <span className={atCap ? 'text-red-600 font-semibold' : ''}>{empCount} emp</span>
                              {plan !== null && plan !== undefined && plan > 0 && (
                                <span className="text-[10px] text-slate-500">/ plan {plan}</span>
                              )}
                              {cap !== null && cap !== undefined && cap > 0 && (
                                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${atCap ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                  cap {cap}
                                </span>
                              )}
                            </span>
                            <span className={`thb-badge text-[10px] ${c.status === 'active' ? 'thb-badge-success' : 'thb-badge-info'}`}>{c.status}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB 3: SUBSCRIPTION PLANS ═══ */}
      {activeTab === 'plans' && (
        <div className="space-y-4">
          {/* View Plan Panel */}
          {viewingPlanId && viewingPlan && (
            <div ref={viewRef} className="thb-card border-l-4 border-l-emerald-500 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-thb-text-primary">Plan Details</h3>
                <div className="flex gap-2">
                  <button onClick={handleEditPlanFromView} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100"><FiEdit2 className="w-3.5 h-3.5" /> Edit</button>
                  <button onClick={() => { setViewingPlanId(null); setViewingPlan(null); }} className="p-1.5 text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 rounded-lg"><FiX className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div><p className="text-xs text-thb-text-muted">Name</p><p className="text-sm font-medium text-thb-text-primary">{viewingPlan.name}</p></div>
                <div><p className="text-xs text-thb-text-muted">Type</p><span className={planBadgeCls[viewingPlan.planType] || 'thb-badge thb-badge-info'}>{planTypeLabel[viewingPlan.planType] || viewingPlan.planType}</span></div>
                <div><p className="text-xs text-thb-text-muted">Status</p><span className={statusBadgeCls[viewingPlan.status] || 'thb-badge thb-badge-info'}>{viewingPlan.status}</span></div>
                <div><p className="text-xs text-thb-text-muted">Monthly Price</p><p className="text-sm font-medium text-thb-text-primary">${viewingPlan.monthlyPrice}</p></div>
                <div><p className="text-xs text-thb-text-muted">Annual Price</p><p className="text-sm font-medium text-thb-text-primary">${viewingPlan.annualPrice}</p></div>
                <div><p className="text-xs text-thb-text-muted">Subscribers</p><p className="text-sm font-medium text-thb-text-primary">{viewingPlan._count?.subscriptions || 0}</p></div>
                <div><p className="text-xs text-thb-text-muted">Employee Limit</p><p className="text-sm font-medium text-thb-text-primary">{viewingPlan.employeeLimit}</p></div>
                <div><p className="text-xs text-thb-text-muted">Company Limit</p><p className="text-sm font-medium text-thb-text-primary">{viewingPlan.companyLimit}</p></div>
                <div><p className="text-xs text-thb-text-muted">Branch Limit</p><p className="text-sm font-medium text-thb-text-primary">{viewingPlan.branchLimit}</p></div>
                <div><p className="text-xs text-thb-text-muted">Storage</p><p className="text-sm font-medium text-thb-text-primary">{viewingPlan.storageLimit} MB</p></div>
                <div><p className="text-xs text-thb-text-muted">AI Interview Limit</p><p className="text-sm font-medium text-thb-text-primary">{viewingPlan.aiInterviewLimit}</p></div>
                <div><p className="text-xs text-thb-text-muted">AI Chatbot Limit</p><p className="text-sm font-medium text-thb-text-primary">{viewingPlan.aiChatbotLimit}</p></div>
                <div><p className="text-xs text-thb-text-muted">Support Level</p><p className="text-sm font-medium text-thb-text-primary capitalize">{viewingPlan.supportLevel}</p></div>
                {viewingPlan.description && <div className="sm:col-span-2 lg:col-span-3"><p className="text-xs text-thb-text-muted">Description</p><p className="text-sm text-thb-text-secondary">{viewingPlan.description}</p></div>}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-thb-text-primary mb-3">Feature Flags</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {[
                    ['Payroll', viewingPlan.payrollEnabled], ['Recruitment', viewingPlan.recruitmentEnabled],
                    ['Attendance', viewingPlan.attendanceEnabled], ['Projects', viewingPlan.projectEnabled],
                    ['Client Portal', viewingPlan.clientPortalEnabled], ['Vendor Portal', viewingPlan.vendorPortalEnabled],
                    ['Mobile App', viewingPlan.mobileAppEnabled], ['API Access', viewingPlan.apiAccessEnabled],
                    ['White Label', viewingPlan.whiteLabelEnabled],
                  ].map(([label, enabled]) => (
                    <span key={String(label)} className={`thb-badge ${enabled ? 'thb-badge-success' : 'thb-badge-error'}`}>{String(label)}: {enabled ? 'Yes' : 'No'}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Plan Form */}
          {showPlanForm && (
            <div ref={formRef} className="thb-card border-l-4 border-l-green-500 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-thb-text-primary">{editingPlanId ? 'Edit Plan' : 'Create Plan'}</h3>
                <button onClick={handleCancelPlanForm} className="p-1.5 text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 rounded-lg"><FiX className="w-4 h-4" /></button>
              </div>
              <form onSubmit={handleSubmitPlan} className="space-y-5">
                {/* Basic Info */}
                <div>
                  <h4 className="text-sm font-semibold text-thb-text-primary mb-3">Basic Info</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div><label className={labelCls}>Name *</label><input required value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} className={inputCls} placeholder="Plan name" /></div>
                    <div><label className={labelCls}>Plan Type *</label>
                      <select required value={planForm.planType} onChange={(e) => setPlanForm({ ...planForm, planType: e.target.value })} className={selectCls}>
                        <option value="starter">Starter</option><option value="professional">Professional</option><option value="enterprise">Enterprise</option><option value="global_enterprise">Global Enterprise</option><option value="staffing">Staffing</option><option value="white_label">White Label</option>
                      </select>
                    </div>
                    <div><label className={labelCls}>Description</label><input value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} className={inputCls} placeholder="Plan description" /></div>
                  </div>
                </div>

                {/* Pricing */}
                <div>
                  <h4 className="text-sm font-semibold text-thb-text-primary mb-3">Pricing</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={labelCls}>Monthly Price ($)</label><input type="number" min="0" step="0.01" value={planForm.monthlyPrice} onChange={(e) => setPlanForm({ ...planForm, monthlyPrice: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
                    <div><label className={labelCls}>Annual Price ($)</label><input type="number" min="0" step="0.01" value={planForm.annualPrice} onChange={(e) => setPlanForm({ ...planForm, annualPrice: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
                  </div>
                </div>

                {/* Limits */}
                <div>
                  <h4 className="text-sm font-semibold text-thb-text-primary mb-3">Limits</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div><label className={labelCls}>Employees</label><input type="number" min="1" value={planForm.employeeLimit} onChange={(e) => setPlanForm({ ...planForm, employeeLimit: parseInt(e.target.value) || 0 })} className={inputCls} /></div>
                    <div><label className={labelCls}>Companies</label><input type="number" min="1" value={planForm.companyLimit} onChange={(e) => setPlanForm({ ...planForm, companyLimit: parseInt(e.target.value) || 0 })} className={inputCls} /></div>
                    <div><label className={labelCls}>Branches</label><input type="number" min="1" value={planForm.branchLimit} onChange={(e) => setPlanForm({ ...planForm, branchLimit: parseInt(e.target.value) || 0 })} className={inputCls} /></div>
                    <div><label className={labelCls}>Storage (MB)</label><input type="number" min="1" value={planForm.storageLimit} onChange={(e) => setPlanForm({ ...planForm, storageLimit: parseInt(e.target.value) || 0 })} className={inputCls} /></div>
                    <div><label className={labelCls}>AI Interviews</label><input type="number" min="0" value={planForm.aiInterviewLimit} onChange={(e) => setPlanForm({ ...planForm, aiInterviewLimit: parseInt(e.target.value) || 0 })} className={inputCls} /></div>
                    <div><label className={labelCls}>AI Chatbot</label><input type="number" min="0" value={planForm.aiChatbotLimit} onChange={(e) => setPlanForm({ ...planForm, aiChatbotLimit: parseInt(e.target.value) || 0 })} className={inputCls} /></div>
                  </div>
                </div>

                {/* Features */}
                <div>
                  <h4 className="text-sm font-semibold text-thb-text-primary mb-3">Features</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {([
                      ['payrollEnabled', 'Payroll'], ['recruitmentEnabled', 'Recruitment'],
                      ['attendanceEnabled', 'Attendance'], ['projectEnabled', 'Projects'],
                      ['clientPortalEnabled', 'Client Portal'], ['vendorPortalEnabled', 'Vendor Portal'],
                      ['mobileAppEnabled', 'Mobile App'], ['apiAccessEnabled', 'API Access'],
                      ['whiteLabelEnabled', 'White Label'],
                    ] as [keyof typeof planForm, string][]).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer text-sm text-thb-text-secondary hover:text-thb-text-primary">
                        <input type="checkbox" checked={planForm[key] as boolean} onChange={(e) => setPlanForm({ ...planForm, [key]: e.target.checked })} className="w-4 h-4 rounded border-thb-border text-green-500 focus:ring-green-500/20" />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Support & Status */}
                <div>
                  <h4 className="text-sm font-semibold text-thb-text-primary mb-3">Support &amp; Status</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={labelCls}>Support Level</label>
                      <select value={planForm.supportLevel} onChange={(e) => setPlanForm({ ...planForm, supportLevel: e.target.value })} className={selectCls}>
                        <option value="email">Email</option><option value="chat">Chat</option><option value="priority">Priority</option><option value="dedicated">Dedicated</option>
                      </select>
                    </div>
                    <div><label className={labelCls}>Status</label>
                      <select value={planForm.status} onChange={(e) => setPlanForm({ ...planForm, status: e.target.value })} className={selectCls}>
                        <option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={handleCancelPlanForm} className="px-4 py-2 text-sm font-medium text-thb-text-secondary bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
                  <button type="submit" disabled={submittingPlan} className="px-4 py-2 text-sm font-medium text-white bg-green-500 hover:bg-green-600 shadow-sm shadow-green-500/25 rounded-lg disabled:opacity-50">
                    {submittingPlan ? 'Saving...' : editingPlanId ? 'Update Plan' : 'Create Plan'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Plan List */}
          {plansLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (<div key={i} className="thb-card p-6 animate-pulse"><div className="h-4 w-24 bg-slate-200 rounded mb-3" /><div className="h-3 w-16 bg-slate-100 rounded mb-4" /><div className="space-y-2"><div className="h-3 w-full bg-slate-50 rounded" /><div className="h-3 w-3/4 bg-slate-50 rounded" /></div></div>))}
            </div>
          ) : plans.length === 0 ? (
            <div className="thb-card p-12 text-center"><FiCreditCard className="w-12 h-12 text-thb-text-muted mx-auto mb-3 opacity-50" /><p className="text-thb-text-secondary">No subscription plans configured</p><p className="text-xs text-thb-text-muted mt-1">Create a new plan to get started</p></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map((p) => (
                <div key={p.id} className="thb-card p-6">
                  {deletePlanConfirmId === p.id ? (
                    <div className="bg-red-50 -m-6 p-6 rounded-xl">
                      <p className="text-sm font-semibold text-red-800 mb-1">Delete &ldquo;{p.name}&rdquo;?</p>
                      <p className="text-xs text-red-600 mb-3">This action cannot be undone.</p>
                      <div className="flex gap-2">
                        <button onClick={() => setDeletePlanConfirmId(null)} className="px-3 py-1.5 text-xs font-medium text-thb-text-secondary bg-white rounded-lg hover:bg-slate-50">Cancel</button>
                        <button onClick={() => handleDeletePlan(p.id)} disabled={deletingPlan} className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50">{deletingPlan ? 'Deleting...' : 'Delete'}</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-thb-text-primary">{p.name}</h3>
                        <span className={planBadgeCls[p.planType] || 'thb-badge thb-badge-info'}>{planTypeLabel[p.planType] || p.planType}</span>
                      </div>
                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between"><span className="text-sm text-thb-text-secondary">Monthly</span><span className="text-sm font-semibold text-thb-text-primary">${p.monthlyPrice}</span></div>
                        <div className="flex justify-between"><span className="text-sm text-thb-text-secondary">Annual</span><span className="text-sm font-semibold text-thb-text-primary">${p.annualPrice}</span></div>
                        <div className="flex justify-between"><span className="text-sm text-thb-text-secondary">Employee Limit</span><span className="text-sm font-semibold text-thb-text-primary">{p.employeeLimit}</span></div>
                      </div>
                      {/* Feature checklist compact */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {p.payrollEnabled && <span className="thb-badge thb-badge-success text-[10px]">Payroll</span>}
                        {p.recruitmentEnabled && <span className="thb-badge thb-badge-success text-[10px]">Recruit</span>}
                        {p.attendanceEnabled && <span className="thb-badge thb-badge-success text-[10px]">Attend.</span>}
                        {p.projectEnabled && <span className="thb-badge thb-badge-success text-[10px]">Projects</span>}
                        {p.clientPortalEnabled && <span className="thb-badge thb-badge-info text-[10px]">Client</span>}
                        {p.vendorPortalEnabled && <span className="thb-badge thb-badge-info text-[10px]">Vendor</span>}
                        {p.mobileAppEnabled && <span className="thb-badge thb-badge-info text-[10px]">Mobile</span>}
                        {p.apiAccessEnabled && <span className="thb-badge thb-badge-purple text-[10px]">API</span>}
                        {p.whiteLabelEnabled && <span className="thb-badge thb-badge-purple text-[10px]">WhiteLabel</span>}
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <span className="text-xs text-thb-text-muted">{p._count?.subscriptions || 0} subscribers</span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openApplyPlan(p)} className="px-2 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 inline-flex items-center gap-1" title="Apply this plan to a tenant">
                            <FiCheck className="w-3 h-3" /> Apply
                          </button>
                          <button onClick={() => handleViewPlan(p.id)} className="p-1.5 text-thb-text-muted hover:text-green-600 hover:bg-green-50 rounded-lg" title="View"><FiEye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleEditPlan(p)} className="p-1.5 text-thb-text-muted hover:text-green-600 hover:bg-green-50 rounded-lg" title="Edit"><FiEdit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setDeletePlanConfirmId(p.id)} className="p-1.5 text-thb-text-muted hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete"><FiTrash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB 4: AUDIT LOGS ═══ */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="thb-card p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
              <div className="flex-1 min-w-0 w-full sm:w-auto">
                <label className={labelCls}>Action</label>
                <select value={auditAction} onChange={(e) => { setAuditAction(e.target.value); setAuditPage(1); }} className={selectCls}>
                  <option value="">All Actions</option>
                  <option value="CREATE_TENANT">Create Tenant</option><option value="UPDATE_TENANT">Update Tenant</option><option value="DELETE_TENANT">Delete Tenant</option>
                  <option value="CREATE_SUBSCRIPTION_PLAN">Create Plan</option><option value="UPDATE_SUBSCRIPTION_PLAN">Update Plan</option><option value="DELETE_SUBSCRIPTION_PLAN">Delete Plan</option>
                  <option value="LOGIN">Login</option><option value="LOGOUT">Logout</option>
                </select>
              </div>
              <div className="w-full sm:w-auto">
                <label className={labelCls}>Module</label>
                <select value={auditModule} onChange={(e) => { setAuditModule(e.target.value); setAuditPage(1); }} className={selectCls}>
                  <option value="">All Modules</option><option value="tenants">Tenants</option><option value="subscriptions">Subscriptions</option><option value="auth">Auth</option><option value="system">System</option>
                </select>
              </div>
              <div className="w-full sm:w-auto">
                <label className={labelCls}>Start Date</label>
                <input type="date" value={auditStartDate} onChange={(e) => { setAuditStartDate(e.target.value); setAuditPage(1); }} className={inputCls} />
              </div>
              <div className="w-full sm:w-auto">
                <label className={labelCls}>End Date</label>
                <input type="date" value={auditEndDate} onChange={(e) => { setAuditEndDate(e.target.value); setAuditPage(1); }} className={inputCls} />
              </div>
              <div className="w-full sm:w-auto">
                <label className={labelCls}>Search</label>
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
                  <input value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} placeholder="Search details..." className={inputCls.replace('w-full', 'w-full pl-9')} />
                </div>
              </div>
              <button onClick={() => fetchAuditLogs()} className="p-2.5 border border-thb-border rounded-lg hover:bg-slate-50 flex-shrink-0"><FiRefreshCw className="w-4 h-4 text-thb-text-muted" /></button>
            </div>
          </div>

          {/* Logs Table */}
          {auditLoading ? (
            <div className="thb-card p-5">
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => (<div key={i} className="flex gap-4 animate-pulse"><div className="h-4 w-32 bg-slate-200 rounded" /><div className="h-4 w-20 bg-slate-100 rounded" /><div className="h-4 w-24 bg-slate-100 rounded" /><div className="h-4 flex-1 bg-slate-50 rounded" /></div>))}</div>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="thb-card p-12 text-center"><FiFileText className="w-12 h-12 text-thb-text-muted mx-auto mb-3 opacity-50" /><p className="text-thb-text-secondary">No audit logs found</p><p className="text-xs text-thb-text-muted mt-1">Try adjusting your filters</p></div>
          ) : (
            <>
              <div className="thb-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-thb-text-muted bg-slate-50 border-b border-thb-border">
                      <th className="px-4 py-3 font-medium">Timestamp</th>
                      <th className="px-4 py-3 font-medium">User</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                      <th className="px-4 py-3 font-medium">Module</th>
                      <th className="px-4 py-3 font-medium">Details</th>
                    </tr></thead>
                    <tbody>
                      {auditLogs
                        .filter((log) => !auditSearch || (log.details || '').toLowerCase().includes(auditSearch.toLowerCase()) || (log.user?.name || '').toLowerCase().includes(auditSearch.toLowerCase()))
                        .map((log) => (
                          <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                            <td className="px-4 py-3 text-thb-text-muted text-xs whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">{log.user?.name?.[0] || '?'}</div>
                                <span className="text-thb-text-primary text-xs">{log.user?.name || 'System'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3"><span className="thb-badge thb-badge-info text-[10px]">{log.action.replace(/_/g, ' ')}</span></td>
                            <td className="px-4 py-3"><span className="thb-badge thb-badge-purple text-[10px]">{log.module}</span></td>
                            <td className="px-4 py-3 text-thb-text-secondary text-xs max-w-xs truncate">{log.details || '—'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-thb-text-muted">{auditTotal} total logs · Page {auditPage} of {auditTotalPages}</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setAuditPage((p) => Math.max(1, p - 1))} disabled={auditPage <= 1} className="p-2 rounded-lg border border-thb-border hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"><FiChevronLeft className="w-4 h-4 text-thb-text-muted" /></button>
                  {Array.from({ length: Math.min(5, auditTotalPages) }).map((_, i) => {
                    const pageNum = Math.max(1, Math.min(auditPage - 2, auditTotalPages - 4)) + i;
                    if (pageNum > auditTotalPages) return null;
                    return (
                      <button key={pageNum} onClick={() => setAuditPage(pageNum)} className={`w-8 h-8 rounded-lg text-xs font-medium ${auditPage === pageNum ? 'bg-green-500 text-white' : 'text-thb-text-secondary hover:bg-slate-100'}`}>{pageNum}</button>
                    );
                  })}
                  <button onClick={() => setAuditPage((p) => Math.min(auditTotalPages, p + 1))} disabled={auditPage >= auditTotalPages} className="p-2 rounded-lg border border-thb-border hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"><FiChevronRightIcon className="w-4 h-4 text-thb-text-muted" /></button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ APPLY PLAN MODAL ═══ */}
      {/* Lets the super admin pick a tenant (group company parent) and apply
          the selected subscription plan to it. The tenant dropdown is the
          "group company parent name" selector the user asked for. */}
      {showApplyPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FiCheck className="w-4 h-4 text-emerald-600" /> Apply Subscription Plan
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Plan: <b>{plans.find((p) => p.id === showApplyPlan)?.name || '—'}</b>
                </p>
              </div>
              <button
                onClick={() => setShowApplyPlan(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitApplyPlan} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Tenant (group company parent) dropdown */}
              <div>
                <label className={labelCls}>
                  <FiHome className="w-3 h-3 inline mr-1" />
                  Group Company Parent (Tenant) *
                </label>
                <select
                  value={applyForm.tenantId}
                  onChange={(e) => setApplyForm({ ...applyForm, tenantId: e.target.value })}
                  required
                  className={selectCls}
                >
                  <option value="">— Select a tenant —</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.slug}){t.domain ? ` · ${t.domain}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  The subscription will be applied to this tenant. All group companies and
                  companies under this tenant will inherit the plan's feature flags and limits.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Billing Cycle</label>
                  <select
                    value={applyForm.billingCycle}
                    onChange={(e) => {
                      const cycle = e.target.value as 'monthly' | 'annual';
                      const plan = plans.find((p) => p.id === showApplyPlan);
                      const amount = cycle === 'annual' ? (plan?.annualPrice || 0) : (plan?.monthlyPrice || 0);
                      setApplyForm({ ...applyForm, billingCycle: cycle, amount });
                    }}
                    className={selectCls}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Amount ({applyForm.billingCycle === 'annual' ? 'annual' : 'monthly'})</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={applyForm.amount}
                    onChange={(e) => setApplyForm({ ...applyForm, amount: parseFloat(e.target.value) || 0 })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    <FiCalendar className="w-3 h-3 inline mr-1" />
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={applyForm.startDate}
                    onChange={(e) => setApplyForm({ ...applyForm, startDate: e.target.value })}
                    required
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    <FiCalendar className="w-3 h-3 inline mr-1" />
                    End Date *
                  </label>
                  <input
                    type="date"
                    value={applyForm.endDate}
                    onChange={(e) => setApplyForm({ ...applyForm, endDate: e.target.value })}
                    required
                    className={inputCls}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={applyForm.autoRenew}
                  onChange={(e) => setApplyForm({ ...applyForm, autoRenew: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20"
                />
                Auto-renew at end of billing period
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowApplyPlan(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={applyingPlan}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 disabled:opacity-60"
                >
                  {applyingPlan ? 'Applying...' : (<><FiCheck className="w-4 h-4" /> Apply Plan</>)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ TAB: BACKUP REPOSITORY ═══ */}
      {activeTab === 'backups' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-thb-text-primary flex items-center gap-2">
                <FiDatabase className="w-5 h-5 text-blue-500" /> Backup Repository
              </h2>
              <p className="text-sm text-thb-text-secondary mt-0.5">View all database backups taken across tenants</p>
            </div>
            <button onClick={() => fetchBackups()} className="inline-flex items-center gap-2 px-3 py-2 border border-thb-border rounded-lg hover:bg-slate-50 text-sm">
              <FiRefreshCw className={`w-4 h-4 ${backupsLoading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          {backupsLoading ? (
            <div className="thb-card p-12 text-center">
              <FiRefreshCw className="w-8 h-8 mx-auto mb-3 text-thb-text-muted animate-spin" />
              <p className="text-thb-text-muted">Loading backups...</p>
            </div>
          ) : backups.length === 0 ? (
            <div className="thb-card p-12 text-center">
              <FiDatabase className="w-12 h-12 mx-auto mb-3 text-thb-text-muted opacity-40" />
              <p className="text-lg font-medium text-thb-text-primary">No backups yet</p>
              <p className="text-sm text-thb-text-muted mt-1">Go to the Tenants tab and click the "Backup" button to create a backup.</p>
            </div>
          ) : (
            <div className="thb-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-thb-text-muted border-b border-thb-border bg-slate-50">
                      <th className="px-4 py-3 font-semibold">Date & Time</th>
                      <th className="px-4 py-3 font-semibold">Tenant</th>
                      <th className="px-4 py-3 font-semibold">Triggered By</th>
                      <th className="px-4 py-3 font-semibold">Tables</th>
                      <th className="px-4 py-3 font-semibold">Records</th>
                      <th className="px-4 py-3 font-semibold">Size (est.)</th>
                      <th className="px-4 py-3 font-semibold">Storage Location</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((b: any) => (
                      <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-thb-text-secondary">
                          {new Date(b.createdAt).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })}
                        </td>
                        <td className="px-4 py-3 font-medium text-thb-text-primary">
                          {b.tenant?.name || 'Unknown'}
                          <span className="block text-xs text-thb-text-muted">{b.tenant?.slug}</span>
                        </td>
                        <td className="px-4 py-3 text-thb-text-secondary text-xs">{b.triggeredByName}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">{b.totalTables}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium">{b.totalRecords}</span>
                        </td>
                        <td className="px-4 py-3 text-thb-text-secondary text-xs">
                          {b.fileSizeBytes ? `${(b.fileSizeBytes / 1024).toFixed(0)} KB` : '—'}
                        </td>
                        <td className="px-4 py-3 text-thb-text-secondary text-xs">
                          <span className="inline-flex items-center gap-1">
                            <FiDatabase className="w-3 h-3 text-thb-text-muted" />
                            {b.storageLocation || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`thb-badge ${b.status === 'completed' ? 'thb-badge-success' : 'thb-badge-warning'}`}>
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 bg-slate-50 border-t border-thb-border flex items-center justify-between">
                <span className="text-xs text-thb-text-muted">{backups.length} backup record(s)</span>
                <span className="text-xs text-thb-text-muted">
                  Total records backed up: {backups.reduce((sum: number, b: any) => sum + (b.totalRecords || 0), 0).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
