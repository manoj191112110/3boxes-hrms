'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface RewriteSuggestion {
  id: string;
  original: string;
  suggested: string;
  type: 'quantify' | 'action_verb' | 'concise' | 'keyword' | 'grammar';
  rationale: string;
  accepted: boolean;
}
interface KeywordSuggestion {
  keyword: string;
  category: string;
  reason: string;
}
interface FormatFeedback {
  id: string;
  issue: string;
  suggestion: string;
  severity: 'high' | 'medium' | 'low';
  category: string;
}
interface GapAnalysis {
  matched: Array<{ skill: string; evidence: string }>;
  missing: Array<{ skill: string; criticality: string }>;
  implied: Array<{ skill: string; evidence: string }>;
}
interface Optimization {
  id: string;
  matchScore: number;
  gapAnalysis: GapAnalysis | null;
  rewriteSuggestions: RewriteSuggestion[] | null;
  suggestedKeywords: KeywordSuggestion[] | null;
  formatFeedback: FormatFeedback[] | null;
  summaryOptions: string[] | null;
  selectedSummary: string | null;
  optimizedResume: string | null;
  version: number;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  quantify: { label: 'Quantify', color: 'bg-green-100 text-green-700' },
  action_verb: { label: 'Action Verb', color: 'bg-teal-100 text-teal-700' },
  concise: { label: 'Concise', color: 'bg-yellow-100 text-yellow-700' },
  keyword: { label: 'Keyword', color: 'bg-green-100 text-green-700' },
  grammar: { label: 'Grammar', color: 'bg-red-100 text-red-700' },
};

const SEVERITY_COLORS: Record<string, string> = {
  high: 'border-red-300 bg-red-50',
  medium: 'border-yellow-300 bg-yellow-50',
  low: 'border-green-300 bg-green-50',
};

