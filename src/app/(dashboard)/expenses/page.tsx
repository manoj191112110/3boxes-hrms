'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiCreditCard,
  FiPlus,
  FiX,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiFilter,
  FiDollarSign,
  FiClock,
  FiCheckCircle,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import ModuleTips from '@/components/ModuleTips';
import ModuleWorkflow from '@/components/ModuleWorkflow';
import { useCompanyContextStore } from '@/store/companyContextStore';

/* ── Types ── */
interface ExpenseClaim {
  id: string;
  employeeId: string;
  title: string;
  category: string;
  amount: number;
  currency: string;
  date: string;
  description: string | null;
  receipt: string | null;
  status: string;
  approvedBy?: string | null;
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

function formatCurrency(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600 thb-badge',
    submitted: 'thb-badge thb-badge-warning',
    pending: 'thb-badge thb-badge-warning',
    approved: 'thb-badge thb-badge-success',
    rejected: 'thb-badge thb-badge-error',
    reimbursed: 'thb-badge thb-badge-info',
    paid: 'thb-badge thb-badge-info',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

function formatStatus(status: string) {
  const map: Record<string, string> = {
    draft: 'Draft',
    submitted: 'Submitted',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    reimbursed: 'Reimbursed',
    paid: 'Paid',
  };
  return map[status] || status;
}

function formatCategory(category: string) {
  const map: Record<string, string> = {
    travel: 'Travel',
    meals: 'Meals',
    office_supplies: 'Office Supplies',
    software: 'Software',
    hardware: 'Hardware',
    training: 'Training',
    entertainment: 'Entertainment',
    other: 'Other',
    food: 'Food',
    accommodation: 'Accommodation',
    transport: 'Transport',
    medical: 'Medical',
  };
  return map[category] || category;
}

const EXPENSE_CATEGORIES = ['travel', 'meals', 'office_supplies', 'software', 'hardware', 'training', 'entertainment', 'other'];
const EXPENSE_STATUSES = ['draft', 'submitted', 'approved', 'rejected', 'reimbursed'];

const expensesTips = [
  { title: 'Expense Categories', description: 'Categorize expenses properly for accurate reporting and tax compliance' },
  { title: 'Receipt Upload', description: 'Always attach receipts to expense claims for verification and audit purposes' },
  { title: 'Approval Workflows', description: 'Follow the defined approval hierarchy to ensure timely processing of claims' },
  { title: 'Policy Limits', description: 'Be aware of expense policy limits to avoid rejections and delays' },
  { title: 'Reimbursement Schedules', description: 'Submit claims on time to be included in the next reimbursement cycle' },
];

const expensesWorkflowSteps = [
  { step: 1, title: 'Submit Expense Claim', description: 'Create a new expense claim with all required details', route: '/expenses' },
  { step: 2, title: 'Attach Receipts', description: 'Upload supporting receipts and documentation' },
  { step: 3, title: 'Manager Review', description: 'Direct manager reviews and approves or rejects the claim' },
  { step: 4, title: 'Finance Verification', description: 'Finance team verifies the claim against policies' },
  { step: 5, title: 'Approve/Reject', description: 'Final approval or rejection with comments' },
  { step: 6, title: 'Process Reimbursement', description: 'Process the approved amount for reimbursement' },
  { step: 7, title: 'Update Records', description: 'Update financial records and close the claim' },
];

const initialForm = {
  title: '',
  category: 'travel',
  amount: '',
  date: '',
  receipt: '',
  description: '',
  status: 'draft',
  employeeId: '',
};

/* ── Component ── */
export default function ExpensesPage() {
  const { user } = useAuthStore();
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');

  const [expenses, setExpenses] = useState<ExpenseClaim[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  /* Fetch data */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();

      const params = new URLSearchParams({ limit: '100' });
      if (filterCategory) params.set('category', filterCategory);
      if (filterStatus) params.set('status', filterStatus);

      const [expRes, empRes] = await Promise.all([
        fetch(`/api/expenses?${scopeQuery}${params.toString()}` , { headers }),
        fetch(`/api/employees?${scopeQuery}limit=500`, { headers }),
      ]);

      if (expRes.ok) {
        const data = await expRes.json();
        setExpenses(data.expenseClaims || data.expenses || []);
      }

      if (empRes.ok) {
        const data = await empRes.json();
        setEmployees(data.employees || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterStatus]);
  const cid = effectiveCompanyId();
  const scopeQuery = cid ? `companyId=${cid}&` : '';


  useEffect(() => { queueMicrotask(() => fetchData()); }, [fetchData]);

  /* Filter by search */
  const filteredExpenses = expenses.filter(e => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      e.title.toLowerCase().includes(s) ||
      e.category.toLowerCase().includes(s) ||
      (e.employee ? `${e.employee.firstName} ${e.employee.lastName}`.toLowerCase().includes(s) : false)
    );
  });

  /* Summary calculations */
  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);
  const pendingAmount = expenses.filter(e => e.status === 'pending' || e.status === 'submitted').reduce((s, e) => s + e.amount, 0);
  const approvedAmount = expenses.filter(e => e.status === 'approved').reduce((s, e) => s + e.amount, 0);

