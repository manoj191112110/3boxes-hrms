/**
 * Tenant Lookup — Multi-tenant login helper
 *
 * GET /api/auth/tenant-lookup?code=<company-code-or-tenant-slug>
 *
 * Resolves a "company code" (typed by the user at login) to a tenant + the
 * list of companies under that tenant. Used by the HRMS /login page so users
 * can identify which company they belong to before entering their password.
 *
 * The lookup is intentionally lenient — it matches against:
 *   1. Tenant.slug (exact, case-insensitive)
 *   2. Tenant.name (substring, case-insensitive)
 *   3. Company.code (exact, case-insensitive)
 *   4. Company.name (substring, case-insensitive)
 *
 * Returns:
 *   200 { found: true, tenant: { id, name, slug }, companies: [...] }
 *   200 { found: false }  — don't leak whether the code exists; just say no match
 *
 * No auth required — this is a pre-login lookup. Rate-limiting should be
 * added at the edge (Vercel) in production.
 */
import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS });
}

export async function GET(request: Request) {
  const db = getPlatformDb();
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code')?.trim();
    if (!code || code.length < 2) {
      return NextResponse.json({ found: false }, { headers: CORS });
    }
    const needle = code.toLowerCase();

    // 1. Try Tenant.slug / Tenant.name
    const tenant = await getPlatformDb().tenant.findFirst({
      where: {
        OR: [
          { slug: { contains: needle, mode: 'insensitive' } },
          { name: { contains: needle, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        // Tenant → CompanyGroup → Company (multi-tenant chain)
        companyGroups: {
          select: {
            id: true,
            name: true,
            companies: {
              select: { id: true, name: true, code: true, logo: true },
              take: 50,
            },
          },
        },
      },
    });

    if (tenant) {
      // Flatten companies across all groups for the response
      const companies = tenant.companyGroups.flatMap(g => g.companies);
      return NextResponse.json({
        found: true,
        match: 'tenant',
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          logo: tenant.logo,
        },
        companies,
      }, { headers: CORS });
    }

    // 2. Fall back to Company.code / Company.name — return the company + its tenant
    const company = await db.company.findFirst({
      where: {
        OR: [
          { code: { equals: code, mode: 'insensitive' } },
          { name: { contains: needle, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        code: true,
        logo: true,
        companyGroup: {
          select: {
            id: true,
            name: true,
            tenant: { select: { id: true, name: true, slug: true, logo: true } },
          },
        },
      },
    });

    if (company) {
      return NextResponse.json({
        found: true,
        match: 'company',
        company: {
          id: company.id,
          name: company.name,
          code: company.code,
          logo: company.logo,
        },
        tenant: company.companyGroup?.tenant
          ? {
              id: company.companyGroup.tenant.id,
              name: company.companyGroup.tenant.name,
              slug: company.companyGroup.tenant.slug,
              logo: company.companyGroup.tenant.logo,
            }
          : null,
      }, { headers: CORS });
    }

    return NextResponse.json({ found: false }, { headers: CORS });
  } catch (e: unknown) {
    return NextResponse.json(
      { found: false, error: e instanceof Error ? e.message : 'Lookup failed' },
      { status: 500, headers: CORS },
    );
  }
}
