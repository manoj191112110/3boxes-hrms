import { PrismaClient } from '@/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { getPlatformDb, registerTenantDatabase } from '@/lib/tenant-db';
import { runTenantSchemaSync } from '@/lib/run-tenant-schema-sync';
import crypto from 'crypto';

const NEON_API_BASE = 'https://console.neon.tech/api/v2';

export const STANDARD_TENANT_ROLES = [
  { key: 'tenant_admin', name: 'Tenant Administrator', description: 'Full tenant access', level: 1, isSystem: true },
  { key: 'hr_admin', name: 'HR Administrator', description: 'HR operations - employees, recruitment, onboarding, leave, attendance', level: 3, isSystem: true },
  { key: 'finance_admin', name: 'Finance Administrator', description: 'Finance operations - payroll, salary structures, expenses, invoices', level: 3, isSystem: true },
  { key: 'it_admin', name: 'IT Administrator', description: 'IT operations - assets, helpdesk, system settings', level: 3, isSystem: true },
  { key: 'manager', name: 'Manager', description: 'Team management - team employees, timesheets, performance reviews, leave approvals', level: 4, isSystem: true },
  { key: 'employee', name: 'Employee', description: 'Basic employee access - view own profile, request leave, view payslips, submit timesheets', level: 5, isSystem: true },
  { key: 'recruiter', name: 'Recruiter', description: 'Recruitment operations - job postings, candidate screening, interview scheduling', level: 4, isSystem: true },
];

export type TrialRegistrationRecord = {
  id: string;
  companyName: string;
  companyCode: string;
  country: string | null;
  currency: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  companyWebsite: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  contactEmail: string;
  contactName: string;
  contactPhone: string | null;
  employeeCount: number | null;
};

export type PlatformTenantRecord = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  plan: string;
  status: string;
  country: string | null;
  currency: string;
  language: string;
  subscriptionSeats: number;
};

export type PlatformUserRecord = {
  id: string;
  email: string;
  name: string | null;
  tenantId: string | null;
};

function getPlatformConnectionString(): string {
  const url =
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    '';
  if (!url) {
    throw new Error('DATABASE_URL is not configured');
  }
  return url;
}

