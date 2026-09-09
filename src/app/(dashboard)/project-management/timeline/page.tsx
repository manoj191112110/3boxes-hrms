'use client';

import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { isClientDemoMode } from '@/lib/site-mode';
import { useAuthStore } from '@/store/authStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

/* ── Helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'thb-badge thb-badge-success',
    on_hold: 'thb-badge thb-badge-warning',
    completed: 'thb-badge thb-badge-info',
    cancelled: 'thb-badge thb-badge-error',
    draft: 'thb-badge bg-slate-100 text-slate-600',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

function formatStatus(status: string) {
  const map: Record<string, string> = {
    active: 'Active', on_hold: 'On Hold', completed: 'Completed',
    cancelled: 'Cancelled', draft: 'Draft',
  };
  return map[status] || status.replace('_', ' ');
}

function getTypeColor(type: string) {
  const map: Record<string, string> = {
    internal: '#3B82F6',
    client: '#10B981',
    r_and_d: '#8B5CF6',
    support: '#F59E0B',
  };
  return map[type] || '#94A3B8';
}

/* ── Types ── */
interface TimelineProject {
  id: string; name: string; startDate: string; endDate: string | null;
  progress: number; status: string; projectType: string;
  budgetAmount?: number;
}

const STATUSES = ['draft', 'active', 'on_hold', 'completed', 'cancelled'];

/* ── Demo Data ── */
const DEMO_TIMELINE: TimelineProject[] = isClientDemoMode() ? [
  { id: '1', name: 'Website Redesign', startDate: '2026-01-15', endDate: '2026-06-30', progress: 45, status: 'active', projectType: 'client', budgetAmount: 120000 },
  { id: '2', name: 'Mobile App Development', startDate: '2026-02-01', endDate: '2026-08-15', progress: 30, status: 'active', projectType: 'client', budgetAmount: 200000 },
  { id: '3', name: 'Internal HRMS Upgrade', startDate: '2026-03-01', endDate: '2026-05-31', progress: 15, status: 'active', projectType: 'internal', budgetAmount: 50000 },
  { id: '4', name: 'AI Research Initiative', startDate: '2026-01-01', endDate: '2026-12-31', progress: 20, status: 'active', projectType: 'r_and_d', budgetAmount: 300000 },
  { id: '5', name: 'Customer Support Portal', startDate: '2026-04-01', endDate: '2026-07-31', progress: 0, status: 'draft', projectType: 'support', budgetAmount: 80000 },
  { id: '6', name: 'Legacy System Migration', startDate: '2025-10-01', endDate: '2026-03-31', progress: 85, status: 'active', projectType: 'internal', budgetAmount: 150000 },
  { id: '7', name: 'Data Analytics Platform', startDate: '2025-11-15', endDate: '2026-02-28', progress: 100, status: 'completed', projectType: 'client', budgetAmount: 175000 },
  { id: '8', name: 'Security Audit Framework', startDate: '2026-02-15', endDate: '2026-04-30', progress: 60, status: 'on_hold', projectType: 'r_and_d', budgetAmount: 45000 },
] : [];

