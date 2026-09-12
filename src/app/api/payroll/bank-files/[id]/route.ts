import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { getTokenFromHeaders, verifyToken } from '@/lib/auth';
import { NextRequest } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getTokenFromHeaders(_request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { id } = await params;

    try {
      const bankFile = await db.bankPaymentFile.findUnique({ where: { id } });

      if (!bankFile) {
        return Response.json({ error: 'Bank file not found' }, { status: 404, headers: corsHeaders });
      }

      return Response.json({ data: bankFile }, { headers: corsHeaders });
    } catch (dbError: unknown) {
      console.error('Database error fetching bank file detail:', dbError);
      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    }
  } catch (error: unknown) {
    console.error('Error fetching bank file detail:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    // Validate status
    const validStatuses = ['submitted', 'acknowledged', 'rejected'];
    if (!status || !validStatuses.includes(status)) {
      return Response.json({ error: `Status must be one of: ${validStatuses.join(', ')}` }, { status: 400, headers: corsHeaders });
    }

    try {
      const existing = await db.bankPaymentFile.findUnique({ where: { id } });
      if (!existing) {
        return Response.json({ error: 'Bank file not found' }, { status: 404, headers: corsHeaders });
      }

      const updateData: Record<string, unknown> = { status };
      if (status === 'submitted') {
        updateData.generatedAt = new Date();
      }

      const updated = await db.bankPaymentFile.update({
        where: { id },
        data: updateData,
      });

      return Response.json({ data: updated, message: `Bank file status updated to ${status}` }, { headers: corsHeaders });
    } catch (dbError: unknown) {
      console.error('Database error updating bank file:', dbError);
      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    }
  } catch (error: unknown) {
    console.error('Error updating bank file:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
