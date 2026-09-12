/**
 * Pre-OT Approval API — REQ-OT-02, REQ-OT-03 (with Comp-Off conversion)
 * + REQ-AI-ATT-04: AI auto-approval engine integration
 *
 *  GET  /api/attendance/overtime-request
 *  POST /api/attendance/overtime-request
 *  PATCH /api/attendance/overtime-request/[id]   — approve/reject + optionally convert to comp-off
 */
import { requireUser, findEmployeeByEmail, isAdminRole, parseBody, getQuery, ok, fail, OPTIONS } from '@/lib/attendance-leave-api';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { buildContext, evaluateOvertimeAutoApproval } from '@/lib/auto-approval-engine';

export { OPTIONS };

export async function GET(request: Request) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const q = getQuery(request);
    const where: Record<string, unknown> = {};
    if (!isAdminRole(user.role)) {
      const emp = await findEmployeeByEmail(user.email);
      if (!emp) return ok({ overtimeRequests: [] });
      where.employeeId = emp.id;
    } else if (q.employeeId) {
      where.employeeId = q.employeeId;
    }
    if (q.status) where.status = q.status;

    const items = await db.overtimeRequest.findMany({
      where,
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } } },
      orderBy: { date: 'desc' },
      take: 200,
    });
    return ok({ overtimeRequests: items });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to load', 500);
  }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  const body = await parseBody(request);
  if (!body) return fail('Invalid JSON');
  try {
    const emp = await findEmployeeByEmail(user.email);
    if (!emp) return fail('Employee record not found', 404);

    const date = new Date(body.date as string);
    const startTime = new Date(body.startTime as string);
    const endTime = new Date(body.endTime as string);
    const reason = (body.reason as string) || '';
    if (!startTime || !endTime || !reason) return fail('Missing required fields');

    const ms = endTime.getTime() - startTime.getTime();
    const estimatedHours = Math.max(0.25, Math.round((ms / (1000 * 60 * 60)) * 100) / 100);

    const payoutPreference = body.payoutPreference === 'comp_off' ? 'comp_off' : 'payout';

    // REQ-AI-ATT-04: run the auto-approval engine
    // Weekend OT always requires human review; weekday OT below threshold
    // may be auto-approved based on employee trust score + anti-abuse checks.
    const day = new Date(date);
    const isWeekend = day.getDay() === 0 || day.getDay() === 6; // 0=Sun, 6=Sat
    const ctx = await buildContext(emp.id);
    const decision = await evaluateOvertimeAutoApproval(ctx, {
      estimatedHours,
      payoutPreference,
      isWeekend,
    });

    const status = decision.autoApproved ? 'approved' : 'pending';
    const approvedBy = decision.autoApproved ? 'ai_auto' : null;
    const approvedAt = decision.autoApproved ? new Date() : null;
    const comments = decision.autoApproved
      ? `AI auto-approved: ${decision.reason} (confidence ${(decision.confidence * 100).toFixed(0)}%)`
      : `AI deferred to human: ${decision.reason}`;

    const record = await db.overtimeRequest.create({
      data: {
        employeeId: emp.id,
        date,
        startTime,
        endTime,
        estimatedHours,
        reason,
        projectId: (body.projectId as string) || null,
        payoutPreference,
        status,
        approvedBy,
        approvedAt,
        comments,
      },
    });

    // If auto-approved AND payout preference is comp_off, auto-credit the comp-off
    if (decision.autoApproved && payoutPreference === 'comp_off') {
      try {
        const compOff = await db.compOffLeave.create({
          data: {
            employeeId: emp.id,
            earnedDate: date,
            hours: estimatedHours,
            source: 'overtime',
            sourceOvertimeRequestId: record.id,
            expiryDate: new Date(date.getTime() + 90 * 24 * 60 * 60 * 1000), // 90-day expiry
            status: 'active',
          },
        });
        await db.overtimeRequest.update({
          where: { id: record.id },
          data: { compOffCreditedId: compOff.id, compOffCreditedAt: new Date() },
        });
      } catch (e) {
        // Non-fatal — the OT is approved, comp-off crediting can be retried
        console.warn('[overtime-request] Comp-off crediting failed (non-fatal):', e);
      }
    }

    return ok({ overtimeRequest: record, autoApprovalDecision: decision }, 201);
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to create', 500);
  }
}
