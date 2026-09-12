import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { hashPassword, getTokenFromHeaders, verifyToken } from '@/lib/auth';
import { getDataScope } from '@/lib/roleAccess';
import { sendEmail } from '@/lib/email';

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

/** Generate a strong random password */
function generateRandomPassword(length = 12): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;
  let pwd = '';
  pwd += upper[Math.floor(Math.random() * upper.length)];
  pwd += lower[Math.floor(Math.random() * lower.length)];
  pwd += digits[Math.floor(Math.random() * digits.length)];
  pwd += special[Math.floor(Math.random() * special.length)];
  for (let i = pwd.length; i < length; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }
  return pwd.split('').sort(() => Math.random() - 0.5).join('');
}

/** Build invite email HTML template */
function buildInviteEmailHtml(params: {
  employeeName: string;
  email: string;
  password: string;
  loginUrl: string;
  tenantName: string;
  tenantLogo: string | null;
  adminName: string;
}): string {
  const { employeeName, email, password, loginUrl, tenantName, tenantLogo, adminName } = params;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:32px 40px;text-align:center;">
            ${tenantLogo ? `<img src="${tenantLogo}" alt="${tenantName}" style="height:36px;margin-bottom:12px;border-radius:6px;" />` : ''}
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Welcome to ${tenantName} HRMS</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Your login credentials are ready</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 16px;font-size:16px;color:#1e293b;">Hi <strong>${employeeName}</strong>,</p>
            <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">
              ${adminName} has invited you to join the <strong>${tenantName}</strong> HRMS platform.
              You can now access your employee dashboard, apply for leave, view payslips, and more.
            </p>
            <!-- Credentials Card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:24px;">
              <tr><td style="padding:20px 24px;">
                <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Your Login Credentials</p>
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:4px 0;font-size:14px;color:#64748b;width:100px;">Email:</td>
                    <td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600;">${email}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;font-size:14px;color:#64748b;">Password:</td>
                    <td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600;font-family:'Courier New',monospace;background:#e0e7ff;padding:2px 8px;border-radius:4px;">${password}</td>
                  </tr>
                </table>
              </td></tr>
            </table>
            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);border-radius:8px;padding:0;">
                  <a href="${loginUrl}" style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">Login to HRMS &rarr;</a>
                </td>
              </tr>
            </table>
            <p style="margin:20px 0 0;font-size:13px;color:#94a3b8;text-align:center;">
              If the button doesn't work, copy and paste this link:<br/>
              <a href="${loginUrl}" style="color:#4f46e5;word-break:break-all;">${loginUrl}</a>
            </p>
          </td>
        </tr>
        <!-- Security Notice -->
        <tr>
          <td style="padding:0 40px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
              <tr><td style="padding:16px 20px;">
                <p style="margin:0;font-size:12px;color:#92400e;line-height:1.5;">
                  <strong>Security Notice:</strong> Please change your password after your first login.
                  Never share your credentials with anyone. If you did not expect this invitation,
                  please contact your HR administrator.
                </p>
              </td></tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">
              Powered by <strong>3Boxes HRMS</strong> &middot; People &middot; Process &middot; Technology<br/>
              A Proud Product of Marq AI Tech Pvt Ltd
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** POST — Send invite emails to employees with login credentials */
export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });

    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const { employeeIds, mode, generateNewPassword, customMessage } = body;

    if (!mode || !['selected', 'all'].includes(mode)) {
      return NextResponse.json({ error: 'mode must be selected or all' }, { status: 400, headers: corsHeaders() });
    }
    if (mode === 'selected' && (!employeeIds || employeeIds.length === 0)) {
      return NextResponse.json({ error: 'selected mode requires employeeIds' }, { status: 400, headers: corsHeaders() });
    }

    // Get admin info
    const admin = await db.user.findUnique({
      where: { id: decoded.userId as string },
      select: { id: true, name: true, role: true, tenantId: true, tenant: { select: { id: true, name: true, slug: true, domain: true, logo: true } } },
    });
    if (!admin) return NextResponse.json({ error: 'Admin not found' }, { status: 404, headers: corsHeaders() });

    // Build where clause — SAME approach as /api/employees (using getDataScope)
    const scope = getDataScope(admin.role);
    const where: Record<string, unknown> = {};

    if (mode === 'selected') {
      where.id = { in: employeeIds };
    }

    // Data scope filtering — same as /api/employees and /api/employees/credentials GET
    if (scope === 'self' && admin.id) {
      where.userId = admin.id;
    } else if (scope === 'team' && admin.id) {
      const ownEmp = await db.employee.findFirst({
        where: { userId: admin.id, status: 'active' },
        select: { departmentId: true },
      });
      if (ownEmp) {
        where.departmentId = ownEmp.departmentId;
      }
    }
    // scope === 'all' → no additional filtering (tenant_admin, admin, super_admin can see all)

    const employees = await db.employee.findMany({
      where,
      select: { id: true, employeeId: true, firstName: true, lastName: true, email: true, userId: true, phone: true, user: { select: { id: true, role: true } } },
    });

    if (employees.length === 0) {
      return NextResponse.json({ error: 'No employees found' }, { status: 404, headers: corsHeaders() });
    }

    const loginUrl = admin.tenant?.domain
      ? `https://${admin.tenant.domain}/login`
      : `https://${admin.tenant?.slug || 'app'}.3boxeshrms.com/login`;

    const results: Array<{
      employeeId: string;
      name: string;
      email: string;
      password: string;
      success: boolean;
      emailSent: boolean;
      error?: string;
      /** If true, the email was sent using the Resend sandbox sender (onboarding@resend.dev)
       *  because the admin's configured FROM domain was not verified. The email was likely
       *  ONLY delivered to the Resend account holder — not to the intended employee. */
      usedFallbackFrom?: boolean;
      /** Human-readable warning explaining the sandbox limitation, for display in the UI. */
      emailWarning?: string;
    }> = [];

    for (const emp of employees) {
      try {
        // Ensure employee has a user account
        let userAccount = emp.userId
          ? await db.user.findUnique({ where: { id: emp.userId } })
          : null;

        let pwd = '';

        if (generateNewPassword || !userAccount) {
          pwd = generateRandomPassword();
          const hashedPwd = await hashPassword(pwd);

          if (userAccount) {
            // Reset password
            await db.user.update({
              where: { id: userAccount.id },
              data: { password: hashedPwd, status: 'active' },
            });
          } else {
            // Check if user already exists with this email
            const existingUser = await db.user.findUnique({ where: { email: emp.email } });
            if (existingUser) {
              await db.user.update({
                where: { id: existingUser.id },
                data: { password: hashedPwd, status: 'active' },
              });
              await db.employee.update({
                where: { id: emp.id },
                data: { userId: existingUser.id },
              });
              userAccount = existingUser;
            } else {
              // Use the employee's assigned role (from their User account) if available,
              // otherwise default to 'employee'
              const employeeRole = emp.user?.role || 'employee';
              const newUser = await db.user.create({
                data: {
                  email: emp.email,
                  password: hashedPwd,
                  name: `${emp.firstName} ${emp.lastName}`,
                  role: employeeRole,
                  tenantId: admin.tenantId,
                  status: 'active',
                },
              });
              await db.employee.update({
                where: { id: emp.id },
                data: { userId: newUser.id },
              });
              userAccount = newUser;
            }
          }
        }

        // Build and send the invite email
        const emailHtml = buildInviteEmailHtml({
          employeeName: `${emp.firstName} ${emp.lastName}`,
          email: emp.email,
          password: pwd || '••••••••',
          loginUrl,
          tenantName: admin.tenant?.name || '3Boxes HRMS',
          tenantLogo: admin.tenant?.logo || null,
          adminName: admin.name,
        });

        const emailResult = await sendEmail({
          to: emp.email,
          subject: `You're invited to join ${admin.tenant?.name || '3Boxes HRMS'} HRMS`,
          html: emailHtml,
        });

        // ─── Mark credentials as 'invited' on the Employee record ───
        // Without this, the employee still shows as "No Account" in the
        // Login Credentials settings tab even after the invite was sent
        // and a User account was created/reset above. The credentialsStatus
        // column is the source-of-truth for the settings page metrics.
        await db.$executeRawUnsafe(
          `UPDATE "Employee" SET "credentialsStatus" = 'invited', "credentialsInvitedAt" = NOW(), "credentialsInvitedBy" = $1, "updatedAt" = NOW() WHERE "id" = $2`,
          admin.id,
          emp.id,
        ).catch(() => null);

        console.log(
          `[INVITE] Invite ${emailResult.success ? 'sent' : 'failed'} for ${emp.email} (tenant: ${admin.tenant?.name})` +
          `${emailResult.usedFallbackFrom ? ' [FALLBACK FROM — sandbox sender used]' : ''}`,
        );

        const resultEntry: (typeof results)[number] = {
          employeeId: emp.employeeId,
          name: `${emp.firstName} ${emp.lastName}`,
          email: emp.email,
          password: pwd,
          success: true,
          emailSent: emailResult.success,
          error: emailResult.error,
        };

        // If the email was sent using the Resend sandbox fallback, flag it
        // so the UI can warn the admin that the employee likely didn't receive it.
        if (emailResult.usedFallbackFrom) {
          resultEntry.usedFallbackFrom = true;
          resultEntry.emailWarning = emailResult.sandboxWarning
            || 'Email was sent via Resend sandbox and was likely only delivered to the Resend account holder — not to this employee. Verify your sending domain at https://resend.com/domains and set RESEND_FROM_EMAIL.';
        }

        results.push(resultEntry);
      } catch (err) {
        results.push({
          employeeId: emp.employeeId,
          name: `${emp.firstName} ${emp.lastName}`,
          email: emp.email,
          password: '',
          success: false,
          emailSent: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const emailSentCount = results.filter(r => r.emailSent).length;
    const fallbackCount = results.filter(r => r.usedFallbackFrom).length;

    // Build a response that includes an admin-level warning if any emails used the sandbox fallback
    const response: Record<string, unknown> = {
      message: `Invites processed: ${successCount}/${results.length} successful, ${emailSentCount} emails sent`,
      results,
      summary: {
        total: results.length,
        succeeded: successCount,
        emailsSent: emailSentCount,
        failed: results.length - successCount,
        /** Number of emails that went through the sandbox fallback — these were
         *  likely NOT delivered to the intended employees. */
        fallbackSent: fallbackCount,
      },
    };

    // If ANY email used the sandbox fallback, add a top-level admin warning
    // so the UI can display a prominent notice to the administrator.
    if (fallbackCount > 0) {
      response.adminWarning =
        `${fallbackCount} invite email(s) were sent via the Resend sandbox sender (onboarding@resend.dev) ` +
        `because your configured FROM domain is not verified. Sandbox emails can ONLY be delivered to the ` +
        `email address registered with your Resend account — the intended employees did NOT receive them. ` +
        `To fix this: (1) Verify your sending domain at https://resend.com/domains, ` +
        `(2) Set the RESEND_FROM_EMAIL environment variable to an address on your verified domain, ` +
        `(3) Redeploy your application.`;
    }

    return NextResponse.json(response, { headers: corsHeaders() });
  } catch (error) {
    console.error('[Invite POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
