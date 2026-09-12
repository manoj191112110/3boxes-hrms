/**
 * Candidate Portal — Right to Erasure (REQ-SEC-CAND-02)
 *
 * POST /api/candidate-portal/erase
 *   body: { companyId?, reason? }
 *
 * Triggers a HARD DELETE of the candidate's profile, resumes, video interviews,
 * chat logs, and application data from the specified sub-company's database.
 * If companyId is omitted, erases across ALL companies the candidate applied to.
 *
 * The deletion is logged in CandidateErasureRequest for audit/GDPR compliance.
 * The candidate's CandidatePortalUser record is also deleted, immediately
 * invalidating their session.
 *
 * This is irreversible. The candidate is warned in the UI before invoking.
 */
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import {
  requireCandidate,
  ok,
  fail,
  OPTIONS,
  parseBody,
  getRequestMeta,
} from '@/lib/candidate-auth';

export { OPTIONS };

export async function POST(request: Request) {
  const db = await getDb(request);
  const { candidate, response } = await requireCandidate(request);
  if (!candidate) return response;

  const body = await parseBody(request);
  if (!body) return fail('Invalid JSON body', 400);
  const { companyId, reason } = body;
  const { ip, ua } = getRequestMeta(request);

  // Create the audit record first (before deleting anything)
  const erasureRequest = await db.candidateErasureRequest.create({
    data: {
      candidateEmail: candidate.email,
      companyId: companyId || null,
      reason: reason || null,
      status: 'processing',
      requestedFromIp: ip,
      requestedFromUa: ua,
    },
  });

  const deletionLog: Record<string, number> = {
    applications: 0,
    resumeParses: 0,
    sentimentScores: 0,
    savedJobs: 0,
    talentPoolEntries: 0,
    jobAlerts: 0,
    messages: 0,
    interviewSessions: 0,
    passwordResets: 0,
    optimizations: 0,
    aiFeedback: 0,
  };

  try {
    // Find all applications for this candidate (optionally scoped to a company)
    const applicationWhere = companyId
      ? {
          candidateEmail: candidate.email,
          jobPosting: {
            department: { company: { id: companyId } },
          },
        }
      : { candidateEmail: candidate.email };

    const applications = await db.jobApplication.findMany({
      where: applicationWhere,
      select: { id: true },
    });
    const applicationIds = applications.map((a) => a.id);

    // Delete in dependency order (children first)

    // 1. CandidateResumeOptimization (per-application)
    if (applicationIds.length > 0) {
      const r = await db.candidateResumeOptimization.deleteMany({
        where: { jobApplicationId: { in: applicationIds } },
      });
      deletionLog.optimizations = r.count;
    }

    // 2. CandidateAiFeedback (per-application)
    if (applicationIds.length > 0) {
      const r = await db.candidateAiFeedback.deleteMany({
        where: { jobApplicationId: { in: applicationIds } },
      });
      deletionLog.aiFeedback = r.count;
    }

    // 3. CandidateSentimentScore (per-application)
    if (applicationIds.length > 0) {
      const r = await db.candidateSentimentScore.deleteMany({
        where: { jobApplicationId: { in: applicationIds } },
      });
      deletionLog.sentimentScores = r.count;
    }

    // 4. ResumeParse (per-application)
    if (applicationIds.length > 0) {
      const r = await db.resumeParse.deleteMany({
        where: { jobApplicationId: { in: applicationIds } },
      });
      deletionLog.resumeParses = r.count;
    }

    // 5. Interview records (InterviewSession, InterviewResponse, ProctoringLog, Interview)
    // InterviewSessions are keyed by candidateEmail (not applicationId)
    const interviewSessions = await db.interviewSession.findMany({
      where: { candidateEmail: candidate.email },
      select: { id: true },
    });
    const sessionIds = interviewSessions.map((s) => s.id);
    if (sessionIds.length > 0) {
      await db.proctoringLog.deleteMany({ where: { sessionId: { in: sessionIds } } });
      await db.interviewResponse.deleteMany({ where: { sessionId: { in: sessionIds } } });
    }
    const delSessions = await db.interviewSession.deleteMany({
      where: { candidateEmail: candidate.email },
    });
    deletionLog.interviewSessions = delSessions.count;

    // 6. Interviews linked to applications (manual interview records)
    if (applicationIds.length > 0) {
      await db.interview.deleteMany({
        where: { jobApplicationId: { in: applicationIds } },
      });
    }

    // 7. JobApplications
    const delApps = await db.jobApplication.deleteMany({ where: applicationWhere });
    deletionLog.applications = delApps.count;

    // 8. CandidateMessage (HR↔candidate chat)
    const delMsgs = await db.candidateMessage.deleteMany({
      where: { candidateEmail: candidate.email },
    });
    deletionLog.messages = delMsgs.count;

    // 9. CandidateSavedJob
    const delSaved = await db.candidateSavedJob.deleteMany({
      where: { candidateEmail: candidate.email },
    });
    deletionLog.savedJobs = delSaved.count;

    // 10. CandidateJobAlert
    const delAlerts = await db.candidateJobAlert.deleteMany({
      where: { candidateEmail: candidate.email },
    });
    deletionLog.jobAlerts = delAlerts.count;

    // 11. CandidateTalentPool
    const delTalent = await db.candidateTalentPool.deleteMany({
      where: { candidateEmail: candidate.email },
    });
    deletionLog.talentPoolEntries = delTalent.count;

    // 12. CandidatePasswordReset
    const delResets = await db.candidatePasswordReset.deleteMany({
      where: { candidateEmail: candidate.email },
    });
    deletionLog.passwordResets = delResets.count;

    // 13. CandidateConsent (withdraw all consents)
    await db.candidateConsent.deleteMany({
      where: { candidateEmail: candidate.email },
    });

    // 14. CandidatePortalUser (last — invalidates session)
    await db.candidatePortalUser.deleteMany({
      where: { candidateEmail: candidate.email },
    });

    // Mark the erasure request as completed
    await db.candidateErasureRequest.update({
      where: { id: erasureRequest.id },
      data: {
        status: 'completed',
        deletionLog: JSON.stringify(deletionLog),
        completedAt: new Date(),
      },
    });

    return ok({
      message: 'Your data has been permanently deleted.',
      erasureRequestId: erasureRequest.id,
      deleted: deletionLog,
    });
  } catch (err: unknown) {
    console.error('[erase] Failed:', err);
    await db.candidateErasureRequest.update({
      where: { id: erasureRequest.id },
      data: {
        status: 'completed',
        deletionLog: JSON.stringify({ ...deletionLog, error: err instanceof Error ? err.message : String(err) }),
        completedAt: new Date(),
      },
    }).catch(() => {});
    return fail('Erasure partially failed — please contact support', 500);
  }
}

/** GET — list this candidate's past erasure requests (for audit trail). */
export async function GET(request: Request) {
  const db = await getDb(request);
  const { candidate, response } = await requireCandidate(request);
  if (!candidate) return response;

  const requests = await db.candidateErasureRequest.findMany({
    where: { candidateEmail: candidate.email },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return ok({ requests });
}
