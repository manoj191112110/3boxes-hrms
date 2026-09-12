'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  FiSettings, FiUsers, FiMail, FiLock, FiKey, FiEye, FiEyeOff,
  FiCopy, FiCheck, FiSend, FiRefreshCw, FiSearch, FiAlertTriangle,
  FiUserCheck, FiUserX, FiPlus, FiTrash2, FiShield, FiToggleLeft,
  FiToggleRight, FiDownload, FiX, FiChevronDown, FiFilter,
  FiClock, FiUser, FiSave, FiEdit2, FiList, FiCalendar,
  FiDollarSign, FiGlobe, FiDatabase, FiFileText, FiBriefcase
} from 'react-icons/fi'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { useCompanyContextStore } from '@/store/companyContextStore'

/* ── Types ── */
interface EmployeeCredential {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  status: string
  department: string
  designation: string
  hasLoginAccount: boolean
  loginEmail: string
  emailMismatch?: boolean
  loginStatus: string
  lastLogin: string | null
  userRole: string | null
}

interface Department {
  id: string
  name: string
}

type TabKey = 'credentials' | 'invite' | 'bulk' | 'map-company' | 'employee-config' | 'custom-fields'

/* ── Setting Types ── */
type SettingType = 'toggle' | 'select' | 'number' | 'text'

interface SettingField {
  key: string
  label: string
  type: SettingType
  defaultValue: string | number | boolean
  description: string
  options?: { value: string; label: string }[]
  min?: number
  max?: number
  step?: number
}

interface SettingSection {
  title: string
  description: string
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  fields: SettingField[]
}

/* ── Employee Setting Definitions (mapped from Governance Settings) ── */
const employeeSettingSections: SettingSection[] = [
  {
    title: 'Employee Code',
    description: 'Configure employee code generation rules',
    icon: <FiUserCheck className="w-5 h-5" />,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-500',
    fields: [
      { key: 'employee_code_prefix', label: 'Employee Code Prefix', type: 'text', defaultValue: 'EMP', description: 'Prefix for auto-generated employee codes' },
      { key: 'employee_code_sequence', label: 'Code Sequence Start', type: 'number', defaultValue: 1001, description: 'Starting number for auto-generated employee codes', min: 1, max: 99999 },
      { key: 'employee_code_auto_generation', label: 'Auto-generate Employee Code', type: 'toggle', defaultValue: true, description: 'Automatically generate employee code on creation' },
    ],
  },
  {
    title: 'Probation & Notice',
    description: 'Default probation and notice period settings',
    icon: <FiClock className="w-5 h-5" />,
    iconBg: 'bg-pink-50',
    iconColor: 'text-pink-500',
    fields: [
      { key: 'employee_probation_period', label: 'Probation Period Default (months)', type: 'number', defaultValue: 6, description: 'Default probation period for new employees', min: 0, max: 24 },
      { key: 'employee_notice_period', label: 'Notice Period Default (months)', type: 'number', defaultValue: 2, description: 'Default notice period for resignations', min: 0, max: 12 },
      { key: 'employee_doc_expiry_reminder_days', label: 'Document Expiry Reminder Days', type: 'number', defaultValue: 30, description: 'Days before document expiry to send a reminder', min: 1, max: 180 },
    ],
  },
  {
    title: 'Access & Permissions',
    description: 'Employee self-service and profile settings',
    icon: <FiShield className="w-5 h-5" />,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-500',
    fields: [
      { key: 'employee_email_domain_restriction', label: 'Email Domain Restriction', type: 'text', defaultValue: '', description: 'Restrict employee emails to this domain (leave empty for no restriction)' },
      { key: 'employee_self_service_access', label: 'Employee Self-Service Access', type: 'toggle', defaultValue: true, description: 'Allow employees to access the self-service portal' },
      { key: 'employee_profile_edit_permissions', label: 'Profile Edit Permissions', type: 'select', defaultValue: 'limited', description: 'What profile fields employees can edit themselves', options: [{ value: 'none', label: 'None' }, { value: 'limited', label: 'Limited (Contact Info)' }, { value: 'full', label: 'Full (All Fields)' }] },
      { key: 'employee_max_reporting_levels', label: 'Maximum Reporting Manager Levels', type: 'number', defaultValue: 3, description: 'Maximum depth of the reporting hierarchy', min: 1, max: 10 },
    ],
  },
  {
    title: 'Login & Security',
    description: 'Password policies and login security settings',
    icon: <FiLock className="w-5 h-5" />,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-500',
    fields: [
      { key: 'employee_password_min_length', label: 'Minimum Password Length', type: 'number', defaultValue: 8, description: 'Minimum characters required for employee passwords', min: 6, max: 32 },
      { key: 'employee_password_require_special', label: 'Require Special Characters', type: 'toggle', defaultValue: true, description: 'Passwords must contain at least one special character' },
      { key: 'employee_password_expiry_days', label: 'Password Expiry (days)', type: 'number', defaultValue: 90, description: 'Number of days before password must be changed (0 = never)', min: 0, max: 365 },
      { key: 'employee_login_max_attempts', label: 'Max Login Attempts Before Lock', type: 'number', defaultValue: 5, description: 'Failed login attempts before account is temporarily locked', min: 3, max: 10 },
      { key: 'employee_auto_lock_inactive_days', label: 'Auto-lock Inactive Accounts (days)', type: 'number', defaultValue: 90, description: 'Automatically disable accounts inactive for this many days (0 = never)', min: 0, max: 365 },
    ],
  },
  {
    title: 'Onboarding & Separation',
    description: 'Settings for employee onboarding and exit processes',
    icon: <FiRefreshCw className="w-5 h-5" />,
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-500',
    fields: [
      { key: 'employee_auto_create_login', label: 'Auto-create Login on Onboarding', type: 'toggle', defaultValue: true, description: 'Automatically create a login account when an employee is onboarded' },
      { key: 'employee_default_role', label: 'Default Login Role', type: 'select', defaultValue: 'employee', description: 'Default role assigned to new employee login accounts', options: [{ value: 'employee', label: 'Employee' }, { value: 'admin', label: 'Admin' }] },
      { key: 'employee_send_welcome_email', label: 'Send Welcome Email on Onboarding', type: 'toggle', defaultValue: true, description: 'Automatically send a welcome email with login credentials when onboarding' },
      { key: 'employee_disable_account_on_exit', label: 'Disable Account on Separation', type: 'toggle', defaultValue: true, description: 'Automatically disable login account when employee is terminated/resigned' },
      { key: 'employee_exit_clearance_required', label: 'Exit Clearance Required', type: 'toggle', defaultValue: true, description: 'Require clearance approval before final account deactivation' },
    ],
  },
]

/* ── Custom Fields Interface ── */
interface CustomField {
  id: string
  name: string
  label: string
  type: 'text' | 'number' | 'date' | 'select' | 'toggle' | 'textarea'
  section: 'personal' | 'employment' | 'compensation' | 'custom'
  required: boolean
  options?: string[]
  isActive: boolean
}

/* ── Password generator ── */
function generatePassword(length = 12): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lower = 'abcdefghijklmnopqrstuvwxyz'
  const digits = '0123456789'
  const special = '!@#$%&*'
  const all = upper + lower + digits + special
  let pwd = ''
  pwd += upper[Math.floor(Math.random() * upper.length)]
  pwd += lower[Math.floor(Math.random() * lower.length)]
  pwd += digits[Math.floor(Math.random() * digits.length)]
  pwd += special[Math.floor(Math.random() * special.length)]
  for (let i = pwd.length; i < length; i++) {
    pwd += all[Math.floor(Math.random() * all.length)]
  }
  return pwd.split('').sort(() => Math.random() - 0.5).join('')
}

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
}

/* ── localStorage Helper for Settings ──
 *
 * IMPORTANT: We write to BOTH the canonical '3boxes_hrms_settings' key
 * (which the Add Employee form reads from) AND the legacy
 * '3boxes_hrms_employee_settings' key (for backwards compatibility).
 * This fixes a desync bug where toggling auto-generation in
 * /employees/settings had no effect on the Add Employee form because
 * the form was reading from a different key.
 */
const CANONICAL_SETTINGS_KEY = '3boxes_hrms_settings'
const EMP_SETTINGS_KEY = '3boxes_hrms_employee_settings'

function loadEmployeeSettings(): Record<string, string | number | boolean> {
  if (typeof window === 'undefined') return {}
  try {
    // Prefer the canonical key (same as /settings and the Add Employee form)
    const canonical = localStorage.getItem(CANONICAL_SETTINGS_KEY)
    if (canonical) return JSON.parse(canonical)
    // Fall back to the legacy key
    const legacy = localStorage.getItem(EMP_SETTINGS_KEY)
    if (legacy) return JSON.parse(legacy)
  } catch { /* ignore */ }
  return {}
}

function saveEmployeeSettings(settings: Record<string, string | number | boolean>) {
  if (typeof window === 'undefined') return
  try {
    // Write to BOTH keys so the Add Employee form (which reads
    // '3boxes_hrms_settings') picks up the changes immediately.
    localStorage.setItem(CANONICAL_SETTINGS_KEY, JSON.stringify(settings))
    localStorage.setItem(EMP_SETTINGS_KEY, JSON.stringify(settings))
  } catch { /* ignore */ }
}

