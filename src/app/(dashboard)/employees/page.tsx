'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  FiUsers,
  FiPlus,
  FiSearch,
  FiEdit2,
  FiTrash2,
  FiEye,
  FiX,
  FiChevronLeft,
  FiChevronRight,

  FiShield,
  FiActivity,
  FiGrid,
  FiList,
  FiMoreVertical,
  FiMail,
  FiPhone,
  FiCalendar,
  FiUserCheck,
  FiUserX,
  FiUserPlus,
  FiDownload,
  FiSettings,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCompanyContextStore } from '@/store/companyContextStore';
import {
  validateEmail as validateEmailFormat,
  validatePhone,
  validateAadhaar,
  validatePAN,
  validateIFSC,
  validateBankAccount,
  validateUAN,
  validateName,
  validateZipCode,
  validateNationality,
  validatePFNumber,
  validateESINumber,
  onlyDigits,
  onlyLetters,
  phoneInputFilter,
  limitLength,
} from '@/lib/validators';
import ModuleTips from '@/components/ModuleTips';
import ModuleWorkflow from '@/components/ModuleWorkflow';
import BulkImportTab from '@/components/BulkImportTab';


/* ── Employee Tips ── */
const employeeTips = [
  {
    title: 'Auto-Generated Employee Codes',
    description: 'Employee codes are auto-generated based on the prefix and sequence in Settings',
  },
  {
    title: 'Complete Onboarding Tasks',
    description: 'Complete all onboarding tasks before marking new hires as Active',
  },
  {
    title: 'Bulk Import from CSV',
    description: 'Use the bulk import feature to add multiple employees at once from a CSV file',
  },
  {
    title: 'Document Expiry Reminders',
    description: 'Configure document expiry reminders to stay compliant with visa and license renewals',
  },
  {
    title: 'Set Up Reporting Managers',
    description: 'Set up reporting manager relationships to enable approval workflows',
  },
];

/* ── Employee Workflow Steps ── */
const employeeWorkflowSteps = [
  { step: 1, title: 'Add Employee', description: 'Create a new employee record with basic details' },
  { step: 2, title: 'Complete Profile Details', description: 'Fill in personal information and contact details' },
  { step: 3, title: 'Assign Department & Designation', description: 'Set the employee\'s department and job title' },
  { step: 4, title: 'Set Bank Details', description: 'Configure bank account and financial information' },
  { step: 5, title: 'Configure Reporting Manager', description: 'Assign the employee\'s reporting manager for approvals' },
  { step: 6, title: 'Mark Active', description: 'Activate the employee after onboarding is complete' },
  { step: 7, title: 'Review Employee Directory', description: 'Verify all employee details in the directory' },
];

/* ── Types ── */
interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  department?: { id: string; name: string };
  designation?: { id: string; title: string };
  branch?: { id: string; name: string } | null;
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
  bankName?: string | null;
  bankAccountNo?: string | null;
  bankIfscCode?: string | null;
  panNumber?: string | null;
  aadhaarNumber?: string | null;
  salary?: number | null;
  salaryCurrency?: string;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  companyId?: string | null;
  leavePolicyId?: string | null;
  attendancePolicyId?: string | null;
  travelPolicyId?: string | null;
  salaryStructureId?: string | null;
  bloodGroup?: string | null;
  user?: { id: string; email: string; role: string; avatar: string | null } | null;
}

interface Department { id: string; name: string; company?: { name: string } | null }
interface Designation { id: string; title: string; department?: { name: string } | null }
interface Branch { id: string; name: string }

/* ── Helpers ── */
function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'thb-badge thb-badge-success',
    on_leave: 'thb-badge thb-badge-warning',
    terminated: 'thb-badge thb-badge-error',
    resigned: 'bg-slate-100 text-slate-600 thb-badge',
  };
  const labels: Record<string, string> = { active: 'Active', on_leave: 'On Leave', terminated: 'Terminated', resigned: 'Resigned' };
  return { className: map[status] || 'thb-badge thb-badge-info', label: labels[status] || status };
}

