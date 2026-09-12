/**
 * HR-side AI-Generated Rejection Feedback (REQ-STAT-05, REQ-STAT-06)
 *
 * POST /api/recruitment/ai-feedback
 *   body: { applicationId, action: 'draft' | 'approve' | 'reject' | 'publish', hrEditedVersion? }
 *
 * Actions:
 *   - 'draft'   : Ask the AI to generate a constructive, polite rejection-feedback
 *                 draft based on the candidate's profile vs the job requirements.
 *                 Stored as CandidateAiFeedback.aiDraft with reviewStatus='in_review'.
 *                 Visible to HR only — NOT visible to the candidate yet.
 *   - 'approve' : HR approves the AI draft (optionally with edits → hrEditedVersion).
 *                 reviewStatus='approved'. Still not visible to candidate.
 *   - 'publish' : Publish the approved feedback to the candidate. Sets
 *                 reviewStatus='published', publishedAt=now. Also updates the
 *                 application status to 'rejected' (REQ-STAT-04) and sends the
 *                 candidate a message containing the feedback.
 *   - 'reject'  : HR rejects the AI draft (decides not to send AI feedback).
 *                 reviewStatus='rejected'. Application status is set to 'rejected'
 *                 without any AI feedback message.
 *
 * REQ-STAT-06 (Human-Overridden Safety): HR MUST review the AI draft before it
 * is sent. The candidate never sees the raw aiDraft — only the hrEditedVersion
 * (which HR may have edited to remove any insensitive language).
 *
 * Tenant gate: This endpoint checks Tenant.aiFeedbackEnabled. If the tenant has
 * not enabled AI feedback, only the 'reject' action is allowed (plain reject
 * without feedback).
 */
import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS });
}

export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: CORS });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: CORS });
    const decodedRec = decoded as unknown as Record<string, any>;

    const url = new URL(request.url);
    const applicationId = url.searchParams.get('applicationId');
    if (!applicationId) return NextResponse.json({ error: 'applicationId is required' }, { status: 400, headers: CORS });

    // Verify tenant ownership (super_admin bypasses)
    const tenantFilter = decodedRec.role === 'super_admin' ? {} : {
      jobPosting: {
        department: { company: { companyGroup: { tenantId: decodedRec.tenantId as string } } },
      },
    };
    const application = await db.jobApplication.findFirst({
      where: {
        id: applicationId,
        ...tenantFilter,
      },
    });
    if (!application) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: CORS });

    const feedback = await db.candidateAiFeedback.findUnique({
      where: { jobApplicationId: applicationId },
    });

    return NextResponse.json({ feedback }, { headers: CORS });
  } catch (error) {
    console.error('AI feedback GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS });
  }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: CORS });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: CORS });
    const decodedRec = decoded as unknown as Record<string, any>;

    const body = await request.json().catch(() => ({}));
    const { applicationId, action, hrEditedVersion } = body;
    if (!applicationId || !action) {
      return NextResponse.json({ error: 'applicationId and action are required' }, { status: 400, headers: CORS });
    }
    if (!['draft', 'approve', 'reject', 'publish'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400, headers: CORS });
    }

    // Verify the application exists and belongs to the caller's tenant
    // (super_admin bypasses the tenant filter so they can manage any application)
    const tenantFilter = decodedRec.role === 'super_admin' ? {} : {
      jobPosting: {
        department: { company: { companyGroup: { tenantId: decodedRec.tenantId as string } } },
      },
    };
    const application = await db.jobApplication.findFirst({
      where: {
        id: applicationId,
        ...tenantFilter,
      },
      include: {
        jobPosting: {
          select: {
            title: true,
            description: true,
            requirements: true,
            department: { select: { company: { select: { id: true, name: true } } } },
          },
        },
        resumeParses: { orderBy: { createdAt: 'desc' }, take: 1, select: { parsedData: true } },
      },
    });
    if (!application) return NextResponse.json({ error: 'Application not found in your tenant' }, { status: 404, headers: CORS });

    // Fetch the tenant to check if AI feedback is enabled
    const tenant = await getPlatformDb().tenant.findFirst({
      where: {
        companyGroups: {
          some: {
            companies: {
              some: { id: application.jobPosting.department.company.id },
            },
          },
        },
      },
      select: { id: true, aiFeedbackEnabled: true },
    });

    const aiFeedbackEnabled = !!tenant?.aiFeedbackEnabled;

    // If AI feedback is not enabled, only allow plain 'reject'
    if (!aiFeedbackEnabled && action !== 'reject') {
      return NextResponse.json({
        error: 'AI feedback is not enabled for this tenant. Use plain reject instead.',
      }, { status: 403, headers: CORS });
    }

    let feedback = await db.candidateAiFeedback.findUnique({
      where: { jobApplicationId: applicationId },
    });

    if (action === 'draft') {
      // Generate the AI draft
      const aiDraft = await generateAiRejectionFeedback(application);

      feedback = await db.candidateAiFeedback.upsert({
        where: { jobApplicationId: applicationId },
        create: {
          jobApplicationId: applicationId,
          candidateEmail: application.candidateEmail,
          aiDraft,
          reviewStatus: 'in_review',
        },
        update: {
          aiDraft,
          reviewStatus: 'in_review',
        },
      });

      return NextResponse.json({ ok: true, feedback }, { headers: CORS });
    }

    if (!feedback) {
      return NextResponse.json({ error: 'No AI draft found — call action=draft first' }, { status: 400, headers: CORS });
    }

    if (action === 'approve') {
      feedback = await db.candidateAiFeedback.update({
        where: { id: feedback.id },
        data: {
          hrEditedVersion: hrEditedVersion ?? feedback.aiDraft,
          reviewStatus: 'approved',
          reviewedBy: decodedRec.userId as string,
          reviewedAt: new Date(),
        },
      });
      return NextResponse.json({ ok: true, feedback }, { headers: CORS });
    }

    if (action === 'reject') {
      feedback = await db.candidateAiFeedback.upsert({
        where: { jobApplicationId: applicationId },
        create: {
          jobApplicationId: applicationId,
          candidateEmail: application.candidateEmail,
          reviewStatus: 'rejected',
          reviewedBy: decodedRec.userId as string,
          reviewedAt: new Date(),
        },
        update: {
          reviewStatus: 'rejected',
          reviewedBy: decodedRec.userId as string,
          reviewedAt: new Date(),
        },
      });

      // Update application status to rejected (REQ-STAT-04)
      await db.jobApplication.update({
        where: { id: applicationId },
        data: { status: 'rejected' },
      });

      return NextResponse.json({ ok: true, feedback, message: 'Application rejected without AI feedback' }, { headers: CORS });
    }

    if (action === 'publish') {
      if (feedback.reviewStatus !== 'approved') {
        return NextResponse.json({ error: 'Feedback must be approved before publishing' }, { status: 400, headers: CORS });
      }
      const finalFeedback = feedback.hrEditedVersion || feedback.aiDraft || '';

      feedback = await db.candidateAiFeedback.update({
        where: { id: feedback.id },
        data: {
          reviewStatus: 'published',
          publishedAt: new Date(),
        },
      });

      // Update application status to rejected (REQ-STAT-04)
      await db.jobApplication.update({
        where: { id: applicationId },
        data: { status: 'rejected' },
      });

      // Send the candidate a message with the feedback
      const companyName = application.jobPosting.department.company.name;
      const candidateMessage = `Hi ${application.candidateName},

Thank you for applying to ${application.jobPosting.title} at ${companyName}.

After careful review, we have decided not to move forward with your application at this time.

${finalFeedback}

We appreciate the time you invested in this process and wish you all the best in your job search.

Best regards,
The ${companyName} Talent Team`;

      await db.candidateMessage.create({
        data: {
          candidateEmail: application.candidateEmail,
          senderName: `${companyName} Talent Team`,
          senderRole: 'recruiter',
          body: candidateMessage,
        },
      }).catch(() => {});

      await db.auditLog.create({
        data: {
          userId: decodedRec.userId as string,
          action: 'PUBLISH_AI_FEEDBACK',
          module: 'recruitment',
          details: `Published AI feedback to ${application.candidateName} for ${application.jobPosting.title}`,
        },
      }).catch(() => {});

      return NextResponse.json({ ok: true, feedback, message: 'Feedback published to candidate' }, { headers: CORS });
    }

    return NextResponse.json({ error: 'Unhandled action' }, { status: 400, headers: CORS });
  } catch (error) {
    console.error('AI feedback POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS });
  }
}

