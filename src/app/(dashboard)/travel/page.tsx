'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import {
  FiMap,
  FiPlus,
  FiX,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiFilter,
  FiCalendar,
  FiNavigation,
  FiGrid, FiFileText, FiSettings, FiBarChart2,
} from 'react-icons/fi';
import ModuleDashboardShell, { DashboardTabConfig } from '@/components/ModuleDashboardShell';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import ModuleTips from '@/components/ModuleTips';
import ModuleWorkflow from '@/components/ModuleWorkflow';
import { useCompanyContextStore } from '@/store/companyContextStore';

/* ── Types ── */
interface TravelRequest {
  id: string;
  employeeId: string;
  purpose: string;
  destination: string;
  startDate: string;
  endDate: string;
  mode: string;
  estimatedCost: number | null;
  actualCost?: number | null;
  status: string;
  approvalNotes?: string | null;
  notes?: string | null;
  employee?: { id: string; firstName: string; lastName: string; employeeId: string };
}

interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
}

/* ── Helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCurrency(amount: number | null | undefined) {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    requested: 'thb-badge thb-badge-warning',
    pending: 'thb-badge thb-badge-warning',
    approved: 'thb-badge thb-badge-info',
    booked: 'thb-badge thb-badge-info',
    in_progress: 'thb-badge thb-badge-info',
    completed: 'thb-badge thb-badge-success',
    cancelled: 'thb-badge thb-badge-error',
    rejected: 'thb-badge thb-badge-error',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

function formatStatus(status: string) {
  const map: Record<string, string> = {
    requested: 'Requested',
    pending: 'Pending',
    approved: 'Approved',
    booked: 'Booked',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    rejected: 'Rejected',
  };
  return map[status] || status;
}

function getModeLabel(mode: string) {
  const map: Record<string, string> = {
    flight: '✈️ Flight',
    train: '🚆 Train',
    bus: '🚌 Bus',
    car: '🚗 Car',
    other: '🚐 Other',
  };
  return map[mode] || mode;
}

const TRAVEL_MODES = ['flight', 'train', 'bus', 'car', 'other'];
const TRAVEL_STATUSES = ['requested', 'approved', 'booked', 'in_progress', 'completed', 'cancelled'];

const travelTips = [
  { title: 'Travel Policy Compliance', description: 'Ensure all travel requests comply with company travel policies and budgets' },
  { title: 'Advance Booking', description: 'Book travel in advance to get better rates and ensure availability' },
  { title: 'Approval Hierarchy', description: 'Follow the proper approval chain based on destination and cost' },
  { title: 'Expense Integration', description: 'Link travel expenses directly to the expense management module for seamless tracking' },
  { title: 'Itinerary Management', description: 'Keep travel itineraries updated with flight, hotel, and meeting details' },
];

const travelWorkflowSteps = [
  { step: 1, title: 'Submit Travel Request', description: 'Employee submits a travel request with purpose and details', route: '/travel' },
  { step: 2, title: 'Manager Approval', description: 'Direct manager reviews and approves the travel request' },
  { step: 3, title: 'Book Travel', description: 'Book flights, hotels, and transportation for the trip' },
  { step: 4, title: 'Track Itinerary', description: 'Monitor travel itinerary and any changes' },
  { step: 5, title: 'Submit Expense Report', description: 'Submit all travel-related expenses after the trip' },
  { step: 6, title: 'Finance Reconciliation', description: 'Finance team reconciles expenses against the approved budget' },
  { step: 7, title: 'Close Request', description: 'Close the travel request after all expenses are settled' },
];

const initialForm = {
  employeeId: '',
  purpose: '',
  destination: '',
  startDate: '',
  endDate: '',
  travelMode: 'flight',
  estimatedCost: '',
  status: 'requested',
  approvalNotes: '',
};

/* ── Placeholder Tabs ── */

const travelTabs: DashboardTabConfig[] = [
  { label: 'Overview', key: 'overview', icon: <FiGrid className="w-4 h-4" /> },
  { label: 'Reports', key: 'reports', icon: <FiFileText className="w-4 h-4" />, isNew: true },
  { label: 'Settings', key: 'settings', icon: <FiSettings className="w-4 h-4" />, isNew: true },
];

function TravelReportsPlaceholder() {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg mb-4">
        <FiFileText className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-lg font-bold text-thb-text-primary mb-1">Reports & Analytics</h3>
      <p className="text-sm text-thb-text-secondary text-center max-w-md mb-4">
        Travel spending reports, expense breakdowns, and policy compliance analytics
      </p>
      <a href="/travel/reports" className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
        <FiBarChart2 className="w-4 h-4" /> Go to Reports
      </a>
    </div>
  );
}

