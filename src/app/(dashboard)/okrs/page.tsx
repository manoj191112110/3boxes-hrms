'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  FiTarget, FiPlus, FiX, FiRefreshCw, FiChevronDown, FiChevronRight,
  FiBriefcase, FiGrid, FiUser, FiTrash2, FiEdit2, FiCheckCircle,
  FiAlertCircle, FiClock, FiTrendingUp,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import ModuleTips from '@/components/ModuleTips';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/* ── Types ── */
interface KeyResult {
  id: string;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string | null;
  status: string;
}

interface OKR {
  id: string;
  objective: string;
  ownerId: string | null;
  owner: { id: string; firstName: string; lastName: string; employeeId: string; avatar?: string | null } | null;
  companyId: string | null;
  company: { id: string; name: string; code: string | null } | null;
  projectId: string | null;
  project: { id: string; name: string; code: string | null } | null;
  category: string; // company, sub_company, project, individual
  parentOkrId: string | null;
  quarter: string;
  year: number;
  status: string; // draft, active, at_risk, completed, missed
  keyResults: KeyResult[];
  childOkrs?: OKR[];
}

interface Company { id: string; name: string; code: string | null }
interface Project { id: string; name: string; code: string | null; companyId: string }
interface Employee { id: string; firstName: string; lastName: string; employeeId: string; email: string }

/* ── Helpers ── */
function getStatusBadge(status: string) {
  const map: Record<string, { cls: string; icon: React.ReactNode }> = {
    draft:     { cls: 'bg-slate-100 text-slate-600',     icon: <FiClock className="w-3 h-3" /> },
    active:    { cls: 'bg-green-100 text-green-700',        icon: <FiTrendingUp className="w-3 h-3" /> },
    at_risk:   { cls: 'bg-amber-100 text-amber-700',      icon: <FiAlertCircle className="w-3 h-3" /> },
    completed: { cls: 'bg-emerald-100 text-emerald-700',  icon: <FiCheckCircle className="w-3 h-3" /> },
    missed:    { cls: 'bg-red-100 text-red-700',          icon: <FiAlertCircle className="w-3 h-3" /> },
  };
  const m = map[status] || map.draft;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${m.cls}`}>
      {m.icon} {status.replace('_', ' ')}
    </span>
  );
}

function getCategoryBadge(category: string) {
  const map: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
    company:     { cls: 'bg-teal-100 text-teal-700 border-teal-200',   label: 'Company',     icon: <FiBriefcase className="w-3 h-3" /> },
    sub_company: { cls: 'bg-emerald-100 text-emerald-700 border-emerald-200',   label: 'Sub-Company', icon: <FiBriefcase className="w-3 h-3" /> },
    project:     { cls: 'bg-cyan-100 text-cyan-700 border-cyan-200',         label: 'Project',     icon: <FiGrid className="w-3 h-3" /> },
    individual:  { cls: 'bg-pink-100 text-pink-700 border-pink-200',         label: 'Individual',  icon: <FiUser className="w-3 h-3" /> },
  };
  const m = map[category] || map.individual;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${m.cls}`}>
      {m.icon} {m.label}
    </span>
  );
}

function getProgress(krs: KeyResult[] | undefined | null): number {
  // Defensive: API may occasionally return OKRs without keyResults populated
  // (e.g. during schema drift or partial Prisma includes on deeply nested
  // child OKRs). Treat undefined/null as an empty array.
  if (!krs || !Array.isArray(krs) || krs.length === 0) return 0;
  const total = krs.reduce((s, kr) => {
    const pct = kr.targetValue > 0 ? (kr.currentValue / kr.targetValue) * 100 : 0;
    return s + Math.min(100, pct);
  }, 0);
  return Math.round(total / krs.length);
}

function getProgressColor(pct: number): string {
  if (pct >= 80) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-green-500';
  if (pct >= 25) return 'bg-amber-500';
  return 'bg-slate-400';
}

