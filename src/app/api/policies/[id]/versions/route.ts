/**
 * Policy Document Version History API
 *
 *   GET /api/policies/[id]/versions   — list archived versions of a policy
 *
 * Whenever a policy is updated via PUT /api/policies, the previous snapshot
 * (including the attached PDF/DOCX) is archived into PolicyDocumentVersion.
 * This endpoint exposes that history so admins can retrieve or download an
 * older copy of the policy document.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { getAuthInfo } from '@/lib/companyScope';

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(req);
  try {
    const auth = await getAuthInfo(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });

    const { id } = await params;
    const policy = await db.policy.findUnique({
      where: { id },
      select: { id: true, title: true, version: true },
    });
    if (!policy) return NextResponse.json({ error: 'Policy not found' }, { status: 404, headers: corsHeaders() });

    const versions = await (db as any).policyDocumentVersion?.findMany({
      where: { policyId: id },
      orderBy: { versionNumber: 'desc' },
      take: 50,
      select: {
        id: true, policyId: true, versionNumber: true, version: true, title: true,
        description: true, fileName: true, fileSize: true, fileMimeType: true,
        changeNote: true, archivedById: true, archivedAt: true, fileUrl: true,
      },
    }) || [];

    return NextResponse.json({
      policy: { id: policy.id, title: policy.title, currentVersion: policy.version },
      versions,
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Policy versions GET error:', error);
    return NextResponse.json({ versions: [] }, { headers: corsHeaders() });
  }
}
