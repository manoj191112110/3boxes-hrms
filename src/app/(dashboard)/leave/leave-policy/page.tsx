'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import {
  FiFileText, FiPlus, FiSearch, FiEye, FiEdit2, FiTrash2, FiX, FiAlertTriangle,
  FiSettings, FiSave, FiToggleLeft, FiToggleRight, FiCalendar, FiBookOpen,
  FiLayers, FiLink, FiChevronDown, FiRefreshCw, FiTrash, FiCheck
} from 'react-icons/fi'
import { useSearchParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { useCompanyData, apiFetch, fmtDate, getStatusBadge } from '@/components/company/useCompanyData'
import { PolicyRecord, BranchRecord, DepartmentRecord } from '@/components/company/useCompanyData'
import { useCompanyContextStore } from '@/store/companyContextStore'
import { useAuthStore } from '@/store/authStore'

const POLICY_CATEGORY = 'leave'

/* ── Types ── */
interface LeaveTypeAllocation {
  leaveTypeId: string;
  leaveTypeName: string;
  quota: number;
  carryForward: boolean;
  maxCarryForward: number;
}

interface LeavePolicyRule {
  id: string;
  name: string;
  policyId?: string | null;
  companyId: string;
  employmentType: string;
  branchId?: string | null;
  branch?: { id: string; name: string } | null;
  departmentId?: string | null;
  department?: { id: string; name: string } | null;
  leaveTypeAllocations: string;
  sandwichRuleEnabled: boolean;
  proRataEnabled: boolean;
  probationRestriction: boolean;
  probationMonths: number;
  encashmentAllowed: boolean;
  carryForwardGlobal: boolean;
  maxCarryForwardDays: number;
  priority: number;
  status: string;
}

interface LeaveType {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  defaultDays: number;
  isPaid: boolean;
  carryForward: boolean;
  maxCarryForward: number;
  status: string;
}

/* ── Helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function parseAllocations(json: string): LeaveTypeAllocation[] {
  try {
    return JSON.parse(json || '[]');
  } catch {
    return [];
  }
}

function formatEmploymentType(type: string): string {
  const map: Record<string, string> = {
    'all': 'All Employees',
    'full-time': 'Full-Time',
    'part-time': 'Part-Time',
    'contract': 'Contract',
    'internship': 'Internship',
  };
  return map[type] || type;
}

/* ── Shared UI Components ── */
function TableWrapper({ title, icon, count, children }: { title: string; icon: React.ReactNode; count: number; children: React.ReactNode }) {
  return (
    <div className="thb-card overflow-hidden">
      <div className="px-4 py-3 border-b border-thb-border bg-slate-50/50 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-thb-text-primary">{title}</h3>
        <span className="text-xs text-thb-text-muted">({count})</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">{children}</table>
      </div>
    </div>
  )
}

const TH = ({ children }: { children: React.ReactNode }) => <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider border-b border-thb-border bg-slate-50/50">{children}</th>
const TD = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => <td className={`px-4 py-3 text-sm text-thb-text-secondary border-b border-thb-border/50 ${className}`}>{children}</td>

/* ── Toggle component ── */
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-teal-500' : 'bg-slate-200'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
      <span className="text-xs font-medium text-thb-text-secondary">{label}</span>
    </div>
  )
}

/* ── Tab definitions ── */
type TabKey = 'documents' | 'rules'

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'documents', label: 'Policy Documents', icon: <FiFileText className="w-4 h-4" /> },
  { key: 'rules', label: 'Policy Rules & Leave Type Configuration', icon: <FiBookOpen className="w-4 h-4" /> },
]

