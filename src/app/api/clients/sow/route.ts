import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const status = searchParams.get('status');
    const where: Record<string, unknown> = {};
    if (clientId) (where as Record<string, unknown>).clientId = clientId;
    if (status) (where as Record<string, unknown>).status = status;
    const sows = await db.sOW.findMany({
      where: where as any,
      include: { client: { select: { id: true, name: true } }, project: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ sows }, { headers: corsHeaders() });
  } catch (error) { console.error('Get SOWs error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const { clientId, title, fileName, fileUrl, rawText, startDate, endDate, maxHeadcount, billRatesJson, milestonesJson, totalValue, currency } = body;
    if (!clientId || !title) return NextResponse.json({ error: 'Missing clientId or title' }, { status: 400, headers: corsHeaders() });

    // AI SOW Parsing: heuristic extraction from rawText (when no explicit fields provided)
    let aiParsed = { startDate: startDate, endDate: endDate, maxHeadcount: maxHeadcount, billRatesJson: billRatesJson, milestonesJson: milestonesJson, totalValue: totalValue, aiConfidence: 0 };
    if (rawText && (!startDate || !totalValue)) {
      const text = rawText.toLowerCase();
      const dateMatch = rawText.match(/(?:start|begin)[^\d]*(\d{4}-\d{2}-\d{2}|\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})/i);
      const endMatch = rawText.match(/(?:end|complete|finish)[^\d]*(\d{4}-\d{2}-\d{2}|\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})/i);
      const valueMatch = rawText.match(/(?:total|value|contract)[^\d]*\$?([\d,]+(?:\.\d{2})?)/i);
      const hcMatch = rawText.match(/(?:headcount|resources|contractors)[^\d]*(\d+)/i);
      // Extract bill rates per role
      const rates: Record<string, number> = {};
      const rateRegex = /([a-z\s]+?)\s*[:\-]\s*\$?(\d+(?:\.\d{2})?)\s*(?:\/|per)?\s*(hr|hour|day|month)/gi;
      let m: RegExpExecArray | null;
      while ((m = rateRegex.exec(rawText)) !== null) {
        const role = m[1].trim().toLowerCase().replace(/\s+/g, '_');
        rates[role] = parseFloat(m[2]);
      }
      aiParsed = {
        startDate: startDate || (dateMatch ? new Date(dateMatch[1]) : null),
        endDate: endDate || (endMatch ? new Date(endMatch[1]) : null),
        maxHeadcount: maxHeadcount || (hcMatch ? parseInt(hcMatch[1]) : null),
        billRatesJson: billRatesJson || (Object.keys(rates).length > 0 ? rates : null),
        milestonesJson: milestonesJson || null,
        totalValue: totalValue || (valueMatch ? parseFloat(valueMatch[1].replace(/,/g, '')) : null),
        aiConfidence: 0.7,
      };
    }

    const sow = await db.sOW.create({
      data: {
        clientId, title, fileName, fileUrl, rawText,
        startDate: aiParsed.startDate ? new Date(aiParsed.startDate) : null,
        endDate: aiParsed.endDate ? new Date(aiParsed.endDate) : null,
        maxHeadcount: aiParsed.maxHeadcount,
        billRatesJson: aiParsed.billRatesJson,
        milestonesJson: aiParsed.milestonesJson,
        totalValue: aiParsed.totalValue,
        currency: currency || 'INR',
        status: 'ai_parsed',
        aiConfidence: aiParsed.aiConfidence,
      },
    });
    await db.auditLog.create({ data: { userId: decoded.userId as string, action: 'AI_PARSE_SOW', module: 'clients', details: `AI parsed SOW ${title} (confidence ${aiParsed.aiConfidence})` } });
    return NextResponse.json({ sow, aiParsed }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Create SOW error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
