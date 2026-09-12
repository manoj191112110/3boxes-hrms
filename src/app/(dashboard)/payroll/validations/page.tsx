'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiShield, FiCheckCircle, FiXCircle, FiAlertTriangle, FiUsers,
  FiRefreshCw, FiSearch, FiChevronDown, FiChevronUp,
  FiUserX, FiUserPlus, FiLogOut, FiPlay,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// --- Types ---
interface ValidationEmployee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  department?: string;
  designation?: string;
  holdType?: string;
  holdReason?: string;
  holdFromPeriod?: string;
  dateOfJoining?: string;
  status?: string;
  separationType?: string;
  lastWorkingDate?: string;
}

interface ValidationError {
  type: string;
  message: string;
  employeeIds?: string[];
}

interface ValidationWarning {
  type: string;
  message: string;
  employeeIds?: string[];
}

interface ValidationRecord {
  id: string;
  payrollRunId: string | null;
  companyId: string | null;
  validationType: string;
  status: string;
  totalEmployees: number;
  validEmployees: number;
  invalidEmployees: number;
  runBy: string | null;
  createdAt: string;
  // Parsed fields
  missingPaymentMethods?: ValidationEmployee[];
  missingSalaryBasis?: ValidationEmployee[];
  heldEmployees?: ValidationEmployee[];
  newJoiners?: ValidationEmployee[];
  terminations?: ValidationEmployee[];
  errors?: ValidationError[];
  warnings?: ValidationWarning[];
}

interface Company {
  id: string;
  name: string;
  code: string | null;
}

// --- Badge Helpers ---
function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    completed: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    failed: 'bg-red-100 text-red-700 border border-red-200',
    pending: 'bg-amber-100 text-amber-700 border border-amber-200',
  };
  return map[status] || 'bg-gray-100 text-gray-700 border border-gray-200';
}

