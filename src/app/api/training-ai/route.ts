import { NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
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

export async function POST(request: Request) {
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const { action } = body;

    if (action === 'recommend_courses') {
      // Mock AI course recommendations
      const recommendations = [
        { id: 'r1', title: 'Advanced React Patterns', category: 'technical', level: 'advanced', duration: 12, matchScore: 95, reason: 'Based on your role and skill profile, this fills a key gap in advanced front-end architecture' },
        { id: 'r2', title: 'Leadership Essentials', category: 'leadership', level: 'intermediate', duration: 8, matchScore: 88, reason: 'Recommended for your career path to Tech Lead' },
        { id: 'r3', title: 'Cloud Architecture on AWS', category: 'technical', level: 'advanced', duration: 16, matchScore: 82, reason: 'Aligns with your team\'s cloud migration initiative' },
        { id: 'r4', title: 'Effective Communication', category: 'soft_skills', level: 'intermediate', duration: 6, matchScore: 75, reason: 'Based on 360 feedback, communication skills could be enhanced' },
      ];
      return NextResponse.json({ recommendations }, { headers: corsHeaders() });
    }

    if (action === 'course_summary') {
      const { courseId, courseTitle } = body;
      let summary = '';
      try {
        const zai = await ZAI.create();
        const response = await zai.chat.completions.create({
          messages: [
            { role: 'system', content: 'You are an AI learning assistant. Provide a concise course summary with key takeaways.' },
            { role: 'user', content: `Summarize the course: ${courseTitle || courseId}. Include: overview, key topics, target audience, and expected outcomes.` },
          ],
          stream: false,
        });
        if (response?.choices?.[0]?.message?.content) summary = response.choices[0].message.content;
      } catch {
        summary = `**Course Summary: ${courseTitle}**\n\nThis comprehensive course covers essential concepts and practical applications. Key topics include foundational theories, hands-on exercises, and real-world case studies.\n\n**Target Audience**: Mid-level professionals looking to advance their skills.\n\n**Expected Outcomes**: By completing this course, learners will gain practical expertise, industry-recognized knowledge, and the ability to apply concepts in their daily work.`;
      }
      return NextResponse.json({ summary }, { headers: corsHeaders() });
    }

    if (action === 'ai_coach_chat') {
      const { message } = body;
      let reply = '';
      try {
        const zai = await ZAI.create();
        const response = await zai.chat.completions.create({
          messages: [
            { role: 'system', content: 'You are an AI learning coach for an HRMS system. Help employees with career development, skill building, and course recommendations. Be concise and actionable.' },
            { role: 'user', content: message },
          ],
          stream: false,
        });
        if (response?.choices?.[0]?.message?.content) reply = response.choices[0].message.content;
      } catch {
        reply = 'I can help you with course recommendations, skill gap analysis, and learning path planning. What would you like to explore?';
      }
      return NextResponse.json({ reply }, { headers: corsHeaders() });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400, headers: corsHeaders() });
  } catch (error) {
    console.error('Training AI error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
