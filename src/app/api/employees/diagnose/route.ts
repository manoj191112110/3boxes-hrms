import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * Diagnostic endpoint to help debug employee lookup issues.
 * Returns a summary of employee records and tests various lookup strategies.
 */
export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const { searchParams } = new URL(request.url);
    const testId = searchParams.get('id');
    const testEmployeeId = searchParams.get('employeeId');

    const result: Record<string, unknown> = {};

    // 1. Total employee count
    try {
      result.totalCount = await db.employee.count();
    } catch {
      result.totalCount = 'ERROR';
    }

    // 2. Sample employees (first 5)
    try {
      const samples = await db.employee.findMany({
        take: 5,
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          email: true,
          departmentId: true,
          designationId: true,
          status: true,
          userId: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      result.sampleEmployees = samples.map(e => ({
        ...e,
        idPrefix: (e.id as string).substring(0, 8) + '...',
      }));
    } catch {
      result.sampleEmployees = 'ERROR';
    }

    // 3. Test specific ID lookup
    if (testId) {
      try {
        const byId = await db.employee.findUnique({
          where: { id: testId },
          select: { id: true, employeeId: true, firstName: true, lastName: true },
        });
        result.lookupById = byId || 'NOT_FOUND';
      } catch (err) {
        result.lookupById = `ERROR: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    // 4. Test specific employeeId lookup
    if (testEmployeeId) {
      try {
        const byEmployeeId = await db.employee.findUnique({
          where: { employeeId: testEmployeeId },
          select: { id: true, employeeId: true, firstName: true, lastName: true },
        });
        result.lookupByEmployeeId = byEmployeeId || 'NOT_FOUND';
      } catch (err) {
        result.lookupByEmployeeId = `ERROR: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    // 5. DB connection info
    const connectionString = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
    result.dbConnection = connectionString
      ? connectionString.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@').substring(0, 60) + '...'
      : 'NO_CONNECTION_STRING';

    return NextResponse.json(result, { headers: corsHeaders() });
  } catch (error) {
    return NextResponse.json(
      { error: 'Diagnostic failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: corsHeaders() }
    );
  }
}