  /* Form handlers */
  const handleAddNew = () => {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(true);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleEdit = (expense: ExpenseClaim) => {
    setForm({
      title: expense.title,
      category: expense.category,
      amount: expense.amount.toString(),
      date: new Date(expense.date).toISOString().split('T')[0],
      receipt: expense.receipt || '',
      description: expense.description || '',
      status: expense.status,
      employeeId: expense.employeeId,
    });
    setEditingId(expense.id);
    setShowForm(true);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(initialForm);
  };

  const handleSubmit = async () => {
    if (!form.title || !form.category || !form.amount || !form.date) {
      toast.error('Please fill in all required fields (Title, Category, Amount, Date)');
      return;
    }
    if (!editingId && !form.employeeId) {
      toast.error('Please select an employee');
      return;
    }
    try {
      setSubmitting(true);
      const body: Record<string, unknown> = {
        title: form.title,
        category: form.category,
        amount: parseFloat(form.amount),
        date: form.date,
        receipt: form.receipt || null,
        description: form.description || null,
        status: form.status,
      };

      if (editingId) {
        const res = await fetch(`/api/expenses/${editingId}?${scopeQuery}` , {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify(body),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to update'); }
        toast.success('Expense updated successfully');
      } else {
        const res = await fetch(`/api/expenses?${scopeQuery}` , {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ ...body, employeeId: form.employeeId }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to create'); }
        toast.success('Expense added successfully');
      }

      handleCancelForm();
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save expense');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleting(true);
      const res = await fetch(`/api/expenses/${id}?${scopeQuery}` , {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to delete'); }
      toast.success('Expense deleted successfully');
      setDeleteConfirmId(null);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete expense');
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
            <FiCreditCard className="w-6 h-6 text-rose-500" />
            Expenses
          </h1>
          <p className="text-thb-text-secondary mt-1">Submit and manage expense reimbursements</p>
        </div>
        <button onClick={handleAddNew} className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors">
          <FiPlus className="w-4 h-4" />
          Add Expense
        </button>
      </div>

      <ModuleTips moduleKey="expenses" title="Expenses Tips" tips={expensesTips} userRole={user?.role} />
      <ModuleWorkflow moduleKey="expenses" title="How to Process Expense Claims" subtitle="Follow this workflow to submit and process expense reimbursements" steps={expensesWorkflowSteps} accentColor="amber" userRole={user?.role} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="thb-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <FiDollarSign className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Total Amount</p>
              <p className="text-xl font-bold text-thb-text-primary">{formatCurrency(totalAmount)}</p>
            </div>
          </div>
        </div>
        <div className="thb-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <FiClock className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Pending Amount</p>
              <p className="text-xl font-bold text-amber-600">{formatCurrency(pendingAmount)}</p>
            </div>
          </div>
        </div>
        <div className="thb-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <FiCheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Approved Amount</p>
              <p className="text-xl font-bold text-emerald-600">{formatCurrency(approvedAmount)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="thb-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
            <input
              type="text"
              placeholder="Search by title, category, or employee..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <FiFilter className="w-4 h-4 text-thb-text-muted" />
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
            >
              <option value="">All Categories</option>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{formatCategory(c)}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
            >
              <option value="">All Statuses</option>
              {EXPENSE_STATUSES.map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
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
                {editingId ? 'Edit Expense' : 'Add New Expense'}
              </h2>
              <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Title *</label>
                <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="Expense title" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Category *</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{formatCategory(c)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Amount *</label>
                <input type="number" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Date *</label>
                <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
              </div>
              {!editingId && (
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Employee *</label>
                  <select value={form.employeeId} onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                    <option value="">Select Employee</option>
                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Receipt URL</label>
                <input type="text" value={form.receipt} onChange={e => setForm(p => ({ ...p, receipt: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" placeholder="https://..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                  {EXPENSE_STATUSES.map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-thb-text-secondary mb-1">Description</label>
                <textarea rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 resize-none" placeholder="Expense description..." />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-thb-border">
              <button onClick={handleCancelForm} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 shadow-sm shadow-green-500/25 transition-colors">
                {submitting ? 'Saving...' : editingId ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expenses Table */}
      <div className="thb-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-thb-border bg-slate-50/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Title</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Employee</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-secondary uppercase tracking-wider">Date</th>
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
                    <td className="px-4 py-3"><div className="h-5 w-16 bg-slate-200 rounded-full" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-20 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-16 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-20 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-16 bg-slate-200 rounded-full" /></td>
                    {isAdmin && <td className="px-4 py-3"><div className="h-3 w-16 bg-slate-200 rounded ml-auto" /></td>}
                  </tr>
                ))
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-12 text-center">
                    <FiCreditCard className="w-10 h-10 text-thb-text-muted mx-auto mb-3" />
                    <p className="text-thb-text-secondary font-medium">No expenses found</p>
                    <p className="text-sm text-thb-text-muted mt-1">
                      {search || filterCategory || filterStatus ? 'Try adjusting your filters' : 'Add your first expense to get started'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map(expense => (
                  <tr key={expense.id} className="border-b border-thb-border/50 hover:bg-slate-50/50 transition-colors">
                    {deleteConfirmId === expense.id ? (
                      <td colSpan={colCount} className="px-4 py-3 bg-red-50">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-red-700 font-medium">Are you sure you want to delete &quot;{expense.title}&quot;?</span>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleDelete(expense.id)} disabled={deleting} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">
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
                        <td className="px-4 py-3 text-sm font-medium text-thb-text-primary">{expense.title}</td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">{formatCategory(expense.category)}</td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">
                          {expense.employee ? `${expense.employee.firstName} ${expense.employee.lastName}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-thb-text-primary text-right">{formatCurrency(expense.amount, expense.currency)}</td>
                        <td className="px-4 py-3 text-sm text-thb-text-secondary">{formatDate(expense.date)}</td>
                        <td className="px-4 py-3"><span className={getStatusBadge(expense.status)}>{formatStatus(expense.status)}</span></td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => handleEdit(expense)} className="p-2 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors" title="Edit">
                                <FiEdit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => setDeleteConfirmId(expense.id)} className="p-2 rounded-lg text-thb-text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete">
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
