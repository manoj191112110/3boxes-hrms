'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  FiPlus, FiBriefcase, FiEdit2, FiSearch, FiRefreshCw,
  FiX, FiCheck, FiInfo, FiLayers, FiServer, FiAlertCircle,
  FiHome, FiShield, FiUsers, FiChevronDown,
} from 'react-icons/fi';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';
import { validateEmail, validatePhone, phoneInputFilter } from '@/lib/validators';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// Common countries + currencies for the dropdowns
const COUNTRIES = [
  'India', 'United States', 'United Kingdom', 'Australia', 'Canada',
  'Singapore', 'United Arab Emirates', 'Saudi Arabia', 'Germany',
  'France', 'Netherlands', 'Ireland', 'Japan', 'South Africa',
  'Malaysia', 'Philippines', 'Indonesia', 'Bangladesh', 'Nepal', 'Sri Lanka',
];

const CURRENCIES = [
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'SGD', label: 'SGD — Singapore Dollar' },
  { code: 'AED', label: 'AED — UAE Dirham' },
  { code: 'SAR', label: 'SAR — Saudi Riyal' },
  { code: 'JPY', label: 'JPY — Japanese Yen' },
  { code: 'ZAR', label: 'ZAR — South African Rand' },
  { code: 'MYR', label: 'MYR — Malaysian Ringgit' },
  { code: 'BDT', label: 'BDT — Bangladeshi Taka' },
  { code: 'NPR', label: 'NPR — Nepalese Rupee' },
  { code: 'LKR', label: 'LKR — Sri Lankan Rupee' },
];

const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo',
  'America/New_York', 'America/Los_Angeles', 'America/Toronto',
  'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Europe/Amsterdam',
  'Australia/Sydney', 'Africa/Johannesburg', 'UTC',
];

interface CompanyRow {
  id: string;
  name: string;
  code: string | null;
  status: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  currency?: string | null;
  email?: string | null;
  phone?: string | null;
  maxEmployees?: number | null;
  plannedEmployeeCount?: number | null;
  companyGroup: {
    id: string;
    name: string;
    tenantId: string;
    maxEmployees?: number | null;
    employeeLimitMode?: 'per_company' | 'group_total';
    maxCompanies?: number | null;
    notes?: string | null;
    tenant?: { id: string; name: string; slug: string; maxCompaniesAllowed: number };
  };
  _count?: { departments: number; branches: number; employees: number };
}

interface TenantQuota {
  maxCompanies: number;
  used: number;
  remaining: number | null;
}

const EMPTY_FORM = {
  name: '',
  code: '',
  companyGroupId: '',
  companyGroupName: '',
  registrationNo: '',
  taxId: '',
  country: 'India',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  phone: '',
  email: '',
  website: '',
  plannedEmployeeCount: 0,
  maxEmployees: 0,
};

