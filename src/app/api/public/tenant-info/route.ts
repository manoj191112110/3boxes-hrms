import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { isLiveMode } from '@/lib/site-mode';
import { getServerHiddenSlugs, LIVE_HIDDEN_SLUGS, DEMO_HIDDEN_SLUGS } from '@/lib/tenant-filter';

// ─── Hidden Tenant Slugs (GOLDEN RULE — FOOLPROOF) ──────────────────
function getHiddenSlugsForRequest(request: Request): string[] {
  const foolproof = getServerHiddenSlugs(request);
  const siteMode = isLiveMode(request) ? LIVE_HIDDEN_SLUGS : DEMO_HIDDEN_SLUGS;
  return [...new Set([...foolproof, ...siteMode])];
}

/**
 * GET /api/public/tenant-info?slug=marqaitechgroup
 *
 * Public endpoint (no auth required) that returns basic tenant information
 * for subdomain-based login page branding. Only returns non-sensitive data:
 * name, slug, and logo.
 *
 * GOLDEN RULE: Hidden tenants are never returned on the live site.
 */
export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json({ error: 'Slug parameter is required' }, { status: 400 });
    }

    // ─── GOLDEN RULE: Block hidden tenants on live/demo ───
    const hiddenSlugs = getHiddenSlugsForRequest(request);
    if (hiddenSlugs.includes(slug)) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const tenant = await getPlatformDb().tenant.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        status: true,
      },
    });

    if (!tenant || tenant.status !== 'active') {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    return NextResponse.json({
      tenant: {
        name: tenant.name,
        slug: tenant.slug,
        logo: tenant.logo,
      },
    });
  } catch (error) {
    console.error('Tenant info error:', error);
    return NextResponse.json({ error: 'Failed to fetch tenant info' }, { status: 500 });
  }
}
