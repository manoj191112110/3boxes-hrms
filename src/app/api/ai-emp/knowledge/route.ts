import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * POST /api/ai-emp/knowledge
 * Body: { query, context? }
 *
 * REQ-AI-EMP-01: AI Knowledge Assistant ("HR Bot")
 *   Employees can ask the chat bot questions in natural language
 *   (e.g., "What is my remaining vacation balance?" or "How do I claim
 *   dental insurance?"). The AI securely authenticates the user and
 *   queries their specific data to answer.
 *
 * Uses ZAI chat completions. Falls back to keyword-based routing if AI is unavailable.
 */

const INTENT_KEYWORDS: Record<string, string[]> = {
  leave_balance: ['leave', 'vacation', 'pto', 'time off', 'balance'],
  payslip: ['payslip', 'salary', 'pay', 'payroll'],
  policy: ['policy', 'policies', 'rule', 'rules'],
  benefits: ['benefits', 'insurance', 'dental', 'medical', 'health'],
  directory: ['who is', 'find', 'contact', 'directory', 'phone number'],
  attendance: ['attendance', 'check in', 'check out', 'clock'],
};

function detectIntent(query: string): string {
  const lower = query.toLowerCase();
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return intent;
  }
  return 'general';
}

export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { query } = body;
    if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 });

    const employee = await db.employee.findFirst({
      where: { userId: decoded.userId as string },
      select: { id: true, firstName: true, lastName: true, email: true, department: { select: { name: true } } },
    });

    const intent = detectIntent(query);

    // Build context-aware system prompt
    const userContext = employee
      ? `User: ${employee.firstName} ${employee.lastName} (${employee.email}), Department: ${employee.department?.name || 'N/A'}`
      : `User ID: ${decoded.userId as string}`;

    let contextData = '';
    if (intent === 'leave_balance' && employee) {
      const balances = await db.leaveBalance.findMany({
        where: { employeeId: employee.id },
        include: { leaveType: true },
      });
      contextData = `\nLeave Balances:\n${balances.map((b) => `- ${b.leaveType.name}: ${b.remaining} days remaining (of ${b.total} total)`).join('\n')}`;
    }

    const systemPrompt = `You are the 3Boxes HRMS AI Knowledge Assistant (HR Bot). Help employees with their HR queries.
${userContext}
${contextData}

Provide accurate, concise answers. If you don't know the answer or need to access data the user didn't share, say so and direct them to the appropriate module.
Common topics: leave balance, payslips, attendance, policies, benefits, employee directory.`;

    let reply = 'I apologize, but I am currently unable to process your request. Please try again later or contact HR directly.';
    let confidenceScore: number | undefined;

    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();
      const response = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
        stream: false,
      });
      if (response?.choices?.[0]?.message?.content) {
        reply = response.choices[0].message.content;
        confidenceScore = 0.85; // ZAI doesn't expose confidence; we estimate
      }
    } catch (aiError) {
      console.error('AI knowledge assistant failed:', aiError);
      // Fallback to canned responses based on intent
      if (intent === 'leave_balance') {
        reply = 'You can view your leave balance on the Leave Management page. Click "Leave" in the sidebar to see your available days for each leave type.';
      } else if (intent === 'payslip') {
        reply = 'Your payslips are available in the Payroll section under "Payslips". You can view and download them for each month.';
      } else if (intent === 'policy') {
        reply = 'Company policies are available in the Documents section. Navigate to "Documents" in the sidebar to find HR policies, IT policies, and more.';
      } else if (intent === 'benefits') {
        reply = 'For benefits-related questions (insurance, dental, medical), please check the Documents section or contact HR directly at hr@company.com.';
      } else {
        reply = 'I can help you with leave balance, payslips, attendance, policies, and benefits. Could you please specify your question?';
      }
      confidenceScore = 0.4;
    }

    // Persist the query + response for audit + improvement
    const knowledgeQuery = await db.aIKnowledgeQuery.create({
      data: {
        userId: decoded.userId as string,
        query,
        intent,
        responseText: reply,
        contextJson: JSON.stringify({ userContext, contextData }),
        confidenceScore,
      },
    });

    return NextResponse.json({
      reply,
      intent,
      confidenceScore,
      queryId: knowledgeQuery.id,
    });
  } catch (error) {
    console.error('POST AI knowledge error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
