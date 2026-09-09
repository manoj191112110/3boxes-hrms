import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

// GET /api/ai-interview/sets/[id] — Get single set with questions
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const set = await db.interviewSet.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { order: 'asc' } },
        sessions: { orderBy: { createdAt: 'desc' }, take: 20 },
        invitations: { orderBy: { createdAt: 'desc' }, take: 20 },
        _count: { select: { sessions: true, invitations: true } },
      },
    });

    if (!set) {
      return NextResponse.json({ error: 'Interview set not found' }, { status: 404 });
    }

    return NextResponse.json({ data: set });
  } catch (error: unknown) {
    console.error('Interview Set GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch interview set' }, { status: 500 });
  }
}

// PUT /api/ai-interview/sets/[id] — Update set
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const set = await db.interviewSet.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.roleTitle !== undefined && { roleTitle: body.roleTitle }),
        ...(body.jobDescription !== undefined && { jobDescription: body.jobDescription }),
        ...(body.interviewMode !== undefined && { interviewMode: body.interviewMode }),
        ...(body.language !== undefined && { language: body.language }),
        ...(body.timeLimit !== undefined && { timeLimit: body.timeLimit }),
        ...(body.cvProbeDuration !== undefined && { cvProbeDuration: body.cvProbeDuration }),
        ...(body.enablePreScreening !== undefined && { enablePreScreening: body.enablePreScreening }),
        ...(body.enableProctoring !== undefined && { enableProctoring: body.enableProctoring }),
        ...(body.enableDynamicFollowUp !== undefined && { enableDynamicFollowUp: body.enableDynamicFollowUp }),
        ...(body.preScreenFilters !== undefined && { preScreenFilters: body.preScreenFilters }),
        ...(body.evaluationConfig !== undefined && { evaluationConfig: body.evaluationConfig }),
        ...(body.status !== undefined && { status: body.status }),
      },
      include: { questions: { orderBy: { order: 'asc' } } },
    });

    return NextResponse.json({ data: set });
  } catch (error: unknown) {
    console.error('Interview Set PUT error:', error);
    return NextResponse.json({ error: 'Failed to update interview set' }, { status: 500 });
  }
}

// DELETE /api/ai-interview/sets/[id] — Archive set
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const set = await db.interviewSet.update({
      where: { id },
      data: { status: 'archived' },
    });

    return NextResponse.json({ data: set });
  } catch (error: unknown) {
    console.error('Interview Set DELETE error:', error);
    return NextResponse.json({ error: 'Failed to archive interview set' }, { status: 500 });
  }
}
