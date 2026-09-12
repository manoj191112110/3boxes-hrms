import { NextResponse } from 'next/server';

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
 * POST /api/offers/webhooks/docusign
 *
 * Receiver for DocuSign Connect webhook status callbacks.
 * DocuSign posts an XML payload when envelope status changes (Sent,
 * Delivered, Completed, Declined, etc.).
 *
 * For now: acknowledge + log. When OAuth is configured later, this
 * route will parse the XML, verify the HMAC signature, update the
 * corresponding Offer (status / signedPdfUrl / signedAt) and fire
 * downstream cascade (preboarding creation, etc.).
 */
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let payloadSummary = '';
    let envelopeId = '';
    let status = '';

    if (contentType.includes('xml') || contentType.includes('text')) {
      const text = await request.text();
      // Very lightweight XML extraction (avoids pulling in a parser dep).
      const envMatch = text.match(/<EnvelopeId>([^<]+)<\/EnvelopeId>/);
      const statusMatch = text.match(/<Status>([^<]+)<\/Status>/);
      envelopeId = envMatch ? envMatch[1].trim() : '';
      status = statusMatch ? statusMatch[1].trim() : '';
      payloadSummary = text.slice(0, 500);
    } else {
      const body = await request.json().catch(() => ({}));
      envelopeId = body.envelopeId || body.envelopeId || '';
      status = body.status || body.event || '';
      payloadSummary = JSON.stringify(body).slice(0, 500);
    }

    console.log(
      `[docusign-webhook] Received callback — envelopeId=${envelopeId || 'unknown'}, status=${status || 'unknown'}, contentType=${contentType}`
    );
    console.log(`[docusign-webhook] Payload preview: ${payloadSummary}`);

    // Future implementation outline (when OAuth is configured):
    //   1. Verify the DocuSign HMAC signature header (`X-DocuSign-Signature-1`).
    //   2. Look up the Offer by esignEnvelopeId == envelopeId.
    //   3. If status === 'Completed':
    //        - Fetch the signed PDF via DocuSign API.
    //        - Store signedPdfUrl, set signedAt = now, status = 'accepted'.
    //        - Trigger the preboarding cascade (reuse the logic in offers/[id]/route.ts PATCH).
    //   4. If status === 'Declined':
    //        - Set offer.status = 'rejected', create OfferDeclineSurvey row.

    return NextResponse.json(
      { received: true, envelopeId, status, note: 'DocuSign webhook acknowledged; processing is stubbed until OAuth is configured.' },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('DocuSign webhook error:', error);
    // Always return 200 to DocuSign so they don't retry
    return NextResponse.json(
      { received: false, error: 'Internal error' },
      { status: 200, headers: corsHeaders() }
    );
  }
}
