'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import {
  FiArrowLeft, FiFileText, FiRefreshCw, FiExternalLink,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Offer {
  id: string;
  candidateName: string;
  candidateEmail: string;
  position: string;
  department: string | null;
  offeredSalary: number;
  offeredCurrency: string;
  offeredCTC: number | null;
  joiningDate: string;
  probationPeriod: number;
  reportingTo: string | null;
  status: string;
  templateId: string | null;
  generatedPdfUrl: string | null;
  generatedAt: string | null;
  signedPdfUrl: string | null;
  signedAt: string | null;
  esignProvider: string | null;
  esignEnvelopeId: string | null;
}

function OfferPreviewContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const envelopeId = searchParams.get('envelopeId');
  const offerId = params?.id;

  const [offer, setOffer] = useState<Offer | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [signing, setSigning] = useState(false);

  const fetchOffer = useCallback(async () => {
    if (!offerId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/offers/${offerId}`, { headers: getAuthHeaders() });
      if (!res.ok) {
        toast.error('Failed to load offer');
        return;
      }
      const data = await res.json();
      const o = data.offer || data;
      setOffer(o);
      if (o?.generatedPdfUrl) {
        const url = o.generatedPdfUrl;
        if (url.startsWith('data:text/html')) {
          const commaIdx = url.indexOf(',');
          setPreviewHtml(decodeURIComponent(url.slice(commaIdx + 1)));
        } else {
          setPreviewHtml('');
        }
      } else {
        setPreviewHtml('');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load offer');
    } finally {
      setLoading(false);
    }
  }, [offerId]);

  useEffect(() => {
    queueMicrotask(() => fetchOffer());
  }, [fetchOffer]);

  const handleRegenerate = async () => {
    if (!offerId) return;
    try {
      setRegenerating(true);
      const res = await fetch(`/api/offers/${offerId}/generate-pdf`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to generate preview');
      }
      const data = await res.json();
      if (data.html) setPreviewHtml(data.html);
      else if (data.offer?.generatedPdfUrl) {
        const url = data.offer.generatedPdfUrl;
        if (url.startsWith('data:text/html')) {
          const commaIdx = url.indexOf(',');
          setPreviewHtml(decodeURIComponent(url.slice(commaIdx + 1)));
        }
      }
      toast.success('Offer preview regenerated');
      fetchOffer();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setRegenerating(false);
    }
  };

  const handleSign = async () => {
    if (!offerId) return;
    try {
      setSigning(true);
      const res = await fetch(`/api/offers/${offerId}/sign`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ envelopeId: envelopeId || offer?.esignEnvelopeId || '' }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to sign offer');
      }
      toast.success('Offer signed successfully — status set to accepted');
      fetchOffer();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to sign');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return <div className="thb-card p-12 text-center text-thb-text-muted">Loading offer...</div>;
  }

  if (!offer) {
    return (
      <div className="thb-card p-12 text-center">
        <FiFileText className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
        <p className="text-thb-text-secondary font-medium">Offer not found</p>
        <Link href="/offers" className="inline-flex items-center gap-2 mt-4 text-sm text-green-600 hover:underline">
          <FiArrowLeft className="w-4 h-4" /> Back to Offers
        </Link>
      </div>
    );
  }

  const alreadySigned = !!(offer.signedPdfUrl && offer.signedAt);
  const showSignButton = !!envelopeId && !alreadySigned;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link href="/offers" className="inline-flex items-center gap-1 text-xs text-thb-text-muted hover:text-thb-text-primary">
            <FiArrowLeft className="w-3 h-3" /> Back to Offers
          </Link>
          <h1 className="text-2xl font-bold text-thb-text-primary mt-1">
            Offer Preview — {offer.candidateName}
          </h1>
          <p className="text-thb-text-secondary mt-1 text-sm">
            {offer.position} • {offer.offeredCurrency} {offer.offeredSalary?.toLocaleString()} • Joining {offer.joiningDate ? new Date(offer.joiningDate).toLocaleDateString() : '—'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <FiRefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
            {regenerating ? 'Regenerating...' : 'Regenerate'}
          </button>
          {showSignButton && (
            <button
              onClick={handleSign}
              disabled={signing || alreadySigned}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 shadow-sm shadow-emerald-500/25 transition-colors"
            >
              {signing ? 'Signing...' : alreadySigned ? 'Signed' : 'Sign Now'}
            </button>
          )}
          {alreadySigned && (
            <span className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              Signed on {new Date(offer.signedAt as string).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      <div className="thb-card p-3 flex flex-wrap items-center gap-3 text-xs">
        <span className="text-thb-text-secondary">Status:</span>
        <span className={`px-2 py-0.5 rounded-full font-medium ${offer.status === 'accepted' ? 'bg-emerald-50 text-emerald-700' : offer.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
          {offer.status}
        </span>
        {offer.templateId && (
          <span className="text-thb-text-muted">Template: <span className="font-mono">{offer.templateId.slice(0, 8)}...</span></span>
        )}
        {offer.generatedAt && (
          <span className="text-thb-text-muted">Generated: {new Date(offer.generatedAt).toLocaleString()}</span>
        )}
        {offer.esignEnvelopeId && (
          <span className="text-thb-text-muted">Envelope: <span className="font-mono">{offer.esignEnvelopeId}</span></span>
        )}
        {offer.esignProvider && (
          <span className="text-thb-text-muted">Provider: {offer.esignProvider}</span>
        )}
        {offer.signedPdfUrl && (
          <a href={offer.signedPdfUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-green-600 hover:underline">
            <FiExternalLink className="w-3 h-3" /> View Signed Copy
          </a>
        )}
      </div>

      <div className="thb-card overflow-hidden">
        {previewHtml ? (
          <iframe title="Offer Letter Preview" srcDoc={previewHtml} className="w-full h-[800px] bg-white" sandbox="allow-same-origin allow-popups" />
        ) : (
          <div className="p-12 text-center">
            <FiFileText className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
            <p className="text-thb-text-secondary font-medium">No preview generated yet</p>
            <p className="text-sm text-thb-text-muted mt-1">Click &quot;Regenerate&quot; to render the offer letter.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OfferPreviewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[40vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto" /></div>}>
      <OfferPreviewContent />
    </Suspense>
  );
}
