'use client';

import { useState, useEffect } from 'react';
import { FiDownload, FiHelpCircle, FiClock, FiBarChart2, FiCheckCircle, FiAlertCircle, FiUser } from 'react-icons/fi';
import toast from 'react-hot-toast';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

type ReportType = 'ticket-summary' | 'sla-compliance' | 'agent-performance' | 'csat-scores';

const reports: { key: ReportType; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: 'ticket-summary', label: 'Ticket Summary', icon: <FiHelpCircle className="w-5 h-5" />, desc: 'Ticket status overview' },
  { key: 'sla-compliance', label: 'SLA Compliance', icon: <FiClock className="w-5 h-5" />, desc: 'SLA adherence metrics' },
  { key: 'agent-performance', label: 'Agent Performance', icon: <FiBarChart2 className="w-5 h-5" />, desc: 'Agent productivity metrics' },
  { key: 'csat-scores', label: 'CSAT Scores', icon: <FiBarChart2 className="w-5 h-5" />, desc: 'Customer satisfaction scores' },
];

export default function HelpdeskReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportType>('ticket-summary');
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);

  const fetchReport = async (type: ReportType) => {
    setLoading(true);
    setReportData(null);
    try {
      const r = await fetch(`/api/support-reports?type=${type}`, { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setReportData(d.data);
    } catch {
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(activeReport); }, [activeReport]);

  const renderTicketSummary = () => {
    if (!reportData) return null;
    const { total, byCategory, byPriority, byStatus } = reportData;
    const categories = Object.entries(byCategory) as [string, any][];

    return (
      <div className="space-y-4">
        {/* Status & Priority Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="thb-card p-4">
            <p className="text-xs text-thb-text-muted mb-1">Total Tickets</p>
            <p className="text-2xl font-bold text-thb-text-primary">{total}</p>
          </div>
          <div className="thb-card p-4">
            <p className="text-xs text-thb-text-muted mb-1">Open</p>
            <p className="text-2xl font-bold text-red-500">{byStatus.open || 0}</p>
          </div>
          <div className="thb-card p-4">
            <p className="text-xs text-thb-text-muted mb-1">In Progress</p>
            <p className="text-2xl font-bold text-amber-600">{byStatus.in_progress || 0}</p>
          </div>
          <div className="thb-card p-4">
            <p className="text-xs text-thb-text-muted mb-1">Resolved</p>
            <p className="text-2xl font-bold text-emerald-600">{(byStatus.resolved || 0) + (byStatus.closed || 0)}</p>
          </div>
        </div>

        {/* Category Table */}
        {categories.length > 0 ? (
          <div className="thb-card overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-thb-text-primary">Ticket Summary by Category</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-thb-text-secondary">Category</th>
                  <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Open</th>
                  <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">In Progress</th>
                  <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Resolved</th>
                  <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Closed</th>
                </tr>
              </thead>
              <tbody>
                {categories.map(([cat, data]) => (
                  <tr key={cat} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-medium text-thb-text-primary">{cat}</td>
                    <td className="py-2.5 px-4 text-right text-red-500 font-medium">{data.open}</td>
                    <td className="py-2.5 px-4 text-right text-amber-600 font-medium">{data.inProgress}</td>
                    <td className="py-2.5 px-4 text-right text-emerald-600 font-medium">{data.resolved}</td>
                    <td className="py-2.5 px-4 text-right text-green-600 font-medium">{data.closed}</td>
                  </tr>
                ))}
                <tr className="bg-green-50 font-bold">
                  <td className="py-3 px-4 text-green-700">Total</td>
                  <td className="py-3 px-4 text-right text-green-700">{categories.reduce((s, [, d]) => s + d.open, 0)}</td>
                  <td className="py-3 px-4 text-right text-green-700">{categories.reduce((s, [, d]) => s + d.inProgress, 0)}</td>
                  <td className="py-3 px-4 text-right text-green-700">{categories.reduce((s, [, d]) => s + d.resolved, 0)}</td>
                  <td className="py-3 px-4 text-right text-green-700">{categories.reduce((s, [, d]) => s + d.closed, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="thb-card p-8 text-center">
            <FiHelpCircle className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
            <p className="text-sm text-thb-text-muted">No ticket data available</p>
          </div>
        )}
      </div>
    );
  };

  const renderSlaCompliance = () => {
    if (!reportData) return null;
    const { totalWithSla, slaMet, slaBreached, complianceRate, byPriority, avgResolutionHours } = reportData;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="thb-card p-4">
            <p className="text-xs text-thb-text-muted mb-1">SLA Compliance</p>
            <p className="text-2xl font-bold text-green-600">{complianceRate}%</p>
          </div>
          <div className="thb-card p-4">
            <p className="text-xs text-thb-text-muted mb-1">SLA Met</p>
            <p className="text-2xl font-bold text-emerald-600">{slaMet}</p>
          </div>
          <div className="thb-card p-4">
            <p className="text-xs text-thb-text-muted mb-1">SLA Breached</p>
            <p className="text-2xl font-bold text-red-500">{slaBreached}</p>
          </div>
          <div className="thb-card p-4">
            <p className="text-xs text-thb-text-muted mb-1">Avg Resolution</p>
            <p className="text-2xl font-bold text-thb-text-primary">{avgResolutionHours}h</p>
          </div>
        </div>

        {/* By Priority */}
        {Object.keys(byPriority).length > 0 ? (
          <div className="thb-card overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-thb-text-primary">SLA Compliance by Priority</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-thb-text-secondary">Priority</th>
                  <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Total</th>
                  <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Met</th>
                  <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Breached</th>
                  <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Rate</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(byPriority).map(([priority, data]: [string, any]) => (
                  <tr key={priority} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-medium text-thb-text-primary capitalize">{priority}</td>
                    <td className="py-2.5 px-4 text-right text-thb-text-primary">{data.total}</td>
                    <td className="py-2.5 px-4 text-right text-emerald-600 font-medium">{data.met}</td>
                    <td className="py-2.5 px-4 text-right text-red-500 font-medium">{data.breached}</td>
                    <td className="py-2.5 px-4 text-right font-medium">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${data.rate >= 90 ? 'bg-green-50 text-green-700' : data.rate >= 70 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                        {data.rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="thb-card p-8 text-center">
            <FiClock className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
            <p className="text-sm text-thb-text-muted">No SLA data available</p>
          </div>
        )}
      </div>
    );
  };

  const renderAgentPerformance = () => {
    if (!reportData) return null;
    const { agents } = reportData;

    return (
      <div className="space-y-4">
        {agents && agents.length > 0 ? (
          <div className="thb-card overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-thb-text-primary">Agent Performance</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-thb-text-secondary">Agent</th>
                  <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Assigned</th>
                  <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Resolved</th>
                  <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Open</th>
                  <th className="text-right py-3 px-4 font-semibold text-thb-text-secondary">Avg Resolution</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent: any) => (
                  <tr key={agent.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-medium text-thb-text-primary">{agent.name}</td>
                    <td className="py-2.5 px-4 text-right text-thb-text-primary">{agent.assigned}</td>
                    <td className="py-2.5 px-4 text-right text-emerald-600 font-medium">{agent.resolved}</td>
                    <td className="py-2.5 px-4 text-right text-amber-600 font-medium">{agent.open}</td>
                    <td className="py-2.5 px-4 text-right text-thb-text-primary">{agent.avgResolutionHours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="thb-card p-8 text-center">
            <FiUser className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
            <p className="text-sm text-thb-text-muted">No agent data available</p>
          </div>
        )}
      </div>
    );
  };

  const renderCsatScores = () => {
    if (!reportData) return null;
    const { totalResolved, csatScore, resolutionTimeBuckets } = reportData;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="thb-card p-4">
            <p className="text-xs text-thb-text-muted mb-1">CSAT Score</p>
            <p className="text-2xl font-bold text-green-600">{csatScore}%</p>
          </div>
          <div className="thb-card p-4">
            <p className="text-xs text-thb-text-muted mb-1">Total Resolved</p>
            <p className="text-2xl font-bold text-thb-text-primary">{totalResolved}</p>
          </div>
        </div>

        {/* Resolution Time Distribution */}
        {resolutionTimeBuckets && (
          <div className="thb-card overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-thb-text-primary">Resolution Time Distribution</h3>
            </div>
            <div className="grid grid-cols-5 gap-3 p-4">
              <div className="text-center p-3 rounded-lg bg-green-50">
                <p className="text-lg font-bold text-green-700">{resolutionTimeBuckets.under1h}</p>
                <p className="text-xs text-thb-text-muted">&lt; 1h</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-emerald-50">
                <p className="text-lg font-bold text-emerald-700">{resolutionTimeBuckets.under4h}</p>
                <p className="text-xs text-thb-text-muted">&lt; 4h</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-amber-50">
                <p className="text-lg font-bold text-amber-700">{resolutionTimeBuckets.under8h}</p>
                <p className="text-xs text-thb-text-muted">&lt; 8h</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-orange-50">
                <p className="text-lg font-bold text-orange-700">{resolutionTimeBuckets.under24h}</p>
                <p className="text-xs text-thb-text-muted">&lt; 24h</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-50">
                <p className="text-lg font-bold text-red-700">{resolutionTimeBuckets.over24h}</p>
                <p className="text-xs text-thb-text-muted">&gt; 24h</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-thb-text-primary">Helpdesk Reports</h1>
          <p className="text-sm text-thb-text-secondary mt-1">Generate and export helpdesk analytics</p>
        </div>
        <button
          onClick={() => toast.success('Report exported successfully')}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium"
        >
          <FiDownload className="w-4 h-4" /> Export Report
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {reports.map(r => (
          <button
            key={r.key}
            onClick={() => setActiveReport(r.key)}
            className={`thb-card p-4 text-left hover:shadow-md transition-all ${activeReport === r.key ? 'ring-2 ring-green-500 shadow-md' : ''}`}
          >
            <div className={`p-2 rounded-lg inline-flex ${activeReport === r.key ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-600'} mb-2`}>{r.icon}</div>
            <p className="text-sm font-semibold text-thb-text-primary">{r.label}</p>
            <p className="text-xs text-thb-text-muted mt-0.5">{r.desc}</p>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="thb-card p-8">
          <div className="space-y-3 animate-pulse">
            <div className="h-6 bg-slate-200 rounded w-40" />
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-slate-100 rounded" />)}
            </div>
            <div className="h-40 bg-slate-100 rounded" />
          </div>
        </div>
      ) : !reportData ? (
        <div className="thb-card p-8 text-center">
          <FiHelpCircle className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-thb-text-primary">No Data Available</h3>
          <p className="text-sm text-thb-text-muted mt-2">Create tickets to see report data here.</p>
        </div>
      ) : (
        <>
          {activeReport === 'ticket-summary' && renderTicketSummary()}
          {activeReport === 'sla-compliance' && renderSlaCompliance()}
          {activeReport === 'agent-performance' && renderAgentPerformance()}
          {activeReport === 'csat-scores' && renderCsatScores()}
        </>
      )}
    </div>
  );
}
