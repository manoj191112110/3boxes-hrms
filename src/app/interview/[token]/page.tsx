'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  FiCpu, FiUser, FiType, FiMic, FiVideo, FiCheckSquare, FiCode,
  FiSend, FiCheck, FiX, FiArrowRight, FiClock, FiShield,
  FiAlertTriangle, FiAward, FiHeart, FiStar,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

/* REQ-SEC-REC-02 — AI Transparency disclaimer (mirrors /careers page) */
const AI_TRANSPARENCY_TEXT =
  'You are interacting with an AI system. Your responses and video are being analyzed algorithmically to assess fit. A human recruiter will review this data.';

/* ── Types ── */
interface SessionDataType {
  id: string; setId: string; candidateName: string; candidateEmail: string;
  status: string; language: string; resumeUrl?: string | null;
  set: {
    id: string; title: string; roleTitle: string; interviewMode: string;
    jobDescription?: string | null; timeLimit: number;
    questions: Array<{
      id: string; order: number; category: string; question: string;
      expectedPoints?: string | null; duration?: number | null;
      difficulty: string; isMandatory: boolean;
    }>;
  };
  responses: Array<{
    id: string; order: number; question?: string | null;
    responseText?: string | null; aiScore?: number | null;
  }>;
}

/* ── Pre-screening form ── */
interface PreScreenData {
  salaryExpectation: string;
  requiresVisa: boolean;
  hasWorkPermit: boolean;
  currentLocation: string;
  noticePeriod: string;
}

