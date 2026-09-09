'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiFile, FiDownload, FiPlus, FiRefreshCw, FiSearch,
  FiCheckCircle, FiXCircle, FiSend, FiChevronDown, FiChevronUp,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// --- Types ---
interface BankPaymentFile {
  id: string;
  payrollRunId: string;
  fileName: string;
  fileFormat: string;
  bankCode: string | null;
  totalAmount: number;
  totalRecords: number;
  fileContent: string | null;
  generatedBy: string | null;
  generatedAt: string;
  status: string;
  companyId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PayrollRun {
  id: string;
  payrollPeriod: string;
  runType: string;
  runStatus: string;
  totalNetPay: number;
  totalEmployees: number;
  companyId: string | null;
  legalEntityId: string;
}

interface Company {
  id: string;
  name: string;
  code: string | null;
}

// --- Badge Helpers ---
function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    generated: 'bg-green-100 text-green-700 border border-green-200',
    submitted: 'bg-amber-100 text-amber-700 border border-amber-200',
    acknowledged: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    rejected: 'bg-red-100 text-red-700 border border-red-200',
  };
  return map[status] || 'bg-gray-100 text-gray-700 border border-gray-200';
}

function getFormatBadge(format: string) {
  const map: Record<string, string> = {
    NACH: 'bg-teal-100 text-teal-700',
    NEFT: 'bg-sky-100 text-sky-700',
    RTGS: 'bg-orange-100 text-orange-700',
    CUSTOM: 'bg-slate-100 text-slate-700',
  };
  return map[format] || 'bg-gray-100 text-gray-700';
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', INR: '₹', GBP: '£', SGD: 'S$', AED: 'د.إ', AUD: 'A$',
};

