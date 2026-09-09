'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  FiLayers, FiMapPin, FiBriefcase, FiCalendar, FiClock, FiPlus, FiSearch,
  FiEye, FiEdit2, FiTrash2, FiX, FiAward, FiMoon, FiSun, FiFileText,
  FiAlertTriangle, FiAlertCircle, FiHome, FiSettings, FiUsers, FiCheckCircle, FiInfo,
} from 'react-icons/fi'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { useCompanyContextStore } from '@/store/companyContextStore'
import ModuleTips from '@/components/ModuleTips'
import ModuleWorkflow from '@/components/ModuleWorkflow'

/* ── Tips ── */
const companyTips = [
  { title: 'Set Up Company First', description: 'Create your company profile before adding branches and departments to ensure proper organizational hierarchy' },
  { title: 'Use Company Codes', description: 'Assign short, unique codes to companies, branches, and departments for easy identification and reporting' },
  { title: 'Define Grades via Designations', description: 'Grades are automatically derived from designation levels — set the level field when creating designations' },
  { title: 'Configure Shifts Early', description: 'Set up work shifts before onboarding employees so attendance tracking works from day one' },
  { title: 'Plan Holiday Calendar', description: 'Upload the holiday calendar at the start of the financial year for accurate leave and payroll calculations' },
]

/* ── Workflow Steps ── */
const companyWorkflowSteps = [
  { step: 1, title: 'Create Company', description: 'Add your organization with basic details like name, code, and address' },
  { step: 2, title: 'Add Branches', description: 'Set up office locations linked to the company' },
  { step: 3, title: 'Create Departments', description: 'Define functional departments within the organization' },
  { step: 4, title: 'Define Designations', description: 'Create job titles with grade levels and salary ranges' },
  { step: 5, title: 'Configure Shifts', description: 'Set up work shift timings for attendance tracking' },
  { step: 6, title: 'Plan Holidays', description: 'Add public, festival, and company holidays for the year' },
  { step: 7, title: 'Set Policies', description: 'Create HR, leave, attendance, and other company policies' },
  { step: 8, title: 'Review Setup', description: 'Verify all organizational structure is complete before onboarding employees' },
]

/* ── Types ── */
interface CompanyRecord {
  id: string;
  name: string;
  code?: string;
  city?: string;
  state?: string;
  country?: string;
  status: string;
  taxId?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  zipCode?: string;
  currency?: string;
  timezone?: string;
  _count?: { departments: number; branches: number };
  // Parent group company + parent tenant — populated by /api/companies which
  // includes the companyGroup.tenant relation. Used to show "under: <group> ·
  // <tenant>" on each company card so the user always knows where a company
  // sits in the Tenant → Group Company → Company hierarchy.
  companyGroup?: {
    id: string;
    name: string;
    tenantId: string;
    tenant?: { id: string; name: string; slug: string } | null;
  };
}
interface BranchRecord { id: string; name: string; code?: string; companyId: string; city?: string; state?: string; country?: string; address?: string; zipCode?: string; phone?: string; email?: string; status: string; company?: { id: string; name: string; code?: string }; _count?: { employees: number } }
interface DepartmentRecord { id: string; name: string; code?: string; companyId: string; status: string; company?: { id: string; name: string }; branch?: { id: string; name: string } | null; _count?: { employees: number; designations: number } }
interface DesignationRecord { id: string; title: string; departmentId: string; level: number; minSalary?: number | null; maxSalary?: number | null; status: string; department?: { id: string; name: string }; _count?: { employees: number } }
interface ShiftRecord { id: string; name: string; startTime: string; endTime: string; breakDuration: number; graceTime: number; status: string }
interface HolidayRecord { id: string; name: string; date: string; type: string; country?: string; description?: string }
interface PolicyRecord { id: string; title: string; category: string; description: string; version: string; status: string; effectiveDate?: string | null; expiryDate?: string | null }

/* ── Helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: getAuthHeaders(), ...options })
  if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Request failed' })); throw new Error(e.error || `HTTP ${res.status}`) }
  return res.json()
}

const fmtSalary = (n?: number | null) => n ? `₹${(n / 100000).toFixed(0)}L` : '—'
const fmtDate = (d: string | Date) => { const dt = new Date(d); return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) }
const fmtDay = (d: string | Date) => new Date(d).toLocaleDateString('en-IN', { weekday: 'long' })
const fmtTime = (t: string) => { if (!t) return ''; if (t.includes('AM') || t.includes('PM')) return t; const [h, m] = t.split(':').map(Number); const ampm = h >= 12 ? 'PM' : 'AM'; return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}` }

const gradeCode = (level: number) => { if (level <= 1) return 'E1'; if (level === 2) return 'E2'; if (level === 3) return 'E3'; if (level >= 4) return 'M1'; return `L${level}` }
const gradeName = (level: number) => { if (level <= 1) return 'E1 - Junior'; if (level === 2) return 'E2 - Mid Level'; if (level === 3) return 'E3 - Senior'; if (level >= 4) return 'M1 - Manager'; return `Level ${level}` }

function getStatusBadge(status: string) {
  const map: Record<string, string> = { active: 'thb-badge thb-badge-success', inactive: 'bg-slate-100 text-slate-600 thb-badge', draft: 'thb-badge thb-badge-warning' }
  const labels: Record<string, string> = { active: 'Active', inactive: 'Inactive', draft: 'Draft' }
  return { className: map[status] || 'thb-badge thb-badge-info', label: labels[status] || status }
}

/* ── Main Component ── */
export default function CompanyManagement() {
  const { user } = useAuthStore()
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '')

  // Company scope — read from the header CompanySwitcher via context store.
  // When the admin selects a company in the dropdown, we re-fetch companies
  // scoped to that selection. selectedTenantId is also passed for super_admin
  // (who can switch across tenants). For tenant_admin, the API auto-scopes to
  // their own tenant via the JWT, so selectedTenantId is ignored.
  const { selectedTenantId, selectedGroupId, selectedCompanyId, availableTenants, availableCompanies, availableCompanyGroups, hydrated, hydrate } = useCompanyContextStore()
  const userRole = (user?.role || 'employee').toLowerCase()
  const isSuperAdmin = userRole === 'super_admin'
  const isTenantAdmin = userRole === 'tenant_admin'
  const canSwitch = isSuperAdmin || isTenantAdmin

  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('companies')

  // Data state
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [branches, setBranches] = useState<BranchRecord[]>([])
  const [departments, setDepartments] = useState<DepartmentRecord[]>([])
  const [designations, setDesignations] = useState<DesignationRecord[]>([])
  const [shifts, setShifts] = useState<ShiftRecord[]>([])
  const [holidays, setHolidays] = useState<HolidayRecord[]>([])
  const [policies, setPolicies] = useState<PolicyRecord[]>([])
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)

  // Form state - inline form instead of dialogs
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})

  // View & delete state - inline instead of dialogs
  const [viewingRecord, setViewingRecord] = useState<{ type: string; data: Record<string, unknown> | null } | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleteInfo, setDeleteInfo] = useState<{ type: string; name: string }>({ type: '', name: '' })
  const [deleting, setDeleting] = useState(false)

  // ============ Data Fetchers ============
  const fetchCompanies = useCallback(async () => {
    setLoading(l => ({ ...l, companies: true }))
    try {
      // Build query string from header dropdown selection. Precedence:
      //   selectedCompanyId  → most specific (single company)
      //   selectedGroupId    → "all companies in this group"
      //   selectedTenantId   → "all companies in this parent" (super_admin only)
      // For tenant_admin, the API scopes via the JWT — selectedTenantId is
      // ignored server-side.
      const params = new URLSearchParams()
      if (selectedCompanyId) {
        params.set('companyId', selectedCompanyId)
      } else if (selectedGroupId) {
        params.set('groupId', selectedGroupId)
      } else if (isSuperAdmin && selectedTenantId) {
        params.set('tenantId', selectedTenantId)
      }
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
      const res = await apiFetch<{ data: BranchRecord[] }>('/api/branches?limit=100')
      setBranches(res.data || [])
    } catch { toast.error('Failed to load branches') }
    finally { setLoading(l => ({ ...l, branches: false })) }
  }, [])

  const fetchDepartments = useCallback(async () => {
    setLoading(l => ({ ...l, departments: true }))
    try {
      const res = await apiFetch<{ data: DepartmentRecord[] }>('/api/departments?limit=100')
      setDepartments(res.data || [])
    } catch { toast.error('Failed to load departments') }
    finally { setLoading(l => ({ ...l, departments: false })) }
  }, [])

  const fetchDesignations = useCallback(async () => {
    setLoading(l => ({ ...l, designations: true }))
    try {
      const res = await apiFetch<{ data: DesignationRecord[] }>('/api/designations?limit=100')
      setDesignations(res.data || [])
    } catch { toast.error('Failed to load designations') }
    finally { setLoading(l => ({ ...l, designations: false })) }
  }, [])

  const fetchShifts = useCallback(async () => {
    setLoading(l => ({ ...l, shifts: true }))
    try {
      const res = await apiFetch<{ data: ShiftRecord[] }>('/api/shifts?limit=100')
      setShifts((res.data || []).map((s: Record<string, unknown>) => ({
        ...s, breakDuration: (s as Record<string, unknown>).breakDuration || (s as Record<string, unknown>).breakMinutes || 60, graceTime: (s as Record<string, unknown>).graceTime || 15,
      })) as ShiftRecord[])
    } catch { toast.error('Failed to load shifts') }
    finally { setLoading(l => ({ ...l, shifts: false })) }
  }, [])

  const fetchHolidays = useCallback(async () => {
    setLoading(l => ({ ...l, holidays: true }))
    try {
      const res = await apiFetch<{ data: HolidayRecord[] }>('/api/holidays?limit=100')
      setHolidays(res.data || [])
    } catch { toast.error('Failed to load holidays') }
    finally { setLoading(l => ({ ...l, holidays: false })) }
  }, [])

  const fetchPolicies = useCallback(async () => {
    setLoading(l => ({ ...l, policies: true }))
    try {
      const res = await apiFetch<{ data: PolicyRecord[] }>('/api/policies?limit=100')
      setPolicies(res.data || [])
    } catch { toast.error('Failed to load policies') }
    finally { setLoading(l => ({ ...l, policies: false })) }
  }, [])

  // Hydrate the company context store on mount so we have the selected
  // tenant/company IDs ready for fetchCompanies. The fetch itself also depends
  // on these values, so any time they change we re-fetch the company list.
  useEffect(() => {
    if (!hydrated) hydrate()
  }, [hydrated, hydrate])

  useEffect(() => {
    fetchCompanies(); fetchBranches(); fetchDepartments(); fetchDesignations(); fetchShifts(); fetchHolidays(); fetchPolicies()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-fetch companies whenever the header dropdown selection changes. This
  // is the key wiring that makes the dropdown actually do something on this
  // page — without it, the dropdown would just change UI state but the data
  // would stay the same. We include selectedGroupId so that picking a group
  // company in the dropdown (which sets selectedGroupId, not selectedCompanyId)
  // also triggers a re-fetch scoped to that group.
  useEffect(() => {
    fetchCompanies()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTenantId, selectedGroupId, selectedCompanyId])

  // ============ CRUD Handlers ============
  const refreshMap: Record<string, () => void> = {
    companies: fetchCompanies, branches: fetchBranches, departments: fetchDepartments,
    designations: fetchDesignations, shifts: fetchShifts, holidays: fetchHolidays, policies: fetchPolicies,
  }

  const getDefaultForm = (type: string): Record<string, string> => {
    switch (type) {
      case 'companies': return { name: '', code: '', companyGroupId: '', country: 'India', currency: 'INR', timezone: 'Asia/Kolkata', city: '', state: '', address: '', zipCode: '', phone: '', email: '', website: '', taxId: '', status: 'active' }
      case 'branches': return { name: '', code: '', companyId: companies[0]?.id || '', country: 'India', state: '', city: '', address: '', zipCode: '', phone: '', email: '', status: 'active' }
      case 'departments': return { name: '', code: '', companyId: companies[0]?.id || '', status: 'active' }
      case 'designations': return { title: '', departmentId: departments[0]?.id || '', level: '1', minSalary: '', maxSalary: '', status: 'active' }
      case 'shifts': return { name: '', startTime: '09:00', endTime: '18:00', breakDuration: '60', graceTime: '15', status: 'active' }
      case 'holidays': return { name: '', date: '', type: 'public', country: 'India', description: '' }
      case 'policies': return { title: '', category: 'hr', description: '', version: '1.0', status: 'active', effectiveDate: '', expiryDate: '' }
      default: return {}
    }
  }

  const getFormFromRecord = (type: string, r: Record<string, unknown>): Record<string, string> => {
    const f = getDefaultForm(type)
    Object.keys(f).forEach(k => { if (r[k] !== undefined && r[k] !== null) f[k] = String(r[k]) })
    return f
  }

  const openAdd = () => {
    setEditingId(null)
    setForm(getDefaultForm(activeTab))
    setShowForm(true)
    setViewingRecord(null)
    setDeleteConfirmId(null)
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  const openEdit = (type: string, record: Record<string, unknown>) => {
    setEditingId(record.id as string)
    setForm(getFormFromRecord(type, record))
    setShowForm(true)
    setViewingRecord(null)
    setDeleteConfirmId(null)
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  const openView = (type: string, record: Record<string, unknown>) => {
    setViewingRecord({ type, data: record })
    setShowForm(false)
    setDeleteConfirmId(null)
    setTimeout(() => document.getElementById('view-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  const handleCancelForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm({})
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setSubmitting(true)
    try {
      const type = activeTab
      const isEdit = !!editingId
      const url = `/api/${type === 'companies' ? 'companies' : type}`
      const method = isEdit ? 'PUT' : 'POST'
      const body = { ...form }
      if (isEdit) body.id = editingId

      // BUG FIX: For company creation, tenant_admin must provide companyGroupId.
      // Only super_admin can auto-create groups. If companyGroupId is missing
      // for a non-super_admin, show a clear error before hitting the API.
      if (type === 'companies' && !isEdit && !isSuperAdmin && !body.companyGroupId) {
        setSubmitting(false)
        toast.error(
          availableCompanyGroups.length === 0
            ? 'No group companies exist under your tenant yet. Please ask your super admin to create one first.'
            : 'Please select a group company. Only super admins can create new group companies.'
        )
        return
      }
      // For super_admin creating a company without a group, delete the empty
      // companyGroupId so the backend auto-creates a group. For tenant_admin,
      // the check above guarantees companyGroupId is set.
      if (type === 'companies' && !body.companyGroupId) {
        delete body.companyGroupId
      }

      await apiFetch(url, { method, body: JSON.stringify(body) })
      const label = type.slice(0, -1).replace(/^./, c => c.toUpperCase())
      toast.success(`${label} ${isEdit ? 'updated' : 'created'} successfully`)
      handleCancelForm()
      refreshMap[type]?.()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Operation failed')
    } finally { setSubmitting(false) }
  }

  const handleDelete = async () => {
    const { type } = deleteInfo
    setDeleting(true)
    try {
      await apiFetch(`/api/${type}?id=${deleteConfirmId}`, { method: 'DELETE' })
      toast.success('Deleted successfully')
      refreshMap[type]?.()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
      setDeleteConfirmId(null)
      setDeleteInfo({ type: '', name: '' })
    }
  }

  const updateForm = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  // ============ Filtered Data ============
  const q = search.toLowerCase()
  const filterList = <T extends Record<string, unknown>>(list: T[], fields: (keyof T)[]) =>
    list.filter(item => fields.some(f => String(item[f] ?? '').toLowerCase().includes(q)))

  const fCompanies = filterList(companies, ['name', 'code', 'city'])
  const fBranches = filterList(branches, ['name', 'city', 'address'])
  const fDepartments = filterList(departments, ['name', 'code'])
  const fDesignations = filterList(designations, ['title'])
  const fShifts = filterList(shifts, ['name'])
  const fHolidays = filterList(holidays, ['name'])
  const fPolicies = filterList(policies, ['title', 'category'])

  // ============ Tab Config ============
  const tabs = [
    { key: 'companies', label: 'Companies', icon: FiHome },
    { key: 'branches', label: 'Branches', icon: FiMapPin },
    { key: 'departments', label: 'Departments', icon: FiBriefcase },
    { key: 'designations', label: 'Designations', icon: FiAward },
    { key: 'grades', label: 'Grades', icon: FiLayers },
    { key: 'shifts', label: 'Shifts', icon: FiClock },
    { key: 'holidays', label: 'Holidays', icon: FiCalendar },
    { key: 'policies', label: 'Policies', icon: FiFileText },
  ]

  const addBtnLabel = () => {
    const map: Record<string, string> = { companies: 'Company', branches: 'Branch', departments: 'Department', designations: 'Designation', grades: 'Grade', shifts: 'Shift', holidays: 'Holiday', policies: 'Policy' }
    return `Add ${map[activeTab] || activeTab.slice(0, -1)}`
  }

  // ============ View Detail Renderer ============
  const renderViewDetail = () => {
    if (!viewingRecord?.data) return null
    const d = viewingRecord.data
    const type = viewingRecord.type

    const renderField = (label: string, value: unknown) => (
      <div>
        <p className="text-xs font-medium text-thb-text-muted mb-1">{label}</p>
        <p className="text-sm font-medium text-thb-text-primary">{value || '—'}</p>
      </div>
    )

    return (
      <div id="view-detail" className="thb-card border-l-4 border-l-teal-500 transition-all duration-300 ease-in-out">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2">
              <FiEye className="w-5 h-5 text-teal-500" />
              Details
            </h2>
            <button onClick={() => setViewingRecord(null)} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors">
              <FiX className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {type === 'companies' && (
              <>
                {renderField('Name', d.name)}{renderField('Code', d.code)}{renderField('Status', d.status)}
                {renderField('Parent Group Company', (d.companyGroup as Record<string, unknown>)?.name || '—')}
                {isSuperAdmin && renderField('Parent Tenant', ((d.companyGroup as Record<string, unknown>)?.tenant as Record<string, unknown>)?.name || '—')}
                {renderField('City', d.city)}{renderField('State', d.state)}{renderField('Country', d.country)}
                {renderField('Currency', d.currency)}{renderField('Phone', d.phone)}{renderField('Email', d.email)}
                {renderField('Website', d.website)}{renderField('Tax ID / GST', d.taxId)}{renderField('Address', d.address)}
                {renderField('ZIP Code', d.zipCode)}
              </>
            )}
            {type === 'branches' && (
              <>
                {renderField('Name', d.name)}{renderField('Code', d.code)}{renderField('Status', d.status)}
                {renderField('Company', (d.company as Record<string, unknown>)?.name)}{renderField('City', d.city)}{renderField('State', d.state)}
                {renderField('Country', d.country)}{renderField('Phone', d.phone)}{renderField('Email', d.email)}
                {renderField('Address', d.address)}{renderField('Employees', d._count ? (d._count as Record<string, number>).employees : '—')}
              </>
            )}
            {type === 'departments' && (
              <>
                {renderField('Name', d.name)}{renderField('Code', d.code)}{renderField('Status', d.status)}
                {renderField('Company', (d.company as Record<string, unknown>)?.name)}{renderField('Employees', d._count ? (d._count as Record<string, number>).employees : '—')}
                {renderField('Designations', d._count ? (d._count as Record<string, number>).designations : '—')}
              </>
            )}
            {type === 'designations' && (
              <>
                {renderField('Title', d.title)}{renderField('Grade', gradeCode(Number(d.level)))}{renderField('Department', (d.department as Record<string, unknown>)?.name)}
                {renderField('Min Salary', d.minSalary ? fmtSalary(Number(d.minSalary)) : '—')}{renderField('Max Salary', d.maxSalary ? fmtSalary(Number(d.maxSalary)) : '—')}{renderField('Level', d.level)}
                {renderField('Status', d.status)}
              </>
            )}
            {type === 'shifts' && (
              <>
                {renderField('Name', d.name)}{renderField('Start Time', fmtTime(String(d.startTime || '')))}{renderField('End Time', fmtTime(String(d.endTime || '')))}
                {renderField('Break Duration', `${d.breakDuration || 60} min`)}{renderField('Grace Time', `${d.graceTime || 15} min`)}{renderField('Status', d.status)}
              </>
            )}
            {type === 'holidays' && (
              <>
                {renderField('Name', d.name)}{renderField('Date', fmtDate(String(d.date)))}{renderField('Day', fmtDay(String(d.date)))}
                {renderField('Type', d.type)}{renderField('Country', d.country)}{renderField('Description', d.description)}
              </>
            )}
            {type === 'policies' && (
              <>
                {renderField('Title', d.title)}{renderField('Category', d.category)}{renderField('Version', d.version)}
                {renderField('Status', d.status)}{renderField('Effective Date', d.effectiveDate ? fmtDate(String(d.effectiveDate)) : '—')}{renderField('Expiry Date', d.expiryDate ? fmtDate(String(d.expiryDate)) : '—')}
                {renderField('Description', d.description)}
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ============ Form Renderer ============
  const renderForm = () => {
    const inputClass = 'w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400'
    const selectClass = inputClass

    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        {activeTab === 'companies' && (
          <>
            {/* Group Company selector — required for tenant_admin, optional for super_admin */}
            {!isSuperAdmin && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">
                  Group Company {!isSuperAdmin && '*'}
                </label>
                {availableCompanyGroups.length === 0 ? (
                  <div className="px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                    <FiAlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold mb-0.5">No group companies available</p>
                      <p>Only your <b>super admin</b> can create group companies. Please ask them to create at least one group under your tenant first.</p>
                    </div>
                  </div>
                ) : (
                  <select
                    value={form.companyGroupId || ''}
                    onChange={e => updateForm('companyGroupId', e.target.value)}
                    className={selectClass}
                    required={!isSuperAdmin}
                  >
                    <option value="">— Select a group company —</option>
                    {availableCompanyGroups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Name *</label><input type="text" value={form.name || ''} onChange={e => updateForm('name', e.target.value)} required className={inputClass} placeholder="Company name" /></div>
              <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Code</label><input type="text" value={form.code || ''} onChange={e => updateForm('code', e.target.value)} className={inputClass} placeholder="e.g. 3BOXES" /></div>
              <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Currency</label><select value={form.currency || 'INR'} onChange={e => updateForm('currency', e.target.value)} className={selectClass}><option value="INR">INR (₹)</option><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option></select></div>
              <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">City</label><input type="text" value={form.city || ''} onChange={e => updateForm('city', e.target.value)} className={inputClass} /></div>
              <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">State</label><input type="text" value={form.state || ''} onChange={e => updateForm('state', e.target.value)} className={inputClass} /></div>
              <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Country</label><input type="text" value={form.country || ''} onChange={e => updateForm('country', e.target.value)} className={inputClass} /></div>
              <div className="sm:col-span-2 lg:col-span-3"><label className="block text-xs font-medium text-thb-text-secondary mb-1">Address</label><input type="text" value={form.address || ''} onChange={e => updateForm('address', e.target.value)} className={inputClass} /></div>
              <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Phone</label><input type="tel" value={form.phone || ''} onChange={e => updateForm('phone', e.target.value)} className={inputClass} /></div>
              <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Email</label><input type="email" value={form.email || ''} onChange={e => updateForm('email', e.target.value)} className={inputClass} /></div>
              <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Website</label><input type="url" value={form.website || ''} onChange={e => updateForm('website', e.target.value)} className={inputClass} /></div>
              <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Tax ID / GST</label><input type="text" value={form.taxId || ''} onChange={e => updateForm('taxId', e.target.value)} className={inputClass} /></div>
              <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">ZIP Code</label><input type="text" value={form.zipCode || ''} onChange={e => updateForm('zipCode', e.target.value)} className={inputClass} /></div>
              <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Status</label><select value={form.status || 'active'} onChange={e => updateForm('status', e.target.value)} className={selectClass}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
            </div>
          </>
        )}
        {activeTab === 'branches' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Name *</label><input type="text" value={form.name || ''} onChange={e => updateForm('name', e.target.value)} required className={inputClass} placeholder="Branch name" /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Code</label><input type="text" value={form.code || ''} onChange={e => updateForm('code', e.target.value)} className={inputClass} placeholder="e.g. MUM" /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Company *</label><select value={form.companyId || ''} onChange={e => updateForm('companyId', e.target.value)} required className={selectClass}><option value="">Select Company</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">City</label><input type="text" value={form.city || ''} onChange={e => updateForm('city', e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">State</label><input type="text" value={form.state || ''} onChange={e => updateForm('state', e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Country</label><input type="text" value={form.country || ''} onChange={e => updateForm('country', e.target.value)} className={inputClass} /></div>
            <div className="sm:col-span-2 lg:col-span-3"><label className="block text-xs font-medium text-thb-text-secondary mb-1">Address</label><input type="text" value={form.address || ''} onChange={e => updateForm('address', e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Phone</label><input type="tel" value={form.phone || ''} onChange={e => updateForm('phone', e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Email</label><input type="email" value={form.email || ''} onChange={e => updateForm('email', e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Status</label><select value={form.status || 'active'} onChange={e => updateForm('status', e.target.value)} className={selectClass}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
          </div>
        )}
        {activeTab === 'departments' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Name *</label><input type="text" value={form.name || ''} onChange={e => updateForm('name', e.target.value)} required className={inputClass} placeholder="Department name" /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Code</label><input type="text" value={form.code || ''} onChange={e => updateForm('code', e.target.value)} className={inputClass} placeholder="e.g. ENG" /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Company *</label><select value={form.companyId || ''} onChange={e => updateForm('companyId', e.target.value)} required className={selectClass}><option value="">Select Company</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Status</label><select value={form.status || 'active'} onChange={e => updateForm('status', e.target.value)} className={selectClass}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
          </div>
        )}
        {activeTab === 'designations' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Title *</label><input type="text" value={form.title || ''} onChange={e => updateForm('title', e.target.value)} required className={inputClass} placeholder="Designation title" /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Department *</label><select value={form.departmentId || ''} onChange={e => updateForm('departmentId', e.target.value)} required className={selectClass}><option value="">Select Department</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Level</label><input type="number" value={form.level || '1'} onChange={e => updateForm('level', e.target.value)} className={inputClass} placeholder="1" /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Min Salary (₹)</label><input type="number" value={form.minSalary || ''} onChange={e => updateForm('minSalary', e.target.value)} className={inputClass} placeholder="300000" /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Max Salary (₹)</label><input type="number" value={form.maxSalary || ''} onChange={e => updateForm('maxSalary', e.target.value)} className={inputClass} placeholder="600000" /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Status</label><select value={form.status || 'active'} onChange={e => updateForm('status', e.target.value)} className={selectClass}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
          </div>
        )}
        {activeTab === 'shifts' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Name *</label><input type="text" value={form.name || ''} onChange={e => updateForm('name', e.target.value)} required className={inputClass} placeholder="Shift name" /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Start Time</label><input type="time" value={form.startTime || '09:00'} onChange={e => updateForm('startTime', e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">End Time</label><input type="time" value={form.endTime || '18:00'} onChange={e => updateForm('endTime', e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Break (min)</label><input type="number" value={form.breakDuration || '60'} onChange={e => updateForm('breakDuration', e.target.value)} className={inputClass} placeholder="60" /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Grace Time (min)</label><input type="number" value={form.graceTime || '15'} onChange={e => updateForm('graceTime', e.target.value)} className={inputClass} placeholder="15" /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Status</label><select value={form.status || 'active'} onChange={e => updateForm('status', e.target.value)} className={selectClass}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
          </div>
        )}
        {activeTab === 'holidays' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Name *</label><input type="text" value={form.name || ''} onChange={e => updateForm('name', e.target.value)} required className={inputClass} placeholder="Holiday name" /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Date *</label><input type="date" value={form.date || ''} onChange={e => updateForm('date', e.target.value)} required className={inputClass} /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Type</label><select value={form.type || 'public'} onChange={e => updateForm('type', e.target.value)} className={selectClass}><option value="public">Public</option><option value="festival">Festival</option><option value="state">State</option><option value="company">Company</option><option value="optional">Optional</option></select></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Country</label><input type="text" value={form.country || ''} onChange={e => updateForm('country', e.target.value)} className={inputClass} /></div>
            <div className="sm:col-span-2"><label className="block text-xs font-medium text-thb-text-secondary mb-1">Description</label><input type="text" value={form.description || ''} onChange={e => updateForm('description', e.target.value)} className={inputClass} placeholder="Holiday description" /></div>
          </div>
        )}
        {activeTab === 'policies' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Title *</label><input type="text" value={form.title || ''} onChange={e => updateForm('title', e.target.value)} required className={inputClass} placeholder="Policy title" /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Category</label><select value={form.category || 'hr'} onChange={e => updateForm('category', e.target.value)} className={selectClass}><option value="hr">HR</option><option value="it">IT</option><option value="leave">Leave</option><option value="attendance">Attendance</option><option value="finance">Finance</option><option value="work">Work</option><option value="safety">Safety</option><option value="code_of_conduct">Code of Conduct</option></select></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Version</label><input type="text" value={form.version || '1.0'} onChange={e => updateForm('version', e.target.value)} className={inputClass} placeholder="1.0" /></div>
            <div className="sm:col-span-2 lg:col-span-3"><label className="block text-xs font-medium text-thb-text-secondary mb-1">Description</label><input type="text" value={form.description || ''} onChange={e => updateForm('description', e.target.value)} className={inputClass} placeholder="Brief description" /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Effective Date</label><input type="date" value={form.effectiveDate || ''} onChange={e => updateForm('effectiveDate', e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Expiry Date</label><input type="date" value={form.expiryDate || ''} onChange={e => updateForm('expiryDate', e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Status</label><select value={form.status || 'active'} onChange={e => updateForm('status', e.target.value)} className={selectClass}><option value="active">Active</option><option value="draft">Draft</option><option value="inactive">Inactive</option></select></div>
          </div>
        )}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-thb-border">
          <button type="button" onClick={handleCancelForm} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">Cancel</button>
          <button type="submit" disabled={submitting} className="px-6 py-2.5 rounded-lg bg-teal-500 text-white text-sm font-medium hover:bg-teal-600 disabled:opacity-50 shadow-sm shadow-teal-500/25 transition-colors">
            {submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    )
  }

  // ============ Action Buttons Helper ============
  const renderActions = (type: string, record: Record<string, unknown>) => {
    const isDeleting = deleteConfirmId === (record.id as string)
    const name = (record.name || record.title) as string
    return (
      <div className="flex items-center gap-1">
        <button onClick={() => openView(type, record)} className="p-2 rounded-lg text-thb-text-muted hover:text-teal-500 hover:bg-teal-50 transition-colors" title="View"><FiEye className="w-4 h-4" /></button>
        {isAdmin && (
          <>
            <button onClick={() => openEdit(type, record)} className="p-2 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Edit"><FiEdit2 className="w-4 h-4" /></button>
            <button onClick={() => { setDeleteConfirmId(record.id as string); setDeleteInfo({ type, name }); setViewingRecord(null) }} className="p-2 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><FiTrash2 className="w-4 h-4" /></button>
          </>
        )}
      </div>
    )
  }

  // ============ Delete Confirmation ============
  const renderDeleteConfirm = (recordId: string, recordName: string) => (
    <div className="flex items-center justify-between px-4 py-3 bg-red-50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
          <FiAlertTriangle className="w-4 h-4 text-red-500" />
        </div>
        <span className="text-sm text-red-700 font-medium">Delete &quot;{recordName}&quot;? This cannot be undone.</span>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={handleDelete} disabled={deleting} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">
          {deleting ? 'Deleting...' : 'Confirm Delete'}
        </button>
        <button onClick={() => { setDeleteConfirmId(null); setDeleteInfo({ type: '', name: '' }) }} className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
      </div>
    </div>
  )

  // ============ Table Container ============
  const TableWrapper = ({ title, icon, count, children }: { title: string; icon: React.ReactNode; count: number; children: React.ReactNode }) => (
    <div className="thb-card overflow-hidden">
      <div className="px-4 py-3 border-b border-thb-border bg-slate-50/50 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-thb-text-primary">{title}</h3>
        <span className="text-xs text-thb-text-muted">({count})</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          {children}
        </table>
      </div>
    </div>
  )

  const TH = ({ children }: { children: React.ReactNode }) => <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider border-b border-thb-border bg-slate-50/50">{children}</th>
  const TD = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => <td className={`px-4 py-3 text-sm text-thb-text-secondary border-b border-thb-border/50 ${className}`}>{children}</td>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiLayers className="w-6 h-6 text-teal-500" />
            Company Management
          </h1>
          <p className="text-thb-text-secondary mt-1">Manage companies, branches, departments, and organizational structure</p>
        </div>
        {/* The "Add Company" button is intentionally hidden on the 'companies' tab.
            Companies are created in the Super Admin or Tenant Admin modules
            (which enforce proper group-company + tenant-quota rules). This tab
            only lists the existing companies for reference and to manage their
            branches / departments / etc. */}
        {isAdmin && activeTab !== 'grades' && activeTab !== 'companies' && (
          <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-medium text-sm shadow-sm shadow-teal-500/25 transition-colors">
            <FiPlus className="w-4 h-4" />
            {addBtnLabel()}
          </button>
        )}
      </div>

      {/* Module Tips */}
      <ModuleTips
        moduleKey="company"
        title="Company Management Tips"
        tips={companyTips}
        userRole={user?.role}
      />

      {/* Getting Started Info Banner */}
      <div className="thb-card border-l-4 border-l-teal-500 bg-gradient-to-r from-teal-50/50 to-green-50/50">
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
              <FiCheckCircle className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-thb-text-primary mb-1">Getting Started with Company Management</h3>
              <p className="text-sm text-thb-text-secondary leading-relaxed">
                Follow this step-by-step workflow to set up your organizational structure. Start by creating your company profile, 
                then add branches and departments. Define designations with grade levels and salary ranges, configure work shifts 
                for attendance tracking, plan your holiday calendar, and set up company policies. Once your organization structure 
                is complete, you can begin onboarding employees.
              </p>
            </div>
          </div>
        </div>
      </div>

      <ModuleWorkflow
        moduleKey="company"
        title="How to Set Up Your Organization"
        subtitle="Follow this workflow to configure your organizational structure"
        steps={companyWorkflowSteps}
        accentColor="violet"
        userRole={user?.role}
      />

      {/* Search & Tabs */}
      <div className="thb-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, code, city..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-thb-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
            />
          </div>
        </div>

        <div className="mt-3 border-t border-thb-border pt-3">
          <nav className="flex flex-wrap gap-1">
            {tabs.map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setShowForm(false); setViewingRecord(null); setDeleteConfirmId(null) }}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'bg-teal-500 text-white shadow-sm'
                      : 'text-thb-text-secondary hover:bg-slate-100 hover:text-thb-text-primary'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* View Detail */}
      {viewingRecord && renderViewDetail()}

      {/* Inline Add/Edit Form */}
      {showForm && (
        <div id="crud-form" className="thb-card border-l-4 border-l-teal-500 transition-all duration-300 ease-in-out">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">
                {editingId ? 'Edit' : 'Add'} {tabs.find(t => t.key === activeTab)?.label.slice(0, -1) || activeTab.slice(0, -1)}
              </h2>
              <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            {renderForm()}
          </div>
        </div>
      )}

      {/* ── COMPANIES TAB ── */}
      {activeTab === 'companies' && (
        loading.companies ? (
          <div className="flex items-center justify-center py-12"><FiSettings className="w-8 h-8 animate-spin text-teal-400" /></div>
        ) : (
          <>
            {/* Info banner — explains where companies are created */}
            <div className="thb-card border-l-4 border-l-green-500 bg-gradient-to-r from-green-50/60 to-emerald-50/40">
              <div className="p-4 flex items-start gap-3">
                <FiInfo className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-slate-700 flex-1">
                  <p className="font-semibold text-slate-900 mb-0.5">Companies are managed by admins</p>
                  <p className="text-xs text-slate-600">
                    New companies can only be created from the <b>Super Admin</b> or <b>Tenant Admin</b> modules,
                    where the proper group-company parent and tenant-level company quota are enforced. Use this
                    tab to view existing companies and manage their branches, departments, and other
                    organizational structure.
                  </p>
                  {/* Active scope banner — only show for admins who can switch context */}
                  {canSwitch && (
                    <div className="mt-3 flex items-center gap-2 flex-wrap text-[11px]">
                      <span className="text-slate-500 font-semibold uppercase tracking-wider">Showing:</span>
                      {selectedCompanyId ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                          <FiBriefcase className="w-3 h-3" />
                          {availableCompanies.find((c) => c.id === selectedCompanyId)?.name || 'Selected company'}
                        </span>
                      ) : selectedGroupId ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200 font-semibold">
                          <FiLayers className="w-3 h-3" />
                          All companies in group "{availableCompanyGroups.find((g) => g.id === selectedGroupId)?.name || 'selected'}"
                        </span>
                      ) : isSuperAdmin && selectedTenantId ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200 font-semibold">
                          <FiHome className="w-3 h-3" />
                          All companies under {availableTenants.find((t) => t.id === selectedTenantId)?.name || 'selected parent'}
                        </span>
                      ) : isTenantAdmin ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200 font-semibold">
                          <FiHome className="w-3 h-3" />
                          All companies in your tenant
                        </span>
                      ) : isSuperAdmin ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                          <FiHome className="w-3 h-3" />
                          All companies across all parents (pick a parent in the header dropdown to narrow)
                        </span>
                      ) : null}
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-500">{companies.length} shown</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="thb-card thb-card-hover p-5">
                <div className="flex items-start justify-between">
                  <div><p className="text-xs font-medium text-thb-text-secondary">Total Companies</p><p className="text-2xl font-bold text-thb-text-primary mt-1">{companies.length}</p></div>
                  <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 ring-1 ring-teal-100"><FiHome className="w-5 h-5" /></div>
                </div>
              </div>
              <div className="thb-card thb-card-hover p-5">
                <div className="flex items-start justify-between">
                  <div><p className="text-xs font-medium text-thb-text-secondary">Total Branches</p><p className="text-2xl font-bold text-thb-text-primary mt-1">{branches.length}</p></div>
                  <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600 ring-1 ring-green-100"><FiMapPin className="w-5 h-5" /></div>
                </div>
              </div>
              <div className="thb-card thb-card-hover p-5">
                <div className="flex items-start justify-between">
                  <div><p className="text-xs font-medium text-thb-text-secondary">Total Departments</p><p className="text-2xl font-bold text-teal-600 mt-1">{departments.length}</p></div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 ring-1 ring-emerald-100"><FiBriefcase className="w-5 h-5" /></div>
                </div>
              </div>
            </div>
            {/* Company Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fCompanies.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <FiHome className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
                  <p className="text-thb-text-secondary font-medium">No companies found</p>
                  <p className="text-xs text-thb-text-muted mt-1 max-w-sm mx-auto">
                    {selectedCompanyId
                      ? 'No company matches the header dropdown selection. Pick "All companies" in the dropdown to see the full list.'
                      : selectedGroupId
                        ? `No companies have been inducted under the selected group "${availableCompanyGroups.find((g) => g.id === selectedGroupId)?.name || ''}" yet. Use the Tenant Admin → Companies page to induct one.`
                        : isSuperAdmin && selectedTenantId
                          ? 'No companies have been inducted under any group company for this parent yet. Open Super Admin → Group Companies to create groups and induct companies.'
                          : 'No companies have been created in your tenant yet. Ask your super admin to create a group company first, then induct companies under it from the Tenant Admin module.'}
                  </p>
                </div>
              ) : fCompanies.map(c => {
                const badge = getStatusBadge(c.status)
                const groupName = c.companyGroup?.name
                const tenantName = c.companyGroup?.tenant?.name
                return (
                  <div key={c.id} className={`thb-card thb-card-hover transition-colors ${deleteConfirmId === c.id ? 'bg-red-50 border-l-4 border-l-red-500' : ''}`}>
                    <div className="p-5">
                      {deleteConfirmId === c.id ? (
                        renderDeleteConfirm(c.id, c.name)
                      ) : (
                        <>
                          <div className="flex items-start justify-between mb-3">
                            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center"><FiHome className="w-5 h-5 text-teal-500" /></div>
                            {renderActions('companies', c as unknown as Record<string, unknown>)}
                          </div>
                          <h3 className="text-thb-text-primary font-semibold text-lg">{c.name}</h3>
                          <p className="text-thb-text-muted text-sm mb-1">{c.code || '—'} · {c.city || '—'}, {c.state || ''}</p>
                          <p className="text-thb-text-muted text-xs mb-2">{c.taxId ? `GST: ${c.taxId}` : ''} {c.phone ? `· ${c.phone}` : ''}</p>
                          {/* Parent group company + tenant badge — makes it obvious
                              where this company sits in the Tenant → Group → Company
                              hierarchy. For tenant_admin, the tenant name is the same
                              as their own so we hide it to reduce noise. */}
                          {(groupName || tenantName) && (
                            <div className="flex items-center gap-1.5 flex-wrap mb-3 text-[10px]">
                              {groupName && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 font-semibold" title="Parent group company">
                                  <FiLayers className="w-2.5 h-2.5" />
                                  {groupName}
                                </span>
                              )}
                              {isSuperAdmin && tenantName && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold" title="Parent company (tenant)">
                                  <FiHome className="w-2.5 h-2.5" />
                                  {tenantName}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="grid grid-cols-3 gap-2 text-center border-t border-thb-border pt-3">
                            <div><p className="text-lg font-bold text-thb-text-primary">{c._count?.branches || 0}</p><p className="text-xs text-thb-text-muted">Branches</p></div>
                            <div><p className="text-lg font-bold text-thb-text-primary">{c._count?.departments || 0}</p><p className="text-xs text-thb-text-muted">Depts</p></div>
                            <div><span className={badge.className}>{badge.label}</span></div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )
      )}

      {/* ── BRANCHES TAB ── */}
      {activeTab === 'branches' && (
        loading.branches ? <div className="flex items-center justify-center py-12"><FiSettings className="w-8 h-8 animate-spin text-teal-400" /></div> : (
          <>
            {companies.length === 0 && (
              <div className="thb-card border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50/60 to-orange-50/40">
                <div className="p-4 flex items-start gap-3">
                  <FiInfo className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-slate-700">
                    <p className="font-semibold text-slate-900 mb-0.5">No companies inducted yet</p>
                    <p className="text-xs text-slate-600">
                      The <b>Company</b> dropdown on the create-branch form is empty because there are no companies
                      in your tenant yet. Please ask your <b>Tenant Admin</b> to induct at least one company under a
                      {' '}<b>Group Company</b> first (via <b>Tenant Admin → Group Companies</b> and
                      {' '}<b>Tenant Admin → Companies</b>).
                    </p>
                  </div>
                </div>
              </div>
            )}
            <TableWrapper title="Branches" icon={<FiMapPin className="w-4 h-4 text-teal-500" />} count={branches.length}>
            <thead><tr><TH>Branch</TH><TH>Company</TH><TH>Location</TH><TH>Status</TH><TH className="text-right">Actions</TH></tr></thead>
            <tbody>
              {fBranches.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center"><FiMapPin className="w-10 h-10 text-thb-text-muted mx-auto mb-3" /><p className="text-thb-text-secondary font-medium">No branches found</p></td></tr>
              ) : fBranches.map(b => {
                const badge = getStatusBadge(b.status)
                return (
                  <tr key={b.id} className={`transition-colors ${deleteConfirmId === b.id ? 'bg-red-50' : 'hover:bg-slate-50/50'}`}>
                    {deleteConfirmId === b.id ? (
                      <td colSpan={5} className="px-4 py-3">{renderDeleteConfirm(b.id, b.name)}</td>
                    ) : (
                      <>
                        <TD className="font-medium text-thb-text-primary"><FiMapPin className="w-4 h-4 inline mr-2 text-teal-400" />{b.name}</TD>
                        <TD>{b.company?.name || '—'}</TD>
                        <TD>{b.city || '—'}, {b.state || ''}</TD>
                        <TD><span className={badge.className}>{badge.label}</span></TD>
                        <TD className="text-right">{renderActions('branches', b as unknown as Record<string, unknown>)}</TD>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </TableWrapper>
          </>
        )
      )}

      {/* ── DEPARTMENTS TAB ── */}
      {activeTab === 'departments' && (
        loading.departments ? <div className="flex items-center justify-center py-12"><FiSettings className="w-8 h-8 animate-spin text-teal-400" /></div> : (
          <>
            {companies.length === 0 && (
              <div className="thb-card border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50/60 to-orange-50/40">
                <div className="p-4 flex items-start gap-3">
                  <FiInfo className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-slate-700">
                    <p className="font-semibold text-slate-900 mb-0.5">No companies inducted yet</p>
                    <p className="text-xs text-slate-600">
                      The <b>Company</b> dropdown on the create-department form is empty because there are no companies
                      in your tenant yet. Please ask your <b>Tenant Admin</b> to induct at least one company under a
                      {' '}<b>Group Company</b> first (via <b>Tenant Admin → Group Companies</b> and
                      {' '}<b>Tenant Admin → Companies</b>).
                    </p>
                  </div>
                </div>
              </div>
            )}
            <TableWrapper title="Departments" icon={<FiBriefcase className="w-4 h-4 text-teal-500" />} count={departments.length}>
            <thead><tr><TH>Department</TH><TH>Company</TH><TH>Employees</TH><TH>Designations</TH><TH>Status</TH><TH className="text-right">Actions</TH></tr></thead>
            <tbody>
              {fDepartments.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center"><FiBriefcase className="w-10 h-10 text-thb-text-muted mx-auto mb-3" /><p className="text-thb-text-secondary font-medium">No departments found</p></td></tr>
              ) : fDepartments.map(d => {
                const badge = getStatusBadge(d.status)
                return (
                  <tr key={d.id} className={`transition-colors ${deleteConfirmId === d.id ? 'bg-red-50' : 'hover:bg-slate-50/50'}`}>
                    {deleteConfirmId === d.id ? (
                      <td colSpan={6} className="px-4 py-3">{renderDeleteConfirm(d.id, d.name)}</td>
                    ) : (
                      <>
                        <TD className="font-medium text-thb-text-primary">{d.name}</TD>
                        <TD>{d.company?.name || '—'}</TD>
                        <TD>{d._count?.employees || 0}</TD>
                        <TD>{d._count?.designations || 0}</TD>
                        <TD><span className={badge.className}>{badge.label}</span></TD>
                        <TD className="text-right">{renderActions('departments', d as unknown as Record<string, unknown>)}</TD>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </TableWrapper>
          </>
        )
      )}

      {/* ── DESIGNATIONS TAB ── */}
      {activeTab === 'designations' && (
        loading.designations ? <div className="flex items-center justify-center py-12"><FiSettings className="w-8 h-8 animate-spin text-teal-400" /></div> : (
          <TableWrapper title="Designations" icon={<FiAward className="w-4 h-4 text-teal-500" />} count={designations.length}>
            <thead><tr><TH>Designation</TH><TH>Grade</TH><TH>Department</TH><TH>Salary Range</TH><TH>Status</TH><TH className="text-right">Actions</TH></tr></thead>
            <tbody>
              {fDesignations.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center"><FiAward className="w-10 h-10 text-thb-text-muted mx-auto mb-3" /><p className="text-thb-text-secondary font-medium">No designations found</p></td></tr>
              ) : fDesignations.map(d => {
                const badge = getStatusBadge(d.status)
                return (
                  <tr key={d.id} className={`transition-colors ${deleteConfirmId === d.id ? 'bg-red-50' : 'hover:bg-slate-50/50'}`}>
                    {deleteConfirmId === d.id ? (
                      <td colSpan={6} className="px-4 py-3">{renderDeleteConfirm(d.id, d.title)}</td>
                    ) : (
                      <>
                        <TD className="font-medium text-thb-text-primary">{d.title}</TD>
                        <TD><span className="thb-badge thb-badge-info">{gradeCode(d.level)}</span></TD>
                        <TD>{d.department?.name || '—'}</TD>
                        <TD className="text-emerald-600 font-medium">{fmtSalary(d.minSalary)} - {fmtSalary(d.maxSalary)}</TD>
                        <TD><span className={badge.className}>{badge.label}</span></TD>
                        <TD className="text-right">{renderActions('designations', d as unknown as Record<string, unknown>)}</TD>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </TableWrapper>
        )
      )}

      {/* ── GRADES TAB ── */}
      {activeTab === 'grades' && (
        loading.designations ? <div className="flex items-center justify-center py-12"><FiSettings className="w-8 h-8 animate-spin text-teal-400" /></div> : (
          (() => {
            const grades = designations.reduce((acc, d) => {
              const g = gradeCode(d.level)
              if (!acc[g]) acc[g] = { name: gradeName(d.level), code: g, level: d.level, min: d.minSalary || 0, max: d.maxSalary || 0, employees: 0, status: 'active' }
              acc[g].employees += d._count?.employees || 0
              if (d.minSalary && (!acc[g].min || d.minSalary < acc[g].min)) acc[g].min = d.minSalary
              if (d.maxSalary && (!acc[g].max || d.maxSalary > acc[g].max)) acc[g].max = d.maxSalary
              return acc
            }, {} as Record<string, { name: string; code: string; level: number; min: number; max: number; employees: number; status: string }>)
            const gradeList = Object.values(grades).filter(g => g.name.toLowerCase().includes(q))
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {gradeList.length === 0 ? (
                  <div className="col-span-full text-center py-12"><FiLayers className="w-10 h-10 text-thb-text-muted mx-auto mb-3" /><p className="text-thb-text-secondary font-medium">No grades found</p><p className="text-xs text-thb-text-muted mt-1">Grades are derived from designation levels</p></div>
                ) : gradeList.map(g => (
                  <div key={g.code} className="thb-card thb-card-hover p-5 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <span className="thb-badge thb-badge-info text-base px-3 py-1">{g.code}</span>
                      <span className="thb-badge thb-badge-success">{g.status}</span>
                    </div>
                    <p className="text-thb-text-primary font-semibold text-lg">{g.name}</p>
                    <p className="text-teal-600 text-2xl font-bold mt-2">₹{(g.min / 100000).toFixed(0)}-{(g.max / 100000).toFixed(0)}L</p>
                    <p className="text-thb-text-muted text-sm mt-1">Per annum</p>
                    <div className="mt-3 pt-3 border-t border-thb-border space-y-1">
                      <div className="flex justify-between text-sm"><span className="text-thb-text-muted">Employees</span><span className="text-thb-text-primary font-medium">{g.employees}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-thb-text-muted">Min</span><span className="text-thb-text-secondary">₹{(g.min / 100000).toFixed(0)}L</span></div>
                      <div className="flex justify-between text-sm"><span className="text-thb-text-muted">Max</span><span className="text-thb-text-secondary">₹{(g.max / 100000).toFixed(0)}L</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )
          })()
        )
      )}

      {/* ── SHIFTS TAB ── */}
      {activeTab === 'shifts' && (
        loading.shifts ? <div className="flex items-center justify-center py-12"><FiSettings className="w-8 h-8 animate-spin text-teal-400" /></div> : (
          <TableWrapper title="Shifts" icon={<FiClock className="w-4 h-4 text-teal-500" />} count={shifts.length}>
            <thead><tr><TH>Shift</TH><TH>Start</TH><TH>End</TH><TH>Break</TH><TH>Grace</TH><TH>Status</TH><TH className="text-right">Actions</TH></tr></thead>
            <tbody>
              {fShifts.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center"><FiClock className="w-10 h-10 text-thb-text-muted mx-auto mb-3" /><p className="text-thb-text-secondary font-medium">No shifts found</p></td></tr>
              ) : fShifts.map(s => {
                const badge = getStatusBadge(s.status)
                return (
                  <tr key={s.id} className={`transition-colors ${deleteConfirmId === s.id ? 'bg-red-50' : 'hover:bg-slate-50/50'}`}>
                    {deleteConfirmId === s.id ? (
                      <td colSpan={7} className="px-4 py-3">{renderDeleteConfirm(s.id, s.name)}</td>
                    ) : (
                      <>
                        <TD className="font-medium text-thb-text-primary">
                          <span className="inline-flex items-center gap-2">
                            {s.name.toLowerCase().includes('night') ? <FiMoon className="w-4 h-4 text-emerald-400" /> : <FiSun className="w-4 h-4 text-amber-400" />}
                            {s.name}
                          </span>
                        </TD>
                        <TD>{fmtTime(s.startTime)}</TD>
                        <TD>{fmtTime(s.endTime)}</TD>
                        <TD>{s.breakDuration} min</TD>
                        <TD>{s.graceTime} min</TD>
                        <TD><span className={badge.className}>{badge.label}</span></TD>
                        <TD className="text-right">{renderActions('shifts', s as unknown as Record<string, unknown>)}</TD>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </TableWrapper>
        )
      )}

      {/* ── HOLIDAYS TAB ── */}
      {activeTab === 'holidays' && (
        loading.holidays ? <div className="flex items-center justify-center py-12"><FiSettings className="w-8 h-8 animate-spin text-teal-400" /></div> : (
          <TableWrapper title="Holidays" icon={<FiCalendar className="w-4 h-4 text-teal-500" />} count={holidays.length}>
            <thead><tr><TH>Holiday</TH><TH>Date</TH><TH>Day</TH><TH>Type</TH><TH className="text-right">Actions</TH></tr></thead>
            <tbody>
              {fHolidays.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center"><FiCalendar className="w-10 h-10 text-thb-text-muted mx-auto mb-3" /><p className="text-thb-text-secondary font-medium">No holidays found</p></td></tr>
              ) : fHolidays.map(h => {
                const typeMap: Record<string, string> = { public: 'thb-badge thb-badge-warning', festival: 'thb-badge thb-badge-info', state: 'thb-badge thb-badge-success', company: 'bg-slate-100 text-slate-600 thb-badge', optional: 'thb-badge thb-badge-info' }
                return (
                  <tr key={h.id} className={`transition-colors ${deleteConfirmId === h.id ? 'bg-red-50' : 'hover:bg-slate-50/50'}`}>
                    {deleteConfirmId === h.id ? (
                      <td colSpan={5} className="px-4 py-3">{renderDeleteConfirm(h.id, h.name)}</td>
                    ) : (
                      <>
                        <TD className="font-medium text-thb-text-primary">{h.name}</TD>
                        <TD>{fmtDate(h.date)}</TD>
                        <TD>{fmtDay(h.date)}</TD>
                        <TD><span className={typeMap[h.type] || 'thb-badge thb-badge-info'}>{h.type}</span></TD>
                        <TD className="text-right">{renderActions('holidays', h as unknown as Record<string, unknown>)}</TD>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </TableWrapper>
        )
      )}

      {/* ── POLICIES TAB ── */}
      {activeTab === 'policies' && (
        loading.policies ? <div className="flex items-center justify-center py-12"><FiSettings className="w-8 h-8 animate-spin text-teal-400" /></div> : (
          <TableWrapper title="Company Policies" icon={<FiFileText className="w-4 h-4 text-teal-500" />} count={policies.length}>
            <thead><tr><TH>Policy</TH><TH>Category</TH><TH>Version</TH><TH>Effective</TH><TH>Status</TH><TH className="text-right">Actions</TH></tr></thead>
            <tbody>
              {fPolicies.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center"><FiFileText className="w-10 h-10 text-thb-text-muted mx-auto mb-3" /><p className="text-thb-text-secondary font-medium">No policies found</p></td></tr>
              ) : fPolicies.map(p => {
                const badge = getStatusBadge(p.status)
                return (
                  <tr key={p.id} className={`transition-colors ${deleteConfirmId === p.id ? 'bg-red-50' : 'hover:bg-slate-50/50'}`}>
                    {deleteConfirmId === p.id ? (
                      <td colSpan={6} className="px-4 py-3">{renderDeleteConfirm(p.id, p.title)}</td>
                    ) : (
                      <>
                        <TD className="font-medium text-thb-text-primary">{p.title}</TD>
                        <TD><span className="thb-badge thb-badge-info">{p.category}</span></TD>
                        <TD>v{p.version}</TD>
                        <TD>{p.effectiveDate ? fmtDate(p.effectiveDate) : '—'}</TD>
                        <TD><span className={badge.className}>{badge.label}</span></TD>
                        <TD className="text-right">{renderActions('policies', p as unknown as Record<string, unknown>)}</TD>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </TableWrapper>
        )
      )}
    </div>
  )
}