function getSettingValue(key: string, fields: SettingField[], settings: Record<string, string | number | boolean>): string | number | boolean {
  if (key in settings) return settings[key]
  const field = fields.find(f => f.key === key)
  return field?.defaultValue ?? ''
}

/* ── Default Custom Fields ── */
const defaultCustomFields: CustomField[] = [
  { id: 'cf_1', name: 'blood_group', label: 'Blood Group', type: 'select', section: 'personal', required: false, options: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'], isActive: true },
  { id: 'cf_2', name: 'emergency_contact_name', label: 'Emergency Contact Name', type: 'text', section: 'personal', required: true, isActive: true },
  { id: 'cf_3', name: 'emergency_contact_phone', label: 'Emergency Contact Phone', type: 'text', section: 'personal', required: true, isActive: true },
  { id: 'cf_4', name: 'marital_status', label: 'Marital Status', type: 'select', section: 'personal', required: false, options: ['Single', 'Married', 'Divorced', 'Widowed'], isActive: true },
  { id: 'cf_5', name: 'previous_experience_years', label: 'Previous Experience (Years)', type: 'number', section: 'employment', required: false, isActive: true },
  { id: 'cf_6', name: 'date_of_joining', label: 'Date of Joining', type: 'date', section: 'employment', required: true, isActive: true },
  { id: 'cf_7', name: 'probation_end_date', label: 'Probation End Date', type: 'date', section: 'employment', required: false, isActive: true },
  { id: 'cf_8', name: 'uan_number', label: 'UAN Number', type: 'text', section: 'compensation', required: false, isActive: true },
  { id: 'cf_9', name: 'pan_number', label: 'PAN Number', type: 'text', section: 'compensation', required: false, isActive: true },
  { id: 'cf_10', name: 'aadhaar_number', label: 'Aadhaar Number', type: 'text', section: 'compensation', required: false, isActive: true },
]

export default function EmployeeSettingsPage() {
  const { user } = useAuthStore()
  const { effectiveCompanyId, availableCompanies, refreshContext, scopeQuery, selectedTenantId } = useCompanyContextStore()
  const scopeCompanyId = effectiveCompanyId()
  const isAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin' || user?.role === 'admin'

  /* State */
  const [activeTab, setActiveTab] = useState<TabKey>('credentials')
  const [employees, setEmployees] = useState<EmployeeCredential[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [designations, setDesignations] = useState<Array<{ id: string; title: string }>>([])
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([])
  // Modal-specific dropdowns (scoped to the selected company in Add Mapping modal)
  const [modalDepartments, setModalDepartments] = useState<Department[]>([])
  const [modalDesignations, setModalDesignations] = useState<Array<{ id: string; title: string }>>([])
  const [modalBranches, setModalBranches] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)

  // Purge duplicates (one-click fix for duplicate employee rows + password sync)
  const [purgingDuplicates, setPurgingDuplicates] = useState(false)

  // Password actions
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordModalMode, setPasswordModalMode] = useState<'single' | 'selected' | 'all'>('single')
  const [manualPassword, setManualPassword] = useState('')
  const [useAutoPassword, setUseAutoPassword] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [passwordResults, setPasswordResults] = useState<Array<{
    employeeId: string; name: string; email: string; password: string; action: string; success: boolean; error?: string
  }> | null>(null)
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})

  // Invite
  const [inviteProcessing, setInviteProcessing] = useState(false)
  const [inviteResults, setInviteResults] = useState<Array<{
    employeeId: string; name: string; email: string; password: string; success: boolean; error?: string
  }> | null>(null)

  // Map Company
  const [mapCompanySearch, setMapCompanySearch] = useState('')
  const [selectedMapEmployee, setSelectedMapEmployee] = useState<EmployeeCredential | null>(null)
  const [companyMappings, setCompanyMappings] = useState<Array<{
    id: string; employeeId: string; companyId: string; employeeCode: string; isPrimary: boolean;
    departmentId?: string | null; designationId?: string | null; branchId?: string | null;
    company?: { id: string; name: string; code: string | null };
    department?: { id: string; name: string } | null;
    designation?: { id: string; title: string } | null;
    branch?: { id: string; name: string } | null;
  }>>([])
  const [showAddMapping, setShowAddMapping] = useState(false)
  const [newMappingCompanyId, setNewMappingCompanyId] = useState('')
  const [newMappingEmpCode, setNewMappingEmpCode] = useState('')
  const [newMappingDeptId, setNewMappingDeptId] = useState('')
  const [newMappingDesigId, setNewMappingDesigId] = useState('')
  const [newMappingBranchId, setNewMappingBranchId] = useState('')
  const [newMappingIsPrimary, setNewMappingIsPrimary] = useState(false)
  const [mapCompanyProcessing, setMapCompanyProcessing] = useState(false)

  // Detail modal
  const [detailEmployee, setDetailEmployee] = useState<EmployeeCredential | null>(null)
  const [editPassword, setEditPassword] = useState('')
  const [editEmail, setEditEmail] = useState('')

  // Employee Config Settings
  const [empSettings, setEmpSettings] = useState<Record<string, string | number | boolean>>({})
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editDrafts, setEditDrafts] = useState<Record<string, Record<string, string | number | boolean>>>({})

  // Custom Fields
  const [customFields, setCustomFields] = useState<CustomField[]>(defaultCustomFields)
  const [showAddFieldModal, setShowAddFieldModal] = useState(false)
  const [newField, setNewField] = useState<Partial<CustomField>>({
    name: '', label: '', type: 'text', section: 'custom', required: false, isActive: true
  })

  /* Load settings */
  useEffect(() => {
    setEmpSettings(loadEmployeeSettings())
    const stored = typeof window !== 'undefined' ? localStorage.getItem('3boxes_hrms_custom_fields') : null
    if (stored) {
      try { setCustomFields(JSON.parse(stored)) } catch { /* ignore */ }
    }
  }, [])

  /* Fetch data */
  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filterDept) params.set('departmentId', filterDept)
      const sq = scopeQuery()
      const res = await fetch(`/api/employees/credentials?${params.toString()}${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        setEmployees(data.employees || [])
      } else {
        const errorData = await res.json().catch(() => ({}))
        console.error('[Employee Settings] Fetch credentials failed:', res.status, errorData)
        // Show the actual error to the user so they can see what's wrong
        if (res.status === 401) {
          toast.error('Session expired. Please log in again.')
        } else if (errorData.error) {
          // Display the detailed Prisma error message from the API
          toast.error(`Error loading credentials: ${errorData.error}`, { duration: 10000 })
        }
      }
    } catch (err) {
      console.error('Fetch error:', err)
      toast.error('Network error while loading credentials')
    } finally {
      setLoading(false)
    }
  }, [search, filterDept, scopeCompanyId, scopeQuery, selectedTenantId])

  /* Purge duplicate employees and sync user passwords across DBs */
  const handlePurgeDuplicates = async () => {
    if (!confirm('Purge duplicate employee records and sync user passwords?\n\nThis will:\n• Delete duplicate employee rows (keeping the one with a login account)\n• Sync passwords from tenant DB → platform DB so login works correctly\n\nThis is safe and idempotent.')) return
    setPurgingDuplicates(true)
    try {
      const sq = scopeQuery()
      const url = `/api/admin/purge-duplicates${sq ? `?${sq}` : ''}`
      const res = await fetch(url, { method: 'POST', headers: getAuthHeaders() })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Failed to purge duplicates')
      }
      const data = await res.json()
      const s = data.summary || {}
      toast.success(`Purge complete: deleted ${s.duplicateEmployeesDeleted || 0} duplicates, synced ${s.duplicateUsersSynced || 0} users.`)
      // Refresh the list to reflect the deduped state
      fetchEmployees()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to purge duplicates')
    } finally {
      setPurgingDuplicates(false)
    }
  }

  /* Reset ALL user passwords in this tenant to a known value (default MarqAI@2026).
     Use this when demo login credentials don't work — fixes both tenant DB and platform DB. */
  const [resettingAllPasswords, setResettingAllPasswords] = useState(false)
  const handleResetAllPasswords = async () => {
    const pwd = prompt(`Reset ALL user passwords in this tenant to a known password?\n\nEnter the new password (or click OK to use default 'MarqAI@2026'):`, 'MarqAI@2026')
    if (!pwd) return
    setResettingAllPasswords(true)
    try {
      const sq = scopeQuery()
      const url = `/api/admin/reset-demo-passwords${sq ? `?${sq}` : ''}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Failed to reset passwords')
      }
      const data = await res.json()
      const s = data.summary || {}
      toast.success(`Reset ${s.tenantDbUpdated || 0} users. Password: '${s.password}'. You can now login.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reset passwords')
    } finally {
      setResettingAllPasswords(false)
    }
  }

  const fetchDepartments = useCallback(async (companyId?: string) => {
    try {
      const sq = scopeQuery()
      const sqParams = new URLSearchParams(sq)
      if (companyId) sqParams.set('companyId', companyId)
      const url = `/api/departments${sqParams.toString() ? '?' + sqParams.toString() : ''}`
      const res = await fetch(url, { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        const list = Array.isArray(data) ? data : (data.data || data.departments || [])
        setDepartments(list.map((d: { id: string; name: string }) => ({ id: d.id, name: d.name })))
      }
    } catch { /* ignore */ }
  }, [scopeQuery, selectedTenantId])

  const fetchDesignations = useCallback(async (companyId?: string) => {
    try {
      const sq = scopeQuery()
      const sqParams = new URLSearchParams(sq)
      if (companyId) sqParams.set('companyId', companyId)
      const url = `/api/designations${sqParams.toString() ? '?' + sqParams.toString() : ''}`
      const res = await fetch(url, { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        const list = Array.isArray(data) ? data : (data.data || data.designations || [])
        setDesignations(list.map((d: { id: string; title: string }) => ({ id: d.id, title: d.title })))
      }
    } catch { /* ignore */ }
  }, [scopeQuery, selectedTenantId])

  const fetchBranches = useCallback(async (companyId?: string) => {
    try {
      const sq = scopeQuery()
      const sqParams = new URLSearchParams(sq)
      if (companyId) sqParams.set('companyId', companyId)
      const url = `/api/branches${sqParams.toString() ? '?' + sqParams.toString() : ''}`
      const res = await fetch(url, { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        const list = (data.data || data.branches || data || []) as Array<{ id: string; name: string }>
        setBranches(list.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name })))
      }
    } catch { /* ignore */ }
  }, [scopeCompanyId, selectedTenantId])

  useEffect(() => { fetchEmployees() }, [fetchEmployees])
  useEffect(() => { fetchDepartments() }, [fetchDepartments])
  useEffect(() => { fetchDesignations() }, [fetchDesignations])
  useEffect(() => { fetchBranches() }, [fetchBranches])

  /** Fetch dropdown data for the Add Mapping modal, scoped to a specific companyId */
  const [modalDropdownsLoading, setModalDropdownsLoading] = useState(false)

  const fetchModalDropdowns = useCallback(async (companyId: string) => {
    setModalDropdownsLoading(true)
    setModalDepartments([])
    setModalDesignations([])
    setModalBranches([])
    try {
      const headers = getAuthHeaders()
      const [deptRes, desigRes, branchRes] = await Promise.allSettled([
        fetch(`/api/departments?companyId=${encodeURIComponent(companyId)}&limit=200`, { headers }),
        fetch(`/api/designations?companyId=${encodeURIComponent(companyId)}&limit=200`, { headers }),
        fetch(`/api/branches?companyId=${encodeURIComponent(companyId)}&limit=200`, { headers }),
      ])

      // Departments
      if (deptRes.status === 'fulfilled') {
        if (deptRes.value.ok) {
          const data = await deptRes.value.json()
          const list = Array.isArray(data) ? data : (data.data || data.departments || [])
          setModalDepartments(list.map((d: { id: string; name: string }) => ({ id: d.id, name: d.name })))
        } else {
          const errData = await deptRes.value.json().catch(() => ({}))
          console.error('[fetchModalDropdowns] Departments API error:', deptRes.value.status, errData)
        }
      } else {
        console.error('[fetchModalDropdowns] Departments fetch failed:', deptRes.reason)
      }

      // Designations
      if (desigRes.status === 'fulfilled') {
        if (desigRes.value.ok) {
          const data = await desigRes.value.json()
          const list = Array.isArray(data) ? data : (data.data || data.designations || [])
          setModalDesignations(list.map((d: { id: string; title: string }) => ({ id: d.id, title: d.title })))
        } else {
          const errData = await desigRes.value.json().catch(() => ({}))
          console.error('[fetchModalDropdowns] Designations API error:', desigRes.value.status, errData)
        }
      } else {
        console.error('[fetchModalDropdowns] Designations fetch failed:', desigRes.reason)
      }

      // Branches
      if (branchRes.status === 'fulfilled') {
        if (branchRes.value.ok) {
          const data = await branchRes.value.json()
          const list = (data.data || data.branches || data || []) as Array<{ id: string; name: string }>
          setModalBranches(list.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name })))
        } else {
          const errData = await branchRes.value.json().catch(() => ({}))
          console.error('[fetchModalDropdowns] Branches API error:', branchRes.value.status, errData)
        }
      } else {
        console.error('[fetchModalDropdowns] Branches fetch failed:', branchRes.reason)
      }
    } catch (err) {
      console.error('[fetchModalDropdowns] Error:', err)
    } finally {
      setModalDropdownsLoading(false)
    }
  }, [])

  /* Selection */
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set())
      setSelectAll(false)
    } else {
      const filtered = getFilteredEmployees()
      setSelectedIds(new Set(filtered.map(e => e.id)))
      setSelectAll(true)
    }
  }

  /* Filter */
  const getFilteredEmployees = () => {
    let list = employees
    if (filterStatus === 'has_account') list = list.filter(e => e.hasLoginAccount)
    if (filterStatus === 'no_account') list = list.filter(e => !e.hasLoginAccount)
    if (filterStatus === 'active') list = list.filter(e => e.loginStatus === 'active')
    if (filterStatus === 'inactive') list = list.filter(e => e.loginStatus === 'inactive')
    return list
  }

  const filteredEmployees = getFilteredEmployees()

  /* Stats */
  const totalEmployees = employees.length
  const withAccount = employees.filter(e => e.hasLoginAccount).length
  const withoutAccount = totalEmployees - withAccount
  const activeAccounts = employees.filter(e => e.loginStatus === 'active').length
  const inactiveAccounts = employees.filter(e => e.loginStatus === 'inactive').length

  /* Password operations */
  const handlePasswordAction = async () => {
    setProcessing(true)
    setPasswordResults(null)
    try {
      const ids = passwordModalMode === 'all'
        ? filteredEmployees.map(e => e.id)
        : passwordModalMode === 'selected'
          ? Array.from(selectedIds)
          : [detailEmployee?.id || '']

      const res = await fetch('/api/employees/credentials', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          mode: passwordModalMode,
          employeeIds: ids,
          password: useAutoPassword ? undefined : manualPassword || undefined,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setPasswordResults(data.results || [])
        toast.success(data.message || 'Passwords processed')
        fetchEmployees()
      } else {
        toast.error(data.error || 'Operation failed')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setProcessing(false)
    }
  }

  /* Invite */
  const handleInvite = async (mode: 'selected' | 'all') => {
    setInviteProcessing(true)
    setInviteResults(null)
    try {
      const ids = mode === 'all'
        ? filteredEmployees.map(e => e.id)
        : Array.from(selectedIds)

      if (ids.length === 0) {
        toast.error('No employees selected')
        setInviteProcessing(false)
        return
      }

      const res = await fetch('/api/employees/invite', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          mode,
          employeeIds: ids,
          generateNewPassword: true,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setInviteResults(data.results || [])
        toast.success(data.message || 'Invites processed')
        fetchEmployees()
      } else {
        toast.error(data.error || 'Invite failed')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setInviteProcessing(false)
    }
  }

  /* Map Company handlers */
  const fetchCompanyMappings = async (empId: string) => {
    try {
      const res = await fetch(`/api/employees/company-mappings?employeeId=${empId}`, { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        setCompanyMappings(data.mappings || [])
      }
    } catch { /* ignore */ }
  }

  const addCompanyMapping = async () => {
    if (!selectedMapEmployee || !newMappingCompanyId || !newMappingEmpCode) {
      toast.error('Employee, company, and employee code are required')
      return
    }
    setMapCompanyProcessing(true)
    try {
      const res = await fetch('/api/employees/company-mappings', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          employeeId: selectedMapEmployee.id,
          companyId: newMappingCompanyId,
          employeeCode: newMappingEmpCode,
          departmentId: newMappingDeptId || undefined,
          designationId: newMappingDesigId || undefined,
          branchId: newMappingBranchId || undefined,
          isPrimary: newMappingIsPrimary,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Company mapping added successfully')
        setShowAddMapping(false)
        setNewMappingCompanyId('')
        setNewMappingEmpCode('')
        setNewMappingDeptId('')
        setNewMappingDesigId('')
        setNewMappingBranchId('')
        setNewMappingIsPrimary(false)
        setModalDepartments([])
        setModalDesignations([])
        setModalBranches([])
        fetchCompanyMappings(selectedMapEmployee.id)
        fetchEmployees()
        // Refresh company context so the CompanySwitcher dropdown updates
        // immediately for the mapped employee (if they're logged in)
        refreshContext()
      } else {
        toast.error(data.error || 'Failed to add mapping')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setMapCompanyProcessing(false)
    }
  }

  const removeMapping = async (mappingId: string) => {
    try {
      const res = await fetch(`/api/employees/company-mappings?id=${mappingId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Mapping removed')
        if (selectedMapEmployee) fetchCompanyMappings(selectedMapEmployee.id)
        refreshContext()
      } else {
        toast.error(data.error || 'Failed to remove mapping')
      }
    } catch (err) {
      toast.error('Failed to remove mapping')
    }
  }

  const setPrimaryMapping = async (mappingId: string) => {
    try {
      const res = await fetch('/api/employees/company-mappings', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          mappingId,
          isPrimary: true,
        }),
      })
      if (res.ok) {
        if (selectedMapEmployee) fetchCompanyMappings(selectedMapEmployee.id)
        toast.success('Primary company updated')
        refreshContext()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to set primary')
      }
    } catch {
      toast.error('Failed to set primary')
    }
  }

  const prismaFetch = async (url: string, options: RequestInit) => {
    return fetch(url, options)
  }

  /* Single employee actions */
  const handleToggleStatus = async (emp: EmployeeCredential) => {
    try {
      const res = await fetch('/api/employees/credentials', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ employeeId: emp.id, action: 'toggle_status' }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        fetchEmployees()
      } else {
        toast.error(data.error)
      }
    } catch (err) {
      toast.error('Failed to toggle status')
    }
  }

  const handleDeleteAccount = async (emp: EmployeeCredential) => {
    if (!confirm(`Remove login account for ${emp.firstName} ${emp.lastName}? They will no longer be able to sign in.`)) return
    try {
      const res = await fetch('/api/employees/credentials', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ employeeId: emp.id, action: 'delete_account' }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        setDetailEmployee(null)
        fetchEmployees()
      } else {
        toast.error(data.error)
      }
    } catch (err) {
      toast.error('Failed to delete account')
    }
  }

  const handleResetSinglePassword = async () => {
    if (!detailEmployee) return
    setProcessing(true)
    try {
      const res = await fetch('/api/employees/credentials', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          employeeId: detailEmployee.id,
          action: 'reset_password',
          password: editPassword || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Password reset successfully')
        setPasswordResults([{ employeeId: detailEmployee.employeeId, name: `${detailEmployee.firstName} ${detailEmployee.lastName}`, email: detailEmployee.email, password: data.password, action: 'reset', success: true }])
        fetchEmployees()
      } else {
        toast.error(data.error)
      }
    } catch (err) {
      toast.error('Failed to reset password')
    } finally {
      setProcessing(false)
    }
  }

  /* Copy to clipboard */
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  /* Export credentials as CSV */
  const handleExportCSV = () => {
    const rows = [['Employee ID', 'Name', 'Email', 'Department', 'Has Account', 'Login Status', 'Last Login']]
    filteredEmployees.forEach(e => {
      rows.push([e.employeeId, `${e.firstName} ${e.lastName}`, e.email, e.department, e.hasLoginAccount ? 'Yes' : 'No', e.loginStatus, e.lastLogin || ''])
    })
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'employee_credentials.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const toggleShowPassword = (key: string) => {
    setShowPasswords(prev => ({ ...prev, [key]: !prev[key] }))
  }

  /* Settings handlers */
  const handleStartEdit = (sectionTitle: string) => {
    const section = employeeSettingSections.find(s => s.title === sectionTitle)
    if (!section) return
    const draft: Record<string, string | number | boolean> = {}
    section.fields.forEach(f => {
      draft[f.key] = getSettingValue(f.key, section.fields, empSettings)
    })
    setEditDrafts(prev => ({ ...prev, [sectionTitle]: draft }))
    setEditingSection(sectionTitle)
  }

  const handleDraftChange = (sectionTitle: string, key: string, value: string | number | boolean) => {
    setEditDrafts(prev => ({
      ...prev,
      [sectionTitle]: { ...(prev[sectionTitle] || {}), [key]: value },
    }))
  }

  const handleSaveSection = (sectionTitle: string) => {
    const draft = editDrafts[sectionTitle]
    if (!draft) return
    const next = { ...empSettings, ...draft }
    setEmpSettings(next)
    saveEmployeeSettings(next)
    const nextDrafts = { ...editDrafts }
    delete nextDrafts[sectionTitle]
    setEditDrafts(nextDrafts)
    setEditingSection(null)
    toast.success(`${sectionTitle} settings saved`)
  }

  const handleCancelEdit = () => {
    setEditingSection(null)
  }

  /* Custom Field handlers */
  const handleToggleFieldActive = (fieldId: string) => {
    setCustomFields(prev => {
      const updated = prev.map(f => f.id === fieldId ? { ...f, isActive: !f.isActive } : f)
      if (typeof window !== 'undefined') localStorage.setItem('3boxes_hrms_custom_fields', JSON.stringify(updated))
      return updated
    })
  }

  const handleDeleteField = (fieldId: string) => {
    if (!confirm('Delete this custom field?')) return
    setCustomFields(prev => {
      const updated = prev.filter(f => f.id !== fieldId)
      if (typeof window !== 'undefined') localStorage.setItem('3boxes_hrms_custom_fields', JSON.stringify(updated))
      return updated
    })
    toast.success('Custom field deleted')
  }

  const handleAddField = () => {
    if (!newField.name || !newField.label) {
      toast.error('Field name and label are required')
      return
    }
    const field: CustomField = {
      id: `cf_${Date.now()}`,
      name: newField.name!,
      label: newField.label!,
      type: newField.type || 'text',
      section: newField.section || 'custom',
      required: newField.required || false,
      options: newField.type === 'select' ? (newField.options || []) : undefined,
      isActive: true,
    }
    setCustomFields(prev => {
      const updated = [...prev, field]
      if (typeof window !== 'undefined') localStorage.setItem('3boxes_hrms_custom_fields', JSON.stringify(updated))
      return updated
    })
    setShowAddFieldModal(false)
    setNewField({ name: '', label: '', type: 'text', section: 'custom', required: false, isActive: true })
    toast.success('Custom field added')
  }

  const renderSettingField = (field: SettingField, value: string | number | boolean, onChange: (val: string | number | boolean) => void, isEditing: boolean) => {
    if (!isEditing) {
      const displayValue = field.type === 'toggle' ? (value ? 'Enabled' : 'Disabled')
        : field.type === 'select' ? (field.options?.find(o => o.value === value)?.label || String(value))
        : String(value)
      return (
        <div className="flex items-center justify-between py-2">
          <div className="flex-1 min-w-0 mr-4">
            <p className="text-sm text-thb-text-primary font-medium">{field.label}</p>
            <p className="text-xs text-thb-text-muted mt-0.5">{field.description}</p>
          </div>
          <div className="flex-shrink-0">
            {field.type === 'toggle' ? (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${value ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {value ? <FiToggleRight className="w-3.5 h-3.5" /> : <FiToggleLeft className="w-3.5 h-3.5" />}
                {displayValue}
              </span>
            ) : (
              <span className="text-sm font-medium text-thb-text-primary bg-slate-50 px-3 py-1.5 rounded-lg">{displayValue || '—'}</span>
            )}
          </div>
        </div>
      )
    }

    // Editing mode
    return (
      <div className="py-2">
        <label className="block text-sm text-thb-text-primary font-medium mb-1">{field.label}</label>
        <p className="text-xs text-thb-text-muted mb-2">{field.description}</p>
        {field.type === 'toggle' ? (
          <button
            onClick={() => onChange(!value)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${value ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {value ? <FiToggleRight className="w-4 h-4" /> : <FiToggleLeft className="w-4 h-4" />}
            {value ? 'Enabled' : 'Disabled'}
          </button>
        ) : field.type === 'select' ? (
          <select
            value={String(value)}
            onChange={e => onChange(e.target.value)}
            className="w-full max-w-xs px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          >
            {field.options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        ) : field.type === 'number' ? (
          <input
            type="number"
            value={Number(value)}
            onChange={e => onChange(Number(e.target.value))}
            min={field.min}
            max={field.max}
            step={field.step || 1}
            className="w-full max-w-xs px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        ) : (
          <input
            type="text"
            value={String(value)}
            onChange={e => onChange(e.target.value)}
            className="w-full max-w-xs px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        )}
      </div>
    )
  }

  /* ── Render ── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-cyan-600 flex items-center justify-center shadow-md">
            <FiSettings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">Employee Settings</h1>
            <p className="text-sm text-thb-text-secondary">Manage login credentials, configurations & invitations</p>
          </div>
        </div>
        <button onClick={handleExportCSV} className="inline-flex items-center gap-2 px-4 py-2.5 border border-thb-border text-thb-text-secondary rounded-lg hover:bg-slate-50 font-medium text-sm transition-colors">
          <FiDownload className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="thb-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center text-green-600"><FiUsers className="w-5 h-5" /></div>
          <div><p className="text-xs text-thb-text-secondary">Total</p><p className="text-lg font-bold text-thb-text-primary">{totalEmployees}</p></div>
        </div>
        <div className="thb-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600"><FiUserCheck className="w-5 h-5" /></div>
          <div><p className="text-xs text-thb-text-secondary">With Account</p><p className="text-lg font-bold text-emerald-600">{withAccount}</p></div>
        </div>
        <div className="thb-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600"><FiUserX className="w-5 h-5" /></div>
          <div><p className="text-xs text-thb-text-secondary">No Account</p><p className="text-lg font-bold text-amber-600">{withoutAccount}</p></div>
        </div>
        <div className="thb-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600"><FiShield className="w-5 h-5" /></div>
          <div><p className="text-xs text-thb-text-secondary">Active</p><p className="text-lg font-bold text-teal-600">{activeAccounts}</p></div>
        </div>
        <div className="thb-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center text-red-600"><FiSettings className="w-5 h-5" /></div>
          <div><p className="text-xs text-thb-text-secondary">Inactive</p><p className="text-lg font-bold text-red-600">{inactiveAccounts}</p></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="thb-card p-1">
        <div className="flex gap-1 overflow-x-auto">
          {([
            { key: 'credentials' as TabKey, label: 'Login Credentials', icon: FiKey },
            { key: 'invite' as TabKey, label: 'Invite', icon: FiSend },
            { key: 'bulk' as TabKey, label: 'Bulk Ops', icon: FiRefreshCw },
            { key: 'map-company' as TabKey, label: 'Map Company', icon: FiBriefcase },
            { key: 'employee-config' as TabKey, label: 'Configuration', icon: FiSettings },
            { key: 'custom-fields' as TabKey, label: 'Custom Fields', icon: FiList },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 min-w-[100px] inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key ? 'bg-teal-500 text-white shadow-sm' : 'text-thb-text-secondary hover:bg-slate-50 hover:text-thb-text-primary'
              }`}
            >
              <tab.icon className="w-4 h-4" /> <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ═══ CREDENTIALS TAB ═══ */}
      {activeTab === 'credentials' && (
        <div className="space-y-4">
          {/* Search + Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, email, ID..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
              />
            </div>
            <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20">
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20">
              <option value="">All Status</option>
              <option value="has_account">Has Account</option>
              <option value="no_account">No Account</option>
              <option value="active">Account Active</option>
              <option value="inactive">Account Inactive</option>
            </select>
            <button
              onClick={handlePurgeDuplicates}
              disabled={purgingDuplicates}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-medium transition-colors disabled:opacity-50"
              title="Delete duplicate employee records and sync user passwords across DBs. Use this if you see duplicate rows in this list, or if password reset doesn't work."
            >
              {purgingDuplicates ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FiFilter className="w-3.5 h-3.5" />}
              Purge Duplicates
            </button>
            <button
              onClick={handleResetAllPasswords}
              disabled={resettingAllPasswords}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-medium transition-colors disabled:opacity-50"
              title="Reset ALL user passwords to 'MarqAI@2026' (tenant DB + platform DB). Use this when login credentials don't work."
            >
              {resettingAllPasswords ? <FiRefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FiKey className="w-3.5 h-3.5" />}
              Reset All Passwords
            </button>
          </div>

          {/* Bulk Actions Bar */}
          {selectedIds.size > 0 && (
            <div className="thb-card border-teal-200 bg-teal-50/40 p-3 flex items-center gap-3">
              <span className="text-sm font-medium text-teal-700">{selectedIds.size} selected</span>
              <button
                onClick={() => { setPasswordModalMode('selected'); setShowPasswordModal(true); setUseAutoPassword(true); setManualPassword(''); setPasswordResults(null) }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <FiKey className="w-3.5 h-3.5" /> Generate Passwords
              </button>
              <button
                onClick={() => handleInvite('selected')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition-colors"
                disabled={inviteProcessing}
              >
                <FiSend className="w-3.5 h-3.5" /> Invite Selected
              </button>
              <button
                onClick={() => { setSelectedIds(new Set()); setSelectAll(false) }}
                className="text-xs text-thb-text-muted hover:text-thb-text-primary ml-auto"
              >
                Clear
              </button>
            </div>
          )}

          {/* Employee Table */}
          <div className="thb-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-thb-border bg-slate-50/80">
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectAll && filteredEmployees.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 text-teal-500 focus:ring-teal-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Employee</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Official Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Department</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Account Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Last Login</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-thb-border">
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center"><div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" /></td></tr>
                  ) : filteredEmployees.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-thb-text-muted">No employees found</td></tr>
                  ) : filteredEmployees.map(emp => (
                    <tr key={emp.id} className={`hover:bg-slate-50/50 transition-colors ${selectedIds.has(emp.id) ? 'bg-teal-50/40' : ''}`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(emp.id)}
                          onChange={() => toggleSelect(emp.id)}
                          className="rounded border-slate-300 text-teal-500 focus:ring-teal-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-thb-text-primary">{emp.firstName} {emp.lastName}</p>
                          <p className="text-xs text-thb-text-muted">{emp.employeeId}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-thb-text-secondary">{emp.email}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-thb-text-secondary">{emp.department}</span>
                      </td>
                      <td className="px-4 py-3">
                        {!emp.hasLoginAccount ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <FiUserX className="w-3 h-3" /> No Account
                          </span>
                        ) : emp.loginStatus === 'active' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <FiUserCheck className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                            <FiUserX className="w-3 h-3" /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-thb-text-muted">{emp.lastLogin ? new Date(emp.lastLogin).toLocaleDateString() : '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {emp.hasLoginAccount && (
                            <button onClick={() => handleToggleStatus(emp)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-teal-500 hover:bg-teal-50 transition-colors" title={emp.loginStatus === 'active' ? 'Disable Account' : 'Enable Account'}>
                              {emp.loginStatus === 'active' ? <FiToggleRight className="w-4 h-4" /> : <FiToggleLeft className="w-4 h-4" />}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setDetailEmployee(emp)
                              setEditPassword('')
                              setEditEmail(emp.email)
                              setPasswordResults(null)
                            }}
                            className="p-1.5 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors"
                            title="Manage Credentials"
                          >
                            <FiKey className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ INVITE TAB ═══ */}
      {activeTab === 'invite' && (
        <div className="space-y-6">
          {/* Info Banner */}
          <div className="thb-card border-l-4 border-l-teal-500 bg-gradient-to-r from-teal-50/60 to-emerald-50/40">
            <div className="p-4 flex items-start gap-3">
              <FiSend className="w-5 h-5 text-teal-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900 mb-1">Invite Employees to HRMS</p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Send login invitations to employees via email. Each invitation includes the employee&apos;s login email,
                  an auto-generated password, and a direct login link. Employees without accounts will have one created automatically.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Invite Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => handleInvite('all')}
              disabled={inviteProcessing || employees.length === 0}
              className="thb-card p-5 text-left hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-500 group-hover:bg-teal-500 group-hover:text-white transition-colors">
                  <FiUsers className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-thb-text-primary">Invite All Employees</p>
                  <p className="text-xs text-thb-text-muted">{withoutAccount} employees without account</p>
                </div>
              </div>
              <p className="text-xs text-thb-text-secondary">Generate credentials and send invitations to all employees who don&apos;t have login access yet.</p>
            </button>

            <button
              onClick={() => {
                if (selectedIds.size === 0) {
                  toast.error('Select employees from the Login Credentials tab first')
                  return
                }
                handleInvite('selected')
              }}
              disabled={inviteProcessing}
              className="thb-card p-5 text-left hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-500 group-hover:bg-green-500 group-hover:text-white transition-colors">
                  <FiUserCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-thb-text-primary">Invite Selected</p>
                  <p className="text-xs text-thb-text-muted">{selectedIds.size} selected</p>
                </div>
              </div>
              <p className="text-xs text-thb-text-secondary">Send invitations only to the employees you have selected. Select from the Credentials tab first.</p>
            </button>
          </div>

          {/* Employee Selection for Invite */}
          <div className="thb-card overflow-hidden">
            <div className="px-5 py-4 border-b border-thb-border flex items-center justify-between">
              <h3 className="font-semibold text-thb-text-primary">Select Employees to Invite</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => { setSelectedIds(new Set(filteredEmployees.map(e => e.id))); setSelectAll(true) }} className="text-xs text-teal-500 hover:text-teal-700 font-medium">Select All</button>
                <span className="text-thb-text-muted">|</span>
                <button onClick={() => { setSelectedIds(new Set()); setSelectAll(false) }} className="text-xs text-thb-text-muted hover:text-thb-text-primary font-medium">Clear</button>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-thb-border">
              {employees.map(emp => (
                <label key={emp.id} className={`flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50 cursor-pointer transition-colors ${selectedIds.has(emp.id) ? 'bg-teal-50/30' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(emp.id)}
                    onChange={() => toggleSelect(emp.id)}
                    className="rounded border-slate-300 text-teal-500 focus:ring-teal-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-thb-text-primary">{emp.firstName} {emp.lastName} <span className="text-thb-text-muted font-normal">({emp.employeeId})</span></p>
                    <p className="text-xs text-thb-text-muted">{emp.email} — {emp.department}</p>
                  </div>
                  {!emp.hasLoginAccount ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                      <FiUserX className="w-3 h-3" /> No Account
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                      <FiUserCheck className="w-3 h-3" /> Has Account
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Invite Results */}
          {inviteResults && (
            <div className="thb-card overflow-hidden">
              <div className="px-5 py-4 border-b border-thb-border">
                <h3 className="font-semibold text-thb-text-primary">Invite Results</h3>
                <p className="text-xs text-thb-text-muted mt-0.5">{inviteResults.filter(r => r.success).length} of {inviteResults.length} invitations processed · {inviteResults.filter(r => (r as Record<string, unknown>).emailSent).length} emails sent</p>
              </div>
              <div className="divide-y divide-thb-border">
                {inviteResults.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-3 px-5 py-3">
                    {r.success ? <FiCheck className="w-4 h-4 text-emerald-500" /> : <FiX className="w-4 h-4 text-red-500" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-thb-text-primary font-medium">{r.name} <span className="font-normal text-thb-text-muted">({r.employeeId})</span></p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-thb-text-muted">{r.email}</p>
                        {(r as Record<string, unknown>).emailSent ? (
                          <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600"><FiMail className="w-3 h-3" /> Email sent</span>
                        ) : r.success ? (
                          <span className="inline-flex items-center gap-0.5 text-xs text-amber-600"><FiAlertTriangle className="w-3 h-3" /> Email not sent (configure RESEND_API_KEY)</span>
                        ) : null}
                      </div>
                    </div>
                    {r.success && r.password && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">{showPasswords[`inv_${idx}`] ? r.password : '••••••••'}</span>
                        <button onClick={() => toggleShowPassword(`inv_${idx}`)} className="text-thb-text-muted hover:text-thb-text-primary">
                          {showPasswords[`inv_${idx}`] ? <FiEyeOff className="w-3.5 h-3.5" /> : <FiEye className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => copyToClipboard(r.password)} className="text-thb-text-muted hover:text-thb-text-primary">
                          <FiCopy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    {r.error && <span className="text-xs text-red-500">{r.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ BULK OPERATIONS TAB ═══ */}
      {activeTab === 'bulk' && (
        <div className="space-y-6">
          <div className="thb-card border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50/60 to-yellow-50/40">
            <div className="p-4 flex items-start gap-3">
              <FiAlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900 mb-1">Bulk Operations</p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Perform bulk password generation, reset, or account creation for multiple employees at once.
                  Use with caution — these actions affect all selected or all employees.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Auto-generate for all */}
            <button
              onClick={() => { setPasswordModalMode('all'); setShowPasswordModal(true); setUseAutoPassword(true); setManualPassword(''); setPasswordResults(null) }}
              className="thb-card p-5 text-left hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                  <FiRefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-thb-text-primary">Auto-Generate All</p>
                  <p className="text-xs text-thb-text-muted">{totalEmployees} employees</p>
                </div>
              </div>
              <p className="text-xs text-thb-text-secondary">Generate random passwords for all employees. Creates accounts for those who don&apos;t have one.</p>
            </button>

            {/* Generate for selected */}
            <button
              onClick={() => {
                if (selectedIds.size === 0) {
                  toast.error('Select employees from the Login Credentials tab first')
                  return
                }
                setPasswordModalMode('selected')
                setShowPasswordModal(true)
                setUseAutoPassword(true)
                setManualPassword('')
                setPasswordResults(null)
              }}
              className="thb-card p-5 text-left hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-500 group-hover:bg-green-500 group-hover:text-white transition-colors">
                  <FiKey className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-thb-text-primary">Generate Selected</p>
                  <p className="text-xs text-thb-text-muted">{selectedIds.size} selected</p>
                </div>
              </div>
              <p className="text-xs text-thb-text-secondary">Generate passwords for selected employees only. Select from Credentials tab first.</p>
            </button>

            {/* Manual password for all */}
            <button
              onClick={() => { setPasswordModalMode('all'); setShowPasswordModal(true); setUseAutoPassword(false); setManualPassword(''); setPasswordResults(null) }}
              className="thb-card p-5 text-left hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                  <FiLock className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-thb-text-primary">Manual Password All</p>
                  <p className="text-xs text-thb-text-muted">Set same password</p>
                </div>
              </div>
              <p className="text-xs text-thb-text-secondary">Set the same manual password for all employees. Use for initial setup or mass reset.</p>
            </button>
          </div>

          {/* Password Results */}
          {passwordResults && (
            <div className="thb-card overflow-hidden">
              <div className="px-5 py-4 border-b border-thb-border flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-thb-text-primary">Password Generation Results</h3>
                  <p className="text-xs text-thb-text-muted mt-0.5">{passwordResults.filter(r => r.success).length} of {passwordResults.length} succeeded</p>
                </div>
                <button onClick={() => {
                  const csv = [['Name', 'Email', 'Password', 'Action', 'Status']]
                    .concat(passwordResults.map(r => [r.name, r.email, r.password, r.action, r.success ? 'Success' : r.error || 'Failed']))
                    .map(r => r.join(',')).join('\n')
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url; a.download = 'generated_passwords.csv'; a.click()
                  URL.revokeObjectURL(url)
                  toast.success('Password results exported')
                }} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-thb-text-secondary rounded-lg text-xs font-medium">
                  <FiDownload className="w-3.5 h-3.5" /> Export
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-thb-border">
                {passwordResults.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-3 px-5 py-3">
                    {r.success ? <FiCheck className="w-4 h-4 text-emerald-500" /> : <FiX className="w-4 h-4 text-red-500" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-thb-text-primary font-medium">{r.name}</p>
                      <p className="text-xs text-thb-text-muted">{r.email}</p>
                    </div>
                    {r.success && r.password && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">{showPasswords[`bulk_${idx}`] ? r.password : '••••••••'}</span>
                        <button onClick={() => toggleShowPassword(`bulk_${idx}`)} className="text-thb-text-muted hover:text-thb-text-primary">
                          {showPasswords[`bulk_${idx}`] ? <FiEyeOff className="w-3.5 h-3.5" /> : <FiEye className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => copyToClipboard(r.password)} className="text-thb-text-muted hover:text-thb-text-primary">
                          <FiCopy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${r.action === 'account_created' ? 'bg-green-50 text-green-700' : r.action === 'password_reset' ? 'bg-emerald-50 text-emerald-700' : r.action === 'linked_and_reset' ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-700'}`}>
                      {r.action.replace(/_/g, ' ')}
                    </span>
                    {r.error && <span className="text-xs text-red-500">{r.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ MAP COMPANY TAB ═══ */}
      {activeTab === 'map-company' && (
        <div className="space-y-6">
          {/* Info Banner */}
          <div className="thb-card border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-50/60 to-teal-50/40">
            <div className="p-4 flex items-start gap-3">
              <FiBriefcase className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900 mb-1">Map Employee to Multiple Companies</p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Map an employee to multiple companies with different employee IDs per company. When an employee is mapped,
                  they can switch between companies using the company dropdown in the header. Each mapping can have its own
                  department, designation, and branch within that company.
                </p>
              </div>
            </div>
          </div>

          {/* Select Employee */}
          <div className="thb-card p-5 space-y-4">
            <h3 className="font-semibold text-thb-text-primary">Select Employee</h3>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
              <input
                type="text"
                placeholder="Search employee by name or ID..."
                value={mapCompanySearch}
                onChange={e => setMapCompanySearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
              />
            </div>
            {mapCompanySearch && (
              <div className="max-h-48 overflow-y-auto border border-thb-border rounded-lg divide-y divide-thb-border">
                {employees
                  .filter(e => `${e.firstName} ${e.lastName} ${e.employeeId}`.toLowerCase().includes(mapCompanySearch.toLowerCase()))
                  .slice(0, 10)
                  .map(emp => (
                    <button
                      key={emp.id}
                      onClick={() => {
                        setSelectedMapEmployee(emp)
                        setMapCompanySearch(`${emp.firstName} ${emp.lastName} (${emp.employeeId})`)
                        fetchCompanyMappings(emp.id)
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${selectedMapEmployee?.id === emp.id ? 'bg-emerald-50' : ''}`}
                    >
                      <FiUser className="w-4 h-4 text-thb-text-muted" />
                      <div>
                        <p className="text-sm font-medium text-thb-text-primary">{emp.firstName} {emp.lastName}</p>
                        <p className="text-xs text-thb-text-muted">{emp.employeeId} — {emp.email}</p>
                      </div>
                    </button>
                  ))
                }
              </div>
            )}
          </div>

          {/* Current Mappings - Enhanced */}
          {selectedMapEmployee && (
            <div className="thb-card overflow-hidden">
              <div className="px-5 py-4 border-b border-thb-border flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-thb-text-primary">Company Mappings for {selectedMapEmployee.firstName} {selectedMapEmployee.lastName}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-thb-text-muted">Employee can switch between mapped companies from the header dropdown</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                      {companyMappings.length} {companyMappings.length === 1 ? 'Company' : 'Companies'}
                    </span>
                    {companyMappings.length > 0 && (
                      <>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                          {companyMappings.filter(m => m.isPrimary).length} Primary
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                          {companyMappings.filter(m => !m.isPrimary).length} Secondary
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowAddMapping(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <FiPlus className="w-3.5 h-3.5" /> Add Company Mapping
                </button>
              </div>
              {companyMappings.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <FiBriefcase className="w-8 h-8 text-thb-text-muted mx-auto mb-2" />
                  <p className="text-sm text-thb-text-muted">No company mappings yet</p>
                  <p className="text-xs text-thb-text-muted mt-1">Click "Add Company Mapping" to map this employee to a company</p>
                </div>
              ) : (
                <div className="divide-y divide-thb-border">
                  {companyMappings.map(mapping => (
                    <div key={mapping.id} className={`flex items-center gap-4 px-5 py-4 ${mapping.isPrimary ? 'bg-emerald-50/30' : ''}`}>
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${mapping.isPrimary ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <FiBriefcase className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-thb-text-primary">{mapping.company?.name || 'Unknown'}</p>
                          {mapping.isPrimary ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">PRIMARY</span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">SECONDARY</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-xs text-thb-text-secondary font-medium">Employee ID: <span className="text-emerald-600 font-bold">{mapping.employeeCode}</span></span>
                          {mapping.department && <span className="text-xs text-thb-text-muted">Dept: {mapping.department.name}</span>}
                          {mapping.designation && <span className="text-xs text-thb-text-muted">Designation: {mapping.designation.title}</span>}
                          {mapping.branch && <span className="text-xs text-thb-text-muted">Branch: {mapping.branch.name}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!mapping.isPrimary && (
                          <button
                            onClick={() => setPrimaryMapping(mapping.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 font-medium rounded-md transition-colors"
                          >
                            <FiToggleLeft className="w-3.5 h-3.5" /> Set Primary
                          </button>
                        )}
                        {!mapping.isPrimary && (
                          <button
                            onClick={() => removeMapping(mapping.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 font-medium rounded-md transition-colors"
                          >
                            <FiTrash2 className="w-3.5 h-3.5" /> Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Summary Bar */}
              {companyMappings.length > 0 && (
                <div className="px-5 py-3 bg-slate-50 border-t border-thb-border">
                  <div className="flex items-center gap-4 text-xs text-thb-text-muted">
                    <span className="font-medium">Summary:</span>
                    <span>{companyMappings.length} compan{companyMappings.length === 1 ? 'y' : 'ies'} mapped</span>
                    <span className="text-emerald-600 font-semibold">{companyMappings.filter(m => m.isPrimary).length} primary</span>
                    <span className="text-slate-500">{companyMappings.filter(m => !m.isPrimary).length} secondary</span>
                    <span className="ml-auto">Employee IDs: {companyMappings.map(m => m.employeeCode).join(', ')}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Add Mapping Modal */}
          {showAddMapping && selectedMapEmployee && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowAddMapping(false)}>
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-thb-text-primary">Add Company Mapping</h3>
                  <button onClick={() => setShowAddMapping(false)} className="p-1 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100"><FiX className="w-5 h-5" /></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Company <span className="text-red-500 font-bold">*</span></label>
                    <select value={newMappingCompanyId} onChange={e => {
                      const cid = e.target.value
                      setNewMappingCompanyId(cid)
                      // Clear previous selections when company changes
                      setNewMappingDeptId('')
                      setNewMappingDesigId('')
                      setNewMappingBranchId('')
                      // Re-fetch departments and designations for the selected company
                      if (cid) {
                        fetchModalDropdowns(cid)
                      } else {
                        // Clear dropdowns if no company selected
                        setModalDepartments([])
                        setModalDesignations([])
                        setModalBranches([])
                      }
                    }} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                      <option value="">Select Company</option>
                      {availableCompanies.filter(c => !companyMappings.some(m => m.companyId === c.id)).map(c => <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Employee ID for this Company <span className="text-red-500 font-bold">*</span></label>
                    <input type="text" value={newMappingEmpCode} onChange={e => setNewMappingEmpCode(e.target.value)} placeholder="e.g. EMP-002" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Department</label>
                    <select value={newMappingDeptId} onChange={e => {
                      setNewMappingDeptId(e.target.value)
                      // When department changes, re-filter designations for that department
                      if (e.target.value) {
                        fetch(`/api/designations?companyId=${encodeURIComponent(newMappingCompanyId)}&departmentId=${encodeURIComponent(e.target.value)}&limit=200`, { headers: getAuthHeaders() })
                          .then(r => r.ok ? r.json() : { data: [] })
                          .then(data => {
                            const list = Array.isArray(data) ? data : (data.data || data.designations || [])
                            setModalDesignations(list.map((d: { id: string; title: string }) => ({ id: d.id, title: d.title })))
                          })
                          .catch(() => {})
                      }
                    }} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm" disabled={modalDropdownsLoading}>
                      <option value="">{modalDropdownsLoading ? 'Loading...' : 'Select Department'}</option>
                      {modalDepartments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Designation</label>
                    <select value={newMappingDesigId} onChange={e => setNewMappingDesigId(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm" disabled={modalDropdownsLoading}>
                      <option value="">{modalDropdownsLoading ? 'Loading...' : 'Select Designation'}</option>
                      {modalDesignations.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Branch</label>
                    <select value={newMappingBranchId} onChange={e => setNewMappingBranchId(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm" disabled={modalDropdownsLoading}>
                      <option value="">{modalDropdownsLoading ? 'Loading...' : 'Select Branch'}</option>
                      {modalBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={newMappingIsPrimary} onChange={e => setNewMappingIsPrimary(e.target.checked)} className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500" />
                    <span className="text-sm text-thb-text-secondary">Set as primary company</span>
                  </label>
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowAddMapping(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50">Cancel</button>
                    <button onClick={addCompanyMapping} disabled={mapCompanyProcessing} className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50">
                      {mapCompanyProcessing ? 'Adding...' : 'Add Mapping'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ EMPLOYEE CONFIGURATION TAB ═══ */}
      {activeTab === 'employee-config' && (
        <div className="space-y-4">
          <div className="thb-card border-l-4 border-l-green-500 bg-gradient-to-r from-green-50/60 to-emerald-50/40">
            <div className="p-4 flex items-start gap-3">
              <FiSettings className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900 mb-1">Employee Configuration</p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Configure employee code generation, probation defaults, access permissions, login security policies,
                  and onboarding/separation settings. These settings are applied across the Employee module.
                </p>
              </div>
            </div>
          </div>

          {employeeSettingSections.map(section => {
            const isEditing = editingSection === section.title
            const draft = editDrafts[section.title] || {}
            const allFields = section.fields
            return (
              <div key={section.title} className="thb-card overflow-hidden">
                <div className="px-5 py-4 border-b border-thb-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${section.iconBg} ${section.iconColor}`}>
                      {section.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-thb-text-primary">{section.title}</h3>
                      <p className="text-xs text-thb-text-muted mt-0.5">{section.description}</p>
                    </div>
                  </div>
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <button onClick={handleSaveSection.bind(null, section.title)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-colors">
                        <FiSave className="w-3.5 h-3.5" /> Save
                      </button>
                      <button onClick={handleCancelEdit} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-thb-border text-thb-text-secondary rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors">
                        <FiX className="w-3.5 h-3.5" /> Cancel
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => handleStartEdit(section.title)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-thb-border text-thb-text-secondary rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors">
                      <FiEdit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                  )}
                </div>
                <div className="px-5 py-3 divide-y divide-thb-border">
                  {allFields.map(field => {
                    const value = isEditing
                      ? (draft[field.key] ?? getSettingValue(field.key, allFields, empSettings))
                      : getSettingValue(field.key, allFields, empSettings)
                    const onChange = (val: string | number | boolean) => handleDraftChange(section.title, field.key, val)
                    return (
                      <div key={field.key}>
                        {renderSettingField(field, value, onChange, isEditing)}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ═══ CUSTOM FIELDS TAB ═══ */}
      {activeTab === 'custom-fields' && (
        <div className="space-y-4">
          <div className="thb-card border-l-4 border-l-teal-500 bg-gradient-to-r from-teal-50/60 to-cyan-50/40">
            <div className="p-4 flex items-start gap-3">
              <FiList className="w-5 h-5 text-teal-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900 mb-1">Custom Fields</p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Manage custom fields for employee profiles. These fields appear in the employee detail forms
                  and can be organized by section. Toggle fields on/off or add new custom fields as needed.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-thb-text-muted">
              <FiList className="w-4 h-4" />
              <span>{customFields.length} fields ({customFields.filter(f => f.isActive).length} active)</span>
            </div>
            <button
              onClick={() => setShowAddFieldModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <FiPlus className="w-4 h-4" /> Add Field
            </button>
          </div>

          {/* Group by section */}
          {(['personal', 'employment', 'compensation', 'custom'] as const).map(section => {
            const sectionFields = customFields.filter(f => f.section === section)
            if (sectionFields.length === 0) return null
            const sectionLabel = { personal: 'Personal Information', employment: 'Employment Details', compensation: 'Compensation & Statutory', custom: 'Custom Fields' }[section]
            const sectionIcon = { personal: <FiUser className="w-4 h-4" />, employment: <FiBriefcase className="w-4 h-4" />, compensation: <FiDollarSign className="w-4 h-4" />, custom: <FiList className="w-4 h-4" /> }[section]
            return (
              <div key={section} className="thb-card overflow-hidden">
                <div className="px-5 py-3 border-b border-thb-border bg-slate-50/80 flex items-center gap-2">
                  <span className="text-thb-text-muted">{sectionIcon}</span>
                  <h3 className="font-semibold text-sm text-thb-text-primary">{sectionLabel}</h3>
                  <span className="text-xs text-thb-text-muted ml-1">({sectionFields.length})</span>
                </div>
                <div className="divide-y divide-thb-border">
                  {sectionFields.map(field => (
                    <div key={field.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors">
                      <button onClick={() => handleToggleFieldActive(field.id)} className="flex-shrink-0" title={field.isActive ? 'Disable field' : 'Enable field'}>
                        {field.isActive ? <FiToggleRight className="w-5 h-5 text-teal-500" /> : <FiToggleLeft className="w-5 h-5 text-slate-300" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${field.isActive ? 'text-thb-text-primary' : 'text-thb-text-muted line-through'}`}>{field.label}</p>
                        <p className="text-xs text-thb-text-muted mt-0.5">
                          <span className="inline-flex px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono mr-2">{field.name}</span>
                          <span className="mr-2">{field.type}</span>
                          {field.required && <span className="text-red-500 font-medium">Required</span>}
                          {field.options && field.options.length > 0 && <span className="text-slate-400 ml-2">({field.options.length} options)</span>}
                        </p>
                      </div>
                      <button onClick={() => handleDeleteField(field.id)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete field">
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Add Field Modal */}
          {showAddFieldModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-thb-text-primary">Add Custom Field</h3>
                  <button onClick={() => setShowAddFieldModal(false)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100">
                    <FiX className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-thb-text-primary mb-1">Field Label</label>
                    <input type="text" value={newField.label || ''} onChange={e => setNewField(prev => ({ ...prev, label: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20" placeholder="e.g. Driving License Number" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-thb-text-primary mb-1">Field Name (key)</label>
                    <input type="text" value={newField.name || ''} onChange={e => setNewField(prev => ({ ...prev, name: e.target.value.replace(/[^a-z0-9_]/g, '_') }))} className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20" placeholder="e.g. driving_license_number" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-thb-text-primary mb-1">Type</label>
                      <select value={newField.type || 'text'} onChange={e => setNewField(prev => ({ ...prev, type: e.target.value as CustomField['type'] }))} className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20">
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="select">Select</option>
                        <option value="toggle">Toggle</option>
                        <option value="textarea">Textarea</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-thb-text-primary mb-1">Section</label>
                      <select value={newField.section || 'custom'} onChange={e => setNewField(prev => ({ ...prev, section: e.target.value as CustomField['section'] }))} className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20">
                        <option value="personal">Personal</option>
                        <option value="employment">Employment</option>
                        <option value="compensation">Compensation</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                  </div>
                  {newField.type === 'select' && (
                    <div>
                      <label className="block text-sm font-medium text-thb-text-primary mb-1">Options (comma-separated)</label>
                      <input type="text" onChange={e => setNewField(prev => ({ ...prev, options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20" placeholder="Option 1, Option 2, Option 3" />
                    </div>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={newField.required || false} onChange={e => setNewField(prev => ({ ...prev, required: e.target.checked }))} className="rounded border-slate-300 text-teal-500 focus:ring-teal-500" />
                    <span className="text-sm text-thb-text-primary">Required field</span>
                  </label>
                  <div className="flex items-center gap-2 pt-2">
                    <button onClick={handleAddField} className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium transition-colors">
                      <FiPlus className="w-4 h-4" /> Add Field
                    </button>
                    <button onClick={() => setShowAddFieldModal(false)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 border border-thb-border text-thb-text-secondary rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ PASSWORD MODAL ═══ */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-thb-text-primary">
                {passwordModalMode === 'all' ? 'Generate Passwords for All' : passwordModalMode === 'selected' ? `Generate Passwords (${selectedIds.size} selected)` : 'Generate Password'}
              </h3>
              <button onClick={() => setShowPasswordModal(false)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-thb-text-primary mb-2">Password Method</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setUseAutoPassword(true)}
                    className={`flex-1 p-3 rounded-lg border-2 text-left transition-colors ${useAutoPassword ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    <p className="text-sm font-medium text-thb-text-primary">Auto-Generate</p>
                    <p className="text-xs text-thb-text-muted mt-0.5">Random 12-character password</p>
                  </button>
                  <button
                    onClick={() => setUseAutoPassword(false)}
                    className={`flex-1 p-3 rounded-lg border-2 text-left transition-colors ${!useAutoPassword ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    <p className="text-sm font-medium text-thb-text-primary">Manual</p>
                    <p className="text-xs text-thb-text-muted mt-0.5">Set your own password</p>
                  </button>
                </div>
              </div>

              {!useAutoPassword && (
                <div>
                  <label className="block text-sm font-medium text-thb-text-primary mb-1">Password</label>
                  <input
                    type="text"
                    value={manualPassword}
                    onChange={e => setManualPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                  <p className="text-xs text-thb-text-muted mt-1">This password will be set for all selected employees</p>
                </div>
              )}

              {useAutoPassword && !manualPassword && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-thb-text-muted">Sample password:</span>
                  <code className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">{generatePassword()}</code>
                  <button onClick={() => copyToClipboard(generatePassword())} className="text-thb-text-muted hover:text-thb-text-primary">
                    <FiCopy className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handlePasswordAction}
                  disabled={processing}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {processing ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <FiKey className="w-4 h-4" />}
                  {processing ? 'Processing...' : 'Generate Passwords'}
                </button>
                <button onClick={() => setShowPasswordModal(false)} className="flex-1 px-4 py-2.5 border border-thb-border text-thb-text-secondary rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>

            {/* Inline results */}
            {passwordResults && passwordResults.length > 0 && (
              <div className="mt-4 border-t border-thb-border pt-4">
                <h4 className="text-sm font-semibold text-thb-text-primary mb-2">Results ({passwordResults.filter(r => r.success).length}/{passwordResults.length})</h4>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {passwordResults.map((r, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      {r.success ? <FiCheck className="w-3.5 h-3.5 text-emerald-500" /> : <FiX className="w-3.5 h-3.5 text-red-500" />}
                      <span className="text-thb-text-primary font-medium">{r.name}</span>
                      {r.success && r.password && (
                        <>
                          <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">{showPasswords[`modal_${idx}`] ? r.password : '••••••••'}</code>
                          <button onClick={() => toggleShowPassword(`modal_${idx}`)}>{showPasswords[`modal_${idx}`] ? <FiEyeOff className="w-3 h-3" /> : <FiEye className="w-3 h-3" />}</button>
                          <button onClick={() => copyToClipboard(r.password)}><FiCopy className="w-3 h-3" /></button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ DETAIL MODAL ═══ */}
      {detailEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-thb-text-primary">Manage Credentials</h3>
              <button onClick={() => setDetailEmployee(null)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 font-bold text-sm">
                  {detailEmployee.firstName[0]}{detailEmployee.lastName[0]}
                </div>
                <div>
                  <p className="font-semibold text-thb-text-primary">{detailEmployee.firstName} {detailEmployee.lastName}</p>
                  <p className="text-xs text-thb-text-muted">{detailEmployee.employeeId} — {detailEmployee.department}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-thb-text-primary mb-1">Login Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-thb-text-primary mb-1">New Password (leave empty to auto-generate)</label>
                <div className="relative">
                  <input
                    type={showPasswords['detail_edit'] ? 'text' : 'password'}
                    value={editPassword}
                    onChange={e => setEditPassword(e.target.value)}
                    placeholder="Auto-generate if empty"
                    className="w-full px-3 py-2 pr-10 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                  <button onClick={() => toggleShowPassword('detail_edit')} className="absolute right-2 top-1/2 -translate-y-1/2 text-thb-text-muted hover:text-thb-text-primary">
                    {showPasswords['detail_edit'] ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <button onClick={() => { const p = generatePassword(); setEditPassword(p); setShowPasswords(prev => ({ ...prev, detail_edit: true })) }} className="text-xs text-teal-500 hover:text-teal-700 font-medium">
                    Generate Random
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-thb-text-primary mb-1">Account Status</label>
                <div className="flex items-center gap-2">
                  {!detailEmployee.hasLoginAccount ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                      <FiUserX className="w-3 h-3" /> No Account
                    </span>
                  ) : detailEmployee.loginStatus === 'active' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                      <FiUserCheck className="w-3 h-3" /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">
                      <FiUserX className="w-3 h-3" /> Inactive
                    </span>
                  )}
                  {detailEmployee.lastLogin && (
                    <span className="text-xs text-thb-text-muted">Last login: {new Date(detailEmployee.lastLogin).toLocaleDateString()}</span>
                  )}
                </div>
              </div>

              {/* Reset results */}
              {passwordResults && passwordResults.length === 1 && passwordResults[0].success && (
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <p className="text-xs font-semibold text-emerald-700 mb-1">New Password Generated</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono bg-white px-2 py-1 rounded border">{showPasswords['detail_result'] ? passwordResults[0].password : '••••••••'}</code>
                    <button onClick={() => toggleShowPassword('detail_result')} className="text-emerald-600 hover:text-emerald-700">
                      {showPasswords['detail_result'] ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                    </button>
                    <button onClick={() => copyToClipboard(passwordResults[0].password)} className="text-emerald-600 hover:text-emerald-700">
                      <FiCopy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleResetSinglePassword}
                  disabled={processing}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {processing ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <FiKey className="w-4 h-4" />}
                  {detailEmployee.hasLoginAccount ? 'Reset Password' : 'Create Account'}
                </button>
                {detailEmployee.hasLoginAccount && (
                  <button
                    onClick={() => handleToggleStatus(detailEmployee)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-thb-border text-thb-text-secondary rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    {detailEmployee.loginStatus === 'active' ? <FiToggleRight className="w-4 h-4" /> : <FiToggleLeft className="w-4 h-4" />}
                    {detailEmployee.loginStatus === 'active' ? 'Disable' : 'Enable'}
                  </button>
                )}
                {detailEmployee.hasLoginAccount && (
                  <button
                    onClick={() => handleDeleteAccount(detailEmployee)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-red-200 text-red-500 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
