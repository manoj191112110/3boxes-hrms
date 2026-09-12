import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { parseResumeFromDataUrl } from '@/lib/resume-parser';

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

/**
 * POST /api/ats/parse-resume
 * Body: { jobApplicationId, resumeDataUrl }
 *   - resumeDataUrl = base64 data URL (data:<mime>;base64,<...>)
 *
 * Validates the application exists, extracts text from PDF/DOCX/text,
 * detects language, calls ZAI for structured extraction, and saves a
 * ResumeParse row.
 */
export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });
    }

    const body = await request.json();
    const { jobApplicationId, resumeDataUrl } = body || ({} as { jobApplicationId?: string; resumeDataUrl?: string });

    if (!jobApplicationId || !resumeDataUrl) {
      return NextResponse.json(
        { error: 'jobApplicationId and resumeDataUrl are required' },
        { status: 400, headers: corsHeaders() },
      );
    }

    // Verify the application exists
    const application = await db.jobApplication.findUnique({
      where: { id: jobApplicationId },
      select: { id: true, candidateName: true },
    });
    if (!application) {
      return NextResponse.json(
        { error: 'Job application not found' },
        { status: 404, headers: corsHeaders() },
      );
    }

    // Run the parser pipeline
    const result = await parseResumeFromDataUrl(resumeDataUrl);

    // Persist the ResumeParse row
    const saved = await db.resumeParse.create({
      data: {
        jobApplicationId,
        rawText: result.rawText.slice(0, 100000), // cap stored raw text
        language: result.language,
        parsedData: JSON.stringify(result.parsed),
        confidence: result.confidence,
        sourceFormat: result.sourceFormat,
        parseError: result.parseError || null,
      },
    });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'PARSE_RESUME',
        module: 'ats',
        details: `Parsed resume for application ${jobApplicationId} (${result.sourceFormat}, conf=${result.confidence.toFixed(2)}, lang=${result.language})`,
      },
    }).catch(() => { /* non-critical */ });

    return NextResponse.json(
      {
        parseId: saved.id,
        parsedData: result.parsed,
        language: result.language,
        confidence: result.confidence,
        sourceFormat: result.sourceFormat,
        parseError: result.parseError || null,
      },
      { status: 201, headers: corsHeaders() },
    );
  } catch (error) {
    console.error('parse-resume POST error:', error);
    return NextResponse.json(
      { error: 'Failed to parse resume' },
      { status: 500, headers: corsHeaders() },
    );
  }
}

/**
 * GET /api/ats/parse-resume?jobApplicationId=...
 * Returns the latest ResumeParse row for a given application.
 */
export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });
    }

    const { searchParams } = new URL(request.url);
    const jobApplicationId = searchParams.get('jobApplicationId');

    if (!jobApplicationId) {
      return NextResponse.json(
        { error: 'jobApplicationId query param is required' },
        { status: 400, headers: corsHeaders() },
      );
    }

    const latest = await db.resumeParse.findFirst({
      where: { jobApplicationId },
      orderBy: { createdAt: 'desc' },
    });

    if (!latest) {
      return NextResponse.json(
        { parse: null, parsedData: null },
        { headers: corsHeaders() },
      );
    }

    let parsedData = null;
    try {
      parsedData = latest.parsedData ? JSON.parse(latest.parsedData) : null;
    } catch {
      parsedData = null;
    }

    return NextResponse.json(
      {
        parse: latest,
        parsedData,
      },
      { headers: corsHeaders() },
    );
  } catch (error) {
    console.error('parse-resume GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch parsed resume' },
      { status: 500, headers: corsHeaders() },
    );
  }
}
