'use client'

import { useState } from 'react'
import { FiClock, FiPlus, FiSearch, FiEye, FiEdit2, FiTrash2, FiX, FiMoon, FiSun, FiAlertTriangle, FiSettings } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { useCompanyData, apiFetch, fmtTime, getStatusBadge } from '@/components/company/useCompanyData'
import { ShiftRecord } from '@/components/company/useCompanyData'
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

export default function ShiftsPage() {
  const { shifts, loading, isAdmin, fetchShifts } = useCompanyData()
  const companyId = useCompanyContextStore(s => s.effectiveCompanyId())
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery)
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId)
  void selectedTenantId; // ensures re-fetch when tenant changes (URL built via scopeQuery)

  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [viewingRecord, setViewingRecord] = useState<ShiftRecord | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleteName, setDeleteName] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const inputClass = 'w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400'
  const q = search.toLowerCase()
  const fShifts = shifts.filter(s => s.name.toLowerCase().includes(q))

  const getDefaultForm = (): Record<string, string> => ({
    name: '', startTime: '09:00', endTime: '18:00', breakDuration: '60', graceTime: '15', status: 'active'
  })

  const getFormFromRecord = (r: ShiftRecord): Record<string, string> => {
    const f = getDefaultForm()
    Object.keys(f).forEach(k => { if ((r as Record<string, unknown>)[k] !== undefined && (r as Record<string, unknown>)[k] !== null) f[k] = String((r as Record<string, unknown>)[k]) })
    return f
  }

  const openAdd = () => { setEditingId(null); setForm(getDefaultForm()); setShowForm(true); setViewingRecord(null); setDeleteConfirmId(null) }
  const openEdit = (r: ShiftRecord) => { setEditingId(r.id); setForm(getFormFromRecord(r)); setShowForm(true); setViewingRecord(null); setDeleteConfirmId(null) }
  const openView = (r: ShiftRecord) => { setViewingRecord(r); setShowForm(false); setDeleteConfirmId(null) }
  const handleCancelForm = () => { setShowForm(false); setEditingId(null); setForm({}) }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    // startTime and endTime are required
    if (!form.startTime) { toast.error('Start time is required'); return }
    if (!form.endTime) { toast.error('End time is required'); return }

    // Validate breakDuration and graceTime: must be non-negative
    const breakVal = Number(form.breakDuration)
    const graceVal = Number(form.graceTime)
    if (isNaN(breakVal) || breakVal < 0) { toast.error('Break duration cannot be negative'); return }
    if (isNaN(graceVal) || graceVal < 0) { toast.error('Grace time cannot be negative'); return }

    // Calculate shift duration in minutes (allow overnight shifts where endTime < startTime)
    const [startH, startM] = form.startTime.split(':').map(Number)
    const [endH, endM] = form.endTime.split(':').map(Number)
    let shiftMinutes = (endH * 60 + endM) - (startH * 60 + startM)
    if (shiftMinutes <= 0) shiftMinutes += 24 * 60 // overnight shift

    // breakDuration cannot exceed total shift duration
    if (breakVal > shiftMinutes) { toast.error('Break duration cannot exceed total shift duration'); return }

    setSubmitting(true)
    try {
      const isEdit = !!editingId
      const body: Record<string, unknown> = { ...form, companyId, breakDuration: Number(form.breakDuration) || 60, graceTime: Number(form.graceTime) || 15 }
      if (isEdit) body.id = editingId
      if (!companyId) { toast.error('Company ID is required'); setSubmitting(false); return }
      const sq = scopeQuery()
      const cidParam = sq ? `?${sq}` : ''
      await apiFetch(`/api/shifts${cidParam}`, { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(body) })
      toast.success(`Shift ${isEdit ? 'updated' : 'created'} successfully`)
      handleCancelForm()
      fetchShifts()
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Operation failed') }
    finally { setSubmitting(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const sq = scopeQuery()
      const cidParam = sq ? `&${sq}` : ''
      await apiFetch(`/api/shifts?id=${deleteConfirmId}${cidParam}`, { method: 'DELETE' })
      toast.success('Deleted successfully')
      fetchShifts()
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Delete failed') }
    finally { setDeleting(false); setDeleteConfirmId(null); setDeleteName('') }
  }

  const updateForm = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
            <FiClock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">Shifts</h1>
            <p className="text-sm text-thb-text-secondary">Manage work shift timings for attendance tracking</p>
          </div>
        </div>
        {isAdmin && companyId && (
          <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-medium text-sm shadow-sm shadow-teal-500/25 transition-colors">
            <FiPlus className="w-4 h-4" /> Add Shift
          </button>
        )}
        {isAdmin && !companyId && (
          <span className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">Select a company to add shifts</span>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by shift name..." className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-thb-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400" />
      </div>

      {/* View Detail */}
      {viewingRecord && (
        <div className="thb-card border-l-4 border-l-teal-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2"><FiEye className="w-5 h-5 text-teal-500" /> Shift Details</h2>
              <button onClick={() => setViewingRecord(null)} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                ['Name', viewingRecord.name], ['Start Time', fmtTime(viewingRecord.startTime)], ['End Time', fmtTime(viewingRecord.endTime)],
                ['Break Duration', `${viewingRecord.breakDuration || 60} min`], ['Grace Time', `${viewingRecord.graceTime || 15} min`], ['Status', viewingRecord.status],
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
              <h2 className="text-lg font-semibold text-thb-text-primary">{editingId ? 'Edit' : 'Add'} Shift</h2>
              <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Name *</label><input type="text" value={form.name || ''} onChange={e => updateForm('name', e.target.value)} required className={inputClass} placeholder="Shift name" /></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Start Time</label><input type="time" value={form.startTime || '09:00'} onChange={e => updateForm('startTime', e.target.value)} className={inputClass} /></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">End Time</label><input type="time" value={form.endTime || '18:00'} onChange={e => updateForm('endTime', e.target.value)} className={inputClass} /></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Break (min)</label><input type="number" value={form.breakDuration || '60'} onChange={e => updateForm('breakDuration', e.target.value)} className={inputClass} placeholder="60" /></div>
                <div><label className="block text-xs font-medium text-thb-text-secondary mb-1">Grace Time (min)</label><input type="number" value={form.graceTime || '15'} onChange={e => updateForm('graceTime', e.target.value)} className={inputClass} placeholder="15" /></div>
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
      {loading.shifts ? (
        <div className="flex items-center justify-center py-12"><FiSettings className="w-8 h-8 animate-spin text-teal-400" /></div>
      ) : (
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
                    <td colSpan={7} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2"><FiAlertTriangle className="w-4 h-4 text-red-500" /><span className="text-sm text-red-600">Delete <b>{s.name}</b>?</span></div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setDeleteConfirmId(null); setDeleteName('') }} className="px-3 py-1 text-xs font-medium rounded-lg border border-thb-border hover:bg-slate-50">Cancel</button>
                          <button onClick={handleDelete} disabled={deleting} className="px-3 py-1 text-xs font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete'}</button>
                        </div>
                      </div>
                    </td>
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
                      <TD className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openView(s)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-teal-500 hover:bg-teal-50 transition-colors" title="View"><FiEye className="w-3.5 h-3.5" /></button>
                          {isAdmin && <>
                            <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Edit"><FiEdit2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => { setDeleteConfirmId(s.id); setDeleteName(s.name) }} className="p-1.5 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><FiTrash2 className="w-3.5 h-3.5" /></button>
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
