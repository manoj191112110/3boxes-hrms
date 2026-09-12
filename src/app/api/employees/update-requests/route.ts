/**
 * Employee Update Requests API
 *
 *   GET  /api/employees/update-requests              — list (mine | inbox | all)
 *   POST /api/employees/update-requests              — submit a new profile-change request
 *
 * Field sensitivity:
 *   'low'        — direct update (phone, address, emergency contact)
 *   'high'       — requires approval (bank details, legal name, PAN, Aadhaar)
 *   'restricted' — never editable by employee (salary, employeeId, userId)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { getAuthInfo } from '@/lib/companyScope';
import { sanitizeMultiLineText } from '@/lib/sanitize';
import { loadWorkflowConfig, resolveTierApprovers } from '@/lib/approverResolve';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

// Field sensitivity classification
const FIELD_SENSITIVITY: Record<string, { sensitivity: 'low' | 'high' | 'restricted'; category: string; label: string }> = {
  // Contact (low-risk — direct update)
  phone:               { sensitivity: 'low',  category: 'contact',    label: 'Phone Number' },
  address:             { sensitivity: 'low',  category: 'contact',    label: 'Address' },
  city:                { sensitivity: 'low',  category: 'contact',    label: 'City' },
  state:               { sensitivity: 'low',  category: 'contact',    label: 'State' },
  zipCode:             { sensitivity: 'low',  category: 'contact',    label: 'ZIP Code' },
  country:             { sensitivity: 'low',  category: 'contact',    label: 'Country' },
  emergencyContactName: { sensitivity: 'low', category: 'contact',    label: 'Emergency Contact Name' },
  emergencyContactPhone: { sensitivity: 'low', category: 'contact',   label: 'Emergency Contact Phone' },
  personalEmail:       { sensitivity: 'low',  category: 'contact',    label: 'Personal Email' },

  // Personal (high-risk — approval required)
  firstName:           { sensitivity: 'high', category: 'personal',   label: 'First Name' },
  lastName:            { sensitivity: 'high', category: 'personal',   label: 'Last Name' },
  dateOfBirth:         { sensitivity: 'high', category: 'personal',   label: 'Date of Birth' },
  gender:              { sensitivity: 'high', category: 'personal',   label: 'Gender' },
  maritalStatus:       { sensitivity: 'high', category: 'personal',   label: 'Marital Status' },
  nationality:         { sensitivity: 'high', category: 'personal',   label: 'Nationality' },

  // Employment (high-risk)
  departmentId:        { sensitivity: 'high', category: 'employment', label: 'Department' },
  designationId:       { sensitivity: 'high', category: 'employment', label: 'Designation' },
  branchId:            { sensitivity: 'high', category: 'employment', label: 'Branch' },
  reportingManagerId:  { sensitivity: 'high', category: 'employment', label: 'Reporting Manager' },
  employeeType:        { sensitivity: 'high', category: 'employment', label: 'Employee Type' },
  employeeStatus:      { sensitivity: 'high', category: 'employment', label: 'Employee Status' },

  // Financial / KYC (high-risk — definitely approval-required)
  bankName:            { sensitivity: 'high', category: 'financial',  label: 'Bank Name' },
  bankAccountNo:       { sensitivity: 'high', category: 'financial',  label: 'Bank Account Number' },
  bankIfscCode:        { sensitivity: 'high', category: 'financial',  label: 'Bank IFSC Code' },
  panNumber:           { sensitivity: 'high', category: 'kyc',        label: 'PAN Number' },
  aadhaarNumber:       { sensitivity: 'high', category: 'kyc',        label: 'Aadhaar Number' },
  taxId:               { sensitivity: 'high', category: 'kyc',        label: 'Tax ID' },

  // Restricted (never editable by employee)
  email:               { sensitivity: 'restricted', category: 'system', label: 'Official Email' },
  employeeId:          { sensitivity: 'restricted', category: 'system', label: 'Employee ID' },
  userId:              { sensitivity: 'restricted', category: 'system', label: 'User ID' },
  salary:              { sensitivity: 'restricted', category: 'system', label: 'Salary' },
  salaryCurrency:      { sensitivity: 'restricted', category: 'system', label: 'Salary Currency' },
  salaryStructureId:   { sensitivity: 'restricted', category: 'system', label: 'Salary Structure' },
  dateOfJoining:       { sensitivity: 'restricted', category: 'system', label: 'Date of Joining' },
  status:              { sensitivity: 'restricted', category: 'system', label: 'Employee Status' },
  companyId:           { sensitivity: 'restricted', category: 'system', label: 'Company' },
};

export async function GET(req: NextRequest) {
  const db = await getDb(req);
  try {
    const auth = await getAuthInfo(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const url = new URL(req.url);
    const scope = url.searchParams.get('scope') || 'mine';
    const isAdmin = ['super_admin', 'tenant_admin', 'admin', 'hr_admin'].includes(auth.role);

    let where: Record<string, unknown> = {};
    if (scope === 'inbox') {
      // Requests waiting for MY approval
      const pendingSteps = await (db as any).employeeUpdateApprovalStep?.findMany({
        where: { status: 'pending', approverUserId: auth.userId },
        select: { updateRequestId: true },
        take: 200,
      }) || [];
      const ids = [...new Set(pendingSteps.map((s: { updateRequestId: string }) => s.updateRequestId))];
      where = { id: { in: ids }, status: 'pending' };
    } else if (scope === 'all' && isAdmin) {
      // All requests (admin)
    } else {
      // scope === 'mine' — the employee's own requests
      // Find the employee record by userId
      const emp = await db.employee.findFirst({ where: { userId: auth.userId }, select: { id: true } });
      if (!emp) return NextResponse.json({ requests: [] }, { headers: corsHeaders() });
      where = { employeeId: emp.id };
    }

    const requests = await db.employeeUpdateRequest.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeId: true, email: true } },
        approvalSteps: { orderBy: { tier: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return NextResponse.json({ requests }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Employee update requests GET error:', error);
    return NextResponse.json({ requests: [] }, { headers: corsHeaders() });
  }
}

export async function POST(req: NextRequest) {
  const db = await getDb(req);
  try {
    const auth = await getAuthInfo(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const body = await req.json();
    const { employeeId, fieldName, newValue, reason, documentId } = body;

    if (!employeeId || !fieldName || newValue === undefined) {
      return NextResponse.json({ error: 'employeeId, fieldName, and newValue are required' }, { status: 400, headers: corsHeaders() });
    }

    // Check field sensitivity
    const fieldConfig = FIELD_SENSITIVITY[fieldName];
    if (!fieldConfig) {
      return NextResponse.json({ error: `Unknown field: ${fieldName}` }, { status: 400, headers: corsHeaders() });
    }
    if (fieldConfig.sensitivity === 'restricted') {
      return NextResponse.json({ error: `Field "${fieldConfig.label}" is restricted and cannot be changed via self-service.` }, { status: 403, headers: corsHeaders() });
    }

    // Get the current value
    const emp = await db.employee.findUnique({ where: { id: employeeId }, select: { [fieldName]: true } });
    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404, headers: corsHeaders() });
    const oldValue = String((emp as Record<string, unknown>)[fieldName] ?? '');

    // If the value hasn't changed, reject
    if (oldValue === String(newValue)) {
      return NextResponse.json({ error: 'The new value is the same as the current value.' }, { status: 400, headers: corsHeaders() });
    }

    const cleanReason = sanitizeMultiLineText(reason, 500);
    const cleanNewValue = sanitizeMultiLineText(newValue, 2000);

    // For LOW-risk fields: apply directly (no approval needed)
    if (fieldConfig.sensitivity === 'low') {
      await db.employee.update({
        where: { id: employeeId },
        data: { [fieldName]: cleanNewValue } as Record<string, unknown>,
      });
      // Still create a log entry for audit trail
      const req = await db.employeeUpdateRequest.create({
        data: {
          employeeId, fieldName, fieldLabel: fieldConfig.label, category: fieldConfig.category,
          oldValue, newValue: cleanNewValue, reason: cleanReason,
          status: 'applied', currentTier: 0,
          requestedById: auth.userId, requestedAt: new Date(),
          appliedAt: new Date(),
          documentId: documentId || null,
        },
      });
      return NextResponse.json({ request: req, message: 'Field updated directly (low-risk)' }, { status: 201, headers: corsHeaders() });
    }

    // For HIGH-risk fields: create a pending approval request
    // Approval chain comes from the ACTIVE EmployeeWorkflowConfig
    // (workflowType='update_profile') when configured; otherwise the
    // 2-tier default (Reporting Manager → HR Admin) applies.
    const wfConfig = await loadWorkflowConfig(db as Record<string, any>, req, 'update_profile');
    const tiers = wfConfig?.tiers?.length
      ? wfConfig.tiers.map((t, i) => ({ tier: i + 1, approverType: t.approverType, approverUserId: t.approverUserId || null, approverName: t.approverName || null }))
      : [
          { tier: 1, approverType: 'reporting_manager', approverName: 'Reporting Manager' },
          { tier: 2, approverType: 'hr_admin', approverName: 'HR Admin' },
        ];

    const configSnapshot = JSON.stringify({
      fieldSensitivity: fieldConfig,
      workflowConfigId: wfConfig?.id || null,
      tiers,
    });

    const updateRequest = await db.employeeUpdateRequest.create({
      data: {
        employeeId, fieldName, fieldLabel: fieldConfig.label, category: fieldConfig.category,
        oldValue, newValue: cleanNewValue, reason: cleanReason,
        status: 'pending', currentTier: 1,
        configSnapshot,
        requestedById: auth.userId,
        documentId: documentId || null,
      },
    });

    // Create approval steps (configured chain or 2-tier default)
    for (const step of tiers) {
      // Resolve approver user ID(s) for this tier
      let approverUserId: string | null = null;
      try {
        const resolved = await resolveTierApprovers(db as Record<string, any>, step, employeeId);
        approverUserId = resolved.userIds[0] || null;
      } catch { approverUserId = null; }
      if (!approverUserId && step.approverType === 'reporting_manager') {
        // legacy fallback: resolve RM directly
        const mgr = await db.employee.findUnique({ where: { id: employeeId }, select: { reportingManagerId: true } });
        if (mgr?.reportingManagerId) {
          const mgrUser = await db.employee.findUnique({ where: { id: mgr.reportingManagerId }, select: { userId: true } });
          approverUserId = mgrUser?.userId || null;
        }
      } else if (!approverUserId && step.approverType === 'hr_admin') {
        const admin = await db.user.findFirst({
          where: { role: { in: ['admin', 'hr_admin', 'tenant_admin'] }, status: 'active' },
          select: { id: true },
        });
        approverUserId = admin?.id || null;
      }
      await (db as any).employeeUpdateApprovalStep.create({
        data: {
          updateRequestId: updateRequest.id,
          tier: step.tier,
          approverType: step.approverType,
          approverName: step.approverName || step.approverType,
          approverUserId,
          status: 'pending',
        },
      });
    }

    return NextResponse.json({ request: updateRequest, message: 'Update request submitted for approval' }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Employee update request POST error:', error);
    return NextResponse.json({ error: 'Failed to create update request' }, { status: 500, headers: corsHeaders() });
  }
}

export { FIELD_SENSITIVITY };
