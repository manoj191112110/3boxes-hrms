import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { withSchemaSync } from '@/lib/schema-sync';

/** GET /api/kanban?boardId=xxx */
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    await withSchemaSync(() => Promise.resolve());
    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get('boardId');

    const employee = await db.employee.findFirst({ where: { userId: decoded.userId as string } });
    if (!employee) return NextResponse.json({ boards: [], cards: [] });

    // Get boards
    const boards = await db.kanbanBoard.findMany({
      where: { isActive: true, OR: [{ createdById: employee.id }, { companyId: employee.companyId }] },
      orderBy: { createdAt: 'desc' },
    });

    // Get cards for specified board or all boards
    const cardWhere: Record<string, unknown> = { isActive: true };
    if (boardId) {
      cardWhere.boardId = boardId;
    } else {
      cardWhere.boardId = { in: boards.map(b => b.id) };
    }

    const cards = await db.kanbanCard.findMany({
      where: cardWhere,
      orderBy: [{ column: 'asc' }, { order: 'asc' }],
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        board: { select: { id: true, name: true } },
      },
    });

    const parsedCards = cards.map(c => ({
      ...c,
      subtasks: c.subtasks ? JSON.parse(c.subtasks) : [],
      tags: c.tags ? JSON.parse(c.tags) : [],
    }));

    const parsedBoards = boards.map(b => ({
      ...b,
      columns: b.columns.split(',').map((s: string) => s.trim()),
    }));

    return NextResponse.json({ boards: parsedBoards, cards: parsedCards });
  } catch (error) {
    console.error('GET kanban error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST /api/kanban — Create board or card */
export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { action } = body;

    const employee = await db.employee.findFirst({ where: { userId: decoded.userId as string } });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    if (action === 'createBoard') {
      const { name, description, columns, companyId } = body;
      if (!name) return NextResponse.json({ error: 'Board name is required' }, { status: 400 });

      const board = await db.kanbanBoard.create({
        data: {
          name,
          description,
          columns: columns ? columns.join(',') : 'Backlog,To Do,In Progress,Done',
          createdById: employee.id,
          companyId: companyId || employee.companyId || null,
        },
      });

      return NextResponse.json({ board }, { status: 201 });
    }

    // Create card
    const { boardId, title, description, column = 'Backlog', priority = 'Medium', category, assignedToId, dueDate, subtasks, tags, order = 0 } = body;

    if (!boardId || !title) return NextResponse.json({ error: 'boardId and title are required' }, { status: 400 });

    const card = await db.kanbanCard.create({
      data: {
        boardId,
        title,
        description,
        column,
        priority,
        category,
        assignedToId: assignedToId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        subtasks: subtasks ? JSON.stringify(subtasks) : null,
        tags: tags ? JSON.stringify(tags) : null,
        order,
      },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      },
    });

    return NextResponse.json({ card }, { status: 201 });
  } catch (error) {
    console.error('POST kanban error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** PATCH /api/kanban — Update card (move, edit) */
export async function PATCH(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { id, boardId: _boardId, ...updates } = body;

    if (id) {
      // Update card
      if (updates.dueDate) updates.dueDate = new Date(updates.dueDate);
      if (updates.subtasks) updates.subtasks = JSON.stringify(updates.subtasks);
      if (updates.tags) updates.tags = JSON.stringify(updates.tags);

      const card = await db.kanbanCard.update({
        where: { id },
        data: updates,
        include: { assignee: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
      });
      return NextResponse.json({ card });
    }

    // Update board
    const { boardId, ...boardUpdates } = body;
    if (!boardId) return NextResponse.json({ error: 'id or boardId is required' }, { status: 400 });

    if (boardUpdates.columns) boardUpdates.columns = boardUpdates.columns.join(',');

    const board = await db.kanbanBoard.update({ where: { id: boardId }, data: boardUpdates });
    return NextResponse.json({ board });
  } catch (error) {
    console.error('PATCH kanban error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** DELETE /api/kanban?id=xxx&type=card */
export async function DELETE(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type') || 'card';
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    if (type === 'board') {
      const board = await db.kanbanBoard.update({ where: { id }, data: { isActive: false } });
      return NextResponse.json({ board });
    }

    const card = await db.kanbanCard.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ card });
  } catch (error) {
    console.error('DELETE kanban error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