function TravelSettingsPlaceholder() {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow-lg mb-4">
        <FiSettings className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-lg font-bold text-thb-text-primary mb-1">Settings & Configuration</h3>
      <p className="text-sm text-thb-text-secondary text-center max-w-md mb-4">
        Configure travel policies, approval hierarchies, and expense categories
      </p>
      <a href="/travel/settings" className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors">
        <FiSettings className="w-4 h-4" /> Go to Settings
      </a>
    </div>
  );
}

function TravelPageContent() {
  return (
    <ModuleDashboardShell
      moduleKey="travel-expense"
      moduleLabel="Travel & Expense"
      moduleIcon={<FiMap className="w-5 h-5 text-white" />}
      gradientColor="from-orange-500 to-red-600"
      tabs={travelTabs}
      overviewContent={<TravelContent />}
      children={{
        reports: <TravelReportsPlaceholder />,
        settings: <TravelSettingsPlaceholder />,
      }}
    />
  );
}

export default function TravelPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>}>
      <TravelPageContent />
    </Suspense>
  );
}

/* ── Component ── */
function TravelContent() {
  const { user } = useAuthStore();
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');

  const [travels, setTravels] = useState<TravelRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMode, setFilterMode] = useState('');

  /* Fetch data */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();

      const params = new URLSearchParams({ limit: '100' });
      if (filterStatus) params.set('status', filterStatus);

      const [travRes, empRes] = await Promise.all([
        fetch(`/api/travel?${scopeQuery}${params.toString()}` , { headers }),
        fetch(`/api/employees?${scopeQuery}limit=500`, { headers }),
      ]);

      if (travRes.ok) {
        const data = await travRes.json();
        setTravels(data.travelRequests || data.travels || []);
      }

      if (empRes.ok) {
        const data = await empRes.json();
        setEmployees(data.employees || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load travel requests');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);
  const cid = effectiveCompanyId();
  const scopeQuery = cid ? `companyId=${cid}&` : '';


  useEffect(() => { queueMicrotask(() => fetchData()); }, [fetchData]);

  /* Filter by search and mode */
  const filteredTravels = travels.filter(t => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      t.purpose.toLowerCase().includes(s) ||
      t.destination.toLowerCase().includes(s) ||
      (t.employee ? `${t.employee.firstName} ${t.employee.lastName}`.toLowerCase().includes(s) : false)
    );
  }).filter(t => {
    if (!filterMode) return true;
    return t.mode === filterMode;
  });

  /* Form handlers */
  const handleAddNew = () => {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(true);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleEdit = (travel: TravelRequest) => {
    setForm({
      employeeId: travel.employeeId,
      purpose: travel.purpose,
      destination: travel.destination,
      startDate: new Date(travel.startDate).toISOString().split('T')[0],
      endDate: new Date(travel.endDate).toISOString().split('T')[0],
      travelMode: travel.mode,
      estimatedCost: travel.estimatedCost?.toString() || '',
      status: travel.status,
      approvalNotes: travel.approvalNotes || travel.notes || '',
    });
    setEditingId(travel.id);
    setShowForm(true);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(initialForm);
  };

  const handleSubmit = async () => {
    if (!form.purpose || !form.destination || !form.startDate || !form.endDate) {
      toast.error('Please fill in all required fields (Purpose, Destination, Dates)');
      return;
    }
    if (!editingId && !form.employeeId) {
      toast.error('Please select an employee');
      return;
    }
    try {
      setSubmitting(true);
      const body: Record<string, unknown> = {
        purpose: form.purpose,
        destination: form.destination,
        startDate: form.startDate,
        endDate: form.endDate,
        mode: form.travelMode,
        estimatedCost: form.estimatedCost ? parseFloat(form.estimatedCost) : null,
        notes: form.approvalNotes || null,
      };

      if (editingId) {
        const res = await fetch(`/api/travel/${editingId}?${scopeQuery}` , {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify({ ...body, status: form.status }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to update'); }
        toast.success('Travel request updated successfully');
      } else {
        const res = await fetch(`/api/travel?${scopeQuery}` , {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ ...body, employeeId: form.employeeId, status: 'requested' }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to create'); }
        toast.success('Travel request submitted successfully');
      }

      handleCancelForm();
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save travel request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleting(true);
      const res = await fetch(`/api/travel/${id}?${scopeQuery}` , {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to delete'); }
      toast.success('Travel request deleted successfully');
      setDeleteConfirmId(null);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete travel request');
    } finally {
      setDeleting(false);
    }
  };

  const colCount = isAdmin ? 8 : 7;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiMap className="w-6 h-6 text-emerald-500" />
            Travel
          </h1>
          <p className="text-thb-text-secondary mt-1">Manage business travel requests and approvals</p>
        </div>
        <button onClick={handleAddNew} className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors">
          <FiPlus className="w-4 h-4" />
          Request Travel
        </button>
      </div>

      <ModuleTips moduleKey="travel" title="Travel Tips" tips={travelTips} userRole={user?.role} />
      <ModuleWorkflow moduleKey="travel" title="How to Process Travel Requests" subtitle="Follow this workflow to manage business travel from request to completion" steps={travelWorkflowSteps} accentColor="rose" userRole={user?.role} />

      {/* Filters & Search */}
      <div className="thb-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
            <input
              type="text"
              placeholder="Search by purpose, destination, or employee..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <FiFilter className="w-4 h-4 text-thb-text-muted" />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
            >
              <option value="">All Statuses</option>
              {TRAVEL_STATUSES.map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
            </select>
            <select
              value={filterMode}
              onChange={e => setFilterMode(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
            >
              <option value="">All Modes</option>
              {TRAVEL_MODES.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Embedded Form */}
      {showForm && (
        <div id="crud-form" className="thb-card border-l-4 border-l-green-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">
                {editingId ? 'Edit Travel Request' : 'New Travel Request'}
              </h2>
              <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {!editingId && (
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Employee <span className="text-red-500 font-bold">*</span></label>
                  <select value={form.employeeId} onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                    <option value="">Select Employee</option>
                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Purpose <span className="text-red-500 font-bold">*</span></label>
                <input type="text" value={form.purpose} onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="Business purpose" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Destination <span className="text-red-500 font-bold">*</span></label>
                <input type="text" value={form.destination} onChange={e => setForm(p => ({ ...p, destination: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="City, Country" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Start Date <span className="text-red-500 font-bold">*</span></label>
                <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">End Date <span className="text-red-500 font-bold">*</span></label>
                <input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} min={form.startDate} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Travel Mode <span className="text-red-500 font-bold">*</span></label>
                <select value={form.travelMode} onChange={e => setForm(p => ({ ...p, travelMode: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                  {TRAVEL_MODES.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Estimated Cost</label>
                <input type="number" step="0.01" value={form.estimatedCost} onChange={e => setForm(p => ({ ...p, estimatedCost: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="0.00" />
              </div>
              {editingId && (
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                    {TRAVEL_STATUSES.map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
                  </select>
                </div>
              )}
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Approval Notes</label>
                <textarea rows={2} value={form.approvalNotes} onChange={e => setForm(p => ({ ...p, approvalNotes: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 resize-none" placeholder="Additional notes..." />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-thb-border">
              <button onClick={handleCancelForm} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 shadow-sm shadow-green-500/25 transition-colors">
                {submitting ? 'Saving...' : editingId ? 'Update' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Travel Requests Table */}
      <div className="thb-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-thb-border bg-slate-50/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Purpose</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Destination</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Dates</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Mode</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Est. Cost</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Status</th>
                {isAdmin && (
                  <th className="text-right px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-thb-border/50 animate-pulse">
                    <td className="px-4 py-3"><div className="h-3 w-24 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-20 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-20 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-28 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-14 bg-slate-200 rounded-full" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-16 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-16 bg-slate-200 rounded-full" /></td>
                    {isAdmin && <td className="px-4 py-3"><div className="h-3 w-16 bg-slate-200 rounded ml-auto" /></td>}
                  </tr>
                ))
              ) : filteredTravels.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-12 text-center">
                    <FiNavigation className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
                    <p className="text-thb-text-secondary font-medium">No travel requests found</p>
                    <p className="text-sm text-thb-text-muted mt-1">
                      {search || filterStatus || filterMode ? 'Try adjusting your filters' : 'Submit your first travel request'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTravels.map(t => (
                  <tr key={t.id} className="border-b border-thb-border/50 hover:bg-slate-50/50 transition-colors">
                    {deleteConfirmId === t.id ? (
                      <td colSpan={colCount} className="px-4 py-3 bg-red-50">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-red-700 font-medium">Are you sure you want to delete this travel request?</span>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleDelete(t.id)} disabled={deleting} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">
                              {deleting ? 'Deleting...' : 'Confirm'}
                            </button>
                            <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-sm font-medium text-thb-text-primary">{t.employee ? `${t.employee.firstName} ${t.employee.lastName}` : 'Unknown'}</td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary truncate max-w-[150px]">{t.purpose}</td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">{t.destination}</td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">
                          <div className="flex items-center gap-1"><FiCalendar className="w-3 h-3 text-thb-text-muted" />{formatDate(t.startDate)} — {formatDate(t.endDate)}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">{getModeLabel(t.mode)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-thb-text-primary text-right">{formatCurrency(t.estimatedCost)}</td>
                        <td className="px-4 py-3"><span className={getStatusBadge(t.status)}>{formatStatus(t.status)}</span></td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => handleEdit(t)} className="p-2 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Edit">
                                <FiEdit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => setDeleteConfirmId(t.id)} className="p-2 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete">
                                <FiTrash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
