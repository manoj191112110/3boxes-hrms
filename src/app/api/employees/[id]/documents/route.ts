/**
 * Employee Documents API — upload, list, request, delete
 *
 *   GET    /api/employees/[id]/documents          — list all docs for an employee
 *   POST   /api/employees/[id]/documents          — upload a new document (JSON with fileUrl)
 *   POST   /api/employees/[id]/documents?action=request — HR requests a document from employee
 *
 * Document categories (centralized document management):
 *   identification  — passports, driver's licenses, national ID, Aadhaar, PAN, visa
 *   onboarding      — offer letters, employment contracts, NDAs, job descriptions
 *   qualifications  — educational certificates, professional licenses, training proofs
 *   financial       — tax forms, PAN/social security, banking info
 *   lifecycle       — appraisal reports, promotion letters, confirmation letters, exit docs
 *   other           — misc
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { getAuthInfo } from '@/lib/companyScope';
import { sanitizeMultiLineText } from '@/lib/sanitize';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

const VALID_CATEGORIES = ['identification', 'onboarding', 'qualifications', 'financial', 'lifecycle', 'other'];
const VALID_TYPES = ['offer_letter', 'id_proof', 'contract', 'certificate', 'policy', 'aadhaar', 'pan_card', 'bank_proof', 'passport', 'visa', 'education', 'experience', 'medical', 'other'];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(req);
  try {
    const auth = await getAuthInfo(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const { id } = await params;

    const documents = await db.document.findMany({
      where: { employeeId: id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ documents }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Employee docs GET error:', error);
    return NextResponse.json({ documents: [] }, { headers: corsHeaders() });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(req);
  try {
    const auth = await getAuthInfo(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const { id } = await params;
    const body = await req.json();
    const action = body.action as string | undefined;

    // ─── Document Request mode (HR requests a document from employee) ───
    if (action === 'request') {
      if (!['super_admin', 'tenant_admin', 'admin', 'hr_admin'].includes(auth.role)) {
        return NextResponse.json({ error: 'Admin only' }, { status: 403, headers: corsHeaders() });
      }
      const name = sanitizeMultiLineText(body.name, 200);
      const category = VALID_CATEGORIES.includes(String(body.category)) ? String(body.category) : 'other';
      const type = VALID_TYPES.includes(String(body.type)) ? String(body.type) : 'other';
      const requiredFormat = body.requiredFormat || 'pdf';
      const maxFileSizeMb = Math.max(1, Math.min(50, Number(body.maxFileSizeMb) || 10));
      const description = sanitizeMultiLineText(body.description, 500);
      if (!name) return NextResponse.json({ error: 'Document name is required' }, { status: 400, headers: corsHeaders() });

      const doc = await db.document.create({
        data: {
          employeeId: id,
          name,
          type,
          category,
          status: 'requested',
          description,
          isRequested: true,
          requestedById: auth.userId,
          requestedAt: new Date(),
          requiredFormat,
          maxFileSizeMb,
        },
      });
      return NextResponse.json({ document: doc }, { status: 201, headers: corsHeaders() });
    }

    // ─── Upload mode (employee or admin uploads a document) ───
    // fileUrl is optional: a document entry may represent a physical/offline
    // document (e.g. collected during onboarding) with no digital file yet.
    const name = sanitizeMultiLineText(body.name, 200);
    const fileUrl = String(body.fileUrl || '');
    const category = VALID_CATEGORIES.includes(String(body.category)) ? String(body.category) : 'other';
    const type = VALID_TYPES.includes(String(body.type)) ? String(body.type) : 'other';
    const description = sanitizeMultiLineText(body.description, 500);
    const expiryDate = body.expiryDate ? new Date(body.expiryDate) : null;
    const fileNodeId = body.fileNodeId ? String(body.fileNodeId) : null;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400, headers: corsHeaders() });
    }
    if (fileUrl && !/^(https?:\/\/|data:)/i.test(fileUrl)) {
      return NextResponse.json({ error: 'fileUrl must be a valid http(s) or data URL' }, { status: 400, headers: corsHeaders() });
    }
    if (expiryDate && isNaN(expiryDate.getTime())) {
      return NextResponse.json({ error: 'Invalid expiry date' }, { status: 400, headers: corsHeaders() });
    }

    const doc = await db.document.create({
      data: {
        employeeId: id,
        name,
        type,
        category,
        fileUrl: fileUrl || null,
        description,
        expiryDate,
        status: 'active',
        fileNodeId,
        uploadedById: auth.userId,
        uploadedAt: new Date(),
      },
    });
    return NextResponse.json({ document: doc }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Employee docs POST error:', error);
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500, headers: corsHeaders() });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(req);
  try {
    const auth = await getAuthInfo(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const { id } = await params;
    const url = new URL(req.url);
    const docId = url.searchParams.get('docId');
    if (!docId) return NextResponse.json({ error: 'docId query param is required' }, { status: 400, headers: corsHeaders() });

    await db.document.delete({ where: { id: docId, employeeId: id } });
    return NextResponse.json({ message: 'Document deleted' }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Employee docs DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500, headers: corsHeaders() });
  }
}
