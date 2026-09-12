export const MOCK_EMPLOYEES = [
  { id: 'e1', employeeId: 'EMP001', firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.johnson@techcorp.com', designation: 'Senior Software Engineer', department: 'Engineering', status: 'active', joiningDate: '2022-03-15', company: 'TechCorp Global', avatar: '' },
  { id: 'e2', employeeId: 'EMP002', firstName: 'Raj', lastName: 'Patel', email: 'raj.patel@techcorp.com', designation: 'HR Manager', department: 'Human Resources', status: 'active', joiningDate: '2021-07-01', company: 'TechCorp Global', avatar: '' },
  { id: 'e3', employeeId: 'EMP003', firstName: 'Emily', lastName: 'Chen', email: 'emily.chen@techcorp.com', designation: 'Product Designer', department: 'Design', status: 'active', joiningDate: '2023-01-10', company: 'TechCorp Global', avatar: '' },
  { id: 'e4', employeeId: 'EMP004', firstName: 'Michael', lastName: 'Brown', email: 'michael.b@techcorp.com', designation: 'DevOps Lead', department: 'Engineering', status: 'probation', joiningDate: '2024-09-01', company: 'TechCorp Global', avatar: '' },
  { id: 'e5', employeeId: 'EMP005', firstName: 'Priya', lastName: 'Sharma', email: 'priya.s@manufactpro.com', designation: 'Production Manager', department: 'Operations', status: 'active', joiningDate: '2020-11-20', company: 'ManufactPro Industries', avatar: '' },
  { id: 'e6', employeeId: 'EMP006', firstName: 'David', lastName: 'Wilson', email: 'david.w@healthfirst.com', designation: 'Nurse Practitioner', department: 'Clinical', status: 'on_leave', joiningDate: '2019-05-15', company: 'HealthFirst Solutions', avatar: '' },
  { id: 'e7', employeeId: 'EMP007', firstName: 'Aiko', lastName: 'Tanaka', email: 'aiko.t@logitrans.com', designation: 'Fleet Coordinator', department: 'Logistics', status: 'active', joiningDate: '2023-06-01', company: 'LogiTrans Worldwide', avatar: '' },
  { id: 'e8', employeeId: 'EMP008', firstName: 'Carlos', lastName: 'Rodriguez', email: 'carlos.r@retailmax.com', designation: 'Store Manager', department: 'Retail Operations', status: 'notice_period', joiningDate: '2021-02-10', company: 'RetailMax Group', avatar: '' },
  { id: 'e9', employeeId: 'EMP009', firstName: 'Lisa', lastName: 'Anderson', email: 'lisa.a@techcorp.com', designation: 'Finance Analyst', department: 'Finance', status: 'active', joiningDate: '2022-08-22', company: 'TechCorp Global', avatar: '' },
  { id: 'e10', employeeId: 'EMP010', firstName: 'Arjun', lastName: 'Kumar', email: 'arjun.k@manufactpro.com', designation: 'Quality Inspector', department: 'Quality', status: 'active', joiningDate: '2023-04-01', company: 'ManufactPro Industries', avatar: '' },
];

export const MOCK_JOBS = [
  { id: 'j1', title: 'Senior Full-Stack Developer', department: 'Engineering', location: 'San Francisco, CA', type: 'Full-time', experience: '5-8 years', salary: '$140K - $180K', status: 'open', applicants: 47, priority: 'high', postedDate: '2024-12-01' },
  { id: 'j2', title: 'HR Business Partner', department: 'Human Resources', location: 'New York, NY', type: 'Full-time', experience: '7-10 years', salary: '$95K - $120K', status: 'open', applicants: 23, priority: 'medium', postedDate: '2024-11-28' },
  { id: 'j3', title: 'UX Research Lead', department: 'Design', location: 'Remote', type: 'Full-time', experience: '6-9 years', salary: '$120K - $150K', status: 'interviewing', applicants: 31, priority: 'high', postedDate: '2024-11-15' },
  { id: 'j4', title: 'Production Supervisor', department: 'Operations', location: 'Mumbai, India', type: 'Full-time', experience: '8-12 years', salary: '₹15L - ₹22L', status: 'open', applicants: 56, priority: 'urgent', postedDate: '2024-12-05' },
  { id: 'j5', title: 'Data Scientist', department: 'Analytics', location: 'Austin, TX', type: 'Full-time', experience: '3-5 years', salary: '$110K - $145K', status: 'draft', applicants: 0, priority: 'medium', postedDate: '' },
  { id: 'j6', title: 'Registered Nurse', department: 'Clinical', location: 'London, UK', type: 'Full-time', experience: '2-5 years', salary: '£35K - £45K', status: 'open', applicants: 18, priority: 'high', postedDate: '2024-12-03' },
  { id: 'j7', title: 'Cloud Infrastructure Engineer', department: 'Engineering', location: 'Singapore', type: 'Full-time', experience: '4-7 years', salary: 'SGD 8K - 12K', status: 'on_hold', applicants: 29, priority: 'low', postedDate: '2024-11-20' },
];

export const MOCK_CANDIDATES = [
  { id: 'cd1', firstName: 'Alex', lastName: 'Turner', email: 'alex.t@email.com', currentCompany: 'Google', currentTitle: 'Software Engineer', experience: 6, expectedSalary: 160000, noticePeriod: '30 days', status: 'interviewing', source: 'LinkedIn', aiScore: 92, skillMatch: 88, cultureFit: 85, jobId: 'j1' },
  { id: 'cd2', firstName: 'Maya', lastName: 'Singh', email: 'maya.s@email.com', currentCompany: 'Amazon', currentTitle: 'Senior Developer', experience: 8, expectedSalary: 175000, noticePeriod: '60 days', status: 'shortlisted', source: 'Naukri', aiScore: 89, skillMatch: 91, cultureFit: 80, jobId: 'j1' },
  { id: 'cd3', firstName: 'James', lastName: 'Williams', email: 'james.w@email.com', currentCompany: 'Microsoft', currentTitle: 'HR Manager', experience: 9, expectedSalary: 110000, noticePeriod: '30 days', status: 'offered', source: 'Referral', aiScore: 95, skillMatch: 94, cultureFit: 90, jobId: 'j2' },
  { id: 'cd4', firstName: 'Sophie', lastName: 'Martin', email: 'sophie.m@email.com', currentCompany: 'Meta', currentTitle: 'UX Researcher', experience: 7, expectedSalary: 140000, noticePeriod: '45 days', status: 'screening', source: 'Portal', aiScore: 78, skillMatch: 82, cultureFit: 88, jobId: 'j3' },
  { id: 'cd5', firstName: 'Wei', lastName: 'Zhang', email: 'wei.z@email.com', currentCompany: 'ByteDance', currentTitle: 'Data Engineer', experience: 4, expectedSalary: 135000, noticePeriod: '30 days', status: 'applied', source: 'Indeed', aiScore: 72, skillMatch: 68, cultureFit: 75, jobId: 'j5' },
];

export const MOCK_ATTENDANCE = [
  { id: 'a1', date: '2025-01-20', checkIn: '09:02', checkOut: '18:15', workHours: 8.5, status: 'present', source: 'biometric', employee: 'Sarah Johnson' },
  { id: 'a2', date: '2025-01-20', checkIn: '09:35', checkOut: '18:30', workHours: 8.0, status: 'late', source: 'mobile', employee: 'Raj Patel' },
  { id: 'a3', date: '2025-01-20', checkIn: '08:50', checkOut: '17:45', workHours: 8.0, status: 'present', source: 'gps', employee: 'Emily Chen' },
  { id: 'a4', date: '2025-01-20', checkIn: '', checkOut: '', workHours: 0, status: 'absent', source: '', employee: 'David Wilson' },
  { id: 'a5', date: '2025-01-20', checkIn: '09:00', checkOut: '14:00', workHours: 4.0, status: 'half_day', source: 'web', employee: 'Priya Sharma' },
  { id: 'a6', date: '2025-01-20', checkIn: '08:45', checkOut: '18:00', workHours: 8.5, status: 'present', source: 'rfid', employee: 'Aiko Tanaka' },
];

export const MOCK_LEAVES = [
  { id: 'l1', type: 'Casual Leave', startDate: '2025-01-22', endDate: '2025-01-23', totalDays: 2, reason: 'Personal work', status: 'approved', employee: 'Sarah Johnson' },
  { id: 'l2', type: 'Sick Leave', startDate: '2025-01-20', endDate: '2025-01-21', totalDays: 2, reason: 'Not feeling well', status: 'pending', employee: 'Raj Patel' },
  { id: 'l3', type: 'Paid Leave', startDate: '2025-02-10', endDate: '2025-02-14', totalDays: 5, reason: 'Family vacation', status: 'pending', employee: 'Emily Chen' },
  { id: 'l4', type: 'Maternity Leave', startDate: '2025-01-15', endDate: '2025-07-15', totalDays: 182, reason: 'Maternity', status: 'approved', employee: 'Lisa Anderson' },
  { id: 'l5', type: 'Comp Off', startDate: '2025-01-25', endDate: '2025-01-25', totalDays: 1, reason: 'Weekend work compensation', status: 'approved', employee: 'Arjun Kumar' },
];

export const MOCK_PAYROLL = [
  { id: 'p1', month: 'January', year: 2025, basicPay: 8000, grossSalary: 12000, totalDeductions: 3200, netSalary: 8800, status: 'paid', employee: 'Sarah Johnson', paymentDate: '2025-01-31' },
  { id: 'p2', month: 'January', year: 2025, basicPay: 7500, grossSalary: 11000, totalDeductions: 2900, netSalary: 8100, status: 'paid', employee: 'Raj Patel', paymentDate: '2025-01-31' },
  { id: 'p3', month: 'January', year: 2025, basicPay: 6500, grossSalary: 9500, totalDeductions: 2500, netSalary: 7000, status: 'processed', employee: 'Emily Chen', paymentDate: '' },
  { id: 'p4', month: 'January', year: 2025, basicPay: 9000, grossSalary: 13500, totalDeductions: 3600, netSalary: 9900, status: 'draft', employee: 'Michael Brown', paymentDate: '' },
];

export const MOCK_CLIENTS = [
  { id: 'cl1', name: 'Acme Corp', email: 'hr@acme.com', clientCompany: 'Acme Corporation', industry: 'Technology', contractStart: '2024-01-01', contractEnd: '2025-12-31', status: 'active', activeJobs: 5, totalHires: 12 },
  { id: 'cl2', name: 'GlobalTech Inc', email: 'talent@globaltech.com', clientCompany: 'GlobalTech Inc', industry: 'Software', contractStart: '2024-06-01', contractEnd: '2025-05-31', status: 'active', activeJobs: 3, totalHires: 8 },
  { id: 'cl3', name: 'BuildRight Construction', email: 'hr@buildright.com', clientCompany: 'BuildRight', industry: 'Construction', contractStart: '2023-09-01', contractEnd: '2024-08-31', status: 'active', activeJobs: 7, totalHires: 45 },
];

export const MOCK_VENDORS = [
  { id: 'v1', name: 'TalentHunt Agency', email: 'info@talenthunt.com', vendorCompany: 'TalentHunt', serviceType: 'recruitment', status: 'active', rating: 4.5, candidatesSubmitted: 89, successRate: 78, subVendors: 3 },
  { id: 'v2', name: 'StaffPro Solutions', email: 'contact@staffpro.com', vendorCompany: 'StaffPro', serviceType: 'staffing', status: 'active', rating: 4.2, candidatesSubmitted: 156, successRate: 72, subVendors: 5 },
  { id: 'v3', name: 'VerifyRight BGV', email: 'team@verifyright.com', vendorCompany: 'VerifyRight', serviceType: 'bgv', status: 'active', rating: 4.8, candidatesSubmitted: 340, successRate: 99, subVendors: 0 },
];

export const ANALYTICS_DATA = {
  headcount: {
    months: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'],
    values: [2200, 2280, 2310, 2380, 2420, 2440, 2450],
  },
  attrition: {
    months: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'],
    values: [3.2, 2.8, 3.5, 2.9, 3.1, 2.7, 2.4],
  },
  hiring: {
    months: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'],
    applied: [320, 280, 350, 410, 380, 290, 340],
    interviewed: [85, 72, 90, 105, 98, 75, 88],
    hired: [22, 18, 25, 30, 28, 20, 24],
  },
  departmentDistribution: [
    { name: 'Engineering', value: 680, color: '#10b981' },
    { name: 'Sales', value: 420, color: '#f59e0b' },
    { name: 'Operations', value: 380, color: '#ef4444' },
    { name: 'HR', value: 150, color: '#8b5cf6' },
    { name: 'Finance', value: 120, color: '#06b6d4' },
    { name: 'Design', value: 90, color: '#f97316' },
    { name: 'Others', value: 610, color: '#6b7280' },
  ],
  attendanceOverview: [
    { name: 'Present', value: 88, color: '#10b981' },
    { name: 'Absent', value: 4, color: '#ef4444' },
    { name: 'Late', value: 3, color: '#f59e0b' },
    { name: 'On Leave', value: 5, color: '#3b82f6' },
  ],
  payrollCost: {
    months: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'],
    values: [2.8, 2.85, 2.9, 2.95, 3.0, 3.05, 3.1],
  },
};
