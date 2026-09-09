'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CandidateSettingsPage() {
  const router = useRouter();
  const [showEraseConfirm, setShowEraseConfirm] = useState(false);
  const [eraseReason, setEraseReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_candidate_token') : null;

  async function handleErase() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/candidate-portal/erase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: eraseReason || undefined }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || 'Erasure failed');
        return;
      }
      setResult(d);
      // Clear the candidate token (session is now invalid — their account is deleted)
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('tb_candidate_token');
          router.push('/careers');
        }
      }, 5000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Settings & Privacy</h1>
        <p className="text-sm text-gray-600 mt-1">Manage your data and privacy preferences (REQ-SEC-CAND-02).</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
      )}

      {result ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✓</span>
            <h3 className="font-semibold text-green-800">Your data has been permanently deleted</h3>
          </div>
          <p className="text-sm text-green-700">{result.message}</p>
          {result.deleted && (
            <div className="text-xs text-green-700 bg-white border border-green-200 rounded p-2">
              <b>Deletion log:</b>
              <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
                {Object.entries(result.deleted).map(([k, v]: [string, any]) => (
                  <li key={k}>{k}: <b>{v}</b></li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-green-700">You will be redirected to the careers page in 5 seconds…</p>
        </div>
      ) : showEraseConfirm ? (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-red-800 flex items-center gap-2">
            <span className="text-xl">⚠️</span> Confirm Permanent Deletion
          </h3>
          <div className="text-sm text-red-700 space-y-2">
            <p>This action is <b>irreversible</b>. The following will be permanently deleted:</p>
            <ul className="list-disc list-inside ml-2 space-y-0.5">
              <li>All your job applications across all companies</li>
              <li>All uploaded resumes and AI-parsed resume data</li>
              <li>All AI video interview recordings, transcripts, and chat logs</li>
              <li>All saved jobs, talent-pool entries, and job alerts</li>
              <li>All HR↔candidate messages</li>
              <li>Your candidate portal login account</li>
            </ul>
            <p>You will be immediately logged out and will need to re-register to apply again.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Reason (optional)</label>
            <textarea
              value={eraseReason}
              onChange={(e) => setEraseReason(e.target.value)}
              className="w-full text-sm border rounded p-2 h-20"
              placeholder="Help us improve by telling us why you're leaving…"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleErase}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:bg-gray-400"
            >
              {loading ? 'Deleting…' : 'Yes, Delete My Data Permanently'}
            </button>
            <button
              onClick={() => setShowEraseConfirm(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border rounded-lg p-4 space-y-3">
          <h3 className="font-semibold">Right to Erasure (GDPR / Data Protection)</h3>
          <p className="text-sm text-gray-600">
            You have the right to request the permanent deletion of all your personal data
            from this platform. This includes your profile, resumes, video interviews,
            chat logs, and application history across all sub-companies.
          </p>
          <p className="text-xs text-gray-500">
            This action cannot be undone. Once deleted, you will need to re-register
            to apply for future roles.
          </p>
          <button
            onClick={() => setShowEraseConfirm(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
          >
            Delete My Data
          </button>
        </div>
      )}

      <div className="border-t pt-4">
        <Link href="/candidate-portal/dashboard" className="text-sm text-green-600 hover:underline">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
