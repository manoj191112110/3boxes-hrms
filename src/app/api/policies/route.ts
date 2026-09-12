import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { getCompanyFilter, getAuthInfo, resolveCompanyScope } from '@/lib/companyScope';
import { sanitizeMultiLineText } from '@/lib/sanitize';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

/** Validate + normalize the attached policy document fields from a request body */
function extractPolicyFileFields(body: Record<string, unknown>) {
  const fileUrl = typeof body.fileUrl === 'string' ? body.fileUrl.trim() : '';
  const fileName = typeof body.fileName === 'string' ? body.fileName.trim().slice(0, 255) : '';
  const fileMimeType = typeof body.fileMimeType === 'string' ? body.fileMimeType.trim().slice(0, 100) : '';
  const rawSize = Number(body.fileSize);
  const fileSize = Number.isFinite(rawSize) && rawSize > 0 ? Math.round(rawSize) : null;

  if (fileUrl && !/^(https?:\/\/|data:)/i.test(fileUrl)) {
    return { error: 'fileUrl must be a valid http(s) or data URL' } as const;
  }
  // Guard: reject absurd data URLs (serverless request bodies are capped anyway)
  if (fileUrl.startsWith('data:') && fileUrl.length > 5 * 1024 * 1024) {
    return { error: 'Attached document is too large. Maximum file size is 3MB.' } as const;
  }
  return {
    fileUrl: fileUrl || null,
    fileName: fileName || null,
    fileSize,
    fileMimeType: fileMimeType || null,
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function GET(req: NextRequest) {
  const db = await getDb(req);
  try {
    const companyFilter = await getCompanyFilter(req);
    if (companyFilter === null) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const url = new URL(req.url);
    const category = url.searchParams.get('category');
    const status = url.searchParams.get('status');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '100');

    const where: Record<string, unknown> = { ...companyFilter };
    if (category) where.category = category;
    if (status) where.status = status;

    const policies = await db.policy.findMany({
      where,
      orderBy: { title: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await db.policy.count({ where });

    return NextResponse.json({
      data: policies,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Policies GET error:', error);
    return NextResponse.json({
      data: [],
      pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
    }, { headers: corsHeaders() });
  }
}

export async function POST(req: NextRequest) {
  const db = await getDb(req);
  try {
    const auth = await getAuthInfo(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const body = await req.json();
    const { title, category, description, content, version, status, effectiveDate, expiryDate, companyId } = body;

    if (!title || !category || !description) {
      return NextResponse.json({ error: 'Title, category, and description are required' }, { status: 400, headers: corsHeaders() });
    }

    const fileFields = extractPolicyFileFields(body);
    if ('error' in fileFields) {
      return NextResponse.json({ error: fileFields.error }, { status: 400, headers: corsHeaders() });
    }

    // Resolve companyId: from body, from user's scope, or from ownCompanyId
    let resolvedCompanyId = companyId;
    if (!resolvedCompanyId) {
      const companyFilter = await getCompanyFilter(req);
      if (companyFilter && 'companyId' in companyFilter) {
        resolvedCompanyId = companyFilter.companyId as string;
      }
    }
    // Fallback: use the caller's own company (for admins without a selection)
    if (!resolvedCompanyId) {
      const scope = await resolveCompanyScope(req);
      if (scope?.ownCompanyId) {
        resolvedCompanyId = scope.ownCompanyId;
      }
    }

    if (!resolvedCompanyId) {
      return NextResponse.json({ error: 'Company ID is required. Please select a company from the switcher.' }, { status: 400, headers: corsHeaders() });
    }

    const policy = await db.policy.create({
      data: {
        title: sanitizeMultiLineText(title, 200),
        category,
        description: sanitizeMultiLineText(description, 2000),
        content: content ? String(content) : null,
        version: version || '1.0',
        status: status || 'active',
        effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        companyId: resolvedCompanyId,
        fileUrl: fileFields.fileUrl,
        fileName: fileFields.fileName,
        fileSize: fileFields.fileSize,
        fileMimeType: fileFields.fileMimeType,
      },
    });

    return NextResponse.json({ policy }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Policies POST error:', error);
    return NextResponse.json({ error: 'Failed to create policy' }, { status: 500, headers: corsHeaders() });
  }
}

export async function PUT(req: NextRequest) {
  const db = await getDb(req);
  try {
    const auth = await getAuthInfo(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const body = await req.json();
    const { id, ...rest } = body;

    if (!id) {
      return NextResponse.json({ error: 'Policy ID is required' }, { status: 400, headers: corsHeaders() });
    }

    // Whitelist updatable fields (prevents mass-assignment of company/auth fields)
    const updateData: Record<string, unknown> = {};
    for (const key of ['title', 'category', 'description', 'content', 'version', 'status', 'effectiveDate', 'expiryDate']) {
      if (rest[key] !== undefined) updateData[key] = rest[key];
    }
    // Attached policy document (only touched when the client sends file fields)
    if (rest.fileUrl !== undefined || rest.fileName !== undefined || rest.fileSize !== undefined || rest.fileMimeType !== undefined) {
      const fileFields = extractPolicyFileFields(rest);
      if ('error' in fileFields) {
        return NextResponse.json({ error: fileFields.error }, { status: 400, headers: corsHeaders() });
      }
      updateData.fileUrl = fileFields.fileUrl;
      updateData.fileName = fileFields.fileName;
      updateData.fileSize = fileFields.fileSize;
      updateData.fileMimeType = fileFields.fileMimeType;
    }

    if (updateData.effectiveDate) {
      updateData.effectiveDate = new Date(updateData.effectiveDate as string);
    }
    if (updateData.expiryDate) {
      updateData.expiryDate = new Date(updateData.expiryDate as string);
    }

    const existing = await db.policy.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404, headers: corsHeaders() });
    }

    // Non-admin users can only update policies in their own company
    const companyFilter = await getCompanyFilter(req);
    if (companyFilter && 'companyId' in companyFilter && existing.companyId !== companyFilter.companyId) {
      return NextResponse.json({ error: 'Forbidden: cannot modify policy outside your company' }, { status: 403, headers: corsHeaders() });
    }

    // ─── Version history: archive the PREVIOUS snapshot before overwriting ───
    // Only archive when something material actually changed (title, description,
    // content, version label, or the attached document). This keeps the previous
    // PDF/DOCX downloadable even after the policy is updated.
    const materialKeys = ['title', 'description', 'content', 'version', 'fileUrl', 'fileName', 'fileSize', 'fileMimeType'] as const;
    const changed = materialKeys.some((k) =>
      updateData[k] !== undefined && String(updateData[k] ?? '') !== String((existing as Record<string, unknown>)[k] ?? '')
    );
    if (changed) {
      const prevCount = await (db as any).policyDocumentVersion?.count({ where: { policyId: id } }) ?? 0;
      await (db as any).policyDocumentVersion?.create({
        data: {
          policyId: id,
          versionNumber: prevCount + 1,
          version: existing.version || '1.0',
          title: existing.title,
          description: existing.description,
          fileName: existing.fileName,
          fileUrl: existing.fileUrl,
          fileSize: existing.fileSize,
          fileMimeType: existing.fileMimeType,
          changeNote: typeof rest.changeNote === 'string' ? sanitizeMultiLineText(rest.changeNote, 300) : null,
          archivedById: auth.userId,
        },
      }).catch(() => null);
    }

    const policy = await db.policy.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ policy }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Policies PUT error:', error);
    return NextResponse.json({ error: 'Failed to update policy' }, { status: 500, headers: corsHeaders() });
  }
}

export async function DELETE(req: NextRequest) {
  const db = await getDb(req);
  try {
    const auth = await getAuthInfo(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Policy ID is required' }, { status: 400, headers: corsHeaders() });
    }

    const existing = await db.policy.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404, headers: corsHeaders() });
    }

    // Non-admin users can only delete policies in their own company
    const companyFilter = await getCompanyFilter(req);
    if (companyFilter && 'companyId' in companyFilter && existing.companyId !== companyFilter.companyId) {
      return NextResponse.json({ error: 'Forbidden: cannot delete policy outside your company' }, { status: 403, headers: corsHeaders() });
    }

    await db.policy.delete({ where: { id } });
    return NextResponse.json({ message: 'Policy deleted' }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Policies DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete policy' }, { status: 500, headers: corsHeaders() });
  }
}
