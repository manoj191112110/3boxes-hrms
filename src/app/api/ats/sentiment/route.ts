import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

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

interface SentimentResult {
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  engagementScore: number; // 0..100
  dropoffRisk: number; // 0..100
  rationale: string;
}

const VALID_SENTIMENTS = new Set(['positive', 'neutral', 'negative', 'mixed']);
const VALID_SOURCES = new Set(['chat_screening', 'video_interview', 'email_response', 'manual']);

function clamp(n: unknown, def = 50): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return def;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function buildSentimentPrompt(candidateName: string, source: string, text: string): string {
  return `You are a candidate engagement analyzer for an HR system.
Analyze the following text from candidate "${candidateName}" (source: ${source}).

Assess:
- sentiment: one of "positive", "neutral", "negative", "mixed"
- engagementScore: 0..100 (responsiveness, enthusiasm, follow-through)
- dropoffRisk: 0..100 (likelihood of ghosting / withdrawal — higher = more likely to drop)
- rationale: 1-2 sentences explaining the scores

Return ONLY a valid JSON object — no markdown, no commentary:
{
  "sentiment": "positive|neutral|negative|mixed",
  "engagementScore": 75,
  "dropoffRisk": 20,
  "rationale": "..."
}

Candidate text:
---
${text.slice(0, 8000)}
---`;
}

function localFallbackSentiment(text: string): SentimentResult {
  // Crude keyword-based fallback
  const positiveWords = ['excited', 'interested', 'looking forward', 'great', 'love', 'happy', 'thank', 'appreciate', 'enthusiastic', 'ready'];
  const negativeWords = ['not interested', 'unfortunately', 'sorry', 'withdraw', 'cancel', 'no longer', 'decline', 'concerned', 'disappointed', 'frustrated'];

  const lower = text.toLowerCase();
  let pos = 0, neg = 0;
  for (const w of positiveWords) if (lower.includes(w)) pos++;
  for (const w of negativeWords) if (lower.includes(w)) neg++;

  let sentiment: SentimentResult['sentiment'];
  if (pos > 0 && neg > 0) sentiment = 'mixed';
  else if (pos > 0) sentiment = 'positive';
  else if (neg > 0) sentiment = 'negative';
  else sentiment = 'neutral';

  const engagementScore = Math.max(10, Math.min(95, 50 + pos * 12 - neg * 18));
  const dropoffRisk = Math.max(5, Math.min(95, 50 - pos * 10 + neg * 22));

  return {
    sentiment,
    engagementScore,
    dropoffRisk,
    rationale: `Local keyword analysis (positive signals: ${pos}, negative signals: ${neg}).`,
  };
}

function tryParseSentiment(content: string): SentimentResult | null {
  if (!content) return null;
  let cleaned = content.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    if (!VALID_SENTIMENTS.has(parsed?.sentiment)) return null;
    return {
      sentiment: parsed.sentiment,
      engagementScore: clamp(parsed.engagementScore, 50),
      dropoffRisk: clamp(parsed.dropoffRisk, 50),
      rationale: typeof parsed.rationale === 'string' ? parsed.rationale : '',
    };
  } catch {
    return null;
  }
}

/**
 * POST /api/ats/sentiment
 * Body: { jobApplicationId, source, messageText? }
 *
 * Calls ZAI on the candidate's chat messages / video transcript (provided
 * directly via messageText, or auto-collected from related Interview records
 * when messageText is omitted).
 */
