'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  FiTarget, FiPlus, FiX, FiEdit2, FiTrash2, FiUsers,
  FiAlertTriangle, FiCheck, FiChevronDown, FiChevronUp,
  FiZap, FiTrendingUp, FiShield, FiArrowRight, FiStar,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store/app-store';

/* ── Types ── */
interface Candidate {
  id: string;
  successionPlanId: string;
  employeeId: string;
  readinessLevel: string;
  aiReadinessScore?: number | null;
  developmentNeeds?: string | null;
  notes?: string | null;
  employee?: {
    id: string; firstName: string; lastName: string; email: string;
    avatar?: string | null;
    department?: { name: string } | null; designation?: { title: string } | null;
  } | null;
}

interface PlanItem {
  id: string;
  positionTitle: string;
  departmentId?: string | null;
  currentHolderId?: string | null;
  riskLevel: string;
  readinessStatus: string;
  notes?: string | null;
  targetDate?: string | null;
  createdAt: string;
  candidates: Candidate[];
  department?: { id: string; name: string } | null;
  currentHolder?: { id: string; firstName: string; lastName: string; email: string; department?: { name: string } | null; designation?: { title: string } | null } | null;
}

interface EmployeeOption {
  id: string; firstName: string; lastName: string; email: string;
  department?: { name: string } | null; designation?: { title: string } | null;
}

interface SuccessionStats {
  criticalRoles: number; successorsIdentified: number; readyNow: number; developmentNeeded: number;
}

/* ── Helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('3boxes_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getRiskBadge(risk: string) {
  const map: Record<string, { className: string; label: string }> = {
    critical: { className: 'bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded-full', label: 'Critical' },
    high: { className: 'bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5 rounded-full', label: 'High' },
    medium: { className: 'bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full', label: 'Medium' },
    low: { className: 'bg-emerald-100 text-emerald-800 text-xs font-medium px-2 py-0.5 rounded-full', label: 'Low' },
  };
  return map[risk] || { className: 'bg-slate-100 text-slate-800 text-xs font-medium px-2 py-0.5 rounded-full', label: risk };
}

function getReadinessBadge(readiness: string) {
  const map: Record<string, { className: string; label: string }> = {
    ready_now: { className: 'bg-emerald-100 text-emerald-800 text-xs font-medium px-2 py-0.5 rounded-full', label: 'Ready Now' },
    ready_1_2_years: { className: 'bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full', label: '1-2 Years' },
    ready_3_5_years: { className: 'bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5 rounded-full', label: '3-5 Years' },
    development_needed: { className: 'bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded-full', label: 'Dev Needed' },
    developing: { className: 'bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5 rounded-full', label: 'Developing' },
    identified: { className: 'bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full', label: 'Identified' },
  };
  return map[readiness] || { className: 'bg-slate-100 text-slate-800 text-xs font-medium px-2 py-0.5 rounded-full', label: readiness };
}

function getReadinessDotColor(readiness: string) {
  switch (readiness) {
    case 'ready_now': return 'bg-emerald-500';
    case 'ready_1_2_years': return 'bg-green-500';
    case 'ready_3_5_years': case 'developing': return 'bg-amber-500';
    case 'development_needed': return 'bg-red-500';
    default: return 'bg-slate-400';
  }
}

export function Succession() {
  const { user } = useAppStore();
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');

  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [stats, setStats] = useState<SuccessionStats>({ criticalRoles: 0, successorsIdentified: 0, readyNow: 0, developmentNeeded: 0 });
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState({ positionTitle: '', departmentId: '', currentHolderId: '', riskLevel: 'medium', readinessStatus: 'identified', notes: '', targetDate: '' });
  const [submittingPlan, setSubmittingPlan] = useState(false);

  const [showCandidateForm, setShowCandidateForm] = useState(false);
  const [candidateForm, setCandidateForm] = useState({ successionPlanId: '', employeeId: '', readinessLevel: 'developing', developmentNeeds: '', notes: '' });
  const [submittingCandidate, setSubmittingCandidate] = useState(false);

  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();
      const [successionRes, empRes] = await Promise.allSettled([
        fetch('/api/succession', { headers }),
        fetch('/api/employees?limit=500', { headers }),
      ]);
      if (successionRes.status === 'fulfilled' && successionRes.value.ok) {
        const data = await successionRes.value.json();
        setPlans(data.plans || []);
        setStats(data.stats || { criticalRoles: 0, successorsIdentified: 0, readyNow: 0, developmentNeeded: 0 });
      }
      if (empRes.status === 'fulfilled' && empRes.value.ok) {
        const data = await empRes.value.json();
        setEmployees((data.employees || []).map((e: EmployeeOption) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName, email: e.email, department: e.department, designation: e.designation })));
      }
    } catch (err) { console.error(err); toast.error('Failed to load succession data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { queueMicrotask(async () => {
    fetchData();
    try {
      const res = await fetch('/api/departments?limit=100', { headers: getAuthHeaders() });
      if (res.ok) { const data = await res.json(); setDepartments(data.departments || []); }
    } catch { /* ignore */ }
  }); }, [fetchData]);

  const handleOpenPlanForm = (plan?: PlanItem) => {
    if (plan) {
      setEditingPlanId(plan.id);
      setPlanForm({ positionTitle: plan.positionTitle, departmentId: plan.departmentId || '', currentHolderId: plan.currentHolderId || '', riskLevel: plan.riskLevel, readinessStatus: plan.readinessStatus, notes: plan.notes || '', targetDate: plan.targetDate ? new Date(plan.targetDate).toISOString().split('T')[0] : '' });
    } else { setEditingPlanId(null); setPlanForm({ positionTitle: '', departmentId: '', currentHolderId: '', riskLevel: 'medium', readinessStatus: 'identified', notes: '', targetDate: '' }); }
    setShowPlanForm(true); setShowCandidateForm(false); setDeleteConfirmId(null);
    setTimeout(() => document.getElementById('succession-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };
  const handleCancelPlanForm = () => { setShowPlanForm(false); setEditingPlanId(null); };

  const handleSavePlan = async () => {
    if (!planForm.positionTitle) { toast.error('Please enter a position title'); return; }
    try {
      setSubmittingPlan(true);
      const payload = { positionTitle: planForm.positionTitle, departmentId: planForm.departmentId || null, currentHolderId: planForm.currentHolderId || null, riskLevel: planForm.riskLevel, readinessStatus: planForm.readinessStatus, notes: planForm.notes || null, targetDate: planForm.targetDate || null };
      if (editingPlanId) {
        const res = await fetch(`/api/succession/${editingPlanId}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(payload) });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
        toast.success('Plan updated');
      } else {
        const res = await fetch('/api/succession', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
        toast.success('Plan created');
      }
      handleCancelPlanForm(); fetchData();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); }
    finally { setSubmittingPlan(false); }
  };

  const handleDeletePlan = async (id: string) => {
    try { setDeleting(true); const res = await fetch(`/api/succession/${id}`, { method: 'DELETE', headers: getAuthHeaders() }); if (!res.ok) throw new Error('Failed'); toast.success('Plan deleted'); setDeleteConfirmId(null); fetchData(); }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); } finally { setDeleting(false); }
  };

  const handleOpenCandidateForm = (planId: string) => {
    setCandidateForm({ successionPlanId: planId, employeeId: '', readinessLevel: 'developing', developmentNeeds: '', notes: '' });
    setShowCandidateForm(true); setShowPlanForm(false); setDeleteConfirmId(null);
    setTimeout(() => document.getElementById('succession-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };
  const handleCancelCandidateForm = () => { setShowCandidateForm(false); };

  const handleSaveCandidate = async () => {
    if (!candidateForm.successionPlanId || !candidateForm.employeeId) { toast.error('Please select an employee'); return; }
    try { setSubmittingCandidate(true); const res = await fetch('/api/succession', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ action: 'add_candidate', ...candidateForm }) }); if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); } toast.success('Candidate added'); handleCancelCandidateForm(); fetchData(); }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); } finally { setSubmittingCandidate(false); }
  };

  const handleRemoveCandidate = async (planId: string, candidateId: string) => {
    try { const res = await fetch(`/api/succession/${planId}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ action: 'remove_candidate', candidateId }) }); if (!res.ok) throw new Error('Failed'); toast.success('Candidate removed'); fetchData(); }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); }
  };

  // 9-Box Grid
  const nineBoxData = (() => {
    const grid: Record<string, Candidate[]> = { 'high-high': [], 'high-medium': [], 'high-low': [], 'medium-high': [], 'medium-medium': [], 'medium-low': [], 'low-high': [], 'low-medium': [], 'low-low': [] };
    plans.forEach(p => p.candidates.forEach(c => {
      const perf = c.aiReadinessScore ? (c.aiReadinessScore >= 70 ? 'high' : c.aiReadinessScore >= 40 ? 'medium' : 'low') : 'medium';
      const pot = c.readinessLevel === 'ready_now' ? 'high' : c.readinessLevel === 'developing' ? 'medium' : 'low';
      const key = `${perf}-${pot}`; if (grid[key]) grid[key].push(c);
    }));
    return grid;
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><FiTarget className="w-6 h-6 text-emerald-500" /> Succession Planning</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage succession plans and talent pipelines</p>
        </div>
        {isAdmin && <button onClick={() => handleOpenPlanForm()} className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium text-sm shadow-sm transition-colors"><FiPlus className="w-4 h-4" /> Create Plan</button>}
      </div>

      {/* Plan/Candidate Form */}
      {(showPlanForm || showCandidateForm) && (
        <div id="succession-form" className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">{showPlanForm ? (editingPlanId ? 'Edit Plan' : 'Create Succession Plan') : 'Add Candidate'}</h2>
            <button onClick={showPlanForm ? handleCancelPlanForm : handleCancelCandidateForm} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><FiX className="w-5 h-5" /></button>
          </div>
          {showPlanForm ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium text-muted-foreground mb-1">Position Title *</label><input type="text" value={planForm.positionTitle} onChange={e => setPlanForm(p => ({ ...p, positionTitle: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400" placeholder="VP of Engineering" /></div>
                <div><label className="block text-xs font-medium text-muted-foreground mb-1">Department</label><select value={planForm.departmentId} onChange={e => setPlanForm(p => ({ ...p, departmentId: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"><option value="">Select</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-muted-foreground mb-1">Current Holder</label><select value={planForm.currentHolderId} onChange={e => setPlanForm(p => ({ ...p, currentHolderId: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"><option value="">Select</option>{employees.map(emp => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-muted-foreground mb-1">Criticality</label><select value={planForm.riskLevel} onChange={e => setPlanForm(p => ({ ...p, riskLevel: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
                <div><label className="block text-xs font-medium text-muted-foreground mb-1">Readiness</label><select value={planForm.readinessStatus} onChange={e => setPlanForm(p => ({ ...p, readinessStatus: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"><option value="identified">Identified</option><option value="developing">Developing</option><option value="ready_now">Ready Now</option></select></div>
                <div><label className="block text-xs font-medium text-muted-foreground mb-1">Target Date</label><input type="date" value={planForm.targetDate} onChange={e => setPlanForm(p => ({ ...p, targetDate: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400" /></div>
              </div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label><textarea rows={2} value={planForm.notes} onChange={e => setPlanForm(p => ({ ...p, notes: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 resize-none" /></div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border"><button onClick={handleCancelPlanForm} className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancel</button><button onClick={handleSavePlan} disabled={submittingPlan} className="px-6 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 shadow-sm transition-colors">{submittingPlan ? 'Saving...' : editingPlanId ? 'Update' : 'Create'}</button></div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium text-muted-foreground mb-1">Employee *</label><select value={candidateForm.employeeId} onChange={e => setCandidateForm(p => ({ ...p, employeeId: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"><option value="">Select</option>{employees.map(emp => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-muted-foreground mb-1">Readiness</label><select value={candidateForm.readinessLevel} onChange={e => setCandidateForm(p => ({ ...p, readinessLevel: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"><option value="ready_now">Ready Now</option><option value="ready_1_2_years">1-2 Years</option><option value="ready_3_5_years">3-5 Years</option><option value="development_needed">Development Needed</option><option value="developing">Developing</option></select></div>
              </div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Development Needs</label><textarea rows={2} value={candidateForm.developmentNeeds} onChange={e => setCandidateForm(p => ({ ...p, developmentNeeds: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-background resize-none" /></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label><textarea rows={2} value={candidateForm.notes} onChange={e => setCandidateForm(p => ({ ...p, notes: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-background resize-none" /></div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border"><button onClick={handleCancelCandidateForm} className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancel</button><button onClick={handleSaveCandidate} disabled={submittingCandidate} className="px-6 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 shadow-sm transition-colors">{submittingCandidate ? 'Adding...' : 'Add Candidate'}</button></div>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Critical Roles', value: stats.criticalRoles, icon: <FiAlertTriangle className="w-5 h-5" />, color: 'text-red-500 bg-red-50' },
          { label: 'Successors', value: stats.successorsIdentified, icon: <FiUsers className="w-5 h-5" />, color: 'text-green-500 bg-green-50' },
          { label: 'Ready Now', value: stats.readyNow, icon: <FiCheck className="w-5 h-5" />, color: 'text-emerald-500 bg-emerald-50' },
          { label: 'Dev Needed', value: stats.developmentNeeded, icon: <FiTrendingUp className="w-5 h-5" />, color: 'text-amber-500 bg-amber-50' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color}`}>{s.icon}</div><div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.value}</p></div></div>
          </div>
        ))}
      </div>

      {/* Pipeline */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2"><FiArrowRight className="w-4 h-4" /> Talent Pipeline</h3>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {[
            { label: 'Talent Pool', count: plans.reduce((s, p) => s + p.candidates.filter(c => c.readinessLevel === 'identified').length, 0), color: 'bg-slate-500' },
            { label: 'Development', count: plans.reduce((s, p) => s + p.candidates.filter(c => c.readinessLevel === 'developing' || c.readinessLevel === 'development_needed' || c.readinessLevel === 'ready_3_5_years').length, 0), color: 'bg-amber-500' },
            { label: 'Ready Now', count: plans.reduce((s, p) => s + p.candidates.filter(c => c.readinessLevel === 'ready_now' || c.readinessLevel === 'ready_1_2_years').length, 0), color: 'bg-emerald-500' },
            { label: 'Promoted', count: 0, color: 'bg-teal-500' },
          ].map((stage, idx) => (
            <div key={stage.label} className="flex items-center gap-2 flex-1 min-w-0">
              <div className={`flex-1 p-4 rounded-lg border border-border text-center ${idx === 1 ? 'bg-amber-50/50' : idx === 2 ? 'bg-emerald-50/50' : idx === 3 ? 'bg-teal-50/50' : ''}`}>
                <div className={`w-8 h-8 rounded-full ${stage.color} flex items-center justify-center mx-auto mb-2`}><span className="text-white text-xs font-bold">{stage.count}</span></div>
                <p className="text-xs font-medium">{stage.label}</p>
              </div>
              {idx < 3 && <FiArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {/* 9-Box Grid */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2"><FiZap className="w-4 h-4 text-teal-500" /> 9-Box Grid</h3>
        <div className="overflow-x-auto"><div className="min-w-[400px]">
          {[['high', 'High Potential'], ['medium', 'Medium'], ['low', 'Low Potential']].map(([pot, potLabel]) => (
            <div key={pot} className="flex items-stretch mb-1">
              <div className="w-20 flex items-center pr-2 justify-end"><span className="text-xs text-muted-foreground">{potLabel}</span></div>
              <div className="flex-1 grid grid-cols-3 gap-1">
                {[['low', 'Low'], ['medium', 'Med'], ['high', 'High']].map(([perf, perfLabel]) => {
                  const key = `${perf}-${pot}`;
                  const items = nineBoxData[key] || [];
                  const bgColors: Record<string, string> = { 'high-high': 'bg-emerald-100 border-emerald-300', 'high-medium': 'bg-green-100 border-green-300', 'high-low': 'bg-amber-100 border-amber-300', 'medium-high': 'bg-green-100 border-green-300', 'medium-medium': 'bg-slate-100 border-slate-300', 'medium-low': 'bg-orange-100 border-orange-300', 'low-high': 'bg-amber-100 border-amber-300', 'low-medium': 'bg-orange-100 border-orange-300', 'low-low': 'bg-red-100 border-red-300' };
                  return (
                    <div key={key} className={`p-2 rounded-lg border ${bgColors[key] || 'bg-slate-50 border-slate-200'} min-h-[50px]`}>
                      <p className="text-[10px] text-muted-foreground mb-0.5">{perfLabel}</p>
                      {items.slice(0, 2).map(c => <div key={c.id} className="flex items-center gap-1"><div className={`w-1.5 h-1.5 rounded-full ${getReadinessDotColor(c.readinessLevel)}`} /><span className="text-[10px] truncate">{c.employee ? `${c.employee.firstName} ${c.employee.lastName}` : '?'}</span></div>)}
                      {items.length > 2 && <span className="text-[10px] text-muted-foreground">+{items.length - 2}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="flex items-center ml-20 mt-1">{['Low Perf', 'Med Perf', 'High Perf'].map(l => <div key={l} className="flex-1 text-center"><span className="text-[10px] text-muted-foreground">{l}</span></div>)}</div>
        </div></div>
      </div>

      {/* Plans List */}
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><FiTarget className="w-4 h-4" /> Plans</h3>
      <div className="space-y-4">
        {loading ? Array.from({ length: 2 }).map((_, i) => <div key={i} className="bg-card border border-border rounded-lg p-6 animate-pulse shadow-sm"><div className="h-5 w-48 bg-muted rounded mb-3" /><div className="h-3 w-32 bg-muted rounded" /></div>)
        : plans.length === 0 ? <div className="bg-card border border-border rounded-lg py-12 text-center shadow-sm"><FiTarget className="w-12 h-12 text-muted-foreground mx-auto mb-3" /><p className="font-medium">No succession plans yet</p><p className="text-sm text-muted-foreground mt-1">Create your first plan</p></div>
        : plans.map(plan => {
          const riskBadge = getRiskBadge(plan.riskLevel);
          const isExpanded = expandedPlan === plan.id;
          const isDeleting = deleteConfirmId === plan.id;
          return (
            <div key={plan.id} className={`bg-card border border-border rounded-lg overflow-hidden shadow-sm transition-colors ${isDeleting ? 'border-red-300' : ''}`}>
              {isDeleting ? (
                <div className="p-6 bg-red-50 flex items-center justify-between"><span className="text-sm text-red-700 font-medium">Delete &quot;{plan.positionTitle}&quot;?</span><div className="flex gap-2"><button onClick={() => handleDeletePlan(plan.id)} disabled={deleting} className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">{deleting ? '...' : 'Confirm'}</button><button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 border border-border text-xs font-medium rounded-lg hover:bg-muted">Cancel</button></div></div>
              ) : (
                <>
                  <div className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap"><h3 className="text-lg font-semibold">{plan.positionTitle}</h3><span className={riskBadge.className}>{riskBadge.label}</span></div>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                          {plan.department && <span className="flex items-center gap-1"><FiUsers className="w-3.5 h-3.5" />{plan.department.name}</span>}
                          <span className="flex items-center gap-1"><FiUsers className="w-3.5 h-3.5" />{plan.candidates.length} Candidate{plan.candidates.length !== 1 ? 's' : ''}</span>
                          {plan.currentHolder && <span>Holder: {plan.currentHolder.firstName} {plan.currentHolder.lastName}</span>}
                        </div>
                        {plan.candidates.length > 0 && (
                          <div className="flex items-center gap-3 mt-2">
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-xs text-muted-foreground">{plan.candidates.filter(c => c.readinessLevel === 'ready_now').length} Ready</span></div>
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" /><span className="text-xs text-muted-foreground">{plan.candidates.filter(c => c.readinessLevel === 'developing' || c.readinessLevel === 'ready_1_2_years').length} Developing</span></div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isAdmin && <><button onClick={() => handleOpenCandidateForm(plan.id)} className="px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700"><FiPlus className="w-3.5 h-3.5 inline mr-1" />Candidate</button><button onClick={() => handleOpenPlanForm(plan)} className="p-2 rounded-lg text-muted-foreground hover:text-amber-500 hover:bg-amber-50"><FiEdit2 className="w-4 h-4" /></button><button onClick={() => setDeleteConfirmId(plan.id)} className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50"><FiTrash2 className="w-4 h-4" /></button></>}
                        <button onClick={() => setExpandedPlan(isExpanded ? null : plan.id)} className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-muted">{isExpanded ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}</button>
                      </div>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-border p-6 bg-muted/30 space-y-3">
                      <h4 className="text-sm font-semibold">Candidates ({plan.candidates.length})</h4>
                      {plan.candidates.length === 0 ? <div className="text-center py-6 bg-background rounded-lg border border-border"><FiUsers className="w-8 h-8 text-muted-foreground mx-auto mb-2" /><p className="text-sm text-muted-foreground">No candidates</p></div>
                      : plan.candidates.map(c => {
                        const rb = getReadinessBadge(c.readinessLevel);
                        return (
                          <div key={c.id} className="p-4 bg-background rounded-lg border border-border">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm ${getReadinessDotColor(c.readinessLevel)}`}>{c.employee ? `${c.employee.firstName[0]}${c.employee.lastName[0]}` : '?'}</div>
                                <div>
                                  <p className="text-sm font-semibold">{c.employee ? `${c.employee.firstName} ${c.employee.lastName}` : 'Unknown'}</p>
                                  <div className="flex items-center gap-2 mt-1"><span className={rb.className}>{rb.label}</span>{c.employee?.designation && <span className="text-xs text-muted-foreground">{c.employee.designation.title}</span>}</div>
                                  {c.aiReadinessScore && <div className="flex items-center gap-2 mt-2"><span className="text-xs text-muted-foreground">AI:</span><div className="w-20 bg-muted rounded-full h-1.5"><div className={`h-1.5 rounded-full ${c.aiReadinessScore >= 70 ? 'bg-emerald-500' : c.aiReadinessScore >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${c.aiReadinessScore}%` }} /></div><span className="text-xs font-medium">{c.aiReadinessScore}%</span></div>}
                                  {c.developmentNeeds && <p className="text-xs text-muted-foreground mt-1">Dev: {c.developmentNeeds}</p>}
                                </div>
                              </div>
                              {isAdmin && <button onClick={() => handleRemoveCandidate(plan.id, c.id)} className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50"><FiX className="w-4 h-4" /></button>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
