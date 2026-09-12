/**
 * Public Offer Acceptance API — candidate self-service (token-based, no auth)
 *
 *   GET  /api/offers/accept/[token]   — fetch offer details for the acceptance page
 *   POST /api/offers/accept/[token]   — accept or decline
 *        body: { action: 'accept' | 'decline', signatureName?, comments? }
 *
 * The token (Offer.accessToken) is minted when HR marks the offer as 'sent'.
 * Accepting records the candidate's typed full name as an e-signature and
 * notifies tenant admins.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { sanitizeMultiLineText } from '@/lib/sanitize';

const PUBLIC_SELECT = {
  id: true,
  candidateName: true,
  candidateEmail: true,
  position: true,
  department: true,
  offeredSalary: true,
  offeredCurrency: true,
  offeredCTC: true,
  joiningDate: true,
  probationPeriod: true,
  reportingTo: true,
  status: true,
  generatedPdfUrl: true,
  sentAt: true,
  respondedAt: true,
  candidateSignature: true,
  candidateSignedAt: true,
  responseNotes: true,
};

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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const db = await getDb(_req);
  try {
    const { token } = await params;
    const offer = await (db as any).offer?.findUnique({ where: { accessToken: token }, select: PUBLIC_SELECT });
    if (!offer) return NextResponse.json({ error: 'Offer link is invalid or has expired' }, { status: 404, headers: corsHeaders() });

    // Tenant branding
    let companyName: string | null = null;
    try {
      const company = await (db as any).company?.findFirst({ select: { name: true } });
      companyName = company?.name || null;
    } catch { /* ignore */ }

    return NextResponse.json({ offer, companyName }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Offer accept GET error:', error);
    return NextResponse.json({ error: 'Failed to load offer' }, { status: 500, headers: corsHeaders() });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const db = await getDb(req);
  try {
    const { token } = await params;
    const body = await req.json();
    const action = String(body.action || '');
    if (!['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'action must be accept or decline' }, { status: 400, headers: corsHeaders() });
    }

    const offer = await (db as any).offer?.findUnique({ where: { accessToken: token } });
    if (!offer) return NextResponse.json({ error: 'Offer link is invalid or has expired' }, { status: 404, headers: corsHeaders() });
    if (!['sent', 'approved'].includes(offer.status)) {
      return NextResponse.json({ error: `This offer can no longer be responded to (current status: ${offer.status})` }, { status: 400, headers: corsHeaders() });
    }
    if (action === 'accept' && !String(body.signatureName || '').trim()) {
      return NextResponse.json({ error: 'Please type your full name to sign the offer' }, { status: 400, headers: corsHeaders() });
    }

    const comments = body.comments ? sanitizeMultiLineText(String(body.comments), 500) : null;
    const updateData: Record<string, unknown> = {
      status: action === 'accept' ? 'accepted' : 'rejected',
      respondedAt: new Date(),
    };
    if (comments) updateData.responseNotes = comments;
    if (action === 'accept') {
      updateData.candidateSignature = sanitizeMultiLineText(String(body.signatureName).trim(), 120);
      updateData.candidateSignedAt = new Date();
      updateData.esignProvider = 'internal_self_service';
    }

    const updated = await (db as any).offer.update({ where: { id: offer.id }, data: updateData });

    // Notify tenant admins + HR
    try {
      const admins = await (db as any).user.findMany({
        where: { role: { in: ['super_admin', 'tenant_admin', 'admin', 'hr_admin'] }, status: 'active' },
        select: { id: true },
        take: 20,
      });
      const label = action === 'accept' ? 'accepted' : 'declined';
      for (const a of admins) {
        try {
          await (db as any).notification.create({
            data: {
              userId: a.id,
              title: `Offer ${label} — ${updated.candidateName}`,
              message: `${updated.candidateName} has ${label} the offer for the ${updated.position} position.${comments ? `\n\nCandidate comments: ${comments}` : ''}`,
              type: action === 'accept' ? 'success' : 'warning',
              category: 'recruitment',
              link: '/offers',
              isRead: false,
              isEmailSent: false,
            },
          }).catch(() => null);
        } catch { /* non-critical */ }
      }
    } catch { /* non-critical */ }

    return NextResponse.json({
      message: action === 'accept' ? 'Offer accepted. Welcome aboard!' : 'Offer declined. Thank you for your response.',
      offer: {
        id: updated.id, status: updated.status, respondedAt: updated.respondedAt,
        candidateSignature: updated.candidateSignature, candidateSignedAt: updated.candidateSignedAt,
      },
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Offer accept POST error:', error);
    return NextResponse.json({ error: 'Failed to record your response' }, { status: 500, headers: corsHeaders() });
  }
}
