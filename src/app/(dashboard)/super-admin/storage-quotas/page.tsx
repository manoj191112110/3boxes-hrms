'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FiHardDrive, FiSave, FiAlertCircle, FiRefreshCw,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface StorageQuota {
  id: string;
  tenantId: string;
  totalQuotaBytes: number;
  usedQuotaBytes: number;
  personalQuotaBytes: number;
  projectQuotaBytes: number;
  companyQuotaBytes: number;
  quotaAlertThreshold: number;
  notes: string | null;
}

export default function StorageQuotasPage() {
  const { user } = useAuthStore();
  const [quotas, setQuotas] = useState<StorageQuota[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Record<string, Partial<StorageQuota>>>({});

  const fetchQuotas = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/collaboration/storage-quotas', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setQuotas(data.quotas || (data.quota ? [data.quota] : []));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuotas();
  }, [fetchQuotas]);

  const handleSave = async (tenantId: string) => {
    const updates = editing[tenantId];
    if (!updates) return;
    try {
      const res = await fetch('/api/collaboration/storage-quotas', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ tenantId, ...updates }),
      });
      if (res.ok) {
        toast.success('Quota updated');
        setEditing((prev) => {
          const next = { ...prev };
          delete next[tenantId];
          return next;
        });
        fetchQuotas();
      } else {
        toast.error('Failed to update quota');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update quota');
    }
  };

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  const updateField = (tenantId: string, field: keyof StorageQuota, value: string | number) => {
    setEditing((prev) => ({
      ...prev,
      [tenantId]: { ...prev[tenantId], [field]: typeof value === 'string' && field !== 'notes' ? parseInt(value, 10) || 0 : value },
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiHardDrive className="w-6 h-6 text-teal-500" />
            Storage Quotas
          </h1>
          <p className="text-sm text-thb-text-secondary mt-1">
            Define how much File/Chat storage space each Parent Company is allowed based on their subscription tier
          </p>
        </div>
        <button
          onClick={fetchQuotas}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-thb-text-secondary hover:bg-slate-100 rounded-md"
        >
          <FiRefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <div className="thb-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-thb-text-muted">Loading...</div>
        ) : quotas.length === 0 ? (
          <div className="p-8 text-center text-sm text-thb-text-muted">No quotas configured</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs text-thb-text-muted uppercase tracking-wider">
                <th className="px-4 py-2 font-medium">Tenant ID</th>
                <th className="px-4 py-2 font-medium">Total Quota</th>
                <th className="px-4 py-2 font-medium">Used</th>
                <th className="px-4 py-2 font-medium">Usage %</th>
                <th className="px-4 py-2 font-medium">Personal</th>
                <th className="px-4 py-2 font-medium">Project</th>
                <th className="px-4 py-2 font-medium">Company</th>
                <th className="px-4 py-2 font-medium">Alert Threshold</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-thb-border">
              {quotas.map((q) => {
                const edits = editing[q.tenantId] || {};
                const usagePercent = q.totalQuotaBytes > 0 ? (q.usedQuotaBytes / q.totalQuotaBytes) * 100 : 0;
                const isOverThreshold = usagePercent >= (edits.quotaAlertThreshold ?? q.quotaAlertThreshold) * 100;
                return (
                  <tr key={q.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs font-mono text-thb-text-secondary">{q.tenantId.substring(0, 12)}...</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        defaultValue={q.totalQuotaBytes}
                        onChange={(e) => updateField(q.tenantId, 'totalQuotaBytes', e.target.value)}
                        className="w-24 px-2 py-1 text-xs border border-thb-border rounded"
                      />
                      <span className="text-[10px] text-thb-text-muted ml-1">B</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-thb-text-secondary">{formatBytes(q.usedQuotaBytes)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${isOverThreshold ? 'bg-red-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(100, usagePercent)}%` }}
                          />
                        </div>
                        <span className={`text-xs ${isOverThreshold ? 'text-red-600' : 'text-thb-text-secondary'}`}>
                          {usagePercent.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        defaultValue={q.personalQuotaBytes}
                        onChange={(e) => updateField(q.tenantId, 'personalQuotaBytes', e.target.value)}
                        className="w-20 px-2 py-1 text-xs border border-thb-border rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        defaultValue={q.projectQuotaBytes}
                        onChange={(e) => updateField(q.tenantId, 'projectQuotaBytes', e.target.value)}
                        className="w-20 px-2 py-1 text-xs border border-thb-border rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        defaultValue={q.companyQuotaBytes}
                        onChange={(e) => updateField(q.tenantId, 'companyQuotaBytes', e.target.value)}
                        className="w-20 px-2 py-1 text-xs border border-thb-border rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        step="0.05"
                        defaultValue={q.quotaAlertThreshold}
                        onChange={(e) => updateField(q.tenantId, 'quotaAlertThreshold', e.target.value)}
                        className="w-16 px-2 py-1 text-xs border border-thb-border rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleSave(q.tenantId)}
                        disabled={!edits[q.tenantId]}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50"
                      >
                        <FiSave className="w-3 h-3" />
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="p-4 rounded-lg bg-amber-50 border border-amber-100 flex items-start gap-2">
        <FiAlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-amber-800">
          <strong>Super Admin capability.</strong> Storage quotas define the maximum disk space each Parent Company (tenant) can use
          for File Hub storage and chat attachments. When a tenant exceeds the alert threshold, the system notifies the Tenant Admin
          to request cleanup. Hard limit at 100% blocks further uploads.
        </div>
      </div>
    </div>
  );
}
