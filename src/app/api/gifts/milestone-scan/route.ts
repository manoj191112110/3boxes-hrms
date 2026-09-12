import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
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

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 86400000);

    // Birthdays today
    const birthdayEmployees = await db.employee.findMany({ where: { status: 'active', dateOfBirth: { not: null } } });
    const birthdayGifts = [];
    for (const emp of birthdayEmployees) {
      if (!emp.dateOfBirth) continue;
      const dob = new Date(emp.dateOfBirth);
      if (dob.getMonth() === today.getMonth() && dob.getDate() === today.getDate()) {
        const existing = await db.gift.findFirst({ where: { recipientId: emp.id, triggerEvent: 'birthday', createdAt: { gte: today } } });
        if (!existing) {
          const g = await db.gift.create({ data: { recipientId: emp.id, triggerEvent: 'birthday', message: 'Happy Birthday from the team!', value: 0, currency: 'INR', status: 'sent' } });
          birthdayGifts.push(g);
        }
      }
    }

    // Work anniversaries today
    const anniversaryGifts = [];
    for (const emp of birthdayEmployees) {
      if (!emp.dateOfJoining) continue;
      const doj = new Date(emp.dateOfJoining);
      if (doj.getMonth() === today.getMonth() && doj.getDate() === today.getDate() && doj.getFullYear() < today.getFullYear()) {
        const years = today.getFullYear() - doj.getFullYear();
        const existing = await db.gift.findFirst({ where: { recipientId: emp.id, triggerEvent: 'work_anniversary', createdAt: { gte: today } } });
        if (!existing) {
          const g = await db.gift.create({ data: { recipientId: emp.id, triggerEvent: 'work_anniversary', message: `Happy ${years} anniversary!`, value: 0, currency: 'INR', status: 'sent' } });
          anniversaryGifts.push(g);
        }
      }
    }

    return NextResponse.json({ birthdayGifts: birthdayGifts.length, anniversaryGifts: anniversaryGifts.length, totalSent: birthdayGifts.length + anniversaryGifts.length, scannedAt: now.toISOString() }, { headers: corsHeaders() });
  } catch (error) { console.error('Milestone scan error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
