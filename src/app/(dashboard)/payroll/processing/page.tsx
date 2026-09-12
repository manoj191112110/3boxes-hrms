'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiPlayCircle, FiPlus, FiX, FiTrash2, FiRefreshCw,
  FiDollarSign, FiTrendingUp, FiCheckCircle,
  FiChevronDown, FiChevronUp, FiArrowRight, FiSearch,
  FiClock, FiZap, FiEye, FiActivity,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { sanitizeSearch } from '@/lib/validators';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// --- Types ---
interface PayrollRun {
  id: string;
  legalEntityId: string;
  payrollPeriod: string;
  periodStartDate: string;
  periodEndDate: string;
  payDate: string;
  runType: string;
  runStatus: string;
  currencyCode: string;
  exchangeRateDate: string | null;
  taxProjectionMethod: string;
  includeStatutory: boolean;
  processingMode: string;
  initiatedBy: string | null;
  companyId: string | null;
  totalEmployees: number;
  totalGrossPay: number;
  totalDeductions: number;
  totalNetPay: number;
  totalEmployerContrib: number;
  createdAt: string;
  updatedAt: string;
  transactionLines?: PayrollTransactionLine[];
  payrollInputs?: unknown[];
  complianceFilings?: unknown[];
}

interface PayrollTransactionLine {
  id: string;
  employeeId: string;
  componentCode: string;
  componentType: string;
  componentCategory: string;
  calculatedAmount: number;
  finalAmount: number;
  currencyCode: string;
  ytdAmount: number;
  mtdAmount: number;
}

interface Company {
  id: string;
  name: string;
  code: string | null;
}

// --- Constants ---
const STATUS_STAGES = ['OPEN', 'INPUT_COLLECTION', 'PROCESSING', 'REVIEW', 'APPROVED', 'ACCOUNTING', 'DISBURSED', 'CLOSED'];

const RUN_TYPE_OPTIONS = [
  { value: 'REGULAR', label: 'Regular' },
  { value: 'OFF_CYCLE', label: 'Off-Cycle' },
  { value: 'SUPPLEMENTAL', label: 'Supplemental' },
  { value: 'FINAL_SETTLEMENT', label: 'Final Settlement' },
  { value: 'CORRECTION', label: 'Correction' },
];

const CURRENCY_CODE_OPTIONS = [
  { value: 'INR', label: 'INR - Indian Rupee' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'SGD', label: 'SGD - Singapore Dollar' },
  { value: 'AED', label: 'AED - UAE Dirham' },
  { value: 'AUD', label: 'AUD - Australian Dollar' },
];

const TAX_METHOD_OPTIONS = [
  { value: 'CUMULATIVE', label: 'Cumulative' },
  { value: 'NON_CUMULATIVE', label: 'Non-Cumulative' },
  { value: 'ANNUALIZED', label: 'Annualized' },
];

const PROCESSING_MODE_OPTIONS = [
  { value: 'FULL', label: 'Full' },
  { value: 'DELTA', label: 'Delta' },
];

const RUN_STATUS_FILTER_OPTIONS = [
  { value: 'OPEN', label: 'Open' },
  { value: 'INPUT_COLLECTION', label: 'Input Collection' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'REVIEW', label: 'Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'ACCOUNTING', label: 'Accounting' },
  { value: 'DISBURSED', label: 'Disbursed' },
  { value: 'CLOSED', label: 'Closed' },
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', INR: '₹', GBP: '£', SGD: 'S$', AED: 'د.إ', AUD: 'A$',
};

const emptyForm = {
  legalEntityId: '',
  payrollPeriod: '',
  periodStartDate: '',
  periodEndDate: '',
  payDate: '',
  runType: 'REGULAR',
  currencyCode: 'INR',
  taxProjectionMethod: 'CUMULATIVE',
  includeStatutory: true,
  processingMode: 'FULL',
  companyId: '',
};

// --- Badge Helpers ---
function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    OPEN: 'bg-green-100 text-green-700 border-green-200',
    INPUT_COLLECTION: 'bg-teal-100 text-teal-700 border-teal-200',
    PROCESSING: 'bg-amber-100 text-amber-700 border-amber-200',
    REVIEW: 'bg-sky-100 text-sky-700 border-sky-200',
    APPROVED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    ACCOUNTING: 'bg-teal-100 text-teal-700 border-teal-200',
    DISBURSED: 'bg-green-100 text-green-700 border-green-200',
    CLOSED: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return map[status] || 'bg-gray-100 text-gray-700 border-gray-200';
}

