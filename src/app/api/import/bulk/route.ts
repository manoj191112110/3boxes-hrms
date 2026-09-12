import { NextRequest, NextResponse } from 'next/server';
import * as xlsx from 'xlsx';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders, hashPassword } from '@/lib/auth';

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

// ── Module column definitions ──────────────────────────────────────────────

interface ColumnDef {
  key: string;
  required: boolean;
  type?: 'string' | 'number' | 'date' | 'boolean';
}

const MODULE_COLUMNS: Record<string, ColumnDef[]> = {
  employees: [
    { key: 'employeeId', required: true },
    { key: 'firstName', required: true },
    { key: 'lastName', required: true },
    { key: 'email', required: true },
    { key: 'phone', required: false },
    { key: 'dateOfJoining', required: false, type: 'date' },
    { key: 'dateOfBirth', required: false, type: 'date' },
    { key: 'gender', required: false },
    { key: 'maritalStatus', required: false },
    { key: 'nationality', required: false },
    { key: 'address', required: false },
    { key: 'city', required: false },
    { key: 'state', required: false },
    { key: 'zipCode', required: false },
    { key: 'country', required: false },
    { key: 'bloodGroup', required: false },
    { key: 'bankName', required: false },
    { key: 'bankAccountNo', required: false },
    { key: 'bankIfscCode', required: false },
    { key: 'panNumber', required: false },
    { key: 'aadhaarNumber', required: false },
    { key: 'salary', required: false, type: 'number' },
    { key: 'salaryCurrency', required: false },
    { key: 'departmentName', required: false },
    { key: 'designationTitle', required: false },
    { key: 'role', required: false },
  ],
  departments: [
    { key: 'name', required: true },
    { key: 'code', required: true },
    { key: 'companyId', required: false },
    { key: 'companyName', required: false },
  ],
  designations: [
    { key: 'title', required: true },
    { key: 'departmentName', required: false },
    { key: 'grade', required: false },
    { key: 'level', required: false, type: 'number' },
    { key: 'minSalary', required: false, type: 'number' },
    { key: 'maxSalary', required: false, type: 'number' },
  ],
  branches: [
    { key: 'name', required: true },
    { key: 'code', required: true },
    { key: 'companyName', required: false },
    { key: 'city', required: false },
    { key: 'state', required: false },
    { key: 'country', required: false },
    { key: 'isHeadOffice', required: false, type: 'boolean' },
  ],
  'leave-types': [
    { key: 'name', required: true },
    { key: 'code', required: true },
    { key: 'defaultDays', required: false, type: 'number' },
    { key: 'isPaid', required: false, type: 'boolean' },
    { key: 'carryForward', required: false, type: 'boolean' },
    { key: 'maxCarryForwardDays', required: false, type: 'number' },
  ],
  'salary-structures': [
    { key: 'name', required: true },
    { key: 'description', required: false },
    { key: 'isActive', required: false, type: 'boolean' },
  ],
};

const VALID_MODULES = Object.keys(MODULE_COLUMNS);

// ── Helpers ────────────────────────────────────────────────────────────────

function parseBoolean(val: unknown): boolean | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const s = String(val).toLowerCase().trim();
  if (['true', '1', 'yes', 'y'].includes(s)) return true;
  if (['false', '0', 'no', 'n'].includes(s)) return false;
  return undefined;
}

function parseDate(val: unknown): Date | undefined {
  if (!val) return undefined;
  if (val instanceof Date) return val;
  const s = String(val).trim();
  if (!s) return undefined;
  // Try YYYY-MM-DD
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (!isNaN(d.getTime())) return d;
  }
  // Fallback to native parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  return undefined;
}

function parseNumber(val: unknown): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const n = Number(val);
  return isNaN(n) ? undefined : n;
}

function getCellValue(row: Record<string, unknown>, key: string): unknown {
  // Try exact key first, then case-insensitive
  if (row[key] !== undefined) return row[key];
  const lowerKey = key.toLowerCase();
  for (const k of Object.keys(row)) {
    if (k.toLowerCase().replace(/[^a-z0-9]/g, '') === lowerKey.replace(/[^a-z0-9]/g, '')) {
      return row[k];
    }
  }
  return undefined;
}

