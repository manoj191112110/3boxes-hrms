import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

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

    // Total employees
    const totalEmployees = await db.employee.count({ where: { status: 'active' } });

    // New hires (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newHires = await db.employee.count({
      where: { dateOfJoining: { gte: thirtyDaysAgo } },
    });

    // Attrition (separated employees in last 30 days)
    const separated = await db.employee.count({
      where: { status: { in: ['terminated', 'resigned'] } },
    });
    const attritionRate = totalEmployees > 0 ? ((separated / totalEmployees) * 100).toFixed(1) : '0';

    // Department distribution
    const deptEmployees = await db.employee.findMany({
      where: { status: 'active' },
      select: { department: { select: { name: true } } },
    });
    const deptMap: Record<string, number> = {};
    deptEmployees.forEach((e) => {
      const name = e.department?.name || 'Unknown';
      deptMap[name] = (deptMap[name] || 0) + 1;
    });
    const departmentDistribution = Object.entries(deptMap).map(([name, count]) => ({ name, count }));

    // Leave statistics
    const pendingLeaves = await db.leaveRequest.count({ where: { status: 'pending' } });
    const approvedLeaves = await db.leaveRequest.count({ where: { status: 'approved' } });
    const totalLeaves = await db.leaveRequest.count();

    // Attendance rate (last 30 days)
    const recentAttendance = await db.attendance.findMany({
      where: { date: { gte: thirtyDaysAgo } },
      select: { status: true },
    });
    const presentCount = recentAttendance.filter((a) => ['present', 'late'].includes(a.status)).length;
    const attendanceRate = recentAttendance.length > 0 ? ((presentCount / recentAttendance.length) * 100).toFixed(1) : '0';

    // Payroll summary
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const payrollRecords = await db.payroll.findMany({
      where: { month: currentMonth, year: currentYear },
      select: { netSalary: true, status: true, currency: true },
    });
    const totalPayroll = payrollRecords.reduce((sum, p) => sum + p.netSalary, 0);
    const paidPayroll = payrollRecords.filter((p) => p.status === 'paid').reduce((sum, p) => sum + p.netSalary, 0);

    // Recruitment funnel
    const openPositions = await db.jobPosting.count({ where: { status: 'open' } });
    const totalApplications = await db.jobApplication.count();
    const interviewStage = await db.jobApplication.count({ where: { status: 'interview' } });
    const offered = await db.jobApplication.count({ where: { status: 'offered' } });
    const hired = await db.jobApplication.count({ where: { status: 'hired' } });

    return NextResponse.json({
      employees: { total: totalEmployees, newHires, attritionRate: parseFloat(attritionRate) },
      departmentDistribution,
      leave: { pending: pendingLeaves, approved: approvedLeaves, total: totalLeaves },
      attendance: { rate: parseFloat(attendanceRate), present: presentCount, total: recentAttendance.length },
      payroll: { total: totalPayroll, paid: paidPayroll, pending: totalPayroll - paidPayroll, currency: 'INR', month: currentMonth, year: currentYear, recordCount: payrollRecords.length },
      recruitment: { openPositions, totalApplications, interviewStage, offered, hired },
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
