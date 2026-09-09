'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FiClock, FiUser, FiSearch, FiPlus, FiRefreshCw,
  FiCheck, FiAlertCircle, FiUsers, FiCalendar,
  FiLogIn, FiLogOut, FiMapPin, FiZap, FiFileText,
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

type AttendanceRequestType = 'regularize' | 'permission' | 'gatepass' | 'overtime' | 'comp-off' | 'wfh';

interface RequestTypeOption {
  key: AttendanceRequestType;
  label: string;
  icon: React.ReactNode;
  description: string;
  apiEndpoint: string;
}

const REQUEST_TYPES: RequestTypeOption[] = [
  { key: 'regularize', label: 'Regularization', icon: <FiRefreshCw className="w-4 h-4" />, description: 'Missed punch / incorrect time correction', apiEndpoint: '/api/attendance/regularize' },
  { key: 'permission', label: 'Permission', icon: <FiClock className="w-4 h-4" />, description: 'Short leave / permission request (1-4 hours)', apiEndpoint: '/api/attendance/permission' },
  { key: 'gatepass', label: 'Gate Pass', icon: <FiLogOut className="w-4 h-4" />, description: 'Early departure / temporary exit request', apiEndpoint: '/api/attendance/gatepass' },
  { key: 'overtime', label: 'Overtime', icon: <FiZap className="w-4 h-4" />, description: 'Overtime work authorization', apiEndpoint: '/api/attendance/overtime-request' },
  { key: 'comp-off', label: 'Comp-Off', icon: <FiCalendar className="w-4 h-4" />, description: 'Compensatory off request', apiEndpoint: '/api/attendance/comp-off' },
  { key: 'wfh', label: 'Work From Home', icon: <FiMapPin className="w-4 h-4" />, description: 'WFH request for a date range', apiEndpoint: '/api/attendance/regularize' },
];

