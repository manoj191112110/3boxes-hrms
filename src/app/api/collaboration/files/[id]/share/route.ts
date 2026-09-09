import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { randomBytes } from 'crypto';

/**
 * POST /api/collaboration/files/[id]/share
 * Body: { recipientEmail?, recipientUserId?, expiresAt?, passwordHash?, downloadEnabled?, watermarkEnabled? }
 *
 * Creates a shareable link for a file. REQ-SEC-EMP-04: Watermarking enabled
 * by default for sensitive files.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { recipientEmail, recipientUserId, expiresAt, downloadEnabled = true, watermarkEnabled = true } = body;

    const employee = await db.employee.findFirst({ where: { userId: decoded.userId } });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const file = await db.fileNode.findUnique({ where: { id } });
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    // Generate a random share token
    const shareToken = randomBytes(16).toString('hex');
    const shareUrl = `/s/${shareToken}`;

    const shareLink = await db.fileShareLink.create({
      data: {
        fileId: id,
        createdBy: employee.id,
        shareUrl,
        shareType: recipientEmail ? 'email' : recipientUserId ? 'user' : 'link',
        recipientEmail,
        recipientUserId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        downloadEnabled,
        watermarkEnabled,
      },
    });

    return NextResponse.json({ shareLink }, { status: 201 });
  } catch (error) {
    console.error('POST file share error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
