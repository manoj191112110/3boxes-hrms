/**
 * Candidate Portal — Resume Optimization (REQ-AI-RES-03..09)
 *
 * POST /api/candidate-portal/resume/optimize
 *   body: { jobApplicationId }
 *
 * Runs the full optimization pipeline for the candidate's application:
 *   1. Parses the resume they submitted with the application
 *   2. Computes a job-specific match score (REQ-AI-RES-03)
 *   3. Computes visual gap analysis (REQ-AI-RES-04)
 *   4. Generates inline rewrite suggestions (REQ-AI-RES-05)
 *   5. Suggests missing ATS keywords (REQ-AI-RES-06)
 *   6. Analyzes format & structure (REQ-AI-RES-07)
 *   7. If no summary exists, generates 3 summary options (REQ-AI-RES-08)
 *
 * Persists everything to CandidateResumeOptimization (one row per application)
 * so the candidate can iteratively refine (REQ-AI-RES-09) — each call updates
 * the match score dynamically as they edit / accept suggestions.
 *
 * GET /api/candidate-portal/resume/optimize?jobApplicationId=X
 *   Returns the existing optimization record (no re-computation).
 *
 * PATCH /api/candidate-portal/resume/optimize
 *   body: { jobApplicationId, optimizedResume?, selectedSummary?, acceptedSuggestionIds? }
 *   Updates the candidate's edited resume / accepted suggestions and recomputes
 *   the match score on the updated resume text (REQ-AI-RES-09).
 */
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import {
  requireCandidate,
  ok,
  fail,
  OPTIONS,
  parseBody,
} from '@/lib/candidate-auth';
import {
  computeMatchScore,
  computeGapAnalysis,
  generateRewriteSuggestions,
  suggestMissingKeywords,
  analyzeFormat,
  generateSummaryOptions,
  type RewriteSuggestion,
} from '@/lib/candidate-resume-optimizer';
import { parseResumeFromDataUrl, type ParsedResume } from '@/lib/resume-parser';

export { OPTIONS };