export default function ApplyAttendanceByHRPage() {
  const { user } = useAuthStore();
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);

  // Employee search & selection
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Request type selection
  const [selectedRequestType, setSelectedRequestType] = useState<AttendanceRequestType | null>(null);

  // Forms for each type
  const [regularizeForm, setRegularizeForm] = useState({ date: new Date().toISOString().split('T')[0], punchType: 'check_in', requestedTime: '', reason: '' });
  const [permissionForm, setPermissionForm] = useState({ date: new Date().toISOString().split('T')[0], startTime: '', endTime: '', reason: '' });
  const [gatepassForm, setGatepassForm] = useState({ date: new Date().toISOString().split('T')[0], outTime: '', expectedReturn: '', reason: '' });
  const [overtimeForm, setOvertimeForm] = useState({ date: new Date().toISOString().split('T')[0], startTime: '', endTime: '', reason: '' });
  const [compoffForm, setCompoffForm] = useState({ date: new Date().toISOString().split('T')[0], reason: '' });
  const [wfhForm, setWfhForm] = useState({ date: new Date().toISOString().split('T')[0], endDate: '', reason: '' });

  const [submitting, setSubmitting] = useState(false);

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

  // ─── Handle Employee Selection ─────────────────
  const handleSelectEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    setShowEmployeeDropdown(false);
    setEmployeeSearch('');
  };

  // ─── Submit Attendance Request on Behalf ───────
  const handleSubmit = async () => {
    if (!selectedEmployee) {
      toast.error('Please select an employee first');
      return;
    }
    if (!selectedRequestType) {
      toast.error('Please select a request type');
      return;
    }

    const reqType = REQUEST_TYPES.find(r => r.key === selectedRequestType);
    if (!reqType) return;

    setSubmitting(true);
    try {
      let body: Record<string, unknown> = {};

      switch (selectedRequestType) {
        case 'regularize': {
          if (!regularizeForm.date || !regularizeForm.requestedTime || !regularizeForm.reason) {
            toast.error('All fields are required');
            setSubmitting(false);
            return;
          }
          const dt = new Date(`${regularizeForm.date}T${regularizeForm.requestedTime}`);
          body = { employeeId: selectedEmployee.id, date: regularizeForm.date, punchType: regularizeForm.punchType, requestedTime: dt, reason: `[HR] ${regularizeForm.reason}` };
          break;
        }
        case 'permission': {
          if (!permissionForm.date || !permissionForm.startTime || !permissionForm.endTime || !permissionForm.reason) {
            toast.error('All fields are required');
            setSubmitting(false);
            return;
          }
          body = { employeeId: selectedEmployee.id, date: permissionForm.date, startTime: permissionForm.startTime, endTime: permissionForm.endTime, reason: `[HR] ${permissionForm.reason}`, type: 'permission' };
          break;
        }
        case 'gatepass': {
          if (!gatepassForm.date || !gatepassForm.outTime || !gatepassForm.reason) {
            toast.error('Date, out time, and reason are required');
            setSubmitting(false);
            return;
          }
          body = { employeeId: selectedEmployee.id, date: gatepassForm.date, outTime: gatepassForm.outTime, expectedReturn: gatepassForm.expectedReturn || null, reason: `[HR] ${gatepassForm.reason}` };
          break;
        }
        case 'overtime': {
          if (!overtimeForm.date || !overtimeForm.startTime || !overtimeForm.endTime || !overtimeForm.reason) {
            toast.error('All fields are required');
            setSubmitting(false);
            return;
          }
          body = { employeeId: selectedEmployee.id, date: overtimeForm.date, startTime: overtimeForm.startTime, endTime: overtimeForm.endTime, reason: `[HR] ${overtimeForm.reason}` };
          break;
        }
        case 'comp-off': {
          if (!compoffForm.date || !compoffForm.reason) {
            toast.error('Date and reason are required');
            setSubmitting(false);
            return;
          }
          body = { employeeId: selectedEmployee.id, date: compoffForm.date, reason: `[HR] ${compoffForm.reason}` };
          break;
        }
        case 'wfh': {
          if (!wfhForm.date || !wfhForm.reason) {
            toast.error('Date and reason are required');
            setSubmitting(false);
            return;
          }
          body = { employeeId: selectedEmployee.id, date: wfhForm.date, endDate: wfhForm.endDate || wfhForm.date, punchType: 'wfh', requestedTime: new Date(), reason: `[HR WFH] ${wfhForm.reason}` };
          break;
        }
      }

      const r = await fetch(reqType.apiEndpoint, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');

      toast.success(`${reqType.label} request submitted for ${selectedEmployee.firstName} ${selectedEmployee.lastName}`);
      setSelectedRequestType(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <FiUsers className="w-6 h-6 text-cyan-500" />
          Apply Attendance by HR
        </h1>
        <p className="text-sm text-slate-500 mt-1">Submit attendance requests on behalf of employees — regularization, permission, gate pass, overtime, comp-off &amp; WFH</p>
      </div>

      {/* Info Banner */}
      <div className="thb-card p-4 border-l-4 border-l-cyan-500 bg-cyan-50/30">
        <div className="flex items-start gap-3">
          <FiAlertCircle className="w-5 h-5 text-cyan-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-cyan-800">HR Proxy Attendance Application</p>
            <p className="text-xs text-cyan-700 mt-1">Requests submitted through this page are recorded on behalf of the selected employee. Standard approval workflows and AI auto-approval rules still apply. All requests are tagged with [HR] prefix.</p>
          </div>
        </div>
      </div>

      {/* Employee Selection */}
      <div className="thb-card p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <FiUsers className="w-5 h-5 text-cyan-500" />
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
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 transition-all"
          />

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
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-cyan-50 transition-colors ${
                    selectedEmployee?.id === emp.id ? 'bg-cyan-50 text-cyan-700' : 'text-slate-700'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
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

        {selectedEmployee && (
          <div className="mt-4 p-4 bg-cyan-50/40 border border-cyan-200 rounded-lg flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {selectedEmployee.firstName[0]}{selectedEmployee.lastName[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800">{selectedEmployee.firstName} {selectedEmployee.lastName}</p>
              <p className="text-xs text-slate-500">{selectedEmployee.employeeId} · {selectedEmployee.email}</p>
              <p className="text-xs text-slate-400">{selectedEmployee.department?.name || 'No Department'} · {selectedEmployee.designation?.name || 'No Designation'}</p>
            </div>
            <button
              onClick={() => { setSelectedEmployee(null); setSelectedRequestType(null); }}
              className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
              title="Clear selection"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Request Type Selection & Form — shown only after employee selection */}
      {selectedEmployee && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Request Type Cards */}
          <div className="lg:col-span-1 thb-card p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Request Type</h3>
            <div className="space-y-2">
              {REQUEST_TYPES.map(rt => (
                <button
                  key={rt.key}
                  onClick={() => setSelectedRequestType(rt.key)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                    selectedRequestType === rt.key
                      ? 'bg-cyan-50 border border-cyan-300 text-cyan-700 shadow-sm'
                      : 'bg-slate-50 border border-transparent text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    selectedRequestType === rt.key ? 'bg-cyan-500 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {rt.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{rt.label}</p>
                    <p className="text-[10px] text-slate-400 truncate">{rt.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Form */}
          <div className="lg:col-span-2 thb-card p-6">
            {!selectedRequestType ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <FiClock className="w-10 h-10 mb-3" />
                <p className="text-sm">Select a request type to proceed</p>
              </div>
            ) : (
              <div className="space-y-5">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  {REQUEST_TYPES.find(r => r.key === selectedRequestType)?.icon}
                  {REQUEST_TYPES.find(r => r.key === selectedRequestType)?.label} for {selectedEmployee.firstName}
                </h2>

                {/* Regularize Form */}
                {selectedRequestType === 'regularize' && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">Date *</label>
                        <input type="date" value={regularizeForm.date} onChange={e => setRegularizeForm({ ...regularizeForm, date: e.target.value })} className="3boxes-input w-full" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">Punch Type *</label>
                        <select value={regularizeForm.punchType} onChange={e => setRegularizeForm({ ...regularizeForm, punchType: e.target.value })} className="3boxes-input w-full">
                          <option value="check_in">Check-In (forgot to clock in)</option>
                          <option value="check_out">Check-Out (forgot to clock out)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">Actual Time *</label>
                        <input type="time" value={regularizeForm.requestedTime} onChange={e => setRegularizeForm({ ...regularizeForm, requestedTime: e.target.value })} className="3boxes-input w-full" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">Reason *</label>
                        <input type="text" value={regularizeForm.reason} onChange={e => setRegularizeForm({ ...regularizeForm, reason: e.target.value })} className="3boxes-input w-full" placeholder="e.g. Forgot to punch in after meeting" />
                      </div>
                    </div>
                  </>
                )}

                {/* Permission Form */}
                {selectedRequestType === 'permission' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Date *</label>
                      <input type="date" value={permissionForm.date} onChange={e => setPermissionForm({ ...permissionForm, date: e.target.value })} className="3boxes-input w-full" />
                    </div>
                    <div />
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Start Time *</label>
                      <input type="time" value={permissionForm.startTime} onChange={e => setPermissionForm({ ...permissionForm, startTime: e.target.value })} className="3boxes-input w-full" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">End Time *</label>
                      <input type="time" value={permissionForm.endTime} onChange={e => setPermissionForm({ ...permissionForm, endTime: e.target.value })} className="3boxes-input w-full" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Reason *</label>
                      <input type="text" value={permissionForm.reason} onChange={e => setPermissionForm({ ...permissionForm, reason: e.target.value })} className="3boxes-input w-full" placeholder="e.g. Personal work for 2 hours" />
                    </div>
                  </div>
                )}

                {/* Gate Pass Form */}
                {selectedRequestType === 'gatepass' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Date *</label>
                      <input type="date" value={gatepassForm.date} onChange={e => setGatepassForm({ ...gatepassForm, date: e.target.value })} className="3boxes-input w-full" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Out Time *</label>
                      <input type="time" value={gatepassForm.outTime} onChange={e => setGatepassForm({ ...gatepassForm, outTime: e.target.value })} className="3boxes-input w-full" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Expected Return</label>
                      <input type="time" value={gatepassForm.expectedReturn} onChange={e => setGatepassForm({ ...gatepassForm, expectedReturn: e.target.value })} className="3boxes-input w-full" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Reason *</label>
                      <input type="text" value={gatepassForm.reason} onChange={e => setGatepassForm({ ...gatepassForm, reason: e.target.value })} className="3boxes-input w-full" placeholder="e.g. Doctor appointment" />
                    </div>
                  </div>
                )}

                {/* Overtime Form */}
                {selectedRequestType === 'overtime' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Date *</label>
                      <input type="date" value={overtimeForm.date} onChange={e => setOvertimeForm({ ...overtimeForm, date: e.target.value })} className="3boxes-input w-full" />
                    </div>
                    <div />
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">OT Start Time *</label>
                      <input type="time" value={overtimeForm.startTime} onChange={e => setOvertimeForm({ ...overtimeForm, startTime: e.target.value })} className="3boxes-input w-full" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">OT End Time *</label>
                      <input type="time" value={overtimeForm.endTime} onChange={e => setOvertimeForm({ ...overtimeForm, endTime: e.target.value })} className="3boxes-input w-full" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Reason *</label>
                      <input type="text" value={overtimeForm.reason} onChange={e => setOvertimeForm({ ...overtimeForm, reason: e.target.value })} className="3boxes-input w-full" placeholder="e.g. Project deadline" />
                    </div>
                  </div>
                )}

                {/* Comp-Off Form */}
                {selectedRequestType === 'comp-off' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Comp-Off Date *</label>
                      <input type="date" value={compoffForm.date} onChange={e => setCompoffForm({ ...compoffForm, date: e.target.value })} className="3boxes-input w-full" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Reason *</label>
                      <input type="text" value={compoffForm.reason} onChange={e => setCompoffForm({ ...compoffForm, reason: e.target.value })} className="3boxes-input w-full" placeholder="e.g. Worked on holiday" />
                    </div>
                  </div>
                )}

                {/* WFH Form */}
                {selectedRequestType === 'wfh' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">From Date *</label>
                      <input type="date" value={wfhForm.date} onChange={e => setWfhForm({ ...wfhForm, date: e.target.value })} className="3boxes-input w-full" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">To Date</label>
                      <input type="date" value={wfhForm.endDate} onChange={e => setWfhForm({ ...wfhForm, endDate: e.target.value })} className="3boxes-input w-full" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Reason *</label>
                      <input type="text" value={wfhForm.reason} onChange={e => setWfhForm({ ...wfhForm, reason: e.target.value })} className="3boxes-input w-full" placeholder="e.g. Personal reason / unwell" />
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="3boxes-btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiPlus className="w-4 h-4" />}
                    Submit {REQUEST_TYPES.find(r => r.key === selectedRequestType)?.label} for {selectedEmployee.firstName}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
