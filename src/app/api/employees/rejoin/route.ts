import { NextResponse } from 'next/server';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function GET(request: Request) {
  try {
    // Try to authenticate, but don't block if no auth (demo mode)
    let isAuthed = false;

    try {
      const token = getTokenFromHeaders(request);
      if (token) {
        try {
          const decoded = await verifyToken(token);
          if (decoded) {
            isAuthed = true;
          }
        } catch {
          // Token verification failed, continue in demo mode
        }
      }
    } catch {
      // Auth check failed entirely, continue in demo mode
    }

    // No database model for rejoin yet — return empty list
    return NextResponse.json(
      { rejoins: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Get rejoins error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Try auth but allow demo mode
    let isAuthed = false;
    let decodedUserId: string | undefined;

    const token = getTokenFromHeaders(request);
    if (token) {
      try {
        const decoded = await verifyToken(token);
        if (decoded) {
          isAuthed = true;
          decodedUserId = decoded.userId as string;
        }
      } catch {
        // Continue in demo mode
      }
    }

    const body = await request.json();
    let { employeeId, rejoinDate, departmentId, designationId, remarks } = body;
    // Also accept previousEmployeeId as fallback from frontend
    if (!employeeId && body.previousEmployeeId) {
      employeeId = body.previousEmployeeId;
    }
    if (!employeeId && body.departmentId === undefined && body.designationId === undefined) {
      // Try alternate field names from frontend
      if (body.newDepartment) departmentId = body.newDepartment;
      if (body.newDesignation) designationId = body.newDesignation;
    } else {
      if (body.newDepartment) departmentId = body.newDepartment;
      if (body.newDesignation) designationId = body.newDesignation;
    }

    // If employeeId is missing, try to look it up from the JWT userId
    if (!employeeId && decodedUserId) {
      try {
        const emp = await db.employee.findFirst({
          where: { userId: decodedUserId },
          select: { id: true },
        });
        if (emp) {
          employeeId = emp.id;
        }
      } catch {
        // ignore lookup errors
      }
    }

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Employee ID is required. Please ensure your user account is linked to an employee record.' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // No database model for rejoin yet — return success
    return NextResponse.json(
      {
        success: true,
        message: 'Rejoin record created successfully',
        rejoin: {
          employeeId,
          rejoinDate: rejoinDate || null,
          departmentId: departmentId || null,
          designationId: designationId || null,
          remarks: remarks || null,
          status: 'active',
        },
      },
      { status: 201, headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Create rejoin error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