export default function TimelinePage() {
  const { user } = useAuthStore();
  const [projects, setProjects] = useState<TimelineProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => { fetchProjects(); }, []);

  async function fetchProjects() {
    try {
      setLoading(true);
      const res = await fetch('/api/projects?limit=50', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const mapped = (data.projects || []).map((p: TimelineProject & { endDate?: string | null }) => ({
          id: p.id, name: p.name, startDate: p.startDate,
          endDate: p.endDate, progress: p.progress || 0, status: p.status,
          projectType: p.projectType || 'internal', budgetAmount: p.budgetAmount,
        }));
        setProjects(mapped.length > 0 ? mapped : DEMO_TIMELINE);
      } else {
        setProjects(DEMO_TIMELINE);
      }
    } catch {
      setProjects(DEMO_TIMELINE);
    } finally { setLoading(false); }
  }

  const filtered = useMemo(() => {
    if (!filterStatus) return projects;
    return projects.filter(p => p.status === filterStatus);
  }, [projects, filterStatus]);

  // Build chart data with day offsets from a reference date
  const chartData = useMemo(() => {
    if (filtered.length === 0) return [];
    const refDate = new Date(Math.min(...filtered.map(p => new Date(p.startDate).getTime())));
    return filtered.map(p => {
      const start = Math.round((new Date(p.startDate).getTime() - refDate.getTime()) / 86400000);
      const end = p.endDate ? Math.round((new Date(p.endDate).getTime() - refDate.getTime()) / 86400000) : start + 90;
      const duration = Math.max(end - start, 1);
      return { name: p.name, start, duration, progress: p.progress, type: p.projectType, color: getTypeColor(p.projectType) };
    });
  }, [filtered]);

  // Timeline visual bars
  const timelineMonths = useMemo(() => {
    if (filtered.length === 0) return [];
    const allDates = filtered.flatMap(p => [new Date(p.startDate), new Date(p.endDate || '2026-12-31')]);
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    const months: { label: string; date: Date }[] = [];
    const current = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (current <= maxDate) {
      months.push({ label: current.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), date: new Date(current) });
      current.setMonth(current.getMonth() + 1);
    }
    return months;
  }, [filtered]);

  const totalDays = useMemo(() => {
    if (timelineMonths.length < 2) return 30;
    return Math.round((timelineMonths[timelineMonths.length - 1].date.getTime() - timelineMonths[0].date.getTime()) / 86400000);
  }, [timelineMonths]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary">Timeline</h1>
          <p className="text-sm text-thb-text-secondary mt-1">Visual project timeline overview</p>
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-thb-border rounded-lg text-sm bg-white">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
        </select>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-thb-text-secondary">
        <span className="font-medium">Project Types:</span>
        {[
          { type: 'internal', color: '#3B82F6', label: 'Internal' },
          { type: 'client', color: '#10B981', label: 'Client' },
          { type: 'r_and_d', color: '#8B5CF6', label: 'R&D' },
          { type: 'support', color: '#F59E0B', label: 'Support' },
        ].map(item => (
          <span key={item.type} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>

      {/* Horizontal Bar Chart */}
      <div className="thb-card p-5">
        <h3 className="font-semibold text-thb-text-primary mb-4">Project Durations</h3>
        {loading ? (
          <div className="h-64 animate-pulse bg-slate-100 rounded" />
        ) : chartData.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94A3B8" label={{ value: 'Days', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#94A3B8" width={140} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
                  formatter={(value: number, name: string) => {
                    if (name === 'duration') return [`${value} days`, 'Duration'];
                    return [value, name];
                  }}
                />
                <Bar dataKey="duration" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-thb-text-muted">No projects to display</div>
        )}
      </div>

      {/* Visual Gantt-like Timeline */}
      <div className="thb-card p-5">
        <h3 className="font-semibold text-thb-text-primary mb-4">Gantt View</h3>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-8 animate-pulse bg-slate-100 rounded" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Month headers */}
            <div className="flex mb-2 ml-44">
              {timelineMonths.map((m, i) => (
                <div key={i} className="text-xs text-thb-text-muted text-center border-l border-thb-border px-1"
                  style={{ minWidth: `${(100 / timelineMonths.length)}%` }}>
                  {m.label}
                </div>
              ))}
            </div>
            {/* Project bars */}
            <div className="space-y-2">
              {filtered.map(project => {
                const pStart = new Date(project.startDate).getTime();
                const pEnd = new Date(project.endDate || '2026-12-31').getTime();
                const tStart = timelineMonths[0]?.date.getTime() || pStart;
                const tEnd = timelineMonths[timelineMonths.length - 1]?.date.getTime() || pEnd;
                const totalRange = Math.max(tEnd - tStart, 1);
                const leftPct = Math.max(((pStart - tStart) / totalRange) * 100, 0);
                const widthPct = Math.min(((pEnd - pStart) / totalRange) * 100, 100 - leftPct);
                return (
                  <div key={project.id} className="flex items-center gap-3">
                    <div className="w-44 flex-shrink-0 flex items-center gap-2">
                      <span className="text-sm font-medium text-thb-text-primary truncate">{project.name}</span>
                    </div>
                    <div className="flex-1 relative h-8 bg-slate-50 rounded">
                      <div className="absolute top-1 bottom-1 rounded"
                        style={{
                          left: `${leftPct}%`, width: `${Math.max(widthPct, 0.5)}%`,
                          backgroundColor: getTypeColor(project.projectType),
                          opacity: 0.85,
                        }}>
                        <div className="h-full rounded" style={{
                          width: `${project.progress}%`,
                          backgroundColor: getTypeColor(project.projectType),
                          opacity: 1,
                        }} />
                      </div>
                      {/* Progress label */}
                      <span className="absolute text-xs text-thb-text-muted" style={{ left: `${leftPct + widthPct + 1}%`, top: '50%', transform: 'translateY(-50%)' }}>
                        {project.progress}%
                      </span>
                    </div>
                    <span className={getStatusBadge(project.status)}>{formatStatus(project.status)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Project List */}
      <div className="thb-card overflow-hidden">
        <div className="px-5 py-3 border-b border-thb-border">
          <h3 className="font-semibold text-thb-text-primary">Project Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-thb-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-thb-text-secondary">Project</th>
                <th className="text-left px-4 py-3 font-medium text-thb-text-secondary">Type</th>
                <th className="text-left px-4 py-3 font-medium text-thb-text-secondary">Status</th>
                <th className="text-left px-4 py-3 font-medium text-thb-text-secondary">Start</th>
                <th className="text-left px-4 py-3 font-medium text-thb-text-secondary">End</th>
                <th className="text-left px-4 py-3 font-medium text-thb-text-secondary">Progress</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-thb-border hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getTypeColor(p.projectType) }} />
                      <span className="font-medium text-thb-text-primary">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-thb-text-secondary">{p.projectType.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</td>
                  <td className="px-4 py-3"><span className={getStatusBadge(p.status)}>{formatStatus(p.status)}</span></td>
                  <td className="px-4 py-3 text-thb-text-secondary">{formatDate(p.startDate)}</td>
                  <td className="px-4 py-3 text-thb-text-secondary">{formatDate(p.endDate)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-slate-100 rounded-full h-1.5">
                        <div className="rounded-full h-1.5" style={{
                          width: `${p.progress}%`,
                          backgroundColor: getTypeColor(p.projectType),
                        }} />
                      </div>
                      <span className="text-xs text-thb-text-muted">{p.progress}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
