'use client';

/**
 * Policy Version History + Acknowledgment — shared UI for all Policy pages.
 *
 * - PolicyVersionHistoryButton: opens a modal listing every archived snapshot
 *   of the policy (kept automatically when the policy is updated) with
 *   download links for older PDF/DOCX copies.
 * - PolicyAcknowledgeButton: "I have read this policy" action for the signed-in
 *   employee; records a PolicyAcknowledgment.
 * - PolicyAcknowledgmentTracker: admin modal showing who acknowledged and who
 *   is still pending.
 */
import { useCallback, useEffect, useState } from 'react';
import { FiArchive, FiDownload, FiX, FiCheckCircle, FiClock, FiUsers, FiCheck } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { formatPolicyFileSize } from './PolicyFileField';

const btnBase = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors';

interface PolicyVersion {
  id: string;
  versionNumber: number;
  version: string;
  title: string;
  description?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  fileMimeType?: string | null;
  changeNote?: string | null;
  archivedAt: string;
  fileUrl?: string | null;
}

export function PolicyVersionHistoryButton({ policyId, className, iconOnly }: { policyId: string; className?: string; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<PolicyVersion[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/policies/${policyId}/versions`);
      const data = await res.json();
      setVersions(data.versions || []);
    } catch {
      toast.error('Failed to load version history');
    } finally {
      setLoading(false);
    }
  }, [policyId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Version history" className={className || `${btnBase} bg-slate-100 text-slate-600 hover:bg-slate-200`}>
        <FiArchive className="w-3.5 h-3.5" />{!iconOnly && ' History'}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-thb-border">
              <div className="flex items-center gap-2">
                <FiArchive className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-semibold text-thb-text-primary">Version History</h3>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><FiX className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto p-5 space-y-3">
              {loading ? (
                <p className="text-sm text-thb-text-muted py-6 text-center">Loading versions…</p>
              ) : versions.length === 0 ? (
                <div className="text-center py-8">
                  <FiArchive className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-thb-text-muted">No archived versions yet.</p>
                  <p className="text-xs text-thb-text-muted mt-1">Each time this policy is updated, the previous copy (including its document) is automatically archived here.</p>
                </div>
              ) : (
                versions.map((v) => (
                  <div key={v.id} className="rounded-lg border border-thb-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-thb-text-primary">{v.title}</span>
                          <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 text-[10px] font-semibold">v{v.version}</span>
                          <span className="text-[10px] text-thb-text-muted">snapshot #{v.versionNumber}</span>
                        </div>
                        {v.description && <p className="text-xs text-thb-text-secondary mt-1 line-clamp-2">{v.description}</p>}
                        <p className="text-[10px] text-thb-text-muted mt-1.5">
                          Archived {new Date(v.archivedAt).toLocaleString()}{v.changeNote ? ` — ${v.changeNote}` : ''}
                        </p>
                      </div>
                      {v.fileUrl && (
                        <a
                          href={v.fileUrl}
                          {...(v.fileUrl.startsWith('data:') ? { download: v.fileName || `policy-v${v.version}` } : { target: '_blank', rel: 'noopener noreferrer' })}
                          className={`${btnBase} bg-teal-50 text-teal-700 hover:bg-teal-100 shrink-0`}
                        >
                          <FiDownload className="w-3.5 h-3.5" />
                          {v.fileUrl.startsWith('data:') ? 'Download' : 'Open'}
                        </a>
                      )}
                    </div>
                    {v.fileName && <p className="text-[11px] text-thb-text-muted mt-2">{v.fileName}{v.fileSize ? ` · ${formatPolicyFileSize(v.fileSize)}` : ''}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Self-service "I have read this policy" button. */
export function PolicyAcknowledgeButton({ policyId, className }: { policyId: string; className?: string }) {
  const [state, setState] = useState<'loading' | 'unknown' | 'acked' | 'not_acked'>('loading');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/policies/acknowledgments?mine=1');
        const data = await res.json();
        if (!alive) return;
        const mine = (data.acknowledgments || []).some((a: { policyId: string }) => a.policyId === policyId);
        setState(mine ? 'acked' : 'not_acked');
      } catch {
        if (alive) setState('unknown');
      }
    })();
    return () => { alive = false; };
  }, [policyId]);

  const acknowledge = async () => {
    try {
      const res = await fetch('/api/policies/acknowledgments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setState('acked');
      toast.success(data.message || 'Policy acknowledged — thank you!');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to record acknowledgment');
    }
  };

  if (state === 'loading' || state === 'unknown') return null;
  if (state === 'acked') {
    return (
      <span className={`${className || btnBase} bg-emerald-50 text-emerald-700 cursor-default`}>
        <FiCheckCircle className="w-3.5 h-3.5" /> Acknowledged
      </span>
    );
  }
  return (
    <button type="button" onClick={acknowledge} className={className || `${btnBase} bg-emerald-600 text-white hover:bg-emerald-700`}>
      <FiCheck className="w-3.5 h-3.5" /> I Have Read This Policy
    </button>
  );
}

interface AckRow {
  employeeId: string;
  employeeCode?: string;
  name: string;
  email?: string;
  acknowledged: boolean;
  acknowledgedAt?: string | null;
  method?: string | null;
}

/** Admin tracking modal: who acknowledged / who is pending. */
export function PolicyAcknowledgmentTracker({ policyId, className }: { policyId: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AckRow[]>([]);
  const [summary, setSummary] = useState<{ total: number; acknowledged: number; pending: number } | null>(null);
  const [filter, setFilter] = useState<'all' | 'acked' | 'pending'>('all');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/policies/acknowledgments?policyId=${policyId}`);
        const data = await res.json();
        setRows(data.rows || []);
        setSummary(data.summary || null);
      } catch {
        toast.error('Failed to load acknowledgment status');
      } finally {
        setLoading(false);
      }
    })();
  }, [open, policyId]);

  const shown = rows.filter((r) => filter === 'all' || (filter === 'acked' ? r.acknowledged : !r.acknowledged));

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Acknowledgment status" className={className || `${btnBase} bg-indigo-50 text-indigo-700 hover:bg-indigo-100`}>
        <FiUsers className="w-3.5 h-3.5" /> Ack Status{summary ? ` (${summary.acknowledged}/${summary.total})` : ''}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-thb-border">
              <div className="flex items-center gap-2">
                <FiUsers className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-semibold text-thb-text-primary">Policy Acknowledgments</h3>
                {summary && (
                  <span className="text-xs text-thb-text-muted">
                    {summary.acknowledged} acknowledged · {summary.pending} pending of {summary.total}
                  </span>
                )}
              </div>
              <button type="button" onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><FiX className="w-4 h-4" /></button>
            </div>
            <div className="px-5 pt-3 flex gap-2">
              {(['all', 'acked', 'pending'] as const).map((f) => (
                <button key={f} type="button" onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${filter === f ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {f === 'all' ? 'All' : f === 'acked' ? 'Acknowledged' : 'Pending'}
                </button>
              ))}
            </div>
            <div className="overflow-y-auto p-5 pt-3 space-y-2">
              {loading ? (
                <p className="text-sm text-thb-text-muted py-6 text-center">Loading…</p>
              ) : shown.length === 0 ? (
                <p className="text-sm text-thb-text-muted py-6 text-center">No employees {filter === 'pending' ? 'pending' : 'in this view'}.</p>
              ) : (
                shown.map((r) => (
                  <div key={r.employeeId} className="flex items-center justify-between gap-3 rounded-lg border border-thb-border px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-thb-text-primary truncate">{r.name}{r.employeeCode ? ` · ${r.employeeCode}` : ''}</p>
                      {r.email && <p className="text-[11px] text-thb-text-muted truncate">{r.email}</p>}
                    </div>
                    {r.acknowledged ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 shrink-0" title={r.acknowledgedAt ? new Date(r.acknowledgedAt).toLocaleString() : ''}>
                        <FiCheckCircle className="w-4 h-4" /> {r.acknowledgedAt ? new Date(r.acknowledgedAt).toLocaleDateString() : 'Acknowledged'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 shrink-0"><FiClock className="w-4 h-4" /> Pending</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
