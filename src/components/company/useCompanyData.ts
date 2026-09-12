'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { useCompanyContextStore } from '@/store/companyContextStore'

/* ── Types ── */
export interface CompanyRecord {
  id: string; name: string; code?: string; city?: string; state?: string; country?: string;
  status: string; taxId?: string; phone?: string; email?: string; website?: string;
  address?: string; zipCode?: string; currency?: string; timezone?: string;
  _count?: { departments: number; branches: number };
  companyGroup?: { id: string; name: string; tenantId: string; tenant?: { id: string; name: string; slug: string } | null };
}
export interface BranchRecord { id: string; name: string; code?: string; companyId: string; city?: string; state?: string; country?: string; address?: string; zipCode?: string; phone?: string; email?: string; status: string; company?: { id: string; name: string; code?: string }; _count?: { employees: number } }
export interface DepartmentRecord { id: string; name: string; code?: string; companyId: string; status: string; company?: { id: string; name: string }; branch?: { id: string; name: string } | null; _count?: { employees: number; designations: number } }
export interface DesignationRecord { id: string; title: string; departmentId: string; level: number; minSalary?: number | null; maxSalary?: number | null; status: string; department?: { id: string; name: string }; _count?: { employees: number } }
export interface ShiftRecord { id: string; name: string; startTime: string; endTime: string; breakDuration: number; graceTime: number; status: string }
export interface HolidayRecord { id: string; name: string; date: string; type: string; country?: string; description?: string }
export interface PolicyRecord { id: string; title: string; category: string; description: string; version: string; status: string; effectiveDate?: string | null; expiryDate?: string | null; fileUrl?: string | null; fileName?: string | null; fileSize?: number | null; fileMimeType?: string | null }

/* ── Helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: getAuthHeaders(), ...options })
  if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Request failed' })); throw new Error(e.error || `HTTP ${res.status}`) }
  return res.json()
}

export const fmtSalary = (n?: number | null) => n ? `₹${(n / 100000).toFixed(0)}L` : '—'
export const fmtDate = (d: string | Date) => { const dt = new Date(d); return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) }
export const fmtDay = (d: string | Date) => new Date(d).toLocaleDateString('en-IN', { weekday: 'long' })
export const fmtTime = (t: string) => { if (!t) return ''; if (t.includes('AM') || t.includes('PM')) return t; const [h, m] = t.split(':').map(Number); const ampm = h >= 12 ? 'PM' : 'AM'; return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}` }

export const gradeCode = (level: number) => { if (level <= 1) return 'E1'; if (level === 2) return 'E2'; if (level === 3) return 'E3'; if (level >= 4) return 'M1'; return `L${level}` }
export const gradeName = (level: number) => { if (level <= 1) return 'E1 - Junior'; if (level === 2) return 'E2 - Mid Level'; if (level === 3) return 'E3 - Senior'; if (level >= 4) return 'M1 - Manager'; return `Level ${level}` }

export function getStatusBadge(status: string) {
  const map: Record<string, string> = { active: 'thb-badge thb-badge-success', inactive: 'bg-slate-100 text-slate-600 thb-badge', draft: 'thb-badge thb-badge-warning' }
  const labels: Record<string, string> = { active: 'Active', inactive: 'Inactive', draft: 'Draft' }
  return { className: map[status] || 'thb-badge thb-badge-info', label: labels[status] || status }
}

/* ── Shared Hook ── */
export function useCompanyData() {
  const { user } = useAuthStore()
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '')
  const { selectedTenantId, selectedGroupId, selectedCompanyId, hydrated, hydrate, availableCompanyGroups } = useCompanyContextStore()
  const userRole = (user?.role || 'employee').toLowerCase()
  const isSuperAdmin = userRole === 'super_admin'
  const isTenantAdmin = userRole === 'tenant_admin'

  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [branches, setBranches] = useState<BranchRecord[]>([])
  const [departments, setDepartments] = useState<DepartmentRecord[]>([])
  const [designations, setDesignations] = useState<DesignationRecord[]>([])
  const [shifts, setShifts] = useState<ShiftRecord[]>([])
  const [holidays, setHolidays] = useState<HolidayRecord[]>([])
  const [policies, setPolicies] = useState<PolicyRecord[]>([])
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  const fetchCompanies = useCallback(async () => {
    setLoading(l => ({ ...l, companies: true }))
    try {
      const params = new URLSearchParams()
      if (selectedCompanyId) params.set('companyId', selectedCompanyId)
      else if (selectedGroupId) params.set('groupId', selectedGroupId)
      else if (isSuperAdmin && selectedTenantId) params.set('tenantId', selectedTenantId)
      const qs = params.toString()
      const url = qs ? `/api/companies?${qs}` : '/api/companies'
      const res = await apiFetch<{ companies: CompanyRecord[] }>(url)
      setCompanies(res.companies || [])
    } catch { toast.error('Failed to load companies') }
    finally { setLoading(l => ({ ...l, companies: false })) }
  }, [isSuperAdmin, selectedTenantId, selectedGroupId, selectedCompanyId])

  const fetchBranches = useCallback(async () => {
    setLoading(l => ({ ...l, branches: true }))
    try {
      const params = new URLSearchParams([['limit', '100']])
      if (selectedCompanyId) params.set('companyId', selectedCompanyId)
      if (isSuperAdmin && selectedTenantId) params.set('tenantId', selectedTenantId)
      const res = await apiFetch<{ data: BranchRecord[] }>(`/api/branches?${params}`)
      setBranches(res.data || [])
    } catch { toast.error('Failed to load branches') }
    finally { setLoading(l => ({ ...l, branches: false })) }
  }, [selectedCompanyId, isSuperAdmin, selectedTenantId])

  const fetchDepartments = useCallback(async () => {
    setLoading(l => ({ ...l, departments: true }))
    try {
      const params = new URLSearchParams([['limit', '100']])
      if (selectedCompanyId) params.set('companyId', selectedCompanyId)
      if (isSuperAdmin && selectedTenantId) params.set('tenantId', selectedTenantId)
      const res = await apiFetch<{ data: DepartmentRecord[] }>(`/api/departments?${params}`)
      setDepartments(res.data || [])
    } catch { toast.error('Failed to load departments') }
    finally { setLoading(l => ({ ...l, departments: false })) }
  }, [selectedCompanyId, isSuperAdmin, selectedTenantId])

  const fetchDesignations = useCallback(async () => {
    setLoading(l => ({ ...l, designations: true }))
    try {
      const params = new URLSearchParams([['limit', '100']])
      if (selectedCompanyId) params.set('companyId', selectedCompanyId)
      if (isSuperAdmin && selectedTenantId) params.set('tenantId', selectedTenantId)
      const res = await apiFetch<{ data: DesignationRecord[] }>(`/api/designations?${params}`)
      setDesignations(res.data || [])
    } catch { toast.error('Failed to load designations') }
    finally { setLoading(l => ({ ...l, designations: false })) }
  }, [selectedCompanyId, isSuperAdmin, selectedTenantId])

  const fetchShifts = useCallback(async () => {
    setLoading(l => ({ ...l, shifts: true }))
    try {
      const params = new URLSearchParams([['limit', '100']])
      if (selectedCompanyId) params.set('companyId', selectedCompanyId)
      if (isSuperAdmin && selectedTenantId) params.set('tenantId', selectedTenantId)
      const res = await apiFetch<{ data: ShiftRecord[] }>(`/api/shifts?${params}`)
      setShifts((res.data || []).map((s: Record<string, unknown>) => ({
        ...s, breakDuration: (s as Record<string, unknown>).breakDuration || (s as Record<string, unknown>).breakMinutes || 60, graceTime: (s as Record<string, unknown>).graceTime || 15,
      })) as ShiftRecord[])
    } catch { toast.error('Failed to load shifts') }
    finally { setLoading(l => ({ ...l, shifts: false })) }
  }, [selectedCompanyId, isSuperAdmin, selectedTenantId])

  const fetchHolidays = useCallback(async () => {
    setLoading(l => ({ ...l, holidays: true }))
    try {
      const params = new URLSearchParams([['limit', '100']])
      if (selectedCompanyId) params.set('companyId', selectedCompanyId)
      if (isSuperAdmin && selectedTenantId) params.set('tenantId', selectedTenantId)
      const res = await apiFetch<{ data: HolidayRecord[] }>(`/api/holidays?${params}`)
      setHolidays(res.data || [])
    } catch { toast.error('Failed to load holidays') }
    finally { setLoading(l => ({ ...l, holidays: false })) }
  }, [selectedCompanyId, isSuperAdmin, selectedTenantId])

  const fetchPolicies = useCallback(async () => {
    setLoading(l => ({ ...l, policies: true }))
    try {
      const params = new URLSearchParams([['limit', '100']])
      if (selectedCompanyId) params.set('companyId', selectedCompanyId)
      if (isSuperAdmin && selectedTenantId) params.set('tenantId', selectedTenantId)
      const res = await apiFetch<{ data: PolicyRecord[] }>(`/api/policies?${params}`)
      setPolicies(res.data || [])
    } catch { toast.error('Failed to load policies') }
    finally { setLoading(l => ({ ...l, policies: false })) }
  }, [selectedCompanyId, isSuperAdmin, selectedTenantId])

  useEffect(() => {
    if (!hydrated) hydrate()
  }, [hydrated, hydrate])

  // Fetch all data when company selection changes (also fires on mount).
  // NOTE: Previously there were TWO useEffects — one on [] and one on
  // [selectedTenantId, selectedGroupId, selectedCompanyId] — causing a
  // double fetch on mount. The second useEffect already fires on mount,
  // so the first was redundant and has been removed.
  useEffect(() => {
    fetchCompanies(); fetchBranches(); fetchDepartments(); fetchDesignations(); fetchShifts(); fetchHolidays(); fetchPolicies()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTenantId, selectedGroupId, selectedCompanyId])

  return {
    user, isAdmin, isSuperAdmin, isTenantAdmin,
    selectedCompanyId, selectedGroupId, selectedTenantId,
    companies, branches, departments, designations, shifts, holidays, policies,
    loading, availableCompanyGroups,
    fetchCompanies, fetchBranches, fetchDepartments, fetchDesignations, fetchShifts, fetchHolidays, fetchPolicies,
  }
}
