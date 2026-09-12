import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

// GET: Check database status
export async function GET() {
  try {
    const companyCount = await db.company.count();
    const userCount = await db.user.count();
    const employeeCount = await db.employee.count();
    const workflowCount = await db.workflowDefinition.count();

    const isSeeded = companyCount > 0 && userCount > 0;

    return NextResponse.json({
      status: 'connected',
      isSeeded,
      counts: {
        companies: companyCount,
        users: userCount,
        employees: employeeCount,
        workflows: workflowCount,
      },
    });
  } catch (error) {
    console.error('DB status check error:', error);
    return NextResponse.json({
      status: 'error',
      isSeeded: false,
      error: 'Database connection failed. Please check your DATABASE_URL.',
    }, { status: 500 });
  }
}

// POST: Seed the database
export async function POST(req: NextRequest) {
  const db = await getDb(req);
  try {
    const body = await req.json();
    const { force } = body || {};

    // Check if already seeded
    if (!force) {
      const companyCount = await db.company.count();
      if (companyCount > 0) {
        return NextResponse.json({
          message: 'Database already seeded. Use force=true to re-seed.',
          isSeeded: true,
        });
      }
    }

    // If force re-seed, clear existing data in reverse dependency order
    if (force) {
      await db.$transaction([
        db.auditLog.deleteMany(),
        db.notification.deleteMany(),
        db.surveyResponse.deleteMany(),
        db.surveyQuestion.deleteMany(),
        db.survey.deleteMany(),
        db.workflowStepInstance.deleteMany(),
        db.workflowInstance.deleteMany(),
        db.workflowStepDef.deleteMany(),
        db.workflowDefinition.deleteMany(),
        db.complianceItem.deleteMany(),
        db.alumniRecord.deleteMany(),
        db.shiftMember.deleteMany(),
        db.shift.deleteMany(),
        db.onboardingTask.deleteMany(),
        db.document.deleteMany(),
        db.surveyResponse.deleteMany(),
        db.interview.deleteMany(),
        db.candidate.deleteMany(),
        db.job.deleteMany(),
        db.ticket.deleteMany(),
        db.learningRecord.deleteMany(),
        db.expenseClaim.deleteMany(),
        db.travelRequest.deleteMany(),
        db.assetAllocation.deleteMany(),
        db.performanceReview.deleteMany(),
        db.reviewCycle.deleteMany(),
        db.goal.deleteMany(),
        db.payrollRecord.deleteMany(),
        db.payrollStructure.deleteMany(),
        db.leave.deleteMany(),
        db.leavePolicy.deleteMany(),
        db.attendance.deleteMany(),
        db.subVendor.deleteMany(),
        db.vendor.deleteMany(),
        db.client.deleteMany(),
        db.employee.deleteMany(),
        db.department.deleteMany(),
        db.branch.deleteMany(),
        db.user.deleteMany(),
        db.company.deleteMany(),
      ]);
    }

    // ==================== COMPANIES ====================
    const tcg = await db.company.create({ data: { name: 'TechCorp Global', code: 'TCG', industry: 'IT Services', country: 'US', currency: 'USD', timezone: 'America/New_York', isActive: true } });
    const mpi = await db.company.create({ data: { name: 'ManufactPro Industries', code: 'MPI', industry: 'Manufacturing', country: 'IN', currency: 'INR', timezone: 'Asia/Kolkata', isActive: true } });
    const hfs = await db.company.create({ data: { name: 'HealthFirst Solutions', code: 'HFS', industry: 'Healthcare', country: 'GB', currency: 'GBP', timezone: 'Europe/London', isActive: true } });
    const rmg = await db.company.create({ data: { name: 'RetailMax Group', code: 'RMG', industry: 'Retail', country: 'DE', currency: 'EUR', timezone: 'Europe/Berlin', isActive: true } });
    const ltw = await db.company.create({ data: { name: 'LogiTrans Worldwide', code: 'LTW', industry: 'Logistics', country: 'SG', currency: 'SGD', timezone: 'Asia/Singapore', isActive: true } });

    // ==================== BRANCHES ====================
    const branchSF = await db.branch.create({ data: { name: 'HQ San Francisco', code: 'TCG-SF', city: 'San Francisco', state: 'CA', country: 'US', companyId: tcg.id } });
    const branchNY = await db.branch.create({ data: { name: 'NYC Office', code: 'TCG-NY', city: 'New York', state: 'NY', country: 'US', companyId: tcg.id } });
    const branchMUM = await db.branch.create({ data: { name: 'Mumbai HQ', code: 'MPI-MUM', city: 'Mumbai', state: 'MH', country: 'IN', companyId: mpi.id } });
    const branchLON = await db.branch.create({ data: { name: 'London Office', code: 'HFS-LON', city: 'London', state: 'England', country: 'GB', companyId: hfs.id } });

    // ==================== DEPARTMENTS ====================
    const engDept = await db.department.create({ data: { name: 'Engineering', code: 'ENG', companyId: tcg.id } });
    const hrDept = await db.department.create({ data: { name: 'Human Resources', code: 'HR', companyId: tcg.id } });
    const designDept = await db.department.create({ data: { name: 'Design', code: 'DSG', companyId: tcg.id } });
    const finDept = await db.department.create({ data: { name: 'Finance', code: 'FIN', companyId: tcg.id } });
    const opsDept = await db.department.create({ data: { name: 'Operations', code: 'OPS', companyId: tcg.id } });
    const salesDept = await db.department.create({ data: { name: 'Sales', code: 'SAL', companyId: tcg.id } });
    const qualDept = await db.department.create({ data: { name: 'Quality', code: 'QAT', companyId: mpi.id } });
    const prodDept = await db.department.create({ data: { name: 'Production', code: 'PRD', companyId: mpi.id } });
    const clinDept = await db.department.create({ data: { name: 'Clinical', code: 'CLI', companyId: hfs.id } });
    const anaDept = await db.department.create({ data: { name: 'Analytics', code: 'ANA', companyId: tcg.id } });

    // ==================== USERS ====================
    const adminUser = await db.user.create({ data: { email: 'admin@3boxeshrms.com', password: 'admin123', name: 'Admin 3Boxes', role: 'super_admin', isActive: true } });
    const sarahUser = await db.user.create({ data: { email: 'sarah.j@techcorp.com', password: 'sarah123', name: 'Sarah Johnson', role: 'admin', companyId: tcg.id, isActive: true } });
    const rajUser = await db.user.create({ data: { email: 'raj.p@techcorp.com', password: 'raj123', name: 'Raj Patel', role: 'reporting_manager', companyId: tcg.id, isActive: true } });
    const emilyUser = await db.user.create({ data: { email: 'emily.c@techcorp.com', password: 'emily123', name: 'Emily Chen', role: 'admin', companyId: tcg.id, isActive: true } });
    const michaelUser = await db.user.create({ data: { email: 'michael.b@techcorp.com', password: 'michael123', name: 'Michael Brown', role: 'admin', companyId: tcg.id, isActive: true } });
    const priyaUser = await db.user.create({ data: { email: 'priya.s@manufactpro.com', password: 'priya123', name: 'Priya Sharma', role: 'reporting_manager', companyId: mpi.id, isActive: true } });
    const davidUser = await db.user.create({ data: { email: 'david.w@healthfirst.com', password: 'david123', name: 'David Wilson', role: 'admin', companyId: hfs.id, isActive: true } });
    const aikoUser = await db.user.create({ data: { email: 'aiko.t@logitrans.com', password: 'aiko123', name: 'Aiko Tanaka', role: 'admin', companyId: ltw.id, isActive: true } });
    const carlosUser = await db.user.create({ data: { email: 'carlos.r@retailmax.com', password: 'carlos123', name: 'Carlos Rodriguez', role: 'admin', companyId: rmg.id, isActive: true } });
    const lisaUser = await db.user.create({ data: { email: 'lisa.a@techcorp.com', password: 'lisa123', name: 'Lisa Anderson', role: 'finance', companyId: tcg.id, isActive: true } });
    const arjunUser = await db.user.create({ data: { email: 'arjun.k@manufactpro.com', password: 'arjun123', name: 'Arjun Kumar', role: 'admin', companyId: mpi.id, isActive: true } });
    const recruiterUser = await db.user.create({ data: { email: 'recruiter@techcorp.com', password: 'recruit123', name: 'Recruiter Kim', role: 'recruiter', companyId: tcg.id, isActive: true } });
    const clientUser = await db.user.create({ data: { email: 'hr@acme.com', password: 'acme123', name: 'Acme Corp', role: 'client', companyId: tcg.id, isActive: true } });
    const vendorUser = await db.user.create({ data: { email: 'info@talenthunt.com', password: 'thunt123', name: 'TalentHunt Agency', role: 'vendor', companyId: tcg.id, isActive: true } });

    // ==================== EMPLOYEES ====================
    const emp1 = await db.employee.create({ data: { employeeId: 'EMP001', firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.j@techcorp.com', designation: 'Senior Software Engineer', jobTitle: 'Senior Developer', employmentType: 'full-time', status: 'active', joiningDate: new Date('2022-03-15'), companyId: tcg.id, branchId: branchSF.id, departmentId: engDept.id, userId: sarahUser.id } });
    const emp2 = await db.employee.create({ data: { employeeId: 'EMP002', firstName: 'Raj', lastName: 'Patel', email: 'raj.p@techcorp.com', designation: 'HR Manager', employmentType: 'full-time', status: 'active', joiningDate: new Date('2021-07-01'), companyId: tcg.id, branchId: branchSF.id, departmentId: hrDept.id, userId: rajUser.id } });
    const emp3 = await db.employee.create({ data: { employeeId: 'EMP003', firstName: 'Emily', lastName: 'Chen', email: 'emily.c@techcorp.com', designation: 'Product Designer', employmentType: 'full-time', status: 'active', joiningDate: new Date('2023-01-10'), companyId: tcg.id, branchId: branchSF.id, departmentId: designDept.id, userId: emilyUser.id } });
    const emp4 = await db.employee.create({ data: { employeeId: 'EMP004', firstName: 'Michael', lastName: 'Brown', email: 'michael.b@techcorp.com', designation: 'DevOps Lead', employmentType: 'full-time', status: 'probation', joiningDate: new Date('2024-09-01'), probationEnd: new Date('2025-03-01'), companyId: tcg.id, branchId: branchSF.id, departmentId: engDept.id, userId: michaelUser.id } });
    const emp5 = await db.employee.create({ data: { employeeId: 'EMP005', firstName: 'Priya', lastName: 'Sharma', email: 'priya.s@manufactpro.com', designation: 'Production Manager', employmentType: 'full-time', status: 'active', joiningDate: new Date('2020-11-20'), companyId: mpi.id, branchId: branchMUM.id, departmentId: prodDept.id, userId: priyaUser.id } });
    const emp6 = await db.employee.create({ data: { employeeId: 'EMP006', firstName: 'David', lastName: 'Wilson', email: 'david.w@healthfirst.com', designation: 'Nurse Practitioner', employmentType: 'full-time', status: 'on_leave', joiningDate: new Date('2019-05-15'), companyId: hfs.id, branchId: branchLON.id, departmentId: clinDept.id, userId: davidUser.id } });
    const emp7 = await db.employee.create({ data: { employeeId: 'EMP007', firstName: 'Aiko', lastName: 'Tanaka', email: 'aiko.t@logitrans.com', designation: 'Fleet Coordinator', employmentType: 'full-time', status: 'active', joiningDate: new Date('2023-06-01'), companyId: ltw.id, departmentId: opsDept.id, userId: aikoUser.id } });
    const emp8 = await db.employee.create({ data: { employeeId: 'EMP008', firstName: 'Carlos', lastName: 'Rodriguez', email: 'carlos.r@retailmax.com', designation: 'Store Manager', employmentType: 'full-time', status: 'notice_period', joiningDate: new Date('2021-02-10'), companyId: rmg.id, departmentId: salesDept.id, userId: carlosUser.id } });
    const emp9 = await db.employee.create({ data: { employeeId: 'EMP009', firstName: 'Lisa', lastName: 'Anderson', email: 'lisa.a@techcorp.com', designation: 'Finance Analyst', employmentType: 'full-time', status: 'active', joiningDate: new Date('2022-08-22'), companyId: tcg.id, branchId: branchNY.id, departmentId: finDept.id, userId: lisaUser.id } });
    const emp10 = await db.employee.create({ data: { employeeId: 'EMP010', firstName: 'Arjun', lastName: 'Kumar', email: 'arjun.k@manufactpro.com', designation: 'Quality Inspector', employmentType: 'full-time', status: 'active', joiningDate: new Date('2023-04-01'), companyId: mpi.id, branchId: branchMUM.id, departmentId: qualDept.id, userId: arjunUser.id } });

    // Reporting managers
    await db.employee.update({ where: { id: emp3.id }, data: { reportingManagerId: emp1.id } });
    await db.employee.update({ where: { id: emp4.id }, data: { reportingManagerId: emp1.id } });
    await db.employee.update({ where: { id: emp9.id }, data: { reportingManagerId: emp1.id } });
    await db.employee.update({ where: { id: emp10.id }, data: { reportingManagerId: emp5.id } });

    // ==================== JOBS ====================
    const job1 = await db.job.create({ data: { title: 'Senior Full-Stack Developer', description: 'Join our engineering team.', requirements: 'React, Node.js, TypeScript, 5+ years', department: 'Engineering', location: 'San Francisco, CA', employmentType: 'Full-time', experienceMin: 5, experienceMax: 8, salaryMin: 140000, salaryMax: 180000, status: 'open', priority: 'high', positions: 2, postedDate: new Date('2024-12-01'), companyId: tcg.id } });
    const job2 = await db.job.create({ data: { title: 'HR Business Partner', description: 'Experienced HR business partner needed.', requirements: '7+ years HR experience', department: 'Human Resources', location: 'New York, NY', employmentType: 'Full-time', experienceMin: 7, experienceMax: 10, salaryMin: 95000, salaryMax: 120000, status: 'open', priority: 'medium', positions: 1, postedDate: new Date('2024-11-28'), companyId: tcg.id } });
    const job3 = await db.job.create({ data: { title: 'UX Research Lead', description: 'Lead UX research initiatives.', requirements: '6+ years UX research', department: 'Design', location: 'Remote', employmentType: 'Full-time', experienceMin: 6, experienceMax: 9, salaryMin: 120000, salaryMax: 150000, status: 'open', priority: 'high', positions: 1, postedDate: new Date('2024-11-15'), companyId: tcg.id } });
    const job4 = await db.job.create({ data: { title: 'Production Supervisor', description: 'Oversee production operations.', requirements: '8+ years manufacturing', department: 'Operations', location: 'Mumbai, India', employmentType: 'Full-time', experienceMin: 8, experienceMax: 12, salaryMin: 1500000, salaryMax: 2200000, status: 'open', priority: 'urgent', positions: 3, postedDate: new Date('2024-12-05'), companyId: mpi.id } });
    const job5 = await db.job.create({ data: { title: 'Data Scientist', description: 'Build ML models.', requirements: 'Python, TensorFlow, 3+ years', department: 'Analytics', location: 'Austin, TX', employmentType: 'Full-time', experienceMin: 3, experienceMax: 5, salaryMin: 110000, salaryMax: 145000, status: 'draft', priority: 'medium', positions: 1, companyId: tcg.id } });
    const job6 = await db.job.create({ data: { title: 'Registered Nurse', description: 'Join our clinical team.', requirements: 'RN license, 2+ years', department: 'Clinical', location: 'London, UK', employmentType: 'Full-time', experienceMin: 2, experienceMax: 5, salaryMin: 35000, salaryMax: 45000, status: 'open', priority: 'high', positions: 5, postedDate: new Date('2024-12-03'), companyId: hfs.id } });
    const job7 = await db.job.create({ data: { title: 'Cloud Infrastructure Engineer', description: 'Design cloud infrastructure.', requirements: 'AWS/Azure, Kubernetes, 4+ years', department: 'Engineering', location: 'Singapore', employmentType: 'Full-time', experienceMin: 4, experienceMax: 7, salaryMin: 8000, salaryMax: 12000, status: 'on_hold', priority: 'low', positions: 1, postedDate: new Date('2024-11-20'), companyId: ltw.id } });

    // ==================== CANDIDATES ====================
    const cand1 = await db.candidate.create({ data: { firstName: 'Alex', lastName: 'Turner', email: 'alex.t@email.com', currentCompany: 'Google', currentTitle: 'Software Engineer', experience: 6, expectedSalary: 160000, noticePeriod: '30 days', status: 'interviewing', source: 'LinkedIn', aiScore: 92, skillMatch: 88, cultureFitScore: 85, jobId: job1.id } });
    const cand2 = await db.candidate.create({ data: { firstName: 'Maya', lastName: 'Singh', email: 'maya.s@email.com', currentCompany: 'Amazon', currentTitle: 'Senior Developer', experience: 8, expectedSalary: 175000, noticePeriod: '60 days', status: 'shortlisted', source: 'Naukri', aiScore: 89, skillMatch: 91, cultureFitScore: 80, jobId: job1.id } });
    const cand3 = await db.candidate.create({ data: { firstName: 'James', lastName: 'Williams', email: 'james.w@email.com', currentCompany: 'Microsoft', currentTitle: 'HR Manager', experience: 9, expectedSalary: 110000, noticePeriod: '30 days', status: 'offered', source: 'Referral', aiScore: 95, skillMatch: 94, cultureFitScore: 90, jobId: job2.id } });
    const cand4 = await db.candidate.create({ data: { firstName: 'Sophie', lastName: 'Martin', email: 'sophie.m@email.com', currentCompany: 'Meta', currentTitle: 'UX Researcher', experience: 7, expectedSalary: 140000, noticePeriod: '45 days', status: 'screening', source: 'Portal', aiScore: 78, skillMatch: 82, cultureFitScore: 88, jobId: job3.id } });
    const cand5 = await db.candidate.create({ data: { firstName: 'Wei', lastName: 'Zhang', email: 'wei.z@email.com', currentCompany: 'ByteDance', currentTitle: 'Data Engineer', experience: 4, expectedSalary: 135000, noticePeriod: '30 days', status: 'applied', source: 'Indeed', aiScore: 72, skillMatch: 68, cultureFitScore: 75, jobId: job5.id } });

    // ==================== INTERVIEWS ====================
    await db.interview.create({ data: { type: 'technical', scheduledAt: new Date('2025-01-22T10:00:00'), duration: 60, status: 'scheduled', meetingLink: 'https://meet.example.com/interview-1', candidateId: cand1.id, jobId: job1.id } });
    await db.interview.create({ data: { type: 'hr', scheduledAt: new Date('2025-01-23T14:00:00'), duration: 45, status: 'scheduled', candidateId: cand1.id, jobId: job1.id } });
    await db.interview.create({ data: { type: 'manager', scheduledAt: new Date('2025-01-20T11:00:00'), duration: 60, status: 'completed', feedback: 'Strong technical skills, good culture fit.', rating: 4, candidateId: cand3.id, jobId: job2.id } });

    // ==================== ATTENDANCE ====================
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await db.attendance.create({ data: { date: today, checkIn: new Date(today.getTime() + 9 * 3600000), checkOut: new Date(today.getTime() + 18 * 3600000), workHours: 8.5, status: 'present', source: 'biometric', employeeId: emp1.id } });
    await db.attendance.create({ data: { date: today, checkIn: new Date(today.getTime() + 9.5 * 3600000), checkOut: new Date(today.getTime() + 18.5 * 3600000), workHours: 8.0, status: 'late', source: 'mobile', employeeId: emp2.id } });
    await db.attendance.create({ data: { date: today, checkIn: new Date(today.getTime() + 8.75 * 3600000), checkOut: new Date(today.getTime() + 17.75 * 3600000), workHours: 8.0, status: 'present', source: 'gps', employeeId: emp3.id } });
    await db.attendance.create({ data: { date: today, status: 'absent', source: 'web', employeeId: emp6.id } });
    await db.attendance.create({ data: { date: today, checkIn: new Date(today.getTime() + 9 * 3600000), checkOut: new Date(today.getTime() + 13 * 3600000), workHours: 4.0, status: 'half_day', source: 'web', employeeId: emp5.id } });
    await db.attendance.create({ data: { date: today, checkIn: new Date(today.getTime() + 8.75 * 3600000), checkOut: new Date(today.getTime() + 18 * 3600000), workHours: 8.5, status: 'present', source: 'rfid', employeeId: emp7.id } });

    // ==================== LEAVE POLICIES ====================
    await db.leavePolicy.create({ data: { name: 'Casual Leave', type: 'casual', totalDays: 12, carryForward: true, maxCarryDays: 3, isPaid: true, companyId: tcg.id } });
    await db.leavePolicy.create({ data: { name: 'Sick Leave', type: 'sick', totalDays: 10, carryForward: false, isPaid: true, companyId: tcg.id } });
    await db.leavePolicy.create({ data: { name: 'Paid Leave', type: 'paid', totalDays: 15, carryForward: true, maxCarryDays: 5, isPaid: true, companyId: tcg.id } });
    await db.leavePolicy.create({ data: { name: 'Maternity Leave', type: 'maternity', totalDays: 182, carryForward: false, isPaid: true, companyId: tcg.id } });
    await db.leavePolicy.create({ data: { name: 'Comp Off', type: 'comp_off', totalDays: 5, carryForward: false, isPaid: true, companyId: tcg.id } });

    // ==================== LEAVES ====================
    const leave1 = await db.leave.create({ data: { type: 'casual', startDate: new Date('2025-01-22'), endDate: new Date('2025-01-23'), totalDays: 2, reason: 'Personal work', status: 'approved', approverId: emp2.id, employeeId: emp1.id } });
    const leave2 = await db.leave.create({ data: { type: 'sick', startDate: new Date('2025-01-20'), endDate: new Date('2025-01-21'), totalDays: 2, reason: 'Not feeling well', status: 'pending', employeeId: emp2.id } });
    const leave3 = await db.leave.create({ data: { type: 'paid', startDate: new Date('2025-02-10'), endDate: new Date('2025-02-14'), totalDays: 5, reason: 'Family vacation', status: 'pending', employeeId: emp3.id } });
    await db.leave.create({ data: { type: 'maternity', startDate: new Date('2025-01-15'), endDate: new Date('2025-07-15'), totalDays: 182, reason: 'Maternity', status: 'approved', approverId: emp2.id, employeeId: emp9.id } });
    await db.leave.create({ data: { type: 'comp_off', startDate: new Date('2025-01-25'), endDate: new Date('2025-01-25'), totalDays: 1, reason: 'Weekend work compensation', status: 'approved', approverId: emp1.id, employeeId: emp10.id } });

    // ==================== PAYROLL ====================
    await db.payrollStructure.create({ data: { name: 'Standard Salaried', basicPay: 8000, hra: 3200, da: 800, transportAllowance: 1500, medicalAllowance: 500, specialAllowance: 2000, pfEmployee: 960, pfEmployer: 960, esiEmployee: 200, esiEmployer: 550, taxDeduction: 1200, companyId: tcg.id } });
    await db.payrollRecord.create({ data: { month: 1, year: 2025, basicPay: 8000, grossSalary: 12000, totalDeductions: 3200, netSalary: 8800, status: 'paid', paymentDate: new Date('2025-01-31'), employeeId: emp1.id } });
    await db.payrollRecord.create({ data: { month: 1, year: 2025, basicPay: 7500, grossSalary: 11000, totalDeductions: 2900, netSalary: 8100, status: 'paid', paymentDate: new Date('2025-01-31'), employeeId: emp2.id } });
    await db.payrollRecord.create({ data: { month: 1, year: 2025, basicPay: 6500, grossSalary: 9500, totalDeductions: 2500, netSalary: 7000, status: 'processed', employeeId: emp3.id } });
    await db.payrollRecord.create({ data: { month: 1, year: 2025, basicPay: 9000, grossSalary: 13500, totalDeductions: 3600, netSalary: 9900, status: 'draft', employeeId: emp4.id } });

    // ==================== GOALS ====================
    await db.goal.create({ data: { title: 'Complete React 19 Migration', description: 'Migrate all frontend apps to React 19', type: 'individual', category: 'okr', progress: 65, status: 'in_progress', startDate: new Date('2025-01-01'), endDate: new Date('2025-03-31'), employeeId: emp1.id } });
    await db.goal.create({ data: { title: 'Reduce Hiring Time-to-Fill', description: 'Reduce average time-to-fill from 45 to 30 days', type: 'department', category: 'kpi', progress: 40, status: 'in_progress', startDate: new Date('2025-01-01'), endDate: new Date('2025-06-30'), employeeId: emp2.id } });
    await db.goal.create({ data: { title: 'Improve Design System Coverage', description: 'Achieve 90% component coverage', type: 'individual', category: 'smart', progress: 80, status: 'in_progress', startDate: new Date('2025-01-01'), endDate: new Date('2025-02-28'), employeeId: emp3.id } });
    await db.goal.create({ data: { title: 'Achieve 99.9% Uptime', description: 'Maintain 99.9% uptime for all production services', type: 'team', category: 'kpi', progress: 95, status: 'in_progress', startDate: new Date('2025-01-01'), endDate: new Date('2025-12-31'), employeeId: emp4.id } });

    // ==================== REVIEW CYCLES & PERFORMANCE REVIEWS ====================
    const cycle1 = await db.reviewCycle.create({ data: { name: 'Q4 2024 Performance Review', type: 'quarterly', startDate: new Date('2024-10-01'), endDate: new Date('2024-12-31'), status: 'completed', companyId: tcg.id } });
    const cycle2 = await db.reviewCycle.create({ data: { name: 'Q1 2025 Mid-Year Review', type: 'mid_year', startDate: new Date('2025-01-01'), endDate: new Date('2025-03-31'), status: 'active', companyId: tcg.id } });
    await db.performanceReview.create({ data: { cycleId: cycle1.id, reviewerId: emp2.id, revieweeId: emp1.id, rating: 4, comments: 'Excellent technical leadership', status: 'completed' } });
    await db.performanceReview.create({ data: { cycleId: cycle1.id, reviewerId: emp1.id, revieweeId: emp3.id, rating: 5, comments: 'Outstanding design work', status: 'completed' } });
    await db.performanceReview.create({ data: { cycleId: cycle2.id, reviewerId: emp2.id, revieweeId: emp4.id, rating: 3, comments: 'Good progress, needs more initiative', status: 'pending' } });

    // ==================== ASSETS ====================
    await db.assetAllocation.create({ data: { assetType: 'laptop', assetName: 'MacBook Pro 16"', assetCode: 'LTP-0042', serialNumber: 'MBP16-2024-0042', status: 'allocated', employeeId: emp1.id } });
    await db.assetAllocation.create({ data: { assetType: 'phone', assetName: 'iPhone 15 Pro', assetCode: 'PHN-0088', status: 'allocated', employeeId: emp2.id } });
    await db.assetAllocation.create({ data: { assetType: 'access_card', assetName: 'Access Card - Floor 5', assetCode: 'AC-1025', status: 'allocated', employeeId: emp3.id } });
    await db.assetAllocation.create({ data: { assetType: 'laptop', assetName: 'Dell XPS 15', assetCode: 'LTP-0045', status: 'allocated', notes: 'On loan from IT pool', employeeId: emp4.id } });

    // ==================== TRAVEL & EXPENSE ====================
    await db.travelRequest.create({ data: { purpose: 'Client Meeting - Acme Corp', destination: 'New York, NY', departureDate: new Date('2025-02-15'), returnDate: new Date('2025-02-17'), estimatedCost: 2500, status: 'pending', employeeId: emp1.id } });
    await db.travelRequest.create({ data: { purpose: 'Tech Conference 2025', destination: 'Las Vegas, NV', departureDate: new Date('2025-03-10'), returnDate: new Date('2025-03-13'), estimatedCost: 4000, approvedCost: 3800, status: 'approved', employeeId: emp3.id } });
    await db.expenseClaim.create({ data: { type: 'travel', amount: 450, description: 'Taxi to airport', status: 'pending', employeeId: emp1.id } });
    await db.expenseClaim.create({ data: { type: 'food', amount: 120, description: 'Team lunch meeting', status: 'approved', employeeId: emp2.id } });
    await db.expenseClaim.create({ data: { type: 'communication', amount: 85, description: 'International calls', status: 'reimbursed', employeeId: emp3.id } });

    // ==================== LEARNING ====================
    await db.learningRecord.create({ data: { courseName: 'Advanced React Patterns', provider: 'Frontend Masters', type: 'e_learning', status: 'in_progress', employeeId: emp1.id } });
    await db.learningRecord.create({ data: { courseName: 'HR Analytics Fundamentals', provider: 'Coursera', type: 'certification', status: 'completed', completedAt: new Date('2024-12-15'), score: 92, certificate: 'cert-hr-analytics-2024', employeeId: emp2.id } });
    await db.learningRecord.create({ data: { courseName: 'Design Systems Workshop', provider: 'Internal', type: 'workshop', status: 'enrolled', employeeId: emp3.id } });

    // ==================== TICKETS ====================
    await db.ticket.create({ data: { subject: 'VPN Connection Issue', description: 'Cannot connect to VPN', category: 'it', priority: 'high', status: 'in_progress', employeeId: emp1.id } });
    await db.ticket.create({ data: { subject: 'Payroll Discrepancy', description: 'December salary incorrect deduction', category: 'payroll', priority: 'urgent', status: 'open', employeeId: emp2.id } });
    await db.ticket.create({ data: { subject: 'Access Request - Production DB', description: 'Need read access to production database', category: 'it', priority: 'medium', status: 'resolved', resolution: 'Access granted by IT admin', employeeId: emp4.id } });

    // ==================== CLIENTS & VENDORS ====================
    await db.client.create({ data: { name: 'Acme Corp', email: 'hr@acme.com', clientCompany: 'Acme Corporation', industry: 'Technology', contractStart: new Date('2024-01-01'), contractEnd: new Date('2025-12-31'), status: 'active', companyId: tcg.id } });
    await db.client.create({ data: { name: 'GlobalTech Inc', email: 'talent@globaltech.com', clientCompany: 'GlobalTech Inc', industry: 'Software', contractStart: new Date('2024-06-01'), contractEnd: new Date('2025-05-31'), status: 'active', companyId: tcg.id } });
    await db.client.create({ data: { name: 'BuildRight Construction', email: 'hr@buildright.com', clientCompany: 'BuildRight', industry: 'Construction', contractStart: new Date('2023-09-01'), contractEnd: new Date('2024-08-31'), status: 'active', companyId: tcg.id } });

    const vendor1 = await db.vendor.create({ data: { name: 'TalentHunt Agency', email: 'info@talenthunt.com', vendorCompany: 'TalentHunt', serviceType: 'recruitment', status: 'active', rating: 4.5, companyId: tcg.id } });
    const vendor2 = await db.vendor.create({ data: { name: 'StaffPro Solutions', email: 'contact@staffpro.com', vendorCompany: 'StaffPro', serviceType: 'staffing', status: 'active', rating: 4.2, companyId: tcg.id } });
    const vendor3 = await db.vendor.create({ data: { name: 'VerifyRight BGV', email: 'team@verifyright.com', vendorCompany: 'VerifyRight', serviceType: 'bgv', status: 'active', rating: 4.8, companyId: tcg.id } });
    await db.subVendor.create({ data: { name: 'QuickHire Regional', email: 'hire@quickhire.com', company: 'QuickHire', status: 'active', vendorId: vendor1.id } });
    await db.subVendor.create({ data: { name: 'TalentBridge East', email: 'east@talentbridge.com', company: 'TalentBridge', status: 'active', vendorId: vendor2.id } });

    // ==================== WORKFLOW DEFINITIONS (8 workflows) ====================
    // 1. Leave Approval
    await db.workflowDefinition.create({
      data: { name: 'Leave Approval Workflow', type: 'approval', entity: 'leave', description: 'Standard leave approval: Manager → HR', isActive: true, companyId: tcg.id,
        steps: { create: [
          { name: 'Manager Approval', stepOrder: 0, approverRole: 'reporting_manager', approverType: 'role', action: 'approve_reject' },
          { name: 'HR Approval', stepOrder: 1, approverRole: 'admin', approverType: 'role', action: 'approve_reject' },
        ]}
      }
    });

    // 2. Expense Approval
    await db.workflowDefinition.create({
      data: { name: 'Expense Approval Workflow', type: 'approval', entity: 'expense', description: 'Expense approval: Manager → Finance', isActive: true, companyId: tcg.id,
        steps: { create: [
          { name: 'Manager Approval', stepOrder: 0, approverRole: 'reporting_manager', approverType: 'role', action: 'approve_reject' },
          { name: 'Finance Review', stepOrder: 1, approverRole: 'finance', approverType: 'role', action: 'approve_reject' },
        ]}
      }
    });

    // 3. Travel Request
    await db.workflowDefinition.create({
      data: { name: 'Travel Request Workflow', type: 'approval', entity: 'travel', description: 'Travel approval: Manager → HR → Finance', isActive: true, companyId: tcg.id,
        steps: { create: [
          { name: 'Manager Approval', stepOrder: 0, approverRole: 'reporting_manager', approverType: 'role', action: 'approve_reject' },
          { name: 'HR Approval', stepOrder: 1, approverRole: 'admin', approverType: 'role', action: 'approve_reject' },
          { name: 'Finance Approval', stepOrder: 2, approverRole: 'finance', approverType: 'role', action: 'approve_reject' },
        ]}
      }
    });

    // 4. Recruitment Approval
    await db.workflowDefinition.create({
      data: { name: 'Recruitment Approval Workflow', type: 'approval', entity: 'recruitment', description: 'Recruitment: HR → Department Head → CEO', isActive: true, companyId: tcg.id,
        steps: { create: [
          { name: 'HR Review', stepOrder: 0, approverRole: 'admin', approverType: 'role', action: 'approve_reject' },
          { name: 'Department Head Approval', stepOrder: 1, approverRole: 'reporting_manager', approverType: 'role', action: 'approve_reject' },
          { name: 'CEO Approval', stepOrder: 2, approverRole: 'super_admin', approverType: 'role', autoApprove: true, action: 'approve_reject' },
        ]}
      }
    });

    // 5. Onboarding Workflow
    await db.workflowDefinition.create({
      data: { name: 'Onboarding Workflow', type: 'sequential', entity: 'onboarding', description: 'Onboarding: HR → IT → Department Manager', isActive: true, companyId: tcg.id,
        steps: { create: [
          { name: 'HR Orientation', stepOrder: 0, approverRole: 'admin', approverType: 'role', action: 'confirm' },
          { name: 'IT Setup', stepOrder: 1, approverRole: 'admin', approverType: 'role', action: 'confirm' },
          { name: 'Department Introduction', stepOrder: 2, approverRole: 'reporting_manager', approverType: 'role', action: 'confirm' },
        ]}
      }
    });

    // 6. Offboarding Workflow
    await db.workflowDefinition.create({
      data: { name: 'Offboarding Workflow', type: 'sequential', entity: 'offboarding', description: 'Offboarding: Manager → HR → IT → Finance', isActive: true, companyId: tcg.id,
        steps: { create: [
          { name: 'Manager Exit Review', stepOrder: 0, approverRole: 'reporting_manager', approverType: 'role', action: 'approve_reject' },
          { name: 'HR Clearance', stepOrder: 1, approverRole: 'admin', approverType: 'role', action: 'approve_reject' },
          { name: 'IT Asset Recovery', stepOrder: 2, approverRole: 'admin', approverType: 'role', action: 'confirm' },
          { name: 'Finance Settlement', stepOrder: 3, approverRole: 'finance', approverType: 'role', action: 'approve_reject' },
        ]}
      }
    });

    // 7. Performance Review Workflow
    await db.workflowDefinition.create({
      data: { name: 'Performance Review Workflow', type: 'sequential', entity: 'performance_review', description: 'Review: Self → Manager → HR', isActive: true, companyId: tcg.id,
        steps: { create: [
          { name: 'Self Assessment', stepOrder: 0, approverRole: 'employee', approverType: 'self', action: 'submit' },
          { name: 'Manager Review', stepOrder: 1, approverRole: 'reporting_manager', approverType: 'role', action: 'rate_approve' },
          { name: 'HR Review', stepOrder: 2, approverRole: 'admin', approverType: 'role', action: 'approve_reject' },
        ]}
      }
    });

    // 8. Probation Completion Workflow
    await db.workflowDefinition.create({
      data: { name: 'Probation Completion Workflow', type: 'approval', entity: 'probation', description: 'Probation: Manager → HR → Admin', isActive: true, companyId: tcg.id,
        steps: { create: [
          { name: 'Manager Evaluation', stepOrder: 0, approverRole: 'reporting_manager', approverType: 'role', action: 'approve_reject' },
          { name: 'HR Review', stepOrder: 1, approverRole: 'admin', approverType: 'role', action: 'approve_reject' },
          { name: 'Admin Confirmation', stepOrder: 2, approverRole: 'super_admin', approverType: 'role', autoApprove: true, action: 'approve_reject' },
        ]}
      }
    });

    // ==================== SURVEYS ====================
    const survey = await db.survey.create({ data: { title: 'Q1 2025 Employee Engagement Pulse', description: 'Quarterly pulse survey.', type: 'pulse', status: 'active', startDate: new Date('2025-01-15'), endDate: new Date('2025-01-31'), companyId: tcg.id } });
    const sq1 = await db.surveyQuestion.create({ data: { question: 'How satisfied are you with your current role?', type: 'rating', order: 0, surveyId: survey.id } });
    const sq2 = await db.surveyQuestion.create({ data: { question: 'Do you feel your work is recognized?', type: 'rating', order: 1, surveyId: survey.id } });
    const sq3 = await db.surveyQuestion.create({ data: { question: 'How would you rate team collaboration?', type: 'rating', order: 2, surveyId: survey.id } });
    await db.surveyQuestion.create({ data: { question: 'What could we improve?', type: 'text', required: false, order: 3, surveyId: survey.id } });
    await db.surveyQuestion.create({ data: { question: 'Would you recommend this company?', type: 'rating', order: 4, surveyId: survey.id } });
    await db.surveyResponse.create({ data: { answer: '4', questionId: sq1.id, employeeId: emp1.id } });
    await db.surveyResponse.create({ data: { answer: '3', questionId: sq2.id, employeeId: emp1.id } });
    await db.surveyResponse.create({ data: { answer: '5', questionId: sq3.id, employeeId: emp1.id } });
    await db.surveyResponse.create({ data: { answer: '4', questionId: sq1.id, employeeId: emp2.id } });
    await db.surveyResponse.create({ data: { answer: '4', questionId: sq2.id, employeeId: emp2.id } });

    // ==================== ONBOARDING TASKS ====================
    await db.onboardingTask.create({ data: { title: 'Complete IT Setup', description: 'Laptop, email, VPN access setup', category: 'it', status: 'completed', completedAt: new Date('2024-09-02'), employeeId: emp4.id } });
    await db.onboardingTask.create({ data: { title: 'HR Orientation', description: 'Company policies, benefits overview', category: 'hr', status: 'completed', completedAt: new Date('2024-09-03'), employeeId: emp4.id } });
    await db.onboardingTask.create({ data: { title: 'Team Introduction', description: 'Meet the engineering team', category: 'team', status: 'completed', completedAt: new Date('2024-09-04'), employeeId: emp4.id } });
    await db.onboardingTask.create({ data: { title: 'Codebase Walkthrough', description: 'Overview of the main repositories', category: 'training', status: 'in_progress', employeeId: emp4.id } });
    await db.onboardingTask.create({ data: { title: 'First Project Assignment', description: 'Assign first development task', category: 'training', status: 'pending', employeeId: emp4.id } });

    // ==================== SHIFTS ====================
    const shift1 = await db.shift.create({ data: { name: 'Morning Shift', startTime: '06:00', endTime: '14:00', breakMinutes: 30, companyId: tcg.id } });
    const shift2 = await db.shift.create({ data: { name: 'General Shift', startTime: '09:00', endTime: '18:00', breakMinutes: 60, companyId: tcg.id } });
    const shift3 = await db.shift.create({ data: { name: 'Evening Shift', startTime: '14:00', endTime: '22:00', breakMinutes: 30, companyId: tcg.id } });
    const shift4 = await db.shift.create({ data: { name: 'Night Shift', startTime: '22:00', endTime: '06:00', breakMinutes: 30, companyId: tcg.id } });
    await db.shiftMember.create({ data: { effectiveDate: new Date('2025-01-01'), shiftId: shift2.id, employeeId: emp1.id } });
    await db.shiftMember.create({ data: { effectiveDate: new Date('2025-01-01'), shiftId: shift2.id, employeeId: emp2.id } });
    await db.shiftMember.create({ data: { effectiveDate: new Date('2025-01-01'), shiftId: shift2.id, employeeId: emp3.id } });

    // ==================== COMPLIANCE ====================
    await db.complianceItem.create({ data: { title: 'Annual Fire Safety Training', description: 'Mandatory fire safety training', category: 'safety', dueDate: new Date('2025-03-31'), status: 'pending', companyId: tcg.id } });
    await db.complianceItem.create({ data: { title: 'POPI Act Compliance Review', description: 'Review data protection compliance', category: 'regulatory', dueDate: new Date('2025-06-30'), status: 'pending', companyId: tcg.id } });
    await db.complianceItem.create({ data: { title: 'Quarterly Tax Filing', description: 'Q4 2024 tax filing', category: 'tax', dueDate: new Date('2025-01-31'), status: 'completed', companyId: tcg.id } });

    // ==================== NOTIFICATIONS ====================
    await db.notification.create({ data: { title: 'Leave Request', message: 'Raj Patel submitted a sick leave request', type: 'info', category: 'leave', userId: sarahUser.id } });
    await db.notification.create({ data: { title: 'New Candidate', message: 'Alex Turner applied for Senior Full-Stack Developer', type: 'success', category: 'recruitment', userId: sarahUser.id } });
    await db.notification.create({ data: { title: 'Payroll Processed', message: 'January 2025 payroll has been processed', type: 'success', category: 'payroll', userId: sarahUser.id } });
    await db.notification.create({ data: { title: 'Attendance Alert', message: 'David Wilson is absent today', type: 'warning', category: 'attendance', userId: sarahUser.id } });
    await db.notification.create({ data: { title: 'Expense Approval', message: 'You have 2 pending expense approvals', type: 'info', category: 'expense', userId: rajUser.id } });
    await db.notification.create({ data: { title: 'Probation Ending', message: 'Michael Brown probation ends on March 1', type: 'warning', category: 'employee', userId: sarahUser.id } });
    await db.notification.create({ data: { title: 'New Ticket', message: 'VPN Connection Issue reported', type: 'info', category: 'helpdesk', userId: sarahUser.id } });
    await db.notification.create({ data: { title: 'Interview Scheduled', message: 'Technical interview with Alex Turner', type: 'info', category: 'recruitment', userId: recruiterUser.id } });

    // ==================== AUDIT LOGS ====================
    await db.auditLog.create({ data: { action: 'SEED', entity: 'System', details: 'Database seeded with demo data', userId: adminUser.id } });
    await db.auditLog.create({ data: { action: 'LOGIN', entity: 'User', entityId: sarahUser.id, details: 'Sarah Johnson logged in', userId: sarahUser.id } });
    await db.auditLog.create({ data: { action: 'CREATE', entity: 'Leave', entityId: leave1.id, details: 'Leave request created', userId: sarahUser.id } });
    await db.auditLog.create({ data: { action: 'APPROVE', entity: 'Leave', entityId: leave2.id, details: 'Leave pending approval', userId: rajUser.id } });

    return NextResponse.json({
      message: 'Database seeded successfully!',
      isSeeded: true,
      counts: {
        companies: 5,
        branches: 4,
        departments: 10,
        users: 14,
        employees: 10,
        jobs: 7,
        candidates: 5,
        interviews: 3,
        attendance: 6,
        leavePolicies: 5,
        leaves: 5,
        payrollRecords: 4,
        goals: 4,
        reviewCycles: 2,
        performanceReviews: 3,
        assets: 4,
        travelRequests: 2,
        expenseClaims: 3,
        learningRecords: 3,
        tickets: 3,
        clients: 3,
        vendors: 3,
        subVendors: 2,
        workflowDefinitions: 8,
        surveys: 1,
        onboardingTasks: 5,
        shifts: 4,
        complianceItems: 3,
        notifications: 8,
        auditLogs: 4,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({
      error: 'Failed to seed database',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