/** Look up the application + job posting + parse the resume. */
async function loadApplicationAndResume(jobApplicationId: string, candidateEmail: string) {
  const application = await db.jobApplication.findUnique({
    where: { id: jobApplicationId },
    include: {
      jobPosting: {
        include: {
          department: { select: { name: true, company: { select: { name: true, language: true } } } },
        },
      },
      resumeParses: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  if (!application) return { error: 'Application not found', status: 404 };
  if (application.candidateEmail.toLowerCase() !== candidateEmail.toLowerCase()) {
    return { error: 'This application does not belong to you', status: 403 };
  }

  // Prefer the most recent AI parse if available, otherwise parse from the data URL on the application
  let parsed: ParsedResume | null = null;
  let rawText = '';

  if (application.resumeParses.length > 0) {
    try {
      const parsedData = application.resumeParses[0].parsedData as any;
      if (parsedData && typeof parsedData === 'object') {
        parsed = parsedData as ParsedResume;
      }
    } catch {}
  }

  if (application.resume && application.resume.startsWith('data:')) {
    try {
      const result = await parseResumeFromDataUrl(application.resume);
      rawText = result.rawText;
      if (!parsed) parsed = result.parsed;
    } catch (err) {
      console.warn('[resume/optimize] Failed to parse resume from data URL:', err);
    }
  }

  if (!parsed) {
    return { error: 'Could not parse resume — please re-upload your resume', status: 400 };
  }

  return {
    application,
    jobPosting: application.jobPosting,
    parsed,
    rawText,
  };
}

export async function GET(request: Request) {
  const db = await getDb(request);
  const { candidate, response } = await requireCandidate(request);
  if (!candidate) return response;

  const url = new URL(request.url);
  const jobApplicationId = url.searchParams.get('jobApplicationId');
  if (!jobApplicationId) return fail('jobApplicationId query parameter is required', 400);

  // Verify ownership
  const application = await db.jobApplication.findUnique({
    where: { id: jobApplicationId },
    select: { candidateEmail: true },
  });
  if (!application) return fail('Application not found', 404);
  if (application.candidateEmail.toLowerCase() !== candidate.email.toLowerCase()) {
    return fail('This application does not belong to you', 403);
  }

  const optimization = await db.candidateResumeOptimization.findUnique({
    where: { jobApplicationId },
  });

  if (!optimization) {
    return ok({ optimization: null, message: 'No optimization yet — POST to run.' });
  }

  return ok({ optimization: serializeOptimization(optimization) });
}

export async function POST(request: Request) {
  const db = await getDb(request);
  const { candidate, response } = await requireCandidate(request);
  if (!candidate) return response;

  const body = await parseBody(request);
  if (!body) return fail('Invalid JSON body', 400);
  const { jobApplicationId } = body;
  if (!jobApplicationId) return fail('jobApplicationId is required', 400);

  const loaded = await loadApplicationAndResume(jobApplicationId, candidate.email);
  if ('error' in loaded) return fail(loaded.error as string, loaded.status);

  const { jobPosting, parsed, rawText } = loaded;

  // Run the full pipeline in parallel — pass the raw resume text to every
  // optimizer function so the model can see actual bullet points and
  // verify skill claims (instead of relying only on the structured fields
  // returned by the parser, which may be incomplete).
  const [matchScore, gapAnalysis, rewriteSuggestions, keywordSuggestions, formatFeedback, summaryOptions] = await Promise.all([
    computeMatchScore(parsed, jobPosting.description, jobPosting.requirements, jobPosting.title, rawText),
    computeGapAnalysis(parsed, jobPosting.description, jobPosting.requirements, jobPosting.title, rawText),
    generateRewriteSuggestions(parsed, jobPosting.description, rawText),
    suggestMissingKeywords(parsed, jobPosting.description, rawText),
    analyzeFormat(parsed, rawText),
    parsed.summary ? Promise.resolve([]) : generateSummaryOptions(parsed),
  ]);

  // Upsert the optimization record
  const optimization = await db.candidateResumeOptimization.upsert({
    where: { jobApplicationId },
    create: {
      jobApplicationId,
      candidateEmail: candidate.email,
      matchScore: matchScore.overall,
      gapAnalysis: JSON.stringify(gapAnalysis),
      rewriteSuggestions: JSON.stringify(rewriteSuggestions),
      suggestedKeywords: JSON.stringify(keywordSuggestions),
      formatFeedback: JSON.stringify(formatFeedback),
      summaryOptions: summaryOptions.length > 0 ? JSON.stringify(summaryOptions) : null,
      optimizedResume: rawText,
      version: 1,
    },
    update: {
      matchScore: matchScore.overall,
      gapAnalysis: JSON.stringify(gapAnalysis),
      rewriteSuggestions: JSON.stringify(rewriteSuggestions),
      suggestedKeywords: JSON.stringify(keywordSuggestions),
      formatFeedback: JSON.stringify(formatFeedback),
      summaryOptions: summaryOptions.length > 0 ? JSON.stringify(summaryOptions) : undefined,
      version: { increment: 1 },
    },
  });

  return ok({
    optimization: serializeOptimization(optimization),
    matchScoreBreakdown: matchScore,
    jobTitle: jobPosting.title,
    companyName: jobPosting.department.company.name,
  });
}

export async function PATCH(request: Request) {
  const db = await getDb(request);
  const { candidate, response } = await requireCandidate(request);
  if (!candidate) return response;

  const body = await parseBody(request);
  if (!body) return fail('Invalid JSON body', 400);
  const { jobApplicationId, optimizedResume, selectedSummary, acceptedSuggestionIds } = body;
  if (!jobApplicationId) return fail('jobApplicationId is required', 400);

  // Verify ownership
  const application = await db.jobApplication.findUnique({
    where: { id: jobApplicationId },
    select: { candidateEmail: true, jobPosting: { select: { title: true, description: true, requirements: true } } },
  });
  if (!application) return fail('Application not found', 404);
  if (application.candidateEmail.toLowerCase() !== candidate.email.toLowerCase()) {
    return fail('This application does not belong to you', 403);
  }

  const existing = await db.candidateResumeOptimization.findUnique({
    where: { jobApplicationId },
  });
  if (!existing) return fail('No optimization record found — POST first to generate one', 404);

  // Apply accepted suggestions to the optimized resume text
  let updatedResume = optimizedResume ?? existing.optimizedResume ?? '';
  if (Array.isArray(acceptedSuggestionIds) && acceptedSuggestionIds.length > 0) {
    try {
      const suggestions: RewriteSuggestion[] = JSON.parse(existing.rewriteSuggestions || '[]');
      for (const s of suggestions) {
        if (acceptedSuggestionIds.includes(s.id) && !s.accepted) {
          s.accepted = true;
          if (s.original && s.suggested && updatedResume.includes(s.original)) {
            updatedResume = updatedResume.replace(s.original, s.suggested);
          }
        }
      }
      // Persist updated suggestion accepted flags
      await db.candidateResumeOptimization.update({
        where: { jobApplicationId },
        data: { rewriteSuggestions: JSON.stringify(suggestions) },
      });
    } catch {}
  }

  // Recompute the match score on the updated resume text (REQ-AI-RES-09: dynamic update)
  let newScore = existing.matchScore;
  try {
    const { extractStructuredFields } = await import('@/lib/resume-parser');
    const lang = 'en';
    const { parsed: reparsed } = await extractStructuredFields(updatedResume, lang);
    const breakdown = await computeMatchScore(
      reparsed,
      application.jobPosting.description,
      application.jobPosting.requirements,
      application.jobPosting.title,
      updatedResume, // pass the edited resume text so the model can see actual bullet points
    );
    newScore = breakdown.overall;
  } catch (err) {
    console.warn('[resume/optimize] Failed to recompute score:', err);
  }

  const updated = await db.candidateResumeOptimization.update({
    where: { jobApplicationId },
    data: {
      optimizedResume: updatedResume,
      selectedSummary: selectedSummary ?? existing.selectedSummary,
      matchScore: newScore,
      version: { increment: 1 },
    },
  });

  return ok({ optimization: serializeOptimization(updated), newMatchScore: newScore });
}

function serializeOptimization(o: any) {
  return {
    id: o.id,
    jobApplicationId: o.jobApplicationId,
    matchScore: o.matchScore,
    gapAnalysis: safeParse(o.gapAnalysis),
    rewriteSuggestions: safeParse(o.rewriteSuggestions),
    suggestedKeywords: safeParse(o.suggestedKeywords),
    formatFeedback: safeParse(o.formatFeedback),
    summaryOptions: safeParse(o.summaryOptions),
    selectedSummary: o.selectedSummary,
    optimizedResume: o.optimizedResume,
    version: o.version,
    updatedAt: o.updatedAt,
  };
}

function safeParse(s: string | null | undefined): any {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}
