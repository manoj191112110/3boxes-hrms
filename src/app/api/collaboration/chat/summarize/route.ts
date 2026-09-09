import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * POST /api/collaboration/chat/summarize
 * Body: { roomId, summaryType?: 'daily'|'weekly'|'on_demand', periodStart?, periodEnd? }
 *
 * REQ-AI-EMP-03: Chat Summarization
 *   For Project Managers, AI generates a daily summary of unread messages
 *   across all their project channels ("Catch me up on Project Alpha").
 *
 * Uses ZAI for summarization.
 */

export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { roomId, summaryType = 'daily', periodStart, periodEnd } = body;
    if (!roomId) return NextResponse.json({ error: 'roomId is required' }, { status: 400 });

    const employee = await db.employee.findFirst({ where: { userId: decoded.userId } });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    // Verify membership
    const membership = await db.chatRoomMember.findUnique({
      where: { roomId_userId: { roomId, userId: employee.id } },
    });
    if (!membership) return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 });

    const end = periodEnd ? new Date(periodEnd) : new Date();
    const start = periodStart
      ? new Date(periodStart)
      : summaryType === 'weekly'
      ? new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)
      : new Date(end.getTime() - 24 * 60 * 60 * 1000);

    const messages = await db.chatMessage.findMany({
      where: {
        roomId,
        createdAt: { gte: start, lte: end },
        isDeleted: false,
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (messages.length === 0) {
      return NextResponse.json({
        summary: 'No messages in the selected period.',
        keyPoints: [],
        actionItems: [],
        messageCount: 0,
        periodStart: start,
        periodEnd: end,
      });
    }

    // Build transcript for the AI
    const transcript = messages
      .map((m) => `[${m.createdAt.toISOString()}] ${m.sender.firstName} ${m.sender.lastName}: ${m.body}`)
      .join('\n');

    let summaryText = '';
    let keyPoints: string[] = [];
    let actionItems: string[] = [];

    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();

      const response = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant that summarizes chat conversations. Given a transcript, produce a JSON object with:
  - "summary": 2-3 sentence summary of the conversation
  - "keyPoints": array of 3-5 key points (strings)
  - "actionItems": array of action items with owner if mentioned (strings)

Return ONLY the JSON, no other text.`,
          },
          { role: 'user', content: transcript },
        ],
        stream: false,
      });

      const content = response?.choices?.[0]?.message?.content || '';
      try {
        const parsed = JSON.parse(content);
        summaryText = parsed.summary || '';
        keyPoints = Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [];
        actionItems = Array.isArray(parsed.actionItems) ? parsed.actionItems : [];
      } catch {
        summaryText = content.substring(0, 500);
      }
    } catch (aiError) {
      console.error('AI summarize failed:', aiError);
      summaryText = `Conversation had ${messages.length} messages in the period. AI summarization unavailable.`;
    }

    // Persist the summary
    const summary = await db.chatSummary.create({
      data: {
        roomId,
        summaryType,
        periodStart: start,
        periodEnd: end,
        summaryText,
        keyPoints: JSON.stringify(keyPoints),
        actionItems: JSON.stringify(actionItems),
        mentionedUsers: JSON.stringify(Array.from(new Set(messages.map((m) => m.sender.id)))),
        generatedFor: employee.id,
        messageCount: messages.length,
      },
    });

    return NextResponse.json({
      summary: summaryText,
      keyPoints,
      actionItems,
      messageCount: messages.length,
      periodStart: start,
      periodEnd: end,
      summaryId: summary.id,
    });
  } catch (error) {
    console.error('POST chat summarize error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
