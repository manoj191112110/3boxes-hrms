/**
 * Candidate-side AI Resume Optimization (REQ-AI-RES-03..09)
 *
 * This module powers the "Optimize & Apply" workflow that turns the candidate
 * portal from a simple form into a career coach. It is invoked from the
 * candidate-portal API routes (NOT the HR-side recruitment-ai route).
 *
 * Pipeline:
 *   1. computeMatchScore()       — REQ-AI-RES-03: Job-specific match score (0-100)
 *   2. computeGapAnalysis()      — REQ-AI-RES-04: matched / missing / implied
 *   3. generateRewriteSuggestions() — REQ-AI-RES-05: inline clickable rewrites
 *   4. suggestMissingKeywords()  — REQ-AI-RES-06: ATS keyword injection
 *   5. analyzeFormat()           — REQ-AI-RES-07: format & structure feedback
 *   6. generateSummaryOptions()  — REQ-AI-RES-08: 3 AI-generated summaries
 *
 * REQ-AI-RES-09 (iterative optimize & apply) is orchestrated by the API route
 * which calls these helpers in sequence and persists the result to
 * CandidateResumeOptimization. The match score updates dynamically as the
 * candidate edits their resume / accepts suggestions.
 *
 * All Z-AI calls have local fallbacks so the candidate experience degrades
 * gracefully if the AI provider is unavailable.
 */
import type { ParsedResume } from '@/lib/resume-parser';

export interface GapAnalysis {
  matched: Array<{ skill: string; evidence: string }>;
  missing: Array<{ skill: string; criticality: 'high' | 'medium' | 'low' }>;
  implied: Array<{ skill: string; evidence: string }>;
}

export interface RewriteSuggestion {
  id: string;
  original: string;
  suggested: string;
  type: 'quantify' | 'action_verb' | 'concise' | 'keyword' | 'grammar';
  rationale: string;
  accepted: boolean;
}

export interface KeywordSuggestion {
  keyword: string;
  category: 'technical' | 'soft_skill' | 'industry' | 'certification';
  reason: string;
}

export interface FormatFeedback {
  id: string;
  issue: string;
  suggestion: string;
  severity: 'high' | 'medium' | 'low';
  category: 'dates' | 'contact' | 'length' | 'structure' | 'ats_friendly';
}

export interface MatchScoreBreakdown {
  overall: number; // 0-100
  skills: number; // 0-100
  experience: number; // 0-100
  education: number; // 0-100
  keywords: number; // 0-100
  reasoning: string;
}

/**
 * Compute a job-specific match score by comparing the candidate's parsed resume
 * against the job description's required skills + experience.
 *
 * Uses Z-AI when available; falls back to a deterministic keyword-overlap
 * heuristic so the candidate always gets a number (even offline).
 *
 * When `rawResumeText` is provided, the full resume text is included in the
 * prompt so the model can see actual bullet points, achievements, and
 * verify skills in context — instead of relying only on the structured
 * fields returned by the parser (which may be incomplete).
 */
