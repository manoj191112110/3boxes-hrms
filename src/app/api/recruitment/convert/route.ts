/**
 * Candidate → Employee one-click conversion
 *
 *   POST /api/recruitment/convert
 *   body: { offerId? | applicationId? | candidateId?, joiningDate?, probationPeriod? }
 *
 * Runs the onboarding cascade:
 *   Employee record (probation) + PreboardingCandidate + auto-generated
 *   onboarding checklist (from templates) + IT/Admin/Finance notifications
 *   + application marked hired + posting vacancies decremented.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { getAuthInfo } from '@/lib/companyScope';
import { convertCandidateToEmployee } from '@/lib/onboarding-cascade';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function POST(req: NextRequest) {
  const db = await getDb(req);
  try {
    const auth = await getAuthInfo(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const isAdmin = ['super_admin', 'tenant_admin', 'admin', 'hr_admin', 'company_hr_admin'].includes(auth.role);
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders() });

    const body = await req.json();
    const { offerId, applicationId, candidateId, joiningDate, probationPeriod } = body || {};
    if (!offerId && !applicationId && !candidateId) {
      return NextResponse.json({ error: 'Provide offerId, applicationId, or candidateId' }, { status: 400, headers: corsHeaders() });
    }

    const result = await convertCandidateToEmployee(db as Record<string, any>, {
      tenantId: auth.tenantId,
      offerId: offerId || null,
      applicationId: applicationId || null,
      candidateId: candidateId || null,
      joiningDate: joiningDate || null,
      probationPeriod: probationPeriod ? Number(probationPeriod) : null,
      actingUserId: auth.userId,
    });

    return NextResponse.json({
      message: `Employee created. ${result.tasksCreated} onboarding task(s) generated and departments notified.`,
      employeeId: result.employeeId,
      preboardingCandidateId: result.preboardingCandidateId,
      tasksCreated: result.tasksCreated,
      notificationsSent: result.notificationsSent,
    }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Candidate conversion error:', error);
    const msg = error instanceof Error ? error.message : 'Conversion failed';
    return NextResponse.json({ error: msg }, { status: 500, headers: corsHeaders() });
  }
}