// --- Validation Category Card ---
function CategoryCard({
  title,
  icon: Icon,
  iconColor,
  iconBg,
  count,
  employees,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  count: number;
  employees: ValidationEmployee[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="thb-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-thb-text-primary">{title}</h3>
            <p className="text-xs text-thb-text-muted">{count} employee(s)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
            count > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
          }`}>
            {count}
          </span>
          {open ? <FiChevronUp className="w-4 h-4 text-thb-text-muted" /> : <FiChevronDown className="w-4 h-4 text-thb-text-muted" />}
        </div>
      </button>
      {open && employees.length > 0 && (
        <div className="border-t border-thb-border">
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full min-w-[500px]">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-thb-border bg-slate-50">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Emp Code</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Name</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Department</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Designation</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-thb-text-secondary uppercase">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-thb-border/50">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-3 py-2 text-sm font-medium text-thb-text-primary">{emp.employeeId}</td>
                    <td className="px-3 py-2 text-sm text-thb-text-primary">{emp.firstName} {emp.lastName}</td>
                    <td className="px-3 py-2 text-sm text-thb-text-secondary">{emp.department || '—'}</td>
                    <td className="px-3 py-2 text-sm text-thb-text-secondary">{emp.designation || '—'}</td>
                    <td className="px-3 py-2 text-sm text-thb-text-muted">
                      {emp.holdReason || emp.separationType || emp.dateOfJoining ? new Date(emp.dateOfJoining as string).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PayrollValidationsPage() {
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId());
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);
  const availableCompanies = useCompanyContextStore(s => s.availableCompanies);
  const [validations, setValidations] = useState<ValidationRecord[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  // Sync selected company with global company switcher on hydration
  useEffect(() => {
    if (effectiveCompanyId) setSelectedCompanyId(prev => prev || effectiveCompanyId);
  }, [effectiveCompanyId, scopeQuery, selectedTenantId]);
  const [selectedValidation, setSelectedValidation] = useState<ValidationRecord | null>(null);
  const [, setLoadingDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Fetch validations
  const fetchValidations = useCallback(async () => {
    try {
      setLoading(true);
      const cid = selectedCompanyId || effectiveCompanyId;
      const params = new URLSearchParams();
      if (cid) params.set('companyId', cid);
      const sq = scopeQuery();
      const qs = params.toString();
      const res = await fetch(`/api/payroll/validations${qs ? `?${qs}${sq ? `&${sq}` : ''}` : (sq ? `?${sq}` : '')}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setValidations(Array.isArray(data) ? data : data.data || []);
      }
    } catch {
      toast.error('Failed to load validations');
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId, effectiveCompanyId, scopeQuery, selectedTenantId]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchValidations();
      fetchCompanies();
    });
  }, [fetchValidations, fetchCompanies]);

  // Run validation
  const handleRunValidation = async () => {
    if (!selectedCompanyId && !effectiveCompanyId) {
      toast.error('Please select a company first');
      return;
    }
    setRunning(true);
    try {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

      const res = await fetch('/api/payroll/validations', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          companyId: selectedCompanyId || effectiveCompanyId,
          periodStart,
          periodEnd,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Validation failed');
      }
      const data = await res.json();
      toast.success(`Validation complete: ${data.summary.totalEmployees} employees, ${data.summary.invalidEmployees} issues found`);
      fetchValidations();

      // Auto-select the new validation
      if (data.data) {
        setSelectedValidation({
          ...data.data,
          missingPaymentMethods: JSON.parse(data.data.missingPaymentMethods || '[]'),
          missingSalaryBasis: JSON.parse(data.data.missingSalaryBasis || '[]'),
          heldEmployees: JSON.parse(data.data.heldEmployees || '[]'),
          newJoiners: JSON.parse(data.data.newJoiners || '[]'),
          terminations: JSON.parse(data.data.terminations || '[]'),
          errors: JSON.parse(data.data.errors || '[]'),
          warnings: JSON.parse(data.data.warnings || '[]'),
        });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setRunning(false);
    }
  };

  // View validation detail
  const handleViewDetail = async (validation: ValidationRecord) => {
    if (selectedValidation?.id === validation.id) {
      setSelectedValidation(null);
      return;
    }
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/payroll/validations/${validation.id}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSelectedValidation(data.data);
      } else {
        setSelectedValidation(validation);
      }
    } catch {
      setSelectedValidation(validation);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Filter validations
  const filteredValidations = validations.filter(v => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (v.companyId || '').toLowerCase().includes(q) ||
        v.validationType.toLowerCase().includes(q) ||
        v.status.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiShield className="w-6 h-6 text-emerald-500" />
            Pre-Payroll Validation
          </h1>
          <p className="text-thb-text-secondary mt-1">Validate employee data before processing payroll runs</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchValidations()}
            className="p-2.5 rounded-lg border border-thb-border text-thb-text-secondary hover:bg-slate-50 transition-colors"
            title="Refresh"
          >
            <FiRefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Run Validation Form */}
      <div className="thb-card p-4 border-l-4 border-l-emerald-500">
        <h3 className="text-sm font-semibold text-thb-text-primary mb-3">Run Pre-Payroll Validation</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="flex-1 px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
          >
            <option value="">Select Company</option>
            {(availableCompanies.length > 0 ? availableCompanies : companies).map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>
            ))}
          </select>
          <button
            onClick={handleRunValidation}
            disabled={running || !selectedCompanyId}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 font-medium text-sm shadow-sm shadow-emerald-500/25 transition-colors whitespace-nowrap"
          >
            {running ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <FiPlay className="w-4 h-4" />}
            {running ? 'Running...' : 'Run Validation'}
          </button>
        </div>
      </div>

      {/* Selected Validation Detail */}
      {selectedValidation && (
        <div className="space-y-4">
          {/* Validation Summary */}
          <div className="thb-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-thb-text-primary">Validation Results</h2>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusBadge(selectedValidation.status)}`}>
                {selectedValidation.status.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div className="p-3 bg-slate-50 rounded-lg text-center">
                <p className="text-xs font-medium text-thb-text-secondary">Total Employees</p>
                <p className="text-xl font-bold text-thb-text-primary">{selectedValidation.totalEmployees}</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg text-center">
                <p className="text-xs font-medium text-emerald-700">Valid</p>
                <p className="text-xl font-bold text-emerald-700">{selectedValidation.validEmployees}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg text-center">
                <p className="text-xs font-medium text-red-700">Invalid</p>
                <p className="text-xl font-bold text-red-700">{selectedValidation.invalidEmployees}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <p className="text-xs font-medium text-green-700">Pass Rate</p>
                <p className="text-xl font-bold text-green-700">
                  {selectedValidation.totalEmployees > 0
                    ? Math.round((selectedValidation.validEmployees / selectedValidation.totalEmployees) * 100)
                    : 0}%
                </p>
              </div>
            </div>

            {/* Errors & Warnings */}
            {selectedValidation.errors && selectedValidation.errors.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">Errors</h4>
                <div className="space-y-2">
                  {selectedValidation.errors.map((err, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2.5 bg-red-50 rounded-lg border border-red-100">
                      <FiXCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-700">{err.type.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-red-600">{err.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedValidation.warnings && selectedValidation.warnings.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">Warnings</h4>
                <div className="space-y-2">
                  {selectedValidation.warnings.map((warn, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                      <FiAlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-700">{warn.type.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-amber-600">{warn.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Category Cards */}
          <div className="grid grid-cols-1 gap-3">
            <CategoryCard
              title="Missing Payment Methods"
              icon={FiUserX}
              iconColor="text-red-500"
              iconBg="bg-red-50"
              count={selectedValidation.missingPaymentMethods?.length || 0}
              employees={selectedValidation.missingPaymentMethods || []}
            />
            <CategoryCard
              title="Missing Salary Basis"
              icon={FiUserX}
              iconColor="text-orange-500"
              iconBg="bg-orange-50"
              count={selectedValidation.missingSalaryBasis?.length || 0}
              employees={selectedValidation.missingSalaryBasis || []}
            />
            <CategoryCard
              title="Active Payroll Holds"
              icon={FiAlertTriangle}
              iconColor="text-amber-500"
              iconBg="bg-amber-50"
              count={selectedValidation.heldEmployees?.length || 0}
              employees={selectedValidation.heldEmployees || []}
              defaultOpen={true}
            />
            <CategoryCard
              title="New Joiners This Period"
              icon={FiUserPlus}
              iconColor="text-green-500"
              iconBg="bg-green-50"
              count={selectedValidation.newJoiners?.length || 0}
              employees={selectedValidation.newJoiners || []}
            />
            <CategoryCard
              title="Terminations This Period"
              icon={FiLogOut}
              iconColor="text-teal-500"
              iconBg="bg-teal-50"
              count={selectedValidation.terminations?.length || 0}
              employees={selectedValidation.terminations || []}
            />
          </div>
        </div>
      )}

      {/* Search */}
      <div className="thb-card p-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
          <input
            type="text"
            placeholder="Search validation history..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
          />
        </div>
      </div>

      {/* Validation History */}
      {loading ? (
        <div className="thb-card p-12 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-thb-text-secondary">Loading validation history...</p>
        </div>
      ) : filteredValidations.length === 0 ? (
        <div className="thb-card p-12 text-center">
          <FiShield className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary font-medium">No validations found</p>
          <p className="text-sm text-thb-text-muted mt-1">Run a pre-payroll validation to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-thb-text-secondary uppercase tracking-wider">Validation History</h3>
          {filteredValidations.map((v) => (
            <button
              key={v.id}
              onClick={() => handleViewDetail(v)}
              className={`w-full thb-card p-4 text-left transition-colors hover:shadow-md ${
                selectedValidation?.id === v.id ? 'ring-2 ring-emerald-500/30 border-emerald-200' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    v.status === 'completed' ? 'bg-emerald-50' : v.status === 'failed' ? 'bg-red-50' : 'bg-amber-50'
                  }`}>
                    {v.status === 'completed' ? (
                      <FiCheckCircle className="w-5 h-5 text-emerald-500" />
                    ) : v.status === 'failed' ? (
                      <FiXCircle className="w-5 h-5 text-red-500" />
                    ) : (
                      <FiUsers className="w-5 h-5 text-amber-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-thb-text-primary">
                      {v.validationType.replace(/_/g, ' ')} Validation
                    </p>
                    <p className="text-xs text-thb-text-muted">
                      {new Date(v.createdAt).toLocaleString()} &middot; Company: {v.companyId || '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium text-thb-text-primary">{v.validEmployees}/{v.totalEmployees}</p>
                    <p className="text-xs text-thb-text-muted">Valid</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getStatusBadge(v.status)}`}>
                    {v.status}
                  </span>
                  {selectedValidation?.id === v.id ? (
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
