import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * POST /api/collaboration/gdpr/anonymize
 * Body: { employeeId, reason?: 'employee_exit'|'gdpr_request'|'legal_order', retentionPeriodYears?: 7 }
 *
 * REQ-SEC-EMP-02: Right to Be Forgotten (GDPR)
 *   Upon employee exit, an automated workflow must anonymize PII data
 *   (replace name with "Deleted User", scramble SSN) while retaining
 *   financial/payroll data for the legally required statutory period
 *   (e.g., 7 years).
 */
export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    if (!['super_admin', 'tenant_admin', 'admin'].includes(decoded.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { employeeId, reason = 'employee_exit', retentionPeriodYears = 7 } = body;
    if (!employeeId) return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });

    const employee = await db.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    // Create the anonymization request record
    const anonymizeReq = await db.gDPRAnonymizationRequest.create({
      data: {
        employeeId,
        requestedBy: decoded.userId,
        reason,
        status: 'in_progress',
        retentionPeriodYears,
        scheduledPurgeDate: new Date(Date.now() + retentionPeriodYears * 365 * 24 * 60 * 60 * 1000),
      },
    });

    // Anonymize PII fields on the employee record
    // REQ-SEC-EMP-02: Replace name with "Deleted User", scramble SSN/tax IDs
    // RETAIN payroll/financial data for statutory period
    const anonymizedFields = ['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'state', 'zipCode', 'emergencyContactName', 'emergencyContactPhone', 'panNumber', 'aadhaarNumber', 'taxId', 'bankName', 'bankAccountNo', 'bankIfscCode', 'avatar'];
    const retainedFields = ['salary', 'salaryCurrency', 'dateOfJoining', 'salaryStructureId', 'payrollRecords']; // financial/payroll

    await db.employee.update({
      where: { id: employeeId },
      data: {
        firstName: 'Deleted',
        lastName: 'User',
        email: `deleted+${employeeId.substring(0, 8)}@anonymized.local`,
        phone: null,
        address: null,
        city: null,
        state: null,
        zipCode: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        panNumber: 'ANONYMIZED',
        aadhaarNumber: 'ANONYMIZED',
        taxId: 'ANONYMIZED',
        bankName: null,
        bankAccountNo: null,
        bankIfscCode: null,
        avatar: null,
      },
    });

    // Mark file nodes owned by employee as anonymized
    await db.fileNode.updateMany({
      where: { ownerEmployeeId: employeeId },
      data: { isAnonymized: true },
    });

    // Update the anonymization request
    const updated = await db.gDPRAnonymizationRequest.update({
      where: { id: anonymizeReq.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        anonymizedFields: JSON.stringify(anonymizedFields),
        retainedFields: JSON.stringify(retainedFields),
      },
    });

    return NextResponse.json({
      request: updated,
      message: `Employee PII anonymized. Payroll/financial data retained for ${retentionPeriodYears} years (scheduled purge: ${updated.scheduledPurgeDate?.toISOString()}).`,
    });
  } catch (error) {
    console.error('POST GDPR anonymize error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/collaboration/gdpr/anonymize
 * Returns anonymization requests (for audit).
 */
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    if (!['super_admin', 'tenant_admin', 'admin'].includes(decoded.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const employeeId = searchParams.get('employeeId');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (employeeId) where.employeeId = employeeId;

    const requests = await db.gDPRAnonymizationRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
      },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('GET GDPR anonymize error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
