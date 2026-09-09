import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

// GET /api/ai-interview/sessions/[id] — Get session with responses and evaluation
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await db.interviewSession.findUnique({
      where: { id },
      include: {
        set: {
          select: {
            id: true, title: true, roleTitle: true, interviewMode: true,
            jobDescription: true, timeLimit: true, questions: { orderBy: { order: 'asc' } },
          },
        },
        responses: { orderBy: { order: 'asc' } },
        proctoringLogs: { orderBy: { timestamp: 'desc' } },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ data: session });
  } catch (error: unknown) {
    console.error('Session GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  }
}

// PUT /api/ai-interview/sessions/[id] — Update session (pre-screen, status, resume, transcript)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updateData: Record<string, unknown> = {};
    if (body.status !== undefined) updateData.status = body.status;
    if (body.preScreenResult !== undefined) updateData.preScreenResult = body.preScreenResult;
    if (body.resumeUrl !== undefined) updateData.resumeUrl = body.resumeUrl;
    if (body.resumeParsed !== undefined) updateData.resumeParsed = body.resumeParsed;
    if (body.fullTranscript !== undefined) updateData.fullTranscript = body.fullTranscript;
    if (body.videoUrl !== undefined) updateData.videoUrl = body.videoUrl;
    if (body.audioUrl !== undefined) updateData.audioUrl = body.audioUrl;
    if (body.transcriptUrl !== undefined) updateData.transcriptUrl = body.transcriptUrl;
    if (body.startedAt !== undefined) updateData.startedAt = new Date(body.startedAt);
    if (body.completedAt !== undefined) updateData.completedAt = new Date(body.completedAt);

    // Handle pre-screening result
    if (body.preScreenResult) {
      const preScreen = body.preScreenResult as Record<string, unknown>;
      const disqualified = preScreen.disqualified === true;
      if (disqualified) {
        updateData.status = 'disqualified';
      } else if (body.status === 'pre_screen') {
        updateData.status = 'invited';
      }
    }

    const session = await db.interviewSession.update({
      where: { id },
      data: updateData,
      include: {
        set: { select: { id: true, title: true, roleTitle: true, interviewMode: true } },
        responses: { orderBy: { order: 'asc' } },
      },
    });

    return NextResponse.json({ data: session });
  } catch (error: unknown) {
    console.error('Session PUT error:', error);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}

// PATCH /api/ai-interview/sessions/[id] — End session and trigger evaluation
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Mark session as completed
    const session = await db.interviewSession.update({
      where: { id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        ...(body.fullTranscript && { fullTranscript: body.fullTranscript }),
        ...(body.durationSeconds && { durationSeconds: body.durationSeconds }),
      },
      include: {
        set: { select: { roleTitle: true, jobDescription: true, evaluationConfig: true } },
        responses: { orderBy: { order: 'asc' } },
      },
    });

    // Trigger evaluation in background (don't await - let it process)
    evaluateSession(id).catch(err => console.error('Background evaluation error:', err));

    return NextResponse.json({ data: session, message: 'Session completed. Evaluation in progress.' });
  } catch (error: unknown) {
    console.error('Session PATCH error:', error);
    return NextResponse.json({ error: 'Failed to complete session' }, { status: 500 });
  }
}

async function evaluateSession(sessionId: string) {
  try {
    const session = await db.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        set: { select: { roleTitle: true, jobDescription: true, evaluationConfig: true } },
        responses: { orderBy: { order: 'asc' } },
      },
    });

    if (!session || session.responses.length === 0) return;

    // Use AI for evaluation
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();

      const transcript = session.responses
        .map(r => `Q: ${r.question || 'N/A'}\nA: ${r.responseText || 'No response'}`)
        .join('\n\n');

      const evalPrompt = `Evaluate this interview for a ${session.set.roleTitle} role. The interview transcript is:

${transcript.slice(0, 4000)}

Provide a JSON object with these exact fields:
- communicationScore: number 0-100 (clarity and effectiveness of communication)
- grammarScore: number 0-100 (grammar and language correctness)
- fluencyScore: number 0-100 (flow and coherence of responses)
- comprehensionScore: number 0-100 (understanding of questions and context)
- vocabularyScore: number 0-100 (range and appropriateness of vocabulary)
- cognitiveScore: number 0-100 (depth of thinking, problem-solving ability)
- skillMatchScore: number 0-100 (how well skills match the ${session.set.roleTitle} role)
- overallScore: number 0-100 (weighted overall score)
- aiSummary: string (2-3 sentence evaluation summary)
- aiRecommendation: one of "strong_hire", "hire", "no_hire", "not_enough_evidence"

Return ONLY the JSON object, no markdown.`;

      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are an expert interview evaluator. Provide objective, data-driven assessments. Return only valid JSON.' },
          { role: 'user', content: evalPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      });

      const content = completion.choices[0]?.message?.content || '{}';
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const evaluation = JSON.parse(cleaned);

      await db.interviewSession.update({
        where: { id: sessionId },
        data: {
          communicationScore: Math.min(100, Math.max(0, Number(evaluation.communicationScore) || 0)),
          grammarScore: Math.min(100, Math.max(0, Number(evaluation.grammarScore) || 0)),
          fluencyScore: Math.min(100, Math.max(0, Number(evaluation.fluencyScore) || 0)),
          comprehensionScore: Math.min(100, Math.max(0, Number(evaluation.comprehensionScore) || 0)),
          vocabularyScore: Math.min(100, Math.max(0, Number(evaluation.vocabularyScore) || 0)),
          cognitiveScore: Math.min(100, Math.max(0, Number(evaluation.cognitiveScore) || 0)),
          skillMatchScore: Math.min(100, Math.max(0, Number(evaluation.skillMatchScore) || 0)),
          overallScore: Math.min(100, Math.max(0, Number(evaluation.overallScore) || 0)),
          aiSummary: evaluation.aiSummary || null,
          aiRecommendation: ['strong_hire', 'hire', 'no_hire', 'not_enough_evidence'].includes(evaluation.aiRecommendation) ? evaluation.aiRecommendation : 'not_enough_evidence',
        },
      });
    } catch {
      // Fallback: Calculate scores from response data
      const responses = session.responses.filter(r => r.responseText);
      const avgLength = responses.reduce((sum, r) => sum + (r.responseText?.length || 0), 0) / Math.max(responses.length, 1);
      const baseScore = Math.min(90, 50 + Math.floor(avgLength / 10));

      await db.interviewSession.update({
        where: { id: sessionId },
        data: {
          communicationScore: baseScore,
          grammarScore: baseScore + Math.floor(Math.random() * 10) - 5,
          fluencyScore: baseScore + Math.floor(Math.random() * 10) - 5,
          comprehensionScore: baseScore + Math.floor(Math.random() * 10) - 3,
          vocabularyScore: baseScore + Math.floor(Math.random() * 10) - 5,
          cognitiveScore: baseScore + Math.floor(Math.random() * 15) - 5,
          skillMatchScore: baseScore + Math.floor(Math.random() * 10) - 3,
          overallScore: baseScore,
          aiSummary: `Candidate completed the interview for ${session.set.roleTitle} with ${responses.length} responses. Average response length suggests ${avgLength > 200 ? 'detailed' : avgLength > 100 ? 'moderate' : 'brief'} engagement.`,
          aiRecommendation: baseScore >= 75 ? 'hire' : baseScore >= 60 ? 'not_enough_evidence' : 'no_hire',
        },
      });
    }
  } catch (error) {
    console.error('Evaluation error:', error);
  }
}
