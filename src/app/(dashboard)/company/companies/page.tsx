'use client'

import { useState, useEffect } from 'react'
import { FiHome, FiPlus, FiSearch, FiEye, FiEdit2, FiTrash2, FiX, FiLayers, FiInfo, FiAlertTriangle, FiCheckCircle, FiSettings, FiBriefcase, FiAlertCircle } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { useCompanyData, apiFetch, fmtSalary, fmtDate, fmtDay, fmtTime, gradeCode, gradeName, getStatusBadge } from '@/components/company/useCompanyData'
import { CompanyRecord } from '@/components/company/useCompanyData'
import { validatePhone, validateEmail, validateWebsite, phoneInputFilter, onlyDigits } from '@/lib/validators'
import { useCompanyContextStore } from '@/store/companyContextStore'
import { useAuthStore } from '@/store/authStore'

export default function CompaniesPage() {
  const { companies, branches, departments, loading, isAdmin, isSuperAdmin, isTenantAdmin, fetchCompanies } = useCompanyData()
  const { user } = useAuthStore()
  const { availableCompanyGroups, hydrated: ctxHydrated, hydrate } = useCompanyContextStore()

  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [viewingRecord, setViewingRecord] = useState<CompanyRecord | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleteName, setDeleteName] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const inputClass = 'w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400'
  const q = search.toLowerCase()
  const fCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(q) || (c.code || '').toLowerCase().includes(q) || (c.city || '').toLowerCase().includes(q)
  )

  const getDefaultForm = (): Record<string, string> => ({
    name: '', code: '', companyGroupId: '', country: 'India', currency: 'INR', timezone: 'Asia/Kolkata',
    city: '', state: '', address: '', zipCode: '', phone: '', email: '', website: '', taxId: '', status: 'active'
  })

  const getFormFromRecord = (r: CompanyRecord): Record<string, string> => {
    const f = getDefaultForm()
    Object.keys(f).forEach(k => { if ((r as Record<string, unknown>)[k] !== undefined && (r as Record<string, unknown>)[k] !== null) f[k] = String((r as Record<string, unknown>)[k]) })
    return f
  }

  const openAdd = () => {
    setEditingId(null)
    setForm(getDefaultForm())
    setShowForm(true)
    setViewingRecord(null)
    setDeleteConfirmId(null)
  }

  const openEdit = (r: CompanyRecord) => {
    setEditingId(r.id)
    setForm(getFormFromRecord(r))
    setShowForm(true)
    setViewingRecord(null)
    setDeleteConfirmId(null)
  }

  const openView = (r: CompanyRecord) => {
    setViewingRecord(r)
    setShowForm(false)
    setDeleteConfirmId(null)
  }

  const handleCancelForm = () => { setShowForm(false); setEditingId(null); setForm({}) }

  // Hydrate company context to get available groups
  useEffect(() => {
    if (!ctxHydrated) hydrate();
  }, [ctxHydrated, hydrate]);

  // BUG FIX: Auto-select the group company when only one exists.
  // Prevents UX issue where user fills form but forgets to select the only group.
  useEffect(() => {
    if (showForm && !editingId && !form.companyGroupId && availableCompanyGroups.length === 1) {
      setForm(prev => ({ ...prev, companyGroupId: availableCompanyGroups[0].id }));
    }
  }, [showForm, editingId, form.companyGroupId, availableCompanyGroups]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    // Phone validation
    if (form.phone) {
      const phoneResult = validatePhone(form.phone)
      if (!phoneResult.valid) { toast.error(phoneResult.error || 'Invalid phone number'); return }
    }

    // Email validation
    if (form.email) {
      const emailResult = validateEmail(form.email)
      if (!emailResult.valid) { toast.error(emailResult.error || 'Invalid email'); return }
    }

    // Website validation
    if (form.website) {
      const websiteResult = validateWebsite(form.website)
      if (!websiteResult.valid) { toast.error(websiteResult.error || 'Invalid website URL'); return }
    }

    // Group company required for tenant_admin (only super_admin can auto-create groups)
    if (!isSuperAdmin && !form.companyGroupId) {
      toast.error(
        availableCompanyGroups.length === 0
          ? 'No group companies exist under your tenant yet. Please ask your super admin to create one first.'
          : 'Please select a group company from the dropdown. Only super admins can create new group companies — if no group is available, ask your super admin to create one under your tenant.'
      );
      return;
    }

    // Duplicate name/code check
    const isEdit = !!editingId
    const duplicateName = companies.find(c => c.name.toLowerCase() === form.name.toLowerCase() && c.id !== editingId)
    if (duplicateName) { toast.error('A company with this name already exists'); return }
    if (form.code) {
      const duplicateCode = companies.find(c => (c.code || '').toLowerCase() === form.code.toLowerCase() && c.id !== editingId)
      if (duplicateCode) { toast.error('A company with this code already exists'); return }
    }

    setSubmitting(true)
    try {
      const url = '/api/companies'
      const method = isEdit ? 'PUT' : 'POST'
      const body: Record<string, unknown> = { ...form }
      if (isEdit) body.id = editingId
      // Ensure companyGroupId is sent as a proper value (not empty string)
      // BUG FIX: Only delete companyGroupId if it's truly empty/falsy AND
      // the user is super_admin (who can auto-create groups). For tenant_admin,
      // the check above guarantees companyGroupId is set, so we keep it.
      if (!body.companyGroupId && isSuperAdmin) delete body.companyGroupId
      await apiFetch(url, { method, body: JSON.stringify(body) })
      toast.success(`Company ${isEdit ? 'updated' : 'created'} successfully`)
      handleCancelForm()
      fetchCompanies()
      // Refresh context so new company appears in the switcher
      hydrate(true)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Operation failed')
    } finally { setSubmitting(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await apiFetch(`/api/companies?id=${deleteConfirmId}`, { method: 'DELETE' })
      toast.success('Deleted successfully')
      fetchCompanies()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
      setDeleteConfirmId(null)
      setDeleteName('')
    }
  }

  const updateForm = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-md">
            <FiHome className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">Companies</h1>
            <p className="text-sm text-thb-text-secondary">Manage your organization&apos;s company profiles</p>
          </div>
        </div>
        {isAdmin && (
          <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-medium text-sm shadow-sm shadow-teal-500/25 transition-colors">
            <FiPlus className="w-4 h-4" /> Add Company
          </button>
        )}
      </div>

      {/* Info banner */}
      <div className="thb-card border-l-4 border-l-green-500 bg-gradient-to-r from-green-50/60 to-emerald-50/40">
        <div className="p-4 flex items-start gap-3">
          <FiInfo className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-700 flex-1">
            <p className="font-semibold text-slate-900 mb-0.5">Companies are managed by admins</p>
            <p className="text-xs text-slate-600">
              New companies can only be created from the <b>Super Admin</b> or <b>Tenant Admin</b> modules,
              where the proper group-company parent and tenant-level company quota are enforced. Use this
              page to view existing companies and manage their organizational structure.
            </p>
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
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600 ring-1 ring-green-100"><FiLayers className="w-5 h-5" /></div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-5">
          <div className="flex items-start justify-between">
            <div><p className="text-xs font-medium text-thb-text-secondary">Total Departments</p><p className="text-2xl font-bold text-teal-600 mt-1">{departments.length}</p></div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 ring-1 ring-emerald-100"><FiBriefcase className="w-5 h-5" /></div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, code, city..." className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-thb-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400" />
      </div>

      {/* View Detail */}
      {viewingRecord && (
        <div className="thb-card border-l-4 border-l-teal-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2"><FiEye className="w-5 h-5 text-teal-500" /> Company Details</h2>
              <button onClick={() => setViewingRecord(null)} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                ['Name', viewingRecord.name], ['Code', viewingRecord.code], ['Status', viewingRecord.status],
                ['Parent Group Company', viewingRecord.companyGroup?.name || '—'],
                ...(isSuperAdmin ? [['Parent Tenant', viewingRecord.companyGroup?.tenant?.name || '—'] as const] : []),
                ['City', viewingRecord.city], ['State', viewingRecord.state], ['Country', viewingRecord.country],
                ['Currency', viewingRecord.currency], ['Phone', viewingRecord.phone], ['Email', viewingRecord.email],
                ['Website', viewingRecord.website], ['Tax ID / GST', viewingRecord.taxId], ['Address', viewingRecord.address],
                ['ZIP Code', viewingRecord.zipCode],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <p className="text-xs font-medium text-thb-text-muted mb-1">{label}</p>
                  <p className="text-sm font-medium text-thb-text-primary">{value || '—'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Inline Add/Edit Form */}
      {showForm && (
        <div className="thb-card border-l-4 border-l-teal-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">{editingId ? 'Edit' : 'Add'} Company</h2>
              <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Name *</label><input type="text" value={form.name || ''} onChange={e => updateForm('name', e.target.value)} required className={inputClass} placeholder="Company name" /></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Code</label><input type="text" value={form.code || ''} onChange={e => updateForm('code', e.target.value)} className={inputClass} placeholder="e.g. 3BOXES" /></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Currency</label><select value={form.currency || 'INR'} onChange={e => updateForm('currency', e.target.value)} className={inputClass}><option value="INR">INR (₹)</option><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option></select></div>
              </div>
              {/* Group Company selector — required for tenant_admin */}
              {!isSuperAdmin && (
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Group Company *</label>
                  {availableCompanyGroups.length === 0 ? (
                    <div className="px-3 py-2.5 rounded-lg border border-amber-200 bg-amber-50 flex items-start gap-2 text-xs text-amber-900">
                      <FiAlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold mb-0.5">No group companies available</p>
                        <p>Only your <b>super admin</b> can create group companies. Please ask them to create at least one group under your tenant first.</p>
                      </div>
                    </div>
                  ) : (
                    <select value={form.companyGroupId || ''} onChange={e => updateForm('companyGroupId', e.target.value)} className={inputClass} required={!isSuperAdmin}>
                      <option value="">— Select a group company —</option>
                      {availableCompanyGroups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">City</label><input type="text" value={form.city || ''} onChange={e => updateForm('city', e.target.value)} className={inputClass} /></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">State</label><input type="text" value={form.state || ''} onChange={e => updateForm('state', e.target.value)} className={inputClass} /></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Country</label><input type="text" value={form.country || ''} onChange={e => updateForm('country', e.target.value)} className={inputClass} /></div>
                <div className="sm:col-span-2 lg:col-span-3"><label className="block text-xs font-medium text-thb-text-secondary mb-1">Address</label><input type="text" value={form.address || ''} onChange={e => updateForm('address', e.target.value)} className={inputClass} /></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Phone</label><input type="tel" value={form.phone || ''} onChange={e => updateForm('phone', phoneInputFilter(e.target.value))} placeholder="10-digit mobile" className={inputClass} /></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Email</label><input type="email" value={form.email || ''} onChange={e => updateForm('email', e.target.value)} placeholder="info@company.com" className={inputClass} /></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Website</label><input type="url" value={form.website || ''} onChange={e => updateForm('website', e.target.value)} className={inputClass} /></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Tax ID / GST</label><input type="text" value={form.taxId || ''} onChange={e => updateForm('taxId', e.target.value)} className={inputClass} /></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">ZIP Code</label><input type="text" value={form.zipCode || ''} onChange={e => updateForm('zipCode', e.target.value)} className={inputClass} /></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Status</label><select value={form.status || 'active'} onChange={e => updateForm('status', e.target.value)} className={inputClass}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
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

      {/* Company Cards Grid */}
      {loading.companies ? (
        <div className="flex items-center justify-center py-12"><FiSettings className="w-8 h-8 animate-spin text-teal-400" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {fCompanies.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <FiHome className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
              <p className="text-thb-text-secondary font-medium">No companies found</p>
              <p className="text-xs text-thb-text-muted mt-1 max-w-sm mx-auto">No companies have been created yet. Ask your admin to create one.</p>
            </div>
          ) : fCompanies.map(c => {
            const badge = getStatusBadge(c.status)
            const groupName = c.companyGroup?.name
            const tenantName = c.companyGroup?.tenant?.name
            return (
              <div key={c.id} className={`thb-card thb-card-hover transition-colors ${deleteConfirmId === c.id ? 'bg-red-50 border-l-4 border-l-red-500' : ''}`}>
                <div className="p-5">
                  {deleteConfirmId === c.id ? (
                    <div className="flex items-center justify-between gap-3 p-3">
                      <div className="flex items-center gap-2">
                        <FiAlertTriangle className="w-4 h-4 text-red-500" />
                        <span className="text-sm text-red-600">Delete <b>{c.name}</b>?</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setDeleteConfirmId(null); setDeleteName('') }} className="px-3 py-1 text-xs font-medium rounded-lg border border-thb-border hover:bg-slate-50">Cancel</button>
                        <button onClick={handleDelete} disabled={deleting} className="px-3 py-1 text-xs font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">
                          {deleting ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center"><FiHome className="w-5 h-5 text-teal-500" /></div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openView(c)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-teal-500 hover:bg-teal-50 transition-colors" title="View"><FiEye className="w-3.5 h-3.5" /></button>
                          {isAdmin && (
                            <>
                              <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Edit"><FiEdit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => { setDeleteConfirmId(c.id); setDeleteName(c.name) }} className="p-1.5 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><FiTrash2 className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                        </div>
                      </div>
                      <h3 className="text-thb-text-primary font-semibold text-lg">{c.name}</h3>
                      <p className="text-thb-text-muted text-sm mb-1">{c.code || '—'} · {c.city || '—'}, {c.state || ''}</p>
                      <p className="text-thb-text-muted text-xs mb-2">{c.taxId ? `GST: ${c.taxId}` : ''} {c.phone ? `· ${c.phone}` : ''}</p>
                      {(groupName || tenantName) && (
                        <div className="flex items-center gap-1.5 flex-wrap mb-3 text-[10px]">
                          {groupName && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 font-semibold" title="Parent group company">
                              <FiLayers className="w-2.5 h-2.5" />{groupName}
                            </span>
                          )}
                          {isSuperAdmin && tenantName && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold" title="Parent tenant">
                              <FiHome className="w-2.5 h-2.5" />{tenantName}
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
      )}
    </div>
  )
}
