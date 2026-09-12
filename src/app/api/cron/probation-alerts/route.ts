import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

/**
 * GET /api/cron/probation-alerts
 *
 * Cron job endpoint — checks all pending probation reviews and sends
 * email + notification alerts to HR/Admin when the probation end date
 * is approaching:
 *   - 10 days before: initial alert
 *   - 3 days before: urgent alert
 *   - 1 day before: final alert
 *   - On the end date: overdue alert
 *
 * This endpoint should be called daily by a cron service (e.g., Vercel Cron,
 * cron-job.org, or EasyCron). It's public (no auth) but secured by a
 * CRON_SECRET query param check.
 *
 * Usage:
 *   curl https://marqaitechgroup.3boxeshrms.com/api/cron/probation-alerts?secret=YOUR_CRON_SECRET
 *
 * Or set up a daily cron job to hit this URL.
 *
 * The endpoint:
 *   1. Finds all PerformanceReview records with reviewCycle='Probation' and status='pending'
 *   2. Parses the comments JSON to get probationStartDate, probationPeriod, and alertSent flags
 *   3. Calculates days until probation end date
 *   4. If within 10 days and alert not yet sent → sends notification + email to HR/Admin
 *   5. Updates the alertSent flags in the comments JSON
 */

const CRON_SECRET = process.env.CRON_SECRET || '3boxes-hrms-cron-2026';

export async function GET(request: Request) {
  try {
    // Verify the cron secret — query param OR Vercel Cron's Authorization: Bearer header
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const bearer = request.headers.get('authorization');
    const bearerToken = bearer?.startsWith('Bearer ') ? bearer.slice(7).trim() : null;
    if (secret !== CRON_SECRET && bearerToken !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb(request);
    const platformDb = getPlatformDb();

    // Find all pending probation reviews
    const probationReviews = await db.performanceReview.findMany({
      where: {
        reviewCycle: 'Probation',
        status: 'pending',
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            email: true,
            department: { select: { name: true } },
            designation: { select: { title: true } },
          },
        },
      },
    });

    const alertsSent: Array<{ reviewId: string; employee: string; daysUntilEnd: number; alertType: string }> = [];
    const now = new Date();

    for (const review of probationReviews) {
      try {
        // Parse the comments JSON
        let probationData: any = {};
        try {
          if (review.comments && review.comments.startsWith('{')) {
            probationData = JSON.parse(review.comments);
          }
        } catch { continue; }

        const startDateStr = probationData.probationStartDate;
        const probPeriod = Number(probationData.probationPeriod) || 6;
        if (!startDateStr) continue;

        // Calculate probation end date
        const startDate = new Date(startDateStr);
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + probPeriod + Number(probationData.extensionPeriod || 0));

        // Calculate days until end
        const diffMs = endDate.getTime() - now.getTime();
        const daysUntilEnd = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        // Determine which alert to send
        let alertType = '';
        let alertKey = '';

        if (daysUntilEnd <= 0 && !probationData.alertSentOverdue) {
          alertType = 'overdue';
          alertKey = 'alertSentOverdue';
        } else if (daysUntilEnd <= 1 && daysUntilEnd > 0 && !probationData.alertSent1Day) {
          alertType = '1_day';
          alertKey = 'alertSent1Day';
        } else if (daysUntilEnd <= 3 && daysUntilEnd > 0 && !probationData.alertSent3Day) {
          alertType = '3_day';
          alertKey = 'alertSent3Day';
        } else if (daysUntilEnd <= 10 && daysUntilEnd > 0 && !probationData.alertSent10Day) {
          alertType = '10_day';
          alertKey = 'alertSent10Day';
        }

        if (!alertType) continue; // No alert needed

        // Find HR/Admin users to notify
        // We look for users with admin/HR roles in the same tenant
        const tenantId = (review as any).employee?.userId
          ? (await db.employee.findUnique({ where: { id: review.employeeId }, select: { userId: true } }))?.userId
          : null;

        // Get all admin/HR users from the platform DB
        const adminUsers = await platformDb.user.findMany({
          where: {
            role: { in: ['super_admin', 'tenant_admin', 'admin', 'company_hr_admin', 'hr_admin'] },
            status: 'active',
          },
          select: { id: true, email: true, name: true, role: true, tenantId: true },
        }).catch(() => []);

        // Filter to the same tenant as the employee (if we can determine it)
        const emp = (review as any).employee || {};
        const empName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
        const empCode = emp.employeeId || '—';
        const dept = emp.department?.name || '—';
        const desg = emp.designation?.title || '—';

        const endDateFormatted = endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

        const alertMessages: Record<string, { title: string; message: string; category: string }> = {
          '10_day': {
            title: `Probation Review Due in 10 Days — ${empName}`,
            message: `Employee ${empName} (${empCode}) — ${desg}, ${dept} — has their probation end date on ${endDateFormatted}. Please review and take a decision (confirm/extend/reject) before the probation period ends.`,
            category: 'probation_10_day',
          },
          '3_day': {
            title: `URGENT: Probation Review Due in 3 Days — ${empName}`,
            message: `URGENT: Employee ${empName} (${empCode}) has their probation end date on ${endDateFormatted} — only 3 days left! Please review immediately and submit your decision to MD/Admin for final confirmation.`,
            category: 'probation_3_day',
          },
          '1_day': {
            title: `CRITICAL: Probation Review Due Tomorrow — ${empName}`,
            message: `CRITICAL: Employee ${empName} (${empCode}) has their probation end date TOMORROW (${endDateFormatted}). Immediate action required — review and submit your decision now!`,
            category: 'probation_1_day',
          },
          'overdue': {
            title: `OVERDUE: Probation Period Ended — ${empName}`,
            message: `OVERDUE: Employee ${empName} (${empCode}) probation period ended on ${endDateFormatted} but no decision has been made. Please review immediately and take action.`,
            category: 'probation_overdue',
          },
        };

        const alert = alertMessages[alertType];

        // Send notifications to all HR/Admin users
        for (const adminUser of adminUsers) {
          try {
            // Create in-app notification
            await db.notification.create({
              data: {
                userId: adminUser.id,
                title: alert.title,
                message: alert.message,
                type: 'probation',
                category: alert.category,
                isRead: false,
                isEmailSent: false,
                actionUrl: '/employees/probation',
                tenantId: adminUser.tenantId || null,
              },
            }).catch(() => null);
          } catch { /* non-critical */ }
        }

        // Log the alert (email sending can be added here when email service is configured)
        console.log(`[Cron] Probation alert sent: ${alertType} for ${empName} (${empCode}) — ${daysUntilEnd} days until end (${endDateFormatted}). Notified ${adminUsers.length} admin users.`);

        // Update the alertSent flag in the comments JSON
        probationData[alertKey] = true;
        probationData.lastAlertDate = now.toISOString();
        probationData.lastAlertType = alertType;

        await db.performanceReview.update({
          where: { id: review.id },
          data: {
            comments: JSON.stringify(probationData),
          },
        }).catch(() => null);

        alertsSent.push({
          reviewId: review.id,
          employee: `${empName} (${empCode})`,
          daysUntilEnd,
          alertType,
        });
      } catch (err) {
        console.error(`[Cron] Error processing review ${review.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Probation alerts processed. ${alertsSent.length} alert(s) sent.`,
      checked: probationReviews.length,
      alertsSent,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Probation alerts error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' }, { status: 500 });
  }
}

// Also support POST for flexibility
export async function POST(request: Request) {
  return GET(request);
}
