import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { withSchemaSync } from '@/lib/schema-sync';

/** GET /api/notes?category=personal&companyId=xxx */
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    await withSchemaSync(() => Promise.resolve());
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const companyId = searchParams.get('companyId');

    const employee = await db.employee.findFirst({ where: { userId: decoded.userId as string } });
    if (!employee) return NextResponse.json({ notes: [] });

    const where: Record<string, unknown> = { isActive: true, createdById: employee.id };
    if (category) where.category = category;
    if (companyId) where.companyId = companyId;

    const notes = await db.note.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
      include: {
        creator: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      },
    });

    const parsed = notes.map(n => ({
      ...n,
      tags: n.tags ? JSON.parse(n.tags) : [],
    }));

    return NextResponse.json({ notes: parsed });
  } catch (error) {
    console.error('GET notes error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST /api/notes — Create note */
export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { title, content, category = 'personal', color = '#3B82F6', isPinned = false, companyId, tags } = body;

    if (!title || !content) return NextResponse.json({ error: 'title and content are required' }, { status: 400 });

    const employee = await db.employee.findFirst({ where: { userId: decoded.userId as string } });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const note = await db.note.create({
      data: {
        title,
        content,
        category,
        color,
        isPinned,
        createdById: employee.id,
        companyId: companyId || employee.companyId || null,
        tags: tags ? JSON.stringify(tags) : null,
      },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error('POST notes error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** PATCH /api/notes — Update note */
export async function PATCH(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'Note id is required' }, { status: 400 });

    if (updates.tags) updates.tags = JSON.stringify(updates.tags);

    const note = await db.note.update({ where: { id }, data: updates });
    return NextResponse.json({ note });
  } catch (error) {
    console.error('PATCH notes error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** DELETE /api/notes?id=xxx */
export async function DELETE(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Note id is required' }, { status: 400 });

    const note = await db.note.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ note });
  } catch (error) {
    console.error('DELETE notes error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
