/**
 * 3Boxes HRMS — Shared API helpers for the Attendance & Leave Addendum APIs.
 *
 * These helpers reduce boilerplate across the new endpoints
 * (regularization, permission, gatepass, OT request, comp-off, geofence,
 * WFH snapshot, burnout, audit log, leave encashment, attachments,
 * collaborative check, rosters, holiday elections, policy config, routing).
 */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { getDb } from '@/lib/tenant-db';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: CORS });
}

export function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status, headers: CORS });
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS });
}

/** Authenticate the request; returns the decoded user or a 401 response. */
export async function requireUser(request: Request): Promise<{
  user: Record<string, any> | null;
  response: Response | null;
}> {
  const token = getTokenFromHeaders(request);
  if (!token) return { user: null, response: fail('No token provided', 401) };
  const decoded = await verifyToken(token);
  if (!decoded) return { user: null, response: fail('Invalid or expired token', 401) };
  // JWT payloads are loosely typed — cast to a permissive record so callers
  // can access .role / .email / .id / .tenantId without TS friction.
  return { user: decoded as unknown as Record<string, any>, response: null };
}

/**
 * Find the employee record matching the authenticated user's email.
 * Uses the tenant-scoped DB (via getDb) so it works correctly in multi-tenant
 * setups. Falls back to platform prisma if db is not provided (backward compat).
 */
export async function findEmployeeByEmail(email: string | undefined | null, db?: any) {
  if (!email) return null;
  const client = db || prisma;
  return client.employee.findFirst({
    where: { email },
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      email: true,
      branchId: true,
      departmentId: true,
      companyId: true,
      designationId: true,
      employeeType: true,   // full_time | part_time | contract | temporary | consultant
      status: true,         // active | on_leave | inactive
    },
  });
}

/** True if the user role is admin-level. */
export function isAdminRole(role: string | undefined | null) {
  return !!role && ['super_admin', 'tenant_admin', 'admin'].includes(role);
}

/** Parse a JSON body safely. */
export async function parseBody(request: Request): Promise<Record<string, any> | null> {
  try {
    const text = await request.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Parse a query string into a record. */
export function getQuery(request: Request): Record<string, string> {
  return Object.fromEntries(new URL(request.url).searchParams.entries());
}

export { prisma };