export async function computeMatchScore(
  resume: ParsedResume,
  jobDescription: string,
  jobRequirements: string | null,
  jobTitle: string,
  rawResumeText?: string,
): Promise<MatchScoreBreakdown> {
  const fullJd = [jobTitle, jobDescription, jobRequirements || ''].filter(Boolean).join('\n\n');
  const fallback = computeFallbackMatchScore(resume, fullJd, rawResumeText);

  if (!fullJd || fullJd.trim().length < 20) {
    return { ...fallback, reasoning: 'Insufficient job description content — using heuristic score.' };
  }

  // Build a rich candidate context that includes BOTH the structured fields
  // AND the full raw resume text. The structured fields give the model a
  // quick summary; the raw text lets it verify skill claims by looking at
  // actual bullet points and quantified achievements.
  const rawTextSection = rawResumeText && rawResumeText.trim().length > 50
    ? `\n\nFULL RESUME TEXT (verbatim, for evidence verification — quote exact phrases when justifying scores):\n---\n${rawResumeText.slice(0, 14000)}\n---`
    : '';

  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are an expert ATS scoring engine used by top recruiters. Analyze the candidate resume against the job requirements carefully. Quote specific resume evidence when justifying scores. Respond with valid JSON only, no markdown.',
        },
        {
          role: 'user',
          content: `Score this candidate's resume against the job description. Be rigorous and evidence-based — only give high scores if the resume actually demonstrates the required skills/years/experience.

CRITICAL: You MUST read the FULL RESUME TEXT section below and cite specific phrases from it in your reasoning. Do NOT rely solely on the structured "CANDIDATE STRUCTURED PROFILE" — it may be incomplete or stale. The raw text is the source of truth.

Return JSON:
{
  "overall": number (0-100),
  "skills": number (0-100),
  "experience": number (0-100),
  "education": number (0-100),
  "keywords": number (0-100),
  "reasoning": "3-4 sentence explanation QUOTING specific evidence from the resume text (use direct quotes)"
}

Scoring guide:
- 90-100: Exceptional fit — every key requirement met with strong evidence
- 70-89: Solid fit — most requirements met, minor gaps
- 50-69: Partial fit — some key requirements met, notable gaps
- 30-49: Weak fit — few requirements met
- 0-29: Poor fit — most requirements missing

PENALIZE the score if:
- The structured profile says the candidate has a skill, but you cannot find evidence of it in the FULL RESUME TEXT
- The candidate's actual experience doesn't match the years claimed in the structured profile
- The candidate is missing key requirements from the job description

JOB TITLE: ${jobTitle}

JOB DESCRIPTION & REQUIREMENTS:
${fullJd}

CANDIDATE STRUCTURED PROFILE (may be incomplete — verify against raw text):
- Name: ${resume.name}
- Skills: ${resume.skills.join(', ') || '(none extracted)'}
- Experience:
${resume.experience.map(e => `  - ${e.role} at ${e.company} (${e.duration})${e.description ? ': ' + e.description : ''}`).join('\n') || '  (none extracted)'}
- Education:
${resume.education.map(e => `  - ${e.degree} from ${e.institution}${e.year ? ` (${e.year})` : ''}`).join('\n') || '  (none extracted)'}
- Summary: ${resume.summary || '(none)'}${rawTextSection}`
        }
      ],
      temperature: 0.2,
      max_tokens: 800,
    });

    const content = completion?.choices?.[0]?.message?.content || '';
    const parsed = tryParseJson(content);
    if (parsed && typeof parsed.overall === 'number') {
      return {
        overall: clamp(parsed.overall),
        skills: clamp(parsed.skills ?? fallback.skills),
        experience: clamp(parsed.experience ?? fallback.experience),
        education: clamp(parsed.education ?? fallback.education),
        keywords: clamp(parsed.keywords ?? fallback.keywords),
        reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : fallback.reasoning,
      };
    }
    return fallback;
  } catch (err) {
    console.warn('[resume-optimizer] computeMatchScore ZAI failed:', err);
    return fallback;
  }
}

/**
 * Visual Gap Analysis — REQ-AI-RES-04
 * Categorizes each JD requirement as matched (green), missing (red), or implied (yellow).
 */
export async function computeGapAnalysis(
  resume: ParsedResume,
  jobDescription: string,
  jobRequirements: string | null,
  jobTitle: string,
  rawResumeText?: string,
): Promise<GapAnalysis> {
  const fullJd = [jobTitle, jobDescription, jobRequirements || ''].filter(Boolean).join('\n\n');
  const fallback = computeFallbackGapAnalysis(resume, fullJd, rawResumeText);
  const rawTextSection = rawResumeText && rawResumeText.trim().length > 50
    ? `\n\nFULL RESUME TEXT (verbatim — search this for concrete evidence for each skill before categorizing):\n---\n${rawResumeText.slice(0, 14000)}\n---`
    : '';

  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are an expert ATS gap-analysis engine. Respond with valid JSON only, no markdown.',
        },
        {
          role: 'user',
          content: `Analyze the gap between this candidate and this job. Return JSON:
{
  "matched": [{ "skill": "...", "evidence": "..." }],
  "missing": [{ "skill": "...", "criticality": "high|medium|low" }],
  "implied": [{ "skill": "...", "evidence": "..." }]
}

"matched" = JD requirement explicitly present in resume.
"missing" = JD requirement NOT found in resume at all.
"implied" = JD requirement not explicit, but candidate's experience implies they have it (e.g., "Managed a team" implies Leadership).

JOB TITLE: ${jobTitle}

JOB DESCRIPTION:
${fullJd}

CANDIDATE SKILLS: ${resume.skills.join(', ')}

CANDIDATE EXPERIENCE:
${resume.experience.map(e => `- ${e.role} at ${e.company} (${e.duration})${e.description ? ': ' + e.description : ''}`).join('\n')}

CANDIDATE SUMMARY: ${resume.summary || '(none)'}${rawTextSection}`
        }
      ],
      temperature: 0.2,
      max_tokens: 1500,
    });

    const content = completion?.choices?.[0]?.message?.content || '';
    const parsed = tryParseJson(content);
    if (parsed && Array.isArray(parsed.matched)) {
      return {
        matched: Array.isArray(parsed.matched) ? parsed.matched : [],
        missing: Array.isArray(parsed.missing) ? parsed.missing : [],
        implied: Array.isArray(parsed.implied) ? parsed.implied : [],
      };
    }
    return fallback;
  } catch (err) {
    console.warn('[resume-optimizer] computeGapAnalysis ZAI failed:', err);
    return fallback;
  }
}