/* ── OKR Node (recursive) ── */
function OKRNode({
  okr,
  depth,
  onAddChild,
  onEdit,
  onDelete,
  onUpdateKR,
}: {
  okr: OKR;
  depth: number;
  onAddChild: (parent: OKR) => void;
  onEdit: (okr: OKR) => void;
  onDelete: (okr: OKR) => void;
  onUpdateKR: (kr: KeyResult, newCurrent: number) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 3);
  const hasChildren = !!(okr.childOkrs && okr.childOkrs.length > 0);
  // Defensive: childOkrs/keyResults may be missing on deeply nested children
  // (Prisma includes only go 4 levels deep in /api/okrs). Fall back to [].
  const keyResults = Array.isArray(okr.keyResults) ? okr.keyResults : [];
  const progress = getProgress(keyResults);

  const ownerLabel = okr.category === 'individual'
    ? okr.owner ? `${okr.owner.firstName} ${okr.owner.lastName}` : '—'
    : okr.category === 'project'
    ? okr.project?.name || '—'
    : okr.company?.name || '—';

  return (
    <div className="relative" style={{ marginLeft: depth > 0 ? 28 : 0 }}>
      {depth > 0 && (
        <div className="absolute -left-4 top-0 bottom-0 w-px bg-slate-200" />
      )}
      <div className="bg-white rounded-lg border border-slate-200 p-4 mb-3 hover:shadow-sm transition-shadow">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {hasChildren ? (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="p-0.5 text-slate-400 hover:text-slate-700"
                >
                  {expanded ? <FiChevronDown className="w-4 h-4" /> : <FiChevronRight className="w-4 h-4" />}
                </button>
              ) : (
                <span className="w-5" />
              )}
              {getCategoryBadge(okr.category)}
              {getStatusBadge(okr.status)}
              <span className="text-xs text-slate-500">{okr.quarter} {okr.year}</span>
            </div>
            <h4 className="text-sm font-semibold text-slate-800 mb-1">{okr.objective}</h4>
            <p className="text-xs text-slate-500">
              Owner: <span className="font-medium text-slate-700">{ownerLabel}</span>
            </p>
          </div>
          <div className="flex items-center gap-1">
            <div className="text-right mr-2">
              <p className="text-xs text-slate-500">Progress</p>
              <p className="text-lg font-bold text-slate-800">{progress}%</p>
            </div>
            <button
              onClick={() => onAddChild(okr)}
              className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded"
              title="Add child OKR"
            >
              <FiPlus className="w-4 h-4" />
            </button>
            <button
              onClick={() => onEdit(okr)}
              className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded"
              title="Edit"
            >
              <FiEdit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(okr)}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
              title="Delete"
            >
              <FiTrash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${getProgressColor(progress)}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Key Results */}
        {keyResults.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">Key Results</p>
            {keyResults.map(kr => {
              const krPct = kr.targetValue > 0 ? Math.min(100, (kr.currentValue / kr.targetValue) * 100) : 0;
              return (
                <div key={kr.id} className="bg-slate-50 rounded p-2">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs text-slate-700">{kr.title}</p>
                    <span className="text-xs font-mono text-slate-600">
                      {kr.currentValue}/{kr.targetValue}{kr.unit ? ` ${kr.unit}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getProgressColor(krPct)}`}
                        style={{ width: `${krPct}%` }}
                      />
                    </div>
                    <input
                      type="number"
                      value={kr.currentValue}
                      onChange={e => onUpdateKR(kr, Number(e.target.value))}
                      className="w-16 px-1.5 py-0.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-teal-400"
                      title="Update current value"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div className="mt-1">
          {okr.childOkrs!.map(child => (
            <OKRNode
              key={child.id}
              okr={child}
              depth={depth + 1}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
              onUpdateKR={onUpdateKR}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main page ── */
export default function OKRCascadePage() {
  const { user } = useAuthStore();
  const [okrs, setOkrs] = useState<OKR[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterQuarter, setFilterQuarter] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingOkr, setEditingOkr] = useState<OKR | null>(null);
  const [parentOkr, setParentOkr] = useState<OKR | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState({
    objective: '',
    category: 'company',
    companyId: '',
    projectId: '',
    ownerId: '',
    parentOkrId: '',
    quarter: currentQuarter(),
    year: new Date().getFullYear(),
    status: 'draft',
    keyResults: [] as { title: string; targetValue: number; unit: string }[],
  });
  const [saving, setSaving] = useState(false);

  const fetchOkrs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ cascade: 'true' });
      if (filterCategory) params.set('category', filterCategory);
      if (filterQuarter) params.set('quarter', filterQuarter);
      const r = await fetch(`/api/okrs?${params.toString()}`, { headers: getAuthHeaders() });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed to load OKRs');
      setOkrs(data.okrs || []);
    } catch (e: unknown) {
      console.error('fetchOkrs', e);
      toast.error(e instanceof Error ? e.message : 'Failed to load OKRs');
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterQuarter]);

  const fetchMeta = useCallback(async () => {
    try {
      const [cos, prs, emps] = await Promise.all([
        fetch('/api/companies?limit=100', { headers: getAuthHeaders() }).then(r => r.json()),
        fetch('/api/projects?limit=100', { headers: getAuthHeaders() }).then(r => r.json()),
        fetch('/api/employees?limit=500', { headers: getAuthHeaders() }).then(r => r.json()),
      ]);
      setCompanies(cos.companies || []);
      setProjects(prs.projects || []);
      setEmployees(emps.employees || []);
    } catch (e) {
      console.warn('fetchMeta failed (non-fatal):', e);
    }
  }, []);

  useEffect(() => { fetchOkrs(); }, [fetchOkrs]);
  useEffect(() => { if (showModal) fetchMeta(); }, [showModal, fetchMeta]);

  const handleAddChild = (parent: OKR) => {
    setParentOkr(parent);
    setEditingOkr(null);
    // Infer child category from parent
    const childCategory =
      parent.category === 'company' ? 'sub_company' :
      parent.category === 'sub_company' ? 'project' :
      parent.category === 'project' ? 'individual' :
      'individual';
    setForm({
      objective: '',
      category: childCategory,
      companyId: parent.companyId || '',
      projectId: parent.projectId || '',
      ownerId: '',
      parentOkrId: parent.id,
      quarter: parent.quarter,
      year: parent.year,
      status: 'draft',
      keyResults: [],
    });
    setShowModal(true);
  };

  const handleCreateTopLevel = () => {
    setParentOkr(null);
    setEditingOkr(null);
    setForm({
      objective: '',
      category: 'company',
      companyId: '',
      projectId: '',
      ownerId: '',
      parentOkrId: '',
      quarter: currentQuarter(),
      year: new Date().getFullYear(),
      status: 'draft',
      keyResults: [],
    });
    setShowModal(true);
  };

  const handleEdit = (okr: OKR) => {
    setEditingOkr(okr);
    setParentOkr(null);
    setForm({
      objective: okr.objective,
      category: okr.category,
      companyId: okr.companyId || '',
      projectId: okr.projectId || '',
      ownerId: okr.ownerId || '',
      parentOkrId: okr.parentOkrId || '',
      quarter: okr.quarter,
      year: okr.year,
      status: okr.status,
      keyResults: (Array.isArray(okr.keyResults) ? okr.keyResults : []).map(kr => ({ title: kr.title, targetValue: kr.targetValue, unit: kr.unit || '' })),
    });
    setShowModal(true);
  };

  const handleDelete = async (okr: OKR) => {
    if (!confirm(`Delete OKR "${okr.objective.substring(0, 60)}"? This will also delete all child OKRs and key results.`)) return;
    try {
      const r = await fetch(`/api/okrs/${okr.id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || 'Failed');
      }
      toast.success('OKR deleted');
      fetchOkrs();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  const handleSave = async () => {
    if (!form.objective) {
      toast.error('Objective is required');
      return;
    }
    if (form.category === 'individual' && !form.ownerId) {
      toast.error('Individual OKRs require an owner');
      return;
    }
    if ((form.category === 'company' || form.category === 'sub_company') && !form.companyId) {
      toast.error('Company OKRs require a company');
      return;
    }
    if (form.category === 'project' && !form.projectId) {
      toast.error('Project OKRs require a project');
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        objective: form.objective,
        category: form.category,
        quarter: form.quarter,
        year: Number(form.year),
        status: form.status,
        keyResults: form.keyResults.filter(kr => kr.title),
      };
      if (form.companyId) body.companyId = form.companyId;
      if (form.projectId) body.projectId = form.projectId;
      if (form.ownerId) body.ownerId = form.ownerId;
      if (form.parentOkrId) body.parentOkrId = form.parentOkrId;

      let r;
      if (editingOkr) {
        r = await fetch(`/api/okrs/${editingOkr.id}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(body),
        });
      } else {
        r = await fetch('/api/okrs', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(body),
        });
      }
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed to save');
      toast.success(editingOkr ? 'OKR updated' : 'OKR created');
      setShowModal(false);
      fetchOkrs();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateKR = async (kr: KeyResult, newCurrent: number) => {
    try {
      const r = await fetch(`/api/okrs/key-results/${kr.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ currentValue: newCurrent }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || 'Failed');
      }
      // Update local state without refetching everything
      setOkrs(prev => updateKRInTree(prev, kr.id, newCurrent));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update KR');
    }
  };

  // Summary stats
  const stats = useMemo(() => {
    const all = flatten(okrs);
    return {
      total: all.length,
      company: all.filter(o => o.category === 'company').length,
      subCompany: all.filter(o => o.category === 'sub_company').length,
      project: all.filter(o => o.category === 'project').length,
      individual: all.filter(o => o.category === 'individual').length,
      active: all.filter(o => o.status === 'active').length,
      atRisk: all.filter(o => o.status === 'at_risk').length,
      completed: all.filter(o => o.status === 'completed').length,
      avgProgress: all.length > 0 ? Math.round(all.reduce((s, o) => s + getProgress(o.keyResults), 0) / all.length) : 0,
    };
  }, [okrs]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FiTarget className="w-7 h-7 text-teal-600" />
            OKR Cascade
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Cascade objectives from Company → Sub-Company → Project → Individual. Track key results with live progress bars.
          </p>
        </div>
        <button onClick={handleCreateTopLevel} className="3boxes-btn-primary flex items-center gap-2">
          <FiPlus className="w-4 h-4" /> New Top-Level OKR
        </button>
      </div>

      <ModuleTips moduleKey="okrs">
        <p><strong>REQ-PER-01 OKR Cascade:</strong> Set objectives at the company level, cascade them down to sub-companies, projects, and individuals. Each OKR has key results (KRs) with target/current values; progress is computed automatically and rolls up to parent OKRs.</p>
      </ModuleTips>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-xs uppercase tracking-wider text-slate-500">Total OKRs</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-xs uppercase tracking-wider text-teal-600">Company</p>
          <p className="text-2xl font-bold text-teal-700 mt-1">{stats.company}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-xs uppercase tracking-wider text-cyan-600">Project</p>
          <p className="text-2xl font-bold text-cyan-700 mt-1">{stats.project}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-xs uppercase tracking-wider text-pink-600">Individual</p>
          <p className="text-2xl font-bold text-pink-700 mt-1">{stats.individual}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-xs uppercase tracking-wider text-slate-500">Avg Progress</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{stats.avgProgress}%</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 border border-slate-200">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="3boxes-input min-w-[160px]"
          >
            <option value="">All Categories</option>
            <option value="company">Company</option>
            <option value="sub_company">Sub-Company</option>
            <option value="project">Project</option>
            <option value="individual">Individual</option>
          </select>
          <input
            type="text"
            placeholder="Quarter (e.g. Q1 2026)"
            value={filterQuarter}
            onChange={e => setFilterQuarter(e.target.value)}
            className="3boxes-input min-w-[160px]"
          />
          <button onClick={fetchOkrs} className="3boxes-btn-secondary flex items-center gap-2">
            <FiRefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Cascade tree */}
      <div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <FiRefreshCw className="w-6 h-6 animate-spin text-teal-600" />
          </div>
        ) : okrs.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <FiTarget className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 mb-2">No OKRs found</p>
            <p className="text-sm text-slate-400 mb-4">Start by creating a company-level OKR — it will cascade down to sub-companies, projects, and individuals.</p>
            <button onClick={handleCreateTopLevel} className="3boxes-btn-primary inline-flex items-center gap-2">
              <FiPlus className="w-4 h-4" /> Create First OKR
            </button>
          </div>
        ) : (
          okrs.map(okr => (
            <OKRNode
              key={okr.id}
              okr={okr}
              depth={0}
              onAddChild={handleAddChild}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onUpdateKR={handleUpdateKR}
            />
          ))
        )}
      </div>

      {/* Create/Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 sticky top-0 bg-white">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  {editingOkr ? 'Edit OKR' : parentOkr ? `Add Child OKR (under ${parentOkr.objective.substring(0, 40)}...)` : 'Create Top-Level OKR'}
                </h2>
                {parentOkr && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Parent: {parentOkr.category.replace('_', ' ')} level → Child: {form.category.replace('_', ' ')} level
                  </p>
                )}
              </div>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Objective *</label>
                <textarea
                  value={form.objective}
                  onChange={e => setForm({ ...form, objective: e.target.value })}
                  rows={2}
                  className="3boxes-input w-full"
                  placeholder="e.g. Achieve $5M revenue in FY 2026"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Category *</label>
                  <select
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value, companyId: '', projectId: '', ownerId: '' })}
                    className="3boxes-input w-full"
                    disabled={!!parentOkr}
                  >
                    <option value="company">Company</option>
                    <option value="sub_company">Sub-Company</option>
                    <option value="project">Project</option>
                    <option value="individual">Individual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                    className="3boxes-input w-full"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="at_risk">At Risk</option>
                    <option value="completed">Completed</option>
                    <option value="missed">Missed</option>
                  </select>
                </div>
              </div>

              {/* Conditional owner field based on category */}
              {(form.category === 'company' || form.category === 'sub_company') && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Company *</label>
                  <select
                    value={form.companyId}
                    onChange={e => setForm({ ...form, companyId: e.target.value })}
                    className="3boxes-input w-full"
                  >
                    <option value="">Select company...</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>
                    ))}
                  </select>
                </div>
              )}
              {form.category === 'project' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Project *</label>
                  <select
                    value={form.projectId}
                    onChange={e => setForm({ ...form, projectId: e.target.value })}
                    className="3boxes-input w-full"
                  >
                    <option value="">Select project...</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ''}</option>
                    ))}
                  </select>
                </div>
              )}
              {form.category === 'individual' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Owner (Employee) *</label>
                  <select
                    value={form.ownerId}
                    onChange={e => setForm({ ...form, ownerId: e.target.value })}
                    className="3boxes-input w-full"
                  >
                    <option value="">Select employee...</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeId})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Quarter</label>
                  <input
                    type="text"
                    value={form.quarter}
                    onChange={e => setForm({ ...form, quarter: e.target.value })}
                    className="3boxes-input w-full"
                    placeholder="Q1 2026"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Year</label>
                  <input
                    type="number"
                    value={form.year}
                    onChange={e => setForm({ ...form, year: Number(e.target.value) })}
                    className="3boxes-input w-full"
                  />
                </div>
              </div>

              {/* Key results editor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-slate-600">Key Results</label>
                  <button
                    type="button"
                    onClick={() => setForm({
                      ...form,
                      keyResults: [...form.keyResults, { title: '', targetValue: 100, unit: '' }],
                    })}
                    className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1"
                  >
                    <FiPlus className="w-3 h-3" /> Add KR
                  </button>
                </div>
                {form.keyResults.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No key results yet. Add at least one to track progress.</p>
                ) : (
                  <div className="space-y-2">
                    {/* Column headers — only on sm+ screens */}
                    <div className="hidden sm:grid grid-cols-12 gap-2 px-1 pb-1">
                      <p className="col-span-6 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Title</p>
                      <p className="col-span-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Target</p>
                      <p className="col-span-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Unit</p>
                      <p className="col-span-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-center">—</p>
                    </div>
                    {form.keyResults.map((kr, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <input
                          type="text"
                          value={kr.title}
                          onChange={e => {
                            const krs = [...form.keyResults];
                            krs[idx] = { ...kr, title: e.target.value };
                            setForm({ ...form, keyResults: krs });
                          }}
                          className="3boxes-input col-span-12 sm:col-span-6"
                          placeholder="e.g. Increase revenue by 20%"
                        />
                        <input
                          type="number"
                          value={kr.targetValue}
                          onChange={e => {
                            const krs = [...form.keyResults];
                            krs[idx] = { ...kr, targetValue: Number(e.target.value) };
                            setForm({ ...form, keyResults: krs });
                          }}
                          className="3boxes-input col-span-6 sm:col-span-2"
                          placeholder="100"
                        />
                        <input
                          type="text"
                          value={kr.unit}
                          onChange={e => {
                            const krs = [...form.keyResults];
                            krs[idx] = { ...kr, unit: e.target.value };
                            setForm({ ...form, keyResults: krs });
                          }}
                          className="3boxes-input col-span-5 sm:col-span-3"
                          placeholder="%, INR, hrs..."
                        />
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, keyResults: form.keyResults.filter((_, i) => i !== idx) })}
                          className="col-span-1 p-1.5 text-slate-400 hover:text-red-600 rounded flex items-center justify-center"
                          title="Remove this key result"
                        >
                          <FiX className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <p className="text-[10px] text-slate-400 pt-1">
                      Tip: Use <code className="px-1 py-0.5 bg-slate-100 rounded">%</code> for percentage KRs, or a currency/unit like <code className="px-1 py-0.5 bg-slate-100 rounded">INR</code> for absolute targets.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-5 border-t border-slate-200 bg-slate-50 sticky bottom-0">
              <button onClick={() => setShowModal(false)} className="3boxes-btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="3boxes-btn-primary flex items-center gap-2">
                {saving ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiPlus className="w-4 h-4" />}
                {editingOkr ? 'Update OKR' : 'Create OKR'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Utility: flatten tree to a list ── */
function flatten(okrs: OKR[]): OKR[] {
  const out: OKR[] = [];
  const walk = (list: OKR[] | undefined | null) => {
    if (!Array.isArray(list)) return;
    for (const o of list) {
      out.push(o);
      if (o.childOkrs) walk(o.childOkrs);
    }
  };
  walk(okrs);
  return out;
}

function updateKRInTree(okrs: OKR[], krId: string, newCurrent: number): OKR[] {
  return okrs.map(o => {
    const krs = Array.isArray(o.keyResults) ? o.keyResults : [];
    const keyResults = krs.map(kr =>
      kr.id === krId ? { ...kr, currentValue: newCurrent } : kr
    );
    const childOkrs = o.childOkrs ? updateKRInTree(o.childOkrs, krId, newCurrent) : undefined;
    return { ...o, keyResults, childOkrs };
  });
}

function currentQuarter(): string {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  return `Q${q} ${now.getFullYear()}`;
}
