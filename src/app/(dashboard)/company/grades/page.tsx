'use client'

import { useState } from 'react'
import { FiLayers, FiSearch, FiEye, FiX, FiSettings } from 'react-icons/fi'
import { useCompanyData, gradeCode, gradeName, fmtSalary } from '@/components/company/useCompanyData'

export default function GradesPage() {
  const { designations, loading } = useCompanyData()
  const [search, setSearch] = useState('')
  const [viewingGrade, setViewingGrade] = useState<{ code: string; name: string; level: number; min: number; max: number; employees: number } | null>(null)

  const q = search.toLowerCase()

  // Derive grades from designations
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-pink-600 flex items-center justify-center shadow-md">
            <FiLayers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">Grades</h1>
            <p className="text-sm text-thb-text-secondary">Organizational grades derived from designation levels</p>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="thb-card border-l-4 border-l-teal-500 bg-gradient-to-r from-teal-50/60 to-pink-50/40">
        <div className="p-4 flex items-start gap-3">
          <FiLayers className="w-5 h-5 text-teal-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-700">
            <p className="font-semibold text-slate-900 mb-0.5">Grades are derived from designations</p>
            <p className="text-xs text-slate-600">
              Grades are automatically calculated from designation levels. To add or modify grades, edit the level field on your designations.
              E1 = Junior (Level 1), E2 = Mid (Level 2), E3 = Senior (Level 3), M1 = Manager (Level 4+).
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by grade name..." className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-thb-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400" />
      </div>

      {/* View Detail */}
      {viewingGrade && (
        <div className="thb-card border-l-4 border-l-teal-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary flex items-center gap-2"><FiEye className="w-5 h-5 text-teal-500" /> Grade Details</h2>
              <button onClick={() => setViewingGrade(null)} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                ['Grade Code', viewingGrade.code], ['Grade Name', viewingGrade.name], ['Level', viewingGrade.level],
                ['Min Salary', fmtSalary(viewingGrade.min)], ['Max Salary', fmtSalary(viewingGrade.max)],
                ['Employees', viewingGrade.employees], ['Status', 'Active'],
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

      {/* Grades Card Grid */}
      {loading.designations ? (
        <div className="flex items-center justify-center py-12"><FiSettings className="w-8 h-8 animate-spin text-teal-400" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {gradeList.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <FiLayers className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
              <p className="text-thb-text-secondary font-medium">No grades found</p>
              <p className="text-xs text-thb-text-muted mt-1">Grades are derived from designation levels</p>
            </div>
          ) : gradeList.map(g => (
            <div key={g.code} className="thb-card thb-card-hover p-5 transition-colors cursor-pointer" onClick={() => setViewingGrade(g)}>
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
      )}
    </div>
  )
}
