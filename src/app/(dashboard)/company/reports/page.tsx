'use client'

import { useState } from 'react'
import {
  FiBarChart2, FiDownload, FiFileText, FiUsers, FiMapPin, FiBriefcase,
  FiAward, FiCalendar, FiCheckCircle, FiAlertTriangle, FiLayers, FiClock
} from 'react-icons/fi'
import toast from 'react-hot-toast'
import { useCompanyData } from '@/components/company/useCompanyData'

interface ReportCard {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  gradient: string
  lastGenerated: string | null
  format: string
  category: string
}

export default function ReportsPage() {
  const { companies, branches, departments, designations, shifts, holidays, policies } = useCompanyData()
  const [generating, setGenerating] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  const reports: ReportCard[] = [
    {
      id: 'company-structure',
      title: 'Company Structure Report',
      description: 'Complete organizational hierarchy including companies, branches, departments, and reporting lines. Shows the full tenant → group company → company → branch → department tree.',
      icon: <FiLayers className="w-5 h-5" />,
      gradient: 'from-emerald-500 to-green-600',
      lastGenerated: null,
      format: 'PDF',
      category: 'Organization',
    },
    {
      id: 'headcount-distribution',
      title: 'Headcount Distribution',
      description: 'Employee headcount breakdown by company, department, designation, and grade level. Includes charts for demographic analysis and headcount trends over time.',
      icon: <FiUsers className="w-5 h-5" />,
      gradient: 'from-teal-500 to-teal-600',
      lastGenerated: null,
      format: 'Excel',
      category: 'Workforce',
    },
    {
      id: 'branch-summary',
      title: 'Branch-wise Summary',
      description: 'Comprehensive summary of each branch including location details, employee count, active departments, and operating status. Useful for multi-location management.',
      icon: <FiMapPin className="w-5 h-5" />,
      gradient: 'from-green-500 to-cyan-600',
      lastGenerated: null,
      format: 'PDF',
      category: 'Location',
    },
    {
      id: 'department-analytics',
      title: 'Department Analytics',
      description: 'Department-level analytics including team sizes, designation distribution, budget allocation, and vacancy tracking. Helps identify understaffed or overstaffed departments.',
      icon: <FiBriefcase className="w-5 h-5" />,
      gradient: 'from-cyan-500 to-teal-600',
      lastGenerated: null,
      format: 'Excel',
      category: 'Workforce',
    },
    {
      id: 'designation-matrix',
      title: 'Designation Matrix',
      description: 'Cross-reference table of designations across departments with grade levels, salary bands, and employee counts. Essential for compensation benchmarking and career path planning.',
      icon: <FiAward className="w-5 h-5" />,
      gradient: 'from-amber-500 to-orange-600',
      lastGenerated: null,
      format: 'Excel',
      category: 'Compensation',
    },
    {
      id: 'holiday-calendar-summary',
      title: 'Holiday Calendar Summary',
      description: 'Yearly holiday calendar with breakdown by type (public, festival, state, company, optional). Shows holiday count by month and quarter for leave planning.',
      icon: <FiCalendar className="w-5 h-5" />,
      gradient: 'from-red-500 to-rose-600',
      lastGenerated: null,
      format: 'PDF',
      category: 'Attendance',
    },
    {
      id: 'policy-compliance',
      title: 'Policy Compliance Report',
      description: 'Overview of all company policies with version tracking, effective dates, expiry status, and category coverage. Identifies gaps in policy coverage and expired policies.',
      icon: <FiFileText className="w-5 h-5" />,
      gradient: 'from-emerald-500 to-teal-600',
      lastGenerated: null,
      format: 'PDF',
      category: 'Compliance',
    },
  ]

  const handleExport = async (reportId: string, format: string) => {
    if (downloading) return;
    setDownloading(reportId);
    try {
      const exportFormat = format === 'Excel' ? 'excel' : format === 'PDF' ? 'pdf' : 'csv';
      const token = localStorage.getItem('tb_token');
      // Send token both as Authorization header AND as query param fallback.
      // Some proxy/CDN configurations strip Authorization headers; the query param
      // ensures the API can always authenticate the request.
      const res = await fetch(`/api/reports/export${token ? `?token=${encodeURIComponent(token)}` : ''}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reportType: reportId, format: exportFormat }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(errData.error || 'Export failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = res.headers.get('Content-Disposition');
      const fileName = contentDisposition?.match(/filename="(.+)"/)?.[1] || `${reportId}-report.${exportFormat === 'excel' ? 'xlsx' : exportFormat}`;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${format} report downloaded successfully`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to download report');
    } finally {
      setDownloading(null);
    }
  }

  const handleGenerate = async (reportId: string) => {
    const report = reports.find(r => r.id === reportId);
    if (!report) return;
    setGenerating(reportId);
    try {
      await handleExport(reportId, report.format);
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setGenerating(null);
    }
  }

  // Quick stats for the reports overview
  const stats = [
    { label: 'Companies', value: companies.length, icon: <FiLayers className="w-4 h-4" />, color: 'text-emerald-500 bg-emerald-50' },
    { label: 'Branches', value: branches.length, icon: <FiMapPin className="w-4 h-4" />, color: 'text-green-500 bg-green-50' },
    { label: 'Departments', value: departments.length, icon: <FiBriefcase className="w-4 h-4" />, color: 'text-emerald-500 bg-emerald-50' },
    { label: 'Designations', value: designations.length, icon: <FiAward className="w-4 h-4" />, color: 'text-amber-500 bg-amber-50' },
    { label: 'Shifts', value: shifts.length, icon: <FiClock className="w-4 h-4" />, color: 'text-teal-500 bg-teal-50' },
    { label: 'Holidays', value: holidays.length, icon: <FiCalendar className="w-4 h-4" />, color: 'text-red-500 bg-red-50' },
    { label: 'Policies', value: policies.length, icon: <FiFileText className="w-4 h-4" />, color: 'text-teal-500 bg-teal-50' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-md">
          <FiBarChart2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-thb-text-primary">Company Reports</h1>
          <p className="text-sm text-thb-text-secondary">Generate and download company-specific reports</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {stats.map(stat => (
          <div key={stat.label} className="thb-card thb-card-hover p-3 text-center">
            <div className={`w-8 h-8 rounded-lg ${stat.color} flex items-center justify-center mx-auto mb-2`}>
              {stat.icon}
            </div>
            <p className="text-lg font-bold text-thb-text-primary">{stat.value}</p>
            <p className="text-[10px] text-thb-text-muted font-medium uppercase tracking-wider">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map(report => (
          <div key={report.id} className="thb-card thb-card-hover transition-all hover:shadow-md">
            <div className="p-5">
              <div className="flex items-start gap-4">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${report.gradient} flex items-center justify-center text-white shadow-sm flex-shrink-0`}>
                  {report.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-thb-text-primary truncate">{report.title}</h3>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">{report.category}</span>
                  </div>
                  <p className="text-xs text-thb-text-secondary leading-relaxed mb-3">{report.description}</p>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-medium text-thb-text-muted">Format: <span className="text-thb-text-secondary">{report.format}</span></span>
                    <span className="text-thb-text-muted">·</span>
                    <span className="text-[10px] font-medium text-thb-text-muted">Est. time: <span className="text-thb-text-secondary">~5 sec</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleGenerate(report.id)}
                      disabled={generating === report.id || downloading === report.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-500 text-white text-xs font-medium rounded-lg hover:bg-teal-600 disabled:opacity-50 shadow-sm shadow-teal-500/25 transition-colors"
                    >
                      {generating === report.id || downloading === report.id ? (
                        <><FiCheckCircle className="w-3 h-3 animate-spin" /> Generating...</>
                      ) : (
                        <><FiBarChart2 className="w-3 h-3" /> Generate & Download</>
                      )}
                    </button>
                    <button
                      onClick={() => handleExport(report.id, report.format === 'Excel' ? 'excel' : 'pdf')}
                      disabled={downloading === report.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-thb-border text-thb-text-secondary text-xs font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      {downloading === report.id ? (
                        <><FiCheckCircle className="w-3 h-3 animate-spin" /> Downloading...</>
                      ) : (
                        <><FiDownload className="w-3 h-3" /> {report.format}</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Info Footer */}
      <div className="thb-card border-l-4 border-l-teal-500 bg-gradient-to-r from-teal-50/60 to-emerald-50/40">
        <div className="p-4 flex items-start gap-3">
          <FiAlertTriangle className="w-5 h-5 text-teal-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-700">
            <p className="font-semibold text-slate-900 mb-0.5">About Company Reports</p>
            <p className="text-xs text-slate-600">
              These reports are scoped to your company and its organizational structure. For organization-wide analytics,
              use the <b>Analytics</b> module. Reports are generated on-demand and may take a few seconds to compile.
              Downloaded reports reflect the current state of your company data at the time of generation.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
