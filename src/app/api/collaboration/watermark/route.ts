import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * POST /api/collaboration/watermark
 * Body: { fileId, accessType: 'view'|'download'|'print' }
 *
 * REQ-SEC-EMP-04: Contextual Watermarking
 *   When viewing sensitive documents (like payslips or contracts) in the
 *   File Hub, a dynamic watermark must appear over the document showing
 *   the logged-in user's email and timestamp to prevent screen-share leaks.
 *
 * This endpoint LOGS the access (creating the watermark text) so we have
 * an audit trail. The actual watermark overlay is applied client-side
 * (rendered over the document in the browser).
 */
export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { fileId, accessType = 'view' } = body;
    if (!fileId) return NextResponse.json({ error: 'fileId is required' }, { status: 400 });

    const employee = await db.employee.findFirst({ where: { userId: decoded.userId } });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const file = await db.fileNode.findUnique({ where: { id: fileId } });
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    // Construct the watermark text
    const timestamp = new Date().toISOString();
    const watermarkText = `${employee.email} · ${timestamp}`;

    // Log the access (REQ-SEC-EMP-04 audit trail)
    const log = await db.watermarkAccessLog.create({
      data: {
        fileId,
        userId: employee.id,
        userEmail: employee.email,
        userIp: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        userAgent: request.headers.get('user-agent') || null,
        watermarkText,
        accessType,
      },
    });

    // Increment share link access count if accessed via a share link
    // (not implemented here — share link access is a separate flow)

    return NextResponse.json({
      watermarkText,
      logId: log.id,
      // Client uses this to render the watermark overlay
      instructions: 'Render this text as a semi-transparent overlay on top of the document.',
    });
  } catch (error) {
    console.error('POST watermark error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