function parseDbOwnerFromUrl(url: string): string {
  try {
    const normalized = url.replace(/^postgresql:\/\//, 'http://').replace(/^postgres:\/\//, 'http://');
    const parsed = new URL(normalized);
    return parsed.username || 'neondb_owner';
  } catch {
    return 'neondb_owner';
  }
}

export function sanitizeTenantDatabaseName(slug: string): string {
  const normalized = slug
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  const name = `tenant_${normalized || 'db'}`.slice(0, 63);
  return name;
}

export function buildTenantConnectionString(baseUrl: string, databaseName: string): string {
  return baseUrl.replace(/\/([^/?]+)(\?.*)?$/, `/${databaseName}$2`);
}

function getNeonConfig() {
  const apiKey = process.env.NEON_API_KEY;
  const projectId = process.env.NEON_PROJECT_ID;
  const branchId = process.env.NEON_BRANCH_ID;

  if (!apiKey || !projectId || !branchId) {
    throw new Error(
      'Tenant auto-provisioning requires NEON_API_KEY, NEON_PROJECT_ID, and NEON_BRANCH_ID environment variables'
    );
  }

  return {
    apiKey,
    projectId,
    branchId,
    ownerName: process.env.NEON_DB_OWNER || parseDbOwnerFromUrl(getPlatformConnectionString()),
  };
}

async function neonRequest(
  method: string,
  path: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; text: string }> {
  const { apiKey } = getNeonConfig();
  const res = await fetch(`${NEON_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

export async function neonDatabaseExists(databaseName: string): Promise<boolean> {
  const { projectId, branchId } = getNeonConfig();
  const result = await neonRequest(
    'GET',
    `/projects/${projectId}/branches/${branchId}/databases/${databaseName}`
  );
  return result.ok;
}

export async function createNeonDatabase(databaseName: string): Promise<void> {
  const { projectId, branchId, ownerName } = getNeonConfig();

  if (await neonDatabaseExists(databaseName)) {
    console.log(`[tenant-provision] Neon database "${databaseName}" already exists — reusing`);
    return;
  }

  const result = await neonRequest(
    'POST',
    `/projects/${projectId}/branches/${branchId}/databases`,
    {
      database: {
        name: databaseName,
        owner_name: ownerName,
      },
    }
  );

  if (!result.ok) {
    if (result.status === 409 || /already exists/i.test(result.text)) {
      console.log(`[tenant-provision] Neon database "${databaseName}" already exists (409) — reusing`);
      return;
    }
    throw new Error(`Neon create database failed (${result.status}): ${result.text}`);
  }

  console.log(`[tenant-provision] Created Neon database "${databaseName}"`);
}

/** Neon may need a moment before a new database accepts DDL connections. */
async function waitForNeonDatabaseReady(connectionString: string, attempts = 8): Promise<void> {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(connectionString);
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      await sql.query('SELECT 1', []);
      return;
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  throw new Error(
    `Neon database not ready after ${attempts} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

export async function deleteNeonDatabase(databaseName: string): Promise<void> {
  if (!process.env.NEON_API_KEY || !process.env.NEON_PROJECT_ID || !process.env.NEON_BRANCH_ID) {
    return;
  }

  const { projectId, branchId } = getNeonConfig();
  const result = await neonRequest(
    'DELETE',
    `/projects/${projectId}/branches/${branchId}/databases/${databaseName}`
  );

  if (!result.ok && result.status !== 404) {
    console.warn(`[tenant-provision] Failed to delete Neon database "${databaseName}": ${result.text}`);
  }
}

function createTenantPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

export async function seedTrialTenantStructure(params: {
  tenantDb: PrismaClient;
  tenant: PlatformTenantRecord;
  user: PlatformUserRecord;
  registration: TrialRegistrationRecord;
  hashedPassword: string;
  reviewedBy?: string | null;
  now: Date;
}): Promise<void> {
  const { tenantDb, tenant, user, registration, hashedPassword, reviewedBy, now } = params;

  await tenantDb.tenant.create({
    data: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      domain: tenant.domain,
      plan: tenant.plan,
      status: tenant.status,
      country: tenant.country,
      currency: tenant.currency,
      language: tenant.language,
      subscriptionSeats: tenant.subscriptionSeats,
    },
  });

  const companyGroup = await tenantDb.companyGroup.create({
    data: {
      name: registration.companyName,
      tenantId: tenant.id,
      maxEmployees: registration.employeeCount || 10,
    },
  });

  const company = await tenantDb.company.create({
    data: {
      name: registration.companyName,
      code: registration.companyCode.toUpperCase(),
      companyGroupId: companyGroup.id,
      country: registration.country,
      currency: registration.currency || 'INR',
      email: registration.companyEmail,
      phone: registration.companyPhone,
      website: registration.companyWebsite,
      address: registration.address,
      city: registration.city,
      state: registration.state,
      zipCode: registration.zipCode,
      status: 'active',
      maxEmployees: registration.employeeCount || 10,
    },
  });

  const department = await tenantDb.department.create({
    data: {
      name: 'Administration',
      code: 'ADMIN',
      companyId: company.id,
      status: 'active',
    },
  });

  const designation = await tenantDb.designation.create({
    data: {
      title: 'Administrator',
      departmentId: department.id,
    },
  });

  const branch = await tenantDb.branch.create({
    data: {
      name: 'Head Office',
      code: 'HO',
      companyId: company.id,
      address: registration.address,
      city: registration.city,
      state: registration.state,
      zipCode: registration.zipCode,
      country: registration.country,
      status: 'active',
    },
  });

  await tenantDb.user.create({
    data: {
      id: user.id,
      email: registration.contactEmail,
      password: hashedPassword,
      name: registration.contactName,
      tenantId: tenant.id,
      role: 'tenant_admin',
      status: 'active',
    },
  });

  const employeeCode = `EMP-${registration.companyCode.toUpperCase()}-001`;
  const firstName = registration.contactName.split(' ')[0] || registration.contactName;
  const lastName = registration.contactName.split(' ').slice(1).join(' ') || 'Admin';
  const employeeRowId = crypto.randomUUID();

  // Raw insert — Prisma model omits legacy 0_init NOT NULL columns (designation, joiningDate).
  await tenantDb.$executeRaw`
    INSERT INTO "Employee" (
      "id", "employeeId", "firstName", "lastName", "email", "phone",
      "userId", "departmentId", "designationId", "branchId", "companyId",
      "designation", "joiningDate", "dateOfJoining",
      "employmentType", "status", "salaryCurrency",
      "createdAt", "updatedAt"
    ) VALUES (
      ${employeeRowId},
      ${employeeCode},
      ${firstName},
      ${lastName},
      ${registration.contactEmail},
      ${registration.contactPhone},
      ${user.id},
      ${department.id},
      ${designation.id},
      ${branch.id},
      ${company.id},
      ${'Administrator'},
      ${now},
      ${now},
      ${'full-time'},
      ${'active'},
      ${registration.currency || 'INR'},
      ${now},
      ${now}
    )
  `;

  await tenantDb.role.createMany({
    data: STANDARD_TENANT_ROLES.map((roleDef) => ({
      name: roleDef.name,
      key: roleDef.key,
      description: roleDef.description,
      level: roleDef.level,
      isSystem: roleDef.isSystem,
      tenantId: tenant.id,
      companyId: null,
      status: 'active',
      createdBy: reviewedBy || null,
    })),
    skipDuplicates: true,
  });

  const tenantAdminRole = await tenantDb.role.findFirst({
    where: { key: 'tenant_admin', tenantId: tenant.id, companyId: null },
  });

  if (tenantAdminRole) {
    await tenantDb.userRoleAssignment.create({
      data: {
        userId: user.id,
        roleId: tenantAdminRole.id,
        companyId: company.id,
        assignedBy: reviewedBy || null,
      },
    });
  }
}

export async function provisionDedicatedTenantDatabase(params: {
  tenant: PlatformTenantRecord;
  user: PlatformUserRecord;
  registration: TrialRegistrationRecord;
  hashedPassword: string;
  reviewedBy?: string | null;
  now: Date;
}): Promise<{ databaseName: string; connectionString: string }> {
  const databaseName = sanitizeTenantDatabaseName(params.tenant.slug);
  const platformConnectionString = getPlatformConnectionString();

  await createNeonDatabase(databaseName);

  const connectionString = buildTenantConnectionString(platformConnectionString, databaseName);
  await waitForNeonDatabaseReady(connectionString);

  console.log(`[tenant-provision] Syncing schema for "${databaseName}"...`);
  await runTenantSchemaSync(connectionString);

  // Belt-and-suspenders: re-apply legacy column fixes (Next dev can cache older runner code).
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(connectionString);
  for (const stmt of [
    `ALTER TABLE "Employee" ALTER COLUMN "designation" DROP NOT NULL`,
    `ALTER TABLE "Employee" ALTER COLUMN "designation" SET DEFAULT 'Employee'`,
    `ALTER TABLE "Employee" ALTER COLUMN "joiningDate" DROP NOT NULL`,
    `ALTER TABLE "Employee" ALTER COLUMN "joiningDate" SET DEFAULT CURRENT_TIMESTAMP`,
  ]) {
    try {
      await sql.query(stmt, []);
    } catch {
      /* ignore benign */
    }
  }

  const tenantDb = createTenantPrismaClient(connectionString);
  try {
    await tenantDb.$queryRaw`SELECT 1`;
    await seedTrialTenantStructure({
      tenantDb,
      tenant: params.tenant,
      user: params.user,
      registration: params.registration,
      hashedPassword: params.hashedPassword,
      reviewedBy: params.reviewedBy,
      now: params.now,
    });
  } finally {
    await tenantDb.$disconnect().catch(() => {});
  }

  const neonConfig = getNeonConfig();
  await registerTenantDatabase({
    tenantId: params.tenant.id,
    connectionString,
    directUrl: connectionString,
    databaseName,
    neonBranchId: neonConfig.branchId,
    neonProjectId: neonConfig.projectId,
  });

  console.log(`[tenant-provision] Registered dedicated DB "${databaseName}" for tenant "${params.tenant.slug}"`);

  return { databaseName, connectionString };
}

export async function rollbackFailedTrialProvision(params: {
  registrationId: string;
  tenantId: string;
  databaseName?: string;
}): Promise<void> {
  const platformDb = getPlatformDb();

  if (params.databaseName) {
    await deleteNeonDatabase(params.databaseName).catch(() => {});
  }

  await platformDb.tenantDatabase.deleteMany({ where: { tenantId: params.tenantId } }).catch(() => {});
  await platformDb.user.deleteMany({ where: { tenantId: params.tenantId } }).catch(() => {});
  await platformDb.tenant.delete({ where: { id: params.tenantId } }).catch(() => {});

  await platformDb.trialRegistration
    .update({
      where: { id: params.registrationId },
      data: {
        status: 'pending',
        tenantId: null,
        tempPassword: null,
        reviewedBy: null,
        reviewedAt: null,
        trialStart: null,
        trialEnd: null,
      },
    })
    .catch(() => {});
}
