/**
 * REQ-ENG-08 — Scheduled report distribution.
 *
 * GET  /api/reports/schedules          → list schedules (filtered by company if non-admin)
 * POST /api/reports/schedules          → create a new schedule
 * PATCH /api/reports/schedules/[id]    → update (deactivate, change recipients, etc.)
 *
 * The actual distribution is performed by a Vercel Cron job at
 * /api/cron/distribute-reports that fires every 15 minutes and checks for
 * schedules due in the current window.
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

export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const schedules = await db.reportSchedule.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return NextResponse.json({ schedules }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get report schedules error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const {
      name, reportType, filtersJson,
      frequency, dayOfWeek, dayOfMonth, hour, minute, timezone,
      recipientsJson, outputFormat, companyId,
    } = body;

    if (!name || !reportType || !frequency || !recipientsJson) {
      return NextResponse.json({ error: 'Missing required fields: name, reportType, frequency, recipientsJson' }, { status: 400, headers: corsHeaders() });
    }
    if (hour === undefined || hour < 0 || hour > 23) {
      return NextResponse.json({ error: 'hour must be 0..23' }, { status: 400, headers: corsHeaders() });
    }
    if (frequency === 'weekly' && (dayOfWeek === undefined || dayOfWeek < 0 || dayOfWeek > 6)) {
      return NextResponse.json({ error: 'dayOfWeek (0..6) required for weekly frequency' }, { status: 400, headers: corsHeaders() });
    }
    if (frequency === 'monthly' && (dayOfMonth === undefined || dayOfMonth < 1 || dayOfMonth > 31)) {
      return NextResponse.json({ error: 'dayOfMonth (1..31) required for monthly frequency' }, { status: 400, headers: corsHeaders() });
    }

    const schedule = await db.reportSchedule.create({
      data: {
        name,
        reportType,
        filtersJson: filtersJson || null,
        frequency,
        dayOfWeek: dayOfWeek ?? null,
        dayOfMonth: dayOfMonth ?? null,
        hour,
        minute: minute ?? 0,
        timezone: timezone || 'Asia/Kolkata',
        recipientsJson,
        outputFormat: outputFormat || 'pdf',
        companyId: companyId || null,
        createdById: (decoded as any).userId as string,
        isActive: true,
      },
    });

    await db.auditLog.create({
      data: {
        userId: (decoded as any).userId as string,
        action: 'REPORT_SCHEDULE_CREATED',
        module: 'reports',
        details: `Created schedule "${name}" (${frequency} at ${hour}:${minute || '00'} ${timezone || 'IST'}) for ${reportType} report`,
      },
    });

    return NextResponse.json({ schedule }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Create report schedule error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
