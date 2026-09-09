import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  // Expose the x-tenant-slug header so the client (careers page) can read it
  // and know which tenant was detected from the hostname. Without this, the
  // browser hides custom response headers from JS.
  'Access-Control-Expose-Headers': 'x-tenant-slug, x-tenant-domain',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/public/jobs
 *
 * Public (no-auth) endpoint that returns all OPEN job postings across the
 * whole HRMS, OR filtered to a single tenant via ?tenantSlug=xxx.
 *
 * This is the data source for the public /careers page that candidates use
 * to browse openings and apply. It is intentionally scoped to OPEN jobs only
 * — closed/on-hold/filled jobs are never exposed to the public.
 *
 * Query params:
 *   - tenantSlug: filter to a single tenant (used by per-tenant career sites)
 *   - companySlug / companyId: further filter to a specific company
 *   - search: free-text search across title/position/location
 *   - type: full-time | part-time | contract | internship
 *   - location: substring match
 *   - page / limit: pagination (default 1 / 24)
 */
export async function GET(req: NextRequest) {
  const db = await getDb(req);
  try {
    const url = new URL(req.url);
    // The tenantSlug can come from:
    //   1. Explicit ?tenantSlug=xxx query param (highest priority — used by /careers/[tenantSlug])
    //   2. x-tenant-slug header (set by middleware based on the request hostname —
    //      lets tenants embed the careers portal on their own subdomain without
    //      needing to know the slug)
    const tenantSlug =
      url.searchParams.get('tenantSlug') ||
      req.headers.get('x-tenant-slug') ||
      null;
    const companyId = url.searchParams.get('companyId');
    const search = url.searchParams.get('search');
    const type = url.searchParams.get('type');
    const location = url.searchParams.get('location');
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(60, Math.max(1, parseInt(url.searchParams.get('limit') || '24')));
    const skip = (page - 1) * limit;

    // Build the where clause — only ever return OPEN jobs publicly
    const where: Record<string, unknown> = { status: 'open' };

    if (tenantSlug) {
      where.department = { company: { companyGroup: { tenant: { slug: tenantSlug } } } };
    }
    if (companyId) {
      where.department = {
        ...(where.department as Record<string, unknown> | undefined),
        companyId,
      };
    }
    if (type) {
      where.type = type;
    }
    if (location) {
      where.location = { contains: location, mode: 'insensitive' };
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { position: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [jobs, total] = await Promise.all([
      db.jobPosting.findMany({
        where,
        skip,
        take: limit,
        orderBy: { postedDate: 'desc' },
        include: {
          department: {
            select: {
              id: true,
              name: true,
              company: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  city: true,
                  country: true,
                  companyGroup: {
                    select: {
                      id: true,
                      name: true,
                      tenant: { select: { id: true, name: true, slug: true } },
                    },
                  },
                },
              },
            },
          },
          _count: { select: { applications: true } },
        },
      }),
      db.jobPosting.count({ where }),
    ]);

    // Shape the response for the public portal — strip internal fields
    const publicJobs = jobs.map((j) => ({
      id: j.id,
      title: j.title,
      position: j.position,
      location: j.location,
      type: j.type,
      experience: j.experience,
      salary: j.salary,
      description: j.description,
      requirements: j.requirements,
      vacancies: j.vacancies,
      postedDate: j.postedDate,
      closingDate: j.closingDate,
      applicants: j._count?.applications || 0,
      department: j.department
        ? {
            id: j.department.id,
            name: j.department.name,
          }
        : null,
      company: j.department?.company
        ? {
            id: j.department.company.id,
            name: j.department.company.name,
            code: j.department.company.code,
            city: j.department.company.city,
            country: j.department.company.country,
          }
        : null,
      tenant: j.department?.company?.companyGroup?.tenant
        ? {
            id: j.department.company.companyGroup.tenant.id,
            name: j.department.company.companyGroup.tenant.name,
            slug: j.department.company.companyGroup.tenant.slug,
          }
        : null,
      group: j.department?.company?.companyGroup
        ? {
            id: j.department.company.companyGroup.id,
            name: j.department.company.companyGroup.name,
          }
        : null,
    }));

    return NextResponse.json(
      {
        jobs: publicJobs,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        // Echo back the tenant slug that was applied (if any) so the client
        // can confirm whether the request was tenant-scoped.
        appliedTenantSlug: tenantSlug,
      },
      {
        headers: {
          ...corsHeaders,
          // Echo the detected tenant slug back to the client. The careers page
          // uses this to auto-filter listings when served from a tenant subdomain.
          'x-tenant-slug': tenantSlug || '',
        },
      }
    );
  } catch (error) {
    console.error('GET /api/public/jobs error:', error);
    return NextResponse.json(
      { jobs: [], pagination: { page: 1, limit: 24, total: 0, totalPages: 0 }, error: 'Failed to load jobs' },
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'x-tenant-slug': (url.searchParams.get('tenantSlug') || req.headers.get('x-tenant-slug') || ''),
        },
      }
    );
  }
}
