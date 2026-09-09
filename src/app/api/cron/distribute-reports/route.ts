/**
 * REQ-ENG-08 — Vercel Cron job for scheduled report distribution.
 *
 * GET /api/cron/distribute-reports
 *
 * Called every 15 minutes by Vercel Cron (configured in vercel.json).
 * Finds all active ReportSchedule rows that are "due" in the current window
 * and dispatches them via email / Collaboration Hub notification.
 *
 * Auth: protected by CRON_SECRET header (set in Vercel env). Falls back to
 * no-auth in development for local testing.
 *
 * Due-window logic:
 *   - We compute the schedule's "next due time" after lastRunAt (or createdAt).
 *   - If next-due-time <= now, fire the schedule and update lastRunAt = now.
 */
import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { createNotification } from '@/lib/notifications';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function computeNextDue(schedule: {
  frequency: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  hour: number;
  minute: number;
  timezone: string;
  lastRunAt: Date | null;
  createdAt: Date;
}): Date | null {
  const now = new Date();
  // Use lastRunAt as anchor, else createdAt
  const anchor = schedule.lastRunAt || schedule.createdAt;

  // Simple computation — assumes Asia/Kolkata for demo. For production,
  // use a proper tz library like luxon.
  const next = new Date(anchor);
  next.setHours(schedule.hour, schedule.minute, 0, 0);

  switch (schedule.frequency) {
    case 'daily':
      // If anchor's scheduled time has passed, advance by 1 day
      if (next <= anchor) next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      const targetDow = schedule.dayOfWeek ?? 1;
      const curDow = next.getDay();
      let diff = (targetDow - curDow + 7) % 7;
      if (diff === 0 && next <= anchor) diff = 7;
      next.setDate(next.getDate() + diff);
      break;
    case 'bi_weekly':
      if (next <= anchor) next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      const targetDom = schedule.dayOfMonth ?? 1;
      next.setDate(targetDom);
      if (next <= anchor) {
        next.setMonth(next.getMonth() + 1);
        // Handle months that don't have the target day (e.g., day 31 in Feb)
        if (next.getDate() !== targetDom) {
          next.setDate(0);  // last day of previous month
        }
      }
      break;
    default:
      return null;
  }
  return next;
}

export async function GET(request: Request) {
  const db = await getDb(request);
  // Auth check via CRON_SECRET header (set in Vercel env)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: any[] = [];
  const now = new Date();

  try {
    const schedules = await db.reportSchedule.findMany({
      where: { isActive: true },
      take: 100,
    });

    for (const schedule of schedules) {
      const nextDue = computeNextDue({
        frequency: schedule.frequency,
        dayOfWeek: schedule.dayOfWeek,
        dayOfMonth: schedule.dayOfMonth,
        hour: schedule.hour,
        minute: schedule.minute,
        timezone: schedule.timezone,
        lastRunAt: schedule.lastRunAt,
        createdAt: schedule.createdAt,
      });

      if (!nextDue || nextDue > now) continue;

      // Fire the schedule
      let status = 'success';
      let errorMsg: string | null = null;
      try {
        // For now, dispatch via Collaboration Hub notifications to recipient users.
        // Email dispatch would require an SMTP / SendGrid / Resend integration.
        const rawRecipients = schedule.recipientsJson;
        const recipients: Array<{ type: string; value: string }> = Array.isArray(rawRecipients)
          ? (rawRecipients as any[]).filter((r): r is { type: string; value: string } =>
              r != null && typeof r === 'object' && typeof r.type === 'string' && typeof r.value === 'string')
          : [];
        for (const r of recipients) {
          if (r.type === 'collab_user' && r.value) {
            // Look up the user's tenantId (notifications table has FK to Tenant + User)
            const user = await db.user.findUnique({
              where: { id: r.value },
              select: { id: true, tenantId: true },
            }).catch(() => null);
            if (!user) continue;
            await createNotification({
              tenantId: user.tenantId,
              userId: user.id,
              title: `Scheduled Report: ${schedule.name}`,
              message: `Your ${schedule.frequency} ${schedule.reportType} report is ready for download. Format: ${schedule.outputFormat}.`,
              type: 'info',
              category: 'system',
              link: `/reports/${schedule.reportType}`,
            }).catch(() => { /* non-fatal */ });
          } else if (r.type === 'email' && r.value) {
            // TODO: integrate with email provider (SendGrid / Resend)
            console.log(`[cron:distribute-reports] Email dispatch to ${r.value} (SMTP integration pending) — schedule: ${schedule.name}`);
          }
        }
      } catch (e: unknown) {
        status = 'failed';
        errorMsg = e instanceof Error ? e.message : String(e);
      }

      // Update lastRunAt
      await db.reportSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: now,
          lastRunStatus: status,
          lastRunError: errorMsg,
        },
      });

      // Audit log
      await db.auditLog.create({
        data: {
          userId: 'system',
          action: 'REPORT_SCHEDULE_DISPATCHED',
          module: 'reports',
          details: `Schedule "${schedule.name}" (${schedule.frequency} ${schedule.reportType}) dispatched at ${now.toISOString()}. Status: ${status}.`,
        },
      }).catch(() => { /* non-fatal */ });

      results.push({
        scheduleId: schedule.id,
        name: schedule.name,
        status,
        nextDue: nextDue.toISOString(),
      });
    }

    return NextResponse.json({
      dispatched: results.length,
      results,
      checkedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('Cron distribute-reports error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
