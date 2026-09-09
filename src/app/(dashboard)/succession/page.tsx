'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiTarget,
  FiTrendingUp,
  FiUsers,
  FiAlertTriangle,
  FiPlus,
  FiX,
  FiSearch,
  FiEdit2,
  FiTrash2,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { isClientDemoMode } from '@/lib/site-mode';
import { useAuthStore } from '@/store/authStore';
import ModuleTips from '@/components/ModuleTips';
import ModuleWorkflow from '@/components/ModuleWorkflow';

/* ── Types ── */
interface SuccessorCandidate {
  id: string;
  name: string;
  currentRole: string;
  performance: 'Low' | 'Medium' | 'High';
  potential: 'Low' | 'Medium' | 'High';
  readiness: 'Ready Now' | '1-2 Years' | '3+ Years';
  skillsGap: string;
  developmentNeeds: string;
  department: string;
}

interface KeyPosition {
  id: string;
  title: string;
  incumbent: string;
  department: string;
  successors: string[];
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  impact: string;
}

/* ── Helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
// getAuthHeaders is used for API integration when available

function getRiskBadge(risk: string) {
  const map: Record<string, string> = {
    Low: 'thb-badge thb-badge-success',
    Medium: 'thb-badge thb-badge-warning',
    High: 'bg-orange-50 text-orange-700 thb-badge',
    Critical: 'thb-badge thb-badge-error',
  };
  return { className: map[risk] || 'thb-badge thb-badge-info', label: risk };
}

function getReadinessBadge(readiness: string) {
  const map: Record<string, string> = {
    'Ready Now': 'thb-badge thb-badge-success',
    '1-2 Years': 'thb-badge thb-badge-warning',
    '3+ Years': 'bg-slate-100 text-slate-600 thb-badge',
  };
  return { className: map[readiness] || 'thb-badge thb-badge-info', label: readiness };
}

/* ── Demo Data ── */
const demoCandidates: SuccessorCandidate[] = isClientDemoMode() ? [
  { id: '1', name: 'Aarav Sharma', currentRole: 'Senior Developer', performance: 'High', potential: 'High', readiness: 'Ready Now', skillsGap: 'Strategic planning (15%)', developmentNeeds: 'Executive leadership program', department: 'Engineering' },
  { id: '2', name: 'Priya Patel', currentRole: 'Lead Designer', performance: 'High', potential: 'Medium', readiness: '1-2 Years', skillsGap: 'Budget management (30%)', developmentNeeds: 'Financial acumen training', department: 'Design' },
  { id: '3', name: 'Rahul Verma', currentRole: 'Product Manager', performance: 'Medium', potential: 'High', readiness: '1-2 Years', skillsGap: 'Stakeholder management (20%)', developmentNeeds: 'Cross-functional leadership', department: 'Product' },
  { id: '4', name: 'Sneha Reddy', currentRole: 'Data Analyst', performance: 'Medium', potential: 'Medium', readiness: '3+ Years', skillsGap: 'Team leadership (40%)', developmentNeeds: 'Management foundations course', department: 'Analytics' },
  { id: '5', name: 'Vikram Singh', currentRole: 'DevOps Lead', performance: 'High', potential: 'High', readiness: 'Ready Now', skillsGap: 'Vendor negotiation (10%)', developmentNeeds: 'Strategic vendor management', department: 'Engineering' },
  { id: '6', name: 'Meera Joshi', currentRole: 'HR Manager', performance: 'Medium', potential: 'Low', readiness: '3+ Years', skillsGap: 'Business strategy (50%)', developmentNeeds: 'MBA program', department: 'HR' },
  { id: '7', name: 'Arjun Nair', currentRole: 'Tech Lead', performance: 'Low', potential: 'Medium', readiness: '3+ Years', skillsGap: 'Technical depth (35%)', developmentNeeds: 'Advanced architecture certification', department: 'Engineering' },
  { id: '8', name: 'Kavya Iyer', currentRole: 'Sales Manager', performance: 'High', potential: 'Medium', readiness: '1-2 Years', skillsGap: 'P&L management (25%)', developmentNeeds: 'Finance for non-finance managers', department: 'Sales' },
  { id: '9', name: 'Deepak Gupta', currentRole: 'Finance Analyst', performance: 'Low', potential: 'High', readiness: '1-2 Years', skillsGap: 'Communication skills (20%)', developmentNeeds: 'Executive presentation skills', department: 'Finance' },
] : [];

