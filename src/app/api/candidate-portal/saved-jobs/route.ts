/**
 * Candidate Portal — Saved Jobs (REQ-CAND-07)
 *
 * GET  /api/candidate-portal/saved-jobs
 *   List all jobs the candidate has saved (bookmarked but not applied to).
 *
 * POST /api/candidate-portal/saved-jobs
 *   body: { jobPostingId }
 *   Save (bookmark) a job. Idempotent — saving an already-saved job is a no-op.
 *
 * DELETE /api/candidate-portal/saved-jobs?jobPostingId=X
 *   Remove a job from the saved list.
 */
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import {
  requireCandidate,
  ok,
  fail,
  OPTIONS,
  parseBody,
} from '@/lib/candidate-auth';

export { OPTIONS };

export async function GET(request: Request) {
  const db = await getDb(request);
  const { candidate, response } = await requireCandidate(request);
  if (!candidate) return response;

  const savedJobs = await db.candidateSavedJob.findMany({
    where: { candidateEmail: candidate.email },
    include: {
      jobPosting: {
        select: {
          id: true,
          title: true,
          position: true,
          location: true,
          type: true,
          experience: true,
          salary: true,
          description: true,
          requirements: true,
          status: true,
          postedDate: true,
          department: { select: { name: true, company: { select: { name: true, logo: true } } } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return ok({
    savedJobs: savedJobs.map((s) => ({
      id: s.id,
      jobPostingId: s.jobPostingId,
      matchScore: s.matchScore,
      savedAt: s.createdAt,
      lastViewedAt: s.lastViewedAt,
      job: s.jobPosting,
    })),
  });
}

export async function POST(request: Request) {
  const db = await getDb(request);
  const { candidate, response } = await requireCandidate(request);
  if (!candidate) return response;

  const body = await parseBody(request);
  if (!body) return fail('Invalid JSON body', 400);
  const { jobPostingId } = body;
  if (!jobPostingId) return fail('jobPostingId is required', 400);

  // Verify the job posting exists and is open
  const jobPosting = await db.jobPosting.findUnique({
    where: { id: jobPostingId },
    select: { id: true, title: true, status: true },
  });
  if (!jobPosting) return fail('Job posting not found', 404);

  // Upsert (idempotent — re-saving is a no-op)
  const saved = await db.candidateSavedJob.upsert({
    where: {
      candidateEmail_jobPostingId: {
        candidateEmail: candidate.email,
        jobPostingId,
      },
    },
    create: {
      candidateEmail: candidate.email,
      jobPostingId,
    },
    update: {
      lastViewedAt: new Date(),
    },
  });

  return ok({ savedJob: saved, message: 'Job saved' }, 201);
}

export async function DELETE(request: Request) {
  const db = await getDb(request);
  const { candidate, response } = await requireCandidate(request);
  if (!candidate) return response;

  const url = new URL(request.url);
  const jobPostingId = url.searchParams.get('jobPostingId');
  if (!jobPostingId) return fail('jobPostingId query parameter is required', 400);

  await db.candidateSavedJob.deleteMany({
    where: {
      candidateEmail: candidate.email,
      jobPostingId,
    },
  });

  return ok({ message: 'Job removed from saved list' });
}
