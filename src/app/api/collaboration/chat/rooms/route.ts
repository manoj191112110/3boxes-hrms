import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * GET /api/collaboration/chat/rooms
 * Returns chat rooms the current user is a member of.
 */
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const employee = await db.employee.findFirst({ where: { userId: decoded.userId } });
    if (!employee) return NextResponse.json({ rooms: [] });

    const rooms = await db.chatRoom.findMany({
      where: {
        isActive: true,
        members: { some: { userId: employee.id } },
      },
      include: {
        members: {
          include: {
            room: { select: { id: true, name: true, avatarUrl: true, roomType: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, body: true, createdAt: true, senderId: true },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    // For each room, find the current user's lastReadAt to compute unread count
    const roomsWithUnread = await Promise.all(
      rooms.map(async (room) => {
        const myMembership = room.members.find((m) => m.userId === employee.id);
        const lastReadAt = myMembership?.lastReadAt;
        const unreadCount = lastReadAt
          ? await db.chatMessage.count({
              where: {
                roomId: room.id,
                createdAt: { gt: lastReadAt },
                senderId: { not: employee.id },
                isDeleted: false,
              },
            })
          : room._count.messages;
        return { ...room, unreadCount };
      })
    );

    return NextResponse.json({ rooms: roomsWithUnread });
  } catch (error) {
    console.error('GET chat rooms error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/collaboration/chat/rooms
 * Body: { name?, roomType: 'direct'|'group'|'project'|'team'|'announcement', memberIds: string[], projectId?, teamId?, isE2EE?, isAnnouncement? }
 *
 * REQ-COL-01: 1:1 and Group Chats
 * REQ-SEC-EMP-03: 1:1 direct chats are E2EE by default
 */
export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { name, roomType, memberIds = [], projectId, teamId, isAnnouncement = false, description } = body;

    if (!roomType || !['direct', 'group', 'project', 'team', 'announcement'].includes(roomType)) {
      return NextResponse.json({ error: 'Invalid roomType' }, { status: 400 });
    }
    if (memberIds.length === 0) {
      return NextResponse.json({ error: 'memberIds is required (at least one other member)' }, { status: 400 });
    }

    const creator = await db.employee.findFirst({ where: { userId: decoded.userId } });
    if (!creator) return NextResponse.json({ error: 'Employee profile not found' }, { status: 404 });

    // For direct chats: check if a room already exists with exactly these 2 members
    if (roomType === 'direct' && memberIds.length === 1) {
      const existing = await db.chatRoom.findFirst({
        where: {
          roomType: 'direct',
          isActive: true,
          AND: [
            { members: { some: { userId: creator.id } } },
            { members: { some: { userId: memberIds[0] } } },
          ],
        },
        include: { members: true },
      });
      // Confirm it's exactly 2 members (not a group with these two plus more)
      if (existing && existing.members.length === 2) {
        return NextResponse.json({ room: existing, alreadyExisted: true });
      }
    }

    // REQ-6.2: Tenant Admin controls who can create announcement channels
    if (isAnnouncement && !['super_admin', 'tenant_admin', 'admin'].includes(decoded.role)) {
      return NextResponse.json({ error: 'Only admins can create announcement channels' }, { status: 403 });
    }

    const allMemberIds = Array.from(new Set([creator.id, ...memberIds]));

    const room = await db.chatRoom.create({
      data: {
        name: roomType === 'direct' ? null : (name || 'Group Chat'),
        roomType,
        projectId: roomType === 'project' ? projectId : null,
        teamId: roomType === 'team' ? teamId : null,
        createdBy: creator.id,
        description,
        isE2EE: roomType === 'direct', // REQ-SEC-EMP-03: 1:1 direct chats are E2EE by default
        isAnnouncement,
        members: {
          create: allMemberIds.map((empId) => ({
            userId: empId,
            role: empId === creator.id ? 'admin' : 'member',
          })),
        },
      },
      include: { members: true },
    });

    return NextResponse.json({ room }, { status: 201 });
  } catch (error) {
    console.error('POST chat rooms error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