function getStringVal(row: Record<string, unknown>, key: string): string | undefined {
  const val = getCellValue(row, key);
  if (val === undefined || val === null || val === '') return undefined;
  return String(val).trim();
}

// ── Company / Department / Designation lookups ─────────────────────────────

async function findCompanyByName(name: string, tenantId: string): Promise<string | null> {
  const company = await db.company.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      companyGroup: { tenantId },
    },
  });
  return company?.id ?? null;
}

async function getDefaultCompanyId(tenantId: string): Promise<string | null> {
  const company = await db.company.findFirst({
    where: { companyGroup: { tenantId } },
  });
  return company?.id ?? null;
}

async function findDepartmentByName(name: string, companyId: string): Promise<string | null> {
  const dept = await db.department.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      companyId,
    },
  });
  return dept?.id ?? null;
}

async function findDesignationByTitle(title: string, departmentId?: string): Promise<string | null> {
  const where: Record<string, unknown> = {
    title: { equals: title, mode: 'insensitive' },
  };
  if (departmentId) where.departmentId = departmentId;
  const desig = await db.designation.findFirst({ where });
  return desig?.id ?? null;
}

// ── Row processors ─────────────────────────────────────────────────────────

async function processEmployeeRow(
  row: Record<string, unknown>,
  tenantId: string,
  companyId: string
): Promise<{ data?: Record<string, unknown>; error?: string }> {
  const employeeId = getStringVal(row, 'employeeId');
  const firstName = getStringVal(row, 'firstName');
  const lastName = getStringVal(row, 'lastName');
  const email = getStringVal(row, 'email');

  if (!employeeId || !firstName || !lastName || !email) {
    return { error: `Missing required fields: employeeId="${employeeId}", firstName="${firstName}", lastName="${lastName}", email="${email}"` };
  }

  // Look up department
  let departmentId: string | undefined;
  const deptName = getStringVal(row, 'departmentName');
  if (deptName) {
    departmentId = await findDepartmentByName(deptName, companyId) ?? undefined;
  }
  if (!departmentId) {
    // Try to find any department in the company
    const firstDept = await db.department.findFirst({ where: { companyId } });
    departmentId = firstDept?.id;
  }
  if (!departmentId) {
    return { error: `No department found for company. Specify a valid departmentName.` };
  }

  // Look up designation
  let designationId: string | undefined;
  const desigTitle = getStringVal(row, 'designationTitle');
  if (desigTitle) {
    designationId = await findDesignationByTitle(desigTitle, departmentId) ?? undefined;
  }
  if (!designationId) {
    // Try to find any designation in the department
    const firstDesig = await db.designation.findFirst({ where: { departmentId } });
    designationId = firstDesig?.id;
  }
  if (!designationId) {
    return { error: `No designation found for department. Specify a valid designationTitle.` };
  }

  const dateOfJoining = parseDate(getCellValue(row, 'dateOfJoining')) ?? new Date();
  const dateOfBirth = parseDate(getCellValue(row, 'dateOfBirth'));
  const salary = parseNumber(getCellValue(row, 'salary'));

  const data: Record<string, unknown> = {
    employeeId,
    firstName,
    lastName,
    email,
    phone: getStringVal(row, 'phone') ?? null,
    departmentId,
    designationId,
    branchId: null,
    companyId,
    dateOfJoining,
    dateOfBirth: dateOfBirth ?? null,
    gender: getStringVal(row, 'gender') ?? null,
    maritalStatus: getStringVal(row, 'maritalStatus') ?? null,
    nationality: getStringVal(row, 'nationality') ?? null,
    address: getStringVal(row, 'address') ?? null,
    city: getStringVal(row, 'city') ?? null,
    state: getStringVal(row, 'state') ?? null,
    zipCode: getStringVal(row, 'zipCode') ?? null,
    country: getStringVal(row, 'country') ?? null,
    bloodGroup: getStringVal(row, 'bloodGroup') ?? null,
    bankName: getStringVal(row, 'bankName') ?? null,
    bankAccountNo: getStringVal(row, 'bankAccountNo') ?? null,
    bankIfscCode: getStringVal(row, 'bankIfscCode') ?? null,
    panNumber: getStringVal(row, 'panNumber') ?? null,
    aadhaarNumber: getStringVal(row, 'aadhaarNumber') ?? null,
    salary: salary ?? null,
    salaryCurrency: getStringVal(row, 'salaryCurrency') ?? 'INR',
    role: getStringVal(row, 'role') || 'employee',
    status: 'active',
  };

  return { data };
}

