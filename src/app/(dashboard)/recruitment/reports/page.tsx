'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FiUsers, FiClock, FiTarget, FiBarChart2, FiRefreshCw,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/* ── Report Types ── */
const reportTypes = [
  { key: 'hiring', label: 'Hiring Summary', icon: FiUsers, color: 'bg-green-50 text-green-600' },
  { key: 'time-to-hire', label: 'Time to Hire', icon: FiClock, color: 'bg-emerald-50 text-emerald-600' },
  { key: 'source', label: 'Source Analytics', icon: FiTarget, color: 'bg-amber-50 text-amber-600' },
  { key: 'offer', label: 'Offer Acceptance', icon: FiBarChart2, color: 'bg-teal-50 text-teal-600' },
];

interface HiringRow { department: string; open: number; inProgress: number; hired: number; }
interface TimeToHireDept { department: string; avgDays: number; hiresCount: number; }
interface SourceRow { source: string; applications: number; hired: number; conversionRate: number; }
interface MonthlyRow { month: string; applications: number; hires: number; offers: number; }

interface ReportData {
  hiringSummary: HiringRow[];
  overall: {
    totalOpenPositions: number;
    totalApplications: number;
    totalOffersMade: number;
    totalHired: number;
    hiringRate: number;
    timeToFillAvg: number;
    timeToHireAvg: number;
    openRequisitions: number;
  };
  timeToHire: { avgDays: number; byDepartment: TimeToHireDept[] };
  sourceAnalytics: SourceRow[];
  offerAcceptance: {
    accepted: number;
    rejected: number;
    pending: number;
    acceptanceRate: number;
  };
  monthlyTrend: MonthlyRow[];
}

