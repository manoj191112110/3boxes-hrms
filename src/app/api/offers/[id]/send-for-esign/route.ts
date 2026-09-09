import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';

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

/**
 * POST /api/offers/[id]/send-for-esign
 *
 * Body: { provider?: 'internal' | 'docusign' | 'adobesign' }
 *
 * - For internal/undefined: mint a UUID envelope, store on the offer, return signingUrl.
 * - For docusign: stub the OAuth call (logs a warning, falls back to internal)
 *
 * Returns: { envelopeId, provider, signingUrl, offer }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const { id } = await params;
    const body: Record<string, unknown> = await request.json().catch(() => ({}));
    const requestedProvider = (body.provider as string | undefined) || 'internal';

    await ensureSchemaSynced();

    const offer = await withSchemaSync(() =>
      db.offer.findUnique({ where: { id } })
    );
    if (!offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404, headers: corsHeaders() });
    }

    if (!offer.generatedPdfUrl) {
      return NextResponse.json(
        { error: 'Offer has no generated PDF/HTML. Call /generate-pdf first.' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // If candidate already signed, refuse to re-send
    if (offer.signedPdfUrl && offer.signedAt) {
      return NextResponse.json(
        { error: 'Offer is already signed', envelopeId: offer.esignEnvelopeId, offer },
        { status: 409, headers: corsHeaders() }
      );
    }

    let effectiveProvider = requestedProvider;
    if (requestedProvider === 'docusign') {
      // DocuSign OAuth needs to be configured separately via env vars.
      if (!process.env.DOCUSIGN_CLIENT_ID || !process.env.DOCUSIGN_USER_ID) {
        console.warn('[esign] DocuSign not configured (missing DOCUSIGN_CLIENT_ID / DOCUSIGN_USER_ID) — using internal stub');
        effectiveProvider = 'internal';
      } else {
        // Real DocuSign path would mint an envelope via their API here.
        // For now we still log and fall back (per task instructions).
        console.warn('[esign] DocuSign credentials present but integration not yet wired — falling back to internal stub');
        effectiveProvider = 'internal';
      }
    }

    const envelopeId = effectiveProvider === 'docusign' ? `docusign-${randomUUID()}` : `internal-${randomUUID()}`;
    const signingUrl = `/offers/${id}/sign?envelopeId=${encodeURIComponent(envelopeId)}`;

    const updated = await withSchemaSync(() =>
      db.offer.update({
        where: { id },
        data: {
          esignProvider: effectiveProvider,
          esignEnvelopeId: envelopeId,
        },
      })
    );

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'OFFER_SENT_FOR_ESIGN',
        module: 'offers',
        details: `Offer ${id} sent for e-signature via ${effectiveProvider} (envelope ${envelopeId})`,
      },
    });

    return NextResponse.json(
      {
        envelopeId,
        provider: effectiveProvider,
        signingUrl,
        offer: updated,
      },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Send for esign error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