async function processDepartmentRow(
  row: Record<string, unknown>,
  tenantId: string,
  companyId: string
): Promise<{ data?: Record<string, unknown>; error?: string }> {
  const name = getStringVal(row, 'name');
  const code = getStringVal(row, 'code');

  if (!name || !code) {
    return { error: `Missing required fields: name="${name}", code="${code}"` };
  }

  // Use provided companyId or lookup by companyName
  let resolvedCompanyId = companyId;
  const companyName = getStringVal(row, 'companyName');
  const directCompanyId = getStringVal(row, 'companyId');
  if (directCompanyId) {
    resolvedCompanyId = directCompanyId;
  } else if (companyName) {
    const found = await findCompanyByName(companyName, tenantId);
    if (!found) {
      return { error: `Company not found: "${companyName}"` };
    }
    resolvedCompanyId = found;
  }

  const data: Record<string, unknown> = {
    name,
    code,
    companyId: resolvedCompanyId,
    status: 'active',
  };

  return { data };
}

async function processDesignationRow(
  row: Record<string, unknown>,
  tenantId: string,
  companyId: string
): Promise<{ data?: Record<string, unknown>; error?: string }> {
  const title = getStringVal(row, 'title');

  if (!title) {
    return { error: `Missing required field: title` };
  }

  // Look up department
  let departmentId: string | undefined;
  const deptName = getStringVal(row, 'departmentName');
  if (deptName) {
    departmentId = await findDepartmentByName(deptName, companyId) ?? undefined;
  }
  if (!departmentId) {
    const firstDept = await db.department.findFirst({ where: { companyId } });
    departmentId = firstDept?.id;
  }
  if (!departmentId) {
    return { error: `No department found. Specify a valid departmentName.` };
  }

  const level = parseNumber(getCellValue(row, 'level'));
  const minSalary = parseNumber(getCellValue(row, 'minSalary'));
  const maxSalary = parseNumber(getCellValue(row, 'maxSalary'));

  const data: Record<string, unknown> = {
    title,
    departmentId,
    level: level ?? 1,
    minSalary: minSalary ?? null,
    maxSalary: maxSalary ?? null,
    status: 'active',
  };

  return { data };
}

async function processBranchRow(
  row: Record<string, unknown>,
  tenantId: string,
  companyId: string
): Promise<{ data?: Record<string, unknown>; error?: string }> {
  const name = getStringVal(row, 'name');
  const code = getStringVal(row, 'code');

  if (!name || !code) {
    return { error: `Missing required fields: name="${name}", code="${code}"` };
  }

  // Resolve companyId
  let resolvedCompanyId = companyId;
  const companyName = getStringVal(row, 'companyName');
  if (companyName) {
    const found = await findCompanyByName(companyName, tenantId);
    if (!found) {
      return { error: `Company not found: "${companyName}"` };
    }
    resolvedCompanyId = found;
  }

  const isHeadOffice = parseBoolean(getCellValue(row, 'isHeadOffice'));

  const data: Record<string, unknown> = {
    name,
    code,
    companyId: resolvedCompanyId,
    city: getStringVal(row, 'city') ?? null,
    state: getStringVal(row, 'state') ?? null,
    country: getStringVal(row, 'country') ?? null,
    status: 'active',
  };

  // Note: Branch model doesn't have isHeadOffice field in current schema;
  // the value is parsed but not stored.
  void isHeadOffice;

  return { data };
}

