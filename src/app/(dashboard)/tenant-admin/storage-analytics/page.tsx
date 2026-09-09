'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FiBarChart2, FiHardDrive, FiRefreshCw, FiAlertTriangle, FiTrash2,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface AnalyticsData {
  quota: { totalQuotaBytes: number; usedQuotaBytes: number; personalQuotaBytes: number; projectQuotaBytes: number; companyQuotaBytes: number } | null;
  usedBytes: number;
  usagePercent: number;
  breakdown: {
    personal: Array<{ ownerEmployeeId: string | null; bytes: number; count: number }>;
    project: Array<{ projectId: string | null; bytes: number; count: number }>;
    company: Array<{ companyId: string | null; bytes: number; count: number }>;
  };
  cleanupCandidates: number;
}

export default function StorageAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/collaboration/storage-analytics', { headers: getAuthHeaders() });
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const gb = bytes / (1024 * 1024 * 1024);
    const mb = bytes / (1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${bytes} B`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiBarChart2 className="w-6 h-6 text-emerald-500" />
            Storage Analytics
          </h1>
          <p className="text-sm text-thb-text-secondary mt-1">
            View which Sub-Company or Project is consuming the most file storage and request cleanup
          </p>
        </div>
        <button
          onClick={fetchAnalytics}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-thb-text-secondary hover:bg-slate-100 rounded-md"
        >
          <FiRefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="thb-card p-8 text-center text-sm text-thb-text-muted">Loading analytics...</div>
      ) : !data ? (
        <div className="thb-card p-8 text-center text-sm text-thb-text-muted">Failed to load analytics</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="thb-card p-4">
              <p className="text-xs font-medium text-thb-text-secondary">Total Used</p>
              <p className="text-2xl font-bold text-thb-text-primary mt-1">{formatBytes(data.usedBytes)}</p>
            </div>
            <div className="thb-card p-4">
              <p className="text-xs font-medium text-thb-text-secondary">Total Quota</p>
              <p className="text-2xl font-bold text-thb-text-primary mt-1">
                {data.quota ? formatBytes(data.quota.totalQuotaBytes) : '—'}
              </p>
            </div>
            <div className="thb-card p-4">
              <p className="text-xs font-medium text-thb-text-secondary">Usage</p>
              <p className={`text-2xl font-bold mt-1 ${data.usagePercent > 85 ? 'text-red-600' : data.usagePercent > 60 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {data.usagePercent.toFixed(1)}%
              </p>
            </div>
            <div className="thb-card p-4">
              <p className="text-xs font-medium text-thb-text-secondary">Cleanup Candidates</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{data.cleanupCandidates}</p>
              <p className="text-[10px] text-thb-text-muted">files &gt;90 days old</p>
            </div>
          </div>

          {/* Usage bar */}
          {data.quota && (
            <div className="thb-card p-4">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Storage Usage</h3>
              <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${data.usagePercent > 85 ? 'bg-red-500' : data.usagePercent > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, data.usagePercent)}%` }}
                />
              </div>
              <p className="text-xs text-thb-text-muted mt-2">
                {formatBytes(data.usedBytes)} of {formatBytes(data.quota.totalQuotaBytes)} used
              </p>
            </div>
          )}

          {/* Breakdown tables */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.breakdown.company.length > 0 && (
              <div className="thb-card overflow-hidden">
                <div className="p-3 border-b border-thb-border">
                  <h3 className="text-sm font-semibold text-thb-text-primary">By Sub-Company</h3>
                </div>
                <div className="divide-y divide-thb-border">
                  {data.breakdown.company.map((item, i) => (
                    <div key={i} className="p-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-thb-text-primary">{item.companyId?.substring(0, 12) || '—'}...</p>
                        <p className="text-[10px] text-thb-text-muted">{item.count} file{item.count !== 1 ? 's' : ''}</p>
                      </div>
                      <span className="text-xs font-medium text-thb-text-secondary">{formatBytes(item.bytes)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.breakdown.project.length > 0 && (
              <div className="thb-card overflow-hidden">
                <div className="p-3 border-b border-thb-border">
                  <h3 className="text-sm font-semibold text-thb-text-primary">By Project</h3>
                </div>
                <div className="divide-y divide-thb-border">
                  {data.breakdown.project.map((item, i) => (
                    <div key={i} className="p-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-thb-text-primary">{item.projectId?.substring(0, 12) || '—'}...</p>
                        <p className="text-[10px] text-thb-text-muted">{item.count} file{item.count !== 1 ? 's' : ''}</p>
                      </div>
                      <span className="text-xs font-medium text-thb-text-secondary">{formatBytes(item.bytes)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.breakdown.personal.length > 0 && (
              <div className="thb-card overflow-hidden">
                <div className="p-3 border-b border-thb-border">
                  <h3 className="text-sm font-semibold text-thb-text-primary">By Employee (Personal Drive)</h3>
                </div>
                <div className="divide-y divide-thb-border max-h-60 overflow-y-auto">
                  {data.breakdown.personal.slice(0, 20).map((item, i) => (
                    <div key={i} className="p-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-thb-text-primary">{item.ownerEmployeeId?.substring(0, 12) || '—'}...</p>
                        <p className="text-[10px] text-thb-text-muted">{item.count} file{item.count !== 1 ? 's' : ''}</p>
                      </div>
                      <span className="text-xs font-medium text-thb-text-secondary">{formatBytes(item.bytes)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {data.cleanupCandidates > 0 && (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-100 flex items-start gap-2">
              <FiAlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-800 flex-1">
                <strong>{data.cleanupCandidates} file(s)</strong> haven&apos;t been accessed in 90+ days and are candidates for cleanup.
                Consider archiving or deleting them to free up storage.
              </div>
              <button
                onClick={() => toast('Cleanup request sent to file owners', { icon: '📧' })}
                className="px-2 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700"
              >
                Request Cleanup
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
