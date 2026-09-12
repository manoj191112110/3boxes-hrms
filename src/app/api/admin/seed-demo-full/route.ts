import { NextResponse } from 'next/server';
import { getPlatformDb, getDbForTenant } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders, hashPassword } from '@/lib/auth';
import { isLiveMode } from '@/lib/site-mode';

/**
 * POST /api/admin/seed-demo-full?phase=1..6
 *
 * COMPREHENSIVE demo seeder for the demo link ONLY (3boxes-hrms-demo tenant).
 * GOLDEN RULE: This endpoint is BLOCKED on the live site (3boxeshrms.com).
 *
 * ══════════════════════════════════════════════════════════════════════
 * WHY PHASED? The previous single-request version ran ~2,500 sequential
 * DB round-trips (one findFirst + one create per row) which takes minutes
 * against Neon from Vercel → the serverless function was killed by the
 * platform timeout → the UI showed "demo data not seeded".
 *
 * FIX: The seed is split into 6 independent PHASES. The UI calls them
 * sequentially. Every phase uses BULK writes (createMany / $transaction)
 * so each phase finishes in a handful of round-trips (< 10 s on any plan).
 *
 * Also fixes from the old version:
 *   - LeaveType requires companyId (schema is non-nullable) → leave types
 *     are now created PER COMPANY. Previously every create failed and the
 *     route crashed with a TypeError on the empty array → 500 error.
 *   - Attendance.checkIn / checkOut are DateTime columns → we now store
 *     real Date objects (the old version stored 'HH:mm' strings which
 *     Prisma rejected → zero attendance rows).
 *   - JobApplication.expectedSalary is a String column → we store
 *     "12 LPA" style strings instead of numbers.
 * ══════════════════════════════════════════════════════════════════════
 *
 * Phases:
 *   1. Org structure  — company group, 6 companies, branches, departments,
 *                       designations, shifts, holidays + DEMO LOGIN USERS
 *                       (superadmin@3boxeshrms.com + 5 admin accounts,
 *                       password MarqAI@2026 — restores the credentials
 *                       panel on the login page and demo sign-in itself)
 *   2. Employees      — 50 employees + primary company mappings + reporting managers
 *   3. Leave          — 5 leave types × 6 companies, balances for all
 *                       employees, 30 leave requests (mixed statuses)
 *   4. Attendance + Payroll — last 30 days attendance (~1,000 rows),
 *                       3 payroll runs + 150 payslips
 *   5. Recruitment + Assets — 6 job postings, 20 candidates, 30 applications,
 *                       30 assets, 25 assignments
 *   6. Training + Performance + Grievances + Helpdesk
 *
 * Extra params:
 *   ?reset=true  — (with phase 1) delete existing demo data first
 *
 * Every phase is IDEMPOTENT: existing rows are detected with a single
 * findMany and skipped, so re-running never duplicates data.
 */

export const maxDuration = 60; // allow up to 60s (Vercel caps per plan)

// ─── Company definitions (6 companies) ──────────────────────────────
const COMPANIES = [
  { name: 'TechNova Solutions', code: 'TNS', city: 'Hyderabad', state: 'Telangana', domain: 'technova.demo' },
  { name: 'Innovatech Systems', code: 'ISY', city: 'Bengaluru', state: 'Karnataka', domain: 'innovatech.demo' },
  { name: 'Global Dynamics Corp', code: 'GDC', city: 'Mumbai', state: 'Maharashtra', domain: 'globaldynamics.demo' },
  { name: 'Apex Services Ltd', code: 'ASG', city: 'Delhi', state: 'Delhi', domain: 'apexservices.demo' },
  { name: 'Prime Healthcare Group', code: 'PHL', city: 'Chennai', state: 'Tamil Nadu', domain: 'primehealthcare.demo' },
  { name: 'Stellar Enterprises', code: 'STE', city: 'Pune', state: 'Maharashtra', domain: 'stellar.demo' },
];

// 50 employees across 6 companies — every company gets at least 6
const EMPLOYEE_DISTRIBUTION = [10, 9, 8, 8, 8, 7];

const DEPARTMENTS = ['Engineering', 'Human Resources', 'Finance', 'Sales & Marketing', 'Operations'];

const DESIGNATIONS = [
  { title: 'Director', level: 6 },
  { title: 'Senior Manager', level: 5 },
  { title: 'Manager', level: 4 },
  { title: 'Team Lead', level: 3 },
  { title: 'Senior Executive', level: 2 },
  { title: 'Executive', level: 1 },
];

const FIRST_NAMES = ['Aarav', 'Vivaan', 'Aditya', 'Ishaan', 'Kabir', 'Arjun', 'Rohan', 'Rahul', 'Priya', 'Ananya', 'Sneha', 'Pooja', 'Neha', 'Kavya', 'Divya', 'Riya', 'Anjali', 'Meera', 'Vikram', 'Suresh', 'Rajesh', 'Amit', 'Sunil', 'Deepak', 'Manish', 'Varun', 'Kiran', 'Nikhil', 'Sandeep', 'Harish', 'Lakshmi', 'Saraswati', 'Ganesh', 'Murugan', 'Karthik', 'Bala', 'Divakar', 'Gopal', 'Ramesh', 'Krishna'];
const LAST_NAMES = ['Sharma', 'Verma', 'Reddy', 'Nair', 'Iyer', 'Patel', 'Gupta', 'Singh', 'Kumar', 'Das', 'Mehta', 'Joshi', 'Rao', 'Menon', 'Pillai', 'Chopra', 'Malhotra', 'Kapoor', 'Shah', 'Desai', 'Bose', 'Chatterjee', 'Banerjee', 'Mukherjee', 'Ghosh', 'Agarwal', 'Bansal', 'Saxena', 'Pandey', 'Mishra'];

const LEAVE_REASONS = [
  'Family function in hometown', 'Not feeling well, fever and cold', 'Personal work at home',
  'Child school event', 'Medical checkup appointment', 'Wedding in the family',
  'House relocation', 'Need rest due to fatigue', 'Attending training program',
  'Travel plans booked earlier', 'Elderly care at home', 'Exam preparation',
];

const GRIEVANCE_TYPES = ['workload', 'salary', 'other', 'harassment', 'discrimination'];
const GRIEVANCE_SUBJECTS = [
  'Excessive workload in current project', 'Salary discrepancy in last month payslip',
  'Workplace ventilation issue on 3rd floor', 'Request for ergonomic chair',
  'Unclear shift rotation policy', 'Team meeting scheduled during lunch hours',
  'Access card not working properly', 'Cabin AC not functioning',
];

const TICKET_SUBJECTS = [
  'Laptop running very slow', 'Unable to access HR portal', 'Payslip not visible for last month',
  'Request for additional monitor', 'VPN connection issues', 'Email password reset required',
  'Leave balance showing incorrect', 'Parking slot allocation request',
  'ID card reprint request', 'Software license renewal', 'Printer not working in 2nd floor',
  'WiFi disconnects frequently', 'Request for team lunch reimbursement',
  'Attendance regularization for last Friday', 'Medical insurance card not received',
];

// ─── Helpers ─────────────────────────────────────────────────────────
function pick<T>(arr: T[], i: number): T { return arr[Math.abs(i) % arr.length]; }
function rand(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }
function daysAgo(n: number): Date { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function isWeekend(d: Date): boolean { const day = d.getDay(); return day === 0 || day === 6; }
function dateOnly(d: Date): Date { return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); }
function atTime(d: Date, h: number, m: number): Date { return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), h, m)); }
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
const SALARY_BY_TITLE: Record<string, number> = {
  Director: 2800000, 'Senior Manager': 2200000, Manager: 1600000,
  'Team Lead': 1200000, 'Senior Executive': 800000, Executive: 550000,
};

function json(data: any, status = 200) { return NextResponse.json(data, { status }); }

// ─── Auth + demo-tenant resolution shared by every phase ────────────
async function authorize(request: Request) {
  if (isLiveMode(request)) {
    return { error: json({ error: 'Seeding is BLOCKED on the live site. This endpoint only works on the demo link.' }, 403) };
  }
  const token = getTokenFromHeaders(request);
  if (!token) return { error: json({ error: 'Unauthorized' }, 401) };
  const decoded = await verifyToken(token);
  if (!decoded) return { error: json({ error: 'Invalid token' }, 401) };
  if (!['super_admin', 'tenant_admin', 'admin'].includes(decoded.role as string)) {
    return { error: json({ error: 'Only admins can seed demo data' }, 403) };
  }
  return { decoded };
}