/**
 * AI Rewrite Suggestions — REQ-AI-RES-05
 * Provides inline, clickable rewrite suggestions (e.g., "Change 'Did sales' to 'Increased sales by 15% QoQ'").
 */
export async function generateRewriteSuggestions(
  resume: ParsedResume,
  jobDescription: string,
  rawResumeText?: string,
): Promise<RewriteSuggestion[]> {
  // Prefer the full raw resume text (which has the exact phrasing the
  // candidate wrote) — fall back to the structured experience entries.
  const experienceText = rawResumeText && rawResumeText.trim().length > 50
    ? rawResumeText.slice(0, 14000)
    : resume.experience
        .map(e => `${e.role} at ${e.company}: ${e.description || ''}`)
        .filter(Boolean)
        .join('\n');

  if (!experienceText.trim()) return [];

  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are an expert resume writer with 10+ years of experience coaching candidates for top tech companies. Respond with valid JSON only, no markdown.',
        },
        {
          role: 'user',
          content: `Suggest inline rewrites to improve this resume for the target job. Return JSON:
{
  "suggestions": [{
    "original": "exact text from the resume",
    "suggested": "improved version",
    "type": "quantify|action_verb|concise|keyword|grammar",
    "rationale": "why this change helps"
  }]
}

Rules:
- "original" MUST be an exact substring that appears in the resume text (copy-paste it).
- "suggested" should be more impactful (quantified, action-verb-led, or ATS-friendly).
- Provide 4-8 high-quality suggestions covering different aspects (not all the same type).
- type="quantify" = add numbers/metrics where the candidate was vague
- type="action_verb" = replace weak verbs (did, worked, helped) with strong ones (architected, spearheaded, optimized)
- type="concise" = trim wordiness
- type="keyword" = inject JD keywords naturally
- type="grammar" = fix grammar/spelling

TARGET JOB DESCRIPTION:
${jobDescription.substring(0, 3000)}

CANDIDATE RESUME (use this text for "original" fields):
${experienceText}`
        }
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const content = completion?.choices?.[0]?.message?.content || '';
    const parsed = tryParseJson(content);
    if (parsed && Array.isArray(parsed.suggestions)) {
      return parsed.suggestions.map((s: any, i: number) => ({
        id: `rw_${i}_${Date.now()}`,
        original: String(s.original || ''),
        suggested: String(s.suggested || ''),
        type: (['quantify', 'action_verb', 'concise', 'keyword', 'grammar'].includes(s.type) ? s.type : 'quantify') as RewriteSuggestion['type'],
        rationale: String(s.rationale || ''),
        accepted: false,
      }));
    }
    return [];
  } catch (err) {
    console.warn('[resume-optimizer] generateRewriteSuggestions ZAI failed:', err);
    return [];
  }
}

/**
 * AI Keyword Injection — REQ-AI-RES-06
 * Suggests missing industry-standard ATS keywords the candidate can accept with one click.
 */
