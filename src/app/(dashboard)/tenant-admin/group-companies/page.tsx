'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiLayers, FiX, FiRefreshCw,
  FiShield, FiUsers, FiHome, FiInfo, FiBriefcase,
  FiLock, FiAlertCircle,
} from 'react-icons/fi';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/* ── Types ── */
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
  tenantSlug?: string | null;
  employeeLimitMode: 'per_company' | 'group_total';
  maxEmployees: number | null;
  maxCompanies: number | null;
  notes?: string | null;
  createdAt: string;
  _count?: { companies: number; employees: number };
  companies?: CompanyInGroup[];
}

/**
 * Tenant Admin → Group Companies page (READ-ONLY)
 *
 * ─── PERMISSION RULE ───
 * Only SUPER ADMIN can create / edit / delete group companies.
 * Tenant admins can ONLY view the group companies that exist under their
 * tenant (so they know which group to induct their new Companies under).
 *
 * If a tenant admin needs a new group company, they must ask their super
 * admin to create it. The page below reflects this rule:
 *   - No "New Group Company" button
 *   - No edit / delete actions on each row
 *   - A prominent banner explains the rule and links to the Companies page
 *     (where the tenant admin CAN create companies under an existing group)
 */
export default function TenantGroupCompaniesPage() {
  const { user } = useAuthStore();
  const { tenant, hydrate, hydrated: ctxHydrated } = useCompanyContextStore();

  const [groups, setGroups] = useState<CompanyGroupRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/company-groups', { headers: getAuthHeaders() });
      if (!res.ok) {
        // The API now returns 200 with empty array on transient errors, but
        // be defensive: an auth failure (401) would still come through.
        throw new Error('Failed to fetch');
      }
      const data = await res.json();
      setGroups(data.groups || []);
    } catch (e) {
      console.error(e);
      // Don't show a scary toast — just empty-state the list. The empty state
      // below already explains what to do.
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ctxHydrated) hydrate();
    fetchGroups();
  }, [ctxHydrated, hydrate, fetchGroups]);

  // ─── Access guard ───
  // Super admins should use /super-admin (Group Companies tab) to manage
  // group companies across all tenants. This page is tenant-scoped (read-only
  // view for the tenant admin's own tenant), so for a super admin it would
  // show empty/misleading data. Redirect them with a helpful explainer.
  if (user && user.role === 'super_admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-teal-500/20">
          <FiLayers className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-semibold text-thb-text-primary">Super admins use the Super Admin page</h2>
        <p className="text-thb-text-secondary text-sm max-w-md leading-relaxed">
          The Group Companies page here is a <b>read-only</b> view scoped to a single
          tenant (the one the logged-in tenant admin belongs to). Since your super
          admin account is platform-level, please manage group companies from the
          <b> Super Admin → Group Companies</b> tab — that view lets you create, edit,
          and delete groups across <b>all tenants</b>.
        </p>
        <Link
          href="/super-admin"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-medium text-sm shadow-sm transition-colors mt-2"
        >
          <FiLayers className="w-4 h-4" /> Go to Super Admin → Group Companies
        </Link>
      </div>
    );
  }

  const tenantName = tenant?.name || 'your tenant';
  const totalGroups = groups.length;
  const totalCompanies = groups.reduce((s, g) => s + (g._count?.companies || 0), 0);
  const totalEmployees = groups.reduce((s, g) => s + (g._count?.employees || 0), 0);

  return (
    <div className="space-y-6">
      {/* HERO */}
      <div className="relative rounded-2xl overflow-hidden border-0 shadow-xl shadow-teal-500/10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F172A] via-[#312E81] to-[#5B21B6]" />
        <div className="absolute top-0 right-0 w-72 h-72 bg-teal-500/30 rounded-full blur-[100px]" />
        <div className="relative z-10 px-6 sm:px-8 py-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-teal-300/60 text-xs font-medium tracking-widest uppercase flex items-center gap-1.5">
                <FiLock className="w-3 h-3" /> Tenant Administration · Read-Only
              </p>
              <h1 className="text-2xl font-bold text-white mt-1 flex items-center gap-2">
                Group Companies
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-400/20 text-amber-200 px-2 py-0.5 rounded-full ring-1 ring-amber-300/30">
                  <FiLock className="w-2.5 h-2.5" /> Super-admin managed
                </span>
              </h1>
              <p className="text-teal-100/60 text-sm font-medium mt-1 flex items-center gap-1.5 flex-wrap">
                <FiHome className="w-3.5 h-3.5" />
                <span>Inducted under tenant:</span>
                <span className="font-bold text-white">{tenantName}</span>
                <span className="opacity-50">·</span>
                <span>{totalGroups} groups</span>
                <span className="opacity-50">·</span>
                <span>{totalCompanies} companies</span>
                <span className="opacity-50">·</span>
                <span>{totalEmployees} employees</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchGroups}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm font-semibold hover:bg-white/20 transition-all"
              >
                <FiRefreshCw className="w-4 h-4" /> Refresh
              </button>
              <Link
                href="/tenant-admin/companies"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all"
              >
                <FiBriefcase className="w-4 h-4" /> Create a Company
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* PERMISSION RULE BANNER */}
      <div className="rounded-xl p-4 border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 flex items-start gap-3">
        <FiShield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 flex-1">
          <p className="font-bold mb-1 text-sm flex items-center gap-1.5">
            <FiLock className="w-3.5 h-3.5" /> Only super admins can create or modify group companies
          </p>
          <p className="leading-relaxed">
            Per the multi-tenancy permission rules, <b>group company creation is restricted to super admins</b>.
            {' '}As a tenant admin, you can <b>view</b> the group companies under your tenant <b>{tenantName}</b>,
            {' '}and you can <b>create Companies</b> under any of these groups via the{' '}
            <Link href="/tenant-admin/companies" className="font-bold text-amber-700 underline">Companies page</Link>.
            {' '}If you need a new group company, please contact your super admin.
          </p>
        </div>
      </div>

      {/* INFO BANNER */}
      <div className="rounded-xl p-4 border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50/60 flex items-start gap-3">
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
            {' '}Your tenant <b>{tenantName}</b> is the parent. The super admin has created the group
            companies listed below — pick one when inducting a new Company via the{' '}
            <Link href="/tenant-admin/companies" className="font-bold text-emerald-700 underline">Companies page</Link>.
            {' '}Each group can have an employee-strength barrier (per-company or group-total).
          </p>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Group Companies" value={totalGroups} icon={<FiLayers className="w-5 h-5" />} bg="bg-teal-50 text-teal-600" ring="ring-teal-100" />
        <StatCard label="Companies Inducted" value={totalCompanies} icon={<FiBriefcase className="w-5 h-5" />} bg="bg-emerald-50 text-emerald-600" ring="ring-emerald-100" />
        <StatCard label="Total Employees" value={totalEmployees} icon={<FiUsers className="w-5 h-5" />} bg="bg-amber-50 text-amber-600" ring="ring-amber-100" />
      </div>

      {/* GROUPS LIST — READ ONLY */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-slate-100/70 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <FiLayers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">No group companies under your tenant yet</p>
          <p className="text-xs text-slate-500 mt-1 mb-2">
            Per the multi-tenancy permission rules, only your <b>super admin</b> can create group companies.
            {' '}Please ask your super admin to create at least one group company under tenant{' '}
            <b>{tenantName}</b> so you can induct Companies under it.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/tenant-admin/companies"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all"
            >
              <FiBriefcase className="w-4 h-4" /> Go to Companies page
            </Link>
            <button
              onClick={fetchGroups}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all"
            >
              <FiRefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const empCount = g._count?.employees || 0;
            const coCount = g._count?.companies || 0;
            const hasEmpCap = g.maxEmployees !== null && g.maxEmployees !== undefined && g.maxEmployees > 0;
            const hasCoCap = g.maxCompanies !== null && g.maxCompanies !== undefined && g.maxCompanies > 0;
            return (
              <div key={g.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white flex-shrink-0">
                      <FiLayers className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
                        {g.name}
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded ring-1 ring-slate-200">
                          <FiLock className="w-2.5 h-2.5" /> read-only
                        </span>
                      </h3>
                      <p className="text-sm text-slate-500 flex items-center gap-1.5 flex-wrap">
                        <FiHome className="w-3 h-3" /> {g.tenantName || tenantName}
                        <span className="opacity-50">·</span> {coCount} companies
                        <span className="opacity-50">·</span> {empCount} employees
                      </p>
                      {g.notes && <p className="text-xs text-slate-500 italic mt-1">&ldquo;{g.notes}&rdquo;</p>}
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
                  </div>
                </div>

                {/* Companies under this group */}
                {g.companies && g.companies.length > 0 ? (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                    {g.companies.map((c) => {
                      const cEmp = c._count?.employees || 0;
                      const cCap = c.maxEmployees;
                      const cPlan = c.plannedEmployeeCount;
                      const atCap = cCap !== null && cCap !== undefined && (cCap as number) > 0 && cEmp >= (cCap as number);
                      return (
                        <div key={c.id} className="flex items-center gap-3 text-xs text-slate-600 bg-slate-50 rounded-lg p-2.5">
                          <FiBriefcase className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium text-slate-900">{c.name}</span>
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
                ) : (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-2.5">
                      <FiAlertCircle className="w-3.5 h-3.5 text-amber-500" />
                      <span>No companies inducted under this group yet.</span>
                      <Link
                        href="/tenant-admin/companies"
                        className="ml-auto inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-semibold"
                      >
                        <FiBriefcase className="w-3 h-3" /> Induct one →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* FOOTER INFO */}
      <div className="rounded-xl p-4 bg-slate-50 border border-slate-200 flex items-start gap-3">
        <FiInfo className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600 leading-relaxed">
          Need a new group company, or need to change an employee-strength cap on an existing one?
          {' '}Group companies are <b>managed by the super admin</b>. Please reach out to your super admin
          {' '}with the request — they can create or modify groups from the{' '}
          <Link href="/super-admin" className="font-bold text-slate-800 underline">Super Admin → Group Companies</Link> tab.
          {' '}Once created, the new group will appear on this page and be selectable when you create a Company.
        </p>
      </div>
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
