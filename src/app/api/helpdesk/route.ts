import { NextRequest, NextResponse } from 'next/server'
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth'

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// GET /api/helpdesk - Returns tickets with stats
export async function GET(req: NextRequest) {
  const db = await getDb(req);
  try {
    const token = getTokenFromHeaders(req);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const priority = url.searchParams.get('priority')
    const categoryId = url.searchParams.get('categoryId')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (priority) where.priority = priority
    if (categoryId) where.categoryId = categoryId

    const tickets = await db.ticket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        category: { select: { id: true, name: true, type: true } },
      },
    })

    const open = tickets.filter(t => t.status === 'open').length
    const inProgress = tickets.filter(t => t.status === 'in_progress').length
    const resolved = tickets.filter(t => t.status === 'resolved').length
    const closed = tickets.filter(t => t.status === 'closed').length

    // Transform tickets to include string category for backward compat
    const transformedTickets = tickets.map(t => {
      const { category, ...rest } = t;
      return {
        ...rest,
        category: category?.name || category?.type || rest.requesterType || 'general',
        categoryDetails: category,
      };
    });

    return NextResponse.json(
      { tickets: transformedTickets, stats: { open, inProgress, resolved, closed, total: tickets.length } },
      { headers: corsHeaders() }
    );
  } catch (error: unknown) {
    console.error('Helpdesk GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

// POST /api/helpdesk - Create a ticket (simplified)
export async function POST(req: NextRequest) {
  const db = await getDb(req);
  try {
    const token = getTokenFromHeaders(req);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const body = await req.json()
    const { requesterId, requesterType, categoryId, priority, subject, description, assignedAgentId, assignedAgentName } = body

    if (!subject) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400, headers: corsHeaders() });
    }

    // Generate ticket ID
    const lastTicket = await db.ticket.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { ticketId: true },
    });
    let nextNum = 1;
    if (lastTicket?.ticketId) {
      const match = lastTicket.ticketId.match(/TK-(\d+)/);
      if (match) nextNum = parseInt(match[1]) + 1;
    }
    const ticketId = `TK-${nextNum.toString().padStart(4, '0')}`;

    const ticket = await db.ticket.create({
      data: {
        ticketId,
        categoryId: categoryId || null,
        requesterId: requesterId || (decoded.userId as string),
        requesterType: requesterType || 'employee',
        requesterName: body.requesterName || (decoded.email as string) || 'Unknown',
        priority: priority || 'medium',
        subject,
        description: description || '',
        assignedAgentId: assignedAgentId || null,
        assignedAgentName: assignedAgentName || null,
        status: 'open',
      },
    });

    return NextResponse.json(ticket, { status: 201, headers: corsHeaders() });
  } catch (error: unknown) {
    console.error('Helpdesk POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

// PUT /api/helpdesk - Update a ticket
export async function PUT(req: NextRequest) {
  const db = await getDb(req);
  try {
    const token = getTokenFromHeaders(req);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const body = await req.json()
    const { id, ...data } = body

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400, headers: corsHeaders() });

    // Filter to only allowed fields
    const allowedFields = ['status', 'priority', 'assignedAgentId', 'assignedAgentName', 'resolutionNotes', 'categoryId', 'subject', 'description'];
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) updateData[field] = data[field];
    }

    // Handle status-specific timestamps
    if (updateData.status === 'resolved') {
      updateData.resolvedAt = new Date();
    }
    if (updateData.status === 'closed') {
      updateData.closedAt = new Date();
    }

    const ticket = await db.ticket.update({ where: { id }, data: updateData });

    return NextResponse.json(ticket, { headers: corsHeaders() });
  } catch (error: unknown) {
    console.error('Helpdesk PUT error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