export async function suggestMissingKeywords(
  resume: ParsedResume,
  jobDescription: string,
  rawResumeText?: string,
): Promise<KeywordSuggestion[]> {
  // Build a candidate-context string that lets the model VERIFY that a
  // keyword is actually missing — by searching the full resume text, not
  // just the (possibly incomplete) structured skills list.
  const candidateContext = rawResumeText && rawResumeText.trim().length > 50
    ? `CANDIDATE SKILLS (from parser): ${resume.skills.join(', ') || '(none extracted)'}\n\nFULL RESUME TEXT (search this ENTIRE text for keyword presence before suggesting — if a keyword appears anywhere, do NOT suggest it):\n${rawResumeText.slice(0, 12000)}`
    : `CANDIDATE SKILLS: ${resume.skills.join(', ') || '(none extracted)'}\nCANDIDATE EXPERIENCE: ${resume.experience.map(e => e.role + ' at ' + e.company).join(', ')}`;

  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are an ATS keyword optimization expert. Respond with valid JSON only, no markdown.',
        },
        {
          role: 'user',
          content: `Suggest ATS keywords missing from this resume that would help it pass automated screening for this job. Return JSON:
{
  "keywords": [{
    "keyword": "...",
    "category": "technical|soft_skill|industry|certification",
    "reason": "why this keyword matters for this role"
  }]
}

Rules:
- ONLY suggest keywords that are GENUINELY missing from BOTH the skills list AND the full resume text. If a keyword appears anywhere in the resume, do NOT suggest it.
- Don't suggest keywords the candidate can't honestly claim given their experience.
- Provide 4-10 keywords, ranked by impact (highest first).
- "technical" = programming language, tool, platform, framework
- "soft_skill" = leadership, communication, etc.
- "industry" = domain-specific terminology
- "certification" = industry-recognized credentials

${candidateContext}

TARGET JOB:
${jobDescription.substring(0, 3000)}`
        }
      ],
      temperature: 0.3,
      max_tokens: 1200,
    });

    const content = completion?.choices?.[0]?.message?.content || '';
    const parsed = tryParseJson(content);
    if (parsed && Array.isArray(parsed.keywords)) {
      return parsed.keywords.map((k: any) => ({
        keyword: String(k.keyword || ''),
        category: (['technical', 'soft_skill', 'industry', 'certification'].includes(k.category) ? k.category : 'technical') as KeywordSuggestion['category'],
        reason: String(k.reason || ''),
      }));
    }
    return [];
  } catch (err) {
    console.warn('[resume-optimizer] suggestMissingKeywords ZAI failed:', err);
    return [];
  }
}

/**
 * Format & Structure Feedback — REQ-AI-RES-07
 * Flags formatting issues (e.g., "dates in footer", "missing contact section").
 */
