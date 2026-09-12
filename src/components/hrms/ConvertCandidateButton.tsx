'use client';

/**
 * ConvertCandidateButton — shared one-click "Convert to Employee" action for
 * accepted offers (offers page) and hired applications (recruitment pages).
 *
 * Opens a small modal for joining date + probation period, then calls
 * POST /api/recruitment/convert which runs the onboarding cascade:
 * employee record, preboarding pipeline, auto-generated checklist, and
 * IT / Admin / Finance notifications.
 */
import { useState } from 'react';
import { FiUserPlus, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export default function ConvertCandidateButton({
  offerId, applicationId, candidateId, defaultJoiningDate, defaultProbationDays, label, className,
}: {
  offerId?: string | null;
  applicationId?: string | null;
  candidateId?: string | null;
  defaultJoiningDate?: string | null;
  defaultProbationDays?: number | null;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [joiningDate, setJoiningDate] = useState(() => {
    const d = defaultJoiningDate ? new Date(defaultJoiningDate) : new Date();
    return d.toISOString().slice(0, 10);
  });
  const [probation, setProbation] = useState(String(defaultProbationDays || 90));
  const [converting, setConverting] = useState(false);

  const convert = async () => {
    setConverting(true);
    try {
      const res = await fetch('/api/recruitment/convert', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          offerId: offerId || undefined,
          applicationId: applicationId || undefined,
          candidateId: candidateId || undefined,
          joiningDate,
          probationPeriod: Number(probation) || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Conversion failed');
      toast.success(data.message || 'Employee created', { duration: 6000 });
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Conversion failed', { duration: 6000 });
    } finally { setConverting(false); }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Convert to Employee (runs onboarding cascade)"
        className={className || 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-teal-600 text-white hover:bg-teal-700'}
      >
        <FiUserPlus className="w-3.5 h-3.5" /> {label || 'Convert to Employee'}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !converting && setOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-thb-border">
              <h3 className="font-semibold text-sm">Convert to Employee</h3>
              <button onClick={() => setOpen(false)} disabled={converting}><FiX className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-[11px] text-thb-text-muted">
                Creates the employee record (probation status), starts the preboarding pipeline, auto-generates the onboarding checklist, and notifies IT / Admin / Finance for provisioning.
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Joining Date *</label>
                <input type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Probation Period (days)</label>
                <input type="number" value={probation} onChange={(e) => setProbation(e.target.value)} min={0} max={365} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t">
              <button onClick={() => setOpen(false)} disabled={converting} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
              <button onClick={convert} disabled={converting} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">{converting ? 'Converting…' : 'Convert & Start Onboarding'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
