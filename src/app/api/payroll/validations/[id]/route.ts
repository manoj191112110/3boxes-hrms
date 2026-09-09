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
      const validation = await db.payrollValidation.findUnique({ where: { id } });

      if (!validation) {
        return Response.json({ error: 'Validation not found' }, { status: 404, headers: corsHeaders });
      }

      // Parse all JSON fields
      const parsed = {
        ...validation,
        missingPaymentMethods: validation.missingPaymentMethods ? JSON.parse(validation.missingPaymentMethods) : [],
        missingSalaryBasis: validation.missingSalaryBasis ? JSON.parse(validation.missingSalaryBasis) : [],
        heldEmployees: validation.heldEmployees ? JSON.parse(validation.heldEmployees) : [],
        newJoiners: validation.newJoiners ? JSON.parse(validation.newJoiners) : [],
        terminations: validation.terminations ? JSON.parse(validation.terminations) : [],
        errors: validation.errors ? JSON.parse(validation.errors) : [],
        warnings: validation.warnings ? JSON.parse(validation.warnings) : [],
      };

      return Response.json({ data: parsed }, { headers: corsHeaders });
    } catch (dbError: unknown) {
      console.error('Database error fetching validation detail:', dbError);
      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    }
  } catch (error: unknown) {
    console.error('Error fetching validation detail:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
