'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiCalendar, FiUser, FiSearch, FiPlus, FiRefreshCw,
  FiChevronDown, FiCheck, FiAlertCircle, FiClock,
  FiFileText, FiUsers,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/* ── Types ── */
interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string | null;
  department?: { name: string } | null;
  designation?: { name: string } | null;
}

interface LeaveType {
  id: string;
  name: string;
  code: string;
  defaultDays: number;
  isPaid: boolean;
}

interface LeaveBalance {
  id: string;
  total: number;
  used: number;
  remaining: number;
  year: number;
  leaveType: { id: string; name: string; code: string };
}

interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
  status: string;
  halfDay: boolean;
  halfDaySlot?: string | null;
  createdAt: string;
  employee?: { id: string; firstName: string; lastName: string; employeeId: string };
  leaveType?: { id: string; name: string; code: string };
}

export default function ApplyLeaveByHRPage() {
  const { user } = useAuthStore();
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);

  // Employee search & selection
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Leave data
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [recentRequests, setRecentRequests] = useState<LeaveRequest[]>([]);

  // Form state
  const [form, setForm] = useState({
    leaveTypeId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    reason: '',
    halfDay: false,
    halfDaySlot: 'first_half',
  });
  const [submitting, setSubmitting] = useState(false);
  const [loadingLeaveData, setLoadingLeaveData] = useState(false);

  // ─── Fetch Employees ───────────────────────────
  const fetchEmployees = useCallback(async (search = '') => {
    setLoadingEmployees(true);
    try {
      const sq = scopeQuery();
      const r = await fetch(`/api/employees?limit=50&search=${encodeURIComponent(search)}${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setEmployees(d.employees || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load employees');
    } finally {
      setLoadingEmployees(false);
    }
  }, [scopeQuery, selectedTenantId]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  // ─── Fetch Leave Types & Balances for selected employee ──────
  const fetchLeaveData = useCallback(async (employeeId: string) => {
    setLoadingLeaveData(true);
    try {
      const [typesRes, balanceRes, requestsRes] = await Promise.all([
        fetch('/api/leave-types', { headers: getAuthHeaders() }),
        fetch(`/api/leave/balance?employeeId=${employeeId}`, { headers: getAuthHeaders() }),
        fetch(`/api/leave?employeeId=${employeeId}&limit=5`, { headers: getAuthHeaders() }),
      ]);

      const typesData = await typesRes.json();
      if (typesRes.ok) setLeaveTypes(typesData.leaveTypes || typesData.data || []);

      const balanceData = await balanceRes.json();
      if (balanceRes.ok) setLeaveBalances(balanceData.balances || []);

      const requestData = await requestsRes.json();
      if (requestsRes.ok) setRecentRequests(requestData.leaveRequests || []);
    } catch {
      toast.error('Failed to load leave data');
    } finally {
      setLoadingLeaveData(false);
    }
  }, []);

  // ─── Handle Employee Selection ─────────────────
  const handleSelectEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    setShowEmployeeDropdown(false);
    setEmployeeSearch('');
    fetchLeaveData(emp.id);
  };

  // ─── Calculate Days ────────────────────────────
  const calculateDays = () => {
    if (!form.startDate || !form.endDate) return 0;
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return form.halfDay ? diff - 0.5 : diff;
  };

  // ─── Submit Leave on Behalf ────────────────────
  const handleSubmit = async () => {
    if (!selectedEmployee) {
      toast.error('Please select an employee first');
      return;
    }
    if (!form.leaveTypeId) {
      toast.error('Please select a leave type');
      return;
    }
    if (!form.startDate || !form.endDate) {
      toast.error('Please select start and end dates');
      return;
    }
    if (new Date(form.endDate) < new Date(form.startDate)) {
      toast.error('End date cannot be before start date');
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch('/api/leave', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          leaveTypeId: form.leaveTypeId,
          startDate: form.startDate,
          endDate: form.endDate,
          reason: form.reason || `Leave applied by HR on behalf of ${selectedEmployee.firstName} ${selectedEmployee.lastName}`,
          halfDay: form.halfDay,
          halfDaySlot: form.halfDay ? form.halfDaySlot : null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');

      toast.success(`Leave applied successfully for ${selectedEmployee.firstName} ${selectedEmployee.lastName}${d.autoApproval?.applied ? ' (Auto-approved)' : ''}`);
      setForm({
        leaveTypeId: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        reason: '',
        halfDay: false,
        halfDaySlot: 'first_half',
      });
      fetchLeaveData(selectedEmployee.id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to apply leave');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Get balance for selected leave type ───────
  const selectedLeaveBalance = leaveBalances.find(b => b.leaveType.id === form.leaveTypeId);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <FiUsers className="w-6 h-6 text-teal-500" />
          Apply Leave by HR
        </h1>
        <p className="text-sm text-slate-500 mt-1">Apply leave on behalf of employees · View balances · Track recent requests</p>
      </div>

      {/* Info Banner */}
      <div className="thb-card p-4 border-l-4 border-l-teal-500 bg-teal-50/30">
        <div className="flex items-start gap-3">
          <FiAlertCircle className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-teal-800">HR Proxy Application</p>
            <p className="text-xs text-teal-700 mt-1">Leave applied through this page will be recorded as submitted on behalf of the selected employee. Standard approval workflows and AI auto-approval rules will still apply.</p>
          </div>
        </div>
      </div>

      {/* Employee Selection */}
      <div className="thb-card p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <FiUsers className="w-5 h-5 text-teal-500" />
          Select Employee
        </h2>
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={employeeSearch}
            onChange={(e) => {
              setEmployeeSearch(e.target.value);
              setShowEmployeeDropdown(true);
              if (e.target.value.length >= 2) fetchEmployees(e.target.value);
            }}
            onFocus={() => setShowEmployeeDropdown(true)}
            placeholder="Search by name, employee ID, or email..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all"
          />

          {/* Employee Dropdown */}
          {showEmployeeDropdown && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto z-50">
              {loadingEmployees ? (
                <div className="p-4 text-center text-sm text-slate-500">Loading...</div>
              ) : employees.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">No employees found</div>
              ) : employees.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => handleSelectEmployee(emp)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-teal-50 transition-colors ${
                    selectedEmployee?.id === emp.id ? 'bg-teal-50 text-teal-700' : 'text-slate-700'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {emp.firstName[0]}{emp.lastName[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{emp.firstName} {emp.lastName}</p>
                    <p className="text-xs text-slate-400 truncate">{emp.employeeId} · {emp.department?.name || 'No Dept'} · {emp.designation?.name || 'No Desg'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Employee Card */}
        {selectedEmployee && (
          <div className="mt-4 p-4 bg-teal-50/40 border border-teal-200 rounded-lg flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {selectedEmployee.firstName[0]}{selectedEmployee.lastName[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800">{selectedEmployee.firstName} {selectedEmployee.lastName}</p>
              <p className="text-xs text-slate-500">{selectedEmployee.employeeId} · {selectedEmployee.email}</p>
              <p className="text-xs text-slate-400">{selectedEmployee.department?.name || 'No Department'} · {selectedEmployee.designation?.name || 'No Designation'}</p>
            </div>
            <button
              onClick={() => { setSelectedEmployee(null); setLeaveTypes([]); setLeaveBalances([]); setRecentRequests([]); }}
              className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
              title="Clear selection"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Leave Application Form — shown only after employee selection */}
      {selectedEmployee && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 thb-card p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <FiCalendar className="w-5 h-5 text-teal-500" />
              Apply Leave for {selectedEmployee.firstName}
            </h2>

            {loadingLeaveData ? (
              <div className="flex items-center justify-center py-12">
                <FiRefreshCw className="w-6 h-6 text-teal-500 animate-spin" />
                <span className="ml-3 text-sm text-slate-500">Loading leave data...</span>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Leave Type */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Leave Type *</label>
                  <select
                    value={form.leaveTypeId}
                    onChange={e => setForm({ ...form, leaveTypeId: e.target.value })}
                    className="3boxes-input w-full"
                  >
                    <option value="">-- Select Leave Type --</option>
                    {leaveTypes.map(lt => (
                      <option key={lt.id} value={lt.id}>{lt.name} ({lt.code}) {lt.isPaid ? '— Paid' : '— Unpaid'}</option>
                    ))}
                  </select>
                </div>

                {/* Balance Info */}
                {selectedLeaveBalance && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-4">
                    <FiCheck className="w-4 h-4 text-blue-600" />
                    <div className="text-xs text-blue-700">
                      <span className="font-medium">{selectedLeaveBalance.leaveType.name}</span> Balance:
                      Total <strong>{selectedLeaveBalance.total}</strong> ·
                      Used <strong>{selectedLeaveBalance.used}</strong> ·
                      Remaining <strong className="text-blue-900">{selectedLeaveBalance.remaining}</strong>
                    </div>
                  </div>
                )}

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Start Date *</label>
                    <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="3boxes-input w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">End Date *</label>
                    <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="3boxes-input w1-full" />
                  </div>
                </div>

                {/* Days Count */}
                {form.startDate && form.endDate && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2">
                    <FiClock className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-700">Duration: <strong>{calculateDays()} day{calculateDays() !== 1 ? 's' : ''}</strong></span>
                  </div>
                )}

                {/* Half Day */}
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.halfDay} onChange={e => setForm({ ...form, halfDay: e.target.checked })} className="w-4 h-4 text-teal-500 rounded border-slate-300 focus:ring-teal-500" />
                    <span className="text-sm text-slate-700">Half Day</span>
                  </label>
                  {form.halfDay && (
                    <select value={form.halfDaySlot} onChange={e => setForm({ ...form, halfDaySlot: e.target.value })} className="3boxes-input text-sm">
                      <option value="first_half">First Half</option>
                      <option value="second_half">Second Half</option>
                    </select>
                  )}
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Reason</label>
                  <textarea
                    value={form.reason}
                    onChange={e => setForm({ ...form, reason: e.target.value })}
                    rows={3}
                    className="3boxes-input w-full resize-none"
                    placeholder="Reason for leave (optional — auto-filled if left blank)"
                  />
                </div>

                {/* Submit */}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !form.leaveTypeId}
                    className="3boxes-btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiPlus className="w-4 h-4" />}
                    Apply Leave for {selectedEmployee.firstName}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar: Balances & Recent Requests */}
          <div className="space-y-6">
            {/* Leave Balances */}
            <div className="thb-card p-5">
              <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <FiFileText className="w-4 h-4 text-teal-500" />
                Leave Balances
              </h3>
              {leaveBalances.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No balances found</p>
              ) : (
                <div className="space-y-2.5">
                  {leaveBalances.map(b => (
                    <div key={b.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                      <div>
                        <p className="text-xs font-medium text-slate-700">{b.leaveType.name}</p>
                        <p className="text-[10px] text-slate-400">Used {b.used} of {b.total}</p>
                      </div>
                      <span className={`text-sm font-bold ${b.remaining > 0 ? 'text-teal-600' : 'text-red-500'}`}>{b.remaining}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Requests */}
            <div className="thb-card p-5">
              <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <FiClock className="w-4 h-4 text-slate-500" />
                Recent Requests
              </h3>
              {recentRequests.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No recent requests</p>
              ) : (
                <div className="space-y-2.5">
                  {recentRequests.map(req => (
                    <div key={req.id} className="p-2.5 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-slate-700">{req.leaveType?.name || 'Leave'}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          req.status === 'approved' ? 'bg-green-100 text-green-700' :
                          req.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          req.status === 'cancelled' ? 'bg-slate-100 text-slate-600' :
                          'bg-amber-100 text-amber-700'
                        }`}>{req.status}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(req.startDate)} — {fmtDate(req.endDate)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