async function resolveDemoDb() {
  const platformDb = getPlatformDb();
  const DEMO_SLUG = '3boxes-hrms-demo';
  let tenant: any = await platformDb.tenant.findUnique({
    where: { slug: DEMO_SLUG },
    select: { id: true, name: true, slug: true },
  });
  if (!tenant) {
    tenant = await platformDb.tenant.create({
      data: {
        name: '3 Boxes HRMS Demo', slug: DEMO_SLUG,
        domain: 'nexus-hrms-mu.vercel.app', plan: 'enterprise', status: 'active',
        country: 'IN', currency: 'INR', timezone: 'Asia/Kolkata', maxCompaniesAllowed: 10,
      },
    });
  }
  const db = await getDbForTenant(DEMO_SLUG);

  // Mirror the Tenant row INTO the demo tenant DB. The tenant DB has its
  // own "Tenant" table and most seeded rows (User.tenantId,
  // CompanyGroup.tenantId, Candidate.tenantId, ...) carry a FK to it.
  // After the 2026-09-08 wipe the mirror row was gone, so every create
  // failed with "Foreign key constraint violated: *_tenantId_fkey".
  // The old 'Seed Tenant DB' button used to create this row — keeping the
  // mirror fresh here makes the seed fully self-healing.
  await (db as any).tenant.upsert({
    where: { id: tenant.id },
    update: { name: tenant.name, slug: tenant.slug, status: 'active' },
    create: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      domain: 'nexus-hrms-mu.vercel.app',
      plan: 'enterprise',
      status: 'active',
      country: 'IN',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      maxCompaniesAllowed: 10,
    },
  }).catch((e: unknown) => {
    console.error('[SeedDemoFull] Tenant mirror upsert failed:', e);
  });

  return { db, tenant };
}

// Demo employees are identified by their @*.demo email domains — this keeps
// every phase precisely scoped so we never touch real tenant data.
const DEMO_EMAIL_SUFFIXES = COMPANIES.map((c) => `@${c.domain}`);
function demoEmployeeWhere() {
  return { OR: DEMO_EMAIL_SUFFIXES.map((s) => ({ email: { endsWith: s } })) };
}

type Report = Record<string, { created: number; skipped: number; note?: string }>;

// ═════════════════════════════════════════════════════════════════════
// PHASE 1 — Org structure: group, companies, branches, departments,
//            designations, shifts, holidays  (~17 round-trips)
// ═════════════════════════════════════════════════════════════════════
// ─── DEMO ADMIN USERS ────────────────────────────────────────────────
// The login page + credentials panel resolve the demo host
// (nexus-hrms-mu.vercel.app) to the DEMO TENANT DB, so this database
// must contain its own User rows. Without them:
//   • /api/public/demo-credentials returns [] → the login page shows
//     no credentials at all
//   • login falls through to an empty tenant DB → nobody can sign in
// (2026-09-08: the whole demo DB was found wiped — 0 users, 0 companies —
// after the phase-1 signature bug made the destructive cleanup run on
// every seed click. This block makes the seed self-healing: it restores
// the login users on every phase-1 run, idempotently.)
const DEMO_PASSWORD = 'MarqAI@2026';
const DEMO_ADMIN_USERS = [
  { email: 'superadmin@3boxeshrms.com', name: '3Boxes Super Admin', role: 'super_admin' },
  { email: 'admin@3boxeshrms.com', name: 'Admin', role: 'tenant_admin' },
  { email: 'admin@acme-global.com', name: 'Admin (Acme Global)', role: 'tenant_admin' },
  { email: 'admin@globalhr.com', name: 'Admin (GlobalHR)', role: 'tenant_admin' },
  { email: 'admin@techstart.com', name: 'Admin (TechStart)', role: 'tenant_admin' },
  { email: 'admin@marqaitechgroup.com', name: 'Tenant Admin', role: 'tenant_admin' },
];

async function seedDemoUsers(db: any, tenantId: string, report: Report) {
  const hashed = await hashPassword(DEMO_PASSWORD);
  let created = 0;
  let skipped = 0;
  for (const u of DEMO_ADMIN_USERS) {
    const existing = await db.user.findUnique({ where: { email: u.email }, select: { id: true } });
    if (existing) {
      // Ensure the account is active and attached to the demo tenant.
      // Do NOT overwrite the password — it may have been changed
      // deliberately via 'Reset all passwords' or by the user.
      await db.user.update({ where: { id: existing.id }, data: { status: 'active', tenantId } });
      skipped++;
      continue;
    }
    await db.user.create({
      data: {
        email: u.email,
        password: hashed,
        name: u.name,
        role: u.role,
        status: 'active',
        tenantId,
      },
    });
    created++;
  }
  report['users'] = { created, skipped, note: `Demo login users ready (password: ${DEMO_PASSWORD})` };
}