const demoPositions: KeyPosition[] = isClientDemoMode() ? [
  { id: '1', title: 'VP of Engineering', incumbent: 'Current VP', department: 'Engineering', successors: ['Aarav Sharma', 'Vikram Singh'], riskLevel: 'Critical', impact: 'Critical - Core technical leadership' },
  { id: '2', title: 'Head of Design', incumbent: 'Current Head', department: 'Design', successors: ['Priya Patel'], riskLevel: 'High', impact: 'High - Brand and UX ownership' },
  { id: '3', title: 'Director of Product', incumbent: 'Current Director', department: 'Product', successors: ['Rahul Verma', 'Kavya Iyer'], riskLevel: 'Medium', impact: 'Medium - Product roadmap impact' },
  { id: '4', title: 'Head of Analytics', incumbent: 'Current Head', department: 'Analytics', successors: ['Sneha Reddy'], riskLevel: 'High', impact: 'High - Data-driven decisions' },
  { id: '5', title: 'HR Director', incumbent: 'Current Director', department: 'HR', successors: ['Meera Joshi'], riskLevel: 'Medium', impact: 'Medium - People operations' },
  { id: '6', title: 'Sales Director', incumbent: 'Current Director', department: 'Sales', successors: ['Kavya Iyer'], riskLevel: 'Low', impact: 'Low - Revenue continuity' },
] : [];

const initialForm = {
  name: '',
  currentRole: '',
  department: '',
  performance: 'Medium' as 'Low' | 'Medium' | 'High',
  potential: 'Medium' as 'Low' | 'Medium' | 'High',
  readiness: '1-2 Years' as 'Ready Now' | '1-2 Years' | '3+ Years',
  skillsGap: '',
  developmentNeeds: '',
};

/* ── Tips & Workflow ── */
const successionTips = [
  { title: 'Identify Key Roles', description: 'Start by identifying positions that are critical to business continuity and have limited talent availability.' },
  { title: 'Assess Readiness', description: 'Evaluate successor candidates on performance, potential, and readiness to step into key roles.' },
  { title: 'Development Plans', description: 'Create individualized development plans to close skills gaps and prepare successors for future roles.' },
  { title: 'Talent Pipeline', description: 'Build a deep talent pipeline with multiple candidates per critical role to reduce single-point-of-failure risk.' },
  { title: 'Review Cycles', description: 'Conduct regular succession planning reviews to keep the pipeline current and aligned with organizational changes.' },
];

const successionWorkflowSteps = [
  { step: 1, title: 'Identify Critical Roles', description: 'Determine which positions are essential for business continuity and strategic success' },
  { step: 2, title: 'Assess Current Talent', description: 'Evaluate the performance and potential of existing employees using the 9-box grid' },
  { step: 3, title: 'Identify Successors', description: 'Select and nominate potential successors for each critical position' },
  { step: 4, title: 'Create Development Plans', description: 'Design targeted development programs to close skills gaps for each successor' },
  { step: 5, title: 'Provide Mentoring', description: 'Pair successors with senior leaders for mentoring and experiential learning' },
  { step: 6, title: 'Track Progress', description: 'Monitor development milestones and readiness progression over time' },
  { step: 7, title: 'Validate Readiness', description: 'Assess and confirm when successors are ready to assume their target roles' },
  { step: 8, title: 'Update Plan', description: 'Refresh the succession plan with new insights, roles, and candidate updates' },
];

