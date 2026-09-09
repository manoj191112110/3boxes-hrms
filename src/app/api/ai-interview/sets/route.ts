import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

// GET /api/ai-interview/sets — List interview sets with pagination
export async function GET(req: NextRequest) {
  const db = await getDb(req);
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const tenantId = searchParams.get('tenantId');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (tenantId) where.tenantId = tenantId;

    const [sets, total] = await Promise.all([
      db.interviewSet.findMany({
        where,
        include: {
          questions: { orderBy: { order: 'asc' } },
          _count: { select: { sessions: true, invitations: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.interviewSet.count({ where }),
    ]);

    return NextResponse.json({ data: sets, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error: unknown) {
    console.error('Interview Sets GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch interview sets' }, { status: 500 });
  }
}

// POST /api/ai-interview/sets — Create interview set
export async function POST(req: NextRequest) {
  const db = await getDb(req);
  try {
    const body = await req.json();
    const {
      title, roleTitle, jobDescription, tenantId,
      interviewMode = 'text', language = 'en', timeLimit = 30,
      cvProbeDuration = 10, enablePreScreening = true,
      enableProctoring = true, enableDynamicFollowUp = true,
      preScreenFilters, evaluationConfig, createdBy,
      questions = [],
      autoGenerate = false,
    } = body;

    if (!title || !roleTitle || !tenantId || !createdBy) {
      return NextResponse.json({ error: 'title, roleTitle, tenantId, and createdBy are required' }, { status: 400 });
    }

    let finalQuestions = questions;

    // Auto-generate questions from role/JD if requested and no questions provided
    if (autoGenerate && questions.length === 0) {
      try {
        const ZAI = (await import('z-ai-web-dev-sdk')).default;
        const zai = await ZAI.create();

        const prompt = `Generate 8 interview questions for a ${roleTitle} role.${jobDescription ? ` Job Description: ${jobDescription.slice(0, 2000)}` : ''}

Return a JSON array of objects with these fields:
- category: one of "technical", "behavioral", "situational", "cv_based", "cognitive"
- question: the interview question text
- expectedPoints: key points to look for in the answer (comma-separated)
- difficulty: one of "easy", "medium", "hard"
- duration: time in seconds for this question (number)

Make questions progressive in difficulty. Include at least 2 behavioral and 2 technical questions.
Return ONLY the JSON array, no markdown or extra text.`;

        const completion = await zai.chat.completions.create({
          messages: [
            { role: 'system', content: 'You are an expert HR interviewer. Generate high-quality interview questions. Return only valid JSON.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        });

        const content = completion.choices[0]?.message?.content || '[]';
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);

        if (Array.isArray(parsed)) {
          finalQuestions = parsed.map((q: Record<string, unknown>, i: number) => ({
            order: i + 1,
            category: q.category || 'technical',
            question: q.question || '',
            expectedPoints: q.expectedPoints || '',
            difficulty: q.difficulty || 'medium',
            duration: q.duration || 120,
            isMandatory: true,
          }));
        }
      } catch (aiError) {
        console.error('AI question generation failed, using defaults:', aiError);
        finalQuestions = generateDefaultQuestions(roleTitle);
      }
    }

    const set = await db.interviewSet.create({
      data: {
        title,
        roleTitle,
        jobDescription: jobDescription || null,
        tenantId,
        interviewMode,
        language,
        timeLimit,
        cvProbeDuration,
        enablePreScreening,
        enableProctoring,
        enableDynamicFollowUp,
        preScreenFilters: preScreenFilters || undefined,
        evaluationConfig: evaluationConfig || undefined,
        createdBy,
        status: 'draft',
        questions: {
          create: finalQuestions.map((q: Record<string, unknown>) => ({
            order: q.order as number,
            category: (q.category as string) || 'technical',
            question: q.question as string,
            expectedPoints: q.expectedPoints as string || null,
            followUpPrompts: q.followUpPrompts as string || null,
            duration: q.duration as number || null,
            isMandatory: q.isMandatory !== false,
            difficulty: (q.difficulty as string) || 'medium',
          })),
        },
      },
      include: { questions: { orderBy: { order: 'asc' } } },
    });

    return NextResponse.json({ data: set }, { status: 201 });
  } catch (error: unknown) {
    console.error('Interview Sets POST error:', error);
    return NextResponse.json({ error: 'Failed to create interview set' }, { status: 500 });
  }
}

function generateDefaultQuestions(roleTitle: string): Record<string, unknown>[] {
  return [
    { order: 1, category: 'technical', question: `Can you describe your experience with the core technologies required for a ${roleTitle} role?`, expectedPoints: 'Relevant tech stack, years of experience, project examples', difficulty: 'easy', duration: 120, isMandatory: true },
    { order: 2, category: 'technical', question: `Walk me through a complex technical challenge you faced as a ${roleTitle} and how you resolved it.`, expectedPoints: 'Problem description, approach, solution, lessons learned', difficulty: 'medium', duration: 180, isMandatory: true },
    { order: 3, category: 'behavioral', question: 'Tell me about a time when you had to work with a difficult team member. How did you handle it?', expectedPoints: 'STAR method, interpersonal skills, conflict resolution', difficulty: 'medium', duration: 150, isMandatory: true },
    { order: 4, category: 'behavioral', question: 'Describe a situation where you had to meet a tight deadline. How did you prioritize your work?', expectedPoints: 'Time management, prioritization, delivery under pressure', difficulty: 'medium', duration: 150, isMandatory: true },
    { order: 5, category: 'situational', question: `If you were hired as a ${roleTitle} and discovered a critical bug in production, what would be your first steps?`, expectedPoints: 'Incident response, communication, debugging approach', difficulty: 'hard', duration: 180, isMandatory: true },
    { order: 6, category: 'situational', question: 'How would you approach learning a completely new technology stack required for a project?', expectedPoints: 'Learning strategy, resourcefulness, adaptability', difficulty: 'easy', duration: 120, isMandatory: true },
    { order: 7, category: 'cv_based', question: 'I see from your background that you have relevant experience. Can you elaborate on your most impactful project?', expectedPoints: 'Project details, individual contribution, measurable outcomes', difficulty: 'easy', duration: 150, isMandatory: true },
    { order: 8, category: 'cognitive', question: `As a ${roleTitle}, how would you approach optimizing a system that is running 3x slower than expected?`, expectedPoints: 'Analytical thinking, systematic approach, tools knowledge', difficulty: 'hard', duration: 180, isMandatory: true },
  ];
}