function getStatusDotColor(status: string) {
  const map: Record<string, string> = {
    active: 'bg-emerald-500',
    on_leave: 'bg-amber-500',
    terminated: 'bg-red-500',
    resigned: 'bg-slate-400',
  };
  return map[status] || 'bg-green-500';
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getAvatarColor(name: string) {
  const colors = [
    'from-green-500 to-cyan-500',
    'from-teal-500 to-teal-500',
    'from-emerald-500 to-teal-500',
    'from-orange-500 to-amber-500',
    'from-pink-500 to-rose-500',
    'from-emerald-500 to-green-500',
    'from-teal-500 to-green-500',
    'from-red-500 to-pink-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

/* ── Initial Form State ── */
const initialForm = {
  employeeId: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  gender: '',
  maritalStatus: '',
  nationality: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  country: '',
  companyId: '',
  departmentId: '',
  designationId: '',
  branchId: '',
  role: '',
  dateOfJoining: '',
  bankName: '',
  bankAccountNo: '',
  bankIfscCode: '',
  panNumber: '',
  aadhaarNumber: '',
  salary: '',
  salaryCurrency: 'INR',
  emergencyContactName: '',
  emergencyContactPhone: '',
  // Statutory Details
  pfNumber: '',
  pfUAN: '',
  pfNomineeName: '',
  pfNomineeRelation: '',
  pfNomineePercentage: '',
  esiNumber: '',
  esiDispensary: '',
  esiNomineeName: '',
  esiNomineeRelation: '',
  professionalTaxNumber: '',
  lwfNumber: '',
  // Overseas Details
  hasForeignCitizenship: '',
  foreignCitizenshipCountry: '',
  foreignPassportNumber: '',
  foreignPassportExpiry: '',
  hasForeignSojourn: '',
  foreignSojournCountry: '',
  foreignSojournPurpose: '',
  foreignSojournDuration: '',
  hasVisa: '',
  visaType: '',
  visaCountry: '',
  visaExpiry: '',
  hasIntlDrivingLicense: '',
  intlDrivingLicenseCountry: '',
  intlDrivingLicenseExpiry: '',
  // Previous Experience
  previousEmployer1: '',
  previousDesignation1: '',
  previousDuration1: '',
  previousReason1: '',
  previousEmployer2: '',
  previousDesignation2: '',
  previousDuration2: '',
  previousReason2: '',
  previousEmployer3: '',
  previousDesignation3: '',
  previousDuration3: '',
  previousReason3: '',
  totalExperience: '',
  // Health History Questionnaire
  bloodGroup: '',
  hasChronicIllness: '',
  chronicIllnessDetails: '',
  hasAllergies: '',
  allergyDetails: '',
  hasDisability: '',
  disabilityDetails: '',
  isOnMedication: '',
  medicationDetails: '',
  hasHadSurgery: '',
  surgeryDetails: '',
  emergencyMedicalCondition: '',
  primaryPhysicianName: '',
  primaryPhysicianPhone: '',
  healthInsuranceProvider: '',
  healthInsurancePolicyNo: '',
  // Policy Mappings
  leavePolicyId: '',
  attendancePolicyId: '',
  travelPolicyId: '',
  salaryStructureId: '',
  avatar: '',
};

/* ── Component ── */
export function EmployeesPageContent({ formOnly = false }: { formOnly?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editIdFromUrl = searchParams.get('editId');
  const { user } = useAuthStore();
  const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(user?.role || '');
  const { effectiveCompanyId, selectedTenantId, availableCompanies, scopeQuery } = useCompanyContextStore();
  const scopeCompanyId = effectiveCompanyId();
  const scopeTenantId = user?.role === 'super_admin' ? selectedTenantId : undefined;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterDesignation, setFilterDesignation] = useState('');
  const [filterStatus, setFilterStatus] = useState('');


  const [showForm, setShowForm] = useState(formOnly);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [leavePolicies, setLeavePolicies] = useState<Array<{ id: string; title: string; version: string }>>([]);
  const [attendancePolicies, setAttendancePolicies] = useState<Array<{ id: string; title: string; version: string }>>([]);
  const [travelPolicies, setTravelPolicies] = useState<Array<{ id: string; title: string; version: string }>>([]);
  const [salaryStructures, setSalaryStructures] = useState<Array<{ id: string; name: string }>>([]);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [activeMainTab, setActiveMainTab] = useState<'list' | 'import'>('list');

  // Row selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  // Horizontal form tab state
  const [formTab, setFormTab] = useState('personal');
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const formTabs = [
    { key: 'personal', label: 'Personal', icon: '👤' },
    { key: 'address', label: 'Address', icon: '📍' },
    { key: 'employment', label: 'Employment', icon: '💼' },
    { key: 'bank', label: 'Bank & Finance', icon: '🏦' },
    { key: 'statutory', label: 'Statutory', icon: '📋' },
    { key: 'emergency', label: 'Emergency', icon: '🚨' },
    { key: 'health', label: 'Health', icon: '❤️' },
    { key: 'overseas', label: 'Overseas', icon: '🌍' },
    { key: 'experience', label: 'Experience', icon: '📄' },
    { key: 'policies', label: 'Policies', icon: '🛡️' },
  ] as const;

  // Per-step required field definitions for stepper validation
  const stepRequiredFields: Record<string, { field: string; label: string }[]> = {
    personal: [
      { field: 'firstName', label: 'First Name' },
      { field: 'lastName', label: 'Last Name' },
      { field: 'email', label: 'Email' },
      { field: 'employeeId', label: 'Employee ID' },
    ],
    address: [
      { field: 'address', label: 'Address Line 1' },
      { field: 'city', label: 'City' },
      { field: 'state', label: 'State' },
      { field: 'zipCode', label: 'ZIP Code' },
    ],
    employment: [
      { field: 'departmentId', label: 'Department' },
      { field: 'designationId', label: 'Designation' },
      { field: 'dateOfJoining', label: 'Date of Joining' },
    ],
    bank: [
      { field: 'bankName', label: 'Bank Name' },
      { field: 'bankAccountNo', label: 'Bank Account Number' },
      { field: 'bankIfscCode', label: 'IFSC Code' },
    ],
    statutory: [],
    emergency: [
      { field: 'emergencyContactName', label: 'Emergency Contact Name' },
      { field: 'emergencyContactPhone', label: 'Emergency Contact Phone' },
    ],
    health: [
      { field: 'bloodGroup', label: 'Blood Group' },
    ],
    overseas: [],
    experience: [],
    policies: [],
  };

  // Per-step format validation (runs on Next, not just on final submit)
  const stepFormatValidators: Record<string, { field: string; label: string; validate: (v: string) => { valid: boolean; error?: string } }[]> = {
    personal: [
      { field: 'firstName', label: 'First Name', validate: (v) => validateName(v, 'First name') },
      { field: 'lastName', label: 'Last Name', validate: (v) => validateName(v, 'Last name', 1) },
      { field: 'email', label: 'Email', validate: validateEmailFormat },
      { field: 'phone', label: 'Phone', validate: validatePhone },
      { field: 'nationality', label: 'Nationality', validate: validateNationality },
    ],
    address: [
      { field: 'zipCode', label: 'ZIP Code', validate: validateZipCode },
    ],
    bank: [
      { field: 'bankIfscCode', label: 'IFSC', validate: validateIFSC },
      { field: 'bankAccountNo', label: 'Bank Account', validate: validateBankAccount },
      { field: 'panNumber', label: 'PAN', validate: validatePAN },
      { field: 'aadhaarNumber', label: 'Aadhaar', validate: validateAadhaar },
    ],
    statutory: [
      { field: 'pfUAN', label: 'UAN', validate: validateUAN },
      { field: 'pfNumber', label: 'PF Number', validate: validatePFNumber },
      { field: 'esiNumber', label: 'ESI Number', validate: validateESINumber },
      { field: 'panNumber', label: 'PAN', validate: validatePAN },
    ],
    emergency: [
      { field: 'emergencyContactName', label: 'Emergency Contact Name', validate: (v) => validateName(v, 'Emergency Contact Name') },
      { field: 'emergencyContactPhone', label: 'Emergency Contact Phone', validate: validatePhone },
    ],
    health: [],
    overseas: [],
    experience: [],
    policies: [],
  };

  /** Validate current step and advance to next if valid */
  const handleNextStep = () => {
    if (submitting) return; // Prevent double-click
    setStepErrors({});
    const errors: Record<string, string> = {};

    // 1. Required field check for this step
    const required = stepRequiredFields[formTab] || [];
    for (const { field, label } of required) {
      const value = (form as any)[field];
      if (!value || !String(value).trim()) {
        errors[field] = `${label} is required`;
      }
    }

    // 2. Format validation for this step (only if field has a value)
    const validators = stepFormatValidators[formTab] || [];
    for (const { field, label, validate } of validators) {
      const value = (form as any)[field];
      if (value && String(value).trim()) {
        const result = validate(String(value));
        if (!result.valid) {
          errors[field] = result.error!;
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setStepErrors(errors);
      toast.error(`Please fix: ${Object.values(errors).join(', ')}`, { duration: 4000 });
      return; // BLOCK navigation
    }

    // Mark current step as completed
    setCompletedSteps(prev => new Set([...prev, formTab]));

    // Advance to next tab
    const idx = formTabs.findIndex((t) => t.key === formTab);
    if (idx < formTabs.length - 1) setFormTab(formTabs[idx + 1].key);
  };

  // Stats calculations
  const stats = {
    total: allEmployees.length,
    active: allEmployees.filter(e => e.status === 'active').length,
    inactive: allEmployees.filter(e => e.status !== 'active').length,
    newJoiners: allEmployees.filter(e => {
      if (!e.dateOfJoining) return false;
      const joinDate = new Date(e.dateOfJoining);
      const now = new Date();
      const monthDiff = (now.getFullYear() - joinDate.getFullYear()) * 12 + now.getMonth() - joinDate.getMonth();
      return monthDiff <= 1;
    }).length,
  };

  /* Close action menu on outside click */
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setActionMenuOpen(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /* Export CSV */
  const handleExportCSV = () => {
    const rows = allEmployees.map(emp => ({
      'Employee ID': emp.employeeId || '',
      'First Name': emp.firstName || '',
      'Last Name': emp.lastName || '',
      'Email': emp.email || '',
      'Phone': emp.phone || '',
      'Department': emp.department?.name || '',
      'Designation': emp.designation?.title || '',
      'Branch': emp.branch?.name || '',
      'Status': emp.status || '',
      'Joining Date': emp.dateOfJoining ? new Date(emp.dateOfJoining).toLocaleDateString() : '',
    }));
    if (rows.length === 0) {
      toast.error('No data to export');
      return;
    }
    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map(row => headers.map(h => {
        const val = row[h as keyof typeof row];
        return `"${String(val ?? '').replace(/"/g, '""')}"`;
      }).join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employees-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success('CSV exported successfully');
  };

  /* Fetch employees */
  const fetchEmployees = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (search) params.set('search', search);
      if (filterDept) params.set('departmentId', filterDept);
      if (filterStatus) params.set('status', filterStatus);
      const sq = scopeQuery();

      const res = await fetch(`/api/employees?${params.toString()}${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const fetched = data.employees || [];
      if (fetched.length === 0) {
        setEmployees([]);
        setPagination(data.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 });
      } else {
        setEmployees(fetched);
        setPagination(data.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 });
      }
    } catch (err) {
      console.error('Failed to load employees from API:', err);
      setEmployees([]);
      setPagination({ page: 1, limit: 10, total: 0, totalPages: 0 });
    } finally {
      setLoading(false);
    }
  }, [search, filterDept, filterStatus, scopeCompanyId, scopeTenantId, scopeQuery]);

  /* Fetch all employees for stats */
  const fetchAllEmployees = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '500' });
      const sq = scopeQuery();
      const res = await fetch(`/api/employees?${params.toString()}${sq ? `&${sq}` : ''}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const fetched = data.employees || [];
        if (fetched.length === 0) {
          setAllEmployees([]);
        } else {
          setAllEmployees(fetched);
        }
      } else {
        setAllEmployees([]);
      }
    } catch {
      setAllEmployees([]);
    }
  }, [scopeCompanyId, scopeTenantId, scopeQuery]);

  /* Fetch dropdown data */
  const fetchDropdowns = useCallback(async (companyId?: string) => {
    try {
      const headers = getAuthHeaders();
      const sq = scopeQuery();
      // If a specific companyId is passed (e.g. from form), use it AND tenantId from scopeQuery
      const sqParams = new URLSearchParams(sq);
      if (companyId) sqParams.set('companyId', companyId);
      const companyParam = sqParams.toString() ? `&${sqParams.toString()}` : '';

      const masterQs = sqParams.toString();
      const masterUrl = masterQs ? `/api/master-data?${masterQs}` : '/api/master-data';
      const masterRes = await fetch(masterUrl, { headers });
      if (masterRes.ok) {
        const m = await masterRes.json();
        setDepartments(m.departments || []);
        setDesignations(m.designations || []);
        setBranches(m.branches || []);
        const policies = m.policies || [];
        setLeavePolicies(policies.filter((p: { category: string }) => p.category === 'leave'));
        setAttendancePolicies(policies.filter((p: { category: string }) => p.category === 'attendance'));
        setTravelPolicies(policies.filter((p: { category: string }) => p.category === 'travel'));
      }

      const [ssRes] = await Promise.allSettled([
        fetch('/api/salary-structures', { headers }),
      ]);
      if (ssRes.status === 'fulfilled' && ssRes.value.ok) { const d = await ssRes.value.json(); setSalaryStructures(d.salaryStructures || d.data || []); }
    } catch (err) {
      console.error('Failed to fetch dropdown data', err);
    }
  }, [scopeQuery]);

  useEffect(() => {
    queueMicrotask(() => fetchEmployees(1));
  }, [fetchEmployees]);

  useEffect(() => {
    queueMicrotask(() => fetchDropdowns(scopeCompanyId || undefined));
  }, [fetchDropdowns, scopeCompanyId]);

  /* Re-fetch dropdowns when form.companyId changes */
  useEffect(() => {
    if (form.companyId) {
      queueMicrotask(() => fetchDropdowns(form.companyId));
    }
  }, [form.companyId, fetchDropdowns]);

  useEffect(() => {
    queueMicrotask(() => fetchAllEmployees());
  }, [fetchAllEmployees]);

  /* Handle editId from URL (navigated from employee view page Edit button) */
  useEffect(() => {
    if (!editIdFromUrl) return;
    const fetchAndOpenEdit = async () => {
      try {
        const res = await fetch(`/api/employees/${editIdFromUrl}`, { headers: getAuthHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        const emp = data.employee;
        if (!emp) return;
        // Build form from fetched employee
        setEditingId(emp.id);
        setForm({
          employeeId: emp.employeeId || '',
          firstName: emp.firstName || '',
          lastName: emp.lastName || '',
          email: emp.email || '',
          phone: emp.phone || '',
          dateOfBirth: emp.dateOfBirth ? emp.dateOfBirth.split('T')[0] : '',
          gender: emp.gender || '',
          maritalStatus: emp.maritalStatus || '',
          nationality: emp.nationality || '',
          address: emp.address || '',
          city: emp.city || '',
          state: emp.state || '',
          zipCode: emp.zipCode || '',
          country: emp.country || '',
          companyId: emp.companyId || emp.company?.id || '',
          departmentId: emp.department?.id || '',
          designationId: emp.designation?.id || '',
          branchId: emp.branch?.id || '',
          dateOfJoining: emp.dateOfJoining ? emp.dateOfJoining.split('T')[0] : '',
          bankName: emp.bankName || '',
          bankAccountNo: emp.bankAccountNo || '',
          bankIfscCode: emp.bankIfscCode || '',
          panNumber: emp.panNumber || '',
          aadhaarNumber: emp.aadhaarNumber || '',
          salary: emp.salary?.toString() || '',
          salaryCurrency: emp.salaryCurrency || 'INR',
          emergencyContactName: emp.emergencyContactName || '',
          emergencyContactPhone: emp.emergencyContactPhone || '',
          bloodGroup: emp.bloodGroup || '',
          hasChronicIllness: (emp as Record<string, unknown>).hasChronicIllness as string || '',
          chronicIllnessDetails: (emp as Record<string, unknown>).chronicIllnessDetails as string || '',
          hasAllergies: (emp as Record<string, unknown>).hasAllergies as string || '',
          allergyDetails: (emp as Record<string, unknown>).allergyDetails as string || '',
          hasDisability: (emp as Record<string, unknown>).hasDisability as string || '',
          disabilityDetails: (emp as Record<string, unknown>).disabilityDetails as string || '',
          isOnMedication: (emp as Record<string, unknown>).isOnMedication as string || '',
          medicationDetails: (emp as Record<string, unknown>).medicationDetails as string || '',
          hasHadSurgery: (emp as Record<string, unknown>).hasHadSurgery as string || '',
          surgeryDetails: (emp as Record<string, unknown>).surgeryDetails as string || '',
          emergencyMedicalCondition: (emp as Record<string, unknown>).emergencyMedicalCondition as string || '',
          primaryPhysicianName: (emp as Record<string, unknown>).primaryPhysicianName as string || '',
          primaryPhysicianPhone: (emp as Record<string, unknown>).primaryPhysicianPhone as string || '',
          healthInsuranceProvider: (emp as Record<string, unknown>).healthInsuranceProvider as string || '',
          healthInsurancePolicyNo: (emp as Record<string, unknown>).healthInsurancePolicyNo as string || '',
          leavePolicyId: emp.leavePolicyId || '',
          attendancePolicyId: emp.attendancePolicyId || '',
          travelPolicyId: emp.travelPolicyId || '',
          salaryStructureId: emp.salaryStructureId || '',
          // Statutory
          pfNumber: (emp as Record<string, unknown>).pfNumber as string || '',
          pfUAN: (emp as Record<string, unknown>).pfUAN as string || '',
          pfNomineeName: (emp as Record<string, unknown>).pfNomineeName as string || '',
          pfNomineeRelation: (emp as Record<string, unknown>).pfNomineeRelation as string || '',
          pfNomineePercentage: (emp as Record<string, unknown>).pfNomineePercentage as string || '',
          esiNumber: (emp as Record<string, unknown>).esiNumber as string || '',
          esiDispensary: (emp as Record<string, unknown>).esiDispensary as string || '',
          esiNomineeName: (emp as Record<string, unknown>).esiNomineeName as string || '',
          esiNomineeRelation: (emp as Record<string, unknown>).esiNomineeRelation as string || '',
          professionalTaxNumber: (emp as Record<string, unknown>).professionalTaxNumber as string || '',
          lwfNumber: (emp as Record<string, unknown>).lwfNumber as string || '',
          // Overseas
          hasForeignCitizenship: (emp as Record<string, unknown>).hasForeignCitizenship as string || '',
          foreignCitizenshipCountry: (emp as Record<string, unknown>).foreignCitizenshipCountry as string || '',
          foreignPassportNumber: (emp as Record<string, unknown>).foreignPassportNumber as string || '',
          foreignPassportExpiry: (emp as Record<string, unknown>).foreignPassportExpiry as string || '',
          hasForeignSojourn: (emp as Record<string, unknown>).hasForeignSojourn as string || '',
          foreignSojournCountry: (emp as Record<string, unknown>).foreignSojournCountry as string || '',
          foreignSojournPurpose: (emp as Record<string, unknown>).foreignSojournPurpose as string || '',
          foreignSojournDuration: (emp as Record<string, unknown>).foreignSojournDuration as string || '',
          hasVisa: (emp as Record<string, unknown>).hasVisa as string || '',
          visaType: (emp as Record<string, unknown>).visaType as string || '',
          visaCountry: (emp as Record<string, unknown>).visaCountry as string || '',
          visaExpiry: (emp as Record<string, unknown>).visaExpiry as string || '',
          hasIntlDrivingLicense: (emp as Record<string, unknown>).hasIntlDrivingLicense as string || '',
          intlDrivingLicenseCountry: (emp as Record<string, unknown>).intlDrivingLicenseCountry as string || '',
          intlDrivingLicenseExpiry: (emp as Record<string, unknown>).intlDrivingLicenseExpiry as string || '',
          // Experience
          previousEmployer1: (emp as Record<string, unknown>).previousEmployer1 as string || '',
          previousDesignation1: (emp as Record<string, unknown>).previousDesignation1 as string || '',
          previousDuration1: (emp as Record<string, unknown>).previousDuration1 as string || '',
          previousReason1: (emp as Record<string, unknown>).previousReason1 as string || '',
          previousEmployer2: (emp as Record<string, unknown>).previousEmployer2 as string || '',
          previousDesignation2: (emp as Record<string, unknown>).previousDesignation2 as string || '',
          previousDuration2: (emp as Record<string, unknown>).previousDuration2 as string || '',
          previousReason2: (emp as Record<string, unknown>).previousReason2 as string || '',
          previousEmployer3: (emp as Record<string, unknown>).previousEmployer3 as string || '',
          previousDesignation3: (emp as Record<string, unknown>).previousDesignation3 as string || '',
          previousDuration3: (emp as Record<string, unknown>).previousDuration3 as string || '',
          previousReason3: (emp as Record<string, unknown>).previousReason3 as string || '',
          totalExperience: (emp as Record<string, unknown>).totalExperience as string || '',
          role: emp.user?.role || 'employee',
          avatar: emp.avatar || '',
        });
        setShowForm(true);
        setFormTab('personal'); setCompletedSteps(new Set());
        setPhotoPreview(emp.avatar || null);
        setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      } catch (err) {
        console.error('Failed to load employee for editing:', err);
      }
    };
    fetchAndOpenEdit();
  }, [editIdFromUrl]);

  /* Handle showAddForm from URL (navigated from /employees/add redirect) */
  useEffect(() => {
    if (searchParams.get('showAddForm') === 'true') {
      queueMicrotask(() => setShowForm(true));
    }
  }, [searchParams]);

  /* Read employee code settings from localStorage */
  const getEmployeeCodeSettings = useCallback(() => {
    try {
      const stored = localStorage.getItem('3boxes_hrms_settings');
      if (stored) {
        const settings = JSON.parse(stored);
        return {
          autoGeneration: settings.employee_code_auto_generation !== false,
          prefix: settings.employee_code_prefix || 'EMP',
          sequence: settings.employee_code_sequence || 1001,
        };
      }
    } catch { /* ignore */ }
    return { autoGeneration: true, prefix: 'EMP', sequence: 1001 };
  }, []);

  /* Generate the next employee code based on settings */
  const generateNextEmployeeCode = useCallback(() => {
    const settings = getEmployeeCodeSettings();
    if (!settings.autoGeneration) return ''; // Manual mode — leave empty for user to fill
    // Use prefix + timestamp-based unique suffix to avoid collisions
    const ts = String(Date.now()).slice(-6);
    return `${settings.prefix}${ts}`;
  }, [getEmployeeCodeSettings]);

  /* Auto-initialize form when in formOnly (Add Employee) mode */
  useEffect(() => {
    if (formOnly && !editingId) {
      const settings = getEmployeeCodeSettings();
      queueMicrotask(() => setForm(prev => ({
        ...prev,
        employeeId: prev.employeeId || (settings.autoGeneration ? generateNextEmployeeCode() : ''),
        companyId: prev.companyId || scopeCompanyId || '',
      })));
    }
  }, [formOnly, scopeCompanyId, getEmployeeCodeSettings, generateNextEmployeeCode, editingId]);

  /* Form handlers */
  const handleOpenAddForm = () => {
    setEditingId(null);
    const settings = getEmployeeCodeSettings();
    setForm({
      ...initialForm,
      employeeId: settings.autoGeneration ? generateNextEmployeeCode() : '',
      companyId: scopeCompanyId || '',
    });
    setShowForm(true);
    setFormTab('personal'); setCompletedSteps(new Set());
    setDeleteConfirmId(null);
    setActionMenuOpen(null);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleOpenEditForm = (emp: Employee) => {
    setEditingId(emp.id);
    setForm({
      employeeId: emp.employeeId,
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      phone: emp.phone || '',
      dateOfBirth: emp.dateOfBirth ? emp.dateOfBirth.split('T')[0] : '',
      gender: emp.gender || '',
      maritalStatus: emp.maritalStatus || '',
      nationality: emp.nationality || '',
      address: emp.address || '',
      city: emp.city || '',
      state: emp.state || '',
      zipCode: emp.zipCode || '',
      country: emp.country || '',
      companyId: emp.companyId || '',
      departmentId: emp.department?.id || '',
      designationId: emp.designation?.id || '',
      branchId: emp.branch?.id || '',
      dateOfJoining: emp.dateOfJoining ? emp.dateOfJoining.split('T')[0] : '',
      bankName: emp.bankName || '',
      bankAccountNo: emp.bankAccountNo || '',
      bankIfscCode: emp.bankIfscCode || '',
      panNumber: emp.panNumber || '',
      aadhaarNumber: emp.aadhaarNumber || '',
      salary: emp.salary?.toString() || '',
      salaryCurrency: emp.salaryCurrency || 'INR',
      emergencyContactName: emp.emergencyContactName || '',
      emergencyContactPhone: emp.emergencyContactPhone || '',
      bloodGroup: emp.bloodGroup || '',
      hasChronicIllness: (emp as Record<string, unknown>).hasChronicIllness as string || '',
      chronicIllnessDetails: (emp as Record<string, unknown>).chronicIllnessDetails as string || '',
      hasAllergies: (emp as Record<string, unknown>).hasAllergies as string || '',
      allergyDetails: (emp as Record<string, unknown>).allergyDetails as string || '',
      hasDisability: (emp as Record<string, unknown>).hasDisability as string || '',
      disabilityDetails: (emp as Record<string, unknown>).disabilityDetails as string || '',
      isOnMedication: (emp as Record<string, unknown>).isOnMedication as string || '',
      medicationDetails: (emp as Record<string, unknown>).medicationDetails as string || '',
      hasHadSurgery: (emp as Record<string, unknown>).hasHadSurgery as string || '',
      surgeryDetails: (emp as Record<string, unknown>).surgeryDetails as string || '',
      emergencyMedicalCondition: (emp as Record<string, unknown>).emergencyMedicalCondition as string || '',
      primaryPhysicianName: (emp as Record<string, unknown>).primaryPhysicianName as string || '',
      primaryPhysicianPhone: (emp as Record<string, unknown>).primaryPhysicianPhone as string || '',
      healthInsuranceProvider: (emp as Record<string, unknown>).healthInsuranceProvider as string || '',
      healthInsurancePolicyNo: (emp as Record<string, unknown>).healthInsurancePolicyNo as string || '',
      leavePolicyId: emp.leavePolicyId || '',
      attendancePolicyId: emp.attendancePolicyId || '',
      travelPolicyId: emp.travelPolicyId || '',
      salaryStructureId: emp.salaryStructureId || '',
      role: emp.user?.role || 'employee',
      avatar: emp.avatar || '',
    });
    setShowForm(true);
    setFormTab('personal'); setCompletedSteps(new Set());
    setPhotoPreview(emp.avatar || null);
    setDeleteConfirmId(null);
    setActionMenuOpen(null);
    setTimeout(() => document.getElementById('crud-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleCancelForm = () => {
    if (formOnly) {
      router.push('/employees');
      return;
    }
    setShowForm(false);
    setEditingId(null);
    setForm(initialForm);
    setFormTab('personal'); setCompletedSteps(new Set());
    setPhotoPreview(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    // Enhanced validation: show exactly which required fields are missing
    const missingFields: string[] = [];
    const settings = getEmployeeCodeSettings();
    if (settings.autoGeneration && !form.employeeId) missingFields.push('Employee ID');
    if (!settings.autoGeneration && !form.employeeId) missingFields.push('Employee ID');
    if (!form.firstName) missingFields.push('First Name');
    if (!form.lastName) missingFields.push('Last Name');
    if (!form.email) missingFields.push('Email');
    if (!form.departmentId) missingFields.push('Department');
    if (!form.designationId) missingFields.push('Designation');
    if (!form.dateOfJoining) missingFields.push('Date of Joining');
    if (missingFields.length > 0) {
      toast.error(`Missing required fields: ${missingFields.join(', ')}`, { duration: 5000 });
      // Auto-navigate to the tab that contains the first missing field
      const personalFields = ['Employee ID', 'First Name', 'Last Name', 'Email'];
      const employmentFields = ['Department', 'Designation', 'Date of Joining'];
      if (personalFields.includes(missingFields[0])) { setFormTab('personal'); setCompletedSteps(new Set()); }
      else if (employmentFields.includes(missingFields[0])) setFormTab('employment');
      return;
    }

    // Format validation using centralized validators
    const formatErrors: string[] = [];
    const emailFmt = validateEmailFormat(form.email);
    if (!emailFmt.valid) formatErrors.push(emailFmt.error!);

    if (form.phone) {
      const r = validatePhone(form.phone);
      if (!r.valid) formatErrors.push(r.error!);
    }
    if (form.aadhaarNumber) {
      const r = validateAadhaar(form.aadhaarNumber);
      if (!r.valid) formatErrors.push(r.error!);
    }
    if (form.panNumber) {
      const r = validatePAN(form.panNumber);
      if (!r.valid) formatErrors.push(r.error!);
    }
    if (form.bankIfscCode) {
      const r = validateIFSC(form.bankIfscCode);
      if (!r.valid) formatErrors.push(r.error!);
    }
    if (form.bankAccountNo) {
      const r = validateBankAccount(form.bankAccountNo);
      if (!r.valid) formatErrors.push(r.error!);
    }
    if (form.pfUAN) {
      const r = validateUAN(form.pfUAN);
      if (!r.valid) formatErrors.push(r.error!);
    }
    if (form.emergencyContactPhone) {
      const r = validatePhone(form.emergencyContactPhone);
      if (!r.valid) formatErrors.push(`Emergency contact: ${r.error!}`);
    }
    if (formatErrors.length > 0) {
      toast.error(`Validation errors: ${formatErrors.join('; ')}`, { duration: 6000 });
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        ...form,
        salary: form.salary ? parseFloat(form.salary) : null,
        companyId: form.companyId || scopeCompanyId || null,
      };

      if (editingId) {
        const res = await fetch(`/api/employees/${editingId}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Update failed'); }
        toast.success('Employee updated successfully');
      } else {
        const res = await fetch('/api/employees', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({ error: 'Create failed' }));
          // Show the FULL error message (includes Prisma code + details for debugging)
          const errorMsg = d.error || d.details || 'Create failed';
          throw new Error(errorMsg);
        }
        toast.success('Employee created successfully');
      }
      handleCancelForm();
      fetchEmployees(pagination.page);
      fetchDropdowns();
      fetchAllEmployees();
    } catch (err: unknown) {
      // Show error for 10 seconds so the user can read the full message
      const msg = err instanceof Error ? err.message : 'Operation failed';
      toast.error(msg, { duration: 10000 });
      console.error('[Employee Form] Submit error:', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleting(true);
      const res = await fetch(`/api/employees/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Delete failed'); }
      toast.success('Employee terminated successfully');
      setDeleteConfirmId(null);
      setActionMenuOpen(null);
      fetchEmployees(pagination.page);
      fetchAllEmployees();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const updateForm = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  /* Photo upload handler */
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo must be under 5MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
      updateForm('avatar', reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  /* Bulk selection */
  const toggleSelectAll = () => {
    if (selectedIds.size === employees.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(employees.map(e => e.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  /* ── Render ── */
  return (
    <div className="space-y-6">
      {/* When formOnly mode (Add Employee page), show ONLY the form */}
      {/* Breadcrumb - SmartHR style */}
      {!formOnly ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">Employees List</h2>
            <nav className="flex items-center gap-1.5 text-sm text-slate-500">
              <button onClick={() => router.push('/')} className="hover:text-green-600 transition-colors">Home</button>
              <span>/</span>
              <span className="text-slate-700 font-medium">Employees</span>
            </nav>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* View Toggle */}
            <div className="flex items-center border border-slate-200 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-green-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                title="List View"
              >
                <FiList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-green-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                title="Grid View"
              >
                <FiGrid className="w-4 h-4" />
              </button>
            </div>
            {isAdmin && (
              <button onClick={handleOpenAddForm} className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm shadow-sm transition-colors">
                <FiPlus className="w-4 h-4" />
                Add Employee
              </button>
            )}
            {isAdmin && (
              <button onClick={() => { setActiveMainTab('import'); setShowForm(false); }} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm shadow-sm transition-colors ${activeMainTab === 'import' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                <FiDownload className="w-4 h-4" />
                Import from Excel
              </button>
            )}
            {activeMainTab === 'import' && (
              <button onClick={() => setActiveMainTab('list')} className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm transition-colors">
                <FiUsers className="w-4 h-4" />
                Back to List
              </button>
            )}
            <button onClick={() => router.push('/employees/settings')} className="inline-flex items-center gap-2 px-4 py-2.5 border border-thb-border text-thb-text-secondary rounded-lg hover:bg-slate-50 font-medium text-sm transition-colors">
              <FiSettings className="w-4 h-4" />
              Settings
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-thb-text-primary flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-cyan-500 flex items-center justify-center shadow-sm">
                <FiUserPlus className="w-5 h-5 text-white" />
              </div>
              Add Employee
            </h1>
            <p className="text-thb-text-secondary mt-1 ml-[46px]">Fill in the details below to create a new employee record</p>
          </div>
          <button onClick={handleCancelForm} className="inline-flex items-center gap-2 px-4 py-2.5 border border-thb-border text-thb-text-secondary rounded-xl hover:bg-slate-50 font-medium text-sm transition-all">
            <FiX className="w-4 h-4" />
            Back to Employees
          </button>
        </div>
      )}

      {/* ── Stats Row (SmartHR-style) ── */}
      {!formOnly && (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Employee */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
          <div className="flex items-center overflow-hidden">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-white flex-shrink-0">
              <FiUsers className="w-5 h-5" />
            </div>
            <div className="ml-3 overflow-hidden">
              <p className="text-xs font-medium text-slate-500 truncate">Total Employee</p>
              <h4 className="text-2xl font-bold text-slate-900">{stats.total}</h4>
            </div>
          </div>
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-700">
            <FiUserPlus className="w-3 h-3" /> +{stats.newJoiners > 0 ? stats.newJoiners : 0}
          </span>
        </div>

        {/* Active */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
          <div className="flex items-center overflow-hidden">
            <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white flex-shrink-0">
              <FiUserCheck className="w-5 h-5" />
            </div>
            <div className="ml-3 overflow-hidden">
              <p className="text-xs font-medium text-slate-500 truncate">Active</p>
              <h4 className="text-2xl font-bold text-emerald-600">{stats.active}</h4>
            </div>
          </div>
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700">
            {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%
          </span>
        </div>

        {/* Inactive */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
          <div className="flex items-center overflow-hidden">
            <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center text-white flex-shrink-0">
              <FiUserX className="w-5 h-5" />
            </div>
            <div className="ml-3 overflow-hidden">
              <p className="text-xs font-medium text-slate-500 truncate">Inactive</p>
              <h4 className="text-2xl font-bold text-red-500">{stats.inactive}</h4>
            </div>
          </div>
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
            {stats.total > 0 ? Math.round((stats.inactive / stats.total) * 100) : 0}%
          </span>
        </div>

        {/* New Joiners */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
          <div className="flex items-center overflow-hidden">
            <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white flex-shrink-0">
              <FiUserPlus className="w-5 h-5" />
            </div>
            <div className="ml-3 overflow-hidden">
              <p className="text-xs font-medium text-slate-500 truncate">New Joiners</p>
              <h4 className="text-2xl font-bold text-green-600">{stats.newJoiners}</h4>
            </div>
          </div>
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-700">
            This month
          </span>
        </div>
      </div>
      )}

      {/* Module Tips & Workflow (dashboard only - collapsible) */}
      {!formOnly && (
      <details className="group">
        <summary className="cursor-pointer flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors">
          <FiChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
          Tips & Workflow Guide
        </summary>
        <div className="mt-3 space-y-4">
          <ModuleTips
            moduleKey="employees"
            title="Employee Tips"
            tips={employeeTips}
            userRole={user?.role}
          />
          <ModuleWorkflow
            moduleKey="employees"
            title="How to Manage Employees"
            subtitle="Follow this workflow to set up and manage your workforce"
            steps={employeeWorkflowSteps}
            accentColor="blue"
            userRole={user?.role}
          />
        </div>
      </details>
      )}

      {/* Main Tabs: List / Bulk Import + Action bar (SmartHR style - dashboard only) */}
      {!formOnly && (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Filter Bar */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search employees..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                />
              </div>

              {/* Department Filter */}
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
              >
                <option value="">All Departments</option>
                {(() => {
                  const seen = new Set<string>();
                  return departments.filter(d => {
                    const key = `${d.name}__${d.company?.name || ''}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                  }).map(d => <option key={d.id} value={d.id}>{d.name}{d.company ? ` (${d.company.name})` : ''}</option>);
                })()}
              </select>

              {/* Designation Filter */}
              <select
                value={filterDesignation}
                onChange={(e) => setFilterDesignation(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 hidden sm:block"
              >
                <option value="">Designation</option>
                {(() => {
                  const seen = new Set<string>();
                  return designations.filter(d => {
                    const key = `${d.title}__${d.department?.name || ''}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                  }).map(d => <option key={d.id} value={d.id}>{d.title}{d.department ? ` — ${d.department.name}` : ''}</option>);
                })()}
              </select>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
              >
                <option value="">Select Status</option>
                <option value="active">Active</option>
                <option value="on_leave">On Leave</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              {/* Export */}
              <button onClick={handleExportCSV} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">
                <FiDownload className="w-3.5 h-3.5" /> Export
              </button>
            </div>
          </div>

          {/* Active filter chips */}
          {(search || filterDept || filterDesignation || filterStatus) && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {search && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                  Search: &ldquo;{search}&rdquo;
                  <button onClick={() => setSearch('')} className="hover:text-green-900"><FiX className="w-3 h-3" /></button>
                </span>
              )}
              {filterDept && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-medium">
                  Dept: {departments.find(d => d.id === filterDept)?.name}
                  <button onClick={() => setFilterDept('')} className="hover:text-teal-900"><FiX className="w-3 h-3" /></button>
                </span>
              )}
              {filterDesignation && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
                  Role: {designations.find(d => d.id === filterDesignation)?.title}
                  <button onClick={() => setFilterDesignation('')} className="hover:text-amber-900"><FiX className="w-3 h-3" /></button>
                </span>
              )}
              {filterStatus && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                  Status: {filterStatus.replace('_', ' ')}
                  <button onClick={() => setFilterStatus('')} className="hover:text-emerald-900"><FiX className="w-3 h-3" /></button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* ── Bulk Import Tab ── */}
      {!formOnly && activeMainTab === 'import' && (
        <div className="thb-card">
          <div className="p-6">
            <BulkImportTab module="employees" />
          </div>
        </div>
      )}

      {(formOnly || activeMainTab === 'list') && (<>
      {/* ── Add/Edit Employee Form ── */}
      {showForm && (
        <div id="crud-form" className="thb-card border-l-4 border-l-green-500 transition-all duration-300 ease-in-out">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-thb-text-primary">
                {editingId ? 'Edit Employee' : 'Add Employee'}
              </h2>
              <button onClick={handleCancelForm} className="p-2 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Horizontal Section Tabs */}
            <div className="flex items-center gap-1 border-b border-thb-border mb-6 overflow-x-auto pb-px -mx-1 px-1">
              {formTabs.map((tab, idx) => {
                const currentIdx = formTabs.findIndex(t => t.key === formTab);
                const isCompleted = completedSteps.has(tab.key);
                const isAccessible = idx <= currentIdx || isCompleted || idx === 0;
                return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => isAccessible && setFormTab(tab.key)}
                  disabled={!isAccessible}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors shrink-0 ${
                    formTab === tab.key
                      ? 'border-green-500 text-green-600 bg-green-50'
                      : isCompleted
                        ? 'border-transparent text-green-600 hover:text-green-700 hover:border-green-300'
                        : isAccessible
                          ? 'border-transparent text-thb-text-muted hover:text-thb-text-primary hover:border-slate-300'
                          : 'border-transparent text-slate-300 cursor-not-allowed'
                  }`}
                >
                  <span className="text-base">{tab.icon}</span>
                  {tab.label}
                  {isCompleted && formTab !== tab.key && <span className="ml-1 text-[10px] text-green-500">✓</span>}
                </button>
                );
              })}
            </div>

            {/* Progress Bar */}
            <div className="flex items-center gap-1.5 mb-6">
              {formTabs.map((tab, idx) => (
                <div
                  key={tab.key}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    formTabs.findIndex(t => t.key === formTab) >= idx ? 'bg-green-500' : 'bg-slate-200'
                  }`}
                />
              ))}
              <span className="text-xs text-thb-text-muted ml-2 shrink-0">
                Step {formTabs.findIndex(t => t.key === formTab) + 1} of {formTabs.length}
              </span>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Personal Information */}
              {formTab === 'personal' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-800">
                        {photoPreview ? (
                          <img src={photoPreview} alt="Employee" className="w-full h-full object-cover" />
                        ) : (
                          <FiUsers className="w-8 h-8 text-gray-400" />
                        )}
                      </div>
                      <label className="absolute -bottom-1 -right-1 w-7 h-7 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center cursor-pointer shadow-sm transition-colors">
                        <FiPlus className="w-3.5 h-3.5" />
                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                      </label>
                      {photoPreview && (
                        <button type="button" onClick={() => { setPhotoPreview(null); updateForm('avatar', ''); }} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                          <FiX className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Employee Photo</p>
                      <p className="text-xs text-gray-500">JPG, PNG or GIF. Max 5MB.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">First Name *</label>
                      <input type="text" value={form.firstName} onChange={e => updateForm('firstName', onlyLetters(e.target.value))} required className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 ${stepErrors.firstName ? 'border-red-400 bg-red-50' : 'border-thb-border'}`} />
                      {stepErrors.firstName && <p className="text-xs text-red-500 mt-1">{stepErrors.firstName}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Last Name *</label>
                      <input type="text" value={form.lastName} onChange={e => updateForm('lastName', onlyLetters(e.target.value))} required className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 ${stepErrors.lastName ? 'border-red-400 bg-red-50' : 'border-thb-border'}`} />
                      {stepErrors.lastName && <p className="text-xs text-red-500 mt-1">{stepErrors.lastName}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">
                        Employee ID *
                        {getEmployeeCodeSettings().autoGeneration && !editingId && (
                          <span className="ml-1.5 text-[10px] font-normal text-green-500 bg-green-50 px-1.5 py-0.5 rounded">Auto-generated</span>
                        )}
                        {!getEmployeeCodeSettings().autoGeneration && !editingId && (
                          <span className="ml-1.5 text-[10px] font-normal text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Manual</span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={form.employeeId}
                        onChange={e => updateForm('employeeId', e.target.value)}
                        required
                        disabled={!!editingId || (getEmployeeCodeSettings().autoGeneration && !editingId)}
                        placeholder={getEmployeeCodeSettings().autoGeneration ? 'Auto-generated on save' : 'Enter employee ID'}
                        className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 disabled:bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Email *</label>
                      <input type="email" value={form.email} onChange={e => updateForm('email', e.target.value)} required className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 ${stepErrors.email ? 'border-red-400 bg-red-50' : 'border-thb-border'}`} />
                      {stepErrors.email && <p className="text-xs text-red-500 mt-1">{stepErrors.email}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Phone</label>
                      <input type="tel" value={form.phone} onChange={e => updateForm('phone', phoneInputFilter(e.target.value))} placeholder="10-digit mobile" className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 ${stepErrors.phone ? 'border-red-400 bg-red-50' : 'border-thb-border'}`} />
                      {stepErrors.phone && <p className="text-xs text-red-500 mt-1">{stepErrors.phone}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Date of Birth</label>
                      <input type="date" value={form.dateOfBirth} onChange={e => updateForm('dateOfBirth', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Gender</label>
                      <select value={form.gender} onChange={e => updateForm('gender', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                        <option value="">Select</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Marital Status</label>
                      <select value={form.maritalStatus} onChange={e => updateForm('maritalStatus', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                        <option value="">Select</option>
                        <option value="single">Single</option>
                        <option value="married">Married</option>
                        <option value="divorced">Divorced</option>
                        <option value="widowed">Widowed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Nationality</label>
                      <input type="text" value={form.nationality} onChange={e => updateForm('nationality', onlyLetters(e.target.value))} className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 ${stepErrors.nationality ? 'border-red-400 bg-red-50' : 'border-thb-border'}`} />
                      {stepErrors.nationality && <p className="text-xs text-red-500 mt-1">{stepErrors.nationality}</p>}
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button type="button" onClick={handleNextStep} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 shadow-sm transition-colors">
                      Next: Address <FiChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Address */}
              {formTab === 'address' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="sm:col-span-2 lg:col-span-3">
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Address</label>
                      <input type="text" value={form.address} onChange={e => updateForm('address', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">City</label>
                      <input type="text" value={form.city} onChange={e => updateForm('city', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">State</label>
                      <input type="text" value={form.state} onChange={e => updateForm('state', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">ZIP Code</label>
                      <input type="text" value={form.zipCode} onChange={e => updateForm('zipCode', onlyDigits(e.target.value).slice(0, 6))} placeholder="6-digit PIN" className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 ${stepErrors.zipCode ? 'border-red-400 bg-red-50' : 'border-thb-border'}`} />
                      {stepErrors.zipCode && <p className="text-xs text-red-500 mt-1">{stepErrors.zipCode}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Country</label>
                      <input type="text" value={form.country} onChange={e => updateForm('country', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <button type="button" onClick={() => setFormTab('personal')} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">
                      <FiChevronLeft className="w-4 h-4" /> Back
                    </button>
                    <button type="button" onClick={handleNextStep} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 shadow-sm transition-colors">
                      Next: Employment <FiChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Employment Details */}
              {formTab === 'employment' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">
                        Company *
                        {availableCompanies.length > 1 && (
                          <span className="ml-1 text-[10px] font-normal text-thb-text-muted">({availableCompanies.length} companies)</span>
                        )}
                      </label>
                      <select
                        value={form.companyId}
                        onChange={e => {
                          updateForm('companyId', e.target.value);
                          updateForm('departmentId', '');
                          updateForm('designationId', '');
                          updateForm('branchId', '');
                        }}
                        className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                      >
                        <option value="">Select Company</option>
                        {availableCompanies.map(c => <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>)}
                      </select>
                      {availableCompanies.length <= 1 && form.companyId && (
                        <p className="text-[10px] text-thb-text-muted mt-1">Auto-assigned to your company</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Department *</label>
                      <select value={form.departmentId} onChange={e => updateForm('departmentId', e.target.value)} required className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                        <option value="">Select Department</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}{d.company ? ` (${d.company.name})` : ''}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Designation *</label>
                      <select value={form.designationId} onChange={e => updateForm('designationId', e.target.value)} required className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                        <option value="">Select Designation</option>
                        {designations.map(d => <option key={d.id} value={d.id}>{d.title}{d.department ? ` — ${d.department.name}` : ''}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Branch</label>
                      <select value={form.branchId} onChange={e => updateForm('branchId', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                        <option value="">Select Branch</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">
                        Role *
                        <span className="ml-1 text-[10px] font-normal text-thb-text-muted">(Determines module access & permissions)</span>
                      </label>
                      <select value={form.role} onChange={e => updateForm('role', e.target.value)} required className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                        <option value="">Select Role</option>
                        <option value="hr_admin">HR Manager / HR Admin</option>
                        <option value="finance_admin">Finance Manager / Finance Admin</option>
                        <option value="manager">Manager</option>
                        <option value="travel_admin">Travel Admin</option>
                        <option value="crm_admin">CRM Admin</option>
                        <option value="employee">Employee (Self-Service)</option>
                      </select>
                      <p className="text-[10px] text-thb-text-muted mt-1">This role determines which menus and modules the employee can access after login</p>
                      {/* Dynamic role info box */}
                      {form.role && (
                        <div className={`mt-2 p-2.5 rounded-lg border text-xs leading-relaxed ${
                          ['hr_admin', 'finance_admin'].includes(form.role)
                            ? 'bg-green-50 border-green-200 text-green-800'
                            : ['manager', 'travel_admin', 'crm_admin'].includes(form.role)
                            ? 'bg-amber-50 border-amber-200 text-amber-800'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        }`}>
                          <div className="flex items-start gap-1.5">
                            <FiShield className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                              ['hr_admin', 'finance_admin'].includes(form.role)
                                ? 'text-green-500'
                                : ['manager', 'travel_admin', 'crm_admin'].includes(form.role)
                                ? 'text-amber-500'
                                : 'text-emerald-500'
                            }`} />
                            <div>
                              <span className="font-semibold">
                                {form.role === 'hr_admin' && 'HR Admin Access'}
                                {form.role === 'finance_admin' && 'Finance Admin Access'}
                                {form.role === 'manager' && 'Manager Access'}
                                {form.role === 'travel_admin' && 'Travel Admin Access'}
                                {form.role === 'crm_admin' && 'CRM Admin Access'}
                                {form.role === 'employee' && 'Employee Access'}
                              </span>
                              <p className="mt-0.5 opacity-90">
                                {form.role === 'hr_admin' && 'Full access to HR modules: Employees, Recruitment, Onboarding, Leave, Attendance, Performance, Training, and HR policies.'}
                                {form.role === 'finance_admin' && 'Full access to Finance modules: Payroll, Salary Structures, Expenses, Invoices, Accounts, Loans, and Claims.'}
                                {form.role === 'manager' && 'Access to team operations: View employees, approve leaves/expenses/travel, manage performance reviews, and assign tasks.'}
                                {form.role === 'travel_admin' && 'Full access to Travel management: Travel requests, approvals, policies, and expense settlements.'}
                                {form.role === 'crm_admin' && 'Full access to CRM: Clients, vendors, CRM operations, and external relationship management.'}
                                {form.role === 'employee' && 'Self-service access: My Profile, Leave Application, Attendance, Documents, and Helpdesk.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Date of Joining *</label>
                      <input type="date" value={form.dateOfJoining} onChange={e => updateForm('dateOfJoining', e.target.value)} required className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <button type="button" onClick={() => setFormTab('address')} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">
                      <FiChevronLeft className="w-4 h-4" /> Back
                    </button>
                    <button type="button" onClick={handleNextStep} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 shadow-sm transition-colors">
                      Next: Bank & Finance <FiChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Bank & Financial Details */}
              {formTab === 'bank' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Bank Name</label>
                      <input type="text" value={form.bankName} onChange={e => updateForm('bankName', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Bank Account No</label>
                      <input type="text" value={form.bankAccountNo} onChange={e => updateForm('bankAccountNo', onlyDigits(e.target.value).slice(0, 18))} placeholder="9-18 digits" className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 ${stepErrors.bankAccountNo ? 'border-red-400 bg-red-50' : 'border-thb-border'}`} />
                      {stepErrors.bankAccountNo && <p className="text-xs text-red-500 mt-1">{stepErrors.bankAccountNo}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">IFSC Code</label>
                      <input type="text" value={form.bankIfscCode} onChange={e => updateForm('bankIfscCode', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11))} placeholder="e.g., SBIN0001234" className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 ${stepErrors.bankIfscCode ? 'border-red-400 bg-red-50' : 'border-thb-border'}`} />
                      {stepErrors.bankIfscCode && <p className="text-xs text-red-500 mt-1">{stepErrors.bankIfscCode}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">PAN Number</label>
                      <input type="text" value={form.panNumber} onChange={e => updateForm('panNumber', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} placeholder="e.g., ABCDE1234F" className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 ${stepErrors.panNumber ? 'border-red-400 bg-red-50' : 'border-thb-border'}`} />
                      {stepErrors.panNumber && <p className="text-xs text-red-500 mt-1">{stepErrors.panNumber}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Aadhaar Number</label>
                      <input type="text" value={form.aadhaarNumber} onChange={e => updateForm('aadhaarNumber', onlyDigits(e.target.value).slice(0, 12))} placeholder="12-digit UID" className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 ${stepErrors.aadhaarNumber ? 'border-red-400 bg-red-50' : 'border-thb-border'}`} />
                      {stepErrors.aadhaarNumber && <p className="text-xs text-red-500 mt-1">{stepErrors.aadhaarNumber}</p>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <button type="button" onClick={() => setFormTab('employment')} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">
                      <FiChevronLeft className="w-4 h-4" /> Back
                    </button>
                    <button type="button" onClick={handleNextStep} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 shadow-sm transition-colors">
                      Next: Statutory <FiChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Statutory Details */}
              {formTab === 'statutory' && (
                <div className="space-y-4">
                  {/* PF Details */}
                  <div>
                    <h4 className="text-xs font-semibold text-thb-text-muted uppercase tracking-wider mb-3">Provident Fund (PF)</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">PF Number</label>
                        <input type="text" value={form.pfNumber} onChange={e => updateForm('pfNumber', e.target.value.replace(/[^A-Za-z0-9\/\-]/g, '').slice(0, 25))} placeholder="e.g., PF/MH/12345/678" className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 ${stepErrors.pfNumber ? 'border-red-400 bg-red-50' : 'border-thb-border'}`} />
                      {stepErrors.pfNumber && <p className="text-xs text-red-500 mt-1">{stepErrors.pfNumber}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">UAN Number</label>
                        <input type="text" value={form.pfUAN} onChange={e => updateForm('pfUAN', onlyDigits(e.target.value).slice(0, 12))} placeholder="12-digit UAN" className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 ${stepErrors.pfUAN ? 'border-red-400 bg-red-50' : 'border-thb-border'}`} />
                      {stepErrors.pfUAN && <p className="text-xs text-red-500 mt-1">{stepErrors.pfUAN}</p>}
                      </div>
                    </div>
                  </div>
                  {/* PF Nomination */}
                  <div className="pt-3 border-t border-thb-border/50">
                    <h4 className="text-xs font-semibold text-thb-text-muted uppercase tracking-wider mb-3">PF Nomination Details</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Nominee Name</label>
                        <input type="text" value={form.pfNomineeName} onChange={e => updateForm('pfNomineeName', e.target.value)} placeholder="Full name of nominee" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Nominee Relationship</label>
                        <select value={form.pfNomineeRelation} onChange={e => updateForm('pfNomineeRelation', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                          <option value="">Select</option>
                          <option value="spouse">Spouse</option>
                          <option value="father">Father</option>
                          <option value="mother">Mother</option>
                          <option value="son">Son</option>
                          <option value="daughter">Daughter</option>
                          <option value="brother">Brother</option>
                          <option value="sister">Sister</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Nomination Percentage</label>
                        <input type="number" min="0" max="100" value={form.pfNomineePercentage} onChange={e => updateForm('pfNomineePercentage', e.target.value)} placeholder="e.g., 100" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                    </div>
                  </div>
                  {/* ESI Details */}
                  <div className="pt-3 border-t border-thb-border/50">
                    <h4 className="text-xs font-semibold text-thb-text-muted uppercase tracking-wider mb-3">Employee State Insurance (ESI)</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">ESI Number</label>
                        <input type="text" value={form.esiNumber} onChange={e => updateForm('esiNumber', e.target.value.replace(/[^0-9\-]/g, '').slice(0, 25))} placeholder="e.g., 31-00-123456-000-0001" className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 ${stepErrors.esiNumber ? 'border-red-400 bg-red-50' : 'border-thb-border'}`} />
                      {stepErrors.esiNumber && <p className="text-xs text-red-500 mt-1">{stepErrors.esiNumber}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">ESI Dispensary</label>
                        <input type="text" value={form.esiDispensary} onChange={e => updateForm('esiDispensary', e.target.value)} placeholder="Assigned dispensary name" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                    </div>
                  </div>
                  {/* ESI Nomination */}
                  <div className="pt-3 border-t border-thb-border/50">
                    <h4 className="text-xs font-semibold text-thb-text-muted uppercase tracking-wider mb-3">ESI Nomination Details</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Nominee Name</label>
                        <input type="text" value={form.esiNomineeName} onChange={e => updateForm('esiNomineeName', e.target.value)} placeholder="Full name of nominee" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Nominee Relationship</label>
                        <select value={form.esiNomineeRelation} onChange={e => updateForm('esiNomineeRelation', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                          <option value="">Select</option>
                          <option value="spouse">Spouse</option>
                          <option value="father">Father</option>
                          <option value="mother">Mother</option>
                          <option value="son">Son</option>
                          <option value="daughter">Daughter</option>
                          <option value="brother">Brother</option>
                          <option value="sister">Sister</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  {/* Other Statutory */}
                  <div className="pt-3 border-t border-thb-border/50">
                    <h4 className="text-xs font-semibold text-thb-text-muted uppercase tracking-wider mb-3">Other Statutory</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Professional Tax Number</label>
                        <input type="text" value={form.professionalTaxNumber} onChange={e => updateForm('professionalTaxNumber', e.target.value)} placeholder="PT registration number" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">LWF Number</label>
                        <input type="text" value={form.lwfNumber} onChange={e => updateForm('lwfNumber', e.target.value)} placeholder="Labour Welfare Fund number" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <button type="button" onClick={() => setFormTab('bank')} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">
                      <FiChevronLeft className="w-4 h-4" /> Back
                    </button>
                    <button type="button" onClick={handleNextStep} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 shadow-sm transition-colors">
                      Next: Emergency <FiChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Emergency Contact */}
              {formTab === 'emergency' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Emergency Contact Name</label>
                      <input type="text" value={form.emergencyContactName} onChange={e => updateForm('emergencyContactName', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Emergency Contact Phone</label>
                      <input type="tel" value={form.emergencyContactPhone} onChange={e => updateForm('emergencyContactPhone', phoneInputFilter(e.target.value))} placeholder="10-digit mobile" className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 ${stepErrors.emergencyContactPhone ? 'border-red-400 bg-red-50' : 'border-thb-border'}`} />
                      {stepErrors.emergencyContactPhone && <p className="text-xs text-red-500 mt-1">{stepErrors.emergencyContactPhone}</p>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <button type="button" onClick={() => setFormTab('statutory')} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">
                      <FiChevronLeft className="w-4 h-4" /> Back
                    </button>
                    <button type="button" onClick={handleNextStep} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 shadow-sm transition-colors">
                      Next: Health <FiChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Health History Questionnaire */}
              {formTab === 'health' && (
                <div className="space-y-4">
                  <p className="text-xs text-thb-text-muted">Capture employee health information for workplace safety and emergency preparedness. All fields are optional and confidential.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Blood Group</label>
                      <select value={form.bloodGroup} onChange={e => updateForm('bloodGroup', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                        <option value="">Select</option>
                        <option value="A+">A+</option><option value="A-">A-</option>
                        <option value="B+">B+</option><option value="B-">B-</option>
                        <option value="AB+">AB+</option><option value="AB-">AB-</option>
                        <option value="O+">O+</option><option value="O-">O-</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Has Chronic Illness?</label>
                      <select value={form.hasChronicIllness} onChange={e => updateForm('hasChronicIllness', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                        <option value="">Select</option>
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                    {form.hasChronicIllness === 'yes' && (
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Chronic Illness Details</label>
                        <input type="text" value={form.chronicIllnessDetails} onChange={e => updateForm('chronicIllnessDetails', e.target.value)} placeholder="Describe the condition" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Has Allergies?</label>
                      <select value={form.hasAllergies} onChange={e => updateForm('hasAllergies', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                        <option value="">Select</option>
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                    {form.hasAllergies === 'yes' && (
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Allergy Details</label>
                        <input type="text" value={form.allergyDetails} onChange={e => updateForm('allergyDetails', e.target.value)} placeholder="List allergies" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Has Disability?</label>
                      <select value={form.hasDisability} onChange={e => updateForm('hasDisability', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                        <option value="">Select</option>
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                    {form.hasDisability === 'yes' && (
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Disability Details</label>
                        <input type="text" value={form.disabilityDetails} onChange={e => updateForm('disabilityDetails', e.target.value)} placeholder="Nature of disability" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">On Medication?</label>
                      <select value={form.isOnMedication} onChange={e => updateForm('isOnMedication', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                        <option value="">Select</option>
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                    {form.isOnMedication === 'yes' && (
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Medication Details</label>
                        <input type="text" value={form.medicationDetails} onChange={e => updateForm('medicationDetails', e.target.value)} placeholder="Current medications" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Has Had Surgery?</label>
                      <select value={form.hasHadSurgery} onChange={e => updateForm('hasHadSurgery', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                        <option value="">Select</option>
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                    {form.hasHadSurgery === 'yes' && (
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Surgery Details</label>
                        <input type="text" value={form.surgeryDetails} onChange={e => updateForm('surgeryDetails', e.target.value)} placeholder="Surgery details" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                    )}
                  </div>
                  <div className="pt-3 border-t border-thb-border/50">
                    <h4 className="text-xs font-semibold text-thb-text-muted uppercase tracking-wider mb-3">Emergency Medical & Insurance</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Emergency Medical Condition</label>
                        <input type="text" value={form.emergencyMedicalCondition} onChange={e => updateForm('emergencyMedicalCondition', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Primary Physician Name</label>
                        <input type="text" value={form.primaryPhysicianName} onChange={e => updateForm('primaryPhysicianName', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Primary Physician Phone</label>
                        <input type="tel" value={form.primaryPhysicianPhone} onChange={e => updateForm('primaryPhysicianPhone', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Health Insurance Provider</label>
                        <input type="text" value={form.healthInsuranceProvider} onChange={e => updateForm('healthInsuranceProvider', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Health Insurance Policy No</label>
                        <input type="text" value={form.healthInsurancePolicyNo} onChange={e => updateForm('healthInsurancePolicyNo', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <button type="button" onClick={() => setFormTab('emergency')} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">
                      <FiChevronLeft className="w-4 h-4" /> Back
                    </button>
                    <button type="button" onClick={handleNextStep} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 shadow-sm transition-colors">
                      Next: Overseas <FiChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Overseas Details */}
              {formTab === 'overseas' && (
                <div className="space-y-4">
                  <p className="text-xs text-thb-text-muted">Applicable for employees with foreign citizenship, travel history, or international work assignments.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Foreign Citizenship?</label>
                      <select value={form.hasForeignCitizenship} onChange={e => updateForm('hasForeignCitizenship', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                        <option value="">Select</option>
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                    {form.hasForeignCitizenship === 'yes' && (
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Citizenship Country</label>
                        <input type="text" value={form.foreignCitizenshipCountry} onChange={e => updateForm('foreignCitizenshipCountry', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Foreign Passport Number</label>
                      <input type="text" value={form.foreignPassportNumber} onChange={e => updateForm('foreignPassportNumber', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Foreign Passport Expiry</label>
                      <input type="date" value={form.foreignPassportExpiry} onChange={e => updateForm('foreignPassportExpiry', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Foreign Sojourn?</label>
                      <select value={form.hasForeignSojourn} onChange={e => updateForm('hasForeignSojourn', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                        <option value="">Select</option>
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                    {form.hasForeignSojourn === 'yes' && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-thb-text-secondary mb-1">Sojourn Country</label>
                          <input type="text" value={form.foreignSojournCountry} onChange={e => updateForm('foreignSojournCountry', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-thb-text-secondary mb-1">Sojourn Purpose</label>
                          <input type="text" value={form.foreignSojournPurpose} onChange={e => updateForm('foreignSojournPurpose', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-thb-text-secondary mb-1">Sojourn Duration</label>
                          <input type="text" value={form.foreignSojournDuration} onChange={e => updateForm('foreignSojournDuration', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                        </div>
                      </>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Has Visa?</label>
                      <select value={form.hasVisa} onChange={e => updateForm('hasVisa', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                        <option value="">Select</option>
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                    {form.hasVisa === 'yes' && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-thb-text-secondary mb-1">Visa Type</label>
                          <input type="text" value={form.visaType} onChange={e => updateForm('visaType', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-thb-text-secondary mb-1">Visa Country</label>
                          <input type="text" value={form.visaCountry} onChange={e => updateForm('visaCountry', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-thb-text-secondary mb-1">Visa Expiry</label>
                          <input type="date" value={form.visaExpiry} onChange={e => updateForm('visaExpiry', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                        </div>
                      </>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Intl Driving License?</label>
                      <select value={form.hasIntlDrivingLicense} onChange={e => updateForm('hasIntlDrivingLicense', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                        <option value="">Select</option>
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                    {form.hasIntlDrivingLicense === 'yes' && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-thb-text-secondary mb-1">License Country</label>
                          <input type="text" value={form.intlDrivingLicenseCountry} onChange={e => updateForm('intlDrivingLicenseCountry', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-thb-text-secondary mb-1">License Expiry</label>
                          <input type="date" value={form.intlDrivingLicenseExpiry} onChange={e => updateForm('intlDrivingLicenseExpiry', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <button type="button" onClick={() => setFormTab('health')} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">
                      <FiChevronLeft className="w-4 h-4" /> Back
                    </button>
                    <button type="button" onClick={handleNextStep} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 shadow-sm transition-colors">
                      Next: Experience <FiChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Previous Experience */}
              {formTab === 'experience' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold text-thb-text-muted uppercase tracking-wider mb-3">Experience 1</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Previous Employer</label>
                        <input type="text" value={form.previousEmployer1} onChange={e => updateForm('previousEmployer1', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Designation</label>
                        <input type="text" value={form.previousDesignation1} onChange={e => updateForm('previousDesignation1', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Duration</label>
                        <input type="text" value={form.previousDuration1} onChange={e => updateForm('previousDuration1', e.target.value)} placeholder="e.g., 2 years" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                      <div className="sm:col-span-2 lg:col-span-3">
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Reason for Leaving</label>
                        <input type="text" value={form.previousReason1} onChange={e => updateForm('previousReason1', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-thb-border/50">
                    <h4 className="text-xs font-semibold text-thb-text-muted uppercase tracking-wider mb-3">Experience 2</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Previous Employer</label>
                        <input type="text" value={form.previousEmployer2} onChange={e => updateForm('previousEmployer2', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Designation</label>
                        <input type="text" value={form.previousDesignation2} onChange={e => updateForm('previousDesignation2', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Duration</label>
                        <input type="text" value={form.previousDuration2} onChange={e => updateForm('previousDuration2', e.target.value)} placeholder="e.g., 2 years" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                      <div className="sm:col-span-2 lg:col-span-3">
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Reason for Leaving</label>
                        <input type="text" value={form.previousReason2} onChange={e => updateForm('previousReason2', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-thb-border/50">
                    <h4 className="text-xs font-semibold text-thb-text-muted uppercase tracking-wider mb-3">Experience 3</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Previous Employer</label>
                        <input type="text" value={form.previousEmployer3} onChange={e => updateForm('previousEmployer3', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Designation</label>
                        <input type="text" value={form.previousDesignation3} onChange={e => updateForm('previousDesignation3', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Duration</label>
                        <input type="text" value={form.previousDuration3} onChange={e => updateForm('previousDuration3', e.target.value)} placeholder="e.g., 2 years" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                      <div className="sm:col-span-2 lg:col-span-3">
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Reason for Leaving</label>
                        <input type="text" value={form.previousReason3} onChange={e => updateForm('previousReason3', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-thb-border/50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-thb-text-secondary mb-1">Total Experience</label>
                        <input type="text" value={form.totalExperience} onChange={e => updateForm('totalExperience', e.target.value)} placeholder="e.g., 5 years" className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <button type="button" onClick={() => setFormTab('overseas')} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">
                      <FiChevronLeft className="w-4 h-4" /> Back
                    </button>
                    <button type="button" onClick={handleNextStep} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 shadow-sm transition-colors">
                      Next: Policies <FiChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Policy Mappings */}
              {formTab === 'policies' && (
                <div className="space-y-4">
                  <p className="text-xs text-thb-text-muted">Assign organizational policies to this employee. These can be updated later from the employee profile.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Leave Policy</label>
                      <select value={form.leavePolicyId} onChange={e => updateForm('leavePolicyId', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                        <option value="">Select Leave Policy</option>
                        {leavePolicies.map(p => <option key={p.id} value={p.id}>{p.title} {p.version ? `(v${p.version})` : ''}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Attendance Policy</label>
                      <select value={form.attendancePolicyId} onChange={e => updateForm('attendancePolicyId', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                        <option value="">Select Attendance Policy</option>
                        {attendancePolicies.map(p => <option key={p.id} value={p.id}>{p.title} {p.version ? `(v${p.version})` : ''}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Travel Policy</label>
                      <select value={form.travelPolicyId} onChange={e => updateForm('travelPolicyId', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                        <option value="">Select Travel Policy</option>
                        {travelPolicies.map(p => <option key={p.id} value={p.id}>{p.title} {p.version ? `(v${p.version})` : ''}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-thb-text-secondary mb-1">Salary Structure</label>
                      <select value={form.salaryStructureId} onChange={e => updateForm('salaryStructureId', e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-thb-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
                        <option value="">Select Salary Structure</option>
                        {salaryStructures.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-thb-border mt-4">
                    <button type="button" onClick={() => setFormTab('experience')} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">
                      <FiChevronLeft className="w-4 h-4" /> Back
                    </button>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={handleCancelForm} className="px-4 py-2.5 rounded-lg border border-thb-border text-sm font-medium text-thb-text-secondary hover:bg-slate-50 transition-colors">
                        Cancel
                      </button>
                      <button type="submit" disabled={submitting} className="px-6 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 shadow-sm shadow-green-500/25 transition-colors">
                        {submitting ? 'Saving...' : editingId ? 'Update Employee' : 'Add Employee'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {!formOnly && (
      <>
      {/* ── Bulk Actions & Count ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 border border-green-200">
              <span className="text-sm font-medium text-green-700">{selectedIds.size} selected</span>
              <button onClick={() => setSelectedIds(new Set())} className="text-green-500 hover:text-green-700">
                <FiX className="w-4 h-4" />
              </button>
            </div>
          )}
          {pagination.total > 0 && (
            <span className="text-sm text-slate-500">
              Showing {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} employees
            </span>
          )}
        </div>
      </div>

      {/* ── Table (List View) ── */}
      {viewMode === 'list' ? (
      <div className="thb-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-thb-border bg-slate-50/80">
                <th className="text-left px-4 py-3 w-12">
                  <input
                    type="checkbox"
                    checked={employees.length > 0 && selectedIds.size === employees.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-green-500 focus:ring-green-500/20 cursor-pointer"
                  />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Emp ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider hidden lg:table-cell">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider hidden sm:table-cell">Designation</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider hidden xl:table-cell">Joining Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-thb-text-muted uppercase tracking-wider w-16">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-thb-border/50 animate-pulse">
                    <td className="px-4 py-3"><div className="w-4 h-4 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-20 bg-slate-200 rounded font-mono" /></td>
                    <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="w-9 h-9 bg-slate-200 rounded-full" /><div className="space-y-1"><div className="h-3 w-28 bg-slate-200 rounded" /><div className="h-2 w-20 bg-slate-200 rounded" /></div></div></td>
                    <td className="px-4 py-3 hidden md:table-cell"><div className="h-3 w-32 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3 hidden lg:table-cell"><div className="h-3 w-24 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3 hidden sm:table-cell"><div className="h-3 w-24 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3 hidden xl:table-cell"><div className="h-3 w-24 bg-slate-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-16 bg-slate-200 rounded-full" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-6 bg-slate-200 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                        <FiUsers className="w-8 h-8 text-thb-text-muted" />
                      </div>
                      <p className="text-thb-text-secondary font-medium text-base">No employees found</p>
                      <p className="text-sm text-thb-text-muted mt-1">Try adjusting your search or filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                employees.map(emp => {
                  const badge = getStatusBadge(emp.status);
                  const dotColor = getStatusDotColor(emp.status);
                  const initials = `${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}`.toUpperCase();
                  const avatarGradient = getAvatarColor(`${emp.firstName} ${emp.lastName}`);
                  const isDeleting = deleteConfirmId === emp.id;
                  const isSelected = selectedIds.has(emp.id);
                  return (
                    <tr key={emp.id} className={`border-b border-thb-border/50 transition-colors ${isDeleting ? 'bg-red-50/80' : isSelected ? 'bg-green-50/50' : 'hover:bg-slate-50/50'}`}>
                      {isDeleting ? (
                        <td colSpan={9} className="px-4 py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                                <FiTrash2 className="w-4 h-4 text-red-500" />
                              </div>
                              <span className="text-sm text-red-700 font-medium">Are you sure you want to terminate {emp.firstName} {emp.lastName}? This action can be reversed by editing the employee.</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleDelete(emp.id)} disabled={deleting} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">
                                {deleting ? 'Terminating...' : 'Confirm Terminate'}
                              </button>
                              <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      ) : (
                        <>
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(emp.id)}
                              className="w-4 h-4 rounded border-slate-300 text-green-500 focus:ring-green-500/20 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-mono font-medium text-thb-text-secondary bg-slate-100 px-2 py-0.5 rounded">
                              {emp.employeeId}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {emp.avatar ? (
                                <img src={emp.avatar} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-white shadow-sm flex-shrink-0" />
                              ) : (
                                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm`}>
                                  {initials}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-thb-text-primary truncate">{emp.firstName} {emp.lastName}</p>
                                <p className="text-xs text-thb-text-muted truncate">{emp.department?.name || 'No Department'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <div className="flex items-center gap-1.5 text-sm text-thb-text-secondary truncate">
                              <FiMail className="w-3.5 h-3.5 text-thb-text-muted flex-shrink-0" />
                              <span className="truncate">{emp.email}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <div className="flex items-center gap-1.5 text-sm text-thb-text-secondary">
                              <FiPhone className="w-3.5 h-3.5 text-thb-text-muted flex-shrink-0" />
                              <span>{emp.phone || '—'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className="text-sm text-thb-text-secondary">{emp.designation?.title || '—'}</span>
                          </td>
                          <td className="px-4 py-3 hidden xl:table-cell">
                            <div className="flex items-center gap-1.5 text-sm text-thb-text-secondary">
                              <FiCalendar className="w-3.5 h-3.5 text-thb-text-muted flex-shrink-0" />
                              <span>{formatDate(emp.dateOfJoining)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 ${badge.className}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end relative" ref={actionMenuOpen === emp.id ? actionMenuRef : null}>
                              <button
                                onClick={() => setActionMenuOpen(actionMenuOpen === emp.id ? null : emp.id)}
                                className="p-1.5 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors"
                                title="Actions"
                              >
                                <FiMoreVertical className="w-4 h-4" />
                              </button>
                              {actionMenuOpen === emp.id && (
                                <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl border border-thb-border shadow-lg py-1.5 z-50 animate-fade-in">
                                  <button
                                    onClick={() => { router.push(`/employees/${emp.id}`); setActionMenuOpen(null); }}
                                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-thb-text-secondary hover:bg-slate-50 hover:text-green-600 transition-colors"
                                  >
                                    <FiEye className="w-4 h-4" /> View Details
                                  </button>
                                  {isAdmin && (
                                    <>
                                      <button
                                        onClick={() => { handleOpenEditForm(emp); setActionMenuOpen(null); }}
                                        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-thb-text-secondary hover:bg-slate-50 hover:text-amber-600 transition-colors"
                                      >
                                        <FiEdit2 className="w-4 h-4" /> Edit Employee
                                      </button>
                                      <div className="my-1 border-t border-thb-border" />
                                      <button
                                        onClick={() => { setDeleteConfirmId(emp.id); setActionMenuOpen(null); }}
                                        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                      >
                                        <FiTrash2 className="w-4 h-4" /> Terminate
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-thb-border bg-slate-50/50">
            <p className="text-sm text-thb-text-muted">
              Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => fetchEmployees(pagination.page - 1)} disabled={pagination.page <= 1} className="p-2 rounded-lg border border-thb-border text-thb-text-secondary hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <FiChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                const p = i + 1;
                return (
                  <button key={p} onClick={() => fetchEmployees(p)} className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-colors ${p === pagination.page ? 'bg-green-500 text-white shadow-sm' : 'text-thb-text-secondary hover:bg-white border border-thb-border'}`}>
                    {p}
                  </button>
                );
              })}
              <button onClick={() => fetchEmployees(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="p-2 rounded-lg border border-thb-border text-thb-text-secondary hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <FiChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
      ) : (
      /* ── Grid View ── */
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {employees.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <FiUsers className="w-8 h-8 text-thb-text-muted" />
              </div>
              <p className="text-thb-text-secondary font-medium">No employees found</p>
              <p className="text-sm text-thb-text-muted mt-1">Try adjusting your search or filters</p>
            </div>
          </div>
        ) : (
          employees.map(emp => {
            const statusBadge = getStatusBadge(emp.status);
            const dotColor = getStatusDotColor(emp.status);
            const initials = `${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}`.toUpperCase();
            const avatarGradient = getAvatarColor(`${emp.firstName} ${emp.lastName}`);
            const isDeleting = deleteConfirmId === emp.id;
            return (
              <div key={emp.id} className={`thb-card overflow-hidden group transition-all duration-200 ${isDeleting ? 'ring-2 ring-red-300' : 'hover:shadow-lg'}`}>
                {isDeleting ? (
                  <div className="p-5 text-center space-y-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                      <FiTrash2 className="w-5 h-5 text-red-500" />
                    </div>
                    <p className="text-sm text-red-700 font-medium">Terminate {emp.firstName}?</p>
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => handleDelete(emp.id)} disabled={deleting} className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">
                        {deleting ? 'Wait...' : 'Confirm'}
                      </button>
                      <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 border border-thb-border text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Card Header with Avatar */}
                    <div className="p-5 pb-3">
                      <div className="flex items-start gap-3.5">
                        {emp.avatar ? (
                          <img src={emp.avatar} alt={`${emp.firstName} ${emp.lastName}`} className="w-12 h-12 rounded-full object-cover ring-2 ring-white shadow-sm flex-shrink-0" />
                        ) : (
                          <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm`}>
                            {initials}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-thb-text-primary text-sm truncate">
                            {emp.firstName} {emp.lastName}
                          </h3>
                          <span className="text-[11px] font-mono font-medium text-thb-text-muted bg-slate-100 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                            {emp.employeeId}
                          </span>
                        </div>
                        {/* Quick Action Menu */}
                        <div className="relative" ref={actionMenuOpen === emp.id ? actionMenuRef : null}>
                          <button
                            onClick={() => setActionMenuOpen(actionMenuOpen === emp.id ? null : emp.id)}
                            className="p-1 rounded-lg text-thb-text-muted hover:text-thb-text-primary hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <FiMoreVertical className="w-4 h-4" />
                          </button>
                          {actionMenuOpen === emp.id && (
                            <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl border border-thb-border shadow-lg py-1.5 z-50 animate-fade-in">
                              <button
                                onClick={() => { router.push(`/employees/${emp.id}`); setActionMenuOpen(null); }}
                                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-thb-text-secondary hover:bg-slate-50 hover:text-green-600 transition-colors"
                              >
                                <FiEye className="w-4 h-4" /> View
                              </button>
                              {isAdmin && (
                                <>
                                  <button
                                    onClick={() => { handleOpenEditForm(emp); setActionMenuOpen(null); }}
                                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-thb-text-secondary hover:bg-slate-50 hover:text-amber-600 transition-colors"
                                  >
                                    <FiEdit2 className="w-4 h-4" /> Edit
                                  </button>
                                  <div className="my-1 border-t border-thb-border" />
                                  <button
                                    onClick={() => { setDeleteConfirmId(emp.id); setActionMenuOpen(null); }}
                                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                  >
                                    <FiTrash2 className="w-4 h-4" /> Terminate
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Details */}
                    <div className="px-5 pb-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs text-thb-text-secondary">
                        <FiMail className="w-3.5 h-3.5 text-thb-text-muted flex-shrink-0" />
                        <span className="truncate">{emp.email}</span>
                      </div>
                      {emp.designation && (
                        <div className="flex items-center gap-2 text-xs text-thb-text-secondary">
                          <FiShield className="w-3.5 h-3.5 text-thb-text-muted flex-shrink-0" />
                          <span className="truncate">{emp.designation.title}</span>
                        </div>
                      )}
                      {emp.department && (
                        <div className="flex items-center gap-2 text-xs text-thb-text-secondary">
                          <FiActivity className="w-3.5 h-3.5 text-thb-text-muted flex-shrink-0" />
                          <span className="truncate">{emp.department.name}</span>
                        </div>
                      )}
                    </div>

                    {/* Card Footer */}
                    <div className="px-5 py-3 border-t border-thb-border bg-slate-50/50 flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1.5 ${statusBadge.className}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                        {statusBadge.label}
                      </span>
                      <span className="text-[11px] text-thb-text-muted">
                        Joined {formatDate(emp.dateOfJoining)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
      )}

      {/* Pagination for Grid View */}
      {viewMode === 'grid' && pagination.totalPages > 1 && (
        <div className="thb-card">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm text-thb-text-muted">
              Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => fetchEmployees(pagination.page - 1)} disabled={pagination.page <= 1} className="p-2 rounded-lg border border-thb-border text-thb-text-secondary hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <FiChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                const p = i + 1;
                return (
                  <button key={p} onClick={() => fetchEmployees(p)} className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-colors ${p === pagination.page ? 'bg-green-500 text-white shadow-sm' : 'text-thb-text-secondary hover:bg-slate-50 border border-thb-border'}`}>
                    {p}
                  </button>
                );
              })}
              <button onClick={() => fetchEmployees(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="p-2 rounded-lg border border-thb-border text-thb-text-secondary hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <FiChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
      </>)}
      </>)}
    </div>
  );
}

export default function EmployeesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-4" />
          <p className="text-sm text-thb-text-secondary">Loading Employees...</p>
        </div>
      </div>
    }>
      <EmployeesPageContent />
    </Suspense>
  );
}
