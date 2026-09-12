'use client';

import { useState, useEffect } from 'react';
import { FiCalendar, FiAlertCircle, FiSettings, FiClock, FiCheckCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

interface ReportSchedule {
  id: string;
  name: string;
  reportType: string;
  frequency: string;
  hour: number;
  minute: number;
  timezone: string;
  outputFormat: string;
  isActive: boolean;
  lastRunAt?: string | null;
  lastRunStatus?: string | null;
  lastRunError?: string | null;
  createdAt: string;
}

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function getFrequencyBadge(frequency: string) {
  const colors: Record<string, string> = {
    daily: 'bg-green-50 text-green-700',
    weekly: 'bg-emerald-50 text-emerald-700',
    bi_weekly: 'bg-teal-50 text-teal-700',
    monthly: 'bg-amber-50 text-amber-700',
  };
  return colors[frequency] || 'bg-slate-100 text-slate-600';
}

function getRunStatusIcon(status: string | null | undefined) {
  if (status === 'success') return <FiCheckCircle className="w-4 h-4 text-emerald-500" />;
  if (status === 'failed') return <FiAlertCircle className="w-4 h-4 text-red-500" />;
  return <FiClock className="w-4 h-4 text-slate-400" />;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function GovernanceScheduledReportsPage() {
  const { token } = useAuthStore();
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSchedules() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/governance/scheduled-reports', { headers: getAuthHeaders() });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to fetch scheduled reports (${res.status})`);
        }
        const data = await res.json();
        setSchedules(data.reportSchedules || []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load scheduled reports';
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    }

    if (token) fetchSchedules();
  }, [token]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-green-50">
          <FiCalendar className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-thb-text-primary">Scheduled Reports</h1>
          <p className="text-sm text-thb-text-secondary">Governance · Automated report schedules and delivery</p>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <FiSettings className="w-8 h-8 animate-spin text-green-400" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="thb-card p-8 text-center">
          <FiAlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-600 font-medium">{error}</p>
        </div>
      )}

      {/* Data */}
      {!loading && !error && (
        <>
          {schedules.length === 0 ? (
            <div className="thb-card p-8 text-center">
              <FiCalendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-thb-text-muted">No scheduled reports found</p>
              <p className="text-xs text-thb-text-muted mt-1">Create report schedules from the Reports module</p>
            </div>
          ) : (
            <div className="thb-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider border-b border-thb-border bg-slate-50/50">Report</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider border-b border-thb-border bg-slate-50/50">Type</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider border-b border-thb-border bg-slate-50/50">Frequency</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider border-b border-thb-border bg-slate-50/50">Format</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider border-b border-thb-border bg-slate-50/50">Last Run</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider border-b border-thb-border bg-slate-50/50">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map((sch) => (
                      <tr key={sch.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-thb-text-primary border-b border-thb-border/50">
                          {sch.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary border-b border-thb-border/50">
                          <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                            {sch.reportType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm border-b border-thb-border/50">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getFrequencyBadge(sch.frequency)}`}>
                            {sch.frequency.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary border-b border-thb-border/50 uppercase">{sch.outputFormat}</td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary border-b border-thb-border/50">
                          {sch.lastRunAt ? formatDateTime(sch.lastRunAt) : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm border-b border-thb-border/50">
                          <div className="flex items-center gap-1.5">
                            {getRunStatusIcon(sch.lastRunStatus)}
                            <span className={sch.isActive ? 'text-emerald-600' : 'text-slate-400'}>
                              {sch.isActive ? 'Active' : 'Paused'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
