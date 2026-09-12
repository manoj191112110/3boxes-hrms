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

    const data = await db.cTCTemplate.findUnique({
      where: { id },
      include: { componentMappings: { orderBy: { calculationSequence: 'asc' } } },
    });

    if (!data) return Response.json({ error: 'CTC template not found' }, { status: 404, headers: corsHeaders });

    return Response.json({ data }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error fetching CTC template:', error);
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
    const { componentMappings, ...templateData } = body;

    // Delete existing mappings and recreate
    if (componentMappings) {
      await db.cTCComponentMapping.deleteMany({ where: { ctcTemplateId: id } });
    }

    const data = await db.cTCTemplate.update({
      where: { id },
      data: {
        ...templateData,
        componentMappings: componentMappings
          ? { create: componentMappings }
          : undefined,
      },
      include: { componentMappings: { orderBy: { calculationSequence: 'asc' } } },
    });

    return Response.json({ data, message: 'CTC template updated successfully' }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error updating CTC template:', error);
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

    await db.cTCComponentMapping.deleteMany({ where: { ctcTemplateId: id } });
    await db.cTCTemplate.delete({ where: { id } });

    return Response.json({ message: 'CTC template deleted successfully' }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error deleting CTC template:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
