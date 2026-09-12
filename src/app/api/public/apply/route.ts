import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';
import { parseResumeFromDataUrl } from '@/lib/resume-parser';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * POST /api/public/apply
 *
 * Public (no-auth) endpoint for candidates to submit a job application.
 *
 * Body (JSON):
 *   - jobPostingId: string (required)
 *   - candidateName: string (required)
 *   - candidateEmail: string (required)
 *   - candidatePhone: string (optional)
 *   - coverLetter: string (optional)
 *   - expectedSalary: string (optional)
 *   - source: string (optional, default 'website')
 *   - resumeDataUrl: string (optional) — base64 data URL of the resume file
 *                    (e.g. "data:application/pdf;base64,...")
 *   - resumeFileName: string (optional) — original file name for record-keeping
 *   - referralToken: string (optional) — track token from an employee's
 *                    shared referral link. If present and matches a Referral
 *                    row, that referral's candidate fields are back-filled
 *                    with the submitted data and its status is advanced
 *                    from 'pending' → 'applied'.
 *
 * The endpoint validates that:
 *   1. The job posting exists and is OPEN
 *   2. The same email hasn't already applied to the same job (idempotency)
 *   3. Required fields are present and email is valid
 *
 * Returns 201 with the created application on success.
 */
export async function POST(req: NextRequest) {
  const db = await getDb(req);
  try {
    // Make sure the Referral table exists (it was added in the WAVE2-B
    // schema addendum). ensureSchemaSynced is a no-op if the DB is already
    // up to date, and gracefully skips on local SQLite (file: DSN).
    await ensureSchemaSynced();

    const body = await req.json();
    const {
      jobPostingId,
      candidateName,
      candidateEmail,
      candidatePhone,
      coverLetter,
      expectedSalary,
      source,
      resumeDataUrl,
      resumeFileName,
      referralToken,
    } = body;

    // ===== Validate required fields =====
    if (!jobPostingId || typeof jobPostingId !== 'string') {
      return NextResponse.json(
        { error: 'Job posting ID is required' },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!candidateName || !String(candidateName).trim()) {
      return NextResponse.json(
        { error: 'Your name is required' },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!candidateEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(candidateEmail))) {
      return NextResponse.json(
        { error: 'A valid email address is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // ===== Verify the job posting exists and is open =====
    const job = await db.jobPosting.findUnique({
      where: { id: jobPostingId },
      select: {
        id: true,
        title: true,
        status: true,
        department: {
          select: {
            id: true,
            name: true,
            company: {
              select: {
                id: true,
                name: true,
                companyGroup: {
                  select: {
                    id: true,
                    name: true,
                    tenant: { select: { id: true, name: true, slug: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job posting not found' },
        { status: 404, headers: corsHeaders }
      );
    }
    if (job.status !== 'open') {
      return NextResponse.json(
        { error: 'This job is no longer accepting applications' },
        { status: 410, headers: corsHeaders }
      );
    }

    // ===== Idempotency: prevent duplicate applications from same email =====
    const existing = await db.jobApplication.findFirst({
      where: {
        jobPostingId,
        candidateEmail: { equals: String(candidateEmail).toLowerCase().trim(), mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        {
          error: "You've already applied for this position. We'll be in touch soon!",
          existingApplicationId: existing.id,
        },
        { status: 409, headers: corsHeaders }
      );
    }

    // ===== Cap resume size at 5 MB (data URL encoded — roughly 6.7 MB raw base64) =====
    if (resumeDataUrl && typeof resumeDataUrl === 'string') {
      if (resumeDataUrl.length > 7_000_000) {
        return NextResponse.json(
          { error: 'Resume file is too large. Maximum size is 5 MB.' },
          { status: 413, headers: corsHeaders }
        );
      }
      // Basic sanity: must be a data URL with a known mime type
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
          { status: 415, headers: corsHeaders }
        );
      }
    }

    // ===== Persist the application =====
    const application = await db.jobApplication.create({
      data: {
        jobPostingId,
        candidateName: String(candidateName).trim(),
        candidateEmail: String(candidateEmail).toLowerCase().trim(),
        candidatePhone: candidatePhone ? String(candidatePhone).trim() : null,
        coverLetter: coverLetter ? String(coverLetter).trim() : null,
        expectedSalary: expectedSalary ? String(expectedSalary).trim() : null,
        source: source || 'website',
        status: 'applied',
        // Store the resume as a data URL — works on serverless (Vercel) since
        // it lives in the DB, not the filesystem. For large deployments you
        // would move this to S3/Cloudinary and store the URL here.
        resume: resumeDataUrl || null,
        notes: resumeFileName ? `Resume file: ${resumeFileName}` : null,
      },
      select: {
        id: true,
        candidateName: true,
        candidateEmail: true,
        status: true,
        appliedDate: true,
      },
    });

    // ===== Parse the resume + persist ResumeParse row (best-effort, non-blocking) =====
    // This is what populates the "Resume Insights" + "Skill Matrix" sections
    // on the candidate dashboard. Without it, candidates see an empty
    // insights panel even though they uploaded a resume. We swallow parse
    // errors so a bad resume file never blocks the application itself.
    if (resumeDataUrl && typeof resumeDataUrl === 'string' && resumeDataUrl.startsWith('data:')) {
      try {
        const result = await parseResumeFromDataUrl(resumeDataUrl);
        await db.resumeParse.create({
          data: {
            jobApplicationId: application.id,
            rawText: result.rawText.slice(0, 100_000), // cap to avoid column overflow
            language: result.language || 'en',
            parsedData: JSON.stringify(result.parsed),
            confidence: result.confidence,
            sourceFormat: result.sourceFormat,
            parseError: result.parseError || null,
          },
        });
      } catch (parseErr) {
        // Non-fatal — log and continue
        console.error('[public/apply] resume parse failed (non-fatal):', parseErr);
      }
    }

    // ===== Audit + notification (best-effort, non-blocking) =====
    try {
      const tenantId = job.department?.company?.companyGroup?.tenant?.id;
      if (tenantId) {
        // Notify tenant admins about the new application
        const tenantAdmins = await db.user.findMany({
          where: { tenantId, role: { in: ['tenant_admin', 'recruiter'] } },
          select: { id: true },
        });
        if (tenantAdmins.length > 0) {
          await db.notification.createMany({
            data: tenantAdmins.map((u) => ({
              userId: u.id,
              title: 'New job application received',
              message: `${candidateName} applied for "${job.title}"`,
              type: 'info',
              category: 'recruitment',
              actionUrl: '/recruitment',
            })),
          });
        }
      }
    } catch {
      // Non-fatal — the application itself was already saved
    }

    // ===== Referral attribution (best-effort, non-blocking) =====
    // If the candidate arrived via an employee's trackable referral link,
    // the careers page passes `referralToken` (the ?ref= param) through.
    // We look up the Referral by token, back-fill the candidate fields
    // (they're stub placeholders when the link was just a shareable URL),
    // and advance status pending → applied. If anything goes wrong we
    // swallow the error — the application itself was already saved.
    let referralAttributed = false;
    if (referralToken && typeof referralToken === 'string') {
      try {
        referralAttributed = await withSchemaSync(async () => {
          // Look up the referral by its unique track token.
          const referral = await db.referral.findUnique({
            where: { trackToken: referralToken },
            select: { id: true, status: true, jobPostingId: true },
          });
          if (!referral) return false;
          // Sanity: only attribute if the referral's job matches the job
          // being applied to (defends against someone reusing a token on
          // a different job).
          if (referral.jobPostingId !== jobPostingId) return false;

          // Back-fill candidate details + advance status. We only advance
          // status if it's still 'pending' so re-applications (idempotency
          // case above) don't keep re-advancing the referral through the
          // funnel.
          const updateData: Record<string, unknown> = {
            candidateName: String(candidateName).trim(),
            candidateEmail: String(candidateEmail).toLowerCase().trim(),
            candidatePhone: candidatePhone ? String(candidatePhone).trim() : null,
            candidateResume: resumeDataUrl || null,
            updatedAt: new Date(),
          };
          if (referral.status === 'pending') {
            updateData.status = 'applied';
          }

          await db.referral.update({
            where: { id: referral.id },
            data: updateData,
          });

          // Best-effort audit log of the attribution.
          try {
            await db.auditLog.create({
              data: {
                userId: '00000000-0000-0000-0000-000000000000', // system / public apply
                action: 'REFERRAL_APPLIED',
                module: 'referrals',
                details: `Referral ${referral.id} attributed to application for "${job.title}"`,
              },
            });
          } catch {
            // Audit log is best-effort — ignore.
          }
          return true;
        });
      } catch (refErr) {
        // Don't let a referral-attribution failure break the application.
        console.error('[public/apply] referral attribution error (non-fatal):', refErr);
      }
    }

    return NextResponse.json(
      {
        success: true,
        application,
        referralAttributed,
        message: `Your application for "${job.title}" has been submitted successfully. We'll be in touch!`,
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error('POST /api/public/apply error:', error);
    return NextResponse.json(
      { error: 'Failed to submit application. Please try again later.' },
      { status: 500, headers: corsHeaders }
    );
  }
}