const formatCurrency = (amount: number, currency = 'INR') => {
  const symbol = CURRENCY_SYMBOLS[currency] || '₹';
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function BankFilesPage() {
  const [bankFiles, setBankFiles] = useState<BankPaymentFile[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<BankPaymentFile | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Generate form state
  const [formPayrollRunId, setFormPayrollRunId] = useState('');
  const [formFileFormat, setFormFileFormat] = useState('NACH');
  const [formBankCode, setFormBankCode] = useState('');
  const [formCompanyId, setFormCompanyId] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formatFilter, setFormatFilter] = useState('');

  // Fetch companies
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

  // Fetch payroll runs
  const fetchPayrollRuns = useCallback(async () => {
    try {
      const res = await fetch('/api/payroll/runs', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setPayrollRuns(Array.isArray(data) ? data : data.data || []);
      }
    } catch {
      // Silently fail
    }
  }, []);

  // Fetch bank files
  const fetchBankFiles = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (formatFilter) params.set('fileFormat', formatFilter);
      const qs = params.toString();
      const res = await fetch(`/api/payroll/bank-files${qs ? `?${qs}` : ''}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBankFiles(Array.isArray(data) ? data : data.data || []);
      }
    } catch {
      toast.error('Failed to load bank files');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, formatFilter]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchBankFiles();
      fetchCompanies();
      fetchPayrollRuns();
    });
  }, [fetchBankFiles, fetchCompanies, fetchPayrollRuns]);

  // Generate bank file
  const handleGenerate = async () => {
    if (!formPayrollRunId) {
      toast.error('Please select a payroll run');
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/payroll/bank-files', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          payrollRunId: formPayrollRunId,
          fileFormat: formFileFormat,
          bankCode: formBankCode || undefined,
          companyId: formCompanyId || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to generate bank file');
      }
      const data = await res.json();
      toast.success(data.message || 'Bank file generated successfully');
      setShowGenerateForm(false);
      setFormPayrollRunId('');
      setFormFileFormat('NACH');
      setFormBankCode('');
      fetchBankFiles();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setGenerating(false);
    }
  };

  // Update status
  const handleStatusUpdate = async (id: string, newStatus: string) => {
    setUpdatingStatus(id);
    try {
      const res = await fetch(`/api/payroll/bank-files/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to update status');
      }
      toast.success(`Bank file status updated to ${newStatus}`);
      fetchBankFiles();
      if (selectedFile?.id === id) {
        const detailRes = await fetch(`/api/payroll/bank-files/${id}`, { headers: getAuthHeaders() });
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          setSelectedFile(detailData.data);
        }
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Download file
  const handleDownload = (file: BankPaymentFile) => {
    if (!file.fileContent) {
      toast.error('No file content available');
      return;
    }
    const blob = new Blob([file.fileContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('File downloaded');
  };

  // View detail
  const handleViewDetail = async (file: BankPaymentFile) => {
    if (selectedFile?.id === file.id) {
      setSelectedFile(null);
      return;
    }
    try {
      const res = await fetch(`/api/payroll/bank-files/${file.id}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSelectedFile(data.data);
      } else {
        setSelectedFile(file);
      }
    } catch {
      setSelectedFile(file);
    }
  };

  // Filter bank files
  const filteredFiles = bankFiles.filter(f => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        f.fileName.toLowerCase().includes(q) ||
        f.fileFormat.toLowerCase().includes(q) ||
        (f.bankCode || '').toLowerCase().includes(q) ||
        f.status.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Compute stats
  const totalFiles = bankFiles.length;
  const _generatedCount = bankFiles.filter(f => f.status === 'generated').length;
  void _generatedCount;
  const submittedCount = bankFiles.filter(f => f.status === 'submitted').length;
  const acknowledgedCount = bankFiles.filter(f => f.status === 'acknowledged').length;
  const totalAmount = bankFiles.reduce((s, f) => s + f.totalAmount, 0);

  // Available payroll runs for generation (excluding ones with existing bank files)
  const availableRuns = payrollRuns.filter(r =>
    ['APPROVED', 'DISBURSED', 'ACCOUNTING'].includes(r.runStatus)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiFile className="w-6 h-6 text-green-500" />
            Bank File Generation
          </h1>
          <p className="text-thb-text-secondary mt-1">Generate and manage bank payment files for salary disbursement</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchBankFiles()}
            className="p-2.5 rounded-lg border border-thb-border text-thb-text-secondary hover:bg-slate-50 transition-colors"
            title="Refresh"
          >
            <FiRefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowGenerateForm(!showGenerateForm)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors"
          >
            <FiPlus className="w-4 h-4" /> Generate Bank File
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <FiFile className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Total Files</p>
              <p className="text-xl font-bold text-thb-text-primary">{totalFiles}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <FiSend className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Submitted</p>
              <p className="text-xl font-bold text-thb-text-primary">{submittedCount}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <FiCheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Acknowledged</p>
              <p className="text-xl font-bold text-thb-text-primary">{acknowledgedCount}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <FiSend className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Total Amount</p>
              <p className="text-lg font-bold text-thb-text-primary">{formatCurrency(totalAmount)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Generate Form */}
      {showGenerateForm && (
        <div className="thb-card p-6 border-l-4 border-l-green-500">
          <h3 className="text-sm font-semibold text-thb-text-primary mb-4">Generate New Bank File</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Payroll Run *</label>
              <select
                value={formPayrollRunId}
                onChange={(e) => setFormPayrollRunId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
              >
                <option value="">Select Payroll Run</option>
                {availableRuns.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.payrollPeriod} — {r.runType} ({r.runStatus}) — {r.totalEmployees} emp
                  </option>
                ))}
                {availableRuns.length === 0 && payrollRuns.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.payrollPeriod} — {r.runType} ({r.runStatus})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">File Format</label>
              <select
                value={formFileFormat}
                onChange={(e) => setFormFileFormat(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
              >
                <option value="NACH">NACH</option>
                <option value="NEFT">NEFT</option>
                <option value="RTGS">RTGS</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Bank Code</label>
              <input
                value={formBankCode}
                onChange={(e) => setFormBankCode(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                placeholder="e.g. HDFC, SBI"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-thb-text-secondary mb-1">Company</label>
              <select
                value={formCompanyId}
                onChange={(e) => setFormCompanyId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
              >
                <option value="">Select Company</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerate}
              disabled={generating || !formPayrollRunId}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium text-sm shadow-sm shadow-green-500/25 transition-colors"
            >
              {generating ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <FiFile className="w-4 h-4" />}
              {generating ? 'Generating...' : 'Generate'}
            </button>
            <button
              onClick={() => setShowGenerateForm(false)}
              className="px-4 py-2.5 border border-thb-border rounded-lg text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="thb-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
            <input
              type="text"
              placeholder="Search by filename, format, status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[140px]"
          >
            <option value="">All Statuses</option>
            <option value="generated">Generated</option>
            <option value="submitted">Submitted</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[120px]"
          >
            <option value="">All Formats</option>
            <option value="NACH">NACH</option>
            <option value="NEFT">NEFT</option>
            <option value="RTGS">RTGS</option>
            <option value="CUSTOM">Custom</option>
          </select>
        </div>
      </div>

      {/* Bank File Detail */}
      {selectedFile && (
        <div className="thb-card p-6 border-l-4 border-l-green-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-thb-text-primary">{selectedFile.fileName}</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownload(selectedFile)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 shadow-sm transition-colors"
              >
                <FiDownload className="w-3.5 h-3.5" /> Download
              </button>
              {selectedFile.status === 'generated' && (
                <button
                  onClick={() => handleStatusUpdate(selectedFile.id, 'submitted')}
                  disabled={updatingStatus === selectedFile.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50 shadow-sm transition-colors"
                >
                  {updatingStatus === selectedFile.id ? <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" /> : <FiSend className="w-3.5 h-3.5" />}
                  Mark Submitted
                </button>
              )}
              {selectedFile.status === 'submitted' && (
                <>
                  <button
                    onClick={() => handleStatusUpdate(selectedFile.id, 'acknowledged')}
                    disabled={updatingStatus === selectedFile.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white text-xs font-medium rounded-lg hover:bg-emerald-600 disabled:opacity-50 shadow-sm transition-colors"
                  >
                    <FiCheckCircle className="w-3.5 h-3.5" /> Acknowledged
                  </button>
                  <button
                    onClick={() => handleStatusUpdate(selectedFile.id, 'rejected')}
                    disabled={updatingStatus === selectedFile.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 shadow-sm transition-colors"
                  >
                    <FiXCircle className="w-3.5 h-3.5" /> Rejected
                  </button>
                </>
              )}
              <button
                onClick={() => setSelectedFile(null)}
                className="p-1.5 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"
              >
                <FiChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Format</p>
              <p className="text-sm font-medium text-thb-text-primary mt-0.5"><span className={`px-2 py-0.5 rounded text-xs ${getFormatBadge(selectedFile.fileFormat)}`}>{selectedFile.fileFormat}</span></p>
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Status</p>
              <p className="text-sm font-medium mt-0.5"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getStatusBadge(selectedFile.status)}`}>{selectedFile.status}</span></p>
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Total Amount</p>
              <p className="text-sm font-semibold text-thb-text-primary mt-0.5">{formatCurrency(selectedFile.totalAmount)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Records</p>
              <p className="text-sm font-semibold text-thb-text-primary mt-0.5">{selectedFile.totalRecords}</p>
            </div>
          </div>

          {selectedFile.fileContent && (
            <div>
              <p className="text-xs font-medium text-thb-text-secondary mb-2">File Content Preview</p>
              <pre className="bg-slate-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto max-h-64 overflow-y-auto font-mono">
                {selectedFile.fileContent.substring(0, 3000)}{selectedFile.fileContent.length > 3000 ? '\n... (truncated)' : ''}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Bank Files List */}
      {loading ? (
        <div className="thb-card p-12 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-thb-text-secondary">Loading bank files...</p>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="thb-card p-12 text-center">
          <FiFile className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary font-medium">No bank files found</p>
          <p className="text-sm text-thb-text-muted mt-1">Generate a bank file from an approved payroll run</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFiles.map((file) => (
            <button
              key={file.id}
              onClick={() => handleViewDetail(file)}
              className={`w-full thb-card p-4 text-left transition-colors hover:shadow-md ${
                selectedFile?.id === file.id ? 'ring-2 ring-green-500/30 border-green-200' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                    <FiFile className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-thb-text-primary">{file.fileName}</p>
                    <p className="text-xs text-thb-text-muted">
                      {new Date(file.createdAt).toLocaleString()} &middot; {file.totalRecords} records
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${getFormatBadge(file.fileFormat)}`}>{file.fileFormat}</span>
                  <span className="text-sm font-semibold text-thb-text-primary">{formatCurrency(file.totalAmount)}</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getStatusBadge(file.status)}`}>{file.status}</span>
                  {selectedFile?.id === file.id ? (
                    <FiChevronUp className="w-4 h-4 text-thb-text-muted" />
                  ) : (
                    <FiChevronDown className="w-4 h-4 text-thb-text-muted" />
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
