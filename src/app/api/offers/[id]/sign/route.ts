import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';
import { renderOfferTemplate, wrapRenderedOffer } from '@/lib/offer-template';

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
 * POST /api/offers/[id]/sign
 *
 * Internal e-signature provider — completes the signing flow.
 * Body: { envelopeId?: string, signature?: string }
 *
 * Side effects:
 *   - offer.signedPdfUrl = re-rendered offer HTML with a signature block
 *   - offer.signedAt = now
 *   - offer.signedById = decoded.userId
 *   - offer.status = 'accepted'
 *
 * This is the "internal" e-sign provider; DocuSign has its own webhook.
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
    const envelopeId = body.envelopeId as string | undefined;
    const signature = (body.signature as string | undefined) || 'Electronically signed';

    await ensureSchemaSynced();

    const offer = await withSchemaSync(() =>
      db.offer.findUnique({ where: { id } })
    );
    if (!offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404, headers: corsHeaders() });
    }
    if (!offer.generatedPdfUrl) {
      return NextResponse.json(
        { error: 'Offer has no generated PDF/HTML to sign' },
        { status: 400, headers: corsHeaders() }
      );
    }
    if (offer.esignEnvelopeId && envelopeId && offer.esignEnvelopeId !== envelopeId) {
      return NextResponse.json(
        { error: 'Envelope ID mismatch' },
        { status: 400, headers: corsHeaders() }
      );
    }
    if (offer.signedPdfUrl && offer.signedAt) {
      return NextResponse.json(
        { error: 'Offer is already signed', offer },
        { status: 409, headers: corsHeaders() }
      );
    }

    // Re-render the offer with a signature block appended.
    let signedHtml = '';
    try {
      // Decode existing generated HTML (data: URL) so we can append a signature stamp.
      const generatedUrl = offer.generatedPdfUrl || '';
      if (generatedUrl.startsWith('data:text/html')) {
        const commaIdx = generatedUrl.indexOf(',');
        signedHtml = decodeURIComponent(generatedUrl.slice(commaIdx + 1));
      } else {
        signedHtml = generatedUrl;
      }
    } catch {
      signedHtml = '';
    }
    if (!signedHtml) {
      // Fallback: render from scratch using the default body.
      const rendered = renderOfferTemplate(
        `<h2>Offer of Employment</h2><p>Dear {{candidateName}},</p><p>We are pleased to offer you the position of {{position}} at {{companyName}}.</p><p>Joining date: {{joiningDate}}. Probation: {{probationDays}} days. Salary: {{currency}} {{salary}}.</p>`,
        {
          candidateName: offer.candidateName,
          position: offer.position,
          department: offer.department,
          offeredSalary: offer.offeredSalary,
          offeredCurrency: offer.offeredCurrency,
          joiningDate: offer.joiningDate,
          probationPeriod: offer.probationPeriod,
          reportingTo: offer.reportingTo,
        }
      );
      signedHtml = wrapRenderedOffer(rendered.html, { title: 'Signed Offer Letter' });
    }

    const signatureBlock = `
<div style="margin-top:48px;border-top:1px solid #cbd5e1;padding-top:16px;">
  <p style="margin:0 0 4px 0;font-weight:600;color:#1e293b;">Accepted and Signed Electronically</p>
  <p style="margin:0 0 2px 0;color:#475569;">Signature: ${signature.replace(/</g, '&lt;')}</p>
  <p style="margin:0 0 2px 0;color:#475569;">Signed By: ${offer.candidateName}</p>
  <p style="margin:0 0 2px 0;color:#475569;">Signed At: ${new Date().toLocaleString()}</p>
  <p style="margin:0;color:#94a3b8;font-size:11px;">Envelope ID: ${offer.esignEnvelopeId || envelopeId || 'N/A'}</p>
</div>`;
    signedHtml = signedHtml.replace('</body>', `${signatureBlock}\n</body>`);

    const signedDataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(signedHtml)}`;

    const updated = await withSchemaSync(() =>
      db.offer.update({
        where: { id },
        data: {
          signedPdfUrl: signedDataUrl,
          signedAt: new Date(),
          signedById: decoded.userId as string,
          esignProvider: offer.esignProvider || 'internal',
          esignEnvelopeId: offer.esignEnvelopeId || envelopeId || `internal-signed-${id}`,
          status: 'accepted',
          respondedAt: new Date(),
        },
      })
    );

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'OFFER_SIGNED',
        module: 'offers',
        details: `Offer ${id} signed electronically (internal provider, envelope ${updated.esignEnvelopeId})`,
      },
    });

    return NextResponse.json(
      {
        offer: updated,
        signedPdfUrl: signedDataUrl,
        status: 'accepted',
      },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Sign offer error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
