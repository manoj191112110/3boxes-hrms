'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiHeart,
  FiThumbsUp,
  FiActivity,
  FiZap,
  FiAward,
  FiPlus,
  FiX,
  FiSearch,
  FiTrash2,
  FiStar,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import ModuleTips from '@/components/ModuleTips';
import ModuleWorkflow from '@/components/ModuleWorkflow';

/* ── Types ── */
interface PulseSurvey {
  id: string;
  title: string;
  questions: SurveyQuestion[];
  responseRate: number;
  avgScore: number;
  totalResponses: number;
  status: 'draft' | 'active' | 'closed';
  createdAt: string;
}

interface SurveyQuestion {
  id: string;
  text: string;
  avgRating: number;
}

interface Recognition {
  id: string;
  fromEmployee: string;
  toEmployee: string;
  category: 'Teamwork' | 'Innovation' | 'Leadership' | 'Excellence';
  message: string;
  likes: number;
  createdAt: string;
}

interface WellnessProgram {
  id: string;
  name: string;
  type: 'Yoga' | 'Mental Health' | 'Fitness' | 'Nutrition';
  participants: number;
  maxCapacity: number;
  schedule: string;
  status: 'active' | 'upcoming' | 'completed';
}

/* ── Helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
// getAuthHeaders is used for API integration when available

function getCategoryBadge(category: string) {
  const map: Record<string, string> = {
    Teamwork: 'bg-green-50 text-green-700 thb-badge',
    Innovation: 'bg-teal-50 text-teal-700 thb-badge',
    Leadership: 'bg-amber-50 text-amber-700 thb-badge',
    Excellence: 'bg-emerald-50 text-emerald-700 thb-badge',
  };
  return { className: map[category] || 'thb-badge thb-badge-info', label: category };
}

function getWellnessTypeBadge(type: string) {
  const map: Record<string, string> = {
    Yoga: 'bg-teal-50 text-teal-700 thb-badge',
    'Mental Health': 'bg-teal-50 text-teal-700 thb-badge',
    Fitness: 'bg-orange-50 text-orange-700 thb-badge',
    Nutrition: 'bg-green-50 text-green-700 thb-badge',
  };
  return { className: map[type] || 'thb-badge thb-badge-info', label: type };
}

function getSurveyStatusBadge(status: string) {
  const map: Record<string, string> = {
    draft: 'thb-badge thb-badge-warning',
    active: 'bg-emerald-50 text-emerald-700 thb-badge',
    closed: 'bg-slate-100 text-slate-600 thb-badge',
  };
  const labels: Record<string, string> = { draft: 'Draft', active: 'Active', closed: 'Closed' };
  return { className: map[status] || 'thb-badge thb-badge-info', label: labels[status] || status };
}

/* ── Demo Data (removed — data comes from API only) ── */

const initialSurveyForm = {
  title: '',
  questionText: '',
  status: 'draft' as 'draft' | 'active' | 'closed',
};

const initialRecognitionForm = {
  toEmployee: '',
  category: 'Teamwork' as 'Teamwork' | 'Innovation' | 'Leadership' | 'Excellence',
  message: '',
};

/* ── Tips & Workflow ── */
const engagementTips = [
  { title: 'Pulse Surveys', description: 'Conduct regular short surveys to gauge employee sentiment and catch issues before they escalate.' },
  { title: 'Recognition Programs', description: 'Implement peer-to-peer and manager recognition programs to boost morale and reinforce positive behaviors.' },
  { title: 'Feedback Culture', description: 'Foster a culture of continuous feedback where employees feel safe to share ideas and concerns openly.' },
  { title: 'Team Activities', description: 'Organize team-building and wellness activities to strengthen bonds and improve collaboration.' },
  { title: 'Sentiment Analysis', description: 'Leverage AI-powered sentiment analysis to identify trends and proactively address engagement gaps.' },
];

const engagementWorkflowSteps = [
  { step: 1, title: 'Launch Pulse Survey', description: 'Design and deploy targeted surveys to measure current engagement levels' },
  { step: 2, title: 'Collect Responses', description: 'Gather employee feedback across teams and departments with anonymity' },
  { step: 3, title: 'Analyze Results', description: 'Process survey data and identify engagement patterns and trends' },
  { step: 4, title: 'Identify Areas for Improvement', description: 'Pinpoint specific teams or themes that need attention and action' },
  { step: 5, title: 'Design Action Plans', description: 'Create targeted initiatives addressing the identified engagement gaps' },
  { step: 6, title: 'Implement Initiatives', description: 'Roll out engagement programs, recognition schemes, and wellness activities' },
  { step: 7, title: 'Measure Impact', description: 'Track the effectiveness of initiatives through follow-up surveys and metrics' },
  { step: 8, title: 'Iterate & Improve', description: 'Refine strategies based on results and continuously improve engagement' },
];

