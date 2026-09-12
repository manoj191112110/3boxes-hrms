import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { scanContentForPII } from '@/lib/dlp';

/**
 * GET /api/collaboration/chat/rooms/[id]/messages?cursor=<iso>&limit=50
 * Returns paginated messages for a room, newest first (cursor-based).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

    const employee = await db.employee.findFirst({ where: { userId: decoded.userId } });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    // Verify membership
    const membership = await db.chatRoomMember.findUnique({
      where: { roomId_userId: { roomId: id, userId: employee.id } },
    });
    if (!membership) return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 });

    const messages = await db.chatMessage.findMany({
      where: { roomId: id, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatar: true, email: true } },
        replies: {
          take: 100,
          orderBy: { createdAt: 'asc' },
          include: { sender: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
        },
      },
    });

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    // Update lastReadAt
    await db.chatRoomMember.update({
      where: { roomId_userId: { roomId: id, userId: employee.id } },
      data: { lastReadAt: new Date() },
    });

    return NextResponse.json({
      messages: items.reverse(), // Return in chronological order
      nextCursor,
    });
  } catch (error) {
    console.error('GET chat messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/collaboration/chat/rooms/[id]/messages
 * Body: { body, parentMessageId?, attachments?, targetLanguage? }
 *
 * REQ-COL-02: Threading via parentMessageId
 * REQ-COL-03: Detect inline actions (dates, file refs) — auto-detected on server
 * REQ-COL-04: AI Translation — translates message to targetLanguage
 * REQ-SEC-EMP-01: DLP scan — blocks PII in announcement channels
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { body: messageBody, parentMessageId, attachments, targetLanguage } = body;

    if (!messageBody || typeof messageBody !== 'string') {
      return NextResponse.json({ error: 'body is required' }, { status: 400 });
    }

    const employee = await db.employee.findFirst({ where: { userId: decoded.userId } });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    // Verify membership
    const membership = await db.chatRoomMember.findUnique({
      where: { roomId_userId: { roomId: id, userId: employee.id } },
    });
    if (!membership) return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 });

    // REQ-SEC-EMP-01: DLP scan
    const dlpResult = scanContentForPII(messageBody);
    if (dlpResult.action === 'block') {
      // Log the DLP block
      await db.dLPScanLog.create({
        data: {
          sourceType: 'chat_message',
          sourceId: id,
          userId: employee.id,
          patterns: JSON.stringify(dlpResult.patterns),
          riskScore: dlpResult.riskScore,
          action: 'block',
          reasonText: dlpResult.reason,
        },
      });
      return NextResponse.json({
        error: 'Message blocked by DLP policy',
        reason: dlpResult.reason,
        patterns: dlpResult.patterns,
      }, { status: 422 });
    }

    // REQ-COL-03: Detect inline actions (dates like "tomorrow at 3 PM")
    const detectedActions = detectInlineActions(messageBody);

    // Create message
    const message = await db.chatMessage.create({
      data: {
        roomId: id,
        senderId: employee.id,
        parentMessageId: parentMessageId || null,
        body: messageBody,
        attachments: attachments ? JSON.stringify(attachments) : null,
        detectedActions: detectedActions ? JSON.stringify(detectedActions) : null,
        dlpStatus: dlpResult.action === 'flag' ? 'flagged' : 'clean',
        dlpReason: dlpResult.action === 'flag' ? dlpResult.reason : null,
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatar: true, email: true } },
      },
    });

    // If DLP flagged, log it
    if (dlpResult.action === 'flag') {
      await db.dLPScanLog.create({
        data: {
          sourceType: 'chat_message',
          sourceId: message.id,
          userId: employee.id,
          patterns: JSON.stringify(dlpResult.patterns),
          riskScore: dlpResult.riskScore,
          action: 'flag',
          reasonText: dlpResult.reason,
        },
      });
    }

    // Update room's lastMessageAt
    await db.chatRoom.update({
      where: { id },
      data: { lastMessageAt: new Date() },
    });

    // REQ-COL-04: AI Translation (async — caller can request translation separately)
    // We don't auto-translate here to keep this endpoint fast. Translation is a
    // separate endpoint: /api/collaboration/chat/translate

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error('POST chat messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Detect inline date/time patterns in a message body.
 * REQ-COL-03: "Let's meet tomorrow at 3 PM" → calendar invite suggestion
 *
 * This is a lightweight regex-based detector. A more sophisticated NLP
 * extractor could be plugged in later.
 */
function detectInlineActions(text: string): Array<{ type: string; value: string; suggestion: string }> | null {
  const actions: Array<{ type: string; value: string; suggestion: string }> = [];

  // Date/time pattern: "tomorrow at 3 PM", "Monday 9am", "Jun 25 at 10:00"
  const dateTimeRegex = /\b(tomorrow|today|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\s+\d{1,2}(:\d{2})?\s*(am|pm)?/gi;
  let match;
  while ((match = dateTimeRegex.exec(text)) !== null) {
    actions.push({
      type: 'calendar_invite',
      value: match[0],
      suggestion: 'Create calendar invite',
    });
  }

  // File reference pattern: "see attached", "file:abc123"
  const fileRegex = /\b(see attached|attached file|file:[a-zA-Z0-9_-]+)/gi;
  while ((match = fileRegex.exec(text)) !== null) {
    actions.push({
      type: 'file_reference',
      value: match[0],
      suggestion: 'Open file in repository',
    });
  }

  return actions.length > 0 ? actions : null;
}
