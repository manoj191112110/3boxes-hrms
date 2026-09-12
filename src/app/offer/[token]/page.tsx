'use client';

/**
 * /offer/[token] — PUBLIC candidate offer acceptance page.
 *
 * Candidates open the secure link shared by HR (no login required), review
 * the offer, and Accept (typed-name e-signature) or Decline with optional
 * comments. Works on any tenant subdomain — the middleware resolves the
 * tenant from the host.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { FiCheckCircle, FiXCircle, FiFileText, FiCalendar, FiUser, FiBriefcase, FiAward, FiLoader } from 'react-icons/fi';

interface OfferData {
  id: string;
  candidateName: string;
  position: string;
  department?: string | null;
  offeredSalary: number;
  offeredCurrency: string;
  offeredCTC?: number | null;
  joiningDate: string;
  probationPeriod: number;
  reportingTo?: string | null;
  status: string;
  generatedPdfUrl?: string | null;
  respondedAt?: string | null;
  candidateSignature?: string | null;
  candidateSignedAt?: string | null;
  responseNotes?: string | null;
}

const fmtMoney = (n: number, cur: string) => {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur || 'INR', maximumFractionDigits: 0 }).format(n); }
  catch { return `${cur} ${n}`; }
};

const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return d; } };

export default function OfferAcceptancePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const [offer, setOffer] = useState<OfferData | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signature, setSignature] = useState('');
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ action: 'accept' | 'decline'; message: string } | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/offers/accept/${token}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load offer');
      setOffer(data.offer);
      setCompanyName(data.companyName || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load offer');
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const respond = async (action: 'accept' | 'decline') => {
    if (action === 'accept' && !signature.trim()) { setError('Please type your full name to sign the offer.'); return; }
    if (action === 'decline' && !window.confirm('Are you sure you want to decline this offer?')) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/offers/accept/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, signatureName: signature.trim(), comments }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit');
      setResult({ action, message: data.message });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit');
    } finally { setSubmitting(false); }
  };

  const actionable = offer && ['sent', 'approved'].includes(offer.status);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50/40 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center text-white font-bold text-sm">3B</div>
            {companyName && <span className="text-sm font-semibold text-slate-700">{companyName}</span>}
          </div>
          <h1 className="text-xl font-bold text-slate-800">Your Offer from {companyName || 'the company'}</h1>
          <p className="text-xs text-slate-500 mt-1">Review the details below and record your response securely.</p>
        </div>

        {loading && (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
            <FiLoader className="w-8 h-8 text-teal-500 mx-auto animate-spin" />
            <p className="text-sm text-slate-500 mt-3">Loading your offer…</p>
          </div>
        )}

        {!loading && error && !offer && (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
            <FiXCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-700">{error}</p>
            <p className="text-xs text-slate-400 mt-1">Please contact HR for a fresh offer link.</p>
          </div>
        )}

        {!loading && offer && (
          <>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-teal-600 text-white px-6 py-5">
                <p className="text-xs text-teal-100 uppercase tracking-wide">Offer Letter</p>
                <h2 className="text-lg font-bold">{offer.candidateName}</h2>
                <p className="text-sm text-teal-50">{offer.position}{offer.department ? ` · ${offer.department}` : ''}</p>
              </div>
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-2.5"><FiAward className="w-4 h-4 text-teal-600 mt-0.5" /><div><p className="text-[11px] text-slate-400">Annual CTC</p><p className="text-sm font-semibold text-slate-800">{offer.offeredCTC ? fmtMoney(offer.offeredCTC, offer.offeredCurrency) : fmtMoney(offer.offeredSalary, offer.offeredCurrency)}</p></div></div>
                <div className="flex items-start gap-2.5"><FiCalendar className="w-4 h-4 text-teal-600 mt-0.5" /><div><p className="text-[11px] text-slate-400">Joining Date</p><p className="text-sm font-semibold text-slate-800">{offer.joiningDate ? fmtDate(offer.joiningDate) : '—'}</p></div></div>
                <div className="flex items-start gap-2.5"><FiBriefcase className="w-4 h-4 text-teal-600 mt-0.5" /><div><p className="text-[11px] text-slate-400">Probation Period</p><p className="text-sm font-semibold text-slate-800">{offer.probationPeriod} days</p></div></div>
                <div className="flex items-start gap-2.5"><FiUser className="w-4 h-4 text-teal-600 mt-0.5" /><div><p className="text-[11px] text-slate-400">Reporting To</p><p className="text-sm font-semibold text-slate-800">{offer.reportingTo || '—'}</p></div></div>
              </div>
              {offer.generatedPdfUrl && offer.generatedPdfUrl.startsWith('data:') && (
                <div className="px-6 pb-5">
                  <a href={offer.generatedPdfUrl} download="offer-letter.html" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-50 text-teal-700 text-xs font-medium hover:bg-teal-100">
                    <FiFileText className="w-3.5 h-3.5" /> View Full Offer Letter
                  </a>
                </div>
              )}
            </div>

            {result ? (
              <div className={`rounded-2xl shadow-sm p-6 text-center ${result.action === 'accept' ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                <FiCheckCircle className={`w-10 h-10 mx-auto mb-3 ${result.action === 'accept' ? 'text-emerald-600' : 'text-amber-600'}`} />
                <p className={`text-sm font-semibold ${result.action === 'accept' ? 'text-emerald-800' : 'text-amber-800'}`}>{result.message}</p>
                {result.action === 'accept' && <p className="text-xs text-emerald-700 mt-2">HR has been notified and will share your onboarding details shortly.</p>}
              </div>
            ) : actionable ? (
              <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
                <h3 className="text-sm font-semibold text-slate-800">Record Your Response</h3>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Type your full name (e-signature) *</label>
                  <input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Your full legal name" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" />
                  <p className="text-[10px] text-slate-400 mt-1">Typing your full name acts as your legally binding electronic signature on this offer.</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Comments (optional)</label>
                  <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Any note for HR (optional)" />
                </div>
                {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button onClick={() => respond('accept')} disabled={submitting} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
                    <FiCheckCircle className="w-4 h-4" /> {submitting ? 'Submitting…' : 'Accept Offer'}
                  </button>
                  <button onClick={() => respond('decline')} disabled={submitting} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
                    <FiXCircle className="w-4 h-4" /> Decline
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
                <p className="text-sm font-medium text-slate-700">
                  {offer.status === 'accepted' ? 'You have accepted this offer' : offer.status === 'rejected' ? 'You declined this offer' : `This offer is currently "${offer.status}"`}
                  {offer.respondedAt ? ` — ${fmtDate(offer.respondedAt)}` : ''}
                </p>
                {offer.status === 'accepted' && offer.candidateSignature && <p className="text-xs text-slate-500 mt-1">Signed: {offer.candidateSignature}</p>}
              </div>
            )}
          </>
        )}

        <p className="text-center text-[10px] text-slate-400">This is a secure, tokenized link. Do not share it with others.</p>
      </div>
    </div>
  );
}
