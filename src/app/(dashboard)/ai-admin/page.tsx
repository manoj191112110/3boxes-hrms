'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiZap,
  FiShield,
  FiCheck,
  FiClock,
  FiMonitor,
  FiPlus,
  FiX,
  FiSearch,
  FiEdit2,
  FiTrash2,
  FiAlertTriangle,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import ModuleTips from '@/components/ModuleTips';
import ModuleWorkflow from '@/components/ModuleWorkflow';

/* ── Types ── */
interface AIPrompt {
  id: string;
  name: string;
  model: string;
  purpose: string;
  status: 'active' | 'inactive' | 'draft';
  lastModified: string;
  version: number;
}

interface BiasCategory {
  category: string;
  score: number;
  threshold: number;
  status: 'pass' | 'warning' | 'fail';
}

interface ApprovalItem {
  id: string;
  action: string;
  model: string;
  input: string;
  output: string;
  requestedBy: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'modified';
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  model: string;
  action: string;
  input: string;
  output: string;
  duration: number;
}

interface MonitoringStats {
  apiCalls: number;
  tokensUsed: number;
  avgResponseTime: number;
  errorRate: number;
  callsLastHour: number;
  tokensLastHour: number;
}

/* ── Helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
// getAuthHeaders is used for API integration when available

function getPromptStatusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'thb-badge thb-badge-success',
    inactive: 'bg-slate-100 text-slate-600 thb-badge',
    draft: 'thb-badge thb-badge-warning',
  };
  const labels: Record<string, string> = { active: 'Active', inactive: 'Inactive', draft: 'Draft' };
  return { className: map[status] || 'thb-badge thb-badge-info', label: labels[status] || status };
}

function getApprovalStatusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'thb-badge thb-badge-warning',
    approved: 'thb-badge thb-badge-success',
    rejected: 'thb-badge thb-badge-error',
    modified: 'bg-green-50 text-green-700 thb-badge',
  };
  return { className: map[status] || 'thb-badge thb-badge-info', label: status.charAt(0).toUpperCase() + status.slice(1) };
}

function getBiasStatusBadge(status: string) {
  const map: Record<string, string> = {
    pass: 'thb-badge thb-badge-success',
    warning: 'thb-badge thb-badge-warning',
    fail: 'thb-badge thb-badge-error',
  };
  const labels: Record<string, string> = { pass: 'Pass', warning: 'Warning', fail: 'Fail' };
  return { className: map[status] || 'thb-badge thb-badge-info', label: labels[status] || status };
}

/* ── Demo Data ── */
const aiAdminTips = [
  { title: 'Configure AI Models', description: 'Select and configure which AI models (GPT-4, Claude, etc.) are available for each HR function in your organization.' },
  { title: 'Set Usage Limits', description: 'Define token limits, rate limits, and budget caps to control AI costs and prevent unexpected overages.' },
  { title: 'Review AI Logs', description: 'Audit all AI interactions to ensure compliance, accuracy, and detect any anomalous usage patterns.' },
  { title: 'Manage Permissions', description: 'Control which roles can access specific AI features and approve high-impact AI decisions before execution.' },
  { title: 'Monitor Performance', description: 'Track API calls, response times, error rates, and token usage to optimize AI operations and costs.' },
];

const aiAdminWorkflowSteps = [
  { step: 1, title: 'Access AI Admin', description: 'Navigate to the AI Admin Console from the sidebar' },
  { step: 2, title: 'Configure Models', description: 'Select AI models and set parameters for each use case' },
  { step: 3, title: 'Set Usage Limits', description: 'Define token limits, rate limits, and budget caps' },
  { step: 4, title: 'Manage User Permissions', description: 'Control role-based access to AI features' },
  { step: 5, title: 'Review AI Logs', description: 'Audit AI interactions for compliance and accuracy' },
  { step: 6, title: 'Monitor Performance', description: 'Track API usage, response times, and error rates' },
  { step: 7, title: 'Optimize Settings', description: 'Fine-tune models and limits based on usage data' },
];