export default function ResumeOptimizerPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobApplicationId = searchParams.get('applicationId');

  const [optimization, setOptimization] = useState<Optimization | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedResume, setEditedResume] = useState('');
  const [selectedSummary, setSelectedSummary] = useState<string | null>(null);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  const [matchScore, setMatchScore] = useState<number | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_candidate_token') : null;

  const loadExisting = useCallback(async () => {
    if (!jobApplicationId || !token) return;
    try {
      const r = await fetch(`/api/candidate-portal/resume/optimize?jobApplicationId=${jobApplicationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (d.optimization) {
        setOptimization(d.optimization);
        setEditedResume(d.optimization.optimizedResume || '');
        setMatchScore(d.optimization.matchScore);
        setSelectedSummary(d.optimization.selectedSummary);
      }
    } catch {}
  }, [jobApplicationId, token]);

  useEffect(() => { loadExisting(); }, [loadExisting]);

  async function runOptimization() {
    if (!jobApplicationId || !token) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/candidate-portal/resume/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ jobApplicationId }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || 'Failed to run optimization');
        return;
      }
      setOptimization(d.optimization);
      setEditedResume(d.optimization.optimizedResume || '');
      setMatchScore(d.optimization.matchScore);
      setAcceptedIds(new Set());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

  async function saveProgress() {
    if (!jobApplicationId || !token || !optimization) return;
    setLoading(true);
    try {
      const r = await fetch('/api/candidate-portal/resume/optimize', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          jobApplicationId,
          optimizedResume: editedResume,
          selectedSummary,
          acceptedSuggestionIds: Array.from(acceptedIds),
        }),
      });
      const d = await r.json();
      if (r.ok) {
        setOptimization(d.optimization);
        setMatchScore(d.newMatchScore);
      } else {
        setError(d.error || 'Failed to save');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

  function toggleSuggestion(id: string) {
    setAcceptedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (!jobApplicationId) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">AI Resume Optimizer</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          No application selected. Please visit your{' '}
          <Link href="/candidate-portal/dashboard" className="text-green-600 underline">dashboard</Link>{' '}
          and click "Optimize Resume" on an application.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">AI Resume Optimizer</h1>
          <p className="text-sm text-gray-600 mt-1">
            Iteratively improve your resume against the job description. Match score updates dynamically. (REQ-AI-RES-03..09)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {matchScore !== null && (
            <div className="text-center px-4 py-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 text-white">
              <div className="text-[10px] uppercase tracking-wider opacity-80">Match Score</div>
              <div className="text-3xl font-bold">{matchScore}%</div>
            </div>
          )}
          <button
            onClick={runOptimization}
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm hover:bg-emerald-700 disabled:bg-gray-400"
          >
            {loading ? 'Analyzing…' : optimization ? 'Re-run Analysis' : 'Run AI Analysis'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
      )}

      {!optimization && !loading && (
        <div className="bg-white border rounded-lg p-8 text-center">
          <div className="text-5xl mb-3">🎯</div>
          <h2 className="text-lg font-semibold mb-2">Optimize Your Resume with AI</h2>
          <p className="text-sm text-gray-600 max-w-md mx-auto mb-4">
            Click "Run AI Analysis" to get an instant match score, visual gap analysis,
            rewrite suggestions, missing ATS keywords, and AI-generated summary options.
          </p>
        </div>
      )}

      {optimization && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Gap Analysis + Format Feedback */}
          <div className="space-y-4">
            {/* Gap Analysis (REQ-AI-RES-04) */}
            <div className="bg-white border rounded-lg p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Gap Analysis
              </h3>
              {optimization.gapAnalysis ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-xs font-bold uppercase text-green-700 mb-1">✓ Matched ({optimization.gapAnalysis.matched.length})</div>
                    <div className="space-y-1">
                      {optimization.gapAnalysis.matched.map((m, i) => (
                        <div key={i} className="text-xs bg-green-50 border border-green-200 rounded px-2 py-1">
                          <b>{m.skill}</b> — <span className="text-gray-600">{m.evidence}</span>
                        </div>
                      ))}
                      {optimization.gapAnalysis.matched.length === 0 && <div className="text-xs text-gray-500">None matched yet.</div>}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase text-yellow-700 mb-1">≈ Implied ({optimization.gapAnalysis.implied.length})</div>
                    <div className="space-y-1">
                      {optimization.gapAnalysis.implied.map((m, i) => (
                        <div key={i} className="text-xs bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                          <b>{m.skill}</b> — <span className="text-gray-600">{m.evidence}</span>
                        </div>
                      ))}
                      {optimization.gapAnalysis.implied.length === 0 && <div className="text-xs text-gray-500">None implied.</div>}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase text-red-700 mb-1">✗ Missing ({optimization.gapAnalysis.missing.length})</div>
                    <div className="space-y-1">
                      {optimization.gapAnalysis.missing.map((m, i) => (
                        <div key={i} className="text-xs bg-red-50 border border-red-200 rounded px-2 py-1">
                          <b>{m.skill}</b> <span className="text-gray-500">({m.criticality})</span>
                        </div>
                      ))}
                      {optimization.gapAnalysis.missing.length === 0 && <div className="text-xs text-gray-500">No missing skills — great match!</div>}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">Not available.</div>
              )}
            </div>

            {/* Format Feedback (REQ-AI-RES-07) */}
            {optimization.formatFeedback && optimization.formatFeedback.length > 0 && (
              <div className="bg-white border rounded-lg p-4">
                <h3 className="font-semibold mb-3">Format & Structure Feedback</h3>
                <div className="space-y-2">
                  {optimization.formatFeedback.map(f => (
                    <div key={f.id} className={`text-xs border-l-4 rounded p-2 ${SEVERITY_COLORS[f.severity] || SEVERITY_COLORS.medium}`}>
                      <div className="font-semibold">{f.issue}</div>
                      <div className="text-gray-600 mt-0.5">{f.suggestion}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Middle column: Rewrite Suggestions + Keywords */}
          <div className="space-y-4">
            {/* Rewrite Suggestions (REQ-AI-RES-05) */}
            <div className="bg-white border rounded-lg p-4">
              <h3 className="font-semibold mb-3">Rewrite Suggestions</h3>
              <p className="text-xs text-gray-500 mb-3">Click to accept — applied when you click "Save Progress".</p>
              {optimization.rewriteSuggestions && optimization.rewriteSuggestions.length > 0 ? (
                <div className="space-y-2">
                  {optimization.rewriteSuggestions.map(s => {
                    const isAccepted = acceptedIds.has(s.id) || s.accepted;
                    return (
                      <div key={s.id} className={`text-xs border rounded p-2 ${isAccepted ? 'bg-green-50 border-green-300' : 'bg-white'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${TYPE_LABELS[s.type]?.color || 'bg-gray-100'}`}>
                            {TYPE_LABELS[s.type]?.label || s.type}
                          </span>
                          <button
                            onClick={() => toggleSuggestion(s.id)}
                            className={`text-[10px] px-2 py-0.5 rounded ${isAccepted ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                          >
                            {isAccepted ? '✓ Accepted' : 'Accept'}
                          </button>
                        </div>
                        <div className="text-red-700 line-through">{s.original}</div>
                        <div className="text-green-700">→ {s.suggested}</div>
                        <div className="text-gray-500 mt-1 italic">{s.rationale}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No rewrite suggestions.</div>
              )}
            </div>

            {/* Keyword Injection (REQ-AI-RES-06) */}
            {optimization.suggestedKeywords && optimization.suggestedKeywords.length > 0 && (
              <div className="bg-white border rounded-lg p-4">
                <h3 className="font-semibold mb-3">Missing ATS Keywords</h3>
                <p className="text-xs text-gray-500 mb-3">Add these to your skills section to pass ATS screening.</p>
                <div className="space-y-2">
                  {optimization.suggestedKeywords.map((k, i) => (
                    <div key={i} className="text-xs border rounded p-2 bg-white">
                      <div className="flex items-center justify-between mb-1">
                        <b>{k.keyword}</b>
                        <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">{k.category}</span>
                      </div>
                      <div className="text-gray-600">{k.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Summary Options (REQ-AI-RES-08) */}
            {optimization.summaryOptions && optimization.summaryOptions.length > 0 && (
              <div className="bg-white border rounded-lg p-4">
                <h3 className="font-semibold mb-3">AI-Generated Summary Options</h3>
                <p className="text-xs text-gray-500 mb-3">Pick one to add to your resume (or write your own).</p>
                <div className="space-y-2">
                  {optimization.summaryOptions.map((s, i) => (
                    <label key={i} className={`block text-xs border rounded p-2 cursor-pointer ${selectedSummary === s ? 'bg-green-50 border-green-400' : 'bg-white hover:bg-gray-50'}`}>
                      <div className="flex items-start gap-2">
                        <input
                          type="radio"
                          name="summary"
                          checked={selectedSummary === s}
                          onChange={() => setSelectedSummary(s)}
                          className="mt-0.5"
                        />
                        <span>{s}</span>
                      </div>
                    </label>
                  ))}
                </div>
                {selectedSummary && (
                  <textarea
                    value={selectedSummary}
                    onChange={(e) => setSelectedSummary(e.target.value)}
                    className="w-full mt-2 text-xs border rounded p-2 h-20"
                    placeholder="Edit your selected summary…"
                  />
                )}
              </div>
            )}
          </div>

          {/* Right column: Edited Resume + Save */}
          <div className="space-y-4">
            <div className="bg-white border rounded-lg p-4 sticky top-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Your Optimized Resume</h3>
                <span className="text-xs text-gray-500">v{optimization.version}</span>
              </div>
              <textarea
                value={editedResume}
                onChange={(e) => setEditedResume(e.target.value)}
                className="w-full text-xs font-mono border rounded p-2 h-96"
                placeholder="Edit your resume here. Accepted suggestions will be applied when you Save Progress."
              />
              <button
                onClick={saveProgress}
                disabled={loading}
                className="w-full mt-2 px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:bg-gray-400"
              >
                {loading ? 'Saving…' : 'Save Progress & Recompute Score'}
              </button>
              <p className="text-[10px] text-gray-500 mt-2 text-center">
                REQ-AI-RES-09: Match score updates dynamically as you edit.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="text-center pt-4">
        <Link href="/candidate-portal/dashboard" className="text-sm text-green-600 hover:underline">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
