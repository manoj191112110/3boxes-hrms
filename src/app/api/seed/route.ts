import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { hashPassword } from '@/lib/auth';
import { isLiveMode } from '@/lib/site-mode';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function GET(request: Request) {
  // ─── LIVE MODE GUARD ───
  // Base seed is BLOCKED on the live production platform.
  if (isLiveMode(request)) {
    return NextResponse.json({
      error: 'Seeding is disabled on the live platform. Dummy data is only available on the demo site (nexus-hrms-mu.vercel.app).',
      code: 'LIVE_MODE_BLOCKED',
    }, { status: 403, headers: corsHeaders() });
  }

  try {
    // Hash passwords for each demo account separately
    const pwHashes: Record<string, string> = {};
    const demoPasswords: Record<string, string> = {
      'admin@3boxeshrms.com': 'admin123',
      'hr@3boxeshrms.com': 'hr123',
      'manager@3boxeshrms.com': 'manager123',
      'employee@3boxeshrms.com': 'employee123',
      'recruiter@3boxeshrms.com': 'recruiter123',
      'candidate@3boxeshrms.com': 'candidate123',
    };
    for (const [email, pw] of Object.entries(demoPasswords)) {
      pwHashes[email] = await hashPassword(pw);
    }
    // Fallback hash for non-demo users
    const defaultHashedPassword = pwHashes['admin@3boxeshrms.com'];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // ============ TENANT ============
    const tenant = await getPlatformDb().tenant.upsert({
      where: { slug: '3boxes-corp' },
      update: {},
      create: {
        name: 'Marq AI Tech Pvt Ltd',
        slug: '3boxes-corp',
        domain: '3boxeshrms.com',
        plan: 'enterprise',
        status: 'active',
        country: 'US',
        currency: 'USD',
        timezone: 'America/New_York',
      },
    });

    // ============ COMPANY GROUPS ============
    const americasGroup = await db.companyGroup.upsert({
      where: { id: 'cg-americas' },
      update: {},
      create: {
        id: 'cg-americas',
        name: '3Boxes Americas',
        tenantId: tenant.id,
      },
    });

    const asiaPacificGroup = await db.companyGroup.upsert({
      where: { id: 'cg-asia-pacific' },
      update: {},
      create: {
        id: 'cg-asia-pacific',
        name: '3Boxes Asia Pacific',
        tenantId: tenant.id,
      },
    });

    // ============ COMPANIES ============
    const usaCompany = await db.company.upsert({
      where: { id: 'comp-usa' },
      update: {},
      create: {
        id: 'comp-usa',
        name: '3Boxes Tech Inc USA',
        code: 'NTU',
        companyGroupId: americasGroup.id,
        registrationNo: 'US-NT-001',
        taxId: 'US-TAX-001',
        country: 'US',
        currency: 'USD',
        timezone: 'America/New_York',
        address: '350 Fifth Avenue',
        city: 'New York',
        state: 'NY',
        zipCode: '10118',
        phone: '+1-212-555-0100',
        email: 'info@3boxestechusa.com',
        website: 'https://3boxestechusa.com',
        status: 'active',
      },
    });

    const indiaCompany = await db.company.upsert({
      where: { id: 'comp-india' },
      update: {},
      create: {
        id: 'comp-india',
        name: 'Marq AI Tech Pvt Ltd India',
        code: 'NTI',
        companyGroupId: asiaPacificGroup.id,
        registrationNo: 'IN-NT-001',
        taxId: 'IN-TAX-001',
        country: 'IN',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        address: '100 Feet Road, Koramangala',
        city: 'Bangalore',
        state: 'Karnataka',
        zipCode: '560034',
        phone: '+91-80-555-0100',
        email: 'info@3boxestechindia.com',
        website: 'https://3boxestechindia.com',
        status: 'active',
      },
    });

    const ukCompany = await db.company.upsert({
      where: { id: 'comp-uk' },
      update: {},
      create: {
        id: 'comp-uk',
        name: '3Boxes Solutions UK',
        code: 'NSU',
        companyGroupId: americasGroup.id,
        registrationNo: 'UK-NS-001',
        taxId: 'UK-TAX-001',
        country: 'GB',
        currency: 'GBP',
        timezone: 'Europe/London',
        address: '1 Canada Square, Canary Wharf',
        city: 'London',
        state: 'England',
        zipCode: 'E14 5AB',
        phone: '+44-20-555-0100',
        email: 'info@3boxessolutionsuk.com',
        website: 'https://3boxessolutionsuk.com',
        status: 'active',
      },
    });

    // ============ BRANCHES ============
    const nyBranch = await db.branch.upsert({
      where: { id: 'branch-ny' },
      update: {},
      create: {
        id: 'branch-ny',
        name: 'New York HQ',
        code: 'NY-HQ',
        companyId: usaCompany.id,
        country: 'US',
        state: 'NY',
        city: 'New York',
        address: '350 Fifth Avenue, Suite 7200',
        zipCode: '10118',
        phone: '+1-212-555-0101',
        email: 'nyhq@3boxestechusa.com',
        status: 'active',
      },
    });

    const sfBranch = await db.branch.upsert({
      where: { id: 'branch-sf' },
      update: {},
      create: {
        id: 'branch-sf',
        name: 'San Francisco',
        code: 'SF-01',
        companyId: usaCompany.id,
        country: 'US',
        state: 'CA',
        city: 'San Francisco',
        address: '101 Market Street, Suite 300',
        zipCode: '94105',
        phone: '+1-415-555-0201',
        email: 'sf@3boxestechusa.com',
        status: 'active',
      },
    });

    const blrBranch = await db.branch.upsert({
      where: { id: 'branch-blr' },
      update: {},
      create: {
        id: 'branch-blr',
        name: 'Bangalore',
        code: 'BLR-01',
        companyId: indiaCompany.id,
        country: 'IN',
        state: 'Karnataka',
        city: 'Bangalore',
        address: '100 Feet Road, Koramangala, 4th Block',
        zipCode: '560034',
        phone: '+91-80-555-0301',
        email: 'blr@3boxestechindia.com',
        status: 'active',
      },
    });

    const mumbaiBranch = await db.branch.upsert({
      where: { id: 'branch-mumbai' },
      update: {},
      create: {
        id: 'branch-mumbai',
        name: 'Mumbai',
        code: 'MUM-01',
        companyId: indiaCompany.id,
        country: 'IN',
        state: 'Maharashtra',
        city: 'Mumbai',
        address: 'Bandra Kurla Complex, Bandra East',
        zipCode: '400051',
        phone: '+91-22-555-0401',
        email: 'mumbai@3boxestechindia.com',
        status: 'active',
      },
    });

    const londonBranch = await db.branch.upsert({
      where: { id: 'branch-london' },
      update: {},
      create: {
        id: 'branch-london',
        name: 'London',
        code: 'LDN-01',
        companyId: ukCompany.id,
        country: 'GB',
        state: 'England',
        city: 'London',
        address: '1 Canada Square, Level 28',
        zipCode: 'E14 5AB',
        phone: '+44-20-555-0501',
        email: 'london@3boxessolutionsuk.com',
        status: 'active',
      },
    });

    // ============ DEPARTMENTS ============
    const departments = [
      { id: 'dept-eng', name: 'Engineering', code: 'ENG', companyId: usaCompany.id, branchId: nyBranch.id },
      { id: 'dept-product', name: 'Product', code: 'PROD', companyId: usaCompany.id, branchId: nyBranch.id },
      { id: 'dept-marketing', name: 'Marketing', code: 'MKT', companyId: usaCompany.id, branchId: sfBranch.id },
      { id: 'dept-sales', name: 'Sales', code: 'SALES', companyId: usaCompany.id, branchId: nyBranch.id },
      { id: 'dept-hr', name: 'Human Resources', code: 'HR', companyId: usaCompany.id, branchId: nyBranch.id },
      { id: 'dept-finance', name: 'Finance', code: 'FIN', companyId: usaCompany.id, branchId: nyBranch.id },
      { id: 'dept-ops', name: 'Operations', code: 'OPS', companyId: indiaCompany.id, branchId: blrBranch.id },
      { id: 'dept-design', name: 'Design', code: 'DES', companyId: usaCompany.id, branchId: sfBranch.id },
      { id: 'dept-recruitment', name: 'Recruitment', code: 'REC', companyId: usaCompany.id, branchId: nyBranch.id },
      { id: 'dept-analytics', name: 'Analytics', code: 'ANA', companyId: usaCompany.id, branchId: nyBranch.id },
    ];

    for (const dept of departments) {
      await db.department.upsert({
        where: { id: dept.id },
        update: {},
        create: dept,
      });
    }

    // ============ DESIGNATIONS ============
    const designations = [
      { id: 'des-cto', title: 'Chief Technology Officer', departmentId: 'dept-eng', level: 10, minSalary: 200000, maxSalary: 350000 },
      { id: 'des-vp-eng', title: 'VP of Engineering', departmentId: 'dept-eng', level: 9, minSalary: 180000, maxSalary: 280000 },
      { id: 'des-sr-eng', title: 'Senior Software Engineer', departmentId: 'dept-eng', level: 6, minSalary: 120000, maxSalary: 180000 },
      { id: 'des-eng', title: 'Software Engineer', departmentId: 'dept-eng', level: 4, minSalary: 80000, maxSalary: 130000 },
      { id: 'des-jr-eng', title: 'Junior Software Engineer', departmentId: 'dept-eng', level: 2, minSalary: 55000, maxSalary: 80000 },
      { id: 'des-vp-product', title: 'VP of Product', departmentId: 'dept-product', level: 9, minSalary: 170000, maxSalary: 260000 },
      { id: 'des-pm', title: 'Product Manager', departmentId: 'dept-product', level: 5, minSalary: 100000, maxSalary: 160000 },
      { id: 'des-marketing-mgr', title: 'Marketing Manager', departmentId: 'dept-marketing', level: 5, minSalary: 90000, maxSalary: 140000 },
      { id: 'des-sales-exec', title: 'Sales Executive', departmentId: 'dept-sales', level: 3, minSalary: 60000, maxSalary: 120000 },
      { id: 'des-hr-admin', title: 'HR Administrator', departmentId: 'dept-hr', level: 5, minSalary: 70000, maxSalary: 110000 },
      { id: 'des-hr-manager', title: 'HR Manager', departmentId: 'dept-hr', level: 6, minSalary: 90000, maxSalary: 140000 },
      { id: 'des-finance-analyst', title: 'Financial Analyst', departmentId: 'dept-finance', level: 4, minSalary: 75000, maxSalary: 120000 },
      { id: 'des-ops-manager', title: 'Operations Manager', departmentId: 'dept-ops', level: 5, minSalary: 80000, maxSalary: 130000 },
      { id: 'des-sr-designer', title: 'Senior UI/UX Designer', departmentId: 'dept-design', level: 5, minSalary: 95000, maxSalary: 150000 },
      { id: 'des-recruiter', title: 'Recruiter', departmentId: 'dept-recruitment', level: 4, minSalary: 65000, maxSalary: 95000 },
      { id: 'des-data-scientist', title: 'Data Scientist', departmentId: 'dept-analytics', level: 5, minSalary: 110000, maxSalary: 160000 },
    ];

    for (const des of designations) {
      await db.designation.upsert({
        where: { id: des.id },
        update: {},
        create: des,
      });
    }

    // ============ DEMO USERS (login page accounts with individual passwords) ============
    const demoUsers = [
      { id: 'user-admin', name: 'Admin 3Boxes', email: 'admin@3boxeshrms.com', role: 'super_admin' },
      { id: 'user-hr', name: 'Sarah Johnson', email: 'hr@3boxeshrms.com', role: 'admin' },
      { id: 'user-manager', name: 'Priya Sharma', email: 'manager@3boxeshrms.com', role: 'manager' },
      { id: 'user-employee', name: 'Raj Patel', email: 'employee@3boxeshrms.com', role: 'employee' },
      { id: 'user-recruiter', name: 'Kim Chen', email: 'recruiter@3boxeshrms.com', role: 'recruiter' },
      { id: 'user-candidate', name: 'Alex Turner', email: 'candidate@3boxeshrms.com', role: 'candidate' },
    ];

    for (const u of demoUsers) {
      const userPassword = pwHashes[u.email] || defaultHashedPassword;
      await db.user.upsert({
        where: { id: u.id },
        update: { password: userPassword }, // Update password in case it was previously wrong
        create: {
          id: u.id,
          name: u.name,
          email: u.email,
          password: userPassword,
          tenantId: tenant.id,
          role: u.role,
          status: 'active',
        },
      });
    }

    // Additional non-demo users (all use admin123 password)
    const additionalUsers = [
      { id: 'user-sarah', name: 'Sarah Johnson', email: 'sarah.hr@3boxeshrms.com', role: 'admin' },
      { id: 'user-john', name: 'John Williams', email: 'john.manager@3boxeshrms.com', role: 'manager' },
      { id: 'user-alice', name: 'Alice Chen', email: 'alice.emp@3boxeshrms.com', role: 'employee' },
      { id: 'user-bob', name: 'Bob Martinez', email: 'bob.dev@3boxeshrms.com', role: 'employee' },
      { id: 'user-carol', name: 'Carol Davis', email: 'carol.design@3boxeshrms.com', role: 'employee' },
      { id: 'user-david', name: 'David Kim', email: 'david.sales@3boxeshrms.com', role: 'employee' },
      { id: 'user-emma', name: 'Emma Thompson', email: 'emma.finance@3boxeshrms.com', role: 'employee' },
      { id: 'user-frank', name: 'Frank Rodriguez', email: 'frank.ops@3boxeshrms.com', role: 'employee' },
      { id: 'user-grace', name: 'Grace Liu', email: 'grace.product@3boxeshrms.com', role: 'employee' },
    ];

    for (const u of additionalUsers) {
      await db.user.upsert({
        where: { id: u.id },
        update: {},
        create: {
          id: u.id,
          name: u.name,
          email: u.email,
          password: defaultHashedPassword,
          tenantId: tenant.id,
          role: u.role,
          status: 'active',
        },
      });
    }

    // ============ DEMO EMPLOYEES (for login page demo accounts) ============
    const demoEmployees = [
      {
        id: 'emp-hr-demo', employeeId: 'EMP-HR', firstName: 'Sarah', lastName: 'Johnson', email: 'hr@3boxeshrms.com',
        phone: '+1-212-555-2001', userId: 'user-hr', departmentId: 'dept-hr', designationId: 'des-hr-manager',
        branchId: nyBranch.id, companyId: usaCompany.id, dateOfJoining: new Date('2021-03-01'),
        dateOfBirth: new Date('1990-09-14'), gender: 'female', maritalStatus: 'single', nationality: 'American',
        city: 'New York', state: 'NY', country: 'US',
        salary: 115000, salaryCurrency: 'USD', status: 'active',
      },
      {
        id: 'emp-manager-demo', employeeId: 'EMP-MGR', firstName: 'Priya', lastName: 'Sharma', email: 'manager@3boxeshrms.com',
        phone: '+1-212-555-2002', userId: 'user-manager', departmentId: 'dept-ops', designationId: 'des-ops-manager',
        branchId: nyBranch.id, companyId: usaCompany.id, dateOfJoining: new Date('2020-11-20'),
        dateOfBirth: new Date('1985-08-22'), gender: 'female', maritalStatus: 'married', nationality: 'Indian',
        city: 'New York', state: 'NY', country: 'US',
        salary: 105000, salaryCurrency: 'USD', status: 'active',
      },
      {
        id: 'emp-employee-demo', employeeId: 'EMP-EMP', firstName: 'Raj', lastName: 'Patel', email: 'employee@3boxeshrms.com',
        phone: '+1-212-555-2003', userId: 'user-employee', departmentId: 'dept-eng', designationId: 'des-sr-eng',
        branchId: nyBranch.id, companyId: usaCompany.id, dateOfJoining: new Date('2022-03-15'),
        dateOfBirth: new Date('1992-06-10'), gender: 'male', maritalStatus: 'single', nationality: 'Indian',
        city: 'New York', state: 'NY', country: 'US',
        salary: 145000, salaryCurrency: 'USD', status: 'active',
      },
      {
        id: 'emp-recruiter-demo', employeeId: 'EMP-REC', firstName: 'Kim', lastName: 'Chen', email: 'recruiter@3boxeshrms.com',
        phone: '+1-212-555-2004', userId: 'user-recruiter', departmentId: 'dept-recruitment', designationId: 'des-recruiter',
        branchId: nyBranch.id, companyId: usaCompany.id, dateOfJoining: new Date('2023-01-10'),
        dateOfBirth: new Date('1990-11-05'), gender: 'female', maritalStatus: 'single', nationality: 'American',
        city: 'New York', state: 'NY', country: 'US',
        salary: 85000, salaryCurrency: 'USD', status: 'active',
      },
    ];

    for (const emp of demoEmployees) {
      await db.employee.upsert({
        where: { id: emp.id },
        update: {},
        create: emp,
      });
    }

    // ============ REGULAR EMPLOYEES ============
    const employees = [
      {
        id: 'emp-admin', employeeId: 'EMP-001', firstName: 'Admin', lastName: 'User', email: 'admin@3boxeshrms.com',
        phone: '+1-212-555-1001', userId: 'user-admin', departmentId: 'dept-hr', designationId: 'des-hr-manager',
        branchId: nyBranch.id, companyId: usaCompany.id, dateOfJoining: new Date('2020-01-15'),
        dateOfBirth: new Date('1985-06-20'), gender: 'male', maritalStatus: 'married', nationality: 'American',
        address: '123 Broadway', city: 'New York', state: 'NY', zipCode: '10001', country: 'US',
        bloodGroup: 'O+', emergencyContactName: 'Jane User', emergencyContactPhone: '+1-212-555-9001',
        bankName: 'Chase Bank', bankAccountNo: 'US0012345678', bankIfscCode: 'CHASUS33',
        panNumber: 'US-PAN-001', aadhaarNumber: null, taxId: 'SSN-001-001',
        salary: 125000, salaryCurrency: 'USD', status: 'active',
      },
      {
        id: 'emp-sarah', employeeId: 'EMP-002', firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.hr@3boxeshrms.com',
        phone: '+1-212-555-1002', userId: 'user-sarah', departmentId: 'dept-hr', designationId: 'des-hr-admin',
        branchId: nyBranch.id, companyId: usaCompany.id, dateOfJoining: new Date('2021-03-01'),
        dateOfBirth: new Date('1990-09-14'), gender: 'female', maritalStatus: 'single', nationality: 'American',
        address: '456 Park Ave', city: 'New York', state: 'NY', zipCode: '10022', country: 'US',
        bloodGroup: 'A+', emergencyContactName: 'Tom Johnson', emergencyContactPhone: '+1-212-555-9002',
        bankName: 'Bank of America', bankAccountNo: 'US0023456789', bankIfscCode: 'BOFAUS3N',
        panNumber: 'US-PAN-002', aadhaarNumber: null, taxId: 'SSN-002-002',
        salary: 95000, salaryCurrency: 'USD', status: 'active',
      },
      {
        id: 'emp-john', employeeId: 'EMP-003', firstName: 'John', lastName: 'Williams', email: 'john.manager@3boxeshrms.com',
        phone: '+1-212-555-1003', userId: 'user-john', departmentId: 'dept-eng', designationId: 'des-vp-eng',
        branchId: nyBranch.id, companyId: usaCompany.id, dateOfJoining: new Date('2019-08-10'),
        dateOfBirth: new Date('1982-11-30'), gender: 'male', maritalStatus: 'married', nationality: 'American',
        address: '789 Lexington Ave', city: 'New York', state: 'NY', zipCode: '10065', country: 'US',
        bloodGroup: 'B+', emergencyContactName: 'Mary Williams', emergencyContactPhone: '+1-212-555-9003',
        bankName: 'Citibank', bankAccountNo: 'US0034567890', bankIfscCode: 'CITIUS33',
        panNumber: 'US-PAN-003', aadhaarNumber: null, taxId: 'SSN-003-003',
        salary: 220000, salaryCurrency: 'USD', status: 'active',
      },
      {
        id: 'emp-alice', employeeId: 'EMP-004', firstName: 'Alice', lastName: 'Chen', email: 'alice.emp@3boxeshrms.com',
        phone: '+1-212-555-1004', userId: 'user-alice', departmentId: 'dept-eng', designationId: 'des-sr-eng',
        branchId: nyBranch.id, companyId: usaCompany.id, dateOfJoining: new Date('2022-02-14'),
        dateOfBirth: new Date('1993-04-22'), gender: 'female', maritalStatus: 'single', nationality: 'American',
        address: '321 Madison Ave', city: 'New York', state: 'NY', zipCode: '10017', country: 'US',
        bloodGroup: 'AB+', emergencyContactName: 'Lisa Chen', emergencyContactPhone: '+1-212-555-9004',
        bankName: 'Wells Fargo', bankAccountNo: 'US0045678901', bankIfscCode: 'WFBIUS6S',
        panNumber: 'US-PAN-004', aadhaarNumber: null, taxId: 'SSN-004-004',
        salary: 150000, salaryCurrency: 'USD', status: 'active',
      },
      {
        id: 'emp-bob', employeeId: 'EMP-005', firstName: 'Bob', lastName: 'Martinez', email: 'bob.dev@3boxeshrms.com',
        phone: '+1-415-555-1005', userId: 'user-bob', departmentId: 'dept-eng', designationId: 'des-eng',
        branchId: sfBranch.id, companyId: usaCompany.id, dateOfJoining: new Date('2023-06-01'),
        dateOfBirth: new Date('1995-12-08'), gender: 'male', maritalStatus: 'single', nationality: 'American',
        address: '555 Market St', city: 'San Francisco', state: 'CA', zipCode: '94105', country: 'US',
        bloodGroup: 'O-', emergencyContactName: 'Rosa Martinez', emergencyContactPhone: '+1-415-555-9005',
        bankName: 'US Bank', bankAccountNo: 'US0056789012', bankIfscCode: 'USBKUS44',
        panNumber: 'US-PAN-005', aadhaarNumber: null, taxId: 'SSN-005-005',
        salary: 110000, salaryCurrency: 'USD', status: 'active',
      },
      {
        id: 'emp-carol', employeeId: 'EMP-006', firstName: 'Carol', lastName: 'Davis', email: 'carol.design@3boxeshrms.com',
        phone: '+1-415-555-1006', userId: 'user-carol', departmentId: 'dept-design', designationId: 'des-sr-designer',
        branchId: sfBranch.id, companyId: usaCompany.id, dateOfJoining: new Date('2022-09-15'),
        dateOfBirth: new Date('1991-07-19'), gender: 'female', maritalStatus: 'married', nationality: 'American',
        address: '888 Folsom St', city: 'San Francisco', state: 'CA', zipCode: '94107', country: 'US',
        bloodGroup: 'A-', emergencyContactName: 'Mark Davis', emergencyContactPhone: '+1-415-555-9006',
        bankName: 'Chase Bank', bankAccountNo: 'US0067890123', bankIfscCode: 'CHASUS33',
        panNumber: 'US-PAN-006', aadhaarNumber: null, taxId: 'SSN-006-006',
        salary: 125000, salaryCurrency: 'USD', status: 'active',
      },
      {
        id: 'emp-david', employeeId: 'EMP-007', firstName: 'David', lastName: 'Kim', email: 'david.sales@3boxeshrms.com',
        phone: '+1-212-555-1007', userId: 'user-david', departmentId: 'dept-sales', designationId: 'des-sales-exec',
        branchId: nyBranch.id, companyId: usaCompany.id, dateOfJoining: new Date('2023-01-10'),
        dateOfBirth: new Date('1992-03-25'), gender: 'male', maritalStatus: 'single', nationality: 'Korean-American',
        address: '200 Wall St', city: 'New York', state: 'NY', zipCode: '10005', country: 'US',
        bloodGroup: 'B-', emergencyContactName: 'Sunhee Kim', emergencyContactPhone: '+1-212-555-9007',
        bankName: 'TD Bank', bankAccountNo: 'US0078901234', bankIfscCode: 'TDOMUS33',
        panNumber: 'US-PAN-007', aadhaarNumber: null, taxId: 'SSN-007-007',
        salary: 85000, salaryCurrency: 'USD', status: 'active',
      },
      {
        id: 'emp-emma', employeeId: 'EMP-008', firstName: 'Emma', lastName: 'Thompson', email: 'emma.finance@3boxeshrms.com',
        phone: '+1-212-555-1008', userId: 'user-emma', departmentId: 'dept-finance', designationId: 'des-finance-analyst',
        branchId: nyBranch.id, companyId: usaCompany.id, dateOfJoining: new Date('2022-05-20'),
        dateOfBirth: new Date('1994-01-12'), gender: 'female', maritalStatus: 'single', nationality: 'British',
        address: '99 Pine St', city: 'New York', state: 'NY', zipCode: '10005', country: 'US',
        bloodGroup: 'O+', emergencyContactName: 'James Thompson', emergencyContactPhone: '+44-20-555-9008',
        bankName: 'HSBC', bankAccountNo: 'US0089012345', bankIfscCode: 'HSBCUS33',
        panNumber: 'US-PAN-008', aadhaarNumber: null, taxId: 'SSN-008-008',
        salary: 95000, salaryCurrency: 'USD', status: 'active',
      },
      {
        id: 'emp-frank', employeeId: 'EMP-009', firstName: 'Frank', lastName: 'Rodriguez', email: 'frank.ops@3boxeshrms.com',
        phone: '+91-80-555-1009', userId: 'user-frank', departmentId: 'dept-ops', designationId: 'des-ops-manager',
        branchId: blrBranch.id, companyId: indiaCompany.id, dateOfJoining: new Date('2021-11-01'),
        dateOfBirth: new Date('1988-08-30'), gender: 'male', maritalStatus: 'married', nationality: 'Indian',
        address: '45 HSR Layout, Sector 2', city: 'Bangalore', state: 'Karnataka', zipCode: '560102', country: 'IN',
        bloodGroup: 'AB-', emergencyContactName: 'Ana Rodriguez', emergencyContactPhone: '+91-80-555-9009',
        bankName: 'HDFC Bank', bankAccountNo: 'IN0090123456', bankIfscCode: 'HDFC0001234',
        panNumber: 'IN-PAN-009', aadhaarNumber: '9876-5432-1009', taxId: 'IN-TAX-009',
        salary: 2800000, salaryCurrency: 'INR', status: 'active',
      },
      {
        id: 'emp-grace', employeeId: 'EMP-010', firstName: 'Grace', lastName: 'Liu', email: 'grace.product@3boxeshrms.com',
        phone: '+1-415-555-1010', userId: 'user-grace', departmentId: 'dept-product', designationId: 'des-pm',
        branchId: sfBranch.id, companyId: usaCompany.id, dateOfJoining: new Date('2022-07-01'),
        dateOfBirth: new Date('1991-10-05'), gender: 'female', maritalStatus: 'single', nationality: 'Chinese-American',
        address: '444 Castro St', city: 'San Francisco', state: 'CA', zipCode: '94114', country: 'US',
        bloodGroup: 'A+', emergencyContactName: 'Wei Liu', emergencyContactPhone: '+1-415-555-9010',
        bankName: 'Chase Bank', bankAccountNo: 'US0101234567', bankIfscCode: 'CHASUS33',
        panNumber: 'US-PAN-010', aadhaarNumber: null, taxId: 'SSN-010-010',
        salary: 135000, salaryCurrency: 'USD', status: 'active',
      },
      {
        id: 'emp-raj', employeeId: 'EMP-011', firstName: 'Raj', lastName: 'Patel', email: 'raj.dev@3boxeshrms.com',
        phone: '+91-80-555-1011', userId: null, departmentId: 'dept-eng', designationId: 'des-jr-eng',
        branchId: blrBranch.id, companyId: indiaCompany.id, dateOfJoining: new Date('2024-01-15'),
        dateOfBirth: new Date('1998-02-14'), gender: 'male', maritalStatus: 'single', nationality: 'Indian',
        address: '22 Indiranagar, 2nd Stage', city: 'Bangalore', state: 'Karnataka', zipCode: '560038', country: 'IN',
        bloodGroup: 'B+', emergencyContactName: 'Arun Patel', emergencyContactPhone: '+91-80-555-9011',
        bankName: 'ICICI Bank', bankAccountNo: 'IN0112345678', bankIfscCode: 'ICIC0001234',
        panNumber: 'IN-PAN-011', aadhaarNumber: '8765-4321-1011', taxId: 'IN-TAX-011',
        salary: 1200000, salaryCurrency: 'INR', status: 'active',
      },
      {
        id: 'emp-priya', employeeId: 'EMP-012', firstName: 'Priya', lastName: 'Sharma', email: 'priya.hr@3boxeshrms.com',
        phone: '+91-22-555-1012', userId: null, departmentId: 'dept-hr', designationId: 'des-hr-admin',
        branchId: mumbaiBranch.id, companyId: indiaCompany.id, dateOfJoining: new Date('2023-04-01'),
        dateOfBirth: new Date('1996-06-18'), gender: 'female', maritalStatus: 'single', nationality: 'Indian',
        address: '15 Juhu Tara Road', city: 'Mumbai', state: 'Maharashtra', zipCode: '400049', country: 'IN',
        bloodGroup: 'O+', emergencyContactName: 'Vikram Sharma', emergencyContactPhone: '+91-22-555-9012',
        bankName: 'SBI', bankAccountNo: 'IN0123456789', bankIfscCode: 'SBIN0001234',
        panNumber: 'IN-PAN-012', aadhaarNumber: '7654-3210-1012', taxId: 'IN-TAX-012',
        salary: 1500000, salaryCurrency: 'INR', status: 'active',
      },
      {
        id: 'emp-james', employeeId: 'EMP-013', firstName: 'James', lastName: 'Wilson', email: 'james.sales@3boxeshrms.com',
        phone: '+44-20-555-1013', userId: null, departmentId: 'dept-sales', designationId: 'des-sales-exec',
        branchId: londonBranch.id, companyId: ukCompany.id, dateOfJoining: new Date('2022-10-01'),
        dateOfBirth: new Date('1989-05-22'), gender: 'male', maritalStatus: 'married', nationality: 'British',
        address: '10 Downing Street', city: 'London', state: 'England', zipCode: 'SW1A 2AA', country: 'GB',
        bloodGroup: 'A-', emergencyContactName: 'Catherine Wilson', emergencyContactPhone: '+44-20-555-9013',
        bankName: 'Barclays', bankAccountNo: 'GB0134567890', bankIfscCode: 'BARCGB22',
        panNumber: null, aadhaarNumber: null, taxId: 'GB-TAX-013',
        salary: 72000, salaryCurrency: 'GBP', status: 'active',
      },
      {
        id: 'emp-mike', employeeId: 'EMP-014', firstName: 'Mike', lastName: 'Brown', email: 'mike.eng@3boxeshrms.com',
        phone: '+1-212-555-1014', userId: null, departmentId: 'dept-eng', designationId: 'des-sr-eng',
        branchId: nyBranch.id, companyId: usaCompany.id, dateOfJoining: new Date('2021-06-15'),
        dateOfBirth: new Date('1990-09-03'), gender: 'male', maritalStatus: 'married', nationality: 'American',
        address: '500 5th Ave', city: 'New York', state: 'NY', zipCode: '10110', country: 'US',
        bloodGroup: 'O+', emergencyContactName: 'Sandra Brown', emergencyContactPhone: '+1-212-555-9014',
        bankName: 'Chase Bank', bankAccountNo: 'US0145678901', bankIfscCode: 'CHASUS33',
        panNumber: 'US-PAN-014', aadhaarNumber: null, taxId: 'SSN-014-014',
        salary: 145000, salaryCurrency: 'USD', status: 'active',
      },
      {
        id: 'emp-lisa', employeeId: 'EMP-015', firstName: 'Lisa', lastName: 'Anderson', email: 'lisa.marketing@3boxeshrms.com',
        phone: '+1-415-555-1015', userId: null, departmentId: 'dept-marketing', designationId: 'des-marketing-mgr',
        branchId: sfBranch.id, companyId: usaCompany.id, dateOfJoining: new Date('2023-02-01'),
        dateOfBirth: new Date('1992-12-11'), gender: 'female', maritalStatus: 'single', nationality: 'American',
        address: '777 Mission St', city: 'San Francisco', state: 'CA', zipCode: '94103', country: 'US',
        bloodGroup: 'AB+', emergencyContactName: 'Robert Anderson', emergencyContactPhone: '+1-415-555-9015',
        bankName: 'Wells Fargo', bankAccountNo: 'US0156789012', bankIfscCode: 'WFBIUS6S',
        panNumber: 'US-PAN-015', aadhaarNumber: null, taxId: 'SSN-015-015',
        salary: 115000, salaryCurrency: 'USD', status: 'active',
      },
    ];

    for (const emp of employees) {
      await db.employee.upsert({
        where: { id: emp.id },
        update: {},
        create: emp,
      });
    }

    // ============ LEAVE TYPES ============
    const leaveTypes = [
      { id: 'lt-casual', name: 'Casual Leave', code: 'CL', description: 'Casual leave for personal matters', defaultDays: 12, isPaid: true, carryForward: true, maxCarryForward: 3 },
      { id: 'lt-sick', name: 'Sick Leave', code: 'SL', description: 'Leave for illness and medical appointments', defaultDays: 10, isPaid: true, carryForward: false, maxCarryForward: 0 },
      { id: 'lt-earned', name: 'Earned Leave', code: 'EL', description: 'Earned/privileged leave', defaultDays: 15, isPaid: true, carryForward: true, maxCarryForward: 5 },
      { id: 'lt-maternity', name: 'Maternity Leave', code: 'ML', description: 'Maternity leave for expecting mothers', defaultDays: 180, isPaid: true, carryForward: false, maxCarryForward: 0 },
      { id: 'lt-paternity', name: 'Paternity Leave', code: 'PL', description: 'Paternity leave for new fathers', defaultDays: 15, isPaid: true, carryForward: false, maxCarryForward: 0 },
    ];

    for (const lt of leaveTypes) {
      await db.leaveType.upsert({
        where: { id: lt.id },
        update: {},
        create: lt,
      });
    }

    // ============ LEAVE BALANCES ============
    for (const emp of employees) {
      for (const lt of leaveTypes) {
        await db.leaveBalance.upsert({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: emp.id,
              leaveTypeId: lt.id,
              year: currentYear,
            },
          },
          update: {},
          create: {
            employeeId: emp.id,
            leaveTypeId: lt.id,
            year: currentYear,
            total: lt.defaultDays,
            used: Math.floor(Math.random() * (lt.defaultDays / 2)),
            remaining: lt.defaultDays,
            carryForward: 0,
          },
        });
      }
    }

    // Update remaining based on used
    const allBalances = await db.leaveBalance.findMany();
    for (const bal of allBalances) {
      await db.leaveBalance.update({
        where: { id: bal.id },
        data: { remaining: bal.total - bal.used },
      });
    }

    // ============ LEAVE REQUESTS ============
    const leaveRequests = [
      { employeeId: 'emp-alice', leaveTypeId: 'lt-casual', startDate: new Date('2025-03-10'), endDate: new Date('2025-03-12'), reason: 'Family function', status: 'approved', approvedBy: 'user-sarah', approvedAt: new Date('2025-03-08') },
      { employeeId: 'emp-bob', leaveTypeId: 'lt-sick', startDate: new Date('2025-03-15'), endDate: new Date('2025-03-16'), reason: 'Not feeling well', status: 'approved', approvedBy: 'user-john', approvedAt: new Date('2025-03-14') },
      { employeeId: 'emp-david', leaveTypeId: 'lt-earned', startDate: new Date('2025-04-01'), endDate: new Date('2025-04-05'), reason: 'Vacation', status: 'pending' },
      { employeeId: 'emp-carol', leaveTypeId: 'lt-casual', startDate: new Date('2025-03-20'), endDate: new Date('2025-03-21'), reason: 'Personal work', status: 'rejected', approvedBy: 'user-sarah', approvedAt: new Date('2025-03-19'), comments: 'Critical project deadline' },
      { employeeId: 'emp-emma', leaveTypeId: 'lt-sick', startDate: new Date('2025-03-25'), endDate: new Date('2025-03-26'), reason: 'Doctor appointment', status: 'pending' },
      { employeeId: 'emp-frank', leaveTypeId: 'lt-earned', startDate: new Date('2025-04-10'), endDate: new Date('2025-04-14'), reason: 'Home renovation', status: 'pending' },
      { employeeId: 'emp-grace', leaveTypeId: 'lt-casual', startDate: new Date('2025-03-05'), endDate: new Date('2025-03-07'), reason: 'Moving to new apartment', status: 'approved', approvedBy: 'user-sarah', approvedAt: new Date('2025-03-03') },
      { employeeId: 'emp-mike', leaveTypeId: 'lt-sick', startDate: new Date('2025-02-28'), endDate: new Date('2025-03-01'), reason: 'Flu', status: 'approved', approvedBy: 'user-john', approvedAt: new Date('2025-02-28') },
      { employeeId: 'emp-lisa', leaveTypeId: 'lt-earned', startDate: new Date('2025-05-01'), endDate: new Date('2025-05-10'), reason: 'International trip', status: 'pending' },
      { employeeId: 'emp-raj', leaveTypeId: 'lt-casual', startDate: new Date('2025-03-18'), endDate: new Date('2025-03-19'), reason: 'Friend wedding', status: 'approved', approvedBy: 'user-frank', approvedAt: new Date('2025-03-16') },
      { employeeId: 'emp-james', leaveTypeId: 'lt-earned', startDate: new Date('2025-04-15'), endDate: new Date('2025-04-18'), reason: 'Long weekend trip', status: 'pending' },
      { employeeId: 'emp-priya', leaveTypeId: 'lt-sick', startDate: new Date('2025-03-22'), endDate: new Date('2025-03-23'), reason: 'Migraine', status: 'approved', approvedBy: 'user-sarah', approvedAt: new Date('2025-03-22') },
    ];

    for (let i = 0; i < leaveRequests.length; i++) {
      const lr = leaveRequests[i];
      await db.leaveRequest.upsert({
        where: { id: `lr-${i + 1}` },
        update: {},
        create: { id: `lr-${i + 1}`, ...lr, halfDay: false },
      });
    }

    // ============ ATTENDANCE ============
    const attendanceDates: Date[] = [];
    for (let d = 1; d <= 28; d++) {
      const date = new Date(currentYear, currentMonth - 1, d);
      if (date.getDay() !== 0 && date.getDay() !== 6 && date <= now) {
        attendanceDates.push(date);
      }
    }

    const attendanceEmpIds = ['emp-admin', 'emp-sarah', 'emp-john', 'emp-alice', 'emp-bob', 'emp-carol'];
    let attendanceCount = 0;

    for (const empId of attendanceEmpIds) {
      for (const date of attendanceDates) {
        const isLate = Math.random() < 0.15;
        const checkInHour = isLate ? 9 + Math.floor(Math.random() * 2) + 1 : 9;
        const checkInMin = isLate ? Math.floor(Math.random() * 30) + 15 : Math.floor(Math.random() * 15);
        const checkOutHour = 17 + Math.floor(Math.random() * 2);
        const checkOutMin = Math.floor(Math.random() * 30);

        attendanceCount++;
        await db.attendance.upsert({
          where: {
            employeeId_date: {
              employeeId: empId,
              date,
            },
          },
          update: {},
          create: {
            employeeId: empId,
            date,
            checkIn: new Date(date.getFullYear(), date.getMonth(), date.getDate(), checkInHour, checkInMin),
            checkOut: new Date(date.getFullYear(), date.getMonth(), date.getDate(), checkOutHour, checkOutMin),
            status: isLate ? 'late' : 'present',
            workHours: 8 + Math.random() * 2,
            overtime: Math.random() > 0.7 ? Math.random() * 2 : 0,
          },
        });
      }
    }

    // ============ PAYROLL ============
    for (const emp of employees.slice(0, 10)) {
      const basicSalary = emp.salary || 0;
      const hra = basicSalary * 0.4;
      const da = basicSalary * 0.1;
      const conveyance = 1600;
      const medical = 1250;
      const otherAllowances = basicSalary * 0.05;
      const grossSalary = basicSalary + hra + da + conveyance + medical + otherAllowances;
      const pf = basicSalary * 0.12;
      const esi = 0;
      const tax = basicSalary > 100000 ? basicSalary * 0.15 : 0;
      const professionalTax = 200;
      const otherDeductions = 0;
      const totalDeductions = pf + esi + tax + professionalTax + otherDeductions;
      const netSalary = grossSalary - totalDeductions;

      await db.payroll.upsert({
        where: {
          employeeId_month_year: {
            employeeId: emp.id,
            month: currentMonth,
            year: currentYear,
          },
        },
        update: {},
        create: {
          employeeId: emp.id,
          month: currentMonth,
          year: currentYear,
          basicSalary,
          hra,
          da,
          conveyance,
          medical,
          otherAllowances,
          grossSalary,
          pf,
          esi,
          tax,
          professionalTax,
          otherDeductions,
          totalDeductions,
          netSalary,
          currency: emp.salaryCurrency || 'USD',
          status: 'draft',
        },
      });
    }

    // ============ JOB POSTINGS ============
    const jobPostings = [
      { id: 'jp-1', title: 'Senior Full-Stack Developer', departmentId: 'dept-eng', position: 'Senior Full-Stack Developer', location: 'New York, NY', type: 'full-time', experience: '5+ years', salary: '$130,000 - $180,000', description: 'We are looking for an experienced Full-Stack Developer to join our engineering team.', requirements: 'React, Node.js, TypeScript, PostgreSQL, AWS', vacancies: 2, closingDate: new Date('2025-05-01') },
      { id: 'jp-2', title: 'Product Designer', departmentId: 'dept-design', position: 'Product Designer', location: 'San Francisco, CA', type: 'full-time', experience: '3+ years', salary: '$100,000 - $140,000', description: 'Join our design team to create intuitive and beautiful product experiences.', requirements: 'Figma, Design Systems, User Research, Prototyping', vacancies: 1, closingDate: new Date('2025-04-15') },
      { id: 'jp-3', title: 'Sales Development Representative', departmentId: 'dept-sales', position: 'Sales Development Representative', location: 'New York, NY', type: 'full-time', experience: '1-2 years', salary: '$60,000 - $80,000 + Commission', description: 'Drive outbound sales activities and generate qualified leads.', requirements: 'CRM, Cold Calling, Lead Generation', vacancies: 3, closingDate: new Date('2025-04-30') },
      { id: 'jp-4', title: 'Data Engineer', departmentId: 'dept-eng', position: 'Data Engineer', location: 'Bangalore, India', type: 'full-time', experience: '3+ years', salary: '₹15,00,000 - ₹25,00,000', description: 'Build and maintain data pipelines and infrastructure.', requirements: 'Python, SQL, Spark, Airflow, AWS/GCP', vacancies: 1, closingDate: new Date('2025-05-15') },
      { id: 'jp-5', title: 'Marketing Intern', departmentId: 'dept-marketing', position: 'Marketing Intern', location: 'San Francisco, CA', type: 'internship', experience: '0-1 year', salary: '$25/hour', description: 'Learn digital marketing in a fast-paced SaaS environment.', requirements: 'Social Media, Content Writing, Basic Analytics', vacancies: 2, closingDate: new Date('2025-04-01') },
    ];

    for (const jp of jobPostings) {
      await db.jobPosting.upsert({
        where: { id: jp.id },
        update: {},
        create: {
          ...jp,
          status: 'open',
          postedDate: new Date(),
        },
      });
    }

    // ============ JOB APPLICATIONS ============
    const applications = [
      { id: 'ja-1', jobPostingId: 'jp-1', candidateName: 'Alex Turner', candidateEmail: 'alex@example.com', candidatePhone: '+1-555-2001', source: 'linkedin', status: 'interview', rating: 4, expectedSalary: '$150,000' },
      { id: 'ja-2', jobPostingId: 'jp-1', candidateName: 'Maria Garcia', candidateEmail: 'maria@example.com', candidatePhone: '+1-555-2002', source: 'referral', status: 'screening', rating: 3, expectedSalary: '$140,000' },
      { id: 'ja-3', jobPostingId: 'jp-2', candidateName: 'Tom Hardy', candidateEmail: 'tom@example.com', candidatePhone: '+1-555-2003', source: 'website', status: 'applied', expectedSalary: '$120,000' },
      { id: 'ja-4', jobPostingId: 'jp-2', candidateName: 'Nina Patel', candidateEmail: 'nina@example.com', candidatePhone: '+1-555-2004', source: 'indeed', status: 'offered', rating: 5, expectedSalary: '$130,000' },
      { id: 'ja-5', jobPostingId: 'jp-3', candidateName: 'Chris Evans', candidateEmail: 'chris@example.com', candidatePhone: '+1-555-2005', source: 'linkedin', status: 'rejected', rating: 2, expectedSalary: '$75,000' },
      { id: 'ja-6', jobPostingId: 'jp-3', candidateName: 'Sophie Brown', candidateEmail: 'sophie@example.com', candidatePhone: '+1-555-2006', source: 'website', status: 'applied', expectedSalary: '$65,000' },
      { id: 'ja-7', jobPostingId: 'jp-4', candidateName: 'Arun Kumar', candidateEmail: 'arun@example.com', candidatePhone: '+91-555-2007', source: 'referral', status: 'interview', rating: 4, expectedSalary: '₹20,00,000' },
      { id: 'ja-8', jobPostingId: 'jp-1', candidateName: 'Jennifer Lee', candidateEmail: 'jennifer@example.com', candidatePhone: '+1-555-2008', source: 'website', status: 'hired', rating: 5, expectedSalary: '$155,000' },
      { id: 'ja-9', jobPostingId: 'jp-5', candidateName: 'Ryan Park', candidateEmail: 'ryan@example.com', candidatePhone: '+1-555-2009', source: 'linkedin', status: 'applied', expectedSalary: '$25/hour' },
      { id: 'ja-10', jobPostingId: 'jp-4', candidateName: 'Deepa Nair', candidateEmail: 'deepa@example.com', candidatePhone: '+91-555-2010', source: 'indeed', status: 'screening', rating: 3, expectedSalary: '₹18,00,000' },
    ];

    for (const ja of applications) {
      await db.jobApplication.upsert({
        where: { id: ja.id },
        update: {},
        create: {
          ...ja,
          appliedDate: new Date(),
        },
      });
    }

    // ============ INTERVIEWS (with AI scores and feedback) ============
    const interviews = [
      { id: 'iv-1', jobApplicationId: 'ja-1', type: 'technical', date: new Date('2025-03-20'), time: '10:00 AM', duration: 60, location: 'Conference Room A', interviewer: 'user-manager', status: 'completed', feedback: 'Strong technical skills demonstrated. Good problem-solving approach.', score: 88, aiScore: 92, aiFeedback: 'Candidate demonstrated exceptional proficiency in React, Node.js, and TypeScript. Problem-solving approach was systematic and efficient. Communication skills rated 9/10. Key strengths: system design, algorithmic thinking, clean code practices.' },
      { id: 'iv-2', jobApplicationId: 'ja-1', type: 'hr', date: new Date('2025-03-21'), time: '3:00 PM', duration: 45, location: 'HR Office', interviewer: 'user-hr', status: 'completed', feedback: 'Good culture fit. Strong alignment with company values.', score: 85, aiScore: 89, aiFeedback: 'Candidate shows strong cultural alignment with organizational values. Leadership potential identified. Response consistency score: 94%. Behavioral indicators suggest high adaptability and team collaboration skills.' },
      { id: 'iv-3', jobApplicationId: 'ja-4', type: 'final', date: new Date('2025-03-18'), time: '2:00 PM', duration: 45, location: 'Video Call', interviewer: 'user-recruiter', status: 'completed', feedback: 'Excellent design sense and communication skills', score: 9, aiScore: 95, aiFeedback: 'Candidate demonstrated expert-level design thinking. Portfolio review score: 97%. Figma proficiency: outstanding. User research methodology: comprehensive. Strongly recommended for hire.' },
      { id: 'iv-4', jobApplicationId: 'ja-7', type: 'technical', date: new Date('2025-03-22'), time: '11:00 AM', duration: 60, meetingUrl: 'https://meet.3boxeshrms.com/interview-arun', interviewer: 'user-recruiter', status: 'scheduled' },
      { id: 'iv-5', jobApplicationId: 'ja-8', type: 'managerial', date: new Date('2025-03-15'), time: '1:00 PM', duration: 45, location: 'Executive Suite', interviewer: 'user-manager', status: 'completed', feedback: 'Strong technical and leadership abilities', score: 90, aiScore: 93, aiFeedback: 'Final assessment confirms strong fit. Leadership assessment: excellent. Cultural fit: 95%. Communication: outstanding. Salary expectation alignment: within range. Proceed to offer stage.' },
      { id: 'iv-6', jobApplicationId: 'ja-8', type: 'technical', date: new Date('2025-03-12'), time: '10:00 AM', duration: 60, location: 'Video Call', interviewer: 'user-recruiter', status: 'completed', feedback: 'Excellent full-stack knowledge and system design capabilities', score: 91, aiScore: 94, aiFeedback: 'Candidate demonstrated advanced proficiency across the full technology stack. System design score: 96%. Algorithm problem-solving: 92%. Code quality assessment: excellent. Recommended for managerial round.' },
      { id: 'iv-7', jobApplicationId: 'ja-2', type: 'technical', date: new Date('2025-03-25'), time: '9:00 AM', duration: 60, meetingUrl: 'https://meet.3boxeshrms.com/interview-maria', interviewer: 'user-recruiter', status: 'scheduled' },
      { id: 'iv-8', jobApplicationId: 'ja-10', type: 'technical', date: new Date('2025-03-28'), time: '11:00 AM', duration: 60, meetingUrl: 'https://meet.3boxeshrms.com/interview-deepa', interviewer: 'user-recruiter', status: 'scheduled' },
    ];

    for (const iv of interviews) {
      await db.interview.upsert({
        where: { id: iv.id },
        update: {},
        create: iv,
      });
    }

    // ============ ONBOARDING TASKS ============
    const onboardingTasks = [
      { id: 'ot-1', employeeId: 'emp-raj', task: 'Complete IT setup and laptop configuration', category: 'it_setup', status: 'completed', completedDate: new Date('2024-01-16'), assignedBy: 'user-frank' },
      { id: 'ot-2', employeeId: 'emp-raj', task: 'Submit identity documents', category: 'hr_docs', status: 'completed', completedDate: new Date('2024-01-17'), assignedBy: 'user-sarah' },
      { id: 'ot-3', employeeId: 'emp-raj', task: 'Complete orientation training', category: 'training', status: 'in_progress', dueDate: new Date('2024-02-15'), assignedBy: 'user-sarah' },
      { id: 'ot-4', employeeId: 'emp-raj', task: 'Meet team members', category: 'introduction', status: 'pending', dueDate: new Date('2024-01-20'), assignedBy: 'user-john' },
      { id: 'ot-5', employeeId: 'emp-priya', task: 'Complete IT setup', category: 'it_setup', status: 'completed', completedDate: new Date('2023-04-02'), assignedBy: 'user-frank' },
      { id: 'ot-6', employeeId: 'emp-priya', task: 'Submit bank details', category: 'hr_docs', status: 'completed', completedDate: new Date('2023-04-03'), assignedBy: 'user-sarah' },
      { id: 'ot-7', employeeId: 'emp-priya', task: 'Review company policies', category: 'general', status: 'in_progress', assignedBy: 'user-sarah' },
      { id: 'ot-8', employeeId: 'emp-james', task: 'Complete IT setup and security training', category: 'it_setup', status: 'completed', completedDate: new Date('2022-10-03'), assignedBy: 'user-admin' },
      { id: 'ot-9', employeeId: 'emp-james', task: 'Review UK compliance documents', category: 'hr_docs', status: 'pending', assignedBy: 'user-sarah' },
      { id: 'ot-10', employeeId: 'emp-lisa', task: 'Complete marketing tool onboarding', category: 'training', status: 'in_progress', dueDate: new Date('2023-03-01'), assignedBy: 'user-sarah' },
    ];

    for (const ot of onboardingTasks) {
      await db.onboardingTask.upsert({
        where: { id: ot.id },
        update: {},
        create: ot,
      });
    }

    // ============ PERFORMANCE REVIEWS ============
    const reviews = [
      { id: 'pr-1', employeeId: 'emp-alice', reviewCycle: 'Q1 2025', reviewPeriod: 'Jan-Mar 2025', reviewerId: 'emp-john', rating: 4.2, goalsRating: 4.0, skillsRating: 4.5, behaviorRating: 4.0, overallRating: 4.2, comments: 'Alice has been an exceptional contributor this quarter', strengths: 'Technical skills, problem-solving, team collaboration', improvements: 'Could improve on documentation and knowledge sharing', status: 'completed', reviewDate: new Date('2025-03-25') },
      { id: 'pr-2', employeeId: 'emp-bob', reviewCycle: 'Q1 2025', reviewPeriod: 'Jan-Mar 2025', reviewerId: 'emp-john', rating: 3.8, goalsRating: 3.5, skillsRating: 4.0, behaviorRating: 3.8, overallRating: 3.8, comments: 'Bob shows great potential and is improving steadily', strengths: 'Quick learner, enthusiastic, good coding practices', improvements: 'Time management, attention to detail in code reviews', status: 'completed', reviewDate: new Date('2025-03-26') },
      { id: 'pr-3', employeeId: 'emp-carol', reviewCycle: 'Q1 2025', reviewPeriod: 'Jan-Mar 2025', reviewerId: 'emp-grace', rating: 4.5, goalsRating: 4.5, skillsRating: 4.8, behaviorRating: 4.2, overallRating: 4.5, comments: 'Carol is a design leader who elevates the whole team', strengths: 'Design thinking, user empathy, mentorship', improvements: 'Could be more assertive in design discussions', status: 'completed', reviewDate: new Date('2025-03-24') },
      { id: 'pr-4', employeeId: 'emp-david', reviewCycle: 'Q1 2025', reviewPeriod: 'Jan-Mar 2025', reviewerId: 'emp-admin', rating: 3.5, goalsRating: 3.2, skillsRating: 3.5, behaviorRating: 3.8, overallRating: 3.5, comments: 'David is meeting expectations but has room for growth', strengths: 'Customer relationship, product knowledge', improvements: 'Closing deals, pipeline management, follow-ups', status: 'in_progress' },
      { id: 'pr-5', employeeId: 'emp-grace', reviewCycle: 'Q1 2025', reviewPeriod: 'Jan-Mar 2025', reviewerId: 'emp-admin', rating: 4.3, goalsRating: 4.5, skillsRating: 4.0, behaviorRating: 4.5, overallRating: 4.3, comments: 'Grace has excellent product vision and stakeholder management', strengths: 'Product strategy, stakeholder management, data-driven decisions', improvements: 'Technical depth, faster decision making', status: 'pending' },
    ];

    for (const rev of reviews) {
      await db.performanceReview.upsert({
        where: { id: rev.id },
        update: {},
        create: rev,
      });
    }

    // ============ GOALS ============
    const goals = [
      { id: 'goal-1', employeeId: 'emp-alice', title: 'Lead API Redesign Project', description: 'Redesign the core API architecture for better performance', category: 'performance', priority: 'high', status: 'in_progress', progress: 65, startDate: new Date('2025-01-01'), endDate: new Date('2025-06-30') },
      { id: 'goal-2', employeeId: 'emp-alice', title: 'AWS Solutions Architect Certification', description: 'Obtain AWS SA Professional certification', category: 'development', priority: 'medium', status: 'not_started', progress: 0, startDate: new Date('2025-04-01'), endDate: new Date('2025-09-30') },
      { id: 'goal-3', employeeId: 'emp-bob', title: 'Complete React Advanced Patterns Training', description: 'Master advanced React patterns and best practices', category: 'development', priority: 'high', status: 'in_progress', progress: 40, startDate: new Date('2025-02-01'), endDate: new Date('2025-05-31') },
      { id: 'goal-4', employeeId: 'emp-bob', title: 'Reduce Bug Count by 30%', description: 'Improve code quality and reduce production bugs', category: 'performance', priority: 'high', status: 'in_progress', progress: 55, startDate: new Date('2025-01-01'), endDate: new Date('2025-03-31') },
      { id: 'goal-5', employeeId: 'emp-carol', title: 'Design System v2.0', description: 'Build and launch the next version of our design system', category: 'performance', priority: 'high', status: 'in_progress', progress: 80, startDate: new Date('2025-01-15'), endDate: new Date('2025-04-30') },
      { id: 'goal-6', employeeId: 'emp-david', title: 'Achieve 120% Sales Quota', description: 'Exceed quarterly sales target by 20%', category: 'performance', priority: 'high', status: 'in_progress', progress: 45, startDate: new Date('2025-01-01'), endDate: new Date('2025-03-31') },
      { id: 'goal-7', employeeId: 'emp-grace', title: 'Launch Product X Beta', description: 'Successfully launch Product X in beta', category: 'performance', priority: 'high', status: 'in_progress', progress: 70, startDate: new Date('2025-01-01'), endDate: new Date('2025-06-30') },
      { id: 'goal-8', employeeId: 'emp-emma', title: 'Automate Monthly Reports', description: 'Build automated financial reporting pipeline', category: 'performance', priority: 'medium', status: 'completed', progress: 100, startDate: new Date('2025-01-01'), endDate: new Date('2025-02-28'), completedDate: new Date('2025-02-25') },
      { id: 'goal-9', employeeId: 'emp-frank', title: 'Reduce Infrastructure Costs by 15%', description: 'Optimize cloud infrastructure and reduce costs', category: 'performance', priority: 'high', status: 'in_progress', progress: 50, startDate: new Date('2025-01-01'), endDate: new Date('2025-06-30') },
      { id: 'goal-10', employeeId: 'emp-sarah', title: 'Implement Employee Wellness Program', description: 'Design and roll out comprehensive wellness program', category: 'performance', priority: 'medium', status: 'in_progress', progress: 35, startDate: new Date('2025-02-01'), endDate: new Date('2025-07-31') },
    ];

    for (const goal of goals) {
      await db.goal.upsert({
        where: { id: goal.id },
        update: {},
        create: goal,
      });
    }

    // ============ TRAININGS ============
    const trainings = [
      { id: 'tr-1', title: 'Advanced React Patterns', description: 'Deep dive into advanced React patterns including hooks, context, and performance optimization', category: 'technical', trainer: 'External - Dan Abramov', startDate: new Date('2025-03-15'), endDate: new Date('2025-03-20'), location: 'Conference Room A', mode: 'online', maxParticipants: 20, cost: 5000, status: 'ongoing' },
      { id: 'tr-2', title: 'Leadership & Management Essentials', description: 'Core leadership skills for new and aspiring managers', category: 'leadership', trainer: 'Sarah Johnson', startDate: new Date('2025-04-01'), endDate: new Date('2025-04-03'), location: 'Training Center', mode: 'offline', maxParticipants: 15, cost: 3000, status: 'upcoming' },
      { id: 'tr-3', title: 'Cloud Security Fundamentals', description: 'AWS and cloud security best practices', category: 'security', trainer: 'External - AWS Training', startDate: new Date('2025-04-15'), endDate: new Date('2025-04-17'), mode: 'online', maxParticipants: 30, cost: 7500, status: 'upcoming' },
      { id: 'tr-4', title: 'Design Thinking Workshop', description: 'Hands-on design thinking methodology workshop', category: 'design', trainer: 'Carol Davis', startDate: new Date('2025-02-10'), endDate: new Date('2025-02-11'), location: 'Creative Lab', mode: 'offline', maxParticipants: 12, cost: 1500, status: 'completed' },
      { id: 'tr-5', title: 'Effective Communication Skills', description: 'Improve workplace communication and presentation skills', category: 'soft_skills', trainer: 'External - Dale Carnegie', startDate: new Date('2025-05-01'), endDate: new Date('2025-05-02'), mode: 'hybrid', maxParticipants: 25, cost: 4000, status: 'upcoming' },
    ];

    for (const tr of trainings) {
      await db.training.upsert({
        where: { id: tr.id },
        update: {},
        create: tr,
      });
    }

    // ============ TRAINING ENROLLMENTS ============
    const enrollments = [
      { id: 'te-1', trainingId: 'tr-1', employeeId: 'emp-bob', status: 'enrolled' },
      { id: 'te-2', trainingId: 'tr-1', employeeId: 'emp-alice', status: 'enrolled' },
      { id: 'te-3', trainingId: 'tr-1', employeeId: 'emp-raj', status: 'enrolled' },
      { id: 'te-4', trainingId: 'tr-2', employeeId: 'emp-john', status: 'enrolled' },
      { id: 'te-5', trainingId: 'tr-2', employeeId: 'emp-sarah', status: 'enrolled' },
      { id: 'te-6', trainingId: 'tr-3', employeeId: 'emp-frank', status: 'enrolled' },
      { id: 'te-7', trainingId: 'tr-3', employeeId: 'emp-mike', status: 'enrolled' },
      { id: 'te-8', trainingId: 'tr-4', employeeId: 'emp-carol', status: 'completed', score: 92, completedDate: new Date('2025-02-11') },
      { id: 'te-9', trainingId: 'tr-4', employeeId: 'emp-lisa', status: 'completed', score: 88, completedDate: new Date('2025-02-11') },
      { id: 'te-10', trainingId: 'tr-5', employeeId: 'emp-david', status: 'enrolled' },
      { id: 'te-11', trainingId: 'tr-5', employeeId: 'emp-emma', status: 'enrolled' },
    ];

    for (const te of enrollments) {
      await db.trainingEnrollment.upsert({
        where: { id: te.id },
        update: {},
        create: te,
      });
    }

    // ============ ASSETS ============
    const assets = [
      { id: 'as-1', name: 'MacBook Pro 16"', assetTag: 'AST-LP-001', category: 'laptop', brand: 'Apple', model: 'MacBook Pro 16" M3 Max', serialNumber: 'APL-MBP-001', purchaseDate: new Date('2024-01-15'), purchaseCost: 3499, condition: 'good' },
      { id: 'as-2', name: 'MacBook Pro 14"', assetTag: 'AST-LP-002', category: 'laptop', brand: 'Apple', model: 'MacBook Pro 14" M3 Pro', serialNumber: 'APL-MBP-002', purchaseDate: new Date('2024-02-01'), purchaseCost: 2499, condition: 'good' },
      { id: 'as-3', name: 'Dell XPS 15', assetTag: 'AST-LP-003', category: 'laptop', brand: 'Dell', model: 'XPS 15 9530', serialNumber: 'DLL-XPS-003', purchaseDate: new Date('2024-01-20'), purchaseCost: 1899, condition: 'good' },
      { id: 'as-4', name: 'iPhone 15 Pro', assetTag: 'AST-PH-001', category: 'phone', brand: 'Apple', model: 'iPhone 15 Pro', serialNumber: 'APL-IPH-001', purchaseDate: new Date('2024-03-01'), purchaseCost: 1199, condition: 'new' },
      { id: 'as-5', name: 'iPhone 15', assetTag: 'AST-PH-002', category: 'phone', brand: 'Apple', model: 'iPhone 15', serialNumber: 'APL-IPH-002', purchaseDate: new Date('2024-03-01'), purchaseCost: 899, condition: 'good' },
      { id: 'as-6', name: 'Dell UltraSharp Monitor', assetTag: 'AST-MN-001', category: 'monitor', brand: 'Dell', model: 'U2723QE', serialNumber: 'DLL-MON-001', purchaseDate: new Date('2023-11-15'), purchaseCost: 619, condition: 'good' },
      { id: 'as-7', name: 'LG UltraWide Monitor', assetTag: 'AST-MN-002', category: 'monitor', brand: 'LG', model: '34WN80C-B', serialNumber: 'LG-MON-002', purchaseDate: new Date('2023-10-01'), purchaseCost: 499, condition: 'fair' },
      { id: 'as-8', name: 'iPad Pro 12.9"', assetTag: 'AST-TB-001', category: 'tablet', brand: 'Apple', model: 'iPad Pro 12.9" M2', serialNumber: 'APL-IPD-001', purchaseDate: new Date('2024-01-10'), purchaseCost: 1299, condition: 'new' },
      { id: 'as-9', name: 'ThinkPad X1 Carbon', assetTag: 'AST-LP-004', category: 'laptop', brand: 'Lenovo', model: 'ThinkPad X1 Carbon Gen 11', serialNumber: 'LNV-TP-004', purchaseDate: new Date('2024-02-15'), purchaseCost: 1699, condition: 'good' },
      { id: 'as-10', name: 'Samsung Galaxy Tab S9', assetTag: 'AST-TB-002', category: 'tablet', brand: 'Samsung', model: 'Galaxy Tab S9', serialNumber: 'SMG-TAB-002', purchaseDate: new Date('2024-01-25'), purchaseCost: 999, condition: 'good' },
    ];

    for (const as of assets) {
      await db.asset.upsert({
        where: { id: as.id },
        update: {},
        create: { ...as, status: 'available' },
      });
    }

    // ============ ASSET ASSIGNMENTS ============
    const assetAssignments = [
      { id: 'aa-1', assetId: 'as-1', employeeId: 'emp-john', assignedDate: new Date('2024-01-16'), condition: 'good', status: 'assigned' },
      { id: 'aa-2', assetId: 'as-2', employeeId: 'emp-alice', assignedDate: new Date('2024-02-02'), condition: 'good', status: 'assigned' },
      { id: 'aa-3', assetId: 'as-3', employeeId: 'emp-bob', assignedDate: new Date('2024-01-21'), condition: 'good', status: 'assigned' },
      { id: 'aa-4', assetId: 'as-4', employeeId: 'emp-david', assignedDate: new Date('2024-03-02'), condition: 'new', status: 'assigned' },
      { id: 'aa-5', assetId: 'as-5', employeeId: 'emp-sarah', assignedDate: new Date('2024-03-02'), condition: 'good', status: 'assigned' },
      { id: 'aa-6', assetId: 'as-6', employeeId: 'emp-carol', assignedDate: new Date('2023-11-16'), condition: 'good', status: 'assigned' },
      { id: 'aa-7', assetId: 'as-7', employeeId: 'emp-grace', assignedDate: new Date('2023-10-02'), condition: 'fair', status: 'assigned' },
      { id: 'aa-8', assetId: 'as-8', employeeId: 'emp-emma', assignedDate: new Date('2024-01-11'), condition: 'new', status: 'assigned' },
      { id: 'aa-9', assetId: 'as-9', employeeId: 'emp-frank', assignedDate: new Date('2024-02-16'), condition: 'good', status: 'assigned' },
      { id: 'aa-10', assetId: 'as-10', employeeId: 'emp-lisa', assignedDate: new Date('2024-01-26'), condition: 'good', status: 'assigned' },
    ];

    for (const aa of assetAssignments) {
      await db.assetAssignment.upsert({
        where: { id: aa.id },
        update: {},
        create: aa,
      });
    }

    // Update asset statuses for assigned assets
    for (const aa of assetAssignments) {
      await db.asset.update({
        where: { id: aa.assetId },
        data: { status: 'assigned' },
      });
    }

    // ============ DOCUMENTS ============
    const documents = [
      { id: 'doc-1', employeeId: 'emp-admin', name: 'Offer Letter', type: 'offer_letter', fileUrl: '/documents/offer-letters/admin.pdf', status: 'active', uploadedAt: new Date('2020-01-15') },
      { id: 'doc-2', employeeId: 'emp-admin', name: 'Government ID', type: 'id_proof', fileUrl: '/documents/ids/admin-id.pdf', status: 'active', uploadedAt: new Date('2020-01-15') },
      { id: 'doc-3', employeeId: 'emp-alice', name: 'Offer Letter', type: 'offer_letter', fileUrl: '/documents/offer-letters/alice.pdf', status: 'active', uploadedAt: new Date('2022-02-14') },
      { id: 'doc-4', employeeId: 'emp-alice', name: 'AWS Certificate', type: 'certificate', fileUrl: '/documents/certificates/alice-aws.pdf', status: 'active', uploadedAt: new Date('2024-06-15') },
      { id: 'doc-5', employeeId: 'emp-bob', name: 'Employment Contract', type: 'contract', fileUrl: '/documents/contracts/bob.pdf', status: 'active', uploadedAt: new Date('2023-06-01') },
      { id: 'doc-6', employeeId: 'emp-carol', name: 'Offer Letter', type: 'offer_letter', fileUrl: '/documents/offer-letters/carol.pdf', status: 'active', uploadedAt: new Date('2022-09-15') },
      { id: 'doc-7', employeeId: 'emp-david', name: 'Passport Copy', type: 'id_proof', fileUrl: '/documents/ids/david-passport.pdf', status: 'active', uploadedAt: new Date('2023-01-10') },
      { id: 'doc-8', employeeId: 'emp-emma', name: 'Offer Letter', type: 'offer_letter', fileUrl: '/documents/offer-letters/emma.pdf', status: 'active', uploadedAt: new Date('2022-05-20') },
      { id: 'doc-9', employeeId: 'emp-frank', name: 'PAN Card', type: 'id_proof', fileUrl: '/documents/ids/frank-pan.pdf', status: 'active', uploadedAt: new Date('2021-11-01') },
      { id: 'doc-10', employeeId: 'emp-grace', name: 'NDA Agreement', type: 'contract', fileUrl: '/documents/contracts/grace-nda.pdf', status: 'active', uploadedAt: new Date('2022-07-01') },
    ];

    for (const doc of documents) {
      await db.document.upsert({
        where: { id: doc.id },
        update: {},
        create: doc,
      });
    }

    // ============ TRAVEL REQUESTS ============
    const travelRequests = [
      { id: 'trv-1', employeeId: 'emp-john', purpose: 'Client meeting with Goldman Sachs', destination: 'London, UK', startDate: new Date('2025-04-10'), endDate: new Date('2025-04-14'), mode: 'flight', estimatedCost: 5000, status: 'approved', approvedBy: 'user-admin', approvedAt: new Date('2025-03-20') },
      { id: 'trv-2', employeeId: 'emp-alice', purpose: 'Tech Conference - React Summit', destination: 'Amsterdam, Netherlands', startDate: new Date('2025-05-15'), endDate: new Date('2025-05-18'), mode: 'flight', estimatedCost: 3500, status: 'pending' },
      { id: 'trv-3', employeeId: 'emp-david', purpose: 'Quarterly Sales Review', destination: 'San Francisco, CA', startDate: new Date('2025-04-05'), endDate: new Date('2025-04-06'), mode: 'flight', estimatedCost: 800, status: 'approved', approvedBy: 'user-john', approvedAt: new Date('2025-03-25') },
      { id: 'trv-4', employeeId: 'emp-carol', purpose: 'Design Sprint with London Team', destination: 'London, UK', startDate: new Date('2025-04-20'), endDate: new Date('2025-04-25'), mode: 'flight', estimatedCost: 4200, status: 'rejected', approvedBy: 'user-sarah', approvedAt: new Date('2025-03-22'), notes: 'Budget constraints, suggest virtual sprint' },
      { id: 'trv-5', employeeId: 'emp-frank', purpose: 'Data Center Migration Project', destination: 'Mumbai, India', startDate: new Date('2025-05-01'), endDate: new Date('2025-05-07'), mode: 'flight', estimatedCost: 2500, status: 'pending' },
    ];

    for (const trv of travelRequests) {
      await db.travelRequest.upsert({
        where: { id: trv.id },
        update: {},
        create: trv,
      });
    }

    // ============ EXPENSE CLAIMS ============
    const expenseClaims = [
      { id: 'ec-1', employeeId: 'emp-john', title: 'Client Dinner - Goldman Sachs', category: 'food', amount: 450, currency: 'USD', date: new Date('2025-03-15'), description: 'Dinner with Goldman Sachs team at Le Bernardin', status: 'approved', approvedBy: 'user-admin', approvedAt: new Date('2025-03-18') },
      { id: 'ec-2', employeeId: 'emp-alice', title: 'Conference Registration - React Summit', category: 'travel', amount: 899, currency: 'USD', date: new Date('2025-03-01'), description: 'React Summit 2025 conference ticket', status: 'pending' },
      { id: 'ec-3', employeeId: 'emp-david', title: 'Hotel Stay - SF Sales Trip', category: 'accommodation', amount: 650, currency: 'USD', date: new Date('2025-03-20'), description: '2 nights at Marriott Union Square', status: 'paid', approvedBy: 'user-john', approvedAt: new Date('2025-03-22'), paidAt: new Date('2025-03-25') },
      { id: 'ec-4', employeeId: 'emp-carol', title: 'Figma Enterprise License', category: 'other', amount: 75, currency: 'USD', date: new Date('2025-03-10'), description: 'Monthly Figma enterprise subscription', status: 'approved', approvedBy: 'user-sarah', approvedAt: new Date('2025-03-12') },
      { id: 'ec-5', employeeId: 'emp-frank', title: 'Taxi to Airport', category: 'transport', amount: 45, currency: 'USD', date: new Date('2025-03-18'), description: 'Uber to JFK airport for business trip', status: 'rejected', approvedBy: 'user-sarah', approvedAt: new Date('2025-03-20') },
    ];

    for (const ec of expenseClaims) {
      await db.expenseClaim.upsert({
        where: { id: ec.id },
        update: {},
        create: ec,
      });
    }

    // ============ TIMESHEETS ============
    const timesheets = [
      { id: 'ts-1', employeeId: 'emp-alice', date: new Date('2025-03-10'), project: 'API Redesign', task: 'Implement new auth endpoints', hours: 8, description: 'Completed JWT auth implementation', status: 'approved', approvedBy: 'user-john', approvedAt: new Date('2025-03-12') },
      { id: 'ts-2', employeeId: 'emp-bob', date: new Date('2025-03-10'), project: 'Mobile App', task: 'Fix navigation bugs', hours: 7.5, description: 'Fixed 3 critical navigation bugs', status: 'submitted' },
      { id: 'ts-3', employeeId: 'emp-mike', date: new Date('2025-03-10'), project: 'Data Pipeline', task: 'Optimize ETL process', hours: 8, description: 'Reduced ETL processing time by 40%', status: 'approved', approvedBy: 'user-john', approvedAt: new Date('2025-03-13') },
      { id: 'ts-4', employeeId: 'emp-raj', date: new Date('2025-03-10'), project: 'Platform v2', task: 'Build user dashboard components', hours: 8, description: 'Completed dashboard layout and charts', status: 'draft' },
      { id: 'ts-5', employeeId: 'emp-grace', date: new Date('2025-03-10'), project: 'Product X', task: 'Write PRD for notification system', hours: 6, description: 'Drafted PRD with user stories and acceptance criteria', status: 'approved', approvedBy: 'user-admin', approvedAt: new Date('2025-03-11') },
    ];

    for (const ts of timesheets) {
      await db.timesheet.upsert({
        where: { id: ts.id },
        update: {},
        create: ts,
      });
    }

    // ============ FEEDBACKS ============
    const feedbacks = [
      { id: 'fb-1', fromId: 'emp-john', toId: 'emp-alice', type: 'manager', rating: 5, comments: 'Alice consistently delivers high-quality code and is a great team player.', isAnonymous: false },
      { id: 'fb-2', fromId: 'emp-alice', toId: 'emp-bob', type: 'peer', rating: 4, comments: 'Bob is always willing to help and has great problem-solving skills.', isAnonymous: false },
      { id: 'fb-3', fromId: 'emp-bob', toId: 'emp-alice', type: 'peer', rating: 5, comments: 'Alice is an exceptional mentor and her code reviews are always insightful.', isAnonymous: false },
      { id: 'fb-4', fromId: 'emp-grace', toId: 'emp-carol', type: 'peer', rating: 5, comments: 'Carol brings a unique perspective to every design discussion and elevates the whole team.', isAnonymous: false },
      { id: 'fb-5', fromId: 'emp-carol', toId: 'emp-grace', type: '360', rating: 4, comments: 'Grace has excellent product vision and communicates requirements clearly to the design team.', isAnonymous: false },
      { id: 'fb-6', fromId: 'emp-admin', toId: 'emp-sarah', type: 'manager', rating: 5, comments: 'Sarah has transformed our HR processes and is a valued leader.', isAnonymous: false },
      { id: 'fb-7', fromId: 'emp-david', toId: 'emp-david', type: 'self', rating: 3, comments: 'I need to improve my closing rate and pipeline management this quarter.', isAnonymous: false },
      { id: 'fb-8', fromId: 'emp-emma', toId: 'emp-emma', type: 'self', rating: 4, comments: 'Good progress on automation goals. Need to focus more on stakeholder communication.', isAnonymous: false },
      { id: 'fb-9', fromId: 'emp-frank', toId: 'emp-raj', type: 'manager', rating: 4, comments: 'Raj is progressing well and shows great enthusiasm for learning.', isAnonymous: false },
      { id: 'fb-10', fromId: 'emp-john', toId: 'emp-mike', type: 'manager', rating: 4, comments: 'Mike is a reliable engineer who consistently delivers. Could take on more leadership.', isAnonymous: false },
    ];

    for (const fb of feedbacks) {
      await db.feedback.upsert({
        where: { id: fb.id },
        update: {},
        create: fb,
      });
    }

    // ============ PROMOTIONS ============
    const promotions = [
      { id: 'pro-1', employeeId: 'emp-alice', fromDesignation: 'Software Engineer', toDesignation: 'Senior Software Engineer', fromDepartment: 'Engineering', toDepartment: null, effectiveDate: new Date('2025-04-01'), salaryChange: 20000, reason: 'Consistent high performance and technical leadership', status: 'approved', approvedBy: 'user-admin', approvedAt: new Date('2025-03-15') },
      { id: 'pro-2', employeeId: 'emp-frank', fromDesignation: 'Operations Executive', toDesignation: 'Operations Manager', fromDepartment: 'Operations', toDepartment: null, effectiveDate: new Date('2025-04-01'), salaryChange: 500000, reason: 'Successfully managed India operations expansion', status: 'approved', approvedBy: 'user-admin', approvedAt: new Date('2025-03-10') },
      { id: 'pro-3', employeeId: 'emp-lisa', fromDesignation: 'Marketing Executive', toDesignation: 'Marketing Manager', fromDepartment: 'Marketing', toDepartment: null, effectiveDate: new Date('2025-05-01'), salaryChange: 15000, reason: 'Outstanding campaign results and team leadership potential', status: 'pending' },
    ];

    for (const pro of promotions) {
      await db.promotion.upsert({
        where: { id: pro.id },
        update: {},
        create: pro,
      });
    }

    // ============ GRIEVANCES ============
    const grievances = [
      { id: 'grv-1', employeeId: 'emp-bob', type: 'workload', subject: 'Excessive overtime without compensation', description: 'I have been working 60+ hour weeks for the past month without overtime pay or comp time.', priority: 'high', status: 'in_progress', assignedTo: 'user-sarah' },
      { id: 'grv-2', employeeId: 'emp-raj', type: 'other', subject: 'Office temperature issues', description: 'The AC in the Bangalore office is not working properly, making it uncomfortable to work.', priority: 'low', status: 'open' },
    ];

    for (const grv of grievances) {
      await db.grievance.upsert({
        where: { id: grv.id },
        update: {},
        create: grv,
      });
    }

    // ============ SEPARATION ============
    const separations = [
      { id: 'sep-1', employeeId: 'emp-priya', type: 'resignation', reason: 'Relocating to another city for family reasons', noticePeriod: 30, lastWorkingDate: new Date('2025-04-30'), status: 'notice_period' },
    ];

    for (const sep of separations) {
      await db.separation.upsert({
        where: { id: sep.id },
        update: {},
        create: sep,
      });
    }

    // ============ NOTIFICATIONS ============
    const notifications = [
      { id: 'noti-1', tenantId: tenant.id, userId: 'user-admin', title: 'New Employee Onboarded', message: 'Raj Patel has been onboarded to the Engineering team.', type: 'info', category: 'system', isRead: false },
      { id: 'noti-2', tenantId: tenant.id, userId: 'user-sarah', title: 'Leave Request Pending', message: 'David Kim has submitted a leave request that needs your approval.', type: 'workflow', category: 'leave', link: '/leave/lr-3', isRead: false },
      { id: 'noti-3', tenantId: tenant.id, userId: 'user-john', title: 'Performance Review Due', message: 'You have pending performance reviews to complete for Q1 2025.', type: 'warning', category: 'performance', link: '/performance/pr-5', isRead: false },
      { id: 'noti-4', tenantId: tenant.id, userId: 'user-alice', title: 'Leave Approved', message: 'Your casual leave request from Mar 10-12 has been approved.', type: 'success', category: 'leave', link: '/leave/lr-1', isRead: true },
      { id: 'noti-5', tenantId: tenant.id, userId: 'user-david', title: 'Payroll Processed', message: 'Your salary for March 2025 has been processed and will be credited soon.', type: 'success', category: 'payroll', isRead: true },
      { id: 'noti-6', tenantId: tenant.id, userId: 'user-bob', title: 'Training Starting Soon', message: 'Advanced React Patterns training starts on March 15, 2025.', type: 'info', category: 'workflow', link: '/training/tr-1', isRead: false },
      { id: 'noti-7', tenantId: tenant.id, userId: 'user-sarah', title: 'New Job Application', message: 'A new application has been received for the Senior Full-Stack Developer position.', type: 'info', category: 'recruitment', link: '/recruitment/jp-1', isRead: false },
      { id: 'noti-8', tenantId: tenant.id, userId: 'user-grace', title: 'Expense Claim Rejected', message: 'Your expense claim for Taxi to Airport has been rejected.', type: 'error', category: 'alert', isRead: true },
      { id: 'noti-9', tenantId: tenant.id, userId: 'user-carol', title: 'Travel Request Update', message: 'Your travel request for the Design Sprint in London has been rejected due to budget constraints.', type: 'warning', category: 'workflow', link: '/travel/trv-4', isRead: false },
      { id: 'noti-10', tenantId: tenant.id, userId: 'user-admin', title: 'System Maintenance', message: 'Scheduled system maintenance on Saturday, March 30 from 2 AM to 6 AM EST.', type: 'info', category: 'system', isRead: false },
      { id: 'noti-11', tenantId: tenant.id, userId: 'user-emma', title: 'Goal Completed', message: 'Congratulations! Your goal "Automate Monthly Reports" has been marked as completed.', type: 'success', category: 'performance', isRead: true },
      { id: 'noti-12', tenantId: tenant.id, userId: 'user-frank', title: 'New Asset Assigned', message: 'A ThinkPad X1 Carbon has been assigned to you.', type: 'info', category: 'system', isRead: true },
    ];

    for (const noti of notifications) {
      await db.notification.upsert({
        where: { id: noti.id },
        update: {},
        create: noti,
      });
    }

    // ============ POLICIES ============
    const policies = [
      { id: 'pol-1', title: 'Employee Code of Conduct', category: 'code_of_conduct', description: 'Guidelines for professional behavior and workplace conduct', content: 'This policy outlines the expected behavior and professional conduct for all employees of Marq AI Tech Pvt Ltd...', version: '2.1', status: 'active', effectiveDate: new Date('2024-01-01') },
      { id: 'pol-2', title: 'Leave Policy', category: 'leave', description: 'Comprehensive leave management policy including all leave types', content: 'All full-time employees are entitled to the following leaves per calendar year...', version: '3.0', status: 'active', effectiveDate: new Date('2025-01-01') },
      { id: 'pol-3', title: 'Information Security Policy', category: 'it', description: 'Security guidelines for handling company and client data', content: 'All employees must adhere to the following information security practices...', version: '1.5', status: 'active', effectiveDate: new Date('2024-06-01') },
      { id: 'pol-4', title: 'Travel and Expense Policy', category: 'travel', description: 'Guidelines for business travel and expense reimbursement', content: 'This policy governs all business-related travel and associated expense reimbursements...', version: '2.0', status: 'active', effectiveDate: new Date('2024-03-01') },
      { id: 'pol-5', title: 'Workplace Safety Policy', category: 'safety', description: 'Health and safety guidelines for all office locations', content: 'Marq AI Tech Pvt Ltd is committed to providing a safe and healthy work environment...', version: '1.2', status: 'active', effectiveDate: new Date('2024-01-01') },
    ];

    for (const pol of policies) {
      await db.policy.upsert({
        where: { id: pol.id },
        update: {},
        create: pol,
      });
    }

    // ============ HOLIDAYS ============
    const holidays = [
      { id: 'hol-1', name: "New Year's Day", date: new Date('2025-01-01'), type: 'public', country: 'US', description: 'New Year celebration' },
      { id: 'hol-2', name: 'Martin Luther King Jr. Day', date: new Date('2025-01-20'), type: 'public', country: 'US', description: 'MLK Day' },
      { id: 'hol-3', name: "Presidents' Day", date: new Date('2025-02-17'), type: 'public', country: 'US', description: 'Presidents Day' },
      { id: 'hol-4', name: 'Memorial Day', date: new Date('2025-05-26'), type: 'public', country: 'US', description: 'Memorial Day' },
      { id: 'hol-5', name: 'Independence Day', date: new Date('2025-07-04'), type: 'public', country: 'US', description: 'US Independence Day' },
      { id: 'hol-6', name: 'Republic Day', date: new Date('2025-01-26'), type: 'public', country: 'IN', description: 'India Republic Day' },
      { id: 'hol-7', name: 'Holi', date: new Date('2025-03-14'), type: 'public', country: 'IN', description: 'Festival of Colors' },
      { id: 'hol-8', name: 'Diwali', date: new Date('2025-10-20'), type: 'public', country: 'IN', description: 'Festival of Lights' },
      { id: 'hol-9', name: 'Good Friday', date: new Date('2025-04-18'), type: 'public', country: 'GB', description: 'Good Friday' },
      { id: 'hol-10', name: 'Christmas Day', date: new Date('2025-12-25'), type: 'public', country: 'US', description: 'Christmas celebration' },
    ];

    for (const hol of holidays) {
      await db.holiday.upsert({
        where: { id: hol.id },
        update: {},
        create: hol,
      });
    }

    // ============ ANNOUNCEMENTS ============
    const announcements = [
      { id: 'ann-1', title: 'Q1 2025 Town Hall Meeting', content: 'Join us for the quarterly town hall meeting on March 28, 2025 at 2:00 PM EST. CEO will share company updates and strategic direction for Q2.', priority: 'important', targetAudience: 'all', isActive: true, publishedAt: new Date('2025-03-15') },
      { id: 'ann-2', title: 'New Health Insurance Provider', content: 'Effective April 1, 2025, we are transitioning to a new health insurance provider. Please review the updated benefits package on the HR portal.', priority: 'urgent', targetAudience: 'all', isActive: true, publishedAt: new Date('2025-03-20') },
      { id: 'ann-3', title: 'Office Closure - Spring Break', content: 'The San Francisco office will be closed on April 18, 2025 for the local spring festival. Remote work is encouraged.', priority: 'normal', targetAudience: 'branch', isActive: true, publishedAt: new Date('2025-03-10'), expiresAt: new Date('2025-04-19') },
    ];

    for (const ann of announcements) {
      await db.announcement.upsert({
        where: { id: ann.id },
        update: {},
        create: ann,
      });
    }

    // ============ SHIFTS ============
    const shifts = [
      { id: 'sh-1', name: 'Morning Shift', startTime: '06:00', endTime: '14:00', breakDuration: 60, graceTime: 15, status: 'active' },
      { id: 'sh-2', name: 'General Shift', startTime: '09:00', endTime: '18:00', breakDuration: 60, graceTime: 15, status: 'active' },
      { id: 'sh-3', name: 'Evening Shift', startTime: '14:00', endTime: '22:00', breakDuration: 60, graceTime: 15, status: 'active' },
    ];

    for (const sh of shifts) {
      await db.shift.upsert({
        where: { id: sh.id },
        update: {},
        create: sh,
      });
    }

    // ============ REIMBURSEMENTS ============
    const reimbursements = [
      { id: 'rmb-1', employeeId: 'emp-emma', type: 'internet', amount: 75, currency: 'USD', description: 'Monthly internet reimbursement for remote work', status: 'approved', approvedBy: 'user-sarah', approvedAt: new Date('2025-03-15') },
      { id: 'rmb-2', employeeId: 'emp-alice', type: 'education', amount: 500, currency: 'USD', description: 'AWS certification exam fee', status: 'pending' },
      { id: 'rmb-3', employeeId: 'emp-david', type: 'phone', amount: 100, currency: 'USD', description: 'Mobile phone bill reimbursement', status: 'approved', approvedBy: 'user-sarah', approvedAt: new Date('2025-03-10') },
      { id: 'rmb-4', employeeId: 'emp-frank', type: 'fuel', amount: 150, currency: 'USD', description: 'Fuel reimbursement for office commute', status: 'rejected', approvedBy: 'user-sarah', approvedAt: new Date('2025-03-18') },
      { id: 'rmb-5', employeeId: 'emp-carol', type: 'medical', amount: 200, currency: 'USD', description: 'Annual health checkup reimbursement', status: 'pending' },
    ];

    for (const rmb of reimbursements) {
      await db.reimbursement.upsert({
        where: { id: rmb.id },
        update: {},
        create: rmb,
      });
    }

    // ============ INCIDENT REPORTS ============
    const incidentReports = [
      { id: 'ir-1', employeeId: 'emp-bob', type: 'security', title: 'Unauthorized Access Attempt', description: 'Detected unauthorized access attempt to the development server from an unknown IP address.', severity: 'high', status: 'investigating', reportedBy: 'user-john' },
      { id: 'ir-2', employeeId: 'emp-raj', type: 'safety', title: 'Loose Wiring in Office', description: 'Exposed wiring near the Bangalore office meeting room poses a safety hazard.', severity: 'medium', status: 'open', reportedBy: 'user-frank' },
      { id: 'ir-3', employeeId: 'emp-sarah', type: 'other', title: 'Visitor Badge Misuse', description: 'A visitor was found using an expired badge to access restricted areas.', severity: 'low', status: 'resolved', resolution: 'Badge confiscated and visitor policy updated', reportedBy: 'user-admin', resolvedDate: new Date('2025-03-12') },
      { id: 'ir-4', employeeId: 'emp-david', type: 'harassment', title: 'Inappropriate Customer Behavior', description: 'A client made inappropriate comments during a sales meeting.', severity: 'high', status: 'investigating', reportedBy: 'user-david' },
      { id: 'ir-5', employeeId: 'emp-frank', type: 'safety', title: 'Fire Alarm Malfunction', description: 'Fire alarm triggered false alarm in the Bangalore office.', severity: 'medium', status: 'closed', resolution: 'Fire alarm system recalibrated and tested', reportedBy: 'user-frank', resolvedDate: new Date('2025-03-05') },
    ];

    for (const ir of incidentReports) {
      await db.incidentReport.upsert({
        where: { id: ir.id },
        update: {},
        create: ir,
      });
    }

    // ============ SUBSCRIPTION PLANS ============
    const plans = [
      { id: 'plan-starter', name: 'Starter', planType: 'starter', monthlyPrice: 49, annualPrice: 470, employeeLimit: 50, companyLimit: 1, branchLimit: 5, supportLevel: 'email' },
      { id: 'plan-professional', name: 'Professional', planType: 'professional', monthlyPrice: 149, annualPrice: 1430, employeeLimit: 500, companyLimit: 5, branchLimit: 20, payrollEnabled: true, recruitmentEnabled: true, projectEnabled: true, supportLevel: 'chat' },
      { id: 'plan-enterprise', name: 'Enterprise', planType: 'enterprise', monthlyPrice: 399, annualPrice: 3830, employeeLimit: 5000, companyLimit: 50, branchLimit: 200, payrollEnabled: true, recruitmentEnabled: true, attendanceEnabled: true, projectEnabled: true, clientPortalEnabled: true, vendorPortalEnabled: true, mobileAppEnabled: true, apiAccessEnabled: true, supportLevel: 'priority' },
      { id: 'plan-global', name: 'Global Enterprise', planType: 'global_enterprise', monthlyPrice: 799, annualPrice: 7670, employeeLimit: 50000, companyLimit: 200, branchLimit: 1000, payrollEnabled: true, recruitmentEnabled: true, attendanceEnabled: true, projectEnabled: true, clientPortalEnabled: true, vendorPortalEnabled: true, mobileAppEnabled: true, apiAccessEnabled: true, whiteLabelEnabled: true, supportLevel: 'dedicated' },
      { id: 'plan-staffing', name: 'Staffing Suite', planType: 'staffing', monthlyPrice: 299, annualPrice: 2870, employeeLimit: 2000, companyLimit: 20, branchLimit: 100, payrollEnabled: true, recruitmentEnabled: true, clientPortalEnabled: true, vendorPortalEnabled: true, supportLevel: 'priority' },
    ];
    for (const plan of plans) { await getPlatformDb().subscriptionPlan.upsert({ where: { id: plan.id }, update: {}, create: plan }); }

    await getPlatformDb().subscription.upsert({ where: { id: 'sub-1' }, update: {}, create: { id: 'sub-1', tenantId: tenant.id, planId: 'plan-enterprise', startDate: new Date('2024-01-01'), endDate: new Date('2025-12-31'), billingCycle: 'annual', amount: 3830, currency: 'USD', paymentStatus: 'paid', status: 'active' } });

    // ============ CLIENTS ============
    const clientData = [
      { id: 'client-1', name: 'Acme Corporation', code: 'ACME', companyId: usaCompany.id, industry: 'Technology', website: 'https://acme.com', contactName: 'Robert Smith', contactEmail: 'robert@acme.com', contactPhone: '+1-555-3001', country: 'US', billingCurrency: 'USD', paymentTerms: 'net_30', contractValue: 500000 },
      { id: 'client-2', name: 'Global Retail Ltd', code: 'GRL', companyId: usaCompany.id, industry: 'Retail', contactName: 'Patricia Jones', contactEmail: 'patricia@globalretail.com', contactPhone: '+44-555-3002', country: 'GB', billingCurrency: 'GBP', paymentTerms: 'net_45', contractValue: 350000 },
      { id: 'client-3', name: 'TechVentures India', code: 'TVI', companyId: indiaCompany.id, industry: 'IT Services', contactName: 'Vikram Reddy', contactEmail: 'vikram@techventures.in', contactPhone: '+91-555-3003', country: 'IN', billingCurrency: 'INR', paymentTerms: 'net_15', contractValue: 20000000 },
    ];
    for (const cl of clientData) { await db.client.upsert({ where: { id: cl.id }, update: {}, create: cl }); }

    // ============ VENDORS ============
    const vendorData = [
      { id: 'vendor-1', name: 'TalentFind Inc', code: 'TF', companyId: usaCompany.id, type: 'vendor', industry: 'Recruitment', contactName: 'Mike Johnson', contactEmail: 'mike@talentfind.com', specialization: 'IT Recruitment', rating: 4.5 },
      { id: 'vendor-2', name: 'StaffPro Solutions', code: 'SPS', companyId: usaCompany.id, type: 'vendor', industry: 'Staffing', contactName: 'Linda Chen', contactEmail: 'linda@staffpro.com', specialization: 'Engineering Staffing', rating: 4.2 },
      { id: 'vendor-3', name: 'QuickHire India', code: 'QHI', companyId: indiaCompany.id, type: 'vendor', industry: 'Recruitment', contactName: 'Suresh Kumar', contactEmail: 'suresh@quickhire.in', specialization: 'BPO & IT Hiring', rating: 3.8 },
      { id: 'vendor-4', name: 'SubStaff Partners', code: 'SSP', companyId: usaCompany.id, type: 'sub_vendor', parentVendorId: 'vendor-1', industry: 'Recruitment', contactName: 'Amy Wilson', contactEmail: 'amy@substaff.com', specialization: 'Junior Developer Sourcing', rating: 3.5 },
    ];
    for (const v of vendorData) { await db.vendor.upsert({ where: { id: v.id }, update: {}, create: v }); }

    // ============ PROJECTS ============
    const projectData = [
      { id: 'proj-1', name: '3Boxes Platform v2.0', code: 'NPV2', companyId: usaCompany.id, clientId: 'client-1', departmentId: 'dept-eng', projectType: 'client', billingType: 'time_and_material', currency: 'USD', budgetAmount: 300000, estimatedHours: 5000, billingRate: 150, startDate: new Date('2025-01-15'), endDate: new Date('2025-12-31'), status: 'active', description: 'Major platform upgrade for Acme Corp', progress: 35 },
      { id: 'proj-2', name: 'Mobile App Development', code: 'MAD', companyId: usaCompany.id, clientId: 'client-2', departmentId: 'dept-eng', projectType: 'client', billingType: 'fixed', currency: 'GBP', budgetAmount: 200000, estimatedHours: 3000, startDate: new Date('2025-03-01'), endDate: new Date('2025-09-30'), status: 'active', description: 'Cross-platform mobile app', progress: 20 },
      { id: 'proj-3', name: 'Internal HR Portal', code: 'IHRP', companyId: indiaCompany.id, departmentId: 'dept-eng', projectType: 'internal', billingType: 'non_billable', currency: 'INR', budgetAmount: 5000000, estimatedHours: 2000, startDate: new Date('2025-02-01'), status: 'active', description: 'Internal HR portal', progress: 50 },
    ];
    for (const proj of projectData) { await db.project.upsert({ where: { id: proj.id }, update: {}, create: proj }); }

    // ============ PROJECT TASKS ============
    const projectTasks = [
      { id: 'ptask-1', projectId: 'proj-1', name: 'API Design', estimatedHours: 200, priority: 'high', status: 'done', isBillable: true },
      { id: 'ptask-2', projectId: 'proj-1', name: 'Frontend Dashboard', estimatedHours: 300, priority: 'high', status: 'in_progress', isBillable: true },
      { id: 'ptask-3', projectId: 'proj-1', name: 'Database Migration', estimatedHours: 100, priority: 'medium', status: 'review', isBillable: true },
      { id: 'ptask-4', projectId: 'proj-1', name: 'Unit Testing', estimatedHours: 150, priority: 'medium', status: 'todo', isBillable: true },
      { id: 'ptask-5', projectId: 'proj-2', name: 'UI/UX Design', estimatedHours: 250, priority: 'high', status: 'done', isBillable: true },
      { id: 'ptask-6', projectId: 'proj-2', name: 'React Native Dev', estimatedHours: 400, priority: 'high', status: 'in_progress', isBillable: true },
    ];
    for (const pt of projectTasks) { await db.projectTask.upsert({ where: { id: pt.id }, update: {}, create: pt }); }

    // ============ PROJECT ALLOCATIONS ============
    const allocationData = [
      { id: 'alloc-1', projectId: 'proj-1', employeeId: 'emp-john', role: 'Project Manager', allocationPct: 50, startDate: new Date('2025-01-15'), billingStatus: 'billable', billingRate: 200, internalCostRate: 120 },
      { id: 'alloc-2', projectId: 'proj-1', employeeId: 'emp-alice', role: 'Tech Lead', allocationPct: 80, startDate: new Date('2025-01-15'), billingStatus: 'billable', billingRate: 150, internalCostRate: 85 },
      { id: 'alloc-3', projectId: 'proj-2', employeeId: 'emp-carol', role: 'Design Lead', allocationPct: 60, startDate: new Date('2025-03-01'), billingStatus: 'billable', billingRate: 140, internalCostRate: 75 },
    ];
    for (const alloc of allocationData) { await db.projectAllocation.upsert({ where: { id: alloc.id }, update: {}, create: alloc }); }

    // ============ TICKET CATEGORIES & TICKETS ============
    const ticketCategories = [
      { id: 'tc-hr', name: 'HR Query', type: 'hr', slaHours: 48 },
      { id: 'tc-it', name: 'IT Support', type: 'it', slaHours: 24 },
      { id: 'tc-payroll', name: 'Payroll Issue', type: 'payroll', slaHours: 72 },
      { id: 'tc-admin', name: 'Admin Request', type: 'admin', slaHours: 48 },
      { id: 'tc-general', name: 'General', type: 'general', slaHours: 96 },
    ];
    for (const tc of ticketCategories) { await db.ticketCategory.upsert({ where: { id: tc.id }, update: {}, create: tc }); }

    const ticketData = [
      { id: 'ticket-1', ticketId: 'TK-0001', categoryId: 'tc-it', requesterType: 'employee', requesterId: 'emp-alice', requesterName: 'Alice Chen', subject: 'Laptop not connecting to VPN', description: 'My laptop cannot connect to the company VPN since Monday.', priority: 'high', status: 'in_progress', assignedAgentId: 'user-frank', assignedAgentName: 'Frank Rodriguez' },
      { id: 'ticket-2', ticketId: 'TK-0002', categoryId: 'tc-hr', requesterType: 'employee', requesterId: 'emp-bob', requesterName: 'Bob Martinez', subject: 'Payslip missing for last month', description: 'Did not receive payslip via email.', priority: 'medium', status: 'open' },
      { id: 'ticket-3', ticketId: 'TK-0003', categoryId: 'tc-payroll', requesterType: 'employee', requesterId: 'emp-david', requesterName: 'David Kim', subject: 'Overtime not reflected in salary', description: 'Overtime hours from last month missing from salary slip.', priority: 'high', status: 'open' },
      { id: 'ticket-4', ticketId: 'TK-0004', categoryId: 'tc-it', requesterType: 'employee', requesterId: 'emp-grace', requesterName: 'Grace Liu', subject: 'Access request for Jira project', description: 'Need access to 3BOXES-PROJ Jira project.', priority: 'low', status: 'resolved', assignedAgentId: 'user-frank', assignedAgentName: 'Frank Rodriguez', resolutionNotes: 'Access granted.', resolvedAt: new Date('2025-03-10') },
      { id: 'ticket-5', ticketId: 'TK-0005', categoryId: 'tc-general', requesterType: 'employee', requesterId: 'emp-emma', requesterName: 'Emma Thompson', subject: 'Parking space allocation', description: 'Requesting reserved parking space.', priority: 'low', status: 'closed', resolvedAt: new Date('2025-03-08'), closedAt: new Date('2025-03-09') },
    ];
    for (const tk of ticketData) { await db.ticket.upsert({ where: { id: tk.id }, update: {}, create: tk }); }

    // ============ REQUISITIONS ============
    const requisitionData = [
      { id: 'req-1', requisitionId: 'REQ-0001', companyId: usaCompany.id, departmentId: 'dept-eng', designationId: 'des-eng', positionType: 'new', numberOfOpenings: 2, employmentType: 'full-time', skillsRequired: 'React, Node.js, TypeScript', experienceRequired: '3-5 years', salaryBudget: '$90,000 - $130,000', priority: 'high', expectedJoiningDate: new Date('2025-05-01'), approvalStatus: 'hr_approved', status: 'approved' },
      { id: 'req-2', requisitionId: 'REQ-0002', companyId: usaCompany.id, departmentId: 'dept-sales', designationId: 'des-sales-exec', positionType: 'new', numberOfOpenings: 3, employmentType: 'full-time', skillsRequired: 'CRM, Lead Generation', experienceRequired: '1-2 years', salaryBudget: '$60,000 - $80,000', priority: 'medium', expectedJoiningDate: new Date('2025-06-01'), approvalStatus: 'pending', status: 'open' },
    ];
    for (const req of requisitionData) { await db.requisition.upsert({ where: { id: req.id }, update: {}, create: req }); }

    // ============ OFFERS ============
    const offerData = [
      { id: 'offer-1', candidateId: 'ja-4', candidateName: 'Nina Patel', candidateEmail: 'nina@example.com', position: 'Product Designer', department: 'Design', offeredSalary: 125000, offeredCurrency: 'USD', joiningDate: new Date('2025-04-01'), probationPeriod: 90, status: 'sent' },
      { id: 'offer-2', candidateId: 'ja-1', candidateName: 'Alex Turner', candidateEmail: 'alex@example.com', position: 'Senior Full-Stack Developer', department: 'Engineering', offeredSalary: 155000, offeredCurrency: 'USD', joiningDate: new Date('2025-05-01'), probationPeriod: 90, status: 'pending_approval' },
    ];
    for (const off of offerData) { await db.offer.upsert({ where: { id: off.id }, update: {}, create: off }); }

    // ============ SALARY STRUCTURES & COMPONENTS ============
    await db.salaryStructure.upsert({ where: { id: 'ss-usa' }, update: {}, create: { id: 'ss-usa', name: 'USA Standard Structure', companyId: usaCompany.id, country: 'US', currency: 'USD', description: 'Standard salary structure for US employees' } });
    await db.salaryStructure.upsert({ where: { id: 'ss-india' }, update: {}, create: { id: 'ss-india', name: 'India Standard Structure', companyId: indiaCompany.id, country: 'IN', currency: 'INR', description: 'Standard salary structure for India employees' } });

    const salaryComponentData = [
      { id: 'sc-1', salaryStructureId: 'ss-usa', name: 'Basic Salary', type: 'earning', category: 'basic', calculationType: 'percentage', value: 40, percentageOf: 'CTC', isTaxable: true, sortOrder: 1 },
      { id: 'sc-2', salaryStructureId: 'ss-usa', name: 'HRA', type: 'earning', category: 'hra', calculationType: 'percentage', value: 50, percentageOf: 'Basic Salary', isTaxable: false, sortOrder: 2 },
      { id: 'sc-3', salaryStructureId: 'ss-usa', name: 'Federal Tax', type: 'deduction', category: 'tax', calculationType: 'formula', formula: 'IF(Basic > 10000, Basic * 0.22, Basic * 0.12)', isTaxable: true, isStatutory: true, sortOrder: 10 },
      { id: 'sc-4', salaryStructureId: 'ss-india', name: 'Basic Salary', type: 'earning', category: 'basic', calculationType: 'percentage', value: 40, percentageOf: 'CTC', isTaxable: true, sortOrder: 1 },
      { id: 'sc-5', salaryStructureId: 'ss-india', name: 'HRA', type: 'earning', category: 'hra', calculationType: 'percentage', value: 40, percentageOf: 'Basic Salary', isTaxable: false, sortOrder: 2 },
      { id: 'sc-6', salaryStructureId: 'ss-india', name: 'Provident Fund', type: 'deduction', category: 'pf', calculationType: 'percentage', value: 12, percentageOf: 'Basic Salary', isTaxable: true, isStatutory: true, maxLimit: 1800, sortOrder: 10 },
      { id: 'sc-7', salaryStructureId: 'ss-india', name: 'Professional Tax', type: 'deduction', category: 'tax', calculationType: 'fixed', value: 200, isTaxable: true, isStatutory: true, sortOrder: 12 },
    ];
    for (const sc of salaryComponentData) { await db.salaryComponent.upsert({ where: { id: sc.id }, update: {}, create: sc }); }

    // ============ WORKFLOW DEFINITIONS ============
    const workflowData = [
      { id: 'wf-leave', name: 'Leave Approval', module: 'leave', companyId: usaCompany.id, steps: JSON.stringify([{ stepNumber: 1, approverRole: 'admin', isRequired: true }, { stepNumber: 2, approverRole: 'admin', isRequired: true }]), version: 1 },
      { id: 'wf-requisition', name: 'Requisition Approval', module: 'recruitment', companyId: usaCompany.id, steps: JSON.stringify([{ stepNumber: 1, approverRole: 'admin', isRequired: true }, { stepNumber: 2, approverRole: 'admin', isRequired: true }, { stepNumber: 3, approverRole: 'tenant_admin', isRequired: false }]), version: 1 },
    ];
    for (const wf of workflowData) { await db.workflowDefinition.upsert({ where: { id: wf.id }, update: {}, create: wf }); }

    // ============ FNF ============
    await db.fNFCalculation.upsert({ where: { id: 'fnf-1' }, update: {}, create: { id: 'fnf-1', employeeId: 'emp-admin', pendingSalary: 10416.67, leaveEncashment: 3472.22, bonus: 2000, totalEarnings: 15888.89, taxDeduction: 2383.33, totalDeductions: 2383.33, netAmount: 13505.56, currency: 'USD', status: 'pending' } });

    // ============ RBAC - Modules & Permissions ============
    let rbacModulesCreated = 0;
    let rbacPermissionsCreated = 0;
    let rbacRolesCreated = 0;
    let rbacRolePermissionsCreated = 0;
    let rbacUserRoleAssignmentsCreated = 0;

    try {
      const RBAC_MODULES = [
        { key: 'dashboard', name: 'Dashboard', category: 'Core HR', icon: 'LayoutDashboard', sortOrder: 1 },
        { key: 'employees', name: 'Employees', category: 'Core HR', icon: 'Users', sortOrder: 2 },
        { key: 'company', name: 'Company', category: 'Core HR', icon: 'Building2', sortOrder: 3 },
        { key: 'recruitment', name: 'Recruitment', category: 'Talent', icon: 'UserPlus', sortOrder: 4 },
        { key: 'requisitions', name: 'Requisitions', category: 'Talent', icon: 'ClipboardList', sortOrder: 5 },
        { key: 'offers', name: 'Offers', category: 'Talent', icon: 'FileText', sortOrder: 6 },
        { key: 'job_portal', name: 'Job Portal', category: 'Talent', icon: 'Globe', sortOrder: 7 },
        { key: 'ai_interview', name: 'AI Interview', category: 'Talent', icon: 'Bot', sortOrder: 8 },
        { key: 'onboarding', name: 'Onboarding', category: 'Lifecycle', icon: 'UserCheck', sortOrder: 9 },
        { key: 'preboarding', name: 'Preboarding', category: 'Lifecycle', icon: 'ClipboardCheck', sortOrder: 10 },
        { key: 'attendance', name: 'Attendance', category: 'Time', icon: 'Clock', sortOrder: 11 },
        { key: 'leave', name: 'Leave', category: 'Time', icon: 'CalendarOff', sortOrder: 12 },
        { key: 'timesheets', name: 'Timesheets', category: 'Time', icon: 'Timer', sortOrder: 13 },
        { key: 'payroll', name: 'Payroll', category: 'Compensation', icon: 'Banknote', sortOrder: 14 },
        { key: 'salary_structures', name: 'Salary Structures', category: 'Compensation', icon: 'Coins', sortOrder: 15 },
        { key: 'performance', name: 'Performance', category: 'Performance', icon: 'TrendingUp', sortOrder: 16 },
        { key: 'training', name: 'Training', category: 'Performance', icon: 'GraduationCap', sortOrder: 17 },
        { key: 'engagement', name: 'Engagement', category: 'Performance', icon: 'Heart', sortOrder: 18 },
        { key: 'succession', name: 'Succession', category: 'Performance', icon: 'ArrowUpRight', sortOrder: 19 },
        { key: 'projects', name: 'Projects', category: 'Operations', icon: 'FolderKanban', sortOrder: 20 },
        { key: 'travel', name: 'Travel', category: 'Operations', icon: 'Plane', sortOrder: 21 },
        { key: 'expenses', name: 'Expenses', category: 'Operations', icon: 'Receipt', sortOrder: 22 },
        { key: 'assets', name: 'Assets', category: 'Operations', icon: 'Monitor', sortOrder: 23 },
        { key: 'documents', name: 'Documents', category: 'Operations', icon: 'FileStack', sortOrder: 24 },
        { key: 'clients', name: 'Clients', category: 'External', icon: 'Handshake', sortOrder: 25 },
        { key: 'vendors', name: 'Vendors', category: 'External', icon: 'Truck', sortOrder: 26 },
        { key: 'helpdesk', name: 'Helpdesk', category: 'Support', icon: 'Headphones', sortOrder: 27 },
        { key: 'grievances', name: 'Grievances', category: 'Support', icon: 'AlertTriangle', sortOrder: 28 },
        { key: 'ai_assistant', name: 'AI Assistant', category: 'Support', icon: 'Sparkles', sortOrder: 29 },
        { key: 'docs', name: 'Documentation', category: 'Knowledge', icon: 'BookOpen', sortOrder: 30 },
        { key: 'workflows', name: 'Workflows', category: 'Governance', icon: 'GitBranch', sortOrder: 31 },
        { key: 'reports', name: 'Reports', category: 'Governance', icon: 'BarChart3', sortOrder: 32 },
        { key: 'settings', name: 'Settings', category: 'Governance', icon: 'Settings', sortOrder: 33 },
        { key: 'notifications', name: 'Notifications', category: 'Governance', icon: 'Bell', sortOrder: 34 },
        { key: 'super_admin', name: 'Super Admin', category: 'Admin', icon: 'Shield', sortOrder: 35 },
        { key: 'tenant_admin', name: 'Tenant Admin', category: 'Admin', icon: 'ShieldCheck', sortOrder: 36 },
        { key: 'ai_admin', name: 'AI Admin', category: 'Admin', icon: 'Brain', sortOrder: 37 },
      ];
      const RBAC_LIMITED_MODULES = ['dashboard', 'notifications', 'docs'];
      const RBAC_DEFAULT_ACTIONS = ['view', 'create', 'edit', 'delete', 'export', 'approve'];
      const RBAC_ADMIN_ONLY = ['super_admin', 'tenant_admin', 'ai_admin'];

      // Create modules and permissions
      for (const mod of RBAC_MODULES) {
        const existing = await db.module.findUnique({ where: { key: mod.key } });
        if (!existing) {
          const created = await db.module.create({ data: mod });
          const actions = RBAC_LIMITED_MODULES.includes(mod.key) ? ['view'] : RBAC_DEFAULT_ACTIONS;
          for (const action of actions) {
            await db.permission.create({ data: { moduleId: created.id, action, description: `${action} ${mod.name.toLowerCase()}` } });
            rbacPermissionsCreated++;
          }
          rbacModulesCreated++;
        }
      }

      // Create system roles
      const RBAC_ROLES = [
        { key: 'super_admin', name: 'Super Administrator', description: 'Full system access across all tenants', level: 0, isSystem: true, tenantId: null as string | null },
        { key: 'tenant_admin', name: 'Tenant Administrator', description: 'Full access within their tenant', level: 1, isSystem: true, tenantId: null as string | null },
        { key: 'admin', name: 'Administrator', description: 'Company-level admin access — manages all employees, HR operations, payroll, recruitment, IT, and finance', level: 2, isSystem: true },
      ];

      const createdRoleIds: Record<string, string> = {};
      for (const roleDef of RBAC_ROLES) {
        const roleTenantId = roleDef.tenantId === null && roleDef.key !== 'super_admin' && roleDef.key !== 'tenant_admin' ? tenant.id : roleDef.tenantId ?? null;
        const existing = await db.role.findFirst({ where: { key: roleDef.key, tenantId: roleTenantId, companyId: null } });
        if (!existing) {
          const role = await db.role.create({ data: { name: roleDef.name, key: roleDef.key, description: roleDef.description, isSystem: roleDef.isSystem, level: roleDef.level, tenantId: roleTenantId, status: 'active', createdBy: 'user-admin' } });
          createdRoleIds[roleDef.key] = role.id;
          rbacRolesCreated++;
        } else {
          createdRoleIds[roleDef.key] = existing.id;
        }
      }

      // Assign permissions to roles
      const allMods = await db.module.findMany({ include: { permissions: true } });
      const modMap = new Map(allMods.map(m => [m.key, m]));

      const assignPerms = async (roleId: string, modKeys: string[], actions?: string[]) => {
        for (const mk of modKeys) {
          const m = modMap.get(mk);
          if (!m) continue;
          for (const p of m.permissions) {
            if (actions && !actions.includes(p.action)) continue;
            try {
              const existing = await db.rolePermission.findUnique({ where: { roleId_permissionId: { roleId, permissionId: p.id } } });
              if (!existing) {
                await db.rolePermission.create({ data: { roleId, permissionId: p.id, granted: true } });
                rbacRolePermissionsCreated++;
              }
            } catch { /* skip duplicates */ }
          }
        }
      };

      const HR_MODS = ['dashboard','employees','company','recruitment','requisitions','offers','job_portal','ai_interview','onboarding','preboarding','attendance','leave','timesheets','payroll','salary_structures','performance','training','engagement','documents','helpdesk','grievances','ai_assistant','docs','workflows','reports','notifications'];
      const MGR_MODS = ['dashboard','employees','recruitment','onboarding','attendance','leave','timesheets','performance','training','engagement','documents','helpdesk','ai_assistant','docs','notifications','projects'];
      const EMP_MODS = ['dashboard','employees','leave','attendance','timesheets','documents','helpdesk','ai_assistant','docs','notifications','expenses','travel','training'];
      const REC_MODS = ['dashboard','recruitment','requisitions','offers','job_portal','ai_interview','employees','docs','notifications','ai_assistant'];
      const CAND_MODS = ['job_portal','ai_interview','docs','notifications'];

      if (createdRoleIds.super_admin) await assignPerms(createdRoleIds.super_admin, RBAC_MODULES.map(m => m.key));
      if (createdRoleIds.tenant_admin) await assignPerms(createdRoleIds.tenant_admin, RBAC_MODULES.filter(m => !RBAC_ADMIN_ONLY.includes(m.key)).map(m => m.key));
      if (createdRoleIds.hr_admin) await assignPerms(createdRoleIds.hr_admin, HR_MODS);
      if (createdRoleIds.manager) await assignPerms(createdRoleIds.manager, MGR_MODS, ['view','create','edit','approve']);
      if (createdRoleIds.employee) {
        const viewOnly = EMP_MODS.filter(m => !['leave','expenses','travel','timesheets','helpdesk','training'].includes(m));
        await assignPerms(createdRoleIds.employee, viewOnly, ['view']);
        await assignPerms(createdRoleIds.employee, ['leave','expenses','travel','timesheets','helpdesk','training'], ['view','create','edit']);
      }
      if (createdRoleIds.recruiter) await assignPerms(createdRoleIds.recruiter, REC_MODS, ['view','create','edit','export']);
      if (createdRoleIds.candidate) await assignPerms(createdRoleIds.candidate, CAND_MODS, ['view','create']);

      // Assign roles to users
      const roleMapping: Record<string, string> = { super_admin: 'super_admin', tenant_admin: 'tenant_admin', admin: 'admin' };
      for (const u of demoUsers) {
        const rKey = roleMapping[u.role];
        if (!rKey || !createdRoleIds[rKey]) continue;
        try {
          await db.userRoleAssignment.create({ data: { userId: u.id, roleId: createdRoleIds[rKey], companyId: rKey !== 'super_admin' && rKey !== 'tenant_admin' ? usaCompany.id : null, assignedBy: 'user-admin' } });
          rbacUserRoleAssignmentsCreated++;
        } catch { /* skip duplicates */ }
      }

      console.log(`RBAC seeded: ${rbacModulesCreated} modules, ${rbacPermissionsCreated} permissions, ${rbacRolesCreated} roles, ${rbacRolePermissionsCreated} role-permissions, ${rbacUserRoleAssignmentsCreated} user-role assignments`);
    } catch (rbacError) {
      console.error('RBAC seed warning (non-fatal):', rbacError instanceof Error ? rbacError.message : String(rbacError));
      // RBAC seeding failure is non-fatal - main seed still succeeds
    }

    // NOTE: The previous branding-lockdown guard that force-renamed EVERY
    // tenant to "Marq AI Tech Pvt Ltd" has been removed. The app now supports true
    // multi-tenancy — each tenant keeps its own name (e.g. "Acme Global",
    // "TechStart Solutions", "Marq AI Tech Pvt Ltd", etc.). The old guard would
    // destroy that setup every time /api/seed was called.

    return NextResponse.json(
      {
        message: 'Database seeded successfully',
        data: {
          tenant: tenant.name,
          companyGroups: 2,
          companies: 3,
          branches: 5,
          departments: 8,
          designations: 14,
          users: demoUsers.length + additionalUsers.length,
          employees: employees.length,
          leaveTypes: leaveTypes.length,
          leaveRequests: leaveRequests.length,
          attendanceRecords: attendanceCount,
          payrollRecords: 10,
          jobPostings: jobPostings.length,
          jobApplications: applications.length,
          interviews: interviews.length,
          onboardingTasks: onboardingTasks.length,
          performanceReviews: reviews.length,
          goals: goals.length,
          trainings: trainings.length,
          assets: assets.length,
          documents: documents.length,
          travelRequests: travelRequests.length,
          expenseClaims: expenseClaims.length,
          timesheets: timesheets.length,
          feedbacks: feedbacks.length,
          promotions: promotions.length,
          grievances: grievances.length,
          separations: separations.length,
          notifications: notifications.length,
          policies: policies.length,
          holidays: holidays.length,
          announcements: announcements.length,
          shifts: shifts.length,
          reimbursements: reimbursements.length,
          incidentReports: incidentReports.length,
          rbac: { modulesCreated: rbacModulesCreated, permissionsCreated: rbacPermissionsCreated, rolesCreated: rbacRolesCreated, rolePermissionsCreated: rbacRolePermissionsCreated, userRoleAssignmentsCreated: rbacUserRoleAssignmentsCreated },
        },
      },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: 'Failed to seed database', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
