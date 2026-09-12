'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FiUser,
  FiMail,
  FiPhone,
  FiMapPin,
  FiBriefcase,
  FiHeart,
  FiDollarSign,
  FiShield,
  FiFileText,
  FiCalendar,
  FiClock,
  FiEdit2,
  FiAlertTriangle,
  FiHome,
  FiCreditCard,
  FiBookOpen,
  FiStar,
  FiCheckCircle,
  FiInfo,
  FiActivity,
  FiHash,
  FiRefreshCw,
  FiGlobe,
  FiCheck,
  FiX,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';

/* ──────────────────────────────────────────────
   Auth Helper
   ────────────────────────────────────────────── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/* ──────────────────────────────────────────────
   Tab definitions
   ────────────────────────────────────────────── */
type ProfileTab = 'personal' | 'address' | 'employment' | 'bank' | 'salary' | 'emergency' | 'health' | 'policies' | 'documents' | 'experience';

const profileTabs: { key: ProfileTab; label: string; icon: React.ReactNode }[] = [
  { key: 'personal', label: 'Personal', icon: <FiUser className="w-4 h-4" /> },
  { key: 'address', label: 'Address', icon: <FiMapPin className="w-4 h-4" /> },
  { key: 'employment', label: 'Employment', icon: <FiBriefcase className="w-4 h-4" /> },
  { key: 'bank', label: 'Bank & Finance', icon: <FiCreditCard className="w-4 h-4" /> },
  { key: 'salary', label: 'Salary', icon: <FiDollarSign className="w-4 h-4" /> },
  { key: 'emergency', label: 'Emergency', icon: <FiHeart className="w-4 h-4" /> },
  { key: 'health', label: 'Health', icon: <FiShield className="w-4 h-4" /> },
  { key: 'policies', label: 'Policies', icon: <FiFileText className="w-4 h-4" /> },
  { key: 'experience', label: 'Experience', icon: <FiStar className="w-4 h-4" /> },
  { key: 'documents', label: 'Documents', icon: <FiBookOpen className="w-4 h-4" /> },
];

/* ──────────────────────────────────────────────
   Helper components – SmartHR Enhanced
   ────────────────────────────────────────────── */

/** Accent color type for section cards */
type AccentColor = 'blue' | 'emerald' | 'violet' | 'rose' | 'amber' | 'teal' | 'slate';

const accentMap: Record<AccentColor, { strip: string; iconBg: string; iconColor: string }> = {
  blue:    { strip: 'from-green-500 to-green-400',   iconBg: 'bg-green-50',    iconColor: 'text-green-500' },
  emerald: { strip: 'from-emerald-500 to-emerald-400', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500' },
  violet:  { strip: 'from-teal-500 to-teal-400',   iconBg: 'bg-teal-50',  iconColor: 'text-teal-500' },
  rose:    { strip: 'from-rose-500 to-rose-400',       iconBg: 'bg-rose-50',    iconColor: 'text-rose-500' },
  amber:   { strip: 'from-amber-500 to-amber-400',     iconBg: 'bg-amber-50',   iconColor: 'text-amber-500' },
  teal:    { strip: 'from-teal-500 to-teal-400',       iconBg: 'bg-teal-50',    iconColor: 'text-teal-500' },
  slate:   { strip: 'from-slate-400 to-slate-300',     iconBg: 'bg-slate-50',   iconColor: 'text-slate-500' },
};

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="group">
      <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-thb-text-muted mb-1.5">
        {icon && <span className="opacity-60 group-hover:opacity-100 transition-opacity">{icon}</span>}
        {label}
      </label>
      <div className="px-3 py-2.5 text-sm text-thb-text-primary bg-gradient-to-br from-slate-50/80 to-slate-100/60 rounded-lg border border-thb-border/40 hover:border-thb-border/80 transition-colors min-h-[38px] flex items-center">
        {value || <span className="text-thb-text-muted italic">Not provided</span>}
      </div>
    </div>
  );
}