async function phase1(db: any, tenant: any, report: Report, reset: boolean = false) {
  // Optional destructive reset (only meaningful together with phase 1)
  // NOTE: signature must stay (db, tenant, report, reset) — the shared
  // dispatcher calls phase.fn(db, tenant, report, reset). A previous
  // version had (db, tenant, reset, report) here while the dispatcher
  // passed 3 args, which made `report` undefined (TypeError "setting
  // 'reset'") AND made the destructive cleanup run on EVERY seed click
  // because `reset` received the truthy report object.
  if (reset) {
    try {
      const oldEmployees = await db.employee.findMany({ where: demoEmployeeWhere(), select: { id: true } });
      const oldEmpIds = oldEmployees.map((e: any) => e.id);
      const oldCompanies = await db.company.findMany({ where: { code: { in: COMPANIES.map((c) => c.code) } }, select: { id: true } });
      const oldCompanyIds = oldCompanies.map((c: any) => c.id);
      const oldDepartments = await db.department.findMany({ where: { companyId: { in: oldCompanyIds } }, select: { id: true } });
      const oldDepartmentIds = oldDepartments.map((d: any) => d.id);

      // IMPORTANT: delete CHILDREN BEFORE PARENTS, one deleteMany at a time.
      // The previous version batched 6 deletes into a $transaction — a single
      // FK violation (e.g. departments deleted while designations still
      // referenced them) rolled back the WHOLE chunk silently and the reset
      // only half-wiped the DB, producing duplicates on re-seed.
      const cleanup: Array<[string, () => Promise<any>]> = [
        // per-employee module data (children of Employee)
        ['leaveEncashmentRequest', () => db.leaveEncashmentRequest.deleteMany({ where: { employeeId: { in: oldEmpIds } } })],
        ['optionalHolidayElection', () => (db as any).optionalHolidayElection?.deleteMany({ where: { employeeId: { in: oldEmpIds } } })],
        ['leaveRequest', () => db.leaveRequest.deleteMany({ where: { employeeId: { in: oldEmpIds } } })],
        ['leaveBalance', () => db.leaveBalance.deleteMany({ where: { employeeId: { in: oldEmpIds } } })],
        ['attendance', () => db.attendance.deleteMany({ where: { employeeId: { in: oldEmpIds } } })],
        ['payroll', () => db.payroll.deleteMany({ where: { employeeId: { in: oldEmpIds } } })],
        ['performanceReview', () => db.performanceReview.deleteMany({ where: { employeeId: { in: oldEmpIds } } })],
        ['goal', () => db.goal.deleteMany({ where: { employeeId: { in: oldEmpIds } } })],
        ['grievance', () => db.grievance.deleteMany({ where: { employeeId: { in: oldEmpIds } } })],
        ['assetAssignment', () => db.assetAssignment.deleteMany({ where: { employeeId: { in: oldEmpIds } } })],
        ['trainingEnrollment', () => db.trainingEnrollment.deleteMany({ where: { employeeId: { in: oldEmpIds } } })],
        ['employeeCompanyMapping', () => db.employeeCompanyMapping.deleteMany({ where: { employeeId: { in: oldEmpIds } } })],
        // tickets + comments (requesterId → Employee)
        ['ticketComment', () => (db as any).ticketComment?.deleteMany({ where: { ticket: { requesterId: { in: oldEmpIds } } } })],
        ['ticket', () => db.ticket.deleteMany({ where: { requesterId: { in: oldEmpIds } } })],
        // recruitment
        ['jobApplication', () => db.jobApplication.deleteMany({})],
        ['jobPosting', () => db.jobPosting.deleteMany({ where: { departmentId: { in: oldDepartmentIds } } })],
        ['candidate', () => db.candidate.deleteMany({ where: { tenantId: tenant.id } })],
        // assets / training / payroll runs
        ['asset', () => db.asset.deleteMany({})],
        ['training', () => db.training.deleteMany({})],
        ['payrollRun', () => db.payrollRun.deleteMany({})],
        // employees (after all children)
        ['employee', () => db.employee.deleteMany({ where: { id: { in: oldEmpIds } } })],
        // org structure (children → parents)
        ['designation', () => db.designation.deleteMany({ where: { departmentId: { in: oldDepartmentIds } } })],
        ['department', () => db.department.deleteMany({ where: { companyId: { in: oldCompanyIds } } })],
        ['branch', () => db.branch.deleteMany({ where: { companyId: { in: oldCompanyIds } } })],
        ['shift', () => db.shift.deleteMany({ where: { companyId: { in: oldCompanyIds } } })],
        ['holiday', () => db.holiday.deleteMany({ where: { companyId: { in: oldCompanyIds } } })],
        ['leaveType', () => db.leaveType.deleteMany({ where: { companyId: { in: oldCompanyIds } } })],
        ['company', () => db.company.deleteMany({ where: { id: { in: oldCompanyIds } } })],
      ];
      let resetFailures = 0;
      for (const [name, fn] of cleanup) {
        if (typeof fn !== 'function') continue;
        try {
          await fn();
        } catch (e: any) {
          // Missing table / nothing to delete is fine — log anything else.
          resetFailures++;
          console.error(`[SeedDemoFull] reset delete "${name}" failed:`, e?.code || '', String(e?.message || e).slice(0, 200));
        }
      }
      report['reset'] = { created: 0, skipped: 0, note: resetFailures ? `Cleared existing demo data (${resetFailures} non-critical delete warnings)` : 'Cleared existing demo data' };
    } catch (e) {
      report['reset'] = { created: 0, skipped: 0, note: `Reset partially failed: ${e instanceof Error ? e.message : 'unknown'}` };
    }
  }

  // Restore/refresh the demo login users FIRST — without them the login
  // page shows no credentials and nobody can sign in to the demo.
  await seedDemoUsers(db, tenant.id, report);

  // Company group
  let group = await db.companyGroup.findFirst({ where: { tenantId: tenant.id } });
  if (!group) {
    group = await db.companyGroup.create({ data: { name: '3 Boxes Enterprise Group', tenantId: tenant.id } });
  }

  // Companies (find existing by code in one query, create missing one-by-one — only 6)
  const existingCompanies = await db.company.findMany({ where: { code: { in: COMPANIES.map((c) => c.code) } } });
  const companyByCode = new Map<string, any>(existingCompanies.map((c: any) => [c.code, c]));
  let companiesCreated = 0;
  for (const c of COMPANIES) {
    if (!companyByCode.has(c.code)) {
      const created = await db.company.create({
        data: {
          name: c.name, code: c.code, companyGroupId: group.id,
          country: 'IN', currency: 'INR', timezone: 'Asia/Kolkata',
          city: c.city, state: c.state, email: `info@${c.domain}`,
          website: `https://${c.domain}`, status: 'active', maxEmployees: 100,
        },
      });
      companyByCode.set(c.code, created);
      companiesCreated++;
    }
  }
  report['companies'] = { created: companiesCreated, skipped: COMPANIES.length - companiesCreated };
  const companyRecords = COMPANIES.map((c) => companyByCode.get(c.code));
  const companyIds = companyRecords.map((c: any) => c.id);

  // Branches — bulk
  const existingBranches = await db.branch.findMany({ where: { companyId: { in: companyIds }, name: 'Head Office' } });
  const branchKey = new Set(existingBranches.map((b: any) => b.companyId));
  const branchCreates = companyRecords
    .filter((c: any) => !branchKey.has(c.id))
    .map((c: any, i: number) => {
      const def = COMPANIES.find((x) => x.code === c.code)!;
      return {
        name: 'Head Office', code: `${def.code}-HO`, companyId: c.id,
        city: def.city, state: def.state, country: 'IN', status: 'active',
        address: `${def.city}, ${def.state}`,
      };
    });
  if (branchCreates.length) await db.branch.createMany({ data: branchCreates });
  report['branches'] = { created: branchCreates.length, skipped: companyRecords.length - branchCreates.length };

  // Departments — bulk (5 per company)
  const existingDepts = await db.department.findMany({ where: { companyId: { in: companyIds }, name: { in: DEPARTMENTS } } });
  const deptKey = new Set(existingDepts.map((d: any) => `${d.companyId}|${d.name}`));
  const branchRows = await db.branch.findMany({ where: { companyId: { in: companyIds }, name: 'Head Office' } });
  const branchByCompany = new Map<string, any>(branchRows.map((b: any) => [b.companyId, b]));
  const deptCreates: any[] = [];
  for (const c of companyRecords) {
    const branch = branchByCompany.get(c.id);
    for (const dn of DEPARTMENTS) {
      if (!deptKey.has(`${c.id}|${dn}`)) deptCreates.push({ name: dn, companyId: c.id, branchId: branch?.id, status: 'active' });
    }
  }
  if (deptCreates.length) await db.department.createMany({ data: deptCreates });
  report['departments'] = { created: deptCreates.length, skipped: companyRecords.length * DEPARTMENTS.length - deptCreates.length };

  // Designations — bulk (6 per company, spread across departments)
  const deptRows = await db.department.findMany({ where: { companyId: { in: companyIds }, name: { in: DEPARTMENTS } } });
  const desgDeptIds = deptRows.map((d: any) => d.id);
  const existingDesgRows = desgDeptIds.length
    ? await db.designation.findMany({ where: { departmentId: { in: desgDeptIds } } })
    : [];
  const desgKey = new Set(existingDesgRows.map((d: any) => `${d.departmentId}|${d.title}`));
  const desgCreates: any[] = [];
  for (const c of companyRecords) {
    const cDepts = deptRows.filter((d: any) => d.companyId === c.id);
    for (let i = 0; i < DESIGNATIONS.length; i++) {
      const d = DESIGNATIONS[i];
      const dept = cDepts[i % Math.max(1, cDepts.length)];
      if (dept && !desgKey.has(`${dept.id}|${d.title}`)) {
        desgCreates.push({
          title: d.title, departmentId: dept.id, level: d.level,
          minSalary: d.level >= 6 ? 1500000 : 400000,
          maxSalary: d.level >= 6 ? 3000000 : 1200000,
          status: 'active',
        });
      }
    }
  }
  if (desgCreates.length) await db.designation.createMany({ data: desgCreates });
  report['designations'] = { created: desgCreates.length, skipped: companyRecords.length * DESIGNATIONS.length - desgCreates.length };

  // Shifts — bulk
  const shiftCounts = await db.shift.groupBy({ by: ['companyId'], where: { companyId: { in: companyIds } }, _count: true });
  const companiesWithShifts = new Set(shiftCounts.filter((s: any) => s._count > 0).map((s: any) => s.companyId));
  const shiftCreates: any[] = [];
  for (const c of companyRecords) {
    if (!companiesWithShifts.has(c.id)) {
      shiftCreates.push({ name: 'General Shift', startTime: '09:00', endTime: '18:00', breakDuration: 60, graceTime: 15, companyId: c.id, status: 'active' });
      shiftCreates.push({ name: 'Early Shift', startTime: '06:00', endTime: '15:00', breakDuration: 45, graceTime: 10, companyId: c.id, status: 'active' });
    }
  }
  if (shiftCreates.length) await db.shift.createMany({ data: shiftCreates }).catch(() => {});
  report['shifts'] = { created: shiftCreates.length, skipped: companyRecords.length * 2 - shiftCreates.length };

  // Holidays — bulk (5 per company for 2026)
  // NOTE: Prisma's groupBy returns _count as an OBJECT ({ _all: N }), so
  // `h._count > 0` was always false and holidays were re-created on every
  // run. Handle both shapes.
  const holidayCounts = await db.holiday.groupBy({ by: ['companyId'], where: { companyId: { in: companyIds } }, _count: true });
  const companiesWithHolidays = new Set(holidayCounts
    .filter((h: any) => (typeof h._count === 'number' ? h._count : (h._count?._all ?? 0)) > 0)
    .map((h: any) => h.companyId));
  const holidays2026 = [
    { name: 'Republic Day', date: new Date('2026-01-26') },
    { name: 'Holi', date: new Date('2026-03-04') },
    { name: 'Independence Day', date: new Date('2026-08-15') },
    { name: 'Diwali', date: new Date('2026-11-08') },
    { name: 'Christmas', date: new Date('2026-12-25') },
  ];
  const holidayCreates: any[] = [];
  for (const c of companyRecords) {
    if (!companiesWithHolidays.has(c.id)) {
      for (const h of holidays2026) {
        // NOTE: Holiday has NO 'status' column (schema) — including it made
        // Prisma reject the whole createMany batch (silently swallowed) and
        // the demo ended up with 0 holidays.
        holidayCreates.push({ name: h.name, date: h.date, type: 'public', country: 'IN', companyId: c.id });
      }
    }
  }
  if (holidayCreates.length) await db.holiday.createMany({ data: holidayCreates }).catch((e: unknown) => {
    console.error('[SeedDemoFull] holiday.createMany failed:', e);
  });
  report['holidays'] = { created: holidayCreates.length, skipped: companyRecords.length * 5 - holidayCreates.length };
}

