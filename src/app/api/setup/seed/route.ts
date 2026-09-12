import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { isLiveMode } from '@/lib/site-mode';

// ==================== HELPER: Idempotent find-or-create ====================

async function findOrCreateBranch(data: {
  name: string;
  code: string;
  city?: string;
  state?: string;
  country?: string;
  companyId: string;
}) {
  const existing = await db.branch.findFirst({
    where: { code: data.code, companyId: data.companyId },
  });
  if (existing) return existing;
  return db.branch.create({ data });
}

async function findOrCreateDepartment(data: {
  name: string;
  code: string;
  description?: string;
  companyId: string;
  parentId?: string;
}) {
  const existing = await db.department.findFirst({
    where: { code: data.code, companyId: data.companyId },
  });
  if (existing) return existing;
  return db.department.create({ data });
}

async function findOrCreateJob(data: {
  title: string;
  description?: string;
  requirements?: string;
  department?: string;
  location?: string;
  employmentType?: string;
  experienceMin?: number;
  experienceMax?: number;
  salaryMin?: number;
  salaryMax?: number;
  status?: string;
  priority?: string;
  positions?: number;
  filledPositions?: number;
  postedDate?: Date;
  closingDate?: Date;
  companyId: string;
}) {
  const existing = await db.job.findFirst({
    where: { title: data.title, companyId: data.companyId, status: data.status },
  });
  if (existing) return existing;
  return db.job.create({ data });
}

async function findOrCreateCandidate(data: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  currentCompany?: string;
  currentTitle?: string;
  experience?: number;
  expectedSalary?: number;
  noticePeriod?: string;
  status?: string;
  source?: string;
  aiScore?: number;
  skillMatch?: number;
  cultureFitScore?: number;
  notes?: string;
  jobId: string;
}) {
  const existing = await db.candidate.findFirst({
    where: { email: data.email, jobId: data.jobId },
  });
  if (existing) return existing;
  return db.candidate.create({ data });
}

async function findOrCreateWorkflowDef(data: {
  name: string;
  type: string;
  entity: string;
  description?: string;
  isActive: boolean;
  companyId: string;
  steps: { name: string; stepOrder: number; approverRole?: string; approverType: string; autoApprove?: boolean; action: string }[];
}) {
  const existing = await db.workflowDefinition.findFirst({
    where: { entity: data.entity, companyId: data.companyId },
    include: { steps: true },
  });
  if (existing) return existing;
  return db.workflowDefinition.create({
    data: {
      name: data.name,
      type: data.type,
      entity: data.entity,
      description: data.description,
      isActive: data.isActive,
      companyId: data.companyId,
      steps: {
        create: data.steps,
      },
    },
    include: { steps: true },
  });
}

/**
 * Alias for findOrCreateWorkflowDef — creates a workflow definition with steps
 * if one with the same entity + companyId does not already exist.
 */
async function findOrCreateWorkflow(data: {
  name: string;
  type: string;
  entity: string;
  description?: string;
  isActive: boolean;
  companyId: string;
  steps: { name: string; stepOrder: number; approverRole?: string; approverType: string; autoApprove?: boolean; action: string }[];
}) {
  return findOrCreateWorkflowDef(data);
}

async function findOrCreateSurvey(data: {
  title: string;
  description?: string;
  type: string;
  status: string;
  startDate?: Date;
  endDate?: Date;
  companyId: string;
}) {
  const existing = await db.survey.findFirst({
    where: { title: data.title, companyId: data.companyId },
  });
  if (existing) return existing;
  return db.survey.create({ data });
}

async function findOrCreateShift(data: {
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  isActive: boolean;
  companyId: string;
}) {
  const existing = await db.shift.findFirst({
    where: { name: data.name, companyId: data.companyId },
  });
  if (existing) return existing;
  return db.shift.create({ data });
}

// ==================== WORKFLOW DEFINITION TEMPLATES ====================
// These are the 7 major HRMS workflow templates applied to every company.

function getWorkflowTemplates(companyId: string) {
  return [
    // 1. Leave Approval Workflow — entity: "leave", 3 steps
    {
      name: 'Leave Approval Workflow',
      type: 'approval',
      entity: 'leave',
      description: 'Standard leave approval: Direct Manager → HR Review → Auto-approve if both approved',
      isActive: true,
      companyId,
      steps: [
        { name: 'Direct Manager Approval', stepOrder: 0, approverRole: 'manager', approverType: 'role', action: 'approve_reject' },
        { name: 'HR Review', stepOrder: 1, approverRole: 'hr', approverType: 'role', action: 'approve_reject' },
        { name: 'Auto-approve', stepOrder: 2, approverType: 'system', autoApprove: true, action: 'approve_reject' },
      ],
    },
    // 2. Travel Request Approval — entity: "travel", 2 steps
    {
      name: 'Travel Request Approval',
      type: 'approval',
      entity: 'travel',
      description: 'Travel request approval: Manager → Finance',
      isActive: true,
      companyId,
      steps: [
        { name: 'Manager Approval', stepOrder: 0, approverRole: 'manager', approverType: 'role', action: 'approve_reject' },
        { name: 'Finance Approval', stepOrder: 1, approverRole: 'finance', approverType: 'role', action: 'approve_reject' },
      ],
    },
    // 3. Expense Claim Approval — entity: "expense", 2 steps
    {
      name: 'Expense Claim Approval',
      type: 'approval',
      entity: 'expense',
      description: 'Expense claim approval: Manager → Finance',
      isActive: true,
      companyId,
      steps: [
        { name: 'Manager Approval', stepOrder: 0, approverRole: 'manager', approverType: 'role', action: 'approve_reject' },
        { name: 'Finance Approval', stepOrder: 1, approverRole: 'finance', approverType: 'role', action: 'approve_reject' },
      ],
    },
    // 4. Recruitment Pipeline — entity: "recruitment", 4 steps
    {
      name: 'Recruitment Pipeline',
      type: 'approval',
      entity: 'recruitment',
      description: 'Recruitment pipeline: HR Screening → Technical Interview → HR Interview → Offer Approval',
      isActive: true,
      companyId,
      steps: [
        { name: 'HR Screening', stepOrder: 0, approverRole: 'hr', approverType: 'role', action: 'approve_reject' },
        { name: 'Technical Interview', stepOrder: 1, approverRole: 'manager', approverType: 'role', action: 'approve_reject' },
        { name: 'HR Interview', stepOrder: 2, approverRole: 'hr', approverType: 'role', action: 'approve_reject' },
        { name: 'Offer Approval', stepOrder: 3, approverRole: 'admin', approverType: 'role', action: 'approve_reject' },
      ],
    },
    // 5. Performance Review — entity: "performance", 3 steps
    {
      name: 'Performance Review',
      type: 'review',
      entity: 'performance',
      description: 'Performance review: Self Assessment → Manager Review → HR Calibration',
      isActive: true,
      companyId,
      steps: [
        { name: 'Self Assessment', stepOrder: 0, approverType: 'self', autoApprove: true, action: 'approve_reject' },
        { name: 'Manager Review', stepOrder: 1, approverRole: 'manager', approverType: 'role', action: 'approve_reject' },
        { name: 'HR Calibration', stepOrder: 2, approverRole: 'hr', approverType: 'role', action: 'approve_reject' },
      ],
    },
    // 6. Onboarding Workflow — entity: "onboarding", 3 steps
    {
      name: 'Onboarding Workflow',
      type: 'approval',
      entity: 'onboarding',
      description: 'Onboarding: IT Setup → HR Orientation → Department Introduction',
      isActive: true,
      companyId,
      steps: [
        { name: 'IT Setup', stepOrder: 0, approverType: 'system', autoApprove: true, action: 'complete' },
        { name: 'HR Orientation', stepOrder: 1, approverType: 'system', autoApprove: true, action: 'complete' },
        { name: 'Department Introduction', stepOrder: 2, approverType: 'system', autoApprove: true, action: 'complete' },
      ],
    },
    // 7. Offboarding Workflow — entity: "offboarding", 4 steps
    {
      name: 'Offboarding Workflow',
      type: 'approval',
      entity: 'offboarding',
      description: 'Offboarding: Manager Clearance → IT Asset Recovery → Finance Clearance → HR Exit Interview',
      isActive: true,
      companyId,
      steps: [
        { name: 'Manager Clearance', stepOrder: 0, approverRole: 'manager', approverType: 'role', action: 'approve_reject' },
        { name: 'IT Asset Recovery', stepOrder: 1, approverRole: 'admin', approverType: 'role', action: 'approve_reject' },
        { name: 'Finance Clearance', stepOrder: 2, approverRole: 'finance', approverType: 'role', action: 'approve_reject' },
        { name: 'HR Exit Interview', stepOrder: 3, approverRole: 'hr', approverType: 'role', action: 'approve_reject' },
      ],
    },
  ];
}

