'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import {
  FiHome,
  FiBriefcase,
  FiUsers,
  FiUpload,
  FiCalendar,
  FiClock,
  FiDollarSign,
  FiMail,
  FiCheck,
  FiPlus,
  FiTrash2,
  FiChevronRight,
  FiChevronLeft,
  FiDownload,
  FiStar,
  FiMapPin,
  FiGlobe,
  FiToggleLeft,
  FiToggleRight,
  FiAward,
  FiCheckCircle,
  FiInfo,
  FiClipboard,
} from 'react-icons/fi';

// ─── Types ───────────────────────────────────────────────────────────

interface DepartmentRow {
  name: string;
  code: string;
}

interface DesignationRow {
  title: string;
  departmentCode: string;
  grade: string;
  level: number;
}

interface BranchRow {
  name: string;
  code: string;
  city: string;
  state: string;
  country: string;
  isHeadOffice: boolean;
}

interface LeaveTypeRow {
  name: string;
  code: string;
  defaultDays: number;
  isPaid: boolean;
  carryForward: boolean;
  maxCarryForwardDays: number;
}

interface WizardState {
  currentStep: number;
  companyDetails: {
    legalName: string;
    registrationNo: string;
    taxId: string;
    country: string;
    state: string;
    city: string;
    address: string;
    timezone: string;
    currency: string;
  };
  departments: DepartmentRow[];
  designations: DesignationRow[];
  branches: BranchRow[];
  leaveTypes: LeaveTypeRow[];
  attendanceRules: {
    workHoursPerDay: number;
    lateThresholdMinutes: number;
    earlyDepartureThresholdMinutes: number;
    halfDayThresholdHours: number;
    weekendDays: string[];
    overtimeStartsAfterHours: number;
  };
  payrollSettings: {
    payFrequency: string;
    defaultPayDay: number;
    taxRegime: string;
    overtimeRate: number;
    prorationMethod: string;
  };
  inviteEmails: string;
  completed: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────

const WIZARD_STORAGE_KEY = '3boxes_setup_wizard_state';

const STEPS = [
  { id: 1, title: 'Welcome', icon: FiHome },
  { id: 2, title: 'Company Details', icon: FiBriefcase },
  { id: 3, title: 'Organization', icon: FiUsers },
  { id: 4, title: 'Employee Import', icon: FiUpload },
  { id: 5, title: 'Leave Policies', icon: FiCalendar },
  { id: 6, title: 'Attendance', icon: FiClock },
  { id: 7, title: 'Payroll', icon: FiDollarSign },
  { id: 8, title: 'Invite & Complete', icon: FiMail },
];

const DEFAULT_LEAVE_TYPES: LeaveTypeRow[] = [
  { name: 'Casual Leave', code: 'CL', defaultDays: 12, isPaid: true, carryForward: false, maxCarryForwardDays: 0 },
  { name: 'Sick Leave', code: 'SL', defaultDays: 10, isPaid: true, carryForward: false, maxCarryForwardDays: 0 },
  { name: 'Earned Leave', code: 'EL', defaultDays: 15, isPaid: true, carryForward: true, maxCarryForwardDays: 5 },
  { name: 'Maternity Leave', code: 'ML', defaultDays: 182, isPaid: true, carryForward: false, maxCarryForwardDays: 0 },
  { name: 'Paternity Leave', code: 'PL', defaultDays: 15, isPaid: true, carryForward: false, maxCarryForwardDays: 0 },
];

const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Shanghai',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'UTC',
];

const CURRENCIES = [
  { value: 'INR', label: '₹ INR — Indian Rupee' },
  { value: 'USD', label: '$ USD — US Dollar' },
  { value: 'EUR', label: '€ EUR — Euro' },
  { value: 'GBP', label: '£ GBP — British Pound' },
  { value: 'AED', label: 'د.إ AED — UAE Dirham' },
  { value: 'SGD', label: 'S$ SGD — Singapore Dollar' },
];

// ─── Helpers ─────────────────────────────────────────────────────────

function getDefaultWizardState(tenantName: string): WizardState {
  return {
    currentStep: 1,
    companyDetails: {
      legalName: tenantName || '',
      registrationNo: '',
      taxId: '',
      country: 'India',
      state: '',
      city: '',
      address: '',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
    },
    departments: [
      { name: 'Engineering', code: 'ENG' },
      { name: 'Human Resources', code: 'HR' },
      { name: 'Finance', code: 'FIN' },
    ],
    designations: [
      { title: 'Software Engineer', departmentCode: 'ENG', grade: 'E1', level: 1 },
      { title: 'Senior Engineer', departmentCode: 'ENG', grade: 'E2', level: 2 },
      { title: 'HR Executive', departmentCode: 'HR', grade: 'E1', level: 1 },
      { title: 'Finance Analyst', departmentCode: 'FIN', grade: 'E1', level: 1 },
    ],
    branches: [
      { name: 'Head Office', code: 'HO', city: '', state: '', country: 'India', isHeadOffice: true },
    ],
    leaveTypes: DEFAULT_LEAVE_TYPES,
    attendanceRules: {
      workHoursPerDay: 8,
      lateThresholdMinutes: 15,
      earlyDepartureThresholdMinutes: 15,
      halfDayThresholdHours: 4,
      weekendDays: ['Saturday', 'Sunday'],
      overtimeStartsAfterHours: 9,
    },
    payrollSettings: {
      payFrequency: 'monthly',
      defaultPayDay: 1,
      taxRegime: 'new',
      overtimeRate: 1.5,
      prorationMethod: 'calendar_days',
    },
    inviteEmails: '',
    completed: false,
  };
}

