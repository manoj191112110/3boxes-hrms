import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * GET /api/referrals/[id]
 *
 * Returns the full detail of a single referral. The caller must be
 * the referral's referrer OR a super_admin / hr_admin / tenant_admin
 * (HR needs to manage referral payouts).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getTokenFromHeaders(req);
    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401, headers: corsHeaders() }
      );
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401, headers: corsHeaders() }
      );
    }

    await ensureSchemaSynced();

    const { id } = await params;

    const referral = await withSchemaSync(() =>
      db.referral.findUnique({
        where: { id },
        include: {
          jobPosting: {
            select: { id: true, title: true, location: true, type: true, status: true },
          },
          referrerEmployee: {
            select: { id: true, firstName: true, lastName: true, employeeId: true, email: true },
          },
        },
      })
    );

    if (!referral) {
      return NextResponse.json(
        { error: 'Referral not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    // Authorization: referrer or HR/admin roles only.
    const role = String(decoded.role || '').toLowerCase();
    const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(role);
    // Need to look up the employee for this user to compare IDs.
    const callerEmployee = await db.employee.findFirst({
      where: { userId: decoded.userId as string },
      select: { id: true },
    });
    const isOwner = callerEmployee?.id === referral.referrerEmployeeId;

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'You do not have permission to view this referral' },
        { status: 403, headers: corsHeaders() }
      );
    }

    return NextResponse.json({ referral }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Referral GET [id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

/**
 * PATCH /api/referrals/[id]
 *
 * Updates a referral's status and/or bonus fields. Used by HR/Admins
 * to advance referrals through the funnel:
 *   pending → applied → interviewed → offered → hired → bonus_paid
 *
 * Body (any subset of):
 *   - status: string
 *   - bonusAmount: number
 *   - bonusCurrency: string
 *   - hiredAt: ISO string (auto-set when status → 'hired')
 *   - bonusPaidAt: ISO string (auto-set when status → 'bonus_paid')
 *   - notes: string
 *
 * Authorization: referrer (limited fields: notes only) or HR/admin (full).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getTokenFromHeaders(req);
    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401, headers: corsHeaders() }
      );
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401, headers: corsHeaders() }
      );
    }

    await ensureSchemaSynced();

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const existing = await withSchemaSync(() =>
      db.referral.findUnique({
        where: { id },
        select: {
          id: true,
          referrerEmployeeId: true,
          status: true,
          hiredAt: true,
          bonusPaidAt: true,
        },
      })
    );
    if (!existing) {
      return NextResponse.json(
        { error: 'Referral not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    const role = String(decoded.role || '').toLowerCase();
    const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(role);
    const callerEmployee = await db.employee.findFirst({
      where: { userId: decoded.userId as string },
      select: { id: true },
    });
    const isOwner = callerEmployee?.id === existing.referrerEmployeeId;

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'You do not have permission to update this referral' },
        { status: 403, headers: corsHeaders() }
      );
    }

    const VALID_STATUSES = [
      'pending',
      'applied',
      'interviewed',
      'offered',
      'hired',
      'rejected',
      'bonus_paid',
    ];

    // Build the update payload defensively — only accept fields the
    // caller is allowed to touch.
    const data: Record<string, unknown> = {};

    if (typeof body.notes === 'string') {
      data.notes = body.notes;
    }

    // Status transitions + bonus fields are HR/admin-only. Employees
    // can edit notes on their own referrals but not advance the status
    // (would let them mark their own referrals as 'bonus_paid').
    if (isAdmin) {
      if (typeof body.status === 'string') {
        if (!VALID_STATUSES.includes(body.status)) {
          return NextResponse.json(
            { error: `Invalid status. Allowed: ${VALID_STATUSES.join(', ')}` },
            { status: 400, headers: corsHeaders() }
          );
        }
        data.status = body.status;

        // Auto-set lifecycle timestamps when crossing into hired/bonus_paid.
        if (body.status === 'hired' && !existing.hiredAt) {
          data.hiredAt = new Date();
        }
        if (body.status === 'bonus_paid' && !existing.bonusPaidAt) {
          data.bonusPaidAt = new Date();
        }
      }

      if (body.bonusAmount !== undefined && body.bonusAmount !== null && body.bonusAmount !== '') {
        const parsed = typeof body.bonusAmount === 'number'
          ? body.bonusAmount
          : parseFloat(String(body.bonusAmount));
        if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
          return NextResponse.json(
            { error: 'bonusAmount must be a finite number' },
            { status: 400, headers: corsHeaders() }
          );
        }
        data.bonusAmount = parsed;
      }

      if (typeof body.bonusCurrency === 'string' && body.bonusCurrency.trim()) {
        data.bonusCurrency = body.bonusCurrency.trim().toUpperCase();
      }

      if (body.hiredAt !== undefined) {
        data.hiredAt = body.hiredAt ? new Date(body.hiredAt) : null;
      }
      if (body.bonusPaidAt !== undefined) {
        data.bonusPaidAt = body.bonusPaidAt ? new Date(body.bonusPaidAt) : null;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'No updatable fields supplied' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const updated = await withSchemaSync(() =>
      db.referral.update({
        where: { id },
        data,
        include: {
          jobPosting: { select: { id: true, title: true } },
          referrerEmployee: {
            select: { id: true, firstName: true, lastName: true, employeeId: true },
          },
        },
      })
    );

    // Best-effort audit log.
    try {
      await db.auditLog.create({
        data: {
          userId: decoded.userId as string,
          action: 'UPDATE_REFERRAL',
          module: 'referrals',
          details: `Updated referral ${id}: ${Object.keys(data).join(', ')}`,
        },
      });
    } catch {
      // Non-fatal
    }

    return NextResponse.json({ referral: updated }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Referral PATCH [id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

/**
 * DELETE /api/referrals/[id]
 *
 * Soft delete is NOT implemented on the Referral model — we hard-delete.
 * Only the referrer (while status='pending') or HR/admin may delete.
 * Once a referral has advanced past 'pending', only admins can delete it
 * (audit/compliance reasons — you don't want a referrer deleting a record
 * that's tied to a payout).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getTokenFromHeaders(req);
    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401, headers: corsHeaders() }
      );
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401, headers: corsHeaders() }
      );
    }

    await ensureSchemaSynced();

    const { id } = await params;

    const existing = await withSchemaSync(() =>
      db.referral.findUnique({
        where: { id },
        select: { id: true, referrerEmployeeId: true, status: true },
      })
    );
    if (!existing) {
      return NextResponse.json(
        { error: 'Referral not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    const role = String(decoded.role || '').toLowerCase();
    const isAdmin = ['super_admin', 'tenant_admin', 'admin'].includes(role);
    const callerEmployee = await db.employee.findFirst({
      where: { userId: decoded.userId as string },
      select: { id: true },
    });
    const isOwner = callerEmployee?.id === existing.referrerEmployeeId;

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this referral' },
        { status: 403, headers: corsHeaders() }
      );
    }

    // Employees may only delete their OWN referrals that are still pending.
    if (isOwner && !isAdmin && existing.status !== 'pending') {
      return NextResponse.json(
        { error: 'You can only delete referrals that are still pending. Contact HR to remove advanced referrals.' },
        { status: 400, headers: corsHeaders() }
      );
    }

    await withSchemaSync(() => db.referral.delete({ where: { id } }));

    // Best-effort audit log.
    try {
      await db.auditLog.create({
        data: {
          userId: decoded.userId as string,
          action: 'DELETE_REFERRAL',
          module: 'referrals',
          details: `Deleted referral ${id} (was status=${existing.status})`,
        },
      });
    } catch {
      // Non-fatal
    }

    return NextResponse.json(
      { success: true, id },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Referral DELETE [id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
