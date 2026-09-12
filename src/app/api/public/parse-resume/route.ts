/**
 * POST /api/public/parse-resume
 *
 * Public (no-auth) endpoint used by the careers apply form to parse a
 * candidate's resume as soon as they upload it — so we can auto-fill the
 * name / email / phone / skills fields in the apply form. This makes the
 * registration flow much smoother: candidate uploads resume first, then
 * verifies the auto-filled fields, then submits.
 *
 * Body: { resumeDataUrl: string }
 * Returns: { parsed: ParsedResume, confidence: number, sourceFormat, parseError? }
 *
 * The endpoint does NOT persist anything — it's a pure parse. The actual
 * ResumeParse row gets written later by /api/ats/parse-resume when the
 * recruiter/admin reviews the application, or by /api/candidate-portal/resume/optimize
 * when the candidate runs the optimizer.
 *
 * Rate-limiting: relies on Vercel's edge rate limits. For production you'd
 * add a per-IP throttle (e.g. 10 parses / hour) to prevent abuse.
 */
import { NextRequest, NextResponse } from 'next/server';
import { parseResumeFromDataUrl } from '@/lib/resume-parser';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { resumeDataUrl } = body;

    if (!resumeDataUrl || typeof resumeDataUrl !== 'string') {
      return NextResponse.json(
        { error: 'resumeDataUrl is required' },
        { status: 400, headers: corsHeaders },
      );
    }

    // Cap resume size at 5 MB (data URL encoded — roughly 6.7 MB raw base64)
    if (resumeDataUrl.length > 7_000_000) {
      return NextResponse.json(
        { error: 'Resume file is too large. Maximum size is 5 MB.' },
        { status: 413, headers: corsHeaders },
      );
    }

    const allowedPrefixes = [
      'data:application/pdf',
      'data:application/msword',
      'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'data:text/plain',
      'data:application/rtf',
    ];
    if (!allowedPrefixes.some((p) => resumeDataUrl.startsWith(p))) {
      return NextResponse.json(
        { error: 'Resume must be a PDF, DOC, DOCX, RTF, or TXT file' },
        { status: 415, headers: corsHeaders },
      );
    }

    const result = await parseResumeFromDataUrl(resumeDataUrl);

    return NextResponse.json(
      {
        parsed: result.parsed,
        confidence: result.confidence,
        language: result.language,
        sourceFormat: result.sourceFormat,
        parseError: result.parseError || null,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error('POST /api/public/parse-resume error:', error);
    return NextResponse.json(
      { error: 'Failed to parse resume. Please try again or fill the form manually.' },
      { status: 500, headers: corsHeaders },
    );
  }
}