async function processLeaveTypeRow(
  row: Record<string, unknown>
): Promise<{ data?: Record<string, unknown>; error?: string }> {
  const name = getStringVal(row, 'name');
  const code = getStringVal(row, 'code');

  if (!name || !code) {
    return { error: `Missing required fields: name="${name}", code="${code}"` };
  }

  const defaultDays = parseNumber(getCellValue(row, 'defaultDays'));
  const isPaid = parseBoolean(getCellValue(row, 'isPaid'));
  const carryForward = parseBoolean(getCellValue(row, 'carryForward'));
  const maxCarryForwardDays = parseNumber(getCellValue(row, 'maxCarryForwardDays'));

  const data: Record<string, unknown> = {
    name,
    code,
    defaultDays: defaultDays ?? 0,
    isPaid: isPaid ?? true,
    carryForward: carryForward ?? false,
    maxCarryForward: maxCarryForwardDays ?? 0,
    status: 'active',
  };

  return { data };
}

async function processSalaryStructureRow(
  row: Record<string, unknown>,
  companyId: string
): Promise<{ data?: Record<string, unknown>; error?: string }> {
  const name = getStringVal(row, 'name');

  if (!name) {
    return { error: `Missing required field: name` };
  }

  const isActive = parseBoolean(getCellValue(row, 'isActive'));

  const data: Record<string, unknown> = {
    name,
    companyId,
    description: getStringVal(row, 'description') ?? null,
    status: isActive === false ? 'inactive' : 'active',
  };

  return { data };
}

