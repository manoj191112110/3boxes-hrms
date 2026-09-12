'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiX, FiSearch, FiRefreshCw, FiFileText, FiList,
  FiUser, FiDollarSign, FiPrinter, FiDownload,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface EmployeeOption {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface PayslipRecord {
  id: string;
  employeeId: string;
  month: number;
  year: number;
  basicSalary: number;
  hra: number;
  da: number;
  conveyance: number;
  medical: number;
  otherAllowances: number;
  grossSalary: number;
  pf: number;
  esi: number;
  tax: number;
  professionalTax: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  currency: string;
  status: string;
  paidDate: string | null;
  paySlip: string | null;
  createdAt: string;
  employee?: {
    employeeId: string;
    firstName: string;
    lastName: string;
    email: string;
    department?: { name: string };
    designation?: { title: string };
  };
}

interface PayslipDetail {
  payrollId: string;
  payslipNo: string;
  period: { month: number; year: number; monthName: string };
  company: { name: string; address: string; phone: string; email: string };
  employee: {
    employeeId: string;
    name: string;
    email: string;
    phone?: string;
    department?: string;
    designation?: string;
    dateOfJoining: string;
    panNumber?: string;
    aadhaarNumber?: string;
    bankName?: string;
    bankAccountNo?: string;
    bankIfscCode?: string;
  };
  earnings: {
    basicSalary: number;
    hra: number;
    da: number;
    conveyance: number;
    medical: number;
    otherAllowances: number;
    grossSalary: number;
  };
  deductions: {
    pf: number;
    esi: number;
    tax: number;
    professionalTax: number;
    otherDeductions: number;
    totalDeductions: number;
  };
  netPay: number;
  currency: string;
  status: string;
  paidDate: string | null;
}

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const MONTH_OPTIONS = monthNames.map((name, i) => ({ value: String(i + 1), label: name }));
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => {
  const y = new Date().getFullYear() - i;
  return { value: String(y), label: String(y) };
});

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    paid: 'thb-badge thb-badge-success',
    processed: 'thb-badge thb-badge-info',
    draft: 'thb-badge thb-badge-warning',
    cancelled: 'thb-badge thb-badge-error',
  };
  return map[status] || 'thb-badge thb-badge-info';
}

