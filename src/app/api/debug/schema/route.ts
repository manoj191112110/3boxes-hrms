/**
 * One-off diagnostic API route to check the actual Tenant, CompanyGroup, and
 * Company table schemas in production. Useful for debugging schema drift.
 *
 * GET /api/debug/schema
 */
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

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

export async function GET(request: Request) {
  // Super-admin only
  const token = getTokenFromHeaders(request);
  if (!token) return NextResponse.json({ error: 'No token' }, { status: 401, headers: corsHeaders() });
  const decoded = await verifyToken(token);
  if (!decoded) return NextResponse.json({ error: 'Bad token' }, { status: 401, headers: corsHeaders() });
  if (decoded.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super admin only' }, { status: 403, headers: corsHeaders() });
  }

  const connectionString = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString || connectionString.startsWith('file:')) {
    return NextResponse.json({ error: 'No DB connection', connectionString: null }, { headers: corsHeaders() });
  }

  try {
    const sql = neon(connectionString);

    const [tenantCols, companyCols, companyGroupCols, featureFlagExists, groupCounts, companyCounts] = await Promise.all([
      sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Tenant' ORDER BY ordinal_position`,
      sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Company' ORDER BY ordinal_position`,
      sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'CompanyGroup' ORDER BY ordinal_position`,
      sql`SELECT table_name FROM information_schema.tables WHERE table_name = 'FeatureFlag'`,
      sql`SELECT "tenantId", COUNT(*) as group_count FROM "CompanyGroup" GROUP BY "tenantId"`,
      sql`SELECT COUNT(*) as total_companies FROM "Company"`,
    ]);

    return NextResponse.json({
      tenantColumns: tenantCols.map((c: any) => `${c.column_name}(${c.data_type})`),
      companyColumns: companyCols.map((c: any) => `${c.column_name}(${c.data_type})`),
      companyGroupColumns: companyGroupCols.map((c: any) => `${c.column_name}(${c.data_type})`),
      featureFlagTableExists: featureFlagExists.length > 0,
      groupsPerTenant: groupCounts,
      totalCompanies: companyCounts[0]?.total_companies ?? 0,
    }, { headers: corsHeaders() });
  } catch (err: unknown) {
    const msg = err && err.message ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500, headers: corsHeaders() });
  }
}