function SectionCard({ title, icon, accent = 'blue', children, rightAction }: {
  title: string; icon: React.ReactNode; accent?: AccentColor; children: React.ReactNode; rightAction?: React.ReactNode;
}) {
  const colors = accentMap[accent] || accentMap.blue;
  return (
    <div className="thb-card overflow-hidden">
      {/* Gradient accent strip */}
      <div className={`h-[3px] bg-gradient-to-r ${colors.strip}`} />
      <div className="p-5">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-thb-border/60">
          <h4 className="text-sm font-semibold text-thb-text-primary flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg ${colors.iconBg} flex items-center justify-center shadow-sm`}>
              <span className={colors.iconColor}>{icon}</span>
            </div>
            {title}
          </h4>
          {rightAction}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
      </div>
    </div>
  );
}

/** Mini stat card for the stats row */
function StatCard({ icon, label, value, subtext, colorClass }: {
  icon: React.ReactNode; label: string; value: string; subtext?: string; colorClass: string;
}) {
  return (
    <div className="thb-card thb-card-hover p-4 flex items-start gap-3.5">
      <div className={`w-10 h-10 rounded-xl ${colorClass} flex items-center justify-center shrink-0 shadow-sm`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-thb-text-muted leading-tight">{label}</p>
        <p className="text-lg font-bold text-thb-text-primary mt-0.5 leading-tight">{value}</p>
        {subtext && <p className="text-[11px] text-thb-text-muted mt-0.5">{subtext}</p>}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Main Component
   ────────────────────────────────────────────── */
export default function MyProfilePage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<ProfileTab>('personal');
  const [profileData, setProfileData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/users/profile', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setProfileData(data);
        // Initialize edit form with current data
        const emp = data.employee as Record<string, unknown> | null;
        setEditForm({
          name: data.name || '',
          phone: (emp?.phone as string) || '',
          emergencyContactName: (emp?.emergencyContactName as string) || '',
          emergencyContactPhone: (emp?.emergencyContactPhone as string) || '',
          address: (emp?.address as string) || '',
          city: (emp?.city as string) || '',
          state: (emp?.state as string) || '',
          zipCode: (emp?.zipCode as string) || '',
          country: (emp?.country as string) || '',
          dateOfBirth: (emp?.dateOfBirth as string) || '',
          gender: (emp?.gender as string) || '',
          bloodGroup: (emp?.bloodGroup as string) || '',
        });
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Failed to load profile');
      }
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');
      toast.success('Profile updated successfully');
      setIsEditing(false);
      fetchProfile(); // Reload profile data
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const updateEditField = (field: string, value: string) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const emp = profileData?.employee as Record<string, unknown> | null | undefined;
  const tenant = profileData?.tenant as Record<string, unknown> | null | undefined;
  const debugInfo = profileData?._debug as Record<string, unknown> | undefined;

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const formatDate = (val: unknown) => {
    if (!val || typeof val !== 'string') return '—';
    try { return new Date(val + 'T00:00:00').toLocaleDateString(); } catch { return '—'; }
  };

  const str = (val: unknown): string => (val as string) || '';

  /** Calculate days employed from joining date */
  const getDaysEmployed = () => {
    if (!emp?.dateOfJoining || typeof emp.dateOfJoining !== 'string') return '—';
    try {
      const joinDate = new Date(emp.dateOfJoining + 'T00:00:00');
      const now = new Date();
      const diffMs = now.getTime() - joinDate.getTime();
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (days < 0) return '0';
      if (days < 30) return `${days} day${days !== 1 ? 's' : ''}`;
      const months = Math.floor(days / 30);
      if (months < 12) return `${months} month${months !== 1 ? 's' : ''}`;
      const years = Math.floor(months / 12);
      const remMonths = months % 12;
      return remMonths > 0 ? `${years}y ${remMonths}m` : `${years} year${years !== 1 ? 's' : ''}`;
    } catch {
      return '—';
    }
  };

  /** Get status badge class */
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'active': return 'thb-badge thb-badge-success';
      case 'on_leave': return 'thb-badge thb-badge-warning';
      case 'inactive': return 'thb-badge thb-badge-error';
      case 'resigned': return 'thb-badge thb-badge-error';
      case 'suspended': return 'thb-badge thb-badge-error';
      default: return 'thb-badge thb-badge-info';
    }
  };

  /* ───── Loading State ───── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
            <div className="absolute inset-0 rounded-full border-4 border-green-500 border-t-transparent animate-spin" />
          </div>
          <p className="text-sm font-medium text-thb-text-secondary">Loading your profile...</p>
          <p className="text-xs text-thb-text-muted mt-1">Fetching employee details</p>
        </div>
      </div>
    );
  }

  /* ───── Error State ───── */
  if (error) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="thb-card p-10 text-center max-w-md overflow-hidden">
          <div className="h-[3px] bg-gradient-to-r from-red-500 to-red-400 -mx-10 -mt-10 mb-6" />
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <FiAlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-thb-text-primary mb-2">Failed to Load Profile</h2>
          <p className="text-sm text-thb-text-secondary mb-6">{error}</p>
          <button
            onClick={() => fetchProfile()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors shadow-sm"
          >
            <FiRefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const displayName = user?.name || `${str(emp?.firstName)} ${str(emp?.lastName)}`.trim() || 'Employee';
  const displayEmail = user?.email || str(emp?.email) || '';
  const employeeId = str(emp?.employeeId);
  const status = str(emp?.status);
  const department = str(emp?.department);
  const designation = str(emp?.designation);

  return (
    <div className="space-y-6">
      {/* Debug banner — temporary, remove after fixing */}
      {debugInfo && !emp && (
        <div className="thb-card p-4 border-2 border-amber-300 bg-amber-50">
          <p className="text-sm font-semibold text-amber-800">Debug Info (Profile Data Issue)</p>
          <div className="mt-2 text-xs text-amber-700 space-y-1">
            <p>User found in platform DB: {String(debugInfo.foundInPlatform)}</p>
            <p>Has employee data: {String(debugInfo.hasEmployee)}</p>
            <p>Employee email: {String(debugInfo.empEmail)}</p>
            <p>User email: {str(profileData?.email)}</p>
            <p>User ID: {str(profileData?.id)}</p>
            <p>Tenant: {tenant ? str(tenant?.name) : 'null'}</p>
            <p className="mt-2 text-amber-600">If hasEmployee is false, the Employee record doesn't exist in any DB for this user. The employee list may show data because it queries by companyId, not userId.</p>
          </div>
        </div>
      )}
      {/* ═══════════════════════════════════════════
          Profile Header Card – SmartHR Style
          ═══════════════════════════════════════════ */}
      <div className="thb-card overflow-hidden">
        {/* Gradient Banner */}
        <div className="relative h-[120px] bg-gradient-to-r from-green-600 via-green-500 to-teal-400 overflow-hidden">
          {/* Decorative pattern */}
          <div className="absolute inset-0 opacity-10">
            <svg width="100%" height="100%">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
          {/* Decorative circles */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/5" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/5" />
          <div className="absolute top-4 right-20 w-20 h-20 rounded-full bg-white/5" />
        </div>

        {/* Profile Content – overlaps banner */}
        <div className="relative px-6 pb-6">
          {/* Avatar – overlapping the banner */}
          <div className="-mt-[60px] mb-4 flex items-end justify-between">
            <div className="flex items-end gap-4">
              <div className="w-[120px] h-[120px] rounded-full bg-gradient-to-br from-green-500 to-teal-400 flex items-center justify-center text-white text-[40px] font-bold shadow-xl ring-4 ring-white shrink-0">
                {displayName ? getInitials(displayName) : '??'}
              </div>
              <div className="pb-2">
                <h1 className="text-2xl font-bold text-thb-text-primary leading-tight">{displayName}</h1>
                <p className="text-sm text-thb-text-secondary mt-0.5 flex items-center gap-1.5">
                  <FiMail className="w-3.5 h-3.5" />
                  {displayEmail}
                </p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2 pb-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
                  >
                    {saving ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiCheck className="w-4 h-4" />}
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-colors"
                  >
                    <FiX className="w-4 h-4" />
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-50 text-green-600 text-sm font-medium hover:bg-green-100 transition-colors border border-green-100"
                >
                  <FiEdit2 className="w-4 h-4" />
                  Edit Profile
                </button>
              )}
            </div>
          </div>

          {/* Chips Row */}
          <div className="flex flex-wrap items-center gap-2">
            {employeeId && (
              <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 font-mono font-medium border border-slate-200/80">
                <FiHash className="w-3 h-3 text-slate-400" />
                {employeeId}
              </span>
            )}
            {department && (
              <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-600 font-medium border border-green-100">
                <FiBriefcase className="w-3 h-3" />
                {department}
              </span>
            )}
            {designation && (
              <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-teal-50 text-teal-600 font-medium border border-teal-100">
                <FiStar className="w-3 h-3" />
                {designation}
              </span>
            )}
            {status && (
              <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium capitalize ${getStatusStyle(status)}`}>
                <FiCheckCircle className="w-3 h-3" />
                {status.replace('_', ' ')}
              </span>
            )}
            {str(emp?.dateOfJoining) && (
              <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-teal-50 text-teal-600 font-medium border border-teal-100">
                <FiCalendar className="w-3 h-3" />
                Joined on {formatDate(emp?.dateOfJoining)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          Quick Stats Row
          ═══════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<FiCalendar className="w-5 h-5 text-green-500" />}
          label="Days Employed"
          value={getDaysEmployed()}
          subtext={emp?.dateOfJoining ? `Since ${formatDate(emp.dateOfJoining).split(',')[0]}` : undefined}
          colorClass="bg-green-50"
        />
        <StatCard
          icon={<FiActivity className="w-5 h-5 text-emerald-500" />}
          label="Attendance Rate"
          value="—"
          subtext="Current month"
          colorClass="bg-emerald-50"
        />
        <StatCard
          icon={<FiHeart className="w-5 h-5 text-amber-500" />}
          label="Leave Balance"
          value="—"
          subtext="Available leaves"
          colorClass="bg-amber-50"
        />
        <StatCard
          icon={<FiDollarSign className="w-5 h-5 text-teal-500" />}
          label="Salary"
          value={emp?.salary ? `${str(emp?.salaryCurrency) || 'INR'} ${Number(emp.salary).toLocaleString()}` : '—'}
          subtext={emp?.salary ? 'CTC per month' : undefined}
          colorClass="bg-teal-50"
        />
      </div>

      {/* ═══════════════════════════════════════════
          Tab Navigation – SmartHR Style
          ═══════════════════════════════════════════ */}
      <div className="thb-card overflow-hidden">
        <div className="bg-slate-50/60 border-b border-thb-border overflow-x-auto">
          <nav className="flex min-w-max px-1">
            {profileTabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'text-green-600'
                      : 'text-thb-text-secondary hover:text-thb-text-primary'
                  }`}
                >
                  <span className={isActive ? 'text-green-500' : 'text-thb-text-muted'}>{tab.icon}</span>
                  {tab.label}
                  {/* Active indicator – blue bottom border */}
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-[2.5px] rounded-t-full bg-gradient-to-r from-green-500 to-teal-400" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          Tab Content
          ═══════════════════════════════════════════ */}
      <div className="min-h-[400px]">

        {/* ─── Personal Tab ─── */}
        {activeTab === 'personal' && (
          <div className="space-y-5">
            <SectionCard title="Basic Information" icon={<FiUser className="w-4 h-4" />} accent="blue">
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
                    <input type="text" value={editForm.name || ''} onChange={e => updateEditField('name', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                    <input type="tel" value={editForm.phone || ''} onChange={e => updateEditField('phone', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Gender</label>
                    <select value={editForm.gender || ''} onChange={e => updateEditField('gender', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Blood Group</label>
                    <input type="text" value={editForm.bloodGroup || ''} onChange={e => updateEditField('bloodGroup', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Date of Birth</label>
                    <input type="date" value={editForm.dateOfBirth || ''} onChange={e => updateEditField('dateOfBirth', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                  </div>
                </div>
              ) : (
                <>
                  <InfoRow label="Full Name" value={`${str(emp?.firstName)} ${str(emp?.lastName)}`} icon={<FiUser className="w-3.5 h-3.5" />} />
                  <InfoRow label="Official Email" value={str(emp?.email)} icon={<FiMail className="w-3.5 h-3.5" />} />
                  <InfoRow label="Phone" value={str(emp?.phone)} icon={<FiPhone className="w-3.5 h-3.5" />} />
                  <InfoRow label="Gender" value={str(emp?.gender) ? String(emp?.gender).charAt(0).toUpperCase() + String(emp?.gender).slice(1) : ''} />
                  <InfoRow label="Blood Group" value={str(emp?.bloodGroup)} icon={<FiHeart className="w-3.5 h-3.5" />} />
                  <InfoRow label="Date of Birth" value={formatDate(emp?.dateOfBirth)} icon={<FiCalendar className="w-3.5 h-3.5" />} />
                  <InfoRow label="Marital Status" value={str(emp?.maritalStatus) ? String(emp?.maritalStatus).charAt(0).toUpperCase() + String(emp?.maritalStatus).slice(1) : ''} />
                  <InfoRow label="Nationality" value={str(emp?.nationality)} icon={<FiMapPin className="w-3.5 h-3.5" />} />
                </>
              )}
            </SectionCard>

            <SectionCard title="Quick Info" icon={<FiInfo className="w-4 h-4" />} accent="emerald">
              <InfoRow label="Employee ID" value={str(emp?.employeeId)} icon={<FiHash className="w-3.5 h-3.5" />} />
              <InfoRow label="Status" value={str(emp?.status) ? String(emp?.status).replace('_', ' ').charAt(0).toUpperCase() + String(emp?.status).replace('_', ' ').slice(1) : ''} icon={<FiCheckCircle className="w-3.5 h-3.5" />} />
              <InfoRow label="Department" value={str(emp?.department)} icon={<FiBriefcase className="w-3.5 h-3.5" />} />
              <InfoRow label="Designation" value={str(emp?.designation)} icon={<FiStar className="w-3.5 h-3.5" />} />
              <InfoRow label="Branch" value={str(emp?.branch)} icon={<FiMapPin className="w-3.5 h-3.5" />} />
              <InfoRow label="Date of Joining" value={formatDate(emp?.dateOfJoining)} icon={<FiCalendar className="w-3.5 h-3.5" />} />
              <InfoRow label="Company" value={str(tenant?.name)} icon={<FiBriefcase className="w-3.5 h-3.5" />} />
            </SectionCard>

            {/* Dependents */}
            {Array.isArray(emp?.dependents) && (emp?.dependents as unknown[]).length > 0 && (
              <SectionCard title="Dependents" icon={<FiHeart className="w-4 h-4" />} accent="rose">
                {(emp?.dependents as Record<string, unknown>[]).map((dep, idx) => (
                  <div key={idx} className="col-span-full">
                    <div className="p-4 bg-slate-50/60 rounded-xl border border-thb-border/40">
                      <p className="text-xs font-semibold text-thb-text-muted uppercase tracking-wider mb-3">Dependent {idx + 1}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <InfoRow label="Name" value={str(dep.name)} />
                        <InfoRow label="Relationship" value={str(dep.relationship)} />
                        <InfoRow label="Date of Birth" value={formatDate(dep.dateOfBirth)} />
                        <InfoRow label="Gender" value={str(dep.gender)} />
                      </div>
                    </div>
                  </div>
                ))}
              </SectionCard>
            )}
          </div>
        )}

        {/* ─── Address Tab ─── */}
        {activeTab === 'address' && (
          <div className="space-y-5">
            <SectionCard title="Residential Address" icon={<FiHome className="w-4 h-4" />} accent="violet">
              <InfoRow label="Street Address" value={str(emp?.address)} icon={<FiMapPin className="w-3.5 h-3.5" />} />
              <InfoRow label="City" value={str(emp?.city)} />
              <InfoRow label="State" value={str(emp?.state)} />
              <InfoRow label="ZIP / Postal Code" value={str(emp?.zipCode)} icon={<FiHash className="w-3.5 h-3.5" />} />
              <InfoRow label="Country" value={str(emp?.country)} icon={<FiGlobe className="w-3.5 h-3.5" />} />
            </SectionCard>
          </div>
        )}

        {/* ─── Employment Tab ─── */}
        {activeTab === 'employment' && (
          <div className="space-y-5">
            <SectionCard title="Employment Details" icon={<FiBriefcase className="w-4 h-4" />} accent="blue">
              <InfoRow label="Employee ID" value={str(emp?.employeeId)} icon={<FiHash className="w-3.5 h-3.5" />} />
              <InfoRow label="Department" value={str(emp?.department)} icon={<FiBriefcase className="w-3.5 h-3.5" />} />
              <InfoRow label="Designation" value={str(emp?.designation)} icon={<FiStar className="w-3.5 h-3.5" />} />
              <InfoRow label="Branch" value={str(emp?.branch)} icon={<FiMapPin className="w-3.5 h-3.5" />} />
              <InfoRow label="Date of Joining" value={formatDate(emp?.dateOfJoining)} icon={<FiCalendar className="w-3.5 h-3.5" />} />
              <InfoRow label="Status" value={str(emp?.status) ? String(emp?.status).replace('_', ' ').charAt(0).toUpperCase() + String(emp?.status).replace('_', ' ').slice(1) : ''} icon={<FiCheckCircle className="w-3.5 h-3.5" />} />
            </SectionCard>

            <SectionCard title="Organization" icon={<FiInfo className="w-4 h-4" />} accent="emerald">
              <InfoRow label="Company" value={str(tenant?.name)} icon={<FiBriefcase className="w-3.5 h-3.5" />} />
              <InfoRow label="Company Plan" value={str(tenant?.plan)} icon={<FiStar className="w-3.5 h-3.5" />} />
              <InfoRow label="Currency" value={str(tenant?.currency)} icon={<FiDollarSign className="w-3.5 h-3.5" />} />
              <InfoRow label="Timezone" value={str(tenant?.timezone)} icon={<FiClock className="w-3.5 h-3.5" />} />
            </SectionCard>
          </div>
        )}

        {/* ─── Bank & Finance Tab ─── */}
        {activeTab === 'bank' && (
          <div className="space-y-5">
            <SectionCard title="Bank Account Details" icon={<FiCreditCard className="w-4 h-4" />} accent="emerald">
              <InfoRow label="Bank Name" value={str(emp?.bankName)} icon={<FiCreditCard className="w-3.5 h-3.5" />} />
              <InfoRow label="Account Number" value={str(emp?.bankAccountNo)} icon={<FiHash className="w-3.5 h-3.5" />} />
              <InfoRow label="IFSC Code" value={str(emp?.bankIfscCode)} icon={<FiHash className="w-3.5 h-3.5" />} />
            </SectionCard>

            <SectionCard title="Identity & Tax" icon={<FiShield className="w-4 h-4" />} accent="violet">
              <InfoRow label="PAN Number" value={str(emp?.panNumber)} icon={<FiFileText className="w-3.5 h-3.5" />} />
              <InfoRow label="Aadhaar Number" value={str(emp?.aadhaarNumber)} icon={<FiShield className="w-3.5 h-3.5" />} />
              <InfoRow label="Tax ID" value={str(emp?.taxId)} icon={<FiFileText className="w-3.5 h-3.5" />} />
            </SectionCard>
          </div>
        )}

        {/* ─── Salary Tab ─── */}
        {activeTab === 'salary' && (
          <div className="space-y-5">
            <SectionCard title="Compensation" icon={<FiDollarSign className="w-4 h-4" />} accent="emerald">
              <InfoRow label="Salary" value={emp?.salary ? `${str(emp?.salaryCurrency) || 'INR'} ${Number(emp.salary).toLocaleString()}` : ''} icon={<FiDollarSign className="w-3.5 h-3.5" />} />
              <InfoRow label="Currency" value={str(emp?.salaryCurrency) || 'INR'} icon={<FiDollarSign className="w-3.5 h-3.5" />} />
              <InfoRow label="Salary Structure" value={str(emp?.salaryStructureId) ? 'Assigned' : 'Not Assigned'} icon={<FiFileText className="w-3.5 h-3.5" />} />
            </SectionCard>
          </div>
        )}

        {/* ─── Emergency Tab ─── */}
        {activeTab === 'emergency' && (
          <div className="space-y-5">
            <SectionCard title="Emergency Contact" icon={<FiHeart className="w-4 h-4" />} accent="rose">
              <InfoRow label="Contact Name" value={str(emp?.emergencyContactName)} icon={<FiUser className="w-3.5 h-3.5" />} />
              <InfoRow label="Contact Phone" value={str(emp?.emergencyContactPhone)} icon={<FiPhone className="w-3.5 h-3.5" />} />
            </SectionCard>
          </div>
        )}

        {/* ─── Health Tab ─── */}
        {activeTab === 'health' && (
          <div className="space-y-5">
            <SectionCard title="Health Information" icon={<FiShield className="w-4 h-4" />} accent="rose">
              <InfoRow label="Blood Group" value={str(emp?.bloodGroup)} icon={<FiHeart className="w-3.5 h-3.5" />} />
              <InfoRow label="Date of Birth" value={formatDate(emp?.dateOfBirth)} icon={<FiCalendar className="w-3.5 h-3.5" />} />
              <InfoRow label="Gender" value={str(emp?.gender) ? String(emp?.gender).charAt(0).toUpperCase() + String(emp?.gender).slice(1) : ''} />
              <InfoRow label="Marital Status" value={str(emp?.maritalStatus) ? String(emp?.maritalStatus).charAt(0).toUpperCase() + String(emp?.maritalStatus).slice(1) : ''} />
            </SectionCard>
          </div>
        )}

        {/* ─── Policies Tab ─── */}
        {activeTab === 'policies' && (
          <div className="space-y-5">
            <SectionCard title="Assigned Policies" icon={<FiFileText className="w-4 h-4" />} accent="amber">
              <InfoRow label="Leave Policy" value={str(emp?.leavePolicyId) ? 'Assigned' : 'Not Assigned'} icon={<FiCalendar className="w-3.5 h-3.5" />} />
              <InfoRow label="Attendance Policy" value={str(emp?.attendancePolicyId) ? 'Assigned' : 'Not Assigned'} icon={<FiClock className="w-3.5 h-3.5" />} />
              <InfoRow label="Travel Policy" value={str(emp?.travelPolicyId) ? 'Assigned' : 'Not Assigned'} icon={<FiMapPin className="w-3.5 h-3.5" />} />
              <InfoRow label="Salary Structure" value={str(emp?.salaryStructureId) ? 'Assigned' : 'Not Assigned'} icon={<FiDollarSign className="w-3.5 h-3.5" />} />
            </SectionCard>
          </div>
        )}

        {/* ─── Experience Tab ─── */}
        {activeTab === 'experience' && (
          <div className="space-y-5">
            {Array.isArray(emp?.experiences) && (emp?.experiences as unknown[]).length > 0 ? (
              (emp?.experiences as Record<string, unknown>[]).map((exp, idx) => (
                <SectionCard key={idx} title={`Experience ${idx + 1}`} icon={<FiBriefcase className="w-4 h-4" />} accent="blue">
                  <InfoRow label="Company" value={str(exp.company)} icon={<FiBriefcase className="w-3.5 h-3.5" />} />
                  <InfoRow label="Designation" value={str(exp.designation)} icon={<FiStar className="w-3.5 h-3.5" />} />
                  <InfoRow label="From" value={formatDate(exp.fromDate)} icon={<FiCalendar className="w-3.5 h-3.5" />} />
                  <InfoRow label="To" value={formatDate(exp.toDate)} icon={<FiCalendar className="w-3.5 h-3.5" />} />
                  {str(exp.description) && (
                    <div className="col-span-full">
                      <div className="p-4 bg-slate-50/60 rounded-xl border border-thb-border/40">
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-thb-text-muted mb-1.5">Description</label>
                        <p className="text-sm text-thb-text-primary leading-relaxed">{str(exp.description)}</p>
                      </div>
                    </div>
                  )}
                </SectionCard>
              ))
            ) : (
              <div className="thb-card overflow-hidden">
                <div className="h-[3px] bg-gradient-to-r from-slate-400 to-slate-300" />
                <div className="p-12 text-center">
                  <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4">
                    <FiBriefcase className="w-7 h-7 text-thb-text-muted" />
                  </div>
                  <h3 className="text-sm font-semibold text-thb-text-primary mb-1">No Experience Records</h3>
                  <p className="text-xs text-thb-text-muted">Previous experience details have not been added yet.</p>
                </div>
              </div>
            )}

            {/* Qualifications */}
            {Array.isArray(emp?.qualifications) && (emp?.qualifications as unknown[]).length > 0 && (
              <div className="space-y-5 mt-5">
                <h3 className="text-sm font-semibold text-thb-text-primary flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center shadow-sm">
                    <FiBookOpen className="w-4 h-4 text-teal-500" />
                  </div>
                  Qualifications
                </h3>
                {(emp?.qualifications as Record<string, unknown>[]).map((qual, idx) => (
                  <SectionCard key={idx} title={`Qualification ${idx + 1}`} icon={<FiBookOpen className="w-4 h-4" />} accent="violet">
                    <InfoRow label="Degree / Course" value={str(qual.degree)} icon={<FiBookOpen className="w-3.5 h-3.5" />} />
                    <InfoRow label="Institution" value={str(qual.institution)} icon={<FiHome className="w-3.5 h-3.5" />} />
                    <InfoRow label="Year" value={str(qual.year)} icon={<FiCalendar className="w-3.5 h-3.5" />} />
                    <InfoRow label="Grade / Percentage" value={str(qual.grade)} icon={<FiStar className="w-3.5 h-3.5" />} />
                  </SectionCard>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Documents Tab ─── */}
        {activeTab === 'documents' && (
          <div className="space-y-5">
            {Array.isArray(emp?.documents) && (emp?.documents as unknown[]).length > 0 ? (
              <SectionCard title="Uploaded Documents" icon={<FiBookOpen className="w-4 h-4" />} accent="blue">
                <div className="col-span-full space-y-2">
                  {(emp?.documents as Record<string, unknown>[]).map((doc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3.5 bg-slate-50/60 rounded-xl border border-thb-border/40 hover:border-thb-border/80 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                          <FiFileText className="w-4.5 h-4.5 text-green-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-thb-text-primary">{str(doc.name)}</p>
                          <p className="text-xs text-thb-text-muted">{str(doc.type)}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2.5 py-1 rounded-md font-semibold uppercase tracking-wider ${
                        str(doc.status) === 'verified' ? 'bg-emerald-50 text-emerald-600' :
                        str(doc.status) === 'pending' ? 'bg-amber-50 text-amber-600' :
                        'bg-slate-50 text-slate-500'
                      }`}>{str(doc.status) || 'Uploaded'}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : (
              <div className="thb-card overflow-hidden">
                <div className="h-[3px] bg-gradient-to-r from-slate-400 to-slate-300" />
                <div className="p-12 text-center">
                  <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4">
                    <FiFileText className="w-7 h-7 text-thb-text-muted" />
                  </div>
                  <h3 className="text-sm font-semibold text-thb-text-primary mb-1">No Documents</h3>
                  <p className="text-xs text-thb-text-muted">No documents have been uploaded yet.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


