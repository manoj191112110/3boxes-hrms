import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced } from '@/lib/schema-sync';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * POST /api/job-board-postings/sync
 *
 * Iterates all JobBoardPosting where status='posted' and checks if the
 * linked JobPosting is filled; if so, auto-closes the board posting.
 *
 * Implements REQ-SRC-03 (auto-close on hire).
 *
 * Body (optional): { dryRun?: boolean }
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

    // Parse body (may be empty for POST with no body)
    let dryRun = false;
    try {
      const text = await request.text();
      if (text) {
        const body = JSON.parse(text);
        dryRun = !!body.dryRun;
      }
    } catch {
      // body is optional — ignore parse errors
    }

    // Find all postings currently in 'posted' status, with their linked jobPosting
    const activePostings = await db.jobBoardPosting.findMany({
      where: { status: 'posted' },
      include: {
        jobPosting: { select: { id: true, title: true, status: true } },
      },
    });

    const toClose = (Array.isArray(activePostings) ? activePostings : []).filter(
      (p) => p.jobPosting && (p.jobPosting.status === 'filled' || p.jobPosting.status === 'closed')
    );

    if (dryRun) {
      return NextResponse.json(
        {
          dryRun: true,
          scanned: Array.isArray(activePostings) ? activePostings.length : 0,
          wouldClose: toClose.length,
          items: toClose.map((p) => ({
            postingId: p.id,
            jobPostingId: p.jobPostingId,
            jobTitle: p.jobPosting?.title,
            board: p.board,
            jobStatus: p.jobPosting?.status,
          })),
        },
        { headers: corsHeaders() }
      );
    }

    const closed: { id: string; jobPostingId: string; board: string; jobTitle: string }[] = [];
    const errors: { id: string; error: string }[] = [];

    for (const p of toClose) {
      try {
        await db.jobBoardPosting.update({
          where: { id: p.id },
          data: {
            status: 'closed',
            closedAt: new Date(),
            lastSyncedAt: new Date(),
            lastSyncPayload: JSON.stringify({
              action: 'auto_close_on_hire',
              closedAt: new Date().toISOString(),
              triggeredBy: 'sync',
              jobStatus: p.jobPosting?.status,
              previousStatus: p.status,
            }),
          },
        });
        closed.push({
          id: p.id,
          jobPostingId: p.jobPostingId,
          board: p.board,
          jobTitle: p.jobPosting?.title || p.jobPostingId,
        });

        await db.auditLog.create({
          data: {
            userId: decoded.userId as string,
            action: 'AUTO_CLOSE_JOB_BOARD_POSTING',
            module: 'recruitment',
            details: `Auto-closed ${p.board} posting for job "${p.jobPosting?.title || p.jobPostingId}" (job status: ${p.jobPosting?.status})`,
          },
        });
      } catch (err: unknown) {
        errors.push({
          id: p.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json(
      {
        scanned: Array.isArray(activePostings) ? activePostings.length : 0,
        closed: closed.length,
        errors: errors.length,
        items: closed,
        errorDetails: errors,
      },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Job board postings sync error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
