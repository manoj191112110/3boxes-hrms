/**
 * Gate Pass QR Verification — Level 2 security check at the turnstile
 *
 *  POST /api/attendance/requests/gate-scan
 *    body: { token: 'GP-XXXX-YYYY', scanType: 'out' | 'in' }
 *
 *  Logs the actual exit / entry times, records the scan on the security
 *  approval level, and reconciles the attendance system once both scans
 *  are captured (physical security + payroll accuracy).
 */
import { requireUser, isAdminRole, parseBody, ok, fail, OPTIONS } from '@/lib/attendance-leave-api';
import { getDb } from '@/lib/tenant-db';

export { OPTIONS };

export async function POST(request: Request) {
  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  const body = await parseBody(request);
  if (!body) return fail('Invalid JSON');
  try {
    const token = String(body.token || '').trim().toUpperCase();
    const scanType = String(body.scanType || '');
    if (!token) return fail('QR token is required');
    if (!['out', 'in'].includes(scanType)) return fail('scanType must be "out" or "in"');

    // Security desk / admins only
    const secRoles = ['security', 'it_admin', 'admin', 'tenant_admin', 'super_admin', 'hr_admin'];
    if (!isAdminRole(user.role) && !secRoles.includes(String(user.role))) {
      return fail('Only the security desk can verify gate passes', 403);
    }

    const reqRow = await db.attendanceRequest.findUnique({
      where: { qrToken: token },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
        approvals: { orderBy: { level: 'asc' } },
      },
    });
    if (!reqRow) return fail('Invalid or unknown gate pass token', 404);
    if (reqRow.requestType !== 'GATE_PASS') return fail('This token is not a gate pass');
    // The pass is scannable while pending at the security level or after approval;
    // rejected/cancelled/completed passes are not.
    if (!['pending', 'approved'].includes(reqRow.status)) {
      return fail(`Gate pass is ${reqRow.status} — QR is only valid while active`);
    }

    const now = new Date();
    const securityStep = reqRow.approvals.find((a: { actorType: string }) => a.actorType === 'security');
    const scanLog = ((securityStep?.scanLog || {}) as Record<string, unknown>);

    if (scanType === 'out') {
      if (scanLog.outAt) return fail(`Exit already logged at ${new Date(String(scanLog.outAt)).toLocaleTimeString()}`);
      scanLog.outAt = now.toISOString();
    } else {
      if (!scanLog.outAt) return fail('Exit must be logged before entry');
      if (scanLog.inAt) return fail(`Entry already logged at ${new Date(String(scanLog.inAt)).toLocaleTimeString()}`);
      scanLog.inAt = now.toISOString();
    }
    scanLog.method = 'qr_scan';

    // Update the security approval step
    if (securityStep) {
      await (db as any).attendanceRequestApproval.update({
        where: { id: securityStep.id },
        data: { status: 'verified', verifiedBy: user.id, scanLog: scanLog as any, actedAt: now },
      });
    }

    // Patch request payload with actual times
    const payload = (reqRow.payload || {}) as Record<string, unknown>;
    payload.actualOutTime = scanLog.outAt || null;
    payload.actualInTime = scanLog.inAt || null;

    const complete = !!scanLog.outAt && !!scanLog.inAt;
    if (complete) {
      payload.totalMinutesOut = Math.round((new Date(String(scanLog.inAt)).getTime() - new Date(String(scanLog.outAt)).getTime()) / 60000);
    }

    await db.attendanceRequest.update({
      where: { id: reqRow.id },
      data: {
        payload: payload as any,
        status: complete ? 'completed' : reqRow.status,
      },
    });

    // Reconcile attendance once both scans captured
    let reconciliation: string | null = null;
    if (complete) {
      const outAt = new Date(String(scanLog.outAt));
      const dayStart = new Date(outAt); dayStart.setHours(0, 0, 0, 0);
      const existing = await db.attendance.findFirst({ where: { employeeId: reqRow.employeeId, date: dayStart } });
      const note = `Gate pass ${reqRow.qrToken}: out ${outAt.toLocaleTimeString()} → in ${new Date(String(scanLog.inAt)).toLocaleTimeString()}`;
      if (existing) {
        await db.attendance.update({ where: { id: existing.id }, data: { notes: `${existing.notes ? existing.notes + ' | ' : ''}${note}` } });
      } else {
        await db.attendance.create({ data: { employeeId: reqRow.employeeId, date: dayStart, status: 'present', notes: note } as any });
      }
      reconciliation = 'Attendance reconciled with gate log';
    }

    return ok({
      message: complete
        ? `Gate pass complete — exit and entry logged (${payload.totalMinutesOut} min out)`
        : (scanType === 'out' ? 'Exit logged. Entry scan pending.' : 'Entry logged.'),
      request: { id: reqRow.id, qrToken: reqRow.qrToken, status: complete ? 'completed' : reqRow.status },
      employee: reqRow.employee,
      scanLog, reconciliation,
    });
  } catch (e: unknown) {
    console.error('[gate-scan POST]', e);
    return fail(e instanceof Error ? e.message : 'Gate scan failed', 500);
  }
}