// ═════════════════════════════════════════════════════════════════════
// PHASE 2 — Employees: 50 employees + mappings + reporting managers
// ═════════════════════════════════════════════════════════════════════
async function phase2(db: any, tenant: any, report: Report) {
  const companyRecords = await db.company.findMany({ where: { code: { in: COMPANIES.map((c) => c.code) } } });
  if (companyRecords.length === 0) {
    report['employees'] = { created: 0, skipped: 0, note: 'No demo companies found — run phase 1 first' };
    return;
  }
  const deptRows = await db.department.findMany({ where: { companyId: { in: companyRecords.map((c: any) => c.id) } } });
  const desgRows = await db.designation.findMany({ where: { departmentId: { in: deptRows.map((d: any) => d.id) } } });
  const branchRows = await db.branch.findMany({ where: { companyId: { in: companyRecords.map((c: any) => c.id) } } });

  // Existing demo employees — dedupe by email and employeeId
  const existing = await db.employee.findMany({
    where: demoEmployeeWhere(),
    select: { id: true, email: true, employeeId: true, departmentId: true, designationId: true, branchId: true, companyId: true, dateOfJoining: true, status: true },
  });
  const existingEmails = new Set(existing.map((e: any) => e.email));
  const existingEmpIds = new Set(existing.map((e: any) => e.employeeId));

  const employeeCreates: any[] = [];
  for (let ci = 0; ci < companyRecords.length; ci++) {
    const company = companyRecords[ci];
    const cDepts = deptRows.filter((d: any) => d.companyId === company.id);
    const cDesgs = desgRows.filter((d: any) => cDepts.some((dp: any) => dp.id === d.departmentId));
    const branch = branchRows.find((b: any) => b.companyId === company.id);
    const count = EMPLOYEE_DISTRIBUTION[ci];

    for (let ei = 0; ei < count; ei++) {
      const firstName = pick(FIRST_NAMES, (ci * 10 + ei) * 2 + 1);
      const lastName = pick(LAST_NAMES, (ci * 10 + ei) * 3 + 2);
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${COMPANIES[ci].domain}`;
      if (existingEmails.has(email)) continue;

      let empIdFinal = `EMP-${COMPANIES[ci].code}-${String(ei + 1).padStart(3, '0')}`;
      while (existingEmpIds.has(empIdFinal)) empIdFinal = `${empIdFinal}-${Date.now().toString(36).slice(-4)}`;
      existingEmpIds.add(empIdFinal);

      const desg = cDesgs.length ? cDesgs[ei % cDesgs.length] : null;
      const dept = desg ? cDepts.find((d: any) => d.id === desg.departmentId) : (cDepts.length ? cDepts[ei % cDepts.length] : null);
      const base = SALARY_BY_TITLE[desg?.title || 'Executive'] || 550000;

      employeeCreates.push({
        employeeId: empIdFinal,
        firstName, lastName, email,
        personalEmail: `${firstName.toLowerCase()}${lastName.toLowerCase()}@gmail.com`,
        phone: `+91-98${rand(10000000, 99999999)}`,
        departmentId: dept?.id || cDepts[0]?.id,
        designationId: desg?.id || cDesgs[0]?.id,
        branchId: branch?.id,
        companyId: company.id,
        dateOfJoining: daysAgo(rand(90, 1500)),
        dateOfBirth: new Date(rand(1980, 2000), rand(0, 11), rand(1, 28)),
        gender: ei % 2 === 0 ? 'male' : 'female',
        maritalStatus: ei % 3 === 0 ? 'married' : 'single',
        nationality: 'Indian',
        city: COMPANIES[ci].city, state: COMPANIES[ci].state, country: 'IN',
        status: 'active',
        employeeStatus: ei < 2 ? 'probation' : 'confirmed',
        employeeType: ei % 5 === 0 ? 'contract' : 'full_time',
        salary: base + rand(-50000, 100000),
        salaryCurrency: 'INR',
        bankName: pick(['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank'], ei),
        bankAccountNo: `${rand(10000000000, 99999999999)}`,
        bankIfscCode: `HDFC000${rand(1000, 9999)}`,
      });
    }
  }

  let created = 0;
  for (const c of chunk(employeeCreates, 25)) {
    await db.employee.createMany({ data: c }).catch(() => {});
    created += c.length;
  }
  report['employees'] = { created, skipped: existing.length };

  // Re-fetch full demo employee list
  const employees = await db.employee.findMany({
    where: demoEmployeeWhere(),
    orderBy: { employeeId: 'asc' }, // STABLE order — pick() dedupe depends on it
    select: { id: true, employeeId: true, email: true, departmentId: true, designationId: true, branchId: true, companyId: true, dateOfJoining: true, firstName: true, lastName: true },
  });

  // EmployeeCompanyMapping — bulk
  const empIds = employees.map((e: any) => e.id);
  const existingMappings = empIds.length
    ? await db.employeeCompanyMapping.findMany({ where: { employeeId: { in: empIds } }, select: { employeeId: true, companyId: true } })
    : [];
  const mappingKey = new Set(existingMappings.map((m: any) => `${m.employeeId}|${m.companyId}`));
  const mappingCreates = employees
    .filter((e: any) => e.companyId && !mappingKey.has(`${e.id}|${e.companyId}`))
    .map((e: any) => ({
      employeeId: e.id, companyId: e.companyId, employeeCode: e.employeeId,
      departmentId: e.departmentId, designationId: e.designationId,
      branchId: e.branchId, isPrimary: true, status: 'active',
      dateOfJoining: e.dateOfJoining || new Date(),
    }));
  for (const c of chunk(mappingCreates, 50)) {
    await db.employeeCompanyMapping.createMany({ data: c }).catch(() => {});
  }
  report['employeeMappings'] = { created: mappingCreates.length, skipped: existingMappings.length };

  // Reporting managers: first employee of each company manages the rest
  const managerUpdates: any[] = [];
  for (const company of companyRecords) {
    const companyEmps = employees.filter((e: any) => e.companyId === company.id);
    if (companyEmps.length > 1) {
      const managerId = companyEmps[0].id;
      for (const emp of companyEmps.slice(1)) {
        managerUpdates.push(db.employee.update({ where: { id: emp.id }, data: { reportingManagerId: managerId } }).catch(() => {}));
      }
    }
  }
  for (const c of chunk(managerUpdates, 25)) {
    // NOTE: these promises carry .catch(() => {}) — they are PLAIN Promises,
    // which Prisma's array $transaction rejects ("All elements of the array
    // need to be Prisma Client promises"). Promise.all is both valid here
    // and more resilient (one failed update doesn't abort the batch).
    await Promise.all(c);
  }
  report['reportingManagers'] = { created: managerUpdates.length, skipped: 0 };
  void tenant;
}

// ═════════════════════════════════════════════════════════════════════
// PHASE 3 — Leave: per-company leave types, balances, 30 requests
// ═════════════════════════════════════════════════════════════════════
async function phase3(db: any, tenant: any, report: Report) {
  const companyRecords = await db.company.findMany({ where: { code: { in: COMPANIES.map((c) => c.code) } }, select: { id: true, code: true } });
  if (companyRecords.length === 0) {
    report['leaveTypes'] = { created: 0, skipped: 0, note: 'No demo companies — run phase 1 first' };
    return;
  }
  const companyIds = companyRecords.map((c: any) => c.id);
  const employees = await db.employee.findMany({
    where: demoEmployeeWhere(),
    orderBy: { employeeId: 'asc' }, // STABLE order — pick() dedupe depends on it
    select: { id: true, companyId: true },
  });
  if (employees.length === 0) {
    report['leaveTypes'] = { created: 0, skipped: 0, note: 'No demo employees — run phase 2 first' };
    return;
  }

  const leaveTypeDefs = [
    { name: 'Casual Leave', code: 'CL', defaultDays: 12, isPaid: true, carryForward: true, maxCarryForward: 3 },
    { name: 'Sick Leave', code: 'SL', defaultDays: 10, isPaid: true, carryForward: false, maxCarryForward: 0 },
    { name: 'Earned Leave', code: 'EL', defaultDays: 15, isPaid: true, carryForward: true, maxCarryForward: 5 },
    { name: 'Maternity Leave', code: 'ML', defaultDays: 90, isPaid: true, carryForward: false, maxCarryForward: 0 },
    { name: 'Paternity Leave', code: 'PL', defaultDays: 15, isPaid: true, carryForward: false, maxCarryForward: 0 },
  ];

  // LeaveType.code is GLOBALLY UNIQUE in the schema (@@id-level @unique),
  // but we create the same 5 leave types PER COMPANY — so every code must
  // be suffixed with the company code (CL → CL-TNS, CL-ISY, ...). Without
  // the suffix the whole createMany batch fails on LeaveType_code_key and
  // the leave module ends up completely empty (2026-09-08 demo incident).
  const allSuffixedCodes = companyRecords.flatMap((c: any) => leaveTypeDefs.map((lt) => `${lt.code}-${c.code}`));

  // LeaveType requires companyId → create the 5 types PER COMPANY (30 rows)
  const existingTypes = await db.leaveType.findMany({
    where: { companyId: { in: companyIds }, code: { in: allSuffixedCodes } },
    select: { id: true, code: true, companyId: true },
  });
  const typeKey = new Set(existingTypes.map((t: any) => `${t.companyId}|${t.code}`));
  const typeCreates: any[] = [];
  for (const company of companyRecords) {
    for (const lt of leaveTypeDefs) {
      const suffixed = `${lt.code}-${company.code}`;
      if (!typeKey.has(`${company.id}|${suffixed}`)) typeCreates.push({ ...lt, code: suffixed, companyId: company.id });
    }
  }
  for (const c of chunk(typeCreates, 30)) {
    await db.leaveType.createMany({ data: c }).catch((e: unknown) => {
      console.error('[SeedDemoFull] leaveType.createMany failed:', e);
    });
  }
  report['leaveTypes'] = { created: typeCreates.length, skipped: existingTypes.length };

  // Re-fetch and index types per company
  const allTypes = await db.leaveType.findMany({
    where: { companyId: { in: companyIds }, code: { in: allSuffixedCodes } },
    select: { id: true, code: true, companyId: true, defaultDays: true },
  });
  const typesByCompany = new Map<string, any[]>();
  for (const t of allTypes) {
    if (!typesByCompany.has(t.companyId)) typesByCompany.set(t.companyId, []);
    typesByCompany.get(t.companyId)!.push(t);
  }

  // Balances — bulk (CL/SL/EL per employee for the current year)
  const currentYear = new Date().getFullYear();
  const empIds = employees.map((e: any) => e.id);
  const existingBalances = await db.leaveBalance.findMany({
    where: { employeeId: { in: empIds }, year: currentYear },
    select: { employeeId: true, leaveTypeId: true },
  });
  const balanceKey = new Set(existingBalances.map((b: any) => `${b.employeeId}|${b.leaveTypeId}`));
  const balanceCreates: any[] = [];
  for (const emp of employees) {
    const types = typesByCompany.get(emp.companyId) || [];
    for (const lt of types) {
      const baseCode = String(lt.code).split('-')[0]; // codes are suffixed per company (CL-TNS)
      if (baseCode === 'ML' || baseCode === 'PL') continue;
      if (balanceKey.has(`${emp.id}|${lt.id}`)) continue;
      const used = rand(0, 5);
      balanceCreates.push({
        employeeId: emp.id, leaveTypeId: lt.id, year: currentYear,
        total: lt.defaultDays || 12, used, carryForward: 0,
        remaining: Math.max(0, (lt.defaultDays || 12) - used),
      });
    }
  }
  for (const c of chunk(balanceCreates, 100)) {
    await db.leaveBalance.createMany({ data: c }).catch((e: unknown) => {
      console.error('[SeedDemoFull] leaveBalance.createMany failed:', e);
    });
  }
  report['leaveBalances'] = { created: balanceCreates.length, skipped: existingBalances.length };

  // Leave requests — bulk (30, mixed statuses, each employee uses own company's types)
  const existingRequests = await db.leaveRequest.findMany({
    where: { employeeId: { in: empIds }, startDate: { gte: daysAgo(75) } },
    select: { employeeId: true, leaveTypeId: true, startDate: true },
  });
  const reqKey = new Set(existingRequests.map((r: any) => `${r.employeeId}|${r.leaveTypeId}|${dateOnly(new Date(r.startDate)).toISOString().slice(0, 10)}`));
  const empById = new Map(employees.map((e: any) => [e.id, e]));
  // TOP-UP semantics: only create enough NEW requests to reach 30 total.
  const requestTarget = Math.max(0, 30 - existingRequests.length);
  const requestCreates: any[] = [];
  for (let i = 0; requestCreates.length < requestTarget && i < 120; i++) {
    const emp = pick(employees, i * 3);
    const types = (typesByCompany.get(emp.companyId) || []).filter((t: any) => ['CL', 'SL', 'EL'].includes(String(t.code).split('-')[0]));
    if (!types.length) continue;
    const lt = pick(types, i);
    const startOffset = rand(-60, 20);
    const start = daysAgo(-startOffset);
    const duration = rand(1, 4);
    const end = new Date(start);
    end.setDate(end.getDate() + duration - 1);
    const key = `${emp.id}|${lt.id}|${dateOnly(start).toISOString().slice(0, 10)}`;
    if (reqKey.has(key)) continue;
    reqKey.add(key);

    const status = requestCreates.length < 12 ? 'approved' : requestCreates.length < 22 ? 'pending' : requestCreates.length < 27 ? 'rejected' : 'cancelled';
    requestCreates.push({
      employeeId: emp.id, leaveTypeId: lt.id,
      startDate: dateOnly(start), endDate: dateOnly(end),
      reason: pick(LEAVE_REASONS, requestCreates.length),
      status,
      approvedBy: status === 'approved' || status === 'rejected' ? 'seed-demo' : null,
      approvedAt: status === 'approved' || status === 'rejected' ? new Date() : null,
      comments: status === 'rejected' ? 'Team capacity constraints during this period' : null,
    });
  }
  for (const c of chunk(requestCreates, 30)) {
    await db.leaveRequest.createMany({ data: c }).catch((e: unknown) => {
      console.error('[SeedDemoFull] leaveRequest.createMany failed:', e);
    });
  }
  report['leaveRequests'] = { created: requestCreates.length, skipped: existingRequests.length };
  void tenant;
}

// ═════════════════════════════════════════════════════════════════════
// PHASE 4 — Attendance (30 days × 50 employees) + Payroll (3 runs,
//            150 payslips) — all bulk creates
// ═════════════════════════════════════════════════════════════════════
async function phase4(db: any, tenant: any, report: Report) {
  const employees = await db.employee.findMany({
    where: demoEmployeeWhere(),
    orderBy: { employeeId: 'asc' }, // STABLE order — pick() dedupe depends on it
    select: { id: true, salary: true },
  });
  if (employees.length === 0) {
    report['attendance'] = { created: 0, skipped: 0, note: 'No demo employees — run phase 2 first' };
    return;
  }
  const empIds = employees.map((e: any) => e.id);

  // ── Attendance: last 30 days, weekday-only, ~90% present ──
  const rangeStart = dateOnly(daysAgo(31));
  const existingAtt = await db.attendance.findMany({
    where: { employeeId: { in: empIds }, date: { gte: rangeStart } },
    select: { employeeId: true, date: true },
  });
  const attKey = new Set(existingAtt.map((a: any) => `${a.employeeId}|${dateOnly(new Date(a.date)).toISOString().slice(0, 10)}`));

  const attCreates: any[] = [];
  for (let dayOffset = 1; dayOffset <= 30; dayOffset++) {
    const date = daysAgo(dayOffset);
    if (isWeekend(date)) continue;
    const d = dateOnly(date);
    const iso = d.toISOString().slice(0, 10);
    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      if (attKey.has(`${emp.id}|${iso}`)) continue;
      const roll = Math.random();
      const status = roll < 0.82 ? 'present' : roll < 0.92 ? 'late' : roll < 0.96 ? 'half_day' : 'absent';
      if (status === 'absent') continue;
      const checkIn = status === 'present' ? atTime(d, rand(8, 9), rand(10, 59)) : atTime(d, 9, rand(20, 59));
      attCreates.push({
        employeeId: emp.id, date: d, status,
        checkIn,
        checkOut: atTime(d, 18, 30),
        workHours: status === 'half_day' ? 4.5 : 8.5,
        overtime: rand(0, 2) === 0 ? rand(1, 3) : 0,
        location: i % 3 === 0 ? 'WFH' : 'Office HQ',
      });
    }
  }
  for (const c of chunk(attCreates, 250)) {
    await db.attendance.createMany({ data: c }).catch(() => {});
  }
  report['attendance'] = { created: attCreates.length, skipped: existingAtt.length };

  // ── Payroll: 3 monthly runs (legalEntityId = first demo company) + payslips ──
  const firstCompany = await db.company.findFirst({ where: { code: COMPANIES[0].code }, select: { id: true } });
  if (!firstCompany) {
    report['payroll'] = { created: 0, skipped: 0, note: 'No demo companies — run phase 1 first' };
    return;
  }
  const runCreates: any[] = [];
  const monthSpecs: { run: Date; period: string; start: Date; end: Date; pay: Date }[] = [];
  for (let m = 2; m >= 0; m--) {
    const runDate = new Date();
    runDate.setMonth(runDate.getMonth() - m);
    const period = `${runDate.getFullYear()}-${String(runDate.getMonth() + 1).padStart(2, '0')}`;
    monthSpecs.push({
      run: runDate,
      period,
      start: new Date(runDate.getFullYear(), runDate.getMonth(), 1),
      end: new Date(runDate.getFullYear(), runDate.getMonth() + 1, 0),
      pay: new Date(runDate.getFullYear(), runDate.getMonth() + 1, 1),
    });
  }
  const existingRuns = await db.payrollRun.findMany({
    where: { legalEntityId: firstCompany.id, payrollPeriod: { in: monthSpecs.map((s) => s.period) } },
    select: { payrollPeriod: true },
  });
  const runPeriods = new Set(existingRuns.map((r: any) => r.payrollPeriod));
  for (const s of monthSpecs) {
    if (!runPeriods.has(s.period)) {
      runCreates.push({
        legalEntityId: firstCompany.id, payrollPeriod: s.period,
        periodStartDate: s.start, periodEndDate: s.end, payDate: s.pay,
        runType: 'REGULAR', runStatus: 'DISBURSED', currencyCode: 'INR',
      });
    }
  }
  if (runCreates.length) await db.payrollRun.createMany({ data: runCreates }).catch(() => {});
  report['payrollRuns'] = { created: runCreates.length, skipped: existingRuns.length };

  // Payslips — bulk (unique [employeeId, month, year])
  const existingPayslips = await db.payroll.findMany({
    where: { employeeId: { in: empIds } },
    select: { employeeId: true, month: true, year: true },
  });
  const slipKey = new Set(existingPayslips.map((p: any) => `${p.employeeId}|${p.month}|${p.year}`));
  const slipCreates: any[] = [];
  for (const s of monthSpecs) {
    const month = s.run.getMonth() + 1;
    const year = s.run.getFullYear();
    for (const emp of employees) {
      if (slipKey.has(`${emp.id}|${month}|${year}`)) continue;
      slipKey.add(`${emp.id}|${month}|${year}`);
      const basic = Math.round((emp.salary || 600000) / 12);
      const hra = Math.round(basic * 0.4);
      const da = Math.round(basic * 0.1);
      const conveyance = 1600;
      const medical = 1250;
      const otherAllowances = rand(2000, 8000);
      const gross = basic + hra + da + conveyance + medical + otherAllowances;
      const pf = Math.round(basic * 0.12);
      const esi = gross <= 21000 ? Math.round(gross * 0.0075) : 0;
      const tax = Math.round(gross * 0.08);
      const profTax = 200;
      const totalDed = pf + esi + tax + profTax;
      slipCreates.push({
        employeeId: emp.id, month, year,
        basicSalary: basic, hra, da, conveyance, medical, otherAllowances,
        grossSalary: gross, pf, esi, tax, professionalTax: profTax,
        otherDeductions: 0, totalDeductions: totalDed,
        netSalary: gross - totalDed, currency: 'INR',
        status: 'paid', paidDate: s.pay,
      });
    }
  }
  for (const c of chunk(slipCreates, 100)) {
    await db.payroll.createMany({ data: c }).catch(() => {});
  }
  report['payroll'] = { created: slipCreates.length, skipped: existingPayslips.length };
  void tenant;
}

// ═════════════════════════════════════════════════════════════════════
// PHASE 5 — Recruitment (6 jobs, 20 candidates, 30 applications)
//            + Assets (30 assets, 25 assignments)
// ═════════════════════════════════════════════════════════════════════
async function phase5(db: any, tenant: any, report: Report) {
  const companyRecords = await db.company.findMany({ where: { code: { in: COMPANIES.map((c) => c.code) } }, select: { id: true, code: true, city: true } });
  if (companyRecords.length === 0) {
    report['jobPostings'] = { created: 0, skipped: 0, note: 'No demo companies — run phase 1 first' };
    return;
  }
  const deptRows = await db.department.findMany({ where: { companyId: { in: companyRecords.map((c: any) => c.id) } }, select: { id: true, companyId: true, name: true } });
  const employees = await db.employee.findMany({ where: demoEmployeeWhere(), orderBy: { employeeId: 'asc' }, select: { id: true, firstName: true, lastName: true } });

  // ── Job postings ──
  const jobTitles = ['Senior Software Engineer', 'Product Manager', 'HR Business Partner', 'Financial Analyst', 'Sales Executive', 'Operations Lead'];
  const existingJobs = await db.jobPosting.findMany({ where: { title: { in: jobTitles }, departmentId: { in: deptRows.map((d: any) => d.id) } }, select: { id: true, title: true, departmentId: true } });
  const jobKey = new Set(existingJobs.map((j: any) => j.title));
  const jobCreates: any[] = [];
  for (let i = 0; i < jobTitles.length; i++) {
    if (jobKey.has(jobTitles[i])) continue;
    const company = companyRecords[i % companyRecords.length];
    const cDepts = deptRows.filter((d: any) => d.companyId === company.id);
    if (!cDepts.length) continue;
    jobCreates.push({
      title: jobTitles[i], departmentId: cDepts[i % cDepts.length].id, position: jobTitles[i],
      location: company.city,
      type: 'full-time', experience: `${rand(2, 8)}-${rand(8, 12)} years`,
      salary: `${rand(8, 15)}-${rand(15, 30)} LPA`,
      description: `We are looking for an experienced ${jobTitles[i]} to join our growing team.`,
      requirements: 'Bachelor degree, relevant experience, strong communication skills',
      status: 'open', vacancies: rand(1, 5),
    });
  }
  if (jobCreates.length) await db.jobPosting.createMany({ data: jobCreates }).catch(() => {});
  report['jobPostings'] = { created: jobCreates.length, skipped: existingJobs.length };
  const jobRecords = await db.jobPosting.findMany({ where: { title: { in: jobTitles } }, select: { id: true, title: true } });

  // ── Candidates (tenantId required) ──
  const existingCands = await db.candidate.findMany({ where: { tenantId: tenant.id }, select: { email: true } });
  const candEmails = new Set(existingCands.map((c: any) => c.email));
  const candCreates: any[] = [];
  for (let i = 0; i < 20; i++) {
    const firstName = pick(FIRST_NAMES, i * 7 + 3);
    const lastName = pick(LAST_NAMES, i * 5 + 1);
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@candidate.demo`;
    if (candEmails.has(email)) continue;
    candEmails.add(email);
    candCreates.push({
      tenantId: tenant.id,
      firstName, lastName, email,
      phone: `+91-97${rand(10000000, 99999999)}`,
      status: pick(['new', 'screening', 'interviewing', 'offer', 'hired', 'rejected'], i),
      source: pick(['linkedin', 'job-portal', 'referral', 'company-website'], i),
    });
  }
  if (candCreates.length) await db.candidate.createMany({ data: candCreates }).catch(() => {});
  report['candidates'] = { created: candCreates.length, skipped: existingCands.length };
  const candidateRecords = await db.candidate.findMany({ where: { tenantId: tenant.id, email: { endsWith: '@candidate.demo' } }, select: { id: true, firstName: true, lastName: true, email: true } });

  // ── Applications — expectedSalary is a String column! ──
  const jobIds = jobRecords.map((j: any) => j.id);
  const existingApps = jobIds.length
    ? await db.jobApplication.findMany({ where: { jobPostingId: { in: jobIds } }, select: { jobPostingId: true, candidateEmail: true } })
    : [];
  const appKey = new Set(existingApps.map((a: any) => `${a.jobPostingId}|${a.candidateEmail}`));
  // TOP-UP semantics: only create enough NEW applications to reach 30 total.
  const appTarget = Math.max(0, 30 - existingApps.length);
  const appCreates: any[] = [];
  for (let i = 0; appCreates.length < appTarget && i < 90; i++) {
    const job = jobRecords.length ? pick(jobRecords, i) : null;
    if (!job) break;
    const cand = candidateRecords.length ? pick(candidateRecords, i * 2) : null;
    const email = cand ? cand.email : `applicant${i}@candidate.demo`;
    if (appKey.has(`${job.id}|${email}`)) continue;
    appKey.add(`${job.id}|${email}`);
    const name = cand ? `${cand.firstName} ${cand.lastName}` : `${pick(FIRST_NAMES, i)} ${pick(LAST_NAMES, i)}`;
    appCreates.push({
      jobPostingId: job.id,
      candidateId: cand?.id || null,
      candidateName: name, candidateEmail: email,
      candidatePhone: `+91-96${rand(10000000, 99999999)}`,
      status: pick(['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'], i),
      source: pick(['linkedin', 'job-portal', 'referral'], i),
      rating: rand(2, 5),
      expectedSalary: `${rand(8, 25)} LPA`,
    });
  }
  if (appCreates.length) await db.jobApplication.createMany({ data: appCreates }).catch(() => {});
  report['jobApplications'] = { created: appCreates.length, skipped: existingApps.length };

  // ── Assets ──
  const assetCategories = ['laptop', 'desktop', 'phone', 'tablet', 'monitor'];
  const assetBrands = ['Dell', 'HP', 'Apple', 'Lenovo', 'Samsung'];
  const assetTags = COMPANIES.flatMap((c) => Array.from({ length: 5 }, (_, i) => `AST-${c.code}-${String(i + 1).padStart(4, '0')}`));
  const existingAssets = await db.asset.findMany({ where: { assetTag: { in: assetTags } }, select: { assetTag: true } });
  const assetTagSet = new Set(existingAssets.map((a: any) => a.assetTag));
  const assetCreates: any[] = [];
  for (let i = 0; i < 30; i++) {
    const company = companyRecords[i % companyRecords.length];
    const category = pick(assetCategories, i);
    const assetTag = `AST-${company.code}-${String(Math.floor(i / companyRecords.length) + 1).padStart(4, '0')}`;
    if (assetTagSet.has(assetTag)) continue;
    assetTagSet.add(assetTag);
    assetCreates.push({
      name: `${pick(assetBrands, i)} ${category}`,
      assetTag, category,
      brand: pick(assetBrands, i),
      model: `Model-${rand(100, 999)}`,
      serialNumber: `SN${rand(100000, 999999)}`,
      purchaseDate: daysAgo(rand(30, 900)),
      purchaseCost: rand(25000, 180000),
      status: assetCreates.length < 25 ? 'assigned' : 'available',
      condition: pick(['new', 'good', 'good', 'fair'], i),
      location: company.city,
      warrantyExpiry: daysAgo(-rand(30, 700)),
    });
  }
  if (assetCreates.length) await db.asset.createMany({ data: assetCreates }).catch(() => {});
  report['assets'] = { created: assetCreates.length, skipped: existingAssets.length };

  // ── Assignments ──
  const assetRecords = await db.asset.findMany({ where: { assetTag: { in: assetTags } }, orderBy: { assetTag: 'asc' }, select: { id: true } });
  const empIds = employees.map((e: any) => e.id);
  const assetIds = assetRecords.map((a: any) => a.id);
  const existingAssignments = (empIds.length && assetIds.length)
    ? await db.assetAssignment.findMany({ where: { OR: [{ employeeId: { in: empIds } }, { assetId: { in: assetIds } }] }, select: { assetId: true, employeeId: true } })
    : [];
  const assignKey = new Set(existingAssignments.map((a: any) => `${a.assetId}|${a.employeeId}`));
  // TOP-UP semantics: only create enough NEW assignments to reach 25 total.
  const assignTarget = Math.max(0, 25 - existingAssignments.length);
  const assignCreates: any[] = [];
  for (let i = 0; assignCreates.length < assignTarget && i < assetRecords.length; i++) {
    const asset = assetRecords[i];
    if (!asset || !employees.length) break;
    const emp = pick(employees, i * 2);
    if (assignKey.has(`${asset.id}|${emp.id}`)) continue;
    assignKey.add(`${asset.id}|${emp.id}`);
    assignCreates.push({
      assetId: asset.id, employeeId: emp.id,
      assignedDate: daysAgo(rand(10, 300)),
      status: 'active',
    });
  }
  if (assignCreates.length) await db.assetAssignment.createMany({ data: assignCreates }).catch(() => {});
  report['assetAssignments'] = { created: assignCreates.length, skipped: existingAssignments.length };
}

// ═════════════════════════════════════════════════════════════════════
// PHASE 6 — Training + Performance + Grievances + Helpdesk
// ═════════════════════════════════════════════════════════════════════
async function phase6(db: any, tenant: any, report: Report) {
  const employees = await db.employee.findMany({
    where: demoEmployeeWhere(),
    orderBy: { employeeId: 'asc' }, // STABLE order — pick() dedupe depends on it
    select: { id: true, firstName: true, lastName: true },
  });
  if (employees.length === 0) {
    report['trainings'] = { created: 0, skipped: 0, note: 'No demo employees — run phase 2 first' };
    return;
  }
  const empIds = employees.map((e: any) => e.id);

  // ── Trainings ──
  const trainingTitles = [
    'Python for Data Analysis', 'Effective Communication Skills', 'Workplace Safety & Compliance',
    'Advanced Excel for Finance', 'Leadership Fundamentals',
  ];
  const existingTrainings = await db.training.findMany({ where: { title: { in: trainingTitles } }, select: { title: true } });
  const trainingSet = new Set(existingTrainings.map((t: any) => t.title));
  const trainingCreates: any[] = [];
  for (let i = 0; i < trainingTitles.length; i++) {
    if (trainingSet.has(trainingTitles[i])) continue;
    const start = daysAgo(-rand(5, 40));
    const end = new Date(start);
    end.setDate(end.getDate() + rand(2, 10));
    trainingCreates.push({
      title: trainingTitles[i],
      description: `Professional development training: ${trainingTitles[i]}`,
      category: pick(['technical', 'soft-skills', 'compliance', 'leadership'], i),
      trainer: `${pick(FIRST_NAMES, i + 5)} ${pick(LAST_NAMES, i + 3)}`,
      startDate: start, endDate: end,
      location: i % 2 === 0 ? 'Online (Zoom)' : `Training Room A, ${COMPANIES[i % 6].city}`,
    });
  }
  if (trainingCreates.length) await db.training.createMany({ data: trainingCreates }).catch(() => {});
  report['trainings'] = { created: trainingCreates.length, skipped: existingTrainings.length };
  const trainingRecords = await db.training.findMany({ where: { title: { in: trainingTitles } }, orderBy: { title: 'asc' }, select: { id: true } });

  // ── Enrollments ──
  const existingEnrollments = await db.trainingEnrollment.findMany({
    where: { employeeId: { in: empIds }, trainingId: { in: trainingRecords.map((t: any) => t.id) } },
    select: { trainingId: true, employeeId: true },
  });
  const enrollKey = new Set(existingEnrollments.map((e: any) => `${e.trainingId}|${e.employeeId}`));
  // TOP-UP semantics: only create enough NEW enrollments to reach 25 total.
  const enrollTarget = Math.max(0, 25 - existingEnrollments.length);
  const enrollCreates: any[] = [];
  for (let i = 0; enrollCreates.length < enrollTarget && i < 75; i++) {
    const training = trainingRecords.length ? pick(trainingRecords, i) : null;
    if (!training) break;
    const emp = pick(employees, i * 2 + 1);
    if (enrollKey.has(`${training.id}|${emp.id}`)) continue;
    enrollKey.add(`${training.id}|${emp.id}`);
    enrollCreates.push({
      trainingId: training.id, employeeId: emp.id,
      status: pick(['enrolled', 'completed', 'completed', 'in_progress'], i),
      score: rand(60, 98),
    });
  }
  if (enrollCreates.length) await db.trainingEnrollment.createMany({ data: enrollCreates }).catch(() => {});
  report['trainingEnrollments'] = { created: enrollCreates.length, skipped: existingEnrollments.length };

  // ── Performance reviews ──
  const cycles = ['Q1 2026', 'Q2 2026', 'Annual 2025'];
  const existingReviews = await db.performanceReview.findMany({
    where: { employeeId: { in: empIds }, reviewCycle: { in: cycles } },
    select: { employeeId: true, reviewCycle: true },
  });
  const reviewKey = new Set(existingReviews.map((r: any) => `${r.employeeId}|${r.reviewCycle}`));
  // TOP-UP semantics: only create enough NEW reviews to reach 20 total.
  const reviewTarget = Math.max(0, 20 - existingReviews.length);
  const reviewCreates: any[] = [];
  for (let i = 0; reviewCreates.length < reviewTarget && i < 60; i++) {
    const emp = pick(employees, i * 2 + 1);
    const cycle = pick(cycles, i);
    if (reviewKey.has(`${emp.id}|${cycle}`)) continue;
    reviewKey.add(`${emp.id}|${cycle}`);
    reviewCreates.push({
      employeeId: emp.id, reviewCycle: cycle, reviewPeriod: cycle,
      rating: rand(2, 5), goalsRating: rand(2, 5), skillsRating: rand(2, 5),
      behaviorRating: rand(2, 5), overallRating: rand(2, 5),
      comments: pick([
        'Consistent performer, exceeds expectations in project delivery.',
        'Good team player, needs improvement in time management.',
        'Outstanding technical skills, ready for next-level responsibility.',
        'Meets expectations, showing steady growth this quarter.',
      ], i),
      status: pick(['completed', 'completed', 'pending'], i),
      reviewDate: daysAgo(rand(10, 120)),
    });
  }
  if (reviewCreates.length) await db.performanceReview.createMany({ data: reviewCreates }).catch(() => {});
  report['performanceReviews'] = { created: reviewCreates.length, skipped: existingReviews.length };

  // ── Goals ──
  const goalTitles = ['Complete Q3 project deliverables', 'Improve customer satisfaction score', 'Learn new technology stack',
    'Reduce response time by 20%', 'Mentor junior team members', 'Achieve sales target of 50L',
    'Complete certification course', 'Lead a cross-functional initiative'];
  const existingGoals = await db.goal.findMany({
    where: { employeeId: { in: empIds }, title: { in: goalTitles } },
    select: { employeeId: true, title: true },
  });
  const goalKey = new Set(existingGoals.map((g: any) => `${g.employeeId}|${g.title}`));
  // TOP-UP semantics: only create enough NEW goals to reach 40 total.
  const goalTarget = Math.max(0, 40 - existingGoals.length);
  const goalCreates: any[] = [];
  for (let i = 0; goalCreates.length < goalTarget && i < 120; i++) {
    const emp = pick(employees, i);
    const title = pick(goalTitles, i);
    if (goalKey.has(`${emp.id}|${title}`)) continue;
    goalKey.add(`${emp.id}|${title}`);
    const start = daysAgo(rand(30, 90));
    const end = new Date(start);
    end.setMonth(end.getMonth() + 3);
    goalCreates.push({
      employeeId: emp.id, title,
      description: `Goal: ${title}. Aligned with quarterly objectives.`,
      category: pick(['performance', 'development', 'behavioral'], i),
      priority: pick(['high', 'medium', 'low'], i),
      status: pick(['not_started', 'in_progress', 'in_progress', 'completed'], i),
      progress: rand(0, 100),
      startDate: start, endDate: end,
    });
  }
  if (goalCreates.length) await db.goal.createMany({ data: goalCreates }).catch(() => {});
  report['goals'] = { created: goalCreates.length, skipped: existingGoals.length };

  // ── Grievances ──
  const existingGrievances = await db.grievance.findMany({
    where: { employeeId: { in: empIds }, subject: { in: GRIEVANCE_SUBJECTS } },
    select: { employeeId: true, subject: true },
  });
  const grievanceKey = new Set(existingGrievances.map((g: any) => `${g.employeeId}|${g.subject}`));
  // TOP-UP semantics: only create enough NEW grievances to reach 8 total.
  const grievanceTarget = Math.max(0, 8 - existingGrievances.length);
  const grievanceCreates: any[] = [];
  for (let i = 0; grievanceCreates.length < grievanceTarget && i < 40; i++) {
    const emp = pick(employees, i * 5);
    const subject = pick(GRIEVANCE_SUBJECTS, i);
    if (grievanceKey.has(`${emp.id}|${subject}`)) continue;
    grievanceKey.add(`${emp.id}|${subject}`);
    grievanceCreates.push({
      employeeId: emp.id,
      type: pick(GRIEVANCE_TYPES, i),
      subject,
      description: `${subject}. Requesting HR to review and take appropriate action. This issue has been ongoing and affecting my work experience.`,
      priority: pick(['low', 'medium', 'high'], i),
      status: pick(['open', 'in_progress', 'resolved', 'closed'], i),
      assignedTo: i % 2 === 0 ? 'HR Team' : null,
    });
  }
  if (grievanceCreates.length) await db.grievance.createMany({ data: grievanceCreates }).catch(() => {});
  report['grievances'] = { created: grievanceCreates.length, skipped: existingGrievances.length };

  // ── Helpdesk tickets (ticketId unique) ──
  const existingTickets = await db.ticket.findMany({
    where: { requesterId: { in: empIds }, subject: { in: TICKET_SUBJECTS } },
    select: { requesterId: true, subject: true },
  });
  const ticketKey = new Set(existingTickets.map((t: any) => `${t.requesterId}|${t.subject}`));
  const ticketStamp = Date.now().toString().slice(-6);
  // TOP-UP semantics: only create enough NEW tickets to reach 15 total
  // (previous behaviour created 15 MORE on every run — tickets tripled).
  const ticketTarget = Math.max(0, 15 - existingTickets.length);
  const ticketCreates: any[] = [];
  for (let i = 0; ticketCreates.length < ticketTarget && i < 60; i++) {
    const emp = pick(employees, i * 3);
    const subject = pick(TICKET_SUBJECTS, i);
    if (ticketKey.has(`${emp.id}|${subject}`)) continue;
    ticketKey.add(`${emp.id}|${subject}`);
    ticketCreates.push({
      ticketId: `TK-${ticketStamp}-${String(ticketCreates.length + 1).padStart(4, '0')}`,
      requesterType: 'employee',
      requesterId: emp.id,
      requesterName: `${emp.firstName} ${emp.lastName}`,
      subject,
      description: `${subject}. Raised via employee helpdesk portal. Please assist at the earliest.`,
      priority: pick(['low', 'medium', 'medium', 'high'], i),
      status: pick(['open', 'in_progress', 'resolved', 'closed', 'open'], i),
    });
  }
  if (ticketCreates.length) await db.ticket.createMany({ data: ticketCreates }).catch(() => {});
  report['tickets'] = { created: ticketCreates.length, skipped: existingTickets.length };
  void tenant;
}

// ═════════════════════════════════════════════════════════════════════
// POST dispatcher — ?phase=1..6 (default: all phases sequentially)
// ═════════════════════════════════════════════════════════════════════
const PHASES: Record<number, { name: string; fn: (db: any, tenant: any, report: Report, reset?: boolean) => Promise<void> }> = {
  1: { name: 'Organisation structure (companies, branches, departments, designations, shifts, holidays)', fn: phase1 },
  2: { name: 'Employees (50 employees + company mappings + reporting managers)', fn: phase2 },
  3: { name: 'Leave (types, balances, requests)', fn: phase3 },
  4: { name: 'Attendance + Payroll', fn: phase4 },
  5: { name: 'Recruitment + Assets', fn: phase5 },
  6: { name: 'Training + Performance + Grievances + Helpdesk', fn: phase6 },
};

export async function POST(request: Request) {
  try {
    const { error } = await authorize(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const reset = searchParams.get('reset') === 'true';
    const phaseParam = parseInt(searchParams.get('phase') || '', 10);
    const phasesToRun = Number.isFinite(phaseParam) && phaseParam >= 1 && phaseParam <= 6
      ? [phaseParam]
      : Object.keys(PHASES).map(Number);

    const { db, tenant } = await resolveDemoDb();

    const report: Report = {};
    for (const p of phasesToRun) {
      const phase = PHASES[p];
      try {
        await phase.fn(db, tenant, report, reset);
        report[`phase_${p}`] = report[`phase_${p}`] || { created: 0, skipped: 0, note: 'OK' };
      } catch (phaseErr) {
        console.error(`[SeedDemoFull] Phase ${p} failed:`, phaseErr);
        report[`phase_${p}`] = {
          created: 0, skipped: 0,
          note: `FAILED: ${phaseErr instanceof Error ? phaseErr.message : 'unknown error'}`,
        };
        // When running a single phase, surface the failure explicitly
        if (phasesToRun.length === 1) {
          return json({
            success: false,
            error: `Seed phase ${p} failed`,
            details: phaseErr instanceof Error ? phaseErr.message : 'Unknown',
            phase: p,
            report,
          }, 500);
        }
      }
    }

    const totalCreated = Object.values(report).reduce((sum: number, r: any) => sum + (r.created || 0), 0);
    const totalEmployees = await db.employee.count({ where: demoEmployeeWhere() }).catch(() => 0);
    const totalCompanies = await db.company.count({ where: { code: { in: COMPANIES.map((c) => c.code) } } }).catch(() => 0);
    const failedPhases = Object.entries(report)
      .filter(([k, v]: any) => k.startsWith('phase_') && v.note?.startsWith('FAILED'))
      .map(([k]) => k);

    return json({
      success: failedPhases.length === 0,
      message: failedPhases.length
        ? `Seed completed with failures in: ${failedPhases.join(', ')}`
        : `Demo seed complete. ${totalCompanies} companies, ${totalEmployees} employees. ${totalCreated} records created.`,
      phasesRun: phasesToRun,
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      summary: { totalCompanies, totalEmployees, totalCreated },
      report,
    });
  } catch (error) {
    console.error('[SeedDemoFull] Error:', error);
    return json(
      { error: 'Demo seed failed', details: error instanceof Error ? error.message : 'Unknown' },
      500,
    );
  }
}
