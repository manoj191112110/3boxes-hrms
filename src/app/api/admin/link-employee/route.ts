import { NextResponse } from 'next/server';
import { getDb, getPlatformDb, getDbForTenant } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * POST /api/admin/link-employee
 *
 * Links a User account to an Employee record by setting Employee.userId.
 * This is needed because the marqai seed created Employee records with
 * userId already set, but after the self-healing login (which may have
 * created a NEW User record), the userId link was lost.
 *
 * Also, some Employee records were created without a userId at all (after
 * we removed auto-User-account-creation). This endpoint finds the employee
 * by email or employeeId and links it.
 *
 * Body:
 *   { email: "admin@marqaitechgroup.com" }  — finds employee by email
 *   { employeeId: "EMP-MTPL-001" }          — finds employee by employeeId
 *   { userId: "cmtof1sjp..." }              — the user ID to link
 *
 * Or with no body: auto-links ALL users to their employee records by email.
 *
 * Only super_admin, tenant_admin, admin can call this.
 */
export async function POST(request: Request) {
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const db = await getDb(request);
    const platformDb = getPlatformDb();

    // Collect all DBs to search
    const allDbs = [db];
    if (platformDb !== db) allDbs.push(platformDb);

    const results: Array<{ email: string; userId: string; employeeId: string; status: string }> = [];

    // If specific user+employee provided, link just that one
    if (body.email || body.employeeId) {
      const targetEmail = body.email;
      const targetEmpId = body.employeeId;
      const targetUserId = body.userId || decoded.userId;

      for (const tryDb of allDbs) {
        // Search by email or employeeId
        let employee: any = null;
        try {
          if (targetEmail) {
            const rows = await tryDb.$queryRawUnsafe(
              `SELECT * FROM "Employee" WHERE LOWER(TRIM("email")) = LOWER(TRIM($1)) LIMIT 1`,
              targetEmail
            ) as any[];
            if (rows?.[0]) employee = rows[0];
          }
          if (!employee && targetEmpId) {
            const rows = await tryDb.$queryRawUnsafe(
              `SELECT * FROM "Employee" WHERE "employeeId" = $1 LIMIT 1`,
              targetEmpId
            ) as any[];
            if (rows?.[0]) employee = rows[0];
          }
        } catch { /* table might not exist */ }

        if (employee) {
          // Link the employee to the user
          try {
            await tryDb.$executeRawUnsafe(
              `UPDATE "Employee" SET "userId" = $1 WHERE "id" = $2`,
              targetUserId, employee.id
            );
            results.push({
              email: employee.email || targetEmail || 'N/A',
              userId: targetUserId,
              employeeId: employee.employeeid || employee.employeeId || 'N/A',
              status: 'linked',
            });
            console.log(`[LinkEmployee] Linked employee ${employee.id} to user ${targetUserId}`);
          } catch (err) {
            results.push({
              email: targetEmail || 'N/A',
              userId: targetUserId,
              employeeId: targetEmpId || 'N/A',
              status: `failed: ${err instanceof Error ? err.message : 'unknown'}`,
            });
          }
          break;
        }
      }

      if (results.length === 0) {
        // Employee not found — try to find by name parts from the user
        const user = await platformDb.user.findUnique({
          where: { id: targetUserId },
          select: { name: true, email: true },
        }).catch(() => null);

        if (user) {
          for (const tryDb of allDbs) {
            try {
              // Try finding any employee with NULL userId in this tenant
              const rows = await tryDb.$queryRawUnsafe(
                `SELECT * FROM "Employee" WHERE "userId" IS NULL LIMIT 5`
              ) as any[];
              if (rows && rows.length > 0) {
                // Link the first one found
                const emp = rows[0];
                await tryDb.$executeRawUnsafe(
                  `UPDATE "Employee" SET "userId" = $1, "email" = $2 WHERE "id" = $3`,
                  targetUserId, targetEmail || user.email, emp.id
                );
                results.push({
                  email: targetEmail || user.email,
                  userId: targetUserId,
                  employeeId: emp.employeeid || emp.employeeId || 'N/A',
                  status: 'linked (found by NULL userId, set email)',
                });
                break;
              }
            } catch { /* table might not exist */ }
          }
        }
      }

      if (results.length === 0) {
        return NextResponse.json({
          error: `Employee not found with email "${targetEmail}" or employeeId "${targetEmpId}" in any database.`,
          suggestion: 'The employee record may not exist yet. Create it via the Add Employee form.',
        }, { status: 404 });
      }
    } else {
      // Auto-link ALL users to their employee records by email
      const allUsers = await platformDb.user.findMany({
        where: { status: 'active' },
        select: { id: true, email: true, name: true, tenantId: true },
      }).catch(() => []);

      for (const user of allUsers) {
        for (const tryDb of allDbs) {
          try {
            const rows = await tryDb.$queryRawUnsafe(
              `SELECT * FROM "Employee" WHERE LOWER(TRIM("email")) = LOWER(TRIM($1)) LIMIT 1`,
              user.email
            ) as any[];
            if (rows?.[0]) {
              await tryDb.$executeRawUnsafe(
                `UPDATE "Employee" SET "userId" = $1 WHERE "id" = $2`,
                user.id, rows[0].id
              );
              results.push({
                email: user.email,
                userId: user.id,
                employeeId: rows[0].employeeid || 'N/A',
                status: 'linked',
              });
              break;
            }
          } catch { /* table might not exist */ }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Linked ${results.filter(r => r.status === 'linked' || r.status.startsWith('linked')).length} employee(s) to user(s).`,
      results,
    });
  } catch (error) {
    console.error('[LinkEmployee] Error:', error);
    return NextResponse.json({
      error: 'Failed to link employee',
      details: error instanceof Error ? error.message : 'Unknown',
    }, { status: 500 });
  }
}
