import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { getTokenFromHeaders, verifyToken } from '@/lib/auth';
import { NextRequest } from 'next/server';
import { isServerLiveSite } from '@/lib/tenant-filter';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Default response when data is unavailable
const defaultResponse = {
  currentPeriod: '',
  metrics: {
    totalEmployeesProcessed: 0,
    totalActiveEmployees: 0,
    totalGrossPay: 0,
    totalDeductions: 0,
    totalNetPay: 0,
    totalEmployerContrib: 0,
    pendingApprovals: 0,
    activeHolds: 0,
  },
  recentRuns: [],
  monthlyTrend: [],
  departmentBreakdown: [],
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    // Treat empty string companyId same as null
    const effectiveCompanyId = companyId && companyId.trim() !== '' ? companyId : null;
    const tenantId = searchParams.get('tenantId');
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    // ─── GOLDEN RULE: No dummy/seed data on LIVE for super_admin ───
    // When super_admin has NO company or tenant selected, getDb() returns
    // the platform DB which may contain seed/demo payroll data.
    if (decoded.role === 'super_admin' && !effectiveCompanyId && !tenantId && isServerLiveSite(request)) {
      return Response.json({
        ...defaultResponse,
        currentPeriod: `${year}-${String(month).padStart(2, '0')}`,
        message: 'Select a company from the switcher to view payroll data.',
      }, { headers: corsHeaders });
    }

    const currentPeriod = `${year}-${String(month).padStart(2, '0')}`;

    // 1. Current month payroll run metrics
    let currentRuns: any[] = [];
    try {
      currentRuns = await db.payrollRun.findMany({
        where: {
          payrollPeriod: currentPeriod,
          ...(effectiveCompanyId ? { companyId: effectiveCompanyId } : {}),
        },
      });
    } catch {
      // PayrollRun table doesn't exist yet, return empty data
    }

    const totalGrossPay = currentRuns.reduce((s: number, r: any) => s + (r.totalGrossPay || 0), 0);
    const totalDeductions = currentRuns.reduce((s: number, r: any) => s + (r.totalDeductions || 0), 0);
    const totalNetPay = currentRuns.reduce((s: number, r: any) => s + (r.totalNetPay || 0), 0);
    const totalEmployerContrib = currentRuns.reduce((s: number, r: any) => s + (r.totalEmployerContrib || 0), 0);
    const totalEmployeesProcessed = currentRuns.reduce((s: number, r: any) => s + (r.totalEmployees || 0), 0);

    // 2. Pending approvals count
    let pendingApprovals = 0;
    try {
      pendingApprovals = await db.payrollRun.count({
        where: {
          runStatus: 'REVIEW',
          ...(effectiveCompanyId ? { companyId: effectiveCompanyId } : {}),
        },
      });
    } catch {
      // PayrollRun table doesn't exist yet, return 0
    }

    // 3. Active payroll holds count
    let activeHolds = 0;
    try {
      activeHolds = await db.payrollHold.count({
        where: { status: 'active' },
      });
    } catch {
      // PayrollHold table doesn't exist yet, return 0
    }

    // 4. Recent payroll runs (last 5)
    let recentRuns: any[] = [];
    try {
      recentRuns = await db.payrollRun.findMany({
        where: { ...(effectiveCompanyId ? { companyId: effectiveCompanyId } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
    } catch {
      // PayrollRun table doesn't exist yet, return empty array
    }

    // 5. Monthly trend (last 6 months)
    const monthlyTrend: { period: string; grossPay: number; deductions: number; netPay: number; employerContrib: number; employees: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const trendMonth = month - i;
      let tYear = year;
      let tMonth = trendMonth;
      if (tMonth <= 0) {
        tMonth = 12 + tMonth;
        tYear--;
      }
      const period = `${tYear}-${String(tMonth).padStart(2, '0')}`;
      let runs: any[] = [];
      try {
        runs = await db.payrollRun.findMany({
          where: { payrollPeriod: period, ...(effectiveCompanyId ? { companyId: effectiveCompanyId } : {}) },
        });
      } catch {
        // PayrollRun table doesn't exist yet, skip this period
      }
      monthlyTrend.push({
        period,
        grossPay: runs.reduce((s: number, r: any) => s + (r.totalGrossPay || 0), 0),
        deductions: runs.reduce((s: number, r: any) => s + (r.totalDeductions || 0), 0),
        netPay: runs.reduce((s: number, r: any) => s + (r.totalNetPay || 0), 0),
        employerContrib: runs.reduce((s: number, r: any) => s + (r.totalEmployerContrib || 0), 0),
        employees: runs.reduce((s: number, r: any) => s + (r.totalEmployees || 0), 0),
      });
    }

    // 6. Department-wise salary breakdown
    let departments: any[] = [];
    try {
      departments = await db.department.findMany({
        where: { ...(effectiveCompanyId ? { companyId: effectiveCompanyId } : {}), status: 'active' },
        include: { employees: { where: { status: 'active' }, select: { id: true, salary: true } } },
      });
    } catch {
      // Department table doesn't exist yet, return empty breakdown
    }

    const departmentBreakdown = departments.map((dept: any) => ({
      departmentId: dept.id,
      departmentName: dept.name,
      headcount: dept.employees?.length || 0,
      totalSalary: (dept.employees || []).reduce((s: number, e: any) => s + (e.salary || 0), 0),
      avgSalary: (dept.employees?.length || 0) > 0
        ? (dept.employees || []).reduce((s: number, e: any) => s + (e.salary || 0), 0) / dept.employees.length
        : 0,
    })).sort((a: any, b: any) => b.totalSalary - a.totalSalary);

    // 7. Total active employees
    let totalActiveEmployees = 0;
    try {
      totalActiveEmployees = await db.employee.count({
        where: {
          status: 'active',
          ...(effectiveCompanyId ? { department: { companyId: effectiveCompanyId } } : {}),
        },
      });
    } catch {
      // Employee table doesn't exist yet, return 0
    }

    return Response.json({
      currentPeriod,
      metrics: {
        totalEmployeesProcessed,
        totalActiveEmployees,
        totalGrossPay,
        totalDeductions,
        totalNetPay,
        totalEmployerContrib,
        pendingApprovals,
        activeHolds,
      },
      recentRuns,
      monthlyTrend,
      departmentBreakdown,
    }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error fetching payroll dashboard:', error);
    // Return default data instead of 500 error so the page can still render
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes('Unauthorized') || errMsg.includes('token')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }
    // For any other error, return default/empty data so the page renders
    return Response.json({
      ...defaultResponse,
      _warning: 'Some data could not be loaded',
    }, { headers: corsHeaders });
  }
}
