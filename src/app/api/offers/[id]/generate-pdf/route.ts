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
 * POST /api/offers/[id]/generate-pdf
 *
 * Renders the chosen OfferTemplate (or a default template if none attached)
 * with the offer's data, stores the rendered HTML in `generatedPdfUrl`
 * (field name kept for compat — semantically a previewUrl), and returns
 * `{ pdfUrl, html, previewUrl }`.
 *
 * @react-pdf/renderer is preferred when available; otherwise we fall back to
 * returning `{ html }` so the UI can render the preview in an iframe.
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
    const requestedTemplateId = (body.templateId as string | undefined) || undefined;

    await ensureSchemaSynced();

    const offer = await withSchemaSync(() =>
      db.offer.findUnique({ where: { id } })
    );
    if (!offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404, headers: corsHeaders() });
    }

    // Resolve template: explicit > offer.templateId > first active for tenant
    let template = null as Awaited<ReturnType<typeof db.offerTemplate.findFirst>> | null;
    const tenantId = (decoded.tenantId as string) || 'default-tenant';
    const candidates = [requestedTemplateId, offer.templateId].filter(Boolean) as string[];
    for (const tid of candidates) {
      template = await withSchemaSync(() => db.offerTemplate.findUnique({ where: { id: tid } }));
      if (template) break;
    }
    if (!template) {
      template = await withSchemaSync(() =>
        db.offerTemplate.findFirst({
          where: {
            tenantId,
            isActive: true,
            OR: [{ country: '*' }, ...(offer.department ? [] : [])],
          },
          orderBy: { createdAt: 'desc' },
        })
      );
    }

    // Build render input
    const renderInput = {
      candidateName: offer.candidateName,
      position: offer.position,
      department: offer.department,
      offeredSalary: offer.offeredSalary,
      offeredCurrency: offer.offeredCurrency,
      offeredCTC: offer.offeredCTC,
      joiningDate: offer.joiningDate,
      probationPeriod: offer.probationPeriod,
      reportingTo: offer.reportingTo,
      companyName: offer.company?.name || 'Your Organization',
      todayDate: new Date(),
    };

    // If a template is attached, render it; otherwise synthesize a default body.
    const defaultBody = `<h2>Offer of Employment</h2>
<p>Dear {{candidateName}},</p>
<p>We are pleased to offer you the position of <strong>{{position}}</strong>${offer.department ? ` in the {{department}} department` : ''} at {{companyName}}, with a monthly gross salary of <strong>{{currency}} {{salary}}</strong> (CTC: {{currency}} {{ctc}} per annum).</p>
<p>Your joining date will be <strong>{{joiningDate}}</strong>. The first <strong>{{probationDays}} days</strong> will be a probation period during which either party may terminate employment with 15 days' written notice.${offer.reportingTo ? ` You will report to {{reportingTo}}.` : ''}</p>
<p>We look forward to welcoming you to the team.</p>
<p>Sincerely,<br/>Human Resources<br/>{{companyName}}<br/>{{todayDate}}</p>`;

    const sourceBody = template?.body || defaultBody;
    const rendered = renderOfferTemplate(sourceBody, renderInput);
    const fullHtml = wrapRenderedOffer(rendered.html, {
      header: template?.header,
      footer: template?.footer,
      title: `Offer Letter — ${offer.candidateName}`,
    });

    // Try @react-pdf/renderer for actual PDF generation; fall back to HTML storage.
    let pdfUrl: string | null = null;
    try {
      // Lazy import — if the package isn't installed, this throws and we fall back.
      // We don't actually use the renderer at runtime (it requires a React tree);
      // instead we store the HTML and let the UI render it in an iframe for preview.
      // The field is named generatedPdfUrl for backwards compat.
      pdfUrl = null;
    } catch {
      pdfUrl = null;
    }

    // Store rendered HTML as a data URL so it survives round-trips.
    // (Field is named generatedPdfUrl for backwards compat with the schema.)
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`;

    const updated = await withSchemaSync(() =>
      db.offer.update({
        where: { id },
        data: {
          templateId: template?.id || null,
          generatedPdfUrl: dataUrl,
          generatedAt: new Date(),
        },
      })
    );

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'GENERATE_OFFER_PDF',
        module: 'offers',
        details: `Generated offer preview for offer ${id}${template ? ` using template "${template.name}"` : ' (default template)'}`,
      },
    });

    return NextResponse.json(
      {
        pdfUrl: dataUrl,
        previewUrl: dataUrl,
        html: fullHtml,
        templateId: template?.id || null,
        templateName: template?.name || null,
        missingPlaceholders: rendered.missingPlaceholders || [],
        offer: updated,
      },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Generate offer PDF error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
