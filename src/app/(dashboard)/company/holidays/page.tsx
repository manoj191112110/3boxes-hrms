'use client'

import { useState } from 'react'
import { FiCalendar, FiPlus, FiSearch, FiEye, FiEdit2, FiTrash2, FiX, FiAlertTriangle, FiSettings } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { useCompanyData, apiFetch, fmtDate, fmtDay } from '@/components/company/useCompanyData'
import { HolidayRecord } from '@/components/company/useCompanyData'
import { useCompanyContextStore } from '@/store/companyContextStore'

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

const typeMap: Record<string, string> = {
  public: 'thb-badge thb-badge-warning',
  festival: 'thb-badge thb-badge-info',
  state: 'thb-badge thb-badge-success',
  company: 'bg-slate-100 text-slate-600 thb-badge',
  optional: 'thb-badge thb-badge-info',
}

export default function HolidaysPage() {
  const { holidays, loading, isAdmin, fetchHolidays } = useCompanyData()
  const companyId = useCompanyContextStore(s => s.effectiveCompanyId())
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery)
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId)
  void selectedTenantId; // ensures re-fetch when tenant changes (URL built via scopeQuery)

  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [viewingRecord, setViewingRecord] = useState<HolidayRecord | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleteName, setDeleteName] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const inputClass = 'w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400'
  const q = search.toLowerCase()
  const fHolidays = holidays.filter(h => h.name.toLowerCase().includes(q))

  const getDefaultForm = (): Record<string, string> => ({
    name: '', date: '', type: 'public', country: 'India', description: ''
  })

  const getFormFromRecord = (r: HolidayRecord): Record<string, string> => {
    const f = getDefaultForm()
    Object.keys(f).forEach(k => { if ((r as Record<string, unknown>)[k] !== undefined && (r as Record<string, unknown>)[k] !== null) f[k] = String((r as Record<string, unknown>)[k]) })
    return f
  }

  const openAdd = () => { setEditingId(null); setForm(getDefaultForm()); setShowForm(true); setViewingRecord(null); setDeleteConfirmId(null) }
  const openEdit = (r: HolidayRecord) => { setEditingId(r.id); setForm(getFormFromRecord(r)); setShowForm(true); setViewingRecord(null); setDeleteConfirmId(null) }
  const openView = (r: HolidayRecord) => { setViewingRecord(r); setShowForm(false); setDeleteConfirmId(null) }
  const handleCancelForm = () => { setShowForm(false); setEditingId(null); setForm({}) }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    // Validate required fields
    if (!form.name || !form.name.trim()) { toast.error('Holiday name is required'); return }
    if (!form.date) { toast.error('Holiday date is required'); return }

    // Duplicate holiday check (same name on same date)
    const duplicateHoliday = holidays.find(h =>
      h.name.toLowerCase() === form.name.toLowerCase() &&
      h.date === form.date &&
      h.id !== editingId
    )
    if (duplicateHoliday) { toast.error('A holiday with this name already exists for this date'); return }

    setSubmitting(true)
    try {
      const isEdit = !!editingId
      const body: Record<string, unknown> = { ...form, companyId }
      if (isEdit) body.id = editingId
      if (!companyId) { toast.error('Company ID is required'); setSubmitting(false); return }
      const sq = scopeQuery()
      const cidParam = sq ? `?${sq}` : ''
      await apiFetch(`/api/holidays${cidParam}`, { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(body) })
      toast.success(`Holiday ${isEdit ? 'updated' : 'created'} successfully`)
      handleCancelForm()
      fetchHolidays()
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Operation failed') }
    finally { setSubmitting(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const sq = scopeQuery()
      const cidParam = sq ? `&${sq}` : ''
      await apiFetch(`/api/holidays?id=${deleteConfirmId}${cidParam}`, { method: 'DELETE' })
      toast.success('Deleted successfully')
      fetchHolidays()
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Delete failed') }
    finally { setDeleting(false); setDeleteConfirmId(null); setDeleteName('') }
  }

  const updateForm = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-md">
            <FiCalendar className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">Holidays</h1>
            <p className="text-sm text-thb-text-secondary">Manage the holiday calendar for the year</p>
          </div>
        </div>
        {isAdmin && (
          <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-medium text-sm shadow-sm shadow-teal-500/25 transition-colors">
            <FiPlus className="w-4 h-4" /> Add Holiday
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by holiday name..." className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-thb-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400" />
      </div>

      {/* View Detail */}
      {viewingRecord && (
        <div className="thb-card border-l-4 border-l-teal-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2"><FiEye className="w-5 h-5 text-teal-500" /> Holiday Details</h2>
              <button onClick={() => setViewingRecord(null)} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                ['Name', viewingRecord.name], ['Date', fmtDate(viewingRecord.date)], ['Day', fmtDay(viewingRecord.date)],
                ['Type', viewingRecord.type], ['Country', viewingRecord.country], ['Description', viewingRecord.description],
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
              <h2 className="text-lg font-semibold text-thb-text-primary">{editingId ? 'Edit' : 'Add'} Holiday</h2>
              <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Name <span className="text-red-500 font-bold">*</span></label><input type="text" value={form.name || ''} onChange={e => updateForm('name', e.target.value)} required className={inputClass} placeholder="Holiday name" /></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Date <span className="text-red-500 font-bold">*</span></label><input type="date" value={form.date || ''} onChange={e => updateForm('date', e.target.value)} required className={inputClass} /></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Type</label><select value={form.type || 'public'} onChange={e => updateForm('type', e.target.value)} className={inputClass}><option value="public">Public</option><option value="festival">Festival</option><option value="state">State</option><option value="company">Company</option><option value="optional">Optional</option></select></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Country</label><input type="text" value={form.country || ''} onChange={e => updateForm('country', e.target.value)} className={inputClass} /></div>
                <div className="sm:col-span-2"><label className="block text-xs font-medium text-thb-text-secondary mb-1">Description</label><input type="text" value={form.description || ''} onChange={e => updateForm('description', e.target.value)} className={inputClass} placeholder="Holiday description" /></div>
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
      {loading.holidays ? (
        <div className="flex items-center justify-center py-12"><FiSettings className="w-8 h-8 animate-spin text-teal-400" /></div>
      ) : (
        <TableWrapper title="Holidays" icon={<FiCalendar className="w-4 h-4 text-teal-500" />} count={holidays.length}>
          <thead><tr><TH>Holiday</TH><TH>Date</TH><TH>Day</TH><TH>Type</TH><TH className="text-right">Actions</TH></tr></thead>
          <tbody>
            {fHolidays.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center"><FiCalendar className="w-10 h-10 text-thb-text-muted mx-auto mb-3" /><p className="text-thb-text-secondary font-medium">No holidays found</p></td></tr>
            ) : fHolidays.map(h => (
              <tr key={h.id} className={`transition-colors ${deleteConfirmId === h.id ? 'bg-red-50' : 'hover:bg-slate-50/50'}`}>
                {deleteConfirmId === h.id ? (
                  <td colSpan={5} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2"><FiAlertTriangle className="w-4 h-4 text-red-500" /><span className="text-sm text-red-600">Delete <b>{h.name}</b>?</span></div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setDeleteConfirmId(null); setDeleteName('') }} className="px-3 py-1 text-xs font-medium rounded-lg border border-thb-border hover:bg-slate-50">Cancel</button>
                        <button onClick={handleDelete} disabled={deleting} className="px-3 py-1 text-xs font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete'}</button>
                      </div>
                    </div>
                  </td>
                ) : (
                  <>
                    <TD className="font-medium text-thb-text-primary">{h.name}</TD>
                    <TD>{fmtDate(h.date)}</TD>
                    <TD>{fmtDay(h.date)}</TD>
                    <TD><span className={typeMap[h.type] || 'thb-badge thb-badge-info'}>{h.type}</span></TD>
                    <TD className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openView(h)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-teal-500 hover:bg-teal-50 transition-colors" title="View"><FiEye className="w-3.5 h-3.5" /></button>
                        {isAdmin && <>
                          <button onClick={() => openEdit(h)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Edit"><FiEdit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { setDeleteConfirmId(h.id); setDeleteName(h.name) }} className="p-1.5 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><FiTrash2 className="w-3.5 h-3.5" /></button>
                        </>}
                      </div>
                    </TD>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </TableWrapper>
      )}
    </div>
  )
}
