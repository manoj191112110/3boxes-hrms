import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { message, sessionId, context } = body;

    if (!message || !sessionId) {
      return NextResponse.json({ error: 'Message and sessionId are required' }, { status: 400 });
    }

    // Save user message
    await db.aIChatLog.create({
      data: {
        userId: decoded.userId as string,
        sessionId,
        role: 'user',
        message,
        source: 'chatbot',
        metadata: context ? JSON.stringify({ context }) : null,
      },
    });

    // Get conversation history for context
    const history = await db.aIChatLog.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    const systemPrompt = 'You are 3Boxes AI HRMS assistant. Help with HR queries about leave, attendance, payroll, policies, recruitment. Be helpful and professional. Keep responses concise and actionable.';

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...history.map((h) => ({
        role: h.role as 'user' | 'assistant' | 'system',
        content: h.message,
      })),
      { role: 'user' as const, content: message },
    ];

    let reply = 'I apologize, but I am currently unable to process your request. Please try again later.';

    try {
      const zai = await ZAI.create();
      const response = await zai.chat.completions.create({
        messages,
        stream: false,
      });

      if (response?.choices?.[0]?.message?.content) {
        reply = response.choices[0].message.content;
      }
    } catch (aiError) {
      console.error('AI service error:', aiError);
      // Fallback response
      const lowerMsg = message.toLowerCase();
      if (lowerMsg.includes('leave') || lowerMsg.includes('time off')) {
        reply = 'To check your leave balance, go to the Leave Management page. You can view your available leaves and submit new leave requests there. Would you like me to help with anything else?';
      } else if (lowerMsg.includes('attendance') || lowerMsg.includes('clock')) {
        reply = 'You can mark your attendance from the Attendance page. Check-in and check-out times are recorded automatically. Need help with anything else?';
      } else if (lowerMsg.includes('payslip') || lowerMsg.includes('salary') || lowerMsg.includes('payroll')) {
        reply = 'Your payslips are available in the Payroll section. You can view and download them for each month. Would you like to know anything else?';
      } else if (lowerMsg.includes('policy') || lowerMsg.includes('policies')) {
        reply = 'Company policies are available in the Documents section. You can find HR policies, IT policies, leave policies, and more. Need anything else?';
      } else {
        reply = 'I can help you with leave management, attendance, payroll, policies, and recruitment queries. What would you like to know?';
      }
    }

    // Save assistant reply
    await db.aIChatLog.create({
      data: {
        userId: decoded.userId as string,
        sessionId,
        role: 'assistant',
        message: reply,
        source: 'chatbot',
      },
    });

    return NextResponse.json({ reply, sessionId });
  } catch (error) {
    console.error('AI Chat error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