// ── Main POST handler ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const db = await getDb(req);
  try {
    // ── Auth ──
    const token = getTokenFromHeaders(req);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const tenantId = decoded.tenantId as string;
    const userId = decoded.userId as string;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID not found in token' }, { status: 401, headers: corsHeaders() });
    }

    // ── Parse form data ──
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const importModule = formData.get('module') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400, headers: corsHeaders() });
    }

    if (!importModule || !VALID_MODULES.includes(importModule)) {
      return NextResponse.json(
        { error: `Invalid module. Must be one of: ${VALID_MODULES.join(', ')}` },
        { status: 400, headers: corsHeaders() }
      );
    }

    // ── Validate file extension ──
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Invalid file type. Only .xlsx and .xls files are supported.' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // ── Parse Excel ──
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ error: 'Excel file has no sheets' }, { status: 400, headers: corsHeaders() });
    }
    const worksheet = workbook.Sheets[sheetName];
    const rows: Record<string, unknown>[] = xlsx.utils.sheet_to_json(worksheet, { defval: '' });

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Excel file is empty' }, { status: 400, headers: corsHeaders() });
    }

    // ── Resolve default companyId for the tenant ──
    let companyId = await getDefaultCompanyId(tenantId);

    // If user has an employee record, prefer their company
    if (userId) {
      const user = await db.user.findUnique({
        where: { id: userId },
        include: { employee: { select: { companyId: true } } },
      });
      if (user?.employee?.companyId) {
        companyId = user.employee.companyId;
      }
    }

    if (!companyId && importModule !== 'leave-types') {
      return NextResponse.json(
        { error: 'No company found for your tenant. Please create a company first.' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // ── Process rows ──
    const columnDefs = MODULE_COLUMNS[importModule];
    let success = 0;
    let failed = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIndex = i + 2; // 1-based, +1 for header row

      try {
        // Validate required columns
        let missingRequired = false;
        for (const col of columnDefs) {
          if (col.required) {
            const val = getCellValue(row, col.key);
            if (val === undefined || val === null || val === '') {
              errors.push({ row: rowIndex, message: `Missing required field: ${col.key}` });
              missingRequired = true;
              break;
            }
          }
        }
        if (missingRequired) {
          failed++;
          continue;
        }

        // Process based on module
        let result: { data?: Record<string, unknown>; error?: string };

        switch (importModule) {
          case 'employees':
            result = await processEmployeeRow(row, tenantId, companyId!);
            break;
          case 'departments':
            result = await processDepartmentRow(row, tenantId, companyId!);
            break;
          case 'designations':
            result = await processDesignationRow(row, tenantId, companyId!);
            break;
          case 'branches':
            result = await processBranchRow(row, tenantId, companyId!);
            break;
          case 'leave-types':
            result = await processLeaveTypeRow(row);
            break;
          case 'salary-structures':
            result = await processSalaryStructureRow(row, companyId!);
            break;
          default:
            result = { error: `Unknown module: ${importModule}` };
        }

        if (result.error) {
          errors.push({ row: rowIndex, message: result.error });
          failed++;
          continue;
        }

        if (!result.data) {
          errors.push({ row: rowIndex, message: 'No data produced from row' });
          failed++;
          continue;
        }

        // Create record
        switch (importModule) {
          case 'employees': {
            const empRole = (result.data as Record<string, unknown>).role as string || 'employee';
            const empEmail = result.data.email as string;
            const empFirstName = result.data.firstName as string;
            const empLastName = result.data.lastName as string;
            // Remove 'role' from data since Employee model doesn't have a 'role' field
            const cleanedData = { ...result.data };
            delete cleanedData.role;
            const emp = await db.employee.create({ data: cleanedData as Parameters<typeof db.employee.create>[0]['data'] });
            // Create User account with role
            try {
              const existingUser = await db.user.findUnique({ where: { email: empEmail } });
              let userIdForEmployee: string;
              if (existingUser) {
                await db.user.update({ where: { id: existingUser.id }, data: { role: empRole } });
                userIdForEmployee = existingUser.id;
              } else {
                const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase() + '!1';
                const hashedPwd = await hashPassword(randomPassword);
                const newUser = await db.user.create({
                  data: {
                    email: empEmail,
                    name: `${empFirstName} ${empLastName}`,
                    role: empRole,
                    tenantId,
                    password: hashedPwd,
                    status: 'active',
                  },
                });
                userIdForEmployee = newUser.id;
              }
              // Link User to Employee
              await db.employee.update({ where: { id: emp.id }, data: { userId: userIdForEmployee } });
              // Create EmployeeCompanyMapping
              const empCompanyId = cleanedData.companyId as string | null;
              if (empCompanyId) {
                try {
                  await db.employeeCompanyMapping.create({
                    data: {
                      employeeId: emp.id,
                      companyId: empCompanyId,
                      employeeCode: cleanedData.employeeId as string,
                      departmentId: (cleanedData.departmentId as string) || null,
                      designationId: (cleanedData.designationId as string) || null,
                      isPrimary: true,
                      status: 'active',
                      dateOfJoining: (cleanedData.dateOfJoining as Date) || new Date(),
                    },
                  });
                } catch { /* non-critical */ }
              }
              // Create UserRoleAssignment
              try {
                const roleRecord = await db.role.findFirst({
                  where: { OR: [{ key: empRole }, { name: { equals: empRole, mode: 'insensitive' } }] },
                });
                if (roleRecord) {
                  const existingAssignment = await db.userRoleAssignment.findFirst({
                    where: { userId: userIdForEmployee, roleId: roleRecord.id, companyId: empCompanyId || null },
                  });
                  if (!existingAssignment) {
                    await db.userRoleAssignment.create({
                      data: { userId: userIdForEmployee, roleId: roleRecord.id, companyId: empCompanyId || null, assignedBy: userId || null },
                    });
                  }
                }
              } catch { /* non-critical */ }
            } catch (userErr) {
              console.error('[Bulk Import] Failed to create User account (non-critical):', userErr);
            }
            break;
          }
          case 'departments':
            await db.department.create({ data: result.data as Parameters<typeof db.department.create>[0]['data'] });
            break;
          case 'designations':
            await db.designation.create({ data: result.data as Parameters<typeof db.designation.create>[0]['data'] });
            break;
          case 'branches':
            await db.branch.create({ data: result.data as Parameters<typeof db.branch.create>[0]['data'] });
            break;
          case 'leave-types':
            await db.leaveType.create({ data: result.data as Parameters<typeof db.leaveType.create>[0]['data'] });
            break;
          case 'salary-structures':
            await db.salaryStructure.create({ data: result.data as Parameters<typeof db.salaryStructure.create>[0]['data'] });
            break;
        }

        success++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        // Handle Prisma unique constraint errors gracefully
        if (message.includes('Unique constraint') || message.includes('unique')) {
          errors.push({ row: rowIndex, message: `Duplicate record: ${message}` });
        } else {
          errors.push({ row: rowIndex, message });
        }
        failed++;
      }
    }

    return NextResponse.json(
      { success, failed, errors, total: rows.length, module: importModule },
      { headers: corsHeaders() }
    );
  } catch (error: unknown) {
    console.error('[Bulk Import] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders() });
  }
}
