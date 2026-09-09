/**
 * REQ-SEC-MKT-03 — Wallet audit ledger verification endpoint.
 *
 * GET /api/wallet/audit-verify?walletId=X
 *
 * Recomputes the hash chain for the given wallet and returns the integrity
 * report. Any tampered rows are flagged in the DB (tamperFlagged=true) and
 * listed in the response.
 *
 * Returns: { walletId, totalTransactions, tampered, tamperedIds, ok }
 */
import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { verifyWalletChain } from '@/lib/wallet-ledger';

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

    // Only admins can run audit verification
    const role = (decoded as any).role as string | undefined;
    if (!role || !['super_admin', 'tenant_admin', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403, headers: corsHeaders() });
    }

    const { searchParams } = new URL(request.url);
    const walletId = searchParams.get('walletId');
    const employeeId = searchParams.get('employeeId');

    if (!walletId && !employeeId) {
      return NextResponse.json({ error: 'Either walletId or employeeId is required' }, { status: 400, headers: corsHeaders() });
    }

    // Resolve target wallet(s)
    let walletIds: string[] = [];
    if (walletId) {
      walletIds = [walletId];
    } else if (employeeId) {
      const wallets = await db.wallet.findMany({ where: { employeeId }, select: { id: true } });
      walletIds = wallets.map(w => w.id);
    }

    const reports = [];
    let totalTampered = 0;
    let totalTransactions = 0;
    for (const wid of walletIds) {
      const report = await verifyWalletChain(prisma, wid);
      reports.push({ walletId: wid, ...report });
      totalTampered += report.tampered;
      totalTransactions += report.totalTransactions;
    }

    if (totalTampered > 0) {
      await db.auditLog.create({
        data: {
          userId: (decoded as any).userId as string,
          action: 'WALLET_TAMPER_DETECTED',
          module: 'marketplace',
          details: `Wallet audit verification flagged ${totalTampered} tampered transaction(s) across ${walletIds.length} wallet(s).`,
        },
      });
    }

    return NextResponse.json({
      ok: totalTampered === 0,
      totalTransactions,
      tampered: totalTampered,
      reports,
      verifiedAt: new Date(),
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Wallet audit verify error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