/* ── Component ── */
export default function SuccessionPage() {
  const { user } = useAuthStore();
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');

  const [candidates, setCandidates] = useState(demoCandidates);
  const [positions] = useState(demoPositions);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'grid' | 'pipeline' | 'risk'>('grid');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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
  const keyPositions = positions.length;
  const identifiedSuccessors = candidates.length;
  const readyNow = candidates.filter(c => c.readiness === 'Ready Now').length;
  const criticalGaps = positions.filter(p => p.riskLevel === 'Critical' && p.successors.length < 2).length;

  /* 9-Box Grid data */
  const gridCells: { performance: string; potential: string; candidates: SuccessorCandidate[] }[] = [];
  for (const perf of ['Low', 'Medium', 'High']) {
    for (const pot of ['Low', 'Medium', 'High']) {
      gridCells.push({ performance: perf, potential: pot, candidates: candidates.filter(c => c.performance === perf && c.potential === pot) });
    }
  }

  function getGridCellStyle(perf: string, pot: string) {
    if (perf === 'High' && pot === 'High') return 'bg-emerald-100 border-emerald-300';
    if (perf === 'High' && pot === 'Medium') return 'bg-emerald-50 border-emerald-200';
    if (perf === 'Medium' && pot === 'High') return 'bg-green-50 border-green-200';
    if (perf === 'Medium' && pot === 'Medium') return 'bg-amber-50 border-amber-200';
    if (perf === 'High' && pot === 'Low') return 'bg-cyan-50 border-cyan-200';
    if (perf === 'Low' && pot === 'High') return 'bg-teal-50 border-teal-200';
    if (perf === 'Medium' && pot === 'Low') return 'bg-orange-50 border-orange-200';
    if (perf === 'Low' && pot === 'Medium') return 'bg-rose-50 border-rose-200';
    return 'bg-slate-50 border-slate-200';
  }

  function getGridLabel(perf: string, pot: string) {
    if (perf === 'High' && pot === 'High') return 'Stars';
    if (perf === 'High' && pot === 'Medium') return 'High Performers';
    if (perf === 'Medium' && pot === 'High') return 'High Potentials';
    if (perf === 'Medium' && pot === 'Medium') return 'Core Contributors';
    if (perf === 'High' && pot === 'Low') return 'Specialists';
    if (perf === 'Low' && pot === 'High') return 'Rough Diamonds';
    if (perf === 'Medium' && pot === 'Low') return 'Backbone';
    if (perf === 'Low' && pot === 'Medium') return 'Up or Out';
    return 'Underperformers';
  }

  /* Filtered */
  const filteredCandidates = candidates.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.currentRole.toLowerCase().includes(search.toLowerCase()) || c.department.toLowerCase().includes(search.toLowerCase())
  );
  const filteredPositions = positions.filter(p =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.incumbent.toLowerCase().includes(search.toLowerCase())
  );

  /* Form handlers */
  const handleShowAddForm = () => {
    setForm(initialForm); setEditingId(null); setShowForm(true);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleShowEditForm = (c: SuccessorCandidate) => {
    setForm({ name: c.name, currentRole: c.currentRole, department: c.department, performance: c.performance, potential: c.potential, readiness: c.readiness, skillsGap: c.skillsGap, developmentNeeds: c.developmentNeeds });
    setEditingId(c.id); setShowForm(true);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleCancelForm = () => { setShowForm(false); setEditingId(null); setForm(initialForm); };

  const handleSubmit = async () => {
    if (!form.name || !form.currentRole) { toast.error('Name and role are required'); return; }
    try {
      setSubmitting(true);
      if (editingId) {
        setCandidates(prev => prev.map(c => c.id === editingId ? { ...c, ...form } : c));
        toast.success('Candidate updated');
      } else {
        setCandidates(prev => [{ id: Date.now().toString(), ...form }, ...prev]);
        toast.success('Candidate added');
      }
      handleCancelForm();
    } catch { toast.error('Operation failed'); } finally { setSubmitting(false); }
  };

  const handleDelete = (id: string) => {
    setCandidates(prev => prev.filter(c => c.id !== id));
    toast.success('Candidate removed');
    setDeleteConfirmId(null);
  };

  const tabs = [
    { key: 'grid' as const, label: '9-Box Grid', icon: FiTarget },
    { key: 'pipeline' as const, label: 'Talent Pipeline', icon: FiUsers },
    { key: 'risk' as const, label: 'Risk Assessment', icon: FiAlertTriangle },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiTarget className="w-6 h-6 text-teal-500" />
            Succession Planning
          </h1>
          <p className="text-thb-text-secondary mt-1">Manage talent pipeline and succession readiness</p>
        </div>
        {isAdmin && (
          <button onClick={handleShowAddForm} className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-medium text-sm shadow-sm shadow-teal-500/25 transition-colors">
            <FiPlus className="w-4 h-4" />Add Successor
          </button>
        )}
      </div>

      {/* Module Tips & Workflow */}
      <ModuleTips moduleKey="succession" title="Succession Planning Tips" tips={successionTips} userRole={user?.role} />
      <ModuleWorkflow moduleKey="succession" title="How to Build a Succession Plan" subtitle="Follow this workflow to build a robust talent pipeline" steps={successionWorkflowSteps} accentColor="blue" userRole={user?.role} />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-50"><FiTarget className="w-4 h-4 text-teal-600" /></div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Key Positions</p>
              <p className="text-xl font-bold text-thb-text-primary">{keyPositions}</p>
            </div>
          </div>
        </div>
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50"><FiUsers className="w-4 h-4 text-green-600" /></div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Identified Successors</p>
              <p className="text-xl font-bold text-thb-text-primary">{identifiedSuccessors}</p>
            </div>
          </div>
        </div>
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50"><FiTrendingUp className="w-4 h-4 text-emerald-600" /></div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Ready Now</p>
              <p className="text-xl font-bold text-emerald-600">{readyNow}</p>
            </div>
          </div>
        </div>
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-50"><FiAlertTriangle className="w-4 h-4 text-red-600" /></div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Critical Gaps</p>
              <p className="text-xl font-bold text-red-600">{criticalGaps}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-thb-border overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.key ? 'border-teal-500 text-teal-600' : 'border-transparent text-thb-text-secondary hover:text-thb-text-primary'}`}>
            <tab.icon className="w-4 h-4" />{tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search successors, positions..." className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400" />
        </div>
      </div>

      {/* Inline Form */}
      {showForm && (
        <div id="crud-form" className="thb-card border-l-4 border-l-teal-500 animate-slide-in-down">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">{editingId ? 'Edit Successor' : 'Add Successor Candidate'}</h2>
              <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Name *</label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Employee name" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Current Role *</label>
                <input type="text" value={form.currentRole} onChange={e => setForm(p => ({ ...p, currentRole: e.target.value }))} placeholder="e.g., Senior Developer" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Department</label>
                <input type="text" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} placeholder="e.g., Engineering" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Performance</label>
                <select value={form.performance} onChange={e => setForm(p => ({ ...p, performance: e.target.value as 'Low' | 'Medium' | 'High' }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400">
                  <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Potential</label>
                <select value={form.potential} onChange={e => setForm(p => ({ ...p, potential: e.target.value as 'Low' | 'Medium' | 'High' }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400">
                  <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Readiness</label>
                <select value={form.readiness} onChange={e => setForm(p => ({ ...p, readiness: e.target.value as 'Ready Now' | '1-2 Years' | '3+ Years' }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400">
                  <option value="Ready Now">Ready Now</option><option value="1-2 Years">1-2 Years</option><option value="3+ Years">3+ Years</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Skills Gap</label>
                <input type="text" value={form.skillsGap} onChange={e => setForm(p => ({ ...p, skillsGap: e.target.value }))} placeholder="e.g., Leadership (20%)" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Development Needs</label>
                <input type="text" value={form.developmentNeeds} onChange={e => setForm(p => ({ ...p, developmentNeeds: e.target.value }))} placeholder="e.g., Executive coaching" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-thb-border">
              <button onClick={handleCancelForm} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2.5 rounded-lg bg-teal-500 text-white text-sm font-medium hover:bg-teal-600 disabled:opacity-50 shadow-sm shadow-teal-500/25 transition-colors">{submitting ? 'Saving...' : editingId ? 'Update' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 9-Box Grid */}
      {activeTab === 'grid' && (
        <div className="thb-card p-6">
          <h3 className="text-sm font-semibold text-thb-text-secondary mb-4">9-Box Grid: Performance vs Potential</h3>
          <div className="overflow-x-auto">
            <div className="min-w-[500px]">
              {/* Column Headers */}
              <div className="grid grid-cols-4 gap-2 mb-2">
                <div />
                <div className="text-center text-xs font-semibold text-thb-text-secondary">Low Potential</div>
                <div className="text-center text-xs font-semibold text-thb-text-secondary">Medium Potential</div>
                <div className="text-center text-xs font-semibold text-thb-text-secondary">High Potential</div>
              </div>
              {/* Grid rows: High perf at top, Low perf at bottom */}
              {(['High', 'Medium', 'Low'] as const).map(perf => (
                <div key={perf} className="grid grid-cols-4 gap-2 mb-2">
                  <div className="flex items-center justify-end pr-2">
                    <span className="text-xs font-semibold text-thb-text-secondary">{perf} Perf</span>
                  </div>
                  {(['Low', 'Medium', 'High'] as const).map(pot => {
                    const cellCandidates = candidates.filter(c => c.performance === perf && c.potential === pot);
                    return (
                      <div key={`${perf}-${pot}`} className={`border rounded-lg p-3 min-h-[100px] ${getGridCellStyle(perf, pot)}`}>
                        <p className="text-[10px] font-semibold text-thb-text-muted mb-1">{getGridLabel(perf, pot)}</p>
                        <div className="space-y-1">
                          {cellCandidates.map(c => (
                            <div key={c.id} className="text-[11px] font-medium text-thb-text-primary bg-white/70 rounded px-1.5 py-0.5 truncate" title={`${c.name} - ${c.currentRole}`}>
                              {c.name}
                            </div>
                          ))}
                        </div>
                        {cellCandidates.length === 0 && <p className="text-[10px] text-thb-text-muted italic">No candidates</p>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Talent Pipeline */}
      {activeTab === 'pipeline' && (
        <div className="space-y-4">
          {/* Key Positions with successors */}
          {filteredPositions.map(pos => {
            const riskBadge = getRiskBadge(pos.riskLevel);
            return (
              <div key={pos.id} className="thb-card p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-thb-text-primary">{pos.title}</p>
                    <p className="text-xs text-thb-text-muted">{pos.department} &middot; Incumbent: {pos.incumbent}</p>
                  </div>
                  <span className={riskBadge.className}>{riskBadge.label}</span>
                </div>
                <div className="space-y-2">
                  {pos.successors.map(name => {
                    const successor = candidates.find(c => c.name === name);
                    if (!successor) return null;
                    const readyBadge = getReadinessBadge(successor.readiness);
                    return (
                      <div key={successor.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="text-sm font-medium text-thb-text-primary">{successor.name}</p>
                            <p className="text-xs text-thb-text-muted">{successor.currentRole}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={readyBadge.className}>{readyBadge.label}</span>
                          {isAdmin && (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleShowEditForm(successor)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-teal-500 hover:bg-teal-50 transition-colors" title="Edit"><FiEdit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setDeleteConfirmId(successor.id)} className="p-1.5 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><FiTrash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {pos.successors.length === 0 && <p className="text-xs text-thb-text-muted italic">No successors identified</p>}
                </div>
              </div>
            );
          })}

          {/* Readiness Score Cards */}
          <div className="thb-card p-4">
            <h3 className="text-xs font-semibold text-thb-text-secondary uppercase tracking-wider mb-3">Readiness Scoring</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredCandidates.map(c => (
                <div key={c.id} className="p-3 border border-thb-border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-thb-text-primary">{c.name}</p>
                    <span className={getReadinessBadge(c.readiness).className}>{c.readiness}</span>
                  </div>
                  <p className="text-xs text-thb-text-muted mb-1">{c.currentRole} &middot; {c.department}</p>
                  <div className="space-y-1 mt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-thb-text-secondary">Skills Gap</span>
                      <span className="text-amber-600 font-medium">{c.skillsGap || 'None'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-thb-text-secondary">Development</span>
                      <span className="text-green-600 font-medium truncate ml-2 max-w-[150px]">{c.developmentNeeds || 'None'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Delete Confirmation inline */}
          {deleteConfirmId && (() => {
            const c = candidates.find(x => x.id === deleteConfirmId);
            if (!c) return null;
            return (
              <div className="thb-card p-4 border-l-4 border-l-red-500 bg-red-50">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-red-700 font-medium">Remove &quot;{c.name}&quot; from succession pipeline?</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleDelete(c.id)} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors">Confirm</button>
                    <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Risk Assessment */}
      {activeTab === 'risk' && (
        <div className="space-y-4">
          <div className="thb-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-thb-border bg-slate-50/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Position</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Department</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Successors</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Risk Level</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Impact if Vacant</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPositions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center">
                        <FiAlertTriangle className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
                        <p className="text-thb-text-secondary font-medium">No positions found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredPositions.map(p => {
                      const riskBadge = getRiskBadge(p.riskLevel);
                      return (
                        <tr key={p.id} className="border-b border-thb-border/50 hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-thb-text-primary">{p.title}</td>
                          <td className="px-4 py-3 text-sm text-thb-text-secondary">{p.department}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {p.successors.map(s => (
                                <span key={s} className="thb-badge thb-badge-primary">{s}</span>
                              ))}
                              {p.successors.length === 0 && <span className="text-xs text-thb-text-muted italic">None identified</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3"><span className={riskBadge.className}>{riskBadge.label}</span></td>
                          <td className="px-4 py-3 text-sm text-thb-text-secondary truncate max-w-[200px]">{p.impact}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Risk Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(['Critical', 'High', 'Medium', 'Low'] as const).map(level => {
              const count = positions.filter(p => p.riskLevel === level).length;
              return (
                <div key={level} className="thb-card p-4">
                  <p className="text-xs font-medium text-thb-text-secondary">{level} Risk</p>
                  <p className={`text-xl font-bold mt-1 ${level === 'Critical' ? 'text-red-600' : level === 'High' ? 'text-orange-600' : level === 'Medium' ? 'text-amber-600' : 'text-emerald-600'}`}>{count}</p>
                  <p className="text-xs text-thb-text-muted">positions</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
