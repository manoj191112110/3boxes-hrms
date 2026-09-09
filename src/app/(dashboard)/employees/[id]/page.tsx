'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  FiArrowLeft,
  FiUser,
  FiMail,
  FiPhone,
  FiMapPin,
  FiCalendar,
  FiBriefcase,
  FiDollarSign,
  FiFileText,
  FiClock,
  FiHeart,
  FiShield,
  FiUpload,
  FiEdit2,
  FiGlobe,
  FiDroplet,
  FiHome,
  FiUsers,
  FiAward,
  FiTrendingUp,
  FiHash,
  FiCheckCircle,
  FiXCircle,
  FiCreditCard,
  FiRefreshCw,
  FiPlus,
  FiTrash2,
  FiToggleLeft,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// ─── Employee Policies Tab Component ───
function EmployeePoliciesTab({ employeeId }: { employeeId: string }) {
  const { user } = useAuthStore();
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'tenant_admin' || user?.role === 'admin';
  const [policies, setPolicies] = useState<{ leave?: Record<string, unknown>; attendance?: Record<string, unknown>; travel?: Record<string, unknown>; salaryStructure?: Record<string, unknown>; leavePolicyId?: string | null; attendancePolicyId?: string | null; travelPolicyId?: string | null; salaryStructureId?: string | null } | null>(null);
  const [leavePolicies, setLeavePolicies] = useState<Array<{ id: string; title: string; version: string; effectiveDate?: string | null }>>([]);
  const [attendancePolicies, setAttendancePolicies] = useState<Array<{ id: string; title: string; version: string; effectiveDate?: string | null }>>([]);
  const [travelPolicies, setTravelPolicies] = useState<Array<{ id: string; title: string; version: string; effectiveDate?: string | null }>>([]);
  const [salaryStructures, setSalaryStructures] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchPolicies = useCallback(async () => {
    const sqBase = scopeQuery();
    const sq = sqBase ? `${sqBase}&` : '';
    try {
      const [polRes, lpRes, apRes, tpRes, ssRes] = await Promise.allSettled([
        fetch(`/api/employees/${employeeId}/policies?${sq}`, { headers: getAuthHeaders() }),
        fetch(`/api/policies?${sq}category=leave`, { headers: getAuthHeaders() }),
        fetch(`/api/policies?${sq}category=attendance`, { headers: getAuthHeaders() }),
        fetch(`/api/policies?${sq}category=travel`, { headers: getAuthHeaders() }),
        fetch(`/api/salary-structures?${sq}`, { headers: getAuthHeaders() }),
      ]);
      if (polRes.status === 'fulfilled' && polRes.value.ok) { const d = await polRes.value.json(); setPolicies(d.data); }
      if (lpRes.status === 'fulfilled' && lpRes.value.ok) { const d = await lpRes.value.json(); setLeavePolicies((d.policies || d.data || [])); }
      if (apRes.status === 'fulfilled' && apRes.value.ok) { const d = await apRes.value.json(); setAttendancePolicies((d.policies || d.data || [])); }
      if (tpRes.status === 'fulfilled' && tpRes.value.ok) { const d = await tpRes.value.json(); setTravelPolicies((d.policies || d.data || [])); }
      if (ssRes.status === 'fulfilled' && ssRes.value.ok) { const d = await ssRes.value.json(); setSalaryStructures((d.salaryStructures || d.data || [])); }
    } catch { /* silently */ }
  }, [employeeId, scopeQuery, selectedTenantId]);

  useEffect(() => { queueMicrotask(() => fetchPolicies()); }, [fetchPolicies]);

  const handleSave = async (field: string, value: string | null) => {
    setSaving(field);
    try {
      const res = await fetch(`/api/employees/${employeeId}/policies`, {
        method: 'PUT', headers: getAuthHeaders(),
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) { toast.success('Updated'); fetchPolicies(); }
      else { toast.error('Failed'); }
    } catch { toast.error('Failed'); }
    finally { setSaving(null); }
  };

  const policyDropdown = (label: string, field: string, items: Array<{ id: string; title: string; version: string; effectiveDate?: string | null }>, currentId: string | null | undefined, icon: React.ReactNode) => (
    <div className="thb-card p-5">
      <h4 className="text-sm font-semibold text-thb-text-primary mb-3 flex items-center gap-2">{icon}{label}</h4>
      <select
        value={currentId || ''}
        onChange={e => handleSave(field, e.target.value || null)}
        disabled={!isAdmin || saving === field}
        className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 disabled:opacity-50"
      >
        <option value="">— Not Assigned —</option>
        {items.map(p => <option key={p.id} value={p.id}>{p.title} (v{p.version})</option>)}
      </select>
      {currentId && items.find(p => p.id === currentId) && (
        <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-thb-border text-xs text-thb-text-secondary">
          <p><span className="font-medium">Title:</span> {items.find(p => p.id === currentId)?.title}</p>
          <p><span className="font-medium">Version:</span> {items.find(p => p.id === currentId)?.version}</p>
          {items.find(p => p.id === currentId)?.effectiveDate && <p><span className="font-medium">Effective:</span> {new Date(items.find(p => p.id === currentId)!.effectiveDate!).toLocaleDateString()}</p>}
        </div>
      )}
      {saving === field && <p className="text-xs text-green-500 mt-2">Saving...</p>}
    </div>
  );

  return (
    <div className="space-y-5">
      {!isAdmin && <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-700">Only admins can modify policy mappings.</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {policyDropdown('Leave Policy', 'leavePolicyId', leavePolicies, policies?.leavePolicyId, <FiCalendar className="w-4 h-4 text-green-500" />)}
        {policyDropdown('Attendance Policy', 'attendancePolicyId', attendancePolicies, policies?.attendancePolicyId, <FiClock className="w-4 h-4 text-emerald-500" />)}
        {policyDropdown('Travel Policy', 'travelPolicyId', travelPolicies, policies?.travelPolicyId, <FiBriefcase className="w-4 h-4 text-amber-500" />)}
        <div className="thb-card p-5">
          <h4 className="text-sm font-semibold text-thb-text-primary mb-3 flex items-center gap-2"><FiDollarSign className="w-4 h-4 text-emerald-500" />Salary Structure</h4>
          <select
            value={policies?.salaryStructureId || ''}
            onChange={e => handleSave('salaryStructureId', e.target.value || null)}
            disabled={!isAdmin || saving === 'salaryStructureId'}
            className="w-full px-3 py-2 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 disabled:opacity-50"
          >
            <option value="">— Not Assigned —</option>
            {salaryStructures.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {saving === 'salaryStructureId' && <p className="text-xs text-green-500 mt-2">Saving...</p>}
        </div>
      </div>
    </div>
  );
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'bg-gradient-to-r from-emerald-500 to-teal-400 text-white thb-badge shadow-sm shadow-emerald-200',
    on_leave: 'bg-gradient-to-r from-amber-500 to-orange-400 text-white thb-badge shadow-sm shadow-amber-200',
    terminated: 'bg-gradient-to-r from-red-500 to-rose-400 text-white thb-badge shadow-sm shadow-red-200',
    resigned: 'bg-gradient-to-r from-slate-500 to-slate-400 text-white thb-badge shadow-sm shadow-slate-200',
  };
  const labels: Record<string, string> = { active: 'Active', on_leave: 'On Leave', terminated: 'Terminated', resigned: 'Resigned' };
  return { className: map[status] || 'thb-badge thb-badge-info', label: labels[status] || status };
}

interface EmployeeData {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  department?: { id: string; name: string; company?: { id: string; name: string; code: string | null } | null } | null;
  designation?: { id: string; title: string } | null;
  branch?: { id: string; name: string; company?: { id: string; name: string; code: string | null } | null } | null;
  company?: { id: string; name: string; code: string | null } | null;
  dateOfJoining: string;
  status: string;
  dateOfBirth?: string | null;
  gender?: string | null;
  maritalStatus?: string | null;
  nationality?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  bloodGroup?: string | null;
  bankName?: string | null;
  bankAccountNo?: string | null;
  bankIfscCode?: string | null;
  panNumber?: string | null;
  aadhaarNumber?: string | null;
  salary?: number | null;
  salaryCurrency?: string;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  leaveBalances?: Array<{
    id: string;
    total: number;
    used: number;
    remaining: number;
    year: number;
    leaveType: { id: string; name: string; code: string };
  }>;
  dependents?: Array<{ id: string; name: string; relation: string; dateOfBirth?: string | null; gender?: string | null }>;
  qualifications?: Array<{ id: string; degree: string; institution: string; year: number; percentage?: number | null }>;
  experiences?: Array<{ id: string; company: string; designation: string; startDate: string; endDate?: string | null; isCurrent: boolean }>;
  skills?: Array<{ id: string; skill: string; level: string; yearsOfExp?: number | null }>;
  documents?: Array<{ id: string; name: string; type: string; fileUrl?: string | null; status: string; uploadedAt: string; expiryDate?: string | null }>;
  assetAssignments?: Array<{ id: string; status: string; assignedDate: string; asset: { id: string; name: string; assetTag: string; category: string } }>;
}

const tabs = ['Overview', 'Personal', 'Employment', 'Documents', 'Leave', 'Attendance', 'Payroll', 'Health', 'Policies', 'Company Mapping'] as const;
type TabName = typeof tabs[number];

// ─── Info Field Component ───
function InfoField({ label, value, icon, accentColor }: { label: string; value?: string | null; icon?: React.ReactNode; accentColor?: string }) {
  return (
    <div className="flex items-start gap-3 py-3 pl-3 border-l-2 border-transparent hover:border-l-green-400 transition-colors group">
      {icon && <span className="mt-0.5 text-thb-text-muted flex-shrink-0 group-hover:text-green-500 transition-colors">{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-thb-text-muted mb-0.5">{label}</p>
        <p className="text-sm font-medium text-thb-text-primary break-words">{value || '—'}</p>
      </div>
    </div>
  );
}

// ─── Section Card Component ───
function SectionCard({ title, icon, children, accentGradient }: { title: string; icon?: React.ReactNode; children: React.ReactNode; accentGradient?: string }) {
  const gradient = accentGradient || 'from-teal-500 via-green-500 to-cyan-400';
  return (
    <div className="thb-card overflow-hidden relative">
      {/* Colorful left border */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${gradient}`} />
      <div className={`px-6 py-4 border-b border-thb-border bg-gradient-to-r from-teal-50/60 via-green-50/40 to-cyan-50/30`}>
        <h3 className="text-sm font-semibold text-thb-text-primary flex items-center gap-2">
          {icon}
          {title}
        </h3>
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

// ─── Stat Card Component ───
function StatCard({ icon, label, value, subtitle, colorClass, borderGradient }: { icon: React.ReactNode; label: string; value: string | number; subtitle?: string; colorClass: string; borderGradient: string }) {
  return (
    <div className={`thb-card p-5 flex items-start gap-4 relative overflow-hidden border-l-4 border-transparent`}>
      {/* Gradient left border */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${borderGradient}`} />
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${colorClass}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-thb-text-muted mb-1">{label}</p>
        <p className="text-xl font-bold text-thb-text-primary">{value}</p>
        {subtitle && <p className="text-[11px] text-thb-text-muted mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const scopeQuery = useCompanyContextStore(s => s.scopeQuery);
  const selectedTenantId = useCompanyContextStore(s => s.selectedTenantId);

  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabName>('Overview');
  const [companyMappings, setCompanyMappings] = useState<Array<{ id: string; companyId: string; employeeCode: string; isPrimary: boolean; department?: { name: string } | null; designation?: { title: string } | null; branch?: { name: string } | null; company?: { name: string; code?: string } | null }>>([]);

  const [attendance, setAttendance] = useState<Array<{ id: string; date: string; checkIn?: string | null; checkOut?: string | null; workHours?: number | null; overtime?: number | null; status: string }>>([]);
  const [payrolls, setPayrolls] = useState<Array<{ id: string; month: number; year: number; grossSalary: number; totalDeductions: number; netSalary: number; status: string; paidDate?: string | null }>>([]);
  const [leaveRequests, setLeaveRequests] = useState<Array<{ id: string; startDate: string; endDate: string; reason?: string | null; status: string; halfDay: boolean; leaveType: { name: string } }>>([]);
  const [now] = useState(() => Date.now());

  const fetchEmployee = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await fetch(`/api/employees/${encodeURIComponent(id)}`, { headers: getAuthHeaders() });
      if (res.status === 503) {
        setLoadError('Database temporarily unavailable. Please try again.');
        setEmployee(null);
        return;
      }
      if (res.status === 404) {
        setLoadError('Employee not found in database.');
        setEmployee(null);
        return;
      }
      if (!res.ok) {
        setLoadError(`Failed to load employee (HTTP ${res.status})`);
        setEmployee(null);
        return;
      }
      const data = await res.json();
      setEmployee(data.employee);
    } catch (err) {
      console.error('Failed to load employee details:', err);
      setLoadError('Network error. Please check your connection and try again.');
      setEmployee(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchCompanyMappings = useCallback(async () => {
    if (!employee) return;
    try {
      const res = await fetch(`/api/employees/company-mappings?employeeId=${employee.id}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setCompanyMappings(data.mappings || []);
      }
    } catch { /* silently */ }
  }, [employee]);

  const fetchRelatedData = useCallback(async () => {
    if (!employee) return;
    const sqBase = scopeQuery();
    const sq = sqBase ? `${sqBase}&` : '';
    try {
      const headers = getAuthHeaders();
      const [attRes, payRes, leaveRes] = await Promise.allSettled([
        fetch(`/api/attendance?${sq}employeeId=${employee.id}&limit=30`, { headers }),
        fetch(`/api/payroll?${sq}employeeId=${employee.id}&limit=12`, { headers }),
        fetch(`/api/leave?${sq}employeeId=${employee.id}&limit=20`, { headers }),
      ]);
      if (attRes.status === 'fulfilled' && attRes.value.ok) {
        const d = await attRes.value.json();
        setAttendance(d.attendance || []);
      }
      if (payRes.status === 'fulfilled' && payRes.value.ok) {
        const d = await payRes.value.json();
        setPayrolls(d.payrolls || []);
      }
      if (leaveRes.status === 'fulfilled' && leaveRes.value.ok) {
        const d = await leaveRes.value.json();
        setLeaveRequests(d.leaveRequests || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, [employee, scopeQuery, selectedTenantId]);

  useEffect(() => {
    queueMicrotask(() => fetchEmployee());
  }, [fetchEmployee]);

  useEffect(() => {
    if (employee) queueMicrotask(() => fetchRelatedData());
  }, [employee, fetchRelatedData]);

  useEffect(() => {
    if (employee && activeTab === 'Company Mapping') queueMicrotask(() => fetchCompanyMappings());
  }, [employee, activeTab, fetchCompanyMappings]);

  // ─── Loading State ───
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="thb-card overflow-hidden animate-pulse">
          <div className="h-32 bg-gradient-to-r from-slate-200 to-slate-100" />
          <div className="px-6 pb-6 -mt-12">
            <div className="flex items-end gap-5">
              <div className="w-[120px] h-[120px] rounded-2xl bg-slate-200 border-4 border-white" />
              <div className="pb-3 space-y-2 flex-1">
                <div className="h-6 w-48 bg-slate-200 rounded" />
                <div className="h-4 w-64 bg-slate-200 rounded" />
              </div>
            </div>
          </div>
        </div>
        <div className="thb-card p-6 animate-pulse">
          <div className="flex gap-4 mb-6">
            {[1,2,3,4,5].map(i => <div key={i} className="h-8 w-20 bg-slate-200 rounded" />)}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-16 bg-slate-200 rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  // ─── Not Found / Error State ───
  if (!employee) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-5">
            <FiUser className="w-10 h-10 text-slate-300" />
          </div>
          <p className="text-lg font-semibold text-thb-text-primary mb-1">Employee Not Found</p>
          <p className="text-sm text-thb-text-secondary mb-2">The employee you&apos;re looking for doesn&apos;t exist or has been removed.</p>
          {loadError && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              {loadError}
            </p>
          )}
          <p className="text-xs text-thb-text-muted mb-5">Employee ID: {id}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => fetchEmployee()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm"
            >
              <FiRefreshCw className="w-4 h-4" />
              Retry
            </button>
            <button
              onClick={() => router.push('/employees')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors shadow-sm"
            >
              <FiArrowLeft className="w-4 h-4" />
              Back to Employees
            </button>
          </div>
        </div>
      </div>
    );
  }

  const badge = getStatusBadge(employee.status);
  const initials = `${employee.firstName[0]}${employee.lastName[0]}`;
  const daysEmployed = Math.floor((now - new Date(employee.dateOfJoining).getTime()) / (1000 * 60 * 60 * 24));
  const totalLeaveBalance = employee.leaveBalances?.reduce((sum, lb) => sum + lb.remaining, 0) || 0;
  const attendanceRate = attendance.length > 0 ? Math.round((attendance.filter(a => ['present', 'late'].includes(a.status)).length / attendance.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════
          PROFILE HEADER CARD — SmartHR Style
          ═══════════════════════════════════════════ */}
      <div className="thb-card overflow-hidden">
        {/* Gradient Strip */}
        <div className="h-32 bg-gradient-to-r from-teal-600 via-fuchsia-500 to-cyan-400 relative">
          {/* Subtle pattern overlay */}
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
        </div>

        {/* Profile Content - overlaps the gradient */}
        <div className="px-6 pb-6 -mt-12 relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {employee.avatar ? (
                <img
                  src={employee.avatar}
                  alt={`${employee.firstName} ${employee.lastName}`}
                  className="w-[120px] h-[120px] rounded-2xl object-cover border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-[120px] h-[120px] rounded-2xl bg-gradient-to-br from-rose-500 via-teal-500 to-emerald-600 flex items-center justify-center text-white text-4xl font-bold border-4 border-white shadow-lg">
                  {initials}
                </div>
              )}
            </div>

            {/* Name, Designation, Meta */}
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-thb-text-primary tracking-tight">
                  {employee.firstName} {employee.lastName}
                </h1>
                <span className={badge.className}>{badge.label}</span>
              </div>
              <p className="text-sm text-thb-text-secondary font-medium mb-2">
                {employee.designation?.title || 'No Designation'}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-thb-text-muted">
                <span className="inline-flex items-center gap-1.5 bg-white border border-thb-border rounded-md px-2.5 py-1 font-medium text-thb-text-secondary shadow-sm">
                  <FiHash className="w-3 h-3" />
                  {employee.employeeId}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <FiBriefcase className="w-3 h-3" />
                  {employee.department?.name || 'No Department'}
                </span>
                {employee.branch && (
                  <span className="inline-flex items-center gap-1.5">
                    <FiBriefcase className="w-3 h-3" />
                    {employee.branch.name}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <FiCalendar className="w-3 h-3" />
                  Joined {formatDate(employee.dateOfJoining)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0 sm:pb-1">
              <button
                onClick={() => router.push(`/employees?editId=${id}`)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-600 via-fuchsia-500 to-cyan-500 text-white rounded-lg text-sm font-medium hover:from-teal-700 hover:via-fuchsia-600 hover:to-cyan-600 transition-all shadow-md shadow-fuchsia-200/50"
              >
                <FiEdit2 className="w-3.5 h-3.5" />
                Edit
              </button>
              <button
                onClick={() => router.push('/employees')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-thb-border text-thb-text-secondary rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
              >
                <FiArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          STAT CARDS ROW
          ═══════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<FiCalendar className="w-5 h-5 text-green-600" />}
          label="Days Employed"
          value={daysEmployed}
          subtitle={`Since ${formatDate(employee.dateOfJoining)}`}
          colorClass="bg-gradient-to-br from-green-100 to-green-50"
          borderGradient="from-green-500 via-green-400 to-cyan-400"
        />
        <StatCard
          icon={<FiClock className="w-5 h-5 text-emerald-600" />}
          label="Attendance Rate"
          value={`${attendanceRate}%`}
          subtitle="Last 30 days"
          colorClass="bg-gradient-to-br from-emerald-100 to-emerald-50"
          borderGradient="from-emerald-500 via-teal-400 to-green-400"
        />
        <StatCard
          icon={<FiCalendar className="w-5 h-5 text-amber-600" />}
          label="Leave Balance"
          value={totalLeaveBalance}
          subtitle="Days remaining"
          colorClass="bg-gradient-to-br from-amber-100 to-amber-50"
          borderGradient="from-amber-500 via-orange-400 to-yellow-400"
        />
        <StatCard
          icon={<FiDollarSign className="w-5 h-5 text-teal-600" />}
          label="Salary"
          value={employee.salary ? `${employee.salaryCurrency || 'INR'} ${(employee.salary / 1000).toFixed(0)}K` : '—'}
          subtitle={employee.salary ? employee.salary.toLocaleString() : undefined}
          colorClass="bg-gradient-to-br from-teal-100 to-teal-50"
          borderGradient="from-teal-500 via-teal-400 to-fuchsia-400"
        />
      </div>

      {/* ═══════════════════════════════════════════
          TAB NAVIGATION + CONTENT
          ═══════════════════════════════════════════ */}
      <div className="thb-card overflow-hidden">
        {/* Tab Bar */}
        <div className="border-b border-thb-border bg-gradient-to-r from-teal-50/30 via-green-50/20 to-cyan-50/30 overflow-x-auto">
          <nav className="flex px-6">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-4 py-3.5 text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab
                    ? 'text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-cyan-500'
                    : 'text-thb-text-muted hover:text-thb-text-primary'
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-teal-500 via-fuchsia-500 to-cyan-400 rounded-full" />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">

          {/* ── Overview Tab ── */}
          {activeTab === 'Overview' && (
            <div className="space-y-6">
              {/* Personal Information */}
              <SectionCard title="Personal Information" icon={<FiUser className="w-4 h-4 text-green-500" />} accentGradient="from-green-500 via-emerald-400 to-teal-400">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-0">
                  <InfoField label="Full Name" value={`${employee.firstName} ${employee.lastName}`} icon={<FiUser className="w-3.5 h-3.5" />} />
                  <InfoField label="Date of Birth" value={formatDate(employee.dateOfBirth)} icon={<FiCalendar className="w-3.5 h-3.5" />} />
                  <InfoField label="Gender" value={employee.gender} icon={<FiUser className="w-3.5 h-3.5" />} />
                  <InfoField label="Marital Status" value={employee.maritalStatus} icon={<FiHeart className="w-3.5 h-3.5" />} />
                  <InfoField label="Nationality" value={employee.nationality} icon={<FiGlobe className="w-3.5 h-3.5" />} />
                  <InfoField label="Blood Group" value={employee.bloodGroup} icon={<FiDroplet className="w-3.5 h-3.5" />} />
                </div>
              </SectionCard>

              {/* Contact Information */}
              <SectionCard title="Contact Information" icon={<FiMail className="w-4 h-4 text-emerald-500" />} accentGradient="from-emerald-500 via-teal-400 to-cyan-400">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-0">
                  <InfoField label="Email" value={employee.email} icon={<FiMail className="w-3.5 h-3.5" />} />
                  <InfoField label="Phone" value={employee.phone} icon={<FiPhone className="w-3.5 h-3.5" />} />
                  <InfoField label="Address" value={employee.address} icon={<FiHome className="w-3.5 h-3.5" />} />
                  <InfoField label="City" value={employee.city} icon={<FiMapPin className="w-3.5 h-3.5" />} />
                  <InfoField label="State" value={employee.state} />
                  <InfoField label="ZIP Code" value={employee.zipCode} />
                  <InfoField label="Country" value={employee.country} icon={<FiGlobe className="w-3.5 h-3.5" />} />
                </div>
              </SectionCard>

              {/* Emergency Contact */}
              <SectionCard title="Emergency Contact" icon={<FiHeart className="w-4 h-4 text-rose-500" />} accentGradient="from-rose-500 via-pink-400 to-fuchsia-400">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-0">
                  <InfoField label="Contact Name" value={employee.emergencyContactName} icon={<FiUser className="w-3.5 h-3.5" />} />
                  <InfoField label="Contact Phone" value={employee.emergencyContactPhone} icon={<FiPhone className="w-3.5 h-3.5" />} />
                </div>
              </SectionCard>

              {/* Skills */}
              {employee.skills && employee.skills.length > 0 && (
                <SectionCard title="Skills" icon={<FiAward className="w-4 h-4 text-teal-500" />} accentGradient="from-teal-500 via-teal-400 to-fuchsia-400">
                  <div className="flex flex-wrap gap-2">
                    {employee.skills.map(s => (
                      <span key={s.id} className="inline-flex items-center gap-1.5 bg-gradient-to-r from-teal-100 to-fuchsia-100 text-teal-700 px-2.5 py-1 rounded-full text-xs font-medium shadow-sm">
                        <FiTrendingUp className="w-3 h-3" />
                        {s.skill}
                        <span className="opacity-60">·</span>
                        {s.level}
                      </span>
                    ))}
                  </div>
                </SectionCard>
              )}
            </div>
          )}

          {/* ── Personal Tab ── */}
          {activeTab === 'Personal' && (
            <div className="space-y-6">
              {/* Personal Details */}
              <SectionCard title="Personal Details" icon={<FiUser className="w-4 h-4 text-green-500" />} accentGradient="from-green-500 via-emerald-400 to-teal-400">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-0">
                  <InfoField label="First Name" value={employee.firstName} />
                  <InfoField label="Last Name" value={employee.lastName} />
                  <InfoField label="Email" value={employee.email} icon={<FiMail className="w-3.5 h-3.5" />} />
                  <InfoField label="Phone" value={employee.phone} icon={<FiPhone className="w-3.5 h-3.5" />} />
                  <InfoField label="Date of Birth" value={formatDate(employee.dateOfBirth)} icon={<FiCalendar className="w-3.5 h-3.5" />} />
                  <InfoField label="Gender" value={employee.gender} />
                  <InfoField label="Marital Status" value={employee.maritalStatus} />
                  <InfoField label="Nationality" value={employee.nationality} icon={<FiGlobe className="w-3.5 h-3.5" />} />
                  <InfoField label="Blood Group" value={employee.bloodGroup} icon={<FiDroplet className="w-3.5 h-3.5" />} />
                </div>
              </SectionCard>

              {/* Address */}
              <SectionCard title="Address" icon={<FiMapPin className="w-4 h-4 text-emerald-500" />} accentGradient="from-emerald-500 via-teal-400 to-cyan-400">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-0">
                  <InfoField label="Street Address" value={employee.address} icon={<FiHome className="w-3.5 h-3.5" />} />
                  <InfoField label="City" value={employee.city} icon={<FiMapPin className="w-3.5 h-3.5" />} />
                  <InfoField label="State" value={employee.state} />
                  <InfoField label="ZIP Code" value={employee.zipCode} />
                  <InfoField label="Country" value={employee.country} icon={<FiGlobe className="w-3.5 h-3.5" />} />
                </div>
              </SectionCard>

              {/* Emergency Contact */}
              <SectionCard title="Emergency Contact" icon={<FiHeart className="w-4 h-4 text-rose-500" />} accentGradient="from-rose-500 via-pink-400 to-fuchsia-400">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-0">
                  <InfoField label="Contact Name" value={employee.emergencyContactName} icon={<FiUser className="w-3.5 h-3.5" />} />
                  <InfoField label="Contact Phone" value={employee.emergencyContactPhone} icon={<FiPhone className="w-3.5 h-3.5" />} />
                </div>
              </SectionCard>

              {/* Dependents */}
              {employee.dependents && employee.dependents.length > 0 && (
                <SectionCard title="Dependents" icon={<FiUsers className="w-4 h-4 text-amber-500" />} accentGradient="from-amber-500 via-orange-400 to-yellow-400">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-thb-border">
                          <th className="text-left py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Name</th>
                          <th className="text-left py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Relation</th>
                          <th className="text-left py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Date of Birth</th>
                          <th className="text-left py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Gender</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employee.dependents.map(dep => (
                          <tr key={dep.id} className="border-b border-thb-border/50 hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 text-sm font-medium text-thb-text-primary">{dep.name}</td>
                            <td className="py-3 text-sm text-thb-text-secondary">{dep.relation}</td>
                            <td className="py-3 text-sm text-thb-text-secondary">{formatDate(dep.dateOfBirth)}</td>
                            <td className="py-3 text-sm text-thb-text-secondary">{dep.gender || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              )}
            </div>
          )}

          {/* ── Employment Tab ── */}
          {activeTab === 'Employment' && (
            <div className="space-y-6">
              {/* Employment Details */}
              <SectionCard title="Employment Details" icon={<FiBriefcase className="w-4 h-4 text-green-500" />} accentGradient="from-green-500 via-emerald-400 to-teal-400">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-0">
                  <InfoField label="Employee ID" value={employee.employeeId} icon={<FiHash className="w-3.5 h-3.5" />} />
                  <InfoField label="Department" value={employee.department?.name} icon={<FiBriefcase className="w-3.5 h-3.5" />} />
                  <InfoField label="Designation" value={employee.designation?.title} icon={<FiUser className="w-3.5 h-3.5" />} />
                  <InfoField label="Branch" value={employee.branch?.name} icon={<FiBriefcase className="w-3.5 h-3.5" />} />
                  <InfoField label="Date of Joining" value={formatDate(employee.dateOfJoining)} icon={<FiCalendar className="w-3.5 h-3.5" />} />
                  <InfoField label="Status" value={badge.label} />
                </div>
              </SectionCard>

              {/* Salary Information */}
              <SectionCard title="Salary Information" icon={<FiDollarSign className="w-4 h-4 text-emerald-500" />} accentGradient="from-emerald-500 via-teal-400 to-cyan-400">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-0">
                  <InfoField label="Salary" value={employee.salary ? `${employee.salaryCurrency || 'INR'} ${employee.salary.toLocaleString()}` : '—'} icon={<FiDollarSign className="w-3.5 h-3.5" />} />
                  <InfoField label="Currency" value={employee.salaryCurrency || 'INR'} />
                </div>
              </SectionCard>

              {/* Bank Details */}
              <SectionCard title="Bank & Statutory Details" icon={<FiShield className="w-4 h-4 text-teal-500" />} accentGradient="from-teal-500 via-teal-400 to-fuchsia-400">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-0">
                  <InfoField label="Bank Name" value={employee.bankName} icon={<FiBriefcase className="w-3.5 h-3.5" />} />
                  <InfoField label="Account No" value={employee.bankAccountNo} icon={<FiHash className="w-3.5 h-3.5" />} />
                  <InfoField label="IFSC Code" value={employee.bankIfscCode} />
                  <InfoField label="PAN Number" value={employee.panNumber} icon={<FiFileText className="w-3.5 h-3.5" />} />
                  <InfoField label="Aadhaar Number" value={employee.aadhaarNumber} icon={<FiShield className="w-3.5 h-3.5" />} />
                </div>
              </SectionCard>

              {/* Work Experience */}
              {employee.experiences && employee.experiences.length > 0 && (
                <SectionCard title="Work Experience" icon={<FiTrendingUp className="w-4 h-4 text-amber-500" />} accentGradient="from-amber-500 via-orange-400 to-yellow-400">
                  <div className="space-y-4">
                    {employee.experiences.map(exp => (
                      <div key={exp.id} className="flex items-start gap-4 p-4 rounded-xl border border-thb-border hover:bg-slate-50/50 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center flex-shrink-0">
                          <FiBriefcase className="w-5 h-5 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-thb-text-primary">{exp.company}</p>
                            {exp.isCurrent && <span className="thb-badge thb-badge-success">Current</span>}
                          </div>
                          <p className="text-xs text-thb-text-secondary mt-0.5">{exp.designation}</p>
                          <p className="text-xs text-thb-text-muted mt-1">
                            {formatDate(exp.startDate)} — {exp.endDate ? formatDate(exp.endDate) : 'Present'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* Qualifications */}
              {employee.qualifications && employee.qualifications.length > 0 && (
                <SectionCard title="Qualifications" icon={<FiAward className="w-4 h-4 text-green-500" />} accentGradient="from-green-500 via-emerald-400 to-teal-400">
                  <div className="space-y-4">
                    {employee.qualifications.map(q => (
                      <div key={q.id} className="flex items-start gap-4 p-4 rounded-xl border border-thb-border hover:bg-slate-50/50 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-100 to-green-50 flex items-center justify-center flex-shrink-0">
                          <FiAward className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-thb-text-primary">{q.degree}</p>
                          <p className="text-xs text-thb-text-secondary mt-0.5">{q.institution}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-thb-text-muted">Year: {q.year}</span>
                            {q.percentage && <span className="text-xs text-thb-text-muted">Score: {q.percentage}%</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}
            </div>
          )}

          {/* ── Documents Tab ── */}
          {activeTab === 'Documents' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-thb-text-primary">Documents</h3>
                  <p className="text-xs text-thb-text-muted mt-0.5">{employee.documents?.length || 0} documents on file</p>
                </div>
                <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors shadow-sm">
                  <FiUpload className="w-3.5 h-3.5" />
                  Upload Document
                </button>
              </div>
              {(!employee.documents || employee.documents.length === 0) ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <FiFileText className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-sm font-medium text-thb-text-secondary mb-1">No documents uploaded</p>
                  <p className="text-xs text-thb-text-muted">Upload documents to keep employee records complete.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-thb-border">
                        <th className="text-left py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Name</th>
                        <th className="text-left py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Type</th>
                        <th className="text-left py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Status</th>
                        <th className="text-left py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Uploaded</th>
                        <th className="text-left py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Expiry</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employee.documents.map(doc => (
                        <tr key={doc.id} className="border-b border-thb-border/50 hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 text-sm font-medium text-thb-text-primary">{doc.name}</td>
                          <td className="py-3 text-sm text-thb-text-secondary capitalize">{doc.type.replace('_', ' ')}</td>
                          <td className="py-3"><span className="thb-badge thb-badge-success">{doc.status}</span></td>
                          <td className="py-3 text-sm text-thb-text-secondary">{formatDate(doc.uploadedAt)}</td>
                          <td className="py-3 text-sm text-thb-text-secondary">{formatDate(doc.expiryDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Leave Tab ── */}
          {activeTab === 'Leave' && (
            <div className="space-y-6">
              {/* Leave Balances */}
              {employee.leaveBalances && employee.leaveBalances.length > 0 && (
                <SectionCard title="Leave Balances" icon={<FiCalendar className="w-4 h-4 text-green-500" />} accentGradient="from-green-500 via-emerald-400 to-teal-400">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {employee.leaveBalances.map(lb => {
                      const pct = lb.total > 0 ? (lb.used / lb.total) * 100 : 0;
                      const barColor = pct > 80 ? 'bg-gradient-to-r from-red-500 to-rose-400' : pct > 50 ? 'bg-gradient-to-r from-amber-500 to-orange-400' : 'bg-gradient-to-r from-green-500 to-cyan-400';
                      return (
                        <div key={lb.id} className="p-4 rounded-xl border border-thb-border hover:shadow-md transition-all hover:border-green-200">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold text-thb-text-primary">{lb.leaveType.name}</p>
                            <span className="text-xs font-medium text-thb-text-muted">{lb.year}</span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                            <div className={`h-full rounded-full transition-all shadow-sm ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex items-center justify-between text-xs text-thb-text-muted">
                            <span>Total: <strong className="text-thb-text-secondary">{lb.total}</strong></span>
                            <span>Used: <strong className="text-thb-text-secondary">{lb.used}</strong></span>
                            <span>Remaining: <strong className="text-emerald-600">{lb.remaining}</strong></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>
              )}

              {/* Leave History */}
              <SectionCard title="Leave History" icon={<FiClock className="w-4 h-4 text-amber-500" />} accentGradient="from-amber-500 via-orange-400 to-yellow-400">
                {leaveRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                      <FiCalendar className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-sm text-thb-text-muted">No leave requests found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-thb-border">
                          <th className="text-left py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Type</th>
                          <th className="text-left py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">From</th>
                          <th className="text-left py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">To</th>
                          <th className="text-left py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Reason</th>
                          <th className="text-left py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaveRequests.map(lr => {
                          const statusMap: Record<string, string> = { pending: 'thb-badge thb-badge-warning', approved: 'thb-badge thb-badge-success', rejected: 'thb-badge thb-badge-error', cancelled: 'bg-slate-100 text-slate-600 thb-badge' };
                          return (
                            <tr key={lr.id} className="border-b border-thb-border/50 hover:bg-slate-50/50 transition-colors">
                              <td className="py-3 text-sm font-medium text-thb-text-primary">{lr.leaveType.name}</td>
                              <td className="py-3 text-sm text-thb-text-secondary">{formatDate(lr.startDate)}</td>
                              <td className="py-3 text-sm text-thb-text-secondary">{formatDate(lr.endDate)}</td>
                              <td className="py-3 text-sm text-thb-text-secondary truncate max-w-[200px]">{lr.reason || '—'}</td>
                              <td className="py-3"><span className={statusMap[lr.status] || 'thb-badge thb-badge-info'}>{lr.status}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          {/* ── Attendance Tab ── */}
          {activeTab === 'Attendance' && (
            <SectionCard title="Recent Attendance" icon={<FiClock className="w-4 h-4 text-emerald-500" />} accentGradient="from-emerald-500 via-teal-400 to-cyan-400">
              {attendance.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <FiClock className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-sm text-thb-text-muted">No attendance records found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-thb-border">
                        <th className="text-left py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Date</th>
                        <th className="text-left py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Check In</th>
                        <th className="text-left py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Check Out</th>
                        <th className="text-left py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Work Hours</th>
                        <th className="text-left py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Overtime</th>
                        <th className="text-left py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.map(a => {
                        const statusMap: Record<string, string> = { present: 'thb-badge thb-badge-success', absent: 'thb-badge thb-badge-error', late: 'bg-orange-50 text-orange-700 thb-badge', half_day: 'thb-badge thb-badge-warning', holiday: 'thb-badge thb-badge-info', weekend: 'bg-slate-100 text-slate-600 thb-badge', on_leave: 'thb-badge thb-badge-warning' };
                        return (
                          <tr key={a.id} className="border-b border-thb-border/50 hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 text-sm font-medium text-thb-text-primary">{formatDate(a.date)}</td>
                            <td className="py-3 text-sm text-thb-text-secondary">{a.checkIn ? formatDateTime(a.checkIn) : '—'}</td>
                            <td className="py-3 text-sm text-thb-text-secondary">{a.checkOut ? formatDateTime(a.checkOut) : '—'}</td>
                            <td className="py-3 text-sm text-thb-text-secondary">{a.workHours != null ? `${a.workHours}h` : '—'}</td>
                            <td className="py-3 text-sm text-thb-text-secondary">{a.overtime != null && a.overtime > 0 ? `${a.overtime}h` : '—'}</td>
                            <td className="py-3"><span className={statusMap[a.status] || 'thb-badge thb-badge-info'}>{a.status.replace('_', ' ')}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

          {/* ── Payroll Tab ── */}
          {activeTab === 'Payroll' && (
            <SectionCard title="Recent Payslips" icon={<FiDollarSign className="w-4 h-4 text-emerald-500" />} accentGradient="from-emerald-500 via-teal-400 to-cyan-400">
              {payrolls.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <FiDollarSign className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-sm text-thb-text-muted">No payroll records found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-thb-border">
                        <th className="text-left py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Month</th>
                        <th className="text-left py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Gross Salary</th>
                        <th className="text-left py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Deductions</th>
                        <th className="text-left py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Net Salary</th>
                        <th className="text-left py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payrolls.map(p => {
                        const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        const statusMap: Record<string, string> = { draft: 'thb-badge thb-badge-warning', processed: 'thb-badge thb-badge-info', paid: 'thb-badge thb-badge-success', cancelled: 'thb-badge thb-badge-error' };
                        return (
                          <tr key={p.id} className="border-b border-thb-border/50 hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 text-sm font-medium text-thb-text-primary">{months[p.month]} {p.year}</td>
                            <td className="py-3 text-sm text-thb-text-secondary">${p.grossSalary.toLocaleString()}</td>
                            <td className="py-3 text-sm text-red-500">${p.totalDeductions.toLocaleString()}</td>
                            <td className="py-3 text-sm font-semibold text-emerald-600">${p.netSalary.toLocaleString()}</td>
                            <td className="py-3"><span className={statusMap[p.status] || 'thb-badge thb-badge-info'}>{p.status}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

          {/* ── Health Tab ── */}
          {activeTab === 'Health' && (
            <div className="space-y-6">
              {/* Vitals & Blood */}
              <SectionCard title="Vitals & Blood Information" icon={<FiHeart className="w-4 h-4 text-red-500" />} accentGradient="from-red-500 via-rose-400 to-pink-400">
                <p className="text-xs text-thb-text-muted mb-4">Employee health information for workplace safety and emergency preparedness.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
                  <InfoField label="Blood Group" value={employee.bloodGroup} icon={<FiDroplet className="w-3.5 h-3.5" />} />
                  <InfoField label="Emergency Condition" value={(employee as Record<string, unknown>).emergencyMedicalCondition as string} />
                </div>
              </SectionCard>

              {/* Medical History */}
              <SectionCard title="Medical History" icon={<FiShield className="w-4 h-4 text-amber-500" />} accentGradient="from-amber-500 via-orange-400 to-yellow-400">
                <div className="space-y-3">
                  {[
                    { label: 'Chronic Illness', value: (employee as Record<string, unknown>).hasChronicIllness as string, details: (employee as Record<string, unknown>).chronicIllnessDetails as string },
                    { label: 'Allergies', value: (employee as Record<string, unknown>).hasAllergies as string, details: (employee as Record<string, unknown>).allergyDetails as string },
                    { label: 'Disability', value: (employee as Record<string, unknown>).hasDisability as string, details: (employee as Record<string, unknown>).disabilityDetails as string },
                    { label: 'On Medication', value: (employee as Record<string, unknown>).isOnMedication as string, details: (employee as Record<string, unknown>).medicationDetails as string },
                    { label: 'Previous Surgery', value: (employee as Record<string, unknown>).hasHadSurgery as string, details: (employee as Record<string, unknown>).surgeryDetails as string },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3 p-3 rounded-lg border border-thb-border hover:bg-slate-50/50 transition-colors">
                      {item.value === 'yes' ? (
                        <FiCheckCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      ) : (
                        <FiXCircle className="w-4 h-4 text-slate-300 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-thb-text-primary">{item.label}</p>
                        <p className="text-xs text-thb-text-muted">{item.value === 'yes' ? `Yes — ${item.details || 'No details provided'}` : item.value === 'no' ? 'No' : '—'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* Physician & Insurance */}
              <SectionCard title="Physician & Insurance" icon={<FiShield className="w-4 h-4 text-green-500" />} accentGradient="from-green-500 via-emerald-400 to-teal-400">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-0">
                  <InfoField label="Primary Physician" value={(employee as Record<string, unknown>).primaryPhysicianName as string} icon={<FiUser className="w-3.5 h-3.5" />} />
                  <InfoField label="Physician Phone" value={(employee as Record<string, unknown>).primaryPhysicianPhone as string} icon={<FiPhone className="w-3.5 h-3.5" />} />
                  <InfoField label="Insurance Provider" value={(employee as Record<string, unknown>).healthInsuranceProvider as string} icon={<FiShield className="w-3.5 h-3.5" />} />
                  <InfoField label="Policy Number" value={(employee as Record<string, unknown>).healthInsurancePolicyNo as string} icon={<FiFileText className="w-3.5 h-3.5" />} />
                </div>
              </SectionCard>
            </div>
          )}

          {/* ── Policies Tab ── */}
          {activeTab === 'Policies' && <EmployeePoliciesTab employeeId={employee.id} />}

          {/* ── Company Mapping Tab ── */}
          {activeTab === 'Company Mapping' && (
            <div className="space-y-5">
              {/* Info Banner */}
              <div className="thb-card border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-50/60 to-teal-50/40">
                <div className="p-4 flex items-start gap-3">
                  <FiBriefcase className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-900 mb-1">Company Mappings</p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      This employee can be mapped to multiple companies with different employee IDs per company.
                      When mapped, they can switch between companies using the header dropdown.
                    </p>
                  </div>
                </div>
              </div>

              {/* Mapping Summary */}
              <div className="thb-card overflow-hidden">
                <div className="px-5 py-4 border-b border-thb-border flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-thb-text-primary flex items-center gap-2">
                      <FiBriefcase className="w-4 h-4 text-emerald-500" />
                      Company Mapping Overview
                    </h3>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                        {companyMappings.filter(m => !m.isPrimary).length + 1} Total Compan{companyMappings.filter(m => !m.isPrimary).length + 1 === 1 ? 'y' : 'ies'}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                        {companyMappings.filter(m => !m.isPrimary).length + 1} Primary
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                        {companyMappings.filter(m => !m.isPrimary).length} Secondary
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push('/employees/settings')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    <FiEdit2 className="w-3.5 h-3.5" /> Manage Mappings
                  </button>
                </div>

                {/* All Company Mappings - including primary */}
                <div className="divide-y divide-thb-border">
                  {/* Primary Company (from Employee record) */}
                  <div className="flex items-center gap-4 px-5 py-4 bg-emerald-50/30">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                      <FiBriefcase className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-thb-text-primary">{employee.company?.name || employee.department?.company?.name || employee.branch?.company?.name || 'Primary Company'}</p>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">PRIMARY</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-thb-text-secondary font-medium">Employee ID: <span className="text-emerald-600 font-bold">{employee.employeeId}</span></span>
                        {employee.designation && <span className="text-xs text-thb-text-muted">Designation: {employee.designation.title}</span>}
                        {employee.department && <span className="text-xs text-thb-text-muted">Dept: {employee.department.name}</span>}
                        {employee.branch && <span className="text-xs text-thb-text-muted">Branch: {employee.branch.name}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Additional Company Mappings (excluding primary which is shown above) */}
                  {companyMappings.filter(m => !m.isPrimary).length === 0 ? (
                    <div className="px-5 py-6 text-center">
                      <FiGlobe className="w-6 h-6 text-thb-text-muted mx-auto mb-2" />
                      <p className="text-sm text-thb-text-muted">No additional company mappings</p>
                      <p className="text-xs text-thb-text-muted mt-1">
                        Go to <button onClick={() => router.push('/employees/settings')} className="text-green-600 hover:underline font-medium">Employee Settings &gt; Map Company</button> to add mappings
                      </p>
                    </div>
                  ) : (
                    companyMappings.filter(m => !m.isPrimary).map(mapping => (
                      <div key={mapping.id} className={`flex items-center gap-4 px-5 py-4 ${mapping.isPrimary ? 'bg-green-50/20' : ''}`}>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${mapping.isPrimary ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          <FiGlobe className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-thb-text-primary">{mapping.company?.name || 'Unknown Company'}</p>
                            {mapping.isPrimary ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">PRIMARY</span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">SECONDARY</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-thb-text-secondary font-medium">Employee ID: <span className={mapping.isPrimary ? 'text-emerald-600 font-bold' : 'text-slate-700 font-bold'}>{mapping.employeeCode}</span></span>
                            {mapping.department && <span className="text-xs text-thb-text-muted">Dept: {mapping.department.name}</span>}
                            {mapping.designation && <span className="text-xs text-thb-text-muted">Role: {mapping.designation.title}</span>}
                            {mapping.branch && <span className="text-xs text-thb-text-muted">Branch: {mapping.branch.name}</span>}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Summary Bar */}
                <div className="px-5 py-3 bg-slate-50 border-t border-thb-border">
                  <div className="flex items-center gap-4 text-xs text-thb-text-muted flex-wrap">
                    <span className="font-medium">Summary:</span>
                    <span>{companyMappings.filter(m => !m.isPrimary).length + 1} compan{(companyMappings.filter(m => !m.isPrimary).length + 1) === 1 ? 'y' : 'ies'} mapped</span>
                    <span className="text-emerald-600 font-semibold">1 primary</span>
                    <span className="text-slate-500">{companyMappings.filter(m => !m.isPrimary).length} secondary</span>
                    <span className="ml-auto font-medium">Employee IDs: {[employee.employeeId, ...companyMappings.filter(m => !m.isPrimary).map(m => m.employeeCode)].join(', ')}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
