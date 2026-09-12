import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

/**
 * GET /api/collaboration/files/[id]/versions
 * Returns all versions of a file (REQ-COL-09).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { id } = await params;
    const versions = await db.fileVersion.findMany({
      where: { fileId: id, isActive: true },
      orderBy: { versionNumber: 'desc' },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      },
    });

    return NextResponse.json({ versions });
  } catch (error) {
    console.error('GET file versions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/collaboration/files/[id]/versions
 * Body: { storagePath, sizeBytes, mimeType?, changeLog? }
 *
 * Uploads a new version of the file. Increments currentVersion.
 * REQ-COL-09: Ability to download or roll back to previous versions.
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
    const { storagePath, sizeBytes, mimeType, changeLog } = body;
    if (!storagePath) return NextResponse.json({ error: 'storagePath is required' }, { status: 400 });

    const employee = await db.employee.findFirst({ where: { userId: decoded.userId } });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const file = await db.fileNode.findUnique({ where: { id } });
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    // Use a transaction: create new version + update file's currentVersion + sizeBytes
    const [newVersion, updatedFile] = await db.$transaction([
      db.fileVersion.create({
        data: {
          fileId: id,
          versionNumber: file.currentVersion + 1,
          sizeBytes: sizeBytes || 0,
          storagePath,
          mimeType,
          uploadedById: employee.id,
          changeLog: changeLog || `Version ${file.currentVersion + 1}`,
          isActive: true,
        },
      }),
      db.fileNode.update({
        where: { id },
        data: {
          currentVersion: { increment: 1 },
          sizeBytes: sizeBytes || 0,
          storagePath,
          mimeType: mimeType || file.mimeType,
        },
      }),
    ]);

    return NextResponse.json({ version: newVersion, file: updatedFile }, { status: 201 });
  } catch (error) {
    console.error('POST file versions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
