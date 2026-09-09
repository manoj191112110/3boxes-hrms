/**
 * Candidate Portal Dashboard (REQ-ATS-04)
 *
 * GET /api/candidate-portal/dashboard
 *
 * Returns the candidate's full dashboard payload:
 *   - profile: { name, email }
 *   - applications: JobApplication[] with jobPosting title + status + interviewDate
 *   - stats: { applied, shortlisted, interviewing, offered, hired, rejected }
 *   - interviews: upcoming + past interviews (Interview[] + InterviewSession[])
 *   - missedInterviews: count + list
 *   - resumeInsights: latest ResumeParse.parsedData per application
 *   - sentiment: latest CandidateSentimentScore per application
 *   - skillMatrix: aggregated skills from resume parses with frequency
 *   - aiSuggestions: simple heuristics-based recommendations
 *     - missing-skills: skills mentioned in job requirements but not in resume
 *     - low-engagement-warn: if dropoffRisk > 70
 *     - interview-prep: tip based on upcoming interview type
 *   - learningSuggestions: course recommendations based on missing skills
 *     (curated static mapping; would be AI-driven in production)
 */
import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { parseResumeFromDataUrl } from '@/lib/resume-parser';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS });
}

async function requireCandidate(request: Request) {
  const token = getTokenFromHeaders(request);
  if (!token) return { error: NextResponse.json({ error: 'No token' }, { status: 401, headers: CORS }) };
  const decoded = await verifyToken(token);
  if (!decoded || decoded.kind !== 'candidate') {
    return { error: NextResponse.json({ error: 'Invalid candidate token' }, { status: 401, headers: CORS }) };
  }
  return { email: decoded.email as string, name: decoded.name as string };
}

// Static catalog of curated learning resources keyed by skill slug.
// In production this would come from a CourseCatalog model + integrations
// with Coursera/Udemy/LinkedIn Learning APIs.
const LEARNING_CATALOG: Record<string, { title: string; provider: string; url: string; level: string }> = {
  react: { title: 'React — The Complete Guide', provider: 'Coursera', url: 'https://coursera.org/react', level: 'intermediate' },
  nodejs: { title: 'Node.js Microservices', provider: 'Udemy', url: 'https://udemy.com/nodejs-microservices', level: 'intermediate' },
  typescript: { title: 'TypeScript Fundamentals', provider: 'Microsoft Learn', url: 'https://learn.microsoft.com/typescript', level: 'beginner' },
  python: { title: 'Python for Everybody', provider: 'Coursera', url: 'https://coursera.org/python', level: 'beginner' },
  aws: { title: 'AWS Certified Developer', provider: 'A Cloud Guru', url: 'https://acloudguru.com/aws-developer', level: 'intermediate' },
  docker: { title: 'Docker Mastery', provider: 'Udemy', url: 'https://udemy.com/docker-mastery', level: 'intermediate' },
  kubernetes: { title: 'Kubernetes for Developers', provider: 'Linux Foundation', url: 'https://training.linuxfoundation.org/kubernetes', level: 'advanced' },
  sql: { title: 'SQL for Data Science', provider: 'Coursera', url: 'https://coursera.org/sql-data-science', level: 'beginner' },
  postgresql: { title: 'PostgreSQL Administration', provider: 'Udemy', url: 'https://udemy.com/postgresql', level: 'intermediate' },
  'machine-learning': { title: 'Machine Learning Specialization', provider: 'Coursera', url: 'https://coursera.org/ml', level: 'advanced' },
  'data-structures': { title: 'Data Structures & Algorithms', provider: 'Coursera', url: 'https://coursera.org/dsa', level: 'intermediate' },
  communication: { title: 'Effective Communication', provider: 'LinkedIn Learning', url: 'https://linkedin.com/learning/communication', level: 'beginner' },
  leadership: { title: 'Leadership Principles', provider: 'Harvard Online', url: 'https://online-learning.harvard.edu/leadership', level: 'advanced' },
  'system-design': { title: 'System Design Interview Prep', provider: 'Educative', url: 'https://educative.io/system-design', level: 'advanced' },
  graphql: { title: 'GraphQL with Apollo', provider: 'Udemy', url: 'https://udemy.com/graphql-apollo', level: 'intermediate' },
  java: { title: 'Java Programming Masterclass', provider: 'Udemy', url: 'https://udemy.com/java-masterclass', level: 'intermediate' },
  go: { title: 'Go (Golang) Crash Course', provider: 'Coursera', url: 'https://coursera.org/go', level: 'intermediate' },
};

