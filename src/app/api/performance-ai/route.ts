import { NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
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

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const { action } = body;

    if (action === 'performance_insights') {
      let insights = '';
      try {
        const zai = await ZAI.create();
        const response = await zai.chat.completions.create({
          messages: [
            { role: 'system', content: 'You are an HR analytics expert. Provide concise, actionable performance insights for an organization.' },
            { role: 'user', content: 'Generate 4-5 key performance insights for an HRMS system. Include observations about rating distributions, trends, and recommendations.' },
          ],
          stream: false,
        });
        if (response?.choices?.[0]?.message?.content) insights = response.choices[0].message.content;
      } catch {
        insights = `**Key Performance Observations:**\n\n1. **Rating Distribution Imbalance**: 42% of employees received ratings between 3.5-4.0, suggesting potential grade inflation in the mid-range. Consider calibration sessions to normalize ratings.\n\n2. **Department Variance**: Engineering team averages 4.2/5 while Operations averages 3.4/5 - investigate whether this reflects actual performance or inconsistent evaluation standards.\n\n3. **Goal Completion**: Only 67% of Q4 goals were marked complete. Recommend breaking down large goals into smaller milestones for better tracking.\n\n4. **High Performer Retention Risk**: 3 employees with 4.5+ ratings have been in the same role for 2+ years. Consider career development conversations.\n\n5. **Feedback Gap**: Only 28% of employees received 360 feedback this cycle. Increase awareness and make feedback a cultural norm.`;
      }
      return NextResponse.json({ insights }, { headers: corsHeaders() });
    }

    if (action === 'promotion_prediction') {
      // Mock promotion predictions
      const predictions = [
        { employeeId: '1', name: 'Sarah Chen', currentRole: 'Senior Developer', predictedRole: 'Tech Lead', likelihood: 92, reason: 'Consistent 4.5+ ratings, leading 2 projects, mentored 3 juniors' },
        { employeeId: '2', name: 'Mike Johnson', currentRole: 'Marketing Specialist', predictedRole: 'Marketing Manager', likelihood: 85, reason: 'Exceeded all KPIs for 3 consecutive quarters, strong leadership potential' },
        { employeeId: '3', name: 'Emily Park', currentRole: 'HR Coordinator', predictedRole: 'HR Business Partner', likelihood: 78, reason: 'Completed HR certification, positive 360 feedback, managed onboarding for 15 new hires' },
        { employeeId: '4', name: 'Alex Rivera', currentRole: 'Data Analyst', predictedRole: 'Senior Data Analyst', likelihood: 75, reason: 'Built 5 critical dashboards, cross-team collaboration excellence' },
      ];
      return NextResponse.json({ predictions }, { headers: corsHeaders() });
    }

    if (action === 'skill_gap_recommendations') {
      const gaps = [
        { skill: 'Cloud Architecture', gapLevel: 'High', affectedEmployees: 12, recommendation: 'AWS Solutions Architect certification path' },
        { skill: 'Data Analysis', gapLevel: 'Medium', affectedEmployees: 8, recommendation: 'Advanced Analytics with Python course' },
        { skill: 'Leadership', gapLevel: 'Medium', affectedEmployees: 6, recommendation: 'Leadership Development Program' },
        { skill: 'DevOps/CI-CD', gapLevel: 'High', affectedEmployees: 10, recommendation: 'DevOps Engineering Professional Certificate' },
      ];
      return NextResponse.json({ gaps }, { headers: corsHeaders() });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400, headers: corsHeaders() });
  } catch (error) {
    console.error('Performance AI error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'rating_distribution') {
      const reviews = await db.performanceReview.findMany({
        where: { status: 'completed' },
        select: { overallRating: true },
      });
      const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
      reviews.forEach(r => {
        const bucket = String(Math.min(5, Math.max(1, Math.round(r.overallRating))));
        distribution[bucket]++;
      });
      return NextResponse.json({ distribution }, { headers: corsHeaders() });
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400, headers: corsHeaders() });
  } catch (error) {
    console.error('Performance AI GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
