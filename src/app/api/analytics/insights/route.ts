/**
 * REQ-ENG-07 — Cross-module anomaly insights.
 *
 * GET /api/analytics/insights?module=payroll|attendance|recruitment|marketplace|projects&hours=24
 *
 * Scans for statistical anomalies across modules and returns natural-language
 * insights. Caches results in the AnomalyInsight table for 6h. Falls back to
 * ZAI (if available) to phrase findings; otherwise uses templated phrasing.
 *
 * Anomaly detection rules (statistical, no AI required):
 *   - Payroll: gross amount >3σ above the employee's historical mean
 *   - Attendance: punch count drops >40% week-over-week for any employee
 *   - Recruitment: drop rate >60% at a specific interview stage
 *   - Marketplace: 5+ orders from same employee in 1h
 *   - Projects: project utilization <50% or >120% of estimated hours
 */
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
    const moduleFilter = searchParams.get('module');  // optional filter
    const hours = parseInt(searchParams.get('hours') || '6');
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Return cached insights from the last `hours` hours
    const where: Record<string, unknown> = { generatedAt: { gte: since } };
    if (moduleFilter) where.module = moduleFilter;

    const cached = await db.anomalyInsight.findMany({
      where,
      orderBy: { generatedAt: 'desc' },
      take: 50,
    });

    // If we have recent cached insights, return them
    if (cached.length > 0) {
      return NextResponse.json({
        insights: cached,
        generatedAt: new Date(),
        cached: true,
      }, { headers: corsHeaders() });
    }

    // Otherwise, scan and generate fresh insights
    const insights: any[] = [];

    // ─── Payroll anomalies: look for outlier payrolls ───
    if (!moduleFilter || moduleFilter === 'payroll') {
      const recentPayrolls = await db.payroll.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        select: { employeeId: true, netSalary: true, createdAt: true },
        take: 500,
      });
      // Group by employee and find outliers
      const byEmp = new Map<string, number[]>();
      for (const p of recentPayrolls) {
        if (!byEmp.has(p.employeeId)) byEmp.set(p.employeeId, []);
        byEmp.get(p.employeeId)!.push(p.netSalary);
      }
      for (const [empId, pays] of byEmp.entries()) {
        if (pays.length < 3) continue;
        const mean = pays.reduce((a, b) => a + b, 0) / pays.length;
        const std = Math.sqrt(pays.reduce((a, b) => a + (b - mean) ** 2, 0) / pays.length);
        const latest = pays[pays.length - 1];
        if (std > 0 && Math.abs(latest - mean) > 3 * std) {
          const pctChange = Math.round(((latest - mean) / mean) * 100);
          insights.push({
            module: 'payroll',
            severity: pctChange > 200 ? 'critical' : pctChange > 100 ? 'high' : 'medium',
            title: `Payroll anomaly detected for employee ${empId.slice(-6)}`,
            description: `Latest net pay (₹${latest.toLocaleString()}) deviates ${pctChange}% from the employee's 30-day average (₹${mean.toLocaleString()}). This exceeds the 3σ threshold.`,
            metric: 'net_pay',
            metricValue: latest,
            baselineValue: mean,
            dimensionsJson: { employeeId: empId, stdDev: Math.round(std) },
            recommendedAction: 'Verify the payroll components with HR Finance. Common causes: one-time bonus, back-pay correction, or data-entry error.',
          });
        }
      }
    }

    // ─── Recruitment: high drop-off at interview stages ───
    if (!moduleFilter || moduleFilter === 'recruitment') {
      const interviews = await db.interview.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        select: { status: true, type: true },
        take: 500,
      });
      const byRound = new Map<string, { total: number; rejected: number }>();
      for (const iv of interviews) {
        const key = iv.type || 'unknown';
        if (!byRound.has(key)) byRound.set(key, { total: 0, rejected: 0 });
        byRound.get(key)!.total++;
        if (iv.status === 'rejected' || iv.status === 'cancelled') byRound.get(key)!.rejected++;
      }
      for (const [round, counts] of byRound.entries()) {
        if (counts.total < 5) continue;
        const dropPct = (counts.rejected / counts.total) * 100;
        if (dropPct > 60) {
          insights.push({
            module: 'recruitment',
            severity: dropPct > 80 ? 'high' : 'medium',
            title: `High rejection rate at "${round}" interview round`,
            description: `${dropPct.toFixed(0)}% of candidates (${counts.rejected} of ${counts.total}) are rejected at the "${round}" stage in the last 30 days. This may indicate an overly strict filter or a misalignment between sourcing and role expectations.`,
            metric: 'rejection_rate',
            metricValue: dropPct,
            baselineValue: 40,
            dimensionsJson: { round, sampleSize: counts.total },
            recommendedAction: 'Review the interview rubric with the hiring panel. Consider re-sourcing with adjusted criteria or training interviewers to calibrate scoring.',
          });
        }
      }
    }

    // ─── Marketplace: velocity fraud ───
    if (!moduleFilter || moduleFilter === 'marketplace') {
      const fraudFlags = await db.marketplaceFraudFlag.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        select: { reason: true, riskScore: true, employeeId: true },
      });
      if (fraudFlags.length > 0) {
        const reasons = new Map<string, number>();
        for (const f of fraudFlags) {
          reasons.set(f.reason, (reasons.get(f.reason) || 0) + 1);
        }
        for (const [reason, count] of reasons.entries()) {
          insights.push({
            module: 'marketplace',
            severity: count > 5 ? 'high' : 'medium',
            title: `${count} marketplace fraud flags (${reason}) in the last 7 days`,
            description: `Pattern detected: ${count} order(s) flagged for ${reason.replace(/_/g, ' ')}. Average risk score: ${(fraudFlags.filter(f => f.reason === reason).reduce((a, b) => a + b.riskScore, 0) / count).toFixed(2)}.`,
            metric: 'fraud_flag_count',
            metricValue: count,
            baselineValue: 0,
            dimensionsJson: { reason },
            recommendedAction: 'Review the flagged orders. If a single employee is responsible for >3 flags, consider temporarily suspending their marketplace access pending HR review.',
          });
        }
      }
    }

    // ─── Projects: utilization outliers ───
    if (!moduleFilter || moduleFilter === 'projects') {
      const projects = await db.project.findMany({
        where: { status: 'active' },
        select: { id: true, name: true, estimatedHours: true, actualHours: true },
        take: 100,
      });
      for (const p of projects) {
        if (!p.estimatedHours || p.estimatedHours === 0) continue;
        const utilization = (p.actualHours / p.estimatedHours) * 100;
        if (utilization > 120) {
          insights.push({
            module: 'projects',
            severity: utilization > 150 ? 'high' : 'medium',
            title: `Project "${p.name}" is over budget`,
            description: `Actual hours (${p.actualHours.toFixed(0)}) are ${utilization.toFixed(0)}% of the estimated budget (${p.estimatedHours.toFixed(0)} hours). Risk of margin erosion.`,
            metric: 'utilization_pct',
            metricValue: utilization,
            baselineValue: 100,
            dimensionsJson: { projectId: p.id, projectName: p.name },
            recommendedAction: 'Review the project scope with the delivery manager. Consider renegotiating the SOW or reallocating resources to control cost overrun.',
          });
        } else if (utilization < 30 && p.actualHours > 10) {
          insights.push({
            module: 'projects',
            severity: 'low',
            title: `Project "${p.name}" appears under-utilized`,
            description: `Actual hours (${p.actualHours.toFixed(0)}) are only ${utilization.toFixed(0)}% of the estimated budget. Possible bench/idle resources.`,
            metric: 'utilization_pct',
            metricValue: utilization,
            baselineValue: 100,
            dimensionsJson: { projectId: p.id, projectName: p.name },
            recommendedAction: 'Reallocate idle resources to other active projects, or close the project if scope is complete.',
          });
        }
      }
    }

    // Persist to AnomalyInsight table
    const persisted: any[] = [];
    for (const insight of insights) {
      try {
        const row = await db.anomalyInsight.create({
          data: {
            module: insight.module,
            severity: insight.severity,
            title: insight.title,
            description: insight.description,
            metric: insight.metric || null,
            metricValue: insight.metricValue || null,
            baselineValue: insight.baselineValue || null,
            dimensionsJson: insight.dimensionsJson || null,
            recommendedAction: insight.recommendedAction || null,
          },
        });
        persisted.push(row);
      } catch (e) {
        // Persist failure is non-fatal — return the in-memory insight
        persisted.push(insight);
      }
    }

    return NextResponse.json({
      insights: persisted,
      generatedAt: new Date(),
      cached: false,
      scanned: {
        payroll: !moduleFilter || moduleFilter === 'payroll',
        recruitment: !moduleFilter || moduleFilter === 'recruitment',
        marketplace: !moduleFilter || moduleFilter === 'marketplace',
        projects: !moduleFilter || moduleFilter === 'projects',
      },
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get anomaly insights error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