export async function analyzeFormat(
  resume: ParsedResume,
  rawResumeText: string,
): Promise<FormatFeedback[]> {
  const issues: FormatFeedback[] = [];

  // Local heuristic checks first (always run)
  if (!resume.email && !resume.phone) {
    issues.push({
      id: 'fmt_contact',
      issue: 'Missing contact information',
      suggestion: 'Add your email and phone number at the top of the resume.',
      severity: 'high',
      category: 'contact',
    });
  }
  if (!resume.summary || resume.summary.trim().length < 30) {
    issues.push({
      id: 'fmt_summary',
      issue: 'Missing or too-short professional summary',
      suggestion: 'Add a 2-3 sentence professional summary at the top.',
      severity: 'medium',
      category: 'structure',
    });
  }
  if (resume.experience.length === 0) {
    issues.push({
      id: 'fmt_exp',
      issue: 'No work experience entries detected',
      suggestion: 'Ensure each role has a clear title, company, duration, and bullet-point accomplishments.',
      severity: 'high',
      category: 'structure',
    });
  }
  const hasDurationlessExp = resume.experience.some(e => !e.duration || e.duration.trim().length < 2);
  if (hasDurationlessExp) {
    issues.push({
      id: 'fmt_dates',
      issue: 'Some experience entries are missing dates',
      suggestion: 'Move dates next to job titles (ATS parsers struggle with dates in footers).',
      severity: 'medium',
      category: 'dates',
    });
  }
  if (resume.skills.length < 5) {
    issues.push({
      id: 'fmt_skills',
      issue: 'Skills section is sparse',
      suggestion: 'List at least 8-12 relevant skills to improve ATS keyword matching.',
      severity: 'medium',
      category: 'ats_friendly',
    });
  }
  if (rawResumeText && rawResumeText.length > 5000) {
    issues.push({
      id: 'fmt_length',
      issue: 'Resume may be too long',
      suggestion: 'Aim for 1-2 pages. Trim older roles or irrelevant details.',
      severity: 'low',
      category: 'length',
    });
  }

  // If heuristic found issues, return them (don't need Z-AI for basic checks)
  if (issues.length > 0) return issues;

  // Otherwise, ask Z-AI for deeper analysis
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a resume formatting expert. Respond with valid JSON only, no markdown.',
        },
        {
          role: 'user',
          content: `Analyze this resume for formatting and structure issues. Return JSON:
{
  "issues": [{
    "issue": "...",
    "suggestion": "...",
    "severity": "high|medium|low",
    "category": "dates|contact|length|structure|ats_friendly"
  }]
}

Resume text (first 2000 chars):
${rawResumeText.substring(0, 2000)}`
        }
      ],
      temperature: 0.3,
      max_tokens: 600,
    });
    const content = completion?.choices?.[0]?.message?.content || '';
    const parsed = tryParseJson(content);
    if (parsed && Array.isArray(parsed.issues)) {
      return parsed.issues.map((iss: any, i: number) => ({
        id: `fmt_ai_${i}`,
        issue: String(iss.issue || ''),
        suggestion: String(iss.suggestion || ''),
        severity: (['high', 'medium', 'low'].includes(iss.severity) ? iss.severity : 'medium') as FormatFeedback['severity'],
        category: (['dates', 'contact', 'length', 'structure', 'ats_friendly'].includes(iss.category) ? iss.category : 'structure') as FormatFeedback['category'],
      }));
    }
  } catch (err) {
    console.warn('[resume-optimizer] analyzeFormat ZAI failed:', err);
  }
  return issues;
}

/**
 * AI-Generated Summary Options — REQ-AI-RES-08
 * If the candidate lacks a professional summary, generate 3 different options
 * based on their experience that they can select or edit.
 */
export async function generateSummaryOptions(resume: ParsedResume): Promise<string[]> {
  if (resume.experience.length === 0) return [];

  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are an expert resume writer. Respond with valid JSON only, no markdown.',
        },
        {
          role: 'user',
          content: `Generate 3 different professional summary options for this candidate. Return JSON:
{
  "summaries": ["summary 1", "summary 2", "summary 3"]
}

Rules:
- Each summary should be 2-3 sentences.
- Each should have a different tone: (1) achievement-focused, (2) skills-focused, (3) growth-focused.
- Use the candidate's actual experience and skills — do NOT invent credentials.

CANDIDATE NAME: ${resume.name}
CANDIDATE SKILLS: ${resume.skills.join(', ')}
CANDIDATE EXPERIENCE:
${resume.experience.map(e => `- ${e.role} at ${e.company} (${e.duration})`).join('\n')}
CANDIDATE EDUCATION: ${resume.education.map(e => e.degree + ' from ' + e.institution).join(', ')}`
        }
      ],
      temperature: 0.5,
      max_tokens: 600,
    });
    const content = completion?.choices?.[0]?.message?.content || '';
    const parsed = tryParseJson(content);
    if (parsed && Array.isArray(parsed.summaries)) {
      return parsed.summaries.map((s: unknown) => String(s || '')).filter(Boolean).slice(0, 3);
    }
  } catch (err) {
    console.warn('[resume-optimizer] generateSummaryOptions ZAI failed:', err);
  }
  return [];
}

/* ─── Helpers ─── */

function clamp(n: unknown): number {
  const num = typeof n === 'number' ? n : parseInt(String(n), 10);
  if (isNaN(num)) return 0;
  return Math.max(0, Math.min(100, num));
}

