import { NextRequest, NextResponse } from 'next/server';

/**
 * Legacy auth route - kept for backward compatibility.
 * Demo users have been removed for production deployment.
 * All authentication now goes through /api/auth/login which uses
 * the database with bcrypt password hashing and JWT tokens.
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Redirect to the primary auth endpoint
    return NextResponse.json(
      { error: 'Please use /api/auth/login for authentication' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