/* ── Demo Data ── */
const demoPrompts: AIPrompt[] = [
  { id: '1', name: 'Resume Screening', model: 'GPT-4', purpose: 'Screen and rank candidate resumes', status: 'active', lastModified: '2026-03-01', version: 3 },
  { id: '2', name: 'Interview Question Gen', model: 'Claude 3.5', purpose: 'Generate role-specific interview questions', status: 'active', lastModified: '2026-02-28', version: 2 },
  { id: '3', name: 'Performance Summary', model: 'GPT-4', purpose: 'Summarize performance review data', status: 'active', lastModified: '2026-02-25', version: 5 },
  { id: '4', name: 'Sentiment Analysis', model: 'GPT-3.5', purpose: 'Analyze employee feedback sentiment', status: 'active', lastModified: '2026-02-20', version: 4 },
  { id: '5', name: 'Job Description Writer', model: 'Claude 3.5', purpose: 'Generate inclusive job descriptions', status: 'draft', lastModified: '2026-03-02', version: 1 },
  { id: '6', name: 'Leave Policy QA', model: 'GPT-3.5', purpose: 'Answer employee leave policy questions', status: 'inactive', lastModified: '2026-01-15', version: 2 },
];

const demoBias: BiasCategory[] = [
  { category: 'Gender', score: 0.12, threshold: 0.15, status: 'pass' },
  { category: 'Race', score: 0.14, threshold: 0.15, status: 'pass' },
  { category: 'Age', score: 0.16, threshold: 0.15, status: 'warning' },
  { category: 'Disability', score: 0.08, threshold: 0.15, status: 'pass' },
  { category: 'Religion', score: 0.05, threshold: 0.15, status: 'pass' },
  { category: 'Nationality', score: 0.19, threshold: 0.15, status: 'fail' },
];

const demoApprovals: ApprovalItem[] = [
  { id: '1', action: 'Resume Auto-Reject', model: 'GPT-4', input: 'Candidate resume scoring - threshold 0.3', output: 'Score: 0.28 - Recommend reject', requestedBy: 'AI System', requestedAt: '2026-03-03 10:45 AM', status: 'pending' },
  { id: '2', action: 'Salary Recommendation', model: 'GPT-4', input: 'Market data analysis for Senior Dev role', output: 'Recommended range: $120K-$145K', requestedBy: 'AI System', requestedAt: '2026-03-03 09:30 AM', status: 'pending' },
  { id: '3', action: 'Performance Flag', model: 'Claude 3.5', input: 'Quarterly performance deviation alert', output: 'Employee #1042 below threshold - flag for review', requestedBy: 'AI System', requestedAt: '2026-03-02 04:15 PM', status: 'approved' },
  { id: '4', action: 'Training Recommendation', model: 'GPT-3.5', input: 'Skill gap analysis for team Alpha', output: 'Recommend React Advanced course for 3 members', requestedBy: 'AI System', requestedAt: '2026-03-02 11:00 AM', status: 'modified' },
  { id: '5', action: 'Resume Auto-Reject', model: 'GPT-4', input: 'Candidate resume scoring - threshold 0.3', output: 'Score: 0.15 - Recommend reject', requestedBy: 'AI System', requestedAt: '2026-03-01 02:20 PM', status: 'rejected' },
];

const demoAuditLogs: AuditLogEntry[] = [
  { id: '1', timestamp: '2026-03-03 10:45:12', user: 'AI System', model: 'GPT-4', action: 'Resume Screening', input: '5 resumes processed', output: '3 passed, 2 flagged', duration: 4.2 },
  { id: '2', timestamp: '2026-03-03 10:42:08', user: 'hr_admin@3boxeshrms.com', model: 'GPT-4', action: 'Performance Summary', input: 'Q4 review data batch', output: 'Summary generated', duration: 6.1 },
  { id: '3', timestamp: '2026-03-03 10:38:55', user: 'AI System', model: 'Claude 3.5', action: 'Interview Question Gen', input: 'Backend Developer role', output: '8 questions generated', duration: 3.8 },
  { id: '4', timestamp: '2026-03-03 10:35:20', user: 'manager@3boxeshrms.com', model: 'GPT-3.5', action: 'Sentiment Analysis', input: 'Employee pulse survey #12', output: 'Score: 78/100 Positive', duration: 2.9 },
  { id: '5', timestamp: '2026-03-03 10:30:00', user: 'AI System', model: 'GPT-4', action: 'Salary Recommendation', input: 'Senior Dev market data', output: '$120K-$145K range', duration: 5.4 },
];

