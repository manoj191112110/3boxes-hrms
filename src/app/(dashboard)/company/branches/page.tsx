'use client'

import { useState } from 'react'
import { FiMapPin, FiPlus, FiSearch, FiEye, FiEdit2, FiTrash2, FiX, FiInfo, FiAlertTriangle, FiSettings } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { useCompanyData, apiFetch, getStatusBadge } from '@/components/company/useCompanyData'
import { BranchRecord } from '@/components/company/useCompanyData'
import { validatePhone, validateEmail, phoneInputFilter } from '@/lib/validators'

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

export default function BranchesPage() {
  const { companies, branches, loading, isAdmin, fetchBranches, selectedCompanyId } = useCompanyData()

  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [viewingRecord, setViewingRecord] = useState<BranchRecord | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleteName, setDeleteName] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const inputClass = 'w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400'
  const q = search.toLowerCase()
  const fBranches = branches.filter(b =>
    b.name.toLowerCase().includes(q) || (b.city || '').toLowerCase().includes(q) || (b.address || '').toLowerCase().includes(q)
  )

  const getDefaultForm = (): Record<string, string> => ({
    name: '', code: '', companyId: companies[0]?.id || '', country: 'India', state: '', city: '', address: '', zipCode: '', phone: '', email: '', status: 'active'
  })

  const getFormFromRecord = (r: BranchRecord): Record<string, string> => {
    const f = getDefaultForm()
    Object.keys(f).forEach(k => { if ((r as Record<string, unknown>)[k] !== undefined && (r as Record<string, unknown>)[k] !== null) f[k] = String((r as Record<string, unknown>)[k]) })
    return f
  }

  const openAdd = () => { setEditingId(null); setForm(getDefaultForm()); setShowForm(true); setViewingRecord(null); setDeleteConfirmId(null) }
  const openEdit = (r: BranchRecord) => { setEditingId(r.id); setForm(getFormFromRecord(r)); setShowForm(true); setViewingRecord(null); setDeleteConfirmId(null) }
  const openView = (r: BranchRecord) => { setViewingRecord(r); setShowForm(false); setDeleteConfirmId(null) }
  const handleCancelForm = () => { setShowForm(false); setEditingId(null); setForm({}) }

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

    // Duplicate name/code check within same company
    const isEdit = !!editingId
    if (form.companyId) {
      const duplicateName = branches.find(b => b.name.toLowerCase() === form.name.toLowerCase() && b.companyId === form.companyId && b.id !== editingId)
      if (duplicateName) { toast.error('A branch with this name already exists for this company'); return }
      if (form.code) {
        const duplicateCode = branches.find(b => (b.code || '').toLowerCase() === form.code.toLowerCase() && b.companyId === form.companyId && b.id !== editingId)
        if (duplicateCode) { toast.error('A branch with this code already exists for this company'); return }
      }
    }

    setSubmitting(true)
    try {
      const body: Record<string, unknown> = { ...form }
      if (isEdit) body.id = editingId
      const cidParam = selectedCompanyId ? `?companyId=${selectedCompanyId}` : ''
      await apiFetch(`/api/branches${cidParam}`, { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(body) })
      toast.success(`Branch ${isEdit ? 'updated' : 'created'} successfully`)
      handleCancelForm()
      fetchBranches()
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Operation failed') }
    finally { setSubmitting(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const cidParam = selectedCompanyId ? `&companyId=${selectedCompanyId}` : ''
      await apiFetch(`/api/branches?id=${deleteConfirmId}${cidParam}`, { method: 'DELETE' })
      toast.success('Deleted successfully')
      fetchBranches()
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Delete failed') }
    finally { setDeleting(false); setDeleteConfirmId(null); setDeleteName('') }
  }

  const updateForm = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-cyan-600 flex items-center justify-center shadow-md">
            <FiMapPin className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">Branches</h1>
            <p className="text-sm text-thb-text-secondary">Manage office locations and branches</p>
          </div>
        </div>
        {isAdmin && (
          <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-medium text-sm shadow-sm shadow-teal-500/25 transition-colors">
            <FiPlus className="w-4 h-4" /> Add Branch
          </button>
        )}
      </div>

      {/* Info banner when no companies */}
      {companies.length === 0 && (
        <div className="thb-card border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50/60 to-orange-50/40">
          <div className="p-4 flex items-start gap-3">
            <FiInfo className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-slate-700">
              <p className="font-semibold text-slate-900 mb-0.5">No companies inducted yet</p>
              <p className="text-xs text-slate-600">
                The <b>Company</b> dropdown on the create-branch form is empty because there are no companies
                in your tenant yet. Please ask your <b>Tenant Admin</b> to induct at least one company first.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, city, address..." className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-thb-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400" />
      </div>

      {/* View Detail */}
      {viewingRecord && (
        <div className="thb-card border-l-4 border-l-teal-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2"><FiEye className="w-5 h-5 text-teal-500" /> Branch Details</h2>
              <button onClick={() => setViewingRecord(null)} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                ['Name', viewingRecord.name], ['Code', viewingRecord.code], ['Status', viewingRecord.status],
                ['Company', viewingRecord.company?.name], ['City', viewingRecord.city], ['State', viewingRecord.state],
                ['Country', viewingRecord.country], ['Phone', viewingRecord.phone], ['Email', viewingRecord.email],
                ['Address', viewingRecord.address], ['Employees', viewingRecord._count?.employees],
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

      {/* Inline Form */}
      {showForm && (
        <div className="thb-card border-l-4 border-l-teal-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">{editingId ? 'Edit' : 'Add'} Branch</h2>
              <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Name *</label><input type="text" value={form.name || ''} onChange={e => updateForm('name', e.target.value)} required className={inputClass} placeholder="Branch name" /></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Code</label><input type="text" value={form.code || ''} onChange={e => updateForm('code', e.target.value)} className={inputClass} placeholder="e.g. MUM" /></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Company *</label><select value={form.companyId || ''} onChange={e => updateForm('companyId', e.target.value)} required className={inputClass}><option value="">Select Company</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">City</label><input type="text" value={form.city || ''} onChange={e => updateForm('city', e.target.value)} className={inputClass} /></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">State</label><input type="text" value={form.state || ''} onChange={e => updateForm('state', e.target.value)} className={inputClass} /></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Country</label><input type="text" value={form.country || ''} onChange={e => updateForm('country', e.target.value)} className={inputClass} /></div>
                <div className="sm:col-span-2 lg:col-span-3"><label className="block text-xs font-medium text-thb-text-secondary mb-1">Address</label><input type="text" value={form.address || ''} onChange={e => updateForm('address', e.target.value)} className={inputClass} /></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Phone</label><input type="tel" value={form.phone || ''} onChange={e => updateForm('phone', phoneInputFilter(e.target.value))} placeholder="10-digit mobile" className={inputClass} /></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Email</label><input type="email" value={form.email || ''} onChange={e => updateForm('email', e.target.value)} placeholder="branch@company.com" className={inputClass} /></div>
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

      {/* Table */}
      {loading.branches ? (
        <div className="flex items-center justify-center py-12"><FiSettings className="w-8 h-8 animate-spin text-teal-400" /></div>
      ) : (
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
                    <td colSpan={5} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2"><FiAlertTriangle className="w-4 h-4 text-red-500" /><span className="text-sm text-red-600">Delete <b>{b.name}</b>?</span></div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setDeleteConfirmId(null); setDeleteName('') }} className="px-3 py-1 text-xs font-medium rounded-lg border border-thb-border hover:bg-slate-50">Cancel</button>
                          <button onClick={handleDelete} disabled={deleting} className="px-3 py-1 text-xs font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete'}</button>
                        </div>
                      </div>
                    </td>
                  ) : (
                    <>
                      <TD className="font-medium text-thb-text-primary"><FiMapPin className="w-4 h-4 inline mr-2 text-teal-400" />{b.name}</TD>
                      <TD>{b.company?.name || '—'}</TD>
                      <TD>{b.city || '—'}, {b.state || ''}</TD>
                      <TD><span className={badge.className}>{badge.label}</span></TD>
                      <TD className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openView(b)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-teal-500 hover:bg-teal-50 transition-colors" title="View"><FiEye className="w-3.5 h-3.5" /></button>
                          {isAdmin && <>
                            <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Edit"><FiEdit2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => { setDeleteConfirmId(b.id); setDeleteName(b.name) }} className="p-1.5 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><FiTrash2 className="w-3.5 h-3.5" /></button>
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
    </div>
  )
}
