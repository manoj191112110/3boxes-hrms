import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * GET /api/collaboration/sentiment?scope=room|team|company&scopeId=xxx&days=30
 *
 * REQ-AI-EMP-04: Sentiment Analysis
 *   AI analyzes anonymous aggregates of chat/collaboration activity to flag
 *   "Toxic Teams" or "Burnout risks" to the Tenant Admin.
 *
 * This endpoint computes sentiment scores for the given scope + period by
 * analyzing chat messages. Uses a simple keyword-based approach for the
 * MVP — can be upgraded to an AI model later.
 *
 * Returns anonymous aggregates only (privacy preserving).
 */

// Simple sentiment lexicon — replace with AI model in production
const POSITIVE_WORDS = ['great', 'excellent', 'good', 'thanks', 'appreciate', 'happy', 'love', 'well done', 'congrats', 'win', 'awesome', 'fantastic', 'perfect'];
const NEGATIVE_WORDS = ['bad', 'terrible', 'awful', 'hate', 'angry', 'frustrated', 'annoyed', 'stressed', 'overwhelmed', 'burnout', 'toxic', 'unfair', 'worst'];
const TOXIC_WORDS = ['stupid', 'idiot', 'incompetent', 'useless', 'shut up', 'fire them', 'lazy'];

export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    if (!['super_admin', 'tenant_admin', 'admin'].includes(decoded.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') || 'company';
    const scopeId = searchParams.get('scopeId');
    const days = parseInt(searchParams.get('days') || '30', 10);

    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - days * 24 * 60 * 60 * 1000);

    // Find chat rooms in scope
    let roomWhere: Record<string, unknown> = { isActive: true };
    if (scope === 'room' && scopeId) {
      roomWhere = { id: scopeId };
    } else if (scope === 'team' && scopeId) {
      roomWhere = { teamId: scopeId };
    } else if (scope === 'company' && scopeId) {
      roomWhere = { companyId: scopeId };
    }

    const rooms = await db.chatRoom.findMany({
      where: roomWhere,
      select: { id: true },
    });
    const roomIds = rooms.map((r) => r.id);

    if (roomIds.length === 0) {
      return NextResponse.json({
        scope, scopeId, periodStart, periodEnd,
        messageCount: 0, participantCount: 0,
        positivityScore: 0, negativityScore: 0, toxicityScore: 0, burnoutRiskScore: 0,
        topPositiveKeywords: [], topNegativeKeywords: [],
        alertTriggered: false,
      });
    }

    const messages = await db.chatMessage.findMany({
      where: {
        roomId: { in: roomIds },
        createdAt: { gte: periodStart, lte: periodEnd },
        isDeleted: false,
      },
      select: { body: true, senderId: true, createdAt: true },
    });

    const participantCount = new Set(messages.map((m) => m.senderId)).size;

    // Count word frequencies
    let positiveCount = 0;
    let negativeCount = 0;
    let toxicCount = 0;
    const positiveKeywords: Record<string, number> = {};
    const negativeKeywords: Record<string, number> = {};

    for (const msg of messages) {
      const lower = msg.body.toLowerCase();
      for (const w of POSITIVE_WORDS) {
        if (lower.includes(w)) {
          positiveCount++;
          positiveKeywords[w] = (positiveKeywords[w] || 0) + 1;
        }
      }
      for (const w of NEGATIVE_WORDS) {
        if (lower.includes(w)) {
          negativeCount++;
          negativeKeywords[w] = (negativeKeywords[w] || 0) + 1;
        }
      }
      for (const w of TOXIC_WORDS) {
        if (lower.includes(w)) toxicCount++;
      }
    }

    const totalMessages = messages.length || 1;
    const positivityScore = Math.round((positiveCount / totalMessages) * 100);
    const negativityScore = Math.round((negativeCount / totalMessages) * 100);
    const toxicityScore = Math.round((toxicCount / totalMessages) * 100);
    // Burnout risk = high negativity + low activity (proxy: low messages per participant)
    const messagesPerParticipant = participantCount > 0 ? totalMessages / participantCount : 0;
    const activityScore = Math.min(100, Math.round(messagesPerParticipant * 10));
    const burnoutRiskScore = Math.max(0, Math.round((negativityScore * 0.6) + ((100 - activityScore) * 0.4)));

    // Determine if alert should be triggered
    const alertTriggered = toxicityScore > 10 || burnoutRiskScore > 60 || (negativityScore > 40 && activityScore < 30);
    let alertReason: string | null = null;
    if (toxicityScore > 10) alertReason = `High toxicity score (${toxicityScore}%)`;
    else if (burnoutRiskScore > 60) alertReason = `High burnout risk (${burnoutRiskScore}%)`;
    else if (negativityScore > 40 && activityScore < 30) alertReason = `Low activity with high negativity — possible disengagement`;

    // Sort top keywords
    const topPositiveKeywords = Object.entries(positiveKeywords)
      .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => ({ keyword: k, count: v }));
    const topNegativeKeywords = Object.entries(negativeKeywords)
      .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => ({ keyword: k, count: v }));

    // Persist sentiment analysis record (anonymous — no user IDs)
    const analysis = await db.sentimentAnalysis.create({
      data: {
        scope,
        scopeId,
        periodStart,
        periodEnd,
        positivityScore,
        negativityScore,
        toxicityScore,
        burnoutRiskScore,
        messageCount: totalMessages,
        participantCount,
        topNegativeKeywords: JSON.stringify(topNegativeKeywords),
        topPositiveKeywords: JSON.stringify(topPositiveKeywords),
        alertTriggered,
        alertReason,
      },
    });

    return NextResponse.json({
      analysis,
      // Don't include user-identifiable info — only aggregates
    });
  } catch (error) {
    console.error('GET sentiment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
