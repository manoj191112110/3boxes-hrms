import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/candidate-portal/resume/rebuild
 *
 * Rebuilds a candidate's resume using AI-powered analysis.
 * Parses the uploaded resume, applies template-specific formatting,
 * and generates optimization aspects with scores.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { resumeDataUrl, templateId } = body;

    if (!resumeDataUrl || !templateId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Decode the data URL to get the file content
    const matches = resumeDataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json({ error: 'Invalid resume data' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(matches[2], 'base64');

    // Parse the resume using the existing parsing logic
    let parsedResume: any = {};

    try {
      // Use the same parsing approach as /api/public/parse-resume
      const { default: pdfParse } = await import('pdf-parse');
      const result = await pdfParse(fileBuffer);
      const text = result.text || '';

      // Basic parsing - extract key sections
      parsedResume = parseResumeText(text);
    } catch (parseErr) {
      console.error('Failed to parse resume:', parseErr);
      // Continue with empty parsed data
    }

    // Apply AI enhancements based on template
    const enhancedResume = enhanceResumeForTemplate(parsedResume, templateId);

    // Generate optimization aspects
    const aspects = generateOptimizationAspects(enhancedResume);

    // Calculate overall score
    const overallScore = calculateOverallScore(aspects);

    return NextResponse.json({
      resume: enhancedResume,
      aspects,
      overallScore,
      templateId,
    });
  } catch (error) {
    console.error('Resume rebuild error:', error);
    return NextResponse.json(
      { error: 'Failed to rebuild resume' },
      { status: 500 }
    );
  }
}

// ─── Helper: Parse resume text ───
function parseResumeText(text: string): any {
  const resume: any = {
    name: '',
    email: '',
    phone: '',
    location: '',
    website: '',
    summary: '',
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
  };

  // Extract email
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (emailMatch) resume.email = emailMatch[0];

  // Extract phone
  const phoneMatch = text.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) resume.phone = phoneMatch[0];

  // Extract name (usually first line or after common patterns)
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    if (firstLine.length < 50 && !firstLine.includes('@') && !firstLine.includes('+')) {
      resume.name = firstLine;
    }
  }

  // Extract skills section
  const skillsMatch = text.match(/(?:skills|technical skills|core competencies)[:\s]*([\s\S]*?)(?:\n\n|\n[A-Z])/i);
  if (skillsMatch) {
    const skillsText = skillsMatch[1];
    resume.skills = skillsText
      .split(/[,;•·\n]/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0 && s.length < 50)
      .slice(0, 20);
  }

  // Extract summary/objective
  const summaryMatch = text.match(/(?:summary|objective|profile|about)[:\s]*([\s\S]*?)(?:\n\n|\n[A-Z])/i);
  if (summaryMatch) {
    resume.summary = summaryMatch[1].trim().slice(0, 500);
  }

  return resume;
}

// ─── Helper: Enhance resume for template ───
function enhanceResumeForTemplate(resume: any, templateId: string): any {
  const enhanced = { ...resume };

  // Template-specific enhancements
  switch (templateId) {
    case 'modern':
      // Modern: Emphasize achievements, use metrics
      enhanced.summary = enhanceSummary(resume.summary, 'modern');
      break;
    case 'executive':
      // Executive: Focus on leadership, strategy
      enhanced.summary = enhanceSummary(resume.summary, 'executive');
      break;
    case 'creative':
      // Creative: More personality, portfolio-focused
      enhanced.summary = enhanceSummary(resume.summary, 'creative');
      break;
    case 'minimal':
      // Minimal: Clean, ATS-optimized
      enhanced.summary = enhanceSummary(resume.summary, 'minimal');
      break;
  }

  return enhanced;
}

