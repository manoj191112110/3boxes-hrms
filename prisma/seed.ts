import "dotenv/config";
import bcryptjs from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

// Setup Prisma client with Neon adapter (same pattern as src/lib/prisma.ts)
const connectionString = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('No database connection string found. Set POSTGRES_PRISMA_URL, POSTGRES_URL, or DATABASE_URL');
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function hashPassword(password: string): Promise<string> {
  const salt = await bcryptjs.genSalt(12);
  return bcryptjs.hash(password, salt);
}

const TENANT_SLUG = '3boxes-hrms-demo';

async function main() {
  console.log('🌱 Seeding database...');
  console.log('ℹ️  Using connection string prefix:', connectionString?.substring(0, 30) + '...');

  const existingTenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } });

  let tenant: Awaited<ReturnType<typeof prisma.tenant.create>>;
  let adminUser: Awaited<ReturnType<typeof prisma.user.create>>;
  let hrUser: Awaited<ReturnType<typeof prisma.user.create>> | undefined;
  let managerUser: Awaited<ReturnType<typeof prisma.user.create>> | undefined;
  let employeeUser: Awaited<ReturnType<typeof prisma.user.create>> | undefined;
  let recruiterUser: Awaited<ReturnType<typeof prisma.user.create>> | undefined;
  let candidateUser: Awaited<ReturnType<typeof prisma.user.create>> | undefined;
  let tcg: Awaited<ReturnType<typeof prisma.company.create>>;
  let mpi: Awaited<ReturnType<typeof prisma.company.create>>;

  if (existingTenant) {
    tenant = existingTenant;
    console.log(`\n⏭️  Tenant already exists (${tenant.name}) — skipping bootstrap data`);

    const users = await prisma.user.findMany({
      where: { tenantId: tenant.id },
    });
    const userByEmail = new Map(users.map((user) => [user.email, user]));
    const pickUser = (...emails: string[]) => emails.map((email) => userByEmail.get(email)).find(Boolean);

    adminUser =
      pickUser('admin@3boxeshrms.com', 'superadmin@3boxeshrms.com', 'tenantadmin@3boxeshrms.com') ??
      users.find((user) => user.role === 'super_admin');
    if (!adminUser) {
      throw new Error('Seed cannot continue — no admin user found for existing tenant');
    }

    hrUser = pickUser('hr@3boxeshrms.com', 'hr.tcg@3boxeshrms.com');
    managerUser = pickUser('manager@3boxeshrms.com', 'mgr1@3boxeshrms.com', 'mgr2@3boxeshrms.com');
    employeeUser = pickUser('employee@3boxeshrms.com') ?? users.find((user) => user.role === 'employee');
    recruiterUser = pickUser('recruiter@3boxeshrms.com');
    candidateUser = pickUser('candidate@3boxeshrms.com');

    const companies = await prisma.company.findMany({
      where: {
        code: { in: ['TCG', 'MPI'] },
        companyGroup: { tenantId: tenant.id },
      },
    });
    const companyByCode = new Map(companies.map((company) => [company.code, company]));
    const tcgCompany = companyByCode.get('TCG');
    const mpiCompany = companyByCode.get('MPI');
    if (!tcgCompany || !mpiCompany) {
      throw new Error('Seed bootstrap incomplete — missing companies TCG and/or MPI');
    }
    tcg = tcgCompany;
    mpi = mpiCompany;
  } else {
  // ==================== TENANT ====================
  console.log('\n📋 Creating Tenant...');
  tenant = await prisma.tenant.create({
    data: {
      name: '3 Boxes HRMS Demo',
      slug: TENANT_SLUG,
      domain: 'demo.3boxeshrms.com',
      plan: 'enterprise',
      status: 'active',
      country: 'US',
      currency: 'USD',
      timezone: 'America/New_York',
      // Candidate Portal addendum: enable AI features for the demo tenant so
      // HR can immediately try Talent Pool / AI Feedback buttons and
      // candidates can use the AI Resume Optimizer without needing an admin
      // to flip these flags manually first.
      aiFeedbackEnabled: true,
      resumeScoreThreshold: 0,
      talentPoolCrossCompanyEnabled: true,
      videoInterviewRetakeLimit: 2,
      videoRetentionDays: 90,
    },
  });
  console.log(`  ✓ Tenant: ${tenant.name} (${tenant.id})`);

  // ==================== COMPANY GROUP ====================
  console.log('\n📋 Creating Company Group...');
  const companyGroup = await prisma.companyGroup.create({
    data: {
      name: 'TechCorp Global Group',
      tenantId: tenant.id,
    },
  });
  console.log(`  ✓ CompanyGroup: ${companyGroup.name}`);

  // ==================== COMPANIES ====================
  console.log('\n📋 Creating Companies...');
  const [tcgCreated, mpiCreated, hfs] = await Promise.all([
    prisma.company.create({
      data: {
        name: 'TechCorp Global',
        code: 'TCG',
        companyGroupId: companyGroup.id,
        country: 'US',
        currency: 'USD',
        timezone: 'America/New_York',
        city: 'San Francisco',
        state: 'CA',
        email: 'info@techcorp.com',
        website: 'https://techcorp.com',
        status: 'active',
      },
    }),
    prisma.company.create({
      data: {
        name: 'ManufactPro Industries',
        code: 'MPI',
        companyGroupId: companyGroup.id,
        country: 'IN',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        city: 'Mumbai',
        state: 'MH',
        email: 'info@manufactpro.com',
        status: 'active',
      },
    }),
    prisma.company.create({
      data: {
        name: 'HealthFirst Solutions',
        code: 'HFS',
        companyGroupId: companyGroup.id,
        country: 'GB',
        currency: 'GBP',
        timezone: 'Europe/London',
        city: 'London',
        state: 'England',
        email: 'info@healthfirst.com',
        status: 'active',
      },
    }),
  ]);
  tcg = tcgCreated;
  mpi = mpiCreated;
  console.log(`  ✓ Created 3 companies: ${tcg.name}, ${mpi.name}, ${hfs.name}`);

  // ==================== BRANCHES ====================
  console.log('\n📋 Creating Branches...');
  const [sfBranch, nyBranch, mumbaiBranch, londonBranch] = await Promise.all([
    prisma.branch.create({
      data: { name: 'HQ San Francisco', code: 'TCG-SF', city: 'San Francisco', state: 'CA', country: 'US', companyId: tcg.id, status: 'active' },
    }),
    prisma.branch.create({
      data: { name: 'NYC Office', code: 'TCG-NY', city: 'New York', state: 'NY', country: 'US', companyId: tcg.id, status: 'active' },
    }),
    prisma.branch.create({
      data: { name: 'Mumbai HQ', code: 'MPI-MUM', city: 'Mumbai', state: 'MH', country: 'IN', companyId: mpi.id, status: 'active' },
    }),
    prisma.branch.create({
      data: { name: 'London Office', code: 'HFS-LON', city: 'London', state: 'England', country: 'GB', companyId: hfs.id, status: 'active' },
    }),
  ]);
  console.log(`  ✓ Created 4 branches`);

  // ==================== DEPARTMENTS ====================
  console.log('\n📋 Creating Departments...');
  const [engDept, hrDept, designDept, finDept, opsDept, salesDept, anaDept, recDept] = await Promise.all([
    prisma.department.create({ data: { name: 'Engineering', code: 'ENG', companyId: tcg.id, branchId: sfBranch.id, status: 'active' } }),
    prisma.department.create({ data: { name: 'Human Resources', code: 'HR', companyId: tcg.id, branchId: sfBranch.id, status: 'active' } }),
    prisma.department.create({ data: { name: 'Design', code: 'DSG', companyId: tcg.id, branchId: sfBranch.id, status: 'active' } }),
    prisma.department.create({ data: { name: 'Finance', code: 'FIN', companyId: tcg.id, branchId: nyBranch.id, status: 'active' } }),
    prisma.department.create({ data: { name: 'Operations', code: 'OPS', companyId: tcg.id, branchId: sfBranch.id, status: 'active' } }),
    prisma.department.create({ data: { name: 'Sales', code: 'SAL', companyId: tcg.id, branchId: nyBranch.id, status: 'active' } }),
    prisma.department.create({ data: { name: 'Analytics', code: 'ANA', companyId: tcg.id, branchId: sfBranch.id, status: 'active' } }),
    prisma.department.create({ data: { name: 'Recruitment', code: 'REC', companyId: tcg.id, branchId: sfBranch.id, status: 'active' } }),
  ]);
  console.log(`  ✓ Created 8 departments`);

  // ==================== DESIGNATIONS ====================
  console.log('\n📋 Creating Designations...');
  const [seniorDevDesg, hrManagerDesg, designerDesg, devOpsDesg, financeAnalystDesg, opsManagerDesg, recruiterDesg, dataScientistDesg] = await Promise.all([
    prisma.designation.create({ data: { title: 'Senior Software Engineer', departmentId: engDept.id, level: 4, minSalary: 120000, maxSalary: 180000, status: 'active' } }),
    prisma.designation.create({ data: { title: 'HR Manager', departmentId: hrDept.id, level: 5, minSalary: 90000, maxSalary: 130000, status: 'active' } }),
    prisma.designation.create({ data: { title: 'Product Designer', departmentId: designDept.id, level: 3, minSalary: 95000, maxSalary: 140000, status: 'active' } }),
    prisma.designation.create({ data: { title: 'DevOps Lead', departmentId: engDept.id, level: 4, minSalary: 130000, maxSalary: 175000, status: 'active' } }),
    prisma.designation.create({ data: { title: 'Finance Analyst', departmentId: finDept.id, level: 3, minSalary: 70000, maxSalary: 100000, status: 'active' } }),
    prisma.designation.create({ data: { title: 'Operations Manager', departmentId: opsDept.id, level: 4, minSalary: 85000, maxSalary: 120000, status: 'active' } }),
    prisma.designation.create({ data: { title: 'Recruiter', departmentId: recDept.id, level: 3, minSalary: 65000, maxSalary: 95000, status: 'active' } }),
    prisma.designation.create({ data: { title: 'Data Scientist', departmentId: anaDept.id, level: 4, minSalary: 110000, maxSalary: 160000, status: 'active' } }),
  ]);
  console.log(`  ✓ Created 8 designations`);

  // ==================== USERS ====================
  console.log('\n📋 Creating Users (with bcrypt-hashed passwords)...');
  const passwordHashes = await Promise.all([
    hashPassword('admin123'),
    hashPassword('hr123'),
    hashPassword('manager123'),
    hashPassword('employee123'),
    hashPassword('recruiter123'),
    hashPassword('candidate123'),
  ]);

  [adminUser, hrUser, managerUser, employeeUser, recruiterUser, candidateUser] = await Promise.all([
    prisma.user.create({
      data: { email: 'admin@3boxeshrms.com', password: passwordHashes[0], name: 'Admin 3Boxes', role: 'super_admin', status: 'active', tenantId: tenant.id },
    }),
    prisma.user.create({
      data: { email: 'hr@3boxeshrms.com', password: passwordHashes[1], name: 'Sarah Johnson', role: 'hr_admin', status: 'active', tenantId: tenant.id },
    }),
    prisma.user.create({
      data: { email: 'manager@3boxeshrms.com', password: passwordHashes[2], name: 'Priya Sharma', role: 'manager', status: 'active', tenantId: tenant.id },
    }),
    prisma.user.create({
      data: { email: 'employee@3boxeshrms.com', password: passwordHashes[3], name: 'Raj Patel', role: 'employee', status: 'active', tenantId: tenant.id },
    }),
    prisma.user.create({
      data: { email: 'recruiter@3boxeshrms.com', password: passwordHashes[4], name: 'Kim Chen', role: 'recruiter', status: 'active', tenantId: tenant.id },
    }),
    prisma.user.create({
      data: { email: 'candidate@3boxeshrms.com', password: passwordHashes[5], name: 'Alex Turner', role: 'candidate', status: 'active', tenantId: tenant.id },
    }),
  ]);
  console.log(`  ✓ Created 6 users: super_admin, hr_admin, manager, employee, recruiter, candidate`);

  // ==================== EMPLOYEES (for internal roles) ====================
  console.log('\n📋 Creating Employees...');
  const [hrEmployee, managerEmployee, employeeEmployee, recruiterEmployee] = await Promise.all([
    prisma.employee.create({
      data: {
        employeeId: 'EMP001',
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'hr@3boxeshrms.com',
        phone: '+1-555-0101',
        userId: hrUser.id,
        departmentId: hrDept.id,
        designationId: hrManagerDesg.id,
        branchId: sfBranch.id,
        companyId: tcg.id,
        dateOfJoining: new Date('2021-07-01'),
        dateOfBirth: new Date('1988-03-15'),
        gender: 'female',
        nationality: 'American',
        city: 'San Francisco',
        state: 'CA',
        country: 'US',
        status: 'active',
        salary: 115000,
        salaryCurrency: 'USD',
      },
    }),
    prisma.employee.create({
      data: {
        employeeId: 'EMP002',
        firstName: 'Priya',
        lastName: 'Sharma',
        email: 'manager@3boxeshrms.com',
        phone: '+1-555-0102',
        userId: managerUser.id,
        departmentId: opsDept.id,
        designationId: opsManagerDesg.id,
        branchId: sfBranch.id,
        companyId: tcg.id,
        dateOfJoining: new Date('2020-11-20'),
        dateOfBirth: new Date('1985-08-22'),
        gender: 'female',
        nationality: 'Indian',
        city: 'San Francisco',
        state: 'CA',
        country: 'US',
        status: 'active',
        salary: 105000,
        salaryCurrency: 'USD',
      },
    }),
    prisma.employee.create({
      data: {
        employeeId: 'EMP003',
        firstName: 'Raj',
        lastName: 'Patel',
        email: 'employee@3boxeshrms.com',
        phone: '+1-555-0103',
        userId: employeeUser.id,
        departmentId: engDept.id,
        designationId: seniorDevDesg.id,
        branchId: sfBranch.id,
        companyId: tcg.id,
        dateOfJoining: new Date('2022-03-15'),
        dateOfBirth: new Date('1992-06-10'),
        gender: 'male',
        nationality: 'Indian',
        city: 'San Francisco',
        state: 'CA',
        country: 'US',
        status: 'active',
        salary: 145000,
        salaryCurrency: 'USD',
      },
    }),
    prisma.employee.create({
      data: {
        employeeId: 'EMP004',
        firstName: 'Kim',
        lastName: 'Chen',
        email: 'recruiter@3boxeshrms.com',
        phone: '+1-555-0104',
        userId: recruiterUser.id,
        departmentId: recDept.id,
        designationId: recruiterDesg.id,
        branchId: sfBranch.id,
        companyId: tcg.id,
        dateOfJoining: new Date('2023-01-10'),
        dateOfBirth: new Date('1990-11-05'),
        gender: 'female',
        nationality: 'American',
        city: 'San Francisco',
        state: 'CA',
        country: 'US',
        status: 'active',
        salary: 85000,
        salaryCurrency: 'USD',
      },
    }),
  ]);
  console.log(`  ✓ Created 4 employee records for internal users`);

  // ==================== JOB POSTINGS ====================
  console.log('\n📋 Creating Job Postings (AI Interview sample data)...');
  const [job1, job2, job3, job4] = await Promise.all([
    prisma.jobPosting.create({
      data: {
        title: 'Senior Full-Stack Developer',
        departmentId: engDept.id,
        position: 'Senior Full-Stack Developer',
        location: 'San Francisco, CA',
        type: 'full-time',
        experience: '5-8 years',
        salary: '$140,000 - $180,000',
        description: 'We are looking for a senior full-stack developer to join our engineering team. You will be responsible for building and maintaining scalable web applications using modern technologies.',
        requirements: 'React, Node.js, TypeScript, PostgreSQL, 5+ years experience, strong system design skills',
        status: 'open',
        postedDate: new Date('2025-01-15'),
        closingDate: new Date('2025-03-15'),
        vacancies: 2,
      },
    }),
    prisma.jobPosting.create({
      data: {
        title: 'UX Research Lead',
        departmentId: designDept.id,
        position: 'UX Research Lead',
        location: 'Remote',
        type: 'full-time',
        experience: '6-9 years',
        salary: '$120,000 - $150,000',
        description: 'Lead UX research initiatives across products. Drive user-centered design through qualitative and quantitative research methods.',
        requirements: '6+ years UX research experience, mixed methods expertise, proficiency in research tools',
        status: 'open',
        postedDate: new Date('2025-01-10'),
        closingDate: new Date('2025-02-28'),
        vacancies: 1,
      },
    }),
    prisma.jobPosting.create({
      data: {
        title: 'Data Scientist',
        departmentId: anaDept.id,
        position: 'Data Scientist',
        location: 'Austin, TX',
        type: 'full-time',
        experience: '3-5 years',
        salary: '$110,000 - $145,000',
        description: 'Build ML models for business insights. Work with cross-functional teams to identify opportunities for data-driven decision making.',
        requirements: 'Python, TensorFlow/PyTorch, SQL, statistical analysis, 3+ years experience',
        status: 'open',
        postedDate: new Date('2025-01-20'),
        closingDate: new Date('2025-03-20'),
        vacancies: 1,
      },
    }),
    prisma.jobPosting.create({
      data: {
        title: 'HR Business Partner',
        departmentId: hrDept.id,
        position: 'HR Business Partner',
        location: 'New York, NY',
        type: 'full-time',
        experience: '7-10 years',
        salary: '$95,000 - $120,000',
        description: 'Seeking an experienced HR business partner to align people strategies with business objectives and drive organizational effectiveness.',
        requirements: '7+ years HR experience, PHR certification preferred, strong stakeholder management',
        status: 'filled',
        postedDate: new Date('2024-11-28'),
        closingDate: new Date('2025-01-15'),
        vacancies: 1,
      },
    }),
  ]);
  console.log(`  ✓ Created 4 job postings`);

  // ==================== JOB APPLICATIONS ====================
  console.log('\n📋 Creating Job Applications...');
  const [app1, app2, app3, app4, app5, app6, app7] = await Promise.all([
    // Application for Senior Full-Stack Developer - interview stage
    prisma.jobApplication.create({
      data: {
        jobPostingId: job1.id,
        candidateName: 'Alex Turner',
        candidateEmail: 'alex.turner@email.com',
        candidatePhone: '+1-555-1001',
        source: 'linkedin',
        status: 'interview',
        appliedDate: new Date('2025-01-18'),
        rating: 5,
        expectedSalary: '$160,000',
        notes: 'Strong candidate with Google background. Excellent technical skills.',
      },
    }),
    // Another application for Senior Full-Stack Developer - screening stage
    prisma.jobApplication.create({
      data: {
        jobPostingId: job1.id,
        candidateName: 'Maya Singh',
        candidateEmail: 'maya.singh@email.com',
        candidatePhone: '+1-555-1002',
        source: 'referral',
        status: 'screening',
        appliedDate: new Date('2025-01-20'),
        rating: 4,
        expectedSalary: '$175,000',
        notes: 'Referred by current employee. Amazon background.',
      },
    }),
    // Application for UX Research Lead - interview stage
    prisma.jobApplication.create({
      data: {
        jobPostingId: job2.id,
        candidateName: 'Sophie Martin',
        candidateEmail: 'sophie.martin@email.com',
        candidatePhone: '+1-555-1003',
        source: 'website',
        status: 'interview',
        appliedDate: new Date('2025-01-12'),
        rating: 4,
        expectedSalary: '$140,000',
        notes: 'Meta UX researcher, strong portfolio.',
      },
    }),
    // Application for Data Scientist - applied stage
    prisma.jobApplication.create({
      data: {
        jobPostingId: job3.id,
        candidateName: 'Wei Zhang',
        candidateEmail: 'wei.zhang@email.com',
        candidatePhone: '+1-555-1004',
        source: 'indeed',
        status: 'applied',
        appliedDate: new Date('2025-01-21'),
        rating: 3,
        expectedSalary: '$135,000',
      },
    }),
    // Application for HR Business Partner - hired (completed flow)
    prisma.jobApplication.create({
      data: {
        jobPostingId: job4.id,
        candidateName: 'James Williams',
        candidateEmail: 'james.williams@email.com',
        candidatePhone: '+1-555-1005',
        source: 'referral',
        status: 'hired',
        appliedDate: new Date('2024-12-01'),
        rating: 5,
        expectedSalary: '$110,000',
        notes: 'Exceptional candidate. Offer accepted.',
      },
    }),
    // Another application for Senior Full-Stack Developer - rejected
    prisma.jobApplication.create({
      data: {
        jobPostingId: job1.id,
        candidateName: 'Tom Baker',
        candidateEmail: 'tom.baker@email.com',
        candidatePhone: '+1-555-1006',
        source: 'website',
        status: 'rejected',
        appliedDate: new Date('2025-01-16'),
        rating: 2,
        expectedSalary: '$190,000',
        notes: 'Did not meet minimum technical requirements.',
      },
    }),
    // Application for Data Scientist - screening stage
    prisma.jobApplication.create({
      data: {
        jobPostingId: job3.id,
        candidateName: 'Lisa Park',
        candidateEmail: 'lisa.park@email.com',
        candidatePhone: '+1-555-1007',
        source: 'linkedin',
        status: 'screening',
        appliedDate: new Date('2025-01-22'),
        rating: 4,
        expectedSalary: '$125,000',
        notes: 'Strong ML background, published researcher.',
      },
    }),
  ]);
  console.log(`  ✓ Created 7 job applications in various stages`);

  // ==================== INTERVIEWS ====================
  console.log('\n📋 Creating Interviews (with AI scores and feedback)...');
  const [interview1, interview2, interview3, interview4, interview5, interview6] = await Promise.all([
    // Completed AI interview - Alex Turner for Full-Stack Developer
    prisma.interview.create({
      data: {
        jobApplicationId: app1.id,
        type: 'technical',
        date: new Date('2025-02-01T10:00:00Z'),
        time: '10:00 AM',
        duration: 60,
        location: 'Online',
        meetingUrl: 'https://meet.3boxeshrms.com/interview-alex-tech',
        interviewer: recruiterEmployee.id,
        status: 'completed',
        feedback: 'Strong technical skills demonstrated. Good problem-solving approach. Excellent communication.',
        score: 88,
        aiScore: 92,
        aiFeedback: 'Candidate demonstrated exceptional proficiency in React, Node.js, and TypeScript. Problem-solving approach was systematic and efficient. Communication skills rated 9/10. Recommended for next round. Key strengths: system design, algorithmic thinking, clean code practices.',
      },
    }),
    // Completed AI HR interview - Alex Turner
    prisma.interview.create({
      data: {
        jobApplicationId: app1.id,
        type: 'hr',
        date: new Date('2025-02-03T14:00:00Z'),
        time: '2:00 PM',
        duration: 45,
        location: 'Online',
        meetingUrl: 'https://meet.3boxeshrms.com/interview-alex-hr',
        interviewer: hrEmployee.id,
        status: 'completed',
        feedback: 'Good culture fit. Strong alignment with company values.',
        score: 85,
        aiScore: 89,
        aiFeedback: 'Candidate shows strong cultural alignment with organizational values. Leadership potential identified. Response consistency score: 94%. Behavioral indicators suggest high adaptability and team collaboration skills. Recommended for offer stage.',
      },
    }),
    // Scheduled AI interview - Sophie Martin for UX Research Lead
    prisma.interview.create({
      data: {
        jobApplicationId: app3.id,
        type: 'technical',
        date: new Date('2025-02-10T11:00:00Z'),
        time: '11:00 AM',
        duration: 60,
        location: 'Online',
        meetingUrl: 'https://meet.3boxeshrms.com/interview-sophie-tech',
        interviewer: recruiterEmployee.id,
        status: 'scheduled',
      },
    }),
    // Completed AI interview - James Williams for HR Business Partner (full cycle)
    prisma.interview.create({
      data: {
        jobApplicationId: app5.id,
        type: 'technical',
        date: new Date('2024-12-15T10:00:00Z'),
        time: '10:00 AM',
        duration: 60,
        location: 'Online',
        interviewer: hrEmployee.id,
        status: 'completed',
        feedback: 'Excellent HR knowledge. Strong stakeholder management experience.',
        score: 92,
        aiScore: 95,
        aiFeedback: 'Candidate demonstrated expert-level knowledge in HR business partnering. Strategic thinking score: 96%. Stakeholder management simulation: outstanding. Industry knowledge comprehensive. Strongly recommended for hire.',
      },
    }),
    // Completed AI final interview - James Williams
    prisma.interview.create({
      data: {
        jobApplicationId: app5.id,
        type: 'final',
        date: new Date('2024-12-20T15:00:00Z'),
        time: '3:00 PM',
        duration: 45,
        location: 'Online',
        interviewer: managerEmployee.id,
        status: 'completed',
        feedback: 'Final round cleared. Ready for offer.',
        score: 90,
        aiScore: 93,
        aiFeedback: 'Final assessment confirms strong fit for HR Business Partner role. Leadership assessment: excellent. Cultural fit: 95%. Communication: outstanding. Salary expectation alignment: within range. Proceed to offer stage.',
      },
    }),
    // Scheduled AI interview - Maya Singh for Full-Stack Developer
    prisma.interview.create({
      data: {
        jobApplicationId: app2.id,
        type: 'technical',
        date: new Date('2025-02-15T09:00:00Z'),
        time: '9:00 AM',
        duration: 60,
        location: 'Online',
        meetingUrl: 'https://meet.3boxeshrms.com/interview-maya-tech',
        interviewer: recruiterEmployee.id,
        status: 'scheduled',
      },
    }),
  ]);
  console.log(`  ✓ Created 6 interviews (4 completed with AI scores, 2 scheduled)`);

  // ==================== LEAVE TYPES ====================
  console.log('\n📋 Creating Leave Types...');
  const [casualLeave, sickLeave, paidLeave] = await Promise.all([
    prisma.leaveType.create({
      data: { name: 'Casual Leave', code: 'CL', description: 'Casual leave for personal matters', defaultDays: 12, isPaid: true, carryForward: true, maxCarryForward: 3, status: 'active' },
    }),
    prisma.leaveType.create({
      data: { name: 'Sick Leave', code: 'SL', description: 'Sick leave for medical reasons', defaultDays: 10, isPaid: true, carryForward: false, status: 'active' },
    }),
    prisma.leaveType.create({
      data: { name: 'Paid Leave', code: 'PL', description: 'Earned paid leave', defaultDays: 15, isPaid: true, carryForward: true, maxCarryForward: 5, status: 'active' },
    }),
  ]);
  console.log(`  ✓ Created 3 leave types`);

  // ==================== DEFAULT POLICIES ====================
  console.log('\n📋 Creating Default Policies for each company...');

  const defaultPoliciesByCategory: Record<string, Array<{ title: string; category: string; description: string; content: string }>> = {
    leave: [
      {
        title: 'India Leave Policy',
        category: 'leave',
        description: 'Default leave policy for India-based employees per Shops & Establishments Act',
        content: JSON.stringify({
          annualLeave: 15, sickLeave: 7, casualLeave: 7, maternityLeave: 182, paternityLeave: 15,
          carryForward: true, maxCarryForward: 5, encashmentAllowed: true, encashmentRate: 1.0,
          probationLeaveCap: 2, leaveAccrual: 'monthly', weekendBetweenLeave: 'exclude',
          publicHolidayBetweenLeave: 'exclude',
        }),
      },
      {
        title: 'US Leave Policy',
        category: 'leave',
        description: 'Default leave policy for US-based employees per FLSA',
        content: JSON.stringify({
          annualLeave: 10, sickLeave: 10, casualLeave: 0, maternityLeave: 0, paternityLeave: 5,
          carryForward: true, maxCarryForward: 5, encashmentAllowed: true, encashmentRate: 1.0,
          probationLeaveCap: 0, leaveAccrual: 'biweekly', fmlaEligible: true, fmlaWeeks: 12,
        }),
      },
      {
        title: 'UK Leave Policy',
        category: 'leave',
        description: 'Default leave policy for UK-based employees per Employment Rights Act 1996',
        content: JSON.stringify({
          annualLeave: 20, sickLeave: 10, casualLeave: 0, maternityLeave: 52, paternityLeave: 2,
          carryForward: true, maxCarryForward: 5, encashmentAllowed: false,
          bankHolidays: 8, statutorySickPayWeeks: 28,
        }),
      },
    ],
    travel: [
      {
        title: 'Domestic Travel Policy',
        category: 'travel',
        description: 'Default domestic travel policy for all employees',
        content: JSON.stringify({
          travelClass: { junior: 'economy', mid: 'economy', senior: 'business' },
          accommodation: { junior: 3000, mid: 5000, senior: 8000 },
          dailyAllowance: { junior: 800, mid: 1200, senior: 2000 },
          conveyanceAllowance: 300, mealAllowance: 500,
          advanceDays: 7, settlementDays: 5, approvalRequired: true,
          documentationRequired: true, gstMandatory: true,
        }),
      },
      {
        title: 'International Travel Policy',
        category: 'travel',
        description: 'Default international travel policy for all employees',
        content: JSON.stringify({
          travelClass: { junior: 'economy', mid: 'economy', senior: 'business' },
          accommodation: { junior: 150, mid: 200, senior: 350, currency: 'USD' },
          dailyAllowance: { junior: 75, mid: 100, senior: 150, currency: 'USD' },
          visaFeeReimbursement: true, travelInsurance: true, airportTransfer: true,
          advanceDays: 10, settlementDays: 7, multiCurrencySettlement: true,
          forexAdvanceAllowed: true, maxForexAdvance: 5000,
        }),
      },
    ],
    attendance: [
      {
        title: 'India Attendance Policy',
        category: 'attendance',
        description: 'Default attendance policy for India — 9 hours / 48 hours per week',
        content: JSON.stringify({
          workingHoursPerDay: 9, workingDaysPerWeek: 6, workingHoursPerWeek: 48,
          shiftTiming: { start: '09:00', end: '18:00', gracePeriod: 15 },
          halfDayThreshold: 4, lateMarkAfter: 15, earlyLeaveBefore: 15,
          overtimeMultiplier: 2.0, maxOvertimePerWeek: 12, compOffEnabled: true, compOffExpiryDays: 30,
          attendanceMode: 'biometric', weekendPolicy: 'alternate_saturday',
        }),
      },
      {
        title: 'US/International Attendance Policy',
        category: 'attendance',
        description: 'Default attendance policy for US and international offices — 8 hours / 40 hours per week',
        content: JSON.stringify({
          workingHoursPerDay: 8, workingDaysPerWeek: 5, workingHoursPerWeek: 40,
          shiftTiming: { start: '09:00', end: '17:00', gracePeriod: 10 },
          halfDayThreshold: 4, lateMarkAfter: 10, earlyLeaveBefore: 10,
          overtimeMultiplier: 1.5, maxOvertimePerWeek: 12, compOffEnabled: false,
          attendanceMode: 'web', weekendPolicy: 'saturday_sunday_off',
        }),
      },
    ],
    payroll: [
      {
        title: 'India Payroll Policy',
        category: 'payroll',
        description: 'Indian payroll policy with PF, ESI, PT, TDS, Gratuity compliance',
        content: JSON.stringify({
          frequency: 'monthly', processingDay: 25, paymentDay: 1, cutOffDay: 20,
          currency: 'INR', taxRegime: 'new',
          statutoryComponents: {
            pf: { employeeRate: 12, employerRate: 12, wageCap: 15000 },
            esi: { employeeRate: 0.75, employerRate: 3.25, wageCap: 21000 },
            professionalTax: { slabs: [{ range: '0-10000', amount: 0 }, { range: '10001-15000', amount: 150 }, { range: '15001+', amount: 200 }] },
            labourWelfareFund: { employeeRate: 25, employerRate: 75 },
            tds: { applicable: true, regime: 'new', deductions: ['standard_deduction_50000'] },
          },
          gratuity: { eligibleAfterYears: 5, rate: 15, baseDays: 26, maxCap: 2000000 },
          minWage: { national: 17800, stateSpecific: true },
          ltc: { applicable: true, frequency: 'biennial', carryForward: true },
        }),
      },
    ],
  };

  let totalPolicies = 0;
  for (const company of [tcg, mpi, hfs]) {
    const countryCode = company.country;
    for (const [category, policies] of Object.entries(defaultPoliciesByCategory)) {
      for (const p of policies) {
        // For leave/attendance/payroll, create the appropriate country-specific policy
        // For travel, create both policies for all companies
        const isCountrySpecific = ['leave', 'attendance'].includes(category);
        const matchesCountry = isCountrySpecific
          ? p.title.includes(countryCode === 'IN' ? 'India' : countryCode === 'US' ? 'US' : countryCode === 'GB' ? 'UK' : 'International')
          : true;

        // Always include payroll for India company, travel for all
        if (category === 'payroll' && countryCode !== 'IN') continue;
        if (isCountrySpecific && !matchesCountry) {
          // If no exact match, use the International/default version
          if (!p.title.includes('International') && !p.title.includes('US/') && countryCode !== 'IN' && countryCode !== 'US' && countryCode !== 'GB') {
            continue; // Skip country-specific for non-matching countries
          }
        }

        try {
          await prisma.policy.create({
            data: {
              title: p.title,
              category: p.category,
              description: p.description,
              content: p.content,
              version: '1.0',
              status: 'active',
              effectiveDate: new Date(),
              companyId: company.id,
            },
          });
          totalPolicies++;
        } catch {
          // Skip if already exists
        }
      }
    }
  }
  console.log(`  ✓ Created ${totalPolicies} default policies across companies`);

  // ==================== LEAVE BALANCES ====================
  console.log('\n📋 Creating Leave Balances...');
  const currentYear = new Date().getFullYear();
  await Promise.all([
    // Sarah (HR) leave balances
    prisma.leaveBalance.create({ data: { employeeId: hrEmployee.id, leaveTypeId: casualLeave.id, year: currentYear, total: 12, used: 3, remaining: 9, carryForward: 2 } }),
    prisma.leaveBalance.create({ data: { employeeId: hrEmployee.id, leaveTypeId: sickLeave.id, year: currentYear, total: 10, used: 2, remaining: 8, carryForward: 0 } }),
    prisma.leaveBalance.create({ data: { employeeId: hrEmployee.id, leaveTypeId: paidLeave.id, year: currentYear, total: 15, used: 5, remaining: 10, carryForward: 3 } }),
    // Raj (Employee) leave balances
    prisma.leaveBalance.create({ data: { employeeId: employeeEmployee.id, leaveTypeId: casualLeave.id, year: currentYear, total: 12, used: 1, remaining: 11, carryForward: 0 } }),
    prisma.leaveBalance.create({ data: { employeeId: employeeEmployee.id, leaveTypeId: sickLeave.id, year: currentYear, total: 10, used: 0, remaining: 10, carryForward: 0 } }),
    prisma.leaveBalance.create({ data: { employeeId: employeeEmployee.id, leaveTypeId: paidLeave.id, year: currentYear, total: 15, used: 2, remaining: 13, carryForward: 5 } }),
  ]);
  console.log(`  ✓ Created leave balances`);

  // ==================== ATTENDANCE ====================
  console.log('\n📋 Creating Attendance records...');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await Promise.all([
    prisma.attendance.create({ data: { employeeId: hrEmployee.id, date: today, checkIn: new Date(today.getTime() + 9 * 3600000 + 2 * 60000), checkOut: new Date(today.getTime() + 18 * 3600000 + 15 * 60000), workHours: 8.5, status: 'present' } }),
    prisma.attendance.create({ data: { employeeId: employeeEmployee.id, date: today, checkIn: new Date(today.getTime() + 8 * 3600000 + 50 * 60000), checkOut: new Date(today.getTime() + 17 * 3600000 + 45 * 60000), workHours: 8.0, status: 'present' } }),
    prisma.attendance.create({ data: { employeeId: managerEmployee.id, date: today, checkIn: new Date(today.getTime() + 9 * 3600000 + 35 * 60000), checkOut: new Date(today.getTime() + 18 * 3600000 + 30 * 60000), workHours: 8.0, status: 'late' } }),
  ]);
  console.log(`  ✓ Created 3 attendance records`);

  // ==================== NOTIFICATIONS ====================
  console.log('\n📋 Creating Notifications...');
  await Promise.all([
    prisma.notification.create({ data: { tenantId: tenant.id, userId: hrUser.id, title: 'New Job Application', message: 'Alex Turner has applied for Senior Full-Stack Developer', type: 'info', category: 'recruitment', isRead: false } }),
    prisma.notification.create({ data: { tenantId: tenant.id, userId: hrUser.id, title: 'Interview Scheduled', message: 'AI Technical interview with Sophie Martin on Feb 10', type: 'info', category: 'recruitment', isRead: false } }),
    prisma.notification.create({ data: { tenantId: tenant.id, userId: recruiterUser.id, title: 'AI Interview Completed', message: 'AI interview for Alex Turner has been completed with score 92/100', type: 'success', category: 'recruitment', isRead: true } }),
    prisma.notification.create({ data: { tenantId: tenant.id, userId: adminUser.id, title: 'New Candidate Registered', message: 'Candidate Alex Turner has registered on the platform', type: 'info', category: 'recruitment', isRead: false } }),
    prisma.notification.create({ data: { tenantId: tenant.id, userId: managerUser.id, title: 'Leave Request', message: 'Raj Patel has submitted a leave request', type: 'info', category: 'leave', isRead: false } }),
  ]);
  console.log(`  ✓ Created 5 notifications`);

  // ==================== SUBSCRIPTION PLAN ====================
  console.log('\n📋 Creating Subscription Plan...');
  const plan = await prisma.subscriptionPlan.create({
    data: {
      name: 'Enterprise',
      planType: 'enterprise',
      monthlyPrice: 299,
      annualPrice: 2990,
      employeeLimit: 500,
      companyLimit: 10,
      branchLimit: 50,
      storageLimit: 50000,
      aiInterviewLimit: 500,
      aiChatbotLimit: 5000,
      payrollEnabled: true,
      recruitmentEnabled: true,
      attendanceEnabled: true,
      projectEnabled: true,
      clientPortalEnabled: true,
      vendorPortalEnabled: true,
      mobileAppEnabled: true,
      apiAccessEnabled: true,
      whiteLabelEnabled: false,
      supportLevel: 'dedicated',
      status: 'active',
      description: 'Full-featured enterprise plan with AI capabilities',
    },
  });
  console.log(`  ✓ Created subscription plan: ${plan.name}`);

  // Subscription
  await prisma.subscription.create({
    data: {
      tenantId: tenant.id,
      planId: plan.id,
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
      billingCycle: 'annual',
      amount: 2990,
      currency: 'USD',
      paymentStatus: 'paid',
      status: 'active',
      autoRenew: true,
    },
  });
  console.log(`  ✓ Created subscription for tenant`);
  }

  // ==================== RBAC - MODULES & PERMISSIONS ====================
  console.log('\n📋 Creating RBAC Modules & Permissions...');

  const MODULE_DEFINITIONS = [
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
    { key: 'tenant_configuration', name: 'Tenant Configuration', category: 'Admin', icon: 'Settings', sortOrder: 38 },
    { key: 'subscriptions', name: 'Subscriptions', category: 'Admin', icon: 'CreditCard', sortOrder: 39 },
    { key: 'packages', name: 'Packages', category: 'Admin', icon: 'Package', sortOrder: 40 },
    { key: 'domain_management', name: 'Domain Management', category: 'Admin', icon: 'Globe', sortOrder: 41 },
    { key: 'purchase_transactions', name: 'Purchase Transactions', category: 'Admin', icon: 'DollarSign', sortOrder: 42 },
    { key: 'tenant_usage', name: 'Tenant Usage Metrics', category: 'Admin', icon: 'BarChart2', sortOrder: 43 },
    { key: 'tenant_tickets', name: 'Tenant Support Tickets', category: 'Admin', icon: 'HelpCircle', sortOrder: 44 },
    { key: 'storage_quotas', name: 'Storage Quotas', category: 'Admin', icon: 'HardDrive', sortOrder: 45 },
    { key: 'sso_providers', name: 'SSO Providers', category: 'Admin', icon: 'Lock', sortOrder: 46 },
    { key: 'trial_requests', name: 'Trial Requests', category: 'Admin', icon: 'Briefcase', sortOrder: 47 },
    { key: 'rbac', name: 'RBAC Management', category: 'Admin', icon: 'Shield', sortOrder: 48 },
    { key: 'storage_analytics', name: 'Storage Analytics', category: 'Admin', icon: 'Database', sortOrder: 49 },
    { key: 'comm_governance', name: 'Communication Governance', category: 'Admin', icon: 'MessageCircle', sortOrder: 50 },
    { key: 'invoices', name: 'Invoices', category: 'Finance', icon: 'FileText', sortOrder: 51 },
    { key: 'accounts', name: 'Accounts', category: 'Finance', icon: 'Wallet', sortOrder: 52 },
    { key: 'crm', name: 'CRM', category: 'External', icon: 'Users', sortOrder: 53 },
    { key: 'separation', name: 'Separation', category: 'Lifecycle', icon: 'UserMinus', sortOrder: 54 },
    { key: 'insurance', name: 'Insurance', category: 'Benefits', icon: 'HeartShield', sortOrder: 55 },
    { key: 'loans', name: 'Loans', category: 'Compensation', icon: 'Banknote', sortOrder: 56 },
    { key: 'claims', name: 'Claims', category: 'Compensation', icon: 'FileCheck', sortOrder: 57 },
  ];

  const LIMITED_ACTION_MODULES = ['dashboard', 'notifications', 'docs'];
  const DEFAULT_ACTIONS = ['view', 'create', 'edit', 'delete', 'export', 'approve'];

  const moduleMap = new Map<string, string>(); // key -> id
  const permissionMap = new Map<string, string>(); // moduleId:action -> permissionId
  let modulesCreated = 0;
  let permissionsCreated = 0;

  for (const modDef of MODULE_DEFINITIONS) {
    const existingModule = await prisma.module.findUnique({ where: { key: modDef.key } });
    if (existingModule) {
      moduleMap.set(modDef.key, existingModule.id);
      // Load existing permissions
      const existingPerms = await prisma.permission.findMany({ where: { moduleId: existingModule.id } });
      for (const perm of existingPerms) {
        permissionMap.set(`${existingModule.id}:${perm.action}`, perm.id);
      }
      continue;
    }

    const createdModule = await prisma.module.create({
      data: {
        key: modDef.key,
        name: modDef.name,
        category: modDef.category,
        icon: modDef.icon,
        sortOrder: modDef.sortOrder,
      },
    });
    moduleMap.set(modDef.key, createdModule.id);

    const actions = LIMITED_ACTION_MODULES.includes(modDef.key) ? ['view'] : DEFAULT_ACTIONS;
    for (const action of actions) {
      const perm = await prisma.permission.create({
        data: {
          moduleId: createdModule.id,
          action,
          description: `${action} ${modDef.name.toLowerCase()}`,
        },
      });
      permissionMap.set(`${createdModule.id}:${action}`, perm.id);
      permissionsCreated++;
    }
    modulesCreated++;
  }
  console.log(`  ✓ Created ${modulesCreated} modules, ${permissionsCreated} permissions`);

  // ==================== RBAC - SYSTEM ROLES ====================
  console.log('\n📋 Creating RBAC System Roles...');

  const SYSTEM_ROLES = [
    { key: 'super_admin', name: 'Super Administrator', description: 'Full system access across all tenants — manages platform configuration, RBAC, audit logs, and all tenant operations', level: 0, isSystem: true, tenantId: null as string | null },
    { key: 'tenant_admin', name: 'Tenant Administrator', description: 'Full access within their tenant — manages company RBAC, organization settings, and all HR operations', level: 1, isSystem: true, tenantId: null as string | null },
    { key: 'hr_admin', name: 'HR Manager / HR Admin', description: 'Manages all HR operations including recruitment, onboarding, employee lifecycle, leave, attendance, performance, training, and HR policies', level: 2, isSystem: true, tenantId: tenant.id },
    { key: 'finance_admin', name: 'Finance Manager / Finance Admin', description: 'Manages payroll, salary structures, expenses, invoices, accounts, loans, claims, and financial reporting', level: 2, isSystem: true, tenantId: tenant.id },
    { key: 'manager', name: 'Manager', description: 'Manages team operations — view employees, approve leaves/expenses/travel, manage performance reviews, and assign tasks', level: 3, isSystem: true, tenantId: tenant.id },
    { key: 'travel_admin', name: 'Travel Admin', description: 'Manages travel requests, approvals, policies, and travel expense settlements', level: 3, isSystem: true, tenantId: tenant.id },
    { key: 'crm_admin', name: 'CRM Admin', description: 'Manages clients, vendors, CRM operations, and external relationship management', level: 3, isSystem: true, tenantId: tenant.id },
    { key: 'employee', name: 'Employee', description: 'Self-service access — view own profile, apply leave/expenses/travel, submit timesheets, access helpdesk and documents', level: 4, isSystem: true, tenantId: tenant.id },
  ];

  const roleMap = new Map<string, string>(); // key -> id
  let rolesCreated = 0;

  for (const roleDef of SYSTEM_ROLES) {
    const existingRole = await prisma.role.findFirst({
      where: {
        key: roleDef.key,
        tenantId: roleDef.tenantId,
        companyId: null,
      },
    });

    if (existingRole) {
      roleMap.set(roleDef.key, existingRole.id);
      continue;
    }

    const role = await prisma.role.create({
      data: {
        name: roleDef.name,
        key: roleDef.key,
        description: roleDef.description,
        isSystem: roleDef.isSystem,
        level: roleDef.level,
        tenantId: roleDef.tenantId,
        status: 'active',
        createdBy: adminUser.id,
      },
    });
    roleMap.set(roleDef.key, role.id);
    rolesCreated++;
  }
  console.log(`  ✓ Created ${rolesCreated} system roles`);

  // ==================== RBAC - ROLE PERMISSIONS ====================
  console.log('\n📋 Assigning Role Permissions...');

  const ADMIN_ONLY_MODULES = ['super_admin', 'ai_admin'];
  const HR_ADMIN_FULL_MODULES = [
    'dashboard', 'employees', 'company', 'recruitment', 'requisitions', 'offers',
    'job_portal', 'ai_interview', 'onboarding', 'preboarding', 'attendance',
    'leave', 'performance', 'training', 'engagement', 'succession', 'separation',
    'documents', 'helpdesk', 'grievances', 'settings', 'reports', 'notifications',
    'workflows', 'insurance',
  ];
  const HR_ADMIN_LIMITED_MODULES = ['timesheets', 'payroll', 'salary_structures', 'assets', 'ai_assistant', 'docs'];
  const FINANCE_ADMIN_FULL_MODULES = [
    'dashboard', 'payroll', 'salary_structures', 'expenses', 'invoices', 'accounts',
    'loans', 'claims', 'timesheets', 'reports', 'settings',
  ];
  const FINANCE_ADMIN_LIMITED_MODULES = ['employees', 'company', 'attendance', 'leave', 'documents', 'notifications', 'travel'];
  const MANAGER_FULL_MODULES = [
    'dashboard', 'employees', 'attendance', 'leave', 'timesheets', 'performance',
    'training', 'engagement', 'succession', 'expenses', 'travel', 'projects', 'reports',
  ];
  const MANAGER_VIEW_MODULES = ['payroll', 'salary_structures', 'company', 'recruitment', 'onboarding', 'documents', 'notifications', 'helpdesk'];
  const TRAVEL_ADMIN_FULL_MODULES = ['dashboard', 'travel', 'expenses', 'reports', 'settings', 'docs', 'notifications'];
  const TRAVEL_ADMIN_LIMITED_MODULES = ['employees', 'company', 'documents'];
  const CRM_ADMIN_FULL_MODULES = ['dashboard', 'clients', 'vendors', 'reports', 'settings', 'docs', 'notifications'];
  const CRM_ADMIN_LIMITED_MODULES = ['employees', 'expenses', 'invoices', 'accounts', 'documents'];
  const EMPLOYEE_VIEW_MODULES = ['dashboard', 'company', 'insurance', 'helpdesk', 'grievances', 'documents', 'notifications', 'docs'];
  const EMPLOYEE_SELFSERVICE_MODULES = ['leave', 'attendance', 'timesheets', 'expenses', 'travel', 'training', 'assets', 'performance'];

  let rolePermissionsCreated = 0;

  const assignPermissions = async (roleKey: string, moduleKeys: string[], allowedActions?: string[]) => {
    const roleId = roleMap.get(roleKey);
    if (!roleId) return;
    for (const moduleKey of moduleKeys) {
      const moduleId = moduleMap.get(moduleKey);
      if (!moduleId) continue;
      for (const action of allowedActions || DEFAULT_ACTIONS) {
        const permId = permissionMap.get(`${moduleId}:${action}`);
        if (!permId) continue;
        try {
          await prisma.rolePermission.create({
            data: { roleId, permissionId: permId, granted: true },
          });
          rolePermissionsCreated++;
        } catch {
          // Skip if already exists (unique constraint)
        }
      }
    }
  };

  // super_admin gets ALL permissions
  await assignPermissions('super_admin', MODULE_DEFINITIONS.map((m) => m.key));

  // tenant_admin gets all except admin-only modules
  const tenantAdminModules = MODULE_DEFINITIONS.filter((m) => !ADMIN_ONLY_MODULES.includes(m.key)).map((m) => m.key);
  await assignPermissions('tenant_admin', tenantAdminModules);

  // hr_admin gets full actions on HR modules + limited on secondary
  await assignPermissions('hr_admin', HR_ADMIN_FULL_MODULES);
  await assignPermissions('hr_admin', HR_ADMIN_LIMITED_MODULES, ['view', 'create', 'edit', 'export']);

  // finance_admin gets full actions on finance modules + limited on related
  await assignPermissions('finance_admin', FINANCE_ADMIN_FULL_MODULES);
  await assignPermissions('finance_admin', FINANCE_ADMIN_LIMITED_MODULES, ['view', 'create', 'edit', 'export']);

  // manager gets view+create+edit+approve on team modules + view-only on others
  await assignPermissions('manager', MANAGER_FULL_MODULES, ['view', 'create', 'edit', 'approve']);
  await assignPermissions('manager', MANAGER_VIEW_MODULES, ['view']);

  // travel_admin gets full actions on travel modules + limited on related
  await assignPermissions('travel_admin', TRAVEL_ADMIN_FULL_MODULES);
  await assignPermissions('travel_admin', TRAVEL_ADMIN_LIMITED_MODULES, ['view', 'create', 'edit']);

  // crm_admin gets full actions on CRM modules + limited on related
  await assignPermissions('crm_admin', CRM_ADMIN_FULL_MODULES);
  await assignPermissions('crm_admin', CRM_ADMIN_LIMITED_MODULES, ['view', 'create', 'edit']);

  // employee: view-only on base modules, self-service (view+create) on applicable modules
  await assignPermissions('employee', EMPLOYEE_VIEW_MODULES, ['view']);
  await assignPermissions('employee', EMPLOYEE_SELFSERVICE_MODULES, ['view', 'create']);

  console.log(`  ✓ Created ${rolePermissionsCreated} role-permission assignments`);

  // ==================== RBAC - USER ROLE ASSIGNMENTS ====================
  console.log('\n📋 Assigning User Roles...');

  const userRoleMap: Array<{ userId: string; roleKey: string; companyId?: string }> = [
    { userId: adminUser.id, roleKey: 'super_admin' },
    ...(hrUser ? [{ userId: hrUser.id, roleKey: 'hr_admin', companyId: tcg.id }] : []),
    ...(managerUser ? [{ userId: managerUser.id, roleKey: 'manager', companyId: tcg.id }] : []),
    ...(employeeUser ? [{ userId: employeeUser.id, roleKey: 'employee', companyId: tcg.id }] : []),
    ...(recruiterUser ? [{ userId: recruiterUser.id, roleKey: 'hr_admin', companyId: mpi.id }] : []),
    ...(candidateUser ? [{ userId: candidateUser.id, roleKey: 'employee' }] : []),
  ];

  let userRolesAssigned = 0;
  for (const assignment of userRoleMap) {
    const roleId = roleMap.get(assignment.roleKey);
    if (!roleId) continue;
    try {
      await prisma.userRoleAssignment.create({
        data: {
          userId: assignment.userId,
          roleId,
          companyId: assignment.companyId || null,
          assignedBy: adminUser.id,
        },
      });
      userRolesAssigned++;
    } catch {
      // Skip if already exists (unique constraint)
    }
  }
  console.log(`  ✓ Assigned ${userRolesAssigned} user-role assignments`);

  // ==================== TENANT CONFIGURATION ====================
  console.log('\n📋 Creating Tenant Configuration with sample data...');

  // Check if TenantConfiguration already exists for this tenant
  const existingConfig = await prisma.tenantConfiguration.findUnique({
    where: { tenantId: tenant.id },
    include: { countries: { where: { isActive: true } } },
  });

  if (!existingConfig || existingConfig.countries.length === 0) {
    // Delete existing empty config if it exists
    if (existingConfig) {
      await prisma.tenantConfiguration.delete({ where: { id: existingConfig.id } });
    }

    // Master data for tenant configuration (matching API route)
    const COUNTRY_DATA = [
      { code: 'IN', name: 'India', currency: 'INR', language: 'hi', payrollFrequency: 'MONTHLY', taxRegime: 'NEW', workingHours: 48, workingDays: 6, overtimeMultiplier: 2.0, pf: true, esi: true, gratuity: true, socialSecurity: false, pension: false, medicaid: false, labourLaw: 'Shops & Establishments Act', terminationNotice: 30, probation: 180, annualLeave: 15, dataResidency: false, dataRegion: 'ap-south-1' },
      { code: 'US', name: 'United States', currency: 'USD', language: 'en', payrollFrequency: 'SEMI_MONTHLY', taxRegime: 'PROGRESSIVE', workingHours: 40, workingDays: 5, overtimeMultiplier: 1.5, pf: false, esi: false, gratuity: false, socialSecurity: true, pension: false, medicaid: true, labourLaw: 'FLSA', terminationNotice: 14, probation: 90, annualLeave: 10, dataResidency: false, dataRegion: 'us-east-1' },
      { code: 'GB', name: 'United Kingdom', currency: 'GBP', language: 'en', payrollFrequency: 'MONTHLY', taxRegime: 'PROGRESSIVE', workingHours: 40, workingDays: 5, overtimeMultiplier: 1.5, pf: false, esi: false, gratuity: false, socialSecurity: true, pension: true, medicaid: false, labourLaw: 'Employment Rights Act 1996', terminationNotice: 28, probation: 180, annualLeave: 20, dataResidency: false, dataRegion: 'eu-west-2' },
      { code: 'AE', name: 'United Arab Emirates', currency: 'AED', language: 'ar', payrollFrequency: 'MONTHLY', taxRegime: null, workingHours: 40, workingDays: 5, overtimeMultiplier: 1.5, pf: false, esi: false, gratuity: true, socialSecurity: false, pension: false, medicaid: false, labourLaw: 'UAE Labour Law', terminationNotice: 30, probation: 180, annualLeave: 21, dataResidency: false, dataRegion: 'me-south-1' },
      { code: 'SG', name: 'Singapore', currency: 'SGD', language: 'en', payrollFrequency: 'MONTHLY', taxRegime: 'PROGRESSIVE', workingHours: 44, workingDays: 5, overtimeMultiplier: 1.5, pf: false, esi: false, gratuity: false, socialSecurity: true, pension: true, medicaid: false, labourLaw: 'Employment Act', terminationNotice: 14, probation: 90, annualLeave: 7, dataResidency: false, dataRegion: 'ap-southeast-1' },
      { code: 'AU', name: 'Australia', currency: 'AUD', language: 'en', payrollFrequency: 'MONTHLY', taxRegime: 'PROGRESSIVE', workingHours: 38, workingDays: 5, overtimeMultiplier: 1.5, pf: false, esi: false, gratuity: true, socialSecurity: true, pension: true, medicaid: true, labourLaw: 'Fair Work Act 2009', terminationNotice: 28, probation: 180, annualLeave: 20, dataResidency: false, dataRegion: 'ap-southeast-2' },
      { code: 'CA', name: 'Canada', currency: 'CAD', language: 'en', payrollFrequency: 'SEMI_MONTHLY', taxRegime: 'PROGRESSIVE', workingHours: 40, workingDays: 5, overtimeMultiplier: 1.5, pf: false, esi: false, gratuity: false, socialSecurity: true, pension: true, medicaid: true, labourLaw: 'Canada Labour Code', terminationNotice: 14, probation: 90, annualLeave: 10, dataResidency: false, dataRegion: 'ca-central-1' },
      { code: 'DE', name: 'Germany', currency: 'EUR', language: 'de', payrollFrequency: 'MONTHLY', taxRegime: 'PROGRESSIVE', workingHours: 40, workingDays: 5, overtimeMultiplier: 1.5, pf: false, esi: false, gratuity: false, socialSecurity: true, pension: true, medicaid: true, labourLaw: 'Arbeitsgesetz', terminationNotice: 28, probation: 180, annualLeave: 20, dataResidency: true, dataRegion: 'eu-central-1' },
    ];

    const CURRENCY_DATA = [
      { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
      { code: 'USD', name: 'US Dollar', symbol: '$' },
      { code: 'EUR', name: 'Euro', symbol: '€' },
      { code: 'GBP', name: 'British Pound', symbol: '£' },
      { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
      { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
      { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
      { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
    ];

    const LANGUAGE_DATA = [
      { code: 'en', name: 'English', rtl: false, ui: true, docs: true, email: true, help: true },
      { code: 'hi', name: 'Hindi', rtl: false, ui: true, docs: true, email: true, help: false },
      { code: 'ar', name: 'Arabic', rtl: true, ui: true, docs: true, email: true, help: false },
      { code: 'de', name: 'German', rtl: false, ui: true, docs: true, email: true, help: true },
      { code: 'fr', name: 'French', rtl: false, ui: true, docs: true, email: true, help: true },
    ];

    // Helper to generate default policies for a country
    function getSeedPoliciesForCountry(country: typeof COUNTRY_DATA[0]) {
      const policies: Array<{ policyName: string; policyType: string; category: string; policyContent: string }> = [];

      policies.push({
        policyName: `${country.name} — Payroll Frequency`,
        policyType: 'PAYROLL_FREQUENCY',
        category: 'payroll',
        policyContent: JSON.stringify({ frequency: country.payrollFrequency, processingDay: 25, paymentDay: country.payrollFrequency === 'SEMI_MONTHLY' ? 15 : 1, cutOffDay: 20, currencyCode: country.currency }),
      });

      if (country.taxRegime) {
        policies.push({
          policyName: `${country.name} — Tax Regime`,
          policyType: 'TAX_REGIME',
          category: 'payroll',
          policyContent: JSON.stringify({ regimeType: country.taxRegime, deductionsAllowed: country.code === 'IN', filingFrequency: 'ANNUAL', tdsApplicable: country.code === 'IN' }),
        });
      }

      const statutoryComponents: string[] = [];
      if (country.pf) statutoryComponents.push('PF');
      if (country.esi) statutoryComponents.push('ESI');
      if (country.socialSecurity) statutoryComponents.push('SOCIAL_SECURITY');
      if (country.pension) statutoryComponents.push('PENSION');
      if (country.medicaid) statutoryComponents.push('MEDICAL_AID');
      if (country.code === 'IN') statutoryComponents.push('PT', 'LWF');
      if (statutoryComponents.length > 0) {
        policies.push({
          policyName: `${country.name} — Statutory Compliance`,
          policyType: 'STATUTORY_COMPLIANCE',
          category: 'compliance',
          policyContent: JSON.stringify({ components: statutoryComponents, filingFrequency: 'MONTHLY', autoDeduct: true, employerContributionRequired: true }),
        });
      }

      policies.push({
        policyName: `${country.name} — Leave Policy`,
        policyType: 'LEAVE_POLICY',
        category: 'leave',
        policyContent: JSON.stringify({ annualLeave: country.annualLeave, sickLeave: country.code === 'IN' ? 7 : 10, casualLeave: country.code === 'IN' ? 7 : 0, carryForward: true, maxCarryForward: 5, encashmentAllowed: true, maternityLeave: country.code === 'IN' ? 182 : country.code === 'US' ? 0 : 84, paternityLeave: country.code === 'IN' ? 15 : 5 }),
      });

      policies.push({
        policyName: `${country.name} — Overtime Policy`,
        policyType: 'OVERTIME_POLICY',
        category: 'payroll',
        policyContent: JSON.stringify({ multiplier: country.overtimeMultiplier, maxOTHoursPerWeek: 12, compOffEnabled: true, compOffExpiryDays: 30, requiresApproval: true }),
      });

      if (country.gratuity) {
        policies.push({
          policyName: `${country.name} — Gratuity Policy`,
          policyType: 'GRATUITY_POLICY',
          category: 'benefits',
          policyContent: JSON.stringify({ eligibleAfterYears: country.code === 'IN' ? 5 : 1, calculationBasis: 'LAST_DRAWN', multiplier: 15 / 26, maxCap: country.code === 'IN' ? 2000000 : null }),
        });
      }

      policies.push({
        policyName: `${country.name} — Probation Policy`,
        policyType: 'PROBATION_POLICY',
        category: 'labour_law',
        policyContent: JSON.stringify({ durationDays: country.probation, extendable: true, maxExtensionDays: 90, confirmationRequiresReview: true, noticeDuringProbation: 7 }),
      });

      policies.push({
        policyName: `${country.name} — Termination Policy`,
        policyType: 'TERMINATION_POLICY',
        category: 'labour_law',
        policyContent: JSON.stringify({ noticePeriodDays: country.terminationNotice, paymentInLieu: true, fnfTimelineDays: 30, gardenLeave: country.code === 'GB', severancePay: country.code !== 'IN' }),
      });

      policies.push({
        policyName: `${country.name} — Working Hours`,
        policyType: 'WORKING_HOURS',
        category: 'labour_law',
        policyContent: JSON.stringify({ hoursPerWeek: country.workingHours, daysPerWeek: country.workingDays, breakDurationMinutes: 30, maxContinuousHours: 5, flexibleTiming: country.code !== 'IN' }),
      });

      if (country.socialSecurity || country.pension || country.pf) {
        policies.push({
          policyName: `${country.name} — Social Security & Retirement`,
          policyType: 'SOCIAL_SECURITY',
          category: 'benefits',
          policyContent: JSON.stringify({ pfRate: country.pf ? 12 : 0, employerPFRate: country.pf ? 12 : 0, esiRate: country.esi ? 0.75 : 0, employerESIRate: country.esi ? 3.25 : 0, socialSecurityRate: country.socialSecurity ? 6.2 : 0, employerSocialSecurityRate: country.socialSecurity ? 6.2 : 0, pensionRate: country.pension ? 5 : 0, employerPensionRate: country.pension ? 3 : 0 }),
        });
      }

      policies.push({
        policyName: `${country.name} — Minimum Wage`,
        policyType: 'MINIMUM_WAGE',
        category: 'compliance',
        policyContent: JSON.stringify({ currencyCode: country.currency, nationalMinimumWage: country.code === 'IN' ? 17800 : country.code === 'US' ? 7.25 * 160 : null, wageType: 'MONTHLY', regionSpecific: country.code === 'IN' || country.code === 'US', reviewFrequency: 'ANNUAL' }),
      });

      return policies;
    }

    // Create TenantConfiguration with full tier and auto-provisioning
    const tenantConfig = await prisma.tenantConfiguration.create({
      data: {
        tenantId: tenant.id,
        autoProvisionPayroll: true,
        autoProvisionCompliance: true,
        autoProvisionTaxSlabs: true,
        autoProvisionMinWage: true,
        customisationTier: 'full',
        maxUsers: 500,
        maxCompanies: 10,
        maxEmployees: 5000,
      },
    });

    // Seed countries with auto-provisioned policies, currencies, and languages
    for (const country of COUNTRY_DATA) {
      await prisma.tenantCountryAccess.create({
        data: {
          tenantConfigId: tenantConfig.id,
          countryCode: country.code,
          countryName: country.name,
          payrollFrequencyDefault: country.payrollFrequency,
          payrollCurrencyDefault: country.currency,
          taxRegimeDefault: country.taxRegime,
          workingHoursPerWeek: country.workingHours,
          workingDaysPerWeek: country.workingDays,
          overtimeMultiplier: country.overtimeMultiplier,
          pfEnabled: country.pf,
          esiEnabled: country.esi,
          gratuityEnabled: country.gratuity,
          socialSecurityEnabled: country.socialSecurity,
          pensionEnabled: country.pension,
          medicaidEnabled: country.medicaid,
          labourLawCode: country.labourLaw,
          terminationNoticePeriod: country.terminationNotice,
          probationPeriod: country.probation,
          annualLeaveEntitlement: country.annualLeave,
          dataResidencyRequired: country.dataResidency,
          dataResidencyRegion: country.dataRegion,
        },
      });

      // Seed payroll policies for this country
      const policies = getSeedPoliciesForCountry(country);
      for (const p of policies) {
        await prisma.tenantPayrollPolicy.create({
          data: {
            tenantConfigId: tenantConfig.id,
            countryCode: country.code,
            countryName: country.name,
            policyName: p.policyName,
            policyType: p.policyType,
            category: p.category,
            policyContent: p.policyContent,
            source: 'system_default',
            status: 'active',
            isEditable: true,
          },
        });
      }

      // Auto-add the country's default currency
      const currencyMaster = CURRENCY_DATA.find(c => c.code === country.currency);
      if (currencyMaster) {
        await prisma.tenantCurrencyAccess.upsert({
          where: { tenantConfigId_currencyCode: { tenantConfigId: tenantConfig.id, currencyCode: currencyMaster.code } },
          update: { isActive: true },
          create: {
            tenantConfigId: tenantConfig.id,
            currencyCode: currencyMaster.code,
            currencyName: currencyMaster.name,
            currencySymbol: currencyMaster.symbol,
          },
        });
      }

      // Auto-add the country's default language
      const langMaster = LANGUAGE_DATA.find(l => l.code === country.language);
      if (langMaster) {
        await prisma.tenantLanguageAccess.upsert({
          where: { tenantConfigId_languageCode: { tenantConfigId: tenantConfig.id, languageCode: langMaster.code } },
          update: { isActive: true },
          create: {
            tenantConfigId: tenantConfig.id,
            languageCode: langMaster.code,
            languageName: langMaster.name,
            isRTL: langMaster.rtl,
            uiTranslated: langMaster.ui,
            documentTemplates: langMaster.docs,
            emailTemplates: langMaster.email,
            helpArticles: langMaster.help,
          },
        });
      }
    }

    // Seed extra currencies not auto-added by countries
    const seededCurrencyCodes = new Set(COUNTRY_DATA.map(c => c.currency));
    for (const cur of CURRENCY_DATA) {
      if (seededCurrencyCodes.has(cur.code)) continue;
      await prisma.tenantCurrencyAccess.create({
        data: {
          tenantConfigId: tenantConfig.id,
          currencyCode: cur.code,
          currencyName: cur.name,
          currencySymbol: cur.symbol,
        },
      });
    }

    // Seed extra languages not auto-added by countries
    const seededLanguageCodes = new Set(COUNTRY_DATA.map(c => c.language));
    for (const lang of LANGUAGE_DATA) {
      if (seededLanguageCodes.has(lang.code)) continue;
      await prisma.tenantLanguageAccess.create({
        data: {
          tenantConfigId: tenantConfig.id,
          languageCode: lang.code,
          languageName: lang.name,
          isRTL: lang.rtl,
          uiTranslated: lang.ui,
          documentTemplates: lang.docs,
          emailTemplates: lang.email,
          helpArticles: lang.help,
        },
      });
    }

    // Calculate and update counts/costing
    const activeCountries = await prisma.tenantCountryAccess.count({ where: { tenantConfigId: tenantConfig.id, isActive: true } });
    const activeCurrencies = await prisma.tenantCurrencyAccess.count({ where: { tenantConfigId: tenantConfig.id, isActive: true } });
    const activeLanguages = await prisma.tenantLanguageAccess.count({ where: { tenantConfigId: tenantConfig.id, isActive: true } });
    const activePolicies = await prisma.tenantPayrollPolicy.count({ where: { tenantConfigId: tenantConfig.id, status: 'active' } });

    const countryCost = activeCountries * 50;
    const currencyCost = Math.max(0, activeCurrencies - 1) * 10;
    const languageCost = Math.max(0, activeLanguages - 1) * 5;
    const tierCost = 150; // full tier
    const userCost = 500 * 0.5;
    const companyCost = 10 * 5;
    const employeeCost = 5000 * 0.1;
    const monthlyCost = countryCost + currencyCost + languageCost + tierCost + userCost + companyCost + employeeCost;

    await prisma.tenantConfiguration.update({
      where: { id: tenantConfig.id },
      data: {
        activeCountryCount: activeCountries,
        activeCurrencyCount: activeCurrencies,
        activeLanguageCount: activeLanguages,
        estimatedMonthlyCost: Math.round(monthlyCost * 100) / 100,
        estimatedAnnualCost: Math.round(monthlyCost * 12 * 100) / 100,
      },
    });

    console.log(`  ✓ Tenant Configuration: ${activeCountries} countries, ${activeCurrencies} currencies, ${activeLanguages} languages, ${activePolicies} policies`);
    console.log(`  ✓ Estimated Monthly Cost: $${Math.round(monthlyCost * 100) / 100}`);
  } else {
    console.log('  ⊘ Tenant Configuration already exists with data — skipping seed');
  }

  // ==================== VERIFICATION ====================
  console.log('\n🔍 Verifying seed data...');
  const userCount = await prisma.user.count();
  const employeeCount = await prisma.employee.count();
  const jobPostingCount = await prisma.jobPosting.count();
  const jobAppCount = await prisma.jobApplication.count();
  const interviewCount = await prisma.interview.count();
  const moduleCount = await prisma.module.count();
  const permCount = await prisma.permission.count();
  const roleCount = await prisma.role.count();
  const rolePermCount = await prisma.rolePermission.count();
  const userRoleCount = await prisma.userRoleAssignment.count();

  console.log(`  ✓ Users: ${userCount}`);
  console.log(`  ✓ Employees: ${employeeCount}`);
  console.log(`  ✓ Job Postings: ${jobPostingCount}`);
  console.log(`  ✓ Job Applications: ${jobAppCount}`);
  console.log(`  ✓ Interviews: ${interviewCount}`);
  console.log(`  ✓ RBAC Modules: ${moduleCount}`);
  console.log(`  ✓ RBAC Permissions: ${permCount}`);
  console.log(`  ✓ RBAC Roles: ${roleCount}`);
  console.log(`  ✓ Role-Permission Mappings: ${rolePermCount}`);
  console.log(`  ✓ User-Role Assignments: ${userRoleCount}`);

  // Verify tenant configuration
  const tenantConfigCount = await prisma.tenantConfiguration.count();
  const tenantCountryCount = await prisma.tenantCountryAccess.count({ where: { isActive: true } });
  const tenantCurrencyCount = await prisma.tenantCurrencyAccess.count({ where: { isActive: true } });
  const tenantLanguageCount = await prisma.tenantLanguageAccess.count({ where: { isActive: true } });
  const tenantPolicyCount = await prisma.tenantPayrollPolicy.count({ where: { status: 'active' } });
  console.log(`  ✓ Tenant Configurations: ${tenantConfigCount}`);
  console.log(`  ✓ Tenant Country Access: ${tenantCountryCount}`);
  console.log(`  ✓ Tenant Currency Access: ${tenantCurrencyCount}`);
  console.log(`  ✓ Tenant Language Access: ${tenantLanguageCount}`);
  console.log(`  ✓ Tenant Payroll Policies: ${tenantPolicyCount}`);

  // Verify password hashing works
  const adminUserCheck = await prisma.user.findUnique({ where: { email: 'admin@3boxeshrms.com' } });
  if (adminUserCheck) {
    const passwordMatch = await bcryptjs.compare('admin123', adminUserCheck.password);
    console.log(`  ✓ Password verification (admin@3boxeshrms.com / admin123): ${passwordMatch ? 'PASS ✓' : 'FAIL ✗'}`);
  }

  console.log('\n✅ Database seeding completed successfully!');
  console.log('\n📝 Demo Login Credentials:');
  console.log('  ┌─────────────────┬───────────────────────────┬──────────────┐');
  console.log('  │ Role            │ Email                     │ Password     │');
  console.log('  ├─────────────────┼───────────────────────────┼──────────────┤');
  console.log('  │ Super Admin     │ admin@3boxeshrms.com       │ admin123     │');
  console.log('  │ HR Admin        │ hr@3boxeshrms.com          │ hr123        │');
  console.log('  │ Manager         │ manager@3boxeshrms.com     │ manager123   │');
  console.log('  │ Employee        │ employee@3boxeshrms.com    │ employee123  │');
  console.log('  │ Recruiter       │ recruiter@3boxeshrms.com   │ recruiter123 │');
  console.log('  │ Candidate       │ candidate@3boxeshrms.com   │ candidate123 │');
  console.log('  └─────────────────┴───────────────────────────┴──────────────┘');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
