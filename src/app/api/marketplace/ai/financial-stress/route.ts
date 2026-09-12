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

    const employees = await db.employee.findMany({
      where: { status: 'active' },
      select: { id: true, firstName: true, lastName: true, employeeId: true },
    });
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

    const results = [];
    for (const emp of employees) {
      const [ewaCount, loanCount, attendanceDrop] = await Promise.all([
        db.eWARequest.count({ where: { employeeId: emp.id, createdAt: { gte: thirtyDaysAgo } } }),
        db.loanMarketplaceListing.count({ where: { employeeId: emp.id, applicationStatus: { in: ['applied', 'approved', 'disbursed'] } } }),
        db.attendance.count({ where: { employeeId: emp.id, date: { gte: thirtyDaysAgo }, status: 'absent' } }),
      ]);
      let score = 0;
      score += Math.min(0.5, ewaCount * 0.15);
      score += Math.min(0.3, loanCount * 0.10);
      score += Math.min(0.2, attendanceDrop * 0.02);
      score = Math.min(1, score);
      const riskLevel = score >= 0.6 ? 'high' : score >= 0.3 ? 'medium' : 'low';
      if (riskLevel === 'low') continue; // only flag medium+
      const flag = await db.financialStressFlag.create({
        data: { employeeId: emp.id, riskScore: score, riskLevel, factorsJson: { ewaCount, loanCount, attendanceDrop }, recommendedAction: riskLevel === 'high' ? 'Offer financial counseling session' : 'Send EWA best-practices guide', notifiedHR: false, anonymized: true },
      });
      results.push({ employeeId: emp.id, employeeName: `${emp.firstName} ${emp.lastName}`, riskLevel, riskScore: Math.round(score * 100) / 100, factors: { ewaCount, loanCount, attendanceDrop }, flagId: flag.id });
    }
    return NextResponse.json({ results, evaluatedAt: now.toISOString() }, { headers: corsHeaders() });
  } catch (error) { console.error('Stress prediction error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
