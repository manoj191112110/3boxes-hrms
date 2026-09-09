import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'surveys' or 'recognitions'
    const status = searchParams.get('status');

    // Ensure the Survey + SurveyResponse + Recognition tables exist (P0 fix)
    await ensureSchemaSynced();

    if (type === 'recognitions' || type === 'recognition') {
      const recognitions = await withSchemaSync(() =>
        db.recognition.findMany({
          where: status ? { category: status } : {},
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      );

      // Enrich with employee data
      const employeeIds = new Set<string>();
      recognitions.forEach(r => {
        employeeIds.add(r.fromId);
        employeeIds.add(r.toId);
      });

      const employees = await db.employee.findMany({
        where: { id: { in: Array.from(employeeIds) } },
        select: { id: true, firstName: true, lastName: true, avatar: true, department: { select: { name: true } } },
      });
      const empMap = new Map(employees.map(e => [e.id, e]));

      const enriched = recognitions.map(r => ({
        ...r,
        fromEmployee: empMap.get(r.fromId) || null,
        toEmployee: empMap.get(r.toId) || null,
      }));

      return NextResponse.json({ recognitions: enriched }, { headers: corsHeaders() });
    }

    // Default: return surveys
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [surveys, total] = await Promise.all([
      withSchemaSync(() =>
        db.survey.findMany({
          where,
          include: {
            _count: { select: { responses: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      ),
      withSchemaSync(() => db.survey.count({ where })),
    ]);

    return NextResponse.json({ surveys, total }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get engagement error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const body = await request.json();

    // Handle recognition creation
    if (body.action === 'recognition') {
      const { toId, type, title, message, points, isPublic, category } = body;
      if (!toId || !message) {
        return NextResponse.json({ error: 'Missing required fields: toId, message' }, { status: 400, headers: corsHeaders() });
      }

      await ensureSchemaSynced();

      const recognition = await withSchemaSync(() =>
        db.recognition.create({
          data: {
            fromId: decoded.userId as string,
            toId,
            type: type || 'kudos',
            title: title || '',
            message,
            points: points || 0,
            isPublic: isPublic !== false,
            category: category || 'general',
          },
        })
      );

      return NextResponse.json({ recognition }, { status: 201, headers: corsHeaders() });
    }

    // Handle survey response submission
    if (body.action === 'submit_response') {
      const { surveyId, answers, sentiment } = body;
      if (!surveyId || !answers) {
        return NextResponse.json({ error: 'Missing required fields: surveyId, answers' }, { status: 400, headers: corsHeaders() });
      }

      await ensureSchemaSynced();

      const response = await withSchemaSync(() =>
        db.surveyResponse.create({
          data: {
            surveyId,
            employeeId: decoded.userId as string,
            answers: typeof answers === 'string' ? answers : JSON.stringify(answers),
            sentiment: sentiment || null,
          },
        })
      );

      return NextResponse.json({ response }, { status: 201, headers: corsHeaders() });
    }

    // Default: create survey
    const { title, description, type, anonymous, targetAudience, questions, startDate, endDate } = body;
    if (!title) {
      return NextResponse.json({ error: 'Missing required field: title' }, { status: 400, headers: corsHeaders() });
    }

    await ensureSchemaSynced();

    const survey = await withSchemaSync(() =>
      db.survey.create({
        data: {
          title,
          description: description || null,
          type: type || 'pulse',
          status: 'draft',
          anonymous: anonymous !== false,
          targetAudience: targetAudience || 'all',
          questions: typeof questions === 'string' ? questions : JSON.stringify(questions || []),
          startDate: startDate ? new Date(startDate) : new Date(),
          endDate: endDate ? new Date(endDate) : null,
        },
        include: {
          _count: { select: { responses: true } },
        },
      })
    );

    return NextResponse.json({ survey }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Create engagement error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