// ==================== LEAVE POLICY TEMPLATES ====================

function getLeavePolicyTemplates(companyId: string) {
  return [
    { name: 'Casual Leave', type: 'casual', totalDays: 12, carryForward: true, maxCarryDays: 3, isPaid: true, companyId },
    { name: 'Sick Leave', type: 'sick', totalDays: 10, carryForward: false, isPaid: true, companyId },
    { name: 'Earned Leave', type: 'earned', totalDays: 15, carryForward: true, maxCarryDays: 5, isPaid: true, companyId },
    { name: 'Maternity Leave', type: 'maternity', totalDays: 182, carryForward: false, isPaid: true, companyId },
    { name: 'Paternity Leave', type: 'paternity', totalDays: 15, carryForward: false, isPaid: true, companyId },
  ];
}

// ==================== PAYROLL STRUCTURE TEMPLATES ====================

function getPayrollStructureTemplates(companyId: string) {
  return [
    { name: 'Standard Salaried', basicPay: 8000, hra: 3200, da: 800, transportAllowance: 1500, medicalAllowance: 500, specialAllowance: 2000, pfEmployee: 960, pfEmployer: 960, esiEmployee: 200, esiEmployer: 550, taxDeduction: 1200, companyId },
  ];
}

// ==================== SHIFT TEMPLATES ====================

function getShiftTemplates(companyId: string) {
  return [
    { name: 'Morning Shift', startTime: '06:00', endTime: '14:00', breakMinutes: 30, isActive: true, companyId },
    { name: 'Evening Shift', startTime: '14:00', endTime: '22:00', breakMinutes: 30, isActive: true, companyId },
    { name: 'Night Shift', startTime: '22:00', endTime: '06:00', breakMinutes: 30, isActive: true, companyId },
    { name: 'General Shift', startTime: '09:00', endTime: '18:00', breakMinutes: 60, isActive: true, companyId },
  ];
}

// ==================== MAIN SEED FUNCTION ====================

