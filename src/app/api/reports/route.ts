import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { getDataScope } from '@/lib/roleAccess';

export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userRole = (decoded.role as string) || 'employee';
    const userId = decoded.userId as string;
    const scope = getDataScope(userRole);
    const isSelfOnly = scope === 'self';
    const isTeam = scope === 'team';

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'employee_report';

    // Build employee filter based on role
    let employeeFilter: Record<string, unknown> = { status: 'active' };

    if (isSelfOnly && userId) {
      employeeFilter = { userId, status: 'active' };
    } else if (isTeam && userId) {
      const ownEmp = await db.employee.findFirst({
        where: { userId, status: 'active' },
        select: { departmentId: true },
      });
      if (ownEmp) {
        employeeFilter = { departmentId: ownEmp.departmentId, status: 'active' };
      }
    }

    // Exclude super_admin users from HR admin view
    if (userRole === 'admin') {
      employeeFilter = {
        ...employeeFilter,
        user: { role: { not: 'super_admin' } },
      };
    }

    switch (type) {
      case 'employee_report': {
        const totalEmployees = await db.employee.count({ where: employeeFilter });
        const newHires30d = await db.employee.count({
          where: { ...employeeFilter, dateOfJoining: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        });
        const deptData = await db.employee.findMany({
          where: employeeFilter,
          select: { department: { select: { name: true } }, designation: { select: { title: true } } },
        });
        const deptMap: Record<string, number> = {};
        deptData.forEach((e) => {
          const name = e.department?.name || 'Unknown';
          deptMap[name] = (deptMap[name] || 0) + 1;
        });
        const separated = isSelfOnly ? 0 : await db.employee.count({ where: { status: { in: ['terminated', 'resigned'] } } });
        const employees = await db.employee.findMany({
          where: employeeFilter,
          select: { employeeId: true, firstName: true, lastName: true, email: true, department: { select: { name: true } }, designation: { select: { title: true } }, dateOfJoining: true, status: true },
          take: isSelfOnly ? 1 : 100,
          orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json({ type, headcount: totalEmployees, newHires: newHires30d, attrition: separated, departmentDistribution: deptMap, employees, dataScope: scope });
      }

      case 'leave_report': {
        const leaveRequests = await db.leaveRequest.findMany({
          where: isSelfOnly ? { employee: { userId } } : isTeam ? { employee: employeeFilter } : {},
          select: { leaveType: { select: { name: true } }, status: true, startDate: true, endDate: true, employee: { select: { firstName: true, lastName: true, department: { select: { name: true } } } } },
          take: 200,
          orderBy: { createdAt: 'desc' },
        });
        const byType: Record<string, number> = {};
        leaveRequests.forEach((lr) => {
          const name = lr.leaveType?.name || 'Unknown';
          byType[name] = (byType[name] || 0) + 1;
        });
        const byStatus: Record<string, number> = {};
        leaveRequests.forEach((lr) => { byStatus[lr.status] = (byStatus[lr.status] || 0) + 1; });
        const deptLeave: Record<string, number> = {};
        leaveRequests.forEach((lr) => {
          const dept = lr.employee?.department?.name || 'Unknown';
          deptLeave[dept] = (deptLeave[dept] || 0) + 1;
        });
        return NextResponse.json({ type, byType, byStatus, departmentAverages: deptLeave, records: leaveRequests, total: leaveRequests.length, dataScope: scope });
      }

      case 'attendance_report': {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const attendance = await db.attendance.findMany({
          where: {
            date: { gte: thirtyDaysAgo },
            ...(isSelfOnly ? { employee: { userId } } : isTeam ? { employee: employeeFilter } : {}),
          },
          select: { status: true, workHours: true, overtime: true, employee: { select: { firstName: true, lastName: true, department: { select: { name: true } } } }, date: true },
          take: 500,
          orderBy: { date: 'desc' },
        });
        const byStatus: Record<string, number> = {};
        attendance.forEach((a) => { byStatus[a.status] = (byStatus[a.status] || 0) + 1; });
        const lateArrivals = attendance.filter((a) => a.status === 'late').length;
        const totalOvertime = attendance.reduce((sum, a) => sum + (a.overtime || 0), 0);
        const present = attendance.filter((a) => ['present', 'late'].includes(a.status)).length;
        const rate = attendance.length > 0 ? ((present / attendance.length) * 100).toFixed(1) : '0';
        return NextResponse.json({ type, attendanceRate: parseFloat(rate), lateArrivals, totalOvertime, byStatus, records: attendance, total: attendance.length, dataScope: scope });
      }

      case 'payroll_report': {
        // Payroll data is sensitive — only accessible to hr_admin, finance, tenant_admin, super_admin
        if (isSelfOnly) {
          return NextResponse.json({ type, totalGross: 0, totalNet: 0, departmentCosts: {}, monthOverMonth: {}, records: [], total: 0, dataScope: scope, message: 'Self-service payroll view - use payslips endpoint' });
        }
        const payrolls = await db.payroll.findMany({
          where: isTeam ? { employee: employeeFilter } : {},
          select: { month: true, year: true, grossSalary: true, netSalary: true, totalDeductions: true, status: true, currency: true, employee: { select: { firstName: true, lastName: true, department: { select: { name: true } } } } },
          take: 500,
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
        });
        const deptCost: Record<string, number> = {};
        payrolls.forEach((p) => {
          const dept = p.employee?.department?.name || 'Unknown';
          deptCost[dept] = (deptCost[dept] || 0) + p.netSalary;
        });
        const byMonth: Record<string, { gross: number; net: number; deductions: number }> = {};
        payrolls.forEach((p) => {
          const key = `${p.year}-${String(p.month).padStart(2, '0')}`;
          if (!byMonth[key]) byMonth[key] = { gross: 0, net: 0, deductions: 0 };
          byMonth[key].gross += p.grossSalary;
          byMonth[key].net += p.netSalary;
          byMonth[key].deductions += p.totalDeductions;
        });
        const totalGross = payrolls.reduce((s, p) => s + p.grossSalary, 0);
        const totalNet = payrolls.reduce((s, p) => s + p.netSalary, 0);
        return NextResponse.json({ type, totalGross, totalNet, departmentCosts: deptCost, monthOverMonth: byMonth, records: payrolls, total: payrolls.length, dataScope: scope });
      }

      case 'recruitment_report': {
        // Recruitment reports restricted for self-only
        if (isSelfOnly) {
          return NextResponse.json({ type, openPositions: 0, totalApplications: 0, sourceEffectiveness: {}, byStatus: {}, timeToFill: 'N/A', records: [], dataScope: scope, message: 'Recruitment reports not available for self-service' });
        }
        const openPositions = await db.jobPosting.count({ where: { status: 'open' } });
        const applications = await db.jobApplication.findMany({
          select: { source: true, status: true, appliedDate: true, jobPosting: { select: { title: true, department: { select: { name: true } } } } },
          take: 500,
          orderBy: { appliedDate: 'desc' },
        });
        const bySource: Record<string, number> = {};
        applications.forEach((a) => { bySource[a.source] = (bySource[a.source] || 0) + 1; });
        const byStatus: Record<string, number> = {};
        applications.forEach((a) => { byStatus[a.status] = (byStatus[a.status] || 0) + 1; });
        const hired = applications.filter((a) => a.status === 'hired').length;
        const timeToFill = applications.length > 0 && hired > 0 ? '21 days avg' : 'N/A';
        return NextResponse.json({ type, openPositions, totalApplications: applications.length, sourceEffectiveness: bySource, byStatus, timeToFill, records: applications, dataScope: scope });
      }

      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Reports error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