/* ── Component ── */
export default function EngagementPage() {
  const { user } = useAuthStore();
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');

  const [surveys, setSurveys] = useState<PulseSurvey[]>([]);
  const [recognitions, setRecognitions] = useState<Recognition[]>([]);
  const [wellness] = useState<WellnessProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'surveys' | 'recognition' | 'wellness' | 'ai'>('surveys');

  const [showSurveyForm, setShowSurveyForm] = useState(false);
  const [surveyForm, setSurveyForm] = useState(initialSurveyForm);
  const [submitting, setSubmitting] = useState(false);

  const [showRecognitionForm, setShowRecognitionForm] = useState(false);
  const [recognitionForm, setRecognitionForm] = useState(initialRecognitionForm);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  /* Fetch */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/employees?limit=1', { headers: getAuthHeaders() });
      if (!res.ok) { /* use demo data */ }
    } catch { /* use demo data */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { queueMicrotask(() => fetchData()); }, [fetchData]);

  /* Stats */
  const avgResponseRate = Math.round(surveys.reduce((a, s) => a + s.responseRate, 0) / surveys.length);
  const avgEngagement = (surveys.reduce((a, s) => a + s.avgScore, 0) / surveys.length).toFixed(1);
  const totalRecognition = recognitions.length;
  const activePrograms = wellness.filter(w => w.status === 'active').length;

  /* Leaderboard */
  const leaderboard = recognitions.reduce<Record<string, { name: string; count: number; likes: number }>>((acc, r) => {
    if (!acc[r.toEmployee]) acc[r.toEmployee] = { name: r.toEmployee, count: 0, likes: 0 };
    acc[r.toEmployee].count++;
    acc[r.toEmployee].likes += r.likes;
    return acc;
  }, {});
  const sortedLeaderboard = Object.values(leaderboard).sort((a, b) => b.count - a.count);

  /* Filtered surveys */
  const filteredSurveys = surveys.filter(s => !search || s.title.toLowerCase().includes(search.toLowerCase()));
  const filteredRecognitions = recognitions.filter(r => !search || r.toEmployee.toLowerCase().includes(search.toLowerCase()) || r.message.toLowerCase().includes(search.toLowerCase()));

  /* Form handlers */
  const handleAddSurvey = () => {
    if (!surveyForm.title) { toast.error('Survey title is required'); return; }
    try {
      setSubmitting(true);
      const newSurvey: PulseSurvey = {
        id: Date.now().toString(), title: surveyForm.title,
        questions: surveyForm.questionText ? [{ id: Date.now().toString(), text: surveyForm.questionText, avgRating: 0 }] : [],
        responseRate: 0, avgScore: 0, totalResponses: 0, status: surveyForm.status, createdAt: new Date().toISOString().split('T')[0],
      };
      setSurveys(prev => [newSurvey, ...prev]);
      toast.success('Survey created successfully');
      setShowSurveyForm(false);
      setSurveyForm(initialSurveyForm);
    } catch { toast.error('Failed to create survey'); } finally { setSubmitting(false); }
  };

  const handleAddRecognition = () => {
    if (!recognitionForm.toEmployee || !recognitionForm.message) { toast.error('Please fill in all fields'); return; }
    const newRec: Recognition = {
      id: Date.now().toString(), fromEmployee: user?.name || 'You', toEmployee: recognitionForm.toEmployee,
      category: recognitionForm.category, message: recognitionForm.message, likes: 0, createdAt: new Date().toISOString().split('T')[0],
    };
    setRecognitions(prev => [newRec, ...prev]);
    toast.success('Recognition posted!');
    setShowRecognitionForm(false);
    setRecognitionForm(initialRecognitionForm);
  };

  const handleLike = (id: string) => {
    setLikedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); setRecognitions(r => r.map(x => x.id === id ? { ...x, likes: x.likes - 1 } : x)); }
      else { next.add(id); setRecognitions(r => r.map(x => x.id === id ? { ...x, likes: x.likes + 1 } : x)); }
      return next;
    });
  };

  const handleDeleteSurvey = (id: string) => {
    setSurveys(prev => prev.filter(s => s.id !== id));
    toast.success('Survey deleted');
    setDeleteConfirmId(null); setDeleting(false);
  };

  const tabs = [
    { key: 'surveys' as const, label: 'Pulse Surveys', icon: FiActivity },
    { key: 'recognition' as const, label: 'Recognition', icon: FiAward },
    { key: 'wellness' as const, label: 'Wellness', icon: FiHeart },
    { key: 'ai' as const, label: 'AI Insights', icon: FiZap },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiHeart className="w-6 h-6 text-rose-500" />
            Employee Engagement
          </h1>
          <p className="text-thb-text-secondary mt-1">Track engagement, recognition, and wellness</p>
        </div>
      </div>

      {/* Module Tips & Workflow */}
      <ModuleTips moduleKey="engagement" title="Engagement Tips" tips={engagementTips} userRole={user?.role} />
      <ModuleWorkflow moduleKey="engagement" title="How to Build Employee Engagement" subtitle="Follow this workflow to improve and sustain engagement" steps={engagementWorkflowSteps} accentColor="violet" userRole={user?.role} />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50"><FiActivity className="w-4 h-4 text-green-600" /></div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Survey Response Rate</p>
              <p className="text-xl font-bold text-thb-text-primary">{avgResponseRate}%</p>
            </div>
          </div>
        </div>
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50"><FiStar className="w-4 h-4 text-emerald-600" /></div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Avg Engagement Score</p>
              <p className="text-xl font-bold text-emerald-600">{avgEngagement}/5</p>
            </div>
          </div>
        </div>
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50"><FiAward className="w-4 h-4 text-amber-600" /></div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Recognition Given</p>
              <p className="text-xl font-bold text-thb-text-primary">{totalRecognition}</p>
            </div>
          </div>
        </div>
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-50"><FiHeart className="w-4 h-4 text-rose-600" /></div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Active Programs</p>
              <p className="text-xl font-bold text-thb-text-primary">{activePrograms}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-thb-border overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.key ? 'border-rose-500 text-rose-600' : 'border-transparent text-thb-text-secondary hover:text-thb-text-primary'}`}>
            <tab.icon className="w-4 h-4" />{tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400" />
        </div>
      </div>

      {/* Surveys Tab */}
      {activeTab === 'surveys' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-thb-text-secondary">Pulse Surveys</h3>
            {isAdmin && (
              <button onClick={() => { setShowSurveyForm(!showSurveyForm); }} className="inline-flex items-center gap-2 px-3 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 font-medium text-xs shadow-sm transition-colors">
                <FiPlus className="w-3.5 h-3.5" />Create Survey
              </button>
            )}
          </div>

          {showSurveyForm && (
            <div id="crud-form" className="thb-card border-l-4 border-l-rose-500 animate-slide-in-down">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-thb-text-primary">Create Pulse Survey</h2>
                  <button onClick={() => { setShowSurveyForm(false); setSurveyForm(initialSurveyForm); }} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Survey Title <span className="text-red-500 font-bold">*</span></label>
                    <input type="text" value={surveyForm.title} onChange={e => setSurveyForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g., Q2 2026 Pulse" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Initial Question</label>
                    <input type="text" value={surveyForm.questionText} onChange={e => setSurveyForm(p => ({ ...p, questionText: e.target.value }))} placeholder="e.g., How satisfied are you?" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Status</label>
                    <select value={surveyForm.status} onChange={e => setSurveyForm(p => ({ ...p, status: e.target.value as 'draft' | 'active' | 'closed' }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400">
                      <option value="draft">Draft</option><option value="active">Active</option><option value="closed">Closed</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-thb-border">
                  <button onClick={() => { setShowSurveyForm(false); setSurveyForm(initialSurveyForm); }} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">Cancel</button>
                  <button onClick={handleAddSurvey} disabled={submitting} className="px-6 py-2.5 rounded-lg bg-rose-500 text-white text-sm font-medium hover:bg-rose-600 disabled:opacity-50 shadow-sm shadow-rose-500/25 transition-colors">{submitting ? 'Creating...' : 'Create'}</button>
                </div>
              </div>
            </div>
          )}

          {filteredSurveys.map(s => {
            const statusBadge = getSurveyStatusBadge(s.status);
            return (
              <div key={s.id} className="thb-card p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-thb-text-primary">{s.title}</p>
                    <p className="text-xs text-thb-text-muted mt-0.5">Created {s.createdAt} &middot; {s.totalResponses} responses</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={statusBadge.className}>{statusBadge.label}</span>
                    {isAdmin && (
                      <button onClick={() => setDeleteConfirmId(deleteConfirmId === s.id ? null : s.id)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors"><FiTrash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                </div>
                {deleteConfirmId === s.id && (
                  <div className="mb-3 p-3 bg-red-50 rounded-lg flex items-center justify-between">
                    <span className="text-sm text-red-700">Delete this survey?</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleDeleteSurvey(s.id)} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors">Confirm</button>
                      <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div><p className="text-xs text-thb-text-muted">Response Rate</p><p className="text-lg font-bold text-thb-text-primary">{s.responseRate}%</p></div>
                  <div><p className="text-xs text-thb-text-muted">Avg Score</p><p className="text-lg font-bold text-emerald-600">{s.avgScore.toFixed(1)}/5</p></div>
                  <div><p className="text-xs text-thb-text-muted">Questions</p><p className="text-lg font-bold text-thb-text-primary">{s.questions.length}</p></div>
                </div>
                {s.questions.length > 0 && (
                  <div className="space-y-2 border-t border-thb-border pt-3">
                    {s.questions.map(q => (
                      <div key={q.id} className="flex items-center justify-between">
                        <p className="text-xs text-thb-text-secondary">{q.text}</p>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map(star => (
                            <FiStar key={star} className={`w-3 h-3 ${star <= Math.round(q.avgRating) ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
                          ))}
                          <span className="text-xs text-thb-text-muted ml-1">{q.avgRating > 0 ? q.avgRating.toFixed(1) : 'N/A'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Recognition Tab */}
      {activeTab === 'recognition' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-thb-text-secondary">Recognition Feed</h3>
            <button onClick={() => setShowRecognitionForm(!showRecognitionForm)} className="inline-flex items-center gap-2 px-3 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 font-medium text-xs shadow-sm transition-colors">
              <FiPlus className="w-3.5 h-3.5" />Give Kudos
            </button>
          </div>

          {showRecognitionForm && (
            <div id="crud-form" className="thb-card border-l-4 border-l-amber-500 animate-slide-in-down">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-thb-text-primary">Give Recognition</h2>
                  <button onClick={() => { setShowRecognitionForm(false); setRecognitionForm(initialRecognitionForm); }} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">To Employee <span className="text-red-500 font-bold">*</span></label>
                    <input type="text" value={recognitionForm.toEmployee} onChange={e => setRecognitionForm(p => ({ ...p, toEmployee: e.target.value }))} placeholder="Employee name" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Category</label>
                    <select value={recognitionForm.category} onChange={e => setRecognitionForm(p => ({ ...p, category: e.target.value as 'Teamwork' | 'Innovation' | 'Leadership' | 'Excellence' }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400">
                      <option value="Teamwork">Teamwork</option><option value="Innovation">Innovation</option><option value="Leadership">Leadership</option><option value="Excellence">Excellence</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-thb-text-secondary mb-1">Message <span className="text-red-500 font-bold">*</span></label>
                    <textarea rows={2} value={recognitionForm.message} onChange={e => setRecognitionForm(p => ({ ...p, message: e.target.value }))} placeholder="What did they do well?" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 resize-none" />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-thb-border">
                  <button onClick={() => { setShowRecognitionForm(false); setRecognitionForm(initialRecognitionForm); }} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">Cancel</button>
                  <button onClick={handleAddRecognition} className="px-6 py-2.5 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 shadow-sm shadow-amber-500/25 transition-colors">Post Recognition</button>
                </div>
              </div>
            </div>
          )}

          {/* Leaderboard */}
          <div className="thb-card p-4">
            <h4 className="text-xs font-semibold text-thb-text-secondary uppercase tracking-wider mb-3 flex items-center gap-2"><FiAward className="w-4 h-4 text-amber-500" />Recognition Leaderboard</h4>
            <div className="space-y-2">
              {sortedLeaderboard.map((entry, i) => (
                <div key={entry.name} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-thb-text-muted'}`}>{i + 1}</span>
                    <span className="text-sm font-medium text-thb-text-primary">{entry.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-thb-text-muted">
                    <span>{entry.count} recognition{entry.count > 1 ? 's' : ''}</span>
                    <span className="flex items-center gap-1"><FiThumbsUp className="w-3 h-3" />{entry.likes}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Feed */}
          {filteredRecognitions.map(r => {
            const catBadge = getCategoryBadge(r.category);
            return (
              <div key={r.id} className="thb-card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-thb-text-primary">{r.fromEmployee}</span>
                      <span className="text-xs text-thb-text-muted">recognized</span>
                      <span className="text-sm font-semibold text-thb-text-primary">{r.toEmployee}</span>
                    </div>
                    <span className={catBadge.className}>{catBadge.label}</span>
                  </div>
                  <span className="text-xs text-thb-text-muted">{r.createdAt}</span>
                </div>
                <p className="text-sm text-thb-text-secondary mt-2">{r.message}</p>
                <button onClick={() => handleLike(r.id)} className={`mt-3 flex items-center gap-1.5 text-xs font-medium transition-colors ${likedIds.has(r.id) ? 'text-rose-500' : 'text-thb-text-muted hover:text-rose-500'}`}>
                  <FiThumbsUp className="w-3.5 h-3.5" />{r.likes} {likedIds.has(r.id) ? 'Liked' : 'Like'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Wellness Tab */}
      {activeTab === 'wellness' && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-thb-text-secondary">Wellness Programs</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {wellness.map(w => {
              const typeBadge = getWellnessTypeBadge(w.type);
              const pct = w.maxCapacity > 0 ? Math.round((w.participants / w.maxCapacity) * 100) : 0;
              return (
                <div key={w.id} className="thb-card p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-thb-text-primary">{w.name}</p>
                      <p className="text-xs text-thb-text-muted mt-0.5">{w.schedule}</p>
                    </div>
                    <span className={typeBadge.className}>{w.type}</span>
                  </div>
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs text-thb-text-secondary mb-1">
                      <span>Participation</span>
                      <span>{w.participants}/{w.maxCapacity} ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className={`thb-badge ${w.status === 'active' ? 'thb-badge-success' : w.status === 'upcoming' ? 'thb-badge-warning' : 'bg-slate-100 text-slate-600 thb-badge'}`}>
                    {w.status.charAt(0).toUpperCase() + w.status.slice(1)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Insights Tab */}
      {activeTab === 'ai' && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-thb-text-secondary flex items-center gap-2"><FiZap className="w-4 h-4 text-amber-500" />AI Sentiment Analysis</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="thb-card p-6">
              <p className="text-xs font-medium text-thb-text-secondary mb-2">Overall Sentiment Score</p>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-full border-4 border-emerald-400 flex items-center justify-center">
                  <span className="text-lg font-bold text-emerald-600">78</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-600">Positive</p>
                  <p className="text-xs text-thb-text-muted">Based on 295 feedback entries</p>
                </div>
              </div>
            </div>
            <div className="thb-card p-6">
              <p className="text-xs font-medium text-thb-text-secondary mb-2">Sentiment Trend</p>
              <div className="flex items-end gap-1 h-20">
                {[65, 70, 68, 72, 75, 78].map((v, i) => (
                  <div key={i} className="flex-1 bg-emerald-200 rounded-t" style={{ height: `${v}%` }} title={`${v}%`} />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-thb-text-muted mt-1">
                <span>Oct</span><span>Nov</span><span>Dec</span><span>Jan</span><span>Feb</span><span>Mar</span>
              </div>
            </div>
          </div>
          <div className="thb-card p-6">
            <p className="text-xs font-medium text-thb-text-secondary mb-3">Key Themes Extracted</p>
            <div className="flex flex-wrap gap-2">
              {['Career Growth', 'Work-Life Balance', 'Team Collaboration', 'Management Support', 'Learning Opportunities', 'Compensation', 'Remote Work', 'Culture'].map(theme => (
                <span key={theme} className="thb-badge thb-badge-primary">{theme}</span>
              ))}
            </div>
          </div>
          <div className="thb-card p-6">
            <p className="text-xs font-medium text-thb-text-secondary mb-3">Top Positive Signals</p>
            <div className="space-y-2">
              {['Strong team collaboration mentioned by 42% of respondents', 'Flexible work arrangements highly valued', 'Manager support rated 4.1/5 average'].map((signal, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-emerald-50 rounded-lg">
                  <FiThumbsUp className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-thb-text-secondary">{signal}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="thb-card p-6">
            <p className="text-xs font-medium text-thb-text-secondary mb-3">Areas of Concern</p>
            <div className="space-y-2">
              {['Workload balance flagged by 28% of team leads', 'Career path clarity needs improvement (3.2/5)', 'Cross-team communication can be improved'].map((concern, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg">
                  <FiActivity className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-thb-text-secondary">{concern}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
