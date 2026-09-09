import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { withSchemaSync } from '@/lib/schema-sync';

async function safeQuery<T>(fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch { return null; }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/** GET /api/support-reports — aggregate from Ticket/TicketComment models */
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    await withSchemaSync(() => Promise.resolve());

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'ticket-summary';

    if (reportType === 'ticket-summary') {
      // Fetch all tickets with category info
      const tickets = (await safeQuery(() => db.ticket.findMany({
        select: {
          id: true,
          priority: true,
          status: true,
          categoryId: true,
          category: { select: { name: true, type: true } },
          createdAt: true,
          resolvedAt: true,
          closedAt: true,
          slaDeadline: true,
          assignedAgentId: true,
          assignedAgentName: true,
          requesterId: true,
        },
      }))) ?? [];

      // Group by category
      const byCategory: Record<string, { open: number; inProgress: number; resolved: number; closed: number; cancelled: number }> = {};
      for (const t of tickets) {
        const catName = (t as any).category?.name || (t as any).category?.type || 'General';
        if (!byCategory[catName]) byCategory[catName] = { open: 0, inProgress: 0, resolved: 0, closed: 0, cancelled: 0 };
        const status = t.status || 'open';
        if (status === 'open') byCategory[catName].open++;
        else if (status === 'in_progress') byCategory[catName].inProgress++;
        else if (status === 'resolved') byCategory[catName].resolved++;
        else if (status === 'closed') byCategory[catName].closed++;
        else if (status === 'cancelled') byCategory[catName].cancelled++;
      }

      // Group by priority
      const byPriority: Record<string, number> = {};
      for (const t of tickets) {
        const p = t.priority || 'medium';
        byPriority[p] = (byPriority[p] || 0) + 1;
      }

      // Group by status
      const byStatus: Record<string, number> = {};
      for (const t of tickets) {
        const s = t.status || 'open';
        byStatus[s] = (byStatus[s] || 0) + 1;
      }

      // Monthly trend (last 6 months)
      const now = new Date();
      const monthlyTrend: Record<string, { created: number; resolved: number }> = {};
      for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyTrend[key] = { created: 0, resolved: 0 };
      }

      for (const t of tickets) {
        const createdKey = `${new Date(t.createdAt).getFullYear()}-${String(new Date(t.createdAt).getMonth() + 1).padStart(2, '0')}`;
        if (monthlyTrend[createdKey]) monthlyTrend[createdKey].created++;

        if (t.resolvedAt) {
          const resolvedKey = `${new Date(t.resolvedAt).getFullYear()}-${String(new Date(t.resolvedAt).getMonth() + 1).padStart(2, '0')}`;
          if (monthlyTrend[resolvedKey]) monthlyTrend[resolvedKey].resolved++;
        }
      }

      return NextResponse.json({
        reportType: 'ticket-summary',
        data: {
          total: tickets.length,
          byCategory,
          byPriority,
          byStatus,
          monthlyTrend,
        },
      }, { headers: corsHeaders() });
    }

    if (reportType === 'sla-compliance') {
      const tickets = (await safeQuery(() => db.ticket.findMany({
        select: {
          id: true,
          priority: true,
          status: true,
          createdAt: true,
          resolvedAt: true,
          slaDeadline: true,
        },
      }))) ?? [];

      // Calculate SLA compliance
      const withSla = tickets.filter(t => t.slaDeadline);
      const slaBreached = withSla.filter(t => {
        const resolvedAt = t.resolvedAt ? new Date(t.resolvedAt) : new Date();
        return resolvedAt > new Date(t.slaDeadline!);
      });
      const slaMet = withSla.length - slaBreached.length;
      const complianceRate = withSla.length > 0 ? Math.round((slaMet / withSla.length) * 100) : 0;

      // By priority
      const byPriority: Record<string, { total: number; breached: number; met: number; rate: number }> = {};
      for (const t of withSla) {
        const p = t.priority || 'medium';
        if (!byPriority[p]) byPriority[p] = { total: 0, breached: 0, met: 0, rate: 0 };
        byPriority[p].total++;
        const resolvedAt = t.resolvedAt ? new Date(t.resolvedAt) : new Date();
        if (resolvedAt > new Date(t.slaDeadline!)) {
          byPriority[p].breached++;
        } else {
          byPriority[p].met++;
        }
      }
      for (const p of Object.keys(byPriority)) {
        byPriority[p].rate = byPriority[p].total > 0 ? Math.round((byPriority[p].met / byPriority[p].total) * 100) : 0;
      }

      // Average resolution time
      const resolved = tickets.filter(t => t.resolvedAt && t.createdAt);
      let avgResolutionHours = 0;
      if (resolved.length > 0) {
        const totalHours = resolved.reduce((sum, t) => {
          const diff = (new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60);
          return sum + Math.max(0, diff);
        }, 0);
        avgResolutionHours = Math.round((totalHours / resolved.length) * 10) / 10;
      }

      return NextResponse.json({
        reportType: 'sla-compliance',
        data: {
          totalWithSla: withSla.length,
          slaMet,
          slaBreached: slaBreached.length,
          complianceRate,
          byPriority,
          avgResolutionHours,
        },
      }, { headers: corsHeaders() });
    }

    if (reportType === 'agent-performance') {
      const tickets = (await safeQuery(() => db.ticket.findMany({
        select: {
          id: true,
          assignedAgentId: true,
          assignedAgentName: true,
          status: true,
          priority: true,
          createdAt: true,
          resolvedAt: true,
        },
      }))) ?? [];

      // Group by agent
      const agentMap: Record<string, { name: string; assigned: number; resolved: number; open: number; avgResolutionHours: number; priorities: Record<string, number> }> = {};
      for (const t of tickets) {
        const agentId = t.assignedAgentId || 'unassigned';
        if (!agentMap[agentId]) {
          agentMap[agentId] = {
            name: t.assignedAgentName || 'Unassigned',
            assigned: 0,
            resolved: 0,
            open: 0,
            avgResolutionHours: 0,
            priorities: {},
          };
        }
        agentMap[agentId].assigned++;
        const p = t.priority || 'medium';
        agentMap[agentId].priorities[p] = (agentMap[agentId].priorities[p] || 0) + 1;

        if (t.status === 'resolved' || t.status === 'closed') {
          agentMap[agentId].resolved++;
        } else {
          agentMap[agentId].open++;
        }
      }

      // Calculate average resolution time per agent
      const resolvedTickets = tickets.filter(t => t.resolvedAt && t.createdAt && (t.status === 'resolved' || t.status === 'closed'));
      for (const t of resolvedTickets) {
        const agentId = t.assignedAgentId || 'unassigned';
        if (agentMap[agentId]) {
          // We'll compute the average differently
        }
      }

      // Recompute avg resolution hours per agent properly
      const agentResolutionTimes: Record<string, number[]> = {};
      for (const t of resolvedTickets) {
        const agentId = t.assignedAgentId || 'unassigned';
        if (!agentResolutionTimes[agentId]) agentResolutionTimes[agentId] = [];
        const hours = (new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60);
        agentResolutionTimes[agentId].push(Math.max(0, hours));
      }
      for (const agentId of Object.keys(agentResolutionTimes)) {
        const times = agentResolutionTimes[agentId];
        if (agentMap[agentId] && times.length > 0) {
          agentMap[agentId].avgResolutionHours = Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10;
        }
      }

      const agents = Object.entries(agentMap).map(([id, data]) => ({ id, ...data }));

      return NextResponse.json({
        reportType: 'agent-performance',
        data: { agents },
      }, { headers: corsHeaders() });
    }

    if (reportType === 'csat-scores') {
      // CSAT would typically come from a feedback/rating model
      // Since we don't have a dedicated CSAT model, we derive from ticket resolution
      const tickets = (await safeQuery(() => db.ticket.findMany({
        select: {
          id: true,
          status: true,
          priority: true,
          resolvedAt: true,
          createdAt: true,
          slaDeadline: true,
        },
      }))) ?? [];

      const resolved = tickets.filter(t => t.status === 'resolved' || t.status === 'closed');
      // Derive a satisfaction proxy from SLA compliance
      const resolvedWithSla = resolved.filter(t => t.slaDeadline);
      const slaMet = resolvedWithSla.filter(t => t.resolvedAt && new Date(t.resolvedAt) <= new Date(t.slaDeadline!)).length;

      // Resolution time buckets
      const buckets = { under1h: 0, under4h: 0, under8h: 0, under24h: 0, over24h: 0 };
      for (const t of resolved) {
        if (!t.resolvedAt) continue;
        const hours = (new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60);
        if (hours < 1) buckets.under1h++;
        else if (hours < 4) buckets.under4h++;
        else if (hours < 8) buckets.under8h++;
        else if (hours < 24) buckets.under24h++;
        else buckets.over24h++;
      }

      const csatScore = resolvedWithSla.length > 0 ? Math.round((slaMet / resolvedWithSla.length) * 100) : 0;

      return NextResponse.json({
        reportType: 'csat-scores',
        data: {
          totalResolved: resolved.length,
          csatScore,
          resolutionTimeBuckets: buckets,
          slaCompliantResolutions: slaMet,
          totalResolutionsWithSla: resolvedWithSla.length,
        },
      }, { headers: corsHeaders() });
    }

    return NextResponse.json({ error: 'Unknown report type. Use: ticket-summary, sla-compliance, agent-performance, csat-scores' }, { status: 400, headers: corsHeaders() });
  } catch (error) {
    console.error('GET support-reports error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
