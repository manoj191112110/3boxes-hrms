/**
 * Onboarding Task Reminders — scheduled sweep (Vercel Cron)
 *
 *   GET /api/cron/onboarding-reminders?secret=CRON_SECRET
 *
 * Sends a notification for every pending/in-progress onboarding task that is
 * due within 2 days or already overdue (remindersEnabled, max one reminder
 * per task per 24h). Notifies the new hire's linked user plus HR admins.
 *
 * Recommended schedule: daily. Configure in vercel.json crons.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';

const CRON_SECRET = process.env.CRON_SECRET || '3boxes-hrms-cron-2026';
const REMINDER_WINDOW_DAYS = 2;
const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

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

export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const searchParams = new URL(request.url).searchParams;
    // Accept the secret via query param OR Vercel Cron's Authorization: Bearer header
    const bearer = request.headers.get('authorization');
    const bearerToken = bearer?.startsWith('Bearer ') ? bearer.slice(7).trim() : null;
    if (searchParams.get('secret') !== CRON_SECRET && bearerToken !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const now = new Date();
    const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const tasks = await db.onboardingTask.findMany({
      where: {
        status: { in: ['pending', 'in_progress'] },
        remindersEnabled: true,
        dueDate: { lte: windowEnd },
        OR: [{ lastRemindedAt: null }, { lastRemindedAt: { lt: new Date(now.getTime() - REMINDER_COOLDOWN_MS) } }],
      },
      select: {
        id: true, task: true, category: true, dueDate: true, priority: true,
        employee: { select: { id: true, firstName: true, lastName: true, userId: true } },
      },
      take: 500,
    });

    let remindersSent = 0;
    const hrAdmins = await db.user.findMany({
      where: { role: { in: ['admin', 'hr_admin', 'company_hr_admin'] }, status: 'active' },
      select: { id: true },
      take: 20,
    }).catch(() => []);

    for (const t of tasks) {
      const emp = (t as Record<string, unknown>).employee as Record<string, unknown> | undefined;
      const empName = emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : 'New hire';
      const overdue = t.dueDate ? new Date(t.dueDate).getTime() < now.getTime() : false;
      const title = overdue ? `Overdue onboarding task — ${empName}` : `Onboarding task due soon — ${empName}`;
      const message = `"${t.task}" is ${overdue ? 'OVERDUE' : `due ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'soon'}`} for ${empName}.${t.priority === 'high' ? ' (High priority)' : ''}`;

      const recipients = new Set<string>(hrAdmins.map((h: { id: string }) => h.id));
      if (emp?.userId) recipients.add(String(emp.userId));

      for (const userId of recipients) {
        try {
          await (db as any).notification.create({
            data: { userId, title, message, type: overdue ? 'error' : 'warning', category: 'workflow', link: '/onboarding', isRead: false, isEmailSent: false },
          }).catch(() => null);
          remindersSent++;
        } catch { /* non-critical */ }
      }

      try { await db.onboardingTask.update({ where: { id: t.id }, data: { lastRemindedAt: now } }); } catch { /* non-critical */ }
    }

    return NextResponse.json({ success: true, tasksConsidered: tasks.length, remindersSent, checkedAt: now.toISOString() }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Onboarding reminders cron error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
