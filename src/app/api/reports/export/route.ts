import { NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import * as XLSX from 'xlsx';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

// Collect real data from the tenant DB based on report type
async function collectReportData(db: any, reportType: string, tenantId: string) {
  switch (reportType) {
    case 'headcount': {
      const employees = await db.employee.findMany({
        where: { status: { in: ['active', 'on_leave', 'probation'] } },
        include: { department: { select: { name: true } }, designation: { select: { title: true } }, branch: { select: { name: true } } },
        orderBy: { employeeId: 'asc' },
      });
      const departments = await db.department.findMany({ include: { _count: { select: { employees: true } } }, orderBy: { name: 'asc' } });
      return {
        title: 'Employee Headcount Report',
        summary: { totalEmployees: employees.length, totalDepartments: departments.length },
        rows: employees.map((e: any) => ({
          'Employee ID': e.employeeId,
          'Name': `${e.firstName} ${e.lastName}`,
          'Email': e.email,
          'Department': e.department?.name || 'N/A',
          'Designation': e.designation?.title || 'N/A',
          'Branch': e.branch?.name || 'N/A',
          'Status': e.status,
          'Joining Date': e.dateOfJoining ? new Date(e.dateOfJoining).toLocaleDateString() : 'N/A',
        })),
        departmentBreakdown: departments.map((d: any) => ({
          'Department': d.name,
          'Headcount': d._count?.employees || 0,
        })),
      };
    }
    case 'department': {
      const departments = await db.department.findMany({
        include: {
          company: { select: { name: true } },
          _count: { select: { employees: true } },
        },
        orderBy: { name: 'asc' },
      });
      return {
        title: 'Department Analytics Report',
        summary: { totalDepartments: departments.length },
        rows: departments.map((d: any) => ({
          'Department': d.name,
          'Company': d.company?.name || 'N/A',
          'Headcount': d._count?.employees || 0,
          'Status': d.isActive ? 'Active' : 'Inactive',
        })),
      };
    }
    case 'demographics': {
      const employees = await db.employee.findMany({
        where: { status: { in: ['active', 'on_leave', 'probation'] } },
        select: { gender: true, dateOfBirth: true, dateOfJoining: true, department: { select: { name: true } } },
      });
      const genderCounts: Record<string, number> = {};
      const deptCounts: Record<string, number> = {};
      const now = new Date();
      let totalAge = 0;
      let ageCount = 0;
      for (const e of employees) {
        const g = e.gender || 'Not Specified';
        genderCounts[g] = (genderCounts[g] || 0) + 1;
        const d = e.department?.name || 'Unassigned';
        deptCounts[d] = (deptCounts[d] || 0) + 1;
        if (e.dateOfBirth) {
          totalAge += (now.getTime() - new Date(e.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
          ageCount++;
        }
      }
      return {
        title: 'Demographics Report',
        summary: { totalEmployees: employees.length, avgAge: ageCount > 0 ? Math.round(totalAge / ageCount * 10) / 10 : 'N/A' },
        rows: Object.entries(genderCounts).map(([g, c]) => ({ 'Gender': g, 'Count': c, 'Percentage': `${Math.round(c / employees.length * 100)}%` })),
        departmentBreakdown: Object.entries(deptCounts).map(([d, c]) => ({ 'Department': d, 'Count': c })),
      };
    }
    case 'turnover': {
      const active = await db.employee.count({ where: { status: { in: ['active', 'on_leave', 'probation'] } } });
      const terminated = await db.employee.count({ where: { status: 'terminated' } });
      const resigned = await db.employee.count({ where: { status: 'resigned' } });
      return {
        title: 'Turnover Analysis Report',
        summary: { activeEmployees: active, terminated, resigned, turnoverRate: active > 0 ? `${Math.round((terminated + resigned) / active * 100 * 10) / 10}%` : 'N/A' },
        rows: [
          { 'Status': 'Active', 'Count': active },
          { 'Status': 'Terminated', 'Count': terminated },
          { 'Status': 'Resigned', 'Count': resigned },
        ],
      };
    }
    case 'attrition': {
      const active = await db.employee.count({ where: { status: { in: ['active', 'on_leave', 'probation'] } } });
      const left = await db.employee.count({ where: { status: { in: ['terminated', 'resigned'] } } });
      const total = active + left;
      return {
        title: 'Attrition Report',
        summary: { totalEmployees: total, activeEmployees: active, employeesLeft: left, attritionRate: total > 0 ? `${Math.round(left / total * 100 * 10) / 10}%` : 'N/A' },
        rows: [
          { 'Metric': 'Total Employees', 'Value': total },
          { 'Metric': 'Active Employees', 'Value': active },
          { 'Metric': 'Employees Left', 'Value': left },
          { 'Metric': 'Attrition Rate', 'Value': total > 0 ? `${Math.round(left / total * 100 * 10) / 10}%` : 'N/A' },
        ],
      };
    }
    case 'joiners-leavers': {
      const employees = await db.employee.findMany({
        select: { status: true, dateOfJoining: true, createdAt: true },
        orderBy: { dateOfJoining: 'desc' },
      });
      const joiners = employees.filter((e: any) => e.status !== 'terminated' && e.status !== 'resigned');
      const leavers = employees.filter((e: any) => e.status === 'terminated' || e.status === 'resigned');
      return {
        title: 'Joiners & Leavers Report',
        summary: { totalJoiners: joiners.length, totalLeavers: leavers.length, netGain: joiners.length - leavers.length },
        rows: [
          { 'Category': 'Joiners', 'Count': joiners.length },
          { 'Category': 'Leavers', 'Count': leavers.length },
          { 'Category': 'Net Gain/Loss', 'Count': joiners.length - leavers.length },
        ],
      };
    }
    case 'probation': {
      const probation = await db.employee.findMany({
        where: { status: 'probation' },
        include: { department: { select: { name: true } }, designation: { select: { title: true } } },
        orderBy: { dateOfJoining: 'asc' },
      });
      return {
        title: 'Probation Report',
        summary: { totalOnProbation: probation.length },
        rows: probation.map((e: any) => ({
          'Employee ID': e.employeeId,
          'Name': `${e.firstName} ${e.lastName}`,
          'Department': e.department?.name || 'N/A',
          'Designation': e.designation?.title || 'N/A',
          'Joining Date': e.dateOfJoining ? new Date(e.dateOfJoining).toLocaleDateString() : 'N/A',
          'Days in Probation': e.dateOfJoining ? Math.floor((Date.now() - new Date(e.dateOfJoining).getTime()) / (1000 * 60 * 60 * 24)) : 'N/A',
        })),
      };
    }
    case 'login-activity': {
      const users = await db.user.findMany({
        where: { status: 'active' },
        select: { email: true, role: true, lastLoginAt: true, createdAt: true, status: true },
        orderBy: { lastLoginAt: 'desc' },
      });
      return {
        title: 'Login Activity Report',
        summary: { totalActiveUsers: users.length },
        rows: users.map((u: any) => ({
          'Email': u.email,
          'Role': u.role,
          'Status': u.status,
          'Last Login': u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never',
          'Account Created': u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A',
        })),
      };
    }
    // Company report types
    case 'company-structure': {
      const groups = await db.companyGroup.findMany({
        include: {
          companies: {
            include: {
              branches: { include: { departments: { select: { name: true } } } },
            },
          },
        },
        orderBy: { name: 'asc' },
      });
      const rows: Record<string, string>[] = [];
      for (const g of groups) {
        for (const c of g.companies) {
          for (const b of c.branches) {
            for (const d of b.departments) {
              rows.push({
                'Group': g.name,
                'Company': c.name,
                'Branch': b.name,
                'Department': d.name,
              });
            }
            if (b.departments.length === 0) {
              rows.push({ 'Group': g.name, 'Company': c.name, 'Branch': b.name, 'Department': '—' });
            }
          }
          if (c.branches.length === 0) {
            rows.push({ 'Group': g.name, 'Company': c.name, 'Branch': '—', 'Department': '—' });
          }
        }
      }
      return {
        title: 'Company Structure Report',
        summary: { groups: groups.length },
        rows,
      };
    }
    case 'headcount-distribution': {
      const companies = await db.company.findMany({
        include: { _count: { select: { employees: true } }, companyGroup: { select: { name: true } } },
        orderBy: { name: 'asc' },
      });
      return {
        title: 'Headcount Distribution',
        summary: { totalCompanies: companies.length },
        rows: companies.map((c: any) => ({
          'Company': c.name,
          'Group': c.companyGroup?.name || 'N/A',
          'Headcount': c._count?.employees || 0,
          'Status': c.isActive ? 'Active' : 'Inactive',
        })),
      };
    }
    case 'branch-summary': {
      const branches = await db.branch.findMany({
        include: { company: { select: { name: true } }, _count: { select: { employees: true, departments: true } } },
        orderBy: { name: 'asc' },
      });
      return {
        title: 'Branch-wise Summary',
        summary: { totalBranches: branches.length },
        rows: branches.map((b: any) => ({
          'Branch': b.name,
          'Company': b.company?.name || 'N/A',
          'Location': b.city && b.state ? `${b.city}, ${b.state}` : 'N/A',
          'Employees': b._count?.employees || 0,
          'Departments': b._count?.departments || 0,
          'Status': b.isActive ? 'Active' : 'Inactive',
        })),
      };
    }
    case 'department-analytics': {
      const departments = await db.department.findMany({
        include: {
          company: { select: { name: true } },
          _count: { select: { employees: true } },
        },
        orderBy: { name: 'asc' },
      });
      return {
        title: 'Department Analytics',
        summary: { totalDepartments: departments.length },
        rows: departments.map((d: any) => ({
          'Department': d.name,
          'Company': d.company?.name || 'N/A',
          'Headcount': d._count?.employees || 0,
          'Status': d.isActive ? 'Active' : 'Inactive',
        })),
      };
    }
    case 'designation-matrix': {
      const designations = await db.designation.findMany({
        include: { department: { select: { name: true } }, _count: { select: { employees: true } } },
        orderBy: { title: 'asc' },
      });
      return {
        title: 'Designation Matrix',
        summary: { totalDesignations: designations.length },
        rows: designations.map((d: any) => ({
          'Designation': d.title,
          'Department': d.department?.name || 'N/A',
          'Grade': d.grade || 'N/A',
          'Employees': d._count?.employees || 0,
          'Status': d.isActive ? 'Active' : 'Inactive',
        })),
      };
    }
    case 'holiday-calendar-summary': {
      const holidays = await db.holiday.findMany({ orderBy: { date: 'asc' } });
      return {
        title: 'Holiday Calendar Summary',
        summary: { totalHolidays: holidays.length },
        rows: holidays.map((h: any) => ({
          'Holiday': h.name,
          'Date': h.date ? new Date(h.date).toLocaleDateString() : 'N/A',
          'Type': h.type || 'N/A',
          'Status': h.isActive ? 'Active' : 'Inactive',
        })),
      };
    }
    case 'policy-compliance': {
      const policies = await db.tenantPayrollPolicy.findMany({ orderBy: [{ countryCode: 'asc' }, { policyType: 'asc' }] });
      return {
        title: 'Policy Compliance Report',
        summary: { totalPolicies: policies.length },
        rows: policies.map((p: any) => ({
          'Policy': p.policyName,
          'Type': p.policyType || 'N/A',
          'Country': p.countryName || 'N/A',
          'Status': p.status || 'N/A',
          'Source': p.source || 'N/A',
        })),
      };
    }
    default:
      return { title: 'Unknown Report', summary: {}, rows: [] };
  }
}

// Generate CSV string
function generateCSV(data: any): string {
  if (!data.rows || data.rows.length === 0) return 'No data available';

  const headers = Object.keys(data.rows[0]);
  const lines: string[] = [];

  // Title line
  lines.push(`# ${data.title}`);
  lines.push(`# Generated: ${new Date().toLocaleString()}`);
  if (data.summary) {
    for (const [k, v] of Object.entries(data.summary)) {
      lines.push(`# ${k}: ${v}`);
    }
  }
  lines.push('');

  // Header
  lines.push(headers.map(h => `"${h}"`).join(','));

  // Data rows
  for (const row of data.rows) {
    lines.push(headers.map(h => {
      const val = String(row[h] ?? '');
      return `"${val.replace(/"/g, '""')}"`;
    }).join(','));
  }

  return lines.join('\n');
}

// Generate Excel buffer
function generateExcel(data: any): Buffer {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  if (data.summary && Object.keys(data.summary).length > 0) {
    const summaryRows = Object.entries(data.summary).map(([k, v]) => ({ 'Metric': k, 'Value': String(v) }));
    const ws1 = XLSX.utils.json_to_sheet(summaryRows);
    ws1['!cols'] = [{ wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary');
  }

  // Data sheet
  if (data.rows && data.rows.length > 0) {
    const ws2 = XLSX.utils.json_to_sheet(data.rows);
    // Auto-size columns
    const cols = Object.keys(data.rows[0]).map(k => ({ wch: Math.max(k.length + 2, 15) }));
    ws2['!cols'] = cols;
    XLSX.utils.book_append_sheet(wb, ws2, 'Data');
  }

  // Department breakdown sheet (if exists)
  if (data.departmentBreakdown && data.departmentBreakdown.length > 0) {
    const ws3 = XLSX.utils.json_to_sheet(data.departmentBreakdown);
    const cols = Object.keys(data.departmentBreakdown[0]).map(k => ({ wch: Math.max(k.length + 2, 15) }));
    ws3['!cols'] = cols;
    XLSX.utils.book_append_sheet(wb, ws3, 'Breakdown');
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

// Generate PDF buffer using jsPDF
async function generatePDF(data: any): Promise<Buffer> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Title
  doc.setFontSize(18);
  doc.setTextColor(20, 100, 100);
  doc.text(data.title || 'Report', 14, 20);

  // Generated date
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 27);

  // Summary
  let y = 35;
  if (data.summary && Object.keys(data.summary).length > 0) {
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    const summaryText = Object.entries(data.summary).map(([k, v]) => `${k}: ${v}`).join('  |  ');
    doc.text(summaryText, 14, y);
    y += 8;
  }

  // Data table
  if (data.rows && data.rows.length > 0) {
    const headers = Object.keys(data.rows[0]);
    const body = data.rows.map((row: any) => headers.map(h => String(row[h] ?? '')));

    autoTable(doc, {
      head: [headers],
      body,
      startY: y,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [20, 150, 140], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 248, 248] },
      margin: { left: 14, right: 14 },
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`3Boxes HRMS - Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() - 50, doc.internal.pageSize.getHeight() - 10);
  }

  return Buffer.from(doc.output('arraybuffer'));
}

export async function POST(request: Request) {
  try {
    const db = await getDb(request);

    // Try to authenticate — check Authorization header first, then URL query param fallback
    let token = getTokenFromHeaders(request);
    if (!token) {
      // Fallback: check query param (handles cases where Authorization header is stripped by proxy/CDN)
      const { searchParams } = new URL(request.url);
      token = searchParams.get('token');
    }
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401, headers: corsHeaders() });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const body = await request.json();
    const { reportType, format, tenantId, data: inlineData } = body;

    if (!reportType || !format) {
      return NextResponse.json({ error: 'reportType and format are required' }, { status: 400, headers: corsHeaders() });
    }

    if (!['csv', 'excel', 'pdf'].includes(format)) {
      return NextResponse.json({ error: 'Invalid format. Use csv, excel, or pdf' }, { status: 400, headers: corsHeaders() });
    }

    const targetTenantId = tenantId || decoded.tenantId;

    // Collect data: use inline data from client if provided, otherwise query from DB
    let reportData: any;
    if (inlineData && Array.isArray(inlineData) && inlineData.length > 0) {
      // Client-side data (e.g., leave module sends its own filtered data)
      reportData = {
        title: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`,
        summary: { totalRecords: inlineData.length },
        rows: inlineData,
      };
    } else {
      reportData = await collectReportData(db, reportType, targetTenantId);
    }

    // Generate file based on format
    let fileBuffer: Buffer;
    let contentType: string;
    let fileName: string;

    switch (format) {
      case 'csv': {
        const csvContent = generateCSV(reportData);
        fileBuffer = Buffer.from(csvContent, 'utf-8');
        contentType = 'text/csv';
        fileName = `${reportType}-report.csv`;
        break;
      }
      case 'excel': {
        fileBuffer = generateExcel(reportData);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileName = `${reportType}-report.xlsx`;
        break;
      }
      case 'pdf': {
        fileBuffer = await generatePDF(reportData);
        contentType = 'application/pdf';
        fileName = `${reportType}-report.pdf`;
        break;
      }
      default:
        return NextResponse.json({ error: 'Unsupported format' }, { status: 400, headers: corsHeaders() });
    }

    // Return the file as a downloadable response
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        ...corsHeaders(),
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Report export error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to generate report', details: msg }, { status: 500, headers: corsHeaders() });
  }
}
