'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  FiCheckCircle, FiAlertCircle, FiMail, FiArrowLeft, FiSend,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

interface SurveyContext {
  survey: {
    id: string;
    token: string;
    primaryReason: string | null;
    comments: string | null;
    openToFuture: boolean | null;
    submittedAt: string | null;
    createdAt: string;
  } | null;
  offer: {
    id: string;
    candidateName: string;
    position: string;
    department: string | null;
    offeredSalary: number;
    offeredCurrency: string;
  } | null;
}

const REASON_OPTIONS = [
  { value: 'compensation_too_low', label: 'Compensation was too low' },
  { value: 'accepted_another_offer', label: 'Accepted another offer' },
  { value: 'location', label: 'Location / commute' },
  { value: 'role_fit', label: 'Role was not a good fit' },
  { value: 'benefits', label: 'Benefits package' },
  { value: 'counter_offer', label: 'Current employer counter-offered' },
  { value: 'personal', label: 'Personal reasons' },
  { value: 'other', label: 'Other' },
];

export default function DeclineSurveyPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;

  const [ctx, setCtx] = useState<SurveyContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [primaryReason, setPrimaryReason] = useState('');
  const [comments, setComments] = useState('');
  const [openToFuture, setOpenToFuture] = useState<boolean | null>(null);

  const fetchSurvey = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/offers/decline-survey/${token}`);
      if (!res.ok) {
        if (res.status === 404) {
          toast.error('Survey not found or has expired');
        } else {
          toast.error('Failed to load survey');
        }
        return;
      }
      const data = await res.json();
      setCtx(data);
      if (data.survey?.submittedAt) {
        setSubmitted(true);
        setPrimaryReason(data.survey.primaryReason || '');
        setComments(data.survey.comments || '');
        setOpenToFuture(data.survey.openToFuture);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load survey');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    queueMicrotask(() => fetchSurvey());
  }, [fetchSurvey]);

  const handleSubmit = async () => {
    if (!token) return;
    if (!primaryReason) {
      toast.error('Please select a primary reason');
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch(`/api/offers/decline-survey/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryReason,
          comments: comments || undefined,
          openToFuture: openToFuture === null ? undefined : openToFuture,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        if (res.status === 409) {
          // Already submitted
          setSubmitted(true);
          toast.success('Survey already submitted');
          return;
        }
        throw new Error(d.error || 'Failed to submit survey');
      }
      setSubmitted(true);
      toast.success('Thank you — your feedback has been recorded');
      fetchSurvey();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-green-50 p-6">
        <div className="text-thb-text-muted text-sm">Loading survey...</div>
      </div>
    );
  }

  if (!ctx?.survey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-green-50 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <FiAlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900">Survey Not Found</h1>
          <p className="text-sm text-slate-600 mt-2">
            This decline survey link is invalid, has expired, or has already been removed.
            If you believe this is an error, please reach out to the recruiter who sent you the offer.
          </p>
        </div>
      </div>
    );
  }

  const survey = ctx.survey;
  const offer = ctx.offer;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mb-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-green-50 flex-shrink-0">
              <FiMail className="w-6 h-6 text-green-500" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Quick Feedback on Your Offer
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Hi {offer?.candidateName || 'there'} — sorry the offer for{' '}
                <strong>{offer?.position || 'the role'}</strong> didn&apos;t work out.
                Would you mind sharing why? It will help us improve.
              </p>
              <p className="text-xs text-slate-500 mt-2">
                This survey is anonymous in our analytics and takes less than a minute.
              </p>
            </div>
          </div>
        </div>

        {/* Form / Confirmation */}
        {submitted ? (
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 text-center">
            <FiCheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900">Thank you for your feedback</h2>
            <p className="text-sm text-slate-600 mt-2">
              Your response has been recorded. We appreciate you taking the time to share.
            </p>
            {survey.submittedAt && (
              <p className="text-xs text-slate-400 mt-3">
                Submitted on {new Date(survey.submittedAt).toLocaleString()}
              </p>
            )}
            <div className="mt-6 pt-6 border-t border-slate-100 text-left">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Your Response</p>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-slate-500">Reason:</span>{' '}
                  <span className="font-medium text-slate-900">
                    {REASON_OPTIONS.find((r) => r.value === survey.primaryReason)?.label || survey.primaryReason}
                  </span>
                </div>
                {survey.comments && (
                  <div>
                    <span className="text-slate-500">Comments:</span>{' '}
                    <span className="text-slate-900">{survey.comments}</span>
                  </div>
                )}
                {survey.openToFuture !== null && survey.openToFuture !== undefined && (
                  <div>
                    <span className="text-slate-500">Open to future opportunities:</span>{' '}
                    <span className="font-medium text-slate-900">{survey.openToFuture ? 'Yes' : 'No'}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Primary reason for declining <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {REASON_OPTIONS.map((r) => (
                    <label
                      key={r.value}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${primaryReason === r.value ? 'border-green-400 bg-green-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                    >
                      <input
                        type="radio"
                        name="primaryReason"
                        value={r.value}
                        checked={primaryReason === r.value}
                        onChange={(e) => setPrimaryReason(e.target.value)}
                        className="text-green-500 focus:ring-green-400"
                      />
                      <span className="text-sm text-slate-700">{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Additional comments <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={4}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  placeholder="Anything else you'd like to share? Salary expectations, role concerns, interview feedback..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Would you be open to future opportunities with us? <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setOpenToFuture(true)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${openToFuture === true ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    Yes, please keep in touch
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenToFuture(false)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${openToFuture === false ? 'border-slate-400 bg-slate-100 text-slate-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    No thanks
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !primaryReason}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-green-500 text-white text-sm font-semibold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-green-500/25 transition-colors"
                >
                  <FiSend className="w-4 h-4" />
                  {submitting ? 'Submitting...' : 'Submit Feedback'}
                </button>
                <p className="text-xs text-slate-400 mt-3">
                  By submitting, you agree to let us use this feedback anonymously to improve our hiring process.
                  Your personal data will not be shared externally.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="text-center mt-6">
          <Link
            href="https://marqai.tech"
            className="text-xs text-slate-400 hover:text-slate-600"
            target="_blank"
            rel="noreferrer"
          >
            Powered by Marq AI Tech Pvt Ltd HRMS
          </Link>
        </div>
      </div>
    </div>
  );
}