export async function POST(request: Request) {
  // ─── LIVE MODE GUARD ───
  // Setup seed is BLOCKED on the live production platform.
  if (isLiveMode(request)) {
    return NextResponse.json({
      error: 'Setup seeding is disabled on the live platform. This feature is only available on the demo site.',
      code: 'LIVE_MODE_BLOCKED',
    }, { status: 403 });
  }

  const log: string[] = [];
  const created: Record<string, number> = {};

  try {
    // ==================== COMPANIES (upsert by unique `code`) ====================
    log.push('--- Seeding Companies ---');
    const companies = await Promise.all([
      db.company.upsert({
        where: { code: 'TCG' },
        update: {},
        create: { name: 'TechCorp Global', code: 'TCG', industry: 'IT Services', country: 'US', currency: 'USD', timezone: 'America/New_York', isActive: true },
      }),
      db.company.upsert({
        where: { code: 'MPI' },
        update: {},
        create: { name: 'ManufactPro Industries', code: 'MPI', industry: 'Manufacturing', country: 'IN', currency: 'INR', timezone: 'Asia/Kolkata', isActive: true },
      }),
      db.company.upsert({
        where: { code: 'HFS' },
        update: {},
        create: { name: 'HealthFirst Solutions', code: 'HFS', industry: 'Healthcare', country: 'GB', currency: 'GBP', timezone: 'Europe/London', isActive: true },
      }),
      db.company.upsert({
        where: { code: 'RMG' },
        update: {},
        create: { name: 'RetailMax Group', code: 'RMG', industry: 'Retail', country: 'DE', currency: 'EUR', timezone: 'Europe/Berlin', isActive: true },
      }),
      db.company.upsert({
        where: { code: 'LTW' },
        update: {},
        create: { name: 'LogiTrans Worldwide', code: 'LTW', industry: 'Logistics', country: 'SG', currency: 'SGD', timezone: 'Asia/Singapore', isActive: true },
      }),
    ]);
    created.companies = companies.length;
    log.push(`Companies: ${companies.length} ensured`);

    const tcg = companies[0];
    const mpi = companies[1];
    const hfs = companies[2];
    const rmg = companies[3];
    const ltw = companies[4];

    // ==================== BRANCHES (find by code+companyId) ====================
    log.push('--- Seeding Branches ---');
    const existingBranchCount = await db.branch.count();
    if (existingBranchCount < 4) {
      const branches = await Promise.all([
        findOrCreateBranch({ name: 'HQ San Francisco', code: 'TCG-SF', city: 'San Francisco', state: 'CA', country: 'US', companyId: tcg.id }),
        findOrCreateBranch({ name: 'NYC Office', code: 'TCG-NY', city: 'New York', state: 'NY', country: 'US', companyId: tcg.id }),
        findOrCreateBranch({ name: 'Mumbai HQ', code: 'MPI-MUM', city: 'Mumbai', state: 'MH', country: 'IN', companyId: mpi.id }),
        findOrCreateBranch({ name: 'London Office', code: 'HFS-LON', city: 'London', state: 'England', country: 'GB', companyId: hfs.id }),
      ]);
      created.branches = branches.length;
      log.push(`Branches: ${branches.length} ensured`);
    } else {
      created.branches = existingBranchCount;
      log.push(`Branches: already exist (${existingBranchCount}), skipped`);
    }

    // Re-fetch branches for references
    const branchSF = await db.branch.findFirst({ where: { code: 'TCG-SF' } });
    const branchNY = await db.branch.findFirst({ where: { code: 'TCG-NY' } });
    const branchMUM = await db.branch.findFirst({ where: { code: 'MPI-MUM' } });
    const branchLON = await db.branch.findFirst({ where: { code: 'HFS-LON' } });

    // ==================== DEPARTMENTS (find by code+companyId) ====================
    log.push('--- Seeding Departments ---');
    const existingDeptCount = await db.department.count();
    if (existingDeptCount < 10) {
      const departments = await Promise.all([
        findOrCreateDepartment({ name: 'Engineering', code: 'ENG', companyId: tcg.id }),
        findOrCreateDepartment({ name: 'Human Resources', code: 'HR', companyId: tcg.id }),
        findOrCreateDepartment({ name: 'Design', code: 'DSG', companyId: tcg.id }),
        findOrCreateDepartment({ name: 'Finance', code: 'FIN', companyId: tcg.id }),
        findOrCreateDepartment({ name: 'Operations', code: 'OPS', companyId: tcg.id }),
        findOrCreateDepartment({ name: 'Sales', code: 'SAL', companyId: tcg.id }),
        findOrCreateDepartment({ name: 'Quality', code: 'QAT', companyId: mpi.id }),
        findOrCreateDepartment({ name: 'Production', code: 'PRD', companyId: mpi.id }),
        findOrCreateDepartment({ name: 'Clinical', code: 'CLI', companyId: hfs.id }),
        findOrCreateDepartment({ name: 'Analytics', code: 'ANA', companyId: tcg.id }),
      ]);
      created.departments = departments.length;
      log.push(`Departments: ${departments.length} ensured`);
    } else {
      created.departments = existingDeptCount;
      log.push(`Departments: already exist (${existingDeptCount}), skipped`);
    }

    // Re-fetch departments for references
    const engDept = await db.department.findFirst({ where: { code: 'ENG', companyId: tcg.id } });
    const hrDept = await db.department.findFirst({ where: { code: 'HR', companyId: tcg.id } });
    const designDept = await db.department.findFirst({ where: { code: 'DSG', companyId: tcg.id } });
    const finDept = await db.department.findFirst({ where: { code: 'FIN', companyId: tcg.id } });
    const opsDept = await db.department.findFirst({ where: { code: 'OPS', companyId: tcg.id } });
    const salesDept = await db.department.findFirst({ where: { code: 'SAL', companyId: tcg.id } });
    const qualDept = await db.department.findFirst({ where: { code: 'QAT', companyId: mpi.id } });
    const prodDept = await db.department.findFirst({ where: { code: 'PRD', companyId: mpi.id } });
    const clinDept = await db.department.findFirst({ where: { code: 'CLI', companyId: hfs.id } });
    const anaDept = await db.department.findFirst({ where: { code: 'ANA', companyId: tcg.id } });

    // ==================== USERS (upsert by unique `email`) ====================
    log.push('--- Seeding Users ---');
    const users = await Promise.all([
      db.user.upsert({
        where: { email: 'admin@3boxeshrms.com' },
        update: {},
        create: { email: 'admin@3boxeshrms.com', password: 'admin123', name: 'Admin 3Boxes', role: 'super_admin', isActive: true },
      }),
      db.user.upsert({
        where: { email: 'sarah.j@techcorp.com' },
        update: {},
        create: { email: 'sarah.j@techcorp.com', password: 'sarah123', name: 'Sarah Johnson', role: 'admin', companyId: tcg.id, isActive: true },
      }),
      db.user.upsert({
        where: { email: 'raj.p@techcorp.com' },
        update: {},
        create: { email: 'raj.p@techcorp.com', password: 'raj123', name: 'Raj Patel', role: 'admin', companyId: tcg.id, isActive: true },
      }),
      db.user.upsert({
        where: { email: 'emily.c@techcorp.com' },
        update: {},
        create: { email: 'emily.c@techcorp.com', password: 'emily123', name: 'Emily Chen', role: 'admin', companyId: tcg.id, isActive: true },
      }),
      db.user.upsert({
        where: { email: 'michael.b@techcorp.com' },
        update: {},
        create: { email: 'michael.b@techcorp.com', password: 'michael123', name: 'Michael Brown', role: 'admin', companyId: tcg.id, isActive: true },
      }),
      db.user.upsert({
        where: { email: 'priya.s@manufactpro.com' },
        update: {},
        create: { email: 'priya.s@manufactpro.com', password: 'priya123', name: 'Priya Sharma', role: 'reporting_manager', companyId: mpi.id, isActive: true },
      }),
      db.user.upsert({
        where: { email: 'david.w@healthfirst.com' },
        update: {},
        create: { email: 'david.w@healthfirst.com', password: 'david123', name: 'David Wilson', role: 'admin', companyId: hfs.id, isActive: true },
      }),
      db.user.upsert({
        where: { email: 'aiko.t@logitrans.com' },
        update: {},
        create: { email: 'aiko.t@logitrans.com', password: 'aiko123', name: 'Aiko Tanaka', role: 'admin', companyId: ltw.id, isActive: true },
      }),
      db.user.upsert({
        where: { email: 'carlos.r@retailmax.com' },
        update: {},
        create: { email: 'carlos.r@retailmax.com', password: 'carlos123', name: 'Carlos Rodriguez', role: 'admin', companyId: rmg.id, isActive: true },
      }),
      db.user.upsert({
        where: { email: 'lisa.a@techcorp.com' },
        update: {},
        create: { email: 'lisa.a@techcorp.com', password: 'lisa123', name: 'Lisa Anderson', role: 'finance', companyId: tcg.id, isActive: true },
      }),
      db.user.upsert({
        where: { email: 'arjun.k@manufactpro.com' },
        update: {},
        create: { email: 'arjun.k@manufactpro.com', password: 'arjun123', name: 'Arjun Kumar', role: 'admin', companyId: mpi.id, isActive: true },
      }),
      db.user.upsert({
        where: { email: 'hr@acme.com' },
        update: {},
        create: { email: 'hr@acme.com', password: 'acme123', name: 'Acme Corp', role: 'client', companyId: tcg.id, isActive: true },
      }),
      db.user.upsert({
        where: { email: 'info@talenthunt.com' },
        update: {},
        create: { email: 'info@talenthunt.com', password: 'thunt123', name: 'TalentHunt Agency', role: 'vendor', companyId: tcg.id, isActive: true },
      }),
      db.user.upsert({
        where: { email: 'recruiter@techcorp.com' },
        update: {},
        create: { email: 'recruiter@techcorp.com', password: 'recruit123', name: 'Recruiter Kim', role: 'recruiter', companyId: tcg.id, isActive: true },
      }),
    ]);
    created.users = users.length;
    log.push(`Users: ${users.length} ensured`);

    // ==================== EMPLOYEES (upsert by unique `email`) ====================
    log.push('--- Seeding Employees ---');
    const existingEmpCount = await db.employee.count();

    if (existingEmpCount < 10 && engDept && hrDept && designDept && finDept && opsDept && salesDept && qualDept && prodDept && clinDept) {
      const employees = await Promise.all([
        db.employee.upsert({
          where: { email: 'sarah.j@techcorp.com' },
          update: {},
          create: {
            employeeId: 'EMP001', firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.j@techcorp.com',
            designation: 'Senior Software Engineer', jobTitle: 'Senior Developer', employmentType: 'full-time',
            status: 'active', joiningDate: new Date('2022-03-15'),
            companyId: tcg.id, branchId: branchSF?.id, departmentId: engDept.id, userId: users[1].id,
          },
        }),
        db.employee.upsert({
          where: { email: 'raj.p@techcorp.com' },
          update: {},
          create: {
            employeeId: 'EMP002', firstName: 'Raj', lastName: 'Patel', email: 'raj.p@techcorp.com',
            designation: 'HR Manager', employmentType: 'full-time',
            status: 'active', joiningDate: new Date('2021-07-01'),
            companyId: tcg.id, branchId: branchSF?.id, departmentId: hrDept.id, userId: users[2].id,
          },
        }),
        db.employee.upsert({
          where: { email: 'emily.c@techcorp.com' },
          update: {},
          create: {
            employeeId: 'EMP003', firstName: 'Emily', lastName: 'Chen', email: 'emily.c@techcorp.com',
            designation: 'Product Designer', employmentType: 'full-time',
            status: 'active', joiningDate: new Date('2023-01-10'),
            companyId: tcg.id, branchId: branchSF?.id, departmentId: designDept.id, userId: users[3].id,
          },
        }),
        db.employee.upsert({
          where: { email: 'michael.b@techcorp.com' },
          update: {},
          create: {
            employeeId: 'EMP004', firstName: 'Michael', lastName: 'Brown', email: 'michael.b@techcorp.com',
            designation: 'DevOps Lead', employmentType: 'full-time',
            status: 'probation', joiningDate: new Date('2024-09-01'), probationEnd: new Date('2025-03-01'),
            companyId: tcg.id, branchId: branchSF?.id, departmentId: engDept.id, userId: users[4].id,
          },
        }),
        db.employee.upsert({
          where: { email: 'priya.s@manufactpro.com' },
          update: {},
          create: {
            employeeId: 'EMP005', firstName: 'Priya', lastName: 'Sharma', email: 'priya.s@manufactpro.com',
            designation: 'Production Manager', employmentType: 'full-time',
            status: 'active', joiningDate: new Date('2020-11-20'),
            companyId: mpi.id, branchId: branchMUM?.id, departmentId: prodDept.id, userId: users[5].id,
          },
        }),
        db.employee.upsert({
          where: { email: 'david.w@healthfirst.com' },
          update: {},
          create: {
            employeeId: 'EMP006', firstName: 'David', lastName: 'Wilson', email: 'david.w@healthfirst.com',
            designation: 'Nurse Practitioner', employmentType: 'full-time',
            status: 'on_leave', joiningDate: new Date('2019-05-15'),
            companyId: hfs.id, branchId: branchLON?.id, departmentId: clinDept.id, userId: users[6].id,
          },
        }),
        db.employee.upsert({
          where: { email: 'aiko.t@logitrans.com' },
          update: {},
          create: {
            employeeId: 'EMP007', firstName: 'Aiko', lastName: 'Tanaka', email: 'aiko.t@logitrans.com',
            designation: 'Fleet Coordinator', employmentType: 'full-time',
            status: 'active', joiningDate: new Date('2023-06-01'),
            companyId: ltw.id, departmentId: opsDept.id, userId: users[7].id,
          },
        }),
        db.employee.upsert({
          where: { email: 'carlos.r@retailmax.com' },
          update: {},
          create: {
            employeeId: 'EMP008', firstName: 'Carlos', lastName: 'Rodriguez', email: 'carlos.r@retailmax.com',
            designation: 'Store Manager', employmentType: 'full-time',
            status: 'notice_period', joiningDate: new Date('2021-02-10'),
            companyId: rmg.id, departmentId: salesDept.id, userId: users[8].id,
          },
        }),
        db.employee.upsert({
          where: { email: 'lisa.a@techcorp.com' },
          update: {},
          create: {
            employeeId: 'EMP009', firstName: 'Lisa', lastName: 'Anderson', email: 'lisa.a@techcorp.com',
            designation: 'Finance Analyst', employmentType: 'full-time',
            status: 'active', joiningDate: new Date('2022-08-22'),
            companyId: tcg.id, branchId: branchNY?.id, departmentId: finDept.id, userId: users[9].id,
          },
        }),
        db.employee.upsert({
          where: { email: 'arjun.k@manufactpro.com' },
          update: {},
          create: {
            employeeId: 'EMP010', firstName: 'Arjun', lastName: 'Kumar', email: 'arjun.k@manufactpro.com',
            designation: 'Quality Inspector', employmentType: 'full-time',
            status: 'active', joiningDate: new Date('2023-04-01'),
            companyId: mpi.id, branchId: branchMUM?.id, departmentId: qualDept.id, userId: users[10].id,
          },
        }),
      ]);

      // Set reporting manager for some employees
      await db.employee.updateMany({
        where: { employeeId: { in: ['EMP003', 'EMP004', 'EMP009'] } },
        data: { reportingManagerId: employees[0].id },
      });

      created.employees = employees.length;
      log.push(`Employees: ${employees.length} ensured`);
    } else {
      created.employees = existingEmpCount;
      log.push(`Employees: already exist (${existingEmpCount}), skipped`);
    }

    // Re-fetch employees for references
    const empSarah = await db.employee.findFirst({ where: { employeeId: 'EMP001' } });
    const empRaj = await db.employee.findFirst({ where: { employeeId: 'EMP002' } });
    const empEmily = await db.employee.findFirst({ where: { employeeId: 'EMP003' } });
    const empMichael = await db.employee.findFirst({ where: { employeeId: 'EMP004' } });
    const empPriya = await db.employee.findFirst({ where: { employeeId: 'EMP005' } });
    const empDavid = await db.employee.findFirst({ where: { employeeId: 'EMP006' } });
    const empAiko = await db.employee.findFirst({ where: { employeeId: 'EMP007' } });
    const empLisa = await db.employee.findFirst({ where: { employeeId: 'EMP009' } });
    const empArjun = await db.employee.findFirst({ where: { employeeId: 'EMP010' } });

    // ==================== JOBS ====================
    log.push('--- Seeding Jobs ---');
    const existingJobCount = await db.job.count();
    if (existingJobCount < 7) {
      const jobs = await Promise.all([
        findOrCreateJob({
          title: 'Senior Full-Stack Developer', description: 'We are looking for a senior full-stack developer to join our engineering team.',
          requirements: 'React, Node.js, TypeScript, 5+ years experience', department: 'Engineering',
          location: 'San Francisco, CA', employmentType: 'Full-time', experienceMin: 5, experienceMax: 8,
          salaryMin: 140000, salaryMax: 180000, status: 'open', priority: 'high', positions: 2,
          postedDate: new Date('2024-12-01'), companyId: tcg.id,
        }),
        findOrCreateJob({
          title: 'HR Business Partner', description: 'Seeking an experienced HR business partner.',
          requirements: '7+ years HR experience, PHR certification preferred', department: 'Human Resources',
          location: 'New York, NY', employmentType: 'Full-time', experienceMin: 7, experienceMax: 10,
          salaryMin: 95000, salaryMax: 120000, status: 'open', priority: 'medium', positions: 1,
          postedDate: new Date('2024-11-28'), companyId: tcg.id,
        }),
        findOrCreateJob({
          title: 'UX Research Lead', description: 'Lead UX research initiatives across products.',
          requirements: '6+ years UX research, mixed methods expertise', department: 'Design',
          location: 'Remote', employmentType: 'Full-time', experienceMin: 6, experienceMax: 9,
          salaryMin: 120000, salaryMax: 150000, status: 'open', priority: 'high', positions: 1,
          postedDate: new Date('2024-11-15'), companyId: tcg.id,
        }),
        findOrCreateJob({
          title: 'Production Supervisor', description: 'Oversee daily production operations.',
          requirements: '8+ years in manufacturing, Six Sigma preferred', department: 'Operations',
          location: 'Mumbai, India', employmentType: 'Full-time', experienceMin: 8, experienceMax: 12,
          salaryMin: 1500000, salaryMax: 2200000, status: 'open', priority: 'urgent', positions: 3,
          postedDate: new Date('2024-12-05'), companyId: mpi.id,
        }),
        findOrCreateJob({
          title: 'Data Scientist', description: 'Build ML models for business insights.',
          requirements: 'Python, TensorFlow, 3+ years experience', department: 'Analytics',
          location: 'Austin, TX', employmentType: 'Full-time', experienceMin: 3, experienceMax: 5,
          salaryMin: 110000, salaryMax: 145000, status: 'draft', priority: 'medium', positions: 1,
          companyId: tcg.id,
        }),
        findOrCreateJob({
          title: 'Registered Nurse', description: 'Join our clinical team.',
          requirements: 'RN license, BLS/ACLS certified, 2+ years', department: 'Clinical',
          location: 'London, UK', employmentType: 'Full-time', experienceMin: 2, experienceMax: 5,
          salaryMin: 35000, salaryMax: 45000, status: 'open', priority: 'high', positions: 5,
          postedDate: new Date('2024-12-03'), companyId: hfs.id,
        }),
        findOrCreateJob({
          title: 'Cloud Infrastructure Engineer', description: 'Design and maintain cloud infrastructure.',
          requirements: 'AWS/Azure, Terraform, Kubernetes, 4+ years', department: 'Engineering',
          location: 'Singapore', employmentType: 'Full-time', experienceMin: 4, experienceMax: 7,
          salaryMin: 8000, salaryMax: 12000, status: 'on_hold', priority: 'low', positions: 1,
          postedDate: new Date('2024-11-20'), companyId: ltw.id,
        }),
      ]);
      created.jobs = jobs.length;
      log.push(`Jobs: ${jobs.length} ensured`);
    } else {
      created.jobs = existingJobCount;
      log.push(`Jobs: already exist (${existingJobCount}), skipped`);
    }

    // Re-fetch jobs for references
    const jobFullStack = await db.job.findFirst({ where: { title: 'Senior Full-Stack Developer', companyId: tcg.id } });
    const jobHR = await db.job.findFirst({ where: { title: 'HR Business Partner', companyId: tcg.id } });
    const jobUX = await db.job.findFirst({ where: { title: 'UX Research Lead', companyId: tcg.id } });
    const jobDataSci = await db.job.findFirst({ where: { title: 'Data Scientist', companyId: tcg.id } });

    // ==================== CANDIDATES ====================
    log.push('--- Seeding Candidates ---');
    const existingCandidateCount = await db.candidate.count();
    if (existingCandidateCount < 5 && jobFullStack && jobHR && jobUX && jobDataSci) {
      const candidates = await Promise.all([
        findOrCreateCandidate({
          firstName: 'Alex', lastName: 'Turner', email: 'alex.t@email.com',
          currentCompany: 'Google', currentTitle: 'Software Engineer', experience: 6,
          expectedSalary: 160000, noticePeriod: '30 days', status: 'interviewing', source: 'LinkedIn',
          aiScore: 92, skillMatch: 88, cultureFitScore: 85, jobId: jobFullStack.id,
        }),
        findOrCreateCandidate({
          firstName: 'Maya', lastName: 'Singh', email: 'maya.s@email.com',
          currentCompany: 'Amazon', currentTitle: 'Senior Developer', experience: 8,
          expectedSalary: 175000, noticePeriod: '60 days', status: 'shortlisted', source: 'Naukri',
          aiScore: 89, skillMatch: 91, cultureFitScore: 80, jobId: jobFullStack.id,
        }),
        findOrCreateCandidate({
          firstName: 'James', lastName: 'Williams', email: 'james.w@email.com',
          currentCompany: 'Microsoft', currentTitle: 'HR Manager', experience: 9,
          expectedSalary: 110000, noticePeriod: '30 days', status: 'offered', source: 'Referral',
          aiScore: 95, skillMatch: 94, cultureFitScore: 90, jobId: jobHR.id,
        }),
        findOrCreateCandidate({
          firstName: 'Sophie', lastName: 'Martin', email: 'sophie.m@email.com',
          currentCompany: 'Meta', currentTitle: 'UX Researcher', experience: 7,
          expectedSalary: 140000, noticePeriod: '45 days', status: 'screening', source: 'Portal',
          aiScore: 78, skillMatch: 82, cultureFitScore: 88, jobId: jobUX.id,
        }),
        findOrCreateCandidate({
          firstName: 'Wei', lastName: 'Zhang', email: 'wei.z@email.com',
          currentCompany: 'ByteDance', currentTitle: 'Data Engineer', experience: 4,
          expectedSalary: 135000, noticePeriod: '30 days', status: 'applied', source: 'Indeed',
          aiScore: 72, skillMatch: 68, cultureFitScore: 75, jobId: jobDataSci.id,
        }),
      ]);
      created.candidates = candidates.length;
      log.push(`Candidates: ${candidates.length} ensured`);
    } else {
      created.candidates = existingCandidateCount;
      log.push(`Candidates: already exist (${existingCandidateCount}), skipped`);
    }

    // Re-fetch candidates
    const candAlex = await db.candidate.findFirst({ where: { email: 'alex.t@email.com' } });
    const candJames = await db.candidate.findFirst({ where: { email: 'james.w@email.com' } });

    // ==================== INTERVIEWS ====================
    log.push('--- Seeding Interviews ---');
    const existingInterviewCount = await db.interview.count();
    if (existingInterviewCount < 3 && candAlex && candJames && jobFullStack && jobHR) {
      await Promise.all([
        db.interview.create({
          data: {
            type: 'technical', scheduledAt: new Date('2025-01-22T10:00:00'), duration: 60,
            status: 'scheduled', meetingLink: 'https://meet.example.com/interview-1',
            candidateId: candAlex.id, jobId: jobFullStack.id,
          },
        }),
        db.interview.create({
          data: {
            type: 'hr', scheduledAt: new Date('2025-01-23T14:00:00'), duration: 45,
            status: 'scheduled',
            candidateId: candAlex.id, jobId: jobFullStack.id,
          },
        }),
        db.interview.create({
          data: {
            type: 'manager', scheduledAt: new Date('2025-01-20T11:00:00'), duration: 60,
            status: 'completed', feedback: 'Strong technical skills, good culture fit. Recommended for next round.', rating: 4,
            candidateId: candJames.id, jobId: jobHR.id,
          },
        }),
      ]);
      created.interviews = 3;
      log.push('Interviews: 3 created');
    } else {
      created.interviews = existingInterviewCount;
      log.push(`Interviews: already exist (${existingInterviewCount}), skipped`);
    }

    // ==================== ATTENDANCE ====================
    log.push('--- Seeding Attendance ---');
    const existingAttendanceCount = await db.attendance.count();
    if (existingAttendanceCount < 6 && empSarah && empRaj && empEmily && empDavid && empPriya && empAiko) {
      const today = new Date('2025-01-20');
      await Promise.all([
        db.attendance.upsert({
          where: { employeeId_date: { employeeId: empSarah.id, date: today } },
          update: {},
          create: { date: today, checkIn: new Date('2025-01-20T09:02:00'), checkOut: new Date('2025-01-20T18:15:00'), workHours: 8.5, status: 'present', source: 'biometric', employeeId: empSarah.id },
        }),
        db.attendance.upsert({
          where: { employeeId_date: { employeeId: empRaj.id, date: today } },
          update: {},
          create: { date: today, checkIn: new Date('2025-01-20T09:35:00'), checkOut: new Date('2025-01-20T18:30:00'), workHours: 8.0, status: 'late', source: 'mobile', employeeId: empRaj.id },
        }),
        db.attendance.upsert({
          where: { employeeId_date: { employeeId: empEmily.id, date: today } },
          update: {},
          create: { date: today, checkIn: new Date('2025-01-20T08:50:00'), checkOut: new Date('2025-01-20T17:45:00'), workHours: 8.0, status: 'present', source: 'gps', employeeId: empEmily.id },
        }),
        db.attendance.upsert({
          where: { employeeId_date: { employeeId: empDavid.id, date: today } },
          update: {},
          create: { date: today, status: 'absent', source: 'web', employeeId: empDavid.id },
        }),
        db.attendance.upsert({
          where: { employeeId_date: { employeeId: empPriya.id, date: today } },
          update: {},
          create: { date: today, checkIn: new Date('2025-01-20T09:00:00'), checkOut: new Date('2025-01-20T14:00:00'), workHours: 4.0, status: 'half_day', source: 'web', employeeId: empPriya.id },
        }),
        db.attendance.upsert({
          where: { employeeId_date: { employeeId: empAiko.id, date: today } },
          update: {},
          create: { date: today, checkIn: new Date('2025-01-20T08:45:00'), checkOut: new Date('2025-01-20T18:00:00'), workHours: 8.5, status: 'present', source: 'rfid', employeeId: empAiko.id },
        }),
      ]);
      created.attendance = 6;
      log.push('Attendance: 6 ensured');
    } else {
      created.attendance = existingAttendanceCount;
      log.push(`Attendance: already exist (${existingAttendanceCount}), skipped`);
    }

    // ==================== LEAVE POLICIES (for each company) ====================
    log.push('--- Seeding Leave Policies ---');
    let totalLeavePoliciesEnsured = 0;
    for (const company of companies) {
      const policyTemplates = getLeavePolicyTemplates(company.id);
      for (const policy of policyTemplates) {
        const existing = await db.leavePolicy.findFirst({ where: { type: policy.type, companyId: policy.companyId } });
        if (!existing) {
          await db.leavePolicy.create({ data: policy });
          totalLeavePoliciesEnsured++;
        }
      }
    }
    created.leavePolicies = await db.leavePolicy.count();
    log.push(`Leave Policies: ${totalLeavePoliciesEnsured} new, total ${created.leavePolicies} (Casual, Sick, Earned, Maternity, Paternity per company)`);

    // ==================== LEAVES ====================
    log.push('--- Seeding Leaves ---');
    const existingLeaveCount = await db.leave.count();
    if (existingLeaveCount < 5 && empSarah && empRaj && empEmily && empLisa && empArjun) {
      const leaveSarah = await db.leave.create({
        data: { type: 'casual', startDate: new Date('2025-01-22'), endDate: new Date('2025-01-23'), totalDays: 2, reason: 'Personal work', status: 'approved', approverId: empRaj.id, employeeId: empSarah.id },
      });
      const leaveRaj = await db.leave.create({
        data: { type: 'sick', startDate: new Date('2025-01-20'), endDate: new Date('2025-01-21'), totalDays: 2, reason: 'Not feeling well', status: 'pending', employeeId: empRaj.id },
      });
      await db.leave.create({
        data: { type: 'paid', startDate: new Date('2025-02-10'), endDate: new Date('2025-02-14'), totalDays: 5, reason: 'Family vacation', status: 'pending', employeeId: empEmily.id },
      });
      await db.leave.create({
        data: { type: 'maternity', startDate: new Date('2025-01-15'), endDate: new Date('2025-07-15'), totalDays: 182, reason: 'Maternity', status: 'approved', approverId: empRaj.id, employeeId: empLisa.id },
      });
      await db.leave.create({
        data: { type: 'comp_off', startDate: new Date('2025-01-25'), endDate: new Date('2025-01-25'), totalDays: 1, reason: 'Weekend work compensation', status: 'approved', approverId: empMichael?.id, employeeId: empArjun.id },
      });
      created.leaves = 5;
      log.push('Leaves: 5 created');

      // ==================== AUDIT LOGS (need leave IDs) ====================
      log.push('--- Seeding Audit Logs ---');
      const existingAuditCount = await db.auditLog.count();
      if (existingAuditCount < 4) {
        await Promise.all([
          db.auditLog.create({ data: { action: 'LOGIN', entity: 'User', entityId: users[1].id, details: 'Sarah Johnson logged in', userId: users[1].id, ipAddress: '192.168.1.100' } }),
          db.auditLog.create({ data: { action: 'CREATE', entity: 'Leave', entityId: leaveSarah.id, details: 'Leave request created by Sarah Johnson', userId: users[1].id } }),
          db.auditLog.create({ data: { action: 'UPDATE', entity: 'Leave', entityId: leaveRaj.id, details: 'Leave approved by Raj Patel', userId: users[2].id } }),
          db.auditLog.create({ data: { action: 'CREATE', entity: 'Employee', entityId: empMichael?.id || '', details: 'New employee Michael Brown added', userId: users[1].id } }),
        ]);
        created.auditLogs = 4;
        log.push('Audit Logs: 4 created');
      } else {
        created.auditLogs = existingAuditCount;
        log.push(`Audit Logs: already exist (${existingAuditCount}), skipped`);
      }
    } else {
      created.leaves = existingLeaveCount;
      log.push(`Leaves: already exist (${existingLeaveCount}), skipped`);
      // Still check audit logs
      const existingAuditCount = await db.auditLog.count();
      created.auditLogs = existingAuditCount;
    }

    // ==================== PAYROLL STRUCTURES (for each company) ====================
    log.push('--- Seeding Payroll ---');
    let totalPayrollStructuresEnsured = 0;
    for (const company of companies) {
      const structTemplates = getPayrollStructureTemplates(company.id);
      for (const struct of structTemplates) {
        const existing = await db.payrollStructure.findFirst({ where: { name: struct.name, companyId: struct.companyId } });
        if (!existing) {
          await db.payrollStructure.create({ data: struct });
          totalPayrollStructuresEnsured++;
        }
      }
    }
    created.payrollStructures = await db.payrollStructure.count();
    log.push(`Payroll Structures: ${totalPayrollStructuresEnsured} new, total ${created.payrollStructures} (Standard Salaried per company)`);

    if (empSarah && empRaj && empEmily && empMichael) {
      const existingPayrollRecCount = await db.payrollRecord.count();
      if (existingPayrollRecCount < 4) {
        await Promise.all([
          db.payrollRecord.upsert({
            where: { employeeId_month_year: { employeeId: empSarah.id, month: 1, year: 2025 } },
            update: {},
            create: { month: 1, year: 2025, basicPay: 8000, grossSalary: 12000, totalDeductions: 3200, netSalary: 8800, status: 'paid', paymentDate: new Date('2025-01-31'), employeeId: empSarah.id },
          }),
          db.payrollRecord.upsert({
            where: { employeeId_month_year: { employeeId: empRaj.id, month: 1, year: 2025 } },
            update: {},
            create: { month: 1, year: 2025, basicPay: 7500, grossSalary: 11000, totalDeductions: 2900, netSalary: 8100, status: 'paid', paymentDate: new Date('2025-01-31'), employeeId: empRaj.id },
          }),
          db.payrollRecord.upsert({
            where: { employeeId_month_year: { employeeId: empEmily.id, month: 1, year: 2025 } },
            update: {},
            create: { month: 1, year: 2025, basicPay: 6500, grossSalary: 9500, totalDeductions: 2500, netSalary: 7000, status: 'processed', employeeId: empEmily.id },
          }),
          db.payrollRecord.upsert({
            where: { employeeId_month_year: { employeeId: empMichael.id, month: 1, year: 2025 } },
            update: {},
            create: { month: 1, year: 2025, basicPay: 9000, grossSalary: 13500, totalDeductions: 3600, netSalary: 9900, status: 'draft', employeeId: empMichael.id },
          }),
        ]);
        created.payrollRecords = 4;
        log.push('Payroll Records: 4 ensured');
      } else {
        created.payrollRecords = existingPayrollRecCount;
        log.push(`Payroll Records: already exist (${existingPayrollRecCount}), skipped`);
      }
    }

    // ==================== GOALS ====================
    log.push('--- Seeding Goals ---');
    const existingGoalCount = await db.goal.count();
    if (existingGoalCount < 4 && empSarah && empRaj && empEmily && empMichael) {
      await Promise.all([
        db.goal.create({ data: { title: 'Complete React 19 Migration', description: 'Migrate all frontend apps to React 19', type: 'individual', category: 'okr', progress: 65, status: 'in_progress', startDate: new Date('2025-01-01'), endDate: new Date('2025-03-31'), employeeId: empSarah.id } }),
        db.goal.create({ data: { title: 'Reduce Hiring Time-to-Fill', description: 'Reduce average time-to-fill from 45 to 30 days', type: 'department', category: 'kpi', progress: 40, status: 'in_progress', startDate: new Date('2025-01-01'), endDate: new Date('2025-06-30'), employeeId: empRaj.id } }),
        db.goal.create({ data: { title: 'Improve Design System Coverage', description: 'Achieve 90% component coverage in design system', type: 'individual', category: 'smart', progress: 80, status: 'in_progress', startDate: new Date('2025-01-01'), endDate: new Date('2025-02-28'), employeeId: empEmily.id } }),
        db.goal.create({ data: { title: 'Achieve 99.9% Uptime', description: 'Maintain 99.9% uptime for all production services', type: 'team', category: 'kpi', progress: 95, status: 'in_progress', startDate: new Date('2025-01-01'), endDate: new Date('2025-12-31'), employeeId: empMichael.id } }),
      ]);
      created.goals = 4;
      log.push('Goals: 4 created');
    } else {
      created.goals = existingGoalCount;
      log.push(`Goals: already exist (${existingGoalCount}), skipped`);
    }

    // ==================== ASSETS ====================
    log.push('--- Seeding Assets ---');
    const existingAssetCount = await db.assetAllocation.count();
    if (existingAssetCount < 4 && empSarah && empRaj && empEmily && empMichael) {
      await Promise.all([
        db.assetAllocation.create({ data: { assetType: 'laptop', assetName: 'MacBook Pro 16"', assetCode: 'LTP-0042', serialNumber: 'MBP16-2024-0042', status: 'allocated', employeeId: empSarah.id } }),
        db.assetAllocation.create({ data: { assetType: 'phone', assetName: 'iPhone 15 Pro', assetCode: 'PHN-0088', status: 'allocated', employeeId: empRaj.id } }),
        db.assetAllocation.create({ data: { assetType: 'access_card', assetName: 'Access Card - Floor 5', assetCode: 'AC-1025', status: 'allocated', employeeId: empEmily.id } }),
        db.assetAllocation.create({ data: { assetType: 'laptop', assetName: 'Dell XPS 15', assetCode: 'LTP-0045', status: 'allocated', notes: 'On loan from IT pool', employeeId: empMichael.id } }),
      ]);
      created.assets = 4;
      log.push('Assets: 4 created');
    } else {
      created.assets = existingAssetCount;
      log.push(`Assets: already exist (${existingAssetCount}), skipped`);
    }

    // ==================== TRAVEL & EXPENSE ====================
    log.push('--- Seeding Travel & Expense ---');
    const existingTravelCount = await db.travelRequest.count();
    if (existingTravelCount < 2 && empSarah && empEmily) {
      await Promise.all([
        db.travelRequest.create({ data: { purpose: 'Client Meeting - Acme Corp', destination: 'New York, NY', departureDate: new Date('2025-02-15'), returnDate: new Date('2025-02-17'), estimatedCost: 2500, status: 'pending', employeeId: empSarah.id } }),
        db.travelRequest.create({ data: { purpose: 'Tech Conference 2025', destination: 'Las Vegas, NV', departureDate: new Date('2025-03-10'), returnDate: new Date('2025-03-13'), estimatedCost: 4000, approvedCost: 3800, status: 'approved', employeeId: empEmily.id } }),
      ]);
      created.travelRequests = 2;
      log.push('Travel Requests: 2 created');
    } else {
      created.travelRequests = existingTravelCount;
      log.push(`Travel Requests: already exist (${existingTravelCount}), skipped`);
    }

    const existingExpenseCount = await db.expenseClaim.count();
    if (existingExpenseCount < 3 && empSarah && empRaj && empEmily) {
      await Promise.all([
        db.expenseClaim.create({ data: { type: 'travel', amount: 450, description: 'Taxi to airport', status: 'pending', employeeId: empSarah.id } }),
        db.expenseClaim.create({ data: { type: 'food', amount: 120, description: 'Team lunch meeting', status: 'approved', employeeId: empRaj.id } }),
        db.expenseClaim.create({ data: { type: 'communication', amount: 85, description: 'International calls for project', status: 'reimbursed', employeeId: empEmily.id } }),
      ]);
      created.expenseClaims = 3;
      log.push('Expense Claims: 3 created');
    } else {
      created.expenseClaims = existingExpenseCount;
      log.push(`Expense Claims: already exist (${existingExpenseCount}), skipped`);
    }

    // ==================== LEARNING ====================
    log.push('--- Seeding Learning ---');
    const existingLearningCount = await db.learningRecord.count();
    if (existingLearningCount < 3 && empSarah && empRaj && empEmily) {
      await Promise.all([
        db.learningRecord.create({ data: { courseName: 'Advanced React Patterns', provider: 'Frontend Masters', type: 'e_learning', status: 'in_progress', employeeId: empSarah.id } }),
        db.learningRecord.create({ data: { courseName: 'HR Analytics Fundamentals', provider: 'Coursera', type: 'certification', status: 'completed', completedAt: new Date('2024-12-15'), score: 92, certificate: 'cert-hr-analytics-2024', employeeId: empRaj.id } }),
        db.learningRecord.create({ data: { courseName: 'Design Systems Workshop', provider: 'Internal', type: 'workshop', status: 'enrolled', employeeId: empEmily.id } }),
      ]);
      created.learning = 3;
      log.push('Learning Records: 3 created');
    } else {
      created.learning = existingLearningCount;
      log.push(`Learning Records: already exist (${existingLearningCount}), skipped`);
    }

    // ==================== TICKETS ====================
    log.push('--- Seeding Tickets ---');
    const existingTicketCount = await db.ticket.count();
    if (existingTicketCount < 3 && empSarah && empRaj && empMichael) {
      await Promise.all([
        db.ticket.create({ data: { subject: 'VPN Connection Issue', description: 'Cannot connect to VPN since morning', category: 'it', priority: 'high', status: 'in_progress', employeeId: empSarah.id } }),
        db.ticket.create({ data: { subject: 'Payroll Discrepancy', description: 'December salary has incorrect deduction', category: 'payroll', priority: 'urgent', status: 'open', employeeId: empRaj.id } }),
        db.ticket.create({ data: { subject: 'Access Request - Production DB', description: 'Need read access to production database for debugging', category: 'it', priority: 'medium', status: 'resolved', resolution: 'Access granted by IT admin', employeeId: empMichael.id } }),
      ]);
      created.tickets = 3;
      log.push('Tickets: 3 created');
    } else {
      created.tickets = existingTicketCount;
      log.push(`Tickets: already exist (${existingTicketCount}), skipped`);
    }

    // ==================== CLIENTS & VENDORS ====================
    log.push('--- Seeding Clients & Vendors ---');
    const existingClientCount = await db.client.count();
    if (existingClientCount < 3) {
      await Promise.all([
        db.client.create({ data: { name: 'Acme Corp', email: 'hr@acme.com', clientCompany: 'Acme Corporation', industry: 'Technology', contractStart: new Date('2024-01-01'), contractEnd: new Date('2025-12-31'), status: 'active', companyId: tcg.id } }),
        db.client.create({ data: { name: 'GlobalTech Inc', email: 'talent@globaltech.com', clientCompany: 'GlobalTech Inc', industry: 'Software', contractStart: new Date('2024-06-01'), contractEnd: new Date('2025-05-31'), status: 'active', companyId: tcg.id } }),
        db.client.create({ data: { name: 'BuildRight Construction', email: 'hr@buildright.com', clientCompany: 'BuildRight', industry: 'Construction', contractStart: new Date('2023-09-01'), contractEnd: new Date('2024-08-31'), status: 'active', companyId: tcg.id } }),
      ]);
      created.clients = 3;
      log.push('Clients: 3 created');
    } else {
      created.clients = existingClientCount;
      log.push(`Clients: already exist (${existingClientCount}), skipped`);
    }

    const existingVendorCount = await db.vendor.count();
    if (existingVendorCount < 3) {
      const vendors = await Promise.all([
        db.vendor.create({ data: { name: 'TalentHunt Agency', email: 'info@talenthunt.com', vendorCompany: 'TalentHunt', serviceType: 'recruitment', status: 'active', rating: 4.5, companyId: tcg.id } }),
        db.vendor.create({ data: { name: 'StaffPro Solutions', email: 'contact@staffpro.com', vendorCompany: 'StaffPro', serviceType: 'staffing', status: 'active', rating: 4.2, companyId: tcg.id } }),
        db.vendor.create({ data: { name: 'VerifyRight BGV', email: 'team@verifyright.com', vendorCompany: 'VerifyRight', serviceType: 'bgv', status: 'active', rating: 4.8, companyId: tcg.id } }),
      ]);
      created.vendors = vendors.length;

      // Sub-vendors
      const existingSubVendorCount = await db.subVendor.count();
      if (existingSubVendorCount < 2) {
        await Promise.all([
          db.subVendor.create({ data: { name: 'QuickHire Regional', email: 'hire@quickhire.com', company: 'QuickHire', status: 'active', vendorId: vendors[0].id } }),
          db.subVendor.create({ data: { name: 'TalentBridge East', email: 'east@talentbridge.com', company: 'TalentBridge', status: 'active', vendorId: vendors[1].id } }),
        ]);
        created.subVendors = 2;
        log.push('Vendors: 3 created, Sub-vendors: 2 created');
      } else {
        created.subVendors = existingSubVendorCount;
        log.push(`Vendors: 3 created, Sub-vendors: already exist`);
      }
    } else {
      created.vendors = existingVendorCount;
      created.subVendors = await db.subVendor.count();
      log.push(`Vendors: already exist (${existingVendorCount}), Sub-vendors: already exist`);
    }

    // ==================== WORKFLOW DEFINITIONS (7 comprehensive workflows per company) ====================
    log.push('--- Seeding Workflow Definitions ---');
    let totalWorkflowsEnsured = 0;
    for (const company of companies) {
      const workflowTemplates = getWorkflowTemplates(company.id);
      for (const wf of workflowTemplates) {
        await findOrCreateWorkflow(wf);
        totalWorkflowsEnsured++;
      }
    }
    created.workflows = await db.workflowDefinition.count();
    log.push(`Workflow Definitions: ${totalWorkflowsEnsured} templates across ${companies.length} companies, total ${created.workflows} (Leave, Travel, Expense, Recruitment, Performance, Onboarding, Offboarding)`);

    // ==================== SURVEYS ====================
    log.push('--- Seeding Surveys ---');
    const existingSurveyCount = await db.survey.count();
    if (existingSurveyCount < 1) {
      const survey = await findOrCreateSurvey({
        title: 'Q1 2025 Employee Engagement Pulse',
        description: 'Quarterly pulse survey to measure employee engagement and satisfaction.',
        type: 'pulse', status: 'active',
        startDate: new Date('2025-01-15'), endDate: new Date('2025-01-31'),
        companyId: tcg.id,
      });

      const surveyQuestions = await Promise.all([
        db.surveyQuestion.create({ data: { question: 'How satisfied are you with your current role?', type: 'rating', order: 0, surveyId: survey.id } }),
        db.surveyQuestion.create({ data: { question: 'Do you feel your work is recognized?', type: 'rating', order: 1, surveyId: survey.id } }),
        db.surveyQuestion.create({ data: { question: 'How would you rate team collaboration?', type: 'rating', order: 2, surveyId: survey.id } }),
        db.surveyQuestion.create({ data: { question: 'What could we improve?', type: 'text', required: false, order: 3, surveyId: survey.id } }),
        db.surveyQuestion.create({ data: { question: 'Would you recommend this company as a workplace?', type: 'rating', order: 4, surveyId: survey.id } }),
      ]);

      // Survey responses
      if (empSarah && empRaj) {
        await Promise.all([
          db.surveyResponse.create({ data: { answer: '4', questionId: surveyQuestions[0].id, employeeId: empSarah.id } }),
          db.surveyResponse.create({ data: { answer: '3', questionId: surveyQuestions[1].id, employeeId: empSarah.id } }),
          db.surveyResponse.create({ data: { answer: '5', questionId: surveyQuestions[2].id, employeeId: empSarah.id } }),
          db.surveyResponse.create({ data: { answer: '4', questionId: surveyQuestions[0].id, employeeId: empRaj.id } }),
          db.surveyResponse.create({ data: { answer: '4', questionId: surveyQuestions[1].id, employeeId: empRaj.id } }),
        ]);
      }
      created.surveys = 1;
      created.surveyQuestions = 5;
      created.surveyResponses = 5;
      log.push('Surveys: 1 with 5 questions and 5 responses created');
    } else {
      created.surveys = existingSurveyCount;
      created.surveyQuestions = await db.surveyQuestion.count();
      created.surveyResponses = await db.surveyResponse.count();
      log.push(`Surveys: already exist (${existingSurveyCount}), skipped`);
    }

    // ==================== ONBOARDING TASKS ====================
    log.push('--- Seeding Onboarding Tasks ---');
    const existingOnboardingCount = await db.onboardingTask.count();
    if (existingOnboardingCount < 5 && empMichael) {
      await Promise.all([
        db.onboardingTask.create({ data: { title: 'Complete IT Setup', description: 'Laptop, email, VPN access setup', category: 'it', status: 'completed', completedAt: new Date('2024-09-02'), employeeId: empMichael.id } }),
        db.onboardingTask.create({ data: { title: 'HR Orientation', description: 'Company policies, benefits overview', category: 'hr', status: 'completed', completedAt: new Date('2024-09-03'), employeeId: empMichael.id } }),
        db.onboardingTask.create({ data: { title: 'Team Introduction', description: 'Meet the engineering team', category: 'team', status: 'completed', completedAt: new Date('2024-09-04'), employeeId: empMichael.id } }),
        db.onboardingTask.create({ data: { title: 'Codebase Walkthrough', description: 'Overview of the main repositories', category: 'training', status: 'in_progress', employeeId: empMichael.id } }),
        db.onboardingTask.create({ data: { title: 'First Project Assignment', description: 'Assign first development task', category: 'training', status: 'pending', employeeId: empMichael.id } }),
      ]);
      created.onboardingTasks = 5;
      log.push('Onboarding Tasks: 5 created');
    } else {
      created.onboardingTasks = existingOnboardingCount;
      log.push(`Onboarding Tasks: already exist (${existingOnboardingCount}), skipped`);
    }

    // ==================== SHIFTS (for each company) ====================
    log.push('--- Seeding Shifts ---');
    let totalShiftsEnsured = 0;
    for (const company of companies) {
      const shiftTemplates = getShiftTemplates(company.id);
      for (const shiftData of shiftTemplates) {
        await findOrCreateShift(shiftData);
        totalShiftsEnsured++;
      }
    }
    created.shifts = await db.shift.count();
    log.push(`Shifts: ${totalShiftsEnsured} templates across ${companies.length} companies, total ${created.shifts} (Morning, Evening, Night, General per company)`);

    // Shift members (TCG employees on General Shift)
    if (empSarah && empRaj && empEmily) {
      const tcgGeneralShift = await db.shift.findFirst({ where: { name: 'General Shift', companyId: tcg.id } });
      if (tcgGeneralShift) {
        const effectiveDate = new Date('2025-01-01');
        for (const emp of [empSarah, empRaj, empEmily]) {
          try {
            await db.shiftMember.upsert({
              where: { employeeId_effectiveDate_shiftId: { employeeId: emp.id, effectiveDate, shiftId: tcgGeneralShift.id } },
              update: {},
              create: { effectiveDate, shiftId: tcgGeneralShift.id, employeeId: emp.id },
            });
          } catch {
            // Skip if already exists
          }
        }
      }
    }
    created.shiftMembers = await db.shiftMember.count();

    // ==================== COMPLIANCE ITEMS ====================
    log.push('--- Seeding Compliance Items ---');
    const existingComplianceCount = await db.complianceItem.count();
    if (existingComplianceCount < 3) {
      await Promise.all([
        db.complianceItem.create({ data: { title: 'Annual Fire Safety Training', description: 'Mandatory fire safety training for all employees', category: 'safety', dueDate: new Date('2025-03-31'), status: 'pending', companyId: tcg.id } }),
        db.complianceItem.create({ data: { title: 'POPI Act Compliance Review', description: 'Review data protection compliance', category: 'regulatory', dueDate: new Date('2025-06-30'), status: 'pending', companyId: tcg.id } }),
        db.complianceItem.create({ data: { title: 'Quarterly Tax Filing', description: 'Q4 2024 tax filing', category: 'tax', dueDate: new Date('2025-01-31'), status: 'completed', companyId: tcg.id } }),
      ]);
      created.complianceItems = 3;
      log.push('Compliance Items: 3 created');
    } else {
      created.complianceItems = existingComplianceCount;
      log.push(`Compliance Items: already exist (${existingComplianceCount}), skipped`);
    }

    // ==================== NOTIFICATIONS ====================
    log.push('--- Seeding Notifications ---');
    const existingNotifCount = await db.notification.count();
    if (existingNotifCount < 8) {
      await Promise.all([
        db.notification.create({ data: { title: 'Leave Request', message: 'Raj Patel has submitted a sick leave request', type: 'info', category: 'leave', userId: users[1].id } }),
        db.notification.create({ data: { title: 'New Candidate', message: 'Alex Turner applied for Senior Full-Stack Developer', type: 'success', category: 'recruitment', userId: users[1].id } }),
        db.notification.create({ data: { title: 'Payroll Processed', message: 'January 2025 payroll has been processed', type: 'success', category: 'payroll', userId: users[1].id } }),
        db.notification.create({ data: { title: 'Attendance Alert', message: 'David Wilson is absent today without prior notice', type: 'warning', category: 'attendance', userId: users[1].id } }),
        db.notification.create({ data: { title: 'Expense Approval', message: 'You have 2 pending expense approvals', type: 'info', category: 'expense', userId: users[1].id } }),
        db.notification.create({ data: { title: 'Probation Ending', message: 'Michael Brown probation ends on March 1, 2025', type: 'warning', category: 'employee', userId: users[1].id } }),
        db.notification.create({ data: { title: 'New Ticket', message: 'VPN Connection Issue reported by Sarah Johnson', type: 'info', category: 'helpdesk', userId: users[1].id } }),
        db.notification.create({ data: { title: 'Interview Scheduled', message: 'Technical interview with Alex Turner on Jan 22', type: 'info', category: 'recruitment', userId: users[13].id } }),
      ]);
      created.notifications = 8;
      log.push('Notifications: 8 created');
    } else {
      created.notifications = existingNotifCount;
      log.push(`Notifications: already exist (${existingNotifCount}), skipped`);
    }

    // Ensure audit logs count is set
    if (!created.auditLogs) {
      created.auditLogs = await db.auditLog.count();
    }

    log.push('\n=== Database seeding completed successfully! ===');

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      created,
      log,
    });
  } catch (error) {
    console.error('Seed error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
        created,
        log,
      },
      { status: 500 }
    );
  }
}
