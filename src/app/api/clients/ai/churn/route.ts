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

export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    // Pull clients + their invoice payment behavior + project activity
    const clients = await db.client.findMany({
      where: clientId ? { id: clientId } : { status: 'active' },
      include: {
        invoices: { select: { id: true, status: true, dueDate: true, createdAt: true, totalAmount: true, currency: true }, orderBy: { createdAt: 'desc' }, take: 12 },
        projects: { select: { id: true, status: true, progress: true, updatedAt: true, actualHours: true, estimatedHours: true } },
      },
    });

    const results = [];
    for (const c of clients) {
      // Risk factors
      const overdueInvoices = c.invoices.filter(inv => inv.status === 'sent' || inv.status === 'overdue');
      const overdueCount = overdueInvoices.length;
      const avgDelayDays = overdueInvoices.length > 0
        ? overdueInvoices.reduce((sum, inv) => sum + Math.max(0, Math.floor((Date.now() - (inv.dueDate?.getTime() || Date.now())) / 86400000)), 0) / overdueInvoices.length
        : 0;
      const activeProjects = c.projects.filter(p => p.status === 'active').length;
      const staleProjects = c.projects.filter(p => p.updatedAt && (Date.now() - p.updatedAt.getTime()) > 45 * 86400000).length;
      const lowProgressProjects = c.projects.filter(p => p.progress < 30 && p.status === 'active').length;

      // Composite churn risk score (0..1)
      let score = 0;
      score += Math.min(0.35, overdueCount * 0.10);                 // up to 35% for multiple overdue invoices
      score += Math.min(0.30, avgDelayDays / 60 * 0.30);            // up to 30% for long payment delays
      score += Math.min(0.20, staleProjects * 0.10);                // up to 20% for stale projects
      score += Math.min(0.15, lowProgressProjects * 0.075);         // up to 15% for stalled progress
      score = Math.min(1, score);

      const riskLevel = score >= 0.6 ? 'high' : score >= 0.3 ? 'medium' : 'low';
      const factors = { overdueCount, avgDelayDays: Math.round(avgDelayDays), activeProjects, staleProjects, lowProgressProjects };
      const recommendations = riskLevel === 'high'
        ? 'Schedule executive review meeting within 7 days. Offer payment plan. Investigate project blockers.'
        : riskLevel === 'medium'
          ? 'Assign account manager to reconnect. Review recent project deliverables.'
          : 'Healthy client. Continue regular cadence.';

      const risk = await db.clientChurnRisk.create({
        data: { clientId: c.id, riskScore: score, riskLevel, factorsJson: factors, recommendations, notifiedManager: riskLevel === 'high' },
      });
      results.push({ clientId: c.id, clientName: c.name, riskLevel, riskScore: Math.round(score * 100) / 100, factors, recommendations, riskId: risk.id });
    }

    return NextResponse.json({ results, evaluatedAt: new Date().toISOString() }, { headers: corsHeaders() });
  } catch (error) { console.error('Churn prediction error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