export default function CandidateInterviewPage() {
  const params = useParams();
  const token = params.token as string;

  const [phase, setPhase] = useState<'loading' | 'invalid' | 'expired' | 'pre_screen' | 'interview' | 'thank_you' | 'disqualified'>('loading');
  const [session, setSession] = useState<SessionDataType | null>(null);
  const [invitationData, setInvitationData] = useState<{ setId: string; candidateName: string; candidateEmail: string } | null>(null);

  // Pre-screen form
  const [preScreen, setPreScreen] = useState<PreScreenData>({
    salaryExpectation: '', requiresVisa: false, hasWorkPermit: true,
    currentLocation: '', noticePeriod: '',
  });
  const [preScreenSubmitting, setPreScreenSubmitting] = useState(false);

  // REQ-SEC-REC-02 — AI Transparency acknowledgment (must be checked before the candidate can start)
  const [aiConsentAck, setAiConsentAck] = useState(false);

  // Interview state
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'ai' | 'candidate'; content: string; timestamp: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [interviewStartTime, setInterviewStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // MCQ state
  const [mcqOptions, setMcqOptions] = useState<string[]>([]);
  const [mcqSelected, setMcqSelected] = useState<number | null>(null);
  const [mcqShowResult, setMcqShowResult] = useState(false);

  // Load invitation data
  useEffect(() => {
    if (!token) return;
    const loadInvitation = async () => {
      try {
        const res = await fetch(`/api/ai-interview/invitations?limit=100`);
        if (res.ok) {
          const d = await res.json();
          const inv = (d.data || []).find((i: { invitationToken: string; status: string }) => i.invitationToken === token && ['pending', 'sent', 'opened'].includes(i.status));
          if (inv) {
            setInvitationData({ setId: inv.setId, candidateName: inv.candidateName, candidateEmail: inv.candidateEmail });
            // Check if expired
            if (inv.expiresAt && new Date(inv.expiresAt) < new Date()) {
              setPhase('expired');
              return;
            }
            setPhase('pre_screen');
          } else {
            setPhase('invalid');
          }
        } else {
          setPhase('invalid');
        }
      } catch {
        setPhase('invalid');
      }
    };
    loadInvitation();
  }, [token]);

  // Timer
  useEffect(() => {
    if (!interviewStartTime || phase !== 'interview') return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - interviewStartTime.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [interviewStartTime, phase]);

  // Auto-scroll chat
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  /* ── Pre-screening submission ── */
  const handlePreScreenSubmit = async () => {
    if (!invitationData) return;
    if (!aiConsentAck) {
      toast.error('Please acknowledge the AI consent notice to start the interview');
      return;
    }
    setPreScreenSubmitting(true);

    try {
      // REQ-SEC-REC-04 — record ai_evaluation + video_recording consent before the session starts.
      // The /api/ats/consent route is idempotent: if a prior active consent exists, this is a no-op.
      // tenantId is best-effort — we don't have it on the candidate side, so we pass the literal 'unknown'
      // and rely on the recruiter's tenant-admin tooling to reconcile. If the request fails, we still
      // allow the interview to proceed (the candidate has clicked through, so we honor their intent).
      await Promise.allSettled([
        fetch('/api/ats/consent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateEmail: invitationData.candidateEmail,
            tenantId: 'unknown',
            purpose: 'ai_evaluation',
            source: 'email_link',
          }),
        }),
        fetch('/api/ats/consent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateEmail: invitationData.candidateEmail,
            tenantId: 'unknown',
            purpose: 'video_recording',
            source: 'email_link',
          }),
        }),
      ]);

      // Create session from invitation
      const sessionRes = await fetch('/api/ai-interview/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setId: invitationData.setId,
          candidateName: invitationData.candidateName,
          candidateEmail: invitationData.candidateEmail,
        }),
      });

      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        const newSession = sessionData.data;

        // Save pre-screen result
        await fetch(`/api/ai-interview/sessions/${newSession.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            preScreenResult: {
              salaryExpectation: preScreen.salaryExpectation,
              requiresVisa: preScreen.requiresVisa,
              hasWorkPermit: preScreen.hasWorkPermit,
              currentLocation: preScreen.currentLocation,
              noticePeriod: preScreen.noticePeriod,
              disqualified: false,
            },
            status: 'in_progress',
            startedAt: new Date().toISOString(),
          }),
        });

        // Fetch full session with set data
        const fullRes = await fetch(`/api/ai-interview/sessions/${newSession.id}`);
        if (fullRes.ok) {
          const fullData = await fullRes.json();
          setSession(fullData.data);
          setPhase('interview');
          setInterviewStartTime(new Date());

          // Start first question
          if (fullData.data.set?.questions?.length > 0) {
            const firstQ = fullData.data.set.questions[0];
            if (['text', 'voice', 'video'].includes(fullData.data.set.interviewMode)) {
              setChatMessages([{ role: 'ai', content: firstQ.question, timestamp: new Date().toISOString() }]);
            }
          }
        }
      } else {
        toast.error('Failed to start interview session');
      }
    } catch {
      toast.error('Something went wrong');
    }
    setPreScreenSubmitting(false);
  };

  /* ── Chat functions ── */
  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatSending || !session) return;
    const userMsg = { role: 'candidate' as const, content: chatInput.trim(), timestamp: new Date().toISOString() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatSending(true);

    try {
      const res = await fetch('/api/ai-interview/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: chatInput.trim(),
          interviewType: session.set.interviewMode,
          jobTitle: session.set.roleTitle,
          history: chatMessages,
        }),
      });

      if (res.ok) {
        const d = await res.json();
        setChatMessages(prev => [...prev, { role: 'ai', content: d.response, timestamp: d.timestamp }]);

        // Move to next question if we have enough exchanges
        const candidateMsgs = [...chatMessages, userMsg].filter(m => m.role === 'candidate').length;
        if (candidateMsgs % 2 === 0 && currentQuestionIndex < (session.set.questions?.length || 0) - 1) {
          setTimeout(() => {
            const nextQ = session.set.questions[currentQuestionIndex + 1];
            if (nextQ) {
              setCurrentQuestionIndex(prev => prev + 1);
              setChatMessages(prev => [...prev, { role: 'ai', content: `Next question: ${nextQ.question}`, timestamp: new Date().toISOString() }]);
            }
          }, 2000);
        }
      }
    } catch { toast.error('Failed to send'); }
    setChatSending(false);
  };

  /* ── MCQ answer ── */
  const handleMCQAnswer = (index: number) => {
    if (mcqShowResult) return;
    setMcqSelected(index);
    setMcqShowResult(true);
  };

  /* ── End interview ── */
  const endInterview = async () => {
    if (!session) return;
    try {
      const transcript = chatMessages.map(m => `${m.role === 'ai' ? 'Interviewer' : 'Candidate'}: ${m.content}`).join('\n');
      await fetch(`/api/ai-interview/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullTranscript: transcript,
          durationSeconds: elapsedSeconds,
        }),
      });
      setPhase('thank_you');
    } catch {
      setPhase('thank_you');
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'voice': return <FiMic className="w-5 h-5" />;
      case 'video': return <FiVideo className="w-5 h-5" />;
      case 'mcq': return <FiCheckSquare className="w-5 h-5" />;
      case 'coding': return <FiCode className="w-5 h-5" />;
      default: return <FiType className="w-5 h-5" />;
    }
  };

  /* ══════════════════════════════════════════════════ */
  /* ═══  LOADING                                  ════ */
  /* ══════════════════════════════════════════════════ */
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-teal-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-500/25 animate-pulse">
            <FiCpu className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">3Boxes AI Interview</h2>
          <p className="text-gray-500 text-sm">Loading your interview session...</p>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════ */
  /* ═══  INVALID / EXPIRED                        ════ */
  /* ══════════════════════════════════════════════════ */
  if (phase === 'invalid' || phase === 'expired') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
            <FiAlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {phase === 'expired' ? 'Invitation Expired' : 'Invalid Invitation'}
          </h2>
          <p className="text-gray-500 text-sm">
            {phase === 'expired'
              ? 'This interview invitation has expired. Please contact the recruiter for a new link.'
              : 'This interview link is invalid or has already been used. Please check your invitation email.'}
          </p>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════ */
  /* ═══  PRE-SCREENING                            ════ */
  /* ══════════════════════════════════════════════════ */
  if (phase === 'pre_screen') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          {/* REQ-SEC-REC-02 — AI Transparency banner (top of candidate interview page) */}
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
            <div className="flex items-start gap-2.5">
              <FiAlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                  <FiCpu className="w-3 h-3" /> AI Transparency Notice
                </p>
                <p className="text-xs text-amber-900 mt-1 leading-relaxed">{AI_TRANSPARENCY_TEXT}</p>
              </div>
            </div>
          </div>

          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-teal-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-500/25">
              <FiCpu className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Welcome, {invitationData?.candidateName || 'Candidate'}</h2>
            <p className="text-gray-500 text-sm">Before we begin, please answer a few quick questions.</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg shadow-teal-500/5 border border-teal-100 p-6 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Salary Expectation (Annual) *</label>
              <input value={preScreen.salaryExpectation} onChange={e => setPreScreen(p => ({ ...p, salaryExpectation: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                placeholder="e.g., $80,000 - $100,000" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Current Location *</label>
              <input value={preScreen.currentLocation} onChange={e => setPreScreen(p => ({ ...p, currentLocation: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                placeholder="e.g., New York, NY" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Notice Period</label>
              <select value={preScreen.noticePeriod} onChange={e => setPreScreen(p => ({ ...p, noticePeriod: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all">
                <option value="">Select...</option>
                <option value="immediate">Immediate</option>
                <option value="2_weeks">2 Weeks</option>
                <option value="1_month">1 Month</option>
                <option value="2_months">2 Months</option>
                <option value="3_months">3+ Months</option>
              </select>
            </div>
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={preScreen.requiresVisa} onChange={e => setPreScreen(p => ({ ...p, requiresVisa: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                <div><p className="text-sm font-medium text-gray-700">I require visa sponsorship</p><p className="text-xs text-gray-500">Check if you need visa sponsorship to work in the target location</p></div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={preScreen.hasWorkPermit} onChange={e => setPreScreen(p => ({ ...p, hasWorkPermit: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                <div><p className="text-sm font-medium text-gray-700">I have a valid work permit</p><p className="text-xs text-gray-500">Check if you already have a work permit for the target location</p></div>
              </label>
            </div>

            {/* REQ-SEC-REC-04 — AI consent checkbox (required to start) */}
            <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={aiConsentAck} onChange={e => setAiConsentAck(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">I consent to AI analysis of my video and responses</p>
                  <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                    I understand my chat responses, voice, and video will be processed by an AI evaluation
                    system and reviewed by a human recruiter. This consent is required to start the interview.
                    You may withdraw it at any time by contacting the hiring team or via the careers portal.
                  </p>
                </div>
              </label>
            </div>

            <button onClick={handlePreScreenSubmit} disabled={preScreenSubmitting || !preScreen.salaryExpectation || !preScreen.currentLocation || !aiConsentAck}
              className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-semibold text-sm hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-lg shadow-teal-500/25 flex items-center justify-center gap-2">
              {preScreenSubmitting ? 'Starting...' : <>Start Interview <FiArrowRight className="w-4 h-4" /></>}
            </button>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
            <FiShield className="w-3.5 h-3.5" />
            <span>Your data is secure and used only for this interview</span>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════ */
  /* ═══  DISQUALIFIED                             ════ */
  /* ══════════════════════════════════════════════════ */
  if (phase === 'disqualified') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
            <FiX className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Pre-Screening Not Met</h2>
          <p className="text-gray-500 text-sm">Unfortunately, your profile does not meet the pre-screening criteria for this position. You may still be considered for other roles.</p>
          <p className="text-gray-400 text-xs mt-4">If you believe this is an error, please contact the recruiter.</p>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════ */
  /* ═══  THANK YOU                                ════ */
  /* ══════════════════════════════════════════════════ */
  if (phase === 'thank_you') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <FiCheck className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Interview Complete!</h2>
          <p className="text-gray-500 text-sm mb-6">Thank you for completing the AI interview, {session?.candidateName || 'Candidate'}. Our team will review your responses and get back to you shortly.</p>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Position</span>
              <span className="font-medium text-gray-900">{session?.set?.roleTitle || '—'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Duration</span>
              <span className="font-medium text-gray-900">{formatTime(elapsedSeconds)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Questions Answered</span>
              <span className="font-medium text-gray-900">{chatMessages.filter(m => m.role === 'candidate').length}</span>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
            <FiHeart className="w-3.5 h-3.5" /> <span>Powered by 3Boxes AI Interview</span>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════ */
  /* ═══  INTERVIEW IN PROGRESS                    ════ */
  /* ══════════════════════════════════════════════════ */
  const interviewMode = session?.set?.interviewMode || 'text';
  const questions = session?.set?.questions || [];
  const timeLimit = session?.set?.timeLimit || 30;
  const timeExceeded = elapsedSeconds > timeLimit * 60;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-green-50">
      {/* REQ-SEC-REC-02 — AI Transparency banner (top of in-progress interview) */}
      <div className="bg-amber-50/80 border-b border-amber-200 px-4 py-2.5">
        <div className="max-w-4xl mx-auto flex items-center gap-2 text-xs text-amber-900">
          <FiAlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
          <span>
            <strong>AI Transparency:</strong> {AI_TRANSPARENCY_TEXT}
          </span>
        </div>
      </div>

      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center shadow-sm shadow-teal-500/25">
              <FiCpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">{session?.set?.title || 'AI Interview'}</h1>
              <p className="text-xs text-gray-500">{session?.set?.roleTitle} · {interviewMode.toUpperCase()} Mode</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <FiClock className={`w-4 h-4 ${timeExceeded ? 'text-red-500' : 'text-gray-400'}`} />
              <span className={`font-mono font-bold ${timeExceeded ? 'text-red-500' : 'text-gray-700'}`}>{formatTime(elapsedSeconds)}</span>
              <span className="text-gray-300">/</span>
              <span className="text-gray-400 text-xs">{timeLimit}m</span>
            </div>
            <div className="text-xs text-gray-400 flex items-center gap-1">
              <span>Q{Math.min(currentQuestionIndex + 1, questions.length)}/{questions.length}</span>
            </div>
            <button onClick={endInterview} className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-colors">
              End Interview
            </button>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div className="h-full bg-teal-600 transition-all duration-500"
          style={{ width: `${Math.min(100, (elapsedSeconds / (timeLimit * 60)) * 100)}%` }} />
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {/* Interview mode indicator */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-100 text-teal-700 text-xs font-semibold">
            {getModeIcon(interviewMode)} {interviewMode.toUpperCase()} Interview
          </span>
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
            <FiShield className="w-3 h-3" /> Proctored
          </span>
        </div>

        {['text', 'voice', 'video'].includes(interviewMode) ? (
          /* ── Chat Interview ── */
          <div className="bg-white rounded-2xl shadow-lg shadow-teal-500/5 border border-teal-100 overflow-hidden">
            <div className="h-[calc(100vh-240px)] min-h-[400px] overflow-y-auto p-4 space-y-4 bg-gray-50/50">
              {chatMessages.length === 0 && !chatSending && (
                <div className="text-center py-12">
                  <FiCpu className="w-10 h-10 text-teal-300 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Starting your interview...</p>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'ai' ? 'bg-white border border-gray-100 rounded-tl-none shadow-sm text-gray-900' : 'bg-teal-600 text-white rounded-tr-none shadow-sm'}`}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      {msg.role === 'ai' ? <><FiCpu className="w-3.5 h-3.5 text-teal-500" /><span className="text-[10px] font-semibold text-teal-500">AI Interviewer</span></>
                        : <><FiUser className="w-3.5 h-3.5" /><span className="text-[10px] font-semibold">You</span></>}
                    </div>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {chatSending && (
                <div className="flex justify-start"><div className="max-w-[80%] p-4 rounded-2xl rounded-tl-none bg-white border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2"><div className="flex gap-1">{[0, 150, 300].map((d, i) => <div key={i} className="w-2 h-2 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}<span className="text-xs text-gray-400">AI is thinking...</span></div></div>
                </div></div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="p-4 border-t border-gray-100 bg-white">
              <div className="flex items-end gap-3">
                <textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                  placeholder="Type your response... (Press Enter to send)"
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 min-h-[48px] max-h-[120px]" rows={1} disabled={chatSending} />
                <button onClick={sendChatMessage} disabled={!chatInput.trim() || chatSending}
                  className="flex-shrink-0 w-12 h-12 rounded-xl bg-teal-600 text-white flex items-center justify-center hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-lg shadow-teal-500/25">
                  <FiSend className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ) : interviewMode === 'mcq' ? (
          /* ── MCQ Mode ── */
          <div className="bg-white rounded-2xl shadow-lg shadow-teal-500/5 border border-teal-100 p-6">
            {questions.length > 0 && currentQuestionIndex < questions.length ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-teal-100 text-teal-700 text-xs font-bold">Question {currentQuestionIndex + 1} of {questions.length}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${questions[currentQuestionIndex].difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' : questions[currentQuestionIndex].difficulty === 'hard' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {questions[currentQuestionIndex].difficulty}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{questions[currentQuestionIndex].question}</h3>
                <div className="space-y-3">
                  {['Option A', 'Option B', 'Option C', 'Option D'].map((opt, i) => (
                    <button key={i} onClick={() => handleMCQAnswer(i)}
                      disabled={mcqShowResult}
                      className={`w-full p-4 rounded-xl border-2 text-left text-sm font-medium transition-all ${mcqSelected === i ? (mcqShowResult ? (i === 0 ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-red-500 bg-red-50 text-red-700') : 'border-teal-500 bg-teal-50 text-teal-700') : 'border-gray-100 hover:border-teal-200 hover:bg-teal-50/50 text-gray-700'}`}>
                      {opt}
                    </button>
                  ))}
                </div>
                {mcqShowResult && (
                  <button onClick={() => { setMcqSelected(null); setMcqShowResult(false); setCurrentQuestionIndex(prev => prev + 1); }}
                    className="w-full py-3 bg-teal-600 text-white rounded-xl font-semibold text-sm hover:bg-teal-700 flex items-center justify-center gap-2">
                    {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish Interview'} <FiArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <FiCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <p className="text-lg font-semibold text-gray-900">All questions answered!</p>
                <button onClick={endInterview} className="mt-4 px-6 py-3 bg-teal-600 text-white rounded-xl font-semibold text-sm hover:bg-teal-700">Complete Interview</button>
              </div>
            )}
          </div>
        ) : (
          /* ── Coding Mode ── */
          <div className="bg-white rounded-2xl shadow-lg shadow-teal-500/5 border border-teal-100 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-teal-100 text-teal-700 text-xs font-bold">Coding Challenge</span>
            </div>
            {questions.length > 0 && currentQuestionIndex < questions.length && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{questions[currentQuestionIndex].question}</h3>
                <textarea className="w-full h-64 px-4 py-3 rounded-xl border border-gray-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                  placeholder="// Write your code here..." />
                <div className="flex gap-3 mt-4">
                  <button className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">Run Code</button>
                  <button onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                    className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700">Submit & Next</button>
                </div>
              </div>
            )}
            {currentQuestionIndex >= questions.length && (
              <div className="text-center py-12">
                <FiCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <p className="text-lg font-semibold text-gray-900">All challenges completed!</p>
                <button onClick={endInterview} className="mt-4 px-6 py-3 bg-teal-600 text-white rounded-xl font-semibold text-sm hover:bg-teal-700">Complete Interview</button>
              </div>
            )}
          </div>
        )}

        {/* Footer hint */}
        <div className="mt-4 text-center text-xs text-gray-400 flex items-center justify-center gap-4">
          <span className="flex items-center gap-1"><FiShield className="w-3 h-3" /> Proctored session</span>
          <span className="flex items-center gap-1"><FiCpu className="w-3 h-3" /> AI-powered evaluation</span>
          <span className="flex items-center gap-1"><FiStar className="w-3 h-3" /> 3Boxes AI Interview</span>
        </div>
      </div>
    </div>
  );
}