export default function TenantCompaniesPage() {
  const { user } = useAuthStore();
  const { hydrate, availableCompanyGroups, hydrated: ctxHydrated, tenant, tenantQuota, selectedGroupId, selectedCompanyId } = useCompanyContextStore();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeTenantName, setActiveTenantName] = useState<string | null>(null);
  const [activeTenantQuota, setActiveTenantQuota] = useState<TenantQuota | null>(null);

  // Create-form state
  const [form, setForm] = useState({ ...EMPTY_FORM });

  // BUG FIX: Auto-select the group company when only one exists.
  // This prevents the common UX issue where the user opens the form,
  // fills in all fields, but forgets to select the group (since there's
  // only one) and gets a confusing backend error. If there's exactly
  // one group, we pre-select it automatically.
  useEffect(() => {
    if (showCreate && !form.companyGroupId && availableCompanyGroups.length === 1) {
      setForm(prev => ({ ...prev, companyGroupId: availableCompanyGroups[0].id }));
    }
  }, [showCreate, form.companyGroupId, availableCompanyGroups]);

  // Selected group for the create modal — when user picks a group, we display
  // the inherited employee-strength barrier so they know what they're working with
  const selectedGroupForForm = useMemo(
    () => availableCompanyGroups.find((g) => g.id === form.companyGroupId) || null,
    [availableCompanyGroups, form.companyGroupId]
  );

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      // Build the query string from the header dropdown selection.
      // Precedence: selectedCompanyId > selectedGroupId > (tenant scope via JWT).
      // For super_admin, the API would also accept tenantId but this page is
      // for tenant_admin so we rely on the JWT for tenant scoping.
      const params = new URLSearchParams();
      if (selectedCompanyId) {
        params.set('companyId', selectedCompanyId);
      } else if (selectedGroupId) {
        params.set('groupId', selectedGroupId);
      }
      const qs = params.toString();
      const url = qs ? `/api/companies?${qs}` : '/api/companies';
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setCompanies(data.companies || []);
      // Also pick up the tenantQuota that the API returns alongside
      if (data.tenantQuota) {
        setActiveTenantName(data.tenantQuota.name || null);
        setActiveTenantQuota({
          maxCompanies: data.tenantQuota.maxCompaniesAllowed ?? 0,
          used: (data.companies || []).length,
          remaining: data.tenantQuota.maxCompaniesAllowed > 0
            ? Math.max(0, data.tenantQuota.maxCompaniesAllowed - (data.companies || []).length)
            : null,
        });
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load companies');
    } finally {
      setLoading(false);
    }
  }, [selectedGroupId, selectedCompanyId]);

  useEffect(() => {
    if (!ctxHydrated) hydrate();
    fetchCompanies();
  }, [ctxHydrated, hydrate, fetchCompanies]);

  // Re-fetch whenever the header dropdown selection changes (company or group).
  // This is what makes the dropdown actually filter the data on this page.
  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // ─── Access guard ───
  // Super admins should manage companies from /super-admin (or via the header
  // dropdown + /company page). This page is for tenant admins to induct
  // companies under their own tenant's groups. For super admin, the API call
  // would return companies across ALL tenants which is confusing here.
  if (user && user.role === 'super_admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <FiBriefcase className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-semibold text-thb-text-primary">Super admins use the Super Admin page</h2>
        <p className="text-thb-text-secondary text-sm max-w-md leading-relaxed">
          This Companies page is for tenant admins to induct companies under their
          own tenant&rsquo;s group companies. Since your super admin account is
          platform-level, please manage companies from the{' '}
          <b>Super Admin → Tenants</b> tab (click the eye icon on a tenant to see
          its groups + companies) or via the <b>Company Management</b> page in
          the sidebar.
        </p>
        <Link
          href="/super-admin"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium text-sm shadow-sm transition-colors mt-2"
        >
          <FiServer className="w-4 h-4" /> Go to Super Admin
        </Link>
      </div>
    );
  }

  const filtered = companies.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.code || '').toLowerCase().includes(q) ||
      c.companyGroup?.name?.toLowerCase().includes(q)
    );
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Company name is required');
      return;
    }
    // Email validation
    if (form.email) {
      const emailResult = validateEmail(form.email);
      if (!emailResult.valid) { toast.error(emailResult.error || 'Invalid email'); return; }
    }
    // Phone validation
    if (form.phone) {
      const phoneResult = validatePhone(form.phone);
      if (!phoneResult.valid) { toast.error(phoneResult.error || 'Invalid phone number'); return; }
    }
    // Tenant admin MUST select an existing group company (only super admin can
    // create group companies). If no group is selected, surface a clear error
    // that tells them to ask their super admin to create one.
    if (!form.companyGroupId) {
      toast.error(
        availableCompanyGroups.length === 0
          ? 'No group companies exist under your tenant yet. Please ask your super admin to create one first.'
          : 'Please select a group company from the dropdown above. Only super admins can create new group companies — if no group is available, ask your super admin to create one under your tenant.'
      );
      return;
    }
    // If a group is selected, make sure it has room for another company
    if (selectedGroupForForm?.maxCompanies !== null && selectedGroupForForm?.maxCompanies !== undefined && selectedGroupForForm.maxCompanies > 0) {
      const usedInGroup = companies.filter((c) => c.companyGroup?.id === selectedGroupForForm.id).length;
      if (usedInGroup >= selectedGroupForForm.maxCompanies) {
        toast.error(
          `Group "${selectedGroupForForm.name}" has reached its cap of ${selectedGroupForForm.maxCompanies} companies. Pick another group or ask your super admin to raise the cap.`
        );
        return;
      }
    }
    setCreating(true);
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...form,
          // Only send numeric values when they're > 0; backend treats null/0 as "unlimited"
          plannedEmployeeCount: Number(form.plannedEmployeeCount) > 0 ? Number(form.plannedEmployeeCount) : null,
          maxEmployees: Number(form.maxEmployees) > 0 ? Number(form.maxEmployees) : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create company');
      }
      const data = await res.json();
      // The API echoes back the parent context — surface it in the toast so the
      // user can clearly see WHICH tenant and WHICH group the company went into.
      const ctx = data?.context;
      if (ctx) {
        toast.success(
          `Created "${form.name}" under tenant "${ctx.tenant.name}" → group "${ctx.companyGroup.name}"`
        );
      } else {
        toast.success(`Company "${form.name}" created`);
      }
      setShowCreate(false);
      setForm({ ...EMPTY_FORM });
      fetchCompanies();
      hydrate(true); // refresh context so the new company appears in the switcher
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Failed to create company');
    } finally {
      setCreating(false);
    }
  };

  const totalBranches = companies.reduce((s, c) => s + (c._count?.branches || 0), 0);
  const totalGroups = new Set(companies.map((c) => c.companyGroup?.id)).size;
  const totalEmployees = companies.reduce((s, c) => s + (c._count?.employees || 0), 0);

  // Quota display: prefer tenantQuota from context store, fall back to the per-fetch one
  const quota = tenantQuota || activeTenantQuota;
  const tenantName = tenant?.name || activeTenantName || 'your tenant';
  const quotaReached = !!quota && quota.maxCompanies > 0 && quota.used >= quota.maxCompanies;

  return (
    <div className="space-y-6">
      {/* HERO */}
      <div className="relative rounded-2xl overflow-hidden border-0 shadow-xl shadow-emerald-500/10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F172A] via-[#1E3A5F] to-[#312E81]" />
        <div className="absolute top-0 right-0 w-72 h-72 bg-green-500/20 rounded-full blur-[100px]" />
        <div className="relative z-10 px-6 sm:px-8 py-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-green-300/60 text-xs font-medium tracking-widest uppercase">Tenant Administration</p>
              <h1 className="text-2xl font-bold text-white mt-1">Companies</h1>
              <p className="text-green-100/60 text-sm font-medium mt-1 flex items-center gap-1.5 flex-wrap">
                <FiHome className="w-3.5 h-3.5" />
                <span>Inducted under tenant:</span>
                <span className="font-bold text-white">{tenantName}</span>
                <span className="opacity-50">·</span>
                <span>{companies.length} companies</span>
                <span className="opacity-50">·</span>
                <span>{totalGroups} groups</span>
                <span className="opacity-50">·</span>
                <span>{totalBranches} branches</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchCompanies}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm font-semibold hover:bg-white/20 transition-all"
              >
                <FiRefreshCw className="w-4 h-4" /> Refresh
              </button>
              <button
                onClick={() => {
                  if (quotaReached) {
                    toast.error(
                      `Company quota reached — your tenant is allowed ${quota!.maxCompanies} companies max. Contact your super admin to raise the limit.`
                    );
                    return;
                  }
                  // Note: we intentionally do NOT block the user from opening
                  // the form when availableCompanyGroups is empty. The form
                  // itself shows an inline "no group companies available"
                  // message with guidance to contact the super admin. This is
                  // better UX than a disabled button that leaves the user
                  // wondering why nothing happens on click.
                  setShowCreate(true);
                }}
                disabled={quotaReached}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                title={
                  quotaReached
                    ? 'Company quota reached'
                    : 'Create new company'
                }
              >
                <FiPlus className="w-4 h-4" /> New Company
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* HIERARCHY BANNER */}
      <div className="rounded-xl p-4 border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50/60 flex items-start gap-3">
        <FiLayers className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-900 flex-1">
          <p className="font-bold mb-2 text-sm">Where am I in the hierarchy?</p>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-md border border-emerald-200 font-semibold">
              <FiHome className="w-3 h-3" /> Tenant: {tenantName}
            </span>
            <span className="text-emerald-400">=</span>
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-md border border-teal-200 font-semibold">
              <FiLayers className="w-3 h-3" /> Group Company (parent)
            </span>
            <span className="text-emerald-400">→</span>
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-br from-emerald-500 to-teal-500 text-white rounded-md font-semibold">
              <FiBriefcase className="w-3 h-3" /> Company (this page)
            </span>
            <span className="text-emerald-400">→</span>
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-md border border-amber-200 font-semibold">
              <FiUsers className="w-3 h-3" /> Employees
            </span>
          </div>
          <p className="leading-relaxed">
            <b>The group company name and parent tenant are the same.</b>
            {' '}Companies on this page sit <b>under a Group Company</b>, which sits under your tenant <b>{tenantName}</b>.
            {' '}Group companies are <b>created by your super admin</b>. If the <b>Group Company</b> dropdown below is empty,
            {' '}please <b>ask your super admin to create at least one group company</b> under tenant{' '}
            <b>{tenantName}</b> first — you can then induct Companies under it from this page.
          </p>
        </div>
      </div>

      {/* QUOTA BANNER */}
      {quota && (
        <div
          className={`rounded-xl p-4 border flex items-start gap-3 ${
            quotaReached
              ? 'bg-red-50 border-red-200 text-red-800'
              : quota.maxCompanies > 0
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <FiShield className={`w-5 h-5 mt-0.5 flex-shrink-0 ${quotaReached ? 'text-red-500' : quota.maxCompanies > 0 ? 'text-amber-500' : 'text-emerald-500'}`} />
          <div className="flex-1">
            <p className="text-sm font-bold">
              {quota.maxCompanies > 0
                ? `Company quota: ${quota.used} of ${quota.maxCompanies} used`
                : `Company quota: ${quota.used} created (unlimited allowed)`}
            </p>
            <p className="text-xs opacity-80 mt-0.5">
              {quota.maxCompanies > 0
                ? quotaReached
                  ? `You have reached the cap of ${quota.maxCompanies} companies under tenant "${tenantName}". Ask your super admin to raise the limit to create more.`
                  : `${quota.remaining} more compan${quota.remaining === 1 ? 'y' : 'ies'} can be created under this tenant.`
                : `Tenant "${tenantName}" has no company cap — create as many as you need.`}
            </p>
          </div>
        </div>
      )}

      {/* STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Companies" value={companies.length} icon={<FiBriefcase className="w-5 h-5" />} bg="bg-emerald-50 text-emerald-600" ring="ring-emerald-100" />
        <StatCard label="Group Companies" value={totalGroups} icon={<FiLayers className="w-5 h-5" />} bg="bg-teal-50 text-teal-600" ring="ring-teal-100" />
        <StatCard label="Branches" value={totalBranches} icon={<FiServer className="w-5 h-5" />} bg="bg-emerald-50 text-emerald-600" ring="ring-emerald-100" />
        <StatCard label="Employees" value={totalEmployees} icon={<FiUsers className="w-5 h-5" />} bg="bg-amber-50 text-amber-600" ring="ring-amber-100" />
      </div>

      {/* SEARCH */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
        <div className="relative">
          <FiSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, code or group..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-300"
          />
        </div>
      </div>

      {/* COMPANIES TABLE */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-100/70 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FiAlertCircle className="w-10 h-10 mb-3" />
            <p className="text-sm font-medium">No companies found</p>
            {!quotaReached && (
              <button onClick={() => setShowCreate(true)} className="mt-3 text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                + Create your first company
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Company</th>
                  <th className="px-5 py-3">Group Company</th>
                  <th className="px-5 py-3">Location</th>
                  <th className="px-5 py-3">Currency</th>
                  <th className="px-5 py-3 text-center">Employees</th>
                  <th className="px-5 py-3 text-center">Branches</th>
                  <th className="px-5 py-3 text-center">Departments</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => {
                  const groupMax = c.companyGroup?.maxEmployees;
                  const groupMode = c.companyGroup?.employeeLimitMode;
                  const groupHasLimit = groupMax !== null && groupMax !== undefined && (groupMax as number) > 0;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                            {c.name[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
                            <p className="text-xs text-slate-500">{c.code || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-sm text-slate-700 font-medium">{c.companyGroup?.name || '—'}</p>
                        {groupHasLimit && (
                          <p className="text-[10px] text-amber-700 flex items-center gap-0.5 mt-0.5">
                            <FiUsers className="w-2.5 h-2.5" />
                            {groupMode === 'per_company' ? 'per-company' : 'group-total'} cap: {groupMax}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">
                        {[c.city, c.state, c.country].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">{c.currency || '—'}</td>
                      <td className="px-5 py-3 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-sm font-semibold text-slate-700">{c._count?.employees || 0}</span>
                          {(c.plannedEmployeeCount !== null && c.plannedEmployeeCount !== undefined && c.plannedEmployeeCount > 0) && (
                            <span className="text-[10px] text-slate-500">plan: {c.plannedEmployeeCount}</span>
                          )}
                          {(c.maxEmployees !== null && c.maxEmployees !== undefined && c.maxEmployees > 0) && (
                            <span className="text-[9px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">cap: {c.maxEmployees}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-center text-sm font-semibold text-slate-700">{c._count?.branches || 0}</td>
                      <td className="px-5 py-3 text-center text-sm font-semibold text-slate-700">{c._count?.departments || 0}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ring-1 ${
                          c.status === 'active' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-700 ring-slate-200'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => toast('Open in sidebar for full editing')}
                          className="text-slate-400 hover:text-emerald-600"
                          title="Edit"
                        >
                          <FiEdit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FiPlus className="w-4 h-4 text-emerald-500" /> Create New Company
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 flex-wrap">
                  <FiHome className="w-3 h-3" />
                  <span>Inducting under tenant:</span>
                  <span className="font-bold text-emerald-700">{tenantName}</span>
                </p>
              </div>
              <button
                onClick={() => setShowCreate(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Tenant context badge — read-only */}
              <div className="px-4 py-3 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center gap-3">
                <FiHome className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-[11px] uppercase tracking-wider text-emerald-700/70 font-semibold">Parent Tenant</p>
                  <p className="text-sm font-bold text-emerald-900">{tenantName}</p>
                </div>
                <span className="text-[11px] text-emerald-700/70">
                  {quota && quota.maxCompanies > 0
                    ? `${quota.used}/${quota.maxCompanies} used`
                    : `${quota?.used || 0} created (unlimited)`}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Company Name *">
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    placeholder="e.g., Acme Technologies"
                    className="form-input"
                  />
                </Field>
                <Field label="Code">
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="Auto from name"
                    className="form-input"
                  />
                </Field>
              </div>

              {/* Group company selector — tenant admin must pick an existing group
                  (only super admin can create group companies). If no groups exist,
                  show a "contact your super admin" message instead of an inline
                  group-creation input. */}
              <Field label="Group Company *">
                {availableCompanyGroups.length === 0 ? (
                  <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                    <FiAlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-900">
                      <p className="font-bold mb-0.5">No group companies available</p>
                      <p>
                        Only your <b>super admin</b> can create group companies. Please ask them to create at
                        least one group under tenant <b>{tenantName}</b> first — you will then be able to
                        select it here and induct your company under it.
                      </p>
                    </div>
                  </div>
                ) : (
                  <select
                    value={form.companyGroupId}
                    onChange={(e) => setForm({ ...form, companyGroupId: e.target.value })}
                    className="form-input bg-white"
                    required
                  >
                    <option value="">— Select an existing group —</option>
                    {availableCompanyGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                        {g.maxEmployees ? ` (emp cap: ${g.maxEmployees} ${g.employeeLimitMode === 'per_company' ? 'per-co' : 'group'})` : ''}
                        {g.maxCompanies ? ` · co cap: ${g.maxCompanies}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </Field>

              {/* Show the inherited employee-strength barrier of the selected group */}
              {selectedGroupForForm && (
                <div className="px-4 py-3 rounded-xl bg-amber-50/70 border border-amber-200 flex items-start gap-3">
                  <FiShield className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs text-amber-900">
                    <p className="font-bold">Inherited employee strength barrier</p>
                    {selectedGroupForForm.maxEmployees !== null && selectedGroupForForm.maxEmployees !== undefined && selectedGroupForForm.maxEmployees > 0 ? (
                      <p className="mt-0.5">
                        Group <b>{selectedGroupForForm.name}</b> caps at{' '}
                        <b>{selectedGroupForForm.maxEmployees} employees</b> ({selectedGroupForForm.employeeLimitMode === 'per_company' ? 'per company' : 'across all companies in the group'}).
                        Once that limit is reached you won't be able to add more employees to this company.
                      </p>
                    ) : (
                      <p className="mt-0.5">Group <b>{selectedGroupForForm.name}</b> has no employee cap set — you can add as many employees as you need (subject to tenant-level limits).</p>
                    )}
                    {selectedGroupForForm.maxCompanies !== null && selectedGroupForForm.maxCompanies !== undefined && selectedGroupForForm.maxCompanies > 0 && (
                      <p className="mt-0.5">Group also caps at <b>{selectedGroupForForm.maxCompanies} companies</b>.</p>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Registration No.">
                  <input value={form.registrationNo} onChange={(e) => setForm({ ...form, registrationNo: e.target.value })} className="form-input" />
                </Field>
                <Field label="Tax ID (GSTIN)">
                  <input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} className="form-input" />
                </Field>

                <Field label="Country">
                  <div className="relative">
                    <select
                      value={form.country}
                      onChange={(e) => setForm({ ...form, country: e.target.value })}
                      className="form-input bg-white appearance-none pr-8"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      {/* Allow previously-saved values not in the list */}
                      {!COUNTRIES.includes(form.country) && form.country && (
                        <option value={form.country}>{form.country}</option>
                      )}
                    </select>
                    <FiChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </Field>

                <Field label="Currency">
                  <div className="relative">
                    <select
                      value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value })}
                      className="form-input bg-white appearance-none pr-8"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>{c.label}</option>
                      ))}
                      {!CURRENCIES.some((c) => c.code === form.currency) && form.currency && (
                        <option value={form.currency}>{form.currency}</option>
                      )}
                    </select>
                    <FiChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </Field>

                <Field label="Timezone">
                  <div className="relative">
                    <select
                      value={form.timezone}
                      onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                      className="form-input bg-white appearance-none pr-8"
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                    <FiChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </Field>

                <Field label="City">
                  <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="form-input" />
                </Field>
                <Field label="State">
                  <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="form-input" />
                </Field>
                <Field label="Phone">
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: phoneInputFilter(e.target.value) })} placeholder="10-digit mobile" className="form-input" />
                </Field>
                <Field label="Email">
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="info@company.com" className="form-input" />
                </Field>
              </div>

              {/* ─── Employee Strength (No of Employees) ─── */}
              <div className="px-4 py-4 rounded-xl bg-gradient-to-br from-amber-50/60 to-orange-50/40 border border-amber-200 space-y-3">
                <div className="flex items-center gap-2">
                  <FiUsers className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <p className="text-sm font-bold text-amber-900">Employee Strength Configuration</p>
                </div>
                <p className="text-[11px] text-amber-800/80">
                  Declare the planned headcount for this company and optionally set a hard cap. The cap blocks
                  employee creation beyond the limit. If a parent group cap also applies, the tighter limit wins.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="No. of Employees (planned strength)">
                    <input
                      type="number"
                      min={0}
                      value={form.plannedEmployeeCount}
                      onChange={(e) => setForm({ ...form, plannedEmployeeCount: parseInt(e.target.value) || 0 })}
                      placeholder="0 = not declared"
                      className="form-input"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Informational target — does not block creation.</p>
                  </Field>
                  <Field label="Employee Cap (hard limit, 0 = unlimited)">
                    <input
                      type="number"
                      min={0}
                      value={form.maxEmployees}
                      onChange={(e) => setForm({ ...form, maxEmployees: parseInt(e.target.value) || 0 })}
                      placeholder="0 = unlimited"
                      className="form-input"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Blocks employee creation beyond this number.</p>
                  </Field>
                </div>
              </div>

              <Field label="Address">
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  rows={2}
                  className="form-input"
                />
              </Field>

              <div className="flex items-center gap-2 pt-2 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
                <FiInfo className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <p className="text-xs text-slate-500">
                  After creation, the new company will appear in the header switcher (under <b>{tenantName}</b>) and you can start configuring branches, departments and employees under it.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 disabled:opacity-60"
                >
                  {creating ? 'Creating...' : (<><FiCheck className="w-4 h-4" /> Create Company</>)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .form-input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid rgb(226 232 240);
          font-size: 0.875rem;
          outline: none;
        }
        .form-input:focus {
          box-shadow: 0 0 0 2px rgb(99 102 241 / 0.4);
          border-color: rgb(165 180 252);
        }
      `}</style>
    </div>
  );
}

function StatCard({ label, value, icon, bg, ring }: { label: string; value: number; icon: React.ReactNode; bg: string; ring: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center ring-1 ${ring}`}>{icon}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );
}