const demoMonitoring: MonitoringStats = {
  apiCalls: 12847,
  tokensUsed: 4258300,
  avgResponseTime: 3.2,
  errorRate: 0.8,
  callsLastHour: 142,
  tokensLastHour: 48200,
};

const initialPromptForm = {
  name: '',
  model: 'GPT-4',
  purpose: '',
  status: 'draft' as 'active' | 'inactive' | 'draft',
};

/* ── Component ── */
export default function AIAdminPage() {
  const { user } = useAuthStore();
  const isAdmin = ['super_admin', 'tenant_admin'].includes(user?.role || '');

  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [biasData, setBiasData] = useState<BiasCategory[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [monitoring, setMonitoring] = useState<MonitoringStats>({
    apiCalls: 0, tokensUsed: 0, avgResponseTime: 0, errorRate: 0, callsLastHour: 0, tokensLastHour: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'prompts' | 'bias' | 'approvals' | 'audit' | 'monitoring'>('prompts');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialPromptForm);
  const [submitting, setSubmitting] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  /* Fetch LIVE data from /api/ai-admin */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/ai-admin', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const configs = data.configs || [];
        const promptLogs = data.promptLogs || [];
        const stats = data.stats || {};

        // Map AIConfig records to AIPrompt format
        const mappedPrompts: AIPrompt[] = configs.map((c: any) => ({
          id: c.id,
          name: c.name || 'Untitled',
          model: c.model || 'gpt-4',
          purpose: c.description || c.category || '',
          status: c.isActive ? 'active' : 'inactive',
          lastModified: c.updatedAt ? new Date(c.updatedAt).toISOString().split('T')[0] : '',
          version: parseInt(c.version || '1'),
        }));
        setPrompts(mappedPrompts);

        // Map prompt logs to audit entries
        const mappedLogs: AuditLogEntry[] = promptLogs.map((l: any) => ({
          id: l.id,
          timestamp: l.createdAt ? new Date(l.createdAt).toISOString() : '',
          user: l.userId || 'System',
          model: l.model || 'unknown',
          action: l.category || l.type || 'AI Call',
          input: l.inputText ? l.inputText.slice(0, 60) : '—',
          output: l.outputText ? l.outputText.slice(0, 60) : '—',
          duration: l.latencyMs ? l.latencyMs / 1000 : 0,
        }));
        setAuditLogs(mappedLogs);

        // Set monitoring stats from live data
        setMonitoring({
          apiCalls: stats.totalRequests24h || 0,
          tokensUsed: stats.totalTokens24h || 0,
          avgResponseTime: stats.avgLatency ? stats.avgLatency / 1000 : 0,
          errorRate: stats.errorRate || 0,
          callsLastHour: 0,
          tokensLastHour: 0,
        });
      }
    } catch { /* empty state on error */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { queueMicrotask(() => fetchData()); }, [fetchData]);

  /* Stats */
  const activeModels = new Set(prompts.filter(p => p.status === 'active').map(p => p.model)).size;
  const totalPrompts = prompts.length;
  const pendingApprovals = approvals.filter(a => a.status === 'pending').length;
  const avgResponseTime = monitoring.avgResponseTime;

  /* Filtered */
  const filteredPrompts = prompts.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.model.toLowerCase().includes(search.toLowerCase()) || p.purpose.toLowerCase().includes(search.toLowerCase()));
  const filteredApprovals = approvals.filter(a => !search || a.action.toLowerCase().includes(search.toLowerCase()) || a.model.toLowerCase().includes(search.toLowerCase()));
  const filteredLogs = auditLogs.filter(l => !search || l.action.toLowerCase().includes(search.toLowerCase()) || l.user.toLowerCase().includes(search.toLowerCase()));

  /* Form handlers */
  const handleShowAddForm = () => {
    setForm(initialPromptForm); setEditingId(null); setShowForm(true);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleShowEditForm = (p: AIPrompt) => {
    setForm({ name: p.name, model: p.model, purpose: p.purpose, status: p.status });
    setEditingId(p.id); setShowForm(true);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleCancelForm = () => { setShowForm(false); setEditingId(null); setForm(initialPromptForm); };

  const handleSubmit = async () => {
    if (!form.name || !form.purpose) { toast.error('Name and purpose are required'); return; }
    try {
      setSubmitting(true);
      if (editingId) {
        // Update via API
        const res = await fetch(`/api/ai-admin/${editingId}`, {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify({ name: form.name, model: form.model, description: form.purpose, isActive: form.status === 'active' }),
        });
        if (res.ok) {
          toast.success('Prompt updated');
          fetchData();
        } else { toast.error('Failed to update prompt'); }
      } else {
        // Create via API
        const res = await fetch('/api/ai-admin', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ name: form.name, type: 'prompt', category: 'general', content: form.purpose, model: form.model, isActive: form.status === 'active' }),
        });
        if (res.ok) {
          toast.success('Prompt created');
          fetchData();
        } else { toast.error('Failed to create prompt'); }
      }
      handleCancelForm();
    } catch { toast.error('Operation failed'); } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/ai-admin/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) { toast.success('Prompt deleted'); fetchData(); }
      else { toast.error('Failed to delete'); }
    } catch { toast.error('Failed to delete'); }
    setDeleteConfirmId(null);
  };

  const handleApproval = (id: string, status: 'approved' | 'rejected') => {
    setApprovals(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    toast.success(`Decision ${status}`);
  };

  const tabs = [
    { key: 'prompts' as const, label: 'Prompts', icon: FiZap },
    { key: 'bias' as const, label: 'Bias Monitor', icon: FiShield },
    { key: 'approvals' as const, label: 'Approvals', icon: FiCheck },
    { key: 'audit' as const, label: 'Audit Logs', icon: FiClock },
    { key: 'monitoring' as const, label: 'Monitoring', icon: FiMonitor },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiZap className="w-6 h-6 text-amber-500" />
            AI Admin Console
          </h1>
          <p className="text-thb-text-secondary mt-1">Manage AI models, prompts, bias, and approvals</p>
        </div>
        {isAdmin && activeTab === 'prompts' && (
          <button onClick={handleShowAddForm} className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium text-sm shadow-sm shadow-amber-500/25 transition-colors">
            <FiPlus className="w-4 h-4" />Add Prompt
          </button>
        )}
      </div>

      {/* Module Tips & Workflow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ModuleTips moduleKey="ai_admin" title="AI Admin Tips" tips={aiAdminTips} userRole={user?.role} />
        <ModuleWorkflow moduleKey="ai_admin" title="How to Configure AI Settings" steps={aiAdminWorkflowSteps} accentColor="violet" userRole={user?.role} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50"><FiZap className="w-4 h-4 text-amber-600" /></div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Active Models</p>
              <p className="text-xl font-bold text-thb-text-primary">{activeModels}</p>
            </div>
          </div>
        </div>
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50"><FiMonitor className="w-4 h-4 text-green-600" /></div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Total Prompts</p>
              <p className="text-xl font-bold text-thb-text-primary">{totalPrompts}</p>
            </div>
          </div>
        </div>
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50"><FiCheck className="w-4 h-4 text-amber-600" /></div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Pending Approvals</p>
              <p className="text-xl font-bold text-amber-600">{pendingApprovals}</p>
            </div>
          </div>
        </div>
        <div className="thb-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50"><FiClock className="w-4 h-4 text-emerald-600" /></div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Avg Response Time</p>
              <p className="text-xl font-bold text-thb-text-primary">{avgResponseTime}s</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-thb-border overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.key ? 'border-amber-500 text-amber-600' : 'border-transparent text-thb-text-secondary hover:text-thb-text-primary'}`}>
            <tab.icon className="w-4 h-4" />{tab.label}
            {tab.key === 'approvals' && pendingApprovals > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-full">{pendingApprovals}</span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400" />
        </div>
      </div>

      {/* Inline Form */}
      {showForm && (
        <div id="crud-form" className="thb-card border-l-4 border-l-amber-500 animate-slide-in-down">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">{editingId ? 'Edit Prompt' : 'Add AI Prompt'}</h2>
              <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"><FiX className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Prompt Name *</label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Resume Screener" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Model</label>
                <select value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400">
                  <option value="GPT-4">GPT-4</option><option value="GPT-3.5">GPT-3.5</option><option value="Claude 3.5">Claude 3.5</option><option value="Gemini Pro">Gemini Pro</option><option value="Llama 3">Llama 3</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Purpose *</label>
                <input type="text" value={form.purpose} onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))} placeholder="What does this prompt do?" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as 'active' | 'inactive' | 'draft' }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400">
                  <option value="draft">Draft</option><option value="active">Active</option><option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-thb-border">
              <button onClick={handleCancelForm} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2.5 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50 shadow-sm shadow-amber-500/25 transition-colors">{submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Prompts Tab */}
      {activeTab === 'prompts' && (
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-thb-border bg-slate-50/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Model</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Purpose</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Version</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Last Modified</th>
                  {isAdmin && <th className="text-right px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-thb-border/50 animate-pulse"><td className="px-4 py-3"><div className="h-3 w-28 bg-slate-200 rounded" /></td><td className="px-4 py-3"><div className="h-3 w-16 bg-slate-200 rounded" /></td><td className="px-4 py-3"><div className="h-3 w-40 bg-slate-200 rounded" /></td><td className="px-4 py-3"><div className="h-3 w-8 bg-slate-200 rounded" /></td><td className="px-4 py-3"><div className="h-5 w-14 bg-slate-200 rounded-full" /></td><td className="px-4 py-3"><div className="h-3 w-20 bg-slate-200 rounded" /></td>{isAdmin && <td className="px-4 py-3"><div className="h-3 w-16 bg-slate-200 rounded ml-auto" /></td>}</tr>
                  ))
                ) : filteredPrompts.length === 0 ? (
                  <tr><td colSpan={isAdmin ? 7 : 6} className="px-4 py-12 text-center"><FiZap className="w-10 h-10 text-thb-text-muted mx-auto mb-3" /><p className="text-thb-text-secondary font-medium">No prompts found</p></td></tr>
                ) : (
                  filteredPrompts.map(p => {
                    const statusBadge = getPromptStatusBadge(p.status);
                    return (
                      <tr key={p.id} className="border-b border-thb-border/50 hover:bg-slate-50/50 transition-colors">
                        {deleteConfirmId === p.id ? (
                          <td colSpan={isAdmin ? 7 : 6} className="px-4 py-3 bg-red-50">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-red-700 font-medium">Delete prompt &quot;{p.name}&quot;?</span>
                              <div className="flex items-center gap-2">
                                <button onClick={() => handleDelete(p.id)} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors">Confirm</button>
                                <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                              </div>
                            </div>
                          </td>
                        ) : (
                          <>
                            <td className="px-4 py-3 text-sm font-medium text-thb-text-primary">{p.name}</td>
                            <td className="px-4 py-3"><span className="thb-badge thb-badge-purple">{p.model}</span></td>
                            <td className="px-4 py-3 text-sm text-thb-text-secondary truncate max-w-[200px]">{p.purpose}</td>
                            <td className="px-4 py-3 text-sm text-thb-text-secondary">v{p.version}</td>
                            <td className="px-4 py-3"><span className={statusBadge.className}>{statusBadge.label}</span></td>
                            <td className="px-4 py-3 text-sm text-thb-text-secondary">{p.lastModified}</td>
                            {isAdmin && (
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1">
                                  <button onClick={() => handleShowEditForm(p)} className="p-2 rounded-lg text-thb-text-muted hover:text-amber-500 hover:bg-amber-50 transition-colors" title="Edit"><FiEdit2 className="w-4 h-4" /></button>
                                  <button onClick={() => setDeleteConfirmId(p.id)} className="p-2 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete"><FiTrash2 className="w-4 h-4" /></button>
                                </div>
                              </td>
                            )}
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bias Monitor Tab */}
      {activeTab === 'bias' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {biasData.map(b => {
              const biasBadge = getBiasStatusBadge(b.status);
              const pct = Math.round((b.score / b.threshold) * 100);
              return (
                <div key={b.category} className="thb-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-thb-text-primary">{b.category}</p>
                    <span className={biasBadge.className}>{biasBadge.label}</span>
                  </div>
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs text-thb-text-secondary mb-1">
                      <span>Bias Score</span>
                      <span>{b.score.toFixed(2)} / {b.threshold.toFixed(2)} threshold</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${b.status === 'pass' ? 'bg-emerald-500' : b.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                  {b.status === 'fail' && (
                    <div className="flex items-start gap-2 p-2 bg-red-50 rounded-lg mt-2">
                      <FiAlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-red-700">Exceeds threshold. Review recommended.</p>
                    </div>
                  )}
                  {b.status === 'warning' && (
                    <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg mt-2">
                      <FiShield className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-700">Approaching threshold. Monitor closely.</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="thb-card p-4">
            <p className="text-xs font-medium text-thb-text-secondary mb-2">Overall Bias Assessment</p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-xs text-thb-text-secondary">Pass ({biasData.filter(b => b.status === 'pass').length})</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500" /><span className="text-xs text-thb-text-secondary">Warning ({biasData.filter(b => b.status === 'warning').length})</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500" /><span className="text-xs text-thb-text-secondary">Fail ({biasData.filter(b => b.status === 'fail').length})</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Approvals Tab */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          {filteredApprovals.length === 0 ? (
            <div className="thb-card p-12 text-center"><FiCheck className="w-10 h-10 text-thb-text-muted mx-auto mb-3" /><p className="text-thb-text-secondary font-medium">No approval items found</p></div>
          ) : filteredApprovals.map(a => {
            const statusBadge = getApprovalStatusBadge(a.status);
            return (
              <div key={a.id} className="thb-card p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-thb-text-primary">{a.action}</p>
                    <p className="text-xs text-thb-text-muted">{a.model} &middot; {a.requestedBy} &middot; {a.requestedAt}</p>
                  </div>
                  <span className={statusBadge.className}>{statusBadge.label}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <p className="text-[10px] font-semibold text-thb-text-muted uppercase mb-0.5">Input</p>
                    <p className="text-xs text-thb-text-secondary">{a.input}</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <p className="text-[10px] font-semibold text-thb-text-muted uppercase mb-0.5">Output</p>
                    <p className="text-xs text-thb-text-secondary">{a.output}</p>
                  </div>
                </div>
                {a.status === 'pending' && isAdmin && (
                  <div className="flex items-center gap-2 pt-2 border-t border-thb-border">
                    <button onClick={() => handleApproval(a.id, 'approved')} className="px-4 py-1.5 bg-emerald-500 text-white text-xs font-medium rounded-lg hover:bg-emerald-600 transition-colors flex items-center gap-1"><FiCheck className="w-3.5 h-3.5" />Approve</button>
                    <button onClick={() => handleApproval(a.id, 'rejected')} className="px-4 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1"><FiX className="w-3.5 h-3.5" />Reject</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'audit' && (
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-thb-border bg-slate-50/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Timestamp</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Model</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Action</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Input</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Output</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Duration</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center"><FiClock className="w-10 h-10 text-thb-text-muted mx-auto mb-3" /><p className="text-thb-text-secondary font-medium">No audit logs found</p></td></tr>
                ) : (
                  filteredLogs.map(l => (
                    <tr key={l.id} className="border-b border-thb-border/50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-xs text-thb-text-secondary whitespace-nowrap">{l.timestamp}</td>
                      <td className="px-4 py-3 text-xs text-thb-text-primary font-medium">{l.user}</td>
                      <td className="px-4 py-3"><span className="thb-badge thb-badge-purple">{l.model}</span></td>
                      <td className="px-4 py-3 text-xs text-thb-text-secondary">{l.action}</td>
                      <td className="px-4 py-3 text-xs text-thb-text-secondary truncate max-w-[150px]">{l.input}</td>
                      <td className="px-4 py-3 text-xs text-thb-text-secondary truncate max-w-[150px]">{l.output}</td>
                      <td className="px-4 py-3 text-xs text-thb-text-secondary">{l.duration}s</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monitoring Tab */}
      {activeTab === 'monitoring' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="thb-card p-4">
              <p className="text-xs font-medium text-thb-text-secondary">Total API Calls</p>
              <p className="text-2xl font-bold text-thb-text-primary">{monitoring.apiCalls.toLocaleString()}</p>
              <p className="text-xs text-emerald-600 mt-1">+{monitoring.callsLastHour} last hour</p>
            </div>
            <div className="thb-card p-4">
              <p className="text-xs font-medium text-thb-text-secondary">Tokens Used</p>
              <p className="text-2xl font-bold text-thb-text-primary">{(monitoring.tokensUsed / 1000000).toFixed(1)}M</p>
              <p className="text-xs text-emerald-600 mt-1">+{(monitoring.tokensLastHour / 1000).toFixed(1)}K last hour</p>
            </div>
            <div className="thb-card p-4">
              <p className="text-xs font-medium text-thb-text-secondary">Avg Response Time</p>
              <p className="text-2xl font-bold text-thb-text-primary">{monitoring.avgResponseTime}s</p>
              <p className="text-xs text-emerald-600 mt-1">Within SLA</p>
            </div>
            <div className="thb-card p-4">
              <p className="text-xs font-medium text-thb-text-secondary">Error Rate</p>
              <p className={`text-2xl font-bold ${monitoring.errorRate > 5 ? 'text-red-600' : monitoring.errorRate > 2 ? 'text-amber-600' : 'text-emerald-600'}`}>{monitoring.errorRate}%</p>
              <p className="text-xs text-thb-text-muted mt-1">Threshold: 5%</p>
            </div>
            <div className="thb-card p-4">
              <p className="text-xs font-medium text-thb-text-secondary">Active Models</p>
              <p className="text-2xl font-bold text-thb-text-primary">{activeModels}</p>
              <p className="text-xs text-thb-text-muted mt-1">GPT-4, Claude, GPT-3.5</p>
            </div>
            <div className="thb-card p-4">
              <p className="text-xs font-medium text-thb-text-secondary">Uptime</p>
              <p className="text-2xl font-bold text-emerald-600">99.9%</p>
              <p className="text-xs text-thb-text-muted mt-1">Last 30 days</p>
            </div>
          </div>
          <div className="thb-card p-4">
            <p className="text-xs font-semibold text-thb-text-secondary mb-3">API Calls (Last 12 Hours)</p>
            <div className="flex items-end gap-1 h-32">
              {[42, 55, 38, 67, 82, 91, 78, 63, 45, 58, 72, 85].map((v, i) => (
                <div key={i} className="flex-1 bg-amber-200 hover:bg-amber-400 rounded-t transition-colors cursor-pointer" style={{ height: `${(v / 100) * 100}%` }} title={`${v} calls`} />
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-thb-text-muted mt-1">
              <span>12h ago</span><span>9h</span><span>6h</span><span>3h</span><span>Now</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
