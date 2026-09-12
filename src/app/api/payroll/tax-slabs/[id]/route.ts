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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const data = await db.taxSlabTable.findUnique({
      where: { id },
      include: { rateLines: { orderBy: { sequence: 'asc' } } },
    });

    if (!data) return Response.json({ error: 'Tax slab table not found' }, { status: 404, headers: corsHeaders });

    return Response.json({ data }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error fetching tax slab table:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const body = await request.json();
    const { rateLines, ...slabData } = body;

    if (rateLines) {
      await db.taxSlabRateLine.deleteMany({ where: { slabTableId: id } });
    }

    const data = await db.taxSlabTable.update({
      where: { id },
      data: {
        ...slabData,
        rateLines: rateLines
          ? { create: rateLines }
          : undefined,
      },
      include: { rateLines: { orderBy: { sequence: 'asc' } } },
    });

    return Response.json({ data, message: 'Tax slab table updated successfully' }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error updating tax slab table:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    await db.taxSlabRateLine.deleteMany({ where: { slabTableId: id } });
    await db.taxSlabTable.delete({ where: { id } });

    return Response.json({ message: 'Tax slab table deleted successfully' }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error deleting tax slab table:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