export default function PayslipsPage() {
  useAuthStore();
  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);
  const [records, setRecords] = useState<PayslipRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');

  const [selectedPayslip, setSelectedPayslip] = useState<PayslipDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch(`/api/employees?${scopeQuery}limit=200`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = data.employees || data.data || [];
        setEmployees(list.map((e: Record<string, unknown>) => ({
          id: e.id as string,
          employeeId: e.employeeId as string,
          firstName: e.firstName as string,
          lastName: e.lastName as string,
          email: e.email as string,
        })));
      }
    } catch { /* silently fail */ }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (monthFilter) params.set('month', monthFilter);
      if (yearFilter) params.set('year', yearFilter);
      if (employeeFilter) params.set('employeeId', employeeFilter);
      const qs = params.toString();
      const url = `/api/payroll/payslips?${scopeQuery}${qs}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setRecords(Array.isArray(data) ? data : data.data || []);
      }
    } catch {
      toast.error('Failed to load payslips');
    } finally {
      setLoading(false);
    }
  }, [monthFilter, yearFilter, employeeFilter]);
  const cid = effectiveCompanyId();
  const scopeQuery = cid ? `companyId=${cid}&` : '';


  useEffect(() => {
    queueMicrotask(() => {
      fetchData();
      fetchEmployees();
    });
  }, [fetchData, fetchEmployees]);

  const totalCount = records.length;
  const totalNetSalary = records.reduce((sum, r) => sum + r.netSalary, 0);
  const totalGrossSalary = records.reduce((sum, r) => sum + r.grossSalary, 0);

  const filteredRecords = records.filter(r => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const emp = employees.find(e => e.employeeId === r.employeeId);
      const empName = emp ? `${emp.firstName} ${emp.lastName}`.toLowerCase() : '';
      if (!r.employeeId.toLowerCase().includes(q) && !empName.includes(q)) return false;
    }
    return true;
  });

  const getEmployeeDisplay = (empId: string) => {
    const emp = employees.find(e => e.employeeId === empId || e.id === empId);
    if (emp) return `${emp.firstName} ${emp.lastName}`;
    return empId;
  };

  const formatCurrency = (val: number, curr: string = 'INR') => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: curr, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(val);
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : '—';

  const handleViewPayslip = async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/payroll/payslips/${id}?${scopeQuery}` , { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSelectedPayslip(data.data);
      } else {
        toast.error('Failed to load payslip details');
      }
    } catch {
      toast.error('Failed to load payslip details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleGeneratePayslip = async (payrollId: string) => {
    try {
      const res = await fetch(`/api/payroll/payslips?${scopeQuery}` , {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ payrollId }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedPayslip(data.data);
        toast.success('Payslip generated successfully');
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed to generate payslip');
      }
    } catch {
      toast.error('Failed to generate payslip');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2">
            <FiFileText className="w-6 h-6 text-emerald-500" />
            Payslips
          </h1>
          <p className="text-thb-text-secondary mt-1">View and generate employee payslips</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchData()} className="p-2.5 rounded-lg border border-thb-border text-thb-text-secondary hover:bg-slate-50 transition-colors" title="Refresh">
            <FiRefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <FiList className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Total Payslips</p>
              <p className="text-xl font-bold text-thb-text-primary">{totalCount}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <FiDollarSign className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Total Gross</p>
              <p className="text-lg font-bold text-thb-text-primary">{formatCurrency(totalGrossSalary)}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <FiDollarSign className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Total Net Pay</p>
              <p className="text-lg font-bold text-thb-text-primary">{formatCurrency(totalNetSalary)}</p>
            </div>
          </div>
        </div>
        <div className="thb-card thb-card-hover p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
              <FiFileText className="w-5 h-5 text-teal-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-thb-text-secondary">Generated</p>
              <p className="text-xl font-bold text-thb-text-primary">{records.filter(r => r.paySlip).length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="thb-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thb-text-muted" />
            <input type="text" placeholder="Search by employee..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
          </div>
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[150px]">
            <option value="">All Months</option>
            {MONTH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[120px]">
            <option value="">All Years</option>
            {YEAR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 min-w-[160px]">
            <option value="">All Employees</option>
            {employees.map(e => (
              <option key={e.id} value={e.employeeId}>{e.firstName} {e.lastName} ({e.employeeId})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Payslip Detail View */}
      {selectedPayslip && (
        <div id="payslip-detail" className="thb-card print:shadow-none print:border-0">
          <div className="p-6 print:p-0">
            {/* Header with close button (hidden in print) */}
            <div className="flex items-center justify-between mb-6 print:hidden">
              <h2 className="text-lg font-semibold text-thb-text-primary">Payslip Detail</h2>
              <div className="flex items-center gap-2">
                <button onClick={handlePrint} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-thb-border text-sm text-thb-text-secondary hover:bg-slate-50 transition-colors">
                  <FiPrinter className="w-4 h-4" /> Print
                </button>
                <button onClick={() => setSelectedPayslip(null)} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors">
                  <FiX className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Company Header */}
            <div className="text-center border-b border-thb-border pb-4 mb-6">
              <h1 className="text-2xl font-bold text-thb-text-primary">{selectedPayslip.company.name}</h1>
              <p className="text-sm text-thb-text-secondary">{selectedPayslip.company.address}</p>
              <p className="text-sm text-thb-text-secondary">{selectedPayslip.company.phone} | {selectedPayslip.company.email}</p>
              <h2 className="text-lg font-semibold text-thb-text-primary mt-3">
                PAY SLIP — {selectedPayslip.period.monthName} {selectedPayslip.period.year}
              </h2>
              <p className="text-xs text-thb-text-muted">Payslip No: {selectedPayslip.payslipNo}</p>
            </div>

            {/* Employee Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 mb-6 text-sm">
              <div className="flex justify-between py-1.5 border-b border-slate-100"><span className="text-thb-text-secondary">Employee Name</span><span className="font-medium text-thb-text-primary">{selectedPayslip.employee.name}</span></div>
              <div className="flex justify-between py-1.5 border-b border-slate-100"><span className="text-thb-text-secondary">Employee ID</span><span className="font-medium text-thb-text-primary">{selectedPayslip.employee.employeeId}</span></div>
              <div className="flex justify-between py-1.5 border-b border-slate-100"><span className="text-thb-text-secondary">Department</span><span className="font-medium text-thb-text-primary">{selectedPayslip.employee.department || '—'}</span></div>
              <div className="flex justify-between py-1.5 border-b border-slate-100"><span className="text-thb-text-secondary">Designation</span><span className="font-medium text-thb-text-primary">{selectedPayslip.employee.designation || '—'}</span></div>
              <div className="flex justify-between py-1.5 border-b border-slate-100"><span className="text-thb-text-secondary">Date of Joining</span><span className="font-medium text-thb-text-primary">{selectedPayslip.employee.dateOfJoining ? new Date(selectedPayslip.employee.dateOfJoining).toLocaleDateString() : '—'}</span></div>
              <div className="flex justify-between py-1.5 border-b border-slate-100"><span className="text-thb-text-secondary">PAN Number</span><span className="font-medium text-thb-text-primary">{selectedPayslip.employee.panNumber || '—'}</span></div>
              <div className="flex justify-between py-1.5 border-b border-slate-100"><span className="text-thb-text-secondary">Bank Name</span><span className="font-medium text-thb-text-primary">{selectedPayslip.employee.bankName || '—'}</span></div>
              <div className="flex justify-between py-1.5 border-b border-slate-100"><span className="text-thb-text-secondary">Bank Account</span><span className="font-medium text-thb-text-primary">{selectedPayslip.employee.bankAccountNo || '—'}</span></div>
            </div>

            {/* Earnings & Deductions Tables */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              {/* Earnings */}
              <div>
                <h3 className="text-sm font-semibold text-thb-text-primary mb-2 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Earnings
                </h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-thb-border">
                      <th className="text-left py-2 text-thb-text-muted font-medium">Component</th>
                      <th className="text-right py-2 text-thb-text-muted font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Basic Salary', value: selectedPayslip.earnings.basicSalary },
                      { label: 'HRA', value: selectedPayslip.earnings.hra },
                      { label: 'DA', value: selectedPayslip.earnings.da },
                      { label: 'Conveyance', value: selectedPayslip.earnings.conveyance },
                      { label: 'Medical', value: selectedPayslip.earnings.medical },
                      { label: 'Other Allowances', value: selectedPayslip.earnings.otherAllowances },
                    ].map(({ label, value }) => (
                      <tr key={label} className="border-b border-slate-100">
                        <td className="py-2 text-thb-text-secondary">{label}</td>
                        <td className="py-2 text-right font-medium text-thb-text-primary">{formatCurrency(value, selectedPayslip.currency)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-thb-border">
                      <td className="py-2 font-semibold text-emerald-700">Gross Salary</td>
                      <td className="py-2 text-right font-bold text-emerald-700">{formatCurrency(selectedPayslip.earnings.grossSalary, selectedPayslip.currency)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Deductions */}
              <div>
                <h3 className="text-sm font-semibold text-thb-text-primary mb-2 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Deductions
                </h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-thb-border">
                      <th className="text-left py-2 text-thb-text-muted font-medium">Component</th>
                      <th className="text-right py-2 text-thb-text-muted font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Provident Fund', value: selectedPayslip.deductions.pf },
                      { label: 'ESI', value: selectedPayslip.deductions.esi },
                      { label: 'Income Tax', value: selectedPayslip.deductions.tax },
                      { label: 'Professional Tax', value: selectedPayslip.deductions.professionalTax },
                      { label: 'Other Deductions', value: selectedPayslip.deductions.otherDeductions },
                    ].map(({ label, value }) => (
                      <tr key={label} className="border-b border-slate-100">
                        <td className="py-2 text-thb-text-secondary">{label}</td>
                        <td className="py-2 text-right font-medium text-red-600">{formatCurrency(value, selectedPayslip.currency)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-thb-border">
                      <td className="py-2 font-semibold text-red-700">Total Deductions</td>
                      <td className="py-2 text-right font-bold text-red-700">{formatCurrency(selectedPayslip.deductions.totalDeductions, selectedPayslip.currency)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Net Pay */}
            <div className="bg-slate-50 rounded-lg p-4 text-center border border-thb-border">
              <p className="text-sm text-thb-text-secondary mb-1">Net Pay</p>
              <p className="text-3xl font-bold text-emerald-700">{formatCurrency(selectedPayslip.netPay, selectedPayslip.currency)}</p>
              <p className="text-xs text-thb-text-muted mt-1">
                {selectedPayslip.currency} | Paid: {formatDate(selectedPayslip.paidDate)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Data Table */}
      {loading ? (
        <div className="thb-card overflow-hidden">
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="thb-card p-12 text-center">
          <FiFileText className="w-12 h-12 text-thb-text-muted mx-auto mb-3" />
          <p className="text-thb-text-secondary font-medium">No payslips found</p>
          <p className="text-sm text-thb-text-muted mt-1">Payslips will appear once payroll is processed and paid</p>
        </div>
      ) : (
        <div className="thb-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-50 border-b border-thb-border">
                <tr>
                  {['Employee', 'Period', 'Gross Salary', 'Total Deductions', 'Net Salary', 'Status', 'Paid Date', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-thb-text-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <FiUser className="w-3.5 h-3.5 text-slate-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-thb-text-primary truncate max-w-[150px]">{getEmployeeDisplay(item.employeeId)}</p>
                          <p className="text-xs text-thb-text-muted">{item.employeeId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-thb-text-primary">{monthNames[item.month - 1]} {item.year}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-thb-text-primary">{formatCurrency(item.grossSalary, item.currency)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-red-600">{formatCurrency(item.totalDeductions, item.currency)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold text-emerald-700">{formatCurrency(item.netSalary, item.currency)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={getStatusBadge(item.status)}>{item.status.charAt(0).toUpperCase() + item.status.slice(1)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-thb-text-secondary">{formatDate(item.paidDate)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleViewPayslip(item.id)} disabled={loadingDetail}
                          className="p-1.5 rounded-lg text-thb-text-muted hover:text-green-500 hover:bg-green-50 transition-colors disabled:opacity-50" title="View Payslip">
                          <FiSearch className="w-3.5 h-3.5" />
                        </button>
                        {!item.paySlip && (
                          <button onClick={() => handleGeneratePayslip(item.id)}
                            className="p-1.5 rounded-lg text-thb-text-muted hover:text-emerald-500 hover:bg-emerald-50 transition-colors" title="Generate Payslip">
                            <FiDownload className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {item.paySlip && (
                          <button onClick={() => handleViewPayslip(item.id)}
                            className="p-1.5 rounded-lg text-thb-text-muted hover:text-teal-500 hover:bg-teal-50 transition-colors" title="View Generated Payslip">
                            <FiFileText className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
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
