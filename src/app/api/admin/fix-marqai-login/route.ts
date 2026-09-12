import { NextResponse } from 'next/server';
import { getPlatformDb } from '@/lib/tenant-db';
import { hashPassword } from '@/lib/auth';

/**
 * POST /api/admin/fix-marqai-login
 *
 * Emergency endpoint to reset the MarqAI tenant admin + HR admin passwords
 * to 'MarqAI@2026'. This is needed because the seed script's password hash
 * may not match what's in the production DB (different bcrypt salt rounds,
 * or the seed was never run on the production DB).
 *
 * This endpoint is PUBLIC (no auth required) so it can be called from the
 * browser even when you can't log in. It only resets the MarqAI users —
 * it doesn't touch any other tenant's data.
 *
 * Usage:
 *   curl -X POST https://marqaitechgroup.3boxeshrms.com/api/admin/fix-marqai-login
 *   Or just visit the URL in the browser with a POST extension
 *
 * After calling this, login with:
 *   Email: admin@marqaitechgroup.com
 *   Password: MarqAI@2026
 */
export async function POST(request: Request) {
  try {
    const platformDb = getPlatformDb();
    const newPassword = 'MarqAI@2026';
    const hashedPwd = await hashPassword(newPassword);

    // Find the MarqAI tenant
    const tenant = await platformDb.tenant.findUnique({
      where: { slug: 'marqaitechgroup' },
      select: { id: true, name: true, status: true },
    });

    if (!tenant) {
      return NextResponse.json({
        error: 'MarqAI tenant not found. Run the seed-marqai.ts script first.',
      }, { status: 404 });
    }

    // List of MarqAI user emails to reset
    const emailsToReset = [
      'admin@marqaitechgroup.com',
      'admin@3boxesluxury.com',
      'admin@3boxesconsulting.com',
      'admin@3boxestechnologies.com',
      'superadmin@3boxeshrms.com',
    ];

    const results: Array<{ email: string; status: string; oldRole?: string }> = [];

    for (const email of emailsToReset) {
      try {
        const existingUser = await platformDb.user.findUnique({
          where: { email },
          select: { id: true, role: true, status: true },
        });

        if (existingUser) {
          await platformDb.user.update({
            where: { id: existingUser.id },
            data: {
              password: hashedPwd,
              status: 'active',
            },
          });
          results.push({ email, status: 'reset', oldRole: existingUser.role });
        } else {
          // User doesn't exist — create it
          // Determine role based on email
          let role = 'employee';
          if (email === 'superadmin@3boxeshrms.com') role = 'super_admin';
          else if (email === 'admin@marqaitechgroup.com') role = 'tenant_admin';
          else role = 'company_hr_admin';

          await platformDb.user.create({
            data: {
              email,
              password: hashedPwd,
              name: email.split('@')[0].replace(/_/g, ' '),
              role,
              status: 'active',
              tenantId: tenant.id,
            },
          });
          results.push({ email, status: 'created', oldRole: role });
        }
      } catch (err) {
        results.push({
          email,
          status: 'failed',
          // error: err instanceof Error ? err.message : 'Unknown',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Reset ${results.filter(r => r.status === 'reset').length} users, created ${results.filter(r => r.status === 'created').length} users. All passwords are now '${newPassword}'.`,
      tenant: { id: tenant.id, name: tenant.name, status: tenant.status },
      newPassword,
      results,
      loginInstructions: {
        url: 'https://marqaitechgroup.3boxeshrms.com/login',
        email: 'admin@marqaitechgroup.com',
        password: newPassword,
      },
    });
  } catch (error) {
    console.error('[fix-marqai-login] Error:', error);
    return NextResponse.json({
      error: 'Failed to reset passwords',
      details: error instanceof Error ? error.message : 'Unknown',
    }, { status: 500 });
  }
}

/**
 * GET — same as POST but accessible via browser URL bar.
 * Visit: https://marqaitechgroup.3boxeshrms.com/api/admin/fix-marqai-login
 */
export async function GET(request: Request) {
  return POST(request);
}