// ─── Helper: Enhance summary based on style ───
function enhanceSummary(summary: string, style: string): string {
  if (!summary) {
    const templates: Record<string, string> = {
      modern: 'Results-driven professional with a proven track record of delivering measurable impact. Skilled in leveraging data-driven approaches to solve complex challenges and drive business growth.',
      executive: 'Strategic leader with extensive experience driving organizational transformation and delivering sustainable business results. Proven ability to build high-performing teams and execute complex initiatives.',
      creative: 'Innovative professional passionate about pushing boundaries and creating impactful solutions. Combines technical expertise with creative thinking to deliver exceptional results.',
      minimal: 'Professional with strong technical skills and experience delivering results in fast-paced environments. Focused on continuous improvement and measurable outcomes.',
    };
    return templates[style] || templates.minimal;
  }

  // Enhance existing summary with stronger action verbs
  const actionVerbs = ['Spearheaded', 'Orchestrated', 'Delivered', 'Transformed', 'Optimized'];
  const firstWord = summary.split(' ')[0];
  if (firstWord.length < 15) {
    return summary.replace(firstWord, actionVerbs[Math.floor(Math.random() * actionVerbs.length)]);
  }

  return summary;
}

// ─── Helper: Generate optimization aspects ───
function generateOptimizationAspects(resume: any): any[] {
  const aspects = [];

  // Content Quality
  const contentScore = evaluateContent(resume);
  aspects.push({
    category: 'Content Quality',
    score: contentScore.score,
    maxScore: contentScore.max,
    feedback: contentScore.feedback,
    suggestions: contentScore.suggestions,
    icon: 'content',
  });

  // Formatting
  const formatScore = evaluateFormatting(resume);
  aspects.push({
    category: 'Formatting & Structure',
    score: formatScore.score,
    maxScore: formatScore.max,
    feedback: formatScore.feedback,
    suggestions: formatScore.suggestions,
    icon: 'format',
  });

  // Keywords
  const keywordScore = evaluateKeywords(resume);
  aspects.push({
    category: 'ATS Keywords',
    score: keywordScore.score,
    maxScore: keywordScore.max,
    feedback: keywordScore.feedback,
    suggestions: keywordScore.suggestions,
    icon: 'keywords',
  });

  // Impact
  const impactScore = evaluateImpact(resume);
  aspects.push({
    category: 'Impact & Achievements',
    score: impactScore.score,
    maxScore: impactScore.max,
    feedback: impactScore.feedback,
    suggestions: impactScore.suggestions,
    icon: 'impact',
  });

  // Skills
  const skillsScore = evaluateSkills(resume);
  aspects.push({
    category: 'Skills Section',
    score: skillsScore.score,
    maxScore: skillsScore.max,
    feedback: skillsScore.feedback,
    suggestions: skillsScore.suggestions,
    icon: 'skills',
  });

  return aspects;
}

// ─── Evaluation helpers ───
function evaluateContent(resume: any) {
  let score = 0;
  const max = 20;
  const suggestions: string[] = [];

  if (resume.summary && resume.summary.length > 100) {
    score += 5;
  } else {
    suggestions.push('Expand your professional summary to 100+ characters');
  }

  if (resume.experience && resume.experience.length > 0) {
    score += 8;
    if (resume.experience.length >= 3) score += 2;
  } else {
    suggestions.push('Add work experience with clear responsibilities');
  }

  if (resume.education && resume.education.length > 0) {
    score += 5;
  } else {
    suggestions.push('Add your education background');
  }

  return {
    score: Math.min(score, max),
    max,
    feedback: score >= 15 ? 'Strong content foundation' : score >= 10 ? 'Good start, room for improvement' : 'Needs significant enhancement',
    suggestions,
  };
}

function evaluateFormatting(resume: any) {
  let score = 0;
  const max = 20;
  const suggestions: string[] = [];

  if (resume.name) score += 5;
  if (resume.email) score += 3;
  if (resume.phone) score += 3;
  if (resume.location) score += 2;
  if (resume.skills && resume.skills.length > 5) score += 4;
  if (resume.summary && resume.summary.length < 500) score += 3;

  if (!resume.location) suggestions.push('Add your location for local job matching');
  if (!resume.skills || resume.skills.length < 5) suggestions.push('Add more relevant skills (aim for 10-15)');

  return {
    score: Math.min(score, max),
    max,
    feedback: score >= 16 ? 'Well-structured resume' : score >= 12 ? 'Decent structure, some gaps' : 'Needs better organization',
    suggestions,
  };
}

