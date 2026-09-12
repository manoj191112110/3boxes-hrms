'use client'

import { useState } from 'react'
import { FiAward, FiPlus, FiSearch, FiEye, FiEdit2, FiTrash2, FiX, FiAlertTriangle, FiSettings } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { useCompanyData, apiFetch, fmtSalary, gradeCode, getStatusBadge } from '@/components/company/useCompanyData'
import { DesignationRecord } from '@/components/company/useCompanyData'

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

export default function DesignationsPage() {
  const { departments, designations, loading, isAdmin, fetchDesignations, selectedCompanyId } = useCompanyData()

  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [viewingRecord, setViewingRecord] = useState<DesignationRecord | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleteName, setDeleteName] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const inputClass = 'w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400'
  const q = search.toLowerCase()
  const fDesignations = designations.filter(d => d.title.toLowerCase().includes(q))

  const getDefaultForm = (): Record<string, string> => ({
    title: '', departmentId: departments[0]?.id || '', level: '1', minSalary: '', maxSalary: '', status: 'active'
  })

  const getFormFromRecord = (r: DesignationRecord): Record<string, string> => {
    const f = getDefaultForm()
    Object.keys(f).forEach(k => { if ((r as Record<string, unknown>)[k] !== undefined && (r as Record<string, unknown>)[k] !== null) f[k] = String((r as Record<string, unknown>)[k]) })
    return f
  }

  const openAdd = () => { setEditingId(null); setForm(getDefaultForm()); setShowForm(true); setViewingRecord(null); setDeleteConfirmId(null) }
  const openEdit = (r: DesignationRecord) => { setEditingId(r.id); setForm(getFormFromRecord(r)); setShowForm(true); setViewingRecord(null); setDeleteConfirmId(null) }
  const openView = (r: DesignationRecord) => { setViewingRecord(r); setShowForm(false); setDeleteConfirmId(null) }
  const handleCancelForm = () => { setShowForm(false); setEditingId(null); setForm({}) }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    // Salary validation: reject negative values and special characters
    if (form.minSalary) {
      const minVal = Number(form.minSalary)
      if (isNaN(minVal)) { toast.error('Min Salary must be a numeric value'); return }
      if (minVal < 0) { toast.error('Min Salary cannot be negative'); return }
    }
    if (form.maxSalary) {
      const maxVal = Number(form.maxSalary)
      if (isNaN(maxVal)) { toast.error('Max Salary must be a numeric value'); return }
      if (maxVal < 0) { toast.error('Max Salary cannot be negative'); return }
    }

    // Duplicate designation title check within same department
    const isEdit = !!editingId
    if (form.departmentId) {
      const duplicateTitle = designations.find(d => d.title.toLowerCase() === form.title.toLowerCase() && d.departmentId === form.departmentId && d.id !== editingId)
      if (duplicateTitle) { toast.error('A designation with this title already exists for this department'); return }
    }

    setSubmitting(true)
    try {
      // Build body with proper types for numeric fields (Prisma expects Int/Float, not strings)
      const body: Record<string, unknown> = {
        title: form.title,
        departmentId: form.departmentId,
        level: form.level ? Number(form.level) : 1,
        minSalary: form.minSalary ? Number(form.minSalary) : null,
        maxSalary: form.maxSalary ? Number(form.maxSalary) : null,
        status: form.status || 'active',
      }
      if (isEdit) body.id = editingId
      const cidParam = selectedCompanyId ? `?companyId=${selectedCompanyId}` : ''
      await apiFetch(`/api/designations${cidParam}`, { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(body) })
      toast.success(`Designation ${isEdit ? 'updated' : 'created'} successfully`)
      handleCancelForm()
      fetchDesignations()
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Operation failed') }
    finally { setSubmitting(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const cidParam = selectedCompanyId ? `&companyId=${selectedCompanyId}` : ''
      await apiFetch(`/api/designations?id=${deleteConfirmId}${cidParam}`, { method: 'DELETE' })
      toast.success('Deleted successfully')
      fetchDesignations()
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Delete failed') }
    finally { setDeleting(false); setDeleteConfirmId(null); setDeleteName('') }
  }

  const updateForm = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-md">
            <FiAward className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">Designations</h1>
            <p className="text-sm text-thb-text-secondary">Manage job titles, grades, and salary ranges</p>
          </div>
        </div>
        {isAdmin && (
          <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-medium text-sm shadow-sm shadow-teal-500/25 transition-colors">
            <FiPlus className="w-4 h-4" /> Add Designation
          </button>
        )}
      </div>

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
              <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2"><FiEye className="w-5 h-5 text-teal-500" /> Designation Details</h2>
              <button onClick={() => setViewingRecord(null)} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                ['Title', viewingRecord.title], ['Grade', gradeCode(viewingRecord.level)], ['Department', viewingRecord.department?.name],
                ['Min Salary', viewingRecord.minSalary ? fmtSalary(viewingRecord.minSalary) : '—'], ['Max Salary', viewingRecord.maxSalary ? fmtSalary(viewingRecord.maxSalary) : '—'], ['Level', viewingRecord.level],
                ['Status', viewingRecord.status],
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
              <h2 className="text-lg font-semibold text-thb-text-primary">{editingId ? 'Edit' : 'Add'} Designation</h2>
              <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Title <span className="text-red-500 font-bold">*</span></label><input type="text" value={form.title || ''} onChange={e => updateForm('title', e.target.value)} required className={inputClass} placeholder="Designation title" /></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Department <span className="text-red-500 font-bold">*</span></label><select value={form.departmentId || ''} onChange={e => updateForm('departmentId', e.target.value)} required className={inputClass}><option value="">Select Department</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Level</label><input type="number" value={form.level || '1'} onChange={e => updateForm('level', e.target.value)} className={inputClass} placeholder="1" /></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Min Salary (₹)</label><input type="number" min="0" step="1" value={form.minSalary || ''} onChange={e => updateForm('minSalary', e.target.value)} className={inputClass} placeholder="300000" /></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Max Salary (₹)</label><input type="number" min="0" step="1" value={form.maxSalary || ''} onChange={e => updateForm('maxSalary', e.target.value)} className={inputClass} placeholder="600000" /></div>
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
      {loading.designations ? (
        <div className="flex items-center justify-center py-12"><FiSettings className="w-8 h-8 animate-spin text-teal-400" /></div>
      ) : (
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
                    <td colSpan={6} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2"><FiAlertTriangle className="w-4 h-4 text-red-500" /><span className="text-sm text-red-600">Delete <b>{d.title}</b>?</span></div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setDeleteConfirmId(null); setDeleteName('') }} className="px-3 py-1 text-xs font-medium rounded-lg border border-thb-border hover:bg-slate-50">Cancel</button>
                          <button onClick={handleDelete} disabled={deleting} className="px-3 py-1 text-xs font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete'}</button>
                        </div>
                      </div>
                    </td>
                  ) : (
                    <>
                      <TD className="font-medium text-thb-text-primary">{d.title}</TD>
                      <TD><span className="thb-badge thb-badge-info">{gradeCode(d.level)}</span></TD>
                      <TD>{d.department?.name || '—'}</TD>
                      <TD className="text-emerald-600 font-medium">{fmtSalary(d.minSalary)} - {fmtSalary(d.maxSalary)}</TD>
                      <TD><span className={badge.className}>{badge.label}</span></TD>
                      <TD className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openView(d)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-teal-500 hover:bg-teal-50 transition-colors" title="View"><FiEye className="w-3.5 h-3.5" /></button>
                          {isAdmin && <>
                            <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Edit"><FiEdit2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => { setDeleteConfirmId(d.id); setDeleteName(d.title) }} className="p-1.5 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><FiTrash2 className="w-3.5 h-3.5" /></button>
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
