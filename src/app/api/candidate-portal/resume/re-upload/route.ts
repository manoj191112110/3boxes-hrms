/**
 * Candidate Portal — Resume Re-upload
 *
 * POST /api/candidate-portal/resume/re-upload
 *   body: { jobApplicationId, resumeDataUrl, resumeFileName? }
 *
 * Lets a candidate replace the resume on file for one of their existing
 * applications. After persisting the new resume data URL on the application,
 * we re-run the parser and create a fresh ResumeParse row so the dashboard
 * insights + skill matrix update immediately.
 *
 * Auth: candidate JWT (kind === 'candidate'). The application must belong
 * to the authenticated candidate (email match).
 */
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import {
  requireCandidate,
  ok,
  fail,
  OPTIONS,
  parseBody,
} from '@/lib/candidate-auth';
import { parseResumeFromDataUrl } from '@/lib/resume-parser';

export { OPTIONS };

const ALLOWED_PREFIXES = [
  'data:application/pdf',
  'data:application/msword',
  'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'data:text/plain',
  'data:application/rtf',
];

export async function POST(request: Request) {
  const db = await getDb(request);
  const { candidate, response } = await requireCandidate(request);
  if (!candidate) return response;

  const body = await parseBody(request);
  if (!body) return fail('Invalid JSON body', 400);

  const { jobApplicationId, resumeDataUrl, resumeFileName } = body as {
    jobApplicationId?: string;
    resumeDataUrl?: string;
    resumeFileName?: string;
  };

  if (!jobApplicationId) return fail('jobApplicationId is required', 400);
  if (!resumeDataUrl || typeof resumeDataUrl !== 'string') {
    return fail('resumeDataUrl is required', 400);
  }
  if (!resumeDataUrl.startsWith('data:')) {
    return fail('resumeDataUrl must be a data: URL', 400);
  }
  if (resumeDataUrl.length > 7_000_000) {
    return fail('Resume file is too large. Maximum size is 5 MB.', 413);
  }
  if (!ALLOWED_PREFIXES.some((p) => resumeDataUrl.startsWith(p))) {
    return fail('Resume must be a PDF, DOC, DOCX, RTF, or TXT file', 415);
  }

  // Verify the application exists + belongs to this candidate
  const application = await db.jobApplication.findUnique({
    where: { id: jobApplicationId },
    select: { id: true, candidateEmail: true, jobPostingId: true },
  });
  if (!application) return fail('Application not found', 404);
  if (application.candidateEmail.toLowerCase() !== candidate.email.toLowerCase()) {
    return fail('This application does not belong to you', 403);
  }

  // 1. Update the resume data URL + filename on the application
  await db.jobApplication.update({
    where: { id: jobApplicationId },
    data: {
      resume: resumeDataUrl,
      notes: resumeFileName ? `Resume file: ${resumeFileName}` : null,
    },
  });

  // 2. Parse the new resume + persist a fresh ResumeParse row so the
  //    dashboard insights/skill matrix update immediately. Best-effort —
  //    if the parser fails we still keep the new resume on file.
  let parseSummary: { ok: boolean; confidence?: number; skills?: number; error?: string } = {
    ok: false,
  };
  try {
    const result = await parseResumeFromDataUrl(resumeDataUrl);
    await db.resumeParse.create({
      data: {
        jobApplicationId,
        rawText: result.rawText.slice(0, 100_000),
        language: result.language || 'en',
        parsedData: JSON.stringify(result.parsed),
        confidence: result.confidence,
        sourceFormat: result.sourceFormat,
        parseError: result.parseError || null,
      },
    });
    parseSummary = {
      ok: true,
      confidence: result.confidence,
      skills: Array.isArray(result.parsed?.skills) ? result.parsed.skills.length : 0,
    };
  } catch (err) {
    parseSummary = {
      ok: false,
      error: err instanceof Error ? err.message : 'Parse failed',
    };
  }

  return ok({
    success: true,
    message: 'Resume updated successfully. Your insights will refresh on the dashboard.',
    parse: parseSummary,
  });
}
