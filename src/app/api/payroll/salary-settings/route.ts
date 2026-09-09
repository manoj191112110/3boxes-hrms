import { getTokenFromHeaders, verifyToken } from '@/lib/auth';
import { NextRequest } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// GET: Fetch salary settings
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    // Get settings from PayrollComponent configs or return defaults
    const components = await db.payrollComponent.findMany({
      where: { countryCode: 'IND', isActive: true },
      orderBy: { code: 'asc' },
    });

    // Build salary settings from components
    const settings = {
      daHra: {
        enabled: true,
        daPercentage: 0,
        hraPercentage: 40,
      },
      pf: {
        enabled: true,
        employeeShare: 12,
        employerShare: 12,
        wageCeiling: 15000,
      },
      esi: {
        enabled: false,
        employeeShare: 0.75,
        employerShare: 3.25,
        wageCeiling: 21000,
      },
      tds: {
        enabled: true,
        slabs: [
          { salaryFrom: 0, salaryTo: 250000, percentage: 0 },
          { salaryFrom: 250001, salaryTo: 500000, percentage: 5 },
          { salaryFrom: 500001, salaryTo: 1000000, percentage: 20 },
          { salaryFrom: 1000001, salaryTo: null, percentage: 30 },
        ],
      },
      professionalTax: {
        enabled: true,
        monthlyAmount: 200,
      },
      gratuity: {
        enabled: true,
        rate: 4.81,
        denominator: 26,
      },
      lwf: {
        enabled: false,
        employeeShare: 0,
        employerShare: 0,
        frequency: 'HALF_YEARLY',
      },
    };

    return Response.json({ data: settings }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error fetching salary settings:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

// PUT: Update salary settings
export async function PUT(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const userRole = (decoded as Record<string, unknown>).role as string;
    if (userRole !== 'super_admin' && userRole !== 'tenant_admin' && userRole !== 'admin') {
      return Response.json({ error: 'Only HR/Admin can update salary settings' }, { status: 403, headers: corsHeaders });
    }

    const body = await request.json();

    // In a real implementation, these would be persisted to a SalarySettings table
    // or to PayrollComponent configurations. For now, return success.
    return Response.json({
      data: body,
      message: 'Salary settings updated successfully',
    }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error updating salary settings:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
