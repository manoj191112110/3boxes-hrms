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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const { id } = await params;
    const sow = await db.sOW.findUnique({ where: { id }, include: { client: true } });
    if (!sow) return NextResponse.json({ error: 'SOW not found' }, { status: 404, headers: corsHeaders() });
    if (sow.status === 'approved') return NextResponse.json({ error: 'Already approved' }, { status: 400, headers: corsHeaders() });

    // Auto-create Project shell
    const project = await db.project.create({
      data: {
        name: `${sow.client.name} — ${sow.title}`,
        companyId: sow.client.companyId,
        clientId: sow.clientId,
        projectType: 'client',
        billingType: 'time_and_material',
        currency: sow.currency,
        budgetAmount: sow.totalValue || 0,
        billingRate: (sow.billRatesJson && typeof sow.billRatesJson === 'object' && Object.values(sow.billRatesJson)[0]) ? Number(Object.values(sow.billRatesJson)[0]) : 0,
        startDate: sow.startDate || new Date(),
        endDate: sow.endDate,
        status: 'active',
        description: `Auto-generated from SOW: ${sow.title}`,
      },
    });

    const updated = await db.sOW.update({
      where: { id },
      data: { status: 'approved', projectId: project.id, approvedById: decoded.userId as string, approvedAt: new Date() },
    });
    await db.auditLog.create({ data: { userId: decoded.userId as string, action: 'APPROVE_SOW', module: 'clients', details: `Approved SOW ${sow.title} → project ${project.id}` } });
    return NextResponse.json({ sow: updated, project }, { headers: corsHeaders() });
  } catch (error) { console.error('Approve SOW error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
