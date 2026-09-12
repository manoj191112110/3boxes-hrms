/**
 * REQ-AI-MKT-01 — Hyper-personalized catalog (life-stage based).
 *
 * GET /api/marketplace/products/recommended?employeeId=X
 *
 * Returns the marketplace catalog ranked by life-stage signals for the given
 * employee. Uses a 24h cache (PersonalizedCatalogCache) to avoid recomputing
 * signals on every page load.
 *
 * Life-stage inference rules (heuristic — no AI call required for speed):
 *   - tenureYears < 1     → "new_joiner"
 *   - maritalStatus='married' & hasChildren → "new_parent"
 *   - maritalStatus='married' & no children → "married"
 *   - age >= 55           → "pre_retirement"
 *   - age 40-55           → "mid_career"
 *   - else                → "single"
 *
 * Each life-stage has a curated priority list of product categories. The
 * endpoint returns the top N products in ranked order with an explanation.
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

const LIFE_STAGE_CATEGORY_PRIORITY: Record<string, string[]> = {
  new_joiner: ['course', 'voucher', 'gift_card'],          // L&D focus, onboarding perks
  new_parent: ['insurance_topup', 'voucher', 'physical_goods'], // insurance + baby essentials
  married:   ['voucher', 'gift_card', 'insurance_topup'],
  single:    ['voucher', 'gift_card', 'digital_goods'],
  mid_career:['course', 'insurance_topup', 'voucher'],
  pre_retirement: ['insurance_topup', 'course', 'voucher'],
};

const LIFE_STAGE_DESCRIPTIONS: Record<string, string> = {
  new_joiner: 'New joiner — prioritized learning & development and onboarding perks',
  new_parent: 'New parent — prioritized insurance top-ups and family essentials',
  married: 'Married — prioritized couple-friendly vouchers and insurance',
  single: 'Single — prioritized entertainment and lifestyle vouchers',
  mid_career: 'Mid-career — prioritized upskilling and protection planning',
  pre_retirement: 'Pre-retirement — prioritized health insurance and legacy planning',
};

function computeLifeStage(emp: {
  dateOfJoining: Date | null;
  dateOfBirth: Date | null;
  maritalStatus: string | null;
}): { stage: string; signals: Record<string, any> } {
  const now = new Date();
  const tenureYears = emp.dateOfJoining
    ? (now.getTime() - emp.dateOfJoining.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    : 0;
  const ageYears = emp.dateOfBirth
    ? Math.floor((now.getTime() - emp.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : 30;

  const signals: Record<string, any> = {
    tenureYears: Math.round(tenureYears * 10) / 10,
    ageBracket: ageYears < 30 ? '<30' : ageYears < 40 ? '30-40' : ageYears < 55 ? '40-55' : '55+',
    maritalStatus: emp.maritalStatus || 'single',
  };

  let stage = 'single';
  if (tenureYears < 1) stage = 'new_joiner';
  else if (emp.maritalStatus?.toLowerCase() === 'married' && signals.hasChildren) stage = 'new_parent';
  else if (emp.maritalStatus?.toLowerCase() === 'married') stage = 'married';
  else if (ageYears >= 55) stage = 'pre_retirement';
  else if (ageYears >= 40) stage = 'mid_career';

  return { stage, signals };
}

export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const refresh = searchParams.get('refresh') === '1';
    if (!employeeId) return NextResponse.json({ error: 'Missing employeeId' }, { status: 400, headers: corsHeaders() });

    // Check cache (24h TTL)
    if (!refresh) {
      const cached = await db.personalizedCatalogCache.findFirst({
        where: { employeeId, expiresAt: { gt: new Date() } },
        orderBy: { evaluatedAt: 'desc' },
      });
      if (cached) {
        const rankedIds = cached.rankedProductIds.split(',').filter(Boolean);
        const products = await db.marketplaceProduct.findMany({
          where: { id: { in: rankedIds }, status: 'active' },
        });
        // Preserve ranking order
        products.sort((a, b) => rankedIds.indexOf(a.id) - rankedIds.indexOf(b.id));
        return NextResponse.json({
          lifeStage: cached.lifeStage,
          signals: cached.signalsJson,
          reason: cached.reason,
          products,
          cached: true,
          evaluatedAt: cached.evaluatedAt,
        }, { headers: corsHeaders() });
      }
    }

    // Compute fresh
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        dateOfJoining: true,
        dateOfBirth: true,
        maritalStatus: true,
      },
    });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404, headers: corsHeaders() });

    const { stage, signals } = computeLifeStage(employee);

    // Pull recent purchases to inform ranking (diversification)
    const recentOrders = await db.marketplaceOrder.findMany({
      where: { employeeId, status: 'completed' },
      include: { product: { select: { category: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    signals.recentCategoryPurchases = recentOrders.map(o => o.product.category);

    // Get active products and rank by life-stage priority
    const allProducts = await db.marketplaceProduct.findMany({
      where: { status: 'active' },
    });
    const priorityCats = LIFE_STAGE_CATEGORY_PRIORITY[stage] || LIFE_STAGE_CATEGORY_PRIORITY.single;

    // Score: priority index (lower = higher priority) + diversification penalty
    const scored = allProducts.map(p => {
      const catIdx = priorityCats.indexOf(p.category);
      const priorityScore = catIdx === -1 ? priorityCats.length : catIdx;  // 0..N
      const diversityPenalty = signals.recentCategoryPurchases.includes(p.category) ? 1 : 0;
      return { product: p, score: priorityScore + diversityPenalty };
    });
    scored.sort((a, b) => a.score - b.score);

    const ranked = scored.slice(0, 12).map(s => s.product);
    const rankedIds = ranked.map(p => p.id).join(',');
    const reason = `${LIFE_STAGE_DESCRIPTIONS[stage]}. Catalog ranked by life-stage category priority with diversification against your last 5 purchases.`;

    // Persist cache (24h TTL). Delete any existing cached rows for this employee first
    // (avoids growth of stale rows; indexed by employeeId only, not unique).
    try {
      await db.personalizedCatalogCache.deleteMany({ where: { employeeId } });
      await db.personalizedCatalogCache.create({
        data: {
          employeeId,
          lifeStage: stage,
          signalsJson: signals as any,
          rankedProductIds: rankedIds,
          reason,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    } catch (cacheErr) {
      // Non-fatal — caching is best-effort
      console.warn('Personalized catalog cache write failed (non-fatal):', cacheErr);
    }

    return NextResponse.json({
      lifeStage: stage,
      signals,
      reason,
      products: ranked,
      cached: false,
      evaluatedAt: new Date(),
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get recommended catalog error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
