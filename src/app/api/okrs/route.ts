import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

// ─── GET /api/okrs ────────────────────────────────────────────────
// Returns OKRs as a flat list with includes (owner, company, project, keyResults, childOkrs).
// Use ?cascade=true to get the tree pre-built (top-level OKRs with children nested).
// Use ?quarter=Q1+2026&year=2026 to filter by period.
// Use ?category=company|sub_company|project|individual to filter by level.
// Use ?companyId=X or ?projectId=Y to filter by owner entity.
export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    await ensureSchemaSynced();

    const { searchParams } = new URL(request.url);
    const quarter = searchParams.get('quarter');
    const year = searchParams.get('year');
    const category = searchParams.get('category');
    const companyId = searchParams.get('companyId');
    const projectId = searchParams.get('projectId');
    const ownerId = searchParams.get('ownerId');
    const cascade = searchParams.get('cascade') === 'true';

    const where: Record<string, unknown> = {};
    if (quarter) where.quarter = quarter;
    if (year) where.year = parseInt(year);
    if (category) where.category = category;
    if (companyId) where.companyId = companyId;
    if (projectId) where.projectId = projectId;
    if (ownerId) where.ownerId = ownerId;

    const okrs = await withSchemaSync(() =>
      db.oKR.findMany({
        where,
        include: {
          owner: { select: { id: true, firstName: true, lastName: true, employeeId: true, avatar: true } },
          company: { select: { id: true, name: true, code: true } },
          project: { select: { id: true, name: true, code: true } },
          keyResults: true,
          childOkrs: {
            include: {
              owner: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
              company: { select: { id: true, name: true } },
              project: { select: { id: true, name: true } },
              keyResults: true,
              childOkrs: {
                include: {
                  owner: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
                  company: { select: { id: true, name: true } },
                  project: { select: { id: true, name: true } },
                  keyResults: true,
                  childOkrs: {
                    include: {
                      owner: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
                      keyResults: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [
          { category: 'asc' }, // company first, then sub_company, project, individual
          { createdAt: 'desc' },
        ],
        take: 200,
      })
    );

    if (cascade) {
      // Build tree: top-level OKRs are those with parentOkrId === null
      const tree = okrs.filter((o) => !o.parentOkrId);
      return NextResponse.json({ okrs: tree, flatCount: okrs.length }, { headers: corsHeaders() });
    }

    return NextResponse.json({ okrs, count: okrs.length }, { headers: corsHeaders() });
  } catch (error) {
    console.error('OKRs GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

// ─── POST /api/okrs ───────────────────────────────────────────────
// Create an OKR at any cascade level.
// Body:
//   { objective, ownerId?, companyId?, projectId?, category, parentOkrId?,
//     quarter?, year?, status?, keyResults?: [{title, targetValue, unit?}] }
// Validation:
//   - category='individual' requires ownerId
//   - category='company' or 'sub_company' requires companyId
//   - category='project' requires projectId
export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const { objective, ownerId, companyId, projectId, category, parentOkrId, quarter, year, status, keyResults } = body;

    if (!objective) {
      return NextResponse.json({ error: 'Objective is required' }, { status: 400, headers: corsHeaders() });
    }
    if (!category) {
      return NextResponse.json({ error: 'Category is required (company | sub_company | project | individual)' }, { status: 400, headers: corsHeaders() });
    }

    // Validate ownership based on category
    const cat = String(category);
    if ((cat === 'individual') && !ownerId) {
      return NextResponse.json({ error: 'Individual OKRs require an ownerId (Employee ID)' }, { status: 400, headers: corsHeaders() });
    }
    if ((cat === 'company' || cat === 'sub_company') && !companyId) {
      return NextResponse.json({ error: 'Company/sub-company OKRs require a companyId' }, { status: 400, headers: corsHeaders() });
    }
    if (cat === 'project' && !projectId) {
      return NextResponse.json({ error: 'Project OKRs require a projectId' }, { status: 400, headers: corsHeaders() });
    }

    await ensureSchemaSynced();

    const okr = await withSchemaSync(() =>
      db.oKR.create({
        data: {
          objective,
          ownerId: ownerId || null,
          companyId: companyId || null,
          projectId: projectId || null,
          createdById: decoded.userId as string,
          category: cat,
          parentOkrId: parentOkrId || null,
          quarter: quarter || currentQuarter(),
          year: year || new Date().getFullYear(),
          status: status || 'draft',
          keyResults: keyResults
            ? {
                create: keyResults.map((kr: { title: string; targetValue?: number; unit?: string }) => ({
                  title: kr.title,
                  targetValue: kr.targetValue || 100,
                  unit: kr.unit || null,
                })),
              }
            : undefined,
        },
        include: {
          keyResults: true,
          owner: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
          company: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
        },
      })
    );

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'CREATE_OKR',
        module: 'okrs',
        details: `Created ${cat} OKR: ${objective.substring(0, 60)}`,
      },
    });

    return NextResponse.json({ okr }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('OKRs POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

function currentQuarter(): string {
  const now = new Date();
  const month = now.getMonth();
  const q = Math.floor(month / 3) + 1;
  return `Q${q} ${now.getFullYear()}`;
}
