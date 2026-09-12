import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/** GET /api/collaboration/reports?type=chat-activity&period=30d */
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'chat-activity';
    const period = searchParams.get('period') || '30d';

    const employee = await db.employee.findFirst({ where: { userId: decoded.userId } });
    if (!employee) return NextResponse.json({ report: null });

    // Calculate period start
    const periodDays = parseInt(period) || 30;
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);

    let report: Record<string, unknown> = { type, period: `${periodDays}d`, generatedAt: new Date().toISOString() };

    if (type === 'chat-activity') {
      const [totalMessages, totalRooms, recentMessages] = await Promise.all([
        db.chatMessage.count({ where: { createdAt: { gte: periodStart }, isDeleted: false } }),
        db.chatRoom.count({ where: { isActive: true } }),
        db.chatMessage.findMany({
          where: { createdAt: { gte: periodStart }, isDeleted: false },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { sender: { select: { firstName: true, lastName: true } }, room: { select: { name: true, roomType: true } } },
        }),
      ]);

      // Messages per day (last 7 days)
      const dailyActivity: { date: string; count: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const dayStart = new Date();
        dayStart.setDate(dayStart.getDate() - i);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        const count = await db.chatMessage.count({
          where: { createdAt: { gte: dayStart, lt: dayEnd }, isDeleted: false },
        });
        dailyActivity.push({ date: dayStart.toISOString().split('T')[0], count });
      }

      report = {
        ...report,
        totalMessages,
        totalRooms,
        dailyActivity,
        recentMessages: recentMessages.map(m => ({
          id: m.id,
          body: m.body.substring(0, 100),
          sender: `${m.sender.firstName} ${m.sender.lastName}`,
          room: m.room.name || m.room.roomType,
          createdAt: m.createdAt,
        })),
      };
    } else if (type === 'call-analytics') {
      const [totalCalls, completedCalls, missedCalls, avgDuration] = await Promise.all([
        db.callLog.count({ where: { startedAt: { gte: periodStart } } }),
        db.callLog.count({ where: { startedAt: { gte: periodStart }, status: 'completed' } }),
        db.callLog.count({ where: { startedAt: { gte: periodStart }, status: 'missed' } }),
        db.callLog.aggregate({ where: { startedAt: { gte: periodStart }, status: 'completed', durationSec: { not: null } }, _avg: { durationSec: true } }),
      ]);

      // Calls per day
      const dailyCalls: { date: string; count: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const dayStart = new Date();
        dayStart.setDate(dayStart.getDate() - i);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        const count = await db.callLog.count({ where: { startedAt: { gte: dayStart, lt: dayEnd } } });
        dailyCalls.push({ date: dayStart.toISOString().split('T')[0], count });
      }

      report = {
        ...report,
        totalCalls,
        completedCalls,
        missedCalls,
        avgDurationSec: Math.round(avgDuration._avg.durationSec || 0),
        dailyCalls,
      };
    } else if (type === 'productivity') {
      const [totalTodos, completedTodos, overdueTodos, totalNotes, totalFiles] = await Promise.all([
        db.todoTask.count({ where: { isActive: true } }),
        db.todoTask.count({ where: { isActive: true, status: 'Completed' } }),
        db.todoTask.count({ where: { isActive: true, status: 'Overdue' } }),
        db.note.count({ where: { isActive: true } }),
        db.fileNode.count({ where: { isActive: true, nodeType: 'file' } }),
      ]);

      report = {
        ...report,
        totalTodos,
        completedTodos,
        overdueTodos,
        todoCompletionRate: totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0,
        totalNotes,
        totalFiles,
      };
    }

    return NextResponse.json({ report });
  } catch (error) {
    console.error('GET collaboration reports error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
