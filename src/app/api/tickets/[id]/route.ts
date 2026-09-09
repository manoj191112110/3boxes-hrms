import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const ticket = await db.ticket.findUnique({
      where: { id },
      include: {
        category: true,
        comments: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404, headers: corsHeaders() });
    }

    // Transform category for backward compatibility
    const { category, ...rest } = ticket;
    const transformedTicket = {
      ...rest,
      category: category?.name || category?.type || rest.requesterType || 'general',
      categoryDetails: category,
    };

    return NextResponse.json({ ticket: transformedTicket }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get ticket error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();
    const { status, assignedAgentId, assignedAgentName, resolutionNotes } = body;

    const existing = await db.ticket.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404, headers: corsHeaders() });
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (assignedAgentId !== undefined) updateData.assignedAgentId = assignedAgentId;
    if (assignedAgentName !== undefined) updateData.assignedAgentName = assignedAgentName;
    if (resolutionNotes !== undefined) updateData.resolutionNotes = resolutionNotes;

    // Handle status-specific timestamps
    if (status === 'resolved') {
      updateData.resolvedAt = new Date();
      if (resolutionNotes) updateData.resolutionNotes = resolutionNotes;
    }
    if (status === 'closed') {
      updateData.closedAt = new Date();
      if (!existing.resolvedAt) updateData.resolvedAt = new Date();
    }

    const ticket = await db.ticket.update({
      where: { id },
      data: updateData,
      include: { category: true },
    });

    // Notify requester on status change (wrapped in try-catch to prevent crashes)
    if (status && status !== existing.status && decoded.tenantId) {
      try {
        // Try to find the requester's user record
        const requesterUser = await db.user.findFirst({
          where: { id: existing.requesterId },
        });

        if (requesterUser) {
          const { createNotification } = await import('@/lib/notifications');
          await createNotification({
            tenantId: decoded.tenantId as string,
            userId: requesterUser.id,
            title: 'Ticket Status Updated',
            message: `Ticket ${existing.ticketId} status changed to ${status}.`,
            type: status === 'resolved' || status === 'closed' ? 'success' : 'info',
            category: 'alert',
            link: `/helpdesk`,
          });
        }
      } catch (notifErr) {
        console.error('Failed to send ticket status notification (non-fatal):', notifErr);
        // Continue - notification failure should not break the ticket update
      }
    }

    try {
      await db.auditLog.create({
        data: {
          userId: decoded.userId as string,
          action: 'UPDATE_TICKET',
          module: 'tickets',
          details: `Updated ticket ${existing.ticketId}: ${JSON.stringify(updateData)}`,
        },
      });
    } catch (auditErr) {
      console.error('Failed to create audit log (non-fatal):', auditErr);
    }

    return NextResponse.json({ ticket }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Patch ticket error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();

    const existing = await db.ticket.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404, headers: corsHeaders() });
    }

    const updateData: Record<string, unknown> = {};
    const fields = ['subject', 'description', 'priority', 'categoryId', 'attachments', 'tags'];
    for (const field of fields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    const ticket = await db.ticket.update({
      where: { id },
      data: updateData,
      include: { category: true },
    });

    try {
      await db.auditLog.create({
        data: {
          userId: decoded.userId as string,
          action: 'UPDATE_TICKET',
          module: 'tickets',
          details: `Updated ticket ${existing.ticketId}`,
        },
      });
    } catch (auditErr) {
      console.error('Failed to create audit log (non-fatal):', auditErr);
    }

    return NextResponse.json({ ticket }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Update ticket error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const existing = await db.ticket.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404, headers: corsHeaders() });
    }

    // Delete comments first, then the ticket
    await db.ticketComment.deleteMany({ where: { ticketId: id } });
    await db.ticket.delete({ where: { id } });

    try {
      await db.auditLog.create({
        data: {
          userId: decoded.userId as string,
          action: 'DELETE_TICKET',
          module: 'tickets',
          details: `Deleted ticket ${existing.ticketId}`,
        },
      });
    } catch (auditErr) {
      console.error('Failed to create audit log (non-fatal):', auditErr);
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Delete ticket error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
