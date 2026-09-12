import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced } from '@/lib/schema-sync';
import { createNotification } from '@/lib/notifications';

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

const VALID_BOARDS = ['linkedin', 'indeed', 'glassdoor', 'stepstone', 'naukri', 'internal_careers'];

/**
 * Simulates an external board API call.
 * Returns a fake externalJobId and externalUrl after a 2-second delay.
 * Throws a synthetic error ~5% of the time so the failed-status branch is exercised.
 */
async function simulateExternalBoardCall(jobPostingId: string, board: string): Promise<{
  externalJobId: string;
  externalUrl: string;
}> {
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Simulated flake — ~5% failure rate
  if (Math.random() < 0.05) {
    throw new Error(`[${board}] API returned 503 Service Unavailable (simulated)`);
  }

  const externalJobId = `${board}-${jobPostingId.substring(0, 8)}-${Date.now().toString(36)}`;
  const externalUrl = `https://boards.${board}.com/jobs/${jobPostingId}`;
  return { externalJobId, externalUrl };
}

/**
 * GET /api/job-board-postings
 * Query params:
 *   - jobPostingId: filter by job posting
 *   - board: filter by board
 *   - status: filter by status
 */
export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401, headers: corsHeaders() }
      );
    }

    await ensureSchemaSynced();

    const { searchParams } = new URL(request.url);
    const jobPostingId = searchParams.get('jobPostingId');
    const board = searchParams.get('board');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (jobPostingId) where.jobPostingId = jobPostingId;
    if (board) where.board = board;
    if (status) where.status = status;

    const postings = await db.jobBoardPosting.findMany({
      where,
      include: {
        jobPosting: {
          select: { id: true, title: true, status: true, department: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      { postings: Array.isArray(postings) ? postings : [] },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Job board postings GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

/**
 * POST /api/job-board-postings
 * Body: { jobPostingId: string, board: string }
 *
 * Behaviour:
 *  - internal_careers: immediately set status='posted', externalUrl=`/careers?jobId=<id>`
 *  - linkedin|indeed|glassdoor|stepstone|naukri: simulate 2-sec external call, then set posted
 *  - errors -> status='failed' with errorMessage
 */
export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401, headers: corsHeaders() }
      );
    }

    await ensureSchemaSynced();

    const body = await request.json();
    const { jobPostingId, board } = body;

    if (!jobPostingId || !board) {
      return NextResponse.json(
        { error: 'Missing required fields: jobPostingId, board' },
        { status: 400, headers: corsHeaders() }
      );
    }

    if (!VALID_BOARDS.includes(board)) {
      return NextResponse.json(
        { error: `Invalid board. Must be one of: ${VALID_BOARDS.join(', ')}` },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Verify the job posting exists
    const jobPosting = await db.jobPosting.findUnique({ where: { id: jobPostingId } });
    if (!jobPosting) {
      return NextResponse.json(
        { error: 'Job posting not found' },
        { status: 404, headers: corsHeaders() }
      );
    }

    // Use upsert to enforce the @@unique([jobPostingId, board]) constraint.
    // If a posting already exists for (jobPostingId, board), return it as-is.
    const existing = await db.jobBoardPosting.findFirst({
      where: { jobPostingId, board },
    });
    if (existing) {
      return NextResponse.json(
        {
          posting: existing,
          message: 'Posting already exists for this job + board',
        },
        { status: 200, headers: corsHeaders() }
      );
    }

    // Create the posting in pending status immediately
    const posting = await db.jobBoardPosting.create({
      data: {
        jobPostingId,
        board,
        status: 'pending',
      },
    });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'CREATE_JOB_BOARD_POSTING',
        module: 'recruitment',
        details: `Created ${board} posting for job: ${jobPosting.title}`,
      },
    });

    // ── Branch by board ──
    if (board === 'internal_careers') {
      // Internal careers page — instantly posted
      const updated = await db.jobBoardPosting.update({
        where: { id: posting.id },
        data: {
          status: 'posted',
          externalUrl: `/careers?jobId=${jobPostingId}`,
          externalJobId: `internal-${jobPostingId}`,
          postedAt: new Date(),
          lastSyncedAt: new Date(),
          lastSyncPayload: JSON.stringify({ source: 'internal', postedAt: new Date().toISOString() }),
        },
      });

      // Notify HR admins (best-effort, non-blocking)
      try {
        const hrAdmins = await db.user.findMany({
          where: {
            tenantId: decoded.tenantId as string,
            role: { in: ['super_admin', 'tenant_admin', 'admin'] },
          },
        });
        for (const admin of hrAdmins) {
          await createNotification({
            tenantId: decoded.tenantId as string,
            userId: admin.id,
            title: 'Job Posted to Internal Careers',
            message: `"${jobPosting.title}" is now live on the internal careers page.`,
            type: 'info',
            category: 'recruitment',
            link: `/recruitment/${jobPostingId}`,
          });
        }
      } catch {
        // best-effort
      }

      return NextResponse.json(
        { posting: updated, message: 'Posted to internal careers page' },
        { status: 201, headers: corsHeaders() }
      );
    }

    // External board — simulate async API call (fire-and-await; the client sees ~2s latency)
    try {
      const { externalJobId, externalUrl } = await simulateExternalBoardCall(jobPostingId, board);
      const updated = await db.jobBoardPosting.update({
        where: { id: posting.id },
        data: {
          status: 'posted',
          externalJobId,
          externalUrl,
          postedAt: new Date(),
          lastSyncedAt: new Date(),
          lastSyncPayload: JSON.stringify({
            source: board,
            externalJobId,
            externalUrl,
            postedAt: new Date().toISOString(),
          }),
        },
      });
      return NextResponse.json(
        { posting: updated, message: `Posted to ${board}` },
        { status: 201, headers: corsHeaders() }
      );
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown external API error';
      const updated = await db.jobBoardPosting.update({
        where: { id: posting.id },
        data: {
          status: 'failed',
          errorMessage,
          lastSyncedAt: new Date(),
          lastSyncPayload: JSON.stringify({ error: errorMessage, at: new Date().toISOString() }),
        },
      });
      return NextResponse.json(
        { posting: updated, message: `Failed to post to ${board}: ${errorMessage}` },
        { status: 201, headers: corsHeaders() }
      );
    }
  } catch (error) {
    console.error('Job board postings POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