function loadWizardState(tenantName: string): WizardState {
  if (typeof window === 'undefined') return getDefaultWizardState(tenantName);
  try {
    const stored = localStorage.getItem(WIZARD_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return getDefaultWizardState(tenantName);
}

function saveWizardState(state: WizardState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

// ─── Celebration Confetti Component ──────────────────────────────────

function CelebrationOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Array<{
      x: number; y: number; vx: number; vy: number;
      color: string; size: number; rotation: number;
      rotationSpeed: number; opacity: number;
    }> = [];

    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -10 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        opacity: 1,
      });
    }

    let animationId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let allDone = true;

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.rotation += p.rotationSpeed;
        if (p.y > canvas.height) p.opacity -= 0.02;
        if (p.opacity > 0) allDone = false;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });

      if (!allDone) {
        animationId = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}

// ─── Main Page Component ─────────────────────────────────────────────

export default function SetupWizardPage() {
  const router = useRouter();
  const { user, token } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');
  const tenantName = tenant?.name || 'Your Company';
  const tenantId = tenant?.id || user?.tenantId || '';

  // Load state from localStorage via lazy initializer
  const [wizard, setWizard] = useState<WizardState>(() => {
    if (typeof window !== 'undefined') {
      return loadWizardState(tenantName);
    }
    return getDefaultWizardState(tenantName);
  });
  const [loaded] = useState(true);

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (loaded) saveWizardState(wizard);
  }, [wizard, loaded]);

  // Redirect non-admins
  useEffect(() => {
    if (user && !isAdmin) {
      toast.error('You do not have access to the setup wizard');
      router.push('/home');
    }
  }, [user, isAdmin, router]);

  const updateWizard = useCallback((updates: Partial<WizardState>) => {
    setWizard((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateCompanyDetails = useCallback((field: string, value: string) => {
    setWizard((prev) => ({
      ...prev,
      companyDetails: { ...prev.companyDetails, [field]: value },
    }));
  }, []);

  const updateAttendanceRule = useCallback((field: string, value: number | string[]) => {
    setWizard((prev) => ({
      ...prev,
      attendanceRules: { ...prev.attendanceRules, [field]: value },
    }));
  }, []);

  const updatePayrollSetting = useCallback((field: string, value: string | number) => {
    setWizard((prev) => ({
      ...prev,
      payrollSettings: { ...prev.payrollSettings, [field]: value },
    }));
  }, []);

  const goNext = () => {
    if (wizard.currentStep < 8) {
      setDirection('forward');
      updateWizard({ currentStep: wizard.currentStep + 1 });
    }
  };

  const goBack = () => {
    if (wizard.currentStep > 1) {
      setDirection('backward');
      updateWizard({ currentStep: wizard.currentStep - 1 });
    }
  };

  const goToStep = (step: number) => {
    if (step >= 1 && step <= 8) {
      setDirection(step > wizard.currentStep ? 'forward' : 'backward');
      updateWizard({ currentStep: step });
    }
  };

  // ─── Step Save Functions ─────────────────────────────────────────

  const saveCompanyDetails = async () => {
    setSaving(true);
    try {
      // Update tenant details via PATCH
      if (tenantId && token) {
        const res = await fetch(`/api/tenants/${tenantId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            country: wizard.companyDetails.country,
            currency: wizard.companyDetails.currency,
            timezone: wizard.companyDetails.timezone,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          // Tenant PATCH requires super_admin; if tenant_admin, just save locally
          console.log('Tenant update note:', data.error || 'saved');
        }
      }

      // Also try to update company record
      if (token) {
        try {
          const companiesRes = await fetch('/api/companies', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (companiesRes.ok) {
            const companiesData = await companiesRes.json();
            const companies = companiesData.data || companiesData;
            if (Array.isArray(companies) && companies.length > 0) {
              const companyId = companies[0].id;
              await fetch(`/api/companies`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  id: companyId,
                  name: wizard.companyDetails.legalName,
                  registrationNo: wizard.companyDetails.registrationNo,
                  taxId: wizard.companyDetails.taxId,
                  country: wizard.companyDetails.country,
                  state: wizard.companyDetails.state,
                  city: wizard.companyDetails.city,
                  address: wizard.companyDetails.address,
                  timezone: wizard.companyDetails.timezone,
                  currency: wizard.companyDetails.currency,
                }),
              });
            }
          }
        } catch {
          // Non-critical, continue
        }
      }

      toast.success('Company details saved');
      goNext();
    } catch {
      toast.error('Failed to save company details');
    } finally {
      setSaving(false);
    }
  };

  const saveOrganizationStructure = async () => {
    setSaving(true);
    try {
      if (!token) throw new Error('No auth token');

      // Get company ID
      let companyId = '';
      const companiesRes = await fetch('/api/companies', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (companiesRes.ok) {
        const companiesData = await companiesRes.json();
        const companies = companiesData.data || companiesData;
        if (Array.isArray(companies) && companies.length > 0) {
          companyId = companies[0].id;
        }
      }

      if (!companyId) {
        toast.error('No company found. Please complete company details first.');
        setSaving(false);
        return;
      }

      // Create departments
      const createdDepartments: Record<string, string> = {};
      for (const dept of wizard.departments) {
        if (!dept.name.trim()) continue;
        try {
          const res = await fetch('/api/departments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ name: dept.name, code: dept.code, companyId }),
          });
          if (res.ok) {
            const data = await res.json();
            createdDepartments[dept.code] = data.department?.id || '';
          }
        } catch { /* continue */ }
      }

      // Create designations
      for (const des of wizard.designations) {
        if (!des.title.trim()) continue;
        const departmentId = createdDepartments[des.departmentCode] || '';
        if (!departmentId) continue;
        try {
          await fetch('/api/designations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ title: des.title, departmentId, level: des.level }),
          });
        } catch { /* continue */ }
      }

      // Create branches
      for (const branch of wizard.branches) {
        if (!branch.name.trim()) continue;
        try {
          await fetch('/api/branches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              name: branch.name,
              code: branch.code,
              companyId,
              city: branch.city,
              state: branch.state,
              country: branch.country,
            }),
          });
        } catch { /* continue */ }
      }

      toast.success('Organization structure saved');
      goNext();
    } catch {
      toast.error('Failed to save organization structure');
    } finally {
      setSaving(false);
    }
  };

  const saveLeaveTypes = async () => {
    setSaving(true);
    try {
      for (const lt of wizard.leaveTypes) {
        if (!lt.name.trim()) continue;
        try {
          await fetch('/api/leave-types', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: lt.name,
              code: lt.code,
              defaultDays: lt.defaultDays,
              isPaid: lt.isPaid,
              carryForward: lt.carryForward,
              maxCarryForward: lt.maxCarryForwardDays,
            }),
          });
        } catch { /* continue */ }
      }
      toast.success('Leave policies saved');
      goNext();
    } catch {
      toast.error('Failed to save leave policies');
    } finally {
      setSaving(false);
    }
  };

  const saveAttendanceAndPayroll = () => {
    // Save to localStorage (same pattern as Settings page)
    const settingsKey = '3boxes_hrms_settings';
    try {
      const existing = localStorage.getItem(settingsKey);
      const settings = existing ? JSON.parse(existing) : {};

      settings.attendance_workHoursPerDay = wizard.attendanceRules.workHoursPerDay;
      settings.attendance_lateThreshold = wizard.attendanceRules.lateThresholdMinutes;
      settings.attendance_earlyDepartureThreshold = wizard.attendanceRules.earlyDepartureThresholdMinutes;
      settings.attendance_halfDayThreshold = wizard.attendanceRules.halfDayThresholdHours;
      settings.attendance_weekendDays = wizard.attendanceRules.weekendDays.join(',');
      settings.attendance_overtimeStartAfter = wizard.attendanceRules.overtimeStartsAfterHours;

      settings.payroll_frequency = wizard.payrollSettings.payFrequency;
      settings.payroll_defaultPayDay = wizard.payrollSettings.defaultPayDay;
      settings.payroll_taxRegime = wizard.payrollSettings.taxRegime;
      settings.payroll_overtimeRate = wizard.payrollSettings.overtimeRate;
      settings.payroll_prorationMethod = wizard.payrollSettings.prorationMethod;

      localStorage.setItem(settingsKey, JSON.stringify(settings));
    } catch { /* ignore */ }
  };

  const sendInvitations = async () => {
    setSaving(true);
    try {
      const emailList = wizard.inviteEmails
        .split(/[,\n]/)
        .map((e) => e.trim())
        .filter((e) => e.includes('@'));

      if (emailList.length > 0 && token && tenantId) {
        const res = await fetch('/api/invitations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ emails: emailList, tenantId, role: 'employee' }),
        });
        if (res.ok) {
          const data = await res.json();
          const summary = data.summary || {};
          toast.success(`Invitations sent: ${summary.success || 0} successful, ${summary.failed || 0} failed`);
        }
      }
    } catch {
      toast.error('Failed to send some invitations');
    } finally {
      setSaving(false);
    }
  };

  const completeSetup = async () => {
    setSaving(true);
    try {
      if (token) {
        await fetch('/api/setup-wizard/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
      }
      updateWizard({ completed: true });
      setShowCelebration(true);
      toast.success('Setup completed! Welcome aboard! 🎉');
      setTimeout(() => {
        localStorage.removeItem(WIZARD_STORAGE_KEY);
      }, 5000);
    } catch {
      toast.error('Failed to mark setup as complete');
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    switch (wizard.currentStep) {
      case 1: goNext(); break;
      case 2: await saveCompanyDetails(); break;
      case 3: await saveOrganizationStructure(); break;
      case 4: goNext(); break;
      case 5: await saveLeaveTypes(); break;
      case 6: saveAttendanceAndPayroll(); toast.success('Attendance rules saved'); goNext(); break;
      case 7: saveAttendanceAndPayroll(); toast.success('Payroll settings saved'); goNext(); break;
      case 8: await completeSetup(); break;
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto pb-8">
      {showCelebration && <CelebrationOverlay />}

      {/* ─── Stepper ──────────────────────────────────────────────────── */}
      <div className="thb-card p-4 mb-6">
        <div className="flex items-center justify-between overflow-x-auto gap-1">
          {STEPS.map((step, idx) => {
            const StepIcon = step.icon;
            const isActive = wizard.currentStep === step.id;
            const isCompleted = wizard.currentStep > step.id;
            return (
              <div key={step.id} className="flex items-center flex-1 min-w-0">
                <button
                  onClick={() => goToStep(step.id)}
                  className={`flex flex-col items-center gap-1 flex-1 min-w-0 group transition-all duration-300 ${
                    isActive ? 'scale-105' : ''
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isCompleted
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                        : isActive
                          ? 'bg-teal-600 text-white shadow-md shadow-teal-600/25'
                          : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                    }`}
                  >
                    {isCompleted ? (
                      <FiCheck className="w-4 h-4" />
                    ) : (
                      <StepIcon className="w-4 h-4" />
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-semibold whitespace-nowrap transition-colors ${
                      isActive
                        ? 'text-teal-700'
                        : isCompleted
                          ? 'text-emerald-600'
                          : 'text-slate-400'
                    }`}
                  >
                    {step.title}
                  </span>
                </button>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 w-4 shrink-0 rounded transition-colors duration-300 ${
                      wizard.currentStep > step.id ? 'bg-emerald-400' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Step Content ──────────────────────────────────────────────── */}
      <div
        className="transition-all duration-300 ease-in-out"
        style={{
          opacity: 1,
          transform: direction === 'forward' ? 'translateX(0)' : 'translateX(0)',
        }}
      >
        {wizard.currentStep === 1 && <StepWelcome tenantName={tenantName} />}
        {wizard.currentStep === 2 && (
          <StepCompanyDetails details={wizard.companyDetails} onUpdate={updateCompanyDetails} />
        )}
        {wizard.currentStep === 3 && (
          <StepOrganizationStructure
            departments={wizard.departments}
            designations={wizard.designations}
            branches={wizard.branches}
            onDepartmentsChange={(d) => updateWizard({ departments: d })}
            onDesignationsChange={(d) => updateWizard({ designations: d })}
            onBranchesChange={(b) => updateWizard({ branches: b })}
          />
        )}
        {wizard.currentStep === 4 && <StepEmployeeImport />}
        {wizard.currentStep === 5 && (
          <StepLeavePolicies
            leaveTypes={wizard.leaveTypes}
            onLeaveTypesChange={(lt) => updateWizard({ leaveTypes: lt })}
          />
        )}
        {wizard.currentStep === 6 && (
          <StepAttendanceRules
            rules={wizard.attendanceRules}
            onUpdate={updateAttendanceRule}
          />
        )}
        {wizard.currentStep === 7 && (
          <StepPayrollSettings
            settings={wizard.payrollSettings}
            onUpdate={updatePayrollSetting}
          />
        )}
        {wizard.currentStep === 8 && (
          <StepInviteComplete
            emails={wizard.inviteEmails}
            onEmailsChange={(e) => updateWizard({ inviteEmails: e })}
            saving={saving}
            onSendInvitations={sendInvitations}
          />
        )}
      </div>

      {/* ─── Navigation Buttons ────────────────────────────────────────── */}
      {!wizard.completed && (
        <div className="thb-card p-4 mt-6 flex items-center justify-between">
          <button
            onClick={goBack}
            disabled={wizard.currentStep === 1}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              wizard.currentStep === 1
                ? 'text-slate-300 cursor-not-allowed'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FiChevronLeft className="w-4 h-4" />
            Back
          </button>

          <span className="text-xs text-slate-400 font-medium">
            Step {wizard.currentStep} of 8
          </span>

          <button
            onClick={handleNext}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : wizard.currentStep === 8 ? (
              <>
                <FiCheckCircle className="w-4 h-4" />
                Complete Setup
              </>
            ) : (
              <>
                Next
                <FiChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}

      {/* ─── Completed State ────────────────────────────────────────────── */}
      {wizard.completed && (
        <div className="thb-card p-8 mt-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <FiCheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Setup Complete!</h2>
          <p className="text-slate-500 mb-6">
            Your company is all set up. You can now start managing your HRMS.
          </p>
          <button
            onClick={() => router.push('/home')}
            className="px-6 py-2.5 rounded-lg bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-all shadow-sm"
          >
            Go to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Step 1: Welcome ─────────────────────────────────────────────────

function StepWelcome({ tenantName }: { tenantName: string }) {
  return (
    <div className="thb-card p-8 text-center">
      {/* Logo placeholder */}
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-teal-500/25">
        <FiStar className="w-10 h-10 text-white" />
      </div>

      <h1 className="text-3xl font-bold text-slate-800 mb-2">Welcome to {tenantName}!</h1>
      <p className="text-slate-500 text-lg mb-8">
        Let&apos;s get your company set up in just a few steps.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-xl mx-auto">
        {[
          { icon: FiBriefcase, label: 'Company Details', color: 'text-green-500 bg-green-50' },
          { icon: FiUsers, label: 'Organization', color: 'text-emerald-500 bg-emerald-50' },
          { icon: FiCalendar, label: 'Leave & Attendance', color: 'text-amber-500 bg-amber-50' },
          { icon: FiMail, label: 'Invite Team', color: 'text-rose-500 bg-rose-50' },
        ].map((item) => (
          <div key={item.label} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-50">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item.color}`}>
              <item.icon className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-slate-600">{item.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-teal-50 rounded-xl border border-teal-100 max-w-lg mx-auto">
        <div className="flex items-start gap-3">
          <FiInfo className="w-5 h-5 text-teal-500 mt-0.5 shrink-0" />
          <p className="text-sm text-teal-700 text-left">
            This wizard will guide you through setting up your company. You can save your progress at any step and resume later.
            Each step takes just a minute or two.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Company Details ─────────────────────────────────────────

function StepCompanyDetails({
  details,
  onUpdate,
}: {
  details: WizardState['companyDetails'];
  onUpdate: (field: string, value: string) => void;
}) {
  return (
    <div className="thb-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
          <FiBriefcase className="w-5 h-5 text-green-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Company Details</h2>
          <p className="text-sm text-slate-500">Fill in your company&apos;s legal information</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Company Legal Name</label>
          <input
            type="text"
            value={details.legalName}
            onChange={(e) => onUpdate('legalName', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
            placeholder="Enter legal name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Registration Number</label>
          <input
            type="text"
            value={details.registrationNo}
            onChange={(e) => onUpdate('registrationNo', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
            placeholder="e.g., CIN/UIN"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Tax ID (GST/PAN)</label>
          <input
            type="text"
            value={details.taxId}
            onChange={(e) => onUpdate('taxId', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
            placeholder="e.g., 29AABCU9603R1ZM"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            <FiGlobe className="w-3.5 h-3.5 inline mr-1" />Country
          </label>
          <select
            value={details.country}
            onChange={(e) => onUpdate('country', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all bg-white"
          >
            <option value="India">India</option>
            <option value="United States">United States</option>
            <option value="United Kingdom">United Kingdom</option>
            <option value="UAE">UAE</option>
            <option value="Singapore">Singapore</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            <FiMapPin className="w-3.5 h-3.5 inline mr-1" />State
          </label>
          <input
            type="text"
            value={details.state}
            onChange={(e) => onUpdate('state', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
            placeholder="e.g., Maharashtra"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
          <input
            type="text"
            value={details.city}
            onChange={(e) => onUpdate('city', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
            placeholder="e.g., Mumbai"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Timezone</label>
          <select
            value={details.timezone}
            onChange={(e) => onUpdate('timezone', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all bg-white"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
          <select
            value={details.currency}
            onChange={(e) => onUpdate('currency', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all bg-white"
          >
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
          <textarea
            value={details.address}
            onChange={(e) => onUpdate('address', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all resize-none"
            placeholder="Full street address"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Step 3: Organization Structure ──────────────────────────────────

function StepOrganizationStructure({
  departments,
  designations,
  branches,
  onDepartmentsChange,
  onDesignationsChange,
  onBranchesChange,
}: {
  departments: DepartmentRow[];
  designations: DesignationRow[];
  branches: BranchRow[];
  onDepartmentsChange: (d: DepartmentRow[]) => void;
  onDesignationsChange: (d: DesignationRow[]) => void;
  onBranchesChange: (b: BranchRow[]) => void;
}) {
  const [activeTab, setActiveTab] = useState<'departments' | 'designations' | 'branches'>('departments');

  const addDepartment = () => onDepartmentsChange([...departments, { name: '', code: '' }]);
  const removeDepartment = (idx: number) => onDepartmentsChange(departments.filter((_, i) => i !== idx));
  const updateDepartment = (idx: number, field: keyof DepartmentRow, value: string) => {
    const updated = [...departments];
    updated[idx] = { ...updated[idx], [field]: value };
    onDepartmentsChange(updated);
  };

  const addDesignation = () =>
    onDesignationsChange([...designations, { title: '', departmentCode: '', grade: '', level: 1 }]);
  const removeDesignation = (idx: number) => onDesignationsChange(designations.filter((_, i) => i !== idx));
  const updateDesignation = (idx: number, field: keyof DesignationRow, value: string | number) => {
    const updated = [...designations];
    updated[idx] = { ...updated[idx], [field]: value } as DesignationRow;
    onDesignationsChange(updated);
  };

  const addBranch = () =>
    onBranchesChange([...branches, { name: '', code: '', city: '', state: '', country: 'India', isHeadOffice: false }]);
  const removeBranch = (idx: number) => onBranchesChange(branches.filter((_, i) => i !== idx));
  const updateBranch = (idx: number, field: keyof BranchRow, value: string | boolean) => {
    const updated = [...branches];
    updated[idx] = { ...updated[idx], [field]: value } as BranchRow;
    onBranchesChange(updated);
  };

  const tabs = [
    { key: 'departments' as const, label: 'Departments', icon: FiClipboard, count: departments.length },
    { key: 'designations' as const, label: 'Designations', icon: FiAward, count: designations.length },
    { key: 'branches' as const, label: 'Branches', icon: FiMapPin, count: branches.length },
  ];

  return (
    <div className="thb-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
          <FiUsers className="w-5 h-5 text-emerald-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Organization Structure</h2>
          <p className="text-sm text-slate-500">Define departments, designations, and branches</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 border-b border-slate-100 pb-3">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-teal-100 text-teal-700'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              activeTab === tab.key ? 'bg-teal-200 text-teal-800' : 'bg-slate-100 text-slate-500'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Departments Tab */}
      {activeTab === 'departments' && (
        <div>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {departments.map((dept, idx) => (
              <div key={idx} className="flex gap-3 items-start p-3 bg-slate-50 rounded-lg">
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={dept.name}
                    onChange={(e) => updateDepartment(idx, 'name', e.target.value)}
                    placeholder="Department name"
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  />
                  <input
                    type="text"
                    value={dept.code}
                    onChange={(e) => updateDepartment(idx, 'code', e.target.value.toUpperCase())}
                    placeholder="Code (e.g., ENG)"
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none uppercase"
                  />
                </div>
                <button
                  onClick={() => removeDepartment(idx)}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addDepartment}
            className="mt-3 flex items-center gap-2 px-4 py-2 text-sm font-medium text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
          >
            <FiPlus className="w-4 h-4" /> Add Department
          </button>
        </div>
      )}

      {/* Designations Tab */}
      {activeTab === 'designations' && (
        <div>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {designations.map((des, idx) => (
              <div key={idx} className="flex gap-3 items-start p-3 bg-slate-50 rounded-lg">
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <input
                    type="text"
                    value={des.title}
                    onChange={(e) => updateDesignation(idx, 'title', e.target.value)}
                    placeholder="Title"
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  />
                  <select
                    value={des.departmentCode}
                    onChange={(e) => updateDesignation(idx, 'departmentCode', e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white"
                  >
                    <option value="">Select dept</option>
                    {departments.filter(d => d.code).map((d) => (
                      <option key={d.code} value={d.code}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={des.grade}
                    onChange={(e) => updateDesignation(idx, 'grade', e.target.value)}
                    placeholder="Grade (e.g., E1)"
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  />
                  <input
                    type="number"
                    value={des.level}
                    onChange={(e) => updateDesignation(idx, 'level', parseInt(e.target.value) || 1)}
                    placeholder="Level"
                    min={1}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  />
                </div>
                <button
                  onClick={() => removeDesignation(idx)}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addDesignation}
            className="mt-3 flex items-center gap-2 px-4 py-2 text-sm font-medium text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
          >
            <FiPlus className="w-4 h-4" /> Add Designation
          </button>
        </div>
      )}

      {/* Branches Tab */}
      {activeTab === 'branches' && (
        <div>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {branches.map((branch, idx) => (
              <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                <div className="flex gap-3 items-start">
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={branch.name}
                      onChange={(e) => updateBranch(idx, 'name', e.target.value)}
                      placeholder="Branch name"
                      className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                    />
                    <input
                      type="text"
                      value={branch.code}
                      onChange={(e) => updateBranch(idx, 'code', e.target.value.toUpperCase())}
                      placeholder="Code"
                      className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none uppercase"
                    />
                    <input
                      type="text"
                      value={branch.city}
                      onChange={(e) => updateBranch(idx, 'city', e.target.value)}
                      placeholder="City"
                      className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                    />
                    <input
                      type="text"
                      value={branch.state}
                      onChange={(e) => updateBranch(idx, 'state', e.target.value)}
                      placeholder="State"
                      className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                    />
                    <select
                      value={branch.country}
                      onChange={(e) => updateBranch(idx, 'country', e.target.value)}
                      className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white"
                    >
                      <option value="India">India</option>
                      <option value="United States">United States</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="UAE">UAE</option>
                      <option value="Singapore">Singapore</option>
                    </select>
                    <button
                      onClick={() => updateBranch(idx, 'isHeadOffice', !branch.isHeadOffice)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                        branch.isHeadOffice
                          ? 'border-teal-300 bg-teal-50 text-teal-700'
                          : 'border-slate-200 text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      {branch.isHeadOffice ? <FiToggleRight className="w-4 h-4" /> : <FiToggleLeft className="w-4 h-4" />}
                      Head Office
                    </button>
                  </div>
                  <button
                    onClick={() => removeBranch(idx)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={addBranch}
            className="mt-3 flex items-center gap-2 px-4 py-2 text-sm font-medium text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
          >
            <FiPlus className="w-4 h-4" /> Add Branch
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Step 4: Employee Import ─────────────────────────────────────────

function StepEmployeeImport() {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    window.open('/api/import/template?module=employees', '_blank');
  };

  const handleFileUpload = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Please upload an Excel file (.xlsx or .xls)');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('module', 'employees');

      const token = localStorage.getItem('tb_token');
      const res = await fetch('/api/import/bulk', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Import complete: ${data.success || 0} successful, ${data.failed || 0} failed`);
      } else {
        toast.error(data.error || 'Import failed');
      }
    } catch {
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  return (
    <div className="thb-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
          <FiUpload className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Employee Import</h2>
          <p className="text-sm text-slate-500">Bulk import employees from an Excel file</p>
        </div>
      </div>

      <div className="p-4 bg-green-50 rounded-xl border border-green-100 mb-6">
        <div className="flex items-start gap-3">
          <FiInfo className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
          <div className="text-sm text-green-700">
            <p className="font-medium mb-1">Template Format</p>
            <p>Download the Excel template, fill in your employee data, and upload it back. The template includes columns for personal details, job information, and bank details.</p>
          </div>
        </div>
      </div>

      <button
        onClick={handleDownloadTemplate}
        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors mb-6"
      >
        <FiDownload className="w-4 h-4" />
        Download Template
      </button>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          dragActive
            ? 'border-teal-400 bg-teal-50'
            : 'border-slate-200 hover:border-teal-300 hover:bg-slate-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
          }}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
            <p className="text-sm text-slate-600">Uploading and processing...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
              <FiUpload className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">Drag & drop your Excel file here</p>
              <p className="text-xs text-slate-400 mt-1">or click to browse — supports .xlsx, .xls</p>
            </div>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-400 text-center">
        You can also import employees later from the Settings page → Bulk Import tab
      </p>
    </div>
  );
}

// ─── Step 5: Leave Policies ──────────────────────────────────────────

function StepLeavePolicies({
  leaveTypes,
  onLeaveTypesChange,
}: {
  leaveTypes: LeaveTypeRow[];
  onLeaveTypesChange: (lt: LeaveTypeRow[]) => void;
}) {
  const addLeaveType = () =>
    onLeaveTypesChange([...leaveTypes, { name: '', code: '', defaultDays: 0, isPaid: true, carryForward: false, maxCarryForwardDays: 0 }]);

  const removeLeaveType = (idx: number) => onLeaveTypesChange(leaveTypes.filter((_, i) => i !== idx));

  const updateLeaveType = (idx: number, field: keyof LeaveTypeRow, value: string | number | boolean) => {
    const updated = [...leaveTypes];
    updated[idx] = { ...updated[idx], [field]: value } as LeaveTypeRow;
    onLeaveTypesChange(updated);
  };

  return (
    <div className="thb-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center">
          <FiCalendar className="w-5 h-5 text-rose-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Leave Policies</h2>
          <p className="text-sm text-slate-500">Configure leave types and their default allocations</p>
        </div>
      </div>

      <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
        {leaveTypes.map((lt, idx) => (
          <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-start gap-3">
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={lt.name}
                  onChange={(e) => updateLeaveType(idx, 'name', e.target.value)}
                  placeholder="Leave type name"
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
                <input
                  type="text"
                  value={lt.code}
                  onChange={(e) => updateLeaveType(idx, 'code', e.target.value.toUpperCase())}
                  placeholder="Code"
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none uppercase"
                />
                <input
                  type="number"
                  value={lt.defaultDays}
                  onChange={(e) => updateLeaveType(idx, 'defaultDays', parseInt(e.target.value) || 0)}
                  placeholder="Days"
                  min={0}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
                <button
                  onClick={() => updateLeaveType(idx, 'isPaid', !lt.isPaid)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                    lt.isPaid
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  {lt.isPaid ? <FiToggleRight className="w-4 h-4" /> : <FiToggleLeft className="w-4 h-4" />}
                  Paid
                </button>
                <button
                  onClick={() => updateLeaveType(idx, 'carryForward', !lt.carryForward)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                    lt.carryForward
                      ? 'border-teal-300 bg-teal-50 text-teal-700'
                      : 'border-slate-200 text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  {lt.carryForward ? <FiToggleRight className="w-4 h-4" /> : <FiToggleLeft className="w-4 h-4" />}
                  Carry Forward
                </button>
                {lt.carryForward && (
                  <input
                    type="number"
                    value={lt.maxCarryForwardDays}
                    onChange={(e) => updateLeaveType(idx, 'maxCarryForwardDays', parseInt(e.target.value) || 0)}
                    placeholder="Max carry"
                    min={0}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  />
                )}
              </div>
              <button
                onClick={() => removeLeaveType(idx)}
                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <FiTrash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addLeaveType}
        className="mt-3 flex items-center gap-2 px-4 py-2 text-sm font-medium text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
      >
        <FiPlus className="w-4 h-4" /> Add Leave Type
      </button>
    </div>
  );
}

// ─── Step 6: Attendance Rules ────────────────────────────────────────

function StepAttendanceRules({
  rules,
  onUpdate,
}: {
  rules: WizardState['attendanceRules'];
  onUpdate: (field: string, value: number | string[]) => void;
}) {
  const WEEKEND_OPTIONS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const toggleWeekend = (day: string) => {
    const current = rules.weekendDays;
    if (current.includes(day)) {
      onUpdate('weekendDays', current.filter((d) => d !== day));
    } else {
      onUpdate('weekendDays', [...current, day]);
    }
  };

  return (
    <div className="thb-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-cyan-50 flex items-center justify-center">
          <FiClock className="w-5 h-5 text-cyan-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Attendance Rules</h2>
          <p className="text-sm text-slate-500">Configure work hours and attendance thresholds</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Work Hours Per Day</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={rules.workHoursPerDay}
              onChange={(e) => onUpdate('workHoursPerDay', parseFloat(e.target.value) || 0)}
              min={1}
              max={12}
              step={0.5}
              className="w-24 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
            />
            <span className="text-sm text-slate-400">hours</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Late Threshold</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={rules.lateThresholdMinutes}
              onChange={(e) => onUpdate('lateThresholdMinutes', parseInt(e.target.value) || 0)}
              min={0}
              className="w-24 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
            />
            <span className="text-sm text-slate-400">minutes after shift start</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Early Departure Threshold</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={rules.earlyDepartureThresholdMinutes}
              onChange={(e) => onUpdate('earlyDepartureThresholdMinutes', parseInt(e.target.value) || 0)}
              min={0}
              className="w-24 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
            />
            <span className="text-sm text-slate-400">minutes before shift end</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Half-Day Threshold</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={rules.halfDayThresholdHours}
              onChange={(e) => onUpdate('halfDayThresholdHours', parseFloat(e.target.value) || 0)}
              min={1}
              step={0.5}
              className="w-24 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
            />
            <span className="text-sm text-slate-400">hours (less than = half day)</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Overtime Starts After</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={rules.overtimeStartsAfterHours}
              onChange={(e) => onUpdate('overtimeStartsAfterHours', parseFloat(e.target.value) || 0)}
              min={1}
              step={0.5}
              className="w-24 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
            />
            <span className="text-sm text-slate-400">hours</span>
          </div>
        </div>
      </div>

      {/* Weekend days */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-slate-700 mb-3">Weekend Days</label>
        <div className="flex flex-wrap gap-2">
          {WEEKEND_OPTIONS.map((day) => {
            const isWeekend = rules.weekendDays.includes(day);
            return (
              <button
                key={day}
                onClick={() => toggleWeekend(day)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isWeekend
                    ? 'bg-red-100 text-red-700 border border-red-200'
                    : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {day.slice(0, 3)}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-400">Click to toggle weekend days (highlighted = weekend)</p>
      </div>
    </div>
  );
}

// ─── Step 7: Payroll Settings ────────────────────────────────────────

function StepPayrollSettings({
  settings,
  onUpdate,
}: {
  settings: WizardState['payrollSettings'];
  onUpdate: (field: string, value: string | number) => void;
}) {
  return (
    <div className="thb-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
          <FiDollarSign className="w-5 h-5 text-green-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Payroll Settings</h2>
          <p className="text-sm text-slate-500">Configure pay frequency and tax settings</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Pay Frequency</label>
          <select
            value={settings.payFrequency}
            onChange={(e) => onUpdate('payFrequency', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white"
          >
            <option value="monthly">Monthly</option>
            <option value="bi-monthly">Bi-Monthly</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Default Pay Day</label>
          <select
            value={settings.defaultPayDay}
            onChange={(e) => onUpdate('defaultPayDay', parseInt(e.target.value))}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white"
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
              <option key={day} value={day}>
                {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} of the month
              </option>
            ))}
            <option value={0}>Last day of month</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Tax Regime</label>
          <div className="flex gap-3">
            {['old', 'new'].map((regime) => (
              <button
                key={regime}
                onClick={() => onUpdate('taxRegime', regime)}
                className={`flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                  settings.taxRegime === regime
                    ? 'border-teal-300 bg-teal-50 text-teal-700'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {regime === 'old' ? 'Old Regime' : 'New Regime'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Overtime Rate</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={settings.overtimeRate}
              onChange={(e) => onUpdate('overtimeRate', parseFloat(e.target.value) || 1)}
              min={1}
              step={0.25}
              className="w-24 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
            />
            <span className="text-sm text-slate-400">x regular rate</span>
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Proration Method</label>
          <div className="flex gap-3">
            {[
              { value: 'calendar_days', label: 'Calendar Days', desc: 'Based on total days in month' },
              { value: 'working_days', label: 'Working Days', desc: 'Based on working days in month' },
              { value: 'fixed_30', label: 'Fixed 30 Days', desc: 'Always use 30-day base' },
            ].map((method) => (
              <button
                key={method.value}
                onClick={() => onUpdate('prorationMethod', method.value)}
                className={`flex-1 p-3 rounded-xl border text-left transition-all ${
                  settings.prorationMethod === method.value
                    ? 'border-teal-300 bg-teal-50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <p className={`text-sm font-medium ${
                  settings.prorationMethod === method.value ? 'text-teal-700' : 'text-slate-700'
                }`}>
                  {method.label}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">{method.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 8: Invite Team & Complete ──────────────────────────────────

function StepInviteComplete({
  emails,
  onEmailsChange,
  saving,
  onSendInvitations,
}: {
  emails: string;
  onEmailsChange: (e: string) => void;
  saving: boolean;
  onSendInvitations: () => Promise<void>;
}) {
  const emailCount = emails.split(/[,\n]/).filter((e) => e.trim().includes('@')).length;

  return (
    <div className="thb-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
          <FiMail className="w-5 h-5 text-teal-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Invite Your Team</h2>
          <p className="text-sm text-slate-500">Add team members to get started</p>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Email Addresses
          {emailCount > 0 && (
            <span className="ml-2 text-xs text-teal-500 font-normal">
              ({emailCount} valid email{emailCount !== 1 ? 's' : ''})
            </span>
          )}
        </label>
        <textarea
          value={emails}
          onChange={(e) => onEmailsChange(e.target.value)}
          rows={5}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-none"
          placeholder="Enter email addresses, separated by commas or one per line&#10;&#10;e.g.,&#10;john@company.com, jane@company.com&#10;alex@company.com"
        />
        <p className="mt-1 text-xs text-slate-400">
          Invited members will receive a temporary password and can log in after activating their account.
        </p>
      </div>

      {emailCount > 0 && (
        <button
          onClick={onSendInvitations}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-all disabled:opacity-50"
        >
          {saving ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : (
            <FiMail className="w-4 h-4" />
          )}
          Send Invitations
        </button>
      )}

      {/* Skip option */}
      <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
        <div className="flex items-start gap-3">
          <FiInfo className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
          <div className="text-sm text-slate-500">
            <p className="font-medium text-slate-600">You can skip this step</p>
            <p className="mt-1">Invitations are optional. You can always invite team members later from the Settings page. Click &quot;Complete Setup&quot; to finish the wizard.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
