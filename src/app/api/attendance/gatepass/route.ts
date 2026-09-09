/**
 * Gatepass API — REQ-GATE-01, REQ-GATE-02
 * + REQ-AI-ATT-04: AI auto-approval for early-departure/late-arrival within grace
 *
 * Two-tier approval: Manager (time loss) + Security (physical gate opening).
 * Visitor/contractor gatepasses have no employeeId but log visitorName/Company.
 */
import { requireUser, findEmployeeByEmail, isAdminRole, parseBody, getQuery, ok, fail, OPTIONS } from '@/lib/attendance-leave-api';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { buildContext, evaluateGatepassAutoApproval } from '@/lib/auto-approval-engine';

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
      if (!emp) return ok({ gatepasses: [] });
      where.employeeId = emp.id;
    } else if (q.employeeId) {
      where.employeeId = q.employeeId;
    }
    if (q.status) where.status = q.status;
    if (q.type) where.type = q.type;

    const items = await db.gatepass.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
      },
      orderBy: { requestedAt: 'desc' },
      take: 200,
    });
    return ok({ gatepasses: items });
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
    const type = body.type as string;
    if (!['early_departure', 'late_arrival', 'visitor', 'contractor'].includes(type)) {
      return fail('Invalid gatepass type');
    }
    const reason = (body.reason as string) || '';
    if (!reason) return fail('Reason is required');
    const requestedAt = new Date(body.requestedAt as string);

    let employeeId: string | null = null;
    if (type === 'early_departure' || type === 'late_arrival') {
      const emp = await findEmployeeByEmail(user.email);
      if (!emp) return fail('Employee record not found', 404);
      employeeId = emp.id;
    }

    // REQ-AI-ATT-04: run auto-approval engine for employee gatepasses
    // Visitor/contractor gatepasses always need security review.
    let managerStatus = 'pending';
    let managerApprovedBy: string | null = null;
    let managerApprovedAt: Date | null = null;
    let autoApprovalDecision: { autoApproved: boolean; reason: string; confidence: number } | null = null;

    if (employeeId) {
      const ctx = await buildContext(employeeId);
      const minutesOffset = typeof body.minutesOffset === 'number'
        ? Number(body.minutesOffset)
        : 30; // default 30 min if not specified
      const decision = await evaluateGatepassAutoApproval(ctx, {
        type,
        minutesOffset,
        isVisitor: false,
      });
      autoApprovalDecision = decision;
      if (decision.autoApproved) {
        managerStatus = 'approved';
        managerApprovedBy = 'ai_auto';
        managerApprovedAt = new Date();
      }
    }

    const record = await db.gatepass.create({
      data: {
        employeeId,
        visitorName: (body.visitorName as string) || null,
        visitorCompany: (body.visitorCompany as string) || null,
        visitorPhone: (body.visitorPhone as string) || null,
        projectId: (body.projectId as string) || null,
        type,
        requestedAt,
        reason,
        managerStatus,
        managerApprovedBy,
        managerApprovedAt,
        status: managerStatus === 'approved' ? 'approved' : 'pending',
      },
    });
    return ok({ gatepass: record, autoApprovalDecision }, 201);
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Failed to create', 500);
  }
}
