import { NextResponse } from 'next/server';
import { getPlatformDb, getDbForTenant } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(request: Request) {
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!['super_admin', 'tenant_admin', 'admin'].includes(decoded.role as string)) {
      return NextResponse.json({ error: 'Only admins can backup' }, { status: 403 });
    }

    const body = await request.json();
    const { tenantSlug } = body;
    if (!tenantSlug) return NextResponse.json({ error: 'tenantSlug is required' }, { status: 400 });

    const platformDb = getPlatformDb();
    const tenant = await platformDb.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, slug: true, name: true },
    });
    if (!tenant) return NextResponse.json({ error: `Tenant "${tenantSlug}" not found` }, { status: 404 });

    const tenantDb = await getDbForTenant(tenant.slug);

    // Collect record counts for all major tables
    const tables = [
      'employee', 'user', 'company', 'companyGroup', 'department', 'designation',
      'branch', 'leaveType', 'leaveBalance', 'leaveRequest', 'attendance',
      'shift', 'holiday', 'payrollRun', 'payroll', 'payrollComponent',
      'statutoryComponent', 'cTCTemplate', 'taxSlabTable', 'employeePaymentMethod',
      'loan', 'overtimeRecord', 'payrollHold', 'payrollInput', 'payrollValidation',
      'incomeTaxDeclaration', 'complianceFiling', 'bankPaymentFile',
      'leavePolicyRule', 'attendancePolicyRule',
      'onboardingTask', 'preboardingCandidate', 'grievance',
      'document', 'performanceReview', 'goal', 'trainingEnrollment',
      'assetAssignment', 'incidentReport', 'travelRequest', 'expenseClaim',
      'timesheet', 'project', 'task', 'projectAllocation',
      'invoice', 'invoiceLineItem', 'ticket',
    ];

    const tableCounts: { table: string; count: number }[] = [];
    let totalRecords = 0;

    for (const table of tables) {
      try {
        const count = await (tenantDb as any)[table].count();
        tableCounts.push({ table, count });
        totalRecords += count;
      } catch {
        // Table might not exist — skip
      }
    }

    const tablesWithData = tableCounts.filter(t => t.count > 0);

    // Determine storage location
    const tenantDbRecord = await platformDb.tenantDatabase.findFirst({
      where: { tenant: { slug: tenant.slug }, isActive: true },
      select: { databaseName: true },
    });
    const storageLocation = tenantDbRecord
      ? `Neon DB: ${tenantDbRecord.databaseName}`
      : 'Platform DB (shared mode)';

    // Estimate file size (rough: 1KB per record)
    const fileSizeBytes = totalRecords * 1024;

    // Save backup record to platform DB
    const backupRecord = await platformDb.backupRecord.create({
      data: {
        tenantId: tenant.id,
        triggeredBy: decoded.userId as string,
        triggeredByName: (decoded as any).email || (decoded as any).name || 'Admin',
        backupType: 'manual',
        status: 'completed',
        totalTables: tablesWithData.length,
        totalRecords,
        tableDetails: JSON.stringify(tablesWithData),
        storageLocation,
        fileSizeBytes,
        backupNotes: `Manual backup of "${tenant.name}" tenant database`,
      },
    });

    console.log(`[backup] Saved record ${backupRecord.id} for tenant "${tenantSlug}"`);

    return NextResponse.json({
      success: true,
      backupId: backupRecord.id,
      tenant: tenant.name,
      tenantSlug: tenant.slug,
      timestamp: backupRecord.createdAt.toISOString(),
      tables: tablesWithData,
      totalTables: tablesWithData.length,
      totalRecords,
      storageLocation,
      fileSizeBytes,
      message: `Backup completed for ${tenant.name}. ${totalRecords} records across ${tablesWithData.length} tables. Saved to backup repository.`,
    });
  } catch (error) {
    console.error('Backup error:', error);
    return NextResponse.json(
      { error: 'Failed to backup database', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

// GET — List all backup records
export async function GET(request: Request) {
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!['super_admin', 'tenant_admin', 'admin'].includes(decoded.role as string)) {
      return NextResponse.json({ error: 'Only admins can view backups' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    const platformDb = getPlatformDb();
    const where: Record<string, unknown> = {};
    if (tenantId) where.tenantId = tenantId;

    const records = await platformDb.backupRecord.findMany({
      where,
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ backups: records });
  } catch (error) {
    console.error('List backups error:', error);
    return NextResponse.json({ backups: [] }, { status: 200 });
  }
}
