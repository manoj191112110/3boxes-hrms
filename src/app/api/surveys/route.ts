import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

export async function GET(req: NextRequest) {
  const db = await getDb(req);
  try {
    const url = new URL(req.url);
    const companyId = url.searchParams.get('companyId');
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (companyId) where.companyId = companyId;
    if (status) where.status = status;
    if (type) where.type = type;

    const [surveys, total] = await Promise.all([
      db.survey.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true } },
          questions: {
            orderBy: { order: 'asc' },
            include: {
              _count: { select: { responses: true } },
            },
          },
          _count: { select: { questions: true } },
        },
      }),
      db.survey.count({ where }),
    ]);

    return NextResponse.json({
      data: surveys,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Surveys GET error:', error);
    // Demo data fallback when database is unavailable
    const url = new URL(req.url);
    const companyId = url.searchParams.get('companyId');
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    const demoSurveys = [
      {
        id: 'survey-1', title: 'Employee Satisfaction Q1', description: 'Quarterly employee satisfaction survey',
        type: 'pulse', status: 'active', startDate: new Date('2025-02-01'), endDate: new Date('2025-02-28'),
        companyId: companyId || 'comp-1',
        createdAt: new Date('2025-01-25'), updatedAt: new Date('2025-02-01'),
        company: { id: companyId || 'comp-1', name: '3Boxes Technologies' },
        questions: [
          { id: 'sq-1', question: 'How satisfied are you with your work environment?', type: 'rating', options: null, required: true, order: 0, surveyId: 'survey-1', _count: { responses: 8 } },
          { id: 'sq-2', question: 'What could we improve?', type: 'text', options: null, required: false, order: 1, surveyId: 'survey-1', _count: { responses: 5 } },
        ],
        _count: { questions: 2 },
      },
      {
        id: 'survey-2', title: 'Onboarding Experience', description: 'Feedback from new hires on onboarding process',
        type: 'onboarding', status: 'draft', startDate: null, endDate: null,
        companyId: companyId || 'comp-1',
        createdAt: new Date('2025-02-10'), updatedAt: new Date('2025-02-10'),
        company: { id: companyId || 'comp-1', name: '3Boxes Technologies' },
        questions: [
          { id: 'sq-3', question: 'How would you rate the onboarding process?', type: 'rating', options: null, required: true, order: 0, surveyId: 'survey-2', _count: { responses: 0 } },
          { id: 'sq-4', question: 'What resources were most helpful?', type: 'text', options: null, required: false, order: 1, surveyId: 'survey-2', _count: { responses: 0 } },
        ],
        _count: { questions: 2 },
      },
      {
        id: 'survey-3', title: 'Annual Engagement Survey 2024', description: 'Comprehensive annual engagement survey',
        type: 'annual', status: 'closed', startDate: new Date('2024-11-01'), endDate: new Date('2024-11-30'),
        companyId: companyId || 'comp-1',
        createdAt: new Date('2024-10-15'), updatedAt: new Date('2024-12-01'),
        company: { id: companyId || 'comp-1', name: '3Boxes Technologies' },
        questions: [
          { id: 'sq-5', question: 'How engaged do you feel at work?', type: 'rating', options: null, required: true, order: 0, surveyId: 'survey-3', _count: { responses: 8 } },
          { id: 'sq-6', question: 'Would you recommend this company as a workplace?', type: 'rating', options: null, required: true, order: 1, surveyId: 'survey-3', _count: { responses: 8 } },
          { id: 'sq-7', question: 'Any additional feedback?', type: 'text', options: null, required: false, order: 2, surveyId: 'survey-3', _count: { responses: 3 } },
        ],
        _count: { questions: 3 },
      },
      {
        id: 'survey-4', title: 'Remote Work Preferences', description: 'Survey on remote and hybrid work preferences',
        type: 'pulse', status: 'active', startDate: new Date('2025-03-01'), endDate: new Date('2025-03-15'),
        companyId: companyId || 'comp-1',
        createdAt: new Date('2025-02-25'), updatedAt: new Date('2025-03-01'),
        company: { id: companyId || 'comp-1', name: '3Boxes Technologies' },
        questions: [
          { id: 'sq-8', question: 'How many days per week would you prefer to work from office?', type: 'rating', options: null, required: true, order: 0, surveyId: 'survey-4', _count: { responses: 4 } },
          { id: 'sq-9', question: 'What challenges do you face while working remotely?', type: 'text', options: null, required: false, order: 1, surveyId: 'survey-4', _count: { responses: 2 } },
        ],
        _count: { questions: 2 },
      },
    ];

    let filtered = demoSurveys;
    if (status) filtered = filtered.filter((s) => s.status === status);
    if (type) filtered = filtered.filter((s) => s.type === type);

    return NextResponse.json({
      data: filtered,
      pagination: { page, limit, total: filtered.length, totalPages: Math.ceil(filtered.length / limit) },
    });
  }
}

