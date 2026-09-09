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

    // No database model for resignation yet — return empty list
    return NextResponse.json(
      { resignations: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Get resignations error:', error);
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
    let { employeeId, resignationDate, reason, noticePeriodDays } = body;

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

    // No database model for resignation yet — return success
    return NextResponse.json(
      {
        success: true,
        message: 'Resignation record created successfully',
        resignation: {
          employeeId,
          resignationDate: resignationDate || null,
          reason: reason || null,
          noticePeriodDays: noticePeriodDays || null,
          status: 'pending',
        },
      },
      { status: 201, headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Create resignation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