function slugifySkill(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+#]+/g, '-').replace(/^-|-$/g, '');
}

export async function GET(request: Request) {
  const db = await getDb(request);
  const auth = await requireCandidate(request);
  if ('error' in auth) return auth.error;
  const { email, name } = auth;

  try {
    // ─── Applications + job postings + interviews ─────────────────────────
    const applications = await db.jobApplication.findMany({
      where: { candidateEmail: email },
      include: {
        jobPosting: {
          select: {
            id: true,
            title: true,
            position: true,
            location: true,
            type: true,
            department: { select: { name: true } },
            requirements: true,
          },
        },
        interviews: { orderBy: { date: 'asc' } },
        resumeParses: { orderBy: { createdAt: 'desc' }, take: 1 },
        sentimentScores: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { appliedDate: 'desc' },
    });

    // ─── Backfill missing ResumeParse rows for existing applications ────
    // Before this fix, /api/public/apply stored the resume data URL on the
    // application but never created a ResumeParse row. So candidates who
    // applied before the fix have no insights / skill matrix on their
    // dashboard. We backfill lazily on dashboard load: for each application
    // that has a resume data URL but zero ResumeParse rows, parse + persist
    // one now (best-effort, non-blocking — failures are swallowed).
    //
    // ALSO: re-parse any row whose parseError references DOMMatrix — that
    // error came from the old `pdf-parse` library (which referenced the
    // browser-only DOMMatrix API at module-eval time). The new `unpdf`
    // pipeline doesn't have this issue, so re-parsing clears the stale
    // error and gives the candidate real insights.
    const STALE_PARSE_ERRORS = ['DOMMatrix', 'pdf-parse', 'Canvas'];
    const isStaleParseError = (err: string | null | undefined): boolean => {
      if (!err) return false;
      return STALE_PARSE_ERRORS.some(k => err.includes(k));
    };

    await Promise.allSettled(
      applications
        .filter((a) => {
          const hasResume = !!a.resume && a.resume.startsWith('data:');
          if (!hasResume) return false;
          // Backfill if no parse rows exist, OR if the most recent parse has
          // a stale error (DOMMatrix etc.) — re-parse to clear it.
          if (a.resumeParses.length === 0) return true;
          const latest = a.resumeParses[0];
          return isStaleParseError(latest?.parseError as string | undefined);
        })
        .map(async (a) => {
          try {
            const result = await parseResumeFromDataUrl(a.resume as string);
            // If we're re-parsing (an existing row had a stale error),
            // update the latest row in place rather than creating a new one.
            const latestId = a.resumeParses[0]?.id as string | undefined;
            if (latestId) {
              await db.resumeParse.update({
                where: { id: latestId },
                data: {
                  rawText: result.rawText.slice(0, 100_000),
                  language: result.language || 'en',
                  parsedData: JSON.stringify(result.parsed),
                  confidence: result.confidence,
                  sourceFormat: result.sourceFormat,
                  parseError: result.parseError || null,
                },
              });
            } else {
              await db.resumeParse.create({
                data: {
                  jobApplicationId: a.id,
                  rawText: result.rawText.slice(0, 100_000),
                  language: result.language || 'en',
                  parsedData: JSON.stringify(result.parsed),
                  confidence: result.confidence,
                  sourceFormat: result.sourceFormat,
                  parseError: result.parseError || null,
                },
              });
            }
            // Mutate the in-memory application so the rest of this request
            // sees the freshly-parsed insight without a second DB round-trip.
            a.resumeParses = [
              {
                id: latestId,
                parsedData: JSON.stringify(result.parsed),
                language: result.language,
                confidence: result.confidence,
                sourceFormat: result.sourceFormat,
                parseError: result.parseError || null,
              } as any,
            ];
          } catch (err) {
            console.warn('[candidate-portal/dashboard] backfill parse failed for', a.id, err);
          }
        }),
    );

    // ─── AI Interview Sessions (separate from manual Interview records) ──
    const aiSessions = await db.interviewSession.findMany({
      where: { candidateEmail: email },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // ─── Talent Pool entries (REQ-STAT-01) ──────────────────────────────
    const talentPoolEntries = await db.candidateTalentPool.findMany({
      where: { candidateEmail: email, removedAt: null },
      include: {
        company: { select: { id: true, name: true, logo: true } },
      },
      orderBy: { placedAt: 'desc' },
    });

    // ─── Saved Jobs (REQ-CAND-07) ───────────────────────────────────────
    const savedJobs = await db.candidateSavedJob.findMany({
      where: { candidateEmail: email },
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
            status: true,
            postedDate: true,
            department: { select: { name: true, company: { select: { name: true, logo: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // ─── Resume Optimization per application (REQ-AI-RES-03..09) ─────────
    const optimizations = await db.candidateResumeOptimization.findMany({
      where: { candidateEmail: email },
      select: {
        jobApplicationId: true,
        matchScore: true,
        version: true,
        updatedAt: true,
      },
    });
    const optimizationByApp: Record<string, { matchScore: number; version: number; updatedAt: Date }> = {};
    for (const o of optimizations) {
      optimizationByApp[o.jobApplicationId] = {
        matchScore: o.matchScore,
        version: o.version,
        updatedAt: o.updatedAt,
      };
    }

    // ─── AI Feedback published to this candidate (REQ-STAT-05) ──────────
    const aiFeedback = await db.candidateAiFeedback.findMany({
      where: { candidateEmail: email, reviewStatus: 'published' },
      select: {
        jobApplicationId: true,
        hrEditedVersion: true,
        publishedAt: true,
      },
    });
    const feedbackByApp: Record<string, { text: string; publishedAt: Date }> = {};
    for (const f of aiFeedback) {
      feedbackByApp[f.jobApplicationId] = {
        text: f.hrEditedVersion || '',
        publishedAt: f.publishedAt || new Date(),
      };
    }

    // ─── Job Alerts (REQ-STAT-03) ───────────────────────────────────────
    const jobAlerts = await db.candidateJobAlert.findMany({
      where: { candidateEmail: email, seenAt: null },
      include: {
        jobPosting: {
          select: {
            id: true, title: true, location: true,
            department: { select: { company: { select: { name: true, logo: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // ─── Stats ───────────────────────────────────────────────────────────
    const stats = {
      applied: applications.filter(a => a.status === 'applied').length,
      shortlisted: applications.filter(a => a.status === 'screening').length,
      interviewing: applications.filter(a => a.status === 'interview').length,
      offered: applications.filter(a => a.status === 'offered').length,
      hired: applications.filter(a => a.status === 'hired').length,
      rejected: applications.filter(a => a.status === 'rejected').length,
      talentPool: applications.filter(a => a.status === 'talent_pool').length,
      total: applications.length,
    };

    // ─── Upcoming + past interviews ──────────────────────────────────────
    const now = new Date();
    const upcoming: any[] = [];
    const attended: any[] = [];
    const missed: any[] = [];

    for (const app of applications) {
      for (const iv of app.interviews) {
        const ivDate = new Date(iv.date);
        const entry = {
          id: iv.id,
          applicationId: app.id,
          jobTitle: app.jobPosting.title,
          type: iv.type,
          date: iv.date,
          time: iv.time,
          duration: iv.duration,
          location: iv.location,
          meetingUrl: iv.meetingUrl,
          interviewer: iv.interviewer,
          status: iv.status,
          score: iv.score,
          aiScore: iv.aiScore,
          feedback: iv.feedback,
        };
        if (iv.status === 'cancelled' || iv.status === 'rescheduled') continue;
        if (ivDate > now) {
          upcoming.push(entry);
        } else if (iv.status === 'completed') {
          attended.push(entry);
        } else if (iv.status === 'scheduled' && ivDate < now) {
          // Scheduled but in the past with no completion → likely missed
          missed.push(entry);
        }
      }
    }
    upcoming.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    attended.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // ─── AI Sessions: count missed (expired/disqualified without completion) ──
    const aiMissed = aiSessions.filter(s => ['expired', 'disqualified'].includes(s.status)).length;
    const aiCompleted = aiSessions.filter(s => s.status === 'completed').length;

    // ─── Resume insights ─────────────────────────────────────────────────
    const resumeInsights = applications.map(a => {
      const parse = a.resumeParses[0];
      if (!parse) return null;
      let parsed: any = null;
      try { parsed = JSON.parse(parse.parsedData); } catch { /* noop */ }
      return {
        applicationId: a.id,
        jobTitle: a.jobPosting.title,
        language: parse.language,
        confidence: parse.confidence,
        sourceFormat: parse.sourceFormat,
        parseError: parse.parseError,
        parsed,
      };
    }).filter(Boolean);

    // ─── Skill matrix (aggregate from all resume parses) ─────────────────
    const skillFrequency: Record<string, { count: number; levels: string[] }> = {};
    for (const ri of resumeInsights) {
      const skills: string[] = ri?.parsed?.skills || [];
      for (const skill of skills) {
        const slug = slugifySkill(skill);
        if (!slug) continue;
        if (!skillFrequency[slug]) skillFrequency[slug] = { count: 0, levels: [] };
        skillFrequency[slug].count += 1;
      }
    }
    const skillMatrix = Object.entries(skillFrequency)
      .map(([slug, info]) => ({ skill: slug, frequency: info.count }))
      .sort((a, b) => b.frequency - a.frequency);

    // ─── Sentiment scores ────────────────────────────────────────────────
    const sentiments = applications.map(a => ({
      applicationId: a.id,
      jobTitle: a.jobPosting.title,
      ...(a.sentimentScores[0] ? {
        sentiment: a.sentimentScores[0].sentiment,
        engagementScore: a.sentimentScores[0].engagementScore,
        dropoffRisk: a.sentimentScores[0].dropoffRisk,
        rationale: a.sentimentScores[0].rationale,
        source: a.sentimentScores[0].source,
      } : null),
    })).filter(s => s.sentiment);

    // ─── AI suggestions (heuristic) ──────────────────────────────────────
    const aiSuggestions: any[] = [];

    // 1. Missing-skills analysis
    const candidateSkillSlugs = new Set(skillMatrix.map(s => s.skill));
    const missingSkillsByJob: Record<string, string[]> = {};
    for (const app of applications) {
      if (['rejected', 'hired'].includes(app.status)) continue;
      const req = app.jobPosting.requirements || '';
      // Extract candidate skill-like tokens from requirements (very simple heuristic)
      const tokens = req.split(/[\n,•·|\s]+/).map(t => t.trim().toLowerCase()).filter(t => t.length > 2 && t.length < 30);
      const missingForJob: string[] = [];
      for (const t of tokens) {
        const slug = slugifySkill(t);
        if (LEARNING_CATALOG[slug] && !candidateSkillSlugs.has(slug)) {
          missingForJob.push(slug);
        }
      }
      if (missingForJob.length) {
        missingSkillsByJob[app.jobPosting.title] = Array.from(new Set(missingForJob)).slice(0, 5);
        aiSuggestions.push({
          type: 'missing_skills',
          severity: 'info',
          jobTitle: app.jobPosting.title,
          message: `You're missing these in-demand skills for "${app.jobPosting.title}": ${missingForJob.join(', ')}. Strengthening these could improve your match score.`,
        });
      }
    }

    // 2. Low-engagement warning
    for (const s of sentiments) {
      if (s.dropoffRisk && s.dropoffRisk > 70) {
        aiSuggestions.push({
          type: 'engagement_warning',
          severity: 'warning',
          jobTitle: s.jobTitle,
          message: `Your engagement score for "${s.jobTitle}" has dropped. Consider responding faster to recruiter messages to keep your application active.`,
        });
      }
    }

    // 3. Upcoming interview prep
    for (const iv of upcoming.slice(0, 3)) {
      const prepMap: Record<string, string> = {
        technical: 'Brush up on data structures, algorithms, and recent project work. Have 2-3 coding examples ready.',
        hr: 'Prepare STAR-format answers for behavioral questions. Have questions ready about the team and culture.',
        managerial: 'Be ready to discuss past projects end-to-end, trade-offs you made, and how you handle ambiguity.',
        final: 'Focus on big-picture thinking, leadership scenarios, and cultural fit. Prepare a 60-second self-intro.',
      };
      aiSuggestions.push({
        type: 'interview_prep',
        severity: 'info',
        jobTitle: iv.jobTitle,
        interviewType: iv.type,
        interviewDate: iv.date,
        message: prepMap[iv.type] || 'Review the job description and your resume; be ready to talk through each role.',
      });
    }

    // 4. Stale applications nudge
    const staleApps = applications.filter(a => {
      if (!['applied', 'screening'].includes(a.status)) return false;
      const daysSince = (Date.now() - new Date(a.appliedDate).getTime()) / 86400000;
      return daysSince > 14;
    });
    if (staleApps.length > 0) {
      aiSuggestions.push({
        type: 'stale_applications',
        severity: 'info',
        message: `You have ${staleApps.length} application(s) with no update for 2+ weeks. Consider sending a follow-up message to the recruiter.`,
      });
    }

    // ─── Learning suggestions (based on missing skills) ──────────────────
    const allMissingSkills = new Set<string>();
    Object.values(missingSkillsByJob).forEach(skills => skills.forEach(s => allMissingSkills.add(s)));
    const learningSuggestions = Array.from(allMissingSkills).map(slug => LEARNING_CATALOG[slug]).filter(Boolean);

    return NextResponse.json({
      profile: { name, email },
      stats,
      applications: applications.map(a => {
        const opt = optimizationByApp[a.id];
        const fb = feedbackByApp[a.id];
        return {
          id: a.id,
          jobTitle: a.jobPosting.title,
          position: a.jobPosting.position,
          department: a.jobPosting.department?.name,
          location: a.jobPosting.location,
          type: a.jobPosting.type,
          status: a.status,
          appliedDate: a.appliedDate,
          rating: a.rating,
          interviewDate: a.interviewDate,
          expectedSalary: a.expectedSalary,
          // REQ-AI-RES-03: per-application match score
          matchScore: opt?.matchScore ?? null,
          optimizationVersion: opt?.version ?? null,
          // REQ-STAT-05: published AI feedback (only shown after HR review)
          aiFeedback: fb ? { text: fb.text, publishedAt: fb.publishedAt } : null,
        };
      }),
      interviews: { upcoming, attended, missed },
      aiInterviews: {
        total: aiSessions.length,
        completed: aiCompleted,
        missed: aiMissed,
        recent: aiSessions.slice(0, 5).map(s => ({
          id: s.id,
          status: s.status,
          overallScore: s.overallScore,
          aiRecommendation: s.aiRecommendation,
          startedAt: s.startedAt,
          completedAt: s.completedAt,
        })),
      },
      resumeInsights,
      sentiments,
      skillMatrix,
      aiSuggestions,
      learningSuggestions,
      // ─── Candidate Portal addendum sections ───
      // REQ-STAT-01: Talent Pool status — which companies have placed this candidate
      talentPool: talentPoolEntries.map(tp => ({
        id: tp.id,
        companyName: tp.company.name,
        companyLogo: tp.company.logo,
        placedAt: tp.placedAt,
        notes: tp.notes,
        // REQ-STAT-02: positive message shown in the UI
        message: `Your profile is impressive — we have added you to ${tp.company.name}'s talent pool and may reach out for future matching roles.`,
      })),
      // REQ-CAND-07: Saved Jobs (bookmarked but not applied to)
      savedJobs: savedJobs.map(s => ({
        id: s.id,
        jobPostingId: s.jobPostingId,
        matchScore: s.matchScore,
        savedAt: s.createdAt,
        lastViewedAt: s.lastViewedAt,
        job: s.jobPosting,
      })),
      // REQ-STAT-03: New job alerts matching this candidate's profile
      jobAlerts: jobAlerts.map(ja => ({
        id: ja.id,
        matchScore: ja.matchScore,
        createdAt: ja.createdAt,
        job: ja.jobPosting,
      })),
    }, { headers: CORS });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500, headers: CORS });
  }
}
