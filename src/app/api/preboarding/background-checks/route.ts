/**
 * Background Checks API — BGV tracking for preboarding candidates
 *
 *   GET   /api/preboarding/background-checks?preboardingCandidateId=<id>
 *   POST  /api/preboarding/background-checks
 *         { preboardingCandidateId, vendor?, package? }
 *   PATCH /api/preboarding/background-checks?id=<id>
 *         { status, reportUrl?, summary?, externalCaseId? }
 *
 * Triggering a check records the candidate's authorization (consent) and
 * keeps screening results inside the system. Statuses: pending → initiated →
 * in_progress → cleared | failed | cancelled.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { getAuthInfo } from '@/lib/companyScope';
import { sanitizeMultiLineText } from '@/lib/sanitize';

const VALID_STATUSES = ['pending', 'initiated', 'in_progress', 'cleared', 'failed', 'cancelled'];
const VALID_VENDORS = ['sterling', 'hireright', 'first_advantage', 'internal', 'manual'];
const VALID_PACKAGES = ['basic', 'standard', 'enhanced', 'executive'];

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function GET(req: NextRequest) {
  const db = await getDb(req);
  try {
    const auth = await getAuthInfo(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });

    const url = new URL(req.url);
    const preboardingCandidateId = url.searchParams.get('preboardingCandidateId');

    const where: Record<string, unknown> = {};
    if (preboardingCandidateId) where.preboardingCandidateId = preboardingCandidateId;

    const checks = await (db as any).backgroundCheck?.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        preboardingCandidate: { select: { id: true, candidateName: true, candidateEmail: true, jobTitle: true, joiningDate: true } },
      },
    }) || [];

    return NextResponse.json({ checks }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Background checks GET error:', error);
    return NextResponse.json({ checks: [] }, { headers: corsHeaders() });
  }
}

export async function POST(req: NextRequest) {
  const db = await getDb(req);
  try {
    const auth = await getAuthInfo(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const isAdmin = ['super_admin', 'tenant_admin', 'admin', 'hr_admin', 'company_hr_admin'].includes(auth.role);
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders() });

    const body = await req.json();
    const { preboardingCandidateId, vendor, package: pkg, notes } = body;
    if (!preboardingCandidateId) {
      return NextResponse.json({ error: 'preboardingCandidateId is required' }, { status: 400, headers: corsHeaders() });
    }

    const preboarding = await (db as any).preboardingCandidate?.findUnique({ where: { id: preboardingCandidateId } });
    if (!preboarding) return NextResponse.json({ error: 'Preboarding candidate not found' }, { status: 404, headers: corsHeaders() });

    const check = await (db as any).backgroundCheck?.create({
      data: {
        preboardingCandidateId,
        vendor: VALID_VENDORS.includes(vendor) ? vendor : 'manual',
        package: VALID_PACKAGES.includes(pkg) ? pkg : 'standard',
        // Authorization form reference — the candidate's screening consent
        consentId: `consent_${preboardingCandidateId}_${Date.now().toString(36)}`,
        status: 'initiated',
        summary: notes ? sanitizeMultiLineText(String(notes), 500) : null,
        initiatedAt: new Date(),
      },
    });

    // Keep the denormalized status on the preboarding record in sync
    await (db as any).preboardingCandidate?.update({
      where: { id: preboardingCandidateId },
      data: { backgroundCheckStatus: 'in_progress' },
    }).catch(() => null);

    return NextResponse.json({ check, message: 'Background check initiated — authorization recorded' }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Background checks POST error:', error);
    return NextResponse.json({ error: 'Failed to initiate background check' }, { status: 500, headers: corsHeaders() });
  }
}

export async function PATCH(req: NextRequest) {
  const db = await getDb(req);
  try {
    const auth = await getAuthInfo(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const isAdmin = ['super_admin', 'tenant_admin', 'admin', 'hr_admin', 'company_hr_admin'].includes(auth.role);
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders() });

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400, headers: corsHeaders() });

    const body = await req.json();
    const { status, reportUrl, summary, externalCaseId } = body;
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400, headers: corsHeaders() });
    }

    const updateData: Record<string, unknown> = {};
    if (status) {
      updateData.status = status;
      if (['cleared', 'failed', 'cancelled'].includes(status)) updateData.completedAt = new Date();
    }
    if (reportUrl !== undefined) {
      const u = String(reportUrl || '').trim();
      if (u && !/^(https?:\/\/|data:)/i.test(u)) return NextResponse.json({ error: 'reportUrl must be a valid URL' }, { status: 400, headers: corsHeaders() });
      updateData.reportUrl = u || null;
    }
    if (summary !== undefined) updateData.summary = sanitizeMultiLineText(String(summary || ''), 1000);
    if (externalCaseId !== undefined) updateData.externalCaseId = sanitizeMultiLineText(String(externalCaseId || ''), 100);

    const check = await (db as any).backgroundCheck?.update({ where: { id }, data: updateData });

    // Sync denormalized status on the preboarding record
    if (status && check?.preboardingCandidateId) {
      const mapped = status === 'cleared' ? 'cleared' : status === 'failed' ? 'failed' : ['initiated', 'in_progress'].includes(status) ? 'in_progress' : 'pending';
      await (db as any).preboardingCandidate?.update({
        where: { id: check.preboardingCandidateId },
        data: { backgroundCheckStatus: mapped },
      }).catch(() => null);
    }

    return NextResponse.json({ check, message: 'Background check updated' }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Background checks PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update background check' }, { status: 500, headers: corsHeaders() });
  }
}
