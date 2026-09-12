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

  // Tenant branding header
  lines.push(`# ${data.tenantName || '3Boxes HRMS'}`);
  lines.push(`# ${data.reportName || data.title || 'Report'}`);
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

  // Branded header sheet with tenant name + report name
  const headerRows: any[][] = [
    [data.tenantName || '3Boxes HRMS'],
    [data.reportName || data.title || 'Report'],
    [`Generated: ${new Date().toLocaleString()}`],
    [],
  ];
  if (data.summary && Object.keys(data.summary).length > 0) {
    headerRows.push(['Summary']);
    Object.entries(data.summary).forEach(([k, v]) => headerRows.push([k, String(v)]));
    headerRows.push([]);
  }
  if (data.rows && data.rows.length > 0) {
    headerRows.push(['Total Records', data.rows.length]);
  }
  const headerSheet = XLSX.utils.aoa_to_sheet(headerRows);
  headerSheet['!cols'] = [{ wch: 30 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, headerSheet, 'Summary');

  // Summary sheet (if separate from header)
  if (data.summary && Object.keys(data.summary).length > 0) {
    const summaryRows = Object.entries(data.summary).map(([k, v]) => ({ 'Metric': k, 'Value': String(v) }));
    const ws1 = XLSX.utils.json_to_sheet(summaryRows);
    ws1['!cols'] = [{ wch: 30 }, { wch: 20 }];
    // Only add if different from header
    if (summaryRows.length > 3) {
      XLSX.utils.book_append_sheet(wb, ws1, 'Metrics');
    }
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
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Tenant branding header (centered)
  const tenantName = data.tenantName || '3Boxes HRMS';
  const reportName = data.reportName || data.title || 'Report';
  const tenantAddress = data.tenantAddress || '';

  // Try to add tenant logo (centered at top)
  let logoAdded = false;
  if (data.tenantLogo) {
    try {
      const logoUrl = data.tenantLogo.startsWith('http') ? data.tenantLogo : null;
      if (logoUrl) {
        const logoResponse = await fetch(logoUrl);
        if (logoResponse.ok) {
          const logoBuffer = await logoResponse.arrayBuffer();
          const logoBase64 = Buffer.from(logoBuffer).toString('base64');
          const contentType = logoResponse.headers.get('content-type') || 'image/png';
          const format = contentType.includes('png') ? 'PNG' : 'JPEG';
          // Center the logo: logo width=25mm, so x = (pageWidth - 25) / 2
          doc.addImage(logoBase64, format, (pageWidth - 25) / 2, 8, 25, 25);
          logoAdded = true;
        }
      }
    } catch { /* logo fetch failed */ }
  }

  // Tenant name (centered, bold, below logo)
  let yPos = logoAdded ? 36 : 14;
  doc.setFontSize(16);
  doc.setTextColor(20, 100, 100);
  doc.text(tenantName, pageWidth / 2, yPos, { align: 'center' });

  // Company address (centered, small, below tenant name)
  yPos += 5;
  if (tenantAddress) {
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    // Split address into multiple lines if too long
    const addrLines = doc.splitTextToSize(tenantAddress, pageWidth - 40);
    addrLines.slice(0, 2).forEach((line: string, i: number) => {
      doc.text(line, pageWidth / 2, yPos + (i * 4), { align: 'center' });
    });
    yPos += addrLines.length > 1 ? 10 : 5;
  }

  // Report name (centered, below address)
  yPos += 3;
  doc.setFontSize(13);
  doc.setTextColor(40, 40, 40);
  doc.text(reportName, pageWidth / 2, yPos, { align: 'center' });

  // Horizontal line separator
  yPos += 3;
  doc.setDrawColor(20, 150, 140);
  doc.setLineWidth(0.5);
  doc.line(14, yPos, pageWidth - 14, yPos);

  // Generated date (left-aligned)
  yPos += 5;
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, yPos);

  // Summary
  yPos += 5;
  if (data.summary && Object.keys(data.summary).length > 0) {
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    const summaryText = Object.entries(data.summary).map(([k, v]) => `${k}: ${v}`).join('  |  ');
    doc.text(summaryText, 14, yPos);
    yPos += 8;
  }

  // Data table
  if (data.rows && data.rows.length > 0) {
    const headers = Object.keys(data.rows[0]);
    const body = data.rows.map((row: any) => headers.map(h => String(row[h] ?? '')));

    autoTable(doc, {
      head: [headers],
      body,
      startY: yPos,
      styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [20, 150, 140], textColor: 255, fontStyle: 'bold', halign: 'center' },
      alternateRowStyles: { fillColor: [240, 248, 248] },
      margin: { left: 14, right: 14 },
    });
  }

  // Footer with "Powered by 3Boxes HRMS" (centered)
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Footer line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);

    // Page number (left)
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${pageCount}`, 14, pageHeight - 9);

    // Powered by (centered)
    doc.setFontSize(8);
    doc.setTextColor(20, 100, 100);
    doc.text('Powered by 3Boxes HRMS', pageWidth / 2, pageHeight - 9, { align: 'center' });

    // Tenant name (right)
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(tenantName, pageWidth - 14, pageHeight - 9, { align: 'right' });
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

    // Fetch tenant info for branding (logo + name + address) in exports
    let tenantInfo: { name: string; logo: string | null; address: string; city: string; state: string; country: string } = {
      name: '3Boxes HRMS', logo: null, address: '', city: '', state: '', country: ''
    };
    try {
      if (targetTenantId) {
        const tenant = await getPlatformDb().tenant.findUnique({
          where: { id: targetTenantId },
          select: { name: true, logo: true, domain: true },
        });
        if (tenant) {
          // Also try to get the company address from the first company in the tenant
          let companyAddress = '';
          try {
            const company = await db.company.findFirst({
              where: { companyGroup: { tenantId: targetTenantId } },
              select: { name: true, address: true, city: true, state: true, country: true, phone: true, email: true },
            });
            if (company) {
              tenantInfo = {
                name: tenant.name,
                logo: tenant.logo,
                address: company.address || '',
                city: company.city || '',
                state: company.state || '',
                country: company.country || '',
              };
              // Build full address string
              const addrParts = [company.address, company.city, company.state, company.country].filter(Boolean);
              if (addrParts.length > 0) {
                companyAddress = addrParts.join(', ');
              }
              if (company.phone) companyAddress += ` | Tel: ${company.phone}`;
              if (company.email) companyAddress += ` | Email: ${company.email}`;
            }
          } catch { /* company query failed */ }

          if (!tenantInfo.name) {
            tenantInfo = { name: tenant.name, logo: tenant.logo, address: '', city: '', state: '', country: '' };
          }
          tenantInfo.address = companyAddress || tenantInfo.address;
        }
      }
    } catch { /* non-critical */ }

    // Add tenant branding to report data
    reportData.tenantName = tenantInfo.name;
    reportData.tenantLogo = tenantInfo.logo;
    reportData.tenantAddress = tenantInfo.address;
    reportData.reportName = `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`;

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