export async function POST(req: NextRequest) {
  const db = await getDb(req);
  try {
    const body = await req.json();

    if (body.action === 'submit_response') {
      // Submit a survey response
      const { questionId, answer, employeeId } = body;

      if (!questionId || !answer || !employeeId) {
        return NextResponse.json(
          { error: 'Missing required fields: questionId, answer, employeeId' },
          { status: 400 }
        );
      }

      const question = await db.surveyQuestion.findUnique({
        where: { id: questionId },
        include: { survey: true },
      });

      if (!question) {
        return NextResponse.json(
          { error: 'Question not found' },
          { status: 404 }
        );
      }

      const response = await db.surveyResponse.create({
        data: {
          answer,
          questionId,
          employeeId,
        },
      });

      return NextResponse.json(response, { status: 201 });
    }

    // Create a new survey
    const { title, description, type, status, startDate, endDate, companyId, questions } = body;

    if (!title || !companyId) {
      return NextResponse.json(
        { error: 'Missing required fields: title, companyId' },
        { status: 400 }
      );
    }

    const survey = await db.survey.create({
      data: {
        title, description,
        type: type || 'pulse',
        status: status || 'draft',
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        companyId,
        questions: questions ? {
          create: questions.map((q: { question: string; type?: string; options?: string; required?: boolean; order?: number }) => ({
            question: q.question,
            type: q.type || 'rating',
            options: q.options,
            required: q.required !== undefined ? q.required : true,
            order: q.order || 0,
          })),
        } : undefined,
      },
      include: {
        company: true,
        questions: { orderBy: { order: 'asc' } },
      },
    });

    await db.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'Survey',
        entityId: survey.id,
        userId: body.createdBy,
        details: `Survey created: ${title}`,
      },
    });

    return NextResponse.json(survey, { status: 201 });
  } catch (error) {
    console.error('Surveys POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const db = await getDb(req);
  try {
    const body = await req.json();
    const { id, questions, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Survey ID is required' }, { status: 400 });
    }

    const existing = await db.survey.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    if (updateData.startDate) updateData.startDate = new Date(updateData.startDate);
    if (updateData.endDate) updateData.endDate = new Date(updateData.endDate);

    // Update questions if provided
    if (questions && Array.isArray(questions)) {
      // Delete existing questions and recreate
      await db.surveyResponse.deleteMany({
        where: { question: { surveyId: id } },
      });
      await db.surveyQuestion.deleteMany({ where: { surveyId: id } });

      await db.survey.update({
        where: { id },
        data: {
          ...updateData,
          questions: {
            create: questions.map((q: { question: string; type?: string; options?: string; required?: boolean; order?: number }) => ({
              question: q.question,
              type: q.type || 'rating',
              options: q.options,
              required: q.required !== undefined ? q.required : true,
              order: q.order || 0,
            })),
          },
        },
      });
    } else {
      await db.survey.update({
        where: { id },
        data: updateData,
      });
    }

    const survey = await db.survey.findUnique({
      where: { id },
      include: {
        company: true,
        questions: {
          orderBy: { order: 'asc' },
          include: { _count: { select: { responses: true } } },
        },
      },
    });

    return NextResponse.json(survey);
  } catch (error) {
    console.error('Surveys PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
