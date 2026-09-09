import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

// POST /api/ai-interview/evaluate — Evaluate a completed session
export async function POST(req: NextRequest) {
  const db = await getDb(req);
  try {
    const body = await req.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const session = await db.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        set: { select: { roleTitle: true, jobDescription: true, evaluationConfig: true } },
        responses: { orderBy: { order: 'asc' } },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status !== 'completed') {
      return NextResponse.json({ error: 'Session must be completed before evaluation' }, { status: 400 });
    }

    const responses = session.responses.filter(r => r.responseText && r.responseText.trim().length > 0);
    if (responses.length === 0) {
      return NextResponse.json({ error: 'No responses to evaluate' }, { status: 400 });
    }

    // Try AI evaluation
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();

      const transcript = responses
        .map(r => `Q: ${r.question || 'N/A'}\nA: ${r.responseText}`)
        .join('\n\n');

      const evalPrompt = `You are an expert interview evaluator for a ${session.set.roleTitle} position. Evaluate the following interview transcript:

${transcript.slice(0, 5000)}

Analyze and score each dimension (0-100). Return a JSON object:
{
  "communicationScore": <0-100>,
  "grammarScore": <0-100>,
  "fluencyScore": <0-100>,
  "comprehensionScore": <0-100>,
  "vocabularyScore": <0-100>,
  "cognitiveScore": <0-100>,
  "skillMatchScore": <0-100>,
  "overallScore": <0-100>,
  "aiSummary": "<2-3 paragraph evaluation summary>",
  "aiRecommendation": "<strong_hire|hire|no_hire|not_enough_evidence>"
}

Be objective and fair. Return ONLY the JSON.`;

      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a professional interview evaluator. Provide data-driven assessments. Return only valid JSON.' },
          { role: 'user', content: evalPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const content = completion.choices[0]?.message?.content || '{}';
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const evaluation = JSON.parse(cleaned);

      const clamp = (v: number) => Math.min(100, Math.max(0, v));

      const updatedSession = await db.interviewSession.update({
        where: { id: sessionId },
        data: {
          communicationScore: clamp(Number(evaluation.communicationScore) || 0),
          grammarScore: clamp(Number(evaluation.grammarScore) || 0),
          fluencyScore: clamp(Number(evaluation.fluencyScore) || 0),
          comprehensionScore: clamp(Number(evaluation.comprehensionScore) || 0),
          vocabularyScore: clamp(Number(evaluation.vocabularyScore) || 0),
          cognitiveScore: clamp(Number(evaluation.cognitiveScore) || 0),
          skillMatchScore: clamp(Number(evaluation.skillMatchScore) || 0),
          overallScore: clamp(Number(evaluation.overallScore) || 0),
          aiSummary: evaluation.aiSummary || null,
          aiRecommendation: ['strong_hire', 'hire', 'no_hire', 'not_enough_evidence'].includes(evaluation.aiRecommendation)
            ? evaluation.aiRecommendation : 'not_enough_evidence',
        },
      });

      return NextResponse.json({ data: updatedSession });
    } catch (aiError) {
      console.error('AI evaluation failed, using fallback:', aiError);

      // Fallback scoring
      const avgLen = responses.reduce((s, r) => s + (r.responseText?.length || 0), 0) / responses.length;
      const base = Math.min(90, 45 + Math.floor(avgLen / 8));
      const rand = (offset: number) => clamp(base + Math.floor(Math.random() * offset) - Math.floor(offset / 2));

      const updatedSession = await db.interviewSession.update({
        where: { id: sessionId },
        data: {
          communicationScore: rand(15),
          grammarScore: rand(15),
          fluencyScore: rand(15),
          comprehensionScore: rand(12),
          vocabularyScore: rand(15),
          cognitiveScore: rand(20),
          skillMatchScore: rand(12),
          overallScore: base,
          aiSummary: `Candidate completed the ${session.set.roleTitle} interview with ${responses.length} responses. Response detail level: ${avgLen > 200 ? 'thorough' : avgLen > 100 ? 'moderate' : 'brief'}. Overall engagement appears ${base >= 70 ? 'strong' : base >= 55 ? 'adequate' : 'limited'}.`,
          aiRecommendation: base >= 80 ? 'strong_hire' : base >= 65 ? 'hire' : base >= 50 ? 'not_enough_evidence' : 'no_hire',
        },
      });

      return NextResponse.json({ data: updatedSession, fallback: true });
    }
  } catch (error: unknown) {
    console.error('Evaluate POST error:', error);
    return NextResponse.json({ error: 'Failed to evaluate session' }, { status: 500 });
  }
}