/**
 * Generate a polite, constructive rejection-feedback draft using Z-AI.
 * Falls back to a generic message if Z-AI is unavailable.
 */
async function generateAiRejectionFeedback(application: any): Promise<string> {
  const jobTitle = application.jobPosting.title;
  const jobDescription = application.jobPosting.description;
  const jobRequirements = application.jobPosting.requirements || '';
  const companyName = application.jobPosting.department.company.name;

  // Build candidate profile from resume parse
  let candidateProfile = `Name: ${application.candidateName}`;
  try {
    if (application.resumeParses?.length > 0) {
      const parsed = application.resumeParses[0].parsedData as any;
      if (parsed?.skills?.length) {
        candidateProfile += `\nSkills: ${parsed.skills.join(', ')}`;
      }
      if (parsed?.experience?.length) {
        candidateProfile += `\nExperience: ${parsed.experience.map((e: any) => `${e.role} at ${e.company}`).join(', ')}`;
      }
      if (parsed?.summary) {
        candidateProfile += `\nSummary: ${parsed.summary}`;
      }
    }
  } catch {}

  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a compassionate, professional HR communications writer. Respond with only the feedback paragraph — no greeting, no signature, no JSON, no markdown.',
        },
        {
          role: 'user',
          content: `Write a polite, constructive rejection-feedback message for a candidate who applied to ${jobTitle} at ${companyName}.

Rules:
- Be respectful and encouraging — never harsh or legally binding.
- Reference SPECIFIC gaps between the candidate's profile and the job requirements.
- Suggest concrete improvements the candidate can make for future applications.
- Do NOT mention protected characteristics (age, gender, race, etc.).
- Do NOT make up facts about the candidate that aren't in their profile.
- Keep it to 3-5 sentences.
- Do NOT include "Dear X" or "Best regards" — just the feedback body.

JOB REQUIREMENTS:
${(jobRequirements || jobDescription).substring(0, 1500)}

CANDIDATE PROFILE:
${candidateProfile.substring(0, 1000)}`,
        },
      ],
      temperature: 0.4,
      max_tokens: 400,
    });

    const content = completion?.choices?.[0]?.message?.content || '';
    if (content.trim().length > 20) return content.trim();
  } catch (err) {
    console.warn('[ai-feedback] ZAI generation failed:', err);
  }

  // Fallback — generic but polite
  return `After careful review of your application and the job requirements, we have decided to proceed with other candidates whose profiles more closely match the specific needs of this role. We encourage you to highlight your relevant experience and skills more prominently in future applications, and we wish you success in your job search.`;
}