export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });
    }

    const body = await request.json();
    const { jobApplicationId, source, messageText } = body || {};

    if (!jobApplicationId) {
      return NextResponse.json(
        { error: 'jobApplicationId is required' },
        { status: 400, headers: corsHeaders() },
      );
    }

    const finalSource = VALID_SOURCES.has(source) ? source : 'chat_screening';

    const application = await db.jobApplication.findUnique({
      where: { id: jobApplicationId },
      select: { id: true, candidateName: true, candidateEmail: true, notes: true },
    });
    if (!application) {
      return NextResponse.json({ error: 'Job application not found' }, { status: 404, headers: corsHeaders() });
    }

    // Gather text for sentiment analysis
    let textToAnalyze = (typeof messageText === 'string' && messageText.trim()) || '';
    if (!textToAnalyze) {
      // Pull together whatever candidate-generated text we have:
      //  - application.notes (if any)
      //  - related Interview.aiFeedback (which accumulates chat transcripts)
      const parts: string[] = [];
      if (application.notes) parts.push(`Application notes: ${application.notes}`);
      try {
        const interviews = await db.interview.findMany({
          where: { jobApplicationId },
          select: { aiFeedback: true, feedback: true },
          take: 10,
        });
        (interviews || []).forEach((iv, i) => {
          if (iv.aiFeedback) parts.push(`Interview ${i + 1} AI transcript:\n${iv.aiFeedback}`);
          if (iv.feedback) parts.push(`Interview ${i + 1} feedback:\n${iv.feedback}`);
        });
      } catch { /* ignore */ }
      textToAnalyze = parts.join('\n\n').trim();
    }

    if (!textToAnalyze || textToAnalyze.length < 10) {
      return NextResponse.json(
        {
          error: 'No candidate text available for sentiment analysis. Pass messageText or attach an interview transcript first.',
        },
        { status: 400, headers: corsHeaders() },
      );
    }

    // Run sentiment analysis via ZAI (with local fallback)
    let result: SentimentResult;
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a strict JSON-only candidate sentiment analyzer.' },
          { role: 'user', content: buildSentimentPrompt(application.candidateName, finalSource, textToAnalyze) },
        ],
        temperature: 0.2,
        max_tokens: 400,
      });
      const content = completion?.choices?.[0]?.message?.content || '';
      const parsed = tryParseSentiment(content);
      result = parsed || localFallbackSentiment(textToAnalyze);
    } catch (err) {
      console.warn('[sentiment] ZAI call failed, using local fallback:', err);
      result = localFallbackSentiment(textToAnalyze);
    }

    // Persist the CandidateSentimentScore row
    const saved = await db.candidateSentimentScore.create({
      data: {
        jobApplicationId,
        sentiment: result.sentiment,
        engagementScore: result.engagementScore,
        dropoffRisk: result.dropoffRisk,
        rationale: result.rationale,
        source: finalSource,
      },
    });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'SCORE_CANDIDATE_SENTIMENT',
        module: 'ats',
        details: `Sentiment for application ${jobApplicationId}: ${result.sentiment} (engagement=${result.engagementScore}, dropoff=${result.dropoffRisk})`,
      },
    }).catch(() => { /* non-critical */ });

    return NextResponse.json(
      {
        id: saved.id,
        sentiment: saved.sentiment,
        engagementScore: saved.engagementScore,
        dropoffRisk: saved.dropoffRisk,
        rationale: saved.rationale,
        source: saved.source,
        createdAt: saved.createdAt,
      },
      { status: 201, headers: corsHeaders() },
    );
  } catch (error) {
    console.error('sentiment POST error:', error);
    return NextResponse.json(
      { error: 'Failed to compute candidate sentiment' },
      { status: 500, headers: corsHeaders() },
    );
  }
}

/**
 * GET /api/ats/sentiment?jobApplicationId=...
 * Returns the latest CandidateSentimentScore for a given application.
 */
export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });
    }

    const { searchParams } = new URL(request.url);
    const jobApplicationId = searchParams.get('jobApplicationId');

    if (!jobApplicationId) {
      return NextResponse.json(
        { error: 'jobApplicationId query param is required' },
        { status: 400, headers: corsHeaders() },
      );
    }

    const latest = await db.candidateSentimentScore.findFirst({
      where: { jobApplicationId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      { sentiment: latest || null },
      { headers: corsHeaders() },
    );
  } catch (error) {
    console.error('sentiment GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sentiment' },
      { status: 500, headers: corsHeaders() },
    );
  }
}
