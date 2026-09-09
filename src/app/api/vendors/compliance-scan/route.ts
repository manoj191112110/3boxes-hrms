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
    const days30 = new Date(now.getTime() + 30 * 86400000);
    const days15 = new Date(now.getTime() + 15 * 86400000);
    const days7  = new Date(now.getTime() + 7  * 86400000);

    // Find docs that need reminders
    const [need30, need15, need7, expired] = await Promise.all([
      db.vendorDocument.findMany({ where: { expiryDate: { lte: days30, gt: days15 }, reminderSent30: false }, include: { vendor: { select: { id: true, name: true, contactEmail: true } } } }),
      db.vendorDocument.findMany({ where: { expiryDate: { lte: days15, gt: days7 }, reminderSent15: false }, include: { vendor: { select: { id: true, name: true, contactEmail: true } } } }),
      db.vendorDocument.findMany({ where: { expiryDate: { lte: days7, gt: now }, reminderSent7: false }, include: { vendor: { select: { id: true, name: true, contactEmail: true } } } }),
      db.vendorDocument.findMany({ where: { expiryDate: { lt: now }, status: { not: 'expired' } }, include: { vendor: { select: { id: true, name: true, contactEmail: true } } } }),
    ]);

    const sent = [];
    for (const d of need30) { await db.vendorDocument.update({ where: { id: d.id }, data: { reminderSent30: true, status: 'expiring' } }); sent.push({ docId: d.id, vendor: d.vendor.name, type: d.type, days: 30 }); }
    for (const d of need15) { await db.vendorDocument.update({ where: { id: d.id }, data: { reminderSent15: true, status: 'expiring' } }); sent.push({ docId: d.id, vendor: d.vendor.name, type: d.type, days: 15 }); }
    for (const d of need7)  { await db.vendorDocument.update({ where: { id: d.id }, data: { reminderSent7: true, status: 'expiring' } }); sent.push({ docId: d.id, vendor: d.vendor.name, type: d.type, days: 7 }); }
    for (const d of expired) { await db.vendorDocument.update({ where: { id: d.id }, data: { status: 'expired' } }); sent.push({ docId: d.id, vendor: d.vendor.name, type: d.type, days: 0, expired: true }); }
    // (In production: send emails to vendor.contactEmail and tenant admin here)
    return NextResponse.json({ sent, total: sent.length, scannedAt: now.toISOString() }, { headers: corsHeaders() });
  } catch (error) { console.error('Compliance scan error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
