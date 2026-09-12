import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { scanContentForPII } from '@/lib/dlp';

/**
 * GET /api/collaboration/files?driveType=personal|project|company&projectId=xxx&companyId=xxx&parentId=xxx
 *
 * REQ-COL-08: Granular Storage Hierarchies
 *   - Personal Drive: visible only to employee + manager
 *   - Project Drive: visible to all project members
 *   - Company Drive: visible to all employees of a sub-company
 */
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const driveType = searchParams.get('driveType') || 'personal';
    const projectId = searchParams.get('projectId');
    const companyId = searchParams.get('companyId');
    const parentId = searchParams.get('parentId') || null;

    const employee = await db.employee.findFirst({ where: { userId: decoded.userId } });
    if (!employee) return NextResponse.json({ files: [] });

    const where: Record<string, unknown> = {
      driveType,
      parentId,
      isActive: true,
    };

    if (driveType === 'personal') {
      where.ownerEmployeeId = employee.id;
    } else if (driveType === 'project') {
      where.projectId = projectId;
    } else if (driveType === 'company') {
      where.companyId = companyId;
    }

    const files = await db.fileNode.findMany({
      where,
      orderBy: [{ nodeType: 'asc' }, { name: 'asc' }], // folders first
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        _count: { select: { versions: true, shareLinks: true } },
      },
    });

    return NextResponse.json({ files });
  } catch (error) {
    console.error('GET files error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/collaboration/files
 * Body: { name, driveType, projectId?, companyId?, parentId?, nodeType: 'file'|'folder', mimeType?, sizeBytes?, storagePath?, description?, watermarkEnabled? }
 *
 * REQ-COL-09: Versioning — first version auto-created
 * REQ-SEC-EMP-01: DLP scan on file name + description
 * REQ-SEC-EMP-04: Watermark enabled per file
 */
export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const {
      name, driveType, projectId, companyId, parentId, nodeType = 'file',
      mimeType, sizeBytes = 0, storagePath, description, watermarkEnabled = false,
      changeLog,
    } = body;

    if (!name || !driveType) return NextResponse.json({ error: 'name and driveType are required' }, { status: 400 });
    if (!['personal', 'project', 'company'].includes(driveType)) {
      return NextResponse.json({ error: 'Invalid driveType' }, { status: 400 });
    }
    if (driveType === 'project' && !projectId) {
      return NextResponse.json({ error: 'projectId required for project drive' }, { status: 400 });
    }
    if (driveType === 'company' && !companyId) {
      return NextResponse.json({ error: 'companyId required for company drive' }, { status: 400 });
    }

    const employee = await db.employee.findFirst({ where: { userId: decoded.userId } });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    // REQ-SEC-EMP-01: DLP scan on name + description
    const dlpContent = `${name}\n${description || ''}`;
    const dlpResult = scanContentForPII(dlpContent);

    let dlpScanStatus = 'clean';
    let dlpFlags: string | null = null;
    if (dlpResult.action === 'block') {
      await db.dLPScanLog.create({
        data: {
          sourceType: 'file_upload',
          sourceId: 'pending',
          userId: employee.id,
          patterns: JSON.stringify(dlpResult.patterns),
          riskScore: dlpResult.riskScore,
          action: 'block',
          reasonText: dlpResult.reason,
        },
      });
      return NextResponse.json({
        error: 'File upload blocked by DLP policy',
        reason: dlpResult.reason,
      }, { status: 422 });
    }
    if (dlpResult.action === 'flag') {
      dlpScanStatus = 'flagged';
      dlpFlags = JSON.stringify(dlpResult.patterns);
    }

    // Create file node + initial version in a transaction
    const file = await db.fileNode.create({
      data: {
        name,
        driveType,
        ownerEmployeeId: driveType === 'personal' ? employee.id : null,
        projectId: driveType === 'project' ? projectId : null,
        companyId: driveType === 'company' ? companyId : null,
        parentId: parentId || null,
        nodeType,
        mimeType,
        sizeBytes,
        storagePath,
        currentVersion: 1,
        dlpScanStatus,
        dlpFlags,
        watermarkEnabled,
        description,
        uploadedById: employee.id,
        versions: nodeType === 'file' ? {
          create: {
            versionNumber: 1,
            sizeBytes,
            storagePath: storagePath || '',
            mimeType,
            uploadedById: employee.id,
            changeLog: changeLog || 'Initial upload',
            isActive: true,
          },
        } : undefined,
      },
      include: { versions: true },
    });

    // Log DLP flag if applicable
    if (dlpResult.action === 'flag') {
      await db.dLPScanLog.create({
        data: {
          sourceType: 'file_upload',
          sourceId: file.id,
          userId: employee.id,
          patterns: JSON.stringify(dlpResult.patterns),
          riskScore: dlpResult.riskScore,
          action: 'flag',
          reasonText: dlpResult.reason,
        },
      });
    }

    return NextResponse.json({ file }, { status: 201 });
  } catch (error) {
    console.error('POST files error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