function tryParseJson(content: string): any {
  if (!content) return null;
  let cleaned = content.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
  try {
    return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

/**
 * Deterministic fallback for match scoring when Z-AI is unavailable.
 * Uses keyword overlap + experience-text presence heuristics.
 */
function computeFallbackMatchScore(resume: ParsedResume, fullJd: string, rawResumeText?: string): MatchScoreBreakdown {
  const jdLower = fullJd.toLowerCase();
  const jdWords = new Set(jdLower.split(/\W+/).filter((w: string) => w.length > 2));
  const resumeSkillsLower = resume.skills.map(s => s.toLowerCase());

  // Skills overlap
  const matchedSkills = resumeSkillsLower.filter(s =>
    jdLower.includes(s) || jdWords.has(s.split(/[\s/]+/)[0])
  );
  const skillsScore = resume.skills.length === 0
    ? 0
    : Math.round((matchedSkills.length / Math.max(resume.skills.length, 1)) * 100);

  // Experience (text presence) — use raw resume text when available because
  // it's much richer than the parser's structured `description` field.
  const expText = rawResumeText && rawResumeText.trim().length > 50
    ? rawResumeText.toLowerCase()
    : resume.experience.map(e => `${e.role} ${e.company} ${e.description || ''}`).join(' ').toLowerCase();
  const expKeywords = Array.from(jdWords).filter(w => expText.includes(w));
  const experienceScore = jdWords.size === 0
    ? 50
    : Math.min(100, Math.round((expKeywords.length / Math.max(jdWords.size * 0.3, 1)) * 100));

  // Education (degree presence)
  const educationScore = resume.education.length > 0 ? 80 : 40;

  // Keywords (overall JD word coverage in resume — including raw text)
  const allResumeText = (resume.skills.join(' ') + ' ' + expText + ' ' + (resume.summary || '')).toLowerCase();
  const matchedJdWords = Array.from(jdWords).filter(w => allResumeText.includes(w));
  const keywordsScore = jdWords.size === 0
    ? 50
    : Math.round((matchedJdWords.length / jdWords.size) * 100);

  const overall = Math.round(
    skillsScore * 0.4 + experienceScore * 0.3 + educationScore * 0.1 + keywordsScore * 0.2,
  );

  return {
    overall,
    skills: skillsScore,
    experience: experienceScore,
    education: educationScore,
    keywords: keywordsScore,
    reasoning: 'Heuristic score based on keyword overlap (AI unavailable).',
  };
}

function computeFallbackGapAnalysis(resume: ParsedResume, fullJd: string, rawResumeText?: string): GapAnalysis {
  const jdLower = fullJd.toLowerCase();
  const resumeSkillsLower = resume.skills.map(s => s.toLowerCase());
  // Use the raw resume text (much richer) when available — fallback to
  // structured experience entries only if the parser gave us nothing else.
  const expText = rawResumeText && rawResumeText.trim().length > 50
    ? rawResumeText.toLowerCase()
    : resume.experience.map(e => `${e.role} ${e.description || ''}`).join(' ').toLowerCase();

  // Crude skill extraction from JD: find words that look like skills
  const jdSkillCandidates = new Set<string>();
  const skillKeywords = [
    'python', 'java', 'javascript', 'typescript', 'react', 'angular', 'vue', 'node',
    'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'aws', 'azure', 'gcp', 'docker',
    'kubernetes', 'git', 'jenkins', 'ci/cd', 'leadership', 'management', 'agile', 'scrum',
    'communication', 'analytics', 'excel', 'powerbi', 'tableau', 'salesforce', 'sap',
    'marketing', 'seo', 'content', 'design', 'figma', 'photoshop',
  ];
  for (const k of skillKeywords) {
    if (jdLower.includes(k)) jdSkillCandidates.add(k);
  }

  const matched: GapAnalysis['matched'] = [];
  const missing: GapAnalysis['missing'] = [];
  const implied: GapAnalysis['implied'] = [];

  for (const skill of jdSkillCandidates) {
    if (resumeSkillsLower.some(s => s.includes(skill) || s === skill)) {
      matched.push({ skill, evidence: `Listed in skills section` });
    } else if (expText.includes(skill)) {
      matched.push({ skill, evidence: `Mentioned in experience` });
    } else if (skill === 'leadership' && expText.match(/manag|lead|direct|supervis/)) {
      implied.push({ skill, evidence: 'Management/leadership role detected in experience' });
    } else if (skill === 'communication' && expText.match(/present|wrote|writ|client|stakeholder/)) {
      implied.push({ skill, evidence: 'Communication-related activities detected' });
    } else {
      missing.push({ skill, criticality: 'medium' });
    }
  }

  return { matched, missing, implied };
}