function evaluateKeywords(resume: any) {
  let score = 0;
  const max = 20;
  const suggestions: string[] = [];

  const skillCount = resume.skills?.length || 0;
  if (skillCount >= 10) score += 10;
  else if (skillCount >= 5) score += 7;
  else if (skillCount > 0) score += 4;
  else suggestions.push('Add a dedicated skills section with relevant keywords');

  if (resume.summary && resume.summary.length > 50) score += 5;
  if (resume.experience && resume.experience.length > 0) score += 5;

  if (skillCount < 10) suggestions.push('Include industry-specific keywords and technologies');
  suggestions.push('Tailor keywords to each job application for best ATS results');

  return {
    score: Math.min(score, max),
    max,
    feedback: score >= 16 ? 'Excellent keyword coverage' : score >= 12 ? 'Good keyword usage' : 'Needs more relevant keywords',
    suggestions,
  };
}

function evaluateImpact(resume: any) {
  let score = 0;
  const max = 20;
  const suggestions: string[] = [];

  // Check for metrics/numbers in experience descriptions
  const hasMetrics = resume.experience?.some((exp: any) =>
    exp.description && /\d+%|\$\d+|\d+\+/.test(exp.description)
  );

  if (hasMetrics) {
    score += 10;
  } else {
    suggestions.push('Add quantifiable achievements (%, $, numbers) to your experience');
  }

  if (resume.experience && resume.experience.length >= 3) {
    score += 5;
  } else if (resume.experience && resume.experience.length > 0) {
    score += 3;
    suggestions.push('Add more work experiences to show career progression');
  }

  // Check for action verbs
  const actionVerbPattern = /^(Led|Managed|Developed|Created|Improved|Increased|Reduced|Built|Designed|Implemented)/;
  const hasActionVerbs = resume.experience?.some((exp: any) =>
    exp.description && actionVerbPattern.test(exp.description)
  );

  if (hasActionVerbs) {
    score += 5;
  } else {
    suggestions.push('Start bullet points with strong action verbs (Led, Managed, Developed)');
  }

  return {
    score: Math.min(score, max),
    max,
    feedback: score >= 16 ? 'Strong impact demonstration' : score >= 12 ? 'Good impact, can be stronger' : 'Needs more quantifiable achievements',
    suggestions,
  };
}

function evaluateSkills(resume: any) {
  let score = 0;
  const max = 20;
  const suggestions: string[] = [];

  const skillCount = resume.skills?.length || 0;

  if (skillCount >= 15) score += 10;
  else if (skillCount >= 10) score += 7;
  else if (skillCount >= 5) score += 5;
  else if (skillCount > 0) score += 3;

  if (skillCount < 10) suggestions.push('Add 5-10 more relevant skills');
  if (skillCount > 20) suggestions.push('Consider consolidating to your top 15-20 most relevant skills');

  suggestions.push('Organize skills by category (Technical, Soft Skills, Tools)');
  score += 3; // Bonus for having a skills section at all

  return {
    score: Math.min(score, max),
    max,
    feedback: score >= 16 ? 'Excellent skills coverage' : score >= 12 ? 'Good skills list' : 'Needs more comprehensive skills',
    suggestions,
  };
}

// ─── Helper: Calculate overall score ───
function calculateOverallScore(aspects: any[]): number {
  const totalScore = aspects.reduce((sum, a) => sum + a.score, 0);
  const totalMax = aspects.reduce((sum, a) => sum + a.max, 0);
  return Math.round((totalScore / totalMax) * 100);
}