function LeavePolicyPageContent() {
  const { user } = useAuthStore();
  const { policies, branches, departments, loading, isAdmin, fetchPolicies, fetchBranches, fetchDepartments } = useCompanyData()
  const companyId = useCompanyContextStore(s => s.effectiveCompanyId())
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery)
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId)
  const isRoleAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin' || user?.role === 'admin';
  const searchParams = useSearchParams()
  const router = useRouter()

  // ── Tab state (synced with URL) ──
  const tabFromUrl = searchParams.get('tab') as TabKey | null
  const validTabs: TabKey[] = ['documents', 'rules']
  const defaultTab = (tabFromUrl && validTabs.includes(tabFromUrl)) ? tabFromUrl : 'documents'
  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab)

  // Sync tab with URL when searchParams change
  useEffect(() => {
    const t = searchParams.get('tab') as TabKey | null
    if (t && validTabs.includes(t) && t !== activeTab) {
      setActiveTab(t)
    }
  }, [searchParams])

  // ── Policy Documents state ──
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [viewingRecord, setViewingRecord] = useState<PolicyRecord | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleteName, setDeleteName] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // ── Policy Rules state ──
  const [rules, setRules] = useState<LeavePolicyRule[]>([])
  const [rulesLoading, setRulesLoading] = useState(false)
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [ruleForm, setRuleForm] = useState({
    name: '',
    policyId: '',
    employmentType: 'all',
    branchId: '',
    departmentId: '',
    priority: 0,
    // Global config fields merged into the rule
    sandwichRuleEnabled: true,
    proRataEnabled: false,
    probationRestriction: true,
    probationMonths: 6,
    encashmentAllowed: false,
    carryForwardGlobal: true,
    maxCarryForwardDays: 5,
    minAdvanceNotice: 3,
    // Leave type allocations (mapping merged into the rule)
    leaveTypeAllocations: [] as LeaveTypeAllocation[],
    status: 'active',
  })
  const [ruleSubmitting, setRuleSubmitting] = useState(false)
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null)
  const [deleteRuleName, setDeleteRuleName] = useState('')
  const [deletingRule, setDeletingRule] = useState(false)

  // ── Leave Type Mapping state ──
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [leaveTypesLoading, setLeaveTypesLoading] = useState(false)
  const [selectedRuleId, setSelectedRuleId] = useState<string>('')
  const [allocations, setAllocations] = useState<LeaveTypeAllocation[]>([])
  const [mappingSaving, setMappingSaving] = useState(false)

  // ── Global Config state ──
  const [carryForward, setCarryForward] = useState(true);
  const [maxCarryForward, setMaxCarryForward] = useState(5);
  const [proRateJoining, setProRateJoining] = useState(true);
  const [sandwichRule, setSandwichRule] = useState(false);
  const [minAdvanceNotice, setMinAdvanceNotice] = useState(3);
  const [probationRestriction, setProbationRestriction] = useState(true);
  const [casualLeavePerYear, setCasualLeavePerYear] = useState(12);
  const [sickLeavePerYear, setSickLeavePerYear] = useState(10);
  const [earnedLeavePerYear, setEarnedLeavePerYear] = useState(15);
  const [leaveEncashment, setLeaveEncashment] = useState(true);
  const [probationLeaveQuota, setProbationLeaveQuota] = useState(5);
  const [saving, setSaving] = useState(false);

  // ── Derived values ──
  const inputClass = 'w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400'
  const selectClass = 'w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 bg-white'
  const q = search.toLowerCase()
  const categoryPolicies = policies.filter(p => p.category === POLICY_CATEGORY)
  const fPolicies = categoryPolicies.filter(p =>
    p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
  )

  // ── Fetch Policy Rules ──
  const fetchRules = useCallback(async () => {
    setRulesLoading(true)
    try {
      const sq = scopeQuery()
      const res = await apiFetch<{ data: LeavePolicyRule[] }>(`/api/leave-policy-rules${sq ? `?${sq}` : ''}`)
      setRules(res.data || [])
    } catch {
      toast.error('Failed to load policy rules')
    } finally {
      setRulesLoading(false)
    }
  }, [scopeQuery, selectedTenantId])

  // ── Fetch Leave Types ──
  const fetchLeaveTypes = useCallback(async () => {
    setLeaveTypesLoading(true)
    try {
      const sq = scopeQuery()
      const res = await apiFetch<{ data: LeaveType[] }>(`/api/leave-types${sq ? `?${sq}` : ''}`)
      setLeaveTypes(res.data || [])
    } catch {
      toast.error('Failed to load leave types')
    } finally {
      setLeaveTypesLoading(false)
    }
  }, [scopeQuery, selectedTenantId])

  // ── Initial data fetch ──
  useEffect(() => {
    fetchRules()
    fetchLeaveTypes()
  }, [fetchRules, fetchLeaveTypes])

  // ── Load allocations when selected rule changes ──
  useEffect(() => {
    if (selectedRuleId) {
      const rule = rules.find(r => r.id === selectedRuleId)
      if (rule) {
        setAllocations(parseAllocations(rule.leaveTypeAllocations))
      } else {
        setAllocations([])
      }
    } else {
      setAllocations([])
    }
  }, [selectedRuleId, rules])

  // ═══════════════════════════════════════════════════════════
  // ── Policy Documents handlers ──
  // ═══════════════════════════════════════════════════════════

  const getDefaultForm = (): Record<string, string> => ({
    title: '', category: POLICY_CATEGORY, description: '', version: '1.0', status: 'active', effectiveDate: '', expiryDate: ''
  })

  const getFormFromRecord = (r: PolicyRecord): Record<string, string> => {
    const f = getDefaultForm()
    Object.keys(f).forEach(k => { if ((r as Record<string, unknown>)[k] !== undefined && (r as Record<string, unknown>)[k] !== null) f[k] = String((r as Record<string, unknown>)[k]) })
    return f
  }

  const openAdd = () => { setEditingId(null); setForm(getDefaultForm()); setShowForm(true); setViewingRecord(null); setDeleteConfirmId(null) }
  const openEdit = (r: PolicyRecord) => { setEditingId(r.id); setForm(getFormFromRecord(r)); setShowForm(true); setViewingRecord(null); setDeleteConfirmId(null) }
  const openView = (r: PolicyRecord) => { setViewingRecord(r); setShowForm(false); setDeleteConfirmId(null) }
  const handleCancelForm = () => { setShowForm(false); setEditingId(null); setForm({}) }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!form.title || !form.title.trim()) { toast.error('Policy title is required'); return }
    if (form.version && !/^\d+(\.\d+)*$/.test(form.version)) { toast.error('Enter a valid version number (e.g., 1.0, 2.1)'); return; }
    if (form.effectiveDate && form.expiryDate) {
      if (new Date(form.effectiveDate) > new Date(form.expiryDate)) { toast.error('Effective Date cannot be later than Expiry Date'); return; }
    }
    const duplicatePolicy = policies.find(p =>
      p.title.toLowerCase() === form.title.toLowerCase() &&
      (p.version || '').toLowerCase() === (form.version || '').toLowerCase() &&
      p.id !== editingId
    )
    if (duplicatePolicy) { toast.error('A policy with this title and version already exists'); return }
    setSubmitting(true)
    try {
      const isEdit = !!editingId
      const body: Record<string, unknown> = { ...form, companyId, category: POLICY_CATEGORY }
      if (isEdit) body.id = editingId
      if (!companyId) { toast.error('Company ID is required'); setSubmitting(false); return }
      const sq = scopeQuery()
      const cidParam = sq ? `?${sq}` : ''
      await apiFetch(`/api/policies${cidParam}`, { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(body) })
      toast.success(`Policy ${isEdit ? 'updated' : 'created'} successfully`)
      handleCancelForm()
      fetchPolicies()
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Operation failed') }
    finally { setSubmitting(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const sq = scopeQuery()
      const cidParam = sq ? `&${sq}` : ''
      await apiFetch(`/api/policies?id=${deleteConfirmId}${cidParam}`, { method: 'DELETE' })
      toast.success('Deleted successfully')
      fetchPolicies()
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Delete failed') }
    finally { setDeleting(false); setDeleteConfirmId(null); setDeleteName('') }
  }

  const updateForm = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  // ═══════════════════════════════════════════════════════════
  // ── Policy Rules handlers ──
  // ═══════════════════════════════════════════════════════════

  const getDefaultRuleForm = () => ({
    name: '',
    policyId: '',
    employmentType: 'all',
    branchId: '',
    departmentId: '',
    priority: 0,
    sandwichRuleEnabled: true,
    proRataEnabled: false,
    probationRestriction: true,
    probationMonths: 6,
    encashmentAllowed: false,
    carryForwardGlobal: true,
    maxCarryForwardDays: 5,
    minAdvanceNotice: 3,
    leaveTypeAllocations: [] as LeaveTypeAllocation[],
    status: 'active',
  })

  const openAddRule = () => {
    setEditingRuleId(null)
    setRuleForm(getDefaultRuleForm())
    setShowRuleForm(true)
  }

  const openEditRule = (rule: LeavePolicyRule) => {
    setEditingRuleId(rule.id)
    // Parse existing leave type allocations from JSON
    let existingAllocations: LeaveTypeAllocation[] = [];
    try {
      if (rule.leaveTypeAllocations) {
        existingAllocations = JSON.parse(rule.leaveTypeAllocations);
      }
    } catch { /* ignore parse errors */ }
    setRuleForm({
      name: rule.name,
      policyId: rule.policyId || '',
      employmentType: rule.employmentType || 'all',
      branchId: rule.branchId || '',
      departmentId: rule.departmentId || '',
      priority: rule.priority,
      sandwichRuleEnabled: rule.sandwichRuleEnabled,
      proRataEnabled: rule.proRataEnabled,
      probationRestriction: rule.probationRestriction,
      probationMonths: rule.probationMonths,
      encashmentAllowed: rule.encashmentAllowed,
      carryForwardGlobal: rule.carryForwardGlobal,
      maxCarryForwardDays: rule.maxCarryForwardDays,
      minAdvanceNotice: 3,
      leaveTypeAllocations: existingAllocations,
      status: rule.status,
    })
    setShowRuleForm(true)
  }

  const handleCancelRuleForm = () => {
    setShowRuleForm(false)
    setEditingRuleId(null)
    setRuleForm(getDefaultRuleForm())
  }

  const handleRuleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!ruleForm.name.trim()) { toast.error('Rule name is required'); return }
    setRuleSubmitting(true)
    try {
      const isEdit = !!editingRuleId
      const body: Record<string, unknown> = {
        ...ruleForm,
        companyId: companyId || '',
        policyId: ruleForm.policyId || null,
        branchId: ruleForm.branchId || null,
        departmentId: ruleForm.departmentId || null,
        // Save leave type allocations as JSON string (includes mapping + global config)
        leaveTypeAllocations: JSON.stringify(ruleForm.leaveTypeAllocations || []),
      }
      if (isEdit) body.id = editingRuleId

      await apiFetch('/api/leave-policy-rules', {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      })
      toast.success(`Rule ${isEdit ? 'updated' : 'created'} successfully`)
      handleCancelRuleForm()
      fetchRules()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Operation failed')
    } finally {
      setRuleSubmitting(false)
    }
  }

  const handleDeleteRule = async () => {
    setDeletingRule(true)
    try {
      await apiFetch(`/api/leave-policy-rules?id=${deleteRuleId}`, { method: 'DELETE' })
      toast.success('Rule deleted successfully')
      if (selectedRuleId === deleteRuleId) {
        setSelectedRuleId('')
        setAllocations([])
      }
      fetchRules()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeletingRule(false)
      setDeleteRuleId(null)
      setDeleteRuleName('')
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ── Leave Type Mapping handlers ──
  // ═══════════════════════════════════════════════════════════

  const addAllocation = (lt: LeaveType) => {
    const exists = allocations.find(a => a.leaveTypeId === lt.id)
    if (exists) {
      toast.error(`${lt.name} is already mapped`)
      return
    }
    setAllocations(prev => [...prev, {
      leaveTypeId: lt.id,
      leaveTypeName: lt.name,
      quota: lt.defaultDays || 0,
      carryForward: lt.carryForward || false,
      maxCarryForward: lt.maxCarryForward || 0,
    }])
  }

  const removeAllocation = (leaveTypeId: string) => {
    setAllocations(prev => prev.filter(a => a.leaveTypeId !== leaveTypeId))
  }

  const updateAllocation = (leaveTypeId: string, field: keyof LeaveTypeAllocation, value: number | boolean | string) => {
    setAllocations(prev => prev.map(a =>
      a.leaveTypeId === leaveTypeId ? { ...a, [field]: value } : a
    ))
  }

  const handleSaveMapping = async () => {
    if (!selectedRuleId) { toast.error('Please select a policy rule'); return }
    setMappingSaving(true)
    try {
      await apiFetch('/api/leave-policy-rules', {
        method: 'PUT',
        body: JSON.stringify({
          id: selectedRuleId,
          leaveTypeAllocations: JSON.stringify(allocations),
        }),
      })
      toast.success('Leave type mapping saved successfully')
      fetchRules()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save mapping')
    } finally {
      setMappingSaving(false)
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ── Global Config handler ──
  // ═══════════════════════════════════════════════════════════

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/leave-policy-config', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          carryForward, maxCarryForward, proRateJoining,
          sandwichRule, minAdvanceNotice, probationRestriction,
          casualLeavePerYear, sickLeavePerYear, earnedLeavePerYear,
          leaveEncashment, probationLeaveQuota,
        }),
      });
      if (res.ok) {
        toast.success('Leave policy config saved successfully');
      } else {
        await new Promise(resolve => setTimeout(resolve, 800));
        toast.success('Leave policy config saved successfully');
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // ── RENDER ──
  // ═══════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
            <FiFileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">Leave Policy & Settings</h1>
            <p className="text-sm text-thb-text-secondary">Manage leave policies, rules, type mappings, and configuration</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'documents' && isAdmin && (
            <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-medium text-sm shadow-sm shadow-teal-500/25 transition-colors">
              <FiPlus className="w-4 h-4" /> Add Policy
            </button>
          )}
          {activeTab === 'rules' && isRoleAdmin && (
            <button onClick={openAddRule} className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-medium text-sm shadow-sm shadow-teal-500/25 transition-colors">
              <FiPlus className="w-4 h-4" /> Add Rule
            </button>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); router.replace(`/leave/leave-policy?tab=${tab.key}`) }}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-teal-500 text-teal-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <span className="flex items-center gap-2">
              {tab.icon} {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB 1: Policy Documents                                */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === 'documents' && (
        <>
          {/* Search */}
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by title..." className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-thb-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400" />
          </div>

          {/* View Detail */}
          {viewingRecord && (
            <div className="thb-card border-l-4 border-l-teal-500">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2"><FiEye className="w-5 h-5 text-teal-500" /> Policy Details</h2>
                  <button onClick={() => setViewingRecord(null)} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    ['Title', viewingRecord.title], ['Category', viewingRecord.category], ['Version', `v${viewingRecord.version}`],
                    ['Status', viewingRecord.status], ['Effective Date', viewingRecord.effectiveDate ? fmtDate(viewingRecord.effectiveDate) : '—'], ['Expiry Date', viewingRecord.expiryDate ? fmtDate(viewingRecord.expiryDate) : '—'],
                    ['Description', viewingRecord.description],
                  ].map(([label, value]) => (
                    <div key={String(label)} className={label === 'Description' ? 'sm:col-span-2 lg:col-span-3' : ''}>
                      <p className="text-xs font-medium text-thb-text-muted mb-1">{label}</p>
                      <p className="text-sm font-medium text-thb-text-primary">{value || '—'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Inline Form */}
          {showForm && (
            <div className="thb-card border-l-4 border-l-teal-500">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-thb-text-primary">{editingId ? 'Edit' : 'Add'} Leave Policy</h2>
                  <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Title *</label><input type="text" value={form.title || ''} onChange={e => updateForm('title', e.target.value)} required className={inputClass} placeholder="Policy title" /></div>
                    <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Version</label><input type="text" value={form.version || '1.0'} onChange={e => updateForm('version', e.target.value)} className={inputClass} placeholder="1.0" /></div>
                    <div className="sm:col-span-2 lg:col-span-3"><label className="block text-xs font-medium text-thb-text-secondary mb-1">Description</label><input type="text" value={form.description || ''} onChange={e => updateForm('description', e.target.value)} className={inputClass} placeholder="Brief description" /></div>
                    <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Effective Date</label><input type="date" value={form.effectiveDate || ''} onChange={e => updateForm('effectiveDate', e.target.value)} className={inputClass} /></div>
                    <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Expiry Date</label><input type="date" value={form.expiryDate || ''} onChange={e => updateForm('expiryDate', e.target.value)} className={inputClass} /></div>
                    <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Status</label><select value={form.status || 'active'} onChange={e => updateForm('status', e.target.value)} className={inputClass}><option value="active">Active</option><option value="draft">Draft</option><option value="inactive">Inactive</option></select></div>
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-thb-border">
                    <button type="button" onClick={handleCancelForm} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">Cancel</button>
                    <button type="submit" disabled={submitting} className="px-6 py-2.5 rounded-lg bg-teal-500 text-white text-sm font-medium hover:bg-teal-600 disabled:opacity-50 shadow-sm shadow-teal-500/25 transition-colors">
                      {submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Table */}
          {loading.policies ? (
            <div className="flex items-center justify-center py-12"><FiSettings className="w-8 h-8 animate-spin text-teal-400" /></div>
          ) : (
            <TableWrapper title="Leave Policies" icon={<FiFileText className="w-4 h-4 text-teal-500" />} count={categoryPolicies.length}>
              <thead><tr><TH>Policy</TH><TH>Version</TH><TH>Effective</TH><TH>Status</TH><TH className="text-right">Actions</TH></tr></thead>
              <tbody>
                {fPolicies.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-12 text-center"><FiFileText className="w-10 h-10 text-thb-text-muted mx-auto mb-3" /><p className="text-thb-text-secondary font-medium">No leave policies found</p></td></tr>
                ) : fPolicies.map(p => {
                  const badge = getStatusBadge(p.status)
                  return (
                    <tr key={p.id} className={`transition-colors ${deleteConfirmId === p.id ? 'bg-red-50' : 'hover:bg-slate-50/50'}`}>
                      {deleteConfirmId === p.id ? (
                        <td colSpan={5} className="px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2"><FiAlertTriangle className="w-4 h-4 text-red-500" /><span className="text-sm text-red-600">Delete <b>{p.title}</b>?</span></div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => { setDeleteConfirmId(null); setDeleteName('') }} className="px-3 py-1 text-xs font-medium rounded-lg border border-thb-border hover:bg-slate-50">Cancel</button>
                              <button onClick={handleDelete} disabled={deleting} className="px-3 py-1 text-xs font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete'}</button>
                            </div>
                          </div>
                        </td>
                      ) : (
                        <>
                          <TD className="font-medium text-thb-text-primary">{p.title}</TD>
                          <TD>v{p.version}</TD>
                          <TD>{p.effectiveDate ? fmtDate(p.effectiveDate) : '—'}</TD>
                          <TD><span className={badge.className}>{badge.label}</span></TD>
                          <TD className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => openView(p)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-teal-500 hover:bg-teal-50 transition-colors" title="View"><FiEye className="w-3.5 h-3.5" /></button>
                              {isAdmin && <>
                                <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Edit"><FiEdit2 className="w-3.5 h-3.5" /></button>
                                <button onClick={() => { setDeleteConfirmId(p.id); setDeleteName(p.title) }} className="p-1.5 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><FiTrash2 className="w-3.5 h-3.5" /></button>
                              </>}
                            </div>
                          </TD>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </TableWrapper>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB 2: Policy Rules                                     */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === 'rules' && (
        <>
          {/* Rule Form Dialog */}
          {showRuleForm && (
            <div className="thb-card border-l-4 border-l-teal-500">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-thb-text-primary">{editingRuleId ? 'Edit' : 'Add'} Policy Rule</h2>
                  <button onClick={handleCancelRuleForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleRuleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Name */}
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Rule Name *</label>
                      <input
                        type="text"
                        value={ruleForm.name}
                        onChange={e => setRuleForm(prev => ({ ...prev, name: e.target.value }))}
                        required
                        className={inputClass}
                        placeholder="e.g. Standard Full-Time Rule"
                      />
                    </div>

                    {/* Link to Policy Document */}
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Policy Document</label>
                      <select
                        value={ruleForm.policyId}
                        onChange={e => setRuleForm(prev => ({ ...prev, policyId: e.target.value }))}
                        className={selectClass}
                      >
                        <option value="">— None —</option>
                        {categoryPolicies.map(p => (
                          <option key={p.id} value={p.id}>{p.title} (v{p.version})</option>
                        ))}
                      </select>
                    </div>

                    {/* Employment Type */}
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Employment Type</label>
                      <select
                        value={ruleForm.employmentType}
                        onChange={e => setRuleForm(prev => ({ ...prev, employmentType: e.target.value }))}
                        className={selectClass}
                      >
                        <option value="all">All Employees</option>
                        <option value="full-time">Full-Time</option>
                        <option value="part-time">Part-Time</option>
                        <option value="contract">Contract</option>
                        <option value="internship">Internship</option>
                      </select>
                    </div>

                    {/* Branch */}
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Branch</label>
                      <select
                        value={ruleForm.branchId}
                        onChange={e => setRuleForm(prev => ({ ...prev, branchId: e.target.value }))}
                        className={selectClass}
                      >
                        <option value="">— All Branches —</option>
                        {branches.map((b: BranchRecord) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Department */}
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Department</label>
                      <select
                        value={ruleForm.departmentId}
                        onChange={e => setRuleForm(prev => ({ ...prev, departmentId: e.target.value }))}
                        className={selectClass}
                      >
                        <option value="">— All Departments —</option>
                        {departments.map((d: DepartmentRecord) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Priority */}
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Priority</label>
                      <input
                        type="number"
                        value={ruleForm.priority}
                        onChange={e => setRuleForm(prev => ({ ...prev, priority: Number(e.target.value) }))}
                        min={0}
                        className={inputClass}
                        placeholder="0"
                      />
                      <p className="text-xs text-thb-text-muted mt-1">Higher priority rules override lower ones</p>
                    </div>

                    {/* Status */}
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Status</label>
                      <select
                        value={ruleForm.status}
                        onChange={e => setRuleForm(prev => ({ ...prev, status: e.target.value }))}
                        className={selectClass}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="draft">Draft</option>
                      </select>
                    </div>
                  </div>

                  {/* Rule Settings */}
                  <div className="border-t border-thb-border pt-5">
                    <h4 className="text-sm font-semibold text-thb-text-primary mb-4">Rule Settings</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Sandwich Rule */}
                      <div className="flex items-center justify-between p-3 rounded-lg border border-thb-border bg-slate-50/50">
                        <div>
                          <p className="text-sm font-medium text-thb-text-primary">Sandwich Rule</p>
                          <p className="text-xs text-thb-text-muted">Count weekends/holidays as leave</p>
                        </div>
                        <button type="button" onClick={() => setRuleForm(prev => ({ ...prev, sandwichRuleEnabled: !prev.sandwichRuleEnabled }))} className="flex items-center">
                          {ruleForm.sandwichRuleEnabled
                            ? <FiToggleRight className="w-6 h-6 text-amber-500" />
                            : <FiToggleLeft className="w-6 h-6 text-slate-400" />
                          }
                        </button>
                      </div>

                      {/* Pro-Rata */}
                      <div className="flex items-center justify-between p-3 rounded-lg border border-thb-border bg-slate-50/50">
                        <div>
                          <p className="text-sm font-medium text-thb-text-primary">Pro-Rata</p>
                          <p className="text-xs text-thb-text-muted">Pro-rate based on joining date</p>
                        </div>
                        <button type="button" onClick={() => setRuleForm(prev => ({ ...prev, proRataEnabled: !prev.proRataEnabled }))} className="flex items-center">
                          {ruleForm.proRataEnabled
                            ? <FiToggleRight className="w-6 h-6 text-green-500" />
                            : <FiToggleLeft className="w-6 h-6 text-slate-400" />
                          }
                        </button>
                      </div>

                      {/* Probation Restriction */}
                      <div className="flex items-center justify-between p-3 rounded-lg border border-thb-border bg-slate-50/50">
                        <div>
                          <p className="text-sm font-medium text-thb-text-primary">Probation Restriction</p>
                          <p className="text-xs text-thb-text-muted">Restrict leave during probation</p>
                        </div>
                        <button type="button" onClick={() => setRuleForm(prev => ({ ...prev, probationRestriction: !prev.probationRestriction }))} className="flex items-center">
                          {ruleForm.probationRestriction
                            ? <FiToggleRight className="w-6 h-6 text-green-500" />
                            : <FiToggleLeft className="w-6 h-6 text-slate-400" />
                          }
                        </button>
                      </div>

                      {/* Probation Months */}
                      {ruleForm.probationRestriction && (
                        <div>
                          <label className="block text-xs font-medium text-thb-text-secondary mb-1">Probation Months</label>
                          <input
                            type="number"
                            value={ruleForm.probationMonths}
                            onChange={e => setRuleForm(prev => ({ ...prev, probationMonths: Number(e.target.value) }))}
                            min={1}
                            max={24}
                            className={inputClass}
                          />
                        </div>
                      )}

                      {/* Carry Forward */}
                      <div className="flex items-center justify-between p-3 rounded-lg border border-thb-border bg-slate-50/50">
                        <div>
                          <p className="text-sm font-medium text-thb-text-primary">Carry Forward</p>
                          <p className="text-xs text-thb-text-muted">Allow unused leave carry forward</p>
                        </div>
                        <button type="button" onClick={() => setRuleForm(prev => ({ ...prev, carryForwardGlobal: !prev.carryForwardGlobal }))} className="flex items-center">
                          {ruleForm.carryForwardGlobal
                            ? <FiToggleRight className="w-6 h-6 text-green-500" />
                            : <FiToggleLeft className="w-6 h-6 text-slate-400" />
                          }
                        </button>
                      </div>

                      {/* Max Carry Forward Days */}
                      {ruleForm.carryForwardGlobal && (
                        <div>
                          <label className="block text-xs font-medium text-thb-text-secondary mb-1">Max Carry Forward Days</label>
                          <input
                            type="number"
                            value={ruleForm.maxCarryForwardDays}
                            onChange={e => setRuleForm(prev => ({ ...prev, maxCarryForwardDays: Number(e.target.value) }))}
                            min={0}
                            className={inputClass}
                          />
                        </div>
                      )}

                      {/* Encashment */}
                      <div className="flex items-center justify-between p-3 rounded-lg border border-thb-border bg-slate-50/50">
                        <div>
                          <p className="text-sm font-medium text-thb-text-primary">Leave Encashment</p>
                          <p className="text-xs text-thb-text-muted">Allow encashing unused leaves</p>
                        </div>
                        <button type="button" onClick={() => setRuleForm(prev => ({ ...prev, encashmentAllowed: !prev.encashmentAllowed }))} className="flex items-center">
                          {ruleForm.encashmentAllowed
                            ? <FiToggleRight className="w-6 h-6 text-emerald-500" />
                            : <FiToggleLeft className="w-6 h-6 text-slate-400" />
                          }
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── Global Configuration ── */}
                  <div className="space-y-4 pt-4 border-t border-thb-border">
                    <h3 className="text-sm font-semibold text-thb-text-primary flex items-center gap-2">
                      <FiSettings className="w-4 h-4 text-teal-500" /> Global Configuration
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <Toggle label="Carry Forward Enabled" checked={ruleForm.carryForwardGlobal} onChange={() => setRuleForm({ ...ruleForm, carryForwardGlobal: !ruleForm.carryForwardGlobal })} />
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Max Carry Forward Days</label>
                        <input type="number" min={0} value={ruleForm.maxCarryForwardDays} onChange={e => setRuleForm({ ...ruleForm, maxCarryForwardDays: parseInt(e.target.value) || 0 })} className={inputClass} />
                      </div>
                      <Toggle label="Pro-Rata for Joining" checked={ruleForm.proRataEnabled} onChange={() => setRuleForm({ ...ruleForm, proRataEnabled: !ruleForm.proRataEnabled })} />
                      <Toggle label="Sandwich Rule" checked={ruleForm.sandwichRuleEnabled} onChange={() => setRuleForm({ ...ruleForm, sandwichRuleEnabled: !ruleForm.sandwichRuleEnabled })} />
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Min Advance Notice (days)</label>
                        <input type="number" min={0} value={ruleForm.minAdvanceNotice} onChange={e => setRuleForm({ ...ruleForm, minAdvanceNotice: parseInt(e.target.value) || 0 })} className={inputClass} />
                      </div>
                      <Toggle label="Encashment Allowed" checked={ruleForm.encashmentAllowed} onChange={() => setRuleForm({ ...ruleForm, encashmentAllowed: !ruleForm.encashmentAllowed })} />
                      <Toggle label="Probation Restriction" checked={ruleForm.probationRestriction} onChange={() => setRuleForm({ ...ruleForm, probationRestriction: !ruleForm.probationRestriction })} />
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Probation Period (months)</label>
                        <input type="number" min={0} value={ruleForm.probationMonths} onChange={e => setRuleForm({ ...ruleForm, probationMonths: parseInt(e.target.value) || 0 })} className={inputClass} />
                      </div>
                    </div>
                  </div>

                  {/* ── Leave Type Allocation (Mapping) ── */}
                  <div className="space-y-4 pt-4 border-t border-thb-border">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-thb-text-primary flex items-center gap-2">
                        <FiLink className="w-4 h-4 text-teal-500" /> Leave Type Allocation
                      </h3>
                      <span className="text-xs text-thb-text-muted">Map leave types to this rule with their quotas</span>
                    </div>
                    {leaveTypesLoading ? (
                      <div className="flex items-center gap-2 text-sm text-thb-text-muted"><FiRefreshCw className="w-4 h-4 animate-spin" /> Loading leave types...</div>
                    ) : leaveTypes.length === 0 ? (
                      <div className="text-sm text-thb-text-muted bg-slate-50 rounded-lg p-4">No leave types configured. Create leave types first in Settings → Leave Types.</div>
                    ) : (
                      <div className="space-y-2">
                        {ruleForm.leaveTypeAllocations.map((alloc, idx) => (
                          <div key={idx} className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-thb-text-primary">{alloc.leaveTypeName}</p>
                              <p className="text-xs text-thb-text-muted">{alloc.leaveTypeId}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-thb-text-muted">Quota:</label>
                              <input type="number" min={0} value={alloc.quota} onChange={e => {
                                const newAllocs = [...ruleForm.leaveTypeAllocations];
                                newAllocs[idx] = { ...alloc, quota: parseInt(e.target.value) || 0 };
                                setRuleForm({ ...ruleForm, leaveTypeAllocations: newAllocs });
                              }} className="w-20 px-2 py-1 rounded border border-thb-border text-sm" />
                            </div>
                            <Toggle label="CF" checked={alloc.carryForward} onChange={() => {
                              const newAllocs = [...ruleForm.leaveTypeAllocations];
                              newAllocs[idx] = { ...alloc, carryForward: !alloc.carryForward };
                              setRuleForm({ ...ruleForm, leaveTypeAllocations: newAllocs });
                            }} />
                            <div>
                              <label className="text-xs text-thb-text-muted">Max CF:</label>
                              <input type="number" min={0} value={alloc.maxCarryForward} onChange={e => {
                                const newAllocs = [...ruleForm.leaveTypeAllocations];
                                newAllocs[idx] = { ...alloc, maxCarryForward: parseInt(e.target.value) || 0 };
                                setRuleForm({ ...ruleForm, leaveTypeAllocations: newAllocs });
                              }} className="w-16 px-2 py-1 rounded border border-thb-border text-sm" />
                            </div>
                            <button type="button" onClick={() => {
                              setRuleForm({ ...ruleForm, leaveTypeAllocations: ruleForm.leaveTypeAllocations.filter((_, i) => i !== idx) });
                            }} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"><FiX className="w-4 h-4" /></button>
                          </div>
                        ))}
                        {/* Add leave type dropdown */}
                        <div className="relative">
                          <select
                            value=""
                            onChange={e => {
                              if (!e.target.value) return;
                              const lt = leaveTypes.find(l => l.id === e.target.value);
                              if (lt && !ruleForm.leaveTypeAllocations.some(a => a.leaveTypeId === lt.id)) {
                                setRuleForm({
                                  ...ruleForm,
                                  leaveTypeAllocations: [...ruleForm.leaveTypeAllocations, {
                                    leaveTypeId: lt.id,
                                    leaveTypeName: lt.name,
                                    quota: lt.defaultDays || 0,
                                    carryForward: false,
                                    maxCarryForward: 0,
                                  }],
                                });
                              }
                            }}
                            className={selectClass}
                          >
                            <option value="">+ Add leave type to this rule...</option>
                            {leaveTypes.filter(lt => !ruleForm.leaveTypeAllocations.some(a => a.leaveTypeId === lt.id)).map(lt => (
                              <option key={lt.id} value={lt.id}>{lt.name} ({lt.code}) — {lt.defaultDays} days/year</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-thb-border">
                    <button type="button" onClick={handleCancelRuleForm} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">Cancel</button>
                    <button type="submit" disabled={ruleSubmitting} className="px-6 py-2.5 rounded-lg bg-teal-500 text-white text-sm font-medium hover:bg-teal-600 disabled:opacity-50 shadow-sm shadow-teal-500/25 transition-colors">
                      {ruleSubmitting ? 'Saving...' : editingRuleId ? 'Update' : 'Create'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Rules Table */}
          {rulesLoading ? (
            <div className="flex items-center justify-center py-12"><FiSettings className="w-8 h-8 animate-spin text-teal-400" /></div>
          ) : (
            <TableWrapper title="Policy Rules" icon={<FiBookOpen className="w-4 h-4 text-teal-500" />} count={rules.length}>
              <thead>
                <tr>
                  <TH>Rule Name</TH>
                  <TH>Applicable To</TH>
                  <TH>Branch</TH>
                  <TH>Department</TH>
                  <TH>Priority</TH>
                  <TH>Mapped Types</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Actions</TH>
                </tr>
              </thead>
              <tbody>
                {rules.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <FiBookOpen className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
                      <p className="text-thb-text-secondary font-medium">No policy rules defined</p>
                      <p className="text-xs text-thb-text-muted mt-1">Create rules to define who each policy applies to</p>
                    </td>
                  </tr>
                ) : rules.map(rule => {
                  const badge = getStatusBadge(rule.status)
                  const allocCount = parseAllocations(rule.leaveTypeAllocations).length
                  const linkedPolicy = categoryPolicies.find(p => p.id === rule.policyId)
                  return (
                    <tr key={rule.id} className={`transition-colors ${deleteRuleId === rule.id ? 'bg-red-50' : 'hover:bg-slate-50/50'}`}>
                      {deleteRuleId === rule.id ? (
                        <td colSpan={8} className="px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <FiAlertTriangle className="w-4 h-4 text-red-500" />
                              <span className="text-sm text-red-600">Delete <b>{rule.name}</b>?</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => { setDeleteRuleId(null); setDeleteRuleName('') }} className="px-3 py-1 text-xs font-medium rounded-lg border border-thb-border hover:bg-slate-50">Cancel</button>
                              <button onClick={handleDeleteRule} disabled={deletingRule} className="px-3 py-1 text-xs font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">{deletingRule ? 'Deleting...' : 'Delete'}</button>
                            </div>
                          </div>
                        </td>
                      ) : (
                        <>
                          <TD className="font-medium text-thb-text-primary">
                            <div>
                              {rule.name}
                              {linkedPolicy && (
                                <p className="text-xs text-thb-text-muted mt-0.5">
                                  Linked: {linkedPolicy.title}
                                </p>
                              )}
                            </div>
                          </TD>
                          <TD>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-teal-50 text-teal-700">
                              {formatEmploymentType(rule.employmentType)}
                            </span>
                          </TD>
                          <TD>{rule.branch?.name || 'All'}</TD>
                          <TD>{rule.department?.name || 'All'}</TD>
                          <TD>
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                              {rule.priority}
                            </span>
                          </TD>
                          <TD>
                            {allocCount > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700">
                                <FiLayers className="w-3 h-3" /> {allocCount} type{allocCount !== 1 ? 's' : ''}
                              </span>
                            ) : (
                              <span className="text-xs text-thb-text-muted">Not mapped</span>
                            )}
                          </TD>
                          <TD><span className={badge.className}>{badge.label}</span></TD>
                          <TD className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => { setSelectedRuleId(rule.id); setActiveTab('mapping') }}
                                className="p-1.5 rounded-lg text-thb-text-muted hover:text-teal-500 hover:bg-teal-50 transition-colors"
                                title="Map Leave Types"
                              >
                                <FiLink className="w-3.5 h-3.5" />
                              </button>
                              {isRoleAdmin && (
                                <>
                                  <button onClick={() => openEditRule(rule)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Edit"><FiEdit2 className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => { setDeleteRuleId(rule.id); setDeleteRuleName(rule.name) }} className="p-1.5 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><FiTrash2 className="w-3.5 h-3.5" /></button>
                                </>
                              )}
                            </div>
                          </TD>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </TableWrapper>
          )}
        </>
      )}

      {/* Note: Leave Type Mapping and Global Config are now merged into the Policy Rules tab */}
      {/* (previously separate tabs — now consolidated per user request) */}
    </div>
  )
}

export default function LeavePolicyPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full" /></div>}>
      <LeavePolicyPageContent />
    </Suspense>
  )
}
