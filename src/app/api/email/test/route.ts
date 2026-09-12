import { NextResponse } from 'next/server';
import { sendEmail, getEmailFromAddress } from '@/lib/email';
import { getTokenFromHeaders, verifyToken } from '@/lib/auth';

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

/**
 * GET — Diagnose email configuration (admin only)
 * Returns the current email FROM address and whether the API key is configured.
 */
export async function GET(request: Request) {
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });

    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const role = (decoded.role as string) || 'employee';
    if (!['super_admin', 'tenant_admin', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403, headers: corsHeaders() });
    }

    const hasApiKey = !!process.env.RESEND_API_KEY;
    const fromAddress = getEmailFromAddress();
    const resendFromEmail = process.env.RESEND_FROM_EMAIL || null;
    const emailFrom = process.env.EMAIL_FROM || null;
    const isSandbox = fromAddress === 'onboarding@resend.dev';

    return NextResponse.json({
      configured: hasApiKey,
      fromAddress,
      isSandbox,
      resendFromEmail,
      emailFrom,
      recommendation: isSandbox
        ? 'Email is using Resend sandbox sender. Sandbox emails can ONLY be delivered to the email address registered with your Resend account. To fix: (1) Verify your sending domain at https://resend.com/domains, (2) Set RESEND_FROM_EMAIL=noreply@your-verified-domain.com in Vercel environment variables, (3) Redeploy.'
        : 'Email is configured with a custom FROM address. If emails are not being delivered, verify that the domain is verified in Resend at https://resend.com/domains',
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('[Email Test GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

/**
 * POST — Send a test email (admin only)
 * Body: { to: string }
 */
export async function POST(request: Request) {
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });

    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const role = (decoded.role as string) || 'employee';
    if (!['super_admin', 'tenant_admin', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403, headers: corsHeaders() });
    }

    const body = await request.json();
    const { to } = body;

    if (!to) {
      return NextResponse.json({ error: 'Recipient email is required' }, { status: 400, headers: corsHeaders() });
    }

    const fromAddress = getEmailFromAddress();
    const isSandbox = fromAddress === 'onboarding@resend.dev';

    const result = await sendEmail({
      to,
      subject: '3Boxes HRMS — Email Delivery Test',
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="margin: 0; color: #ffffff; font-size: 20px;">Email Delivery Test</h1>
          </div>
          <div style="background: #ffffff; padding: 24px; border: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;">
            <p style="margin: 0 0 12px; font-size: 15px; color: #1e293b;">This is a test email from <strong>3Boxes HRMS</strong>.</p>
            <p style="margin: 0 0 12px; font-size: 13px; color: #64748b;">If you received this email, your email configuration is working correctly.</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
              <tr><td style="padding: 8px 0; font-size: 13px; color: #64748b; width: 140px;">Sent from:</td><td style="padding: 8px 0; font-size: 13px; color: #1e293b; font-weight: 600;">${fromAddress}</td></tr>
              <tr><td style="padding: 8px 0; font-size: 13px; color: #64748b;">Mode:</td><td style="padding: 8px 0; font-size: 13px; color: ${isSandbox ? '#dc2626' : '#16a34a'}; font-weight: 600;">${isSandbox ? 'Sandbox (onboarding@resend.dev)' : 'Custom verified domain'}</td></tr>
              <tr><td style="padding: 8px 0; font-size: 13px; color: #64748b;">Timestamp:</td><td style="padding: 8px 0; font-size: 13px; color: #1e293b;">${new Date().toISOString()}</td></tr>
            </table>
            ${isSandbox ? `
            <div style="margin-top: 16px; padding: 12px 16px; background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px;">
              <p style="margin: 0; font-size: 12px; color: #92400e; line-height: 1.5;">
                <strong>Warning:</strong> This email was sent via the Resend sandbox. Sandbox emails can ONLY be delivered to the email address registered with your Resend account.
                To send to any recipient: verify your domain at <a href="https://resend.com/domains" style="color: #4f46e5;">resend.com/domains</a> and set <code>RESEND_FROM_EMAIL</code>.
              </p>
            </div>` : ''}
          </div>
        </div>
      `,
    });

    return NextResponse.json({
      success: result.success,
      fromAddress,
      isSandbox,
      usedFallbackFrom: result.usedFallbackFrom,
      sandboxWarning: result.sandboxWarning,
      error: result.error,
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('[Email Test POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
