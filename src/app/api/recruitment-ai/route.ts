import { NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import {
  parseResumeFromDataUrl,
  detectLanguage,
  extractStructuredFields,
  type ParsedResume,
} from '@/lib/resume-parser';

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

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const { action } = body;

    if (action === 'generate_jd') {
      const { jobTitle, department, experienceLevel, keySkills } = body;
      if (!jobTitle) return NextResponse.json({ error: 'Job title is required' }, { status: 400, headers: corsHeaders() });

      let jd = '';
      try {
        const zai = await ZAI.create();
        const response = await zai.chat.completions.create({
          messages: [
            { role: 'system', content: 'You are an expert HR professional who creates compelling job descriptions. Return the job description in a structured format with sections: About the Role, Responsibilities, Requirements, Benefits, and About the Company placeholder.' },
            { role: 'user', content: `Generate a professional job description for:\nJob Title: ${jobTitle}\nDepartment: ${department || 'Not specified'}\nExperience Level: ${experienceLevel || 'Mid-level'}\nKey Skills: ${keySkills || 'Not specified'}` },
          ],
          stream: false,
        });
        if (response?.choices?.[0]?.message?.content) jd = response.choices[0].message.content;
      } catch {
        jd = `# ${jobTitle}\n\n## About the Role\nWe are looking for an experienced ${jobTitle} to join our ${department || 'dynamic'} team. This is an exciting opportunity for a ${experienceLevel || 'mid-level'} professional to make a significant impact.\n\n## Responsibilities\n- Lead and execute key projects within the ${department || 'department'}\n- Collaborate with cross-functional teams to drive results\n- Mentor junior team members and contribute to knowledge sharing\n- Identify process improvements and implement best practices\n- Report on progress and outcomes to senior leadership\n\n## Requirements\n- ${experienceLevel || '3-5 years'} of relevant experience in ${jobTitle}\n- Strong knowledge of ${keySkills || 'industry-standard tools and practices'}\n- Excellent communication and interpersonal skills\n- Problem-solving mindset with attention to detail\n- Bachelor's degree in a relevant field\n\n## Benefits\n- Competitive salary and equity package\n- Health, dental, and vision insurance\n- Flexible work arrangements\n- Professional development budget\n- Generous PTO and company holidays\n\n## About the Company\n[Company name] is a leading organization committed to excellence and innovation.`;
      }
      return NextResponse.json({ jd }, { headers: corsHeaders() });
    }

    if (action === 'parse_resume') {
      // REAL implementation — replaced the WAVE2-C mock.
      // Accepts either:
      //   - { resumeDataUrl, jobApplicationId? }   → full pipeline (PDF/DOCX/text)
      //   - { rawText, jobApplicationId? }          → text-only pipeline
      const { resumeDataUrl, rawText, jobApplicationId } = body;

      let result;
      if (resumeDataUrl) {
        result = await parseResumeFromDataUrl(resumeDataUrl);
      } else if (rawText && typeof rawText === 'string') {
        const language = detectLanguage(rawText);
        const { parsed, confidence } = await extractStructuredFields(rawText, language);
        result = {
          rawText,
          language,
          parsed,
          confidence,
          sourceFormat: 'text' as const,
          parseError: undefined as string | undefined,
        };
      } else {
        return NextResponse.json(
          { error: 'Either resumeDataUrl or rawText is required for parse_resume' },
          { status: 400, headers: corsHeaders() },
        );
      }

      // Persist a ResumeParse row if a jobApplicationId was provided
      let parseId: string | null = null;
      if (jobApplicationId) {
        try {
          const saved = await db.resumeParse.create({
            data: {
              jobApplicationId,
              rawText: result.rawText.slice(0, 100000),
              language: result.language,
              parsedData: JSON.stringify(result.parsed),
              confidence: result.confidence,
              sourceFormat: result.sourceFormat,
              parseError: result.parseError || null,
            },
          });
          parseId = saved.id;
        } catch (e) {
          console.warn('[recruitment-ai] Failed to persist ResumeParse row:', e);
        }
      }

      return NextResponse.json(
        {
          parsed: result.parsed,
          language: result.language,
          confidence: result.confidence,
          sourceFormat: result.sourceFormat,
          parseError: result.parseError || null,
          parseId,
        },
        { headers: corsHeaders() },
      );
    }

    if (action === 'score_candidates') {
      // REAL implementation — replaced the WAVE2-C mock.
      // Accepts { jobPostingId } and uses each candidate's latest ResumeParse
      // + the JobPosting's requirements to call ZAI for an overall match score.
      const { jobPostingId } = body;
      if (!jobPostingId) {
        return NextResponse.json(
          { error: 'jobPostingId is required for score_candidates' },
          { status: 400, headers: corsHeaders() },
        );
      }

      const job = await db.jobPosting.findUnique({
        where: { id: jobPostingId },
        select: {
          id: true, title: true, description: true, requirements: true,
          experience: true,
          applications: {
            select: {
              id: true, candidateName: true, candidateEmail: true,
              resumeParses: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { parsedData: true, language: true, confidence: true },
              },
            },
            take: 50,
          },
        },
      }).catch(() => null);

      if (!job) {
        return NextResponse.json(
          { error: 'Job posting not found' },
          { status: 404, headers: corsHeaders() },
        );
      }

      const jobContext = `Job Title: ${job.title}\nExperience: ${job.experience || 'N/A'}\nRequirements: ${job.requirements || job.description || 'N/A'}`;

      const scores: Array<{
        candidateId: string;
        name: string;
        skillsMatch: number;
        experience: number;
        education: number;
        overall: number;
        rationale?: string;
      }> = [];

      for (const app of (job.applications || [])) {
        const latestParse = app.resumeParses?.[0];
        let parsed: ParsedResume | null = null;
        try {
          parsed = latestParse?.parsedData ? JSON.parse(latestParse.parsedData) : null;
        } catch { parsed = null; }

        // No parsed resume → emit zeroed scores with rationale
        if (!parsed) {
          scores.push({
            candidateId: app.id,
            name: app.candidateName,
            skillsMatch: 0,
            experience: 0,
            education: 0,
            overall: 0,
            rationale: 'No parsed resume available — run parse_resume first.',
          });
          continue;
        }

        // Ask ZAI to score this candidate against the job
        let skillsMatch = 0, experience = 0, education = 0, overall = 0;
        let rationale = '';
        try {
          const zai = await ZAI.create();
          const completion = await zai.chat.completions.create({
            messages: [
              {
                role: 'system',
                content: 'You are a strict JSON-only candidate scoring engine. Return ONLY a JSON object: {"skillsMatch":0-100,"experience":0-100,"education":0-100,"overall":0-100,"rationale":"..."}',
              },
              {
                role: 'user',
                content: `Score this candidate against the job.\n\n${jobContext}\n\nCandidate Resume JSON:\n${JSON.stringify(parsed).slice(0, 4000)}`,
              },
            ],
            temperature: 0.2,
            max_tokens: 300,
          });
          const content = completion?.choices?.[0]?.message?.content || '';
          const m = content.match(/\{[\s\S]*\}/);
          if (m) {
            const obj = JSON.parse(m[0]);
            const clamp = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
            skillsMatch = clamp(obj.skillsMatch);
            experience = clamp(obj.experience);
            education = clamp(obj.education);
            overall = clamp(obj.overall);
            rationale = typeof obj.rationale === 'string' ? obj.rationale : '';
          }
        } catch (e) {
          console.warn('[recruitment-ai] ZAI scoring failed for', app.id, e);
          // crude fallback: skills count + experience length
          skillsMatch = Math.min(100, (parsed.skills?.length || 0) * 10);
          experience = Math.min(100, (parsed.experience?.length || 0) * 20);
          education = Math.min(100, (parsed.education?.length || 0) * 25);
          overall = Math.round((skillsMatch + experience + education) / 3);
          rationale = 'Local heuristic fallback (ZAI unavailable).';
        }

        scores.push({
          candidateId: app.id,
          name: app.candidateName,
          skillsMatch,
          experience,
          education,
          overall,
          rationale,
        });
      }

      // Sort by overall score descending
      scores.sort((a, b) => b.overall - a.overall);

      return NextResponse.json({ scores }, { headers: corsHeaders() });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400, headers: corsHeaders() });
  } catch (error) {
    console.error('Recruitment AI error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