export default function RecruitmentReportsPage() {
  useAuthStore();
  const [activeReport, setActiveReport] = useState('hiring');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/recruitment-reports', { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        toast.error('Failed to load recruitment reports');
      }
    } catch {
      toast.error('Failed to load recruitment reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => fetchReports()); }, [fetchReports]);

  const formatMonth = (m: string) => {
    const [y, mm] = m.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(mm) - 1]} ${y}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-green-50">
            <FiBarChart2 className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-thb-text-primary">Recruitment Reports</h1>
            <p className="text-sm text-thb-text-secondary">Analyze hiring pipeline and recruitment effectiveness</p>
          </div>
        </div>
        <button
          onClick={fetchReports}
          className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"
          title="Refresh"
        >
          <FiRefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Overall KPI Cards */}
      {!loading && data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="thb-card p-4 text-center">
            <p className="text-xs text-thb-text-muted font-medium uppercase tracking-wider">Open Positions</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{data.overall.totalOpenPositions}</p>
          </div>
          <div className="thb-card p-4 text-center">
            <p className="text-xs text-thb-text-muted font-medium uppercase tracking-wider">Applications</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{data.overall.totalApplications}</p>
          </div>
          <div className="thb-card p-4 text-center">
            <p className="text-xs text-thb-text-muted font-medium uppercase tracking-wider">Hired</p>
            <p className="text-2xl font-bold text-teal-600 mt-1">{data.overall.totalHired}</p>
          </div>
          <div className="thb-card p-4 text-center">
            <p className="text-xs text-thb-text-muted font-medium uppercase tracking-wider">Hiring Rate</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{data.overall.hiringRate}%</p>
          </div>
        </div>
      )}

      {/* Report Type Selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {reportTypes.map((rt) => {
          const Icon = rt.icon;
          const isActive = activeReport === rt.key;
          return (
            <button
              key={rt.key}
              onClick={() => setActiveReport(rt.key)}
              className={`thb-card p-4 flex flex-col items-center gap-2 text-center transition-all hover:shadow-md ${isActive ? 'ring-2 ring-green-500 shadow-md' : ''}`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${rt.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-xs font-medium ${isActive ? 'text-green-600' : 'text-thb-text-secondary'}`}>{rt.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="thb-card p-8 animate-pulse space-y-4">
          <div className="h-5 w-40 bg-slate-200 rounded" />
          <div className="h-4 w-64 bg-slate-100 rounded" />
          <div className="h-4 w-56 bg-slate-100 rounded" />
          <div className="h-4 w-48 bg-slate-100 rounded" />
        </div>
      ) : !data ? (
        <div className="thb-card p-8 text-center">
          <FiBarChart2 className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary font-medium">No report data available</p>
          <p className="text-sm text-thb-text-muted mt-1">Reports will appear once you have recruitment activity</p>
        </div>
      ) : (
        <>
          {/* Hiring Summary */}
          {activeReport === 'hiring' && (
            <div className="space-y-4">
              <div className="thb-card overflow-hidden">
                <div className="px-5 py-4 border-b border-thb-border">
                  <h2 className="font-semibold text-thb-text-primary">Hiring Summary</h2>
                  <p className="text-xs text-thb-text-muted mt-0.5">Open positions and hiring progress by department</p>
                </div>
                {data.hiringSummary.length === 0 ? (
                  <div className="p-8 text-center">
                    <FiUsers className="w-10 h-10 text-thb-text-muted mx-auto mb-2" />
                    <p className="text-sm text-thb-text-muted">No hiring data yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-thb-border bg-slate-50">
                          <th className="text-left px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Department</th>
                          <th className="text-center px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Open</th>
                          <th className="text-center px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">In Progress</th>
                          <th className="text-center px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Hired</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.hiringSummary.map((row) => (
                          <tr key={row.department} className="border-b border-thb-border last:border-b-0 hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3 text-sm text-thb-text-primary font-medium">{row.department}</td>
                            <td className="px-5 py-3 text-sm text-green-600 text-center font-semibold">{row.open}</td>
                            <td className="px-5 py-3 text-sm text-amber-600 text-center font-medium">{row.inProgress}</td>
                            <td className="px-5 py-3 text-sm text-emerald-600 text-center font-medium">{row.hired}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Monthly Trend */}
              {data.monthlyTrend.length > 0 && (
                <div className="thb-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-thb-border">
                    <h2 className="font-semibold text-thb-text-primary">Monthly Trend (Last 6 Months)</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-thb-border bg-slate-50">
                          <th className="text-left px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Month</th>
                          <th className="text-center px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Applications</th>
                          <th className="text-center px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Hires</th>
                          <th className="text-center px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Offers</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.monthlyTrend.map((row) => (
                          <tr key={row.month} className="border-b border-thb-border last:border-b-0 hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3 text-sm text-thb-text-primary font-medium">{formatMonth(row.month)}</td>
                            <td className="px-5 py-3 text-sm text-sky-600 text-center font-medium">{row.applications}</td>
                            <td className="px-5 py-3 text-sm text-emerald-600 text-center font-medium">{row.hires}</td>
                            <td className="px-5 py-3 text-sm text-teal-600 text-center font-medium">{row.offers}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Time to Hire */}
          {activeReport === 'time-to-hire' && (
            <div className="space-y-4">
              <div className="thb-card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-emerald-50">
                    <FiClock className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-thb-text-primary">Average Time to Hire</h3>
                    <p className="text-xs text-thb-text-muted">From application to offer acceptance</p>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-emerald-600">{data.timeToHire.avgDays}</span>
                  <span className="text-sm text-thb-text-muted">days average</span>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-thb-text-muted">
                  <span>Time to Fill: <strong className="text-thb-text-primary">{data.overall.timeToFillAvg} days</strong></span>
                  <span>Open Requisitions: <strong className="text-thb-text-primary">{data.overall.openRequisitions}</strong></span>
                </div>
              </div>

              {data.timeToHire.byDepartment.length > 0 ? (
                <div className="thb-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-thb-border">
                    <h2 className="font-semibold text-thb-text-primary">Time to Hire by Department</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-thb-border bg-slate-50">
                          <th className="text-left px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Department</th>
                          <th className="text-center px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Avg Days</th>
                          <th className="text-center px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Hires</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.timeToHire.byDepartment.map((row) => (
                          <tr key={row.department} className="border-b border-thb-border last:border-b-0 hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3 text-sm text-thb-text-primary font-medium">{row.department}</td>
                            <td className="px-5 py-3 text-sm text-emerald-600 text-center font-semibold">{row.avgDays}</td>
                            <td className="px-5 py-3 text-sm text-thb-text-primary text-center">{row.hiresCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="thb-card p-8 text-center">
                  <FiClock className="w-10 h-10 text-thb-text-muted mx-auto mb-2" />
                  <p className="text-sm text-thb-text-muted">No time-to-hire data yet — data will populate as candidates are hired</p>
                </div>
              )}
            </div>
          )}

          {/* Source Analytics */}
          {activeReport === 'source' && (
            <div className="thb-card overflow-hidden">
              <div className="px-5 py-4 border-b border-thb-border">
                <h2 className="font-semibold text-thb-text-primary">Source Analytics</h2>
                <p className="text-xs text-thb-text-muted mt-0.5">Effectiveness of different recruitment sources</p>
              </div>
              {data.sourceAnalytics.length === 0 ? (
                <div className="p-8 text-center">
                  <FiTarget className="w-10 h-10 text-thb-text-muted mx-auto mb-2" />
                  <p className="text-sm text-thb-text-muted">No source data yet — data will appear as applications come in</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-thb-border bg-slate-50">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Source</th>
                        <th className="text-center px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Applications</th>
                        <th className="text-center px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Hired</th>
                        <th className="text-center px-5 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Conversion Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.sourceAnalytics.map((row) => (
                        <tr key={row.source} className="border-b border-thb-border last:border-b-0 hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3 text-sm text-thb-text-primary font-medium capitalize">{row.source}</td>
                          <td className="px-5 py-3 text-sm text-sky-600 text-center font-medium">{row.applications}</td>
                          <td className="px-5 py-3 text-sm text-emerald-600 text-center font-medium">{row.hired}</td>
                          <td className="px-5 py-3 text-sm text-amber-600 text-center font-semibold">{row.conversionRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Offer Acceptance */}
          {activeReport === 'offer' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="thb-card p-4 text-center">
                  <p className="text-xs text-thb-text-muted font-medium uppercase tracking-wider">Accepted</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{data.offerAcceptance.accepted}</p>
                </div>
                <div className="thb-card p-4 text-center">
                  <p className="text-xs text-thb-text-muted font-medium uppercase tracking-wider">Rejected</p>
                  <p className="text-2xl font-bold text-red-500 mt-1">{data.offerAcceptance.rejected}</p>
                </div>
                <div className="thb-card p-4 text-center">
                  <p className="text-xs text-thb-text-muted font-medium uppercase tracking-wider">Pending</p>
                  <p className="text-2xl font-bold text-amber-500 mt-1">{data.offerAcceptance.pending}</p>
                </div>
                <div className="thb-card p-4 text-center">
                  <p className="text-xs text-thb-text-muted font-medium uppercase tracking-wider">Acceptance Rate</p>
                  <p className="text-2xl font-bold text-teal-600 mt-1">{data.offerAcceptance.acceptanceRate}%</p>
                </div>
              </div>

              {data.offerAcceptance.accepted + data.offerAcceptance.rejected + data.offerAcceptance.pending === 0 && (
                <div className="thb-card p-8 text-center">
                  <FiBarChart2 className="w-10 h-10 text-thb-text-muted mx-auto mb-2" />
                  <p className="text-sm text-thb-text-muted">No offer data yet — data will appear as offers are sent</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