function getRunTypeBadge(type: string) {
  const map: Record<string, string> = {
    REGULAR: 'thb-badge thb-badge-info',
    OFF_CYCLE: 'thb-badge thb-badge-warning',
    SUPPLEMENTAL: 'thb-badge thb-badge-purple',
    FINAL_SETTLEMENT: 'thb-badge thb-badge-error',
    CORRECTION: 'thb-badge thb-badge-success',
  };
  return map[type] || 'thb-badge thb-badge-info';
}

// --- Detail Item ---
function DetailItem({ label, value, badge }: { label: string; value: string | number | boolean | null | undefined; badge?: string }) {
  return (
    <div>
      <span className="text-xs font-medium text-thb-text-secondary">{label}</span>
      {badge ? (
        <p className="mt-0.5"><span className={badge}>{value != null ? String(value).replace(/_/g, ' ') : '—'}</span></p>
      ) : (
        <p className="text-sm font-medium text-thb-text-primary mt-0.5">
          {value === true ? 'Yes' : value === false ? 'No' : value != null && value !== '' ? String(value) : '—'}
        </p>
      )}
    </div>
  );
}

export default function PayrollProcessingPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin' || user?.role === 'admin';
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId());
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);
  const availableCompanies = useCompanyContextStore(s => s.availableCompanies);

  // --- State ---
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [expandedRunData, setExpandedRunData] = useState<PayrollRun | null>(null);
  const [expandLoading, setExpandLoading] = useState(false);
  const [calculatingId, setCalculatingId] = useState<string | null>(null);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [payrollPeriodFilter, setPayrollPeriodFilter] = useState('');
  const [runStatusFilter, setRunStatusFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');

  // Sync company filter with global company switcher on hydration
  useEffect(() => {
    if (effectiveCompanyId) setCompanyFilter(prev => prev || effectiveCompanyId);
  }, [effectiveCompanyId, selectedTenantId]);

  // Form state
  const [form, setForm] = useState({ ...emptyForm });

  // --- Data Fetching ---
  const fetchCompanies = useCallback(async () => {
    try {
      const res = await fetch('/api/companies?limit=100', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = data.companies || data.data || [];
        setCompanies(list.map((c: Record<string, unknown>) => ({
          id: c.id as string,
          name: c.name as string,
          code: (c.code as string) || null,
        })));
      }
    } catch {
      // Silently fail
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (runStatusFilter) params.set('runStatus', runStatusFilter);
      if (payrollPeriodFilter) params.set('payrollPeriod', payrollPeriodFilter);
      const cid = companyFilter || effectiveCompanyId;
      if (cid) params.set('companyId', cid);
      const sq = scopeQuery();
      const qs = params.toString();
      const url = `/api/payroll/runs${qs ? `?${qs}${sq ? `&${sq}` : ''}` : (sq ? `?${sq}` : '')}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setRuns(Array.isArray(data) ? data : data.data || []);
      } else {
        let errorMsg = 'Failed to load payroll runs';
        try { const d = await res.json(); errorMsg = d.error || errorMsg; } catch { /* non-JSON response */ }
        toast.error(errorMsg);
      }
    } catch {
      toast.error('Failed to load payroll runs');
    } finally {
      setLoading(false);
    }
  }, [runStatusFilter, payrollPeriodFilter, companyFilter, effectiveCompanyId, scopeQuery, selectedTenantId]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchData();
      fetchCompanies();
    });
  }, [fetchData, fetchCompanies]);

  // --- Computed Stats ---
  const totalRuns = runs.length;
  const inProgressCount = runs.filter(r => ['INPUT_COLLECTION', 'PROCESSING', 'REVIEW'].includes(r.runStatus)).length;
  const approvedCount = runs.filter(r => r.runStatus === 'APPROVED').length;
  const disbursedCount = runs.filter(r => ['DISBURSED', 'CLOSED'].includes(r.runStatus)).length;

  // --- Filtered List ---
  const filteredRuns = runs.filter(r => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !r.payrollPeriod.toLowerCase().includes(q) &&
        !r.runType.toLowerCase().includes(q) &&
        !r.legalEntityId.toLowerCase().includes(q) &&
        !r.runStatus.toLowerCase().includes(q) &&
        !r.currencyCode.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  // --- Format Helpers ---
  const formatCurrency = (amount: number, currencyCode: string) => {
    const symbol = CURRENCY_SYMBOLS[currencyCode] || '$';
    return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString() : '—';

  const formatStatus = (s: string) => s ? s.replace(/_/g, ' ') : '';

  const formatRunType = (t: string) => t ? t.replace(/_/g, ' ') : '';

  // --- Stage Progress ---
  const getStageIndex = (status: string) => STATUS_STAGES.indexOf(status);

  // --- Handlers ---
  const handleAddNew = () => {
    setForm({ ...emptyForm, companyId: effectiveCompanyId || '' });
    setEditingId(null);
    setShowForm(true);
    setExpandedRunId(null);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const handleSubmit = async () => {
    if (!form.legalEntityId.trim()) { toast.error('Legal Entity ID is required'); return; }
    if (!form.payrollPeriod.trim()) { toast.error('Payroll Period is required'); return; }
    if (!form.periodStartDate) { toast.error('Period Start Date is required'); return; }
    if (!form.periodEndDate) { toast.error('Period End Date is required'); return; }
    if (!form.payDate) { toast.error('Pay Date is required'); return; }

    setSubmitting(true);
    try {
      const payload = {
        legalEntityId: form.legalEntityId,
        payrollPeriod: form.payrollPeriod,
        periodStartDate: form.periodStartDate,
        periodEndDate: form.periodEndDate,
        payDate: form.payDate,
        runType: form.runType,
        currencyCode: form.currencyCode,
        taxProjectionMethod: form.taxProjectionMethod,
        includeStatutory: form.includeStatutory,
        processingMode: form.processingMode,
        companyId: form.companyId || effectiveCompanyId || null,
      };

      if (editingId) {
        const res = await fetch(`/api/payroll/runs/${editingId}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to update'); }
        toast.success('Payroll run updated successfully');
      } else {
        const res = await fetch('/api/payroll/runs', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to create'); }
        toast.success('Payroll run created successfully');
      }
      handleCancelForm();
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/payroll/runs/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to delete'); }
      toast.success('Payroll run deleted successfully');
      setDeleteConfirmId(null);
      if (expandedRunId === id) { setExpandedRunId(null); setExpandedRunData(null); }
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusTransition = async (id: string, newStatus: string, label: string) => {
    setTransitioningId(id);
    try {
      const res = await fetch(`/api/payroll/runs/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ runStatus: newStatus }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to transition status');
      }
      toast.success(`Payroll run advanced to ${formatStatus(newStatus)}`);
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : `Failed to ${label}`);
    } finally {
      setTransitioningId(null);
    }
  };

  const handleCalculate = async (id: string) => {
    setCalculatingId(id);
    try {
      const res = await fetch(`/api/payroll/runs/${id}/calculate`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Calculation failed'); }
      const data = await res.json();
      const summary = data.data?.summary;
      if (summary) {
        toast.success(`Calculation complete: ${summary.totalEmployees} employees, Net Pay: ${formatCurrency(summary.totalNetPay, 'INR')}`);
      } else {
        toast.success('Payroll calculation completed successfully');
      }
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Calculation failed');
    } finally {
      setCalculatingId(null);
    }
  };

  const handleViewDetails = async (run: PayrollRun) => {
    if (expandedRunId === run.id) {
      setExpandedRunId(null);
      setExpandedRunData(null);
      return;
    }
    setExpandedRunId(run.id);
    setExpandLoading(true);
    try {
      const res = await fetch(`/api/payroll/runs/${run.id}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setExpandedRunData(data.data || data);
      } else {
        setExpandedRunData(run);
      }
    } catch {
      setExpandedRunData(run);
    } finally {
      setExpandLoading(false);
    }
  };

  // --- Action Buttons by Status ---
  const getActionButtons = (run: PayrollRun) => {
    if (!isAdmin) return null;
    const isTransitioning = transitioningId === run.id;

    switch (run.runStatus) {
      case 'OPEN':
        return (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleStatusTransition(run.id, 'INPUT_COLLECTION', 'start input collection')}
              disabled={isTransitioning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-500 text-white text-xs font-medium rounded-lg hover:bg-teal-600 disabled:opacity-50 shadow-sm transition-colors"
            >
              {isTransitioning ? <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" /> : <FiArrowRight className="w-3.5 h-3.5" />}
              Start Input Collection
            </button>
            <button
              onClick={() => setDeleteConfirmId(run.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors"
            >
              <FiTrash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        );
      case 'INPUT_COLLECTION':
        return (
          <button
            onClick={() => handleStatusTransition(run.id, 'PROCESSING', 'process payroll')}
            disabled={isTransitioning}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50 shadow-sm transition-colors"
          >
            {isTransitioning ? <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" /> : <FiZap className="w-3.5 h-3.5" />}
            Process Payroll
          </button>
        );
      case 'PROCESSING':
        return (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleStatusTransition(run.id, 'REVIEW', 'send for review')}
              disabled={isTransitioning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-500 text-white text-xs font-medium rounded-lg hover:bg-sky-600 disabled:opacity-50 shadow-sm transition-colors"
            >
              {isTransitioning ? <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" /> : <FiCheckCircle className="w-3.5 h-3.5" />}
              Review
            </button>
            <button
              onClick={() => handleCalculate(run.id)}
              disabled={calculatingId === run.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white text-xs font-medium rounded-lg hover:bg-emerald-600 disabled:opacity-50 shadow-sm transition-colors"
            >
              {calculatingId === run.id ? <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" /> : <FiActivity className="w-3.5 h-3.5" />}
              Calculate
            </button>
          </div>
        );
      case 'REVIEW':
        return (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleStatusTransition(run.id, 'APPROVED', 'approve')}
              disabled={isTransitioning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white text-xs font-medium rounded-lg hover:bg-emerald-600 disabled:opacity-50 shadow-sm transition-colors"
            >
              {isTransitioning ? <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" /> : <FiCheckCircle className="w-3.5 h-3.5" />}
              Approve
            </button>
            <button
              onClick={() => handleStatusTransition(run.id, 'PROCESSING', 'return for correction')}
              disabled={isTransitioning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-amber-200 text-amber-700 text-xs font-medium rounded-lg hover:bg-amber-50 transition-colors"
            >
              <FiRefreshCw className="w-3.5 h-3.5" /> Return for Correction
            </button>
          </div>
        );
      case 'APPROVED':
        return (
          <button
            onClick={() => handleStatusTransition(run.id, 'ACCOUNTING', 'post to accounting')}
            disabled={isTransitioning}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-500 text-white text-xs font-medium rounded-lg hover:bg-teal-600 disabled:opacity-50 shadow-sm transition-colors"
          >
            {isTransitioning ? <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" /> : <FiTrendingUp className="w-3.5 h-3.5" />}
            Post to Accounting
          </button>
        );
      case 'ACCOUNTING':
        return (
          <button
            onClick={() => handleStatusTransition(run.id, 'DISBURSED', 'mark as disbursed')}
            disabled={isTransitioning}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 disabled:opacity-50 shadow-sm transition-colors"
          >
            {isTransitioning ? <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" /> : <FiDollarSign className="w-3.5 h-3.5" />}
            Mark Disbursed
          </button>
        );
      case 'DISBURSED':
        return (
          <button
            onClick={() => handleStatusTransition(run.id, 'CLOSED', 'close period')}
            disabled={isTransitioning}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-600 text-white text-xs font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 shadow-sm transition-colors"
          >
            {isTransitioning ? <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" /> : <FiCheckCircle className="w-3.5 h-3.5" />}
            Close Period
          </button>
        );
      default:
        return null;
    }
  };

  // --- Progress Bar ---
  const renderProgressBar = (currentStatus: string) => {
    const currentIndex = getStageIndex(currentStatus);
    const stageLabels = ['Open', 'Input', 'Process', 'Review', 'Approved', 'Accounting', 'Disbursed', 'Closed'];

    return (
      <div className="mt-4">
        <div className="flex items-center gap-0.5">
          {STATUS_STAGES.map((stage, idx) => {
            const isCompleted = idx < currentIndex;
            const isCurrent = idx === currentIndex;
            // idx > currentIndex indicates future stage

            return (
              <div key={stage} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-full h-1.5 rounded-full transition-colors ${
                      isCompleted ? 'bg-emerald-400' : isCurrent ? 'bg-green-400' : 'bg-slate-200'
                    }`}
                  />
                  <span className={`text-[10px] mt-1 font-medium whitespace-nowrap ${
                    isCompleted ? 'text-emerald-600' : isCurrent ? 'text-green-600' : 'text-slate-400'
                  }`}>
                    {stageLabels[idx]}
                  </span>
                </div>
                {idx < STATUS_STAGES.length - 1 && (
                  <FiArrowRight className={`w-3 h-3 flex-shrink-0 mx-0.5 ${
                    isCompleted ? 'text-emerald-400' : 'text-slate-300'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // --- Transaction Summary (grouped by component) ---
  const renderTransactionSummary = (lines: PayrollTransactionLine[], currencyCode: string) => {
    if (!lines || lines.length === 0) {
      return <p className="text-sm text-thb-text-muted text-center py-6">No transaction lines. Run &quot;Calculate&quot; to generate.</p>;
    }

    // Group by componentType and componentCode
    const grouped: Record<string, { code: string; type: string; total: number; count: number }> = {};
    for (const line of lines) {
      const key = `${line.componentType}_${line.componentCode}`;
      if (!grouped[key]) {
        grouped[key] = { code: line.componentCode, type: line.componentType, total: 0, count: 0 };
      }
      grouped[key].total += line.finalAmount;
      grouped[key].count++;
    }

    const earnings = Object.values(grouped).filter(g => g.type === 'EARNING');
    const deductions = Object.values(grouped).filter(g => g.type === 'DEDUCTION');
    const employerContrib = Object.values(grouped).filter(g => g.type === 'EMPLOYER_CONTRIB');

    const renderGroup = (title: string, items: { code: string; type: string; total: number; count: number }[], colorClass: string) => {
      if (items.length === 0) return null;
      return (
        <div className="mb-3">
          <h4 className={`text-xs font-semibold ${colorClass} mb-1.5`}>{title}</h4>
          <div className="space-y-1">
            {items.sort((a, b) => b.total - a.total).map(item => (
              <div key={item.code} className="flex items-center justify-between text-sm">
                <span className="text-thb-text-secondary">{item.code.replace(/_/g, ' ')}</span>
                <span className="font-medium text-thb-text-primary">{formatCurrency(item.total, currencyCode)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    };

    return (
      <div>
        {renderGroup('Earnings', earnings, 'text-emerald-600')}
        {renderGroup('Deductions', deductions, 'text-red-600')}
        {renderGroup('Employer Contributions', employerContrib, 'text-green-600')}
      </div>
    );
  };

  // --- Employee-wise Summary ---
  const renderEmployeeSummary = (lines: PayrollTransactionLine[], currencyCode: string) => {
    if (!lines || lines.length === 0) return null;

    const employeeMap: Record<string, { gross: number; deductions: number; employer: number; net: number }> = {};
    for (const line of lines) {
      if (!employeeMap[line.employeeId]) {
        employeeMap[line.employeeId] = { gross: 0, deductions: 0, employer: 0, net: 0 };
      }
      if (line.componentType === 'EARNING') employeeMap[line.employeeId].gross += line.finalAmount;
      if (line.componentType === 'DEDUCTION') employeeMap[line.employeeId].deductions += line.finalAmount;
      if (line.componentType === 'EMPLOYER_CONTRIB') employeeMap[line.employeeId].employer += line.finalAmount;
    }

    for (const emp of Object.values(employeeMap)) {
      emp.net = emp.gross - emp.deductions;
    }

    const sortedEmployees = Object.entries(employeeMap).sort((a, b) => b[1].net - a[1].net);

    return (
      <div className="overflow-x-auto max-h-64 overflow-y-auto">
        <table className="w-full min-w-[400px]">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-thb-border bg-slate-50">
              <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Employee ID</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Gross Pay</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Deductions</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Net Pay</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Employer Contrib</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-thb-border/50">
            {sortedEmployees.map(([empId, data]) => (
              <tr key={empId} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-3 py-2 text-sm font-medium text-thb-text-primary">{empId.substring(0, 8)}...</td>
                <td className="px-3 py-2 text-sm text-right text-thb-text-primary">{formatCurrency(data.gross, currencyCode)}</td>
                <td className="px-3 py-2 text-sm text-right text-red-600">{formatCurrency(data.deductions, currencyCode)}</td>
                <td className="px-3 py-2 text-sm text-right font-medium text-thb-text-primary">{formatCurrency(data.net, currencyCode)}</td>
                <td className="px-3 py-2 text-sm text-right text-thb-text-secondary">{formatCurrency(data.employer, currencyCode)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiPlayCircle className="w-6 h-6 text-emerald-500" />
            Payroll Processing
          </h1>
          <p className="text-thb-text-secondary mt-1">Manage payroll run lifecycle — from creation through disbursement</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchData()}
            className="p-2.5 rounded-lg border border-thb-border text-thb-text-secondary hover:bg-slate-50 transition-colors"
            title="Refresh"
          >
            <FiRefreshCw className="w-4 h-4" />
          </button>
          {isAdmin && (
            <button
              onClick={handleAddNew}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors"
            >
              <FiPlus className="w-4 h-4" /> Create Payroll Run
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <FiActivity className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Total Runs</p>
              <p className="text-xl font-bold text-thb-text-primary">{totalRuns}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <FiClock className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">In Progress</p>
              <p className="text-xl font-bold text-thb-text-primary">{inProgressCount}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <FiCheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Approved</p>
              <p className="text-xl font-bold text-thb-text-primary">{approvedCount}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <FiDollarSign className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Disbursed / Closed</p>
              <p className="text-xl font-bold text-thb-text-primary">{disbursedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="thb-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
            <input
              type="text"
              placeholder="Search by period, run type, status, entity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(sanitizeSearch(e.target.value))}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
            />
          </div>
          <input
            type="month"
            value={payrollPeriodFilter}
            onChange={(e) => setPayrollPeriodFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[160px]"
            placeholder="Payroll Period"
          />
          <select
            value={runStatusFilter}
            onChange={(e) => setRunStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[160px]"
          >
            <option value="">All Statuses</option>
            {RUN_STATUS_FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[160px]"
          >
            <option value="">All Companies</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{c.code ? ` (${c.code})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div id="crud-form" className="thb-card border-l-4 border-l-green-500">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">
                {editingId ? 'Edit Payroll Run' : 'Create Payroll Run'}
              </h2>
              <button
                onClick={handleCancelForm}
                className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Basic Information */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Basic Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Legal Entity ID <span className="text-red-500 font-bold">*</span></label>
                  <input
                    required
                    value={form.legalEntityId}
                    onChange={(e) => setForm({ ...form, legalEntityId: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                    placeholder="e.g. LE-001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Payroll Period <span className="text-red-500 font-bold">*</span></label>
                  <input
                    required
                    type="month"
                    value={form.payrollPeriod}
                    onChange={(e) => {
                      const period = e.target.value; // e.g. "2026-06"
                      setForm({
                        ...form,
                        payrollPeriod: period,
                        ...(period ? {
                          periodStartDate: `${period}-01`,
                          periodEndDate: new Date(parseInt(period.split('-')[0]), parseInt(period.split('-')[1]), 0).toISOString().split('T')[0],
                          payDate: new Date(parseInt(period.split('-')[0]), parseInt(period.split('-')[1]) + 1, 1).toISOString().split('T')[0],
                        } : {}),
                      });
                    }}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Run Type</label>
                  <select
                    value={form.runType}
                    onChange={(e) => setForm({ ...form, runType: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    {RUN_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Date Configuration */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Date Configuration</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Period Start Date <span className="text-red-500 font-bold">*</span></label>
                  <input
                    type="date"
                    required
                    value={form.periodStartDate}
                    onChange={(e) => setForm({ ...form, periodStartDate: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Period End Date <span className="text-red-500 font-bold">*</span></label>
                  <input
                    type="date"
                    required
                    value={form.periodEndDate}
                    onChange={(e) => setForm({ ...form, periodEndDate: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Pay Date <span className="text-red-500 font-bold">*</span></label>
                  <input
                    type="date"
                    required
                    value={form.payDate}
                    onChange={(e) => setForm({ ...form, payDate: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  />
                </div>
              </div>
            </div>

            {/* Processing Configuration */}
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Processing Configuration</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Currency</label>
                  <select
                    value={form.currencyCode}
                    onChange={(e) => setForm({ ...form, currencyCode: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    {CURRENCY_CODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Tax Projection Method</label>
                  <select
                    value={form.taxProjectionMethod}
                    onChange={(e) => setForm({ ...form, taxProjectionMethod: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    {TAX_METHOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Processing Mode</label>
                  <select
                    value={form.processingMode}
                    onChange={(e) => setForm({ ...form, processingMode: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    {PROCESSING_MODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm text-thb-text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.includeStatutory}
                      onChange={(e) => setForm({ ...form, includeStatutory: e.target.checked })}
                      className="rounded border-thb-border"
                    />
                    <span className="font-medium">Include Statutory</span>
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-thb-text-secondary mb-1">Company</label>
                  <select
                    value={form.companyId}
                    onChange={(e) => setForm({ ...form, companyId: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                  >
                    <option value="">Select Company (optional)</option>
                    {(availableCompanies.length > 0 ? availableCompanies : companies).map(c => (
                      <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-thb-border">
              <button
                onClick={handleCancelForm}
                className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 shadow-sm shadow-green-500/25 transition-colors"
              >
                {submitting ? 'Saving...' : editingId ? 'Update Run' : 'Create Run'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payroll Run Cards */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="thb-card p-6">
              <div className="animate-pulse space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-6 bg-slate-100 rounded w-48" />
                  <div className="h-6 bg-slate-100 rounded w-24" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div key={j} className="h-16 bg-slate-100 rounded" />
                  ))}
                </div>
                <div className="h-8 bg-slate-100 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredRuns.length === 0 ? (
        <div className="thb-card p-12 text-center">
          <FiPlayCircle className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary font-medium">No payroll runs found</p>
          <p className="text-sm text-thb-text-muted mt-1">Create your first payroll run to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRuns.map((run) => (
            <div key={run.id} className="thb-card overflow-hidden">
              {/* Delete Confirmation */}
              {deleteConfirmId === run.id ? (
                <div className="p-6 bg-red-50">
                  <p className="text-sm text-red-700 font-medium mb-3">
                    Are you sure you want to delete this payroll run ({run.payrollPeriod} - {formatRunType(run.runType)})?
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(run.id)}
                      disabled={deleting}
                      className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {deleting ? 'Deleting...' : 'Delete'}
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-4 py-2 border border-thb-border text-sm font-medium rounded-lg text-thb-text-secondary hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Card Header */}
                  <div className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          run.runStatus === 'CLOSED' ? 'bg-slate-100' :
                          ['APPROVED', 'ACCOUNTING', 'DISBURSED'].includes(run.runStatus) ? 'bg-emerald-50' :
                          run.runStatus === 'PROCESSING' ? 'bg-amber-50' :
                          run.runStatus === 'REVIEW' ? 'bg-sky-50' :
                          'bg-green-50'
                        }`}>
                          <FiPlayCircle className={`w-5 h-5 ${
                            run.runStatus === 'CLOSED' ? 'text-slate-400' :
                            ['APPROVED', 'ACCOUNTING', 'DISBURSED'].includes(run.runStatus) ? 'text-emerald-500' :
                            run.runStatus === 'PROCESSING' ? 'text-amber-500' :
                            run.runStatus === 'REVIEW' ? 'text-sky-500' :
                            'text-green-500'
                          }`} />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-thb-text-primary">
                            {run.payrollPeriod} &middot; {formatRunType(run.runType)}
                          </h3>
                          <p className="text-xs text-thb-text-secondary mt-0.5">
                            Entity: {run.legalEntityId} &middot; Pay Date: {formatDate(run.payDate)} &middot; {run.currencyCode}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusBadge(run.runStatus)}`}>
                          {formatStatus(run.runStatus)}
                        </span>
                        <span className={getRunTypeBadge(run.runType)}>
                          {formatRunType(run.runType)}
                        </span>
                      </div>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-[10px] font-medium text-thb-text-muted uppercase">Employees</p>
                        <p className="text-lg font-bold text-thb-text-primary">{run.totalEmployees}</p>
                      </div>
                      <div className="bg-emerald-50 rounded-lg p-3">
                        <p className="text-[10px] font-medium text-emerald-600 uppercase">Gross Pay</p>
                        <p className="text-lg font-bold text-emerald-700">{formatCurrency(run.totalGrossPay, run.currencyCode)}</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-3">
                        <p className="text-[10px] font-medium text-red-600 uppercase">Deductions</p>
                        <p className="text-lg font-bold text-red-700">{formatCurrency(run.totalDeductions, run.currencyCode)}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3">
                        <p className="text-[10px] font-medium text-green-600 uppercase">Net Pay</p>
                        <p className="text-lg font-bold text-green-700">{formatCurrency(run.totalNetPay, run.currencyCode)}</p>
                      </div>
                      <div className="bg-teal-50 rounded-lg p-3">
                        <p className="text-[10px] font-medium text-teal-600 uppercase">Employer Contrib</p>
                        <p className="text-lg font-bold text-teal-700">{formatCurrency(run.totalEmployerContrib, run.currencyCode)}</p>
                      </div>
                    </div>

                    {/* Progress Indicator */}
                    {renderProgressBar(run.runStatus)}

                    {/* Action Buttons & View Details */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t border-thb-border">
                      {getActionButtons(run)}
                      <button
                        onClick={() => handleViewDetails(run)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-thb-border text-thb-text-secondary text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <FiEye className="w-3.5 h-3.5" />
                        {expandedRunId === run.id ? 'Hide Details' : 'View Details'}
                        {expandedRunId === run.id ? <FiChevronUp className="w-3.5 h-3.5" /> : <FiChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {expandedRunId === run.id && (
                    <div className="border-t border-thb-border bg-slate-50/50">
                      {expandLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500" />
                          <span className="ml-3 text-sm text-thb-text-secondary">Loading details...</span>
                        </div>
                      ) : expandedRunData ? (
                        <div className="p-6">
                          {/* Run Configuration */}
                          <div className="mb-6">
                            <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Run Configuration</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                              <DetailItem label="Legal Entity" value={expandedRunData.legalEntityId} />
                              <DetailItem label="Payroll Period" value={expandedRunData.payrollPeriod} />
                              <DetailItem label="Period Start" value={formatDate(expandedRunData.periodStartDate)} />
                              <DetailItem label="Period End" value={formatDate(expandedRunData.periodEndDate)} />
                              <DetailItem label="Pay Date" value={formatDate(expandedRunData.payDate)} />
                              <DetailItem label="Run Type" value={formatRunType(expandedRunData.runType)} badge={getRunTypeBadge(expandedRunData.runType)} />
                              <DetailItem label="Status" value={formatStatus(expandedRunData.runStatus)} badge={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border ${getStatusBadge(expandedRunData.runStatus)}`} />
                              <DetailItem label="Currency" value={expandedRunData.currencyCode} />
                              <DetailItem label="Tax Projection" value={formatStatus(expandedRunData.taxProjectionMethod)} />
                              <DetailItem label="Include Statutory" value={expandedRunData.includeStatutory} />
                              <DetailItem label="Processing Mode" value={expandedRunData.processingMode} />
                              <DetailItem label="Company ID" value={expandedRunData.companyId} />
                            </div>
                          </div>

                          {/* Transaction Summary */}
                          <div className="mb-6">
                            <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Transaction Summary</h3>
                            <div className="thb-card p-4">
                              {renderTransactionSummary(expandedRunData.transactionLines || [], expandedRunData.currencyCode)}
                            </div>
                          </div>

                          {/* Employee-wise Summary */}
                          <div>
                            <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Employee-wise Net Pay Summary</h3>
                            <div className="thb-card overflow-hidden">
                              {renderEmployeeSummary(expandedRunData.transactionLines || [], expandedRunData.currencyCode) || (
                                <p className="text-sm text-thb-text-muted text-center py-6">No transaction lines available</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
