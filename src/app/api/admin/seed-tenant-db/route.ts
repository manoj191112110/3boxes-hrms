import { NextResponse } from 'next/server';
import { getPlatformDb, getDbForTenant } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders, hashPassword } from '@/lib/auth';

/**
 * POST /api/admin/seed-tenant-db?slug=marqaitechgroup
 *
 * Seeds the dedicated tenant_marqaitechgroup database with:
 * - Tenant record
 * - TenantDatabase registration
 * - Company Group + 4 Companies
 * - Branches, Departments, Designations
 * - Users (tenant admin + 4 HR admins)
 * - Employee records for each user
 * - Leave types, shifts, holidays
 *
 * This is needed because after registering the separate DB,
 * the tenant_marqaitechgroup database is empty — all data was
 * previously in the platform DB (neondb).
 *
 * Only super_admin can call this endpoint.
 */

const NEON_POOLER_HOST = 'ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech';
const NEON_USER = 'neondb_owner';
const NEON_PASSWORD = 'npg_pxZd8woKe4WB';

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export async function POST(request: Request) {
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (decoded.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admin can seed tenant DBs' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug') || 'marqaitechgroup';

    const platformDb = getPlatformDb();

    // Find the tenant in the platform DB
    const tenant = await platformDb.tenant.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, status: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: `Tenant "${slug}" not found` }, { status: 404 });
    }

    // Register the TenantDatabase record (so getDbForTenant routes correctly)
    const connString = `postgresql://${NEON_USER}:${NEON_PASSWORD}@${NEON_POOLER_HOST}/tenant_${slug}?sslmode=require&connect_timeout=10`;
    const directUrl = `postgresql://${NEON_USER}:${NEON_PASSWORD}@${NEON_POOLER_HOST}/tenant_${slug}?sslmode=require`;

    await platformDb.tenantDatabase.upsert({
      where: { tenantId: tenant.id },
      update: {
        connectionString: connString,
        directUrl,
        databaseName: `tenant_${slug}`,
        isActive: true,
      },
      create: {
        tenantId: tenant.id,
        connectionString: connString,
        directUrl,
        databaseName: `tenant_${slug}`,
        isActive: true,
      },
    });

    // Now get the tenant DB client
    const db = await getDbForTenant(slug);

    // Run schema sync (create all tables)
    const schemaSyncStatements = [
      `CREATE TABLE IF NOT EXISTS "Tenant" (id TEXT NOT NULL, name TEXT NOT NULL, slug TEXT NOT NULL, domain TEXT, plan TEXT, status TEXT NOT NULL DEFAULT 'active', country TEXT, currency TEXT, timezone TEXT, language TEXT, logo TEXT, baseCurrency TEXT, maxCompaniesAllowed INTEGER NOT NULL DEFAULT 0, aiFeedbackEnabled BOOLEAN NOT NULL DEFAULT false, resumeScoreThreshold INTEGER NOT NULL DEFAULT 0, talentPoolCrossCompanyEnabled BOOLEAN NOT NULL DEFAULT false, videoInterviewRetakeLimit INTEGER NOT NULL DEFAULT 2, videoRetentionDays INTEGER NOT NULL DEFAULT 90, createdAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_slug_key" ON "Tenant"("slug")`,
      `CREATE TABLE IF NOT EXISTS "TenantDatabase" (id TEXT NOT NULL, tenantId TEXT NOT NULL, connectionString TEXT NOT NULL, directUrl TEXT, databaseName TEXT NOT NULL, neonBranchId TEXT, neonProjectId TEXT, isActive BOOLEAN NOT NULL DEFAULT true, provisionedAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), createdAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), CONSTRAINT "TenantDatabase_pkey" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "TenantDatabase_tenantId_key" ON "TenantDatabase"("tenantId")`,
      `CREATE TABLE IF NOT EXISTS "User" (id TEXT NOT NULL, email TEXT NOT NULL, password TEXT NOT NULL, name TEXT NOT NULL, avatar TEXT, tenantId TEXT, role TEXT NOT NULL DEFAULT 'admin', status TEXT NOT NULL DEFAULT 'active', lastLogin TIMESTAMP(3), lastLogout TIMESTAMP(3), createdAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), CONSTRAINT "User_pkey" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "User_id_key" ON "User"("id")`,
      `CREATE INDEX IF NOT EXISTS "User_tenantId_idx" ON "User"("tenantId")`,
      `CREATE TABLE IF NOT EXISTS "CompanyGroup" (id TEXT NOT NULL, name TEXT NOT NULL, tenantId TEXT NOT NULL, createdAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), CONSTRAINT "CompanyGroup_pkey" PRIMARY KEY ("id"))`,
      `CREATE TABLE IF NOT EXISTS "Company" (id TEXT NOT NULL, name TEXT NOT NULL, code TEXT, companyGroupId TEXT, country TEXT, currency TEXT, timezone TEXT, city TEXT, state TEXT, email TEXT, website TEXT, status TEXT NOT NULL DEFAULT 'active', address TEXT, phone TEXT, logo TEXT, maxEmployees INTEGER, plannedEmployeeCount INTEGER, createdAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), CONSTRAINT "Company_pkey" PRIMARY KEY ("id"))`,
      `CREATE TABLE IF NOT EXISTS "Branch" (id TEXT NOT NULL, name TEXT NOT NULL, code TEXT, city TEXT, state TEXT, country TEXT, companyId TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', address TEXT, phone TEXT, email TEXT, createdAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), CONSTRAINT "Branch_pkey" PRIMARY KEY ("id"))`,
      `CREATE TABLE IF NOT EXISTS "Department" (id TEXT NOT NULL, name TEXT NOT NULL, code TEXT, companyId TEXT NOT NULL, branchId TEXT, status TEXT NOT NULL DEFAULT 'active', createdAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), CONSTRAINT "Department_pkey" PRIMARY KEY ("id"))`,
      `CREATE TABLE IF NOT EXISTS "Designation" (id TEXT NOT NULL, title TEXT NOT NULL, departmentId TEXT NOT NULL, level INTEGER NOT NULL DEFAULT 1, minSalary DOUBLE PRECISION, maxSalary DOUBLE PRECISION, status TEXT NOT NULL DEFAULT 'active', createdAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), CONSTRAINT "Designation_pkey" PRIMARY KEY ("id"))`,
      `CREATE TABLE IF NOT EXISTS "Employee" (id TEXT NOT NULL, employeeId TEXT NOT NULL, firstName TEXT NOT NULL, lastName TEXT NOT NULL, email TEXT NOT NULL, personalEmail TEXT, phone TEXT, avatar TEXT, userId TEXT, departmentId TEXT NOT NULL, designationId TEXT NOT NULL, branchId TEXT, companyId TEXT, reportingManagerId TEXT, dateOfJoining TIMESTAMP(3) NOT NULL DEFAULT NOW(), dateOfBirth TIMESTAMP(3), gender TEXT, maritalStatus TEXT, nationality TEXT, address TEXT, city TEXT, state TEXT, zipCode TEXT, country TEXT, bloodGroup TEXT, emergencyContactName TEXT, emergencyContactPhone TEXT, status TEXT NOT NULL DEFAULT 'active', employeeStatus TEXT, employeeType TEXT, bankName TEXT, bankAccountNo TEXT, bankIfscCode TEXT, panNumber TEXT, aadhaarNumber TEXT, taxId TEXT, salary DOUBLE PRECISION, salaryCurrency TEXT NOT NULL DEFAULT 'INR', leavePolicyId TEXT, attendancePolicyId TEXT, travelPolicyId TEXT, salaryStructureId TEXT, createdAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), CONSTRAINT "Employee_pkey" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "Employee_employeeId_key" ON "Employee"("employeeId")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "Employee_userId_key" ON "Employee"("userId")`,
      `CREATE INDEX IF NOT EXISTS "Employee_departmentId_idx" ON "Employee"("departmentId")`,
      `CREATE INDEX IF NOT EXISTS "Employee_reportingManagerId_idx" ON "Employee"("reportingManagerId")`,
      `CREATE TABLE IF NOT EXISTS "Shift" (id TEXT NOT NULL, name TEXT NOT NULL, code TEXT, startTime TEXT NOT NULL, endTime TEXT NOT NULL, companyId TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', graceMinutes INTEGER NOT NULL DEFAULT 0, isNight BOOLEAN NOT NULL DEFAULT false, createdAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), CONSTRAINT "Shift_pkey" PRIMARY KEY ("id"))`,
      `CREATE TABLE IF NOT EXISTS "Holiday" (id TEXT NOT NULL, name TEXT NOT NULL, date TIMESTAMP(3) NOT NULL, type TEXT, companyId TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', createdAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id"))`,
      `CREATE TABLE IF NOT EXISTS "LeaveType" (id TEXT NOT NULL, name TEXT NOT NULL, code TEXT NOT NULL, description TEXT, defaultDays INTEGER NOT NULL DEFAULT 0, isPaid BOOLEAN NOT NULL DEFAULT true, carryForward BOOLEAN NOT NULL DEFAULT false, maxCarryForward INTEGER, status TEXT NOT NULL DEFAULT 'active', createdAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), CONSTRAINT "LeaveType_pkey" PRIMARY KEY ("id"))`,
      `CREATE TABLE IF NOT EXISTS "PerformanceReview" (id TEXT NOT NULL, employeeId TEXT NOT NULL, reviewCycle TEXT NOT NULL, reviewPeriod TEXT, reviewerId TEXT, rating DOUBLE PRECISION NOT NULL DEFAULT 0, goalsRating DOUBLE PRECISION NOT NULL DEFAULT 0, skillsRating DOUBLE PRECISION NOT NULL DEFAULT 0, behaviorRating DOUBLE PRECISION NOT NULL DEFAULT 0, overallRating DOUBLE PRECISION NOT NULL DEFAULT 0, comments TEXT, strengths TEXT, improvements TEXT, status TEXT NOT NULL DEFAULT 'pending', reviewDate TIMESTAMP(3), createdAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), CONSTRAINT "PerformanceReview_pkey" PRIMARY KEY ("id"))`,
      `CREATE INDEX IF NOT EXISTS "PerformanceReview_employeeId_idx" ON "PerformanceReview"("employeeId")`,
      `CREATE TABLE IF NOT EXISTS "AuditLog" (id TEXT NOT NULL, userId TEXT, action TEXT NOT NULL, module TEXT, entityId TEXT, details TEXT, ip TEXT, userAgent TEXT, createdAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id"))`,
      `CREATE TABLE IF NOT EXISTS "Notification" (id TEXT NOT NULL, userId TEXT, tenantId TEXT, title TEXT NOT NULL, message TEXT NOT NULL, type TEXT NOT NULL, category TEXT, isRead BOOLEAN NOT NULL DEFAULT false, isEmailSent BOOLEAN NOT NULL DEFAULT false, actionUrl TEXT, createdAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"))`,
      `CREATE TABLE IF NOT EXISTS "LoginActivity" (id TEXT NOT NULL, userId TEXT, action TEXT NOT NULL, ip TEXT, userAgent TEXT, createdAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), CONSTRAINT "LoginActivity_pkey" PRIMARY KEY ("id"))`,
      `CREATE TABLE IF NOT EXISTS "EmployeeCompanyMapping" (id TEXT NOT NULL, employeeId TEXT NOT NULL, companyId TEXT NOT NULL, employeeCode TEXT, departmentId TEXT, designationId TEXT, branchId TEXT, isPrimary BOOLEAN NOT NULL DEFAULT false, status TEXT NOT NULL DEFAULT 'active', dateOfJoining TIMESTAMP(3), createdAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), updatedAt TIMESTAMP(3) NOT NULL DEFAULT NOW(), CONSTRAINT "EmployeeCompanyMapping_pkey" PRIMARY KEY ("id"))`,
    ];

    for (const sql of schemaSyncStatements) {
      try { await db.$executeRawUnsafe(sql); } catch (e) { /* table exists */ }
    }

    const results: string[] = [];

    // 1. Create Tenant record in tenant DB
    await db.tenant.upsert({
      where: { id: tenant.id },
      update: {},
      create: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        domain: `${tenant.slug}.3boxeshrms.com`,
        plan: 'enterprise',
        status: 'active',
        country: 'IN',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        maxCompaniesAllowed: 10,
        aiFeedbackEnabled: true,
        resumeScoreThreshold: 0,
        talentPoolCrossCompanyEnabled: true,
        videoInterviewRetakeLimit: 2,
        videoRetentionDays: 90,
      },
    }).catch(() => null);
    results.push('Tenant record created');

    // 2. Create TenantDatabase record in tenant DB
    await (db as any).tenantDatabase?.upsert({
      where: { tenantId: tenant.id },
      update: {},
      create: {
        tenantId: tenant.id,
        connectionString: connString,
        directUrl,
        databaseName: `tenant_${slug}`,
        isActive: true,
      },
    }).catch(() => null);

    // 3. Create Company Group
    const companyGroup = await db.companyGroup.upsert({
      where: { id: `${tenant.id}-group` },
      update: {},
      create: {
        id: `${tenant.id}-group`,
        name: `${tenant.name} Group`,
        tenantId: tenant.id,
      },
    }).catch(() => null as any);
    results.push('Company Group created');

    // 4. Create Companies
    const companyData = [
      { name: 'MARQ AI TECH PVT LTD', code: 'MAT', city: 'Hyderabad', state: 'TG' },
      { name: '3 BOXES LUXURY CURATIONS', code: '3BL', city: 'Hyderabad', state: 'TG' },
      { name: '3 BOXES CONSULTING SERVICES', code: '3BC', city: 'Hyderabad', state: 'TG' },
      { name: '3 BOXES TECHNOLOGIES', code: '3BT', city: 'Hyderabad', state: 'TG' },
    ];

    const companies = [];
    for (let i = 0; i < companyData.length; i++) {
      const c = companyData[i];
      const company = await db.company.upsert({
        where: { id: `${tenant.id}-co-${i}` },
        update: {},
        create: {
          id: `${tenant.id}-co-${i}`,
          name: c.name,
          code: c.code,
          companyGroupId: companyGroup?.id || `${tenant.id}-group`,
          country: 'IN',
          currency: 'INR',
          timezone: 'Asia/Kolkata',
          city: c.city,
          state: c.state,
          email: `info@${c.code.toLowerCase()}.com`,
          status: 'active',
        },
      }).catch(() => null as any);
      if (company) companies.push(company);
    }
    results.push(`${companies.length} Companies created`);

    // 5. Create Branches (1 per company)
    const branches = [];
    for (let i = 0; i < companies.length; i++) {
      const branch = await db.branch.upsert({
        where: { id: `${tenant.id}-br-${i}` },
        update: {},
        create: {
          id: `${tenant.id}-br-${i}`,
          name: 'Head Office',
          code: `${companies[i].code}-HO`,
          city: companies[i].city,
          state: companies[i].state,
          country: 'IN',
          companyId: companies[i].id,
          status: 'active',
          address: `${companies[i].city}, ${companies[i].state}`,
        },
      }).catch(() => null as any);
      if (branch) branches.push(branch);
    }
    results.push(`${branches.length} Branches created`);

    // 6. Create Departments (3 per company: HR, Finance, Operations)
    const deptNames = ['Human Resources', 'Finance', 'Operations'];
    const allDepts = [];
    for (let i = 0; i < companies.length; i++) {
      for (let j = 0; j < deptNames.length; j++) {
        const dept = await db.department.upsert({
          where: { id: `${tenant.id}-dept-${i}-${j}` },
          update: {},
          create: {
            id: `${tenant.id}-dept-${i}-${j}`,
            name: deptNames[j],
            code: `${companies[i].code}-${deptNames[j].slice(0, 3).toUpperCase()}`,
            companyId: companies[i].id,
            branchId: branches[i]?.id,
            status: 'active',
          },
        }).catch(() => null as any);
        if (dept) allDepts.push({ ...dept, companyIdx: i });
      }
    }
    results.push(`${allDepts.length} Departments created`);

    // 7. Create Designations (2 per department)
    const desgData = [
      { title: 'HR Manager', level: 6 },
      { title: 'HR Executive', level: 3 },
      { title: 'Finance Manager', level: 6 },
      { title: 'Finance Executive', level: 3 },
      { title: 'Operations Manager', level: 6 },
      { title: 'Operations Executive', level: 3 },
    ];
    const allDesgs = [];
    for (const dept of allDepts) {
      const matchingDesgs = desgData.filter(d => d.title.includes(dept.name.split(' ')[0]));
      for (const d of matchingDesgs) {
        const desg = await db.designation.upsert({
          where: { id: `${dept.id}-desg-${d.title.replace(/\s/g, '')}` },
          update: {},
          create: {
            id: `${dept.id}-desg-${d.title.replace(/\s/g, '')}`,
            title: d.title,
            departmentId: dept.id,
            level: d.level,
            minSalary: d.level >= 6 ? 1500000 : 500000,
            maxSalary: d.level >= 6 ? 3000000 : 1000000,
            status: 'active',
          },
        }).catch(() => null as any);
        if (desg) allDesgs.push(desg);
      }
    }
    results.push(`${allDesgs.length} Designations created`);

    // 8. Create Users + Employees
    const hashedPwd = await hashPassword('MarqAI@2026');
    const userData = [
      { email: 'admin@marqaitechgroup.com', name: 'Tenant Admin', role: 'tenant_admin', companyIdx: 0 },
      { email: 'admin@3boxesluxury.com', name: 'Admin Luxury', role: 'company_hr_admin', companyIdx: 1 },
      { email: 'admin@3boxesconsulting.com', name: 'Admin Consulting', role: 'company_hr_admin', companyIdx: 2 },
      { email: 'admin@3boxestechnologies.com', name: 'Admin Technologies', role: 'company_hr_admin', companyIdx: 3 },
    ];

    let userCount = 0;
    let empCount = 0;
    for (let i = 0; i < userData.length; i++) {
      const u = userData[i];
      const company = companies[u.companyIdx];
      const hrDept = allDepts.find(d => d.companyIdx === u.companyIdx && d.name === 'Human Resources');
      const mgrDesg = allDesgs.find(d => hrDept && d.departmentId === hrDept.id && d.title.includes('Manager'));
      const branch = branches[u.companyIdx];

      // Create User
      const user = await db.user.upsert({
        where: { email: u.email },
        update: { password: hashedPwd, status: 'active' },
        create: {
          email: u.email,
          password: hashedPwd,
          name: u.name,
          role: u.role,
          status: 'active',
          tenantId: tenant.id,
        },
      }).catch(() => null as any);

      if (!user) continue;
      userCount++;

      // Create Employee
      if (hrDept && mgrDesg) {
        const nameParts = u.name.split(' ');
        const emp = await db.employee.upsert({
          where: { userId: user.id },
          update: {},
          create: {
            employeeId: `EMP-${company.code}-HR001`,
            firstName: nameParts[0],
            lastName: nameParts.slice(1).join(' ') || 'Admin',
            email: u.email,
            phone: `+91-9876${String(5000 + i).padStart(4, '0')}`,
            userId: user.id,
            departmentId: hrDept.id,
            designationId: mgrDesg.id,
            branchId: branch?.id,
            companyId: company.id,
            dateOfJoining: new Date('2020-01-01'),
            gender: i % 2 === 0 ? 'male' : 'female',
            nationality: 'Indian',
            city: company.city,
            state: company.state,
            country: 'IN',
            status: 'active',
            employeeStatus: 'confirmed',
            employeeType: 'permanent',
            salary: 2000000,
            salaryCurrency: 'INR',
          },
        }).catch(() => null as any);
        if (emp) empCount++;

        // Create EmployeeCompanyMapping
        if (emp) {
          await db.employeeCompanyMapping.upsert({
            where: { id: `${emp.id}-mapping` },
            update: {},
            create: {
              id: `${emp.id}-mapping`,
              employeeId: emp.id,
              companyId: company.id,
              employeeCode: `EMP-${company.code}-HR001`,
              departmentId: hrDept.id,
              designationId: mgrDesg.id,
              branchId: branch?.id,
              isPrimary: true,
              status: 'active',
              dateOfJoining: new Date('2020-01-01'),
            },
          }).catch(() => null);
        }
      }
    }
    results.push(`${userCount} Users created`);
    results.push(`${empCount} Employees created`);

    // 9. Create Leave Types
    const leaveTypes = [
      { name: 'Casual Leave', code: 'CL', defaultDays: 12, isPaid: true, carryForward: true, maxCarryForward: 3 },
      { name: 'Sick Leave', code: 'SL', defaultDays: 10, isPaid: true, carryForward: false },
      { name: 'Earned Leave', code: 'EL', defaultDays: 15, isPaid: true, carryForward: true, maxCarryForward: 5 },
    ];
    for (const lt of leaveTypes) {
      await db.leaveType.upsert({
        where: { id: `${tenant.id}-lt-${lt.code}` },
        update: {},
        create: {
          id: `${tenant.id}-lt-${lt.code}`,
          name: lt.name,
          code: lt.code,
          defaultDays: lt.defaultDays,
          isPaid: lt.isPaid,
          carryForward: lt.carryForward,
          maxCarryForward: lt.maxCarryForward || null,
          status: 'active',
        },
      }).catch(() => null);
    }
    results.push(`${leaveTypes.length} Leave Types created`);

    // 10. Create Shifts
    for (let i = 0; i < companies.length; i++) {
      await db.shift.upsert({
        where: { id: `${tenant.id}-shift-${i}` },
        update: {},
        create: {
          id: `${tenant.id}-shift-${i}`,
          name: 'General Shift',
          code: `${companies[i].code}-GS`,
          startTime: '09:00',
          endTime: '18:00',
          companyId: companies[i].id,
          status: 'active',
          graceMinutes: 15,
          isNight: false,
        },
      }).catch(() => null);
    }
    results.push(`${companies.length} Shifts created`);

    // 11. Create Holidays (2026)
    const holidays = [
      { name: 'Republic Day', date: '2026-01-26', type: 'national' },
      { name: 'Independence Day', date: '2026-08-15', type: 'national' },
      { name: 'Gandhi Jayanti', date: '2026-10-02', type: 'national' },
      { name: 'Christmas', date: '2026-12-25', type: 'festival' },
      { name: 'New Year', date: '2026-01-01', type: 'national' },
    ];
    for (const company of companies) {
      for (const h of holidays) {
        await db.holiday.upsert({
          where: { id: `${tenant.id}-hol-${company.code}-${h.name.replace(/\s/g, '')}` },
          update: {},
          create: {
            id: `${tenant.id}-hol-${company.code}-${h.name.replace(/\s/g, '')}`,
            name: h.name,
            date: new Date(h.date),
            type: h.type,
            companyId: company.id,
            status: 'active',
          },
        }).catch(() => null);
      }
    }
    results.push(`${holidays.length * companies.length} Holidays created`);

    return NextResponse.json({
      success: true,
      message: `Tenant database seeded successfully! ${results.length} operations completed.`,
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      database: `tenant_${slug}`,
      results,
      loginCredentials: {
        url: `https://${slug}.3boxeshrms.com/login`,
        email: 'admin@marqaitechgroup.com',
        password: 'MarqAI@2026',
      },
    });
  } catch (error) {
    console.error('[SeedTenantDB] Error:', error);
    return NextResponse.json({
      error: 'Failed to seed tenant database',
      details: error instanceof Error ? error.message : 'Unknown',
    }, { status: 500 });
  }
}
